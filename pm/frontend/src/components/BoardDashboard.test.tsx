import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoardDashboard } from "@/components/BoardDashboard";

const TOKEN = "session-token";

let boards: Array<{ id: string; name: string; createdAt: string; updatedAt: string; cardCount: number }>;

beforeEach(() => {
  boards = [
    {
      id: "board-1",
      name: "Product roadmap",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      cardCount: 3,
    },
  ];

  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input);
      const body = options?.body ? JSON.parse(String(options.body)) : undefined;

      if (options?.method === "POST" && url.endsWith("/boards")) {
        boards.push({
          id: "board-new",
          name: body.name,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          cardCount: 0,
        });
        return { ok: true, json: async () => ({ board: {}, columns: [], cards: [] }) };
      }

      if (options?.method === "PATCH") {
        const boardId = url.split("/").pop();
        const board = boards.find((candidate) => candidate.id === boardId);
        if (board) board.name = body.name;
        return { ok: true, json: async () => ({ board: {}, columns: [], cards: [] }) };
      }

      if (options?.method === "DELETE") {
        const boardId = url.split("/").pop();
        boards = boards.filter((candidate) => candidate.id !== boardId);
        return { ok: true, json: async () => ({ boards }) };
      }

      return { ok: true, json: async () => ({ boards }) };
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BoardDashboard", () => {
  it("lists existing boards with their card counts", async () => {
    render(<BoardDashboard token={TOKEN} onOpenBoard={vi.fn()} />);

    expect(await screen.findByDisplayValue("Product roadmap")).toBeInTheDocument();
    expect(screen.getByText("3 cards")).toBeInTheDocument();
  });

  it("opens a board when its open button is clicked", async () => {
    const onOpenBoard = vi.fn();
    render(<BoardDashboard token={TOKEN} onOpenBoard={onOpenBoard} />);

    await userEvent.click(await screen.findByRole("button", { name: "Open board" }));

    expect(onOpenBoard).toHaveBeenCalledWith({ id: "board-1", name: "Product roadmap" });
  });

  it("creates a new board", async () => {
    render(<BoardDashboard token={TOKEN} onOpenBoard={vi.fn()} />);
    await screen.findByDisplayValue("Product roadmap");

    await userEvent.type(screen.getByLabelText("New board name"), "Marketing");
    await userEvent.click(screen.getByRole("button", { name: "Create board" }));

    expect(await screen.findByDisplayValue("Marketing")).toBeInTheDocument();
  });

  it("renames a board inline", async () => {
    render(<BoardDashboard token={TOKEN} onOpenBoard={vi.fn()} />);
    const input = await screen.findByDisplayValue("Product roadmap");

    await userEvent.clear(input);
    await userEvent.type(input, "Growth roadmap");
    await userEvent.tab();

    expect(await screen.findByDisplayValue("Growth roadmap")).toBeInTheDocument();
  });

  it("commits a rename when Enter is pressed", async () => {
    render(<BoardDashboard token={TOKEN} onOpenBoard={vi.fn()} />);
    const input = await screen.findByDisplayValue("Product roadmap");

    await userEvent.clear(input);
    await userEvent.type(input, "Renamed via Enter{Enter}");

    expect(await screen.findByDisplayValue("Renamed via Enter")).toBeInTheDocument();
  });

  it("reverts to the previous name when cleared to empty", async () => {
    render(<BoardDashboard token={TOKEN} onOpenBoard={vi.fn()} />);
    const input = await screen.findByDisplayValue("Product roadmap");

    await userEvent.clear(input);
    await userEvent.tab();

    expect(input).toHaveValue("Product roadmap");
  });

  it("shows an error banner when creating a board fails", async () => {
    render(<BoardDashboard token={TOKEN} onOpenBoard={vi.fn()} />);
    await screen.findByDisplayValue("Product roadmap");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: RequestInfo | URL, options?: RequestInit) => {
        if (options?.method === "POST") {
          throw new Error("offline");
        }
        return { ok: true, json: async () => ({ boards }) };
      })
    );

    await userEvent.type(screen.getByLabelText("New board name"), "Marketing");
    await userEvent.click(screen.getByRole("button", { name: "Create board" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The board could not be created."
    );
  });

  it("deletes a board", async () => {
    render(<BoardDashboard token={TOKEN} onOpenBoard={vi.fn()} />);
    const card = (await screen.findByTestId("board-card-board-1")) as HTMLElement;

    await userEvent.click(within(card).getByRole("button", { name: "Delete Product roadmap" }));

    expect(screen.queryByDisplayValue("Product roadmap")).not.toBeInTheDocument();
    expect(await screen.findByText("No boards yet. Create your first one above.")).toBeInTheDocument();
  });
});
