"""Shared pytest fixtures."""
import pytest
from app import create_app, Config


@pytest.fixture
def app():
    """Flask application fixture for tests."""
    app = create_app(Config)
    app.config["TESTING"] = True
    yield app


@pytest.fixture
def client(app):
    with app.test_client() as client:
        yield client
