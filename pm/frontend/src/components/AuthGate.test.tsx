import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthGate, AUTH_STORAGE_KEY } from "@/components/AuthGate";
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
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => boardResponse,
    })
  );
});

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe("AuthGate", () => {
  it("requires sign-in before showing the board", async () => {
    render(<AuthGate />);

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeRequired();
    expect(screen.getByLabelText("Password")).toBeRequired();
    expect(screen.queryByRole("heading", { name: "Kanban Studio" })).not.toBeInTheDocument();
  });

  it("rejects invalid credentials without revealing the board", async () => {
    const user = userEvent.setup();
    render(<AuthGate />);

    await user.type(await screen.findByLabelText("Username"), "wrong");
    await user.type(screen.getByLabelText("Password"), "credentials");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Invalid username or password.");
    expect(screen.queryByRole("heading", { name: "Kanban Studio" })).not.toBeInTheDocument();
  });

  it("shows the board and persists a valid session", async () => {
    const user = userEvent.setup();
    render(<AuthGate />);

    await user.type(await screen.findByLabelText("Username"), "user");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBe("true");
  });

  it("restores a session on refresh and logs out", async () => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
    const user = userEvent.setup();
    render(<AuthGate />);

    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });
});
