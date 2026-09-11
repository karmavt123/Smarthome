"""Face ID: pure AI endpoints, no business logic (ownership/lockout/alerts stay in Node)."""

from __future__ import annotations

import json
import math

import cv2
from flask import Blueprint, current_app, jsonify, request
from flask.wrappers import Response

from app.ai.model_loader import models_ready
from app.middleware.auth import require_api_key
from app.services.face_recognition_service import EMBEDDING_DIM, euclidean_distance, get_embedding
from app.services.liveness_service import (
    MULTIPLE_FACES,
    NO_FACE,
    evaluate_liveness,
)
from app.utils.errors import AppError, MultipleFacesDetectedError, NoFaceDetectedError
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


def _is_finite_number(value) -> bool:
    """Is this JSON value a number numpy can safely turn into a float64?

    math.isfinite() coerces its argument to a C double before testing it, and json.loads
    turns a huge integer *literal* into a Python int of unbounded size. So
    math.isfinite(10 ** 400) does not return False — it raises OverflowError, which
    escaped as a 500 and made Node report "Face ID unavailable" for the whole home.
    That is the exact failure the finiteness check was added to prevent, produced by the
    check itself. A 692-character embedding element was enough to trigger it.

    float() is used instead of a magic bound because the largest int that survives the
    conversion is not a round number (it depends on float64 rounding), and letting the
    interpreter answer that question is both exact and self-evidently correct.
    """
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    if isinstance(value, int):
        try:
            coerced = float(value)
        except OverflowError:
            return False
        return math.isfinite(coerced)
    return math.isfinite(value)


def _parse_threshold() -> float:
    raw = request.form.get("threshold")
    if raw is None:
        raise AppError(400, "'threshold' is required")
    try:
        value = float(raw)
    except ValueError:
        raise AppError(400, "'threshold' must be a float") from None

    # float() happily accepts "inf", "nan" and "1e400". A threshold of inf makes
    # `best_distance <= threshold` true for whoever is nearest — the door opens for a
    # stranger. nan makes every comparison false, so nobody ever matches.
    if not math.isfinite(value) or value <= 0:
        raise AppError(400, "'threshold' must be a positive, finite number")

    return value


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

        # Element types matter: numpy raises TypeError on a list of strings or None, which
        # surfaced as a 500 and made Node report "Face ID unavailable" for the whole home
        # because of one corrupt face_profiles row. A 400 naming the bad candidate lets the
        # caller find and fix that row.
        # Finiteness matters as well: json.loads accepts the bare literals NaN / Infinity /
        # -Infinity, and isinstance(nan, float) is True. One such value reached the response
        # as `"distance": NaN`, which is not valid JSON — Node's JSON.parse threw and the
        # whole home got "Face ID unavailable", the exact failure this validation stops.
        # _is_finite_number rather than math.isfinite: see its docstring for why the bare
        # call turned an oversized integer literal into the very 500 it was guarding.
        if not all(_is_finite_number(value) for value in embedding):
            raise AppError(
                400,
                "candidate embedding must contain only finite numbers",
                {"id": candidate.get("id")},
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

    liveness_score, liveness_error = evaluate_liveness(frames)

    # "Could not measure" is not "looks fake". Before this, a user standing off-centre or
    # in poor light scored 0.0 and was told liveness_failed — i.e. accused of spoofing —
    # while the 422s below were unreachable on /verify (get_embedding, the only other
    # place that raises them, runs after this gate). The Node caller also returns early on
    # a liveness failure, so those attempts never even reached door_access_logs.
    if liveness_error == NO_FACE:
        raise NoFaceDetectedError()
    if liveness_error == MULTIPLE_FACES:
        raise MultipleFacesDetectedError()

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
