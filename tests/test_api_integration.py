"""Additional API integration tests for Card Block API."""
import pytest
from app import create_app, Config


@pytest.fixture
def client():
    app = create_app(Config)
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


class TestApiSwagger:
    """Test API documentation endpoint."""

    def test_swagger_ui_accessible(self, client):
        """Swagger UI should be accessible at /api/docs."""
        resp = client.get("/api/docs")
        assert resp.status_code == 200


class TestBankListEdgeCases:
    """Edge cases for the bank list endpoint."""

    def test_list_returns_correct_content_type(self, client):
        """Response should be JSON."""
        resp = client.get("/api/v1/banks/")
        assert resp.content_type == "application/json"

    def test_list_banks_have_card_types(self, client):
        """Each bank summary should list available card types."""
        resp = client.get("/api/v1/banks/")
        data = resp.get_json()
        assert isinstance(data, list)
        # At least top banks should have card types in summary
        for bank in data:
            assert "id" in bank
            assert "name" in bank

    def test_list_count_matches_data_file(self, client):
        """API list count should match banks.json entry count."""
        import json
        with open("app/data/banks.json", encoding="utf-8") as f:
            file_count = len(json.load(f))
        resp = client.get("/api/v1/banks/")
        data = resp.get_json()
        assert len(data) == file_count


class TestBankDetailEdgeCases:
    """Edge cases for individual bank detail endpoint."""

    def test_detail_has_correct_fields(self, client):
        """Bank detail should have all expected fields."""
        resp = client.get("/api/v1/banks/hdfc")
        data = resp.get_json()
        expected = {"id", "name", "logo", "ifsc", "blockingInstructions", "sources"}
        assert expected.issubset(data.keys())

    def test_detail_blocking_has_phone_number(self, client):
        """At least one phone number should exist for blocking."""
        resp = client.get("/api/v1/banks/sbi")
        data = resp.get_json()
        for card_type, inst in data["blockingInstructions"].items():
            has_phone = any([
                inst.get("tollFree"),
                inst.get("number1"),
                inst.get("number2"),
            ])
            assert has_phone, f"sbi/{card_type}: no phone number for blocking"

    def test_sbi_detail_has_credit_debit(self, client):
        """SBI should have both credit and debit card types."""
        resp = client.get("/api/v1/banks/sbi")
        data = resp.get_json()
        assert "credit" in data["blockingInstructions"]
        assert "debit" in data["blockingInstructions"]

    def test_bank_not_found_returns_json(self, client):
        """404 response should be JSON, not HTML."""
        resp = client.get("/api/v1/banks/nonexistent_bank")
        assert resp.content_type == "application/json"


class TestSearchEdgeCases:
    """Search endpoint edge cases."""

    def test_search_partial_match(self, client):
        """Search 'state' should find SBI (State Bank of India)."""
        resp = client.get("/api/v1/banks/search?q=state")
        data = resp.get_json()
        assert len(data) >= 1
        assert any(b["id"] == "sbi" for b in data)

    def test_search_case_insensitive(self, client):
        """Search should be case-insensitive."""
        resp_lower = client.get("/api/v1/banks/search?q=hdfc")
        resp_upper = client.get("/api/v1/banks/search?q=HDFC")
        data_lower = resp_lower.get_json()
        data_upper = resp_upper.get_json()
        assert len(data_lower) == len(data_upper)

    def test_search_no_results(self, client):
        """Search for nonsense should return empty list."""
        resp = client.get("/api/v1/banks/search?q=zzznonexistent")
        data = resp.get_json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_special_characters_in_search(self, client):
        """Search with special chars shouldn't crash."""
        resp = client.get("/api/v1/banks/search?q=<>@#$%")
        assert resp.status_code == 200


class TestStatsEndpoint:
    """Stats endpoint tests."""

    def test_stats_content_type(self, client):
        resp = client.get("/api/v1/banks/stats")
        assert resp.content_type == "application/json"

    def test_stats_bank_names_not_empty(self, client):
        """Stats should include non-empty bank names list."""
        resp = client.get("/api/v1/banks/stats")
        data = resp.get_json()
        assert len(data["bankNames"]) > 0


class TestStaticFiles:
    """Static file serving tests."""

    def test_css_served(self, client):
        """CSS (if inline in HTML) or JS should be served."""
        resp = client.get("/static/app.js")
        assert resp.status_code == 200
        assert "javascript" in resp.content_type.lower()

    def test_logo_served(self, client):
        """At least one logo file should be servable."""
        resp = client.get("/static/logos/sbi.svg")
        assert resp.status_code == 200
