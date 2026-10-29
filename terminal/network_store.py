"""Additive network document storage; never rewrites legacy research tables."""
import json
from .db import now

def dispatch_network(db, action, data):
    if action == 'network_load':
        row = db.execute('SELECT document,revision FROM network_workspace WHERE id=1').fetchone()
        if not row: return None
        result=json.loads(row['document']); result['revision']=row['revision']; return result
    if action == 'network_save':
        document=data['document']; revision=document['revision']
        if not isinstance(revision,int) or revision<0 or document.get('format')!='bd-oracle-network-v1':
            raise ValueError('Invalid network document')
        # Full structured validation happens at the TypeScript API boundary.
        db.execute('BEGIN IMMEDIATE')
        try:
            row=db.execute('SELECT revision FROM network_workspace WHERE id=1').fetchone()
            if (row['revision'] if row else 0)!=revision: raise ValueError('Network revision conflict. Reload before saving.')
            document={**document,'revision':revision+1}
            db.execute('INSERT INTO network_workspace(id,revision,document,updated_at) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,document=excluded.document,updated_at=excluded.updated_at',(revision+1,json.dumps(document),now()))
            db.commit(); return document
        except Exception:
            db.rollback(); raise
    if action == 'network_ai_reserve':
        day=now()[:10]
        with db:
            db.execute('INSERT INTO network_ai_usage(day,attempts) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET attempts=attempts+1 WHERE attempts<10',(day,))
            if db.execute('SELECT changes()').fetchone()[0]!=1: raise ValueError('Daily AI request limit reached (10 attempts).')
        return {'reserved':True}
    raise ValueError('Unknown network action')
