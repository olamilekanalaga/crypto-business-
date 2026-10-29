# Homepage token directory

`/` and `/discover` share the same browser workspace and saved research. The previous walkthrough lives at `/opportunities`; legacy `/?view=...` research routes are preserved.

Headline totals use only the latest retained snapshot, independent of UI filters: distinct base assets across all quotes, distinct base assets with a USDC quote, and active Spot USDC pairs. Inactive listings are included in the first two totals. Missing data displays a dash, never an invented count. Historical unavailable listings remain available in the directory filters.

Cards show the Binance ticker, a saved project name or candidate catalogue name, a local logo where available, and product tags. The Classification button focuses the product filter. Selecting a card opens existing manual research. Multiple categories, evidence, review status, exports and imports remain unchanged.

## Image provenance and limitations

479 PNG logos and their names were imported from `cryptocurrency-icons` version 0.18.1 (https://github.com/atomiclabs/cryptocurrency-icons), distributed under CC0. The full license is retained in `public/token-logos/LICENSE.md`. Images are bundled in `public/token-logos`; the display-only manifest is `lib/token-display.json`. No runtime image API or third-party image request is required. Only visible cards load logos.

This catalogue is incomplete and may contain historical names/branding. Symbol lookup supplies visual candidates only: it does not resolve asset identity, add product categories, verify a business, or merge exchange assets. Saved project names take priority. Unknown names show “Name unresolved”; missing or failed images show ticker initials. These display assets are part of the app, not copied into user backups. Binance exchangeInfo does not supply token names or logos. Reliable comprehensive coverage still requires verified identifier enrichment and research.

## Validation

Seven browser journeys passed: snapshot and note backups, failed-request preservation, classification review and transfer, homepage totals/logo/fallback/mobile layout, and the three preserved opportunity walkthrough journeys. The directory test also passed after moving data tools beneath the cards. Tests use synthetic fixtures, never claimed extraction counts. Production build and TypeScript checks passed.
