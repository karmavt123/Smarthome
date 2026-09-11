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


def test_recognized_intent_returns_device_type_action_and_confidence(client, api_key, app):
    response = client.post(
        "/api/voice/intent", headers={"X-API-Key": api_key}, json={"text": "làm ơn tắt đèn phòng khách giúp tôi"}
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["deviceType"] == "light"
    assert body["action"] == "turn_off"
    # A 200 only happens above the configured threshold, so asserting >= 0.0 could never
    # fail. Read the threshold from config rather than hard-coding it: pinning 0.72 here
    # made the test fail for anyone running a lower threshold, even though the service was
    # behaving exactly as configured.
    assert body["confidence"] >= app.config["VOICE_INTENT_THRESHOLD"]


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


def test_non_object_json_body_is_bad_request(client, api_key):
    """get_json parses any valid JSON, so a bare array/string/number used to reach
    .get() and raise AttributeError -> 500 instead of a plain 400."""
    for payload in ("[1, 2]", '"hello"', "5", "true"):
        response = client.post(
            "/api/voice/intent",
            headers={"X-API-Key": api_key, "Content-Type": "application/json"},
            data=payload,
        )
        assert response.status_code == 400, f"body={payload!r} should be rejected"


def test_negation_is_refused(client, api_key):
    """The embedding model scores "đừng bật đèn" close to "bật đèn"; the regex in
    voice_intent_service is what stops a negated sentence turning the light on."""
    for text in ("đừng bật đèn", "không bật đèn", "khoan hãy tắt quạt"):
        response = client.post(
            "/api/voice/intent",
            headers={"X-API-Key": api_key},
            json={"text": text},
        )
        assert response.status_code == 422, f"{text!r} should not be recognised as a command"
