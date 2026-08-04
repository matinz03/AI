# Backend

The backend is a FastAPI application managed with `uv`.

- `app/main.py` exposes the health, example, and authenticated Kanban API routes, then serves the static frontend.
- `app/database.py` owns SQLite initialization, seed data, ownership checks, and transactional board mutations.
- `app/schemas.py` contains the request and response validation models.
- `tests/` contains backend tests run with `uv --no-cache run --frozen --no-sync pytest` in this workspace.
- `pyproject.toml` and `uv.lock` define the runtime and development dependencies.

The default database is `backend/data/pm.sqlite3`. It is created automatically on the first API request and is ignored by Git. The demo API accepts `X-Username: user` and only exposes the hardcoded user’s board; the frontend sign-in remains an MVP-only client-side gate, not production authentication.

Kanban routes are documented in `docs/DATABASE.md` and use the board snapshot shape from `docs/kanban-schema.json`:

- `GET /api/users/user/board`
- `PATCH /api/users/user/board/columns/{column_id}`
- `POST /api/users/user/board/cards`
- `PATCH /api/users/user/board/cards/{card_id}`
- `POST /api/users/user/board/cards/{card_id}/move`
- `DELETE /api/users/user/board/cards/{card_id}`

Keep provider keys and other secrets out of source control and browser responses. Later parts will add the server-side AI integration.
