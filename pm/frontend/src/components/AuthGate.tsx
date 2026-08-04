"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";

export const AUTH_STORAGE_KEY = "pm-mvp-authenticated";

const DEMO_USERNAME = "user";
const DEMO_PASSWORD = "password";

const authListeners = new Set<() => void>();

const subscribeToAuth = (listener: () => void) => {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
};

const getAuthSnapshot = () =>
  window.localStorage.getItem(AUTH_STORAGE_KEY) === "true";

const getServerAuthSnapshot = () => false;

const notifyAuthListeners = () => {
  authListeners.forEach((listener) => listener());
};

export const AuthGate = () => {
  const isAuthenticated = useSyncExternalStore(
    subscribeToAuth,
    getAuthSnapshot,
    getServerAuthSnapshot
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (username.trim() !== DEMO_USERNAME || password !== DEMO_PASSWORD) {
      setError("Invalid username or password.");
      return;
    }

    window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
    setError(null);
    notifyAuthListeners();
  };

  const handleLogout = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setUsername("");
    setPassword("");
    setError(null);
    notifyAuthListeners();
  };

  if (isAuthenticated) {
    return (
      <div className="relative">
        <div className="relative z-10 mx-auto flex max-w-[1500px] justify-end px-6 pt-6">
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-[var(--stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:border-[var(--primary-blue)] hover:text-[var(--navy-dark)]"
          >
            Log out
          </button>
        </div>
        <KanbanBoard />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section
        aria-labelledby="sign-in-title"
        className="w-full max-w-md rounded-[32px] border border-[var(--stroke)] bg-white/90 p-8 shadow-[var(--shadow)] backdrop-blur"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
          Project Management MVP
        </p>
        <h1
          id="sign-in-title"
          className="mt-4 font-display text-4xl font-semibold text-[var(--navy-dark)]"
        >
          Welcome back
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--gray-text)]">
          Sign in to open your Kanban board.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="username"
              className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              className="mt-2 w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-3 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="mt-2 w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-3 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
              required
            />
          </div>

          {error && (
            <p role="alert" className="text-sm font-semibold text-[var(--secondary-purple)]">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:brightness-110"
          >
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
};
