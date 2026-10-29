# BD Oracle · Cřyptô Business

BD Oracle is your private, local-first Business Dependency & Opportunity Graph within Cřyptô Business. Start with assets, establish project identities, then investigate products, customers, repeated consumption, dependencies, value exchanges, and opportunities you might serve. Business Anatomy makes those needs and connections explorable, with any recorded node becoming the centre of another economic map.

The asset universe is a starting point. This is not a trading or investment tool. There are no prices, signals, portfolios, wallet trackers, public directories, or automated partnership recommendations.

**Extraction status:** the implementation attempted the official Binance and CoinGecko APIs in the build environment. Both were blocked by the environment proxy with `403 Forbidden` before an upstream response was received. There is no successful live extraction or fabricated replacement dataset. [Observed data-quality report](docs/QUALITY_REPORT.md) records the actual outcome. Run the collectors from a machine whose network permits those APIs to populate the real universe.

[Opportunity explorer](docs/images/opportunity-desktop.png) · [Mobile preview](docs/images/opportunity-mobile.png) · [Earlier Business Anatomy preview](docs/images/anatomy-desktop.png)

## Animated opportunity explorer

### Browser-only Binance workspace

Open `/discover` on the Vercel site or locally. **Fetch Binance Spot** calls the official public endpoint directly from your browser without a key, credentials, Python server or hosted database. Successful responses are validated and saved with their original JSON in IndexedDB. Browse deduplicated Binance base assets, all associated pairs, active/inactive states, and listings absent from the latest snapshot. Each asset can have an editable, explicitly unverified research note.

**Download backup** saves every retained snapshot and saved note as a portable JSON file. **Import JSON** accepts either this backup (merging without deleting existing snapshots/notes) or an original Binance `exchangeInfo` response. Imported raw responses get an import date, not a claimed extraction date. Invalid snapshots and duplicate pair identifiers are rejected while existing data is retained. **Download original JSON** preserves the latest response text unchanged.

Browser storage belongs to this device, browser and site origin; it does not sync automatically. Backups are the way to transfer data between devices. Clearing browser storage can remove local copies. Fetching runs while the page is open. If Binance disallows cross-origin requests or the user's network blocks access, open the official endpoint, save its JSON and import the file. Opening a URL in a tab does not by itself establish CORS access. Live browser-to-Binance access has not been demonstrated from this restricted development environment; browser tests use explicit synthetic API responses.

The browser workspace currently includes Binance discovery and notes. CoinGecko enrichment, relational research entities and the full SQLite graph remain in the existing local terminal; this feature does not silently migrate those records. On Vercel, `/research` also opens the browser workspace. The legacy server RPC remains disabled on Vercel because this path does not need it.

The homepage explains how complementary products can unlock a new use, change user behaviour and create measurable economic activity. Select a step in the Huma × Kamino example, play or pause the walkthrough, compare business needs, and explore a hypothetical share of attributable net revenue. The example combines supplied research notes with linked official documentation about the integration. Economic outcomes remain illustrative: there are no verified financial results or promised compensation. See [case provenance and hosting limits](docs/HOSTED_VISUAL_PREVIEW.md).

The interface uses a dark theme, responsive layouts and reduced-motion support. Open `/research` for the existing local terminal; existing `/?view=…`, asset, business, Anatomy and Network routes remain available locally.

On Vercel, the homepage is an interactive concept preview with a link to the browser workspace. It uploads no SQLite records and does not offer cloud saves. Legacy SQLite routes explain the distinction and their server API requests are disabled. A shared, continuously refreshed server database remains an optional future deployment path. To test the Vercel boundary locally, set `BD_ORACLE_PREVIEW=1` when building and starting Next.js. No API keys are needed for the visual preview or browser-only Binance collection.

## Product vision update — extended in place

The existing collectors, listings, identity matches and research records are preserved. The Binance connector, ingestion, CoinGecko enrichment, HTTP transport and quality reporting files are unchanged; [the inspection audit](docs/VISION_UPDATE_AUDIT.md) records their source fingerprints and the baseline database state.

- **Discover → Anatomy:** open `/assets/<id>/anatomy` to inspect the separately researched product/operator associations and their evidence. A verified CoinGecko identity does not establish a company. Open `/businesses/<id>/anatomy` for a dedicated map; original asset and business research pages remain available.
- **Economic Network:** `/network` expands actual stored connections to one, two or three hops, with evidence, dependency, lens and direction filters. Relevance ordering and visible limits reduce clutter. A path between businesses does not assert a direct relationship.
- **Economic explanations:** record what each endpoint provides or needs, why the connection makes sense, value to each side, explicit payment direction, evidence gaps and a separately recorded source-check date. Source observation is not silently treated as verification.
- **Research frameworks:** editable lending, game, wallet and data-provider frameworks contain questions only. They never assign dependencies to a business or insert edges. The research workspace also includes a question about new problems a business creates for other actors.
- **Optional intelligence boundary:** a disabled-by-default Python provider interface and [structured proposal schema](docs/intelligence-proposal.schema.json) prepare for later extraction/reasoning adapters. Imported proposals stay in a separate queue. Human review can edit the explanation, gaps and finding/value text; acceptance retains a hypothesis, never a verified fact. Original suggestions, sources, declared provider/model, confidence and edits remain inspectable. No external model is connected or called.
- **Unresolved:** review unconfirmed relationships as well as asset identities.

See [the product update handoff](docs/PRODUCT_VISION_UPDATE.md) for completed scope, remaining work, external API dependencies and validation. The original CEX live-data blocker has not been replaced with a fictional dataset.

## Run locally

Requirements: Python 3.12+, Node.js 20.9+ (Node.js 22 or 24 recommended), npm, and SQLite support in Python. Python uses only its standard library. No model API, paid hosting, or separate API server is required.

```bash
git clone --branch feat/personal-economic-intelligence-terminal https://github.com/olamilekanalaga/crypto-business-.git
cd crypto-business-
npm install
cp .env.example .env.local
python -m terminal init
npm run dev
```

Open **http://127.0.0.1:3000** for the opportunity explorer or **http://127.0.0.1:3000/research** for your research workspace. Keep the server bound to loopback. For a production-mode local build:

```bash
npm run build
npm start
```

If Python is not available as `python3`, set `PYTHON_BIN` to the executable path in `.env.local`; run CLI examples with your equivalent Python command.

The interface is mobile-friendly, but its API intentionally rejects non-local hosts. Access from another device or a public deployment requires a separate authentication/access design; do not expose this server directly.

## Collect and enrich

Run commands from the project directory. Next.js loads `.env.local`; Python CLI commands read exported environment variables. On bash/zsh, load local configuration first:

```bash
set -a
source .env.local
set +a
python -m terminal ingest
python -m terminal candidates
```

`ingest` fetches `https://data-api.binance.vision/api/v3/exchangeInfo`, stores the original response with SHA-256, deduplicates base assets within Binance, and retains every observed pair. Repeating it updates existing records, adds new pairs/assets, and marks previously observed pairs absent from the successful snapshot unavailable. It does not erase your research. Malformed, empty, or duplicate-symbol snapshots are rejected.

`candidates` retrieves CoinGecko's documented `/coins/list?include_platform=true` index. Matching tickers produce candidates only, including ambiguous alternatives. **Even one candidate remains unresolved.**

Then use the terminal:

1. Open **Unresolved queue** and investigate an asset's candidate identities.
2. Add original source evidence in **Research workspace → Source & evidence**. Compare the exchange's official asset information with official project, network, and contract identifiers.
3. Use **Verify asset identity** to approve an indexed CoinGecko ID with confirmed evidence. The record remains independent of any operating organisation or product.
4. Inspect the identity approval evidence and timestamped review history on the asset’s Identity tab. If needed, return the identity to unresolved; the review event is retained.
5. Use **Verify contract** on the research desk to record a specific network/address against its CoinGecko ID with confirmed official/chain evidence. The Identity tab separates these researcher-verified addresses from CoinGecko-reported metadata.
6. Run enrichment for approved identities:

```bash
python -m terminal enrich --limit 20
python -m terminal report
python -m terminal export
```

Enrichment stores available descriptions, links/social accounts, repositories, networks, contract metadata, categories, developer data, and a source-provided subset of exchange tickers. It does not verify a business or a reported contract address. Missing fields remain missing. Contract verification requires your independent evidence.

CoinGecko supports an optional Demo key in `COINGECKO_DEMO_API_KEY`. Availability and limits depend on the current provider plan. A paid Pro endpoint is supported only when you explicitly configure its base URL and `COINGECKO_PRO_API_KEY`; it is not required. Keys travel in headers and are excluded from Git.

The coin index is cached for one day; detail responses are cached for seven days. Detail enrichment selects verified identities with missing or stale profiles, respects a configurable request interval (seven seconds by default), and resumes on subsequent batches. HTTP retries are bounded; `Retry-After` is honoured or a long retry is deferred. Failures are recorded rather than replaced with invented metadata.

## Research your economic machine

- **Asset discovery:** searchable, paginated Binance base assets, trading pairs, status, and identity resolution.
- **Business explorer:** separate organisation and product records, with research pages. A business can exist without a token. Business pages open Business Anatomy; the Research tab retains the detailed economic questions.
- **Business Anatomy:** click through organisations, products, needs, capabilities, actors and resources. Distinguish essential dependencies, growth needs, existing relationships and potential connections. Inspect the economic explanation, both sides’ value, sources, evidence gaps and certainty. See the [Business Anatomy guide](docs/BUSINESS_ANATOMY.md).
- **Research workspace:** record all sixteen economic questions, distinct business activities, source excerpts, interpretations, hypotheses, and organisation/product/asset associations.
- **Economic flow:** Actor → Want → Behaviour → Problem → Provider → Transaction → Value → Next actor. Every step is a separate finding; unknown steps stay empty.
- **Relationships:** record what both businesses provide, what each gains, why the relationship exists, whether payment is known, dates, evidence, and certainty.
- **My opportunities:** capture friction, how you might help, a possible buyer, and the next research step. Update stages as you investigate.
- **Data quality:** inspect extraction counts, identity ambiguity, duplicated identifiers, request failures, availability, and last successful refresh. Download the current JSON report from the interface.

Create organisation and product records separately. Use **Connect records** for organisation → product (`operates`) and product → asset (`associated_asset`). Record each concrete business activity separately under its product, including the actor and what the product enables. One organisation can operate multiple products; products and assets can have many-to-many associations. Do not infer a business from a token name.

Confirmed claims, confirmed activities/associations, verified identities/contracts, and supported opportunity notes require confirmed source evidence. Stating that money does or does not change hands also requires confirmed evidence, even when the overall relationship is still a hypothesis; otherwise leave payment unknown. The system enforces the presence/status of evidence; **you** determine whether the source truly supports the specific claim. An integration announcement is not proof of payment. Technical compatibility is not proof of a formal partnership.

Evidence and findings are append-only: add corrected evidence and a new finding to retain the audit trail. Identity approvals and returns to unresolved have timestamped review records. Associations retain their observation dates and can be revised; opportunity notes are editable. Whole-page source archiving and automated source verification are not implemented. Store a faithful source excerpt or observation in the evidence field.

## Explore Business Anatomy

Open **Business Anatomy** in the sidebar, or open an organisation/product page. Choose a centre, click neighbouring nodes, and use Back one step to retrace your investigation. Filter by evidence status, essential/growth/existing/potential connection, direction, or body lens.

The Oxygen, Blood, Brain, Legs and Food lenses organise questions about access, capital, coordination, execution and recurring inputs. They do not establish that every business needs the same things. Four cards surface recorded answers to what keeps a business alive, what helps it grow, who supplies it, and who else might help or benefit; unresearched answers remain unknown.

Use **Record nodes & connections** to add concepts and directed research connections. Existing organisation/product records appear as graph nodes automatically, without generating dependencies. Confirmed connections require confirmed evidence; potential connections remain unconfirmed with unknown payment and explicit evidence gaps. Existing relationship records remain read-only graph projections with their original type, so an integration is never silently relabelled as a partnership.

**Illustrative example** is a generic, client-only navigation demonstration. It is clearly labelled hypothetical, contains no verified contractual claims about Particle Network or another real company, and is never inserted into SQLite. **My research** shows only your records and documented relationship projections.

The implementation uses SQLite and React Flow. It does not run an LLM, analyse documents automatically, match companies automatically, or generate opportunities. Those are later research-assistance capabilities; basic collection and manual graph work require no model API or paid graph database.

## Local files and checks

By default, private records live under `data/`, which is excluded from Git:

| File/location | Contents |
| --- | --- |
| `data/terminal.sqlite3` | Research, exchange observations, metadata, audit records, cache |
| `data/raw/` | Original HTTP response bodies, including failed/invalid responses when available |
| `data/exports/trading_pairs.{json,csv}` | All current/historical listing records after successful ingestion/export |
| `data/exports/assets.{json,csv}` | Deduplicated exchange-scoped asset records |
| `data/quality-report.json` | Current generated quality metrics |
| `data/QUALITY_REPORT.md` | Human-readable current quality report |

Use `TERMINAL_DATA_DIR` to select another private directory consistently for CLI and Next.js. A SQLite database is created automatically and ordered SQL migrations are applied on connection.

```bash
npm test
npm run typecheck
npm run build
# Optional browser flow checks: system Chromium or CHROMIUM_PATH is required.
npm run test:e2e
```

The browser suite starts its own local server on port 3100 and creates a fresh temporary database by default. `E2E_DATA_DIR` selects a specific disposable directory; `E2E_REUSE_SERVER=1` explicitly permits reusing a server already pointed at that same isolated directory. Never reuse a server or directory containing your real research data. Set `CHROMIUM_PATH` if Chromium is not installed at `/usr/bin/chromium`.

The original foundation passed the checks recorded in [verification evidence](docs/VERIFICATION.md). Consult that record and the final handoff for the latest graph-extension validation results. Tests use isolated fixture data, not a claimed live extraction. See [architecture](docs/ARCHITECTURE.md) for the model and [handoff](docs/HANDOFF.md) for operations, limitations, backup, and next steps.
