# Frontend

The frontend is a Next.js App Router application for the Project Management MVP.

- `src/app/page.tsx` renders the client-side sign-in gate and board at `/`.
- `src/components/` contains the board, columns, cards, drag-and-drop behavior, edit controls, and new-card form.
- `src/lib/kanban.ts` contains the UI board types, API-snapshot conversion, demo fixture data, and card movement logic.
- `src/lib/api.ts` is the browser-to-backend boundary for board reads and mutations. It sends the demo `X-Username: user` header and never contains provider credentials.
- `src/**/*.{test,spec}.{ts,tsx}` contains Vitest unit and component tests.
- `tests/` contains Playwright browser integration tests.
- `next.config.ts` configures a static export. `npm run build` writes the deployable output to `out/`.

`src/components/AuthGate.tsx` provides the MVP demo sign-in and local session gate. Once signed in, `KanbanBoard` loads the persisted snapshot from FastAPI, reconciles every mutation from the response, and shows recoverable loading or API errors. The UI still uses intentionally simple MVP authentication; it is not production security.

The default Playwright suite uses a local API mock. Set `PM_E2E_BASE_URL` and `PM_E2E_REAL_API=true` to run the same browser flow against a running container.

Use the project color palette from the root `AGENTS.md`. Keep the visual design focused, avoid unrequested features, and do not add build-time dependencies on external services when a local option is sufficient.
