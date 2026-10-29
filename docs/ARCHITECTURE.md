# Architecture

## Boundary and runtime

BD Oracle, within Cřyptô Business, uses Next.js 16, React, TypeScript, Tailwind CSS, React Flow and local Python processes. SQLite stores the graph alongside the existing research records; no separate graph database or model API is required. The browser posts JSON to explicit `/api/<action>` handlers. The server invokes `python3 -m terminal rpc` (or `PYTHON_BIN`) with JSON on stdin. Python validates the operation and uses parameterized SQLite statements. No arbitrary SQL, executable paths, or source fetch URLs are accepted from the browser. There is no separate Python HTTP listener.

The supplied dev and start scripts bind to `127.0.0.1`. API requests require a local Host header and, when supplied, matching Origin; cross-site browser requests are rejected. This is a **local access boundary, not account authentication**. Do not place this service on a public interface or behind a public proxy. Remote access, account sessions, and multi-user permissions are outside Phase 1.

API calls do not run external data ingestion. The interface's Data refresh panel explains the CLI commands and can reload local records after they run. This keeps rate limits and long network work out of research form submissions.

## Data model

| Record | Meaning and relationship |
| --- | --- |
| `entities` | Shared record identity for asset, organisation, or product |
| `assets` | An exchange-scoped base asset, unique by `(exchange, code)`; not automatically a unique global project |
| `identities` | CoinGecko canonical ID, source metadata, enrichment/attempt timestamps and latest enrichment error |
| `listings` | Latest known state of `(exchange, symbol)`, linked to its base asset |
| `listing_observations` | Per-successful-run snapshot of each pair, status, and Spot permission |
| `runs` | Connector execution, extraction counts, error, timestamp and raw-response hash/path |
| `requests` | Every external request/cache observation, response status/error, hash/path |
| `cache` | Expiring transport response cache |
| `evidence` | Original source excerpt, URL, source type, observation/publication dates, researcher's interpretation and verification status |
| `claims` | A finding about an entity, research question/flow field, certainty, observation date and optional evidence |
| `business_activities` | Distinct product-enabled activity, actor, explanation, certainty, evidence and observation date |
| `entity_links` | Organisation → product (`operates`) and product → asset (`associated_asset`), each with certainty, evidence and observation date |
| `identity_reviews` | Append-only asset identity approvals and returns to unresolved, with identity, evidence and review timestamp |
| `contract_verifications` | Researcher-verified network/address for a CoinGecko identity, confirmed evidence and observation date |
| `relationships` | Two organisations/products, relationship type, reciprocal provisions/value, reason, payment certainty and dates |
| `relationship_evidence` | Many-to-many evidence association for a business relationship |
| `opportunities` | Personal opportunity notes: friction, possible solution, buyer, next research step and research stage |
| `graph_nodes` | Organisation/product wrappers linked to existing entities, or manually defined need/capability/actor/resource concepts |
| `graph_edges` | Directed, typed research connection with essentiality, existing/potential state, certainty, economic explanation, reciprocal value, payment, evidence and gaps |
| `graph_edge_events` | Append-only creation, retraction and supersession audit events |
| `research_frameworks` | Editable, revision-checked questions for business categories; never automatic graph facts |
| `intelligence_proposals` | Separate structured suggestions, declared provider/model/confidence, original and reviewed payloads, human decision and accepted-record mapping |
| `intelligence_proposal_sources` | Original evidence references retained for every structured proposal |

Organisation and product extensions do not need separate tables in this phase: they are distinct `entities.kind` records with typed connections and attached claims. An organisation may operate many products. A product may have many assets, and an asset may be associated with many products. Entities without asset links are valid.

Assets retain their exchange identity even when linked to the same verified CoinGecko ID. Additional connectors must never merge observations merely because symbols match. Canonical identity approval requires indexed identity plus a confirmed evidence record, and appends an identity review event. Returning an approval to unresolved also appends a review event. Provider metadata and source-reported contracts remain distinct from researcher-verified network/address records and verified economic claims. Contract verification requires an indexed identity, specific network and address, confirmed evidence, and observation date; it is a researcher judgement rather than automated chain verification.

## Ingestion lifecycle

`terminal/connectors/` defines an exchange connector interface (`name`, `url`, `normalize`). Only Binance Spot is implemented.

1. Create a run record before requesting the official endpoint.
2. Preserve the HTTP response bytes in `data/raw/`, with SHA-256 and request timestamps. Transport failures with no upstream body have an empty body hash and a recorded error; they are not valid API snapshots.
3. Validate a non-empty symbols list and required fields; reject duplicate pair symbols before changing listing state.
4. Under an immediate SQLite write transaction, reject an older response if a newer run already succeeded; otherwise upsert exchange-scoped base assets and pair listings, retain first/last observations, append snapshot rows and mark pairs missing from the latest successful response unavailable.
5. Record the successful run counts/hash and export dataset files. A failed API or normalization attempt retains the prior good listing data. A derived export disk error is logged without relabelling the committed snapshot; retry with `python -m terminal export`.

“Active” requires availability in the latest successful snapshot, Binance status `TRADING`, and Spot permission. “Inactive” means observed but not satisfying trading/permission criteria. “Unavailable” means previously observed but absent from a newer successful response. These states are not inferred from failed requests.

Exchange asset codes can be reused or renamed over long periods; Phase 1 does not automatically infer identity continuity across such events. Review official evidence and identity associations when a relisting or migration is suspected.

## CoinGecko lifecycle

`/coins/list?include_platform=true` produces source identities and case-insensitive ticker candidates. A single match is not confidence evidence. Candidate collisions and shared approved identities remain inspectable in the quality report.

`/coins/{id}` is queried only for researcher-approved identities whose detail profile is missing or more than seven days old. The full documented response is stored so currently available categories, links, repositories, description, platform metadata, developer metadata and exchange tickers remain inspectable. The detail endpoint's ticker subset is not an exhaustive exchange universe. No paid-only field is presumed available.

The standard-library transport records requests and response bodies, caches by URL, spaces CoinGecko requests, retries bounded transient failures, and defers a server-requested cooldown longer than a minute. Successful profiles remain stored across later failures. Each detail attempt records its time and any error. Permanent per-ID errors (HTTP 400/404/410) and detail identity mismatches are recorded and skipped so other identities can progress. Quota, authentication, transport and server failures stop the batch. Oldest-attempt ordering prevents repeatedly failing identities from starving unattempted work; subsequent commands resume the backlog.

## Research semantics

The structured business questions are structured claim fields: actual activity, service, customers, actors' wants, demand behaviour, problem solved, exchanged value, payment flows, revenue, suppliers, distribution, recurring consumption, dependencies, dependents, new activity and new problems that the business creates for other actors. Eight additional fields support the economic flow view.

Business activities are separate records under a product, each describing an actor and the concrete action the product enables. Their certainty, source and observation date are independent from the product name or associated token.

Claims are labelled `confirmed`, `inference`, `hypothesis`, or `unknown`. Evidence is captured independently from the interpretation. Confirmed findings need a confirmed evidence record. Supported opportunity notes and verified identity matches also require confirmed evidence. These constraints prevent unsourced confirmation; they do not prove a researcher's interpretation is correct.

Relationships describe both sides explicitly. Payment has three values (`yes`, `no`, `unknown`) and is separate from relationship type. Any explicit `yes` or `no` requires confirmed source evidence regardless of the overall relationship’s certainty; evidence is not required for `unknown` unless the relationship itself is confirmed. A partnership/integration label must be supported by the evidence the researcher selected. The application does not automatically interpret announcements as paying customers or formal partnerships.

Evidence and claims are append-only. A correction is new evidence and a new finding, so original research remains inspectable. Identity approvals/resets append review events and expose approval evidence/history on the identity page. Entity links retain submitted observation dates but may be revised; opportunity notes may be edited. Full revision history for mutable links/opportunities and claim-level supersession/retraction are future additions.

## Business Anatomy and connected exploration

`terminal/anatomy.py` handles `anatomy`, `asset_anatomy`, `unresolved_graph`, `save_graph_node`, `save_graph_edge` and `retract_graph_edge`. Graph reads synchronise one wrapper per existing organisation/product entity. A wrapper does not verify the business or invent a dependency. Assets remain in the discovery/identity layer, while manually defined graph concepts may be needs, capabilities, actors or resources. Customers, suppliers, developers, distribution and infrastructure are economic roles expressed through these records and typed relationships, not inferred from their names.

Dedicated routes `/anatomy`, `/businesses/[id]/anatomy`, `/assets/[id]/anatomy` and `/network` extend the existing application. Asset Anatomy resolves only recorded product → asset and organisation → product → asset association paths. It exposes all paths and their sources; an organisation is confirmed through a path only when every link is confirmed. Alternative unconfirmed associations remain visible as research. CoinGecko identity approval alone never supplies an operating organisation, and a token never becomes a business graph node. An asset with no researched association stays unresolved.

Each directed edge independently records:

- Relationship meaning: `needs_to_operate`, `needs_to_grow`, `pays_for`, `earns_from`, `provides_to`, `integrates_with`, `partners_with`, `depends_on`, `could_benefit_from` or `competes_with`.
- Essentiality (`essential`, `optional`, `unknown`), existing/potential state and certainty (`confirmed`, `inference`, `hypothesis`, `unknown`).
- What each endpoint provides or needs (`source_context`, `target_context`), the economic explanation, and the value each side receives.
- Whether payment is known and its explicit direction: source → target, target → source, none or unknown.
- Source evidence, researcher interpretation, observation date, unresolved gaps and an optional manually entered evidence-check date.

Observation is not verification. `evidence_checked_at` is nullable, requires confirmed supporting evidence when supplied, and is never filled from `observed_at` or a source publication date. Historical records receive no invented verification date. Old graph context text remains blank if it was never recorded. A known pays-for direction can be derived from its literal source → target meaning for backwards-compatible calls; other historical known payments retain unknown direction unless explicitly documented.

The service/schema preserve economic meaning: operating needs are essential, growth needs optional; potential connections cannot be confirmed or assert known payment; `could_benefit_from` stays potential; partnerships/competition require organisation/product endpoints; unconfirmed connections require evidence gaps. Confirmed findings and explicit payment assertions require confirmed source evidence. Confirmed `pays_for` requires payment yes in source → target direction; confirmed `earns_from` requires payment yes in target → source direction. Neither can assert no payment. These checks constrain the record; the researcher still decides whether a source supports its interpretation.

Original `relationships` remain read-only projections with `relation=documented_relationship` and their unchanged `original_type`. An integration stays an integration. It is not upgraded into a partnership, supplier, essential dependency or paying customer. Both documented provisions, reciprocal value and source records remain available. The arrow follows the original A → B ordering and adds no inferred money direction.

Business Anatomy defaults to one-hop exploration. Economic Network uses `scope=network` and a bounded breadth-first traversal of one to three stored hops. Every hop applies certainty/category/lens/direction filters before traversal: a hidden hypothesis cannot be used as an invisible bridge to a confirmed node. Recentring and back navigation explore further without creating new edges. Within each distance, explicit certainty, essentiality and existing state rank before recency. Returned nodes follow distance and retained-edge relevance so the first canvas nodes are useful rather than merely old numeric IDs.

The API returns at most 500 nodes/edges, 5,000 catalogue entries and 100 historical edges, with totals and truncation flags. The canvas shows at most 40 nodes. Bounds do not turn omitted data into absence; select another centre, refine filters or expand the recorded network explicitly. `unresolved_graph` exposes paginated unconfirmed/potential active graph records and unconfirmed original relationships, retaining their sources and declared uncertainty.

React Flow supplies zoom, pan, node selection and connection inspection. The Oxygen/Blood/Brain/Legs/Food lenses organise research questions rather than impose universal dependencies. The four summary cards show recorded inputs, growth needs, confirmed suppliers and possibilities, with unknowns left unknown. The client-only illustration is separate from My research, never enters SQLite and makes no factual claim about Particle Network or another real business.

Retraction retains the original edge, source and reason/timestamp audit events. API supersession atomically retains both versions. A reviewed generated suggestion cannot supersede a verified record or insert a known payment; it enters as a new potential hypothesis. Original relationship projections remain read-only in this graph.

## Reusable dependency frameworks

`terminal/taxonomy.py` serves editable `research_frameworks`. Migration 008 supplies generic starter questions for lending protocols, blockchain games, wallets and data providers. Their descriptions explicitly say that a category does not establish a company's actual needs. Creating, selecting or editing a framework does not instantiate concepts, relationships or business facts. Framework edits use an expected revision to reject stale overwrites. Findings still enter the existing evidence-aware research workspace independently.

## Optional intelligence boundary and human review

`terminal/intelligence.py` defines the `IntelligenceProvider` Protocol, typed requests/proposals and a `DisabledProvider`. A future adapter may implement `extract` and `reason` using caller-selected local evidence. No provider SDK, credentials, paid call, document crawler, automatic matcher or continuous intelligence engine is enabled or included. The status endpoint reports that external intelligence is disabled. The schema handoff is `docs/intelligence-proposal.schema.json`.

Structured imports are validated and stored in a separate proposal queue; import does not create a graph edge or a research claim. Proposals retain original source IDs, payload, explanation, gaps, reported confidence and declared provider/model names. Those names are unverified metadata, and confidence is not a probability of truth. Connection/finding proposals must refer to existing evidence; the server does not accept model-supplied verification status, payment, arbitrary field names or invented endpoint IDs.

An explicit human review can reject a proposal or retain it for investigation. Inline human review permits edited economic context, values, finding/question text, explanation and gaps while preserving originals; the review API validates the edited payload again. Acceptance is one immediate transaction: check the proposed state, validate sources, create the investigation record and set the accepted-record mapping. Retry or concurrent acceptance cannot create duplicate/orphan graph records. Accepted connections are forced to potential/hypothesis/unknown payment with no verification date, and accepted findings/questions remain hypotheses. The trusted graph insertion helper verifies the proposal identity/type/state and rejects attempts to use it outside the review transaction or to supersede existing research.

Accepted graph records carry `ai_reviewed` provenance; accepted graph records and claims expose proposal origin, original/reviewed content, sources, declared model/provider, confidence and human note. The graph's direct JSON writer still rejects provenance spoofing. Researcher acceptance is not factual confirmation. Independent evidence-backed manual research is required before a relationship is presented as verified.

## Migrations and local storage

`terminal/db.py` enables foreign keys, a 30-second SQLite busy timeout and WAL journaling. It creates `schema_migrations` and applies lexically ordered `migrations/*.sql` not already recorded. Each migration uses `BEGIN IMMEDIATE` to serialize its applied-state check and DDL, preventing simultaneous first requests from applying it twice. `001_foundation.sql` establishes the foundation tables, checks and indexes; `002_business_activities.sql` adds separate business activity records; `003_verification_history.sql` adds link observation dates, identity review history, contract verification and enrichment-attempt tracking. `004_business_anatomy.sql` adds graph nodes, directed research edges and audit events; `005_anatomy_semantics.sql` enforces potential-payment and endpoint-kind rules; `006_anatomy_payment_semantics.sql` enforces the meaning of pays-for claims. `007_graph_extensions.sql` rebuilds the graph edge/event tables within the same transaction with deferred foreign-key checks, preserving existing primary keys, source references, self-referencing supersession and audit event IDs while adding meanings/context/payment direction/manual review dates. It does not rebuild assets, listings, collectors or original research. `008_taxonomy_intelligence.sql` adds generic research frameworks and the isolated proposal/source queue.

Add new changes after the latest recorded migration, such as `009_*.sql` and later. Do not edit an already-applied migration as a deployment strategy. Back up first, test on a copied database, and verify `PRAGMA integrity_check` and representative research flows after applying it. There is no automated down-migration command.

Private data and API keys are excluded from Git. Files are protected by the local operating-system account; application-level encryption is not supplied. Use the SQLite backup API rather than copying only the main database file while WAL writes are active. Raw responses must be backed up separately because database records reference them by path.

## Prepared source adapters

Evidence source types accommodate official documentation/websites, product/integration documents, announcements, financial data, DefiLlama, public chain observations, GitHub, official X and other public sources. In Phase 1 these sources enter as manual source records; only Binance and CoinGecko have automated API connectors. An automated future source adapter should retain original evidence, URL, dates, request provenance and interpretation separately, and must not silently promote imported text to verified economic research.

The collector preservation audit is recorded in [VISION_UPDATE_AUDIT.md](VISION_UPDATE_AUDIT.md). The Binance connector, HTTP transport, ingestion, enrichment and quality-report code were fingerprinted before this extension and remain outside the graph/navigation/intelligence changes. Successful live collection is still unavailable: the recorded environment proxy denials are six failed requests, not invented extraction counts.
