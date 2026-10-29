"""Synthetic asset fixture for browser tests. No network and never production data.

Run only with TERMINAL_DATA_DIR set to a disposable directory outside data/.
The injected Client opener supplies synthetic Binance/CoinGecko responses.
"""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from terminal.db import connect
from terminal.http import Client
from terminal.ingest import ingest
from terminal.enrich import CoinGecko
from terminal.service import dispatch

configured = os.environ.get('TERMINAL_DATA_DIR')
if not configured:
    raise SystemExit('TERMINAL_DATA_DIR must be set to an isolated browser-test directory')
if Path(configured).resolve() == (ROOT / 'data').resolve():
    raise SystemExit('Refusing to put test fixtures in the production data directory')


class Response:
    status = 200
    def __init__(self, payload): self.body = json.dumps(payload).encode()
    def __enter__(self): return self
    def __exit__(self, *_): return False
    def read(self): return self.body


def client(db, payload):
    return Client(db, attempts=1, opener=lambda *_, **__: Response(payload), sleeper=lambda _: None)


db = connect()
try:
    if len(sys.argv)>1 and sys.argv[1] == 'enrich':
        profile = {
            'id': 'test-fixture-project', 'name': 'Test Fixture Project', 'symbol': 'testfixture',
            'description': {'en': '<p>TEST FIXTURE: source-provided metadata, not business verification.</p>'},
            'links': {'homepage': ['https://example.test/test-fixture-project'],
                      'twitter_screen_name': 'TESTFIXTURE',
                      'repos_url': {'github': ['https://example.test/test-fixture-repository']}},
            'platforms': {'test-fixture-network': '0xTESTFIXTUREUNVERIFIED'},
            'categories': ['Test Fixture Category'],
            'tickers': [{'base': 'TESTFIXTURE', 'target': 'USD', 'market': {'name': 'Test Fixture Exchange'}}],
        }
        print(json.dumps(CoinGecko(db, client(db, profile)).enrich()))
    else:
        ingest(db, client=client(db, {'symbols': [
            {'symbol': 'TESTFIXTUREUSD', 'baseAsset': 'TESTFIXTURE', 'quoteAsset': 'USD', 'status': 'TRADING', 'isSpotTradingAllowed': True},
            {'symbol': 'TESTFIXTUREEUR', 'baseAsset': 'TESTFIXTURE', 'quoteAsset': 'EUR', 'status': 'BREAK', 'isSpotTradingAllowed': True},
        ]}))
        CoinGecko(db, client(db, [
            {'id': 'test-fixture-project', 'name': 'Test Fixture Project', 'symbol': 'testfixture', 'platforms': {'test-fixture-network': '0xTESTFIXTUREUNVERIFIED'}},
            {'id': 'test-fixture-ticker-collision', 'name': 'Test Fixture Unrelated Project', 'symbol': 'testfixture', 'platforms': {}},
        ])).discover()
        asset_id = db.execute("SELECT id FROM assets WHERE exchange='binance' AND code='TESTFIXTURE'").fetchone()[0]
        dispatch(db, {'action':'unresolve','data':{'asset_id':asset_id}})
        print(json.dumps({'asset_id': asset_id}))
finally:
    db.close()
