"""X-API-Key check, applied to every AI-service route except /health endpoints."""

import hmac
from functools import wraps

from flask import current_app, request

from app.utils.errors import UnauthorizedError


def require_api_key(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        expected = current_app.config["AI_SERVICE_API_KEY"]
        provided = request.headers.get("X-API-Key")

        if not expected or not provided:
            raise UnauthorizedError()

        # compare_digest instead of != : a plain string comparison returns as soon as
        # two bytes differ, so how long the request takes leaks how many leading
        # characters of the key were right. compare_digest always walks both buffers.
        if not hmac.compare_digest(provided, expected):
            raise UnauthorizedError()

        return view(*args, **kwargs)

    return wrapped
