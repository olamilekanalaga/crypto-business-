-- Run once against a private Postgres database using its SQL console or psql.
-- The server credentials must not be exposed through NEXT_PUBLIC variables.
CREATE TABLE IF NOT EXISTS bd_network_workspace (
 id integer PRIMARY KEY CHECK (id = 1),
 revision integer NOT NULL DEFAULT 0,
 document jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bd_network_ai_usage (
 day text PRIMARY KEY,
 attempts integer NOT NULL DEFAULT 0
);
-- Deny direct anonymous client access, including Supabase public API access.
ALTER TABLE bd_network_workspace ENABLE ROW LEVEL SECURITY;
ALTER TABLE bd_network_ai_usage ENABLE ROW LEVEL SECURITY;
-- Server connection must be a privileged role; no anonymous policies are created.
