'use client';

import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { AppShell } from '@/components/AppShell';
import { ApiError, login, register, type AuthSession } from '@/lib/api';

export const AUTH_STORAGE_KEY = 'pm-auth-session';

const authListeners = new Set<() => void>();

const subscribeToAuth = (listener: () => void) => {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
};

const notifyAuthListeners = () => {
  authListeners.forEach((listener) => listener());
};

let cachedRaw: string | null = null;
let cachedSession: AuthSession | null = null;

// useSyncExternalStore requires getSnapshot to return a stable reference when
// nothing changed, so this only re-parses localStorage when its raw value
// actually differs from what was last read.
const readSession = (): AuthSession | null => {
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (raw === cachedRaw) {
    return cachedSession;
  }
  cachedRaw = raw;
  try {
    cachedSession = raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    cachedSession = null;
  }
  return cachedSession;
};

const getServerSnapshot = (): AuthSession | null => null;

const storeSession = (session: AuthSession) => {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  notifyAuthListeners();
};

const clearSession = () => {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  notifyAuthListeners();
};

export const AuthGate = () => {
  const session = useSyncExternalStore(subscribeToAuth, readSession, getServerSnapshot);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result =
        mode === 'login'
          ? await login(username.trim(), password)
          : await register(username.trim(), password);
      storeSession(result);
      setPassword('');
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not reach the server. Try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (session) {
    return <AppShell session={session} onLogout={clearSession} />;
  }

  const isLogin = mode === 'login';

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section
        aria-labelledby="sign-in-title"
        className="w-full max-w-md rounded-[32px] border border-[var(--stroke)] bg-white/90 p-8 shadow-[var(--shadow)] backdrop-blur"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
          Project Management
        </p>
        <h1
          id="sign-in-title"
          className="mt-4 font-display text-4xl font-semibold text-[var(--navy-dark)]"
        >
          {isLogin ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--gray-text)]">
          {isLogin
            ? 'Sign in to open your boards.'
            : 'Set up an account to start your own boards.'}
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
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              minLength={isLogin ? undefined : 8}
              className="mt-2 w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-3 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
              required
            />
            {!isLogin && (
              <p className="mt-1.5 text-[11px] leading-4 text-[var(--gray-text)]">
                At least 8 characters.
              </p>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm font-semibold text-[var(--secondary-purple)]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Please wait...' : isLogin ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(isLogin ? 'register' : 'login');
            setError(null);
          }}
          className="mt-5 w-full text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary-blue)] transition hover:text-[var(--navy-dark)]"
        >
          {isLogin ? 'Need an account? Create one' : 'Already have an account? Sign in'}
        </button>
      </section>
    </main>
  );
};
