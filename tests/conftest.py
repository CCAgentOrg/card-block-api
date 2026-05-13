"""Shared pytest fixtures."""
import pytest
from app import create_app, Config


@pytest.fixture
def client():
    app = create_app(Config)
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client
