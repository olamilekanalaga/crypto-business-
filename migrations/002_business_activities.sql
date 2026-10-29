-- A product can enable multiple activities; an activity is not a token or organisation.
CREATE TABLE business_activities (
 id INTEGER PRIMARY KEY,
 product_id INTEGER NOT NULL REFERENCES entities(id),
 name TEXT NOT NULL,
 enables TEXT NOT NULL,
 actor TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('confirmed','inference','hypothesis','unknown')),
 evidence_id INTEGER REFERENCES evidence(id),
 observed_at TEXT NOT NULL,
 created_at TEXT NOT NULL,
 CHECK(status != 'confirmed' OR evidence_id IS NOT NULL)
);
CREATE INDEX activities_product ON business_activities(product_id);
