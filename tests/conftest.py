import pytest

from app import create_app


@pytest.fixture(scope="session")
def app():
    return create_app()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def api_key(app):
    return app.config["AI_SERVICE_API_KEY"]
