# Ralph loop plan — comprehensive PM app

Continuation doc for the multi-iteration expansion from the single-user,
single-board MVP into a real multi-user, multi-board project management app.
Read this first in every iteration before making changes; update the
checklist as items land.

## Scope decided for this expansion

- Real user accounts: register/login/logout, hashed passwords, bearer-token
  sessions (no OAuth/third-party providers — out of scope, would over-engineer
  a local single-container app).
- Multiple boards per user (create/rename/delete/list), each with its own
  columns and cards.
- Custom columns per board (add/rename/delete/reorder) instead of a fixed
  five-column set, since boards are now user-created.
- Card metadata: `priority` (low/medium/high) and `due_date` (optional date).
- AI chat becomes per-board (`/api/boards/{board_id}/chat`) and gains the new
  operations it needs (create/delete column, set priority/due date) so it
  stays useful against the richer model.
- Frontend: login/register screen, board list/dashboard, board switcher,
  per-board AI sidebar, card priority/due-date UI, column management UI.

Explicitly out of scope (would be over-engineering for a local single-tenant
app): board sharing/collaborators, comments, file attachments, email
verification, password reset via email, OAuth/SSO, real-time sync/websockets.

## API redesign

The old `X-Username: user` demo header and `/api/users/{username}/board...`
paths are replaced entirely (this is a breaking change, done deliberately —
the old shape can't express "which board" or "which user, for real").

- `POST /api/auth/register` `{username, password}` -> `{token, username}`,
  also creates one default board for the new user.
- `POST /api/auth/login` `{username, password}` -> `{token, username}`.
- `POST /api/auth/logout` (bearer token) -> revokes the session.
- `GET /api/auth/me` (bearer token) -> `{username}`.
- `GET /api/boards` -> list of board summaries for the current user.
- `POST /api/boards` `{name}` -> create a board (seeded with default columns).
- `GET /api/boards/{board_id}` -> full snapshot (board + columns + cards).
- `PATCH /api/boards/{board_id}` `{name}` -> rename.
- `DELETE /api/boards/{board_id}`.
- `POST /api/boards/{board_id}/columns` `{title}` -> add column.
- `PATCH /api/boards/{board_id}/columns/{column_id}` `{title}` -> rename.
- `DELETE /api/boards/{board_id}/columns/{column_id}`.
- `POST /api/boards/{board_id}/columns/{column_id}/cards` -> create card.
- `PATCH /api/boards/{board_id}/cards/{card_id}` -> edit card (title, details,
  priority, due date).
- `POST /api/boards/{board_id}/cards/{card_id}/move` -> move card.
- `DELETE /api/boards/{board_id}/cards/{card_id}`.
- `POST /api/boards/{board_id}/chat` -> AI chat, scoped to one board.

All board/column/card routes require a valid bearer token and verify
ownership through the same join-chain pattern the MVP used, just rooted at
`boards.user_id` directly instead of via a hardcoded username.

## Data model changes

- `users`: add `password_hash`.
- `sessions`: new table, `token` (PK), `user_id`, `created_at`, `expires_at`.
- `boards`: drop `UNIQUE(user_id)` (many boards per user).
- `columns`: unchanged shape, but now user-managed (create/delete), not fixed.
- `cards`: add `priority` (`low`/`medium`/`high`, default `medium`) and
  `due_date` (nullable ISO date string).

Password hashing: stdlib-only PBKDF2-HMAC-SHA256 with a random per-user salt
(`app/auth.py`), stored as `pbkdf2_sha256$<iterations>$<salt_hex>$<hash_hex>`.
No new dependency — consistent with "keep it simple" in `AGENTS.md`.

## Checklist

### P0 — backend auth + multi-board (this is the foundation, do first)
- [x] `app/auth.py`: password hashing/verification, session token helpers.
- [x] `database.py`: schema v2 migration, user/session/board/column/card CRUD
      rewritten for multi-board + custom columns + card priority/due date.
- [x] `schemas.py`: auth + board + column request/response models.
- [x] `main.py`: new routes, `get_current_user` dependency replacing
      `require_demo_user`.
- [x] Rewrite backend tests for the new API shape; add auth + multi-board +
      custom-column + card-metadata coverage.
- [x] `uv run pytest` green.

### P1 — frontend auth + multi-board UI
- [x] `lib/api.ts`: bearer-token client, new endpoints.
- [x] Login/register screen replacing `AuthGate`'s hardcoded demo gate.
- [x] Board list/dashboard + create/rename/delete + switcher.
- [x] Column add/rename/delete UI.
- [x] Card priority + due date UI.
- [x] Update/add Vitest component tests for all of the above.
- [x] `npm run test:unit`, `npm run lint`, `npm run build` green.

### P2 — AI chat catch-up
- [x] Extend `ai_board.py` / `AIBoardResponse` operations for the richer
      model (create/delete column, set priority/due date) and scope chat to
      one board.
- [x] Update AI-related backend tests.

### P3 — polish + integration coverage
- [x] Playwright e2e: register -> create board -> add column -> add card ->
      set priority/due date -> AI chat -> logout -> login again flow.
- [x] Update `docs/DATABASE.md`, `docs/kanban-schema.json`, root/backend/
      frontend `CLAUDE.md`/`AGENTS.md` to describe the new model (drop the
      "MVP-only auth, don't fix it" language since it's now fixed).
- [x] Re-check coverage on backend (`pytest --cov`) and frontend once the
      above lands; fill gaps.

Work top-to-bottom; each item should leave `pytest`/`npm run test:unit`
green before moving on — this file is the continuity mechanism across loop
iterations, so keep it accurate.

## Status after the first pass (P0-P3 complete)

Backend: 59 tests passing, 96% coverage (100% on `auth.py`, `database.py`,
`schemas.py`; remaining gaps are the pre-existing static-file-serving branches
in `main.py` and provider-specific paths in `openrouter.py`, neither touched
by this expansion). Frontend: 63 Vitest tests + 10 Playwright e2e tests
passing, ~93% statement coverage on `src/` (the two 0% files are the trivial
`app/layout.tsx` / `app/page.tsx` wrappers). Verified by hand against a real
`uvicorn` + built static export in the browser: register, open the seeded
board, add a custom column, add a card with high priority and a due date, hit
the AI chat's "not configured" error path cleanly, log out, and log back in
with the board state intact.

One real bug was caught and fixed by writing tests, not just by inspection:
`get_user_id_for_token`'s expired-session cleanup used to delete the row and
then raise inside the *same* `open_database` transaction, so the `except`
branch in `open_database` rolled the delete back before it ever reached disk
— expired sessions were rejected correctly but never actually pruned. Fixed
by deleting in a separate transaction after the read, then raising outside
any transaction.

## Status after the second pass (labels + search complete)

Added board-scoped labels (fixed 5-color palette matching the project's
existing CSS vars — no new colors, per `AGENTS.md`'s palette rule) with
create/delete and per-card attach/detach, plus a client-side search box that
filters cards by title/details across all columns (with a distinct "No
matching cards" empty state vs. the genuinely-empty "Drop a card here").

Backend: 68 tests passing, 96% coverage (100% on `auth.py`, `database.py`,
`schemas.py`; same pre-existing gaps as before in `main.py`/`openrouter.py`,
untouched by this round). Frontend: 68 Vitest tests + 12 Playwright e2e tests
passing, ~93% statement coverage. Verified by hand against a real backend:
created a label, attached it to a card, confirmed the chip renders, searched
and confirmed non-matching cards and empty columns respond correctly, then
reloaded and confirmed both cards and the label attachment persisted.

Noticed but not fixed (out of this round's scope, listed below): if a
session expires while `BoardDashboard` is mounted, the failed `listBoards`
call surfaces a raw "Invalid session." banner instead of returning the user
to the login screen. `AuthGate` has no mechanism today to react to a 401
from deeper in the tree and clear the stored session.

## Ideas for the next pass (not started; pick from here)

Roughly in priority order, but re-evaluate against what the user actually
asks for in each iteration rather than grinding this list mechanically:

- **Auto-logout on an expired/invalid session** — see the gap noted above.
  Simplest fix: a shared `onUnauthorized` callback threaded down to
  `persist()`/`load()` call sites (or a thin wrapper around `apiRequest`)
  that clears the stored session on any 401, so the user lands back on the
  login screen instead of seeing a raw error string.
- **Board activity log** — an append-only `activity` table recording who did
  what and when, surfaced as a feed per board. Useful now that boards are
  multi-user-owned in spirit even though sharing isn't in scope.
- **Card comments** — a `comments` table keyed by card, simple timestamped
  text entries; no editing/threading (keep it simple).
- **Due-date-aware dashboard** — surface overdue/upcoming-across-all-boards
  on the board-list screen, reusing the per-card overdue logic already in
  `KanbanCard.tsx`.
- **Column reordering** (drag columns, not just cards) — `@dnd-kit` already
  in use for cards; extending it to columns is additive, not a new pattern.
- **Filter by label**, not just free-text search — the label data model
  already supports it; add a label-chip toggle row next to the search box.
- **Bulk AI operations safety net** — the AI can already create columns and
  edit card metadata; consider whether a per-response operation cap or a
  "preview before applying" step is worth it as boards get busier. Only if
  asked — don't add friction to a feature that works.

Explicitly still out of scope unless the user asks: board sharing/
collaborators, file attachments, email verification/password reset, OAuth,
real-time sync/websockets, notifications.
