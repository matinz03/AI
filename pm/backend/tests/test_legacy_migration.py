import sqlite3
from pathlib import Path

from app.database import create_board, get_board, initialize_database, list_boards

LEGACY_SCHEMA_SQL = """
CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
);

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
);

CREATE TABLE boards (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE "columns" (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL,
    title TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (board_id, position),
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

CREATE TABLE cards (
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


def _seed_legacy_database(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    try:
        connection.executescript(LEGACY_SCHEMA_SQL)
        connection.execute(
            "INSERT INTO schema_migrations(version, applied_at) VALUES (1, '2026-01-01T00:00:00Z')"
        )
        connection.execute(
            "INSERT INTO users(id, username, created_at) VALUES (?, ?, ?)",
            ("user-default", "user", "2026-01-01T00:00:00Z"),
        )
        connection.execute(
            "INSERT INTO boards(id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            ("board-default", "user-default", "Product roadmap", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"),
        )
        connection.execute(
            'INSERT INTO "columns"(id, board_id, title, position, created_at, updated_at) '
            "VALUES (?, ?, ?, ?, ?, ?)",
            ("col-backlog", "board-default", "Backlog", 0, "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"),
        )
        connection.execute(
            "INSERT INTO cards(id, column_id, title, details, position, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            ("card-1", "col-backlog", "Align roadmap themes", "", 0, "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"),
        )
        connection.commit()
    finally:
        connection.close()


def test_migrating_a_pre_v2_database_adds_missing_columns(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    _seed_legacy_database(db_path)

    initialize_database(db_path)

    connection = sqlite3.connect(db_path)
    try:
        user_columns = {row[1] for row in connection.execute('PRAGMA table_info("users")')}
        card_columns = {row[1] for row in connection.execute('PRAGMA table_info("cards")')}
    finally:
        connection.close()
    assert "password_hash" in user_columns
    assert {"priority", "due_date"} <= card_columns


def test_migrating_preserves_existing_boards_columns_and_cards(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    _seed_legacy_database(db_path)

    initialize_database(db_path)
    board = get_board(db_path, "user-default", "board-default")

    assert board["board"]["name"] == "Product roadmap"
    assert [column["title"] for column in board["columns"]] == ["Backlog"]
    assert [card["title"] for card in board["cards"]] == ["Align roadmap themes"]
    assert board["cards"][0]["priority"] == "medium"
    assert board["cards"][0]["dueDate"] is None


def test_migrating_lets_a_legacy_user_create_a_second_board(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    _seed_legacy_database(db_path)

    initialize_database(db_path)
    create_board(db_path, "user-default", "Second board")

    boards = list_boards(db_path, "user-default")
    assert {board["name"] for board in boards} == {"Product roadmap", "Second board"}


def test_migration_is_idempotent(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    _seed_legacy_database(db_path)

    initialize_database(db_path)
    initialize_database(db_path)
    initialize_database(db_path)

    board = get_board(db_path, "user-default", "board-default")
    assert board["board"]["name"] == "Product roadmap"


def test_initializing_a_brand_new_database_is_unaffected(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"

    initialize_database(db_path)

    connection = sqlite3.connect(db_path)
    try:
        tables = {
            row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
        }
    finally:
        connection.close()
    assert "users" in tables
    assert list_boards(db_path, "any-user-id") == []
