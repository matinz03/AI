from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sqlite3
from typing import Iterator
from uuid import uuid4

from .auth import generate_session_token, hash_password, verify_password

SESSION_TTL_SECONDS = 60 * 60 * 24 * 30  # 30 days

DEFAULT_DB_PATH = Path(__file__).resolve().parents[1] / "data" / "pm.sqlite3"

DEFAULT_COLUMN_TITLES = ("Backlog", "Discovery", "In Progress", "Review", "Done")
PRIORITIES = ("low", "medium", "high")
DEFAULT_PRIORITY = "medium"

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "columns" (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL,
    title TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (board_id, position),
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    column_id TEXT NOT NULL,
    title TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'medium',
    due_date TEXT,
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (column_id, position),
    FOREIGN KEY (column_id) REFERENCES "columns"(id) ON DELETE CASCADE
);
"""

SCHEMA_VERSION = 2


class NotFoundError(Exception):
    """Raised when a requested user-owned record does not exist."""


class DomainValidationError(Exception):
    """Raised when a validly shaped request cannot be applied to the board."""


class AuthenticationError(Exception):
    """Raised when credentials or a session token are invalid."""


@contextmanager
def open_database(db_path: Path) -> Iterator[sqlite3.Connection]:
    db_path = Path(db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _parse_utc(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def initialize_database(db_path: Path) -> None:
    with open_database(db_path) as connection:
        connection.executescript(SCHEMA_SQL)
        connection.execute(
            "INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)",
            (SCHEMA_VERSION, utc_now()),
        )


def _require_text(value: str, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise DomainValidationError(f"{field_name} cannot be empty.")
    return normalized


def _require_priority(priority: str) -> str:
    if priority not in PRIORITIES:
        raise DomainValidationError(f"Priority must be one of: {', '.join(PRIORITIES)}.")
    return priority


# --- Users & sessions -------------------------------------------------------


def create_user(db_path: Path, username: str, password: str) -> dict:
    normalized_username = _require_text(username, "Username")
    if len(password) < 8:
        raise DomainValidationError("Password must be at least 8 characters.")
    with open_database(db_path) as connection:
        existing = connection.execute(
            "SELECT 1 FROM users WHERE username = ?", (normalized_username,)
        ).fetchone()
        if existing is not None:
            raise DomainValidationError("That username is already taken.")
        user_id = f"user-{uuid4().hex}"
        now = utc_now()
        connection.execute(
            "INSERT INTO users(id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (user_id, normalized_username, hash_password(password), now),
        )
        board_id = _create_board(connection, user_id, "My board")
    return {"id": user_id, "username": normalized_username, "boardId": board_id}


def authenticate_user(db_path: Path, username: str, password: str) -> str:
    with open_database(db_path) as connection:
        row = connection.execute(
            "SELECT id, password_hash FROM users WHERE username = ?", (username,)
        ).fetchone()
    if row is None or not verify_password(password, row["password_hash"]):
        raise AuthenticationError("Invalid username or password.")
    return row["id"]


def create_session(db_path: Path, user_id: str) -> dict:
    token = generate_session_token()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=SESSION_TTL_SECONDS)
    with open_database(db_path) as connection:
        connection.execute(
            "INSERT INTO sessions(token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (token, user_id, utc_now(), expires_at.isoformat().replace("+00:00", "Z")),
        )
    return {"token": token}


def get_user_id_for_token(db_path: Path, token: str) -> str:
    with open_database(db_path) as connection:
        row = connection.execute(
            "SELECT user_id, expires_at FROM sessions WHERE token = ?", (token,)
        ).fetchone()
    if row is None:
        raise AuthenticationError("Invalid session.")
    if _parse_utc(row["expires_at"]) <= datetime.now(timezone.utc):
        with open_database(db_path) as connection:
            connection.execute("DELETE FROM sessions WHERE token = ?", (token,))
        raise AuthenticationError("Session has expired.")
    return row["user_id"]


def revoke_session(db_path: Path, token: str) -> None:
    with open_database(db_path) as connection:
        connection.execute("DELETE FROM sessions WHERE token = ?", (token,))


def get_username(db_path: Path, user_id: str) -> str:
    with open_database(db_path) as connection:
        row = connection.execute(
            "SELECT username FROM users WHERE id = ?", (user_id,)
        ).fetchone()
    if row is None:
        raise NotFoundError("User not found.")
    return row["username"]


# --- Boards ------------------------------------------------------------------


def _get_board_for_user(connection: sqlite3.Connection, user_id: str, board_id: str) -> sqlite3.Row:
    row = connection.execute(
        "SELECT * FROM boards WHERE id = ? AND user_id = ?", (board_id, user_id)
    ).fetchone()
    if row is None:
        raise NotFoundError("Board not found.")
    return row


def _create_board(connection: sqlite3.Connection, user_id: str, name: str) -> str:
    board_id = f"board-{uuid4().hex}"
    now = utc_now()
    connection.execute(
        "INSERT INTO boards(id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (board_id, user_id, name, now, now),
    )
    for position, title in enumerate(DEFAULT_COLUMN_TITLES):
        connection.execute(
            """
            INSERT INTO "columns" (id, board_id, title, position, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (f"col-{uuid4().hex}", board_id, title, position, now, now),
        )
    return board_id


def list_boards(db_path: Path, user_id: str) -> list[dict]:
    with open_database(db_path) as connection:
        boards = connection.execute(
            """
            SELECT id, name, created_at, updated_at
            FROM boards
            WHERE user_id = ?
            ORDER BY created_at
            """,
            (user_id,),
        ).fetchall()
        summaries = []
        for board in boards:
            card_count = connection.execute(
                """
                SELECT COUNT(*) AS count
                FROM cards
                JOIN "columns" AS columns ON columns.id = cards.column_id
                WHERE columns.board_id = ?
                """,
                (board["id"],),
            ).fetchone()["count"]
            summaries.append(
                {
                    "id": board["id"],
                    "name": board["name"],
                    "createdAt": board["created_at"],
                    "updatedAt": board["updated_at"],
                    "cardCount": card_count,
                }
            )
    return summaries


def create_board(db_path: Path, user_id: str, name: str) -> dict:
    normalized_name = _require_text(name, "Board name")
    with open_database(db_path) as connection:
        board_id = _create_board(connection, user_id, normalized_name)
    return get_board(db_path, user_id, board_id)


def get_board(db_path: Path, user_id: str, board_id: str) -> dict:
    with open_database(db_path) as connection:
        board = _get_board_for_user(connection, user_id, board_id)
        columns = connection.execute(
            """
            SELECT id, title, position
            FROM "columns"
            WHERE board_id = ?
            ORDER BY position
            """,
            (board_id,),
        ).fetchall()
        cards = connection.execute(
            """
            SELECT cards.id, cards.column_id, cards.title, cards.details, cards.priority,
                   cards.due_date, cards.position, cards.created_at, cards.updated_at
            FROM cards
            JOIN "columns" AS columns ON columns.id = cards.column_id
            WHERE columns.board_id = ?
            ORDER BY cards.column_id, cards.position
            """,
            (board_id,),
        ).fetchall()

    card_rows = [
        {
            "id": card["id"],
            "columnId": card["column_id"],
            "title": card["title"],
            "details": card["details"],
            "priority": card["priority"],
            "dueDate": card["due_date"],
            "position": card["position"],
            "createdAt": card["created_at"],
            "updatedAt": card["updated_at"],
        }
        for card in cards
    ]
    card_ids_by_column: dict[str, list[str]] = {column["id"]: [] for column in columns}
    for card in card_rows:
        card_ids_by_column[card["columnId"]].append(card["id"])

    return {
        "board": {
            "id": board["id"],
            "userId": board["user_id"],
            "name": board["name"],
            "createdAt": board["created_at"],
            "updatedAt": board["updated_at"],
        },
        "columns": [
            {
                "id": column["id"],
                "title": column["title"],
                "position": column["position"],
                "cardIds": card_ids_by_column[column["id"]],
            }
            for column in columns
        ],
        "cards": card_rows,
    }


def rename_board(db_path: Path, user_id: str, board_id: str, name: str) -> dict:
    normalized_name = _require_text(name, "Board name")
    with open_database(db_path) as connection:
        _get_board_for_user(connection, user_id, board_id)
        connection.execute(
            "UPDATE boards SET name = ?, updated_at = ? WHERE id = ?",
            (normalized_name, utc_now(), board_id),
        )
    return get_board(db_path, user_id, board_id)


def delete_board(db_path: Path, user_id: str, board_id: str) -> list[dict]:
    with open_database(db_path) as connection:
        _get_board_for_user(connection, user_id, board_id)
        connection.execute("DELETE FROM boards WHERE id = ?", (board_id,))
    return list_boards(db_path, user_id)


# --- Columns -----------------------------------------------------------------


def _get_column_for_board(connection: sqlite3.Connection, board_id: str, column_id: str) -> sqlite3.Row:
    row = connection.execute(
        'SELECT * FROM "columns" WHERE id = ? AND board_id = ?', (column_id, board_id)
    ).fetchone()
    if row is None:
        raise NotFoundError("Column not found.")
    return row


def _rewrite_column_positions(connection: sqlite3.Connection, board_id: str, column_ids: list[str]) -> None:
    for temporary_position, column_id in enumerate(column_ids, start=1):
        connection.execute(
            'UPDATE "columns" SET position = ? WHERE id = ?', (-temporary_position, column_id)
        )
    for position, column_id in enumerate(column_ids):
        connection.execute(
            'UPDATE "columns" SET position = ?, updated_at = ? WHERE id = ?',
            (position, utc_now(), column_id),
        )


def _create_column(connection: sqlite3.Connection, user_id: str, board_id: str, title: str) -> None:
    normalized_title = _require_text(title, "Column title")
    _get_board_for_user(connection, user_id, board_id)
    position_row = connection.execute(
        'SELECT COALESCE(MAX(position) + 1, 0) AS next_position FROM "columns" WHERE board_id = ?',
        (board_id,),
    ).fetchone()
    now = utc_now()
    connection.execute(
        """
        INSERT INTO "columns" (id, board_id, title, position, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (f"col-{uuid4().hex}", board_id, normalized_title, position_row["next_position"], now, now),
    )


def create_column(db_path: Path, user_id: str, board_id: str, title: str) -> dict:
    with open_database(db_path) as connection:
        _create_column(connection, user_id, board_id, title)
    return get_board(db_path, user_id, board_id)


def _rename_column(
    connection: sqlite3.Connection, user_id: str, board_id: str, column_id: str, title: str
) -> None:
    normalized_title = _require_text(title, "Column title")
    _get_board_for_user(connection, user_id, board_id)
    column = _get_column_for_board(connection, board_id, column_id)
    connection.execute(
        'UPDATE "columns" SET title = ?, updated_at = ? WHERE id = ?',
        (normalized_title, utc_now(), column["id"]),
    )


def rename_column(db_path: Path, user_id: str, board_id: str, column_id: str, title: str) -> dict:
    with open_database(db_path) as connection:
        _rename_column(connection, user_id, board_id, column_id, title)
    return get_board(db_path, user_id, board_id)


def delete_column(db_path: Path, user_id: str, board_id: str, column_id: str) -> dict:
    with open_database(db_path) as connection:
        _get_board_for_user(connection, user_id, board_id)
        _get_column_for_board(connection, board_id, column_id)
        connection.execute('DELETE FROM "columns" WHERE id = ?', (column_id,))
        remaining_columns = [
            row["id"]
            for row in connection.execute(
                'SELECT id FROM "columns" WHERE board_id = ? ORDER BY position', (board_id,)
            ).fetchall()
        ]
        _rewrite_column_positions(connection, board_id, remaining_columns)
    return get_board(db_path, user_id, board_id)


# --- Cards -------------------------------------------------------------------


def _get_card_for_board(connection: sqlite3.Connection, board_id: str, card_id: str) -> sqlite3.Row:
    row = connection.execute(
        """
        SELECT cards.*
        FROM cards
        JOIN "columns" AS columns ON columns.id = cards.column_id
        WHERE cards.id = ? AND columns.board_id = ?
        """,
        (card_id, board_id),
    ).fetchone()
    if row is None:
        raise NotFoundError("Card not found.")
    return row


def _create_card(
    connection: sqlite3.Connection,
    user_id: str,
    board_id: str,
    column_id: str,
    title: str,
    details: str,
    priority: str,
    due_date: str | None,
) -> None:
    normalized_title = _require_text(title, "Card title")
    normalized_priority = _require_priority(priority)
    _get_board_for_user(connection, user_id, board_id)
    column = _get_column_for_board(connection, board_id, column_id)
    position_row = connection.execute(
        'SELECT COALESCE(MAX(position) + 1, 0) AS next_position FROM cards WHERE column_id = ?',
        (column["id"],),
    ).fetchone()
    now = utc_now()
    connection.execute(
        """
        INSERT INTO cards
            (id, column_id, title, details, priority, due_date, position, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            f"card-{uuid4().hex}",
            column["id"],
            normalized_title,
            details,
            normalized_priority,
            due_date,
            position_row["next_position"],
            now,
            now,
        ),
    )


def create_card(
    db_path: Path,
    user_id: str,
    board_id: str,
    column_id: str,
    title: str,
    details: str,
    priority: str = DEFAULT_PRIORITY,
    due_date: str | None = None,
) -> dict:
    with open_database(db_path) as connection:
        _create_card(connection, user_id, board_id, column_id, title, details, priority, due_date)
    return get_board(db_path, user_id, board_id)


def _update_card(
    connection: sqlite3.Connection,
    user_id: str,
    board_id: str,
    card_id: str,
    title: str | None,
    details: str | None,
    priority: str | None,
    due_date: str | None,
    clear_due_date: bool,
) -> None:
    if title is None and details is None and priority is None and due_date is None and not clear_due_date:
        raise DomainValidationError("At least one card field must be provided.")
    normalized_title = _require_text(title, "Card title") if title is not None else None
    normalized_priority = _require_priority(priority) if priority is not None else None
    _get_board_for_user(connection, user_id, board_id)
    card = _get_card_for_board(connection, board_id, card_id)
    next_due_date = None if clear_due_date else due_date
    connection.execute(
        """
        UPDATE cards
        SET title = COALESCE(?, title),
            details = COALESCE(?, details),
            priority = COALESCE(?, priority),
            due_date = CASE WHEN ? THEN NULL ELSE COALESCE(?, due_date) END,
            updated_at = ?
        WHERE id = ?
        """,
        (
            normalized_title,
            details,
            normalized_priority,
            clear_due_date,
            next_due_date,
            utc_now(),
            card["id"],
        ),
    )


def update_card(
    db_path: Path,
    user_id: str,
    board_id: str,
    card_id: str,
    title: str | None = None,
    details: str | None = None,
    priority: str | None = None,
    due_date: str | None = None,
    clear_due_date: bool = False,
) -> dict:
    with open_database(db_path) as connection:
        _update_card(
            connection, user_id, board_id, card_id, title, details, priority, due_date, clear_due_date
        )
    return get_board(db_path, user_id, board_id)


def _rewrite_positions(connection: sqlite3.Connection, column_id: str, card_ids: list[str]) -> None:
    for temporary_position, card_id in enumerate(card_ids, start=1):
        connection.execute(
            "UPDATE cards SET position = ? WHERE id = ?",
            (-temporary_position, card_id),
        )
    for position, card_id in enumerate(card_ids):
        connection.execute(
            "UPDATE cards SET column_id = ?, position = ?, updated_at = ? WHERE id = ?",
            (column_id, position, utc_now(), card_id),
        )


def _move_card(
    connection: sqlite3.Connection,
    user_id: str,
    board_id: str,
    card_id: str,
    target_column_id: str,
    position: int,
) -> None:
    _get_board_for_user(connection, user_id, board_id)
    card = _get_card_for_board(connection, board_id, card_id)
    source_column_id = card["column_id"]
    target_column = _get_column_for_board(connection, board_id, target_column_id)
    source_cards = [
        row["id"]
        for row in connection.execute(
            'SELECT id FROM cards WHERE column_id = ? ORDER BY position',
            (source_column_id,),
        ).fetchall()
        if row["id"] != card_id
    ]
    target_cards = [
        row["id"]
        for row in connection.execute(
            'SELECT id FROM cards WHERE column_id = ? ORDER BY position',
            (target_column["id"],),
        ).fetchall()
        if row["id"] != card_id
    ]
    target_position = min(position, len(target_cards))
    target_cards.insert(target_position, card_id)

    if source_column_id == target_column["id"]:
        _rewrite_positions(connection, source_column_id, target_cards)
    else:
        connection.execute(
            "UPDATE cards SET position = ? WHERE id = ?",
            (-10000000, card_id),
        )
        _rewrite_positions(connection, source_column_id, source_cards)
        _rewrite_positions(connection, target_column["id"], target_cards)


def move_card(
    db_path: Path, user_id: str, board_id: str, card_id: str, target_column_id: str, position: int
) -> dict:
    with open_database(db_path) as connection:
        _move_card(connection, user_id, board_id, card_id, target_column_id, position)
    return get_board(db_path, user_id, board_id)


def apply_board_operations(db_path: Path, user_id: str, board_id: str, operations: list[dict]) -> dict:
    with open_database(db_path) as connection:
        _get_board_for_user(connection, user_id, board_id)
        for operation in operations:
            match operation["type"]:
                case "rename_column":
                    _rename_column(
                        connection, user_id, board_id, operation["columnId"], operation["title"]
                    )
                case "create_column":
                    _create_column(connection, user_id, board_id, operation["title"])
                case "create_card":
                    _create_card(
                        connection,
                        user_id,
                        board_id,
                        operation["columnId"],
                        operation["title"],
                        operation["details"],
                        operation.get("priority") or DEFAULT_PRIORITY,
                        operation.get("dueDate"),
                    )
                case "update_card":
                    _update_card(
                        connection,
                        user_id,
                        board_id,
                        operation["cardId"],
                        operation.get("title"),
                        operation.get("details"),
                        operation.get("priority"),
                        operation.get("dueDate"),
                        False,
                    )
                case "move_card":
                    _move_card(
                        connection,
                        user_id,
                        board_id,
                        operation["cardId"],
                        operation["columnId"],
                        operation["position"],
                    )
                case _:
                    raise DomainValidationError("Unsupported board operation.")
    return get_board(db_path, user_id, board_id)


def delete_card(db_path: Path, user_id: str, board_id: str, card_id: str) -> dict:
    with open_database(db_path) as connection:
        _get_board_for_user(connection, user_id, board_id)
        card = _get_card_for_board(connection, board_id, card_id)
        column_id = card["column_id"]
        connection.execute("DELETE FROM cards WHERE id = ?", (card["id"],))
        remaining_cards = [
            row["id"]
            for row in connection.execute(
                'SELECT id FROM cards WHERE column_id = ? ORDER BY position',
                (column_id,),
            ).fetchall()
        ]
        _rewrite_positions(connection, column_id, remaining_cards)
    return get_board(db_path, user_id, board_id)
