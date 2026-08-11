from fastapi.testclient import TestClient

from .conftest import column_id_by_title, register


def board_response(client: TestClient, headers: dict, board_id: str) -> dict:
    response = client.get(f"/api/boards/{board_id}", headers=headers)
    assert response.status_code == 200
    return response.json()


def test_registering_seeds_an_empty_board_with_five_default_columns(
    client: TestClient, user: dict
) -> None:
    board = board_response(client, user["headers"], user["board_id"])

    assert [column["title"] for column in board["columns"]] == [
        "Backlog",
        "Discovery",
        "In Progress",
        "Review",
        "Done",
    ]
    assert board["cards"] == []
    assert [column["position"] for column in board["columns"]] == list(range(5))


def test_card_lifecycle_with_priority_and_due_date_persists(
    client: TestClient, user: dict
) -> None:
    headers = user["headers"]
    board_id = user["board_id"]
    board = board_response(client, headers, board_id)
    backlog_id = column_id_by_title(board, "Backlog")
    done_id = column_id_by_title(board, "Done")

    created = client.post(
        f"/api/boards/{board_id}/columns/{backlog_id}/cards",
        headers=headers,
        json={"title": "New card", "details": "Notes", "priority": "high", "dueDate": "2026-09-01"},
    )
    assert created.status_code == 201
    created_card = next(card for card in created.json()["cards"] if card["title"] == "New card")
    card_id = created_card["id"]
    assert created_card["position"] == 0
    assert created_card["priority"] == "high"
    assert created_card["dueDate"] == "2026-09-01"

    edited = client.patch(
        f"/api/boards/{board_id}/cards/{card_id}",
        headers=headers,
        json={"title": "Edited card", "details": "Updated notes", "priority": "low"},
    )
    assert edited.status_code == 200
    edited_card = next(card for card in edited.json()["cards"] if card["id"] == card_id)
    assert edited_card["title"] == "Edited card"
    assert edited_card["details"] == "Updated notes"
    assert edited_card["priority"] == "low"
    assert edited_card["dueDate"] == "2026-09-01"

    cleared = client.patch(
        f"/api/boards/{board_id}/cards/{card_id}",
        headers=headers,
        json={"clearDueDate": True},
    )
    assert cleared.status_code == 200
    cleared_card = next(card for card in cleared.json()["cards"] if card["id"] == card_id)
    assert cleared_card["dueDate"] is None

    moved = client.post(
        f"/api/boards/{board_id}/cards/{card_id}/move",
        headers=headers,
        json={"columnId": done_id, "position": 0},
    )
    assert moved.status_code == 200
    moved_card = next(card for card in moved.json()["cards"] if card["id"] == card_id)
    assert moved_card["columnId"] == done_id
    assert moved_card["position"] == 0

    deleted = client.delete(f"/api/boards/{board_id}/cards/{card_id}", headers=headers)
    assert deleted.status_code == 200
    assert all(card["id"] != card_id for card in deleted.json()["cards"])


def test_new_card_defaults_to_medium_priority_and_no_due_date(
    client: TestClient, user: dict
) -> None:
    headers = user["headers"]
    board_id = user["board_id"]
    board = board_response(client, headers, board_id)
    backlog_id = column_id_by_title(board, "Backlog")

    created = client.post(
        f"/api/boards/{board_id}/columns/{backlog_id}/cards",
        headers=headers,
        json={"title": "Plain card"},
    )
    card = next(card for card in created.json()["cards"] if card["title"] == "Plain card")

    assert card["priority"] == "medium"
    assert card["dueDate"] is None


def test_card_positions_stay_contiguous_after_moves_and_deletes(
    client: TestClient, user: dict
) -> None:
    headers = user["headers"]
    board_id = user["board_id"]
    board = board_response(client, headers, board_id)
    backlog_id = column_id_by_title(board, "Backlog")

    for title in ("First", "Second", "Third"):
        client.post(
            f"/api/boards/{board_id}/columns/{backlog_id}/cards",
            headers=headers,
            json={"title": title},
        )

    first_card = next(
        card
        for card in board_response(client, headers, board_id)["cards"]
        if card["title"] == "First"
    )
    client.delete(f"/api/boards/{board_id}/cards/{first_card['id']}", headers=headers)

    final_board = board_response(client, headers, board_id)
    for column in final_board["columns"]:
        cards_in_column = [
            card for card in final_board["cards"] if card["columnId"] == column["id"]
        ]
        assert [card["position"] for card in cards_in_column] == list(range(len(cards_in_column)))


def test_reordering_cards_within_the_same_column(client: TestClient, user: dict) -> None:
    headers = user["headers"]
    board_id = user["board_id"]
    board = board_response(client, headers, board_id)
    backlog_id = column_id_by_title(board, "Backlog")

    for title in ("First", "Second"):
        client.post(
            f"/api/boards/{board_id}/columns/{backlog_id}/cards",
            headers=headers,
            json={"title": title},
        )
    cards = board_response(client, headers, board_id)["cards"]
    first_id = next(card["id"] for card in cards if card["title"] == "First")
    second_id = next(card["id"] for card in cards if card["title"] == "Second")

    moved = client.post(
        f"/api/boards/{board_id}/cards/{second_id}/move",
        headers=headers,
        json={"columnId": backlog_id, "position": 0},
    )
    assert moved.status_code == 200
    backlog_cards = [
        card for card in moved.json()["cards"] if card["columnId"] == backlog_id
    ]
    ordered_ids = sorted(backlog_cards, key=lambda card: card["position"])
    assert [card["id"] for card in ordered_ids] == [second_id, first_id]


def test_invalid_payloads_and_missing_records_do_not_mutate_state(
    client: TestClient, user: dict
) -> None:
    headers = user["headers"]
    board_id = user["board_id"]
    board = board_response(client, headers, board_id)
    backlog_id = column_id_by_title(board, "Backlog")
    before = board_response(client, headers, board_id)

    assert (
        client.post(
            f"/api/boards/{board_id}/columns/{backlog_id}/cards",
            headers=headers,
            json={"title": ""},
        ).status_code
        == 422
    )
    assert (
        client.patch(
            f"/api/boards/{board_id}/cards/card-missing", headers=headers, json={"title": "Nope"}
        ).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/boards/{board_id}/cards/card-missing", headers=headers, json={}
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"/api/boards/{board_id}/cards/card-missing/move",
            headers=headers,
            json={"columnId": "column-missing", "position": 0},
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/boards/{board_id}/columns/{backlog_id}/cards",
            headers=headers,
            json={"title": "Bad priority", "priority": "urgent"},
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"/api/boards/{board_id}/columns/{backlog_id}/cards",
            headers=headers,
            json={"title": "   "},
        ).status_code
        == 422
    )

    after = board_response(client, headers, board_id)
    assert after == before


def test_cards_are_isolated_between_users(client: TestClient, user: dict) -> None:
    other = register(client, username="carol", password="password789")
    board = board_response(client, user["headers"], user["board_id"])
    backlog_id = column_id_by_title(board, "Backlog")

    created = client.post(
        f"/api/boards/{user['board_id']}/columns/{backlog_id}/cards",
        headers=user["headers"],
        json={"title": "Private card"},
    )
    card_id = next(card for card in created.json()["cards"] if card["title"] == "Private card")["id"]

    assert (
        client.patch(
            f"/api/boards/{user['board_id']}/cards/{card_id}",
            headers=other["headers"],
            json={"title": "Hijacked"},
        ).status_code
        == 404
    )
