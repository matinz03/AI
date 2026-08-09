# Code review — Project Management MVP

Reviewed: full `pm/` codebase (backend + frontend + scripts/Docker) at the current `main` commit (`5d9e913`). Scope: correctness, security posture, maintainability, performance, and test coverage. This is a review, not a to-do list forced on the project — most items below are small and optional; none block the current MVP scope defined in [`docs/PLAN.md`](PLAN.md).

## Summary

The codebase is small, consistent, and unusually well-tested for its size (582 lines of backend tests, 653 lines of frontend tests against ~1,500 lines of application code). It follows its own stated conventions (`AGENTS.md`: no over-engineering, no unrequested defensive code) closely. All board mutations are transactional and ownership-checked; AI-driven changes go through the exact same validated code path as user-driven changes. No secrets are committed, and `.gitignore` correctly excludes `.env`, the SQLite database, and build artifacts.

The findings below are mostly small correctness/consistency nits and a couple of "know this before you scale past the MVP" notes — there is no data-loss or security bug that undermines the documented MVP scope.

## Findings

### 1. [Medium] Database re-initializes on every single API request — FIXED

**Where:** [`backend/app/main.py:42-45`](../backend/app/main.py) (as originally reviewed)

```python
def get_db_path(request: Request) -> Path:
    db_path = request.app.state.db_path
    initialize_database(db_path)
    return db_path
```

Every route depended on `get_db_path`, so `initialize_database()` — which opens a connection, runs `executescript()` over the full 5-table `CREATE TABLE IF NOT EXISTS` schema, and issues 15 `INSERT OR IGNORE` statements (migration row, user, board, 5 columns, 8 seed cards) — ran on **every** board read, mutation, and chat call. It was idempotent so it wasn't a correctness bug, but it was wasted work on the hot path, including the AI chat endpoint which is already the slowest route in the app.

**Fix applied:** `initialize_database(app.state.db_path)` now runs once, in a FastAPI `lifespan` startup hook, instead of inside the per-request `get_db_path` dependency:

```python
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    initialize_database(app.state.db_path)
    yield


app = FastAPI(title="Project Management MVP API", version="0.1.0", lifespan=lifespan)
app.state.db_path = DEFAULT_DB_PATH


def get_db_path(request: Request) -> Path:
    return request.app.state.db_path
```

All test fixtures that touch the database already enter the app via `with TestClient(app) as test_client:` (after setting `app.state.db_path` to a temp path), which triggers the lifespan startup at the right time — no test changes were needed. Full backend suite verified passing (26/26) after the change. `get_db_path` should just return the configured path.

### 2. [Low] Two request models bypass the shared strict-schema base

**Where:** [`backend/app/schemas.py:16`](../backend/app/schemas.py) (`ColumnRenameRequest`) and [`schemas.py:26`](../backend/app/schemas.py) (`CardUpdateRequest`)

Every other request/response model in the file extends `ApiModel`, which sets `extra="forbid"`. These two extend plain `BaseModel` instead, so an unexpected field (a typo like `"Title"`, or a stray field from a future frontend change) is silently dropped instead of producing a `422`. Inconsistent, and it weakens exactly the kind of typo-safety `extra="forbid"` exists for elsewhere in the same file.

**Recommendation:** change both to extend `ApiModel`.

### 3. [Low] Root `.env.example` doesn't match where the app actually reads its env file

**Where:** [`pm/.env.example`](../.env.example) vs. [`README.md:48`](../README.md), [`scripts/start.sh:18`](../scripts/start.sh), [`scripts/start.ps1:28`](../scripts/start.ps1)

The only `.env.example` in the repo lives at the project root, but every script and doc reads `backend/.env`. A new contributor who copies `pm/.env.example` to `pm/.env` (the natural move) gets no error — the AI feature just silently returns "AI service is not configured" (503) with no hint that the file is in the wrong place.

**Recommendation:** move the example to `backend/.env.example`, or add a one-line comment in the root file pointing at `backend/.env`.

### 4. [Low] AI system prompt schema is rebuilt on every chat request

**Where:** [`backend/app/ai_board.py:16`](../backend/app/ai_board.py)

```python
schema = json.dumps(AIBoardResponse.model_json_schema(), separators=(",", ":"))
```

`AIBoardResponse.model_json_schema()` is deterministic and has no per-request inputs, but it's regenerated and re-serialized on every call to `build_ai_messages`. Cheap in absolute terms, but pure waste on a path that already makes a network call.

**Recommendation:** hoist `schema` to a module-level constant computed once at import time.

### 5. [Low] No confirmation before deleting a card

**Where:** [`frontend/src/components/KanbanCard.tsx:120-127`](../frontend/src/components/KanbanCard.tsx)

The "Remove" button calls `onDelete(card.id)` directly on click — no confirmation step, unlike editing (which requires an explicit Save/Cancel choice). A single misclick permanently removes a card with no undo. Given the app already has a deliberate, low-friction "Add a card" / edit flow, a lightweight confirm (even a native `window.confirm`, or a two-step "Remove -> confirm" button state) would match the care already taken elsewhere in the UI.

### 6. [Low] Provider/validation failures are not logged server-side

**Where:** [`backend/app/main.py:67-81`](../backend/app/main.py) (`openrouter_configuration_handler`, `openrouter_service_handler`, `ai_response_validation_handler`)

All three exception handlers translate the internal error straight into a generic client-facing message with no `logger.exception(...)` (or any logging at all) in between. That's the right instinct for what the *client* should see, but it means every OpenRouter outage, timeout, or malformed-AI-response event is currently invisible on the server — there's nothing to grep when a user reports "the assistant isn't working." Worth a one-line log call per handler.

### 7. [Info] No regression test for the static-file path-traversal guard

**Where:** [`backend/app/main.py:206-214`](../backend/app/main.py) (`_resolve_static_file`), tests in [`backend/tests/test_main.py`](../backend/tests/test_main.py)

`_resolve_static_file` hand-rolls a check that a resolved static path stays inside `STATIC_DIR` before serving it — exactly the kind of logic that's easy to get subtly wrong and is worth pinning with a test. `test_main.py` currently only covers `/`, `/api/health`, `/api/example`, and one 404 case; there's no test asserting that a request like `/../app/main.py` or `/..%2f..%2fapp/main.py` is rejected rather than served. The current implementation looks correct (it uses `Path.resolve()` + `relative_to()`, which is the right approach), but a test would make that a guarantee instead of an observation.

### 8. [Info] Backend performs no password check at all — worth stating explicitly

**Where:** [`backend/app/main.py:48-54`](../backend/app/main.py) (`require_demo_user`)

This isn't a bug — it's explicitly documented in `README.md`, `AGENTS.md`, and `frontend/AGENTS.md` as an MVP-only, client-side-only gate. But it's worth stating plainly in one place for anyone assessing this project's security posture: the backend API has **no password check whatsoever**. Access control is entirely `X-Username: user` (a fixed, publicly-known string) plus a username path segment that must also equal `"user"`. Anyone who can reach the API — bypassing the frontend entirely with `curl` — can read and mutate the board with no credential. This is fine for a container bound to `localhost` for personal use, and the docs already say so; it just should never be exposed on a shared network or the public internet as-is, and that line is worth adding explicitly to the README's limitations section rather than left implicit in "MVP-only client-side gate."

## Things done well (worth preserving as the project grows)

- **Transactional AI operations.** `apply_board_operations` runs every operation from a single AI response inside one `open_database` transaction, so a partially-valid batch (e.g. op 1 valid, op 2 references a missing card) rolls back completely. This is directly tested (`test_invalid_ai_operation_rolls_back_every_change`).
- **Ownership checks are structural, not incidental.** Every card/column lookup joins all the way to `users.username` (`_get_card_for_user`, `_get_column_for_user`, `_get_board_id`), so there's no code path that can act on another user's data even as the schema grows toward multi-user support.
- **Position rewrites avoid unique-constraint races.** The two-phase negative-position staging in `_rewrite_positions`/`_move_card` correctly avoids transient `UNIQUE(column_id, position)` violations during reorders — this is exactly the kind of detail that's easy to get wrong, and it's correct here.
- **The AI is bound by the same validation and domain functions as the UI.** `AIBoardResponse` operations are Pydantic-validated, then dispatched through the identical `_rename_column`/`_create_card`/`_update_card`/`_move_card` functions the REST routes use — there's no separate, less-trusted code path for AI-originated writes.
- **Optimistic UI with real rollback.** `KanbanBoard.tsx`'s `persist()` helper applies drag-and-drop moves optimistically and rolls back to the previous board state on API failure, while every other mutation always re-syncs from the server response rather than trusting local state.
