import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


class Config:
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "development-secret-key")
    DEBUG: bool = os.environ.get("FLASK_DEBUG", "false").lower() in {"1", "true", "yes"}

    UPLOAD_FOLDER: Path = BASE_DIR / os.environ.get("UPLOAD_FOLDER", "storage/uploads")
    MAX_CONTENT_LENGTH: int = int(os.environ.get("MAX_CONTENT_LENGTH", 10 * 1024 * 1024))

    AI_SERVICE_API_KEY: str = os.environ.get("AI_SERVICE_API_KEY", "")
    MODEL_DIR: Path = BASE_DIR / os.environ.get("MODEL_DIR", "models")
    LIVENESS_THRESHOLD: float = float(os.environ.get("LIVENESS_THRESHOLD", 0.9))
    VOICE_INTENT_THRESHOLD: float = float(os.environ.get("VOICE_INTENT_THRESHOLD", 0.72))
    PORT: int = int(os.environ.get("PORT", 5000))
