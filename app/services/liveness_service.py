"""MiniFASNet anti-spoof scoring (Silent-Face-Anti-Spoofing), run per frame and aggregated by min.

Face crop follows the original repo's CropImage algorithm: a square region centered on the
detected bbox, scaled up by LIVENESS_CROP_SCALE before resizing to the model's 80x80 input.
Output class order [fake-print, real, fake-replay] matches the upstream training labels.
"""

from __future__ import annotations

import cv2
import numpy as np

from app.ai.model_loader import get_face_app, get_liveness_session

REAL_CLASS_INDEX = 1
INPUT_SIZE = 80
CROP_SCALE = 2.7


def _detect_bboxes(image: np.ndarray) -> np.ndarray:
    det_model = get_face_app().models["detection"]
    bboxes, _ = det_model.detect(image, max_num=0, metric="default")
    return bboxes


def _crop_for_liveness(image: np.ndarray, bbox: np.ndarray) -> np.ndarray:
    src_h, src_w = image.shape[:2]
    x1, y1, x2, y2 = bbox[:4]
    box_w, box_h = x2 - x1, y2 - y1

    scale = min((src_h - 1) / box_h, min((src_w - 1) / box_w, CROP_SCALE))
    new_w, new_h = box_w * scale, box_h * scale
    center_x, center_y = x1 + box_w / 2, y1 + box_h / 2

    left, top = center_x - new_w / 2, center_y - new_h / 2
    right, bottom = center_x + new_w / 2, center_y + new_h / 2

    if left < 0:
        right -= left
        left = 0
    if top < 0:
        bottom -= top
        top = 0
    if right > src_w - 1:
        left -= right - src_w + 1
        right = src_w - 1
    if bottom > src_h - 1:
        top -= bottom - src_h + 1
        bottom = src_h - 1

    left, top, right, bottom = int(left), int(top), int(right), int(bottom)
    crop = image[top : bottom + 1, left : right + 1]
    return cv2.resize(crop, (INPUT_SIZE, INPUT_SIZE))


def _score_frame(image: np.ndarray) -> float | None:
    """Returns real-class probability, or None if the frame has 0 or >=2 faces."""
    bboxes = _detect_bboxes(image)
    if bboxes is None or len(bboxes) != 1:
        return None

    crop = _crop_for_liveness(image, bboxes[0])
    blob = crop.astype(np.float32).transpose(2, 0, 1)[np.newaxis, ...] / 255.0

    session = get_liveness_session()
    input_name = session.get_inputs()[0].name
    logits = session.run(None, {input_name: blob})[0][0]

    probs = np.exp(logits - logits.max())
    probs /= probs.sum()
    return float(probs[REAL_CLASS_INDEX])


def compute_liveness(frames: list[np.ndarray]) -> float:
    """Score every frame that has exactly one detectable face, return the min (safest)."""
    scores = [s for s in (_score_frame(f) for f in frames) if s is not None]

    if not scores:
        return 0.0

    return min(scores)
