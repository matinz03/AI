import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app


AUTH_HEADERS = {"X-Username": "user"}


@pytest.fixture()
def client(tmp_path: Path):
    original_db_path = app.state.db_path
    app.state.db_path = tmp_path / "data" / "pm.sqlite3"
    with TestClient(app) as test_client:
        yield test_client
    app.state.db_path = original_db_path


def board_response(client: TestClient) -> dict:
    response = client.get("/api/users/user/board", headers=AUTH_HEADERS)
    assert response.status_code == 200
    return response.json()


def test_missing_database_is_created_and_seeded_idempotently(client: TestClient) -> None:
    first = board_response(client)
    second = board_response(client)

    assert len(first["columns"]) == 5
    assert len(first["cards"]) == 8
    assert first == second
    assert [column["position"] for column in first["columns"]] == list(range(5))

    db_path = client.app.state.db_path
    assert db_path.exists()
    with sqlite3.connect(db_path) as connection:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
        assert {"schema_migrations", "users", "boards", "columns", "cards"} <= tables
        assert connection.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 1
        assert connection.execute("SELECT COUNT(*) FROM boards").fetchone()[0] == 1
        assert connection.execute("SELECT COUNT(*) FROM cards").fetchone()[0] == 8
        assert connection.execute("SELECT version FROM schema_migrations").fetchall() == [(1,)]


def test_authentication_and_ownership_are_enforced(client: TestClient) -> None:
    assert client.get("/api/users/user/board").status_code == 401
    assert client.get(
        "/api/users/user/board", headers={"X-Username": "someone"}
    ).status_code == 401
    assert client.get(
        "/api/users/other/board", headers=AUTH_HEADERS
    ).status_code == 401


def test_column_rename_and_card_lifecycle_persist(client: TestClient) -> None:
    renamed = client.patch(
        "/api/users/user/board/columns/col-backlog",
        headers=AUTH_HEADERS,
        json={"title": "Queue"},
    )
    assert renamed.status_code == 200
    renamed_column = next(
        column for column in renamed.json()["columns"] if column["id"] == "col-backlog"
    )
    assert renamed_column["title"] == "Queue"

    created = client.post(
        "/api/users/user/board/cards",
        headers=AUTH_HEADERS,
        json={
            "columnId": "col-backlog",
            "title": "New card",
            "details": "Notes",
        },
    )
    assert created.status_code == 201
    created_card = next(card for card in created.json()["cards"] if card["title"] == "New card")
    card_id = created_card["id"]
    assert created_card["position"] == 2

    edited = client.patch(
        f"/api/users/user/board/cards/{card_id}",
        headers=AUTH_HEADERS,
        json={"title": "Edited card", "details": "Updated notes"},
    )
    assert edited.status_code == 200
    edited_card = next(card for card in edited.json()["cards"] if card["id"] == card_id)
    assert edited_card["title"] == "Edited card"
    assert edited_card["details"] == "Updated notes"

    moved = client.post(
        f"/api/users/user/board/cards/{card_id}/move",
        headers=AUTH_HEADERS,
        json={"columnId": "col-done", "position": 0},
    )
    assert moved.status_code == 200
    moved_card = next(card for card in moved.json()["cards"] if card["id"] == card_id)
    assert moved_card["columnId"] == "col-done"
    assert moved_card["position"] == 0
    assert moved.json()["columns"][-1]["cardIds"][0] == card_id

    deleted = client.delete(
        f"/api/users/user/board/cards/{card_id}", headers=AUTH_HEADERS
    )
    assert deleted.status_code == 200
    assert all(card["id"] != card_id for card in deleted.json()["cards"])

    final_board = board_response(client)
    for column in final_board["columns"]:
        cards_in_column = [
            card for card in final_board["cards"] if card["columnId"] == column["id"]
        ]
        assert [card["position"] for card in cards_in_column] == list(range(len(cards_in_column)))


def test_invalid_payloads_and_missing_records_do_not_mutate_state(client: TestClient) -> None:
    before = board_response(client)

    assert client.post(
        "/api/users/user/board/cards",
        headers=AUTH_HEADERS,
        json={"columnId": "col-backlog", "title": ""},
    ).status_code == 422
    assert client.patch(
        "/api/users/user/board/cards/card-missing",
        headers=AUTH_HEADERS,
        json={"title": "Nope"},
    ).status_code == 404
    assert client.patch(
        "/api/users/user/board/columns/col-backlog",
        headers=AUTH_HEADERS,
        json={"title": ""},
    ).status_code == 422
    assert client.patch(
        "/api/users/user/board/cards/card-1", headers=AUTH_HEADERS, json={}
    ).status_code == 422
    assert client.post(
        "/api/users/user/board/cards/card-1/move",
        headers=AUTH_HEADERS,
        json={"columnId": "column-missing", "position": 0},
    ).status_code == 404

    after = board_response(client)
    assert after == before
