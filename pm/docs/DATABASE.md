# Database approach proposal

Status: proposed; implementation waits for user sign-off.

## Recommendation

Use a local SQLite database at `data/pm.sqlite3`, accessed through Python’s standard-library `sqlite3` module. Keep database access behind small backend domain functions so the API and later AI operations use the same validation and transaction behavior.

The machine-readable proposal is in [`kanban-schema.json`](./kanban-schema.json).

## Storage model

- `users` stores stable user IDs and unique usernames.
- `boards` stores one board per user for the MVP. The `UNIQUE(user_id)` constraint is deliberately documented as an MVP constraint so it can be removed if multiple boards become a requirement.
- `columns` stores the five initial stages and their editable titles.
- `cards` stores card content, its current column, and its position within that column.
- `schema_migrations` records applied schema versions so future changes are explicit and ordered.

Cards inherit ownership through `cards.column_id -> columns.board_id -> boards.user_id`. Every board mutation must verify that relationship before reading or changing a record.

## Ordering and mutation rules

Column and card positions are zero-based contiguous integers within their scope. A create, delete, or move operation rewrites the affected positions in one transaction. This keeps reads deterministic and avoids exposing database-specific ordering behavior to the frontend.

Column IDs and card IDs are stable text identifiers. Titles, details, column assignment, and positions are mutable. IDs and creation timestamps are immutable. Empty card details are stored as an empty string, not `NULL`.

The API snapshot may include `columns[].cardIds` for compatibility with the existing frontend. That field is derived from the card rows and is not stored redundantly in SQLite.

## Initialization and migrations

1. Resolve the configured database path under the project data directory.
2. Create the parent directory and database file when they do not exist.
3. Open SQLite with foreign-key enforcement enabled.
4. Apply pending ordered migrations inside a transaction.
5. Insert the hardcoded MVP user, board, and five default columns only when their stable IDs are absent.
6. Commit initialization before serving requests.

Initialization must be idempotent: restarting the app must not duplicate users, boards, columns, or cards.

## Future users

The schema keeps user ownership explicit and does not encode the hardcoded username into board or card rows. Supporting additional users later requires authentication and user-management behavior, not a redesign of the core relationships. The MVP keeps the UI and seed data limited to the single demo user.

## Approval gate

Please review and approve [`kanban-schema.json`](./kanban-schema.json) and this document before Part 6 database implementation begins.
