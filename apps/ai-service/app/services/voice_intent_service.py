"""Vietnamese voice command intent classification via multilingual sentence embeddings.

Closed-set classifier: each (deviceType, action) pair is anchored by a handful of seed
phrases, embedded once and cached. Incoming text is embedded and matched by cosine
similarity against the closest seed phrase. No device resolution here — Node keeps
picking the specific device via scoreDeviceName.
"""

from __future__ import annotations

import numpy as np
import re

from app.ai.model_loader import get_embedding_model

# Embedding model gan nhu mu voi phu dinh: "khoan hay tat quat" ra fan/turn_off
# voi confidence 0.92 (do ngay 22/08). Chan bang luat truoc khi goi model.
NEGATION = re.compile(
    r"(đừng|khoan|khỏi cần|không cần|chưa cần|thôi khỏi|đâu cần|\bkhông\b)",
    re.IGNORECASE,
)

SEED_PHRASES: dict[tuple[str, str], list[str]] = {
    ("light", "turn_on"): [
        "bật đèn",
        "mở đèn",
        "bật đèn phòng khách",
        "cho tôi bật đèn",
        "làm ơn mở đèn giúp tôi",
        "sáng đèn lên",
    ],
    ("light", "turn_off"): [
        "tắt đèn",
        "tắt đèn phòng khách",
        "cho tôi tắt đèn",
        "làm ơn tắt đèn giúp tôi",
        "tối đèn đi",
    ],
    ("fan", "turn_on"): [
        "bật quạt",
        "mở quạt",
        "cho quạt chạy",
        "bật quạt lên giúp tôi",
        "quạt chạy đi",
    ],
    ("fan", "turn_off"): [
        "tắt quạt",
        "đóng quạt",
        "tắt quạt giúp tôi",
        "cho quạt nghỉ",
        "dừng quạt lại",
    ],
    ("door", "open"): [
        "mở cửa",
        "mở cửa ra",
        "cho tôi mở cửa",
        "mở cửa giúp tôi",
    ],
    ("door", "close"): [
        "đóng cửa",
        "đóng cửa lại",
        "khoá cửa",
        "đóng cửa giúp tôi",
    ],
}

_seed_labels: list[tuple[str, str]] | None = None
_seed_vectors: np.ndarray | None = None
NONE_LABEL = ("__none__", "__none__")

SEED_PHRASES[NONE_LABEL] = [
    "alo alo", "a lô", "ừ đúng rồi đó", "ok được rồi", "cảm ơn nhé",
    "hôm nay trời đẹp quá", "mấy giờ rồi", "nhiệt độ phòng bao nhiêu",
    "tôi đói bụng quá", "gọi cho mẹ",
]


def _l2_normalize(vectors: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    return vectors / np.clip(norms, 1e-12, None)


def _seed_index() -> tuple[list[tuple[str, str]], np.ndarray]:
    global _seed_labels, _seed_vectors

    if _seed_vectors is None:
        labels: list[tuple[str, str]] = []
        phrases: list[str] = []
        for intent, variants in SEED_PHRASES.items():
            for phrase in variants:
                labels.append(intent)
                phrases.append(phrase)

        vectors = np.array(list(get_embedding_model().embed([p.lower() for p in phrases])))
        _seed_labels = labels
        _seed_vectors = _l2_normalize(vectors)

    return _seed_labels, _seed_vectors


def _score_intents(text: str) -> dict[tuple[str, str], float]:
    """Best cosine similarity per (deviceType, action) label, including NONE_LABEL.
    Tach rieng de tools/measure_voice.py doc duoc diem that, khong bi classify_intent
    nuot mat khi tra ve None."""
    labels, seed_vectors = _seed_index()
    query_vector = _l2_normalize(np.array(list(get_embedding_model().embed([text.lower()]))))[0]
    similarities = seed_vectors @ query_vector

    best_per_intent: dict[tuple[str, str], float] = {}
    for label, score in zip(labels, similarities):
        if score > best_per_intent.get(label, -1.0):
            best_per_intent[label] = float(score)
    return best_per_intent


def classify_intent(text: str, threshold: float) -> dict | None:
    """Returns {deviceType, action, confidence} or None if below threshold (caller returns 422)."""
    if NEGATION.search(text):
        return None

    best_per_intent = _score_intents(text)
    (device_type, action), confidence = max(best_per_intent.items(), key=lambda item: item[1])

    if confidence < threshold:
        return None
    if (device_type, action) == NONE_LABEL:
        return None

    return {"deviceType": device_type, "action": action, "confidence": confidence}
