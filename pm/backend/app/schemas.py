from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class ApiModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


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
