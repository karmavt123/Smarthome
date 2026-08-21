def test_missing_api_key_is_unauthorized(client):
    response = client.post("/api/voice/intent", json={"text": "bật đèn"})
    assert response.status_code == 401


def test_wrong_api_key_is_unauthorized(client):
    response = client.post(
        "/api/voice/intent", headers={"X-API-Key": "wrong"}, json={"text": "bật đèn"}
    )
    assert response.status_code == 401


def test_missing_text_is_bad_request(client, api_key):
    response = client.post("/api/voice/intent", headers={"X-API-Key": api_key}, json={})
    assert response.status_code == 400
    assert "text" in response.get_json()["message"]


def test_blank_text_is_bad_request(client, api_key):
    response = client.post(
        "/api/voice/intent", headers={"X-API-Key": api_key}, json={"text": "   "}
    )
    assert response.status_code == 400


def test_recognized_intent_returns_device_type_action_and_confidence(client, api_key):
    response = client.post(
        "/api/voice/intent", headers={"X-API-Key": api_key}, json={"text": "làm ơn tắt đèn phòng khách giúp tôi"}
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["deviceType"] == "light"
    assert body["action"] == "turn_off"
    assert 0.0 <= body["confidence"] <= 1.0


def test_recognized_intent_is_case_insensitive(client, api_key):
    response = client.post(
        "/api/voice/intent", headers={"X-API-Key": api_key}, json={"text": "Tắt đèn phòng khách"}
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["deviceType"] == "light"
    assert body["action"] == "turn_off"


def test_unrelated_text_is_unrecognized_intent(client, api_key):
    response = client.post(
        "/api/voice/intent", headers={"X-API-Key": api_key}, json={"text": "hôm nay trời đẹp quá"}
    )
    assert response.status_code == 422


def test_health_reports_models_loaded(client):
    response = client.get("/api/voice/health")
    assert response.status_code == 200
    assert response.get_json()["modelsLoaded"] is True
