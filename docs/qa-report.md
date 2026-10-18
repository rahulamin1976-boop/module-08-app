# QA Report — Weekly Status | Atlassian Status Automation

- **Date:** 2026-10-18
- **Environment:** local prototype. Frontend (Vite) at `http://127.0.0.1:5173`, backend at `http://127.0.0.1:3001`, PostgreSQL 15 in Docker.
- **Tools:** Chrome DevTools MCP (console, snapshots, screenshots, scripted interaction), VS Code integrated browser, headless Chrome (screenshots), backend and frontend automated tests.
- **Phases:** (A) Atlassian not connected, no saved reports. (B) Real Atlassian OAuth connection (account Rahul Amin, Jira projects KAN and SAM1) and the full create → review → publish flow.

## 1. Summary of pages tested

| Page | URL | Phase | Result | Screenshot |
|------|-----|-------|--------|------------|
| Weekly reports (home) | `/` | A, B | Pass | [01-weekly-reports.png](screenshots/01-weekly-reports.png), [main-page.png](main-page.png) |
| Create report | `/reports/new` | A, B | Pass (submit blocked in A, works in B) | [02-create-report.png](screenshots/02-create-report.png) |
| Atlassian connection | `/connection` | A, B | Pass after fix; connect works in B | [03 before](screenshots/03-connection-before-fix.png), [04 after](screenshots/04-connection-after-fix.png) |
| Review report | `/reports/:id/review` | B | Pass (empty-section confirmation enforced, approve works) | None |
| Publish report | `/reports/:id/publish` | B | Pass (published to Confluence) | None |
| NotFound | `*` | — | Not tested manually | — |

## 2. Interactive tests performed

### Phase A: not connected

| # | Page | Test | Result |
|---|------|------|--------|
| 1 | `/` | Page loads with no console errors | Pass |
| 2 | `/` | "Create a report" button navigates to `/reports/new` | Pass |
| 3 | `/` | Empty-state card, "Set up Atlassian connection" link and 3-step workflow list render | Pass |
| 4 | All | Sidebar links navigate correctly | Pass |
| 5 | All | "Backend online" indicator, top bar text and "Local prototype" badge render | Pass |
| 6 | `/reports/new` | Period start and end accept dates | Pass |
| 7 | `/reports/new` | Time zone defaults to `UTC` | Pass |
| 8 | `/reports/new` | Jira project dropdown disabled while not connected | Pass (expected) |
| 9 | `/reports/new` | "Add update" adds a manual-update block | Pass |
| 10 | `/reports/new` | Update text accepts input and the counter updates | Pass |
| 11 | `/reports/new` | "Connect Atlassian before creating a report" warning and link render | Pass |
| 12 | `/reports/new` | "Save draft" stays disabled without a project | Pass (expected) |
| 13 | `/connection` | "Not connected" badge, info box, "Access requested" list and back link render | Pass after fix |
| 14 | `/connection` | Click "Connect Atlassian" without OAuth credentials | 503 `ATLASSIAN_NOT_CONFIGURED` (expected) |
| 15 | `/api/v1/jira/projects` | Request while not connected | 500 (Bug 5), now 401 `NOT_CONNECTED` |

### Phase B: connected, full flow

| # | Page | Test | Result |
|---|------|------|--------|
| 16 | `/connection` | Sign in through regular Chrome (Google sign-in is blocked in automation Chrome); status shows connected as Rahul Amin | Pass |
| 17 | `/reports/new` | Jira project list loads (KAN, SAM1); select KAN | Pass |
| 18 | `/reports/new` | Set period 12–18 Oct 2026 (date inputs set via native setter, as the DevTools `fill` tool fails on React date inputs) | Pass |
| 19 | `/reports/new` | Fetch Jira candidates (none for that week); add a manual update; save draft | Pass |
| 20 | Review | Edit and save as v2; confirm Blockers and Next week empty; approve | Pass |
| 21 | Publish | Search spaces, choose HR space, load parent pages, choose "Human Resources" | Pass |
| 22 | Publish | Publish after explicit confirmation | Pass: [Confluence page](https://rahulamin1976.atlassian.net/spaces/HR/pages/360449/KAN+Weekly+Status+2026-10-12+to+2026-10-18) |
| 23 | All | Console errors and warnings after the flow | None |
| 24 | `/reports/new` | Console and DevTools Issues after the form-field fix | None |

## 3. Bugs found

| # | Severity | Page | Description | Evidence | Status |
|---|----------|------|-------------|----------|--------|
| 1 | Medium (UI) | `/connection` | The "Credentials stay on this machine" box and the "Access requested" list sat in the 43px icon column of the panel grid. Text wrapped one word per line and stretched the page. | [03-connection-before-fix.png](screenshots/03-connection-before-fix.png) | **Fixed** |
| 2 | High (configuration) | `/connection` | "Connect Atlassian" returned 503 `ATLASSIAN_NOT_CONFIGURED` because the Atlassian client ID and secret were empty. | Network: `POST /api/v1/integrations/atlassian/oauth/start` 503 (no screenshot) | **Resolved**. Credentials were added to `backend/.env` and the connect works |
| 3 | Low (UX) | `/reports/new` | The "Connect Atlassian before creating a report" warning appears only after the user starts typing. On first load only "Checking Atlassian connection" shows. | Observed in test 11 (no screenshot) | **Open**, not re-checked or investigated |
| 4 | Medium (environment) | Backend | A stale backend process held port 3001 with an outdated database password, causing a `28P01` auth error on OAuth start. | curl output (no screenshot) | **Fixed** (local environment) |
| 5 | Medium (API) | `GET /api/v1/jira/projects` | Returned **500** when no account was connected. OAuth settings were read before the connection lookup. Expected 401 `NOT_CONNECTED`. | Network response, [02-create-report.png](screenshots/02-create-report.png) shows the page where it is triggered | **Fixed** |
| 6 | Low (a11y / DevTools) | All forms | DevTools Issue "A form field element should have an id or name attribute": 4 on `/connection`, 12 across the report flow. | DevTools Issues panel (no screenshot) | **Fixed** |
| 7 | Info (tooling) | `/reports/new` | The DevTools `fill` tool leaves React state empty on `<input type=date>`. | — | Not an app bug; workaround noted in test 18 |

## 4. Fixes applied

| Bug | Fix | Commit | Verification |
|-----|-----|--------|--------------|
| 1 | In `frontend/src/styles.css`, `.connection-panel > .page-state` and `.requested-permissions` now span the full grid row (`grid-column: 1 / -1`). | `fd119dc` fix: make connection page info boxes span the full panel width | [04-connection-after-fix.png](screenshots/04-connection-after-fix.png); frontend tests and build OK |
| 2 | Created `backend/.env` (git-ignored) with encryption key, database URL, redirect URI, scopes and UI origin. The user then supplied the client ID and secret. | Not committed (configuration) | Connect works; account verified as connected |
| 4 | Reset the password of the isolated `module08_local_app` role, ran migrations, stopped the stale process and restarted the backend. | Not committed (local environment) | `/health` returns 200 |
| 5 | `getAccessToken()` in `backend/src/services/connection-service.js` checks the stored connection first and returns 401 `NOT_CONNECTED`. It loads OAuth settings afterwards and returns 503 `ATLASSIAN_NOT_CONFIGURED` if they are missing. Two regression tests added in `backend/tests/services/connection-service.test.js`. | `cc9fbb3` fix: return 401 when Jira projects requested while disconnected; add name attrs to form fields | Live endpoint returns 401; backend tests 69/69 |
| 6 | Added `name` attributes to 15 fields in `ManualUpdateForm`, `CreateReportPage`, `PublishReportPage`, `ReviewReportPage` and `AtlassianConnectionPage`. | `cc9fbb3` (same commit as Bug 5) | Frontend tests 18/18; no DevTools issues on `/reports/new` |

Earlier in the project: the PostgreSQL date-shift bug (local year/month/day instead of `toISOString()`) and the Publish page, in commit `0037b01`.

## 5. Current application status

**Automated tests:**

| Suite | Result |
|-------|--------|
| Backend (`npm --prefix backend test`) | 69 passed, 0 failed |
| Frontend (`npm --prefix frontend test`) | 18 passed, 0 failed |

**Services:** Postgres healthy, backend `/health` 200, frontend on 5173, Atlassian connected.

**Console:** no JavaScript errors or warnings on any page tested.

**Known issues and gaps:**
1. Bug 3 (late connection warning on the Create page) is open.
2. After the Bug 6 fix, only `/reports/new` was re-checked for DevTools issues. `/connection`, review and publish still need a re-check.
3. Error paths (title collision, uncertain publish response) and the NotFound page were covered only by unit tests or not at all.
4. No cross-browser, responsive, accessibility or Lighthouse testing was done.
5. Node is v24.15.0 but the backend declares `>=24.22.0 <25`. Tests pass, but the versions should be aligned. This was not re-checked in this session.
6. Spec tasks T036–T041 (end-to-end, security, failure-recovery, accessibility tests, documentation and final acceptance) were pending at the last check and were not re-verified.
7. The published Confluence page is test data and can be deleted.
