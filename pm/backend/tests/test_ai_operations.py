from pathlib import Path

import pytest

from app.database import (
    DomainValidationError,
    NotFoundError,
    apply_board_operations,
    create_user,
    get_board,
    initialize_database,
    update_card,
)


def _column_id(board: dict, title: str) -> str:
    return next(column["id"] for column in board["columns"] if column["title"] == title)


def test_ai_operations_apply_create_edit_move_rename_and_add_column(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    initialize_database(db_path)
    account = create_user(db_path, "user", "password123")
    user_id, board_id = account["id"], account["boardId"]
    board = get_board(db_path, user_id, board_id)
    backlog_id = _column_id(board, "Backlog")
    done_id = _column_id(board, "Done")

    result = apply_board_operations(
        db_path,
        user_id,
        board_id,
        [
            {"type": "rename_column", "columnId": backlog_id, "title": "Queue"},
            {"type": "create_column", "title": "Blocked"},
            {
                "type": "create_card",
                "columnId": backlog_id,
                "title": "AI task",
                "details": "Created by the assistant.",
                "priority": "high",
                "dueDate": "2026-10-01",
            },
        ],
    )
    created = next(card for card in result["cards"] if card["title"] == "AI task")
    assert result["columns"][0]["title"] == "Queue"
    assert any(column["title"] == "Blocked" for column in result["columns"])
    assert created["priority"] == "high"
    assert created["dueDate"] == "2026-10-01"

    result = apply_board_operations(
        db_path,
        user_id,
        board_id,
        [
            {"type": "update_card", "cardId": created["id"], "details": "Updated details."},
            {"type": "move_card", "cardId": created["id"], "columnId": done_id, "position": 0},
        ],
    )

    updated = next(card for card in result["cards"] if card["id"] == created["id"])
    assert updated["details"] == "Updated details."
    assert updated["columnId"] == done_id


def test_invalid_ai_operation_rolls_back_every_change(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    initialize_database(db_path)
    account = create_user(db_path, "user", "password123")
    user_id, board_id = account["id"], account["boardId"]
    before = get_board(db_path, user_id, board_id)
    backlog_id = _column_id(before, "Backlog")

    with pytest.raises(DomainValidationError):
        apply_board_operations(
            db_path,
            user_id,
            board_id,
            [
                {"type": "rename_column", "columnId": backlog_id, "title": "Queue"},
                {"type": "unsupported_op", "cardId": "card-1"},
            ],
        )

    assert get_board(db_path, user_id, board_id) == before


def test_update_card_requires_at_least_one_field_at_the_database_layer(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    initialize_database(db_path)
    account = create_user(db_path, "user", "password123")
    user_id, board_id = account["id"], account["boardId"]
    board = get_board(db_path, user_id, board_id)
    backlog_id = _column_id(board, "Backlog")
    created = apply_board_operations(
        db_path,
        user_id,
        board_id,
        [{"type": "create_card", "columnId": backlog_id, "title": "Untouched", "details": ""}],
    )
    card_id = next(card for card in created["cards"] if card["title"] == "Untouched")["id"]

    with pytest.raises(DomainValidationError):
        update_card(db_path, user_id, board_id, card_id)


def test_ai_operations_cannot_touch_another_users_board(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    initialize_database(db_path)
    owner = create_user(db_path, "owner", "password123")
    intruder = create_user(db_path, "intruder", "password456")

    with pytest.raises(NotFoundError):
        apply_board_operations(
            db_path,
            intruder["id"],
            owner["boardId"],
            [{"type": "create_column", "title": "Hijacked"}],
        )
