-- Graph nodes describe research subjects. A wrapper never verifies a business.
CREATE TABLE graph_nodes (
 id INTEGER PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN ('organisation','product','need','capability','actor','resource')),
 entity_id INTEGER UNIQUE REFERENCES entities(id),
 name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL,
 CHECK((entity_id IS NOT NULL AND kind IN ('organisation','product')) OR
       (entity_id IS NULL AND kind IN ('need','capability','actor','resource')))
);
CREATE TRIGGER graph_node_entity_kind_insert BEFORE INSERT ON graph_nodes
 WHEN NEW.entity_id IS NOT NULL
 BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.entity_id AND kind=NEW.kind)
   THEN RAISE(ABORT,'Graph business node must reference an organisation or product of the same kind') END;
 END;
CREATE TRIGGER graph_node_entity_kind_update BEFORE UPDATE OF entity_id,kind ON graph_nodes
 WHEN NEW.entity_id IS NOT NULL
 BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM entities WHERE id=NEW.entity_id AND kind=NEW.kind)
   THEN RAISE(ABORT,'Graph business node must reference an organisation or product of the same kind') END;
 END;
CREATE TABLE graph_edges (
 id INTEGER PRIMARY KEY,
 source_id INTEGER NOT NULL REFERENCES graph_nodes(id),
 target_id INTEGER NOT NULL REFERENCES graph_nodes(id),
 relation TEXT NOT NULL CHECK(relation IN ('needs_to_operate','needs_to_grow','pays_for','provides_to','partners_with','could_benefit_from','competes_with')),
 essentiality TEXT NOT NULL CHECK(essentiality IN ('essential','optional','unknown')),
 actuality TEXT NOT NULL CHECK(actuality IN ('existing','potential')),
 lens TEXT NOT NULL CHECK(lens IN ('oxygen','blood','brain','legs','food','other')),
 status TEXT NOT NULL CHECK(status IN ('confirmed','inference','hypothesis','unknown')),
 explanation TEXT NOT NULL,
 source_value TEXT NOT NULL,
 target_value TEXT NOT NULL,
 money TEXT NOT NULL CHECK(money IN ('yes','no','unknown')),
 evidence_id INTEGER REFERENCES evidence(id),
 observed_at TEXT NOT NULL,
 evidence_gaps TEXT NOT NULL DEFAULT '',
 provenance TEXT NOT NULL DEFAULT 'manual' CHECK(provenance='manual'),
 supersedes_id INTEGER UNIQUE REFERENCES graph_edges(id),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL,
 CHECK(source_id != target_id),
 CHECK(actuality != 'potential' OR status != 'confirmed'),
 CHECK(relation != 'could_benefit_from' OR actuality='potential'),
 CHECK(relation != 'needs_to_operate' OR essentiality='essential'),
 CHECK(relation != 'needs_to_grow' OR essentiality='optional'),
 CHECK(status != 'confirmed' OR evidence_id IS NOT NULL),
 CHECK(money='unknown' OR evidence_id IS NOT NULL),
 CHECK((actuality='existing' AND status='confirmed') OR length(trim(evidence_gaps))>0)
);
CREATE TABLE graph_edge_events (
 id INTEGER PRIMARY KEY,
 edge_id INTEGER NOT NULL REFERENCES graph_edges(id),
 action TEXT NOT NULL CHECK(action IN ('created','retracted','superseded')),
 reason TEXT NOT NULL,
 recorded_at TEXT NOT NULL
);
CREATE INDEX graph_edges_source ON graph_edges(source_id,active);
CREATE INDEX graph_edges_target ON graph_edges(target_id,active);
CREATE INDEX graph_edge_events_edge ON graph_edge_events(edge_id,id);
