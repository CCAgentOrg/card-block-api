from flask_restx import Namespace, Resource, fields
from flask import request, current_app
from ..models.bank import BankSummaryModel, BankModel, SourceModel
from ..services import bank_service
from pydantic import ValidationError

api = Namespace('banks', description='Bank information and card blocking instructions')

blocking_instruction_api_model = api.model('BlockingInstruction', {
    'tollFree': fields.String(required=True, description='Primary toll-free number for blocking'),
    'number1': fields.String(description='Alternative contact number 1'),
    'number2': fields.String(description='Alternative contact number 2'),
    'rmn': fields.String(description='SMS command format (from registered mobile)'),
    'email': fields.String(description='Email for blocking requests'),
    'website': fields.String(description='Website/portal for card management'),
    'reference': fields.String(description='Official reference link'),
    'androidApp': fields.String(description='Google Play Store URL for the bank\'s mobile app'),
    'iosApp': fields.String(description='Apple App Store URL for the bank\'s mobile app'),
    'notes': fields.String(description='Additional instructions or notes')
})

source_api_model = api.model('Source', {
    'label': fields.String(description='Source name/description'),
    'url': fields.String(description='Source URL')
})

bank_summary_api_model = api.model('BankSummary', {
    'id': fields.String(required=True, description='Unique identifier'),
    'name': fields.String(description='Bank name'),
    'logo': fields.String(description='Logo URL'),
    'cardTypes': fields.List(fields.String, description='Available card types')
})

bank_api_model = api.model('Bank', {
    'id': fields.String(required=True, description='Unique identifier'),
    'name': fields.String(description='Bank name'),
    'logo': fields.String(description='Logo URL'),
    'ifsc': fields.String(description='Primary IFSC prefix'),
    'blockingInstructions': fields.Raw(description='Blocking instructions keyed by card type'),
    'sources': fields.List(fields.Nested(source_api_model)),
    'lastVerified': fields.String(description='Last verification date (ISO format)')
})

stats_api_model = api.model('Stats', {
    'totalBanks': fields.Integer(description='Total number of banks'),
    'bankNames': fields.List(fields.String(description='Bank name')),
    'lastUpdated': fields.String(description='Last update timestamp')
})

@api.route('/')
class BankList(Resource):
    @api.doc('list_banks')
    @api.marshal_list_with(bank_summary_api_model)
    def get(self):
        """List all banks (summary view)"""
        banks_data = bank_service.get_all_banks()
        try:
            return [BankSummaryModel(**bank).model_dump() for bank in banks_data]
        except ValidationError as e:
            api.abort(500, f"Data validation error: {e}")

@api.route('/<string:bankId>')
@api.param('bankId', 'The unique bank identifier')
@api.response(404, 'Bank not found')
class BankDetail(Resource):
    @api.doc('get_bank_details', model=bank_api_model)
    def get(self, bankId):
        """Get full details for a specific bank including blocking instructions"""
        bank_details_data = bank_service.get_bank_by_id(bankId)
        if bank_details_data is None:
            api.abort(404, f"Bank '{bankId}' not found.")
        try:
            validated = BankModel(**bank_details_data).model_dump(exclude_none=True)
            return validated
        except ValidationError as e:
            current_app.logger.error(f"Validation failed for {bankId}: {e}")
            api.abort(500, f"Data validation error for '{bankId}'.")

@api.route('/search')
@api.param('q', 'Search query for bank name or ID')
class BankSearch(Resource):
    @api.doc('search_banks')
    @api.marshal_list_with(bank_summary_api_model)
    def get(self):
        """Search banks by name or ID. Returns all banks if no query provided."""
        query = request.args.get('q', '').strip().lower()
        if not query:
            return bank_service.get_all_banks()
        results = bank_service.search_banks(query)
        try:
            return [BankSummaryModel(**b).model_dump() for b in results]
        except ValidationError as e:
            api.abort(500, f"Search validation error: {e}")

@api.route('/stats')
class BankStats(Resource):
    @api.doc('get_stats', model=stats_api_model)
    def get(self):
        """Get API statistics and metadata"""
        stats = bank_service.get_stats()
        return stats
