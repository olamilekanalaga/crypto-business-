# BD Oracle — product vision update handoff

This update extends the existing Crypto Economic Intelligence Terminal. It does not replace its collectors, SQLite database, research workspace or earlier Business Anatomy implementation.

## Inspected and preserved

The pre-update audit inspected code, database records, collectors, enrichment, routes, graph/research components and tests. The original 63 Python tests passed before changes. The Binance connector, ingestion, CoinGecko enrichment, HTTP transport and data-quality reporter remain byte-identical to the audited source fingerprints in [VISION_UPDATE_AUDIT.md](VISION_UPDATE_AUDIT.md).

A consistent copy of the normal six-migration database was saved locally at `data/backups/before-product-vision-update.sqlite3` before applying the new migrations. Private data and this backup are excluded from Git. Migration tests use populated disposable databases to verify that assets, listing snapshots, evidence IDs, graph edge IDs, supersession links and audit events survive the extension.

Migrations 007–008 extend the existing model. They do not delete research records or run collectors. The only seeded content is four generic sets of research questions, not companies or relationships.

## Completed

| Capability | Behaviour |
| --- | --- |
| Asset-to-business navigation | Dedicated asset Anatomy pages inspect separately researched product/organisation associations, evidence and path certainty. CoinGecko matching never creates an operator automatically. |
| Dedicated Business Anatomy | Business/product maps have stable dedicated URLs. Original research and discovery pages remain accessible. Any stored need, resource, capability or actor can become the map centre. |
| Connected Economic Network | One-to-three-hop traversal expands only recorded, filtered connections. Re-centering, backward navigation, zoom, pan, selection and mobile layouts remain supported. Depth is retained in the URL. |
| Relevant, bounded maps | Confirmed and essential/existing connections are prioritised within each hop. The canvas remains bounded and shows truncation notices rather than claiming exhaustive coverage. |
| Economic explanations | Endpoint need/provision, reason, value received by each side, money direction, status, sources and gaps are separately recorded. Evidence-check dates are explicit and are not invented from observation dates. |
| Relationship meanings | Adds Integrates with, Depends on and Earns from. Earlier integration records keep their original meaning; no inferred partnership or payment is inserted. |
| Reusable dependency taxonomy | Editable starter frameworks for lending, games, wallets and data providers organise questions. They impose no universal dependency model and create no graph edges. |
| Manual research | Existing evidence, organisation/product, activity, association, finding and opportunity workflows are preserved. A sixteenth business question captures problems created for other actors. |
| Unresolved research | Unconfirmed/potential graph connections join the existing unresolved identity workflow. |
| Optional intelligence boundary | A provider Protocol, disabled implementation, selected evidence snapshots and structured output validation prepare for a later adapter. There is no model SDK, paid call or web generation endpoint. |
| Human review | Imported proposals remain separate. Review can edit explanation, gaps and finding/value text. Acceptance creates only a hypothesis, with potential graph relationships and unknown payment. Original content, declared origin, confidence, sources and edits remain attributable. |
| Audit retention | Retractions and supersession retain original sources/history. Proposal acceptance is atomic and cannot be used to supersede a verified fact or create a stronger status. |

The graph is based on stored relationships and manually researched information. The clearly labelled client-only illustration remains separate from saved research.

## Incomplete and intentionally deferred

- **Live data population:** this environment still has no successful Binance extraction or CoinGecko enrichment. The prior proxy CONNECT 403 failures remain recorded. No complete real asset universe or verified business coverage is claimed.
- **Real LLM adapter:** the optional boundary is functional and tested with a fake adapter, but no OpenAI/other provider implementation, key, billing configuration or live model validation is supplied. The default remains disabled.
- **Autonomous intelligence:** no automated company matcher, continuous research worker or opportunity recommendation engine runs. Structured imports and reviewed hypotheses are not established commercial opportunities.
- **Source collection:** evidence entry remains manual excerpts/observations. The application does not yet crawl whole official documentation sites or automatically verify source interpretations.
- **Exhaustive taxonomy/network:** starter frameworks are research aids; they do not establish a company’s needs. Bounded graph views are not an exhaustive industry census.
- **Public operation:** the tool remains local, private and single-user. Accounts, SaaS billing, lead-generation workflows and public hosting have not been added.

## External APIs

| Feature | External dependency |
| --- | --- |
| Binance Spot discovery | Official `https://data-api.binance.vision/api/v3/exchangeInfo`; requires permitted network access. |
| CoinGecko identity candidates and metadata | Documented CoinGecko API; provider access tier/key and limits apply. |
| Manual research, Anatomy, Economic Network, frameworks and proposal review | No external API required after local dependencies are installed. |
| Future model-assisted extraction/reasoning | A separately implemented and configured provider adapter, permitted network and appropriate credentials would be required. It is optional and disabled now. |

A failed API request never becomes a fabricated listing, partnership, customer, budget or revenue claim. See [QUALITY_REPORT.md](QUALITY_REPORT.md) for the observed extraction state.

## Validation and operation

Run from the project root:

```bash
npm test
npm run typecheck
npm run build
npm run test:e2e
```

Browser tests create fresh disposable databases and an isolated server. Do not point them at your research directory. [VERIFICATION.md](VERIFICATION.md) records the checks actually completed for the final update.

To try the workflow, create or open a business/product, add source evidence and a few typed dependencies, then follow a need into another map. Expand the Economic Network to inspect the actual stored paths. Refine framework questions and record findings with evidence. Only after this data is useful should a real model adapter propose complementary businesses for human investigation.
