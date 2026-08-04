# Backend

The backend is a FastAPI application managed with `uv`.

- `app/main.py` exposes the Part 2 health and example API routes and serves static files.
- `static/index.html` is the temporary Part 2 example page; it will be replaced by the static Next.js output in Part 3.
- `tests/` contains backend tests run with `uv run pytest`.
- `pyproject.toml` and `uv.lock` define the runtime and development dependencies.

Keep provider keys and other secrets out of source control and browser responses. Later parts will add SQLite persistence and the server-side AI integration.
