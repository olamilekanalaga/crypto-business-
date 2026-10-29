-- Extend the graph in one transaction without rewriting earlier applied migrations.
-- Deferred checks allow the populated self-reference/event history to be rebuilt.
-- Existing observation dates are NOT verification dates; old review dates stay NULL.
PRAGMA defer_foreign_keys=ON;
CREATE TABLE graph_edge_events_backup AS SELECT * FROM graph_edge_events;
DROP TABLE graph_edge_events;
CREATE TABLE graph_edges_expanded (
 id INTEGER PRIMARY KEY,
 source_id INTEGER NOT NULL REFERENCES graph_nodes(id),
 target_id INTEGER NOT NULL REFERENCES graph_nodes(id),
 relation TEXT NOT NULL CHECK(relation IN ('needs_to_operate','needs_to_grow','pays_for','provides_to','partners_with','could_benefit_from','competes_with','earns_from','integrates_with','depends_on')),
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
 provenance TEXT NOT NULL DEFAULT 'manual' CHECK(provenance IN ('manual','ai_reviewed')),
 supersedes_id INTEGER UNIQUE REFERENCES graph_edges_expanded(id),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 source_context TEXT NOT NULL DEFAULT '',
 target_context TEXT NOT NULL DEFAULT '',
 money_direction TEXT NOT NULL DEFAULT 'unknown' CHECK(money_direction IN ('source_to_target','target_to_source','none','unknown')),
 evidence_checked_at TEXT,
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

INSERT INTO graph_edges_expanded (id,source_id,target_id,relation,essentiality,actuality,lens,status,explanation,source_value,target_value,money,evidence_id,observed_at,evidence_gaps,provenance,supersedes_id,active,created_at,source_context,target_context,money_direction,evidence_checked_at)
 SELECT id,source_id,target_id,relation,essentiality,actuality,lens,status,explanation,source_value,target_value,money,evidence_id,observed_at,evidence_gaps,provenance,supersedes_id,active,created_at,'','',CASE WHEN money='no' THEN 'none' WHEN money='yes' AND relation='pays_for' THEN 'source_to_target' ELSE 'unknown' END,NULL FROM graph_edges;
DROP TABLE graph_edges;
ALTER TABLE graph_edges_expanded RENAME TO graph_edges;
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

INSERT INTO graph_edge_events SELECT * FROM graph_edge_events_backup;
DROP TABLE graph_edge_events_backup;
-- Apply new invariants to future inserts/revisions without rewriting recorded research.
CREATE TRIGGER graph_edge_semantics_insert BEFORE INSERT ON graph_edges
 BEGIN
  SELECT CASE WHEN NEW.actuality='potential' AND NEW.money!='unknown'
   THEN RAISE(ABORT,'Potential connection payment must remain unknown') END;
  SELECT CASE WHEN NEW.relation IN ('partners_with','competes_with') AND
   (NOT EXISTS(SELECT 1 FROM graph_nodes WHERE id=NEW.source_id AND kind IN ('organisation','product')) OR
    NOT EXISTS(SELECT 1 FROM graph_nodes WHERE id=NEW.target_id AND kind IN ('organisation','product')))
   THEN RAISE(ABORT,'Partnership and competition require organisation or product nodes') END;
 END;
CREATE TRIGGER graph_edge_semantics_update BEFORE UPDATE OF source_id,target_id,relation,actuality,money ON graph_edges
 BEGIN
  SELECT CASE WHEN NEW.actuality='potential' AND NEW.money!='unknown'
   THEN RAISE(ABORT,'Potential connection payment must remain unknown') END;
  SELECT CASE WHEN NEW.relation IN ('partners_with','competes_with') AND
   (NOT EXISTS(SELECT 1 FROM graph_nodes WHERE id=NEW.source_id AND kind IN ('organisation','product')) OR
    NOT EXISTS(SELECT 1 FROM graph_nodes WHERE id=NEW.target_id AND kind IN ('organisation','product')))
   THEN RAISE(ABORT,'Partnership and competition require organisation or product nodes') END;
 END;

-- A confirmed pays-for claim is an evidenced payment assertion, not just compatibility.
CREATE TRIGGER graph_edge_payment_semantics_insert BEFORE INSERT ON graph_edges
 BEGIN
  SELECT CASE WHEN NEW.relation='pays_for' AND
   (NEW.money='no' OR (NEW.status='confirmed' AND NEW.money!='yes'))
   THEN RAISE(ABORT,'Pays for cannot deny payment; confirmed pays for requires payment=yes') END;
 END;
CREATE TRIGGER graph_edge_payment_semantics_update BEFORE UPDATE OF relation,status,money ON graph_edges
 BEGIN
  SELECT CASE WHEN NEW.relation='pays_for' AND
   (NEW.money='no' OR (NEW.status='confirmed' AND NEW.money!='yes'))
   THEN RAISE(ABORT,'Pays for cannot deny payment; confirmed pays for requires payment=yes') END;
 END;

-- New explicit direction and review fields constrain future assertions. Prior records remain intact.
CREATE TRIGGER graph_edge_extended_semantics_insert BEFORE INSERT ON graph_edges
 BEGIN
  SELECT CASE WHEN NEW.money='unknown' AND NEW.money_direction!='unknown'
   THEN RAISE(ABORT,'Unknown payment must leave its direction unknown') END;
  SELECT CASE WHEN NEW.money='no' AND NEW.money_direction!='none'
   THEN RAISE(ABORT,'No payment must have direction none') END;
  SELECT CASE WHEN NEW.money='yes' AND NEW.money_direction='none'
   THEN RAISE(ABORT,'Known payment cannot have direction none') END;
  SELECT CASE WHEN NEW.relation='pays_for' AND NEW.money='yes' AND NEW.money_direction!='source_to_target'
   THEN RAISE(ABORT,'Pays for payment direction must be source to target') END;
  SELECT CASE WHEN NEW.relation='earns_from' AND (NEW.money='no' OR (NEW.status='confirmed' AND NEW.money!='yes') OR (NEW.money='yes' AND NEW.money_direction!='target_to_source'))
   THEN RAISE(ABORT,'Earns from requires compatible payment and target to source direction') END;
  SELECT CASE WHEN NEW.evidence_checked_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM evidence WHERE id=NEW.evidence_id AND verification='confirmed')
   THEN RAISE(ABORT,'A verification date requires confirmed supporting evidence') END;
 END;
CREATE TRIGGER graph_edge_extended_semantics_update BEFORE UPDATE OF relation,status,money,money_direction,evidence_checked_at,evidence_id ON graph_edges
 BEGIN
  SELECT CASE WHEN NEW.money='unknown' AND NEW.money_direction!='unknown'
   THEN RAISE(ABORT,'Unknown payment must leave its direction unknown') END;
  SELECT CASE WHEN NEW.money='no' AND NEW.money_direction!='none'
   THEN RAISE(ABORT,'No payment must have direction none') END;
  SELECT CASE WHEN NEW.money='yes' AND NEW.money_direction='none'
   THEN RAISE(ABORT,'Known payment cannot have direction none') END;
  SELECT CASE WHEN NEW.relation='pays_for' AND NEW.money='yes' AND NEW.money_direction!='source_to_target'
   THEN RAISE(ABORT,'Pays for payment direction must be source to target') END;
  SELECT CASE WHEN NEW.relation='earns_from' AND (NEW.money='no' OR (NEW.status='confirmed' AND NEW.money!='yes') OR (NEW.money='yes' AND NEW.money_direction!='target_to_source'))
   THEN RAISE(ABORT,'Earns from requires compatible payment and target to source direction') END;
  SELECT CASE WHEN NEW.evidence_checked_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM evidence WHERE id=NEW.evidence_id AND verification='confirmed')
   THEN RAISE(ABORT,'A verification date requires confirmed supporting evidence') END;
 END;
