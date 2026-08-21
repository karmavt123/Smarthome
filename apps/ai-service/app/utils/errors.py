"""Uniform error envelope, matching Node's error.middleware.js: {message, details}."""

from __future__ import annotations

from typing import Any


class AppError(Exception):
    def __init__(self, status_code: int, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.details = details or {}


class UnauthorizedError(AppError):
    def __init__(self, details: dict[str, Any] | None = None) -> None:
        super().__init__(401, "Unauthorized", details)


class NoFaceDetectedError(AppError):
    def __init__(self, details: dict[str, Any] | None = None) -> None:
        super().__init__(422, "No face detected", details)


class MultipleFacesDetectedError(AppError):
    def __init__(self, details: dict[str, Any] | None = None) -> None:
        super().__init__(422, "Multiple faces detected", details)


class IntentNotRecognizedError(AppError):
    def __init__(self, details: dict[str, Any] | None = None) -> None:
        super().__init__(422, "Voice command intent not recognized", details)
