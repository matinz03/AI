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

The application is available at <http://localhost:8000>. The scaffolding page is served at `/`, with API checks at `/api/health` and `/api/example`.

Stop the container with the matching `stop.sh` or `stop.ps1` script.

The static Next.js frontend is served by FastAPI in the Docker image. The OpenRouter configuration is integrated in Part 8.
