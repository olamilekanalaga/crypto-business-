class BinanceSpot:
    name = 'binance'
    url = 'https://data-api.binance.vision/api/v3/exchangeInfo'

    def normalize(self, payload):
        if not isinstance(payload, dict) or not isinstance(payload.get('symbols'), list) or not payload['symbols']:
            raise ValueError('Binance response must contain a non-empty symbols list; refusing destructive refresh')
        result = []
        for item in payload['symbols']:
            for field in ('symbol','baseAsset','quoteAsset','status'):
                if not isinstance(item.get(field), str) or not item[field]:
                    raise ValueError(f'Malformed Binance symbol: missing {field}')
            allowed = item.get('isSpotTradingAllowed')
            permissions = item.get('permissions', [])
            permission_sets = item.get('permissionSets', [])
            if allowed is None:
                allowed = 'SPOT' in permissions or any('SPOT' in group for group in permission_sets)
            if not isinstance(allowed, bool):
                raise ValueError('Invalid spot permission')
            # Retain inactive symbols in this Spot endpoint too; status and permissions are independent.
            result.append(dict(symbol=item['symbol'], base=item['baseAsset'], quote=item['quoteAsset'], status=item['status'], spot=int(allowed)))
        return result
