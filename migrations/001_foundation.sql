CREATE TABLE entities (
 id INTEGER PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('asset','organisation','product')), name TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TABLE identities (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, ticker TEXT NOT NULL, platforms_json TEXT NOT NULL DEFAULT '{}',
 profile_json TEXT, enriched_at TEXT, source_url TEXT
);
CREATE TABLE assets (
 id INTEGER PRIMARY KEY REFERENCES entities(id), exchange TEXT NOT NULL, code TEXT NOT NULL,
 identity_id TEXT REFERENCES identities(id), match_status TEXT NOT NULL DEFAULT 'unresolved' CHECK(match_status IN ('unresolved','verified')),
 match_evidence_id INTEGER REFERENCES evidence(id), candidates_json TEXT NOT NULL DEFAULT '[]', first_seen TEXT NOT NULL, last_seen TEXT NOT NULL,
 UNIQUE(exchange,code), CHECK(match_status != 'verified' OR (identity_id IS NOT NULL AND match_evidence_id IS NOT NULL))
);
CREATE TABLE runs (
 id INTEGER PRIMARY KEY, connector TEXT NOT NULL, started_at TEXT NOT NULL, completed_at TEXT, status TEXT NOT NULL,
 pair_count INTEGER, unique_assets INTEGER, duplicate_symbols INTEGER, raw_path TEXT, sha256 TEXT, error TEXT
);
CREATE TABLE listings (
 exchange TEXT NOT NULL, symbol TEXT NOT NULL, asset_id INTEGER NOT NULL REFERENCES assets(id), base_asset TEXT NOT NULL,
 quote_asset TEXT NOT NULL, status TEXT NOT NULL, spot_allowed INTEGER NOT NULL, available INTEGER NOT NULL DEFAULT 1,
 first_seen TEXT NOT NULL, last_seen TEXT NOT NULL, run_id INTEGER NOT NULL REFERENCES runs(id), PRIMARY KEY(exchange,symbol)
);
CREATE TABLE listing_observations (
 run_id INTEGER NOT NULL REFERENCES runs(id), exchange TEXT NOT NULL, symbol TEXT NOT NULL,
 base_asset TEXT NOT NULL, quote_asset TEXT NOT NULL, status TEXT NOT NULL, spot_allowed INTEGER NOT NULL,
 PRIMARY KEY(run_id,exchange,symbol)
);
CREATE TABLE requests (
 id INTEGER PRIMARY KEY, url TEXT NOT NULL, observed_at TEXT NOT NULL, status INTEGER, error TEXT,
 raw_path TEXT, sha256 TEXT, cache_hit INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE cache (
 url TEXT PRIMARY KEY, body TEXT NOT NULL, expires_at REAL NOT NULL, raw_path TEXT, sha256 TEXT
);
CREATE TABLE evidence (
 id INTEGER PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL, source_type TEXT NOT NULL,
 observed_at TEXT NOT NULL, published_at TEXT, original_text TEXT NOT NULL, interpretation TEXT NOT NULL DEFAULT '',
 verification TEXT NOT NULL CHECK(verification IN ('confirmed','inference','hypothesis','unknown')), created_at TEXT NOT NULL
);
CREATE TABLE claims (
 id INTEGER PRIMARY KEY, entity_id INTEGER NOT NULL REFERENCES entities(id), field TEXT NOT NULL, statement TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('confirmed','inference','hypothesis','unknown')), evidence_id INTEGER REFERENCES evidence(id),
 observed_at TEXT NOT NULL, created_at TEXT NOT NULL,
 CHECK(status != 'confirmed' OR evidence_id IS NOT NULL)
);
CREATE TABLE entity_links (
 id INTEGER PRIMARY KEY, from_id INTEGER NOT NULL REFERENCES entities(id), to_id INTEGER NOT NULL REFERENCES entities(id),
 type TEXT NOT NULL CHECK(type IN ('operates','associated_asset')), evidence_id INTEGER REFERENCES evidence(id),
 status TEXT NOT NULL CHECK(status IN ('confirmed','inference','hypothesis','unknown')),
 CHECK(status != 'confirmed' OR evidence_id IS NOT NULL), UNIQUE(from_id,to_id,type)
);
CREATE TABLE relationships (
 id INTEGER PRIMARY KEY, a_id INTEGER NOT NULL REFERENCES entities(id), b_id INTEGER NOT NULL REFERENCES entities(id),
 type TEXT NOT NULL, a_provides TEXT NOT NULL, b_provides TEXT NOT NULL, reason TEXT NOT NULL,
 a_value TEXT NOT NULL, b_value TEXT NOT NULL, money TEXT NOT NULL CHECK(money IN ('yes','no','unknown')),
 observed_at TEXT NOT NULL, announcement_date TEXT, status TEXT NOT NULL CHECK(status IN ('confirmed','inference','hypothesis','unknown')),
 CHECK(a_id != b_id)
);
CREATE TABLE relationship_evidence (
 relationship_id INTEGER NOT NULL REFERENCES relationships(id), evidence_id INTEGER NOT NULL REFERENCES evidence(id),
 PRIMARY KEY(relationship_id,evidence_id)
);
CREATE TABLE opportunities (
 id INTEGER PRIMARY KEY, entity_id INTEGER REFERENCES entities(id), title TEXT NOT NULL, friction TEXT NOT NULL,
 proposed_solution TEXT NOT NULL, buyer TEXT NOT NULL, next_step TEXT NOT NULL, stage TEXT NOT NULL DEFAULT 'hypothesis'
 CHECK(stage IN ('hypothesis','investigating','supported','dismissed')), evidence_id INTEGER REFERENCES evidence(id),
 created_at TEXT NOT NULL, CHECK(stage != 'supported' OR evidence_id IS NOT NULL)
);
CREATE INDEX claims_entity ON claims(entity_id);
CREATE INDEX listings_asset ON listings(asset_id);
CREATE INDEX asset_identity ON assets(identity_id);
