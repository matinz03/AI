# PM — Project Management MVP

A locally run project-management web app: sign in, manage a single Kanban board, and chat with an AI assistant that can edit the board. See [`AGENTS.md`](AGENTS.md) for the original product brief and coding standards, and [`docs/PLAN.md`](docs/PLAN.md) for the part-by-part delivery history (all 10 parts are complete).

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
- `database.py` — everything SQLite: schema DDL, seeding, and all domain read/mutation functions (`get_board`, `rename_column`, `create_card`, `update_card`, `move_card`, `delete_card`, `apply_board_operations`). Each public function opens its own connection via the `open_database` context manager (commit on success, rollback on exception) and returns a fresh board snapshot.
- `schemas.py` — Pydantic request/response/AI-operation models. `ApiModel` (extra="forbid", populate_by_name) is the base for most models; note `ColumnRenameRequest` and `CardUpdateRequest` do **not** inherit from it.
- `ai_board.py` — builds the OpenRouter chat payload (JSON-schema system prompt + bounded history + board+question), validates the JSON response against `AIBoardResponse`.
- `openrouter.py` — thin `httpx` client for OpenRouter (`OPENROUTER_API_KEY`, model `openai/gpt-oss-20b:free`, 15s timeout). Also runnable standalone as a live connectivity smoke test (`python -m app.openrouter`).

### Data model

SQLite at `backend/data/pm.sqlite3` (gitignored, auto-created and seeded on first access via `initialize_database`, called per-request through the `get_db_path` dependency). Tables: `users` -> `boards` (1:1 per user for the MVP, `UNIQUE(user_id)`) -> `columns` -> `cards`. Ownership is always verified through a join chain (`cards.column_id -> columns.board_id -> boards.user_id -> users.username`) — see `_get_card_for_user` / `_get_column_for_user` / `_get_board_id`. Full design rationale in [`docs/DATABASE.md`](docs/DATABASE.md); machine-readable shape in [`docs/kanban-schema.json`](docs/kanban-schema.json).

Column/card `position` is zero-based and contiguous within its parent scope. Moves use a two-phase rewrite (`_rewrite_positions` stages negative temporary positions first) to avoid violating the `UNIQUE(column_id/board_id, position)` constraints mid-update. Every mutation runs inside one `open_database` transaction, so a failure leaves zero partial state — this is covered by dedicated tests (`test_invalid_ai_operation_rolls_back_every_change`, `test_invalid_payloads_and_missing_records_do_not_mutate_state`).

### Auth model (MVP-only, not real security)

`require_demo_user` (in `main.py`) hardcodes everything to a single user: the `{username}` path segment and the `X-Username` header must both equal `"user"` (`DEFAULT_USERNAME`), or the request gets `401`. There is no session/token/cookie. This is intentional and documented — do not "fix" it into real auth without being asked.

### AI board operations

The AI can only emit `rename_column`, `create_card`, `update_card`, or `move_card` (no delete) — see `BoardOperation` in `schemas.py`. The chat route (`POST /api/users/user/board/chat`) loads the current board, sends it + the question + up to 20 prior messages to OpenRouter, validates the structured response against `AIBoardResponse`, then applies all operations through the same `apply_board_operations` transaction used elsewhere (so an invalid op anywhere in the batch rolls back the whole batch and never touches the board). History and message lengths are bounded in `schemas.py` (`ChatMessage` max 2000 chars, `history` max 20 entries, `assistant` text max 4000 chars).

## Frontend (`frontend/src/`)

- `app/page.tsx` -> `components/AuthGate.tsx` — client-only demo sign-in (`user`/`password`) gated by `localStorage` (`pm-mvp-authenticated`), via `useSyncExternalStore`. Not real auth; mirrors the backend's demo-only posture.
- `components/KanbanBoard.tsx` — owns board state, loads the snapshot on mount, wraps every mutation in `persist()` (optimistic update for drag-and-drop, rollback on API failure, always re-syncs from the server response). Drag-and-drop is `@dnd-kit/core` + `@dnd-kit/sortable` with a custom `collisionDetection` that prefers empty-column drops.
- `components/KanbanColumn.tsx`, `KanbanCard.tsx`, `KanbanCardPreview.tsx`, `NewCardForm.tsx` — column rename (blur-to-save input), inline card edit/delete, add-card form, drag overlay preview.
- `components/AiChatSidebar.tsx` — chat UI; sends only `{question, history}` to the backend, never provider credentials; shows a "Board updated" confirmation when the response changes columns/cards.
- `lib/api.ts` — the only place that talks to the backend. All requests go through `apiRequest()` (relative `/api/...`, `X-Username` header, typed `ApiError` on non-2xx).
- `lib/kanban.ts` — `BoardSnapshot` (API shape) <-> `BoardData` (UI shape) conversion (`boardFromApi`), plus the pure `moveCard` reducer used for the optimistic drag-and-drop update.
- `next.config.ts` sets `output: "export"` — the app must remain compatible with static export (no server components/actions that require a Node runtime).

## Commands

Backend (run from `backend/`, using `uv`):
```
uv run --frozen --no-sync pytest          # backend tests (see backend/AGENTS.md for the exact invocation used in CI)
uv run --frozen --env-file .env python -m app.openrouter   # opt-in live OpenRouter smoke test, needs OPENROUTER_API_KEY
```

Frontend (run from `frontend/`):
```
npm run test:unit     # Vitest unit/component tests
npm run lint          # ESLint
npm run test:e2e      # Playwright; uses a local API mock by default
npm run build          # static export to out/
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
