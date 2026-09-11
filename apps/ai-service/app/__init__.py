import os

from flask import Flask, jsonify
from flask_cors import CORS

from config import Config


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    # CORS(app) allowed every origin on the internet to call this service from a
    # victim's browser. Nothing in the product needs that: the browser talks to the Node
    # backend, and only the backend calls this service (server-to-server, where CORS does
    # not apply). Default to no cross-origin access; AI_ALLOWED_ORIGINS re-opens it for
    # local debugging.
    allowed_origins = [
        origin.strip()
        for origin in os.environ.get("AI_ALLOWED_ORIGINS", "").split(",")
        if origin.strip()
    ]
    if allowed_origins:
        CORS(app, origins=allowed_origins)

    Config.UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)

    from app.routes.health_routes import health_bp
    from app.routes.face_id_routes import face_id_bp
    from app.routes.voice_routes import voice_bp

    app.register_blueprint(health_bp)
    app.register_blueprint(face_id_bp)
    app.register_blueprint(voice_bp)

    from app.utils.errors import AppError

    from werkzeug.exceptions import HTTPException

    @app.errorhandler(AppError)
    def handle_app_error(err: AppError):
        return jsonify({"message": err.message, "details": err.details}), err.status_code

    @app.errorhandler(HTTPException)
    def handle_http_error(err: HTTPException):
        return jsonify({"message": err.description, "details": {}}), err.code

    @app.errorhandler(Exception)
    def handle_unexpected_error(err: Exception):
        app.logger.exception(err)
        return jsonify({"message": "Internal server error", "details": {}}), 500

    from app.ai.model_loader import load_models

    load_models(Config.MODEL_DIR)

    return app
