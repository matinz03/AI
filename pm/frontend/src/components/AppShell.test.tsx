import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell } from "@/components/AppShell";

const boardsResponse = {
  boards: [
    {
      id: "board-1",
      name: "Product roadmap",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      cardCount: 0,
    },
  ],
};

const boardSnapshot = {
  board: {
    id: "board-1",
    userId: "user-1",
    name: "Product roadmap",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  columns: [{ id: "col-backlog", title: "Backlog", position: 0, cardIds: [] }],
  cards: [],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/boards")) {
        return { ok: true, json: async () => boardsResponse };
      }
      return { ok: true, json: async () => boardSnapshot };
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AppShell", () => {
  it("shows the board dashboard first, then a board, then returns to the dashboard", async () => {
    const onLogout = vi.fn();
    render(<AppShell session={{ token: "abc", username: "alice" }} onLogout={onLogout} />);

    expect(screen.getByText("Signed in as alice")).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Open board" }));

    expect(await screen.findByRole("heading", { name: "Product roadmap" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "← All boards" }));
    expect(await screen.findByRole("heading", { name: "Your boards" })).toBeInTheDocument();
  });

  it("logs out when the log out button is clicked", async () => {
    const onLogout = vi.fn();
    render(<AppShell session={{ token: "abc", username: "alice" }} onLogout={onLogout} />);

    await userEvent.click(await screen.findByRole("button", { name: "Log out" }));

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
