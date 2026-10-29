"""CoinGecko metadata is source-attributed, never a verified operating business.
Ticker lookup creates candidates only. Identity resolution requires researcher evidence.
"""
import json
import os
from urllib.parse import quote
from .http import Client, FetchError
from .db import now

class CoinGecko:
    def __init__(self, db, client=None):
        self.db = db
        self.base = os.environ.get('COINGECKO_API_BASE', 'https://api.coingecko.com/api/v3').rstrip('/')
        if self.base not in ('https://api.coingecko.com/api/v3','https://pro-api.coingecko.com/api/v3'):
            raise ValueError('Unsupported CoinGecko API base')
        pro = self.base.startswith('https://pro-api.')
        key = os.environ.get('COINGECKO_PRO_API_KEY' if pro else 'COINGECKO_DEMO_API_KEY')
        self.headers = {('x-cg-pro-api-key' if pro else 'x-cg-demo-api-key'):key} if key else {}
        if pro and not key:
            raise ValueError('Pro API requires COINGECKO_PRO_API_KEY')
        self.client = client or Client(db, interval=max(1,float(os.environ.get('COINGECKO_REQUEST_INTERVAL','7'))))

    def discover(self):
        url = self.base+'/coins/list?include_platform=true'
        payload = self.client.get(url, ttl=86400, headers=self.headers)
        try:
            if not isinstance(payload,list) or not payload:
                raise ValueError('CoinGecko returned an invalid or empty coin list')
            for coin in payload:
                if not isinstance(coin,dict) or not all(isinstance(coin.get(k),str) and coin[k] for k in ('id','name','symbol')):
                    raise ValueError('Malformed CoinGecko identity; index update rejected')
        except ValueError:
            # A syntactically valid error payload must not poison the daily cache.
            with self.db:
                self.db.execute('DELETE FROM cache WHERE url=?',(url,))
            raise
        index = {}
        with self.db:
            for coin in payload:
                self.db.execute('''INSERT INTO identities(id,name,ticker,platforms_json) VALUES(?,?,?,?)
                ON CONFLICT(id) DO UPDATE SET name=excluded.name,ticker=excluded.ticker,platforms_json=excluded.platforms_json''',
                (coin['id'],coin['name'],coin['symbol'],json.dumps(coin.get('platforms') or {})))
                index.setdefault(coin['symbol'].casefold(),[]).append({'id':coin['id'],'name':coin['name']})
            for asset in self.db.execute('SELECT id,code FROM assets').fetchall():
                self.db.execute('UPDATE assets SET candidates_json=? WHERE id=?',(json.dumps(index.get(asset['code'].casefold(),[])),asset['id']))
        return len(payload)

    def enrich(self, limit=20):
        # Resume from missing/stale profiles. Canonical ID shared across exchange observations.
        identities = self.db.execute('''SELECT DISTINCT i.* FROM identities i JOIN assets a ON a.identity_id=i.id
         WHERE a.match_status='verified' AND (i.enriched_at IS NULL OR julianday('now')-julianday(i.enriched_at)>7)
         ORDER BY COALESCE(i.last_enrichment_attempt_at,''),i.id LIMIT ?''',(limit,)).fetchall()
        completed, failures = 0, []
        for identity in identities:
            url = self.base+'/coins/'+quote(identity['id'],safe='')+'?localization=false&tickers=true&market_data=false&community_data=true&developer_data=true&sparkline=false'
            try:
                payload = self.client.get(url, ttl=7*86400, headers=self.headers)
                if not isinstance(payload,dict) or payload.get('id') != identity['id']:
                    raise ValueError('CoinGecko detail identity mismatch')
                # Preserve entire documented response: links, descriptions, platforms,
                # categories, developer metadata, and available (paginated) tickers.
                with self.db:
                    self.db.execute('UPDATE identities SET profile_json=?,enriched_at=?,source_url=?,last_enrichment_attempt_at=?,enrichment_error=NULL,platforms_json=? WHERE id=?', (json.dumps(payload),now(),url,now(),json.dumps(payload.get('platforms') or json.loads(identity['platforms_json'])),identity['id']))
                completed += 1
            except Exception as exc:
                failures.append({'id':identity['id'],'error':str(exc)})
                with self.db:
                    self.db.execute('UPDATE identities SET last_enrichment_attempt_at=?,enrichment_error=? WHERE id=?',(now(),str(exc),identity['id']))
                    if isinstance(exc,ValueError):
                        self.db.execute('DELETE FROM cache WHERE url=?',(url,))
                # Continue permanent identity-specific failures, but stop on transport,
                # quota, credentials, or server errors to avoid wasting the request budget.
                if isinstance(exc,FetchError) and exc.status not in (400,404,410):
                    break
                if not isinstance(exc,(ValueError,FetchError)):
                    break
        return {'enriched':completed,'failures':failures}
