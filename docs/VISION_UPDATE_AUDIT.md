# BD Oracle vision update — implementation audit

## Baseline inspected before extension

Inspected commit `b5307aaf222598f9b9b7b1faf505ce63aa69e25b` on `feat/personal-economic-intelligence-terminal` before modifying the existing project. This is an extension, not a replacement application.

The read-only inventory covered Python collectors and transport, CoinGecko enrichment, SQLite migrations and stored records, Next.js API handlers/routes, React research and graph components, source/evidence semantics, and the existing automated checks.

**Baseline check:** all 63 existing Python tests passed using disposable fixture databases. No external requests or normal research-data changes were made by the audit.

| Existing subsystem | Working behaviour to preserve |
| --- | --- |
| Binance Spot connector | Official exchangeInfo endpoint; base/quote/status/Spot permissions; original responses and SHA-256 audit retention |
| Exchange ingestion | Transactional snapshots, unique exchange-scoped base assets, all pair relationships, missing/inactive states, first/last observation and incremental refresh |
| CoinGecko | Candidate-only ticker lookup, manual evidence-backed identity approval, cached incremental profiles and raw request records; no inferred operating business |
| Research database | Separate assets, organisations, products, economic activities, claims, sources, interpretations, verification status and opportunity notes |
| Business Anatomy | Persisted typed nodes/edges, one-hop node-centred exploration, body lenses, evidence-aware inspector and retraction audit |
| Manual workspace | Business/product creation, original evidence excerpts, interpretations, findings, product/asset links and economic relationships |
| Local boundary | Loopback binding, same-origin/local-host API checks, private data excluded from Git |
| Interface | Asset discovery, business research, economic flow, relationship explorer, opportunity notes, unresolved identities and honest data-quality reporting |

The normal research database was opened using SQLite `mode=ro`, rather than the application's migration-capable connection. Baseline file SHA-256: `d406891098f0563fe524d32bb8c436a786910942c1cfb8ffcde0aba12ba8767d`.

| Stored record | Baseline count |
| --- | ---: |
| Assets, listings and listing observations | 0 each |
| Entities, evidence, claims and relationships | 0 each |
| Opportunities, graph nodes and graph edges | 0 each |
| External request audit records | 6 |
| Ingestion runs | 1 |
| Applied migrations | 6 |

The only ingestion run was a failed Binance attempt. Pair/base-asset counts and the successful-refresh date were unavailable, because the environment's proxy denied the official API host before an upstream response. The six request records reflect the attempted Binance and CoinGecko calls. These empty tables are not a claim that an exchange contains zero assets.

## Collector preservation fingerprints

The following source files were fingerprinted before the update. They must remain unchanged by the graph/navigation/intelligence-readiness work. Physical SQLite hashes can change through migrations or WAL checkpoints; preservation of database records is verified through record-level migration tests rather than requiring a fixed database-file hash.

| File | Baseline SHA-256 |
| --- | --- |
| `terminal/connectors/binance.py` | `fc07bf105608e86266a6195ece22a2babac063a5b453d190771780ad62092933` |
| `terminal/ingest.py` | `3eae375efffd176e710ca3039347be0ace70ca98e37c5a8a09f14ba777b7cf88` |
| `terminal/enrich.py` | `e2493f58864528b68cf607d57458f6b8bd4d8e5e3e2316b3429cfe6bf717b2bc` |
| `terminal/http.py` | `6a804bd1185cfab962a2abe71c6728b3aa29f166f22779fadbf22c2e75046924` |
| `terminal/report.py` | `45101497e5106c86f013c30ee907b77fe02a32e493453afd70a1e0fb416f9c35` |

## Gaps identified against the product update

| Requirement | Baseline gap | Extension target |
| --- | --- | --- |
| Select an asset and open its business anatomy | Assets intentionally were not graph nodes, but no dedicated asset-to-business resolution page existed | Resolve explicit product/organisation associations with their own certainty; never treat CoinGecko identity alone as company proof |
| Dedicated anatomy pages | Anatomy was a tab and general workspace view | Stable individual business and asset anatomy routes |
| Economic Network | Only immediate neighbours were returned | Bounded, explicit multi-hop exploration of recorded edges, with relevance ordering and visible limits |
| Economic explanation | Why/value/evidence/gaps existed, but endpoint functions, money direction and last review were not separate fields | Preserve observation date and add explicit endpoint context, money direction and researcher evidence-check date |
| Reusable category research frameworks | Body lenses existed; editable category frameworks did not | Generic question frameworks that can be refined without asserting dependencies or populating factual graph edges |
| Optional model service | No paid calls were required, but no structured provider/proposal/review boundary existed | Disabled-by-default provider interface and separate structured proposals with source references, confidence, gaps and explicit human review |
| Unresolved relationships | Identity queue existed; investigation of uncertain graph relationships was scattered | Evidence-aware unresolved graph/research queue |

These targets extend the stored, manually researched graph first. They do not require a model to generate a convincing but unverified map.

## Validation boundary

Existing extraction freshness, real-asset coverage and live provider compatibility remain dependent on successful access to the official Binance/CoinGecko APIs. Offline and browser fixtures verify application behaviour, not actual business relationships. No fictional fixture should enter the normal research database, and an illustration or model proposal must never be promoted automatically to a verified fact.

Final update results and preservation checks are recorded below only after execution.

## Executed extension checks

- All five collector/enrichment/transport/report fingerprints above were rechecked and remained byte-identical.
- The full Python suite passed **94 tests**, including **15 new vision-update regressions** plus the original 63 tests and the optional-intelligence/taxonomy tests.
- A populated pre-update fixture database was migrated from versions 001–006 through pending migrations. Asset/listing/observation rows, source text, active/retracted edge IDs, supersession self-reference and audit-event IDs survived; SQLite integrity and foreign-key checks passed.
- Asset resolution tests confirm that CoinGecko identity alone creates no operating-business association. Multiple researched product/organisation paths preserve their own certainty and evidence.
- Network tests expand only recorded edges to one, two or three hops. Filters apply at every hop; confirmed claims rank ahead of newer hypotheses, disconnected concepts stay disconnected, and unresolved queues exclude confirmed/retracted facts.
- Connection tests retain separate endpoint functions, value received, known payment direction, source observation and researcher evidence-check dates. A check date is never invented from an observation timestamp.
- Three new browser journeys passed using a fresh disposable database. They cover dedicated asset/product anatomy routes and association-source inspection; money/context/check-date inspection; depth expansion, reload and back navigation; mobile overflow; framework creation/refinement without graph facts; and editable proposal review that creates only a hypothesis while preserving the original proposal.

The final combined browser suite passed **all nine journeys** in 2.8 minutes, including the original six regression checks and the three new vision-update journeys. The browser runner created and cleaned up its own disposable database/server; no normal research records or live Binance, CoinGecko or model calls were used.

The development server emitted the pre-existing Next.js router-initialisation diagnostic during rapid navigation in the original synthetic asset identity test. All assertions passed; the new dedicated route/network journey recorded no page errors. Production-mode browser verification is recorded separately by the primary implementation report.

The normal database was consistently backed up at `data/backups/before-product-vision-update.sqlite3` while it still had six migrations. After migration to eight, existing counts across assets, listings, listing observations, entities, evidence, claims, relationships, opportunities, runs, requests, graph nodes, graph edges and graph events remained unchanged. SQLite integrity returned `ok`. The four newly seeded framework records contain generic questions only.

Production follow-up completed separately with disposable synthetic data: direct asset-to-product Anatomy navigation, reload and depth-three network routes produced no JavaScript page errors. The earlier development-router diagnostic did not reproduce in production. Normal production pages also had no page errors or mobile overflow and reported external intelligence disabled.
