from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import app.main as main
from app.openrouter import OpenRouterServiceError


AUTH_HEADERS = {"X-Username": "user"}


@pytest.fixture()
def client(tmp_path: Path):
    original_db_path = main.app.state.db_path
    main.app.state.db_path = tmp_path / "data" / "pm.sqlite3"
    with TestClient(main.app) as test_client:
        yield test_client
    main.app.state.db_path = original_db_path


def test_provider_failure_leaves_board_unchanged(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    before = client.get("/api/users/user/board", headers=AUTH_HEADERS).json()

    def fail(*args, **kwargs):
        raise OpenRouterServiceError("OpenRouter is unavailable.")

    monkeypatch.setattr(main, "request_board_response_from_provider", fail)

    response = client.post(
        "/api/users/user/board/chat",
        headers=AUTH_HEADERS,
        json={"question": "Create a card"},
    )

    assert response.status_code == 502
    assert response.json() == {"detail": "AI service is unavailable."}
    assert client.get("/api/users/user/board", headers=AUTH_HEADERS).json() == before
