"""Additive registry storage. Assets and raw compressed snapshot history travel together."""
import json
from .db import now

def dispatch_usdc(db,action,data):
 if action=='usdc_load':
  row=db.execute('SELECT document,revision FROM usdc_registry WHERE id=1').fetchone()
  return {**json.loads(row['document']),'revision':row['revision']} if row else None
 if action=='usdc_save':
  value=data['document']; revision=value['revision']
  if value.get('format')!='bd-oracle-usdc-v1' or not isinstance(revision,int): raise ValueError('Invalid registry')
  db.execute('BEGIN IMMEDIATE')
  try:
   row=db.execute('SELECT revision FROM usdc_registry WHERE id=1').fetchone()
   if (row['revision'] if row else 0)!=revision: raise ValueError('Registry revision conflict')
   result={**value,'revision':revision+1}
   db.execute('INSERT INTO usdc_registry VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,document=excluded.document,updated_at=excluded.updated_at',(revision+1,json.dumps(result),now()))
   db.commit();return result
  except Exception:
   db.rollback();raise
 raise ValueError('Unknown registry operation')
