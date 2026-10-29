# Cřyptô Business

A private, local-first economic intelligence terminal for your own business research. Start with Binance assets, establish project identities, then investigate products, customers, repeated consumption, dependencies, value exchanges, and opportunities you might serve.

The asset universe is a starting point. This is not a trading or investment tool. There are no prices, signals, portfolios, wallet trackers, public directories, or automated partnership recommendations.

**Extraction status:** the implementation attempted the official Binance and CoinGecko APIs in the build environment. Both were blocked by the environment proxy with `403 Forbidden` before an upstream response was received. There is no successful live extraction or fabricated replacement dataset. [Observed data-quality report](docs/QUALITY_REPORT.md) records the actual outcome. Run the collectors from a machine whose network permits those APIs to populate the real universe.

[Desktop preview](docs/images/terminal-desktop.png) · [Mobile preview](docs/images/terminal-mobile.png)

## Run locally

Requirements: Python 3.12+, Node.js 20.9+ (Node.js 22 or 24 recommended), npm, and SQLite support in Python. Python uses only its standard library. No model API, paid hosting, or separate API server is required.

```bash
git clone https://github.com/olamilekanalaga/crypto-business-.git
cd crypto-business-
npm install
cp .env.example .env.local
python -m terminal init
npm run dev
```

Open **http://127.0.0.1:3000**. Keep the server bound to loopback. For a production-mode local build:

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
- **Business explorer:** separate organisation and product records, with research pages. A business can exist without a token.
- **Research workspace:** record all fifteen economic questions, distinct business activities, source excerpts, interpretations, hypotheses, and organisation/product/asset associations.
- **Economic flow:** Actor → Want → Behaviour → Problem → Provider → Transaction → Value → Next actor. Every step is a separate finding; unknown steps stay empty.
- **Relationships:** record what both businesses provide, what each gains, why the relationship exists, whether payment is known, dates, evidence, and certainty.
- **My opportunities:** capture friction, how you might help, a possible buyer, and the next research step. Update stages as you investigate.
- **Data quality:** inspect extraction counts, identity ambiguity, duplicated identifiers, request failures, availability, and last successful refresh. Download the current JSON report from the interface.

Create organisation and product records separately. Use **Connect records** for organisation → product (`operates`) and product → asset (`associated_asset`). Record each concrete business activity separately under its product, including the actor and what the product enables. One organisation can operate multiple products; products and assets can have many-to-many associations. Do not infer a business from a token name.

Confirmed claims, confirmed activities/associations, verified identities/contracts, and supported opportunity notes require confirmed source evidence. Stating that money does or does not change hands also requires confirmed evidence, even when the overall relationship is still a hypothesis; otherwise leave payment unknown. The system enforces the presence/status of evidence; **you** determine whether the source truly supports the specific claim. An integration announcement is not proof of payment. Technical compatibility is not proof of a formal partnership.

Evidence and findings are append-only: add corrected evidence and a new finding to retain the audit trail. Identity approvals and returns to unresolved have timestamped review records. Associations retain their observation dates and can be revised; opportunity notes are editable. Whole-page source archiving and automated source verification are not implemented. Store a faithful source excerpt or observation in the evidence field.

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

The browser suite uses its own local server on port 3100 and a disposable database (`E2E_DATA_DIR`, default `/tmp/crypto-business-browser`). Avoid reusing that port with a server pointed at your real research data. Set `CHROMIUM_PATH` if Chromium is not installed at `/usr/bin/chromium`.

The implementation passed 39 offline Python tests and four browser journeys, plus TypeScript and production-build checks; see [verification evidence](docs/VERIFICATION.md). Tests use isolated fixture data, not a claimed live extraction. See [architecture](docs/ARCHITECTURE.md) for the model and [handoff](docs/HANDOFF.md) for operations, limitations, backup, and next steps.
