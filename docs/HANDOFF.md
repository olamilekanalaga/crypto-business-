# BD Oracle handoff

## What is implemented

The local terminal includes the Binance Spot connector, repeatable SQLite ingestion, original-response audit trail, listing snapshots and exports, CoinGecko candidate indexing and incremental detail enrichment, manual identity approval and review history, evidence-backed contract verification, organisation/product records and associations, distinct product-enabled business activities, structured economic research, evidence entry, relationship records, economic-flow views, personal opportunity notes, a live data-quality view, the Business Anatomy dependency graph, dedicated asset/business Anatomy routes, multi-hop Economic Network, reusable research frameworks and an isolated structured-proposal review boundary.

The interface is designed for one person's research: identify a business need, understand who wants what, inspect the exchange of value, capture how you might help, and choose the next investigation. Opportunity notes are hypotheses or personal assessments, not automated recommendations.

## Business Anatomy extension

Use **Discover** to browse existing assets/businesses, then **Business Anatomy** for the selected subject. Dedicated routes are `/anatomy`, `/assets/[id]/anatomy` and `/businesses/[id]/anatomy`; **Economic Network** (`/network`) explores multiple stored hops. Open **Business Anatomy** from the sidebar or an organisation/product page. Business pages now start with this view; their Research tab still contains the original economic questions. Any recorded organisation, product, need, capability, actor or resource can become the centre of the next map.

The extension adds typed directed connections, independent dependency importance/existing-or-potential/certainty fields, original evidence and interpretation, economic value for both sides, explicit evidence gaps, body-question lenses, four research summary cards, and retraction/audit history. Existing documented relationships appear read-only with their original type, without upgraded partnership, payment or dependency claims. The database remains SQLite and the canvas uses React Flow.

For a first map:

1. Create a business/product and supporting sources in the research workspace. Existing business records gain graph wrappers automatically, without inferred dependencies.
2. Open **Record nodes & connections → Nodes** to define a need, capability, actor or resource in plain language.
3. Use **Connections** to select source/target, relationship meaning, importance, existing/potential state, certainty, what each endpoint provides/needs, both sides’ value, payment direction, evidence and unresolved questions. A manually entered evidence-check date is separate from observation; leave it blank when not recorded.
4. Click a node or use the centre selector, inspect a connection, and follow its evidence before relying on it. Filters affect the current neighbourhood; an empty answer means not established in that view.
5. Retract a mistaken connection with a reason. Its original record and source remain in history; record the corrected connection separately. API-level supersession is available but has no dedicated UI editor yet.

Confirmed edges require confirmed evidence. Potential connections stay unconfirmed, leave payment unknown and require evidence gaps. Partnerships/competition require business endpoints. A confirmed pays-for claim requires evidenced payment yes. These rules constrain the stored interpretation; they do not prove that a source supports it.

The **Illustrative example** is a generic, clearly labelled client-only demonstration. It never populates the research database and makes no verified contractual claim about Particle Network or another company. The body analogy organises questions rather than defining a universal business model. See [BUSINESS_ANATOMY.md](BUSINESS_ANATOMY.md) for the full workflow and limits.

## Asset selection, connected exploration and unresolved work

An asset's Anatomy route shows only separately recorded product/organisation associations. It preserves every path and its evidence. An operator reached through product → asset plus organisation → product is confirmed only if the complete path is confirmed; partial or hypothetical associations stay labelled. A verified CoinGecko match alone does not create a company. Choose the appropriate associated business, or investigate the unresolved association in Research workspace.

Business Anatomy keeps the selected subject central. Economic Network expands the same actual stored connections to one, two or three hops; filters apply before every hop. Relevance uses recorded certainty and essentiality, not a model-generated opportunity score. Expand explicitly, click any node to refocus, or move back through explored centres. The Unresolved area includes relationships needing investigation, not just unmatched identities.

**Research frameworks** provide generic, editable questions for lending protocols, games, wallets and data providers. They are reusable starting frameworks, not default claims about a business. Editing or selecting them adds no graph facts. Research each dependency with its own evidence and distinguish recurring operating needs from optional capabilities.

## Optional intelligence readiness

The provider is disabled and no model call, model key, paid graph database, automatic dependency inference, company matcher or recommendation engine is required. An LLM is not continuously running inside this application. `IntelligenceProvider` is a modular Python Protocol for a future, separately configured adapter.

The optional intelligence workspace accepts structured proposals into a separate human-review queue. Use existing entity/node/evidence IDs and the schema in `docs/intelligence-proposal.schema.json`. Provider/model labels and confidence are declared, unverified metadata. Importing is not generation, evidence verification or graph creation. Connection/finding drafts require existing sources; original source excerpts and interpretations remain separate.

A human can reject a proposal or keep it for investigation with a review note. Inline review supports edited context/values or finding/question text, economic explanations and evidence gaps while retaining original content; the server validates edited payloads again. Acceptance atomically creates only a new potential hypothesis with unknown payment and no verification date, or a hypothesis finding/question. It cannot confirm a partnership, customer, revenue, payment or essential dependency, replace verified research, or duplicate records on repeated acceptance. Origin and original/reviewed content remain inspectable on accepted claims/edges. Manual evidence-backed research continues to be the authority for confirmation.

These interfaces prepare later intelligence without representing a model-generated map as current economic knowledge.

## What has not been established

The official Binance request and CoinGecko index request were attempted on 2026-10-29 UTC. The build environment proxy refused both CONNECT requests with `403 Forbidden`. Consequently:

- No successful real Binance asset/pair dataset is available from this build session.
- No live asset count, deduplicated base-asset count, CoinGecko match count from successful enrichment, or successful-refresh date is claimed.
- The database contains request/run failures and an empty asset universe, rather than substituted fixture rows.
- Extraction metrics remain unavailable (`null` in JSON). Zero local record counts mean an empty database, not a zero-asset exchange.

See [the observed quality report](QUALITY_REPORT.md). `data/quality-report.json` and `data/QUALITY_REPORT.md` are the current local reports; regenerate them after network access or research changes.

## First successful run

1. Install and start locally using [README](../README.md).
2. Ensure HTTPS access to `data-api.binance.vision` and `api.coingecko.com` is permitted in the machine's normal network/proxy policy. Do not disable TLS verification or bypass network controls. Configure the optional CoinGecko Demo key if required by the provider.
3. Run `python -m terminal ingest`. Inspect the exit code, `python -m terminal report`, `data/raw/` response, and JSON/CSV exports.
4. Run `python -m terminal candidates`. All ticker candidates should remain unresolved until evidence is recorded.
5. Investigate an asset, add a source excerpt, approve an identity with that evidence, inspect the approval evidence/history, then run `python -m terminal enrich --limit 20`. Use **Verify contract** to record a specific network/address with confirmed evidence; distinguish these from source-reported CoinGecko addresses.
6. Create organisation/product records and the concrete business activities each product enables. Document claims and associations with precise evidence. Open their pages and record customers, revenue, repeated consumption, dependencies, and potential opportunity notes.
7. Add a business relationship, leaving payment `unknown` unless specific confirmed evidence establishes it. The service rejects payment `yes/no` without confirmed evidence, even for a hypothetical relationship. Review both sides' value.
8. Reload local data using the Data refresh panel and inspect the quality view.

A network failure exits unsuccessfully, remains auditable, and does not turn candidate data into verified research. CoinGecko access tiers, endpoint availability, quotas, and supplied fields can change; adapt documented configuration or collect evidence manually rather than fabricating missing information.

## Validation commands

```bash
npm test
npm run typecheck
npm run build
npm run test:e2e
```

The Python suite uses temporary fixture databases. The browser suite starts a local server on port 3100 using a fresh temporary database by default (`E2E_DATA_DIR` can select a specific disposable directory) and system Chromium (`CHROMIUM_PATH`, default `/usr/bin/chromium`). Server reuse requires `E2E_REUSE_SERVER=1`; reuse only a server already configured with that same isolated data directory. Do not run browser fixtures against your research database. A passing fixture suite verifies defined software behaviour; it is not evidence of a successful live extraction. Browser checks should cover creating a source, a business and product, adding a confirmed finding, linking records, recording a relationship, and editing an opportunity across a page reload. Also verify empty states and mobile navigation. See [VERIFICATION.md](VERIFICATION.md) for the checks actually completed and the final handoff for the latest graph-extension results. The original foundation checks do not by themselves validate new graph behaviour. Live collection remains blocked, so fixture success does not establish real coverage.

## Backup and restore

Stop collectors and research edits during a backup if possible. Do not copy only `terminal.sqlite3` while WAL transactions may be active. Use SQLite's consistent backup API:

```bash
python - <<'PY'
from pathlib import Path
import sqlite3
from terminal.db import connect, data_dir

backup = data_dir() / 'backups'
backup.mkdir(exist_ok=True)
destination = backup / 'terminal-backup.sqlite3'
if destination.exists():
    raise SystemExit('Choose a new backup filename; refusing to overwrite an existing backup.')
with connect() as source, sqlite3.connect(destination) as target:
    source.backup(target)
print(destination)
PY
```

Also copy `data/raw/` and, if wanted, exports/reports to the same backup set. Raw paths in the database refer to the directory used at collection time; preserve that location or plan a careful path migration on restore. Protect backup files as private research.

To restore, stop Next.js and all collectors, preserve the existing data directory as a rollback copy, and restore the database together with its raw response archive. Do not combine an old database with newer `-wal`/`-shm` files. Open the restored database, run `PRAGMA integrity_check`, then inspect representative records and quality results before continuing. Reapply only genuinely pending migrations.

## Operation and safety limits

- The Next.js API is loopback/local-host restricted; there are no accounts, sessions, or public-deployment controls. Keep it local.
- Migrations serialize the applied-state check and DDL. Ingestion rejects an older in-flight response once a newer run has succeeded. An export disk error does not invalidate the already-committed snapshot; rerun `python -m terminal export`.
- Python is spawned for each RPC. This is simple for a personal local tool; a hosted or concurrent system would need a different process/authentication design.
- Evidence consists of manually supplied source excerpts/observations. Whole-page archiving, crawler integrations and automatic verification are not implemented.
- Verification records a researcher's judgement. The application cannot establish that an excerpt proves a paying customer, legal organisation, partnership or contract identity.
- Correct evidence/finding entries by appending new records. Identity approval/reset events retain review history; entity links retain observation dates. Mutable entity links and opportunity notes do not yet have a separate revision-history UI.
- CoinGecko contracts/categories/descriptions are source metadata. Use the contract-verification workflow for independently researched network/address records, retaining confirmed evidence and an observation date. Verification remains your judgement, not an automatic chain assertion.
- Permanent CoinGecko per-ID failures are recorded without blocking later identities. Quota/authentication/transport/server errors stop a batch; last-attempt ordering permits fair resumptions. Review retained `enrichment_error` values before treating a missing profile as absent project information.
- A CoinGecko detail response provides a subset of exchange tickers. Binance's observed listing table remains the exchange-universe authority in this phase.
- Base assets are unique within an exchange namespace; symbol reuse, migrations and renames require manual review. Cross-exchange consolidation uses approved canonical identifiers rather than ticker equality.
- Graph responses are bounded to 500 nodes, 500 connections, 5,000 catalogue entries and 100 historical edges, with Economic Network depth limited to three stored hops; the canvas displays at most 40 nodes. Inspect limits/truncation flags and refine the centre or filters rather than assuming a bounded view is the entire graph.
- The four research cards describe the current filtered neighbourhood and recorded findings. Unknown answers and absence of a connection are not proof that a business has no dependency.
- There is no exchange scheduler, automatic research writer, multi-exchange connector implementation, automated opportunity scoring, recommendation engine or model API dependency.

## Extension order

1. Obtain a successful Binance snapshot and independently verify a small set of project identities and operating businesses.
2. Accumulate verified dependency research in Business Anatomy; use retraction and source gaps as you correct it. Add a dedicated supersession editor and finer-grained source support if useful.
3. Add the next exchange as its own `ExchangeConnector`, with normalization fixtures, raw audit retention and verified identity association. Retain its complete listing relationships.
4. Add documented source-specific evidence adapters where they reduce manual work, preserving source text separately from interpretations.
5. Implement and explicitly enable an opt-in `IntelligenceProvider` adapter only after the underlying business evidence is useful and trustworthy; the disabled interface, structured schema and human-review queue are already prepared. Preserve source citations, uncertainty, manual corrections and the graph’s semantic constraints; validate proposed connections against real evidence before treating them as opportunities.

No branch push, public deployment, external messages, paid resources or live partner outreach is required for local operation.

## Preservation and upgrade notes

This is an update to the inspected implementation, not a replacement. Collector hashes and the read-only baseline database audit are in [VISION_UPDATE_AUDIT.md](VISION_UPDATE_AUDIT.md). Existing Binance/CoinGecko collector, transport, enrichment and quality-report files remain unchanged; original assets, listing snapshots, source references and research remain in place.

Migration 007 expands graph meanings and fields while transactionally preserving old graph/event IDs, supersession and evidence. It does not infer a verification date from an observation date or invent previously unrecorded context. Migration 008 supplies generic questions and separate proposal storage. Back up before migration; verify foreign-key/integrity results and representative research after connecting. A copied, populated pre-update database is the appropriate upgrade test, rather than relying on an empty schema alone.

The normal research database still contains the original failed API audit, rather than real extracted asset/business coverage. The network policy blocked the official hosts before upstream responses; six failed request records and unavailable extraction counts remain the honest state. Graph examples, synthetic tests and staged proposals do not remedy that data-access dependency. No new live extraction is claimed by this vision update.
