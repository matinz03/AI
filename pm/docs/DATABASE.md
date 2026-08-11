# Database design

Status: implemented (schema v2 — real accounts, multiple boards per user).

## Overview

A local SQLite database at `backend/data/pm.sqlite3`, accessed through Python's standard-library `sqlite3` module. Database access lives behind small backend domain functions in `app/database.py` so the API and the AI operations use the same validation and transaction behavior.

The machine-readable schema is in [`kanban-schema.json`](./kanban-schema.json).

## Storage model

- `users` stores stable user IDs, unique usernames, and a PBKDF2 password hash (`app/auth.py`).
- `sessions` stores bearer tokens issued on register/login, with an expiry checked on every authenticated request.
- `boards` stores any number of boards per user (no uniqueness constraint on `user_id`).
- `columns` stores each board's user-managed stages (add/rename/delete), seeded with five defaults (`Backlog`, `Discovery`, `In Progress`, `Review`, `Done`) when a board is created.
- `cards` stores card content, its current column, position within that column, `priority` (`low`/`medium`/`high`), and an optional `due_date`.
- `schema_migrations` records applied schema versions so future changes are explicit and ordered.

Ownership is always verified through the relationship chain: `sessions.user_id -> users.id`, `boards.user_id -> users.id`, `columns.board_id -> boards.id`, `cards.column_id -> columns.id`. Every board, column, and card mutation checks that the requesting user's ID owns the board before reading or changing anything under it.

## Ordering and mutation rules

Column and card positions are zero-based contiguous integers within their scope (`board_id` for columns, `column_id` for cards). A create, delete, or move operation rewrites the affected positions in one transaction using a two-phase rewrite (temporary negative positions first) to avoid violating the `UNIQUE(scope, position)` constraints mid-update.

Column IDs and card IDs are stable text identifiers. Titles, details, priority, due date, column assignment, and positions are mutable. IDs and creation timestamps are immutable. Empty card details are stored as an empty string, not `NULL`.

The API board snapshot includes `columns[].cardIds`, derived from the card rows on every read and not stored redundantly in SQLite.

## Auth and sessions

- Passwords are hashed with PBKDF2-HMAC-SHA256 and a random per-user salt (`app/auth.py`); no plaintext password is ever stored or logged.
- A session is a random URL-safe token stored in `sessions`, valid for 30 days from creation. `GET/POST/PATCH/DELETE` routes resolve the current user from the `Authorization: Bearer <token>` header.
- An expired token is rejected with `401` and its row is deleted (in its own transaction, separate from the read that detected the expiry, so the cleanup actually commits).

## Initialization

1. Resolve the configured database path under the project data directory.
2. Create the parent directory and database file when they do not exist.
3. Open SQLite with foreign-key enforcement enabled.
4. Apply the schema (`CREATE TABLE IF NOT EXISTS ...`) inside a transaction.
5. Record the current schema version in `schema_migrations`.

Initialization does not seed any user, board, or card data — every user, board, column, and card is created through the API (registering creates one default board automatically).
