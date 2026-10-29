CREATE TABLE IF NOT EXISTS bd_usdc_registry (
 id integer PRIMARY KEY CHECK(id=1), revision integer NOT NULL,
 document jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE bd_usdc_registry ENABLE ROW LEVEL SECURITY;
