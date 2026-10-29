"""Evidence-aware, manually researched business dependency graph.

Only graph wrappers are automatic. No needs, dependencies, potential matches or
anatomical classifications are inferred from a name, asset or source document.
"""
import sqlite3
from .db import now, rows

CONCEPT_KINDS = ('need', 'capability', 'actor', 'resource')
RELATIONS = ('needs_to_operate', 'needs_to_grow', 'pays_for', 'provides_to',
             'partners_with', 'could_benefit_from', 'competes_with')
STATUSES = ('confirmed', 'inference', 'hypothesis', 'unknown')
LENSES = ('oxygen', 'blood', 'brain', 'legs', 'food', 'other')
CATEGORIES = ('all', 'essential', 'growth', 'existing', 'potential')
DIRECTIONS = ('both', 'incoming', 'outgoing')
MAX_NODES, MAX_EDGES, CATALOG_LIMIT, HISTORY_LIMIT = 500, 500, 5000, 100


def _helpers():
    # Imported at runtime because service dispatch imports this focused module.
    from .service import required, choice, timestamp, evidence_ref
    return required, choice, timestamp, evidence_ref


def _identifier(value, label):
    if isinstance(value, bool) or not isinstance(value, (int, str)):
        raise ValueError(f'Invalid {label}')
    if isinstance(value, str) and not value.isdecimal():
        raise ValueError(f'Invalid {label}')
    identifier = int(value)
    if identifier < 1 or identifier > 9223372036854775807:
        raise ValueError(f'Invalid {label}')
    return identifier


def _node(db, value):
    identifier = _identifier(value, 'graph node ID')
    node = db.execute('SELECT * FROM graph_nodes WHERE id=?', (identifier,)).fetchone()
    if node is None:
        raise ValueError('Graph node not found')
    return dict(node)


def sync_business_nodes(db):
    """Represent existing research records without generating any relationship."""
    with db:
        db.execute('''INSERT INTO graph_nodes(kind,entity_id,name,description,created_at)
            SELECT kind,id,name,'',created_at FROM entities
            WHERE kind IN ('organisation','product')
            ON CONFLICT(entity_id) DO NOTHING''')
        db.execute('''UPDATE graph_nodes SET name=(SELECT name FROM entities WHERE entities.id=graph_nodes.entity_id)
            WHERE entity_id IS NOT NULL AND name != (SELECT name FROM entities WHERE entities.id=graph_nodes.entity_id)''')


def save_graph_node(db, data):
    required, choice, _, _ = _helpers()
    # Business records are created through the existing business workspace. This
    # prevents a separately named graph node from masquerading as a linked business.
    with db:
        identifier = db.execute('''INSERT INTO graph_nodes(kind,name,description,created_at)
            VALUES(?,?,?,?)''', (choice(data, 'kind', CONCEPT_KINDS),
                                required(data, 'name', 200),
                                required(data, 'description'), now())).lastrowid
    return {'id': identifier}


def save_graph_edge(db, data):
    required, choice, timestamp, evidence_ref = _helpers()
    sync_business_nodes(db)
    source, target = _node(db, data.get('source_id')), _node(db, data.get('target_id'))
    if source['id'] == target['id']:
        raise ValueError('Choose two different graph nodes')
    relation = choice(data, 'relation', RELATIONS)
    essentiality = choice(data, 'essentiality', ('essential', 'optional', 'unknown'))
    actuality = choice(data, 'actuality', ('existing', 'potential'))
    status = choice(data, 'status', STATUSES)
    money = choice(data, 'money', ('yes', 'no', 'unknown'))
    lens = choice(data, 'lens', LENSES)
    if relation in ('partners_with', 'competes_with') and (
            source['kind'] not in ('organisation', 'product') or
            target['kind'] not in ('organisation', 'product')):
        raise ValueError('Partnership and competition connections require two organisation or product nodes')
    if relation == 'pays_for' and money == 'no':
        raise ValueError('Pays for cannot assert that no payment occurs')
    if relation == 'pays_for' and status == 'confirmed' and money != 'yes':
        raise ValueError('A confirmed pays for connection requires confirmed payment evidence and money=yes')
    if actuality == 'potential' and money != 'unknown':
        raise ValueError('A potential connection must leave payment unknown')
    if actuality == 'potential' and status == 'confirmed':
        raise ValueError('A potential connection cannot be a confirmed existing relationship')
    if relation == 'could_benefit_from' and actuality != 'potential':
        raise ValueError('Could benefit from must remain a potential connection')
    if relation == 'needs_to_operate' and essentiality != 'essential':
        raise ValueError('Needs to operate must be classified as essential')
    if relation == 'needs_to_grow' and essentiality != 'optional':
        raise ValueError('Needs to grow must be classified as optional')
    gaps = data.get('evidence_gaps', '')
    if not isinstance(gaps, str) or len(gaps) > 20000:
        raise ValueError('evidence_gaps must be text (maximum 20000 characters)')
    if (actuality == 'potential' or status != 'confirmed') and not gaps.strip():
        raise ValueError('Unverified and potential connections require explicit evidence gaps')
    # Presence is insufficient: positive/negative payment assertions need confirmed
    # evidence even when the wider economic interpretation is a hypothesis.
    evidence = evidence_ref(db, data, 'confirmed' if money != 'unknown' else status)
    observed = timestamp(data.get('observed_at'))
    explanation = required(data, 'explanation')
    source_value, target_value = required(data, 'source_value'), required(data, 'target_value')
    if data.get('provenance', 'manual') != 'manual':
        raise ValueError('Only manual research provenance is supported; AI extraction is not enabled')
    previous = data.get('supersedes_id')
    if previous not in (None, ''):
        previous = _identifier(previous, 'superseded edge ID')
    else:
        previous = None
    with db:
        # Make the revision check and deactivation indivisible across RPC processes.
        db.execute('BEGIN IMMEDIATE')
        if previous:
            prior = db.execute('SELECT * FROM graph_edges WHERE id=?', (previous,)).fetchone()
            if not prior or not prior['active']:
                raise ValueError('Only an active graph edge can be superseded')
        identifier = db.execute('''INSERT INTO graph_edges
            (source_id,target_id,relation,essentiality,actuality,lens,status,explanation,
             source_value,target_value,money,evidence_id,observed_at,evidence_gaps,provenance,supersedes_id,created_at)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, ?,?)''',
            (source['id'], target['id'], relation, essentiality, actuality, lens, status,
             explanation, source_value, target_value, money, evidence, observed, gaps.strip(),
             'manual', previous, now())).lastrowid
        db.execute('INSERT INTO graph_edge_events(edge_id,action,reason,recorded_at) VALUES(?,?,?,?)',
                   (identifier, 'created', 'Manual research connection recorded', now()))
        if previous:
            db.execute('UPDATE graph_edges SET active=0 WHERE id=?', (previous,))
            db.execute('INSERT INTO graph_edge_events(edge_id,action,reason,recorded_at) VALUES(?,?,?,?)',
                       (previous, 'superseded', f'Superseded by graph edge #{identifier}', now()))
    return {'id': identifier}


def retract_graph_edge(db, data):
    required, _, _, _ = _helpers()
    identifier = _identifier(data.get('id'), 'graph edge ID')
    reason = required(data, 'reason')
    with db:
        db.execute('BEGIN IMMEDIATE')
        edge = db.execute('SELECT * FROM graph_edges WHERE id=?', (identifier,)).fetchone()
        if edge is None:
            raise ValueError('Graph edge not found; legacy relationships are read-only in this graph')
        if not edge['active']:
            raise ValueError('Graph edge has already been retracted or superseded')
        db.execute('UPDATE graph_edges SET active=0 WHERE id=?', (identifier,))
        db.execute('INSERT INTO graph_edge_events(edge_id,action,reason,recorded_at) VALUES(?,?,?,?)',
                   (identifier, 'retracted', reason, now()))
    return {'id': identifier}


def _filter(data, key, allowed, default):
    value = data.get(key, default)
    if not isinstance(value, str) or value not in allowed:
        raise ValueError(f'Invalid graph {key}')
    return value


def _matches(edge, filters):
    if filters['status'] != 'all' and edge['status'] != filters['status']:
        return False
    if filters['lens'] != 'all' and edge['lens'] != filters['lens']:
        return False
    category = filters['category']
    if category == 'essential' and edge['essentiality'] != 'essential':
        return False
    if category == 'growth' and edge['relation'] != 'needs_to_grow':
        return False
    if category in ('existing', 'potential') and edge['actuality'] != category:
        return False
    return True


def _decorate_edges(db, values):
    if not values:
        return []
    identifiers = [value['id'] for value in values]
    placeholders = ','.join('?' for _ in identifiers)
    events = rows(db, f'SELECT * FROM graph_edge_events WHERE edge_id IN ({placeholders}) ORDER BY id', identifiers)
    histories = {}
    for event in events:
        histories.setdefault(event['edge_id'], []).append(event)
    for edge in values:
        edge['readonly'] = False
        edge['original_type'] = None
        edge['history'] = histories.get(edge['id'], [])
        edge['evidence'] = []
        if edge['evidence_id'] is not None:
            edge['evidence'] = [{
                'id': edge['evidence_id'], 'title': edge['evidence_title'],
                'url': edge['evidence_url'], 'original_text': edge['original_text'],
                'interpretation': edge['interpretation'], 'verification': edge['evidence_verification'],
                'observed_at': edge['evidence_observed_at'],
            }]
    return values


def _legacy_edges(db, center, direction):
    if center['entity_id'] is None:
        return []
    where = {'both': '(r.a_id=? OR r.b_id=?)', 'incoming': 'r.b_id=?', 'outgoing': 'r.a_id=?'}[direction]
    parameters = (center['entity_id'],) * (2 if direction == 'both' else 1)
    values = rows(db, f'''SELECT r.*,a.id AS source_id,b.id AS target_id,
        a.name AS source_name,b.name AS target_name,a.kind AS source_kind,b.kind AS target_kind,
        a.entity_id AS source_entity_id,b.entity_id AS target_entity_id
        FROM relationships r JOIN graph_nodes a ON a.entity_id=r.a_id
        JOIN graph_nodes b ON b.entity_id=r.b_id WHERE {where} ORDER BY r.id DESC''', parameters)
    if not values:
        return []
    placeholders = ','.join('?' for _ in values)
    evidence = rows(db, f'''SELECT e.*,re.relationship_id FROM evidence e
        JOIN relationship_evidence re ON re.evidence_id=e.id
        WHERE re.relationship_id IN ({placeholders}) ORDER BY e.id''', [value['id'] for value in values])
    sources = {}
    for source in evidence:
        relation_id = source.pop('relationship_id')
        sources.setdefault(relation_id, []).append(source)
    result = []
    for value in values:
        source_list = sources.get(value['id'], [])
        first = source_list[0] if source_list else {}
        result.append({
            'id': f"relationship:{value['id']}",
            'source_id': value['source_id'], 'target_id': value['target_id'],
            'source_name': value['source_name'], 'target_name': value['target_name'],
            'source_kind': value['source_kind'], 'target_kind': value['target_kind'],
            'source_entity_id': value['source_entity_id'], 'target_entity_id': value['target_entity_id'],
            'relation': 'documented_relationship', 'original_type': value['type'],
            'essentiality': 'unknown', 'actuality': 'existing', 'lens': 'other',
            'status': value['status'], 'explanation': value['reason'],
            'source_value': value['a_value'], 'target_value': value['b_value'],
            'source_provides': value['a_provides'], 'target_provides': value['b_provides'],
            'money': value['money'], 'observed_at': value['observed_at'],
            'announcement_date': value['announcement_date'],
            'evidence_gaps': 'No dependency, essentiality, or payment is inferred from this recorded relationship. Review the original evidence.' if value['status'] != 'confirmed' else '',
            'provenance': 'legacy_relationship', 'supersedes_id': None, 'active': 1,
            'created_at': value['observed_at'], 'readonly': True, 'history': [],
            'evidence_id': first.get('id'), 'evidence_title': first.get('title'),
            'evidence_url': first.get('url'), 'original_text': first.get('original_text'),
            'interpretation': first.get('interpretation'), 'evidence_verification': first.get('verification'),
            'evidence_observed_at': first.get('observed_at'), 'evidence': source_list,
        })
    return result


def anatomy(db, data):
    sync_business_nodes(db)
    filters = {
        'status': _filter(data, 'status', ('all',) + STATUSES, 'all'),
        'category': _filter(data, 'category', CATEGORIES, 'all'),
        'lens': _filter(data, 'lens', ('all',) + LENSES, 'all'),
        'direction': _filter(data, 'direction', DIRECTIONS, 'both'),
    }
    catalog_total = db.execute('SELECT COUNT(*) FROM graph_nodes').fetchone()[0]
    catalog = rows(db, '''SELECT * FROM graph_nodes ORDER BY
        CASE kind WHEN 'organisation' THEN 0 WHEN 'product' THEN 1 ELSE 2 END,name,id LIMIT ?''', (CATALOG_LIMIT,))
    if data.get('center_id') not in (None, ''):
        center = _node(db, data['center_id'])
    elif data.get('entity_id') not in (None, ''):
        entity_id = _identifier(data['entity_id'], 'entity ID')
        wrapper = db.execute('SELECT * FROM graph_nodes WHERE entity_id=?', (entity_id,)).fetchone()
        if wrapper is None:
            raise ValueError('Business graph subject not found; assets are not operating businesses')
        center = dict(wrapper)
    else:
        center = catalog[0] if catalog else None
    base = {'center_id': center['id'] if center else None, 'catalog': catalog,
            'nodes': [], 'edges': [], 'history': [], 'filters': filters,
            'limits': {'max_nodes': MAX_NODES, 'max_edges': MAX_EDGES, 'catalog_limit': CATALOG_LIMIT,
                       'history_limit': HISTORY_LIMIT, 'catalog_total': catalog_total,
                       'catalog_truncated': catalog_total > CATALOG_LIMIT,
                       'nodes_total': 0, 'edges_total': 0, 'history_total': 0,
                       'nodes_truncated': False, 'edges_truncated': False, 'history_truncated': False}}
    if center is None:
        return base
    where = {'both': '(g.source_id=? OR g.target_id=?)', 'incoming': 'g.target_id=?', 'outgoing': 'g.source_id=?'}[filters['direction']]
    parameters = (center['id'],) * (2 if filters['direction'] == 'both' else 1)
    stored = rows(db, f'''SELECT g.*,a.name AS source_name,b.name AS target_name,
        a.kind AS source_kind,b.kind AS target_kind,a.entity_id AS source_entity_id,b.entity_id AS target_entity_id,
        e.title AS evidence_title,e.url AS evidence_url,e.original_text,e.interpretation,
        e.verification AS evidence_verification,e.observed_at AS evidence_observed_at
        FROM graph_edges g JOIN graph_nodes a ON a.id=g.source_id JOIN graph_nodes b ON b.id=g.target_id
        LEFT JOIN evidence e ON e.id=g.evidence_id WHERE {where} ORDER BY g.id DESC''', parameters)
    visible = [edge for edge in stored if edge['active'] and _matches(edge, filters)]
    visible.extend(edge for edge in _legacy_edges(db, center, filters['direction']) if _matches(edge, filters))
    visible.sort(key=lambda edge: edge['created_at'], reverse=True)
    history = [edge for edge in stored if not edge['active'] and _matches(edge, filters)]
    all_node_ids = {center['id']}
    for edge in visible:
        all_node_ids.update((edge['source_id'], edge['target_id']))
    selected_ids = {center['id']}
    selected = []
    for edge in visible:
        prospective = selected_ids | {edge['source_id'], edge['target_id']}
        if len(selected) >= MAX_EDGES or len(prospective) > MAX_NODES:
            continue
        selected.append(edge)
        selected_ids = prospective
    decorated = _decorate_edges(db, [edge for edge in selected if not edge.get('readonly')])
    by_id = {edge['id']: edge for edge in decorated}
    selected = [edge if edge.get('readonly') else by_id[edge['id']] for edge in selected]
    placeholders = ','.join('?' for _ in selected_ids)
    nodes = rows(db, f'SELECT * FROM graph_nodes WHERE id IN ({placeholders}) ORDER BY id', sorted(selected_ids))
    base.update(nodes=nodes, edges=selected, history=_decorate_edges(db, history[:HISTORY_LIMIT]))
    base['limits'].update(nodes_total=len(all_node_ids), edges_total=len(visible), history_total=len(history),
                          nodes_truncated=len(all_node_ids) > len(nodes), edges_truncated=len(visible) > len(selected),
                          history_truncated=len(history) > HISTORY_LIMIT)
    return base


def dispatch_anatomy(db, action, data):
    operations = {'anatomy': anatomy, 'save_graph_node': save_graph_node,
                  'save_graph_edge': save_graph_edge, 'retract_graph_edge': retract_graph_edge}
    try:
        return operations[action](db, data)
    except sqlite3.IntegrityError as exc:
        raise ValueError(f'Graph record violates a database constraint: {exc}') from exc
