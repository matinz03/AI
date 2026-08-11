# Frontend

The frontend is a Next.js App Router application for the Project Management app.

- `src/app/page.tsx` renders `AuthGate` at `/`.
- `src/components/` contains the auth gate, app shell (dashboard vs. board), board dashboard, board, columns, cards, drag-and-drop behavior, edit controls, new-card/new-column forms, shared icons, and the AI chat sidebar.
- `src/lib/kanban.ts` contains the UI board types (including `Priority`/`CardPatch`), API-snapshot conversion, and card movement logic.
- `src/lib/api.ts` is the browser-to-backend boundary for auth, boards, columns, cards, and chat. It sends `Authorization: Bearer <token>` and never contains provider credentials.
- `src/**/*.{test,spec}.{ts,tsx}` contains Vitest unit and component tests. `npm run test:coverage` runs them with a v8 coverage report scoped to `src/`.
- `tests/` contains Playwright browser integration tests.
- `next.config.ts` configures a static export. `npm run build` writes the deployable output to `out/`.

`src/components/AuthGate.tsx` holds real login/register forms, persists `{token, username}` in `localStorage` (`pm-auth-session`) via `useSyncExternalStore`, and renders `AppShell` once signed in. `AppShell` switches between `BoardDashboard` (list/create/rename/delete boards) and `KanbanBoard` for whichever board is open. `KanbanBoard` loads one board's persisted snapshot from FastAPI, reconciles every mutation from the response, and shows recoverable loading or API errors. `AiChatSidebar` sends only user questions and bounded conversation history to the backend; it never receives provider credentials.

The default Playwright suite uses a local API mock. Set `PM_E2E_BASE_URL` and `PM_E2E_REAL_API=true` to run the same browser flow against a running container.

Use the project color palette from the root `AGENTS.md`. Keep the visual design focused, avoid unrequested features, and do not add build-time dependencies on external services when a local option is sufficient.
