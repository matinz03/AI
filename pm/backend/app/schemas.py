from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Priority = Literal["low", "medium", "high"]
DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"


class ApiModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


# --- Auth ---------------------------------------------------------------


class RegisterRequest(ApiModel):
    username: Annotated[str, Field(min_length=1, max_length=50)]
    password: Annotated[str, Field(min_length=8, max_length=200)]


class LoginRequest(ApiModel):
    username: Annotated[str, Field(min_length=1, max_length=50)]
    password: Annotated[str, Field(min_length=1, max_length=200)]


class AuthResponse(ApiModel):
    token: str
    username: str


class MeResponse(ApiModel):
    username: str


# --- Boards ---------------------------------------------------------------


class BoardSummary(ApiModel):
    id: str
    name: str
    created_at: Annotated[str, Field(alias="createdAt")]
    updated_at: Annotated[str, Field(alias="updatedAt")]
    card_count: Annotated[int, Field(alias="cardCount")]


class BoardListResponse(ApiModel):
    boards: list[BoardSummary]


class BoardCreateRequest(ApiModel):
    name: Annotated[str, Field(min_length=1, max_length=200)]


class BoardRenameRequest(ApiModel):
    name: Annotated[str, Field(min_length=1, max_length=200)]


class BoardResponse(ApiModel):
    board: dict
    columns: list[dict]
    cards: list[dict]


# --- Columns ---------------------------------------------------------------


class ColumnCreateRequest(ApiModel):
    title: Annotated[str, Field(min_length=1, max_length=200)]


class ColumnRenameRequest(BaseModel):
    title: Annotated[str, Field(min_length=1, max_length=200)]


# --- Cards ---------------------------------------------------------------


class CardCreateRequest(ApiModel):
    title: Annotated[str, Field(min_length=1, max_length=200)]
    details: Annotated[str, Field(default="", max_length=5000)]
    priority: Annotated[Priority, Field(default="medium")]
    due_date: Annotated[str | None, Field(default=None, alias="dueDate", pattern=DATE_PATTERN)] = None


class CardUpdateRequest(BaseModel):
    title: Annotated[str | None, Field(default=None, min_length=1, max_length=200)] = None
    details: Annotated[str | None, Field(default=None, max_length=5000)] = None
    priority: Annotated[Priority | None, Field(default=None)] = None
    due_date: Annotated[str | None, Field(default=None, pattern=DATE_PATTERN)] = Field(
        default=None, alias="dueDate"
    )
    clear_due_date: Annotated[bool, Field(default=False, alias="clearDueDate")] = False

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    @model_validator(mode="after")
    def requires_a_field(self):
        if (
            self.title is None
            and self.details is None
            and self.priority is None
            and self.due_date is None
            and not self.clear_due_date
        ):
            raise ValueError("At least one card field must be provided.")
        return self


class CardMoveRequest(ApiModel):
    column_id: Annotated[str, Field(alias="columnId", min_length=1)]
    position: Annotated[int, Field(ge=0)]


# --- AI chat ---------------------------------------------------------------


class ChatMessage(ApiModel):
    role: Literal["user", "assistant"]
    content: Annotated[str, Field(min_length=1, max_length=2000)]


class BoardChatRequest(ApiModel):
    question: Annotated[str, Field(min_length=1, max_length=2000)]
    history: Annotated[list[ChatMessage], Field(default_factory=list, max_length=20)]


class RenameColumnOperation(ApiModel):
    type: Literal["rename_column"]
    column_id: Annotated[str, Field(alias="columnId", min_length=1)]
    title: Annotated[str, Field(min_length=1, max_length=200)]


class CreateColumnOperation(ApiModel):
    type: Literal["create_column"]
    title: Annotated[str, Field(min_length=1, max_length=200)]


class CreateCardOperation(ApiModel):
    type: Literal["create_card"]
    column_id: Annotated[str, Field(alias="columnId", min_length=1)]
    title: Annotated[str, Field(min_length=1, max_length=200)]
    details: Annotated[str, Field(default="", max_length=5000)]
    priority: Annotated[Priority | None, Field(default=None)] = None
    due_date: Annotated[str | None, Field(default=None, alias="dueDate", pattern=DATE_PATTERN)] = None


class UpdateCardOperation(ApiModel):
    type: Literal["update_card"]
    card_id: Annotated[str, Field(alias="cardId", min_length=1)]
    title: Annotated[str | None, Field(default=None, min_length=1, max_length=200)] = None
    details: Annotated[str | None, Field(default=None, max_length=5000)] = None
    priority: Annotated[Priority | None, Field(default=None)] = None
    due_date: Annotated[str | None, Field(default=None, alias="dueDate", pattern=DATE_PATTERN)] = None

    @model_validator(mode="after")
    def requires_a_card_field(self):
        if self.title is None and self.details is None and self.priority is None and self.due_date is None:
            raise ValueError("An update operation requires at least one field to change.")
        return self


class MoveCardOperation(ApiModel):
    type: Literal["move_card"]
    card_id: Annotated[str, Field(alias="cardId", min_length=1)]
    column_id: Annotated[str, Field(alias="columnId", min_length=1)]
    position: Annotated[int, Field(ge=0)]


BoardOperation = Annotated[
    RenameColumnOperation
    | CreateColumnOperation
    | CreateCardOperation
    | UpdateCardOperation
    | MoveCardOperation,
    Field(discriminator="type"),
]


class AIBoardResponse(ApiModel):
    assistant: Annotated[str, Field(min_length=1, max_length=4000)]
    operations: Annotated[list[BoardOperation], Field(default_factory=list, max_length=20)]


class BoardChatResponse(BoardResponse):
    assistant: str
