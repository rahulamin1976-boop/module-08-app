# QA Report - Weekly Status (Atlassian Status Automation)

## Current session: 2026-10-20

### Scope and environment

- Application: local Weekly Status / Atlassian Status Automation prototype.
- Frontend: `http://127.0.0.1:5173` (Vite).
- Backend: `http://127.0.0.1:3001`.
- Database: PostgreSQL 15 in Docker, container `module-08-app-db-1`.
- Node.js: v24.22.0; npm: 11.19.1.
- Browsers: headless Google Chrome through Chrome DevTools MCP for navigation,
  screenshots, and form interaction; VS Code integrated browser with Playwright
  console listeners for fresh-load console checks.
- Initial application state: Atlassian connected as Rahul Amin; one existing
  published KAN report for 2026-10-12 through 2026-10-18.
- Authorized write scope: create and review a local test draft only. No approval,
  publication, account switching, disconnection, or deletion was performed.
- This section records this session's observations. The older report retained
  below is historical; its fixes were not revalidated here. Current automated
  test results are recorded separately below.

### Summary

**Status: PASS for the tested local draft creation and review flow.**

All five main application pages were visited and captured. A test draft was
successfully created, reloaded to verify persistence, and found on the weekly
reports page. Fresh loads of six page instances produced no captured console
warnings, console errors, or uncaught JavaScript exceptions. No application bugs
were identified in the tested scope. This is not a full release acceptance result.

### Pages visited and screenshot evidence

| Page | Route | Observed state and result | Screenshot |
|------|-------|---------------------------|------------|
| Weekly reports | `/` | Existing published report displayed; new draft also listed after creation | [Weekly reports](screenshots/2026-10-20/weekly-reports.png) (before draft creation) |
| Create report | `/reports/new` | Connected project choices available; completed and submitted the manual-update form successfully | [Create report](screenshots/2026-10-20/create-report.png) (initial form) |
| Atlassian connection | `/connection` | Connected account and granted capabilities displayed | [Connection](screenshots/2026-10-20/atlassian-connection.png) |
| Published report review | `/reports/83521c66-0ff8-4c61-a444-d85ef572a704/review` | Published report, approved content, attribution, and Confluence link displayed | [Published review](screenshots/2026-10-20/review-report.png) |
| Published report destination | `/reports/83521c66-0ff8-4c61-a444-d85ef572a704/publish` | Publication confirmed; destination controls disabled | [Publish page](screenshots/2026-10-20/publish-report.png) |
| New test draft review | `/reports/c33cabf5-3b25-4c2a-b80e-0466a4cb9a16/review` | Draft version 1, manual update and Markdown preview persisted after reload | [Test draft review](screenshots/2026-10-20/test-draft-review.png) |

### Elements inspected and interactions tested

"Inspected" means the element was observed, not necessarily clicked or submitted.

| Area | Elements inspected | Interaction and verification |
|------|--------------------|------------------------------|
| Shared layout | Brand/home link; Weekly reports, Create report, and Atlassian connection links; Backend online indicator; Leadership reporting header; Local prototype badge | Navigated to all main routes. Clicked the Create report sidebar link from the starting page during the flow test. |
| Weekly reports | Create a report link, report cards, status badges, Open report links, three-step workflow text | Confirmed new draft link appeared after saving; original published report remained listed. |
| Report details form | Project search input/button; Jira project dropdown; timezone; period start/end; Load Jira updates button | Selected KAN / My HR Team, entered dates, retained UTC. Required controls passed browser validity checks. Project search and Jira issue loading were not exercised. |
| Manual updates form | Add update; category dropdown; update text; character counter; optional owner; Remove update; Save draft | Clicked Add update, selected Accomplishment, entered test text, and clicked Save draft. Owner remained empty. Remove update was not clicked. |
| Test draft review | Source preservation text; category, text, owner fields; empty-section checkboxes; Markdown preview; Save draft; Approve draft; back link; Delete local report | Verified saved values and preview after reload. Observed Blockers and Next week confirmation prompts, with approval disabled. Did not edit, confirm, approve, or delete. |
| Published review | Project/date metadata; Published badge; creator/editor/approver attribution; approved Markdown; Confluence link; back link; delete button | Read-only inspection. No external link or delete action exercised. |
| Atlassian connection | Connected account; scopes; replacement confirmation checkbox; Connect a different account; Disconnect; back link | Confirmed connected state and disabled account-switch button before confirmation. No account changes made. |
| Published destination | Publishing identity; space search; space dropdown; proposed title and counter; report preview; publication confirmation; external/back links | Read-only inspection. Search and selection controls were disabled for this published report; no new publication attempted. |

### Main user-flow test

| Step | Input or action | Observed result |
|------|-----------------|-----------------|
| 1 | Navigate to `/`, then click Create report | Report creation page opened |
| 2 | Select KAN / My HR Team | Project selected successfully |
| 3 | Set period to 2026-10-19 through 2026-10-25; timezone UTC | Required fields valid |
| 4 | Click Add update and select Accomplishment | Manual update form accepted category |
| 5 | Enter `UI TEST ONLY — verifying report creation and review, not a real business update.` | Text accepted; optional owner left empty |
| 6 | Click Save draft | Redirected to new report's review page |
| 7 | Reload review page | Project, dates, timezone, category, update text, Draft status, and Markdown preview retained |
| 8 | Return to `/` | New draft and original published report both listed |

The test draft remains stored locally for inspection:
[Open test draft](http://127.0.0.1:5173/reports/c33cabf5-3b25-4c2a-b80e-0466a4cb9a16/review).
It is not approved or published. The original published report was not edited.

### Browser console checks

Console listeners were attached before navigating in the integrated browser.
Each route was loaded and allowed to reach network idle:

- `/`
- `/reports/new`
- `/connection`
- Test draft review
- Existing published report review
- Existing published report publish page

| Check | Result |
|-------|--------|
| Console errors captured | 0 |
| Console warnings captured | 0 |
| Uncaught JavaScript exceptions captured | 0 |
| Main-document HTTP responses | 200 for all six page instances |
| Visible application alerts during draft save/reload/list verification | None observed |

These results apply to fresh page loads, not historical console messages from the
earlier Chrome session. Console listeners were not active during form submission.
HTTP 200 here describes the main documents, not an exhaustive API/network audit.

### Bugs found and operational issues

| Finding | Classification | Outcome |
|---------|----------------|---------|
| No application defects observed in the tested flow | Test result | No application fix required |
| Docker Desktop was initially stopped | Local environment | Started Docker Desktop; database subsequently healthy |
| Compose requires POSTGRES_PASSWORD, absent from the invoking shell/root environment file | Startup configuration requirement | Passed password from the existing backend DATABASE_URL to the startup command without printing it; no persistent configuration change |
| A follow-up `docker compose ps` lacked the required variable and failed interpolation | Operational command error | Used `docker ps` to verify container status; startup itself succeeded |
| Backend `/` returned 404 | Expected route behavior, not a confirmed bug | Later verified the supported `/health` endpoint returned `{\"status\":\"ok\"}` |
| Draft approval unavailable while empty sections remain unconfirmed | Expected validation state | Left Blockers and Next week unconfirmed, consistent with authorized draft-only scope |

### Fixes and changes applied in this session

- **No application source-code fixes were applied.**
- Started Docker Desktop and the Compose database; ran database migrations
  successfully earlier in this session.
- Started backend and frontend development servers. Later requests confirmed
  they were already running rather than launching duplicate instances.
- Added Chrome DevTools MCP flags to the user's VS Code configuration:
  `--headless`, `--slim`, `--isolated`, `--no-usage-statistics`, and
  `--no-performance-crux`. This is local tooling configuration, not an application
  fix. A server restart was not performed through the assistant.
- Created one explicitly labeled local test draft with user authorization.
- Saved this report and copied screenshot evidence into this documentation folder.

### Additional test cases executed - 2026-10-20

Follow-up testing extended coverage without saving another report or changing
the existing draft. Console listeners were active throughout these browser checks.

| ID | Test case and steps | Expected result | Actual result | Status |
|----|---------------------|-----------------|---------------|--------|
| QA-01 | Open Create report with empty required fields; click Save draft | Native validity prevents submission; stay on creation page | Form invalid; route remained `/reports/new` | PASS |
| QA-02 | Select KAN; set start to 2026-10-25 and end to 2026-10-19 | End date fails range validation | End date `validity.rangeUnderflow` was true | PASS |
| QA-03 | Add manual update with empty category and text | Both fields required | Both controls reported `validity.valueMissing` | PASS |
| QA-04 | Remove the unsaved manual update | Update block removed; empty message returns | "No manual updates added." visible | PASS |
| QA-05 | Open connected account page without confirming replacement | Account-switch action disabled | Connect a different account disabled | PASS |
| QA-06 | Check account replacement confirmation, then uncheck it; do not initiate OAuth | Confirmation enables account-switch action | Button enabled while checked; checkbox reset without starting OAuth | PASS |
| QA-07 | Navigate to `/qa-nonexistent-route` | Clear not-found page and recovery link | "Page not found", workflow explanation, and "Return to weekly reports" displayed | PASS |
| QA-08 | Return home after negative tests | Existing draft and published report remain listed | Both report links present exactly once | PASS |
| QA-09 | Monitor console during QA-01 through QA-08 | No errors, warnings, or uncaught exceptions | No captured events | PASS |
| QA-10 | Run `npm --prefix backend test` | All selected backend tests pass | 73 passed; 0 failed | PASS |
| QA-11 | Run `npm --prefix frontend test` | All selected frontend tests pass | 18 passed; 0 failed | PASS |
| QA-12 | Run `npm --prefix frontend run build` | Production assets build successfully | Vite build succeeded | PASS |

QA-02 and QA-03 check browser validity flags; they are not separate backend
validation tests. QA-01 submitted an invalid form, so this does not extend console
coverage to a successful draft-save request. No additional defects were observed
and no application fixes were applied. These are report test cases and executions;
no new automated test source files were added.

### Current status and remaining coverage

At the latest service check in this session, PostgreSQL was healthy, backend
`/health` returned `{\"status\":\"ok\"}`, and the frontend returned HTTP 200.
The connected application supported local report creation and review.

**Not tested in this session:**

- New Atlassian OAuth authorization, account switching, or disconnection.
- Project search, Jira update loading/selection, and source-data accuracy.
- Editing and re-saving a review draft, empty-section confirmation, or approval.
- New Confluence publication, destination selection, or external page accuracy.
- Persisted deletion, duplicate submissions, backend negative-input requests,
  and live failure recovery. Empty fields, reversed dates, unsaved update removal,
  account-switch confirmation gating, and unknown routes were checked above.
- Responsive layouts, accessibility, performance, or security testing.
- Console/network capture during form submission.
- The separate database test suite was not rerun. Backend tests (73), frontend
  tests (18), and production build passed in the follow-up run above.

Recommended next coverage: exercise Jira-backed report creation and the approval/
publication flow with explicit authorization, monitor submission network/console
events, and extend backend negative-input, accessibility, and failure-recovery
coverage. Automated regression suites and the build passed in this follow-up.

---

## Historical report - 2026-10-18 (not revalidated in this session)

The following pre-existing record is retained for reference. Its bugs, fixes,
commit references, and test totals describe an earlier run, not work performed
on 2026-10-20. In particular, OAuth is now connected and Node v24.22.0 was observed;
the old configuration blockers below should not be read as current findings.

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
