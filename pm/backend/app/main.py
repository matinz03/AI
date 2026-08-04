from pathlib import Path

from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from starlette.responses import FileResponse, HTMLResponse, JSONResponse, Response

from .ai_board import AIResponseValidationError, request_board_response_from_provider
from .database import (
    DEFAULT_DB_PATH,
    DEFAULT_USERNAME,
    DomainValidationError,
    NotFoundError,
    apply_board_operations,
    create_card,
    delete_card,
    get_board,
    initialize_database,
    move_card,
    rename_column,
    update_card,
)
from .schemas import (
    BoardChatRequest,
    BoardChatResponse,
    BoardResponse,
    CardCreateRequest,
    CardMoveRequest,
    CardUpdateRequest,
    ColumnRenameRequest,
)
from .openrouter import OpenRouterConfigurationError, OpenRouterServiceError

BASE_DIR = Path(__file__).resolve().parents[1]
STATIC_DIR = (BASE_DIR / "static").resolve()
INDEX_FILE = STATIC_DIR / "index.html"

app = FastAPI(title="Project Management MVP API", version="0.1.0")
app.state.db_path = DEFAULT_DB_PATH


def get_db_path(request: Request) -> Path:
    db_path = request.app.state.db_path
    initialize_database(db_path)
    return db_path


def require_demo_user(
    username: str,
    x_username: Annotated[str | None, Header(alias="X-Username")] = None,
) -> str:
    if username != DEFAULT_USERNAME or x_username != DEFAULT_USERNAME:
        raise HTTPException(status_code=401, detail="Authentication required.")
    return username


@app.exception_handler(NotFoundError)
async def not_found_handler(_: Request, exception: NotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(exception)})


@app.exception_handler(DomainValidationError)
async def domain_validation_handler(_: Request, exception: DomainValidationError):
    return JSONResponse(status_code=422, content={"detail": str(exception)})


@app.exception_handler(OpenRouterConfigurationError)
async def openrouter_configuration_handler(
    _: Request, __: OpenRouterConfigurationError
):
    return JSONResponse(status_code=503, content={"detail": "AI service is not configured."})


@app.exception_handler(OpenRouterServiceError)
async def openrouter_service_handler(_: Request, __: OpenRouterServiceError):
    return JSONResponse(status_code=502, content={"detail": "AI service is unavailable."})


@app.exception_handler(AIResponseValidationError)
async def ai_response_validation_handler(_: Request, __: AIResponseValidationError):
    return JSONResponse(status_code=502, content={"detail": "AI returned an invalid response."})


@app.get("/api/health", tags=["system"])
def health() -> dict[str, str]:
    """Return a small readiness response for local and container checks."""

    return {"status": "ok"}


@app.get("/api/example", tags=["example"])
def example() -> dict[str, str]:
    """Return the example API response used by the Part 2 smoke test."""

    return {"message": "Hello from the PM backend"}


@app.get(
    "/api/users/{username}/board",
    response_model=BoardResponse,
    tags=["board"],
)
def read_board(
    _: Annotated[str, Depends(require_demo_user)],
    db_path: Annotated[Path, Depends(get_db_path)],
    username: str,
):
    return get_board(db_path, username)


@app.patch(
    "/api/users/{username}/board/columns/{column_id}",
    response_model=BoardResponse,
    tags=["board"],
)
def rename_board_column(
    request: ColumnRenameRequest,
    _: Annotated[str, Depends(require_demo_user)],
    db_path: Annotated[Path, Depends(get_db_path)],
    username: str,
    column_id: str,
):
    return rename_column(db_path, username, column_id, request.title)


@app.post(
    "/api/users/{username}/board/cards",
    response_model=BoardResponse,
    status_code=201,
    tags=["board"],
)
def add_board_card(
    request: CardCreateRequest,
    _: Annotated[str, Depends(require_demo_user)],
    db_path: Annotated[Path, Depends(get_db_path)],
    username: str,
):
    return create_card(db_path, username, request.column_id, request.title, request.details)


@app.patch(
    "/api/users/{username}/board/cards/{card_id}",
    response_model=BoardResponse,
    tags=["board"],
)
def edit_board_card(
    request: CardUpdateRequest,
    _: Annotated[str, Depends(require_demo_user)],
    db_path: Annotated[Path, Depends(get_db_path)],
    username: str,
    card_id: str,
):
    return update_card(db_path, username, card_id, request.title, request.details)


@app.post(
    "/api/users/{username}/board/cards/{card_id}/move",
    response_model=BoardResponse,
    tags=["board"],
)
def move_board_card(
    request: CardMoveRequest,
    _: Annotated[str, Depends(require_demo_user)],
    db_path: Annotated[Path, Depends(get_db_path)],
    username: str,
    card_id: str,
):
    return move_card(db_path, username, card_id, request.column_id, request.position)


@app.delete(
    "/api/users/{username}/board/cards/{card_id}",
    response_model=BoardResponse,
    tags=["board"],
)
def remove_board_card(
    _: Annotated[str, Depends(require_demo_user)],
    db_path: Annotated[Path, Depends(get_db_path)],
    username: str,
    card_id: str,
):
    return delete_card(db_path, username, card_id)


@app.post(
    "/api/users/{username}/board/chat",
    response_model=BoardChatResponse,
    tags=["board"],
)
def chat_about_board(
    request: BoardChatRequest,
    _: Annotated[str, Depends(require_demo_user)],
    db_path: Annotated[Path, Depends(get_db_path)],
    username: str,
):
    board = get_board(db_path, username)
    result = request_board_response_from_provider(board, request.question, request.history)
    updated_board = apply_board_operations(
        db_path,
        username,
        [operation.model_dump(by_alias=True, exclude_none=True) for operation in result.operations],
    )
    return {"assistant": result.assistant, **updated_board}


def _resolve_static_file(path: str) -> Path | None:
    candidate = (STATIC_DIR / path).resolve()

    try:
        candidate.relative_to(STATIC_DIR)
    except ValueError:
        return None

    return candidate if candidate.is_file() else None


@app.get("/", include_in_schema=False)
def index() -> Response:
    if INDEX_FILE.is_file():
        return FileResponse(INDEX_FILE)

    return HTMLResponse("<h1>Hello World</h1>")


@app.get("/{path:path}", include_in_schema=False)
def static_file(path: str) -> Response:
    if path == "api" or path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")

    file_path = _resolve_static_file(path)
    if file_path is not None:
        return FileResponse(file_path)

    if INDEX_FILE.is_file():
        return FileResponse(INDEX_FILE)

    return HTMLResponse("<h1>Not Found</h1>", status_code=404)
