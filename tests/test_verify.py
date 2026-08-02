"""Fixture-based cases (match / no-match / liveness fail) need real face images and a
real spoof image under tests/fixtures/ — not present yet (see spec Testing section: no
model mocking). These cover the request-validation paths only.
"""

import io


def test_missing_api_key_is_unauthorized(client):
    response = client.post("/api/face-id/verify")
    assert response.status_code == 401


def test_missing_images_is_bad_request(client, api_key):
    response = client.post(
        "/api/face-id/verify",
        headers={"X-API-Key": api_key},
        data={"threshold": "0.6"},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400
    assert "images" in response.get_json()["message"]


def test_missing_threshold_is_bad_request(client, api_key):
    response = client.post(
        "/api/face-id/verify",
        headers={"X-API-Key": api_key},
        data={"images": (io.BytesIO(b"not-a-real-image"), "frame.jpg")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400
    assert "threshold" in response.get_json()["message"]


def test_invalid_candidates_json_is_bad_request(client, api_key):
    response = client.post(
        "/api/face-id/verify",
        headers={"X-API-Key": api_key},
        data={
            "images": (io.BytesIO(b"not-a-real-image"), "frame.jpg"),
            "threshold": "0.6",
            "candidates": "{not-json",
        },
        content_type="multipart/form-data",
    )
    assert response.status_code == 400
    assert "candidates" in response.get_json()["message"]


def test_wrong_embedding_dimension_is_bad_request(client, api_key):
    response = client.post(
        "/api/face-id/verify",
        headers={"X-API-Key": api_key},
        data={
            "images": (io.BytesIO(b"not-a-real-image"), "frame.jpg"),
            "threshold": "0.6",
            "candidates": '[{"id": 1, "embedding": [0.1, 0.2]}]',
        },
        content_type="multipart/form-data",
    )
    assert response.status_code == 400
    assert "512" in response.get_json()["message"]
