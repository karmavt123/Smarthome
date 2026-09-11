"""MiniFASNet anti-spoof scoring (Silent-Face-Anti-Spoofing), run per frame and aggregated by min.

Face crop follows the original repo's CropImage algorithm: a square region centered on the
detected bbox, scaled up by LIVENESS_CROP_SCALE before resizing to the model's 80x80 input.
Output class order is [fake, real, fake] (index 1 = real) — matches upstream test.py's
`argmax == 1 -> Real` convention. Input is raw BGR pixels in [0, 255], not rescaled — the
model's own training pipeline has no /255 normalization step.
"""

from __future__ import annotations

import cv2
import numpy as np

from app.ai.model_loader import get_face_app, get_liveness_session

REAL_CLASS_INDEX = 1
INPUT_SIZE = 80
CROP_SCALE = 2.7

# Why a frame could not be scored. Kept distinct from a *low* score: "we could not
# measure" and "we measured and it looks fake" are different answers to the user, and
# collapsing them into 0.0 told everyone standing slightly off-camera that they had been
# caught spoofing.
NO_FACE = "no_face"
MULTIPLE_FACES = "multiple_faces"


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


def _score_frame_detailed(image: np.ndarray) -> tuple[float | None, str | None]:
    """(real-class probability, None), or (None, reason) when the frame has 0 or >=2 faces."""
    bboxes = _detect_bboxes(image)
    face_count = 0 if bboxes is None else len(bboxes)

    if face_count == 0:
        return None, NO_FACE
    if face_count > 1:
        return None, MULTIPLE_FACES

    crop = _crop_for_liveness(image, bboxes[0])
    blob = crop.astype(np.float32).transpose(2, 0, 1)[np.newaxis, ...]

    session = get_liveness_session()
    input_name = session.get_inputs()[0].name
    logits = session.run(None, {input_name: blob})[0][0]

    probs = np.exp(logits - logits.max())
    probs /= probs.sum()
    return float(probs[REAL_CLASS_INDEX]), None


def _score_frame(image: np.ndarray) -> float | None:
    """Score only, or None if the frame has 0 or >=2 faces (used by tools/measure_liveness.py)."""
    score, _ = _score_frame_detailed(image)
    return score


def evaluate_liveness(frames: list[np.ndarray]) -> tuple[float | None, str | None]:
    """(min score over measurable frames, None), or (None, reason) if none could be measured.

    Aggregating by min is deliberate: for a live person every captured frame has to clear
    the bar, and for a spoof a single frame that gives the trick away is enough to reject.
    """
    scores: list[float] = []
    reasons: list[str] = []

    for frame in frames:
        score, reason = _score_frame_detailed(frame)
        if score is None:
            reasons.append(reason)
        else:
            scores.append(score)

    if scores:
        return min(scores), None

    # Nothing measurable. Report "multiple faces" only when that was the problem in every
    # frame; otherwise "no face" is the more useful thing to tell the user.
    if reasons and all(reason == MULTIPLE_FACES for reason in reasons):
        return None, MULTIPLE_FACES
    return None, NO_FACE


def compute_liveness(frames: list[np.ndarray]) -> float:
    """Backwards-compatible wrapper: unmeasurable collapses to 0.0."""
    score, _ = evaluate_liveness(frames)
    return 0.0 if score is None else score
