# Data quality report

Generated: 2026-10-29T02:51:24.190973+00:00

- generated_at: 2026-10-29T02:51:24.190973+00:00
- extraction_status: no_successful_extraction
- total_trading_pairs_retrieved: Not available
- unique_base_assets: Not available
- historical_assets: 0
- matched_coingecko_assets: 0
- enriched_assets: 0
- unresolved_assets: 0
- ambiguous_identifiers: 0
- candidate_only_assets: 0
- duplicate_symbols: Not available
- active_pairs: 0
- inactive_pairs: 0
- unavailable_pairs: 0
- failed_api_requests: 6
- last_successful_refresh: Not available

## Latest extraction attempt
```json
{
  "id": 1,
  "connector": "binance",
  "started_at": "2026-10-29T02:38:09.757922+00:00",
  "completed_at": "2026-10-29T02:38:15.803377+00:00",
  "status": "failed",
  "pair_count": null,
  "unique_assets": null,
  "duplicate_symbols": null,
  "raw_path": "/workspace/crypto-business/data/raw/1793241495801820524-e3b0c44298fc.json",
  "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "error": "https://data-api.binance.vision/api/v3/exchangeInfo: <urlopen error Tunnel connection failed: 403 Forbidden>"
}
```

## Failed requests
```json
[
  {
    "url": "https://api.coingecko.com/api/v3/coins/list?include_platform=true",
    "observed_at": "2026-10-29T02:38:29.940263+00:00",
    "status": null,
    "error": "<urlopen error Tunnel connection failed: 403 Forbidden>"
  },
  {
    "url": "https://api.coingecko.com/api/v3/coins/list?include_platform=true",
    "observed_at": "2026-10-29T02:38:22.938511+00:00",
    "status": null,
    "error": "<urlopen error Tunnel connection failed: 403 Forbidden>"
  },
  {
    "url": "https://api.coingecko.com/api/v3/coins/list?include_platform=true",
    "observed_at": "2026-10-29T02:38:15.953832+00:00",
    "status": null,
    "error": "<urlopen error Tunnel connection failed: 403 Forbidden>"
  },
  {
    "url": "https://data-api.binance.vision/api/v3/exchangeInfo",
    "observed_at": "2026-10-29T02:38:15.801920+00:00",
    "status": null,
    "error": "<urlopen error Tunnel connection failed: 403 Forbidden>"
  },
  {
    "url": "https://data-api.binance.vision/api/v3/exchangeInfo",
    "observed_at": "2026-10-29T02:38:11.791833+00:00",
    "status": null,
    "error": "<urlopen error Tunnel connection failed: 403 Forbidden>"
  },
  {
    "url": "https://data-api.binance.vision/api/v3/exchangeInfo",
    "observed_at": "2026-10-29T02:38:09.783795+00:00",
    "status": null,
    "error": "<urlopen error Tunnel connection failed: 403 Forbidden>"
  }
]
```

## Definitions
- asset: An exchange-scoped base-asset observation, not an independently verified business.
- active_pair: Present in latest successful snapshot, status TRADING, Spot allowed.
- unavailable: Previously observed pair absent from latest successful snapshot.
- matched: Researcher approved CoinGecko identity with evidence. Ticker-only candidates remain unresolved.
- counts: Extraction counts are null until a successful snapshot; database record counts can be zero.
