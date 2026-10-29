"""Auditable HTTP transport: immutable responses, expiring cache, bounded retries."""
import hashlib
import json
import logging
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from .db import data_dir, now

log = logging.getLogger(__name__)

class FetchError(RuntimeError):
    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status

class Client:
    def __init__(self, db, interval=0, attempts=3, opener=None, sleeper=time.sleep):
        self.db, self.interval, self.attempts = db, interval, attempts
        self.opener = opener or urllib.request.urlopen
        self.sleep = sleeper
        self.last_request = 0
        self.last_meta = {}

    def get(self, url, ttl=0, headers=None):
        cached = self.db.execute('SELECT * FROM cache WHERE url=? AND expires_at>?', (url, time.time())).fetchone()
        if cached:
            self.last_meta = {'raw_path': cached['raw_path'], 'sha256': cached['sha256']}
            self.db.execute('INSERT INTO requests(url,observed_at,status,raw_path,sha256,cache_hit) VALUES(?,?,200,?,?,1)', (url, now(), cached['raw_path'], cached['sha256']))
            self.db.commit()
            return json.loads(cached['body'])
        for attempt in range(self.attempts):
            self.sleep(max(0, self.interval - (time.monotonic() - self.last_request)))
            self.last_request = time.monotonic()
            status, body, error, retry_after = None, b'', None, None
            try:
                req = urllib.request.Request(url, headers={'User-Agent':'CryptoBusinessResearch/0.1', 'Accept':'application/json', **(headers or {})})
                with self.opener(req, timeout=40) as response:
                    status, body = response.status, response.read()
            except urllib.error.HTTPError as exc:
                status, body, error = exc.code, exc.read(), f'HTTP {exc.code}'
                retry_after = exc.headers.get('Retry-After')
            except (urllib.error.URLError, TimeoutError, OSError) as exc:
                error = str(exc)
            digest = hashlib.sha256(body).hexdigest()
            folder = data_dir() / 'raw'
            folder.mkdir(exist_ok=True)
            # Timestamp + hash retains every response body. Keys only travel in headers.
            path = folder / f'{time.time_ns()}-{digest[:12]}.json'
            path.write_bytes(body)
            self.last_meta = {'raw_path': str(path), 'sha256': digest}
            parsed = None
            if error is None:
                try:
                    parsed = json.loads(body)
                except (ValueError, UnicodeError):
                    error = 'Response was not valid JSON'
            self.db.execute('INSERT INTO requests(url,observed_at,status,error,raw_path,sha256) VALUES(?,?,?,?,?,?)', (url, now(), status, error, str(path), digest))
            self.db.commit()
            if error is None:
                if ttl:
                    self.db.execute('INSERT OR REPLACE INTO cache VALUES(?,?,?,?,?)', (url, body.decode(), time.time()+ttl, str(path), digest))
                    self.db.commit()
                return parsed
            log.warning('%s: %s (attempt %s/%s)', url, error, attempt+1, self.attempts)
            if attempt+1 >= self.attempts or (status is not None and status not in (408,418,429) and status < 500):
                raise FetchError(f'{url}: {error}', status=status)
            wait = 2 ** (attempt+1)
            if retry_after:
                try:
                    wait = float(retry_after)
                except ValueError:
                    try:
                        wait = (parsedate_to_datetime(retry_after)-datetime.now(timezone.utc)).total_seconds()
                    except (ValueError, TypeError):
                        pass
            # Do not retry earlier than a long server-requested cooldown.
            if wait > 60:
                raise FetchError(f'{url}: retry deferred; server requests {wait:.0f}s cooldown', status=status)
            self.sleep(max(0, wait))
