# Implementation Plan: Atlassian Weekly Status Automation

**Branch**: `001-weekly-status-reports` | **Date**: 2026-10-18
**Spec**: [specification.md](./specification.md)

## Summary

Build a local, single-user web application that prepares evidence-based weekly
leadership reports from user-selected Jira issues and manual updates, lets the user
review and approve canonical report items, and publishes approved reports as
Confluence child pages. Implement the backend and database foundation first, the
frontend shell second, then deliver the user-visible workflow in vertical features,
and finish with live integration and end-to-end verification. PostgreSQL report items
and provenance are authoritative; Markdown and Confluence content are derived outputs.

## Technical Context

**Language/Version**: JavaScript; Node.js 24.22.0 LTS; browser JavaScript on React 18.3.1
**Primary Dependencies**: Express 5.3.0, Vite 8.3.4, npm 11.19.1
**Storage**: PostgreSQL 15.x via Docker Compose V2
**Testing**: Node test runner or repository-standard runner; backend unit, API contract,
integration, frontend component/accessibility, and end-to-end tests; live Atlassian
tests kept separate from repeatable local tests
**Target Platform**: Local desktop browser; backend and published web/API ports bind to
loopback; PostgreSQL is not exposed to other network users
**Project Type**: Local web application with separate frontend and backend
**Performance Goals**: At least 95% of project, issue, space, and parent-page selection
requests complete within 15 seconds or show the specified timeout error
**Constraints**: Exactly three report sections and no more than 20 rendered lines;
least-privilege Atlassian OAuth; server-side credential handling and encryption;
same-origin state-changing requests; bounded upstream retries; version-checked edits;
external writes only after explicit approval; do not claim publication success before
Confluence confirmation
**Scale/Scope**: One local user, one Atlassian Cloud connection, one project and
reporting period per report; paginated result pages capped at 100; no production
availability or horizontal-scaling target

## Constitution Check

| Gate | Result | Plan constraint |
|---|---|---|
| Specification before implementation | PASS | Use the resolved requirements in `specification.md`; do not implement unresolved scope changes without updating the spec. |
| Evidence-based reporting | PASS | Persist selected Jira snapshots and user inputs; derive report output from canonical items; never infer facts from status. |
| Safe, attributable integrations | PASS | OAuth, token encryption/refresh, least-privilege scopes, redacted logs, actor audit events, and explicit publish approval are backend responsibilities. |
| Frontend/backend boundary | PASS | Validate exact JSON contracts at the Express boundary; keep credentials and integration policy out of the browser. |
| Reliable, verifiable behavior | PASS | Test service failures and rate limits; distinguish live Atlassian checks from deterministic local tests; never present failed writes as success. |
| Stack and repository conventions | PASS | Use the specified React/Vite, Node/Express, PostgreSQL/Docker stack and the established frontend/backend folder boundaries. |

No constitution violations or additional architectural projects are proposed.

## Implementation Phases and Milestones

### Phase 1: Backend Setup — Database and API Skeleton

**Milestone 1.1: Local backend foundation**

- Configure Node/Express application startup, environment validation, structured
  non-sensitive logging, and loopback-only binding.
- Configure PostgreSQL 15 in Docker Compose without publishing its port beyond the
  local development environment.
- Add database connection management, migrations, health/readiness checks, and
  repeatable test-database setup.
- Establish backend module boundaries for middleware, routes, services, integrations,
  and database access.

**Milestone 1.2: Persistence and API skeleton**

- Create the project, integration connection, status report, report item, and audit
  event schema from [data-model.md](./data-model.md), including lifecycle constraints,
  indexes, foreign keys, and cascade behavior.
- Add `/api/v1` routing, exact request validation, consistent JSON error responses,
  cursor pagination envelopes, and a not-connected integration-state response.
- Implement local security middleware for loopback/Host/Origin validation and
  same-origin protection on state-changing requests.
- Add unit tests for validation, API errors, database constraints, migrations, and
  security middleware.

**Exit criteria**: Database starts from a clean checkout; migrations apply and can be
tested; API health and disconnected-state routes work; invalid fields and unsafe
origins are rejected; secrets are absent from logs.

### Phase 2: Frontend Setup — UI Skeleton and Routing

**Milestone 2.1: Application shell**

- Configure Vite and React, with development API proxying so the browser uses a
  same-origin `/api` path.
- Add application layout, route handling, shared API client, accessible loading/error
  presentation, and page shells for Weekly Reports, Create Report, Review Report,
  Publish Report, and Atlassian Connection.
- Apply repository naming, component, and file-organization conventions.

**Milestone 2.2: UI-to-API foundation**

- Connect route shells to the API client and display connection state and report-list
  empty/loading/error states.
- Add component tests for route navigation, keyboard operation, semantic labels, and
  error display.

**Exit criteria**: All specified screens are reachable; API calls use the development
proxy and a same-origin path; route-level loading, empty, and failure states render
without exposing credentials.

### Phase 3: Feature Implementation — One Feature at a Time

Implement and verify each vertical feature before beginning the next:

1. **Atlassian connection**: OAuth start/callback/state validation, account display,
   encrypted credential storage, token refresh/revocation, account-switch confirmation,
   and disconnect recovery.
2. **Project and Jira candidate selection**: Search projects; query period-bounded
   issues in the selected timezone; paginate/deduplicate; refetch selected issues;
   persist immutable source snapshots; distinguish empty results from source failure.
3. **Manual updates and report draft creation**: Validate inputs, categorize items,
   record confirmed-empty categories and persisted warnings, then create the canonical
   draft and audit event.
4. **Report review and editing**: Render the fixed three-section Markdown from
   canonical items, preserve provenance, mark material edits user-edited, enforce
   version checks, show stale-write conflicts, and enforce the 20-line limit.
5. **Approval and deletion lifecycle**: Require explicit confirmation, record actors
   and times, block incomplete reports, support approval withdrawal, and explain that
   deleting local data does not delete a remote Confluence page.
6. **Confluence destination and publication**: Select a space/parent, validate the
   proposed title, create a child page only after approval, store the report UUID
   content property, reconcile uncertain outcomes before retry, and retain explicit
   failure states.

Each feature includes service-level tests, API contract tests, and its UI acceptance
tests before the next item starts. Mocked provider behavior is used for repeatable
tests; live Atlassian interactions are gated on registered OAuth settings and a
designated test site.

**Exit criteria**: Each vertical slice passes its own tests; report items remain the
source of truth; audit and version updates are atomic; no feature indicates a
successful external write before provider confirmation.

### Phase 4: Integration and Testing

**Milestone 4.1: Cross-feature integration**

- Exercise the complete flow: connect account, select project and date/timezone,
  select/categorize Jira candidates, add manual updates, save and reopen draft, edit,
  approve, choose destination, publish, and reopen the publication reference.
- Test OAuth state replay/expiry, rotated refresh-token serialization, encryption
  configuration, account-switch protection, secret redaction, loopback exposure, and
  same-origin/CSRF protections.
- Test empty-versus-unavailable handling, manual-only drafts, persisted warnings,
  20-line boundaries, stale concurrent tabs, API schema rejection, provider rate
  limits, transient errors, and retry behavior.
- Test Confluence uncertain-create recovery, UUID-property reconciliation, unrelated
  title collisions, and no-duplicate behavior using provider mocks and a live test
  site where configured.

**Milestone 4.2: Release readiness**

- Run database migration checks, backend unit/API/integration tests, frontend
  component tests, and full end-to-end scenarios.
- Run keyboard and screen-reader acceptance checks and automated accessibility checks
  against WCAG 2.2 AA for core flows.
- Verify the 15-second upstream timeout behavior, pagination limits, report structure,
  line cap, and publication truthfulness against the measurable success criteria.
- Document local setup and runnable validation in [quickstart.md](./quickstart.md);
  record live-service checks that could not be run as unverified rather than passing.

**Exit criteria**: All repeatable automated checks pass; all core flows satisfy the
acceptance criteria; remaining external-service validation is clearly identified.

## Key Dependencies and Risks

- Atlassian OAuth app registration, exact least-privilege scope IDs, callback URI, and
  a designated test site are prerequisites for live connection tests.
- OAuth refresh tokens rotate; refresh attempts for one connection must be serialized
  and the replacement token pair persisted atomically.
- Confluence page creation and writing its report-UUID content property are separate
  operations. An uncertain create response must be reconciled before retry; ambiguous
  results must be surfaced rather than blindly creating or overwriting a page.
- Vite and Express use different development ports. Route API traffic through the Vite
  proxy during development and the same-origin local entry point for normal use; do
  not weaken the loopback/same-origin requirements with permissive CORS.
- The Spec Kit active feature still resolves to `specs/001-task-tracker`, which is a
  different prototype. This plan and the source feature spec are intentionally stored
  under `spec/`; do not use the current active-feature automation until that mismatch
  is deliberately migrated.

## Project Structure

```text
frontend/
  src/
    components/
    pages/
    services/
    hooks/
  tests/
backend/
  src/
    middleware/
    routes/
    services/
    integrations/
    db/
  tests/
spec/
  constitution.md
  specification.md
  clarify.md
  plan.md
  data-model.md
  research.md
  quickstart.md
  contracts/
docker-compose.yml
```

**Structure decision**: Preserve the existing separate frontend/backend application
layout. Keep provider clients, persistence, validation, and report lifecycle rules in
the backend; keep presentation and API transport in the frontend. Documentation and
design artifacts for this requested feature belong in `spec/`.
