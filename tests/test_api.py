import pytest
from app import create_app, Config

@pytest.fixture
def client():
    app = create_app(Config)
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_list_banks(client):
    resp = client.get("/api/v1/banks/")
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)
    assert len(data) >= 10, "Should have at least 10 banks"
    # Check basic structure
    for bank in data:
        assert "id" in bank
        assert "name" in bank
        assert "logo" in bank

def test_bank_detail(client):
    """Test getting a specific bank's full details."""
    resp = client.get("/api/v1/banks/hdfc")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["id"] == "hdfc"
    assert "blockingInstructions" in data
    assert "credit" in data["blockingInstructions"]
    assert "debit" in data["blockingInstructions"]
    assert "sources" in data
    assert len(data["sources"]) >= 1

def test_bank_not_found(client):
    resp = client.get("/api/v1/banks/nonexistent_bank_xyz")
    assert resp.status_code == 404

def test_search_endpoint(client):
    """Test search returns matching banks."""
    resp = client.get("/api/v1/banks/search?q=hdfc")
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert any(b["id"] == "hdfc" for b in data)

def test_search_no_query_returns_all(client):
    """Test search with no query returns all banks."""
    resp = client.get("/api/v1/banks/search")
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data) >= 10

def test_stats_endpoint(client):
    resp = client.get("/api/v1/banks/stats")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "totalBanks" in data
    assert data["totalBanks"] >= 10
    assert "bankNames" in data
    assert len(data["bankNames"]) >= 10

def test_ui_served_at_root(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert b"Card Block" in resp.data

def test_static_assets_served(client):
    resp = client.get("/static/app.js")
    assert resp.status_code == 200
    assert b"cardBlockApp" in resp.data
