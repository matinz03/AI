# Project Management MVP

## Part 2 scaffolding

Prerequisite: Docker Desktop or Docker Engine.

Start on macOS or Linux:

```bash
bash scripts/start.sh
```

Start on Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1
```

The application is available at <http://localhost:8000>. The board is served at `/`, with API checks at `/api/health` and `/api/example`.

Stop the container with the matching `stop.sh` or `stop.ps1` script.

The static Next.js frontend is served by FastAPI in the Docker image.

The current demo sign-in uses username `user` and password `password`. This is an MVP-only client-side gate, not production authentication.

## Persistent Kanban API

The backend creates and seeds `backend/data/pm.sqlite3` automatically. The start scripts attach the named Docker volume `pm-mvp-data` by default, so stopping and starting the container preserves board changes. Set `PM_VOLUME_NAME` to use a different volume.

The authenticated board API expects `X-Username: user`:

- `GET /api/users/user/board`
- `PATCH /api/users/user/board/columns/{column_id}` with `{"title":"..."}`
- `POST /api/users/user/board/cards` with `{"columnId":"...","title":"...","details":"..."}`
- `PATCH /api/users/user/board/cards/{card_id}` with one or both of `title` and `details`
- `POST /api/users/user/board/cards/{card_id}/move` with `{"columnId":"...","position":0}`
- `DELETE /api/users/user/board/cards/{card_id}`

The mutation routes return the complete current board snapshot. Validation failures return `422`, missing records return `404`, and missing or mismatched demo authentication returns `401`.

After sign-in, the frontend loads this snapshot and sends column and card changes back to the API. It shows a loading state while the board is fetched, reconciles successful mutations from the server response, rolls back failed drag moves, and keeps recoverable API errors visible without blocking the rest of the board.

For frontend verification, run `npm run test:unit`, `npm run lint`, and `npm run test:e2e` from `frontend/`. The default browser suite uses a local API mock; to exercise a running Docker container, set `PM_E2E_BASE_URL=http://127.0.0.1:<port>` and `PM_E2E_REAL_API=true` before running `npm run test:e2e`.

## OpenRouter connectivity check

Set `OPENROUTER_API_KEY` in `backend/.env`, then run this opt-in live check from the project root:

```powershell
Push-Location backend
uv run --frozen --env-file .env python -m app.openrouter
Pop-Location
```

It sends a simple `2 + 2` prompt to `openai/gpt-oss-20b:free` through OpenRouter. The key stays server-side and is never printed. Normal tests use mocked provider responses and do not require a key or network access.

## AI board API

`POST /api/users/user/board/chat` accepts `X-Username: user` and a body such as `{"question":"Move card-1 to Done","history":[]}`. The backend sends the current persisted board, question, and up to 20 prior user or assistant messages to OpenRouter. It returns the assistant text plus the resulting board snapshot.

The AI can only request `create_card`, `update_card`, `move_card`, or `rename_column` operations. Invalid responses or invalid board references are rejected without any persisted change. Omit `history` for a new conversation; longer histories are rejected rather than silently truncated.
