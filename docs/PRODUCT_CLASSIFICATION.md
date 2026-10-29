# USDC scope and product classification

The browser discovery workspace defaults to quoteAsset = USDC. This is a view filter, not destructive ingestion. All original exchangeInfo JSON and observed pairs are retained. Search, quote and availability operate on the same subset of pairs before category and review filters are applied. The asset inspector displays the selected quote/availability scope and identifies the total retained pair count separately. Dashboard counters describe current matching pairs; historical unavailable listings remain inspectable.

## Classification meaning

Tags describe what a candidate project or product provides; they do not identify an asset as a yield-bearing receipt, verify its issuing organisation, or claim that token holders receive revenue. An asset may have multiple categories. Categories without supporting research remain unclassified.

The 20-category taxonomy is defined in `lib/product-classification.ts`. Each saved record has a product/project name, categories, explanation, web source, review status and recorded timestamp. “Reviewed by me” records a human assessment and requires populated categories, name, explanation and source. It does not change the unresolved asset identity or the SQLite graph.

## Starter source catalogue

First-party project pages inspected on 2026-10-29 provide eleven **needs-review ticker candidates**. Their product descriptions are source-based interpretations, while the association with a Binance ticker still requires review. Unknown tickers are not guessed. Source pages and concise interpretations are retained in the catalogue:

| Candidate | Source | Product interpretation |
| --- | --- | --- |
| BTC / Bitcoin | https://bitcoin.org/en/ | Payment network |
| ETH / Ethereum | https://ethereum.org/staking/ | Blockchain and staking |
| SOL / Solana | https://solana.com/ | Application and payments blockchain |
| LINK / Chainlink | https://chain.link/ | Oracle and interoperability infrastructure |
| AAVE / Aave | https://aave.com/ | Lending and borrowing products |
| LDO / Lido | https://lido.fi/ | Liquid staking products; LDO differs from stETH |
| ONDO / Ondo Finance | https://ondo.finance/ | Tokenized asset platforms; ONDO is not a Treasury receipt |
| DOGE / Dogecoin | https://dogecoin.com/ | Meme-origin payment currency |
| IMX / Immutable | https://www.immutable.com/ | Gaming platform and tools |
| ENJ / Enjin | https://enjin.io/ | NFT and gaming tools |
| PENDLE / Pendle | https://www.pendle.finance/ | Yield trading products |

No external API or model is called for these suggestions. No rates, TVL or extraction counts are generated. Save a classification to include it in portable research backups; unsaved bundled suggestions remain separately maintained application data.

## Compatibility

The existing IndexedDB store and `bd-oracle-browser-v1` backup format gain an optional classifications map. Missing fields normalize to an empty map. Snapshot/notes merging is preserved; differing saved classifications for the same asset reject the entire merge with an explicit conflict message, retaining the old workspace. Classification validation rejects malformed categories, unsafe source schemes and incomplete reviewed records.

The original Python collectors, SQLite schema, existing snapshots and research graph are unchanged.

## Validation

The existing two browser discovery journeys passed with their original all-quote scope selected explicitly. A new classification journey passed for intersecting quote/status filters, multiple tags, required evidence for review, persistence across a refresh and reload, old-backup compatibility, export/import into a separate browser, conflicting-backup rejection and a 320px layout. TypeScript and the production build passed. Browser tests use synthetic fixtures; fixture counts are never extraction statistics.
