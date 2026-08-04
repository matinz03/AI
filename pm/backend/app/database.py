from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
import sqlite3
from typing import Iterator
from uuid import uuid4


DEFAULT_DB_PATH = Path(__file__).resolve().parents[1] / "data" / "pm.sqlite3"
DEFAULT_USERNAME = "user"
DEFAULT_USER_ID = "user-default"
DEFAULT_BOARD_ID = "board-default"
DEFAULT_BOARD_NAME = "Product roadmap"

DEFAULT_COLUMNS = (
    ("col-backlog", "Backlog", 0),
    ("col-discovery", "Discovery", 1),
    ("col-progress", "In Progress", 2),
    ("col-review", "Review", 3),
    ("col-done", "Done", 4),
)

DEFAULT_CARDS = (
    ("card-1", "col-backlog", "Align roadmap themes", "Draft quarterly themes with impact statements and metrics.", 0),
    ("card-2", "col-backlog", "Gather customer signals", "Review support tags, sales notes, and churn feedback.", 1),
    ("card-3", "col-discovery", "Prototype analytics view", "Sketch initial dashboard layout and key drill-downs.", 0),
    ("card-4", "col-progress", "Refine status language", "Standardize column labels and tone across the board.", 0),
    ("card-5", "col-progress", "Design card layout", "Add hierarchy and spacing for scanning dense lists.", 1),
    ("card-6", "col-review", "QA micro-interactions", "Verify hover, focus, and loading states.", 0),
    ("card-7", "col-done", "Ship marketing page", "Final copy approved and asset pack delivered.", 0),
    ("card-8", "col-done", "Close onboarding sprint", "Document release notes and share internally.", 1),
)

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
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
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (column_id, position),
    FOREIGN KEY (column_id) REFERENCES "columns"(id) ON DELETE CASCADE
);
"""


class NotFoundError(Exception):
    """Raised when a requested user-owned record does not exist."""


class DomainValidationError(Exception):
    """Raised when a validly shaped request cannot be applied to the board."""


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


def initialize_database(db_path: Path) -> None:
    with open_database(db_path) as connection:
        connection.executescript(SCHEMA_SQL)
        already_migrated = connection.execute(
            "SELECT 1 FROM schema_migrations WHERE version = 1"
        ).fetchone()
        now = utc_now()
        connection.execute(
            "INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)",
            (1, now),
        )
        connection.execute(
            "INSERT OR IGNORE INTO users(id, username, created_at) VALUES (?, ?, ?)",
            (DEFAULT_USER_ID, DEFAULT_USERNAME, now),
        )
        connection.execute(
            "INSERT OR IGNORE INTO boards(id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (DEFAULT_BOARD_ID, DEFAULT_USER_ID, DEFAULT_BOARD_NAME, now, now),
        )
        for column_id, title, position in DEFAULT_COLUMNS:
            connection.execute(
                """
                INSERT OR IGNORE INTO "columns"
                    (id, board_id, title, position, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (column_id, DEFAULT_BOARD_ID, title, position, now, now),
            )
        if already_migrated is None:
            for card_id, column_id, title, details, position in DEFAULT_CARDS:
                connection.execute(
                    """
                    INSERT OR IGNORE INTO cards
                        (id, column_id, title, details, position, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (card_id, column_id, title, details, position, now, now),
                )


def _require_text(value: str, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise DomainValidationError(f"{field_name} cannot be empty.")
    return normalized


def _get_board_id(connection: sqlite3.Connection, username: str) -> str:
    row = connection.execute(
        """
        SELECT boards.id
        FROM boards
        JOIN users ON users.id = boards.user_id
        WHERE users.username = ?
        """,
        (username,),
    ).fetchone()
    if row is None:
        raise NotFoundError("Board not found.")
    return row["id"]


def _get_column_for_user(
    connection: sqlite3.Connection, username: str, column_id: str
) -> sqlite3.Row:
    row = connection.execute(
        """
        SELECT columns.*
        FROM "columns" AS columns
        JOIN boards ON boards.id = columns.board_id
        JOIN users ON users.id = boards.user_id
        WHERE columns.id = ? AND users.username = ?
        """,
        (column_id, username),
    ).fetchone()
    if row is None:
        raise NotFoundError("Column not found.")
    return row


def _get_card_for_user(
    connection: sqlite3.Connection, username: str, card_id: str
) -> sqlite3.Row:
    row = connection.execute(
        """
        SELECT cards.*
        FROM cards
        JOIN "columns" AS columns ON columns.id = cards.column_id
        JOIN boards ON boards.id = columns.board_id
        JOIN users ON users.id = boards.user_id
        WHERE cards.id = ? AND users.username = ?
        """,
        (card_id, username),
    ).fetchone()
    if row is None:
        raise NotFoundError("Card not found.")
    return row


def get_board(db_path: Path, username: str) -> dict:
    with open_database(db_path) as connection:
        board_id = _get_board_id(connection, username)
        board = connection.execute(
            """
            SELECT boards.id, boards.user_id, boards.name, boards.created_at, boards.updated_at
            FROM boards
            JOIN users ON users.id = boards.user_id
            WHERE boards.id = ? AND users.username = ?
            """,
            (board_id, username),
        ).fetchone()
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
            SELECT cards.id, cards.column_id, cards.title, cards.details,
                   cards.position, cards.created_at, cards.updated_at
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


def _rename_column(
    connection: sqlite3.Connection, username: str, column_id: str, title: str
) -> None:
    normalized_title = _require_text(title, "Column title")
    column = _get_column_for_user(connection, username, column_id)
    connection.execute(
        'UPDATE "columns" SET title = ?, updated_at = ? WHERE id = ?',
        (normalized_title, utc_now(), column["id"]),
    )


def rename_column(db_path: Path, username: str, column_id: str, title: str) -> dict:
    with open_database(db_path) as connection:
        _rename_column(connection, username, column_id, title)
    return get_board(db_path, username)


def _create_card(
    connection: sqlite3.Connection,
    username: str,
    column_id: str,
    title: str,
    details: str,
) -> None:
    normalized_title = _require_text(title, "Card title")
    column = _get_column_for_user(connection, username, column_id)
    position_row = connection.execute(
        'SELECT COALESCE(MAX(position) + 1, 0) AS next_position FROM cards WHERE column_id = ?',
        (column["id"],),
    ).fetchone()
    now = utc_now()
    connection.execute(
        """
        INSERT INTO cards
            (id, column_id, title, details, position, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            f"card-{uuid4().hex}",
            column["id"],
            normalized_title,
            details,
            position_row["next_position"],
            now,
            now,
        ),
    )


def create_card(
    db_path: Path, username: str, column_id: str, title: str, details: str
) -> dict:
    with open_database(db_path) as connection:
        _create_card(connection, username, column_id, title, details)
    return get_board(db_path, username)


def _update_card(
    connection: sqlite3.Connection,
    username: str,
    card_id: str,
    title: str | None,
    details: str | None,
) -> dict:
    if title is None and details is None:
        raise DomainValidationError("At least one card field must be provided.")
    normalized_title = _require_text(title, "Card title") if title is not None else None
    card = _get_card_for_user(connection, username, card_id)
    connection.execute(
        """
        UPDATE cards
        SET title = COALESCE(?, title), details = COALESCE(?, details), updated_at = ?
        WHERE id = ?
        """,
        (normalized_title, details, utc_now(), card["id"]),
    )


def update_card(
    db_path: Path,
    username: str,
    card_id: str,
    title: str | None,
    details: str | None,
) -> dict:
    with open_database(db_path) as connection:
        _update_card(connection, username, card_id, title, details)
    return get_board(db_path, username)


def _rewrite_positions(
    connection: sqlite3.Connection, column_id: str, card_ids: list[str]
) -> None:
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
    username: str,
    card_id: str,
    target_column_id: str,
    position: int,
) -> None:
    card = _get_card_for_user(connection, username, card_id)
    source_column_id = card["column_id"]
    target_column = _get_column_for_user(connection, username, target_column_id)
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
    db_path: Path, username: str, card_id: str, target_column_id: str, position: int
) -> dict:
    with open_database(db_path) as connection:
        _move_card(connection, username, card_id, target_column_id, position)
    return get_board(db_path, username)


def apply_board_operations(db_path: Path, username: str, operations: list[dict]) -> dict:
    with open_database(db_path) as connection:
        for operation in operations:
            match operation["type"]:
                case "rename_column":
                    _rename_column(
                        connection, username, operation["columnId"], operation["title"]
                    )
                case "create_card":
                    _create_card(
                        connection,
                        username,
                        operation["columnId"],
                        operation["title"],
                        operation["details"],
                    )
                case "update_card":
                    _update_card(
                        connection,
                        username,
                        operation["cardId"],
                        operation.get("title"),
                        operation.get("details"),
                    )
                case "move_card":
                    _move_card(
                        connection,
                        username,
                        operation["cardId"],
                        operation["columnId"],
                        operation["position"],
                    )
                case _:
                    raise DomainValidationError("Unsupported board operation.")
    return get_board(db_path, username)


def delete_card(db_path: Path, username: str, card_id: str) -> dict:
    with open_database(db_path) as connection:
        card = _get_card_for_user(connection, username, card_id)
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
    return get_board(db_path, username)
