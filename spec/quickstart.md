# Quickstart: Local Validation

Run commands from the repository root unless noted otherwise.

## Prerequisites

- Node.js 24.22.0 and npm 11.19.1.
- Docker Compose V2 with PostgreSQL 15 available.
- Atlassian Cloud OAuth application, verified callback URI and least-privilege
  scopes, plus a designated non-production test site for live checks.
- Token-encryption key and OAuth client configuration supplied through local
  environment configuration only; never commit secrets.

## Local startup

1. Copy `.env.example` to `.env` and set a local-only `POSTGRES_PASSWORD`.
2. Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL` to use the
   same local password.
3. Start PostgreSQL with `docker compose up -d` and wait for its health check.
4. Apply backend database migrations with `npm --prefix backend run migrate`.
5. Start the backend with `npm --prefix backend start`
   and frontend with
   `npm --prefix frontend run dev`.
6. Confirm the UI is reachable only on loopback and frontend API calls use the
   same-origin `/api` path.

The backend requires `PORT` and a local PostgreSQL `DATABASE_URL` in `backend/.env`
or the process environment, and listens on `127.0.0.1`. Its `GET /health` endpoint returns
`{ "status": "ok" }`. The Compose database uses the locally configured password and
binds its port to loopback; do not reuse it outside local development.

Expected result after the remaining implementation phases: database readiness
succeeds, the UI loads, connection state reports disconnected, and no credential
material appears in the browser or logs.

## Validation scenarios

1. **Local data/API**: Run migrations from an empty database, create/read/update a
   report through the API, verify schema rejection and structured errors, then test a
   stale update and confirm HTTP 409 leaves the latest version unchanged.
2. **Evidence and draft**: With Jira provider fixtures, test timezone date boundaries,
   candidate pagination/deduplication, snapshot retention, manual items, explicit
   empty-category confirmation, and persisted warnings on reopen.
3. **Report quality**: Verify exactly three sections in the required order, bullet-only
   items, a maximum of 20 lines, and disabled approval/publication for incomplete or
   over-limit reports.
4. **Security and lifecycle**: Test loopback/origin rejection, OAuth state replay and
   expiry, token encryption/redaction, serialized refresh rotation, account-switch
   confirmation, disconnect behavior, audit attribution, and local deletion.
5. **Confluence publication**: With provider mocks, simulate confirmed creation,
   unrelated title collision, rate limiting, timeout after page creation, missing
   UUID property, and retry. Verify no false success and no duplicate page. Repeat
   against the designated live test site when credentials are configured.
6. **Accessibility and full journey**: Complete connection through publication using
   keyboard and screen reader; run automated WCAG 2.2 AA checks and the repository's
   end-to-end suite.

Use the package scripts and test files created in the plan's implementation phases.
Keep live Atlassian tests separate from repeatable local tests and report any live
checks not run as unverified.
