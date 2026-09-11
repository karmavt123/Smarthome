"""Decode uploaded image files (multipart FileStorage) into OpenCV BGR arrays."""

from __future__ import annotations

import struct

import numpy as np
import cv2
from werkzeug.datastructures import FileStorage

from app.utils.errors import AppError

# Guard against decompression bombs. cv2.imdecode allocates width*height*3 bytes the
# moment it is called, so the check has to happen on the HEADER, before decoding: a 10 MB
# PNG of one flat colour is well inside MAX_CONTENT_LENGTH and still expands to gigabytes.
# gunicorn runs a single worker, so one such request takes the whole service down and the
# 120s healthcheck start_period keeps Face ID dark for minutes afterwards.
# 25 MP is ~6000x4000 — far above any webcam frame this API is fed.
MAX_PIXELS = 25_000_000

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
JPEG_MAGIC = b"\xff\xd8"

# SOF markers carrying the frame dimensions. SOF4/SOF8/SOF12 (0xc4, 0xc8, 0xcc) are DHT /
# JPG / DAC and are deliberately excluded.
JPEG_SOF_MARKERS = {
    0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
    0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF,
}


def _png_dimensions(data: bytes) -> tuple[int, int] | None:
    # 8-byte magic, 4-byte IHDR length, 4-byte "IHDR", then width and height as uint32 BE.
    if len(data) < 24 or data[12:16] != b"IHDR":
        return None
    width, height = struct.unpack(">II", data[16:24])
    return width, height


def _jpeg_dimensions(data: bytes) -> tuple[int, int] | None:
    offset = 2  # skip SOI
    total = len(data)

    while offset + 3 < total:
        if data[offset] != 0xFF:
            offset += 1
            continue

        # ITU-T T.81 B.1.1.2: any marker may be preceded by any number of 0xFF fill bytes.
        # Without this, a single extra 0xFF before SOF made the scanner read 0xFF as the
        # marker, treat the next two bytes as a segment length, and skip clean past the
        # dimensions — returning None, which used to mean "no size check" and let a 692-byte
        # upload decode into 1.2 GB.
        marker_at = offset + 1
        while marker_at < total and data[marker_at] == 0xFF:
            marker_at += 1
        if marker_at >= total:
            return None

        marker = data[marker_at]
        offset = marker_at + 1

        # Standalone markers: no length field, nothing to skip.
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            continue
        if marker == 0xD9:  # EOI
            return None
        if offset + 1 >= total:
            return None

        (segment_length,) = struct.unpack(">H", data[offset : offset + 2])
        if marker in JPEG_SOF_MARKERS:
            if offset + 7 > total:
                return None
            height, width = struct.unpack(">HH", data[offset + 3 : offset + 7])
            return width, height

        # A segment length counts its own two bytes, so anything below 2 is malformed and
        # would leave `offset` standing still or moving backwards.
        if segment_length < 2:
            return None

        offset += segment_length

    return None


def _dimensions_from_header(data: bytes) -> tuple[str, tuple[int, int] | None] | None:
    """(format, (width, height)) sniffed from the magic bytes, or None for anything else."""
    if data.startswith(PNG_MAGIC):
        return "png", _png_dimensions(data)
    if data.startswith(JPEG_MAGIC):
        return "jpeg", _jpeg_dimensions(data)
    return None


def decode_image_file(file: FileStorage, field_name: str) -> np.ndarray:
    data = file.read()
    if not data:
        raise AppError(400, f"'{field_name}' is empty", {})

    # Sniff the real bytes rather than trusting file.content_type: that header is written
    # by the client, and the Node caller hard-codes contentType 'image/jpeg' for every
    # frame regardless of what it actually holds — so the old content-type whitelist was
    # only ever checking a constant.
    sniffed = _dimensions_from_header(data)
    if sniffed is None:
        raise AppError(
            400,
            f"Invalid file format for '{field_name}' — only JPEG and PNG are accepted",
            {"contentType": file.content_type},
        )

    image_format, dimensions = sniffed

    # Fail closed. Treating "could not read the header" as "no limit applies" is exactly
    # how the pixel cap got bypassed: cv2.imdecode allocates width*height*3 the moment it
    # is called, so a file whose size we cannot establish must never reach it. Every real
    # image this service handles parses (verified against the whole faces/ and spoof/ set
    # plus progressive, restart-interval and optimised encodings).
    if dimensions is None:
        raise AppError(
            400,
            f"Could not read the dimensions of '{field_name}'",
            {"format": image_format},
        )

    width, height = dimensions
    if width <= 0 or height <= 0:
        raise AppError(400, f"Could not decode '{field_name}' as an image", {})
    if width * height > MAX_PIXELS:
        raise AppError(
            400,
            f"'{field_name}' is too large ({width}x{height}); limit is {MAX_PIXELS} pixels",
            {"width": width, "height": height},
        )

    raw = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(raw, cv2.IMREAD_COLOR)

    if image is None:
        raise AppError(
            400,
            f"Could not decode '{field_name}' as an image",
            {"format": image_format},
        )

    return image
