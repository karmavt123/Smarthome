"""X-API-Key check, applied to every AI-service route except /health endpoints."""

from functools import wraps

from flask import current_app, request

from app.utils.errors import UnauthorizedError


def require_api_key(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        expected = current_app.config["AI_SERVICE_API_KEY"]
        provided = request.headers.get("X-API-Key")

        if not expected or not provided or provided != expected:
            raise UnauthorizedError()

        return view(*args, **kwargs)

    return wrapped
