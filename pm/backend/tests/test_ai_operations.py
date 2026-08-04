from pathlib import Path

import pytest

from app.database import DomainValidationError, apply_board_operations, get_board, initialize_database


def test_ai_operations_apply_create_edit_move_and_rename(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    initialize_database(db_path)

    result = apply_board_operations(
        db_path,
        "user",
        [
            {"type": "rename_column", "columnId": "col-backlog", "title": "Queue"},
            {
                "type": "create_card",
                "columnId": "col-backlog",
                "title": "AI task",
                "details": "Created by the assistant.",
            },
        ],
    )
    created = next(card for card in result["cards"] if card["title"] == "AI task")

    result = apply_board_operations(
        db_path,
        "user",
        [
            {
                "type": "update_card",
                "cardId": created["id"],
                "details": "Updated details.",
            },
            {
                "type": "move_card",
                "cardId": created["id"],
                "columnId": "col-done",
                "position": 0,
            },
        ],
    )

    assert result["columns"][0]["title"] == "Queue"
    updated = next(card for card in result["cards"] if card["id"] == created["id"])
    assert updated["details"] == "Updated details."
    assert updated["columnId"] == "col-done"


def test_invalid_ai_operation_rolls_back_every_change(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    initialize_database(db_path)
    before = get_board(db_path, "user")

    with pytest.raises(DomainValidationError):
        apply_board_operations(
            db_path,
            "user",
            [
                {"type": "rename_column", "columnId": "col-backlog", "title": "Queue"},
                {
                    "type": "update_card",
                    "cardId": "card-1",
                    "title": None,
                    "details": None,
                },
            ],
        )

    assert get_board(db_path, "user") == before
