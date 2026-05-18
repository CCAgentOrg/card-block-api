"""Unit tests for the bank_service module."""
from datetime import datetime
from app.services import bank_service


class TestGetAllBanks:
    """Tests for get_all_banks()."""

    def test_returns_list(self, app):
        with app.app_context():
            result = bank_service.get_all_banks()
        assert isinstance(result, list)

    def test_returns_all_banks(self, app):
        with app.app_context():
            result = bank_service.get_all_banks()
        # We have 115+ banks in the data
        assert len(result) >= 115

    def test_each_bank_has_required_fields(self, app):
        required = {'id', 'name', 'logo', 'ifsc', 'blockingInstructions', 'sources', 'lastVerified'}
        with app.app_context():
            result = bank_service.get_all_banks()
        for bank in result:
            assert required.issubset(bank.keys()), f"Bank {bank.get('id')} missing fields: {required - bank.keys()}"


class TestGetBankById:
    """Tests for get_bank_by_id()."""

    def test_returns_bank_for_valid_id(self, app):
        with app.app_context():
            result = bank_service.get_bank_by_id('hdfc')
        assert result is not None
        assert result['id'] == 'hdfc'
        assert result['name'] == 'HDFC Bank'

    def test_returns_none_for_missing_id(self, app):
        with app.app_context():
            result = bank_service.get_bank_by_id('nonexistent_bank_xyz')
        assert result is None

    def test_returns_none_for_empty_id(self, app):
        with app.app_context():
            result = bank_service.get_bank_by_id('')
        assert result is None

    def test_bank_detail_has_all_fields(self, app):
        with app.app_context():
            result = bank_service.get_bank_by_id('hdfc')
        assert 'blockingInstructions' in result
        assert 'credit' in result['blockingInstructions']
        assert 'debit' in result['blockingInstructions']
        assert 'tollFree' in result['blockingInstructions']['credit']


class TestSearchBanks:
    """Tests for search_banks()."""

    def test_empty_query_returns_all(self, app):
        with app.app_context():
            all_banks = bank_service.get_all_banks()
            search_result = bank_service.search_banks('')
        assert len(search_result) == len(all_banks)

    def test_search_exact_match(self, app):
        with app.app_context():
            result = bank_service.search_banks('hdfc')
        assert len(result) >= 1
        assert result[0]['id'] == 'hdfc'

    def test_search_by_name(self, app):
        with app.app_context():
            result = bank_service.search_banks('hdfc bank')
        assert len(result) >= 1
        assert any('hdfc' in b['name'].lower() for b in result)

    def test_search_partial_match(self, app):
        with app.app_context():
            result = bank_service.search_banks('sbi')
        assert len(result) >= 1

    def test_search_case_insensitive(self, app):
        with app.app_context():
            result_lower = bank_service.search_banks('HDFC')
            result_upper = bank_service.search_banks('hdfc')
        assert len(result_lower) == len(result_upper)

    def test_search_no_results(self, app):
        with app.app_context():
            result = bank_service.search_banks('zzzz_bank_that_does_not_exist')
        assert len(result) == 0

    def test_search_strips_whitespace(self, app):
        with app.app_context():
            result = bank_service.search_banks('  hdfc  ')
        assert len(result) >= 1


class TestGetStats:
    """Tests for get_stats()."""

    def test_stats_has_total_banks(self, app):
        with app.app_context():
            stats = bank_service.get_stats()
        assert stats['totalBanks'] >= 115

    def test_stats_has_bank_names(self, app):
        with app.app_context():
            stats = bank_service.get_stats()
        assert len(stats['bankNames']) >= 115
        assert 'HDFC Bank' in stats['bankNames']

    def test_stats_has_last_updated(self, app):
        with app.app_context():
            stats = bank_service.get_stats()
        assert 'lastUpdated' in stats
        assert stats['lastUpdated'] is not None

    def test_stats_total_matches_data(self, app):
        with app.app_context():
            all_banks = bank_service.get_all_banks()
            stats = bank_service.get_stats()
        assert stats['totalBanks'] == len(all_banks)
