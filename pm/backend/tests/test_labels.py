from fastapi.testclient import TestClient

from .conftest import column_id_by_title, first_board_id, register


def test_create_and_delete_label(client: TestClient, user: dict) -> None:
    headers = user["headers"]
    board_id = user["board_id"]

    created = client.post(
        f"/api/boards/{board_id}/labels", headers=headers, json={"name": "Urgent", "color": "yellow"}
    )
    assert created.status_code == 201
    labels = created.json()["labels"]
    assert len(labels) == 1
    assert labels[0]["name"] == "Urgent"
    assert labels[0]["color"] == "yellow"
    label_id = labels[0]["id"]

    deleted = client.delete(f"/api/boards/{board_id}/labels/{label_id}", headers=headers)
    assert deleted.status_code == 200
    assert deleted.json()["labels"] == []


def test_label_name_must_be_unique_per_board(client: TestClient, user: dict) -> None:
    headers = user["headers"]
    board_id = user["board_id"]
    client.post(f"/api/boards/{board_id}/labels", headers=headers, json={"name": "Urgent", "color": "yellow"})

    duplicate = client.post(
        f"/api/boards/{board_id}/labels", headers=headers, json={"name": "Urgent", "color": "blue"}
    )
    assert duplicate.status_code == 422


def test_label_color_must_be_from_the_fixed_palette(client: TestClient, user: dict) -> None:
    headers = user["headers"]
    board_id = user["board_id"]

    response = client.post(
        f"/api/boards/{board_id}/labels", headers=headers, json={"name": "Urgent", "color": "pink"}
    )
    assert response.status_code == 422


def test_attach_and_detach_label_from_a_card(client: TestClient, user: dict) -> None:
    headers = user["headers"]
    board_id = user["board_id"]
    board = client.get(f"/api/boards/{board_id}", headers=headers).json()
    backlog_id = column_id_by_title(board, "Backlog")

    label_id = client.post(
        f"/api/boards/{board_id}/labels", headers=headers, json={"name": "Urgent", "color": "yellow"}
    ).json()["labels"][0]["id"]
    created = client.post(
        f"/api/boards/{board_id}/columns/{backlog_id}/cards", headers=headers, json={"title": "Ship it"}
    )
    card_id = next(card for card in created.json()["cards"] if card["title"] == "Ship it")["id"]

    attached = client.post(
        f"/api/boards/{board_id}/cards/{card_id}/labels/{label_id}", headers=headers
    )
    assert attached.status_code == 201
    attached_card = next(card for card in attached.json()["cards"] if card["id"] == card_id)
    assert attached_card["labelIds"] == [label_id]

    detached = client.delete(
        f"/api/boards/{board_id}/cards/{card_id}/labels/{label_id}", headers=headers
    )
    assert detached.status_code == 200
    detached_card = next(card for card in detached.json()["cards"] if card["id"] == card_id)
    assert detached_card["labelIds"] == []


def test_attaching_a_label_twice_is_idempotent(client: TestClient, user: dict) -> None:
    headers = user["headers"]
    board_id = user["board_id"]
    board = client.get(f"/api/boards/{board_id}", headers=headers).json()
    backlog_id = column_id_by_title(board, "Backlog")
    label_id = client.post(
        f"/api/boards/{board_id}/labels", headers=headers, json={"name": "Urgent", "color": "yellow"}
    ).json()["labels"][0]["id"]
    created = client.post(
        f"/api/boards/{board_id}/columns/{backlog_id}/cards", headers=headers, json={"title": "Ship it"}
    )
    card_id = next(card for card in created.json()["cards"] if card["title"] == "Ship it")["id"]

    client.post(f"/api/boards/{board_id}/cards/{card_id}/labels/{label_id}", headers=headers)
    second = client.post(f"/api/boards/{board_id}/cards/{card_id}/labels/{label_id}", headers=headers)

    assert second.status_code == 201
    card = next(card for card in second.json()["cards"] if card["id"] == card_id)
    assert card["labelIds"] == [label_id]


def test_deleting_a_label_removes_it_from_cards(client: TestClient, user: dict) -> None:
    headers = user["headers"]
    board_id = user["board_id"]
    board = client.get(f"/api/boards/{board_id}", headers=headers).json()
    backlog_id = column_id_by_title(board, "Backlog")
    label_id = client.post(
        f"/api/boards/{board_id}/labels", headers=headers, json={"name": "Urgent", "color": "yellow"}
    ).json()["labels"][0]["id"]
    created = client.post(
        f"/api/boards/{board_id}/columns/{backlog_id}/cards", headers=headers, json={"title": "Ship it"}
    )
    card_id = next(card for card in created.json()["cards"] if card["title"] == "Ship it")["id"]
    client.post(f"/api/boards/{board_id}/cards/{card_id}/labels/{label_id}", headers=headers)

    deleted = client.delete(f"/api/boards/{board_id}/labels/{label_id}", headers=headers)
    card = next(card for card in deleted.json()["cards"] if card["id"] == card_id)
    assert card["labelIds"] == []


def test_labels_and_attachments_are_isolated_between_users(client: TestClient, user: dict) -> None:
    other = register(client, username="bob", password="password456")
    other["board_id"] = first_board_id(client, other["headers"])
    label_id = client.post(
        f"/api/boards/{user['board_id']}/labels",
        headers=user["headers"],
        json={"name": "Urgent", "color": "yellow"},
    ).json()["labels"][0]["id"]

    assert (
        client.delete(
            f"/api/boards/{user['board_id']}/labels/{label_id}", headers=other["headers"]
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/boards/{other['board_id']}/labels",
            headers=other["headers"],
            json={"name": "Urgent", "color": "blue"},
        ).status_code
        == 201
    )


def test_label_and_card_not_found_return_404(client: TestClient, user: dict) -> None:
    headers = user["headers"]
    board_id = user["board_id"]
    board = client.get(f"/api/boards/{board_id}", headers=headers).json()
    backlog_id = column_id_by_title(board, "Backlog")
    created = client.post(
        f"/api/boards/{board_id}/columns/{backlog_id}/cards", headers=headers, json={"title": "Ship it"}
    )
    card_id = next(card for card in created.json()["cards"] if card["title"] == "Ship it")["id"]

    assert client.delete(f"/api/boards/{board_id}/labels/missing-label", headers=headers).status_code == 404
    assert (
        client.post(
            f"/api/boards/{board_id}/cards/{card_id}/labels/missing-label", headers=headers
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/boards/{board_id}/cards/missing-card/labels/missing-label", headers=headers
        ).status_code
        == 404
    )
