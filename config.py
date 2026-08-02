import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent


class Config:
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "development-secret-key")
    DEBUG: bool = os.environ.get("FLASK_DEBUG", "false").lower() in {"1", "true", "yes"}

    UPLOAD_FOLDER: Path = BASE_DIR / os.environ.get("UPLOAD_FOLDER", "storage/uploads")
    MAX_CONTENT_LENGTH: int = int(os.environ.get("MAX_CONTENT_LENGTH", 10 * 1024 * 1024))
