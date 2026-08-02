from flask import Flask
from flask_cors import CORS

from config import Config


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app)

    Config.UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)

    from app.routes.health_routes import health_bp

    app.register_blueprint(health_bp)

    return app
