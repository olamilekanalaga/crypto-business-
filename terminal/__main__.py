import argparse
import json
import logging
import sys
from .db import connect
from .ingest import ingest, export
from .enrich import CoinGecko
from .report import write_report

def main():
    parser = argparse.ArgumentParser(description='Cřyptô Business — local research data tools')
    parser.add_argument('command',choices=['init','ingest','candidates','enrich','report','export','rpc'])
    parser.add_argument('--limit',type=int,default=20)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO,format='%(asctime)s %(levelname)s %(message)s',stream=sys.stderr)
    db = connect()
    if args.command == 'rpc':
        from .service import dispatch
        try:
            request = json.load(sys.stdin)
            print(json.dumps({'data':dispatch(db,request)}))
        except (ValueError,KeyError,TypeError) as exc:
            print(json.dumps({'error':str(exc)}))
        finally:
            db.close()
        return
    try:
        if args.command == 'ingest': result = {'run_id':ingest(db)}
        elif args.command == 'candidates': result = {'indexed_identities':CoinGecko(db).discover()}
        elif args.command == 'enrich':
            if not 1 <= args.limit <= 500: raise ValueError('--limit must be 1..500')
            result = CoinGecko(db).enrich(args.limit)
        elif args.command == 'export': export(db); result = {'exported':True}
        else: result = {'initialized':True}
        if args.command == 'report': result = write_report(db)
        print(json.dumps(result,indent=2))
        if isinstance(result,dict) and result.get('failures'): return 1
    except Exception as exc:
        logging.error('%s',exc)
        return 1
    finally:
        write_report(db)
        db.close()

if __name__ == '__main__':
    sys.exit(main())
