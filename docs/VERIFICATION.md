# Implementation verification — 2026-10-29

The personal research story is: open a local asset → inspect its preserved exchange observations → verify a project identity with evidence → research organisations and products → document economic activity and reciprocal business value → capture and refine an opportunity.

## Observed checks

| Boundary | Result | Evidence |
| --- | --- | --- |
| Python ingestion, SQLite and research invariants | Passed | 94 isolated offline unittest cases |
| UI → Next.js → Python → SQLite → refreshed UI | Passed | Playwright creates evidence, organisations, products, activities, findings and relationships through real forms |
| Opportunity create/edit/persistence | Passed | Browser changes the investigation stage and next step, reloads, and checks SQLite-backed results |
| Asset discovery and identity review | Passed with synthetic fixtures | Browser inspects preserved pair statuses, records evidence, approves an identity, and reads source metadata without an inferred business |
| Local API boundary | Passed | Cross-origin, remote-Host and cross-site write requests return 403 and leave records unchanged |
| Responsive interface | Passed | 390px mobile viewport, no page overflow, functional mobile navigation and opportunity entry |
| TypeScript | Passed | `npm run typecheck` |
| Production compilation | Passed | `npm run build` using webpack and the supported compiler-API TypeScript check |
| SQLite integrity | Passed | `PRAGMA integrity_check` returns `ok`; all eight migrations applied |
| Live Binance extraction | Blocked | The environment proxy refused the official host with CONNECT 403 before an upstream response |
| Live CoinGecko indexing/enrichment | Blocked | The environment proxy refused the official host with CONNECT 403 before an upstream response |

All browser and unit fixtures use disposable databases. None were inserted into the normal `data/` database. Fixture-based checks prove implementation behaviour, not current exchange coverage or factual business research.

A production-mode browser smoke check also returned HTTP 200, no page JavaScript errors, no mobile overflow, and the expected honest state: six recorded request failures, no successful extraction, and zero stored asset rows. The refresh dialog closes with Escape.

[Actual desktop interface](images/terminal-desktop.png) · [Actual mobile interface](images/terminal-mobile.png). These captures use the normal empty research database, not the synthetic browser-test fixtures.

## Test coverage

The offline suite covers repeatable ingestion; first/last observations; inactive, missing and returning pairs; duplicate rejection; transactional rollback; preservation of the last good snapshot; stale concurrent response rejection; export failure separation; cross-exchange identity separation; ticker ambiguity; evidence constraints; identity history; address-specific contract verification; opportunity editing; incremental enrichment; permanent-failure continuation; quota stops; fair retry ordering; cache invalidation; HTTP retries; raw audit retention; and missing-data reporting.

The nine browser tests cover the original business research journey, local API boundary, synthetic asset identity journey and desktop/mobile usability; two Business Anatomy journeys for typed entry, traversal, filters, sources, retraction and illustrations; and three product-vision journeys for dedicated asset/business routes, multi-hop network expansion and reload, economic contexts/payment dates, framework editing without inserted facts, and edited human-reviewed proposals that remain hypotheses.

## Reproduce

```bash
npm test
npm run typecheck
npm run build
# Requires Chromium; see README for CHROMIUM_PATH.
npm run test:e2e
```

The browser suite starts its own local server on port 3100 and creates a fresh temporary database by default. It refuses the normal data directory. Server reuse requires explicit opt-in and a separately configured disposable database.

The production asset and business tables remain empty until a successful real collection or your manual business research. See [QUALITY_REPORT.md](QUALITY_REPORT.md) for observed request failures and unavailable extraction counts. Live completeness and real provider compatibility still need verification from a network that permits the official APIs.

## Earlier Business Anatomy extension

The extension passed 24 focused Python tests (63 total) and two additional browser journeys (six total), plus TypeScript and production compilation. SQLite integrity is `ok` after applying migrations 004–006. Partnerships and competition require business endpoints; potential payment remains unknown; confirmed Pays for requires confirmed payment evidence. Retraction preserves original claims and sources. Existing integrations are projected with their original meaning, without inferred partnership or payment.

[Business Anatomy desktop illustration](images/anatomy-desktop.png) · [Mobile illustration](images/anatomy-mobile.png). These are client-only conceptual examples, clearly labelled, not a verified map of any real business. A production browser smoke check verifies that exploring the illustration leaves the saved graph unchanged and produces no page errors or mobile overflow. No LLM engine or automatic company-matching service is integrated.

## Product vision update — current validation

- All **94 Python tests** passed, including the original 63 cases, 15 product-update migration/network/association cases and 16 taxonomy/intelligence cases.
- All **nine browser journeys** passed in disposable databases. The three new journeys verify dedicated asset-to-business routes, association sources and certainty, endpoint explanations/payment direction/check dates, one-to-three-hop traversal with reload/back navigation and mobile layout, editable research frameworks that create no facts, and edited proposals that create only explicitly reviewed hypotheses.
- TypeScript and the production build passed, including the dedicated `/anatomy`, `/network`, `/assets/[id]/anatomy` and `/businesses/[id]/anatomy` routes.
- The five audited collector/enrichment/transport/report source files remain byte-identical. See [VISION_UPDATE_AUDIT.md](VISION_UPDATE_AUDIT.md).
- A populated pre-update migration fixture preserves listings, snapshots, evidence IDs, graph IDs, supersession and audit events. Normal production migration also preserved record counts across 13 existing research/audit tables, passed `PRAGMA integrity_check`, and applied eight migrations. Four generic question frameworks are separate from business facts.
- A consistent pre-update database backup was retained before migration. Tests and production-mode synthetic route checks used isolated data directories; normal research contains no fixtures.

The optional provider boundary is disabled. Fake-adapter tests validate structured source-linked outputs, batch rejection, citation validation, review edits, atomic acceptance, retained origin and hypothesis-only status. They do not prove real model behaviour or authenticate declared provider metadata. Live provider implementation and live API validation remain incomplete.

[Product vision handoff](PRODUCT_VISION_UPDATE.md) · [Research frameworks desktop](images/research-frameworks-desktop.png) · [Mobile](images/research-frameworks-mobile.png).

Production-mode follow-up: a separate disposable production server exercised direct asset → associated product → dedicated Anatomy navigation and reload, then `/network?depth=3`. It reported zero page JavaScript errors and retained depth 3. The pre-existing development-router diagnostic was not observed in production. The normal production server also rendered discovery, Anatomy illustration, research frameworks and disabled intelligence review without page errors or mobile overflow; its provider status reported `enabled=false` and `external_calls=false`. No synthetic rows were added to the normal database.
