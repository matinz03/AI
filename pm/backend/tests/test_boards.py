from fastapi.testclient import TestClient

from .conftest import column_id_by_title, register


def test_create_list_rename_and_delete_board(client: TestClient, user: dict) -> None:
    headers = user["headers"]

    created = client.post("/api/boards", headers=headers, json={"name": "Marketing"})
    assert created.status_code == 201
    new_board_id = created.json()["board"]["id"]
    assert len(created.json()["columns"]) == 5

    boards = client.get("/api/boards", headers=headers).json()["boards"]
    assert {board["name"] for board in boards} == {"My board", "Marketing"}

    renamed = client.patch(
        f"/api/boards/{new_board_id}", headers=headers, json={"name": "Growth"}
    )
    assert renamed.status_code == 200
    assert renamed.json()["board"]["name"] == "Growth"

    deleted = client.delete(f"/api/boards/{new_board_id}", headers=headers)
    assert deleted.status_code == 200
    assert {board["id"] for board in deleted.json()["boards"]} == {user["board_id"]}

    assert client.get(f"/api/boards/{new_board_id}", headers=headers).status_code == 404


def test_boards_are_isolated_between_users(client: TestClient, user: dict) -> None:
    other = register(client, username="bob", password="password456")

    assert client.get(f"/api/boards/{user['board_id']}", headers=other["headers"]).status_code == 404
    assert (
        client.patch(
            f"/api/boards/{user['board_id']}", headers=other["headers"], json={"name": "Hijacked"}
        ).status_code
        == 404
    )
    assert client.delete(f"/api/boards/{user['board_id']}", headers=other["headers"]).status_code == 404


def test_board_requires_authentication(client: TestClient, user: dict) -> None:
    assert client.get(f"/api/boards/{user['board_id']}").status_code == 401
    assert client.get("/api/boards").status_code == 401


def test_add_rename_and_delete_column(client: TestClient, user: dict) -> None:
    headers = user["headers"]
    board_id = user["board_id"]

    added = client.post(
        f"/api/boards/{board_id}/columns", headers=headers, json={"title": "Blocked"}
    )
    assert added.status_code == 201
    columns = added.json()["columns"]
    assert [column["title"] for column in columns][-1] == "Blocked"
    assert [column["position"] for column in columns] == list(range(6))

    blocked_id = column_id_by_title(added.json(), "Blocked")
    renamed = client.patch(
        f"/api/boards/{board_id}/columns/{blocked_id}",
        headers=headers,
        json={"title": "On hold"},
    )
    assert renamed.status_code == 200
    assert any(column["title"] == "On hold" for column in renamed.json()["columns"])

    deleted = client.delete(f"/api/boards/{board_id}/columns/{blocked_id}", headers=headers)
    assert deleted.status_code == 200
    remaining = deleted.json()["columns"]
    assert len(remaining) == 5
    assert [column["position"] for column in remaining] == list(range(5))


def test_deleting_a_column_deletes_its_cards(client: TestClient, user: dict) -> None:
    headers = user["headers"]
    board_id = user["board_id"]
    board = client.get(f"/api/boards/{board_id}", headers=headers).json()
    backlog_id = column_id_by_title(board, "Backlog")

    client.post(
        f"/api/boards/{board_id}/columns/{backlog_id}/cards",
        headers=headers,
        json={"title": "Doomed card"},
    )

    result = client.delete(f"/api/boards/{board_id}/columns/{backlog_id}", headers=headers)
    assert result.status_code == 200
    assert all(card["title"] != "Doomed card" for card in result.json()["cards"])


def test_column_not_found_returns_404(client: TestClient, user: dict) -> None:
    headers = user["headers"]
    board_id = user["board_id"]

    assert (
        client.patch(
            f"/api/boards/{board_id}/columns/missing-column",
            headers=headers,
            json={"title": "Nope"},
        ).status_code
        == 404
    )
    assert (
        client.delete(
            f"/api/boards/{board_id}/columns/missing-column", headers=headers
        ).status_code
        == 404
    )
