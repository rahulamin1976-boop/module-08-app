# Tasks: Atlassian Weekly Status Automation

**Inputs**: [specification.md](./specification.md), [plan.md](./plan.md),
[data-model.md](./data-model.md), [research.md](./research.md),
[quickstart.md](./quickstart.md), and [API contract](./contracts/api.md)

**Organization**: Tasks follow the four implementation phases in `plan.md`.
Feature work is grouped by the three specification user stories. Every task contains a
title, description, acceptance criteria, and explicit dependency list.

## Phase 1: Backend Setup — Database and API Skeleton

**Purpose**: Establish the Node/Express/PostgreSQL foundation, persistence and secure
API boundary.

- [x] T001 [P] Configure backend dependencies and start/test scripts in `backend/package.json`.
  - **Description**: Declare backend runtime/package requirements and executable development and test scripts.
  - **Acceptance criteria**:
    - Backend package declares the specified Node/Express baseline.
    - Start and backend test scripts are present and work from `backend/`.
  - **Dependencies**: None.
  - **Validation note**: Backend start/test scripts run with the required `PORT` and local `DATABASE_URL` configuration; 14 backend unit/HTTP tests pass. Current local Node is v24.15.0, below the declared Node 24.22.0 minimum.
- [x] T002 [P] Configure PostgreSQL 15 and health checks in `docker-compose.yml`.
  - **Description**: Add the local PostgreSQL service used for development and automated integration tests.
  - **Acceptance criteria**:
    - `docker compose up` starts a healthy PostgreSQL 15 service.
    - The database port is not bound to a non-loopback interface.
  - **Dependencies**: None.
  - **Validation note**: `POSTGRES_PASSWORD=<local password> docker compose up -d` starts PostgreSQL 15.19 and reaches healthy status; `pg_isready` and a SQL query succeed. `docker compose port db 5432` confirms the host binding is `127.0.0.1:5432`.
- [x] T003 Create validated environment configuration and loopback-only server startup in `backend/src/config.js` and `backend/src/server.js`.
  - **Description**: Validate configuration before startup and expose the Express server only on the local machine.
  - **Acceptance criteria**:
    - Missing required configuration fails explicitly at startup.
    - The server binds only to loopback.
    - Startup output contains no secrets.
  - **Dependencies**: T001.
  - **Validation note**: Backend config and live HTTP tests pass, including required/invalid port handling, loopback binding, and `GET /health`. Current Node v24.15.0 is below the declared v24.22.0 minimum.
- [x] T004 Add database connection and migration runner in `backend/src/db/pool.js` and `backend/src/db/migrate.js`.
  - **Description**: Provide a shared PostgreSQL pool and repeatable migration execution.
  - **Acceptance criteria**:
    - The backend connects to the Compose database.
    - Migrations execute deterministically.
    - The pool closes cleanly after tests and shutdown.
  - **Dependencies**: T002, T003.
  - **Validation note**: The live database migration test connects to PostgreSQL, applies migrations twice, and closes the pool; it passes.
- [x] T005 Create schema migrations for projects, integration connections, status reports, report items, and audit events in `backend/src/db/migrations/001-initial-schema.sql`.
  - **Description**: Implement the persistent entity model, relational constraints, and indexes.
  - **Acceptance criteria**:
    - A clean database has the foreign keys, unique constraints, and required fields in `data-model.md`.
    - Status and category values and report lifecycle constraints are enforced where expressible.
    - Indexes support report listing and relationship lookups.
    - Local report deletion cascades to report items and audit events only.
  - **Dependencies**: T004.
  - **Validation note**: The live migration test verifies the schema, stable report publication key, invalid lifecycle-state rejection, and report-item/audit cascades while preserving the project record.
- [x] T006 [P] Add API error handling, request validation, pagination, and loopback/Host/Origin middleware in `backend/src/middleware/error-handler.js`, `backend/src/middleware/validate-request.js`, `backend/src/middleware/local-origin.js`, and `backend/src/middleware/pagination.js`.
  - **Description**: Create reusable HTTP-boundary middleware for the documented request and local-origin rules.
  - **Acceptance criteria**:
    - Invalid values and unknown fields return the structured HTTP 400 error envelope.
    - Non-loopback hosts and unsafe origins are rejected; state-changing requests enforce same-origin protection.
    - List responses use `items` and `nextCursor`, with default limit 50 and maximum 100.
  - **Dependencies**: T001, T003.
  - **Validation note**: Middleware is wired into the Express app where applicable; request validation and pagination helpers have bounded defaults and return structured errors.
- [x] T007 Add backend foundation tests in `backend/tests/db/migrations.test.js`, `backend/tests/middleware/validate-request.test.js`, and `backend/tests/middleware/local-origin.test.js`.
  - **Description**: Verify database setup and shared request/security middleware before feature work.
  - **Acceptance criteria**:
    - Tests cover a clean migration and representative database constraints.
    - Tests cover malformed and unknown request fields.
    - Tests reject non-loopback access and cross-origin state-changing requests.
  - **Dependencies**: T004, T005, T006.
  - **Validation note**: `npm --prefix backend test` passes 14 unit/HTTP tests; `PORT=3001 DATABASE_URL=<local URL> npm --prefix backend run test:db` passes its PostgreSQL 15 integration test.

## Phase 2: Frontend Setup — UI Skeleton and Routing

**Purpose**: Create the React application shell and navigable page structure using a
same-origin API path.

- [x] T008 Configure frontend dependencies and scripts in `frontend/package.json`.
  - **Description**: Declare the frontend runtime, build tooling, and development/test commands.
  - **Acceptance criteria**:
    - The package declares React 18.3.1 and Vite 8.3.4.
    - Start, build, and test scripts run successfully from `frontend/`.
  - **Dependencies**: None.
  - **Validation note**: React 18.3.1, React DOM 18.3.1, Vite 8.3.4, and React Router 7.18.4 are pinned. Dev server, build, and API-client tests pass; `npm audit` reports no vulnerabilities.
- [x] T009 Configure Vite development API proxy and loopback host in `frontend/vite.config.js`.
  - **Description**: Route development API traffic through Vite while keeping the browser interaction same-origin.
  - **Acceptance criteria**:
    - Requests under `/api` reach the backend through the development proxy.
    - The proxy does not require permissive CORS.
    - Vite listens on loopback only.
  - **Dependencies**: T008.
  - **Validation note**: `npm --prefix frontend run dev` listens on 127.0.0.1:5173; Vite proxies `/health` to the backend and returns its HTTP response.
- [x] T010 Add shared API client with structured error handling in `frontend/src/services/api-client.js`.
  - **Description**: Centralize JSON requests and the API's structured error handling.
  - **Acceptance criteria**:
    - Requests use same-origin `/api/v1`.
    - Responses parse the documented error envelope and expose useful non-sensitive errors.
    - The client never persists or logs credentials.
  - **Dependencies**: T008.
  - **Validation note**: Three API-client tests pass for same-origin JSON requests, structured errors, and rejecting non-API paths.
- [x] T011 Add application routing and accessible shared layout in `frontend/src/App.jsx`, `frontend/src/components/AppLayout.jsx`, and `frontend/src/main.jsx`.
  - **Description**: Create the shared application entry point, route map, and navigation.
  - **Acceptance criteria**:
    - All five specified screens have reachable routes within the shared layout.
    - Navigation is keyboard accessible and uses semantic landmarks.
  - **Dependencies**: T008.
  - **Validation note**: React routes render all five screen views under a shared semantic layout with keyboard-focus styling; smoke-checked in the browser.
- [x] T012 [P] Add screen shells for report list, report creation, report review, publishing, and connection settings in `frontend/src/pages/WeeklyReportsPage.jsx`, `frontend/src/pages/CreateReportPage.jsx`, `frontend/src/pages/ReviewReportPage.jsx`, `frontend/src/pages/PublishReportPage.jsx`, and `frontend/src/pages/AtlassianConnectionPage.jsx`.
  - **Description**: Implement the five named screen components as navigable, accessible page shells.
  - **Acceptance criteria**:
    - Every route has a semantic main landmark.
    - Each page shell can display loading, empty, and error states.
    - No screen exposes provider tokens.
  - **Dependencies**: T011.
  - **Validation note**: Five screen modules render under semantic landmarks. The shared page-state component supports accessible loading, empty, and error states; no page exposes token material.
- [x] T013 Add frontend shell tests in `frontend/tests/App.test.js` and `frontend/tests/api-client.test.js`.
  - **Description**: Verify the frontend shell and shared API client behavior.
  - **Acceptance criteria**:
    - Tests verify all route navigation and API error display.
    - Tests verify loading/empty states and keyboard-operable navigation.
  - **Dependencies**: T009, T010, T011, T012.
  - **Validation note**: `npm --prefix frontend test` passes seven tests covering all five routes, not-found handling, semantic/keyboard-operable links, loading/empty/error states, and API errors.

## Phase 3: Feature Implementation — One Feature at a Time

### User Story 1 — Prepare a Weekly Status Report (P1)

**Goal**: Connect to Atlassian, select evidence and manual updates, and save an
evidence-based canonical draft.

**Independent test**: With a Jira fixture or connected test account, select a project
and reporting period, create a report from Jira/manual items, and verify the saved
draft contains only selected/refetched facts, correct provenance, and clear empty or
unavailable states.

- [x] T014 [P] [US1] Implement OAuth state, callback, encrypted token storage, refresh, revocation, and connection-account services in `backend/src/integrations/atlassian-oauth.js`, `backend/src/services/connection-service.js`, and `backend/src/db/token-encryption.js`.
  - **Description**: Build the backend OAuth and credential lifecycle for the single connected Atlassian account.
  - **Acceptance criteria**:
    - OAuth state is random, browser-session-bound, single-use, and expires within 10 minutes.
    - Tokens are encrypted at rest using externally supplied key material.
    - Refresh rotation is serialized and the replacement token pair is saved atomically.
    - Failed refresh requires reconnection without deleting reports.
  - **Dependencies**: T003, T004, T005, T006.
  - **Validation note**: OAuth state/cookie binding, callback redaction, AES-256-GCM encryption, refresh-token rotation under a PostgreSQL row lock, reauthorization after failure, and revocation fallback have automated tests. Live OAuth remains unverified until local app credentials and registered scopes are configured.
- [x] T015 [US1] Add Atlassian connection routes and explicit account-switch/disconnect behavior in `backend/src/routes/atlassian-routes.js`.
  - **Description**: Expose connection state, OAuth start/callback, account-switch, and disconnect operations through the API.
  - **Acceptance criteria**:
    - Connection state never returns tokens.
    - Replacing a different account requires explicit confirmation.
    - Disconnect removes local credentials and reports whether provider revocation was confirmed.
  - **Dependencies**: T006, T014.
  - **Validation note**: Connection-state, OAuth-start/callback, cookie/state mismatch, explicit account-switch confirmation, disconnected outcome, and unconfigured-app errors are covered. This prototype requires exactly one accessible Atlassian site and rejects multiple sites instead of silently choosing one.
- [x] T016 [P] [US1] Add Jira and Confluence read adapters with bounded retries and deadlines in `backend/src/integrations/jira-client.js` and `backend/src/integrations/confluence-client.js`.
  - **Description**: Implement shared outbound request behavior and provider-specific Jira/Confluence read operations.
  - **Acceptance criteria**:
    - Upstream calls have a 15-second deadline.
    - Transient and rate-limit failures receive at most two retries, honoring `Retry-After`.
    - Authorization and validation failures are not retried.
  - **Dependencies**: T003, T006.
  - **Validation note**: Integration tests cover bearer requests, request construction, non-retried authorization failures, two bounded transient/rate-limit retries, `Retry-After`, and the 15-second deadline.
- [x] T017 [US1] Implement project search and period/timezone-bounded Jira candidate retrieval in `backend/src/services/jira-service.js` and `backend/src/routes/jira-routes.js`.
  - **Description**: Find Jira projects and issue candidates for the selected reporting period.
  - **Acceptance criteria**:
    - Queries select issues updated within the inclusive dates and calculate the exclusive next-day UTC boundary from the IANA timezone.
    - Results are cursor-paginated with no more than 100 candidates per page.
    - Candidate results are deduplicated by Jira issue ID.
  - **Dependencies**: T006, T016.
  - **Validation note**: Service and HTTP route tests cover query validation, ISO dates, DST-aware timezone boundaries, project persistence, provider cursors, candidate deduplication by Jira ID, and the documented response envelope.
- [x] T018 [US1] Implement report creation, source refetch/snapshots, confirmed-empty categories, and persisted warnings in `backend/src/services/report-service.js`.
  - **Description**: Create the canonical report draft using freshly verified Jira facts and user-entered updates.
  - **Acceptance criteria**:
    - Selected Jira issues are refetched and the specified fields, retrieval time, and source URL are snapshotted.
    - Manual input constraints and category values are enforced.
    - Jira failure with manual updates creates a draft with a persisted warning.
    - A failed retrieval is never represented as an empty result.
  - **Dependencies**: T005, T014, T017.
  - **Validation note**: Service tests and live PostgreSQL tests verify refetched selected issues, project/period checks, immutable snapshots, ordered items, actor/audit data, confirmed-empty rendering, persisted source warnings, and no report creation when Jira fails without manual facts.
- [x] T019 [US1] Add report list/create/read and project lookup routes in `backend/src/routes/report-routes.js` and `backend/src/routes/project-routes.js`.
  - **Description**: Expose report and project operations using the documented API contract.
  - **Acceptance criteria**:
    - Endpoints match `contracts/api.md` response envelopes and status codes.
    - Exact request fields are validated.
    - Report creation persists creator and audit metadata.
  - **Dependencies**: T006, T018.
  - **Validation note**: `/api/v1/reports` list/create/read routes validate exact fields and use the documented envelopes/statuses; route and persistence tests pass. Jira project lookup is provided by `/api/v1/jira/projects`.
- [x] T020 [P] [US1] Implement project/date/timezone and Jira-candidate selection UI in `frontend/src/pages/CreateReportPage.jsx` and `frontend/src/components/JiraCandidateList.jsx`.
  - **Description**: Build the selection workflow for project, reporting dates/timezone, and Jira candidate facts.
  - **Acceptance criteria**:
    - User can search/select a project and enter an inclusive date range and timezone.
    - User can browse paginated candidates and explicitly categorize each selected issue.
    - UI does not infer a report category from Jira status.
  - **Dependencies**: T009, T010, T012, T017.
  - **Validation note**: Project lookup/pagination, inclusive dates and timezone, Jira candidate pagination, and mandatory explicit category selection are implemented; frontend workflow tests verify submission does not infer a category from Jira status.
- [x] T021 [US1] Implement manual update entry and report-draft submission UI in `frontend/src/components/ManualUpdateForm.jsx` and `frontend/src/pages/CreateReportPage.jsx`.
  - **Description**: Collect manual report facts and submit the combined Jira/manual draft.
  - **Acceptance criteria**:
    - Trimmed manual text is 1–2,000 characters and owner text is at most 120 characters.
    - Categories are limited to accomplishment, blocker, or next-week.
    - Jira-unavailable warnings remain visible during draft creation.
  - **Dependencies**: T010, T020.
  - **Validation note**: Manual fields enforce the category and trimmed-text/owner limits, draft requests are submitted through the same-origin API client, and Jira-unavailable fallback remains visibly distinct from an empty search.
- [x] T022 [US1] Add US1 service and API tests in `backend/tests/services/jira-service.test.js`, `backend/tests/services/report-service.test.js`, and `backend/tests/routes/report-routes.test.js`.
  - **Description**: Verify Jira search and draft creation behavior at the service and HTTP boundaries.
  - **Acceptance criteria**:
    - Tests cover date boundaries, cursor pagination, duplicate candidates, and refetched snapshots.
    - Tests cover manual-only fallback and empty-versus-unavailable handling.
    - Tests cover request validation and warning persistence.
  - **Dependencies**: T017, T018, T019.
  - **Validation note**: Backend unit, route, and PostgreSQL persistence tests cover Jira boundaries/pagination/deduplication, refetched snapshots, manual-only fallback, empty-vs-unavailable handling, strict validation, and persisted warnings; the backend suite passed.
- [x] T023 [US1] Add report-list and draft-creation UI tests in `frontend/tests/CreateReportPage.test.js`.
  - **Description**: Verify the report-list and report-creation user experience.
  - **Acceptance criteria**:
    - Tests verify project/date/candidate selection and categorization.
    - Tests verify validation, connection/source failures, and warning visibility.
    - Successful creation navigates to the saved draft.
  - **Dependencies**: T020, T021.
  - **Validation note**: Interactive frontend tests cover project/date selection, explicit Jira categorization, trimmed manual-only fallback with visible source warning, disconnected-state blocking, successful draft navigation, report-list loading, and actionable list errors; all 15 frontend tests pass.

### User Story 2 — Review and Correct a Draft (P2)

**Goal**: Review canonical report items, preserve provenance, and safely edit/version
drafts before approval.

**Independent test**: Open a saved draft, edit an item from two browser tabs, and
verify the current version saves with provenance while the stale write is rejected
without losing the newer draft.

- [x] T024 [US2] Implement transactional version-checked report editing and audit updates in `backend/src/services/report-service.js`.
  - **Description**: Persist draft item edits using compare-and-swap version control and actor attribution.
  - **Acceptance criteria**:
    - A successful edit atomically increments the version and records the actor/audit event.
    - A stale version returns HTTP 409 with the latest version and changes no stored report data.
  - **Dependencies**: T018, T019.
  - **Validation note**: Draft edits lock the report/items, compare versions, atomically update items/version/actor/audit, preserve Jira snapshots, and return the latest version on stale conflicts. PostgreSQL lifecycle tests pass.
- [x] T025 [US2] Add draft update and report-read contract handling in `backend/src/routes/report-routes.js`.
  - **Description**: Add strict request/response behavior for reading and editing a saved draft.
  - **Acceptance criteria**:
    - Only drafts can be changed and item IDs must belong to the report.
    - Clients cannot set Jira provenance or snapshots.
    - Categories, text limits, and confirmed-empty constraints are validated.
  - **Dependencies**: T006, T019, T024.
  - **Validation note**: PATCH schema rejects unknown fields and client-supplied provenance; only connected actors can mutate; report update API tests pass.
- [x] T026 [US2] Implement deterministic Markdown rendering and report completeness/line-limit checks in `backend/src/services/report-renderer.js` and `backend/src/services/report-validation.js`.
  - **Description**: Render canonical items into the fixed report format and determine whether a draft may be approved.
  - **Acceptance criteria**:
    - Output contains exactly Accomplishments, Blockers, Next week, in order.
    - Content is bullet-only and no more than 20 lines.
    - Empty-category wording is exact, facts are not invented, and incomplete categories block approval.
  - **Dependencies**: T018.
  - **Validation note**: Backend renderer/validation tests cover exact three-section order, confirmed-empty/source-unavailable bullets, completeness, and the 20-line boundary.
- [x] T027 [P] [US2] Implement review/edit UI with provenance, actor/version metadata, and stale conflict recovery in `frontend/src/pages/ReviewReportPage.jsx` and `frontend/src/components/ReportItemEditor.jsx`.
  - **Description**: Provide the review and editing interface for saved canonical report items.
  - **Acceptance criteria**:
    - User can inspect source snapshots, warnings, actor identity, and report version.
    - User can edit text/category/owner, mark material edits user-edited, and confirm empty categories.
    - HTTP 409 prompts the user to reload the latest report without claiming the stale edit saved.
  - **Dependencies**: T010, T012, T025, T026.
  - **Validation note**: Review supports source snapshots, actor/version data, editing, empty confirmations, approval gating, and a reload action on stale versions; frontend build and interaction tests pass.
- [x] T028 [US2] Add US2 report service, renderer, route, and UI tests in `backend/tests/db/report-lifecycle.test.js`, `backend/tests/services/report-renderer.test.js`, `backend/tests/routes/report-update.test.js`, and `frontend/tests/CreateReportPage.test.js`.
  - **Description**: Verify draft edits, renderer invariants, concurrency, and review interactions.
  - **Acceptance criteria**:
    - Tests cover atomic version/audit behavior, stale updates, and immutable source provenance.
    - Tests cover exact section order, line limits, empty confirmations, and review/reload UX.
  - **Dependencies**: T024, T025, T026, T027.
  - **Validation note**: Database tests cover edit provenance, stale writes, approval/withdrawal, delete cascades, and incomplete approval; route tests reject forged fields/confirmation omissions; UI tests cover edits and stale reload. Backend unit/route suite and 15 frontend tests pass; PostgreSQL lifecycle tests pass.

### User Story 3 — Share the Approved Report (P3)

**Goal**: Approve and publish a reviewed report to a chosen Confluence child page
with safe retry/reconciliation behavior.

**Independent test**: Approve a complete draft, choose a parent page, publish it, and
verify confirmed success; simulate uncertain page creation and ensure retry does not
create a duplicate or overwrite unrelated content.

- [x] T029 [US3] Implement report approval, withdrawal, and local deletion transitions in `backend/src/services/report-service.js`.
  - **Description**: Implement confirmed state transitions and local deletion without remote page deletion.
  - **Acceptance criteria**:
    - Explicit confirmation is required and actors/timestamps are recorded.
    - Incomplete reports cannot be approved; withdrawal returns approved reports to draft.
    - Local deletion cascades items/audit but leaves Confluence untouched.
  - **Dependencies**: T018, T024, T026.
  - **Validation note**: PostgreSQL tests cover complete/incomplete approval, actor/time, withdrawal to draft, and local deletion; publication-in-progress deletion is rejected and published pages are never deleted.
- [x] T030 [US3] Add approval, withdrawal, and delete routes in `backend/src/routes/report-routes.js`.
  - **Description**: Expose report approval, withdrawal, and explicit local-delete actions.
  - **Acceptance criteria**:
    - Lifecycle conflicts return HTTP 409.
    - Mutations require `{ "confirm": true }`.
    - Responses use the documented status codes and envelopes.
  - **Dependencies**: T025, T029.
  - **Validation note**: Approval/withdraw/delete endpoints require exact confirmation and a connected actor; malformed confirmation and disconnected mutation tests pass.
- [ ] T031 [P] [US3] Implement destination search and page-title validation in `backend/src/services/confluence-destination-service.js` and `backend/src/routes/confluence-routes.js`.
  - **Description**: Provide destination lookup and validate proposed Confluence publication titles.
  - **Acceptance criteria**:
    - User can search spaces and parent pages using paginated APIs.
    - Title follows `{PROJECT_KEY} Weekly Status {YYYY-MM-DD} to {YYYY-MM-DD}` and is 1–255 characters.
    - Unrelated title collisions return HTTP 409 without modifying a page.
  - **Dependencies**: T006, T016.
- [ ] T032 [US3] Implement publication intent, UUID-property reconciliation, child-page creation, and recoverable failure transitions in `backend/src/services/publication-service.js`.
  - **Description**: Coordinate durable publication state and Confluence calls so retries are safe.
  - **Acceptance criteria**:
    - Only approved reports publish; `publishing` is persisted before external calls.
    - The report UUID is the stable key; uncertain outcomes are reconciled before retry.
    - Success is reported only after a confirmed page ID and URL.
    - Recoverable failures return the report to approved and preserve retryability.
  - **Dependencies**: T016, T029, T031.
- [ ] T033 [US3] Add publication endpoint and audit/event handling in `backend/src/routes/publication-routes.js`.
  - **Description**: Expose the publication operation through the documented versioned API.
  - **Acceptance criteria**:
    - Destination and report-matching idempotency key are validated.
    - Publish-start/success/failure actor events are recorded.
    - Uncertain or failed writes never produce a success response.
  - **Dependencies**: T030, T032.
- [ ] T034 [P] [US3] Implement approval, delete-confirmation, destination-selection, and publish-result UI in `frontend/src/pages/PublishReportPage.jsx` and `frontend/src/pages/ReviewReportPage.jsx`.
  - **Description**: Complete the user-facing approval, destination, deletion confirmation, and publication result flows.
  - **Acceptance criteria**:
    - Publish is unavailable until approval and destination selection.
    - Delete confirmation explains that remote Confluence content remains.
    - Success displays the confirmed page link; failure preserves recoverable report state.
  - **Dependencies**: T027, T030, T031, T033.
- [ ] T035 [US3] Add US3 lifecycle and publication tests in `backend/tests/services/publication-service.test.js`, `backend/tests/routes/publication-routes.test.js`, and `frontend/tests/PublishReportPage.test.jsx`.
  - **Description**: Verify approval/deletion lifecycle and publication recovery from backend to UI.
  - **Acceptance criteria**:
    - Tests cover all lifecycle transitions, title collision, and parent-page destination.
    - Tests simulate uncertain create response, missing UUID property, and retry reconciliation.
    - Tests verify no duplicate pages and truthful success/failure UI.
  - **Dependencies**: T029, T030, T031, T032, T033, T034.

## Phase 4: Integration and Testing

**Purpose**: Verify complete workflows and cross-cutting security, accessibility,
performance, and failure behavior.

- [ ] T036 [P] Add end-to-end report workflow tests in `frontend/tests/e2e/weekly-report-flow.test.js`.
  - **Description**: Exercise the entire report workflow through the user interface with deterministic Atlassian fixtures.
  - **Acceptance criteria**:
    - The test completes connection, Jira/manual draft creation, review/edit, approval, destination choice, and publication.
    - Reopening the report shows the confirmed Confluence page reference.
  - **Dependencies**: T023, T028, T035.
- [ ] T037 Add OAuth, local-boundary, and secret-handling security tests in `backend/tests/security/oauth-security.test.js` and `backend/tests/security/local-boundary.test.js`.
  - **Description**: Validate the application security guarantees across OAuth and local service boundaries.
  - **Acceptance criteria**:
    - Tests reject replayed/expired OAuth state and unsafe origins.
    - Tests verify loopback-only access, encrypted token storage, secret redaction, safe account switching, and serialized refresh rotation.
  - **Dependencies**: T014, T015.
- [ ] T038 Add integration tests for upstream timeouts, retries, rate limits, and uncertain Confluence outcomes in `backend/tests/integrations/atlassian-failure-recovery.test.js`.
  - **Description**: Verify provider failure handling with controlled Jira and Confluence responses.
  - **Acceptance criteria**:
    - Tests verify the 15-second deadline, at most two retries, `Retry-After`, and explicit 429/503 errors.
    - Tests cover create-timeout reconciliation and no false success or duplicate page.
  - **Dependencies**: T016, T032, T033.
- [ ] T039 [P] Add keyboard, screen-reader, and automated accessibility checks in `frontend/tests/accessibility/weekly-report-accessibility.test.jsx`.
  - **Description**: Evaluate accessibility across the core workflow using automated checks and keyboard/screen-reader acceptance.
  - **Acceptance criteria**:
    - Core connection, draft, review, approval, and publication journeys are keyboard-operable.
    - Automated checks report no critical or serious WCAG 2.2 AA violations in core flows.
  - **Dependencies**: T015, T023, T028, T034.
- [ ] T040 Document runnable setup and test commands in `README.md` and update `spec/quickstart.md` with the actual package scripts.
  - **Description**: Replace planned placeholders with verified setup and test commands.
  - **Acceptance criteria**:
    - A fresh local checkout can follow the docs to start services, migrate the database, and run tests.
    - Documentation separates repeatable mock tests from optional live Atlassian validation.
  - **Dependencies**: T001, T002, T004, T008, T036, T038.
- [ ] T041 Run and record the quickstart and measurable acceptance checks using `spec/quickstart.md` and `specification.md`.
  - **Description**: Execute the final measurable acceptance suite and record results for the prototype.
  - **Acceptance criteria**:
    - Record pass/fail for draft creation time, 20-line format, empty/failure distinction, 100 retry scenarios, stale-tab conflict, 15-second timeout, and accessibility.
    - Any live Atlassian test not run is explicitly marked unverified.
  - **Dependencies**: T036, T037, T038, T039, T040.

## Dependencies and Execution Order

### Phase dependencies

- Phase 1 tasks T001–T007 establish backend/database prerequisites.
- Phase 2 tasks T008–T013 depend on the API boundary and app structure decisions from
  Phase 1; UI shell work may proceed alongside remaining Phase 1 implementation when
  it only touches frontend files.
- Phase 3 user stories depend on the database/API foundation and UI shell. Complete
  US1 before US2 because reports must exist before review/edit. Complete US2 before
  US3 because publishing requires a reviewed, complete report.
- Phase 4 validates the integrated US1–US3 workflow and depends on the relevant
  feature implementations.

### User story dependencies

- **US1 (P1)**: After Phases 1–2. Provides connection and saved drafts.
- **US2 (P2)**: Depends on US1 report creation and persistence; independently verifies
  review/edit and concurrency behavior.
- **US3 (P3)**: Depends on US2's canonical reviewed report and approval-ready state.
- Cross-story end-to-end tests require US1, US2, and US3.

### Parallel opportunities

- T001 and T002 can run independently; T006 can be developed in parallel with database
  schema work once shared API error conventions are agreed.
- T009–T012 touch separate frontend configuration/modules after T008 establishes
  dependencies; T013 follows their implementation.
- Within US1, OAuth adapters and Jira integration adapters may proceed in parallel
  (T014/T016); UI selection can be developed against the documented API contract
  (T020/T021) while backend services are implemented.
- Within US2, the renderer/validation work (T026) and review UI (T027) can proceed
  independently after the canonical item/API shape is fixed.
- Within US3, destination search (T031) and lifecycle transition services (T029) can
  proceed on separate modules; UI work can use the contract while publication logic is
  developed.
- Phase 4's independent accessibility and security checks (T037/T039) can run in
  parallel after their target flows exist.

## Parallel Example: US1

```text
After Phase 1:
  T014 OAuth connection service
  T016 Atlassian API adapters

After request/response shapes are stable:
  T020 project/date/Jira selection UI
  T021 manual update form
```

## Parallel Example: US2

```text
After US1 canonical report shape is stable:
  T026 Markdown renderer and completeness validation
  T027 review/editor UI
```

## MVP and Incremental Delivery

- **MVP scope**: Phase 1, Phase 2, and US1 (T001–T023). The first demo creates and
  saves an evidence-based draft with Jira/manual provenance and explicit warnings.
- Add US2 next to review/edit drafts safely and validate report completeness.
- Add US3 to complete approval and Confluence publication.
- Finish with Phase 4 integration and quality gates before calling the prototype
  complete.

## Format Validation

- Each task has a checklist title, a separate description, explicit acceptance
  criteria, and a dependency list (`None` or task IDs).
- All task entries use `- [ ] Tnnn`, include a file path, and carry the required story
  label when they belong to a user-story phase.
- User-story tasks carry `[US1]`, `[US2]`, or `[US3]`; setup and cross-cutting tasks
  intentionally have no story label.
- `[P]` is used only for tasks isolated to distinct files or independent test work.
