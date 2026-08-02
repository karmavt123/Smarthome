"""Decode uploaded image files (multipart FileStorage) into OpenCV BGR arrays."""

from __future__ import annotations

import numpy as np
import cv2
from werkzeug.datastructures import FileStorage

from app.utils.errors import AppError

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png"}


def decode_image_file(file: FileStorage, field_name: str) -> np.ndarray:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise AppError(400, f"Invalid file format for '{field_name}'", {"contentType": file.content_type})

    raw = np.frombuffer(file.read(), dtype=np.uint8)
    image = cv2.imdecode(raw, cv2.IMREAD_COLOR)

    if image is None:
        raise AppError(400, f"Could not decode '{field_name}' as an image", {})

    return image
