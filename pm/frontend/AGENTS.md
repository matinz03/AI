# Frontend

The frontend is a Next.js App Router application for the Project Management MVP.

- `src/app/page.tsx` renders the client-side Kanban demo at `/`.
- `src/components/` contains the board, columns, cards, drag-and-drop behavior, and new-card form.
- `src/lib/kanban.ts` contains the board data types, demo data, card movement logic, and ID generation.
- `src/**/*.{test,spec}.{ts,tsx}` contains Vitest unit and component tests.
- `tests/` contains Playwright browser integration tests.
- `next.config.ts` configures a static export. `npm run build` writes the deployable output to `out/`.

The current frontend is intentionally client-side only. It has no authentication, backend API, persistence, or AI integration yet; those are added in later plan parts.

Use the project color palette from the root `AGENTS.md`. Keep the visual design focused, avoid unrequested features, and do not add build-time dependencies on external services when a local option is sufficient.
