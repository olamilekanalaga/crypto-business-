import csv
import json
import logging
from collections import Counter
from .db import now, data_dir, rows
from .http import Client
from .connectors.binance import BinanceSpot


def ingest(db, connector=None, client=None):
    connector = connector or BinanceSpot()
    client = client or Client(db)
    started = now()
    run_id = db.execute('INSERT INTO runs(connector,started_at,status) VALUES(?,?,?)', (connector.name, started, 'running')).lastrowid
    db.commit()
    try:
        payload = client.get(connector.url)
        normalized = connector.normalize(payload)
        symbols = Counter(p['symbol'] for p in normalized)
        duplicates = sum(n-1 for n in symbols.values())
        if duplicates:
            raise ValueError(f'{duplicates} duplicate symbols in response; refusing ambiguous snapshot')
        bases = {p['base'] for p in normalized}
        with db:
            db.execute('BEGIN IMMEDIATE')
            if db.execute("SELECT 1 FROM runs WHERE connector=? AND status='success' AND id>?", (connector.name, run_id)).fetchone():
                raise ValueError('A newer extraction already succeeded; refusing to overwrite it with an older response')
            db.execute('UPDATE listings SET available=0 WHERE exchange=?', (connector.name,))
            for pair in normalized:
                asset = db.execute('SELECT id FROM assets WHERE exchange=? AND code=?', (connector.name, pair['base'])).fetchone()
                if asset:
                    asset_id = asset['id']
                    db.execute('UPDATE assets SET last_seen=? WHERE id=?', (started, asset_id))
                else:
                    asset_id = db.execute("INSERT INTO entities(kind,name,created_at) VALUES('asset',?,?)", (pair['base'], started)).lastrowid
                    db.execute('INSERT INTO assets(id,exchange,code,first_seen,last_seen) VALUES(?,?,?,?,?)', (asset_id, connector.name, pair['base'], started, started))
                db.execute('''INSERT INTO listings VALUES(?,?,?,?,?,?,?,1,?,?,?) ON CONFLICT(exchange,symbol) DO UPDATE SET
                asset_id=excluded.asset_id,base_asset=excluded.base_asset,quote_asset=excluded.quote_asset,status=excluded.status,
                spot_allowed=excluded.spot_allowed,available=1,last_seen=excluded.last_seen,run_id=excluded.run_id''',
                (connector.name, pair['symbol'], asset_id, pair['base'], pair['quote'], pair['status'], pair['spot'], started, started, run_id))
                db.execute('INSERT INTO listing_observations VALUES(?,?,?,?,?,?,?)', (run_id, connector.name, pair['symbol'], pair['base'], pair['quote'], pair['status'], pair['spot']))
            db.execute('UPDATE runs SET status=?,completed_at=?,pair_count=?,unique_assets=?,duplicate_symbols=?,raw_path=?,sha256=? WHERE id=?',
                       ('success', now(), len(normalized), len(bases), duplicates, client.last_meta.get('raw_path'), client.last_meta.get('sha256'), run_id))
        # Export is derived output; a disk error must not relabel committed ingestion.
        try:
            export(db)
        except OSError:
            logging.exception('Snapshot committed, but export failed. Run python -m terminal export to retry.')
        return run_id
    except Exception as exc:
        db.rollback()
        db.execute('UPDATE runs SET status=?,completed_at=?,error=?,raw_path=?,sha256=? WHERE id=?', ('failed', now(), str(exc), client.last_meta.get('raw_path'), client.last_meta.get('sha256'), run_id))
        db.commit()
        raise


def export(db):
    path = data_dir() / 'exports'
    path.mkdir(exist_ok=True)
    pairs = rows(db, 'SELECT * FROM listings ORDER BY exchange,symbol')
    assets = rows(db, '''SELECT a.*, (SELECT COUNT(*) FROM listings l WHERE l.asset_id=a.id) AS pair_count FROM assets a ORDER BY exchange,code''')
    for name, values in [('trading_pairs',pairs),('assets',assets)]:
        (path / f'{name}.json').write_text(json.dumps(values, indent=2))
        if values:
            with (path / f'{name}.csv').open('w', newline='') as stream:
                writer = csv.DictWriter(stream, fieldnames=list(values[0]))
                writer.writeheader()
                writer.writerows(values)
