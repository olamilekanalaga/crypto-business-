"""Vision-update regressions: extend the stored economy without guessing facts.

All names, sources, assets and relationships below are synthetic fixtures in
TemporaryDirectory. No live API calls or normal research data are used.
"""
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from terminal.db import ROOT, connect, now
from terminal.service import dispatch

OBSERVED = '2026-04-05T06:07:08+00:00'
CHECKED = '2026-04-06T07:08:09+00:00'


class VisionCase(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='vision-update-fixture-')
        self.env = patch.dict(os.environ, {'TERMINAL_DATA_DIR': self.temp.name})
        self.env.start()
        self.db = connect()
        self.addCleanup(self.temp.cleanup)
        self.addCleanup(self.env.stop)
        self.addCleanup(self.db.close)

    def call(self, action, **data):
        return dispatch(self.db, {'action': action, 'data': data})

    def business(self, name='Test Fixture Vision Business', kind='organisation'):
        return self.call('save_entity', name=name, kind=kind)['id']

    def node(self, name='Test Fixture Vision Business', kind='organisation'):
        entity_id = self.business(name, kind)
        graph = self.call('anatomy', entity_id=entity_id)
        return next(n['id'] for n in graph['catalog'] if n['entity_id'] == entity_id)

    def concept(self, name='Test Fixture Input', kind='need'):
        return self.call('save_graph_node', kind=kind, name=name,
                         description='A synthetic question, not a researched fact.')['id']

    def evidence(self, status='confirmed'):
        return self.call('save_evidence', title='Test Fixture Vision Source',
                         url='https://example.test/vision-fixture',
                         source_type='Official documentation',
                         observed_at=OBSERVED, verification=status,
                         original_text='TEST FIXTURE: synthetic product and operating entity.',
                         interpretation='Supports this synthetic example only.')['id']

    def asset(self, code='VISIONFIXTURE'):
        identifier = self.db.execute("INSERT INTO entities(kind,name,created_at) VALUES('asset',?,?)", (code, now())).lastrowid
        self.db.execute('INSERT INTO assets(id,exchange,code,first_seen,last_seen) VALUES(?,?,?,?,?)',
                        (identifier, 'binance', code, OBSERVED, OBSERVED))
        self.db.commit()
        return identifier

    def link(self, a, b, kind, status='hypothesis', evidence=None):
        return self.call('save_link', from_id=a, to_id=b, type=kind,
                         status=status, evidence_id=evidence, observed_at=OBSERVED)['id']

    def edge(self, a, b, **overrides):
        data = dict(source_id=a, target_id=b, relation='needs_to_operate',
                    essentiality='essential', actuality='existing', lens='legs',
                    status='hypothesis', explanation='Synthetic explanation for a research connection.',
                    source_value='The source could receive a useful input.',
                    target_value='The target could receive demand.',
                    source_context='The source provides a synthetic application and needs input.',
                    target_context='The target is a synthetic input or provider.',
                    money='unknown', observed_at=OBSERVED,
                    evidence_gaps='Verify the synthetic connection and alternatives.')
        data.update(overrides)
        return self.call('save_graph_edge', **data)['id']


class AssetAnatomyTests(VisionCase):
    def test_listing_or_coingecko_identity_never_implies_an_operating_business(self):
        asset = self.asset()
        source = self.evidence()
        self.db.execute('INSERT INTO identities(id,name,ticker) VALUES(?,?,?)',
                        ('vision-fixture-id', 'Test Fixture Project Identity', 'VISIONFIXTURE'))
        self.db.execute("UPDATE assets SET identity_id=?,match_status='verified',match_evidence_id=? WHERE id=?",
                        ('vision-fixture-id', source, asset))
        self.db.commit()
        result = self.call('asset_anatomy', asset_id=asset)
        self.assertEqual(result['asset']['match_status'], 'verified')
        self.assertEqual(result['businesses'], [])
        self.assertTrue(result['unresolved_reason'])
        self.assertEqual(self.call('anatomy')['catalog'], [])

    def test_explicit_many_to_many_paths_preserve_their_own_certainty_and_sources(self):
        asset = self.asset()
        product = self.business('Test Fixture Product', 'product')
        operator = self.business('Test Fixture Operator')
        other_product = self.business('Test Fixture Other Product', 'product')
        source = self.evidence()
        product_link = self.link(product, asset, 'associated_asset', 'confirmed', source)
        operation_link = self.link(operator, product, 'operates', 'hypothesis')
        self.link(other_product, asset, 'associated_asset', 'inference')
        result = self.call('asset_anatomy', asset_id=asset)
        connected = {b['id']: b for b in result['businesses']}
        self.assertEqual(set(connected), {product, operator, other_product})
        self.assertTrue(connected[product]['verified'])
        self.assertEqual(connected[product]['link_status'], 'confirmed')
        self.assertFalse(connected[operator]['verified'])
        self.assertEqual(connected[operator]['link_status'], 'hypothesis')
        self.assertFalse(connected[other_product]['verified'])
        self.assertEqual(connected[other_product]['link_status'], 'inference')
        self.assertIn(source, {e['id'] for e in connected[product]['evidence']})
        self.assertEqual({p['id'] for path in connected[operator]['paths'] for p in path},
                         {product_link, operation_link})
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM assets').fetchone()[0], 1)
        self.assertNotIn(asset, {n['entity_id'] for n in self.call('anatomy')['catalog']})

    def test_confirmed_operator_requires_every_path_association_to_be_confirmed(self):
        asset = self.asset()
        product = self.business('Test Fixture Product', 'product')
        operator = self.business('Test Fixture Operator')
        source = self.evidence()
        self.link(product, asset, 'associated_asset', 'hypothesis')
        self.link(operator, product, 'operates', 'confirmed', source)
        first = self.call('asset_anatomy', asset_id=asset)
        self.assertFalse(next(b for b in first['businesses'] if b['id'] == operator)['verified'])
        self.link(product, asset, 'associated_asset', 'confirmed', source)
        second = self.call('asset_anatomy', asset_id=asset)
        self.assertTrue(next(b for b in second['businesses'] if b['id'] == operator)['verified'])

    def test_a_business_id_cannot_be_used_as_an_asset_discovery_record(self):
        with self.assertRaises(ValueError):
            self.call('asset_anatomy', asset_id=self.business())


class EconomicNetworkTests(VisionCase):
    def test_expansion_follows_stored_connections_and_stops_at_requested_depth(self):
        a, b, c, d = self.node(), self.concept(), self.node('Test Fixture Provider'), self.concept('Test Fixture Distribution', 'capability')
        one, two, three = self.edge(a, b), self.edge(c, b, relation='provides_to', essentiality='unknown'), self.edge(c, d, relation='needs_to_grow', essentiality='optional')
        isolated = self.concept('Test Fixture Disconnected Need')
        default = self.call('anatomy', center_id=a)
        self.assertEqual({e['id'] for e in default['edges']}, {one})
        depth_two = self.call('anatomy', center_id=a, scope='network', depth=2)
        self.assertEqual({e['id'] for e in depth_two['edges']}, {one, two})
        self.assertEqual({n['id'] for n in depth_two['nodes']}, {a, b, c})
        self.assertEqual({n['id']: n['distance'] for n in depth_two['nodes']}, {a: 0, b: 1, c: 2})
        depth_three = self.call('anatomy', center_id=a, scope='network', depth=3)
        self.assertEqual({e['id'] for e in depth_three['edges']}, {one, two, three})
        self.assertNotIn(isolated, {n['id'] for n in depth_three['nodes']})
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM graph_edges').fetchone()[0], 3)

    def test_filters_apply_at_each_hop_without_traversing_hidden_hypotheses(self):
        a, b, c, d = self.node(), self.concept(), self.concept('Test Fixture Downstream'), self.concept('Test Fixture Hypothetical Downstream')
        source = self.evidence()
        first = self.edge(a, b, status='confirmed', evidence_id=source)
        second = self.edge(b, c, status='confirmed', evidence_id=source)
        self.edge(a, d)
        graph = self.call('anatomy', center_id=a, scope='network', depth=3, status='confirmed')
        self.assertEqual({e['id'] for e in graph['edges']}, {first, second})
        self.assertNotIn(d, {n['id'] for n in graph['nodes']})
        outgoing = self.call('anatomy', center_id=c, scope='network', depth=3, direction='outgoing')
        self.assertEqual(outgoing['edges'], [])
        incoming = self.call('anatomy', center_id=c, scope='network', depth=2, direction='incoming', status='confirmed')
        self.assertEqual({e['id'] for e in incoming['edges']}, {first, second})

    def test_relevance_ranks_confirmed_before_newer_hypotheses(self):
        a, b, c = self.node(), self.concept(), self.concept('Test Fixture Speculative Input')
        confirmed = self.edge(a, b, status='confirmed', evidence_id=self.evidence())
        self.edge(a, c)
        graph = self.call('anatomy', center_id=a, scope='network', depth=1)
        self.assertEqual(graph['edges'][0]['id'], confirmed)

    def test_invalid_depth_and_scope_do_not_silently_expand_everything(self):
        centre = self.node()
        for depth in (0, 4, -1, True, 'all'):
            with self.subTest(depth=depth), self.assertRaises(ValueError):
                self.call('anatomy', center_id=centre, scope='network', depth=depth)
        with self.assertRaises(ValueError):
            self.call('anatomy', center_id=centre, scope='global-everything')

    def test_unresolved_connections_exclude_confirmed_and_retracted_facts(self):
        a, b, c = self.node(), self.concept(), self.concept('Test Fixture Optional Need')
        confirmed = self.edge(a, b, status='confirmed', evidence_id=self.evidence())
        hypothesis = self.edge(a, c)
        possibility = self.edge(a, c, relation='could_benefit_from', essentiality='optional', actuality='potential')
        unresolved = self.call('unresolved_graph')
        self.assertEqual({edge['id'] for edge in unresolved['items']}, {hypothesis, possibility})
        self.assertNotIn(confirmed, {edge['id'] for edge in unresolved['items']})
        page = self.call('unresolved_graph', limit=1)
        self.assertEqual(page['total'], 2)
        self.assertTrue(page['truncated'])
        self.call('retract_graph_edge', id=hypothesis, reason='Synthetic contrary evidence found')
        remaining = self.call('unresolved_graph')
        self.assertEqual([edge['id'] for edge in remaining['items']], [possibility])


class ConnectionMeaningTests(VisionCase):
    def test_endpoint_context_and_observation_survive_round_trip_without_invented_review_date(self):
        a, b = self.node(), self.concept()
        identifier = self.edge(a, b, status='confirmed', evidence_id=self.evidence())
        record = next(e for e in self.call('anatomy', center_id=a)['edges'] if e['id'] == identifier)
        self.assertIn('provides a synthetic application', record['source_context'])
        self.assertIn('synthetic input or provider', record['target_context'])
        self.assertEqual(record['observed_at'], OBSERVED)
        self.assertIsNone(record['evidence_checked_at'])
        self.assertEqual(record['money_direction'], 'unknown')

    def test_researcher_check_date_requires_confirmed_evidence_and_is_distinct_from_observation(self):
        a, b = self.node(), self.concept()
        with self.assertRaises(ValueError):
            self.edge(a, b, evidence_checked_at=CHECKED)
        with self.assertRaises(ValueError):
            self.edge(a, b, evidence_checked_at=CHECKED, evidence_id=self.evidence('hypothesis'))
        identifier = self.edge(a, b, status='confirmed', evidence_id=self.evidence(), evidence_checked_at=CHECKED)
        record = next(e for e in self.call('anatomy', center_id=a)['edges'] if e['id'] == identifier)
        self.assertEqual(record['evidence_checked_at'], CHECKED)
        self.assertEqual(record['observed_at'], OBSERVED)

    def test_known_payments_preserve_who_pays_whom(self):
        payer, provider = self.node(), self.node('Test Fixture Provider')
        evidence = self.evidence()
        pays = self.edge(payer, provider, relation='pays_for', essentiality='unknown', status='confirmed', evidence_id=evidence,
                         money='yes', money_direction='source_to_target')
        earns = self.edge(provider, payer, relation='earns_from', essentiality='unknown', status='confirmed', evidence_id=evidence,
                          money='yes', money_direction='target_to_source')
        for identifier, direction in ((pays, 'source_to_target'), (earns, 'target_to_source')):
            record = next(e for e in self.call('anatomy', center_id=payer)['edges'] if e['id'] == identifier)
            self.assertEqual(record['money_direction'], direction)
        for relation, direction in (('pays_for', 'target_to_source'), ('earns_from', 'source_to_target')):
            with self.subTest(relation=relation), self.assertRaises(ValueError):
                self.edge(payer, provider, relation=relation, essentiality='unknown', status='confirmed', evidence_id=evidence,
                          money='yes', money_direction=direction)

    def test_unknown_or_no_payment_cannot_claim_a_direction(self):
        a, b = self.node(), self.concept()
        with self.assertRaises(ValueError):
            self.edge(a, b, money_direction='source_to_target')
        with self.assertRaises(ValueError):
            self.edge(a, b, money='no', evidence_id=self.evidence(), money_direction='target_to_source')
        identifier = self.edge(a, b, money='no', evidence_id=self.evidence(), money_direction='none')
        self.assertEqual(next(e for e in self.call('anatomy', center_id=a)['edges'] if e['id'] == identifier)['money_direction'], 'none')

    def test_new_relation_types_are_explicit_records_not_relabelled_integrations(self):
        a, b = self.node(), self.node('Test Fixture Peer Product', 'product')
        integration = self.edge(a, b, relation='integrates_with', essentiality='unknown')
        dependency = self.edge(a, b, relation='depends_on', essentiality='unknown')
        graph = self.call('anatomy', center_id=a)
        by_id = {e['id']: e['relation'] for e in graph['edges']}
        self.assertEqual(by_id[integration], 'integrates_with')
        self.assertEqual(by_id[dependency], 'depends_on')


class ExistingDataMigrationTests(unittest.TestCase):
    def test_pre_update_assets_edges_sources_and_audit_events_survive_pending_migrations(self):
        with tempfile.TemporaryDirectory(prefix='vision-migration-fixture-') as folder:
            database_path = Path(folder) / 'terminal.sqlite3'
            db = sqlite3.connect(database_path)
            db.execute('PRAGMA foreign_keys=ON')
            db.execute('CREATE TABLE schema_migrations(name TEXT PRIMARY KEY,applied_at TEXT NOT NULL)')
            db.commit()
            for migration in sorted((ROOT / 'migrations').glob('*.sql')):
                if int(migration.name.split('_', 1)[0]) > 6:
                    continue
                db.executescript(migration.read_text())
                db.execute('INSERT INTO schema_migrations VALUES(?,?)', (migration.name, OBSERVED))
                db.commit()
            db.execute("INSERT INTO entities VALUES(10,'organisation','Test Fixture Existing Business',?)", (OBSERVED,))
            db.execute("INSERT INTO entities VALUES(11,'product','Test Fixture Existing Product',?)", (OBSERVED,))
            db.execute("INSERT INTO entities VALUES(12,'asset','OLDFIXTURE',?)", (OBSERVED,))
            db.execute("INSERT INTO assets(id,exchange,code,first_seen,last_seen) VALUES(12,'binance','OLDFIXTURE',?,?)", (OBSERVED, OBSERVED))
            db.execute("INSERT INTO runs(id,connector,started_at,status,pair_count,unique_assets) VALUES(14,'binance',?,'success',1,1)", (OBSERVED,))
            db.execute("INSERT INTO listings VALUES('binance','OLDFIXTUREUSD',12,'OLDFIXTURE','USD','TRADING',1,1,?,?,14)", (OBSERVED, OBSERVED))
            db.execute("INSERT INTO listing_observations VALUES(14,'binance','OLDFIXTUREUSD','OLDFIXTURE','USD','TRADING',1)")
            db.execute("INSERT INTO evidence VALUES(15,'Test Fixture Original Source','https://example.test/original','Official documentation',?,NULL,'TEST FIXTURE ORIGINAL EVIDENCE','Original interpretation','confirmed',?)", (OBSERVED, OBSERVED))
            db.execute("INSERT INTO graph_nodes VALUES(20,'organisation',10,'Test Fixture Existing Business','',?)", (OBSERVED,))
            db.execute("INSERT INTO graph_nodes VALUES(21,'product',11,'Test Fixture Existing Product','',?)", (OBSERVED,))
            for identifier, active, relation, money in ((30,1,'pays_for','yes'), (31,0,'provides_to','unknown')):
                db.execute('''INSERT INTO graph_edges(id,source_id,target_id,relation,essentiality,actuality,lens,status,explanation,source_value,target_value,money,evidence_id,observed_at,evidence_gaps,provenance,active,created_at)
                    VALUES(?,20,21,?,'unknown','existing','other','confirmed','Original explanation','Original source value','Original target value',?,15,?,'','manual',?,?)''',
                    (identifier,relation,money,OBSERVED,active,OBSERVED))
            db.execute('UPDATE graph_edges SET supersedes_id=31 WHERE id=30')
            db.execute("INSERT INTO graph_edge_events VALUES(40,30,'created','Original creation',?)", (OBSERVED,))
            db.execute("INSERT INTO graph_edge_events VALUES(41,31,'retracted','Original correction',?)", (OBSERVED,))
            db.commit()
            db.close()
            with patch.dict(os.environ, {'TERMINAL_DATA_DIR': folder}):
                migrated = connect()
                try:
                    self.assertEqual(migrated.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
                    self.assertEqual(migrated.execute('PRAGMA foreign_key_check').fetchall(), [])
                    self.assertEqual(migrated.execute('SELECT COUNT(*) FROM listings').fetchone()[0], 1)
                    self.assertEqual(migrated.execute('SELECT COUNT(*) FROM listing_observations').fetchone()[0], 1)
                    self.assertEqual(migrated.execute('SELECT supersedes_id FROM graph_edges WHERE id=30').fetchone()[0], 31)
                    self.assertEqual(migrated.execute('SELECT code FROM assets WHERE id=12').fetchone()[0], 'OLDFIXTURE')
                    self.assertEqual(migrated.execute('SELECT original_text FROM evidence WHERE id=15').fetchone()[0], 'TEST FIXTURE ORIGINAL EVIDENCE')
                    events = migrated.execute('SELECT id,edge_id,action,reason FROM graph_edge_events ORDER BY id').fetchall()
                    self.assertEqual([tuple(row) for row in events], [(40,30,'created','Original creation'), (41,31,'retracted','Original correction')])
                    edges = migrated.execute('SELECT id,active,evidence_id,money_direction,evidence_checked_at FROM graph_edges ORDER BY id').fetchall()
                    self.assertEqual(tuple(edges[0]), (30,1,15,'source_to_target',None))
                    self.assertEqual(tuple(edges[1]), (31,0,15,'unknown',None))
                    graph = dispatch(migrated, {'action':'anatomy','data':{'center_id':20}})
                    self.assertEqual([edge['id'] for edge in graph['edges']], [30])
                    self.assertEqual([edge['id'] for edge in graph['history']], [31])
                finally:
                    migrated.close()
