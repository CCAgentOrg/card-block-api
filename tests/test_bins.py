"""Tests for BIN/IIN range lookup endpoints."""
import pytest
from app import create_app


class TestBinLookup:
    def test_unknown_bin_returns_404(self, client):
        """No BIN data exists yet, so all lookups should return 404."""
        r = client.get('/api/v1/bins/999999')
        assert r.status_code == 404

    def test_partial_prefix_too_short(self, client):
        r = client.get('/api/v1/bins/123')
        assert r.status_code == 400

    def test_non_bin_prefix_returns_400(self, client):
        r = client.get('/api/v1/bins/abc')
        assert r.status_code == 400

    def test_lookup_without_data_returns_404(self, client):
        """With no BIN data in banks.json, any valid lookup returns 404."""
        r = client.get('/api/v1/bins/403965')
        assert r.status_code == 404

    def test_list_returns_empty(self, client):
        """With no BIN data, the list endpoint should return 0 banks."""
        r = client.get('/api/v1/bins/list')
        assert r.status_code == 200
        data = r.get_json()
        assert data['total'] == 0
        assert len(data['banks']) == 0

    def test_list_content_type(self, client):
        r = client.get('/api/v1/bins/list')
        assert 'application/json' in r.content_type
