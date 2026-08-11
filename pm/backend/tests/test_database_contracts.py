from pathlib import Path

import pytest

from app.database import (
    DomainValidationError,
    NotFoundError,
    apply_board_operations,
    create_label,
    create_user,
    get_board,
    get_username,
    initialize_database,
)


def test_create_user_rejects_a_short_password_directly(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    initialize_database(db_path)

    with pytest.raises(DomainValidationError):
        create_user(db_path, "someone", "short")


def test_get_username_raises_for_an_unknown_user_id(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    initialize_database(db_path)

    with pytest.raises(NotFoundError):
        get_username(db_path, "user-does-not-exist")


def test_create_card_rejects_an_invalid_priority_directly(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    initialize_database(db_path)
    account = create_user(db_path, "user", "password123")
    user_id, board_id = account["id"], account["boardId"]
    board = get_board(db_path, user_id, board_id)
    backlog_id = next(column["id"] for column in board["columns"] if column["title"] == "Backlog")

    with pytest.raises(DomainValidationError):
        apply_board_operations(
            db_path,
            user_id,
            board_id,
            [
                {
                    "type": "create_card",
                    "columnId": backlog_id,
                    "title": "Bad priority",
                    "details": "",
                    "priority": "urgent",
                }
            ],
        )


def test_create_label_rejects_an_invalid_color_directly(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    initialize_database(db_path)
    account = create_user(db_path, "user", "password123")
    user_id, board_id = account["id"], account["boardId"]

    with pytest.raises(DomainValidationError):
        create_label(db_path, user_id, board_id, "Urgent", "pink")
