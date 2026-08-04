import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData } from "@/lib/kanban";

const boardResponse = {
  board: {
    id: "board-default",
    userId: "user-default",
    name: "Product roadmap",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  columns: initialData.columns.map((column, position) => ({
    ...column,
    position,
  })),
  cards: Object.values(initialData.cards).map((card, position) => ({
    ...card,
    columnId:
      initialData.columns.find((column) => column.cardIds.includes(card.id))?.id ??
      "col-backlog",
    position,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  })),
};

beforeEach(() => {
  const currentBoard = JSON.parse(JSON.stringify(boardResponse));
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

      if (options?.method === "POST" && url.endsWith("/cards")) {
        const id = "card-new";
        const column = currentBoard.columns.find(
          (candidate: { id: string }) => candidate.id === body.columnId
        );
        currentBoard.cards.push({
          id,
          columnId: body.columnId,
          title: body.title,
          details: body.details,
          position: column.cardIds.length,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        });
        column.cardIds.push(id);
      }

      if (options?.method === "DELETE") {
        const cardId = url.split("/").pop();
        currentBoard.cards = currentBoard.cards.filter(
          (card: { id: string }) => card.id !== cardId
        );
        currentBoard.columns.forEach((column: { cardIds: string[] }) => {
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

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  it("renders five columns after loading the backend board", async () => {
    render(<KanbanBoard />);
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renames a column", async () => {
    render(<KanbanBoard />);
    await screen.findAllByTestId(/column-/i);
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("adds and removes a card", async () => {
    render(<KanbanBoard />);
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

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: /delete new card/i,
    });
    await userEvent.click(deleteButton);

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });

  it("shows a recoverable error when the backend is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<KanbanBoard />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The board could not be loaded. Check the backend and try again."
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("shows the assistant response and applies its board snapshot", async () => {
    render(<KanbanBoard />);
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
