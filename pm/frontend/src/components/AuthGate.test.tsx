import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthGate, AUTH_STORAGE_KEY } from "@/components/AuthGate";

const boardsResponse = { boards: [] };

const buildFetchMock = () =>
  vi.fn().mockImplementation(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input);

    if (url.endsWith("/auth/login")) {
      const body = JSON.parse(String(options?.body));
      if (body.username === "alice" && body.password === "correct-password") {
        return { ok: true, json: async () => ({ token: "session-token", username: "alice" }) };
      }
      return { ok: false, status: 401, json: async () => ({ detail: "Invalid username or password." }) };
    }

    if (url.endsWith("/auth/register")) {
      const body = JSON.parse(String(options?.body));
      return { ok: true, json: async () => ({ token: "session-token", username: body.username }) };
    }

    if (url.endsWith("/boards")) {
      return { ok: true, json: async () => boardsResponse };
    }

    return { ok: true, json: async () => ({}) };
  });

beforeEach(() => {
  vi.stubGlobal("fetch", buildFetchMock());
});

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe("AuthGate", () => {
  it("requires sign-in before showing any boards", async () => {
    render(<AuthGate />);

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeRequired();
    expect(screen.getByLabelText("Password")).toBeRequired();
    expect(screen.queryByRole("heading", { name: "Your boards" })).not.toBeInTheDocument();
  });

  it("rejects invalid credentials without revealing any boards", async () => {
    const user = userEvent.setup();
    render(<AuthGate />);

    await user.type(await screen.findByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid username or password."
    );
    expect(screen.queryByRole("heading", { name: "Your boards" })).not.toBeInTheDocument();
  });

  it("signs in and persists the session", async () => {
    const user = userEvent.setup();
    render(<AuthGate />);

    await user.type(await screen.findByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "correct-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Your boards" })).toBeInTheDocument();
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBe(
      JSON.stringify({ token: "session-token", username: "alice" })
    );
  });

  it("switches to registration and creates a new account", async () => {
    const user = userEvent.setup();
    render(<AuthGate />);

    await user.click(
      await screen.findByRole("button", { name: "Need an account? Create one" })
    );
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Username"), "newperson");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("heading", { name: "Your boards" })).toBeInTheDocument();
  });

  it("treats corrupted session data in localStorage as signed out", async () => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, "{not valid json");

    render(<AuthGate />);

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  });

  it("shows a generic message when the server cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const user = userEvent.setup();
    render(<AuthGate />);

    await user.type(await screen.findByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "correct-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the server. Try again."
    );
  });

  it("restores a session on refresh and logs out", async () => {
    window.localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ token: "session-token", username: "alice" })
    );
    const user = userEvent.setup();
    render(<AuthGate />);

    expect(await screen.findByRole("heading", { name: "Your boards" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });
});
