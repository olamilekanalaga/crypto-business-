"""Offline fixture tests. All names, pairs, contracts, and evidence are synthetic.

Never import test fixtures into the production database. Every test uses its own
TERMINAL_DATA_DIR and an injected HTTP opener; no external requests are made.
"""
import hashlib
import io
import json
import os
import sqlite3
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

from terminal.db import connect, now
from terminal.enrich import CoinGecko
from terminal.http import Client, FetchError
from terminal.ingest import ingest
from terminal.report import quality, write_report
from terminal.service import dispatch


OBSERVED_AT = '2026-01-02T03:04:05+00:00'


def pair(symbol='FIXUSD', base='FIX', quote='USD', status='TRADING', spot=True):
    return {'symbol': symbol, 'baseAsset': base, 'quoteAsset': quote,
            'status': status, 'isSpotTradingAllowed': spot}


class Response:
    status = 200

    def __init__(self, payload=None, raw=None):
        self.raw = raw if raw is not None else json.dumps(payload).encode()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self):
        return self.raw


class OfflineCase(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='crypto-terminal-test-')
        self.environment = patch.dict(os.environ, {
            'TERMINAL_DATA_DIR': self.temp.name,
            'COINGECKO_API_BASE': 'https://api.coingecko.com/api/v3',
            'COINGECKO_DEMO_API_KEY': '',
            'COINGECKO_PRO_API_KEY': '',
            'COINGECKO_REQUEST_INTERVAL': '1',
        })
        self.environment.start()
        self.db = connect()
        self.addCleanup(self.temp.cleanup)
        self.addCleanup(self.environment.stop)
        self.addCleanup(self.db.close)

    def scalar(self, sql, params=()):
        return self.db.execute(sql, params).fetchone()[0]

    def call(self, action, **data):
        return dispatch(self.db, {'action': action, 'data': data})

    def client(self, payload, requests=None):
        def opener(request, **_):
            if requests is not None:
                requests.append(request)
            return Response(payload)
        return Client(self.db, attempts=1, opener=opener, sleeper=lambda _: None)

    def ingest(self, pairs=None, connector=None):
        return ingest(self.db, connector=connector,
                      client=self.client({'symbols': pairs if pairs is not None else [pair()]}))

    def subject(self, name='Synthetic business', kind='organisation'):
        return self.call('save_entity', name=name, kind=kind)['id']

    def evidence(self, verification='confirmed'):
        return self.call('save_evidence', title='Synthetic source passage',
                         url='https://example.test/official-documentation',
                         source_type='Official documentation', observed_at=OBSERVED_AT,
                         original_text='Fixture provider supplies a service to fixture customers.',
                         interpretation='Synthetic researcher interpretation.',
                         verification=verification)['id']

    def discover(self, coins):
        return CoinGecko(self.db, client=self.client(coins)).discover()

    def resolve(self, asset_id, identity='fixture-token'):
        return self.call('resolve', asset_id=asset_id, identity_id=identity,
                         evidence_id=self.evidence())


class IngestionTests(OfflineCase):
    def test_deduplicates_base_assets_and_preserves_all_pairs_and_statuses(self):
        self.ingest([pair(), pair('FIXEUR', quote='EUR'),
                     pair('OLDUSD', base='OLD', status='BREAK'),
                     pair('NOSPOTUSD', base='NOSPOT', spot=False)])
        self.assertEqual(self.scalar('SELECT COUNT(*) FROM assets'), 3)
        self.assertEqual(self.scalar('SELECT COUNT(*) FROM listings'), 4)
        fix_id = self.scalar("SELECT id FROM assets WHERE code='FIX'")
        detail = self.call('detail', id=fix_id)
        self.assertEqual({p['symbol'] for p in detail['listings']}, {'FIXUSD', 'FIXEUR'})
        self.assertIsNone(detail['identity'])
        self.assertEqual(quality(self.db)['active_pairs'], 2)
        self.assertEqual(quality(self.db)['inactive_pairs'], 2)
        self.assertEqual(self.scalar("SELECT COUNT(*) FROM entities WHERE kind!='asset'"), 0)

    def test_repeatable_refresh_preserves_ids_and_research_without_duplicate_records(self):
        first_run = self.ingest([pair(), pair('FIXEUR', quote='EUR')])
        asset = dict(self.db.execute('SELECT * FROM assets').fetchone())
        self.call('save_claim', entity_id=asset['id'], field='customers',
                  statement='Synthetic research question remains open.',
                  status='hypothesis', observed_at=OBSERVED_AT)
        second_run = self.ingest([pair(), pair('FIXEUR', quote='EUR')])
        self.assertGreater(second_run, first_run)
        self.assertEqual(self.scalar('SELECT COUNT(*) FROM assets'), 1)
        self.assertEqual(self.scalar('SELECT COUNT(*) FROM listings'), 2)
        self.assertEqual(self.scalar('SELECT COUNT(*) FROM listing_observations'), 4)
        after = dict(self.db.execute('SELECT * FROM assets').fetchone())
        self.assertEqual(after['id'], asset['id'])
        self.assertEqual(after['first_seen'], asset['first_seen'])
        self.assertEqual(self.scalar('SELECT COUNT(*) FROM claims'), 1)

    def test_missing_pair_is_unavailable_but_retained_in_observations(self):
        self.ingest([pair(), pair('FIXEUR', quote='EUR')])
        self.ingest([pair(status='BREAK')])
        pairs = {r['symbol']: dict(r) for r in self.db.execute('SELECT * FROM listings')}
        self.assertEqual(pairs['FIXEUR']['available'], 0)
        self.assertEqual(pairs['FIXUSD']['available'], 1)
        self.assertEqual(pairs['FIXUSD']['status'], 'BREAK')
        self.assertEqual(quality(self.db)['total_trading_pairs_retrieved'], 1)
        self.assertEqual(quality(self.db)['unavailable_pairs'], 1)
        self.assertEqual(self.scalar('SELECT COUNT(*) FROM listing_observations'), 3)

    def test_reappearing_pair_keeps_original_first_seen(self):
        self.ingest([pair(), pair('FIXEUR', quote='EUR')])
        first_seen = self.scalar("SELECT first_seen FROM listings WHERE symbol='FIXEUR'")
        self.ingest([pair()])
        self.ingest([pair(), pair('FIXEUR', quote='EUR')])
        self.assertEqual(self.scalar("SELECT first_seen FROM listings WHERE symbol='FIXEUR'"), first_seen)
        self.assertEqual(self.scalar("SELECT available FROM listings WHERE symbol='FIXEUR'"), 1)

    def test_same_ticker_on_different_exchanges_does_not_merge_assets(self):
        class OtherExchange:
            name = 'synthetic_other_exchange'
            url = 'https://example.test/fixture-exchange'

            def normalize(self, payload):
                return [{'symbol': 'FIX-USD', 'base': 'FIX', 'quote': 'USD',
                         'status': 'TRADING', 'spot': 1}]
        self.ingest()
        self.ingest(connector=OtherExchange())
        self.assertEqual(self.scalar('SELECT COUNT(*) FROM assets'), 2)
        self.assertEqual(self.scalar('SELECT COUNT(DISTINCT id) FROM assets'), 2)
        self.assertEqual(self.scalar('SELECT COUNT(*) FROM listings WHERE available=1'), 2)

    def test_failed_transport_preserves_last_good_snapshot(self):
        self.ingest([pair(), pair('FIXEUR', quote='EUR')])
        before = [dict(r) for r in self.db.execute('SELECT * FROM listings ORDER BY symbol')]
        success = quality(self.db)['last_successful_refresh']

        def fail(*_, **__):
            raise urllib.error.URLError('Synthetic network outage')
        with self.assertRaises(FetchError):
            ingest(self.db, client=Client(self.db, attempts=1, opener=fail,
                                          sleeper=lambda _: None))
        self.assertEqual([dict(r) for r in self.db.execute('SELECT * FROM listings ORDER BY symbol')], before)
        report = quality(self.db)
        self.assertEqual(report['total_trading_pairs_retrieved'], 2)
        self.assertEqual(report['last_successful_refresh'], success)
        self.assertEqual(report['latest_attempt']['status'], 'failed')
        self.assertEqual(report['failed_api_requests'], 1)

    def test_empty_malformed_and_duplicate_snapshots_cannot_erase_good_data(self):
        self.ingest()
        snapshots = [{}, {'symbols': []}, {'symbols': [pair(), pair()]},
                     {'symbols': [pair(), {'symbol': 'BROKEN'}]}]
        for payload in snapshots:
            with self.subTest(payload=payload):
                with self.assertRaises(ValueError):
                    ingest(self.db, client=self.client(payload))
                self.assertEqual(self.scalar('SELECT COUNT(*) FROM assets'), 1)
                self.assertEqual(self.scalar('SELECT available FROM listings'), 1)
                self.assertEqual(self.scalar('SELECT COUNT(*) FROM listing_observations'), 1)
                self.assertEqual(quality(self.db)['latest_attempt']['status'], 'failed')
        self.assertEqual(self.scalar("SELECT COUNT(*) FROM runs WHERE status='failed'"), 4)

    def test_raw_response_hash_and_csv_exports_are_auditable(self):
        run_id = self.ingest([pair(), pair('FIXEUR', quote='EUR')])
        run = self.db.execute('SELECT * FROM runs WHERE id=?', (run_id,)).fetchone()
        raw = Path(run['raw_path']).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), run['sha256'])
        self.assertEqual(len(json.loads(raw)['symbols']), 2)
        export_dir = Path(self.temp.name) / 'exports'
        self.assertEqual(len(json.loads((export_dir / 'trading_pairs.json').read_text())), 2)
        self.assertEqual(len(json.loads((export_dir / 'assets.json').read_text())), 1)
        self.assertIn('FIXEUR', (export_dir / 'trading_pairs.csv').read_text())

    def test_export_disk_failure_does_not_relabel_committed_snapshot(self):
        with patch('terminal.ingest.export', side_effect=OSError('Synthetic disk failure')):
            with self.assertLogs(level='ERROR'):
                run_id = self.ingest([pair(), pair('FIXEUR', quote='EUR')])
        run = self.db.execute('SELECT * FROM runs WHERE id=?', (run_id,)).fetchone()
        self.assertEqual(run['status'], 'success')
        self.assertEqual(self.scalar('SELECT COUNT(*) FROM listings'), 2)
        self.assertEqual(quality(self.db)['total_trading_pairs_retrieved'], 2)
        self.assertIsNotNone(quality(self.db)['last_successful_refresh'])

    def test_database_write_failure_rolls_back_whole_snapshot(self):
        self.ingest()

        class BrokenConnector:
            name = 'binance'
            url = 'https://example.test/synthetic-invalid-connector'

            def normalize(self, payload):
                return [
                    {'symbol': 'NEWUSD', 'base': 'NEW', 'quote': 'USD', 'status': 'TRADING', 'spot': 1},
                    {'symbol': 'BADUSD', 'base': 'BAD', 'quote': None, 'status': 'TRADING', 'spot': 1},
                ]
        with self.assertRaises(sqlite3.IntegrityError):
            self.ingest(connector=BrokenConnector())
        self.assertEqual(self.scalar('SELECT COUNT(*) FROM assets'), 1)
        self.assertEqual(self.scalar('SELECT COUNT(*) FROM listings'), 1)
        self.assertEqual(self.scalar('SELECT available FROM listings'), 1)
        self.assertEqual(self.scalar('SELECT COUNT(*) FROM listing_observations'), 1)
        self.assertEqual(quality(self.db)['latest_attempt']['status'], 'failed')
        self.assertEqual(quality(self.db)['total_trading_pairs_retrieved'], 1)

    def test_slow_older_response_cannot_overwrite_newer_successful_snapshot(self):
        case = self
        class DelayedFixtureClient:
            last_meta = {}
            def get(self, url):
                case.ingest([pair('NEWUSD', base='NEW')])
                return {'symbols': [pair('OLDUSD', base='OLD')]}
        with self.assertRaisesRegex(ValueError, 'newer extraction already succeeded'):
            ingest(self.db, client=DelayedFixtureClient())
        self.assertEqual(self.scalar('SELECT symbol FROM listings'), 'NEWUSD')
        self.assertEqual(self.scalar('SELECT code FROM assets'), 'NEW')
        self.assertEqual(self.scalar("SELECT COUNT(*) FROM runs WHERE status='success'"), 1)
        self.assertEqual(self.scalar("SELECT COUNT(*) FROM runs WHERE status='failed'"), 1)
        self.assertEqual(quality(self.db)['total_trading_pairs_retrieved'], 1)

    def test_permission_sets_and_inactive_status_are_separate(self):
        fixture = pair(status='HALT')
        fixture.pop('isSpotTradingAllowed')
        fixture['permissionSets'] = [['SPOT', 'MARGIN']]
        self.ingest([fixture])
        listing = self.db.execute('SELECT * FROM listings').fetchone()
        self.assertEqual(listing['spot_allowed'], 1)
        self.assertEqual(listing['status'], 'HALT')
        self.assertEqual(quality(self.db)['active_pairs'], 0)


class EvidenceAndResearchTests(OfflineCase):
    def test_confirmed_claim_requires_confirmed_evidence(self):
        subject = self.subject()
        claim = dict(entity_id=subject, field='customers',
                     statement='Synthetic consumers need a service.', status='confirmed',
                     observed_at=OBSERVED_AT)
        with self.assertRaisesRegex(ValueError, 'require evidence'):
            self.call('save_claim', **claim)
        with self.assertRaisesRegex(ValueError, 'Confirmed findings require confirmed evidence'):
            self.call('save_claim', **claim, evidence_id=self.evidence('hypothesis'))
        evidence = self.evidence()
        self.call('save_claim', **claim, evidence_id=evidence)
        self.assertEqual(self.scalar('SELECT COUNT(*) FROM claims'), 1)
        detail = self.call('detail', id=subject)
        self.assertEqual(detail['claims'][0]['original_text'],
                         'Fixture provider supplies a service to fixture customers.')
        self.assertEqual(detail['claims'][0]['interpretation'],
                         'Synthetic researcher interpretation.')

    def test_hypothesis_stays_visibly_unverified_without_evidence(self):
        subject = self.subject()
        self.call('save_claim', entity_id=subject, field='recurring_consumption',
                  statement='Maybe this business repeatedly needs a fixture service.',
                  status='hypothesis', observed_at=OBSERVED_AT)
        finding = self.call('detail', id=subject)['claims'][0]
        self.assertEqual(finding['status'], 'hypothesis')
        self.assertIsNone(finding['evidence_id'])
        self.assertIsNone(finding['evidence_url'])

    def test_evidence_url_and_observation_timezone_validation(self):
        for url in ('javascript:alert(1)', 'file:///etc/passwd', 'https://'):
            with self.subTest(url=url), self.assertRaises(ValueError):
                self.call('save_evidence', title='Invalid source', url=url,
                          source_type='Other', observed_at=OBSERVED_AT,
                          original_text='Fixture excerpt', verification='unknown')
        with self.assertRaisesRegex(ValueError, 'timezone'):
            self.call('save_evidence', title='Invalid observation', url='https://example.test',
                      source_type='Other', observed_at='2026-01-02T03:04:05',
                      original_text='Fixture excerpt', verification='unknown')
        self.assertEqual(self.scalar('SELECT COUNT(*) FROM evidence'), 0)

    def test_evidence_is_append_only_and_retains_original_text(self):
        identifier = self.evidence()
        with self.assertRaisesRegex(ValueError, 'append-only'):
            self.call('update_evidence', id=identifier, original_text='Overwrite attempt')
        self.assertEqual(self.scalar('SELECT original_text FROM evidence WHERE id=?', (identifier,)),
                         'Fixture provider supplies a service to fixture customers.')

    def test_links_preserve_token_product_and_organisation_distinction(self):
        self.ingest()
        asset = self.scalar('SELECT id FROM assets')
        org = self.subject()
        product_a = self.subject('Fixture service A', 'product')
        product_b = self.subject('Fixture service B', 'product')
        for product in (product_a, product_b):
            self.call('save_link', from_id=org, to_id=product, type='operates', status='hypothesis', observed_at=OBSERVED_AT)
            self.call('save_link', from_id=product, to_id=asset, type='associated_asset', status='hypothesis', observed_at=OBSERVED_AT)
        with self.assertRaisesRegex(ValueError, 'wrong kind'):
            self.call('save_link', from_id=asset, to_id=org, type='operates', status='hypothesis', observed_at=OBSERVED_AT)
        self.assertEqual(len(self.call('detail', id=asset)['links']), 2)
        self.assertEqual(len(self.call('detail', id=org)['links']), 2)
        self.assertEqual(self.scalar('SELECT COUNT(*) FROM entities'), 4)

    def test_relationship_contains_both_sides_without_assuming_payment(self):
        a = self.subject('Fixture provider A')
        b = self.subject('Fixture provider B')
        relationship = dict(a_id=a, b_id=b, type='integration', a_provides='Fixture API',
                            b_provides='Fixture distribution', reason='Reduce fixture integration work',
                            a_value='Fixture reach', b_value='Fixture functionality',
                            money='unknown', observed_at=OBSERVED_AT, status='hypothesis')
        self.call('save_relationship', **relationship)
        record = self.call('detail', id=a)['relationships'][0]
        self.assertEqual(record['type'], 'integration')
        self.assertEqual(record['money'], 'unknown')
        self.assertEqual(record['status'], 'hypothesis')
        self.assertEqual(record['a_value'], 'Fixture reach')
        self.assertEqual(record['b_value'], 'Fixture functionality')
        self.assertEqual(record['evidence'], [])
        with self.assertRaisesRegex(ValueError, 'require evidence'):
            self.call('save_relationship', **{**relationship, 'status': 'confirmed'})
        self.assertEqual(self.scalar('SELECT COUNT(*) FROM relationships'), 1)
        self.call('save_relationship', **{**relationship, 'status': 'confirmed',
                                         'evidence_id': self.evidence()})
        self.assertEqual(len(self.call('detail', id=b)['relationships'][0]['evidence']), 1)

    def test_business_activity_requires_product_and_confirmed_evidence(self):
        organisation = self.subject()
        product = self.subject('Synthetic activity product', 'product')
        activity = dict(product_id=product, name='Synthetic business action',
                        enables='Test fixture product enables synthetic operators to perform a task.',
                        actor='Synthetic operator', status='confirmed', observed_at=OBSERVED_AT)
        with self.assertRaisesRegex(ValueError, 'require evidence'):
            self.call('save_activity', **activity)
        with self.assertRaisesRegex(ValueError, 'wrong kind'):
            self.call('save_activity', **{**activity, 'product_id': organisation},
                      evidence_id=self.evidence())
        with self.assertRaisesRegex(ValueError, 'Confirmed findings require confirmed evidence'):
            self.call('save_activity', **activity, evidence_id=self.evidence('hypothesis'))
        evidence_id = self.evidence()
        identifier = self.call('save_activity', **activity, evidence_id=evidence_id)['id']
        stored = dict(self.db.execute('SELECT * FROM business_activities WHERE id=?', (identifier,)).fetchone())
        self.assertEqual(stored['product_id'], product)
        self.assertEqual(stored['status'], 'confirmed')
        self.assertEqual(stored['evidence_id'], evidence_id)
        self.assertEqual(self.scalar('SELECT COUNT(*) FROM business_activities'), 1)

    def test_payment_claim_requires_confirmed_evidence_even_for_hypothesis(self):
        a = self.subject('Synthetic payer')
        b = self.subject('Synthetic provider')
        relationship = dict(a_id=a, b_id=b, type='integration', a_provides='Synthetic API',
                            b_provides='Synthetic service', reason='Synthetic problem',
                            a_value='Synthetic value A', b_value='Synthetic value B',
                            observed_at=OBSERVED_AT, status='hypothesis')
        for money in ('yes', 'no'):
            with self.subTest(money=money):
                with self.assertRaisesRegex(ValueError, 'require evidence'):
                    self.call('save_relationship', **relationship, money=money)
                with self.assertRaisesRegex(ValueError, 'Confirmed findings require confirmed evidence'):
                    self.call('save_relationship', **relationship, money=money,
                              evidence_id=self.evidence('hypothesis'))
        self.assertEqual(self.scalar('SELECT COUNT(*) FROM relationships'), 0)
        self.call('save_relationship', **relationship, money='yes', evidence_id=self.evidence())
        self.assertEqual(self.scalar('SELECT money FROM relationships'), 'yes')
        self.assertEqual(self.scalar('SELECT status FROM relationships'), 'hypothesis')

    def test_supported_opportunity_requires_evidence_and_can_be_updated(self):
        base = dict(title='Synthetic business need', friction='Fixture repeated workaround',
                    proposed_solution='Investigate a fixture service', buyer='Fixture operator',
                    next_step='Verify the fixture need', stage='hypothesis')
        identifier = self.call('save_opportunity', **base)['id']
        with self.assertRaisesRegex(ValueError, 'require evidence'):
            self.call('save_opportunity', **{**base, 'id': identifier, 'stage': 'supported'})
        self.call('save_opportunity', **{**base, 'id': identifier, 'stage': 'investigating',
                                       'next_step': 'Interview the synthetic customer'})
        stored = dict(self.db.execute('SELECT * FROM opportunities').fetchone())
        self.assertEqual(stored['stage'], 'investigating')
        self.assertEqual(stored['next_step'], 'Interview the synthetic customer')
        self.assertEqual(self.scalar('SELECT COUNT(*) FROM opportunities'), 1)


class IdentityAndEnrichmentTests(OfflineCase):
    def test_duplicate_tickers_create_candidates_not_verified_matches(self):
        self.ingest([pair(), pair('ONEUSD', base='ONE'), pair('NONEUSD', base='NONE')])
        self.discover([
            {'id': 'fixture-token', 'name': 'Fixture Token', 'symbol': 'fix', 'platforms': {}},
            {'id': 'other-fixture', 'name': 'Other Fixture', 'symbol': 'FIX', 'platforms': {}},
            {'id': 'single-fixture', 'name': 'Single Fixture', 'symbol': 'one', 'platforms': {}},
        ])
        found = {r['code']: dict(r) for r in self.db.execute('SELECT * FROM assets')}
        self.assertEqual(len(json.loads(found['FIX']['candidates_json'])), 2)
        self.assertEqual(len(json.loads(found['ONE']['candidates_json'])), 1)
        self.assertEqual(json.loads(found['NONE']['candidates_json']), [])
        self.assertTrue(all(r['match_status'] == 'unresolved' and r['identity_id'] is None for r in found.values()))
        report = quality(self.db)
        self.assertEqual(report['matched_coingecko_assets'], 0)
        self.assertEqual(report['unresolved_assets'], 3)
        self.assertEqual(report['ambiguous_identifiers'], 1)
        self.assertEqual(report['duplicate_coingecko_tickers'], [{'ticker': 'fix', 'identities': 2}])

    def test_identity_resolution_needs_indexed_id_and_evidence_and_can_be_reverted(self):
        self.ingest()
        asset = self.scalar('SELECT id FROM assets')
        with self.assertRaisesRegex(ValueError, 'not indexed'):
            self.call('resolve', asset_id=asset, identity_id='missing-fixture')
        self.discover([{'id': 'fixture-token', 'name': 'Fixture Token', 'symbol': 'fix', 'platforms': {}}])
        with self.assertRaisesRegex(ValueError, 'require evidence'):
            self.call('resolve', asset_id=asset, identity_id='fixture-token')
        self.resolve(asset)
        resolved = self.call('detail', id=asset)
        self.assertEqual(resolved['identity']['id'], 'fixture-token')
        self.assertEqual(resolved['asset']['match_status'], 'verified')
        self.assertEqual(self.scalar("SELECT COUNT(*) FROM entities WHERE kind!='asset'"), 0)
        self.call('unresolve', asset_id=asset)
        reverted = self.call('detail', id=asset)
        self.assertEqual(reverted['asset']['match_status'], 'unresolved')
        self.assertIsNone(reverted['identity'])
        self.assertIsNone(reverted['asset']['match_evidence_id'])

    def test_identity_reversal_preserves_review_history(self):
        self.ingest()
        asset = self.scalar('SELECT id FROM assets')
        self.discover([{'id': 'fixture-token', 'name': 'Fixture Token', 'symbol': 'fix', 'platforms': {}}])
        self.resolve(asset)
        self.call('unresolve', asset_id=asset)
        history = [dict(row) for row in self.db.execute('SELECT * FROM identity_reviews ORDER BY id')]
        self.assertEqual([row['action'] for row in history], ['verified', 'returned_to_unresolved'])
        self.assertTrue(all(row['identity_id'] == 'fixture-token' for row in history))
        self.assertTrue(all(row['evidence_id'] is not None for row in history))
        self.assertEqual(self.scalar('SELECT match_status FROM assets'), 'unresolved')

    def test_verified_contract_requires_independent_confirmed_evidence(self):
        self.discover([{'id': 'fixture-token', 'name': 'Fixture Token', 'symbol': 'fix',
                        'platforms': {'fixture-network': '0xUNVERIFIEDFIXTURE'}}])
        contract = dict(identity_id='fixture-token', network='fixture-network',
                        address='0xCONFIRMEDFIXTURE', observed_at=OBSERVED_AT)
        with self.assertRaisesRegex(ValueError, 'require evidence'):
            self.call('verify_contract', **contract)
        with self.assertRaisesRegex(ValueError, 'Confirmed findings require confirmed evidence'):
            self.call('verify_contract', **contract, evidence_id=self.evidence('hypothesis'))
        evidence = self.evidence()
        self.call('verify_contract', **contract, evidence_id=evidence)
        verification = dict(self.db.execute('SELECT * FROM contract_verifications').fetchone())
        self.assertEqual(verification['address'], '0xCONFIRMEDFIXTURE')
        self.assertEqual(verification['evidence_id'], evidence)
        self.assertEqual(json.loads(self.scalar('SELECT platforms_json FROM identities')),
                         {'fixture-network': '0xUNVERIFIEDFIXTURE'})

    def test_identity_specific_enrichment_failure_does_not_starve_remaining_identities(self):
        self.ingest([pair('AAAUSD', base='AAA'), pair('BBBUSD', base='BBB')])
        self.discover([{'id': 'a-broken-fixture', 'name': 'Broken fixture', 'symbol': 'aaa'},
                       {'id': 'b-valid-fixture', 'name': 'Valid fixture', 'symbol': 'bbb'}])
        for row in self.db.execute('SELECT id,code FROM assets').fetchall():
            self.resolve(row['id'], 'a-broken-fixture' if row['code'] == 'AAA' else 'b-valid-fixture')
        requests = []
        def opener(request, **_):
            requests.append(request.full_url)
            if '/a-broken-fixture?' in request.full_url:
                raise urllib.error.HTTPError(request.full_url, 404, 'Fixture not found', {}, io.BytesIO(b'{}'))
            return Response({'id': 'b-valid-fixture'})
        client = Client(self.db, attempts=1, opener=opener, sleeper=lambda _: None)
        result = CoinGecko(self.db, client).enrich()
        self.assertEqual(result['enriched'], 1)
        self.assertEqual(len(result['failures']), 1)
        self.assertEqual(len(requests), 2)
        broken = self.db.execute("SELECT * FROM identities WHERE id='a-broken-fixture'").fetchone()
        self.assertIsNotNone(broken['last_enrichment_attempt_at'])
        self.assertIn('404', broken['enrichment_error'])
        self.assertIsNone(broken['enriched_at'])

    def test_failed_identity_moves_behind_unattempted_identity_on_next_small_batch(self):
        self.ingest([pair('AAAUSD', base='AAA'), pair('BBBUSD', base='BBB')])
        self.discover([{'id': 'a-broken-fixture', 'name': 'Broken fixture', 'symbol': 'aaa'},
                       {'id': 'b-valid-fixture', 'name': 'Valid fixture', 'symbol': 'bbb'}])
        for row in self.db.execute('SELECT id,code FROM assets').fetchall():
            self.resolve(row['id'], 'a-broken-fixture' if row['code'] == 'AAA' else 'b-valid-fixture')
        def opener(request, **_):
            if '/a-broken-fixture?' in request.full_url:
                return Response({'id': 'wrong-fixture'})
            return Response({'id': 'b-valid-fixture'})
        cg = CoinGecko(self.db, Client(self.db, attempts=1, opener=opener, sleeper=lambda _: None))
        self.assertEqual(len(cg.enrich(limit=1)['failures']), 1)
        self.assertEqual(cg.enrich(limit=1), {'enriched': 1, 'failures': []})
        self.assertIsNotNone(self.scalar("SELECT enriched_at FROM identities WHERE id='b-valid-fixture'"))

    def test_quota_failure_stops_enrichment_batch(self):
        self.ingest([pair('AAAUSD', base='AAA'), pair('BBBUSD', base='BBB')])
        self.discover([{'id': 'a-fixture', 'name': 'Fixture A', 'symbol': 'aaa'},
                       {'id': 'b-fixture', 'name': 'Fixture B', 'symbol': 'bbb'}])
        for row in self.db.execute('SELECT id,code FROM assets').fetchall():
            self.resolve(row['id'], 'a-fixture' if row['code'] == 'AAA' else 'b-fixture')
        requests = []
        def opener(request, **_):
            requests.append(request.full_url)
            raise urllib.error.HTTPError(request.full_url, 429, 'Fixture quota', {}, io.BytesIO(b'{}'))
        result = CoinGecko(self.db, Client(self.db, attempts=1, opener=opener,
                                         sleeper=lambda _: None)).enrich()
        self.assertEqual(result['enriched'], 0)
        self.assertEqual(len(result['failures']), 1)
        self.assertEqual(len(requests), 1)
        self.assertIsNone(self.scalar("SELECT last_enrichment_attempt_at FROM identities WHERE id='b-fixture'"))

    def test_unverified_assets_never_trigger_detail_enrichment(self):
        self.ingest()
        self.discover([{'id': 'fixture-token', 'name': 'Fixture Token', 'symbol': 'fix', 'platforms': {}}])
        calls = []
        result = CoinGecko(self.db, self.client({'id': 'fixture-token'}, calls)).enrich()
        self.assertEqual(result, {'enriched': 0, 'failures': []})
        self.assertEqual(calls, [])

    def test_enrichment_is_incremental_and_preserves_source_metadata(self):
        self.ingest()
        self.discover([{'id': 'fixture-token', 'name': 'Fixture Token', 'symbol': 'fix',
                        'platforms': {'fixture-network': '0xsynthetic-address'}}])
        asset = self.scalar('SELECT id FROM assets')
        self.resolve(asset)
        profile = {'id': 'fixture-token', 'description': {'en': 'Synthetic source description'},
                   'links': {'homepage': ['https://example.test'], 'repos_url': {'github': ['https://example.test/repo']}},
                   'platforms': {'fixture-network': '0xsynthetic-address'},
                   'categories': ['Fixture category'], 'tickers': []}
        requests = []
        cg = CoinGecko(self.db, self.client(profile, requests))
        self.assertEqual(cg.enrich(), {'enriched': 1, 'failures': []})
        self.assertEqual(cg.enrich(), {'enriched': 0, 'failures': []})
        self.assertEqual(len(requests), 1)
        detail = self.call('detail', id=asset)
        self.assertEqual(detail['identity']['profile'], profile)
        self.assertEqual(detail['identity']['platforms'], {'fixture-network': '0xsynthetic-address'})
        self.assertEqual(detail['claims'], [])
        self.assertEqual(detail['links'], [])

    def test_multiple_exchange_assets_share_profile_only_after_verified_identity(self):
        class OtherExchange:
            name = 'synthetic_other_exchange'
            url = 'https://example.test/other-fixture-exchange'

            def normalize(self, payload):
                return [{'symbol': 'FIX-USD', 'base': 'FIX', 'quote': 'USD',
                         'status': 'TRADING', 'spot': 1}]
        self.ingest()
        self.ingest(connector=OtherExchange())
        self.discover([{'id': 'fixture-token', 'name': 'Fixture Token', 'symbol': 'fix', 'platforms': {}}])
        assets = [row['id'] for row in self.db.execute('SELECT id FROM assets')]
        for identifier in assets:
            self.resolve(identifier)
        requests = []
        result = CoinGecko(self.db, self.client({'id': 'fixture-token'}, requests)).enrich()
        self.assertEqual(result, {'enriched': 1, 'failures': []})
        self.assertEqual(len(requests), 1)
        self.assertEqual(self.scalar('SELECT COUNT(*) FROM assets'), 2)
        self.assertEqual(quality(self.db)['shared_verified_identities'],
                         [{'identity_id': 'fixture-token', 'exchange_assets': 2}])
        self.assertEqual(quality(self.db)['enriched_assets'], 2)
        self.assertTrue(all(self.call('detail', id=identifier)['identity']['profile'] == {'id': 'fixture-token'}
                            for identifier in assets))

    def test_failed_enrichment_preserves_existing_profile(self):
        self.ingest()
        self.discover([{'id': 'fixture-token', 'name': 'Fixture Token', 'symbol': 'fix', 'platforms': {}}])
        self.resolve(self.scalar('SELECT id FROM assets'))
        old_profile = {'id': 'fixture-token', 'description': {'en': 'Prior audited fixture metadata'}}
        self.db.execute("UPDATE identities SET profile_json=?,enriched_at='2000-01-01T00:00:00+00:00'", (json.dumps(old_profile),))
        self.db.commit()
        result = CoinGecko(self.db, self.client({'id': 'wrong-fixture-id'})).enrich()
        self.assertEqual(result['enriched'], 0)
        self.assertEqual(len(result['failures']), 1)
        self.assertEqual(json.loads(self.scalar('SELECT profile_json FROM identities')), old_profile)
        self.assertEqual(self.scalar("SELECT COUNT(*) FROM cache WHERE url LIKE '%/coins/fixture-token?%'"), 0)

    def test_malformed_coin_index_rolls_back_partial_updates(self):
        self.ingest()
        with self.assertRaisesRegex(ValueError, 'Malformed CoinGecko'):
            self.discover([{'id': 'fixture-token', 'name': 'Fixture Token', 'symbol': 'fix'}, {'id': 'broken'}])
        self.assertEqual(self.scalar('SELECT COUNT(*) FROM identities'), 0)
        self.assertEqual(self.scalar('SELECT candidates_json FROM assets'), '[]')
        self.assertEqual(self.scalar('SELECT COUNT(*) FROM cache'), 0)


class TransportAndReportTests(OfflineCase):
    def test_http_cache_reuses_raw_response_without_network_and_keeps_key_out_of_urls(self):
        requests = []
        client = self.client({'fixture': 'metadata'}, requests)
        url = 'https://example.test/api/fixture'
        first = client.get(url, ttl=86400, headers={'x-cg-demo-api-key': 'synthetic-secret'})
        first_raw = client.last_meta.copy()
        second = client.get(url, ttl=86400, headers={'x-cg-demo-api-key': 'synthetic-secret'})
        self.assertEqual(first, second)
        self.assertEqual(len(requests), 1)
        self.assertEqual(client.last_meta, first_raw)
        self.assertEqual(self.scalar('SELECT SUM(cache_hit) FROM requests'), 1)
        stored_urls = self.db.execute('SELECT url FROM requests').fetchall()
        self.assertTrue(all('synthetic-secret' not in row['url'] for row in stored_urls))
        self.assertEqual(len(list((Path(self.temp.name) / 'raw').glob('*.json'))), 1)

    def test_rate_limit_retries_and_records_failed_response_then_success(self):
        calls, waits = [], []

        def opener(request, **_):
            calls.append(request)
            if len(calls) == 1:
                raise urllib.error.HTTPError(request.full_url, 429, 'Fixture quota',
                                             {'Retry-After': '3'}, io.BytesIO(b'{"error":"fixture rate limit"}'))
            return Response({'fixture': 'ready'})
        client = Client(self.db, attempts=2, opener=opener, sleeper=waits.append)
        self.assertEqual(client.get('https://example.test/quota'), {'fixture': 'ready'})
        self.assertEqual(len(calls), 2)
        self.assertIn(3.0, waits)
        self.assertEqual(self.scalar('SELECT COUNT(*) FROM requests WHERE error IS NOT NULL'), 1)
        self.assertEqual(self.scalar('SELECT COUNT(*) FROM requests'), 2)
        self.assertEqual(len(list((Path(self.temp.name) / 'raw').glob('*.json'))), 2)

    def test_long_retry_after_defers_batch_instead_of_retrying_early(self):
        calls = []

        def opener(request, **_):
            calls.append(request)
            raise urllib.error.HTTPError(request.full_url, 429, 'Fixture quota',
                                         {'Retry-After': '120'}, io.BytesIO(b'{"error":"quota"}'))
        client = Client(self.db, attempts=3, opener=opener, sleeper=lambda _: None)
        with self.assertRaisesRegex(FetchError, 'retry deferred'):
            client.get('https://example.test/quota')
        self.assertEqual(len(calls), 1)

    def test_invalid_json_is_retained_and_rejected(self):
        client = Client(self.db, attempts=1,
                        opener=lambda *_, **__: Response(raw=b'<html>fixture proxy error</html>'),
                        sleeper=lambda _: None)
        with self.assertRaisesRegex(FetchError, 'not valid JSON'):
            client.get('https://example.test/invalid')
        request = self.db.execute('SELECT * FROM requests').fetchone()
        self.assertEqual(Path(request['raw_path']).read_bytes(), b'<html>fixture proxy error</html>')
        self.assertIsNotNone(request['error'])
        self.assertEqual(self.scalar('SELECT COUNT(*) FROM cache'), 0)

    def test_no_successful_extraction_reports_unknown_counts_not_fabricated_zero(self):
        report = write_report(self.db)
        self.assertIsNone(report['total_trading_pairs_retrieved'])
        self.assertIsNone(report['unique_base_assets'])
        self.assertIsNone(report['last_successful_refresh'])
        self.assertEqual(report['historical_assets'], 0)
        self.assertEqual(report['extraction_status'], 'no_successful_extraction')
        persisted = json.loads((Path(self.temp.name) / 'quality-report.json').read_text())
        self.assertIsNone(persisted['total_trading_pairs_retrieved'])
        self.assertIn('Not available', (Path(self.temp.name) / 'QUALITY_REPORT.md').read_text())

    def test_migrations_apply_once_and_foreign_keys_are_enforced(self):
        second = connect()
        try:
            self.assertEqual(second.execute('SELECT COUNT(*) FROM schema_migrations').fetchone()[0], len(list((Path(__file__).resolve().parents[1] / 'migrations').glob('*.sql'))))
            self.assertEqual(second.execute('PRAGMA foreign_keys').fetchone()[0], 1)
            with self.assertRaises(sqlite3.IntegrityError):
                second.execute('INSERT INTO claims(entity_id,field,statement,status,observed_at,created_at) VALUES(999,?,?,?,?,?)',
                               ('customers', 'Invalid fixture', 'hypothesis', OBSERVED_AT, now()))
        finally:
            second.close()


if __name__ == '__main__':
    unittest.main()
