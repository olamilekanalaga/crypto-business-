# Binance USDC directory handoff

The homepage and `/discover` now show only current Binance USDC, TRADING, Spot-enabled assets with verified identities. Unknown identities remain in the review queue; no ticker-only CoinGecko matching or invented market caps is used. Rows show logo, name, ticker and USD market cap. Search, categories and market-cap sorting use stored metadata.

## First use

1. Open the homepage and refresh Binance. Existing browser snapshots are adopted without deleting the original workspace.
2. Expand identity review. Scan CoinGecko Binance tickers one page at a time until the scan completes. Only unique, non-stale, non-anomalous USDC exchange cross-references are accepted. Ambiguous assets remain unresolved. Manual identification requires a source and explanation.
3. Refresh market caps separately. Each request updates up to 50 verified IDs, prioritising older observations; fresh records are cached for one hour. Missing caps remain `—`. Open a token and refresh its project profile for categories and documentation links (seven-day cache).
4. Open a token to save economic research, corrections and notes, then explore its network. Existing research is retained, but candidate nodes must belong to the verified active USDC registry. A token identity does not establish a legal operating organisation.

Browser collection uses public Binance and CoinGecko APIs. Availability depends on geographic access, CORS and provider limits. CoinGecko may require a Demo key; authenticated requests use the optional server proxy, never a public frontend key. API errors are visible and do not erase valid observations.

## Persistence and refresh

Browser data lives in IndexedDB on this device. Download both the directory backup and network backup to retain listing history and research. The previous browser directory and its backup remain at `/discovery-history`. Conflicting backup records are rejected for manual reconciliation rather than silently overwritten.

Every successful Binance refresh retains the compressed original response, checksum, timestamp and listing observations. Permanent listing IDs, first/last seen times, identities and research links survive refreshes. Missing assets become absent, not delisted. Suspended and non-Spot USDC markets are excluded from the active directory. Invalid/empty responses cannot mark the whole universe absent. The first snapshot does not reconstruct earlier listing history.

While the page is open, stale Binance data refreshes daily. For unattended shared refresh on Vercel:

- Provision persistent Postgres and run `postgres/001_network.sql` and `postgres/002_usdc.sql`.
- Set `DATABASE_URL`, `BDO_OWNER_TOKEN` (random, at least 32 characters), and `CRON_SECRET` (random, at least 32 characters).
- The scheduled `/api/usdc/daily` job runs at 06:00 UTC. It refuses requests without its secret and skips recent successful refreshes.
- Enter the owner token in the private server connection field. It stays in tab memory. Reloading requires reconnecting.
- Optionally set `COINGECKO_DEMO_API_KEY` for server metadata requests.

No hosted database or paid service is provisioned by this update. Without these environment variables, browser operation remains available but unattended refresh and cross-device storage are not active. SQLite remains available locally with additive migration 010; it is not persistent Vercel storage.

Directory server transfers currently have a 4 MB limit; browser imports have a 25 MB limit. Compressed snapshots reduce size but long-lived histories will eventually need server-side pagination/archival. Limits fail explicitly; history is never silently pruned.

## Optional intelligence

Set `BDO_AI_ENABLED=1`, `OPENAI_API_KEY`, and `OPENAI_MODEL` on the server to enable on-demand analysis. Opening a token never spends an AI call. Completed results are cached against model, business evidence and the bounded candidate set. Calls retain the existing ten-attempt daily budget. Candidate selection is restricted server-side to active verified USDC businesses; up to 20 are considered per analysis. Outputs remain hypotheses and require review. Human corrections and prior versions are retained separately.

Research with no evidence remains unknown. Existing sourced relationships appear only when both endpoints belong to the current registry. No example relationship is silently promoted to a verified live connection.

## Validation and references

`npm test`, `npm run test:e2e`, `npm run typecheck`, and `npm run build` cover local collectors, legacy workflows and the new registry/directory/network boundaries. Browser tests use explicitly synthetic fixtures, not extraction counts.

- Binance: https://data-api.binance.vision/api/v3/exchangeInfo
- CoinGecko exchange tickers: https://docs.coingecko.com/reference/exchanges-id-tickers
- CoinGecko markets: https://docs.coingecko.com/reference/coins-markets
