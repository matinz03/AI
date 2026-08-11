# PM — Project Management

A locally run project-management web app: register or sign in, manage any number of Kanban boards with custom columns, track card priority and due dates, and chat with an AI assistant that can edit the current board. See [`AGENTS.md`](AGENTS.md) for the original product brief and coding standards, [`docs/PLAN.md`](docs/PLAN.md) for the original MVP's part-by-part delivery history, and [`docs/RALPH_PLAN.md`](docs/RALPH_PLAN.md) for the multi-user/multi-board expansion that followed it.

## Architecture

One Docker image, one process. FastAPI serves both the JSON API (under `/api`) and the statically exported Next.js frontend (everything else). There is no separate frontend server in production.

```
frontend/  Next.js 16 (App Router, React 19), built with `next build` (output: "export") -> out/
backend/   FastAPI (Python 3.12+, uv-managed), serves out/ as static files + /api/*
```

- `Dockerfile`: multi-stage build — builds the frontend with `node:24-slim`, then copies `frontend/out` into a `python:3.13-slim` image alongside the `uv`-installed backend. Single `uvicorn` process on port 8000.
- `scripts/start.{sh,ps1}` / `stop.{sh,ps1}`: build and run the container, mount a named volume (`pm-mvp-data` by default) at `/app/backend/data` for the SQLite file, and pass `backend/.env` in via `--env-file` if present.

## Backend (`backend/app/`)

- `main.py` — FastAPI app, all routes, exception handlers, and the static-file fallback (`_resolve_static_file` guards against path traversal outside `static/`).
- `database.py` — everything SQLite: schema DDL and all domain read/mutation functions for users, sessions, boards, columns, and cards (`create_user`, `authenticate_user`, `create_session`, `get_user_id_for_token`, `list_boards`, `create_board`, `create_column`, `create_card`, `update_card`, `move_card`, `delete_card`, `apply_board_operations`, ...). Each public function opens its own connection via the `open_database` context manager (commit on success, rollback on exception) and mutation functions return a fresh board snapshot. A function that needs to persist state *and* raise (e.g. deleting an expired session) uses two separate `open_database` blocks, since raising inside one rolls it back.
- `auth.py` — PBKDF2-HMAC-SHA256 password hashing/verification (stdlib only, no new dependency) and session-token generation.
- `schemas.py` — Pydantic request/response/AI-operation models. `ApiModel` (extra="forbid", populate_by_name) is the base for most models; note `ColumnRenameRequest` and `CardUpdateRequest` do **not** inherit from it.
- `ai_board.py` — builds the OpenRouter chat payload (JSON-schema system prompt generated from `AIBoardResponse.model_json_schema()` + bounded history + board+question), validates the JSON response against `AIBoardResponse`. Extending `BoardOperation` in `schemas.py` automatically flows through to the prompt schema and to validation — no changes needed here.
- `openrouter.py` — thin `httpx` client for OpenRouter (`OPENROUTER_API_KEY`, model `openai/gpt-oss-20b:free`, 15s timeout). Also runnable standalone as a live connectivity smoke test (`python -m app.openrouter`).

### Data model

SQLite at `backend/data/pm.sqlite3` (gitignored, auto-created via `initialize_database`, called once at app startup through the `lifespan` handler). Tables: `users` -> `sessions` and `users` -> `boards` (many per user) -> `columns` (user-managed, not fixed) -> `cards` (with `priority` and `due_date`). Ownership is always verified through a join/lookup chain rooted at `user_id` — see `_get_board_for_user` / `_get_column_for_board` / `_get_card_for_board`. Full design rationale in [`docs/DATABASE.md`](docs/DATABASE.md); machine-readable shape in [`docs/kanban-schema.json`](docs/kanban-schema.json).

Column/card `position` is zero-based and contiguous within its parent scope. Moves use a two-phase rewrite (`_rewrite_positions` / `_rewrite_column_positions` stage negative temporary positions first) to avoid violating the `UNIQUE(column_id/board_id, position)` constraints mid-update. Every mutation runs inside one `open_database` transaction, so a failure leaves zero partial state — this is covered by dedicated tests (`test_invalid_ai_operation_rolls_back_every_change`, `test_invalid_payloads_and_missing_records_do_not_mutate_state`).

### Auth model

Real accounts: `POST /api/auth/register` and `POST /api/auth/login` return a bearer token (`sessions.token`, 30-day expiry); every other route requires `Authorization: Bearer <token>` and resolves the current user via `get_current_user_id` in `main.py`. There is no OAuth/SSO, email verification, or password reset — deliberately out of scope for a local single-container app.

### AI board operations

The AI can emit `rename_column`, `create_column`, `create_card`, `update_card` (title/details/priority/due date), or `move_card` (no delete of cards or columns) — see `BoardOperation` in `schemas.py`. The chat route (`POST /api/boards/{board_id}/chat`) loads the current board, sends it + the question + up to 20 prior messages to OpenRouter, validates the structured response against `AIBoardResponse`, then applies all operations through the same `apply_board_operations` transaction used elsewhere (so an invalid op anywhere in the batch rolls back the whole batch and never touches the board). History and message lengths are bounded in `schemas.py` (`ChatMessage` max 2000 chars, `history` max 20 entries, `assistant` text max 4000 chars).

## Frontend (`frontend/src/`)

- `app/page.tsx` -> `components/AuthGate.tsx` — real login/register forms; on success stores `{token, username}` in `localStorage` (`pm-auth-session`) via `useSyncExternalStore`, then renders `AppShell`. (`useSyncExternalStore`'s `getSnapshot` must return a stable reference when nothing changed — `readSession` caches the last-parsed session and only re-parses when the raw `localStorage` string actually differs, otherwise React re-renders in an infinite loop.)
- `components/AppShell.tsx` — holds the "which board is open" state; shows `BoardDashboard` or a `KanbanBoard`, plus the logout control.
- `components/BoardDashboard.tsx` — lists the signed-in user's boards (name inline-editable like a column title, card count, open/delete), and creates new ones.
- `components/KanbanBoard.tsx` — owns one board's state (`token` + `boardId` props), loads the snapshot on mount, wraps every mutation in `persist()` (optimistic update for drag-and-drop, rollback on API failure, always re-syncs from the server response). Drag-and-drop is `@dnd-kit/core` + `@dnd-kit/sortable` with a custom `collisionDetection` that prefers empty-column drops.
- `components/KanbanColumn.tsx`, `KanbanCard.tsx`, `KanbanCardPreview.tsx`, `NewCardForm.tsx`, `NewColumnForm.tsx` — column add/rename/delete, inline card edit (title, details, priority, due date) /delete, add-card form, drag overlay preview.
- `components/AiChatSidebar.tsx` — chat UI; sends only `{question, history}` to the backend, never provider credentials; shows a "Board updated" confirmation when the response changes columns/cards.
- `lib/api.ts` — the only place that talks to the backend. All requests go through `apiRequest()` (relative `/api/...`, `Authorization: Bearer <token>` header, typed `ApiError` on non-2xx).
- `lib/kanban.ts` — `BoardSnapshot` (API shape) <-> `BoardData` (UI shape) conversion (`boardFromApi`), plus the pure `moveCard` reducer used for the optimistic drag-and-drop update.
- `next.config.ts` sets `output: "export"` — the app must remain compatible with static export (no server components/actions that require a Node runtime).

## Commands

Backend (run from `backend/`, using `uv`):
```
uv run --frozen --no-sync pytest                                   # backend tests (see backend/AGENTS.md for the exact invocation used in CI)
uv run --frozen --no-sync pytest --cov=app --cov-report=term-missing  # with coverage
uv run --frozen --env-file .env python -m app.openrouter           # opt-in live OpenRouter smoke test, needs OPENROUTER_API_KEY
```
On Windows, pytest's default temp dir can hit a sandboxed-environment permission error; pass `--basetemp=.pytest_tmp` (gitignored) if you see `PermissionError` from `pytest-of-<user>`.

Frontend (run from `frontend/`):
```
npm run test:unit      # Vitest unit/component tests
npm run test:coverage  # Vitest with a v8 coverage report (src/ only)
npm run lint           # ESLint
npm run test:e2e       # Playwright; uses a local API mock by default
npm run build           # static export to out/
```
For Playwright against a real running container: set `PM_E2E_BASE_URL=http://127.0.0.1:<port>` and `PM_E2E_REAL_API=true`.

Full stack: `bash scripts/start.sh` or `powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1` (Docker required); app at `http://localhost:8000`.

## Conventions (from `AGENTS.md`)

- Keep it simple: no over-engineering, no speculative abstractions, no unrequested features or defensive code for cases that can't happen.
- No emojis anywhere (source, docs, UI copy).
- When debugging, find the root cause before changing code — don't guess-and-check.
- Color palette (see `AGENTS.md` for full list): accent yellow `#ecad0a`, blue `#209dd7`, purple `#753991`, navy `#032147`, gray `#888888`. Reuse the existing `var(--...)` CSS custom properties rather than hardcoding hex values in new components.
- Never commit secrets, the generated SQLite database, or build artifacts (`.env`, `backend/data/*.sqlite3`, `frontend/out/`, `frontend/node_modules/`, `frontend/.next/` are already gitignored).
- Per-directory `AGENTS.md` files (`backend/AGENTS.md`, `frontend/AGENTS.md`, `scripts/AGENTS.md`) have more focused notes — read the relevant one before working in that area.
