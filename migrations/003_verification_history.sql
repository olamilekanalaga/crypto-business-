ALTER TABLE entity_links ADD COLUMN observed_at TEXT;
ALTER TABLE identities ADD COLUMN last_enrichment_attempt_at TEXT;
ALTER TABLE identities ADD COLUMN enrichment_error TEXT;
CREATE TABLE identity_reviews (
 id INTEGER PRIMARY KEY,
 asset_id INTEGER NOT NULL REFERENCES assets(id),
 identity_id TEXT REFERENCES identities(id),
 evidence_id INTEGER REFERENCES evidence(id),
 action TEXT NOT NULL CHECK(action IN ('verified','returned_to_unresolved')),
 reviewed_at TEXT NOT NULL
);
CREATE TABLE contract_verifications (
 id INTEGER PRIMARY KEY,
 identity_id TEXT NOT NULL REFERENCES identities(id),
 network TEXT NOT NULL,
 address TEXT NOT NULL,
 evidence_id INTEGER NOT NULL REFERENCES evidence(id),
 observed_at TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX contract_identity ON contract_verifications(identity_id);
