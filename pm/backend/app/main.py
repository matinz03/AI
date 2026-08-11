from contextlib import asynccontextmanager
from pathlib import Path

from typing import Annotated, AsyncIterator

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.responses import FileResponse, HTMLResponse, JSONResponse, Response

from .ai_board import AIResponseValidationError, request_board_response_from_provider
from .database import (
    DEFAULT_DB_PATH,
    AuthenticationError,
    DomainValidationError,
    NotFoundError,
    apply_board_operations,
    attach_label,
    authenticate_user,
    create_board,
    create_card,
    create_column,
    create_label,
    create_session,
    create_user,
    delete_board,
    delete_card,
    delete_column,
    delete_label,
    detach_label,
    get_board,
    get_user_id_for_token,
    get_username,
    initialize_database,
    list_boards,
    move_card,
    rename_board,
    rename_column,
    revoke_session,
    update_card,
)
from .schemas import (
    AuthResponse,
    BoardChatRequest,
    BoardChatResponse,
    BoardCreateRequest,
    BoardListResponse,
    BoardRenameRequest,
    BoardResponse,
    CardCreateRequest,
    CardMoveRequest,
    CardUpdateRequest,
    ColumnCreateRequest,
    ColumnRenameRequest,
    LabelCreateRequest,
    LoginRequest,
    MeResponse,
    RegisterRequest,
)
from .openrouter import OpenRouterConfigurationError, OpenRouterServiceError

BASE_DIR = Path(__file__).resolve().parents[1]
STATIC_DIR = (BASE_DIR / "static").resolve()
INDEX_FILE = STATIC_DIR / "index.html"

bearer_scheme = HTTPBearer(auto_error=False)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    initialize_database(app.state.db_path)
    yield


app = FastAPI(title="Project Management API", version="0.2.0", lifespan=lifespan)
app.state.db_path = DEFAULT_DB_PATH


def get_db_path(request: Request) -> Path:
    return request.app.state.db_path


def get_current_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db_path: Annotated[Path, Depends(get_db_path)],
) -> str:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required.")
    try:
        return get_user_id_for_token(db_path, credentials.credentials)
    except AuthenticationError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


@app.exception_handler(NotFoundError)
async def not_found_handler(_: Request, exception: NotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(exception)})


@app.exception_handler(DomainValidationError)
async def domain_validation_handler(_: Request, exception: DomainValidationError):
    return JSONResponse(status_code=422, content={"detail": str(exception)})


@app.exception_handler(AuthenticationError)
async def authentication_handler(_: Request, exception: AuthenticationError):
    return JSONResponse(status_code=401, content={"detail": str(exception)})


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


# --- Auth --------------------------------------------------------------------


@app.post("/api/auth/register", response_model=AuthResponse, status_code=201, tags=["auth"])
def register(request: RegisterRequest, db_path: Annotated[Path, Depends(get_db_path)]):
    user = create_user(db_path, request.username, request.password)
    session = create_session(db_path, user["id"])
    return {"token": session["token"], "username": user["username"]}


@app.post("/api/auth/login", response_model=AuthResponse, tags=["auth"])
def login(request: LoginRequest, db_path: Annotated[Path, Depends(get_db_path)]):
    user_id = authenticate_user(db_path, request.username, request.password)
    session = create_session(db_path, user_id)
    return {"token": session["token"], "username": request.username}


@app.post("/api/auth/logout", status_code=204, tags=["auth"])
def logout(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db_path: Annotated[Path, Depends(get_db_path)],
) -> Response:
    if credentials is not None:
        revoke_session(db_path, credentials.credentials)
    return Response(status_code=204)


@app.get("/api/auth/me", response_model=MeResponse, tags=["auth"])
def me(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db_path: Annotated[Path, Depends(get_db_path)],
):
    return {"username": get_username(db_path, user_id)}


# --- Boards --------------------------------------------------------------------


@app.get("/api/boards", response_model=BoardListResponse, tags=["boards"])
def read_boards(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db_path: Annotated[Path, Depends(get_db_path)],
):
    return {"boards": list_boards(db_path, user_id)}


@app.post("/api/boards", response_model=BoardResponse, status_code=201, tags=["boards"])
def add_board(
    request: BoardCreateRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db_path: Annotated[Path, Depends(get_db_path)],
):
    return create_board(db_path, user_id, request.name)


@app.get("/api/boards/{board_id}", response_model=BoardResponse, tags=["boards"])
def read_board(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db_path: Annotated[Path, Depends(get_db_path)],
    board_id: str,
):
    return get_board(db_path, user_id, board_id)


@app.patch("/api/boards/{board_id}", response_model=BoardResponse, tags=["boards"])
def rename_user_board(
    request: BoardRenameRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db_path: Annotated[Path, Depends(get_db_path)],
    board_id: str,
):
    return rename_board(db_path, user_id, board_id, request.name)


@app.delete("/api/boards/{board_id}", response_model=BoardListResponse, tags=["boards"])
def remove_board(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db_path: Annotated[Path, Depends(get_db_path)],
    board_id: str,
):
    return {"boards": delete_board(db_path, user_id, board_id)}


# --- Columns -------------------------------------------------------------------


@app.post(
    "/api/boards/{board_id}/columns", response_model=BoardResponse, status_code=201, tags=["board"]
)
def add_board_column(
    request: ColumnCreateRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db_path: Annotated[Path, Depends(get_db_path)],
    board_id: str,
):
    return create_column(db_path, user_id, board_id, request.title)


@app.patch(
    "/api/boards/{board_id}/columns/{column_id}", response_model=BoardResponse, tags=["board"]
)
def rename_board_column(
    request: ColumnRenameRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db_path: Annotated[Path, Depends(get_db_path)],
    board_id: str,
    column_id: str,
):
    return rename_column(db_path, user_id, board_id, column_id, request.title)


@app.delete(
    "/api/boards/{board_id}/columns/{column_id}", response_model=BoardResponse, tags=["board"]
)
def remove_board_column(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db_path: Annotated[Path, Depends(get_db_path)],
    board_id: str,
    column_id: str,
):
    return delete_column(db_path, user_id, board_id, column_id)


# --- Labels --------------------------------------------------------------------


@app.post(
    "/api/boards/{board_id}/labels", response_model=BoardResponse, status_code=201, tags=["board"]
)
def add_board_label(
    request: LabelCreateRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db_path: Annotated[Path, Depends(get_db_path)],
    board_id: str,
):
    return create_label(db_path, user_id, board_id, request.name, request.color)


@app.delete(
    "/api/boards/{board_id}/labels/{label_id}", response_model=BoardResponse, tags=["board"]
)
def remove_board_label(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db_path: Annotated[Path, Depends(get_db_path)],
    board_id: str,
    label_id: str,
):
    return delete_label(db_path, user_id, board_id, label_id)


# --- Cards ---------------------------------------------------------------------


@app.post(
    "/api/boards/{board_id}/columns/{column_id}/cards",
    response_model=BoardResponse,
    status_code=201,
    tags=["board"],
)
def add_board_card(
    request: CardCreateRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db_path: Annotated[Path, Depends(get_db_path)],
    board_id: str,
    column_id: str,
):
    return create_card(
        db_path,
        user_id,
        board_id,
        column_id,
        request.title,
        request.details,
        request.priority,
        request.due_date,
    )


@app.patch("/api/boards/{board_id}/cards/{card_id}", response_model=BoardResponse, tags=["board"])
def edit_board_card(
    request: CardUpdateRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db_path: Annotated[Path, Depends(get_db_path)],
    board_id: str,
    card_id: str,
):
    return update_card(
        db_path,
        user_id,
        board_id,
        card_id,
        request.title,
        request.details,
        request.priority,
        request.due_date,
        request.clear_due_date,
    )


@app.post(
    "/api/boards/{board_id}/cards/{card_id}/move", response_model=BoardResponse, tags=["board"]
)
def move_board_card(
    request: CardMoveRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db_path: Annotated[Path, Depends(get_db_path)],
    board_id: str,
    card_id: str,
):
    return move_card(db_path, user_id, board_id, card_id, request.column_id, request.position)


@app.delete("/api/boards/{board_id}/cards/{card_id}", response_model=BoardResponse, tags=["board"])
def remove_board_card(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db_path: Annotated[Path, Depends(get_db_path)],
    board_id: str,
    card_id: str,
):
    return delete_card(db_path, user_id, board_id, card_id)


@app.post(
    "/api/boards/{board_id}/cards/{card_id}/labels/{label_id}",
    response_model=BoardResponse,
    status_code=201,
    tags=["board"],
)
def attach_board_card_label(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db_path: Annotated[Path, Depends(get_db_path)],
    board_id: str,
    card_id: str,
    label_id: str,
):
    return attach_label(db_path, user_id, board_id, card_id, label_id)


@app.delete(
    "/api/boards/{board_id}/cards/{card_id}/labels/{label_id}",
    response_model=BoardResponse,
    tags=["board"],
)
def detach_board_card_label(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db_path: Annotated[Path, Depends(get_db_path)],
    board_id: str,
    card_id: str,
    label_id: str,
):
    return detach_label(db_path, user_id, board_id, card_id, label_id)


# --- AI chat -------------------------------------------------------------------


@app.post("/api/boards/{board_id}/chat", response_model=BoardChatResponse, tags=["board"])
def chat_about_board(
    request: BoardChatRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db_path: Annotated[Path, Depends(get_db_path)],
    board_id: str,
):
    board = get_board(db_path, user_id, board_id)
    result = request_board_response_from_provider(board, request.question, request.history)
    updated_board = apply_board_operations(
        db_path,
        user_id,
        board_id,
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
