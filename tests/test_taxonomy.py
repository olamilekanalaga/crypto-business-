"""Generic frameworks are questions, never evidence-backed business facts."""
import os
import tempfile
import unittest
from unittest.mock import patch
from terminal.db import connect
from terminal.taxonomy import dispatch_taxonomy


class TaxonomyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='framework-fixture-')
        self.env = patch.dict(os.environ, {'TERMINAL_DATA_DIR': self.temp.name})
        self.env.start()
        self.db = connect()
        self.addCleanup(self.temp.cleanup)
        self.addCleanup(self.env.stop)
        self.addCleanup(self.db.close)

    def call(self, action, **data):
        return dispatch_taxonomy(self.db, action, data)

    def test_starters_are_questions_and_never_instantiate_business_nodes_or_edges(self):
        result = self.call('taxonomy')
        self.assertEqual({row['name'] for row in result['frameworks']},
                         {'Lending protocol', 'Blockchain game', 'Wallet provider', 'Data provider'})
        self.assertTrue(all(row['questions'] and row['origin'] == 'starter' for row in result['frameworks']))
        for table in ('entities', 'graph_nodes', 'graph_edges', 'claims'):
            self.assertEqual(self.db.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0], 0)
        again = connect()
        try:
            self.assertEqual(again.execute('SELECT COUNT(*) FROM research_frameworks').fetchone()[0], 4)
        finally:
            again.close()

    def test_researcher_can_create_and_refine_framework_without_asserting_dependencies(self):
        created = self.call('save_framework', name='Fixture service business',
                            description='Fixture questions, not universal needs.',
                            questions=[{'topic': 'Demand', 'prompt': 'Who might need it?', 'optional': True}])
        result = self.call('save_framework', id=created['id'], expected_revision=1,
                           name='Refined fixture framework', description='Investigate this possibility.',
                           questions=[{'topic': 'Consumption', 'prompt': 'What is repeatedly consumed?', 'optional': False}])
        self.assertEqual(result['revision'], 2)
        framework = next(row for row in self.call('taxonomy')['frameworks'] if row['id'] == created['id'])
        self.assertEqual(framework['questions'][0]['topic'], 'Consumption')
        self.assertEqual(framework['origin'], 'manual')
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM graph_edges').fetchone()[0], 0)
        with self.assertRaisesRegex(ValueError, 'changed'):
            self.call('save_framework', id=created['id'], expected_revision=1, name='Stale edit',
                      description='Fixture stale edit.', questions=[{'topic': 'Stale', 'prompt': 'Overwrite?'}])

    def test_invalid_or_claim_like_question_shapes_do_not_change_frameworks(self):
        for questions in ([], [{'topic': 'Need', 'prompt': '', 'optional': True}],
                          [{'topic': 'Need', 'prompt': 'Why?', 'confirmed': True}],
                          [{'topic': 'Need', 'prompt': 'Why?', 'optional': 'yes'}]):
            with self.subTest(questions=questions):
                with self.assertRaises(ValueError):
                    self.call('save_framework', name='Bad fixture', description='Invalid fixture.', questions=questions)
        self.assertEqual(len(self.call('taxonomy')['frameworks']), 4)
