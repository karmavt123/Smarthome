"""Face ID: pure AI endpoints, no business logic (ownership/lockout/alerts stay in Node)."""

from __future__ import annotations

import json

import cv2
from flask import Blueprint, current_app, jsonify, request
from flask.wrappers import Response

from app.ai.model_loader import models_ready
from app.middleware.auth import require_api_key
from app.services.face_recognition_service import EMBEDDING_DIM, euclidean_distance, get_embedding
from app.services.liveness_service import compute_liveness
from app.utils.errors import AppError
from app.utils.file_utils import decode_image_file

face_id_bp = Blueprint("face_id", __name__, url_prefix="/api/face-id")

MIN_FRAMES = 1
MAX_FRAMES = 5


@face_id_bp.get("/health")
def health() -> Response:
    return jsonify({"status": "ok", "modelsLoaded": models_ready()})


@face_id_bp.post("/enroll")
@require_api_key
def enroll() -> Response:
    file = request.files.get("image")
    if file is None:
        raise AppError(400, "'image' file is required")

    image = decode_image_file(file, "image")
    embedding = get_embedding(image)

    return jsonify({"embedding": embedding})


def _sharpest_frame(frames):
    return max(frames, key=lambda f: cv2.Laplacian(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var())


def _parse_threshold() -> float:
    raw = request.form.get("threshold")
    if raw is None:
        raise AppError(400, "'threshold' is required")
    try:
        return float(raw)
    except ValueError:
        raise AppError(400, "'threshold' must be a float") from None


def _parse_candidates() -> list[dict]:
    raw = request.form.get("candidates", "[]")
    try:
        candidates = json.loads(raw)
    except json.JSONDecodeError:
        raise AppError(400, "'candidates' is not valid JSON") from None

    if not isinstance(candidates, list):
        raise AppError(400, "'candidates' must be a JSON array")

    for candidate in candidates:
        if not isinstance(candidate, dict) or "id" not in candidate or "embedding" not in candidate:
            raise AppError(400, "each candidate must have 'id' and 'embedding'", {"candidate": candidate})

        embedding = candidate["embedding"]
        if not isinstance(embedding, list) or len(embedding) != EMBEDDING_DIM:
            raise AppError(
                400,
                f"candidate embedding must have {EMBEDDING_DIM} dimensions",
                {"id": candidate.get("id"), "length": len(embedding) if isinstance(embedding, list) else None},
            )

    return candidates


@face_id_bp.post("/verify")
@require_api_key
def verify() -> Response:
    files = request.files.getlist("images")
    if not (MIN_FRAMES <= len(files) <= MAX_FRAMES):
        raise AppError(400, f"'images' must contain {MIN_FRAMES}-{MAX_FRAMES} files")

    threshold = _parse_threshold()
    candidates = _parse_candidates()

    frames = [decode_image_file(f, "images") for f in files]

    liveness_score = compute_liveness(frames)
    is_live = liveness_score >= current_app.config["LIVENESS_THRESHOLD"]

    if not is_live:
        return jsonify(
            {
                "isLive": False,
                "livenessScore": liveness_score,
                "matched": None,
                "distance": None,
            }
        )

    embedding = get_embedding(_sharpest_frame(frames))

    matched = None
    distance = None
    if candidates:
        scored = [
            (candidate, euclidean_distance(embedding, candidate["embedding"])) for candidate in candidates
        ]
        best_candidate, best_distance = min(scored, key=lambda pair: pair[1])
        distance = best_distance
        if best_distance <= threshold:
            matched = {"id": best_candidate["id"], "distance": best_distance}

    return jsonify(
        {
            "isLive": True,
            "livenessScore": liveness_score,
            "matched": matched,
            "distance": distance,
        }
    )
