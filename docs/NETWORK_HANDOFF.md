# BD Oracle network update

## Implemented

The directory remains the homepage. `/network` and `/opportunities` now open a data-driven economic network; the illustrative walkthrough is preserved at `/walkthrough`. `/businesses/huma` opens Huma directly. Original numeric business routes and `/network/local` preserve the existing SQLite interface.

The React Flow graph is built from stored businesses and relationships, with zoom, pan, selected-business navigation, back navigation, status filtering and accessible relationship buttons. Why panels retain original evidence excerpts separately from interpretation, value to each side, money-flow unknowns and missing evidence. Guided forms record businesses, manual economic relationships and evidence reviews without requiring code. An advanced structured editor remains available for detailed corrections. Saved hypotheses and notes survive browser reloads and export/import. Conflicting imports are rejected instead of overwriting research.

A sourced starter library contains Huma, Kamino, Morpho and Chainlink. The Huma–Kamino integration is documented by Huma's official integration page, inspected 2026-10-29. This verifies that stated integration only; it does not verify payments between the companies, live reserves, incremental revenue or introducer compensation. Quotes are short excerpts, not full scraped documents. The library is research, not a fictional demonstration or a complete CEX business universe.

For responsiveness, a workspace displays up to 500 generated rule candidates (plus all stored relationships); the graph shows up to 16 adjacent edges at once. The matcher compares sourced business needs with sourced capabilities using controlled function codes. It excludes self-links, documented existing connections and explicitly incompatible chains. Missing chain data stays an evidence gap. Every generated result is a hypothesis, with an explanation and investigation questions. It does not assert novelty: for example, a generated oracle match may already exist in a specific market. Human acceptance means worth investigating, never verification. Rule matches have no fabricated confidence score.

## Storage and privacy

The existing Binance IndexedDB workspace is unchanged. Network research uses a separate `bd-oracle-network` IndexedDB database with optimistic revision checks, a structured backup and an import validator. Browser mode is device-local, without server uploads or cross-device sync. The public application shell and starter research are public; personal notes stay in the browser unless explicitly exported or saved in server mode.

Server mode uses SQLite locally (additive migration `009_network_workspace.sql`) or persistent Postgres when `DATABASE_URL` is set. Vercel refuses server research unless a sufficiently long `BDO_OWNER_TOKEN` is configured. Server API responses are private/no-store. The owner token is entered in the connection panel, held in tab memory, and sent only to same-origin endpoints. It is a single-owner access credential, not multi-user account management. Use HTTPS in hosted deployments. Cross-origin requests are rejected; no permissive CORS or public database policies are added.

Postgres holds a versioned structured network document with validated references. It is an initial private-workspace store, not a migration of every existing SQLite research table into relational Postgres tables. Conflicting writes return 409. Existing SQLite entities, assets, listings, evidence, review history and graph tables are untouched.

## API routes

All server network endpoints require private authorization when hosted.

- `GET /api/businesses?q=Huma&sector=Payments`
- `GET /api/businesses/:id`
- `GET /api/businesses/:id/network`
- `GET /api/relationships/:id`
- `POST /api/relationships/:id/review`: `{revision,review:"accepted"|"rejected"|"pending",note,saved}`
- `GET /api/network/workspace`
- `POST /api/network/workspace`: validated complete graph, including current revision; used for manual research/imports
- `GET /api/sources/status`: server storage/AI setup and local ingestion report where available; never claims a scheduled job exists
- `POST /api/research/analyze`: `{businessId,revision}`

## Optional OpenAI

The server-only adapter uses structured output, existing business/evidence IDs and runtime validation. It sends bounded summaries of up to 20 businesses and 40 evidence excerpts, returns at most five hypotheses, caps completion tokens at 1,800, times out after 45 seconds and reserves a durable maximum of 10 attempts per UTC day. Attempts, including failed attempts, consume that limit. This limits requests, not dollar cost. Choose a compatible model and set a provider project budget separately.

Set `BDO_AI_ENABLED=1`, `OPENAI_API_KEY`, and `OPENAI_MODEL` only after private storage/access is connected. No keys use `NEXT_PUBLIC`. AI is disabled by default; no paid requests were made during implementation. Rejected/refused, incomplete, malformed or unknown-reference outputs are not saved. Valid suggestions remain hypotheses. Machine confidence is explicitly uncalibrated. Source citations must still be checked for entailment by the researcher.

## Enable cross-device research on Vercel

1. In the **crypto-business-** Vercel project, connect a Postgres provider through Storage/Marketplace (Neon or Supabase). Choose a suitable free plan if available; provisioning was not performed here.
2. Run `postgres/001_network.sql` in that database's SQL console. Use a privileged **server-only** pooled database connection; the migration enables row-level security with no anonymous policies.
3. Set `DATABASE_URL` and a randomly generated `BDO_OWNER_TOKEN` of at least 32 characters in Vercel Environment Variables. Do not paste secrets in chat or commit them. Redeploy.
4. In Network → Data sources, export your browser network backup. Enter your owner token and choose **Open server workspace**. Import the network backup explicitly. Other devices can open this server workspace with the same owner credential.
5. Keep Binance snapshot backups separate. This release does not silently upload raw Binance snapshots or migrate the full asset database into Postgres.
6. Optional: configure the OpenAI variables above. Enable only after verifying private API access.

## Preserve and move local research

`python -m terminal.network_export > network-legacy.json` exports existing organisation/product summaries, source excerpts and active business-to-business graph edges into the portable network format. Import it in Network. IDs retain `legacy:` prefixes; no ticker-based entity merging occurs. Needs/capabilities require explicit taxonomy coding before matching. Full original evidence, general actor/resource graph nodes, entity relationships outside graph_edges, claims, identity reviews and audit history remain in SQLite; the export is a portable subset, not a destructive migration. Keep a full SQLite backup.

## Existing collection pipeline

Python `python -m terminal ingest`, `candidates`, `enrich --limit 20`, `report` and `export` remain available with their existing raw audit trail, cache, retry and unresolved matching rules. Run them on a machine/worker that Binance permits; moving an endpoint to Vercel does not guarantee Binance access. Browsing a business does not trigger exchange calls.

## Not yet activated or implemented

- Hosted Postgres provisioning, real cross-device verification and owner credential setup require the user's hosting/database connection.
- Live OpenAI responses and costs have not been tested; no API key is configured.
- Automatic website crawling, AI extraction of needs from documentation, semantic/vector retrieval, hosted scheduled ingestion and additional exchange connectors are not implemented by this update.
- Complete CoinGecko identity enrichment and all CEX assets are not automatically turned into business profiles. Unverified tickers stay in the discovery layer.
- Commercial opportunity attribution, budgets and referral compensation remain research questions, not computed facts.

## Validation

Python regression suite: 96 passing tests, including SQLite migration preservation, revision conflict handling and the daily AI budget. Browser tests cover Huma → Kamino → Why with source evidence, a generated Morpho candidate, saved review persistence, back navigation, mobile overflow, private REST persistence and stale-write rejection. Matcher tests reject cross-chain mismatches, missing source references and automatic verification of hypotheses. No external paid API requests or live extraction counts are represented by test fixtures.
