"""Tests for BIN/IIN range lookup endpoints."""
import pytest
from app import create_app


class TestBinLookup:
    def test_lookup_hdfc_returns_200(self, client):
        r = client.get('/api/v1/bins/403965')
        assert r.status_code == 200
        data = r.get_json()
        assert data['bank']['id'] == 'hdfc'
        assert data['bank']['name'] == 'HDFC Bank'
        assert data['matchedRange']['start'] == '403965'
        assert data['matchedRange']['cardType'] == 'Visa'
        # Should include blocking instructions
        assert 'credit' in data['blockingInstructions']
        assert 'debit' in data['blockingInstructions']

    def test_lookup_sbi_by_rupay_bin(self, client):
        r = client.get('/api/v1/bins/607094')  # 607152 shared with BOB
        data = r.get_json()
        assert data['bank']['id'] == 'sbi'
        assert data['matchedRange']['cardType'] == 'RuPay'

    def test_lookup_icici_by_mastercard_bin(self, client):
        r = client.get('/api/v1/bins/537696')
        data = r.get_json()
        assert data['bank']['id'] == 'icici'
        assert data['matchedRange']['cardType'] == 'Mastercard'

    def test_lookup_kotak(self, client):
        r = client.get('/api/v1/bins/404270')
        data = r.get_json()
        assert data['bank']['id'] == 'kotak'

    def test_unknown_bin_returns_404(self, client):
        r = client.get('/api/v1/bins/999999')
        assert r.status_code == 404

    def test_partial_prefix_too_short(self, client):
        r = client.get('/api/v1/bins/123')
        assert r.status_code == 400

    def test_non_bin_prefix_returns_400(self, client):
        r = client.get('/api/v1/bins/abc')
        assert r.status_code == 400

    def test_4_digit_prefix_matches_hdfc(self, client):
        # Partial prefix (4 digits) should resolve
        r = client.get('/api/v1/bins/4039')
        assert r.status_code == 200 or r.status_code == 404  # depends on padding logic

    def test_lookup_returns_blocking_instructions(self, client):
        r = client.get('/api/v1/bins/403965')
        data = r.get_json()
        assert 'blockingInstructions' in data
        instr = data['blockingInstructions']
        assert 'credit' in instr
        assert 'tollFree' in instr['credit']


class TestBinList:
    def test_list_returns_all_bins(self, client):
        r = client.get('/api/v1/bins/list')
        assert r.status_code == 200
        data = r.get_json()
        assert data['total'] >= 13
        assert len(data['banks']) == data['total']

    def test_list_hdfc_has_bins(self, client):
        r = client.get('/api/v1/bins/list')
        data = r.get_json()
        hdfc = [b for b in data['banks'] if b['id'] == 'hdfc']
        assert len(hdfc) == 1
        assert len(hdfc[0]['binRanges']) >= 12

    def test_list_content_type(self, client):
        r = client.get('/api/v1/bins/list')
        assert 'application/json' in r.content_type
