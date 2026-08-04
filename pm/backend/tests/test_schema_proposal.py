import json
from pathlib import Path


SCHEMA_PATH = Path(__file__).resolve().parents[2] / "docs" / "kanban-schema.json"


def load_schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def test_schema_proposal_is_valid_json_with_required_tables() -> None:
    proposal = load_schema()

    assert proposal["schemaVersion"] == 1
    assert proposal["proposal"]["engine"] == "SQLite"
    assert set(proposal["tables"]) == {
        "schema_migrations",
        "users",
        "boards",
        "columns",
        "cards",
    }


def test_schema_proposal_covers_ownership_and_ordering() -> None:
    proposal = load_schema()
    relationships = {
        (relationship["from"], relationship["to"])
        for relationship in proposal["relationships"]
    }

    assert ("boards.user_id", "users.id") in relationships
    assert ("columns.board_id", "boards.id") in relationships
    assert ("cards.column_id", "columns.id") in relationships
    assert proposal["ordering"]["columns"]["field"] == "position"
    assert proposal["ordering"]["cards"]["field"] == "position"


def test_board_examples_have_consistent_card_membership() -> None:
    examples = load_schema()["examples"]

    assert examples["empty"]["cards"] == []
    populated = examples["populated"]
    column_ids = {column["id"] for column in populated["columns"]}
    cards_by_id = {card["id"]: card for card in populated["cards"]}

    assert cards_by_id
    assert all(card["columnId"] in column_ids for card in cards_by_id.values())
    assert all(
        card_id in cards_by_id
        for column in populated["columns"]
        for card_id in column["cardIds"]
    )
    assert sorted(card["position"] for card in populated["cards"] if card["columnId"] == "col-backlog") == [0, 1]
