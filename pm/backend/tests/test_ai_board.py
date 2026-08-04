import json

import pytest

from app.ai_board import (
    AIResponseValidationError,
    build_ai_messages,
    request_board_response,
)
from app.schemas import ChatMessage


class FakeOpenRouterClient:
    def __init__(self, content: str) -> None:
        self.content = content
        self.messages: list[dict[str, str]] | None = None
        self.response_format: dict | None = None

    def complete_messages(
        self, messages: list[dict[str, str]], response_format: dict | None = None
    ) -> str:
        self.messages = messages
        self.response_format = response_format
        return self.content


def board_snapshot() -> dict:
    return {
        "board": {"id": "board-default"},
        "columns": [{"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1"]}],
        "cards": [{"id": "card-1", "columnId": "col-backlog", "title": "Existing"}],
    }


def test_messages_include_board_question_history_and_schema() -> None:
    history = [ChatMessage(role="user", content="Earlier question")]

    messages = build_ai_messages(board_snapshot(), "Rename backlog", history)

    assert len(messages) == 3
    assert messages[1] == {"role": "user", "content": "Earlier question"}
    assert json.loads(messages[-1]["content"]) == {
        "board": board_snapshot(),
        "question": "Rename backlog",
    }
    assert "rename_column" in messages[0]["content"]
    assert "create_card" in messages[0]["content"]


def test_valid_structured_response_parses_operations() -> None:
    client = FakeOpenRouterClient(
        '{"assistant":"Renamed it.","operations":[{"type":"rename_column","columnId":"col-backlog","title":"Queue"}]}'
    )

    response = request_board_response(client, board_snapshot(), "Rename backlog", [])

    assert response.assistant == "Renamed it."
    assert response.operations[0].model_dump(by_alias=True) == {
        "type": "rename_column",
        "columnId": "col-backlog",
        "title": "Queue",
    }
    assert client.response_format == {"type": "json_object"}


@pytest.mark.parametrize(
    "content",
    [
        "not json",
        '{"assistant":"Done","operations":[{"type":"delete_card","cardId":"card-1"}]}',
        '{"assistant":"Done","operations":[{"type":"update_card","cardId":"card-1"}]}',
    ],
)
def test_invalid_structured_response_is_rejected(content: str) -> None:
    with pytest.raises(AIResponseValidationError):
        request_board_response(FakeOpenRouterClient(content), board_snapshot(), "Change it", [])
