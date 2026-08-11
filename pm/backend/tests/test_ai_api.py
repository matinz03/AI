import pytest
from fastapi.testclient import TestClient

import app.main as main
from app.schemas import AIBoardResponse

from .conftest import column_id_by_title, register


def test_mocked_ai_response_updates_board_and_returns_assistant(
    client: TestClient, user: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    board_id = user["board_id"]
    board = client.get(f"/api/boards/{board_id}", headers=user["headers"]).json()
    backlog_id = column_id_by_title(board, "Backlog")

    def fake_response(board, question, history):
        assert question == "Rename backlog"
        assert history == []
        assert board["board"]["id"] == board_id
        return AIBoardResponse.model_validate(
            {
                "assistant": "Renamed backlog to Queue.",
                "operations": [
                    {
                        "type": "rename_column",
                        "columnId": backlog_id,
                        "title": "Queue",
                    }
                ],
            }
        )

    monkeypatch.setattr(main, "request_board_response_from_provider", fake_response)

    response = client.post(
        f"/api/boards/{board_id}/chat",
        headers=user["headers"],
        json={"question": "Rename backlog"},
    )

    assert response.status_code == 200
    assert response.json()["assistant"] == "Renamed backlog to Queue."
    assert response.json()["columns"][0]["title"] == "Queue"


def test_response_without_operations_leaves_board_unchanged(
    client: TestClient, user: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    board_id = user["board_id"]
    before = client.get(f"/api/boards/{board_id}", headers=user["headers"]).json()
    monkeypatch.setattr(
        main,
        "request_board_response_from_provider",
        lambda board, question, history: AIBoardResponse(assistant="Here is the status."),
    )

    response = client.post(
        f"/api/boards/{board_id}/chat",
        headers=user["headers"],
        json={"question": "What is in progress?"},
    )

    assert response.status_code == 200
    assert {key: response.json()[key] for key in ("board", "columns", "cards", "labels")} == before


def test_chat_is_scoped_to_the_requesting_users_board(
    client: TestClient, user: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    other = register(client, username="dave", password="password123")
    monkeypatch.setattr(
        main,
        "request_board_response_from_provider",
        lambda board, question, history: AIBoardResponse(assistant="Should not run."),
    )

    response = client.post(
        f"/api/boards/{user['board_id']}/chat",
        headers=other["headers"],
        json={"question": "Anything?"},
    )

    assert response.status_code == 404
