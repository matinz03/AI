import json

from pydantic import ValidationError

from .openrouter import OpenRouterClient
from .schemas import AIBoardResponse, ChatMessage


class AIResponseValidationError(Exception):
    """Raised when the provider response is not a permitted board response."""


def build_ai_messages(
    board: dict, question: str, history: list[ChatMessage]
) -> list[dict[str, str]]:
    schema = json.dumps(AIBoardResponse.model_json_schema(), separators=(",", ":"))
    system_message = (
        "You are a project-management assistant. Return only JSON matching this schema: "
        f"{schema}. Use operations only when the user explicitly asks for a board change. "
        "Only reference IDs present in the current board."
    )
    messages = [{"role": "system", "content": system_message}]
    messages.extend(message.model_dump() for message in history)
    messages.append(
        {
            "role": "user",
            "content": json.dumps(
                {"board": board, "question": question}, separators=(",", ":")
            ),
        }
    )
    return messages


def request_board_response(
    client: OpenRouterClient, board: dict, question: str, history: list[ChatMessage]
) -> AIBoardResponse:
    content = client.complete_messages(
        build_ai_messages(board, question, history),
        response_format={"type": "json_object"},
    )
    try:
        return AIBoardResponse.model_validate_json(content)
    except (ValidationError, ValueError) as error:
        raise AIResponseValidationError(
            "OpenRouter returned an invalid board response."
        ) from error


def request_board_response_from_provider(
    board: dict, question: str, history: list[ChatMessage]
) -> AIBoardResponse:
    return request_board_response(OpenRouterClient(), board, question, history)
