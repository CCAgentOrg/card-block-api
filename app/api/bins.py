"""BIN/IIN lookup API endpoints."""
from http import HTTPStatus
from flask_restx import Resource, Namespace, fields, abort as restx_abort
from flask import current_app

bins_ns = Namespace('bins', description='BIN/IIN range lookup operations')

matched_range_model = bins_ns.model('BinRange', {
    'start': fields.String(description='Starting 6-digit BIN prefix'),
    'end': fields.String(description='Ending 6-digit BIN prefix', required=False),
    'cardType': fields.String(description='Card network type', required=False),
})

bank_info_model = bins_ns.model('BankInfo', {
    'id': fields.String(),
    'name': fields.String(),
    'logo': fields.String(),
})

blocking_model = bins_ns.model('BlockingInfo', {
    'tollFree': fields.String(),
    'number1': fields.String(required=False),
    'number2': fields.String(required=False),
    'rmn': fields.String(required=False),
    'email': fields.String(required=False),
    'notes': fields.String(required=False),
    'androidApp': fields.String(required=False),
    'iosApp': fields.String(required=False),
})

bin_lookup_result = bins_ns.model('BinLookupResult', {
    'bin': fields.String(description='Resolved 6-digit BIN'),
    'bank': fields.Nested(bank_info_model),
    'matchedRange': fields.Nested(matched_range_model),
    'blockingInstructions': fields.Raw(description='Blocking contact info by card type'),
})

bin_result = bins_ns.model('BinBankEntry', {
    'id': fields.String(),
    'name': fields.String(),
    'logo': fields.String(),
    'binRanges': fields.List(fields.Nested(matched_range_model)),
})

bin_list_result = bins_ns.model('BinListResult', {
    'total': fields.Integer(),
    'banks': fields.List(fields.Nested(bin_result)),
})

error_model = bins_ns.model('Error', {
    'error': fields.String(),
    'help': fields.String(required=False),
    'bin': fields.String(required=False),
})


def _resolve_bin_range(bins: list, lookup_prefix: str) -> dict | None:
    """Check if a 6-digit BIN prefix falls within any known range."""
    if len(lookup_prefix) < 6:
        lookup_prefix = lookup_prefix.ljust(6, '0')
    for b in bins:
        start = b.get('start', '')
        end = b.get('end', start)
        if start <= lookup_prefix <= end:
            return b
    return None


@bins_ns.route('/')
@bins_ns.route('/<string:prefix>')
class BinResource(Resource):
    @bins_ns.doc(
        params={'prefix': 'First 4-6 digits of a card number'},
        responses={
            200: ('Bank found', bin_lookup_result),
            400: ('Invalid prefix', error_model),
            404: ('No bank found', error_model),
        }
    )
    def get(self, prefix=None):
        """Look up a bank by the first digits of a card number."""
        if not prefix or len(prefix) < 4:
            return {'error': 'BIN prefix must be at least 4 digits'}, 400

        prefix_clean = ''.join(c for c in prefix if c.isdigit())
        banks_store = current_app.config['BANK_DATA']

        for bank_id, bank_data in banks_store.items():
            bin_ranges = bank_data.get('binRanges') or []
            if not bin_ranges:
                continue
            matched = _resolve_bin_range(bin_ranges, prefix_clean)
            if matched:
                result = {
                    'bin': prefix_clean[:6].ljust(6, '0'),
                    'bank': {
                        'id': bank_id,
                        'name': bank_data['name'],
                        'logo': bank_data['logo'],
                    },
                    'matchedRange': matched,
                    'blockingInstructions': {
                        ct: {k: v for k, v in instr.items()}
                        for ct, instr in bank_data.get('blockingInstructions', {}).items()
                    }
                }
                return result, 200

        from flask import jsonify
        resp = jsonify({'error': f'No bank found for BIN prefix {prefix_clean[:6]}'})
        resp.status_code = 404
        return resp


@bins_ns.route('/list')
class BinListResource(Resource):
    @bins_ns.marshal_with(bin_list_result)
    @bins_ns.doc(responses={200: ('All banks with BIN ranges', bin_list_result)})
    def get(self):
        """Return all banks with their BIN ranges."""
        banks_store = current_app.config['BANK_DATA']
        result = []
        for bank_id, bank_data in banks_store.items():
            bin_ranges = bank_data.get('binRanges', [])
            if bin_ranges:
                result.append({
                    'id': bank_id,
                    'name': bank_data['name'],
                    'logo': bank_data['logo'],
                    'binRanges': bin_ranges,
                })
        return {'total': len(result), 'banks': result}
