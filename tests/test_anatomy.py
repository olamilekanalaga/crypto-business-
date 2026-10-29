"""Business Anatomy invariants using synthetic, disposable SQLite databases.

These tests do not call external APIs or seed the normal research database.
"""
import os
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from terminal.db import connect, now
from terminal.service import dispatch

OBSERVED = '2026-02-03T04:05:06+00:00'


class AnatomyCase(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='anatomy-unit-fixture-')
        self.env = patch.dict(os.environ, {'TERMINAL_DATA_DIR': self.temp.name})
        self.env.start()
        self.db = connect()
        self.addCleanup(self.temp.cleanup)
        self.addCleanup(self.env.stop)
        self.addCleanup(self.db.close)

    def call(self, action, **data):
        return dispatch(self.db, {'action': action, 'data': data})

    def business(self, name='Test Fixture Business', kind='organisation'):
        return self.call('save_entity', name=name, kind=kind)['id']

    def business_node(self, name='Test Fixture Business', kind='organisation'):
        entity_id = self.business(name, kind)
        graph = self.call('anatomy', entity_id=entity_id)
        return next(node['id'] for node in graph['catalog'] if node['entity_id'] == entity_id)

    def concept(self, name='Test Fixture Liquidity', kind='need'):
        return self.call('save_graph_node', name=name, kind=kind,
                         description='Synthetic research concept, not a verified dependency.')['id']

    def evidence(self, status='confirmed'):
        return self.call('save_evidence', title='Test Fixture Source',
                         url='https://example.test/anatomy-source',
                         source_type='Official documentation', observed_at=OBSERVED,
                         original_text='TEST FIXTURE: a synthetic service requires an input.',
                         interpretation='Synthetic researcher interpretation only.',
                         verification=status)['id']

    def edge(self, source, target, **overrides):
        data = dict(source_id=source, target_id=target, relation='needs_to_operate',
                    essentiality='essential', actuality='existing', lens='blood',
                    status='hypothesis', explanation='Test fixture rationale for an operating need.',
                    source_value='Test fixture service receives a required input.',
                    target_value='Test fixture supplier could gain a customer.', money='unknown',
                    observed_at=OBSERVED,
                    evidence_gaps='Verify whether this is actually required and who supplies it.')
        data.update(overrides)
        return self.call('save_graph_edge', **data)['id']

    def graph(self, centre, **filters):
        return self.call('anatomy', center_id=centre, **filters)


class AnatomyGraphTests(AnatomyCase):
    def test_empty_database_has_no_invented_businesses_needs_or_connections(self):
        graph = self.call('anatomy')
        self.assertIsNone(graph['center_id'])
        self.assertEqual(graph['catalog'], [])
        self.assertEqual(graph['nodes'], [])
        self.assertEqual(graph['edges'], [])

    def test_business_wrappers_are_stable_and_assets_are_not_business_nodes(self):
        organisation = self.business()
        product = self.business('Test Fixture Product', 'product')
        self.db.execute("INSERT INTO entities(kind,name,created_at) VALUES('asset','TESTFIXTURE',?)", (now(),))
        self.db.commit()
        first = self.call('anatomy')
        again = self.call('anatomy')
        self.assertEqual({node['entity_id'] for node in first['catalog']}, {organisation, product})
        self.assertEqual(first['catalog'], again['catalog'])
        self.assertEqual({node['kind'] for node in first['catalog']}, {'organisation', 'product'})
        self.assertEqual(first['edges'], [])

    def test_concepts_are_persistent_and_do_not_automatically_create_dependencies(self):
        a = self.business_node()
        liquidity = self.concept()
        hosting = self.concept('Test Fixture Hosting', 'capability')
        graph = self.graph(a)
        self.assertIn(liquidity, {node['id'] for node in graph['catalog']})
        self.assertIn(hosting, {node['id'] for node in graph['catalog']})
        self.assertEqual(graph['edges'], [])
        second_connection = connect()
        try:
            persisted = dispatch(second_connection, {'action': 'anatomy', 'data': {'center_id': liquidity}})
            self.assertEqual(persisted['center_id'], liquidity)
            self.assertIn('Test Fixture Liquidity', [n['name'] for n in persisted['nodes']])
        finally:
            second_connection.close()

    def test_each_concept_can_become_a_centre_without_expanding_the_whole_economy(self):
        company = self.business_node()
        liquidity = self.concept()
        capital = self.concept('Test Fixture Capital', 'resource')
        traders = self.concept('Test Fixture Traders', 'actor')
        first = self.edge(company, liquidity)
        second = self.edge(liquidity, capital)
        self.edge(capital, traders)
        initial = self.graph(company)
        self.assertEqual({e['id'] for e in initial['edges']}, {first})
        self.assertNotIn(capital, {n['id'] for n in initial['nodes']})
        expanded = self.graph(liquidity)
        self.assertEqual({e['id'] for e in expanded['edges']}, {first, second})
        self.assertEqual({n['id'] for n in expanded['nodes']}, {company, liquidity, capital})
        self.assertNotIn(traders, {n['id'] for n in expanded['nodes']})

    def test_direction_filters_preserve_the_meaning_of_arrows(self):
        a, b, c = self.business_node(), self.concept(), self.concept('Test Fixture Capital', 'resource')
        outgoing, incoming = self.edge(a, b), self.edge(c, a)
        self.assertEqual([e['id'] for e in self.graph(a, direction='outgoing')['edges']], [outgoing])
        self.assertEqual([e['id'] for e in self.graph(a, direction='incoming')['edges']], [incoming])
        self.assertEqual({e['id'] for e in self.graph(a, direction='both')['edges']}, {outgoing, incoming})

    def test_lens_category_and_certainty_filters_do_not_promote_hypotheses(self):
        a, b, c = self.business_node(), self.concept(), self.concept('Test Fixture Distribution', 'capability')
        essential = self.edge(a, b, status='confirmed', evidence_id=self.evidence(), evidence_gaps='')
        growth = self.edge(a, c, relation='needs_to_grow', essentiality='optional', lens='oxygen')
        self.assertEqual([e['id'] for e in self.graph(a, category='essential')['edges']], [essential])
        self.assertEqual([e['id'] for e in self.graph(a, category='growth')['edges']], [growth])
        self.assertEqual([e['id'] for e in self.graph(a, status='confirmed')['edges']], [essential])
        self.assertEqual([e['id'] for e in self.graph(a, lens='oxygen')['edges']], [growth])
        selected = self.graph(a, lens='oxygen')['edges'][0]
        self.assertEqual(selected['status'], 'hypothesis')
        self.assertEqual(selected['actuality'], 'existing')

    def test_future_complementarity_is_separate_from_existing_relationships(self):
        a, b, c = self.business_node(), self.concept(), self.business_node('Test Fixture Potential Provider')
        existing = self.edge(a, b)
        potential = self.edge(a, c, relation='could_benefit_from', essentiality='optional', actuality='potential')
        self.assertEqual([e['id'] for e in self.graph(a, category='existing')['edges']], [existing])
        self.assertEqual([e['id'] for e in self.graph(a, category='potential')['edges']], [potential])

    def test_confirmed_edges_retain_evidence_and_economic_interpretation(self):
        a, b = self.business_node(), self.concept()
        source = self.evidence()
        identifier = self.edge(a, b, status='confirmed', evidence_id=source, evidence_gaps='')
        edge = next(e for e in self.graph(a)['edges'] if e['id'] == identifier)
        self.assertEqual(edge['status'], 'confirmed')
        self.assertEqual(edge['evidence_id'], source)
        self.assertEqual(edge['observed_at'], OBSERVED)
        self.assertIn('Test fixture rationale', edge['explanation'])
        self.assertEqual(edge['money'], 'unknown')
        self.assertEqual(edge['provenance'], 'manual')
        # Evidence must be inspectable, not reduced to a source URL alone.
        self.assertIn('TEST FIXTURE', str(edge))
        self.assertIn('Synthetic researcher interpretation', str(edge))

    def test_confirmed_dependency_needs_confirmed_source_evidence(self):
        a, b = self.business_node(), self.concept()
        with self.assertRaises(ValueError):
            self.edge(a, b, status='confirmed', evidence_gaps='')
        with self.assertRaises(ValueError):
            self.edge(a, b, status='confirmed', evidence_id=self.evidence('hypothesis'), evidence_gaps='')
        self.assertEqual(self.graph(a)['edges'], [])

    def test_potential_edge_cannot_be_presented_as_a_confirmed_relationship(self):
        a, b = self.business_node(), self.concept()
        with self.assertRaises(ValueError):
            self.edge(a, b, actuality='potential', status='confirmed', evidence_id=self.evidence())
        with self.assertRaises(ValueError):
            self.edge(a, b, relation='could_benefit_from', actuality='existing')
        self.assertEqual(self.graph(a)['edges'], [])

    def test_known_payment_requires_confirmed_evidence_even_for_hypotheses(self):
        a, b = self.business_node(), self.concept()
        for money in ('yes', 'no'):
            with self.subTest(money=money), self.assertRaises(ValueError):
                self.edge(a, b, money=money)
        with self.assertRaises(ValueError):
            self.edge(a, b, money='yes', evidence_id=self.evidence('inference'))
        self.edge(a, b, money='yes', evidence_id=self.evidence())
        self.assertEqual(self.graph(a)['edges'][0]['money'], 'yes')

    def test_needs_and_growth_require_consistent_essentiality(self):
        a, b = self.business_node(), self.concept()
        with self.assertRaises(ValueError):
            self.edge(a, b, relation='needs_to_operate', essentiality='optional')
        with self.assertRaises(ValueError):
            self.edge(a, b, relation='needs_to_grow', essentiality='essential')

    def test_partnership_and_competition_need_businesses_not_abstract_concepts(self):
        company, concept = self.business_node(), self.concept()
        other = self.business_node('Test Fixture Other Business', 'product')
        for relation in ('partners_with', 'competes_with'):
            with self.subTest(relation=relation), self.assertRaises(ValueError):
                self.edge(company, concept, relation=relation, essentiality='unknown')
            identifier = self.edge(company, other, relation=relation, essentiality='unknown')
            self.assertIn(identifier, {e['id'] for e in self.graph(company)['edges']})

    def test_potential_connection_cannot_assert_payment_even_with_a_source(self):
        a, b = self.business_node(), self.concept()
        source = self.evidence()
        for money in ('yes', 'no'):
            with self.subTest(money=money), self.assertRaises(ValueError):
                self.edge(a, b, actuality='potential', money=money, evidence_id=source)
        self.assertEqual(self.graph(a)['edges'], [])

    def test_database_constraints_reject_invalid_payment_and_concept_partnerships(self):
        a, b = self.business_node(), self.concept()
        identifier = self.edge(a, b)
        record = dict(self.db.execute('SELECT * FROM graph_edges WHERE id=?', (identifier,)).fetchone())
        record.pop('id')
        record['relation'] = 'partners_with'
        columns = ','.join(record)
        placeholders = ','.join('?' for _ in record)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(f'INSERT INTO graph_edges({columns}) VALUES({placeholders})', tuple(record.values()))
        self.db.rollback()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE graph_edges SET relation='partners_with' WHERE id=?", (identifier,))
        self.db.rollback()
        source = self.evidence()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE graph_edges SET actuality='potential',money='yes',evidence_id=? WHERE id=?", (source,identifier))
        self.db.rollback()
        self.assertEqual(self.graph(a)['edges'][0]['relation'], 'needs_to_operate')
        self.assertEqual(self.graph(a)['edges'][0]['money'], 'unknown')

    def test_pays_for_does_not_contradict_or_hide_payment_certainty(self):
        a, b = self.business_node(), self.business_node('Test Fixture Service Provider')
        source = self.evidence()
        with self.assertRaises(ValueError):
            self.edge(a, b, relation='pays_for', money='unknown', status='confirmed', evidence_id=source, evidence_gaps='')
        with self.assertRaises(ValueError):
            self.edge(a, b, relation='pays_for', money='no', evidence_id=source)
        confirmed = self.edge(a, b, relation='pays_for', money='yes', status='confirmed', evidence_id=source, evidence_gaps='')
        hypothesis = self.edge(a, b, relation='pays_for', money='unknown', status='hypothesis')
        graph = self.graph(a)
        self.assertEqual(next(e for e in graph['edges'] if e['id'] == confirmed)['money'], 'yes')
        self.assertEqual(next(e for e in graph['edges'] if e['id'] == hypothesis)['money'], 'unknown')
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE graph_edges SET money='unknown' WHERE id=?", (confirmed,))
        self.db.rollback()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE graph_edges SET money='no',evidence_id=? WHERE id=?", (source,hypothesis))
        self.db.rollback()

    def test_unverified_edges_require_explicit_evidence_gaps(self):
        a, b = self.business_node(), self.concept()
        with self.assertRaises(ValueError):
            self.edge(a, b, evidence_gaps='')
        with self.assertRaises(ValueError):
            self.edge(a, b, actuality='potential', evidence_gaps='')

    def test_invalid_nodes_self_links_timestamps_and_filters_are_rejected(self):
        a, b = self.business_node(), self.concept()
        for values in ({'source_id': a, 'target_id': a}, {'target_id': 999999},
                       {'observed_at': 'not-a-date'}, {'relation': 'everything_is_connected'}):
            with self.subTest(values=values), self.assertRaises(ValueError):
                self.edge(a, b, **values)
        for values in ({'status':'fake'},{'category':'fake'},{'lens':'fake'},{'direction':'fake'},{'center_id':999999}):
            with self.subTest(values=values), self.assertRaises(ValueError):
                self.call('anatomy', **values)
        for kind in ('asset','organisation','product','arbitrary'):
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                self.call('save_graph_node',kind=kind,name='Test Fixture Invalid Node',description='Must be rejected.')

    def test_retraction_hides_edge_from_active_map_but_retains_history(self):
        a, b = self.business_node(), self.concept()
        identifier = self.edge(a, b)
        self.call('retract_graph_edge', id=identifier, reason='Test fixture evidence contradicted this dependency.')
        graph = self.graph(a)
        self.assertEqual(graph['edges'], [])
        self.assertIn(identifier, {e['id'] for e in graph['history']})
        self.assertIn('contradicted', str(graph['history']))
        with self.assertRaises(ValueError):
            self.call('retract_graph_edge', id=identifier, reason='Second retraction should not overwrite history.')

    def test_superseding_appends_revision_and_keeps_previous_evidence(self):
        a, b = self.business_node(), self.concept()
        first = self.edge(a, b)
        second = self.edge(a, b, supersedes_id=first, explanation='Updated test fixture rationale.')
        graph = self.graph(a)
        self.assertEqual([e['id'] for e in graph['edges']], [second])
        self.assertIn(first, {e['id'] for e in graph['history']})
        self.assertIn('Test fixture rationale', str(graph['history']))
        self.assertEqual(graph['edges'][0]['supersedes_id'], first)

    def test_failed_superseding_write_preserves_active_predecessor(self):
        a, b = self.business_node(), self.concept()
        first = self.edge(a, b)
        with self.assertRaises(ValueError):
            self.edge(a, b, supersedes_id=first, status='confirmed', evidence_gaps='')
        graph = self.graph(a)
        self.assertEqual([e['id'] for e in graph['edges']], [first])
        self.assertEqual(graph['history'], [])

    def test_bounded_map_reports_truncation_instead_of_hiding_coverage(self):
        a = self.business_node()
        for index in range(3):
            self.edge(a, self.concept(f'Test Fixture Need {index}'))
        with patch('terminal.anatomy.MAX_NODES', 2), patch('terminal.anatomy.MAX_EDGES', 1):
            graph = self.graph(a)
        self.assertEqual(len(graph['nodes']), 2)
        self.assertEqual(len(graph['edges']), 1)
        self.assertEqual(graph['limits']['nodes_total'], 4)
        self.assertEqual(graph['limits']['edges_total'], 3)
        self.assertTrue(graph['limits']['nodes_truncated'])
        self.assertTrue(graph['limits']['edges_truncated'])

    def test_unsupported_ai_provenance_cannot_silently_become_manual_research(self):
        a, b = self.business_node(), self.concept()
        with self.assertRaises(ValueError):
            self.edge(a, b, provenance='llm_generated')
        self.assertEqual(self.graph(a)['edges'], [])

    def test_existing_integration_is_projected_without_inventing_partnership_or_payment(self):
        a_entity, b_entity = self.business('Test Fixture Provider'), self.business('Test Fixture Integrator')
        source = self.evidence()
        relationship = self.call('save_relationship', a_id=a_entity, b_id=b_entity, type='integration',
                                 a_provides='Test fixture API', b_provides='Test fixture application access',
                                 reason='Test fixture integration serves synthetic users.',
                                 a_value='Test fixture reach', b_value='Test fixture API access',
                                 money='unknown', status='confirmed', evidence_id=source,
                                 observed_at=OBSERVED)['id']
        graph = self.call('anatomy', entity_id=a_entity)
        projected = next(e for e in graph['edges'] if e['id'] == f'relationship:{relationship}')
        self.assertTrue(projected['readonly'])
        self.assertEqual(projected['relation'], 'documented_relationship')
        self.assertEqual(projected['original_type'], 'integration')
        self.assertEqual(projected['money'], 'unknown')
        self.assertEqual(projected['status'], 'confirmed')
        self.assertNotIn('partners_with', [e['relation'] for e in graph['edges']])
        self.assertEqual(len(graph['edges']), 1)
        self.assertIn('TEST FIXTURE', str(projected))
        with self.assertRaises(ValueError):
            self.call('retract_graph_edge', id=projected['id'], reason='Cannot retract a legacy record through the graph API.')


if __name__ == '__main__':
    unittest.main()
