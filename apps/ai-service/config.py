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

    # /face-id/verify sends `candidates` as a non-file multipart field: one JSON array
    # holding every active face profile of the home, ~11.8 KB per 512-float embedding.
    # Flask 3.1 caps non-file form data at 500 KB by default, so from roughly the 43rd
    # enrolled profile every verify was rejected with 413 *before reaching the route* —
    # Face ID went permanently dark for that home while MAX_CONTENT_LENGTH still claimed
    # a 10 MB limit. Matching the two removes that invisible second ceiling.
    MAX_FORM_MEMORY_SIZE: int = int(
        os.environ.get("MAX_FORM_MEMORY_SIZE", MAX_CONTENT_LENGTH)
    )

    AI_SERVICE_API_KEY: str = os.environ.get("AI_SERVICE_API_KEY", "")
    MODEL_DIR: Path = BASE_DIR / os.environ.get("MODEL_DIR", "models")
    LIVENESS_THRESHOLD: float = float(os.environ.get("LIVENESS_THRESHOLD", 0.9))
    VOICE_INTENT_THRESHOLD: float = float(os.environ.get("VOICE_INTENT_THRESHOLD", 0.72))
    PORT: int = int(os.environ.get("PORT", 5000))
