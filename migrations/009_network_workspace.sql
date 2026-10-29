-- Additive network application workspace. Existing entities, evidence and graphs remain intact.
-- Revision checks prevent silently replacing research saved by another tab/device.
CREATE TABLE network_workspace (
 id INTEGER PRIMARY KEY CHECK(id=1),
 revision INTEGER NOT NULL DEFAULT 0,
 document TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE network_ai_usage (
 day TEXT PRIMARY KEY,
 attempts INTEGER NOT NULL DEFAULT 0
);
