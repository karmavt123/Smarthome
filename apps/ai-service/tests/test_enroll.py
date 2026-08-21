"""Fixture-based cases (0 face / match / no-match) need real face images under
tests/fixtures/ — not present yet, add them before writing those cases (see spec
Testing section: no model mocking). These cover the request-validation paths only.
"""


def test_missing_api_key_is_unauthorized(client):
    response = client.post("/api/face-id/enroll")
    assert response.status_code == 401
    assert response.get_json()["message"] == "Unauthorized"


def test_wrong_api_key_is_unauthorized(client):
    response = client.post("/api/face-id/enroll", headers={"X-API-Key": "wrong"})
    assert response.status_code == 401


def test_missing_image_is_bad_request(client, api_key):
    response = client.post("/api/face-id/enroll", headers={"X-API-Key": api_key})
    assert response.status_code == 400
    assert "image" in response.get_json()["message"]
