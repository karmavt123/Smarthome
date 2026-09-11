"""Voice command intent: pure NLU, no device resolution (Node keeps scoreDeviceName)."""

from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request
from flask.wrappers import Response

from app.ai.model_loader import embedding_model_ready
from app.middleware.auth import require_api_key
from app.services.voice_intent_service import classify_intent
from app.utils.errors import AppError, IntentNotRecognizedError

voice_bp = Blueprint("voice", __name__, url_prefix="/api/voice")


@voice_bp.get("/health")
def health() -> Response:
    return jsonify({"status": "ok", "modelsLoaded": embedding_model_ready()})


@voice_bp.post("/intent")
@require_api_key
def intent() -> Response:
    # get_json parses ANY valid JSON, not just an object: a body of `[1,2]`, `"hi"` or
    # `5` used to reach .get() and blow up with AttributeError -> 500 + a stack trace in
    # the logs, for what is plainly a bad request.
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise AppError(400, "request body must be a JSON object")

    text = body.get("text")
    if not isinstance(text, str) or not text.strip():
        raise AppError(400, "'text' is required")

    threshold = current_app.config["VOICE_INTENT_THRESHOLD"]
    result = classify_intent(text, threshold)
    if result is None:
        raise IntentNotRecognizedError()

    return jsonify(result)
