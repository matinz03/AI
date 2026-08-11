from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client(tmp_path: Path):
    original_db_path = app.state.db_path
    app.state.db_path = tmp_path / "data" / "pm.sqlite3"
    with TestClient(app) as test_client:
        yield test_client
    app.state.db_path = original_db_path


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def register(client: TestClient, username: str = "alice", password: str = "password123") -> dict:
    response = client.post(
        "/api/auth/register", json={"username": username, "password": password}
    )
    assert response.status_code == 201, response.text
    data = response.json()
    return {"token": data["token"], "username": data["username"], "headers": auth_headers(data["token"])}


def first_board_id(client: TestClient, headers: dict) -> str:
    response = client.get("/api/boards", headers=headers)
    assert response.status_code == 200
    return response.json()["boards"][0]["id"]


@pytest.fixture()
def user(client: TestClient) -> dict:
    account = register(client)
    account["board_id"] = first_board_id(client, account["headers"])
    return account


def column_id_by_title(board: dict, title: str) -> str:
    return next(column["id"] for column in board["columns"] if column["title"] == title)
