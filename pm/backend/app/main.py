from pathlib import Path

from fastapi import FastAPI, HTTPException
from starlette.responses import FileResponse, HTMLResponse, Response

BASE_DIR = Path(__file__).resolve().parents[1]
STATIC_DIR = (BASE_DIR / "static").resolve()
INDEX_FILE = STATIC_DIR / "index.html"

app = FastAPI(title="Project Management MVP API", version="0.1.0")


@app.get("/api/health", tags=["system"])
def health() -> dict[str, str]:
    """Return a small readiness response for local and container checks."""

    return {"status": "ok"}


@app.get("/api/example", tags=["example"])
def example() -> dict[str, str]:
    """Return the example API response used by the Part 2 smoke test."""

    return {"message": "Hello from the PM backend"}


def _resolve_static_file(path: str) -> Path | None:
    candidate = (STATIC_DIR / path).resolve()

    try:
        candidate.relative_to(STATIC_DIR)
    except ValueError:
        return None

    return candidate if candidate.is_file() else None


@app.get("/", include_in_schema=False)
def index() -> Response:
    if INDEX_FILE.is_file():
        return FileResponse(INDEX_FILE)

    return HTMLResponse("<h1>Hello World</h1>")


@app.get("/{path:path}", include_in_schema=False)
def static_file(path: str) -> Response:
    if path == "api" or path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")

    file_path = _resolve_static_file(path)
    if file_path is not None:
        return FileResponse(file_path)

    if INDEX_FILE.is_file():
        return FileResponse(INDEX_FILE)

    return HTMLResponse("<h1>Not Found</h1>", status_code=404)
