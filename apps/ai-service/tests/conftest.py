import pytest

from app import create_app

# Pinned so the auth tests actually exercise the comparison. Reading whatever happens to
# be in the environment meant that with no .env present AI_SERVICE_API_KEY was "" — and
# require_api_key rejects everything when the expected key is empty. Every
# "wrong key is unauthorized" test then passed for the wrong reason (it would still pass
# with the comparison replaced by `return True`), while the validation tests failed with
# 401 instead of the 400 they assert.
TEST_API_KEY = "pytest-api-key"


@pytest.fixture(scope="session")
def app():
    flask_app = create_app()
    flask_app.config["AI_SERVICE_API_KEY"] = TEST_API_KEY
    return flask_app


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def api_key(app):
    return app.config["AI_SERVICE_API_KEY"]
