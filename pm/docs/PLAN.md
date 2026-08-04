# Project Management MVP plan

## Status and delivery gates

- Current status: planning.
- Part 1 must be reviewed and approved by the user before Part 2 begins.
- Part 5 must be reviewed and approved by the user before database implementation in Part 6 begins.
- Each part should be completed and verified before moving to the next part.
- Checklists are updated by the agent as work is completed; unchecked items are not implied to be done.

## Product scope

The MVP is a locally running project-management web app with:

- A single hardcoded sign-in: username `user`, password `password`.
- One Kanban board for the signed-in user.
- Fixed Kanban columns whose names can be changed.
- Cards that can be created, edited, moved with drag and drop, and persisted.
- An AI chat sidebar that can answer questions and create, edit, or move one or more cards.
- A SQLite database created automatically when it does not already exist.
- A Docker-based local runtime with start and stop scripts for macOS, Windows, and Linux.

The MVP will support a data model that can accommodate multiple users in the future, while exposing only the single hardcoded user in this release.

## Technical constraints and decisions

- Frontend: Next.js, statically exported for production serving.
- Backend: Python FastAPI.
- Runtime: one Docker container. FastAPI serves the static Next.js output at `/` and exposes the API under `/api`.
- Python package manager in the container: `uv`.
- Database: local SQLite file, initialized on application startup or first database access.
- AI provider: OpenRouter, using model `openai/gpt-oss-120b` and `OPENROUTER_API_KEY` from the project-root `.env` file.
- Existing frontend: use the current frontend demo as the starting point; preserve working behavior while adapting it to the backend and static build.
- Visual design: use the project palette documented in `pm/AGENTS.md`.
- Keep the implementation simple. Avoid unrequested features, unnecessary abstractions, and speculative defensive code.
- Never commit secrets, generated databases, or unnecessary build artifacts.
- No emojis in source, documentation, or user-facing application copy.

## Test strategy

- Backend unit tests cover pure logic, database operations, API routes, authentication behavior, and AI response validation.
- Frontend unit tests cover components and state transitions.
- Frontend integration tests cover login, board interactions, API integration, and chat behavior.
- Container smoke tests verify the built application through the published HTTP port.
- External OpenRouter tests are opt-in smoke tests and must not make normal unit-test runs depend on network access or a live API key.
- Tests should verify both successful behavior and the smallest set of relevant failure cases: invalid input, missing records, unauthorized requests, malformed AI output, and unavailable dependencies.

## Part 1: Detailed plan and approval

### Checklist

- [x] Confirm the MVP scope, technical decisions, color palette, and constraints in this document.
- [x] Inspect the existing frontend structure, scripts, dependencies, routes, and current test coverage.
- [x] Record the intended boundaries between frontend-only work, backend work, database work, and AI work.
- [x] Define the API and persistence assumptions needed by later parts without implementing them yet.
- [x] Define the test commands and local verification approach for each implementation part.
- [x] Review this plan with the user and capture approval before starting Part 2.

### Tests

- [x] Planning review confirms every original high-level step has detailed substeps, tests, and success criteria.
- [x] The existing frontend can be inspected and its current run/build commands are known before scaffolding changes are made.

### Success criteria

- This document is complete enough to execute in order without silently changing the product scope.
- The user explicitly approves the plan.
- No implementation work begins before that approval.

## Part 2: Docker and backend scaffolding

### Checklist

- [x] Inspect the existing frontend package metadata and determine the smallest compatible static-build integration.
- [x] Create the minimal FastAPI application under `backend/` with a clear application entry point.
- [x] Add a health or status API route under `/api`.
- [x] Add a minimal example API response that the frontend can request.
- [x] Add static-file serving and a fallback for the example frontend page.
- [x] Create the Docker build so the backend and example static files are packaged into one image; defer the Next.js build integration to Part 3.
- [x] Add the required Python dependency configuration managed by `uv`.
- [x] Add a `.dockerignore` and document required environment variables without copying secrets into the image.
- [x] Add start and stop scripts in `scripts/` for macOS, Windows, and Linux.
- [x] Make the scripts fail clearly when Docker is unavailable and avoid deleting unrelated containers or files.
- [x] Add a minimal README section describing how to start, stop, and verify the container.

### Tests

- [x] Backend unit test: the health/status route returns the expected response.
- [x] Backend unit test: the example API route returns valid JSON.
- [x] Build test: the Docker image builds successfully from a clean checkout.
- [x] Smoke test: the running container serves the example HTML at `/`.
- [x] Smoke test: the running container serves the example API response under `/api`.
- [x] Script checks: the Windows scripts parse and execute successfully; the Unix scripts were reviewed and target only this project’s named container, but Bash execution is unavailable in this Windows workspace.

### Success criteria

- A clean local checkout can be built into one Docker image without requiring the existing frontend build.
- Starting the container exposes a working HTML page and API response through one port.
- Stopping the application is repeatable and does not affect unrelated Docker resources.
- The backend starts without requiring a database file or an OpenRouter key.

## Part 3: Add the existing frontend

### Checklist

- [ ] Read and document the existing frontend architecture in `frontend/AGENTS.md` before making frontend changes.
- [ ] Identify the current board components, data shape, styling, scripts, and existing tests.
- [ ] Configure the Next.js app for a static production export compatible with FastAPI serving.
- [ ] Update the Docker build to compile the static Next.js output and copy it into the backend image.
- [ ] Make asset paths, client-side routing, and browser-only code work from the served root path.
- [ ] Integrate the existing demo Kanban board into the Docker build output.
- [ ] Add the minimal frontend API client boundary that later parts can replace with real persistence.
- [ ] Preserve the existing board’s visual behavior and the documented color palette.
- [ ] Ensure the board is displayed at `/` when the app is served from the container.

### Tests

- [ ] Frontend unit tests cover the board rendering and representative card/column interactions.
- [ ] Frontend build test confirms the static export completes without errors.
- [ ] Integration test confirms the served root page renders the demo board.
- [ ] Container smoke test confirms static assets load successfully through FastAPI.

### Success criteria

- The existing demo Kanban board is accessible at `/` from the Docker-served application.
- Static output contains all required JavaScript, CSS, and assets.
- No frontend feature regresses as a result of the static export.
- The frontend test suite and production build pass.

## Part 4: Fake user sign-in experience

### Checklist

- [ ] Define the minimal authentication state and session behavior for the hardcoded user.
- [ ] Add the sign-in screen shown when there is no active session.
- [ ] Accept only username `user` and password `password`.
- [ ] Show a clear validation error for invalid credentials without exposing secrets.
- [ ] Keep the Kanban board inaccessible through the normal UI until sign-in succeeds.
- [ ] Preserve the signed-in state across normal page refreshes for the local session model.
- [ ] Add a logout action that clears the session and returns the user to sign-in.
- [ ] Keep the authentication boundary compatible with later backend API authorization.

### Tests

- [ ] Unit test: sign-in form renders and validates required fields.
- [ ] Integration test: invalid credentials do not reveal the board.
- [ ] Integration test: valid credentials reveal the board.
- [ ] Integration test: refresh preserves the intended local session state.
- [ ] Integration test: logout clears access and returns to sign-in.
- [ ] Integration test: unauthenticated navigation cannot reach the board through the normal route flow.

### Success criteria

- A new visitor sees sign-in before the Kanban board.
- Only the specified dummy credentials succeed.
- Sign-in, refresh, and logout behavior is deterministic and tested.
- The implementation remains explicitly MVP-only and is not presented as production security.

## Part 5: Database schema proposal and sign-off

### Checklist

- [ ] Define the JSON representation of the proposed relational SQLite model in `docs/`.
- [ ] Model users, boards, columns, cards, ordering, ownership, and timestamps needed for the MVP.
- [ ] Define stable identifiers and the relationship between the hardcoded user and their single board.
- [ ] Define ordering semantics for columns and cards, including drag-and-drop moves.
- [ ] Define which fields are required, nullable, mutable, and unique.
- [ ] Define initialization and migration expectations for a missing or newly created database.
- [ ] Document how the proposed model supports multiple users later without adding MVP UI.
- [ ] Add examples for an empty board and a representative populated board.
- [ ] Review the proposal with the user and obtain sign-off before implementing database access.

### Tests

- [ ] Validate that the schema proposal is valid JSON.
- [ ] Validate the examples against the documented shape.
- [ ] Review the model against all required board operations: read, edit, create, move, and delete.
- [ ] Confirm the model can represent the existing frontend demo data without losing required information.

### Success criteria

- The schema proposal is stored in `docs/` and is understandable without reading implementation code.
- The user signs off on the schema before Part 6 starts.
- The proposal covers current MVP behavior and leaves a clear, minimal path to multiple users.

## Part 6: Persistent backend Kanban API

### Checklist

- [ ] Implement SQLite initialization that creates the database and required tables when absent.
- [ ] Seed the hardcoded user and a default board only when required records do not exist.
- [ ] Implement backend data-access functions for board reads and mutations.
- [ ] Add API routes to read the signed-in user’s board.
- [ ] Add API routes to rename columns and create, edit, move, and delete cards.
- [ ] Validate request bodies and enforce ownership of the requested board data.
- [ ] Return stable, documented JSON responses and useful HTTP errors.
- [ ] Keep mutations transactional so a failed operation does not leave partial board state.
- [ ] Document the API routes and local database location.

### Tests

- [ ] Unit test: a missing database is created with the expected schema.
- [ ] Unit test: initialization is idempotent and does not duplicate the user, board, or seed data.
- [ ] Unit test: board reads return columns and cards in the documented order.
- [ ] Unit test: column rename and card create/edit/move/delete operations persist correctly.
- [ ] API test: invalid payloads return validation errors.
- [ ] API test: missing cards or columns return appropriate not-found errors.
- [ ] API test: ownership and authentication checks reject unauthorized access.
- [ ] API test: failed mutations do not partially persist changes.

### Success criteria

- The backend can create a fresh SQLite database and serve a complete board.
- All required board mutations persist across application restarts.
- The API is covered by repeatable automated tests and does not require OpenRouter access.

## Part 7: Connect the frontend to the backend

### Checklist

- [ ] Replace demo-only board state with the backend API as the source of truth.
- [ ] Load the board after successful sign-in and show a clear loading state.
- [ ] Connect column renaming and card create/edit/move/delete actions to API mutations.
- [ ] Refresh or reconcile board state after successful mutations so the UI reflects persisted data.
- [ ] Show concise errors and provide a recoverable path when an API request fails.
- [ ] Preserve drag-and-drop behavior and prevent accidental duplicate submissions.
- [ ] Verify that a restart of the container does not lose persisted board data.

### Tests

- [ ] Frontend unit tests cover API client success and error handling.
- [ ] Integration test: board data loads from the backend after sign-in.
- [ ] Integration test: column and card changes reach the backend and update the UI.
- [ ] Integration test: drag-and-drop persists the new card order and column.
- [ ] Integration test: a browser refresh reloads persisted state.
- [ ] Integration test: API failures produce a usable error state.
- [ ] End-to-end container test covers the primary sign-in-to-edit workflow.

### Success criteria

- The app behaves as a persistent Kanban board rather than a frontend-only demo.
- Every supported board mutation survives refresh and container restart.
- The UI remains usable during loading, mutation, and recoverable error states.

## Part 8: OpenRouter connectivity

### Checklist

- [ ] Add a small backend AI client with configuration loaded from `OPENROUTER_API_KEY`.
- [ ] Configure the requested `openai/gpt-oss-120b` model and required OpenRouter request metadata.
- [ ] Keep the API key server-side and out of logs, responses, client bundles, and committed files.
- [ ] Add a minimal backend service operation that sends a simple `2+2` prompt.
- [ ] Add bounded timeout and clear error handling for unavailable or rejected AI calls.
- [ ] Document how to run the opt-in live connectivity check locally.

### Tests

- [ ] Unit test: missing configuration fails with a clear configuration error.
- [ ] Unit test: the AI client sends the expected model and prompt using a mocked HTTP response.
- [ ] Unit test: provider errors and malformed responses become controlled backend errors.
- [ ] Opt-in live smoke test: OpenRouter returns a response to the `2+2` prompt when a valid key is supplied.

### Success criteria

- The backend can make a verified live OpenRouter call when configured.
- Normal automated tests remain deterministic and do not require a live provider.
- Secrets are never exposed in source control, browser code, logs, or API responses.

## Part 9: Structured AI board operations

### Checklist

- [ ] Define the AI request payload containing the current board JSON, the user’s question, and conversation history.
- [ ] Define a strict structured response model containing the assistant response and an optional board update.
- [ ] Define the smallest board-operation format needed to create, edit, move, and rename without allowing arbitrary database commands.
- [ ] Send the schema and instructions to the AI on every relevant request.
- [ ] Validate the provider response against the structured model before applying any update.
- [ ] Reject invalid, incomplete, or unauthorized board updates without changing persisted state.
- [ ] Apply valid updates transactionally through the same backend domain functions used by the UI.
- [ ] Return the assistant response and the resulting board state needed by the frontend.
- [ ] Bound conversation history and document the behavior when history is absent or too long.

### Tests

- [ ] Unit test: the request includes the complete current board JSON, question, and history.
- [ ] Unit test: valid structured responses parse into the expected domain operations.
- [ ] Unit test: malformed or incomplete structured responses are rejected safely.
- [ ] Unit test: valid create, edit, move, and rename operations are applied correctly.
- [ ] Unit test: invalid operations are rejected without partial persistence.
- [ ] Integration test: a mocked AI response updates the board and returns the assistant text.
- [ ] Integration test: a response without an update leaves the board unchanged.
- [ ] Integration test: provider timeout or failure leaves the board unchanged and returns a usable error.

### Success criteria

- Every AI board change is schema-validated, ownership-checked, and applied transactionally.
- The AI always receives the current board context, the user’s question, and conversation history.
- The backend returns a clear assistant response whether or not a board update was requested.

## Part 10: AI chat sidebar UI

### Checklist

- [ ] Add a visually polished sidebar widget using the existing color palette and app layout.
- [ ] Add conversation history display with clear user and assistant message states.
- [ ] Add message entry, submit behavior, loading state, and error state.
- [ ] Send the current board context through the backend chat endpoint rather than exposing provider credentials.
- [ ] Apply returned board updates and refresh the Kanban automatically when an update is present.
- [ ] Make the update visible enough that users understand what changed without adding unnecessary features.
- [ ] Support keyboard interaction, focus management, readable labels, and reasonable responsive behavior.
- [ ] Ensure chat failures do not prevent normal Kanban use.
- [ ] Document the completed local workflow and known MVP limitations.

### Tests

- [ ] Component tests cover sidebar rendering, message entry, loading, success, and error states.
- [ ] Integration test: a user can send a question and see the assistant response.
- [ ] Integration test: an AI-created, edited, moved, or renamed card is reflected in the board automatically.
- [ ] Integration test: a response without a board update leaves the board unchanged.
- [ ] Integration test: chat errors are recoverable and do not break board interactions.
- [ ] Accessibility checks cover form labels, keyboard navigation, focus behavior, and status announcements.
- [ ] End-to-end test covers sign-in, board mutation, AI chat, and automatic board refresh.
- [ ] Final Docker smoke test verifies the complete local workflow.

### Success criteria

- The MVP supports a complete local flow: sign in, inspect and edit the board, chat with the AI, and see valid AI-directed board changes appear automatically.
- The UI is responsive, understandable, and usable with keyboard interaction for the supported workflow.
- Automated tests, the static frontend build, and the complete Docker smoke test pass.
- Documentation explains setup, start/stop commands, environment configuration, and MVP limitations.

## Final definition of done

- [ ] Parts 1 through 10 are complete, with their tests and success criteria satisfied.
- [ ] Required user approvals were obtained at the Part 1 and Part 5 gates.
- [ ] The app runs locally in Docker using the documented scripts.
- [ ] The database is created automatically and persists the Kanban board.
- [ ] The hardcoded sign-in and logout flow works.
- [ ] The frontend is statically built and served by FastAPI.
- [ ] The AI integration is server-side, structured, validated, and optional for normal app startup.
- [ ] No secrets, unnecessary generated files, or unrelated changes are committed.
