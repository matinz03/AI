from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import app.main as main
from app.schemas import AIBoardResponse


AUTH_HEADERS = {"X-Username": "user"}


@pytest.fixture()
def client(tmp_path: Path):
    original_db_path = main.app.state.db_path
    main.app.state.db_path = tmp_path / "data" / "pm.sqlite3"
    with TestClient(main.app) as test_client:
        yield test_client
    main.app.state.db_path = original_db_path


def test_mocked_ai_response_updates_board_and_returns_assistant(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fake_response(board, question, history):
        assert question == "Rename backlog"
        assert history == []
        assert board["board"]["id"] == "board-default"
        return AIBoardResponse.model_validate(
            {
                "assistant": "Renamed backlog to Queue.",
                "operations": [
                    {
                        "type": "rename_column",
                        "columnId": "col-backlog",
                        "title": "Queue",
                    }
                ],
            }
        )

    monkeypatch.setattr(main, "request_board_response_from_provider", fake_response)

    response = client.post(
        "/api/users/user/board/chat",
        headers=AUTH_HEADERS,
        json={"question": "Rename backlog"},
    )

    assert response.status_code == 200
    assert response.json()["assistant"] == "Renamed backlog to Queue."
    assert response.json()["columns"][0]["title"] == "Queue"


def test_response_without_operations_leaves_board_unchanged(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    before = client.get("/api/users/user/board", headers=AUTH_HEADERS).json()
    monkeypatch.setattr(
        main,
        "request_board_response_from_provider",
        lambda board, question, history: AIBoardResponse(assistant="Here is the status."),
    )

    response = client.post(
        "/api/users/user/board/chat",
        headers=AUTH_HEADERS,
        json={"question": "What is in progress?"},
    )

    assert response.status_code == 200
    assert {key: response.json()[key] for key in ("board", "columns", "cards")} == before
