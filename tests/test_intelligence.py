"""Structured proposal handoff uses synthetic evidence and no model/network calls."""
import json
import os
import sqlite3
import tempfile
import unittest
from unittest.mock import patch
from terminal.db import connect
from terminal.service import dispatch
from terminal.intelligence import (DisabledProvider, IntelligenceDisabled, IntelligenceRequest,
    collect_proposals, intelligence_status, import_proposal, list_proposals, review_proposal, annotate_proposals)

OBSERVED = '2026-02-03T04:05:06+00:00'


class IntelligenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='intelligence-fixture-')
        self.env = patch.dict(os.environ, {'TERMINAL_DATA_DIR': self.temp.name})
        self.env.start()
        self.db = connect()
        self.addCleanup(self.temp.cleanup)
        self.addCleanup(self.env.stop)
        self.addCleanup(self.db.close)
        self.entity = dispatch(self.db, {'action': 'save_entity', 'data': {'name': 'Test Fixture Research Business', 'kind': 'organisation'}})['id']
        self.source = self.evidence('Source one')

    def evidence(self, title):
        return dispatch(self.db, {'action': 'save_evidence', 'data': {
            'title': 'Test Fixture '+title, 'url': 'https://example.test/structured-evidence',
            'source_type': 'Official documentation', 'original_text': 'TEST FIXTURE ONLY: synthetic source excerpt.',
            'interpretation': 'Test fixture researcher interpretation.', 'verification': 'confirmed',
            'observed_at': OBSERVED}})['id']

    def proposal(self, **changes):
        value = {'provider': 'Declared fixture provider', 'model': 'fixture-model', 'kind': 'finding',
                 'confidence': .99, 'explanation': 'Fixture economic interpretation requiring review.',
                 'evidence_gaps': 'Fixture missing evidence: validate real demand and payer.',
                 'source_ids': [self.source],
                 'payload': {'entity_id': self.entity, 'field': 'what_it_does', 'statement': 'Fixture possible business function.'}}
        value.update(changes)
        return value

    def connection(self):
        graph = dispatch(self.db, {'action': 'anatomy', 'data': {'entity_id': self.entity}})
        source = graph['center_id']
        target = dispatch(self.db, {'action': 'save_graph_node', 'data': {
            'kind': 'need', 'name': 'Test Fixture Input', 'description': 'Synthetic possible input.'}})['id']
        return self.proposal(kind='connection', payload={'source_id': source, 'target_id': target,
            'relation': 'needs_to_operate', 'essentiality': 'essential', 'lens': 'food',
            'source_value': 'Fixture input supply.', 'target_value': 'Fixture potential demand.',
            'source_context': 'Fixture business may need an input.', 'target_context': 'Fixture researched need.'})

    def accept(self, identifier, **changes):
        return review_proposal(self.db, {'id': identifier, 'decision': 'accept',
            'reviewer_note': 'TEST FIXTURE: retain as hypothesis for investigation, not verified.', **changes})

    def test_disabled_provider_never_requires_key_or_makes_a_research_record(self):
        self.assertFalse(intelligence_status()['enabled'])
        self.assertFalse(intelligence_status()['external_calls'])
        with self.assertRaises(IntelligenceDisabled):
            collect_proposals(self.db, DisabledProvider(), IntelligenceRequest(self.entity, (self.source,)))
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM intelligence_proposals').fetchone()[0], 0)

    def test_imports_are_separate_from_graph_and_claims_even_at_confidence_one(self):
        value = self.proposal(confidence=1)
        identifier = import_proposal(self.db, value)['id']
        proposal = list_proposals(self.db)['proposals'][0]
        self.assertEqual(proposal['id'], identifier)
        self.assertEqual(proposal['status'], 'proposed')
        self.assertEqual(proposal['metadata_assurance'], 'declared_unverified')
        self.assertEqual(proposal['sources'][0]['original_text'], 'TEST FIXTURE ONLY: synthetic source excerpt.')
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM claims').fetchone()[0], 0)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM graph_edges').fetchone()[0], 0)

    def test_fabricated_sources_empty_citations_and_invalid_confidence_are_rejected(self):
        for changes in ({'source_ids': []}, {'source_ids': [999999]}, {'source_ids': [True]},
                        {'confidence': float('nan')}, {'confidence': float('inf')}, {'confidence': True},
                        {'confidence': 1.1}, {'evidence_gaps': ''}):
            with self.subTest(changes=changes):
                with self.assertRaises(ValueError):
                    import_proposal(self.db, self.proposal(**changes))
        self.assertEqual(list_proposals(self.db)['proposals'], [])

    def test_provider_may_use_only_selected_source_snapshots_and_creates_proposals_only(self):
        value = self.proposal()
        suggestion = {key: val for key, val in value.items() if key not in ('provider', 'model')}
        class Adapter:
            name, model = 'Fixture adapter', 'fixture-only'
            def extract(adapter, request):
                self.assertEqual(request.source_ids, (self.source,))
                self.assertEqual(request.source_evidence[0]['original_text'], 'TEST FIXTURE ONLY: synthetic source excerpt.')
                return [suggestion]
            reason = extract
        result = collect_proposals(self.db, Adapter(), IntelligenceRequest(self.entity, (self.source,)), operation='reason')
        self.assertEqual(len(result['proposal_ids']), 1)
        self.assertEqual(result['created_research_records'], 0)
        self.assertEqual(list_proposals(self.db)['proposals'][0]['origin'], 'adapter')
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM claims').fetchone()[0], 0)

    def test_adapter_cannot_cite_unsupplied_evidence_or_partially_store_an_invalid_batch(self):
        outside = self.evidence('Outside request')
        good = {key: value for key, value in self.proposal().items() if key not in ('provider', 'model')}
        class Adapter:
            name, model = 'Fixture adapter', 'fixture-only'
            def extract(adapter, request):
                return [good, {**good, 'source_ids': [outside]}]
        with self.assertRaisesRegex(ValueError, 'outside'):
            collect_proposals(self.db, Adapter(), IntelligenceRequest(self.entity, (self.source,)))
        self.assertEqual(list_proposals(self.db)['proposals'], [])

    def test_reviewed_finding_is_a_hypothesis_and_retains_original_and_edited_payload(self):
        original = self.proposal(confidence=1)
        identifier = import_proposal(self.db, original)['id']
        edited = {**original['payload'], 'statement': 'Human-edited fixture possibility.'}
        result = self.accept(identifier, payload=edited)
        claim = dict(self.db.execute('SELECT * FROM claims WHERE id=?', (result['created_record_id'],)).fetchone())
        self.assertEqual(claim['status'], 'hypothesis')
        self.assertEqual(claim['statement'], edited['statement'])
        proposal = list_proposals(self.db)['proposals'][0]
        self.assertEqual(proposal['payload'], original['payload'])
        self.assertEqual(proposal['reviewed_payload'], edited)
        decorated = annotate_proposals(self.db, [claim], 'claim')[0]
        self.assertEqual(decorated['proposal_origin']['id'], identifier)
        self.assertEqual(decorated['proposal_origin']['confidence'], 1)

    def test_accepted_connection_is_potential_hypothesis_with_explicit_proposal_origin(self):
        original = self.connection()
        second_source = self.evidence('Source two')
        original['source_ids'].append(second_source)
        identifier = import_proposal(self.db, original)['id']
        result = self.accept(identifier)
        edge = dict(self.db.execute('SELECT * FROM graph_edges WHERE id=?', (result['created_record_id'],)).fetchone())
        self.assertEqual((edge['status'], edge['actuality'], edge['money']), ('hypothesis', 'potential', 'unknown'))
        self.assertEqual(edge['provenance'], 'ai_reviewed')
        self.assertEqual(edge['money_direction'], 'unknown')
        self.assertIsNone(edge['evidence_checked_at'])
        graph = dispatch(self.db, {'action': 'anatomy', 'data': {'center_id': original['payload']['source_id']}})
        stored = next(item for item in graph['edges'] if item['id'] == result['created_record_id'])
        self.assertEqual(stored['proposal_origin']['source_ids'], original['source_ids'])
        self.assertEqual(len(stored['proposal_sources']), 2)
        self.assertEqual(stored['proposal_origin']['metadata_assurance'], 'declared_unverified')
        with self.assertRaisesRegex(ValueError, 'already reviewed'):
            self.accept(identifier)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM graph_edges').fetchone()[0], 1)

    def test_payload_cannot_request_verified_status_payment_or_hide_unknowns(self):
        value = self.connection()
        for extra in ({'status': 'confirmed'}, {'money': 'yes'}, {'actuality': 'existing'}, {'provenance': 'manual'}):
            with self.subTest(extra=extra):
                with self.assertRaises(ValueError):
                    import_proposal(self.db, {**value, 'payload': {**value['payload'], **extra}})

    def test_research_question_can_have_no_sources_but_is_still_only_a_hypothesis(self):
        value = self.proposal(kind='research_question', source_ids=[], payload={
            'entity_id': self.entity, 'field': 'new_activity', 'question': 'Fixture question: what demand might emerge?'})
        result = self.accept(import_proposal(self.db, value)['id'])
        claim = dict(self.db.execute('SELECT * FROM claims WHERE id=?', (result['created_record_id'],)).fetchone())
        self.assertEqual(claim['status'], 'hypothesis')
        self.assertIsNone(claim['evidence_id'])
        self.assertTrue(claim['statement'].startswith('Research question:'))

    def test_rejection_preserves_suggestion_and_requires_a_human_note(self):
        identifier = import_proposal(self.db, self.proposal())['id']
        with self.assertRaisesRegex(ValueError, 'review note'):
            review_proposal(self.db, {'id': identifier, 'decision': 'accept', 'reviewer_note': ''})
        result = review_proposal(self.db, {'id': identifier, 'decision': 'reject', 'reviewer_note': 'Fixture source does not support this interpretation.'})
        self.assertEqual(result['status'], 'rejected')
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM claims').fetchone()[0], 0)
        self.assertEqual(list_proposals(self.db)['proposals'][0]['status'], 'rejected')

    def test_failed_final_review_write_rolls_back_the_graph_record_and_events(self):
        identifier = import_proposal(self.db, self.connection())['id']
        self.db.executescript("""CREATE TRIGGER fixture_review_failure BEFORE UPDATE ON intelligence_proposals
            WHEN NEW.status='accepted' BEGIN SELECT RAISE(ABORT,'fixture failure'); END;""")
        with self.assertRaises(sqlite3.IntegrityError):
            self.accept(identifier)
        self.assertEqual(list_proposals(self.db)['proposals'][0]['status'], 'proposed')
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM graph_edges').fetchone()[0], 0)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM graph_edge_events').fetchone()[0], 0)

    def test_internal_review_path_rejects_wrong_proposal_or_stronger_claims(self):
        from terminal.anatomy import save_graph_edge
        value = self.connection()
        identifier = import_proposal(self.db, value)['id']
        wrong_kind = import_proposal(self.db, self.proposal())['id']
        base = {**value['payload'], 'status': 'hypothesis', 'actuality': 'potential',
                'money': 'unknown', 'money_direction': 'unknown', 'evidence_checked_at': None,
                'explanation': value['explanation'], 'evidence_gaps': value['evidence_gaps'],
                'evidence_id': self.source, 'observed_at': OBSERVED}
        with self.assertRaises(ValueError):
            save_graph_edge(self.db, base, reviewed_proposal_id=identifier)
        for reviewed_id, changes in ((999999, {}), (wrong_kind, {}), (identifier, {'status': 'inference'}),
                                     (identifier, {'actuality': 'existing'}),
                                     (identifier, {'evidence_checked_at': OBSERVED}),
                                     (identifier, {'supersedes_id': 1})):
            with self.subTest(reviewed_id=reviewed_id, changes=changes):
                with self.assertRaises(ValueError):
                    with self.db:
                        self.db.execute('BEGIN IMMEDIATE')
                        save_graph_edge(self.db, {**base, **changes}, reviewed_proposal_id=reviewed_id, _review_transaction=True)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM graph_edges').fetchone()[0], 0)
        self.accept(identifier)
        with self.assertRaises(ValueError):
            with self.db:
                self.db.execute('BEGIN IMMEDIATE')
                save_graph_edge(self.db, base, reviewed_proposal_id=identifier, _review_transaction=True)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM graph_edges').fetchone()[0], 1)
        event = self.db.execute('SELECT reason FROM graph_edge_events ORDER BY id DESC LIMIT 1').fetchone()[0]
        self.assertIn('Human review', event)

    def test_finding_entity_ids_and_adapter_metadata_cannot_be_coerced_or_spoofed(self):
        for identifier in (True, 1.5):
            with self.assertRaises(ValueError):
                import_proposal(self.db, self.proposal(payload={'entity_id': identifier, 'field': 'what_it_does', 'statement': 'Fixture.'}))
        value = self.proposal()
        class Adapter:
            name, model = 'Fixture adapter', 'fixture-only'
            def extract(adapter, request):
                return [{**value, 'provider': 'Spoofed provider'}]
        with self.assertRaisesRegex(ValueError, 'override'):
            collect_proposals(self.db, Adapter(), IntelligenceRequest(self.entity, (self.source,)))
        self.assertEqual(list_proposals(self.db)['proposals'], [])
