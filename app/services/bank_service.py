from flask import current_app
from datetime import datetime

def get_all_banks():
    """Return all banks."""
    banks = current_app.config.get('BANK_DATA', {})
    return list(banks.values())

def get_bank_by_id(bank_id):
    """Return full details for a specific bank."""
    banks = current_app.config.get('BANK_DATA', {})
    return banks.get(bank_id)

def search_banks(query):
    """Search banks by name or ID."""
    query = query.lower().strip()
    banks = current_app.config.get('BANK_DATA', {})
    if not query:
        return list(banks.values())
    return [
        bank for bank in banks.values()
        if query in bank.get('id', '').lower() or query in bank.get('name', '').lower()
    ]

def get_stats():
    """Get API statistics."""
    banks = current_app.config.get('BANK_DATA', {})
    bank_names = [bank.get('name', '') for bank in banks.values()]
    last_verified = None
    for bank in banks.values():
        if bank.get('lastVerified'):
            if last_verified is None or bank['lastVerified'] > last_verified:
                last_verified = bank['lastVerified']
    return {
        'totalBanks': len(banks),
        'bankNames': bank_names,
        'lastUpdated': last_verified or datetime.now().isoformat()
    }
