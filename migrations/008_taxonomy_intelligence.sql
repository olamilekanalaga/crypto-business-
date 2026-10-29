-- Research frameworks contain questions, never claims that a particular business has a need.
CREATE TABLE research_frameworks (
 id INTEGER PRIMARY KEY,
 name TEXT NOT NULL,
 description TEXT NOT NULL,
 questions_json TEXT NOT NULL,
 origin TEXT NOT NULL CHECK(origin IN ('starter','manual')),
 revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
INSERT INTO research_frameworks(name,description,questions_json,origin,created_at,updated_at) VALUES
 ('Lending protocol','Starting questions to refine through research. These are not assumptions about a particular lending business.',
 '[{"topic":"Liquidity","prompt":"Where does lendable liquidity come from, and what motivates suppliers?","optional":true},{"topic":"Collateral","prompt":"What collateral is accepted, and which actors depend on its valuation?","optional":true},{"topic":"Risk management","prompt":"Who evaluates risk and handles liquidations or defaults?","optional":true},{"topic":"Oracles","prompt":"Which external data inputs are actually required, and what evidence establishes the dependency?","optional":true},{"topic":"Borrowers","prompt":"Who borrows, what do they want, and who pays which fees?","optional":true}]',
 'starter',strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('Blockchain game','A reusable investigation framework. A game may have different needs or none of these dependencies.',
 '[{"topic":"Developers","prompt":"Who builds and maintains the game, and what do they repeatedly consume?","optional":true},{"topic":"Players","prompt":"What do players want, and which behaviours create demand?","optional":true},{"topic":"Distribution","prompt":"How do players discover and access the game?","optional":true},{"topic":"Infrastructure","prompt":"Which execution, hosting or asset services are essential rather than optional?","optional":true},{"topic":"Digital asset markets","prompt":"Do asset markets matter to this game, and who receives value from them?","optional":true}]',
 'starter',strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('Wallet provider','Questions for investigating wallet businesses; not a universal dependency model.',
 '[{"topic":"Users","prompt":"Who uses this wallet, and what problems are they trying to solve?","optional":true},{"topic":"Blockchain connectivity","prompt":"Which chain connections are supported and actually needed?","optional":true},{"topic":"Transaction infrastructure","prompt":"Which providers enable transactions, and is payment or integration documented?","optional":true},{"topic":"Security","prompt":"Who supplies security capabilities, and what remains unverified?","optional":true},{"topic":"Distribution","prompt":"Which channels bring users, and what optional capabilities might help growth?","optional":true}]',
 'starter',strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('Data provider','A starting framework for researched data businesses. Refine or replace every question as evidence warrants.',
 '[{"topic":"Data sources","prompt":"Where does the data come from, and under what terms?","optional":true},{"topic":"Computing resources","prompt":"What compute, storage or hosting is repeatedly consumed?","optional":true},{"topic":"Customers","prompt":"Who needs the data, who pays, and why?","optional":true},{"topic":"Distribution","prompt":"Which APIs, marketplaces or partners distribute the product?","optional":true},{"topic":"Second-order activity","prompt":"What new activity does access to this data enable, and which new problems emerge?","optional":true}]',
 'starter',strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'));

-- Imported/provider-produced suggestions are isolated from accepted research records.
CREATE TABLE intelligence_proposals (
 id INTEGER PRIMARY KEY,
 provider TEXT NOT NULL,
 model TEXT NOT NULL,
 origin TEXT NOT NULL CHECK(origin IN ('imported','adapter')),
 kind TEXT NOT NULL CHECK(kind IN ('connection','finding','research_question')),
 confidence REAL NOT NULL CHECK(confidence>=0 AND confidence<=1),
 explanation TEXT NOT NULL,
 evidence_gaps TEXT NOT NULL,
 payload_json TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','accepted','rejected')),
 reviewer_note TEXT,
 reviewed_payload_json TEXT,
 reviewed_explanation TEXT,
 reviewed_evidence_gaps TEXT,
 created_record_type TEXT CHECK(created_record_type IN ('graph_edge','claim')),
 created_record_id INTEGER,
 created_at TEXT NOT NULL,
 reviewed_at TEXT,
 CHECK((status='accepted' AND created_record_type IS NOT NULL AND created_record_id IS NOT NULL AND reviewed_at IS NOT NULL)
    OR (status IN ('proposed','rejected') AND created_record_type IS NULL AND created_record_id IS NULL))
);
CREATE TABLE intelligence_proposal_sources (
 proposal_id INTEGER NOT NULL REFERENCES intelligence_proposals(id),
 evidence_id INTEGER NOT NULL REFERENCES evidence(id),
 PRIMARY KEY(proposal_id,evidence_id)
);
CREATE INDEX intelligence_proposal_status ON intelligence_proposals(status,id);
CREATE UNIQUE INDEX intelligence_record ON intelligence_proposals(created_record_type,created_record_id)
 WHERE created_record_id IS NOT NULL;
