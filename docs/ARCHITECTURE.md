# Architecture

## Boundary and runtime

The Next.js 16 application uses React, TypeScript, Tailwind CSS, and local Python processes. The browser posts JSON to explicit `/api/<action>` handlers. The server invokes `python3 -m terminal rpc` (or `PYTHON_BIN`) with JSON on stdin. Python validates the operation and uses parameterized SQLite statements. No arbitrary SQL, executable paths, or source fetch URLs are accepted from the browser. There is no separate Python HTTP listener.

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

## Migrations and local storage

`terminal/db.py` enables foreign keys, a 30-second SQLite busy timeout and WAL journaling. It creates `schema_migrations` and applies lexically ordered `migrations/*.sql` not already recorded. Each migration uses `BEGIN IMMEDIATE` to serialize its applied-state check and DDL, preventing simultaneous first requests from applying it twice. `001_foundation.sql` establishes the foundation tables, checks and indexes; `002_business_activities.sql` adds separate business activity records; `003_verification_history.sql` adds link observation dates, identity review history, contract verification and enrichment-attempt tracking.

Add new changes as `004_*.sql`, `005_*.sql`, and so on. Do not edit an already-applied migration as a deployment strategy. Back up first, test on a copied database, and verify `PRAGMA integrity_check` and representative research flows after applying it. There is no automated down-migration command.

Private data and API keys are excluded from Git. Files are protected by the local operating-system account; application-level encryption is not supplied. Use the SQLite backup API rather than copying only the main database file while WAL writes are active. Raw responses must be backed up separately because database records reference them by path.

## Prepared source adapters

Evidence source types accommodate official documentation/websites, product/integration documents, announcements, financial data, DefiLlama, public chain observations, GitHub, official X and other public sources. In Phase 1 these sources enter as manual source records; only Binance and CoinGecko have automated API connectors. An automated future source adapter should retain original evidence, URL, dates, request provenance and interpretation separately, and must not silently promote imported text to verified economic research.
