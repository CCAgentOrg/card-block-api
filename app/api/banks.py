from flask_restx import Namespace, Resource, fields
from flask import request, current_app, make_response, send_file
from ..models.bank import BankSummaryModel, BankModel, SourceModel
from ..services import bank_service
from pydantic import ValidationError
import json
import io
import csv

api = Namespace('banks', description='Bank information and card blocking instructions')
export_api = Namespace('export', description='Data export endpoints in JSON, CSV, and JSON Schema formats')

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


@export_api.route('/json')
class ExportJSON(Resource):
    @export_api.doc('export_json')
    def get(self):
        """Export all bank data as a complete JSON file"""
        banks_data = current_app.config.get('BANK_DATA', {})
        response = make_response(json.dumps(banks_data, indent=2, ensure_ascii=False))
        response.headers['Content-Type'] = 'application/json'
        response.headers['Content-Disposition'] = 'attachment; filename=banks.json'
        return response


@export_api.route('/csv')
class ExportCSV(Resource):
    @export_api.doc('export_csv')
    def get(self):
        """Export all bank data as a flattened CSV (one row per bank × card type)"""
        banks_data = current_app.config.get('BANK_DATA', {})
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            'bank_id', 'bank_name', 'ifsc', 'logo', 'card_type',
            'tollFree', 'number1', 'number2', 'rmn', 'email',
            'website', 'reference', 'androidApp', 'iosApp', 'notes',
            'lastVerified'
        ])
        for bank in banks_data.values():
            for card_type, inst in bank.get('blockingInstructions', {}).items():
                writer.writerow([
                    bank.get('id', ''),
                    bank.get('name', ''),
                    bank.get('ifsc', ''),
                    bank.get('logo', ''),
                    card_type,
                    inst.get('tollFree', ''),
                    inst.get('number1', ''),
                    inst.get('number2', ''),
                    inst.get('rmn', ''),
                    inst.get('email', ''),
                    inst.get('website', ''),
                    inst.get('reference', ''),
                    inst.get('androidApp', ''),
                    inst.get('iosApp', ''),
                    inst.get('notes', ''),
                    bank.get('lastVerified', ''),
                ])
        response = make_response(output.getvalue())
        response.headers['Content-Type'] = 'text/csv'
        response.headers['Content-Disposition'] = 'attachment; filename=banks.csv'
        return response


SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "Card Block API Bank Data",
    "description": "Schema for Indian bank card blocking information. Each bank entry contains blocking instructions for credit and debit cards.",
    "type": "object",
    "patternProperties": {
        "^[a-z0-9_-]+$": {
            "$ref": "#/$defs/BankEntry"
        }
    },
    "$defs": {
        "BankEntry": {
            "type": "object",
            "required": ["id", "name", "logo", "ifsc", "blockingInstructions", "sources", "lastVerified"],
            "properties": {
                "id": {
                    "type": "string",
                    "pattern": "^[a-z0-9_-]+$",
                    "description": "Unique lowercase snake_case identifier for the bank",
                },
                "name": {
                    "type": "string",
                    "description": "Full bank name as displayed to users",
                },
                "logo": {
                    "type": "string",
                    "description": "Path to bank logo SVG (relative to static root) or external URL",
                },
                "ifsc": {
                    "type": "string",
                    "description": "IFSC code prefix for the bank (e.g., HDFC0000001)",
                    "pattern": "^[A-Z]{4}0[A-Z0-9]{6}$",
                },
                "blockingInstructions": {
                    "type": "object",
                    "description": "Card blocking instructions keyed by card type",
                    "additionalProperties": {"$ref": "#/$defs/BlockingInstruction"},
                },
                "sources": {
                    "type": "array",
                    "minItems": 1,
                    "description": "Verification sources with labels and URLs",
                    "items": {"$ref": "#/$defs/Source"},
                },
                "lastVerified": {
                    "type": "string",
                    "format": "date",
                    "description": "Date of last verification (ISO 8601 format, YYYY-MM-DD)",
                },
            },
        },
        "BlockingInstruction": {
            "type": "object",
            "required": ["tollFree"],
            "properties": {
                "tollFree": {
                    "type": "string",
                    "description": "Primary toll-free customer care number for card blocking",
                },
                "number1": {
                    "type": "string",
                    "description": "Alternative contact number 1",
                },
                "number2": {
                    "type": "string",
                    "description": "Alternative contact number 2",
                },
                "rmn": {
                    "type": "string",
                    "description": "SMS command format for blocking from registered mobile number",
                },
                "email": {
                    "type": "string",
                    "format": "email",
                    "description": "Email address for blocking requests",
                },
                "website": {
                    "type": "string",
                    "format": "uri",
                    "description": "Official bank website or card management portal URL",
                },
                "reference": {
                    "type": "string",
                    "format": "uri",
                    "description": "Official reference link for blocking instructions",
                },
                "androidApp": {
                    "type": "string",
                    "format": "uri",
                    "description": "Google Play Store URL for the bank's mobile app",
                },
                "iosApp": {
                    "type": "string",
                    "format": "uri",
                    "description": "Apple App Store URL for the bank's mobile app",
                },
                "notes": {
                    "type": "string",
                    "description": "Additional instructions, notes, or guidance for card blocking",
                },
            },
        },
        "Source": {
            "type": "object",
            "required": ["label", "url"],
            "properties": {
                "label": {
                    "type": "string",
                    "description": "Display label for the verification source",
                },
                "url": {
                    "type": "string",
                    "format": "uri",
                    "description": "URL of the verification source",
                },
            },
        },
    },
}


@export_api.route('/schema')
class ExportSchema(Resource):
    @export_api.doc('export_schema')
    def get(self):
        """Export JSON Schema definition for the bank data format"""
        response = make_response(json.dumps(SCHEMA, indent=2, ensure_ascii=False))
        response.headers['Content-Type'] = 'application/json'
        response.headers['Content-Disposition'] = 'attachment; filename=schema.json'
        return response
