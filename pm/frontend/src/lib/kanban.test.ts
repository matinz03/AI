import { boardFromApi, moveCard, type Column } from "@/lib/kanban";

describe("moveCard", () => {
  const baseColumns: Column[] = [
    { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
    { id: "col-b", title: "B", cardIds: ["card-3"] },
  ];

  it("reorders cards in the same column", () => {
    const result = moveCard(baseColumns, "card-2", "card-1");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
  });

  it("moves cards to another column", () => {
    const result = moveCard(baseColumns, "card-2", "card-3");
    expect(result[0].cardIds).toEqual(["card-1"]);
    expect(result[1].cardIds).toEqual(["card-2", "card-3"]);
  });

  it("drops cards to the end of a column", () => {
    const result = moveCard(baseColumns, "card-1", "col-b");
    expect(result[0].cardIds).toEqual(["card-2"]);
    expect(result[1].cardIds).toEqual(["card-3", "card-1"]);
  });
});

describe("boardFromApi", () => {
  it("converts the persisted snapshot into the board state used by the UI", () => {
    const result = boardFromApi({
      board: {
        id: "board-default",
        userId: "user-default",
        name: "Product roadmap",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      columns: [
        { id: "col-a", title: "A", position: 0, cardIds: ["card-1"] },
      ],
      cards: [
        {
          id: "card-1",
          columnId: "col-a",
          title: "Persisted card",
          details: "",
          position: 0,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
    });

    expect(result.columns).toEqual([{ id: "col-a", title: "A", cardIds: ["card-1"] }]);
    expect(result.cards["card-1"]).toMatchObject({
      title: "Persisted card",
      details: "No details yet.",
      columnId: "col-a",
    });
  });
});
