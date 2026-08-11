# Backend

The backend is a FastAPI application managed with `uv`.

- `app/main.py` exposes the health/example routes, auth routes, and authenticated board/column/card API routes, then serves the static frontend.
- `app/auth.py` owns password hashing/verification and session-token generation.
- `app/database.py` owns SQLite initialization, ownership checks, and transactional user/session/board/column/card mutations.
- `app/schemas.py` contains the request and response validation models.
- `tests/` contains backend tests, run with `uv run --frozen --no-sync pytest` in this workspace (add `--basetemp=.pytest_tmp` on Windows if the default temp dir raises a `PermissionError`). `tests/conftest.py` has the shared `client` fixture and `register`/`auth_headers`/`column_id_by_title` helpers used across test modules.
- `pyproject.toml` and `uv.lock` define the runtime and development dependencies (including the `pytest-cov` dev dependency for coverage).

The default database is `backend/data/pm.sqlite3`. It is created automatically at app startup and is ignored by Git. Every route except `/api/health`, `/api/example`, `/api/auth/register`, and `/api/auth/login` requires `Authorization: Bearer <token>`, resolved to the current user via `get_current_user_id` in `main.py`.

Routes are documented in `docs/DATABASE.md` and use the board snapshot shape from `docs/kanban-schema.json`:

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/boards`, `POST /api/boards`, `GET /api/boards/{board_id}`, `PATCH /api/boards/{board_id}`, `DELETE /api/boards/{board_id}`
- `POST /api/boards/{board_id}/columns`, `PATCH /api/boards/{board_id}/columns/{column_id}`, `DELETE /api/boards/{board_id}/columns/{column_id}`
- `POST /api/boards/{board_id}/columns/{column_id}/cards`, `PATCH /api/boards/{board_id}/cards/{card_id}`, `POST /api/boards/{board_id}/cards/{card_id}/move`, `DELETE /api/boards/{board_id}/cards/{card_id}`
- `POST /api/boards/{board_id}/chat`

The chat route loads the current board server-side, accepts a bounded history, and only applies validated AI board operations transactionally. Keep provider keys, password hashes, and session tokens out of source control and browser-visible logs.
