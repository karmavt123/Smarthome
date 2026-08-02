"""Face detection + ArcFace embedding (via insightface FaceAnalysis, buffalo_l pack)."""

from __future__ import annotations

import numpy as np

from app.ai.model_loader import get_face_app
from app.utils.errors import MultipleFacesDetectedError, NoFaceDetectedError


def detect_single_face(image: np.ndarray):
    """Returns the sole detected face. Raises 422 if face count != 1."""
    faces = get_face_app().get(image)

    if len(faces) == 0:
        raise NoFaceDetectedError()
    if len(faces) >= 2:
        raise MultipleFacesDetectedError()

    return faces[0]


def get_embedding(image: np.ndarray) -> list[float]:
    face = detect_single_face(image)
    return face.normed_embedding.astype(float).tolist()


def euclidean_distance(a: list[float], b: list[float]) -> float:
    return float(np.linalg.norm(np.array(a) - np.array(b)))
