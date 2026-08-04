import { ApiError, apiRequest, chatAboutBoard, getBoard, renameColumn } from "@/lib/api";

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

  it("loads the authenticated board with the expected route and header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ columns: [], cards: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getBoard("user");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/users/user/board",
      expect.objectContaining({ headers: { "X-Username": "user" } })
    );
  });

  it("sends mutation bodies and returns the backend snapshot", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ columns: [], cards: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await renameColumn("user", "col-backlog", "Queue");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/users/user/board/columns/col-backlog",
      expect.objectContaining({
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Username": "user",
        },
        body: JSON.stringify({ title: "Queue" }),
      })
    );
  });

  it("sends chat history to the authenticated board chat route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ assistant: "I can help.", columns: [], cards: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await chatAboutBoard("user", "What is next?", [
      { role: "assistant", content: "Earlier reply" },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/users/user/board/chat",
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
