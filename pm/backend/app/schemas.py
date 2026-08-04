from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ApiModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class BoardResponse(ApiModel):
    board: dict
    columns: list[dict]
    cards: list[dict]


class ColumnRenameRequest(BaseModel):
    title: Annotated[str, Field(min_length=1, max_length=200)]


class CardCreateRequest(ApiModel):
    column_id: Annotated[str, Field(alias="columnId", min_length=1)]
    title: Annotated[str, Field(min_length=1, max_length=200)]
    details: Annotated[str, Field(default="", max_length=5000)]


class CardUpdateRequest(BaseModel):
    title: Annotated[str | None, Field(default=None, min_length=1, max_length=200)] = None
    details: Annotated[str | None, Field(default=None, max_length=5000)] = None


class CardMoveRequest(ApiModel):
    column_id: Annotated[str, Field(alias="columnId", min_length=1)]
    position: Annotated[int, Field(ge=0)]


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


class CreateCardOperation(ApiModel):
    type: Literal["create_card"]
    column_id: Annotated[str, Field(alias="columnId", min_length=1)]
    title: Annotated[str, Field(min_length=1, max_length=200)]
    details: Annotated[str, Field(default="", max_length=5000)]


class UpdateCardOperation(ApiModel):
    type: Literal["update_card"]
    card_id: Annotated[str, Field(alias="cardId", min_length=1)]
    title: Annotated[str | None, Field(default=None, min_length=1, max_length=200)] = None
    details: Annotated[str | None, Field(default=None, max_length=5000)] = None

    @model_validator(mode="after")
    def requires_a_card_field(self):
        if self.title is None and self.details is None:
            raise ValueError("An update operation requires a title or details field.")
        return self


class MoveCardOperation(ApiModel):
    type: Literal["move_card"]
    card_id: Annotated[str, Field(alias="cardId", min_length=1)]
    column_id: Annotated[str, Field(alias="columnId", min_length=1)]
    position: Annotated[int, Field(ge=0)]


BoardOperation = Annotated[
    RenameColumnOperation | CreateCardOperation | UpdateCardOperation | MoveCardOperation,
    Field(discriminator="type"),
]


class AIBoardResponse(ApiModel):
    assistant: Annotated[str, Field(min_length=1, max_length=4000)]
    operations: Annotated[list[BoardOperation], Field(default_factory=list, max_length=20)]


class BoardChatResponse(BoardResponse):
    assistant: str
