"""Read legacy research into a portable network file. No inferred ticker identities.
Usage: python -m terminal.network_export > network-legacy.json
Old source text remains intact in SQLite; portable excerpts are bounded.
"""
import json
from .db import connect, rows

def export_network(db):
    sources=[]
    for s in rows(db,'SELECT * FROM evidence ORDER BY id'):
        if not s['url'].startswith(('https://','http://')): continue
        sources.append(dict(id=f"legacy:source:{s['id']}",title=s['title'],url=s['url'],observedAt=s['observed_at'].replace('+00:00','Z'),excerpt=s['original_text'][:6000] or 'Original excerpt not recorded; inspect the source.',interpretation=s['interpretation'][:6000] or 'No interpretation recorded.',status=s['verification']))
    source_ids={s['id'] for s in sources}
    def ref(eid): return [f'legacy:source:{eid}'] if f'legacy:source:{eid}' in source_ids else []
    businesses=[]
    for b in rows(db,"SELECT * FROM entities WHERE kind IN ('organisation','product') ORDER BY id"):
        claims=rows(db,"SELECT * FROM claims WHERE entity_id=? ORDER BY id DESC",(b['id'],))
        summary=next((c['statement'] for c in claims if c['field']=='what_it_does'),'What this business does remains unresearched.')
        businesses.append(dict(id=f"legacy:entity:{b['id']}",name=b['name'],kind=b['kind'],summary=summary[:6000],sectors=[],chains=[],products=[c['statement'][:6000] for c in claims if c['field']=='product_service'][:20],needs=[],capabilities=[],sourceIds=sorted({x for c in claims for x in ref(c['evidence_id'])})[:30]))
    ids={b['id'] for b in businesses}; relationships=[]
    nodes={n['id']:n for n in rows(db,'SELECT * FROM graph_nodes')}
    for r in rows(db,'SELECT * FROM graph_edges WHERE active=1 ORDER BY id'):
        a=f"legacy:entity:{nodes[r['source_id']]['entity_id']}";b=f"legacy:entity:{nodes[r['target_id']]['entity_id']}"
        if a not in ids or b not in ids: continue
        evidence=ref(r['evidence_id']);status=r['status'];provenance='ai' if r['provenance']=='ai_reviewed' else 'manual'
        kind={'integrates_with':'integration','partners_with':'partnership','competes_with':'competition','could_benefit_from':'could_benefit_from'}.get(r['relation'],'dependency')
        if provenance=='ai':kind='could_benefit_from';status='hypothesis'
        if status=='confirmed' and not evidence:status='unknown'
        relationships.append(dict(id=f"legacy:edge:{r['id']}",a=a,b=b,type=kind,reason=r['explanation'][:6000],aProvides=r['source_context'] or 'See original research for source context.',bProvides=r['target_context'] or 'See original research for target context.',aValue=r['source_value'][:6000],bValue=r['target_value'][:6000],moneyFlow=f"Legacy payment observation: {r['money']}; direction: {r['money_direction']}. See cited evidence for scope.",status=status,provenance=provenance,sourceIds=evidence,gaps=[r['evidence_gaps'][:6000] or 'Recheck source scope and current relationship status.'],observedAt=r['observed_at'].replace('+00:00','Z'),confidence=None,review='accepted' if status=='confirmed' else 'pending',note=f"Imported graph edge {r['id']}; original relation: {r['relation']}. Full history remains in SQLite.",saved=False))
    return dict(format='bd-oracle-network-v1',revision=0,businesses=businesses,sources=sources,relationships=relationships)

if __name__=='__main__':
    db=connect()
    try: print(json.dumps(export_network(db),indent=2))
    finally: db.close()
