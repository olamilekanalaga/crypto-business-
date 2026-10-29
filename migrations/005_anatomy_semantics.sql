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
