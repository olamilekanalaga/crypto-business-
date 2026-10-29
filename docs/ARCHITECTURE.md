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

The fifteen business questions are structured claim fields: actual activity, service, customers, actors' wants, demand behaviour, problem solved, exchanged value, payment flows, revenue, suppliers, distribution, recurring consumption, dependencies, dependents, and new activity. Eight additional fields support the economic flow view.

Business activities are separate records under a product, each describing an actor and the concrete action the product enables. Their certainty, source and observation date are independent from the product name or associated token.

Claims are labelled `confirmed`, `inference`, `hypothesis`, or `unknown`. Evidence is captured independently from the interpretation. Confirmed findings need a confirmed evidence record. Supported opportunity notes and verified identity matches also require confirmed evidence. These constraints prevent unsourced confirmation; they do not prove a researcher's interpretation is correct.

Relationships describe both sides explicitly. Payment has three values (`yes`, `no`, `unknown`) and is separate from relationship type. Any explicit `yes` or `no` requires confirmed source evidence regardless of the overall relationship’s certainty; evidence is not required for `unknown` unless the relationship itself is confirmed. A partnership/integration label must be supported by the evidence the researcher selected. The application does not automatically interpret announcements as paying customers or formal partnerships.

Evidence and claims are append-only. A correction is new evidence and a new finding, so original research remains inspectable. Identity approvals/resets append review events and expose approval evidence/history on the identity page. Entity links retain submitted observation dates but may be revised; opportunity notes may be edited. Full revision history for mutable links/opportunities and claim-level supersession/retraction are future additions.

## Business Anatomy graph

`terminal/anatomy.py` handles the `anatomy`, `save_graph_node`, `save_graph_edge` and `retract_graph_edge` RPC operations. Graph reads synchronise one wrapper per existing organisation/product entity. Wrapping a record does not verify that business or infer any connection. Assets stay outside the operating-business graph; their organisation/product associations remain in the original model. Concepts are manually created and may be `need`, `capability`, `actor` or `resource`.

Each stored edge has a directed source and target, one of seven meanings (`needs_to_operate`, `needs_to_grow`, `pays_for`, `provides_to`, `partners_with`, `could_benefit_from`, `competes_with`), and independent fields for importance (`essential`, `optional`, `unknown`), state (`existing`, `potential`) and certainty (`confirmed`, `inference`, `hypothesis`, `unknown`). The explanation, value received by each endpoint, payment status, observation date, evidence reference and evidence gaps preserve the economic meaning beyond a visual line.

The service and schema enforce semantic constraints:

- `needs_to_operate` is essential; `needs_to_grow` is optional.
- `could_benefit_from` remains potential. Potential connections cannot be confirmed or assert known payment.
- Confirmed edges require confirmed evidence. Explicit payment yes/no requires confirmed evidence. `pays_for` cannot deny payment, and a confirmed `pays_for` edge requires payment yes.
- Partnership and competition connect two organisation/product nodes, rather than arbitrary concepts.
- Potential or otherwise unconfirmed edges require explicit evidence gaps. Self-connections and missing endpoints are rejected.
- New graph research uses manual provenance. AI extraction is not enabled and cannot be claimed through the API.

Existing `relationships` appear as read-only projections with `relation=documented_relationship` and the unchanged `original_type`. The projection retains both sides’ documented provisions/value and all associated evidence. A recorded integration is not converted into a partnership, provider relationship or essential dependency. Its displayed A → B orientation follows the stored relationship ordering, without establishing additional supply or payment semantics.

Reads return the selected node’s immediate, filtered neighbourhood. A need, actor, capability or resource can become the next centre just as an organisation can. Filters cover certainty, essential/growth/existing/potential category, lens and direction. The API bounds a response at 500 nodes, 500 edges, a 5,000-node catalogue and 100 historical edges, with totals and truncation flags. The canvas displays at most 40 nodes and points the researcher to the centre selector and connection list for further exploration.

The React Flow view has semantic node/connection controls and a separate searchable node directory. Body lenses are optional research tags: Oxygen (distribution/access), Blood (capital/value circulation), Brain (information/coordination), Legs (delivery/execution) and Food (recurring inputs). They organise questions, rather than impose a universal dependency model. Four research cards surface recorded dependencies, growth needs, confirmed incoming supplies and proposed possibilities; they do not create an answer where no evidence or finding exists.

The generic illustrative map lives only in client code (`components/anatomy-example.ts`). Its nodes and edges are explicitly hypothetical, are separate from My research, and never enter SQLite. It is not a verified map of Particle Network or another real business.

Retraction marks an edge inactive and appends a reason/timestamp event; it does not delete the source or original record. The API can atomically supersede an active edge using `supersedes_id`, preserving both versions and events. The UI offers retraction and entry of a corrected connection; it does not yet offer a dedicated supersession editor. Original relationship projections remain read-only here.

No document crawler, LLM, continuously running intelligence engine, automatic company matcher or opportunity recommendation engine is included. A future model-assisted extractor must propose editable, evidence-linked hypotheses into this structure and pass the same validation rules; it must not silently convert inferred complementarity into a verified relationship.

## Migrations and local storage

`terminal/db.py` enables foreign keys, a 30-second SQLite busy timeout and WAL journaling. It creates `schema_migrations` and applies lexically ordered `migrations/*.sql` not already recorded. Each migration uses `BEGIN IMMEDIATE` to serialize its applied-state check and DDL, preventing simultaneous first requests from applying it twice. `001_foundation.sql` establishes the foundation tables, checks and indexes; `002_business_activities.sql` adds separate business activity records; `003_verification_history.sql` adds link observation dates, identity review history, contract verification and enrichment-attempt tracking. `004_business_anatomy.sql` adds graph nodes, directed research edges and audit events; `005_anatomy_semantics.sql` enforces potential-payment and endpoint-kind rules; `006_anatomy_payment_semantics.sql` enforces the meaning of pays-for claims.

Add new changes after the latest recorded migration, such as `007_*.sql` and later. Do not edit an already-applied migration as a deployment strategy. Back up first, test on a copied database, and verify `PRAGMA integrity_check` and representative research flows after applying it. There is no automated down-migration command.

Private data and API keys are excluded from Git. Files are protected by the local operating-system account; application-level encryption is not supplied. Use the SQLite backup API rather than copying only the main database file while WAL writes are active. Raw responses must be backed up separately because database records reference them by path.

## Prepared source adapters

Evidence source types accommodate official documentation/websites, product/integration documents, announcements, financial data, DefiLlama, public chain observations, GitHub, official X and other public sources. In Phase 1 these sources enter as manual source records; only Binance and CoinGecko have automated API connectors. An automated future source adapter should retain original evidence, URL, dates, request provenance and interpretation separately, and must not silently promote imported text to verified economic research.
