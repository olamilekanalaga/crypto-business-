# Browser-only Binance discovery

The user requested public data collection and file saving without a hosted backend. `/discover` now implements that workflow using direct browser `fetch`, IndexedDB and JSON downloads. The deployed `/research` route also opens this workspace; the original local SQLite terminal remains available when running locally.

## Included

- Official Binance exchangeInfo endpoint; no credentials or key, no proxy service.
- Atomic validation before replacing the visible dataset; failed fetch/import preserves previous records.
- Exchange-scoped base assets, all observed pairs, latest availability, status and Spot permission.
- Exact original response text and observation/import times, with every snapshot retained.
- Per-asset unverified notes, explicit save, warning before leaving unsaved changes.
- Full-history/notes JSON backup and original-response download; backup merge preserves notes and rejects conflicting snapshot IDs.
- Clear CORS/network/timeout failure message and raw JSON import fallback.
- Dark responsive view with search, filtering and pagination.

## Practical limits

This is browser storage, not server synchronization or a background ingestion service. Refresh requires an open page. Backups move data across devices/origins. A raw file's original extraction time is unknown; backup timestamps are file-supplied, not independently authenticated. All asset identities remain unresolved. Existing CoinGecko matching, business records and SQLite graph workflows were not migrated into this new browser store. Clearing site data can remove saved browser copies.

The development environment still blocks the Binance host, so no successful live extraction is claimed here. Users must test direct access from their own browser. Opening the endpoint as a tab and fetching it cross-origin have different browser rules; import works when the user can obtain a valid response file.

## Verification

Five affected Playwright journeys passed: two new discovery tests plus three existing opportunity tests. Synthetic API responses explicitly exercise multiple listings per base asset, absent listings, IndexedDB reload, note persistence, portable backup import in a separate browser context, a 320px layout, blocked fetches and invalid imports. These fixture counts are not extraction statistics. Production build and TypeScript checks passed. Python collectors and database migrations are unchanged.
