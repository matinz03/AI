import pytest
from fastapi.testclient import TestClient

import app.main as main
from app.ai_board import AIResponseValidationError
from app.openrouter import OpenRouterConfigurationError, OpenRouterServiceError


def test_provider_failure_leaves_board_unchanged(
    client: TestClient, user: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    board_id = user["board_id"]
    before = client.get(f"/api/boards/{board_id}", headers=user["headers"]).json()

    def fail(*args, **kwargs):
        raise OpenRouterServiceError("OpenRouter is unavailable.")

    monkeypatch.setattr(main, "request_board_response_from_provider", fail)

    response = client.post(
        f"/api/boards/{board_id}/chat",
        headers=user["headers"],
        json={"question": "Create a card"},
    )

    assert response.status_code == 502
    assert response.json() == {"detail": "AI service is unavailable."}
    assert client.get(f"/api/boards/{board_id}", headers=user["headers"]).json() == before


def test_missing_provider_configuration_is_reported_as_unavailable(
    client: TestClient, user: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fail(*args, **kwargs):
        raise OpenRouterConfigurationError("OPENROUTER_API_KEY is not set.")

    monkeypatch.setattr(main, "request_board_response_from_provider", fail)

    response = client.post(
        f"/api/boards/{user['board_id']}/chat",
        headers=user["headers"],
        json={"question": "Create a card"},
    )

    assert response.status_code == 503
    assert response.json() == {"detail": "AI service is not configured."}


def test_invalid_ai_response_is_reported_as_a_bad_gateway(
    client: TestClient, user: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fail(*args, **kwargs):
        raise AIResponseValidationError("OpenRouter returned an invalid board response.")

    monkeypatch.setattr(main, "request_board_response_from_provider", fail)

    response = client.post(
        f"/api/boards/{user['board_id']}/chat",
        headers=user["headers"],
        json={"question": "Create a card"},
    )

    assert response.status_code == 502
    assert response.json() == {"detail": "AI returned an invalid response."}
