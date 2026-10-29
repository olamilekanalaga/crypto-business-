"""Optional intelligence boundary. Disabled by default, with no provider SDK or API calls.

Adapters may return structured proposals using supplied local evidence. Suggestions
live in a separate queue until explicit human review. Acceptance means a hypothesis
worth investigating; it can never verify an economic relationship.
"""
import json
import math
from dataclasses import dataclass, replace
from typing import Any, Mapping, Protocol, Sequence, TypedDict
from .db import now, rows

KINDS = ('connection', 'finding', 'research_question')


class Proposal(TypedDict):
    kind: str
    confidence: float
    explanation: str
    evidence_gaps: str
    source_ids: list[int]
    payload: dict[str, Any]


@dataclass(frozen=True)
class IntelligenceRequest:
    entity_id: int
    source_ids: tuple[int, ...]
    questions: tuple[str, ...] = ()
    source_evidence: tuple[Mapping[str, Any], ...] = ()


class IntelligenceProvider(Protocol):
    """A future adapter contract; adapters receive evidence selected by the caller.

    Network access, credentials and provider billing belong to a separately
    configured implementation. This package supplies no such implementation.
    """
    name: str
    model: str
    def extract(self, request: IntelligenceRequest) -> Sequence[Proposal]: ...
    def reason(self, request: IntelligenceRequest) -> Sequence[Proposal]: ...


class IntelligenceDisabled(RuntimeError):
    pass


class DisabledProvider:
    name = 'disabled'
    model = 'none'

    def extract(self, request: IntelligenceRequest) -> Sequence[Proposal]:
        raise IntelligenceDisabled('Intelligence provider is disabled; manual research and structured proposal review remain available')

    def reason(self, request: IntelligenceRequest) -> Sequence[Proposal]:
        return self.extract(request)


def intelligence_status(db=None, data=None):
    return {'enabled': False, 'provider': 'disabled', 'external_calls': False,
            'manual_proposal_import': True, 'human_review_required': True,
            'automatic_verification': False,
            'schema': 'docs/intelligence-proposal.schema.json',
            'meaning': 'Provider/model labels and confidence are declared metadata, not proof of origin or accuracy. Accepted proposals become research hypotheses only.'}


def _text(value, label, maximum=20000):
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise ValueError(f'{label} is required (maximum {maximum} characters)')
    return value.strip()


def _sources(db, value, *, required):
    from .anatomy import _identifier
    if not isinstance(value, list) or len(value) > 100:
        raise ValueError('source_ids must be a list of at most 100 existing evidence IDs')
    identifiers = sorted({_identifier(item, 'evidence ID') for item in value})
    if required and not identifiers:
        raise ValueError('Finding and connection proposals require existing source evidence')
    if identifiers:
        marks = ','.join('?' for _ in identifiers)
        existing = {row[0] for row in db.execute(f'SELECT id FROM evidence WHERE id IN ({marks})', identifiers)}
        if existing != set(identifiers):
            raise ValueError('A proposal references evidence that does not exist')
    return identifiers


def _payload(db, kind, value):
    from .anatomy import _node, _identifier, RELATIONS
    from .service import entity, FIELDS
    if not isinstance(value, dict):
        raise ValueError('Proposal payload must be an object')
    if kind == 'connection':
        allowed = {'source_id', 'target_id', 'relation', 'essentiality', 'lens',
                   'source_value', 'target_value', 'source_context', 'target_context'}
        if set(value) - allowed:
            raise ValueError('Connection payload contains unsupported fields; status, payment and verification cannot be supplied by a model')
        source, target = _node(db, value.get('source_id')), _node(db, value.get('target_id'))
        if source['id'] == target['id']:
            raise ValueError('Connection proposal needs two distinct existing nodes')
        relation = value.get('relation')
        if relation not in RELATIONS:
            raise ValueError('Unsupported proposed connection type')
        if relation in ('partners_with', 'competes_with') and (
                source['kind'] not in ('organisation', 'product') or target['kind'] not in ('organisation', 'product')):
            raise ValueError('Proposed partnership or competition requires two business nodes')
        essentiality = value.get('essentiality')
        if essentiality not in ('essential', 'optional', 'unknown'):
            raise ValueError('Proposal essentiality must be essential, optional or unknown')
        if relation == 'needs_to_operate' and essentiality != 'essential':
            raise ValueError('Needs to operate must be essential')
        if relation == 'needs_to_grow' and essentiality != 'optional':
            raise ValueError('Needs to grow must be optional')
        if value.get('lens') not in ('oxygen', 'blood', 'brain', 'legs', 'food', 'other'):
            raise ValueError('Unsupported proposal anatomy lens')
        result = {'source_id': source['id'], 'target_id': target['id'], 'relation': relation,
                  'essentiality': essentiality, 'lens': value['lens'],
                  'source_value': _text(value.get('source_value'), 'Value to source'),
                  'target_value': _text(value.get('target_value'), 'Value to target')}
        for key in ('source_context', 'target_context'):
            text = value.get(key, '')
            if not isinstance(text, str) or len(text) > 20000:
                raise ValueError(f'{key} must be text (maximum 20000 characters)')
            result[key] = text.strip()
        return result
    allowed = {'entity_id', 'field', 'statement'} if kind == 'finding' else {'entity_id', 'field', 'question'}
    if set(value) - allowed:
        raise ValueError('Finding/question payload contains unsupported fields')
    subject = entity(db, _identifier(value.get('entity_id'), 'entity ID'))
    if value.get('field') not in FIELDS:
        raise ValueError('Unsupported research finding field')
    key = 'statement' if kind == 'finding' else 'question'
    return {'entity_id': subject['id'], 'field': value['field'], key: _text(value.get(key), key)}


def _validated(db, data):
    if not isinstance(data, dict):
        raise ValueError('A structured proposal object is required')
    allowed = {'provider', 'model', 'kind', 'confidence', 'explanation', 'evidence_gaps', 'source_ids', 'payload'}
    if set(data) - allowed:
        raise ValueError('Unsupported proposal envelope fields')
    kind = data.get('kind')
    if kind not in KINDS:
        raise ValueError('Proposal kind must be connection, finding or research_question')
    confidence = data.get('confidence')
    if isinstance(confidence, bool) or not isinstance(confidence, (int, float)) or not math.isfinite(confidence) or not 0 <= confidence <= 1:
        raise ValueError('Confidence must be a finite number from 0 to 1; it never establishes verification')
    return {'provider': _text(data.get('provider'), 'Declared provider', 120),
            'model': _text(data.get('model'), 'Declared model', 200),
            'kind': kind, 'confidence': float(confidence),
            'explanation': _text(data.get('explanation'), 'Proposed economic explanation'),
            'evidence_gaps': _text(data.get('evidence_gaps'), 'Missing evidence and validation questions'),
            'source_ids': _sources(db, data.get('source_ids'), required=kind != 'research_question'),
            'payload': _payload(db, kind, data.get('payload'))}


def _insert(db, proposal, origin):
    identifier = db.execute('''INSERT INTO intelligence_proposals
      (provider,model,origin,kind,confidence,explanation,evidence_gaps,payload_json,created_at)
      VALUES(?,?,?,?,?,?,?,?,?)''', (proposal['provider'], proposal['model'], origin, proposal['kind'],
      proposal['confidence'], proposal['explanation'], proposal['evidence_gaps'], json.dumps(proposal['payload']), now())).lastrowid
    for source in proposal['source_ids']:
        db.execute('INSERT INTO intelligence_proposal_sources VALUES(?,?)', (identifier, source))
    return identifier


def import_proposal(db, data):
    proposal = _validated(db, data)
    with db:
        identifier = _insert(db, proposal, 'imported')
    return {'id': identifier, 'status': 'proposed'}


def collect_proposals(db, provider: IntelligenceProvider, request: IntelligenceRequest, *, operation='extract'):
    """Explicit server-side orchestration; not exposed as a web action.

    A test/future adapter may suggest findings using only the evidence supplied to
    it. Invalid batches are rejected atomically. No generated result enters claims
    or the graph here, and DisabledProvider raises before producing a proposal.
    """
    from .service import entity
    from .anatomy import _identifier
    if operation not in ('extract', 'reason'):
        raise ValueError('Unsupported intelligence operation')
    entity(db, _identifier(request.entity_id, 'entity ID'))
    sources = _sources(db, list(request.source_ids), required=False)
    if len(request.questions) > 60 or any(not isinstance(question, str) or not question.strip() or len(question) > 2000 for question in request.questions):
        raise ValueError('Research request supports at most 60 nonempty questions')
    marks = ','.join('?' for _ in sources)
    evidence = rows(db, f'SELECT * FROM evidence WHERE id IN ({marks}) ORDER BY id', sources) if sources else []
    supplied_request = replace(request, source_ids=tuple(sources), source_evidence=tuple(evidence))
    generated = getattr(provider, operation)(supplied_request)
    if not isinstance(generated, (list, tuple)) or len(generated) > 100:
        raise ValueError('An intelligence batch must return a list of at most 100 structured proposals')
    validated = []
    for suggestion in generated:
        if not isinstance(suggestion, Mapping):
            raise ValueError('Provider output must contain structured proposal objects')
        if set(suggestion) - {'kind','confidence','explanation','evidence_gaps','source_ids','payload'}:
            raise ValueError('Adapter output cannot override declared adapter metadata or add unsupported fields')
        proposal = _validated(db, {**dict(suggestion), 'provider': provider.name, 'model': provider.model})
        if set(proposal['source_ids']) - set(sources):
            raise ValueError('Provider cited evidence outside the supplied research request')
        validated.append(proposal)
    with db:
        identifiers = [_insert(db, proposal, 'adapter') for proposal in validated]
    return {'proposal_ids': identifiers, 'created_research_records': 0}


def _proposal(db, identifier):
    from .anatomy import _identifier
    identifier = _identifier(identifier, 'proposal ID')
    row = db.execute('SELECT * FROM intelligence_proposals WHERE id=?', (identifier,)).fetchone()
    if row is None:
        raise ValueError('Intelligence proposal not found')
    result = dict(row)
    result['payload'] = json.loads(result.pop('payload_json'))
    reviewed = result.pop('reviewed_payload_json')
    result['reviewed_payload'] = json.loads(reviewed) if reviewed else None
    result['sources'] = rows(db, '''SELECT e.* FROM evidence e JOIN intelligence_proposal_sources ps ON ps.evidence_id=e.id
        WHERE ps.proposal_id=? ORDER BY e.id''', (identifier,))
    result['source_ids'] = [source['id'] for source in result['sources']]
    result['metadata_assurance'] = 'declared_unverified'
    return result


def list_proposals(db, data=None):
    data = data or {}
    status = data.get('status', 'all')
    if status not in ('all', 'proposed', 'accepted', 'rejected'):
        raise ValueError('Invalid proposal status filter')
    where = '' if status == 'all' else ' WHERE status=?'
    params = () if status == 'all' else (status,)
    total = db.execute('SELECT COUNT(*) FROM intelligence_proposals'+where, params).fetchone()[0]
    identifiers = [row[0] for row in db.execute('SELECT id FROM intelligence_proposals'+where+' ORDER BY id DESC LIMIT 200', params)]
    return {'proposals': [_proposal(db, identifier) for identifier in identifiers], 'total': total,
            'limit': 200, 'truncated': total > len(identifiers)}


def review_proposal(db, data):
    from .anatomy import _identifier, save_graph_edge
    identifier = _identifier(data.get('id'), 'proposal ID')
    decision = data.get('decision')
    if decision not in ('accept', 'reject'):
        raise ValueError('Review decision must be accept or reject')
    note = _text(data.get('reviewer_note'), 'Human review note')
    with db:
        db.execute('BEGIN IMMEDIATE')
        proposal = _proposal(db, identifier)
        if proposal['status'] != 'proposed':
            raise ValueError('Only a proposed item can be reviewed; this proposal was already reviewed')
        if decision == 'reject':
            db.execute("UPDATE intelligence_proposals SET status='rejected',reviewer_note=?,reviewed_at=? WHERE id=?", (note, now(), identifier))
            return {'id': identifier, 'status': 'rejected', 'created_record_type': None, 'created_record_id': None}
        payload = _payload(db, proposal['kind'], data.get('payload', proposal['payload']))
        explanation = _text(data.get('explanation', proposal['explanation']), 'Reviewed economic explanation')
        gaps = _text(data.get('evidence_gaps', proposal['evidence_gaps']), 'Remaining evidence gaps')
        # Sources are never supplied by the review body; original references remain
        # attributable, and their existence is rechecked immediately before use.
        sources = _sources(db, proposal['source_ids'], required=proposal['kind'] != 'research_question')
        observed = now()
        if proposal['kind'] == 'connection':
            graph = {**payload, 'explanation': explanation, 'evidence_gaps': gaps,
                     'status': 'hypothesis', 'actuality': 'potential', 'money': 'unknown',
                     'money_direction': 'unknown', 'evidence_checked_at': None,
                     'evidence_id': sources[0] if sources else None, 'observed_at': observed}
            saved = save_graph_edge(db, graph, reviewed_proposal_id=identifier, _review_transaction=True)
            record_type, record_id = 'graph_edge', saved['id']
        else:
            statement = payload['statement'] if proposal['kind'] == 'finding' else 'Research question: '+payload['question']
            record_id = db.execute('''INSERT INTO claims(entity_id,field,statement,status,evidence_id,observed_at,created_at)
                VALUES(?,?,?,'hypothesis',?,?,?)''', (payload['entity_id'], payload['field'], statement,
                sources[0] if sources else None, observed, observed)).lastrowid
            record_type = 'claim'
        db.execute('''UPDATE intelligence_proposals SET status='accepted',reviewer_note=?,reviewed_at=?,
            reviewed_payload_json=?,reviewed_explanation=?,reviewed_evidence_gaps=?,created_record_type=?,created_record_id=? WHERE id=?''',
            (note, observed, json.dumps(payload), explanation, gaps, record_type, record_id, identifier))
    return {'id': identifier, 'status': 'accepted', 'created_record_type': record_type,
            'created_record_id': record_id, 'meaning': 'Accepted for investigation as a hypothesis, not verified'}


def annotate_proposals(db, records, record_type='graph_edge'):
    """Attach suggestion provenance without changing any record's certainty."""
    if not records:
        return records
    identifiers = [record['id'] for record in records if isinstance(record.get('id'), int)]
    if not identifiers:
        return records
    marks = ','.join('?' for _ in identifiers)
    proposals = rows(db, f'''SELECT id,created_record_id FROM intelligence_proposals
      WHERE status='accepted' AND created_record_type=? AND created_record_id IN ({marks})''', [record_type, *identifiers])
    by_record = {proposal['created_record_id']: _proposal(db, proposal['id']) for proposal in proposals}
    for record in records:
        if record['id'] in by_record:
            proposal = by_record[record['id']]
            record['proposal_origin'] = {'id': proposal['id'], 'provider': proposal['provider'], 'model': proposal['model'],
                'origin': proposal['origin'], 'confidence': proposal['confidence'], 'source_ids': proposal['source_ids'],
                'metadata_assurance': 'declared_unverified', 'original_payload': proposal['payload'],
                'reviewed_payload': proposal['reviewed_payload'], 'reviewer_note': proposal['reviewer_note'],
                'reviewed_at': proposal['reviewed_at'], 'meaning': 'Human-reviewed imported/provider proposal; hypothesis only'}
            record['proposal_sources'] = proposal['sources']
    return records


def dispatch_intelligence(db, action, data):
    operations = {'intelligence_status': intelligence_status, 'import_proposal': import_proposal,
                  'list_proposals': list_proposals, 'review_proposal': review_proposal}
    try:
        return operations[action](db, data)
    except KeyError as exc:
        raise ValueError('Unknown intelligence action') from exc
