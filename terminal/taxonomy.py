"""Editable dependency-research frameworks. Questions never instantiate graph facts."""
import json
from .db import now, rows


def _text(value, label, maximum):
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise ValueError(f'{label} is required (maximum {maximum} characters)')
    return value.strip()


def _questions(value):
    if not isinstance(value, list) or not 1 <= len(value) <= 60:
        raise ValueError('A framework needs 1 to 60 research questions')
    result = []
    for question in value:
        if not isinstance(question, dict) or set(question) - {'topic', 'prompt', 'optional'}:
            raise ValueError('Questions use topic, prompt and optional fields only')
        optional = question.get('optional', True)
        if not isinstance(optional, bool):
            raise ValueError('Question optional must be true or false; it does not assert an actual dependency')
        result.append({'topic': _text(question.get('topic'), 'Question topic', 120),
                       'prompt': _text(question.get('prompt'), 'Research prompt', 2000),
                       'optional': optional})
    return result


def taxonomy(db, data=None):
    result = rows(db, 'SELECT * FROM research_frameworks ORDER BY name,id')
    for framework in result:
        framework['questions'] = json.loads(framework.pop('questions_json'))
    return {'frameworks': result,
            'meaning': 'Generic research questions, not claims about any business. Applying a framework never creates a graph connection.'}


def save_framework(db, data):
    from .anatomy import _identifier
    name = _text(data.get('name'), 'Framework name', 200)
    description = _text(data.get('description'), 'Framework description', 10000)
    questions = _questions(data.get('questions'))
    identifier = data.get('id')
    with db:
        db.execute('BEGIN IMMEDIATE')
        if identifier not in (None, ''):
            identifier = _identifier(identifier, 'framework ID')
            old = db.execute('SELECT * FROM research_frameworks WHERE id=?', (identifier,)).fetchone()
            if not old:
                raise ValueError('Research framework not found')
            expected = data.get('expected_revision')
            if expected is not None and expected != old['revision']:
                raise ValueError('Framework changed since you opened it; reload before saving')
            revision = old['revision'] + 1
            db.execute('UPDATE research_frameworks SET name=?,description=?,questions_json=?,revision=?,updated_at=? WHERE id=?',
                       (name, description, json.dumps(questions), revision, now(), identifier))
        else:
            revision = 1
            identifier = db.execute('''INSERT INTO research_frameworks
                (name,description,questions_json,origin,created_at,updated_at) VALUES(?,?,?,'manual',?,?)''',
                (name, description, json.dumps(questions), now(), now())).lastrowid
    return {'id': identifier, 'revision': revision}


def dispatch_taxonomy(db, action, data):
    if action == 'taxonomy':
        return taxonomy(db, data)
    if action == 'save_framework':
        return save_framework(db, data)
    raise ValueError('Unknown taxonomy action')
