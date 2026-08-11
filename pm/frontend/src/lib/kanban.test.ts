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

  it("leaves columns untouched when the active card id is unknown", () => {
    const result = moveCard(baseColumns, "card-missing", "card-1");
    expect(result).toBe(baseColumns);
  });

  it("is a no-op when reordering within a column resolves to the same index", () => {
    const result = moveCard(baseColumns, "card-1", "card-1");
    expect(result).toBe(baseColumns);
  });

  it("is a no-op when the active id resolves to a column rather than a card it contains", () => {
    const result = moveCard(baseColumns, "col-a", "card-3");
    expect(result).toBe(baseColumns);
  });

  it("moves a card to the end of its own column when dropped on the column itself", () => {
    const result = moveCard(baseColumns, "card-1", "col-a");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
  });

  it("leaves a third, unrelated column untouched when moving between two others", () => {
    const threeColumns: Column[] = [
      ...baseColumns,
      { id: "col-c", title: "C", cardIds: ["card-4"] },
    ];
    const result = moveCard(threeColumns, "card-2", "card-3");
    expect(result[2]).toBe(threeColumns[2]);
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
          priority: "high",
          dueDate: "2026-02-01",
          position: 0,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
    });

    expect(result.name).toBe("Product roadmap");
    expect(result.columns).toEqual([{ id: "col-a", title: "A", cardIds: ["card-1"] }]);
    expect(result.cards["card-1"]).toMatchObject({
      title: "Persisted card",
      details: "No details yet.",
      priority: "high",
      dueDate: "2026-02-01",
      columnId: "col-a",
    });
  });

  it("defaults missing card details to a placeholder while keeping a null due date", () => {
    const result = boardFromApi({
      board: {
        id: "board-1",
        userId: "user-1",
        name: "Empty board",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      columns: [{ id: "col-a", title: "A", position: 0, cardIds: ["card-1"] }],
      cards: [
        {
          id: "card-1",
          columnId: "col-a",
          title: "No details card",
          details: "",
          priority: "medium",
          dueDate: null,
          position: 0,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
    });

    expect(result.cards["card-1"].details).toBe("No details yet.");
    expect(result.cards["card-1"].dueDate).toBeNull();
  });
});
