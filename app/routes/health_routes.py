from flask import Blueprint, jsonify
from flask.wrappers import Response

health_bp = Blueprint("health", __name__, url_prefix="/api")


@health_bp.get("/health")
def health() -> Response:
    return jsonify({"success": True, "message": "API is running"})
