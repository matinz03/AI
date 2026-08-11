import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";

const TOKEN = "session-token";
const BOARD_ID = "board-1";

const buildBoardResponse = () => ({
  board: {
    id: BOARD_ID,
    userId: "user-1",
    name: "Product roadmap",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  columns: [
    { id: "col-backlog", title: "Backlog", position: 0, cardIds: ["card-1", "card-2"] },
    { id: "col-progress", title: "In Progress", position: 1, cardIds: [] },
  ],
  cards: [
    {
      id: "card-1",
      columnId: "col-backlog",
      title: "Align roadmap themes",
      details: "Draft quarterly themes.",
      priority: "high",
      dueDate: "2026-02-01",
      position: 0,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
    {
      id: "card-2",
      columnId: "col-backlog",
      title: "Gather customer signals",
      details: "Review customer feedback.",
      priority: "medium",
      dueDate: null,
      position: 1,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  ],
});

let currentBoard: ReturnType<typeof buildBoardResponse>;

beforeEach(() => {
  currentBoard = buildBoardResponse();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input);
      const body = options?.body ? JSON.parse(String(options.body)) : undefined;

      if (options?.method === "POST" && url.endsWith("/chat")) {
        currentBoard.columns[0].title = "AI Queue";
        return {
          ok: true,
          json: async () => ({
            ...JSON.parse(JSON.stringify(currentBoard)),
            assistant: "I renamed Backlog to AI Queue.",
          }),
        };
      }

      if (options?.method === "POST" && url.endsWith("/columns")) {
        const column = {
          id: "col-new",
          title: body.title,
          position: currentBoard.columns.length,
          cardIds: [],
        };
        currentBoard.columns.push(column);
      }

      if (options?.method === "POST" && url.endsWith("/cards")) {
        const id = "card-new";
        const columnId = url.split("/").at(-2) as string;
        const column = currentBoard.columns.find((candidate) => candidate.id === columnId)!;
        currentBoard.cards.push({
          id,
          columnId,
          title: body.title,
          details: body.details,
          priority: body.priority ?? "medium",
          dueDate: body.dueDate ?? null,
          position: column.cardIds.length,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        });
        column.cardIds.push(id);
      }

      if (options?.method === "PATCH" && url.includes("/columns/")) {
        const columnId = url.split("/").pop();
        const column = currentBoard.columns.find((candidate) => candidate.id === columnId);
        if (column && typeof body.title === "string") {
          column.title = body.title;
        }
      }

      if (options?.method === "PATCH" && url.includes("/cards/")) {
        const cardId = url.split("/").pop();
        const card = currentBoard.cards.find((candidate) => candidate.id === cardId);
        if (card) {
          if (body.title !== undefined) card.title = body.title;
          if (body.details !== undefined) card.details = body.details;
          if (body.priority !== undefined) card.priority = body.priority;
          if (body.clearDueDate) {
            card.dueDate = null;
          } else if (body.dueDate !== undefined) {
            card.dueDate = body.dueDate;
          }
        }
      }

      if (options?.method === "DELETE" && url.includes("/columns/")) {
        const columnId = url.split("/").pop();
        currentBoard.columns = currentBoard.columns.filter((column) => column.id !== columnId);
      }

      if (options?.method === "DELETE" && url.includes("/cards/")) {
        const cardId = url.split("/").pop();
        currentBoard.cards = currentBoard.cards.filter((card) => card.id !== cardId);
        currentBoard.columns.forEach((column) => {
          column.cardIds = column.cardIds.filter((id) => id !== cardId);
        });
      }

      return {
        ok: true,
        json: async () => JSON.parse(JSON.stringify(currentBoard)),
      };
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const renderBoard = () =>
  render(
    <KanbanBoard token={TOKEN} boardId={BOARD_ID} boardName="Product roadmap" onBack={vi.fn()} />
  );

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  it("renders the board's columns after loading from the backend", async () => {
    renderBoard();
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(2);
    expect(await screen.findByRole("heading", { name: "Product roadmap" })).toBeInTheDocument();
  });

  it("renames a column when the title input loses focus", async () => {
    renderBoard();
    await screen.findAllByTestId(/column-/i);
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    await userEvent.tab();

    expect(await within(column).findByDisplayValue("New Name")).toBeInTheDocument();
  });

  it("reverts to the previous title when cleared to empty", async () => {
    renderBoard();
    await screen.findAllByTestId(/column-/i);
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.tab();

    expect(input).toHaveValue("Backlog");
  });

  it("shows a recoverable error and lets the user retry a failed mutation", async () => {
    renderBoard();
    await screen.findAllByTestId(/column-/i);
    const column = getFirstColumn();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "Will fail");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The board could not be updated. Check the backend and try again."
    );
    expect(screen.getByRole("button", { name: "Refresh board" })).toBeInTheDocument();
  });

  it("adds a column via the new-column control", async () => {
    renderBoard();
    await screen.findAllByTestId(/column-/i);

    await userEvent.click(screen.getByRole("button", { name: "+ Add column" }));
    await userEvent.type(screen.getByLabelText("New column name"), "Blocked");
    await userEvent.click(screen.getByRole("button", { name: "Add column" }));

    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(3);
  });

  it("cancels adding a new column without submitting", async () => {
    renderBoard();
    await screen.findAllByTestId(/column-/i);

    await userEvent.click(screen.getByRole("button", { name: "+ Add column" }));
    await userEvent.type(screen.getByLabelText("New column name"), "Discarded");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(2);
    expect(screen.getByRole("button", { name: "+ Add column" })).toBeInTheDocument();
  });

  it("does not add a column when the name is only whitespace", async () => {
    renderBoard();
    await screen.findAllByTestId(/column-/i);

    await userEvent.click(screen.getByRole("button", { name: "+ Add column" }));
    await userEvent.type(screen.getByLabelText("New column name"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Add column" }));

    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(2);
  });

  it("deletes a column", async () => {
    renderBoard();
    await screen.findAllByTestId(/column-/i);
    const secondColumn = screen.getAllByTestId(/column-/i)[1];

    await userEvent.click(
      within(secondColumn).getByRole("button", { name: /delete in progress column/i })
    );

    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(1);
  });

  it("shows card priority and due date, including overdue styling", async () => {
    renderBoard();
    const column = await screen.findByTestId("column-col-backlog");

    expect(within(column).getByText("high")).toBeInTheDocument();
    expect(within(column).getByText(/Due 2026-02-01/)).toHaveTextContent("(overdue)");
  });

  it("adds a card with a priority and due date, then removes it", async () => {
    renderBoard();
    await screen.findAllByTestId(/column-/i);
    const column = getFirstColumn();
    const addButton = within(column).getByRole("button", {
      name: /add a card/i,
    });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");
    await userEvent.selectOptions(within(column).getByLabelText("Priority"), "low");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: /delete new card/i,
    });
    await userEvent.click(deleteButton);

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });

  it("cancels adding a new card without submitting", async () => {
    renderBoard();
    await screen.findAllByTestId(/column-/i);
    const column = getFirstColumn();

    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "Discarded card");
    await userEvent.click(within(column).getByRole("button", { name: "Cancel" }));

    expect(within(column).queryByText("Discarded card")).not.toBeInTheDocument();
    expect(within(column).getByRole("button", { name: /add a card/i })).toBeInTheDocument();
  });

  it("edits a card's priority and due date", async () => {
    renderBoard();
    const column = await screen.findByTestId("column-col-backlog");

    await userEvent.click(within(column).getByRole("button", { name: "Edit Align roadmap themes" }));
    await userEvent.selectOptions(within(column).getByLabelText("Priority"), "low");
    await userEvent.click(within(column).getByRole("button", { name: "Save changes" }));

    expect(await within(column).findByText("low")).toBeInTheDocument();
  });

  it("does not save when the edited title is only whitespace", async () => {
    renderBoard();
    const column = await screen.findByTestId("column-col-backlog");

    await userEvent.click(within(column).getByRole("button", { name: "Edit Align roadmap themes" }));
    const titleInput = within(column).getByLabelText("Card title");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "   ");
    await userEvent.click(within(column).getByRole("button", { name: "Save changes" }));

    expect(within(column).getByLabelText("Card title")).toBeInTheDocument();
    expect(within(column).queryByText("Align roadmap themes")).not.toBeInTheDocument();
  });

  it("discards edits when Cancel is clicked", async () => {
    renderBoard();
    const column = await screen.findByTestId("column-col-backlog");

    await userEvent.click(within(column).getByRole("button", { name: "Edit Align roadmap themes" }));
    const titleInput = within(column).getByLabelText("Card title");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Changed but discarded");
    await userEvent.click(within(column).getByRole("button", { name: "Cancel" }));

    expect(within(column).getByText("Align roadmap themes")).toBeInTheDocument();
    expect(within(column).queryByText("Changed but discarded")).not.toBeInTheDocument();
  });

  it("shows a recoverable error when the backend is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    renderBoard();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The board could not be loaded. Check the backend and try again."
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("shows the assistant response and applies its board snapshot", async () => {
    renderBoard();
    await screen.findAllByTestId(/column-/i);

    await userEvent.type(
      screen.getByLabelText("Ask the project assistant"),
      "Rename Backlog"
    );
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("I renamed Backlog to AI Queue.")).toBeInTheDocument();
    expect(screen.getByText("Board updated from the assistant response.")).toBeInTheDocument();
    expect(screen.getByText("AI Queue")).toBeInTheDocument();
  });
});
