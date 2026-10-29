"""Explicit local RPC commands. SQL and filesystem paths never come from the browser."""
import json
import sqlite3
from datetime import datetime
from urllib.parse import urlparse
from .db import now, rows
from .report import quality

STATUSES = ('confirmed','inference','hypothesis','unknown')
FIELDS = ('what_it_does','product_service','customers','actor_wants','demand_behaviour','problem_solved','customer_exchange','payment_flow','revenue_model','suppliers','distribution','recurring_consumption','depends_on','dependents','new_activity','new_problems','actor','want','behaviour','problem','provider','transaction','value','next_actor')
REL_TYPES = ('customer/provider','integration','partnership','distribution','investment','liquidity provision','infrastructure dependency','competition','ecosystem membership')

def required(data, key, maximum=20000):
    value = data.get(key)
    if not isinstance(value,str) or not value.strip() or len(value)>maximum:
        raise ValueError(f'{key} is required (maximum {maximum} characters)')
    return value.strip()

def choice(data,key,allowed):
    value = required(data,key)
    if value not in allowed: raise ValueError(f'Invalid {key}')
    return value

def timestamp(value):
    if not isinstance(value,str): raise ValueError('Observation date is required')
    try: parsed = datetime.fromisoformat(value.replace('Z','+00:00'))
    except ValueError: raise ValueError('Invalid observation date')
    if not parsed.tzinfo: raise ValueError('Observation date must include a timezone')
    return parsed.isoformat()

def entity(db, identifier, kinds=None):
    try: identifier = int(identifier)
    except (ValueError,TypeError): raise ValueError('Invalid entity ID')
    row = db.execute('SELECT * FROM entities WHERE id=?',(identifier,)).fetchone()
    if not row or (kinds and row['kind'] not in kinds): raise ValueError('Entity not found or wrong kind')
    return dict(row)

def evidence_ref(db,data,status,key='evidence_id'):
    identifier = data.get(key)
    if identifier in (None,''):
        if status in ('confirmed','supported','verified'): raise ValueError('Verified findings require evidence')
        return None
    evidence = db.execute('SELECT * FROM evidence WHERE id=?',(int(identifier),)).fetchone()
    if not evidence: raise ValueError('Evidence not found')
    if status in ('confirmed','supported','verified') and evidence['verification'] != 'confirmed':
        raise ValueError('Confirmed findings require confirmed evidence; an announcement alone does not prove payment or partnership')
    return evidence['id']

def detail(db, identifier):
    item = entity(db,identifier)
    item['claims'] = rows(db,'''SELECT c.*,e.title AS evidence_title,e.url AS evidence_url,e.original_text,e.interpretation FROM claims c
    LEFT JOIN evidence e ON e.id=c.evidence_id WHERE entity_id=? ORDER BY c.id DESC''',(item['id'],))
    from .intelligence import annotate_proposals
    annotate_proposals(db,item['claims'],record_type='claim')
    item['links'] = rows(db,'''SELECT l.*,a.name AS from_name,a.kind AS from_kind,b.name AS to_name,b.kind AS to_kind,e.url AS evidence_url
    FROM entity_links l JOIN entities a ON a.id=l.from_id JOIN entities b ON b.id=l.to_id LEFT JOIN evidence e ON e.id=l.evidence_id
    WHERE from_id=? OR to_id=?''',(item['id'],item['id']))
    if item['kind']=='asset':
        item['asset'] = dict(db.execute('SELECT * FROM assets WHERE id=?',(item['id'],)).fetchone())
        item['asset']['candidates'] = json.loads(item['asset'].pop('candidates_json'))
        item['listings'] = rows(db,'SELECT * FROM listings WHERE asset_id=? ORDER BY available DESC,symbol',(item['id'],))
        identity = db.execute('SELECT * FROM identities WHERE id=?',(item['asset']['identity_id'],)).fetchone()
        item['identity'] = dict(identity) if identity else None
        item['identity_evidence'] = dict(db.execute('SELECT * FROM evidence WHERE id=?',(item['asset']['match_evidence_id'],)).fetchone()) if item['asset']['match_evidence_id'] else None
        item['identity_reviews'] = rows(db,'SELECT * FROM identity_reviews WHERE asset_id=? ORDER BY id DESC',(item['id'],))
        item['verified_contracts'] = rows(db,'''SELECT cv.*,e.title AS evidence_title,e.url AS evidence_url,e.original_text FROM contract_verifications cv
            JOIN evidence e ON e.id=cv.evidence_id WHERE identity_id=? ORDER BY cv.id DESC''',(item['asset']['identity_id'],))
        if identity:
            item['identity']['profile'] = json.loads(identity['profile_json']) if identity['profile_json'] else None
            item['identity']['platforms'] = json.loads(identity['platforms_json'])
            item['identity'].pop('profile_json')
    item['activities'] = rows(db,'''SELECT ba.*,e.title AS evidence_title,e.url AS evidence_url FROM business_activities ba
        LEFT JOIN evidence e ON e.id=ba.evidence_id WHERE product_id=? ORDER BY ba.id DESC''',(item['id'],))
    item['relationships'] = relationships(db,item['id'])
    item['opportunities'] = rows(db,'SELECT * FROM opportunities WHERE entity_id=? ORDER BY id DESC',(item['id'],))
    return item

def relationships(db, identifier=None):
    result = rows(db,'''SELECT r.*,a.name AS a_name,b.name AS b_name FROM relationships r JOIN entities a ON a.id=r.a_id
    JOIN entities b ON b.id=r.b_id'''+(' WHERE a_id=? OR b_id=?' if identifier else '')+' ORDER BY r.id DESC', (identifier,identifier) if identifier else ())
    for relationship in result:
        relationship['evidence'] = rows(db,'''SELECT e.* FROM evidence e JOIN relationship_evidence re ON re.evidence_id=e.id WHERE relationship_id=?''',(relationship['id'],))
    return result

def dispatch(db, request):
    action = request.get('action')
    data = request.get('data') or {}
    if not isinstance(data,dict): raise ValueError('Invalid data')
    if action in ('anatomy','asset_anatomy','unresolved_graph','save_graph_node','save_graph_edge','retract_graph_edge'):
        from .anatomy import dispatch_anatomy
        return dispatch_anatomy(db,action,data)
    if action in ('taxonomy','save_framework'):
        from .taxonomy import dispatch_taxonomy
        return dispatch_taxonomy(db,action,data)
    if action in ('intelligence_status','import_proposal','list_proposals','review_proposal'):
        from .intelligence import dispatch_intelligence
        return dispatch_intelligence(db,action,data)
    if action=='overview':
        from .intelligence import annotate_proposals
        recent_claims=rows(db,'SELECT c.*,e.name FROM claims c JOIN entities e ON e.id=c.entity_id ORDER BY c.id DESC LIMIT 8')
        annotate_proposals(db,recent_claims,record_type='claim')
        return {'quality':quality(db), 'entities':rows(db,'SELECT * FROM entities ORDER BY kind,name'),
                'evidence':rows(db,'SELECT * FROM evidence ORDER BY id DESC LIMIT 1000'),
                'opportunities':rows(db,'SELECT o.*,e.name AS entity_name FROM opportunities o LEFT JOIN entities e ON e.id=o.entity_id ORDER BY o.id DESC'),
                'recent_claims':recent_claims,
                'relationships':relationships(db),
                'businesses':rows(db,"SELECT e.*,(SELECT count(*) FROM claims c WHERE c.entity_id=e.id) AS findings FROM entities e WHERE kind IN ('organisation','product') ORDER BY name")}
    if action=='assets':
        search = str(data.get('search',''))[:200]
        scope = data.get('scope','all')
        clauses = ['(a.code LIKE ? OR i.name LIKE ?)']
        params = ['%'+search+'%']*2
        if scope=='unresolved': clauses.append("a.match_status='unresolved'")
        if scope=='verified': clauses.append("a.match_status='verified'")
        if scope=='active': clauses.append("EXISTS(SELECT 1 FROM listings l WHERE l.asset_id=a.id AND l.available=1 AND l.status='TRADING' AND l.spot_allowed=1)")
        where = ' AND '.join(clauses)
        page = max(1,int(data.get('page',1)))
        count = db.execute('SELECT COUNT(*) FROM assets a LEFT JOIN identities i ON i.id=a.identity_id WHERE '+where,params).fetchone()[0]
        result = rows(db,'''SELECT a.*,i.name AS project_name,i.enriched_at,
        (SELECT COUNT(*) FROM listings l WHERE l.asset_id=a.id) AS pair_count,
        (SELECT COUNT(*) FROM listings l WHERE l.asset_id=a.id AND l.available=1 AND l.status='TRADING' AND l.spot_allowed=1) AS active_pairs
        FROM assets a LEFT JOIN identities i ON i.id=a.identity_id WHERE '''+where+' ORDER BY a.code LIMIT 50 OFFSET ?',params+[(page-1)*50])
        for asset in result: asset['candidates'] = json.loads(asset.pop('candidates_json'))
        return {'items':result,'total':count,'page':page}
    if action=='detail': return detail(db,data.get('id'))
    if action=='quality': return quality(db)
    # All writes are transactional. No network requests run within a browser request.
    try:
        with db:
            if action=='save_evidence':
                url = required(data,'url',2048)
                parsed = urlparse(url)
                if parsed.scheme not in ('https','http') or not parsed.netloc: raise ValueError('Evidence needs an http(s) source URL')
                published = data.get('published_at') or None
                if published: published=timestamp(published)
                identifier = db.execute('''INSERT INTO evidence(title,url,source_type,observed_at,published_at,original_text,interpretation,verification,created_at)
                VALUES(?,?,?,?,?,?,?,?,?)''',(required(data,'title',500),url,required(data,'source_type',100),timestamp(data.get('observed_at')),published,required(data,'original_text'),str(data.get('interpretation',''))[:20000],choice(data,'verification',STATUSES),now())).lastrowid
            elif action=='save_entity':
                identifier=db.execute('INSERT INTO entities(kind,name,created_at) VALUES(?,?,?)',(choice(data,'kind',('organisation','product')),required(data,'name',200),now())).lastrowid
            elif action=='save_claim':
                subject=entity(db,data.get('entity_id'))
                status=choice(data,'status',STATUSES)
                identifier=db.execute('INSERT INTO claims(entity_id,field,statement,status,evidence_id,observed_at,created_at) VALUES(?,?,?,?,?,?,?)',
                (subject['id'],choice(data,'field',FIELDS),required(data,'statement'),status,evidence_ref(db,data,status),timestamp(data.get('observed_at')),now())).lastrowid
            elif action=='save_activity':
                product=entity(db,data.get('product_id'),('product',))
                status=choice(data,'status',STATUSES)
                identifier=db.execute('INSERT INTO business_activities(product_id,name,enables,actor,status,evidence_id,observed_at,created_at) VALUES(?,?,?,?,?,?,?,?)',
                  (product['id'],required(data,'name',200),required(data,'enables'),required(data,'actor'),status,evidence_ref(db,data,status),timestamp(data.get('observed_at')),now())).lastrowid
            elif action=='save_link':
                link_type=choice(data,'type',('operates','associated_asset'))
                a=entity(db,data.get('from_id'),('organisation',) if link_type=='operates' else ('product',))
                b=entity(db,data.get('to_id'),('product',) if link_type=='operates' else ('asset',))
                status=choice(data,'status',STATUSES)
                identifier=db.execute('''INSERT INTO entity_links(from_id,to_id,type,status,evidence_id,observed_at) VALUES(?,?,?,?,?,?)
                ON CONFLICT(from_id,to_id,type) DO UPDATE SET status=excluded.status,evidence_id=excluded.evidence_id,observed_at=excluded.observed_at RETURNING id''',
                (a['id'],b['id'],link_type,status,evidence_ref(db,data,status),timestamp(data.get('observed_at')))).fetchone()[0]
            elif action=='resolve':
                subject=entity(db,data.get('asset_id'),('asset',))
                cg_id=required(data,'identity_id',200)
                if not db.execute('SELECT 1 FROM identities WHERE id=?',(cg_id,)).fetchone(): raise ValueError('CoinGecko identity not indexed; run candidates first')
                evidence=evidence_ref(db,data,'verified')
                db.execute("UPDATE assets SET identity_id=?,match_status='verified',match_evidence_id=? WHERE id=?",(cg_id,evidence,subject['id']))
                db.execute("INSERT INTO identity_reviews(asset_id,identity_id,evidence_id,action,reviewed_at) VALUES(?,?,?,'verified',?)",(subject['id'],cg_id,evidence,now()))
                identifier=subject['id']
            elif action=='unresolve':
                subject=entity(db,data.get('asset_id'),('asset',))
                previous=db.execute('SELECT identity_id,match_evidence_id FROM assets WHERE id=?',(subject['id'],)).fetchone()
                db.execute("INSERT INTO identity_reviews(asset_id,identity_id,evidence_id,action,reviewed_at) VALUES(?,?,?,'returned_to_unresolved',?)",(subject['id'],previous['identity_id'],previous['match_evidence_id'],now()))
                db.execute("UPDATE assets SET identity_id=NULL,match_status='unresolved',match_evidence_id=NULL WHERE id=?",(subject['id'],))
                identifier=subject['id']
            elif action=='verify_contract':
                cg_id=required(data,'identity_id',200)
                if not db.execute('SELECT 1 FROM identities WHERE id=?',(cg_id,)).fetchone(): raise ValueError('CoinGecko identity not found')
                identifier=db.execute('INSERT INTO contract_verifications(identity_id,network,address,evidence_id,observed_at,created_at) VALUES(?,?,?,?,?,?)',
                  (cg_id,required(data,'network',200),required(data,'address',500),evidence_ref(db,data,'verified'),timestamp(data.get('observed_at')),now())).lastrowid
            elif action=='save_relationship':
                a=entity(db,data.get('a_id'),('organisation','product'))
                b=entity(db,data.get('b_id'),('organisation','product'))
                if a['id']==b['id']: raise ValueError('Choose two different businesses')
                status=choice(data,'status',STATUSES)
                evidence=evidence_ref(db,data,'confirmed' if data.get('money') in ('yes','no') else status)
                announcement=data.get('announcement_date') or None
                if announcement: announcement=timestamp(announcement)
                identifier=db.execute('''INSERT INTO relationships(a_id,b_id,type,a_provides,b_provides,reason,a_value,b_value,money,observed_at,announcement_date,status)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?)''',(a['id'],b['id'],choice(data,'type',REL_TYPES),*[required(data,key) for key in ('a_provides','b_provides','reason','a_value','b_value')],choice(data,'money',('yes','no','unknown')),timestamp(data.get('observed_at')),announcement,status)).lastrowid
                if evidence: db.execute('INSERT INTO relationship_evidence VALUES(?,?)',(identifier,evidence))
            elif action=='save_opportunity':
                subject=entity(db,data['entity_id']) if data.get('entity_id') else None
                stage=choice(data,'stage',('hypothesis','investigating','supported','dismissed'))
                values=(subject['id'] if subject else None,*[required(data,key) for key in ('title','friction','proposed_solution','buyer','next_step')],stage,evidence_ref(db,data,stage))
                if data.get('id'):
                    identifier=int(data['id'])
                    if not db.execute('SELECT 1 FROM opportunities WHERE id=?',(identifier,)).fetchone(): raise ValueError('Opportunity not found')
                    db.execute('UPDATE opportunities SET entity_id=?,title=?,friction=?,proposed_solution=?,buyer=?,next_step=?,stage=?,evidence_id=? WHERE id=?',(*values,identifier))
                else:
                    identifier=db.execute('INSERT INTO opportunities(entity_id,title,friction,proposed_solution,buyer,next_step,stage,evidence_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)',(*values,now())).lastrowid
            elif action=='update_evidence':
                identifier=int(data['id'])
                if not db.execute('SELECT 1 FROM evidence WHERE id=?',(identifier,)).fetchone(): raise ValueError('Evidence not found')
                # Append-only evidence is intentional: corrections are a new source record.
                raise ValueError('Evidence is append-only. Add corrected evidence and a superseding finding to preserve the audit trail.')
            else: raise ValueError('Unknown action')
        return {'id':identifier}
    except sqlite3.IntegrityError as exc:
        raise ValueError(f'Record violates a database constraint: {exc}') from exc
