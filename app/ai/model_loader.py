"""Loads Face ID models once at process startup, memoized (mirrors Node's loadModels())."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import onnxruntime

logger = logging.getLogger(__name__)

_face_app = None
_liveness_session: Optional[onnxruntime.InferenceSession] = None
_loaded = False

LIVENESS_MODEL_FILENAME = "minifasnet.onnx"


def load_models(model_dir: Path) -> None:
    """Idempotent: safe to call more than once (e.g. app factory + tests)."""
    global _face_app, _liveness_session, _loaded

    if _loaded:
        return

    model_dir.mkdir(parents=True, exist_ok=True)

    from insightface.app import FaceAnalysis

    _face_app = FaceAnalysis(name="buffalo_l", root=str(model_dir), providers=["CPUExecutionProvider"])
    _face_app.prepare(ctx_id=-1, det_size=(640, 640))

    liveness_path = model_dir / LIVENESS_MODEL_FILENAME
    if liveness_path.exists():
        _liveness_session = onnxruntime.InferenceSession(str(liveness_path), providers=["CPUExecutionProvider"])
    else:
        logger.warning(
            "Liveness model not found at %s — /api/face-id/verify will fail until it is provided.",
            liveness_path,
        )
        _liveness_session = None

    _loaded = True


def get_face_app():
    if _face_app is None:
        raise RuntimeError("Face recognition model not loaded — call load_models() first")
    return _face_app


def get_liveness_session() -> onnxruntime.InferenceSession:
    if _liveness_session is None:
        raise RuntimeError("Liveness model not loaded — missing weight file in MODEL_DIR")
    return _liveness_session


def models_ready() -> bool:
    return _face_app is not None and _liveness_session is not None
