# Kanban Studio

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The static output is written to `out/` and is served by FastAPI in the Docker image.

## Tests

```bash
npm run test:unit
npm run test:e2e
```

Playwright uses a local API mock by default so the frontend suite can run independently. To exercise the real backend in a running container, set `PM_E2E_BASE_URL` and `PM_E2E_REAL_API=true`; the Docker workflow uses this mode for the persistence-backed smoke test.
