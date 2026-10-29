"""SQLite connection and ordered, transactional migrations. No third-party Python packages."""
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def now():
    return datetime.now(timezone.utc).isoformat()

def data_dir():
    path = Path(os.environ.get('TERMINAL_DATA_DIR', ROOT / 'data')).resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path

def connect():
    db = sqlite3.connect(data_dir() / 'terminal.sqlite3', timeout=30)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)')
    for migration in sorted((ROOT / 'migrations').glob('*.sql')):
        # Serialize the check and DDL so simultaneous first browser requests cannot
        # both attempt the same migration. DDL remains in the same transaction.
        try:
            db.execute('BEGIN IMMEDIATE')
            if not db.execute('SELECT 1 FROM schema_migrations WHERE name=?', (migration.name,)).fetchone():
                statement = ''
                for line in migration.read_text().splitlines(keepends=True):
                    statement += line
                    if sqlite3.complete_statement(statement):
                        db.execute(statement)
                        statement = ''
                if statement.strip():
                    raise ValueError(f'Incomplete migration statement in {migration.name}')
                db.execute('INSERT INTO schema_migrations VALUES (?,?)', (migration.name, now()))
            db.commit()
        except Exception:
            db.rollback()
            db.close()
            raise
    return db

def rows(db, sql, params=()):
    return [dict(r) for r in db.execute(sql, params).fetchall()]
