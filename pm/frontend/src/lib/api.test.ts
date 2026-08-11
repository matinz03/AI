import {
  ApiError,
  apiRequest,
  chatAboutBoard,
  createCard,
  createColumn,
  getBoard,
  listBoards,
  login,
  logout,
  moveCardRequest,
  register,
  renameColumn,
  updateCard,
} from "@/lib/api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiRequest", () => {
  it("normalizes the path and returns JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest<{ status: string }>("/health")).resolves.toEqual({
      status: "ok",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/health", undefined);
  });

  it("raises an ApiError for a failed response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 })
    );

    await expect(apiRequest("health")).rejects.toEqual(
      new ApiError("API request failed with status 503.", 503)
    );
  });

  it("returns undefined for a 204 response with no body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204 }));

    await expect(apiRequest("auth/logout")).resolves.toBeUndefined();
  });

  it("falls back to a status-based message when the error body isn't JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("not JSON");
        },
      })
    );

    await expect(apiRequest("boards")).rejects.toEqual(
      new ApiError("API request failed with status 500.", 500)
    );
  });
});

describe("auth", () => {
  it("registers with a JSON body and no auth header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: "abc", username: "alice" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await register("alice", "password123");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/register",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "alice", password: "password123" }),
      })
    );
  });

  it("logs in and returns the session", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: "abc", username: "alice" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(login("alice", "password123")).resolves.toEqual({
      token: "abc",
      username: "alice",
    });
  });

  it("sends the bearer token on logout", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);

    await logout("abc");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer abc" },
      })
    );
  });
});

describe("boards and columns", () => {
  it("lists boards with the bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ boards: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await listBoards("abc");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/boards",
      expect.objectContaining({ headers: { Authorization: "Bearer abc" } })
    );
  });

  it("loads a single board by id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ columns: [], cards: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getBoard("abc", "board-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/boards/board-1",
      expect.objectContaining({ headers: { Authorization: "Bearer abc" } })
    );
  });

  it("renames a column under a board", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ columns: [], cards: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await renameColumn("abc", "board-1", "col-backlog", "Queue");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/boards/board-1/columns/col-backlog",
      expect.objectContaining({
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer abc",
        },
        body: JSON.stringify({ title: "Queue" }),
      })
    );
  });

  it("creates a column under a board", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ columns: [], cards: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createColumn("abc", "board-1", "Blocked");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/boards/board-1/columns",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "Blocked" }),
      })
    );
  });
});

describe("cards", () => {
  it("creates a card with priority and due date", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ columns: [], cards: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createCard("abc", "board-1", "col-backlog", "Title", "Details", "high", "2026-09-01");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/boards/board-1/columns/col-backlog/cards",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "Title",
          details: "Details",
          priority: "high",
          dueDate: "2026-09-01",
        }),
      })
    );
  });

  it("omits an unset due date when creating a card", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ columns: [], cards: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createCard("abc", "board-1", "col-backlog", "Title", "", "medium", null);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/boards/board-1/columns/col-backlog/cards",
      expect.objectContaining({
        body: JSON.stringify({ title: "Title", details: "", priority: "medium" }),
      })
    );
  });

  it("moves a card to a new column and position", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ columns: [], cards: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await moveCardRequest("abc", "board-1", "card-1", "col-done", 2);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/boards/board-1/cards/card-1/move",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ columnId: "col-done", position: 2 }),
      })
    );
  });

  it("sends clearDueDate when updating a card to remove its due date", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ columns: [], cards: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await updateCard("abc", "board-1", "card-1", { clearDueDate: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/boards/board-1/cards/card-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ clearDueDate: true }),
      })
    );
  });
});

describe("chat", () => {
  it("sends chat history to the board-scoped chat route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ assistant: "I can help.", columns: [], cards: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await chatAboutBoard("abc", "board-1", "What is next?", [
      { role: "assistant", content: "Earlier reply" },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/boards/board-1/chat",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          question: "What is next?",
          history: [{ role: "assistant", content: "Earlier reply" }],
        }),
      })
    );
  });
});
