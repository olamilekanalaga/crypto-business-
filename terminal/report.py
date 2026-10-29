import json
from .db import now, rows, data_dir

def quality(db):
    scalar = lambda sql: db.execute(sql).fetchone()[0]
    last = db.execute("SELECT * FROM runs WHERE connector='binance' AND status='success' ORDER BY id DESC LIMIT 1").fetchone()
    current = db.execute("SELECT * FROM runs WHERE connector='binance' ORDER BY id DESC LIMIT 1").fetchone()
    return {
        'generated_at':now(),
        'extraction_status':'available' if last else 'no_successful_extraction',
        'total_trading_pairs_retrieved':last['pair_count'] if last else None,
        'unique_base_assets':last['unique_assets'] if last else None,
        'historical_assets':scalar('SELECT COUNT(*) FROM assets'),
        'matched_coingecko_assets':scalar("SELECT COUNT(*) FROM assets WHERE match_status='verified'"),
        'enriched_assets':scalar('SELECT COUNT(*) FROM assets a JOIN identities i ON a.identity_id=i.id WHERE i.enriched_at IS NOT NULL'),
        'unresolved_assets':scalar("SELECT COUNT(*) FROM assets WHERE match_status='unresolved'"),
        'ambiguous_identifiers':scalar("SELECT COUNT(*) FROM assets WHERE json_array_length(candidates_json)>1"),
        'candidate_only_assets':scalar("SELECT COUNT(*) FROM assets WHERE match_status='unresolved' AND json_array_length(candidates_json)>0"),
        'duplicate_symbols':last['duplicate_symbols'] if last else None,
        'duplicate_coingecko_tickers':rows(db,"SELECT lower(ticker) AS ticker,COUNT(*) AS identities FROM identities GROUP BY lower(ticker) HAVING COUNT(*)>1 ORDER BY identities DESC,ticker"),
        'shared_verified_identities':rows(db,"SELECT identity_id,COUNT(*) AS exchange_assets FROM assets WHERE match_status='verified' GROUP BY identity_id HAVING COUNT(*)>1"),
        'active_pairs':scalar("SELECT COUNT(*) FROM listings WHERE available=1 AND status='TRADING' AND spot_allowed=1"),
        'inactive_pairs':scalar("SELECT COUNT(*) FROM listings WHERE available=1 AND (status!='TRADING' OR spot_allowed=0)"),
        'unavailable_pairs':scalar('SELECT COUNT(*) FROM listings WHERE available=0'),
        'failed_api_requests':scalar('SELECT COUNT(*) FROM requests WHERE error IS NOT NULL'),
        'last_successful_refresh':last['completed_at'] if last else None,
        'latest_attempt':dict(current) if current else None,
        'recent_failures':rows(db,'SELECT url,observed_at,status,error FROM requests WHERE error IS NOT NULL ORDER BY id DESC LIMIT 10'),
        'definitions':{'asset':'An exchange-scoped base-asset observation, not an independently verified business.', 'active_pair':'Present in latest successful snapshot, status TRADING, Spot allowed.', 'unavailable':'Previously observed pair absent from latest successful snapshot.', 'matched':'Researcher approved CoinGecko identity with evidence. Ticker-only candidates remain unresolved.', 'counts':'Extraction counts are null until a successful snapshot; database record counts can be zero.'}
    }

def write_report(db):
    report = quality(db)
    (data_dir()/'quality-report.json').write_text(json.dumps(report,indent=2))
    text = ['# Data quality report', '', 'Generated: '+report['generated_at'], '']
    for key,value in report.items():
        if key not in ('definitions','recent_failures','latest_attempt','duplicate_coingecko_tickers','shared_verified_identities'):
            text.append(f'- {key}: {"Not available" if value is None else value}')
    text += ['', '## Latest extraction attempt', '```json',json.dumps(report['latest_attempt'],indent=2),'```', '', '## Failed requests', '```json',json.dumps(report['recent_failures'],indent=2),'```', '', '## Definitions', *[f'- {k}: {v}' for k,v in report['definitions'].items()]]
    (data_dir()/'QUALITY_REPORT.md').write_text('\n'.join(text)+'\n')
    return report
