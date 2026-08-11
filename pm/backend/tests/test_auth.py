import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

from .conftest import auth_headers, register


def test_register_creates_account_with_default_board(client: TestClient) -> None:
    account = register(client, username="alice", password="password123")

    assert account["username"] == "alice"
    boards = client.get("/api/boards", headers=account["headers"]).json()["boards"]
    assert len(boards) == 1
    assert boards[0]["name"] == "My board"
    assert boards[0]["cardCount"] == 0


def test_register_rejects_duplicate_username(client: TestClient) -> None:
    register(client, username="alice", password="password123")

    response = client.post(
        "/api/auth/register", json={"username": "alice", "password": "password456"}
    )

    assert response.status_code == 422


def test_register_rejects_short_password(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register", json={"username": "alice", "password": "short"}
    )

    assert response.status_code == 422


def test_login_succeeds_with_correct_credentials(client: TestClient) -> None:
    register(client, username="alice", password="password123")

    response = client.post(
        "/api/auth/login", json={"username": "alice", "password": "password123"}
    )

    assert response.status_code == 200
    assert response.json()["username"] == "alice"
    assert response.json()["token"]


def test_login_rejects_wrong_password(client: TestClient) -> None:
    register(client, username="alice", password="password123")

    response = client.post(
        "/api/auth/login", json={"username": "alice", "password": "wrong-password"}
    )

    assert response.status_code == 401


def test_login_rejects_unknown_username(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login", json={"username": "ghost", "password": "password123"}
    )

    assert response.status_code == 401


def test_me_returns_current_username(client: TestClient) -> None:
    account = register(client, username="alice", password="password123")

    response = client.get("/api/auth/me", headers=account["headers"])

    assert response.status_code == 200
    assert response.json() == {"username": "alice"}


def test_me_without_token_is_unauthorized(client: TestClient) -> None:
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers=auth_headers("not-a-real-token")).status_code == 401


def test_logout_revokes_the_session(client: TestClient) -> None:
    account = register(client, username="alice", password="password123")

    logout_response = client.post("/api/auth/logout", headers=account["headers"])
    assert logout_response.status_code == 204

    assert client.get("/api/auth/me", headers=account["headers"]).status_code == 401


def test_expired_session_is_rejected_and_cleaned_up(client: TestClient) -> None:
    account = register(client, username="alice", password="password123")
    db_path: Path = client.app.state.db_path

    with sqlite3.connect(db_path) as connection:
        connection.execute(
            "UPDATE sessions SET expires_at = '2000-01-01T00:00:00Z' WHERE token = ?",
            (account["token"],),
        )
        connection.commit()

    assert client.get("/api/auth/me", headers=account["headers"]).status_code == 401

    with sqlite3.connect(db_path) as connection:
        remaining = connection.execute(
            "SELECT COUNT(*) FROM sessions WHERE token = ?", (account["token"],)
        ).fetchone()[0]
    assert remaining == 0


def test_two_users_get_independent_accounts_and_boards(client: TestClient) -> None:
    alice = register(client, username="alice", password="password123")
    bob = register(client, username="bob", password="password456")

    alice_boards = client.get("/api/boards", headers=alice["headers"]).json()["boards"]
    bob_boards = client.get("/api/boards", headers=bob["headers"]).json()["boards"]

    assert {board["id"] for board in alice_boards}.isdisjoint(
        {board["id"] for board in bob_boards}
    )
