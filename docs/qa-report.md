# QA Report — Weekly Status (Atlassian Status Automation)

- **Date:** 2026-10-18
- **Environment:** local prototype. Frontend (Vite) at `http://127.0.0.1:5173`, backend at `http://127.0.0.1:3001`, PostgreSQL 15 in Docker.
- **Browsers:** VS Code integrated browser (interaction, console checks) and headless Google Chrome (screenshots).
- **State under test:** Atlassian not connected, no saved reports.

## 1. Summary of Pages Tested

| Page | URL | Result | Screenshot |
|------|-----|--------|------------|
| Weekly reports (home) | `/` | Pass | [01-weekly-reports.png](screenshots/01-weekly-reports.png) |
| Create report | `/reports/new` | Pass for input, submit blocked | [02-create-report.png](screenshots/02-create-report.png) |
| Atlassian connection | `/connection` | Pass after fix, connect blocked | [03 before](screenshots/03-connection-before-fix.png), [04 after](screenshots/04-connection-after-fix.png) |

Not tested live: the report review and publish pages. They need a connected Atlassian account and a saved report. They are covered by mocked automated tests only.

## 2. Interactive Tests Performed

| # | Page | Test | Result |
|---|------|------|--------|
| 1 | `/` | Page loads with no console errors | Pass |
| 2 | `/` | "Create a report" button navigates to `/reports/new` | Pass |
| 3 | `/` | Empty-state card, "Set up Atlassian connection" link and 3-step workflow list render | Pass |
| 4 | All | Sidebar links (Weekly reports, Create report, Atlassian connection) navigate correctly | Pass |
| 5 | All | "Backend online" indicator, top bar text and "Local prototype" badge render | Pass |
| 6 | `/reports/new` | Period start and Period end accept dates (2026-10-12, 2026-10-18) | Pass |
| 7 | `/reports/new` | Time zone defaults to `UTC` | Pass |
| 8 | `/reports/new` | Jira project dropdown is disabled while Atlassian is not connected | Pass (expected) |
| 9 | `/reports/new` | "Add update" adds a manual-update block (Category, Update text, Owner, Remove update) | Pass |
| 10 | `/reports/new` | Update text accepts input and the counter updates (22/2000) | Pass |
| 11 | `/reports/new` | "Connect Atlassian before creating a report" warning and "Open connection settings" link render | Pass |
| 12 | `/reports/new` | "Save draft" stays disabled without a project | Pass (expected) |
| 13 | `/connection` | "Not connected" badge, credentials info box, 4-item "Access requested" list and "Back to weekly reports" link render | Pass after fix |
| 14 | `/connection` | Click "Connect Atlassian" | Blocked: HTTP 503, "Atlassian OAuth is not configured on this local installation." |
| 15 | All | Console and network check on all three pages plus the connect click | 0 JavaScript exceptions, 0 warnings, 1 expected 503 |

## 3. Bugs Found

| # | Severity | Page | Description | Evidence | Status |
|---|----------|------|-------------|----------|--------|
| 1 | Medium (UI) | `/connection` | The "Credentials stay on this machine" box and the "Access requested" list sat in the 43px icon column of the connection panel grid. Text wrapped one word per line and stretched the page. | [03-connection-before-fix.png](screenshots/03-connection-before-fix.png) | **Fixed** |
| 2 | High (blocker, configuration) | `/connection` | "Connect Atlassian" returns 503 `ATLASSIAN_NOT_CONFIGURED`. `backend/.env` was missing, and the Atlassian client ID and secret are still empty. | Console: `POST /api/v1/integrations/atlassian/oauth/start` 503 | **Open**, needs user action |
| 3 | Low (UX) | `/reports/new` | The "Connect Atlassian before creating a report" warning appeared only after the user started typing. At first load only "Checking Atlassian connection" shows. | Observed during test 11 | **Open** (not investigated) |
| 4 | Medium (environment) | Backend | A stale backend process kept port 3001 with an outdated database password, which caused a `28P01` auth error on OAuth start. | curl output during the fix | **Fixed** |

## 4. Fixes Applied

| Bug | Fix | Commit | Verification |
|-----|-----|--------|--------------|
| 1 | In `frontend/src/styles.css`, added `.connection-panel > .page-state` and `.requested-permissions` to the rule that makes items span the full grid row (`grid-column: 1 / -1`). | `fd119dc` fix: make connection page info boxes span the full panel width | [04-connection-after-fix.png](screenshots/04-connection-after-fix.png); frontend tests 18/18 and build OK |
| 2 (partial) | Created `backend/.env` (git-ignored, not committed) with a local token encryption key, database URL, redirect URI, scopes and UI origin. Client ID and secret were left empty on purpose. | Not committed (configuration only) | Backend starts from `.env`; the 503 remains until credentials are added |
| 4 | Reset the password of the isolated `module08_local_app` role, ran migrations, stopped the stale process and restarted the backend. The original `weekly_status` database was not touched. | Not committed (local environment only) | `/health` 200 and OAuth start returns the expected `ATLASSIAN_NOT_CONFIGURED` |

Earlier fix in this session: the PostgreSQL date-shift bug (local year/month/day instead of `toISOString()`) and the Publish page, in commit `0037b01`.

## 5. Current Application Status

**Automated tests (re-run after the fixes):**

| Suite | Result |
|-------|--------|
| Backend (`npm --prefix backend test`) | 67 passed, 0 failed |
| Frontend (`npm --prefix frontend test`) | 18 passed, 0 failed |
| Frontend production build | Success |
| Database tests (earlier, disposable DB) | 7 of 7 passed |

**Services:** backend `/health` 200, frontend 200, `GET /api/v1/integrations/atlassian/` returns `{"connected":false}`.

**Known issues:**
1. Atlassian OAuth is not configured (Bug 2). Live connect, project selection, draft save, review, approve and publish are unverified.
2. Late connection warning on the Create page (Bug 3).
3. Node is v24.15.0 but the backend declares `>=24.22.0 <25`. Tests pass, but the versions should be aligned.
4. Pending spec tasks: T036 end-to-end, T037 security, T038 failure-recovery and T039 accessibility tests; T040 documentation; T041 final acceptance run. T031–T035 are implemented but not checked off in `spec/tasks.md`.

**Next steps:** register an Atlassian OAuth 2.0 (3LO) app with callback `http://127.0.0.1:3001/api/v1/integrations/atlassian/oauth/callback`, put its client ID and secret in `backend/.env`, restart the backend, then re-run the full flow.
