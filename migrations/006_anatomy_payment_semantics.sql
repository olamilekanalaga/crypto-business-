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
