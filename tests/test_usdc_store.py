import os
import tempfile
import unittest
from unittest.mock import patch
from terminal.db import connect
from terminal.usdc_store import dispatch_usdc
from terminal.network_store import dispatch_network

class USDCStoreTests(unittest.TestCase):
    def test_stale_refresh_cannot_overwrite_registry_or_research(self):
        with tempfile.TemporaryDirectory() as path, patch.dict(os.environ, {'TERMINAL_DATA_DIR': path}):
            db = connect()
            try:
                graph = {'format':'bd-oracle-network-v1','revision':0,'businesses':[], 'sources':[], 'relationships':[]}
                saved = dispatch_network(db, 'network_save', {'document':graph})
                registry = {'format':'bd-oracle-usdc-v1','revision':0,'assets':[], 'snapshots':[]}
                self.assertIsNone(dispatch_usdc(db, 'usdc_load', {}))
                current = dispatch_usdc(db, 'usdc_save', {'document':registry})
                with self.assertRaisesRegex(ValueError, 'conflict'):
                    dispatch_usdc(db, 'usdc_save', {'document':registry})
                self.assertEqual(dispatch_usdc(db, 'usdc_load', {}), current)
                self.assertEqual(dispatch_network(db, 'network_load', {}), saved)
            finally:
                db.close()
