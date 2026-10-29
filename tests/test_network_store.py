import os
import tempfile
import unittest
from unittest.mock import patch
from terminal.db import connect
from terminal.network_store import dispatch_network
from terminal.network_export import export_network

class NetworkStoreTests(unittest.TestCase):
 def test_revision_guard_and_daily_ai_budget(self):
  with tempfile.TemporaryDirectory() as path, patch.dict(os.environ, {'TERMINAL_DATA_DIR':path}):
   db=connect()
   try:
    self.assertIsNone(dispatch_network(db,'network_load',{}))
    graph={'format':'bd-oracle-network-v1','revision':0,'businesses':[],'sources':[],'relationships':[]}
    self.assertEqual(dispatch_network(db,'network_save',{'document':graph})['revision'],1)
    with self.assertRaisesRegex(ValueError,'conflict'):dispatch_network(db,'network_save',{'document':graph})
    self.assertEqual(dispatch_network(db,'network_load',{})['revision'],1)
    for _ in range(10):dispatch_network(db,'network_ai_reserve',{})
    with self.assertRaisesRegex(ValueError,'limit'):dispatch_network(db,'network_ai_reserve',{})
    self.assertEqual(export_network(db)['businesses'],[])
   finally:db.close()

 def test_legacy_export_retains_business_edge_and_evidence(self):
  from terminal.service import dispatch
  with tempfile.TemporaryDirectory() as path, patch.dict(os.environ, {'TERMINAL_DATA_DIR':path}):
   db=connect()
   try:
    def call(action,**data): return dispatch(db,{'action':action,'data':data})
    ids=[call('save_entity',name=name,kind='organisation')['id'] for name in ['Fixture A','Fixture B']]
    nodes=[]
    for identifier in ids:
     graph=call('anatomy',entity_id=identifier)
     nodes.append(next(n['id'] for n in graph['catalog'] if n['entity_id']==identifier))
    source=call('save_evidence',title='Fixture source',url='https://example.com/evidence',source_type='documentation',observed_at='2026-10-29T00:00:00Z',original_text='Synthetic test evidence.',interpretation='Synthetic interpretation.',verification='confirmed')['id']
    call('save_graph_edge',source_id=nodes[0],target_id=nodes[1],relation='integrates_with',essentiality='optional',actuality='existing',lens='other',status='confirmed',explanation='Fixture integration',source_value='Fixture usage',target_value='Fixture distribution',money='unknown',observed_at='2026-10-29T00:00:00Z',evidence_id=source,evidence_gaps='')
    exported=export_network(db)
    self.assertEqual(len(exported['businesses']),2)
    self.assertEqual(exported['relationships'][0]['type'],'integration')
    self.assertEqual(exported['relationships'][0]['sourceIds'],[f'legacy:source:{source}'])
    self.assertEqual(db.execute('SELECT count(*) FROM graph_edges').fetchone()[0],1)
   finally:db.close()
