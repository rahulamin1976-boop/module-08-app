# QA Report — Weekly Status | Atlassian Status Automation

**Date:** 2026-10-18
**Method:** Exploratory testing driven through Chrome DevTools MCP (console, snapshots, screenshots, scripted interaction), plus the backend and frontend automated test suites.
**Environment:** React/Vite frontend (`127.0.0.1:5173`), Express backend (`127.0.0.1:3001`), Postgres 15 (docker-compose), real Atlassian OAuth connection (account: Rahul Amin; Jira projects KAN, SAM1).

## 1. Pages visited

| Route | Purpose | Result |
|---|---|---|
| `/` | Home / report list | Pass. "Backend online" indicator OK, no console errors |
| `/reports/new` | Create report | Pass once connected |
| `/connection` | Atlassian connection | Pass. OAuth connect and sign-in completed |
| `/reports/:id/review` | Review and approve | Pass. Empty-section confirmation enforced |
| `/reports/:id/publish` | Publish to Confluence | Pass. Published successfully |
| `*` | NotFound | Defined in routing, not exercised manually |

Screenshots: [main-page.png](./main-page.png) and [screenshots/](./screenshots/) (earlier unconnected-state run).

## 2. Elements tested

- **Connection:** Connect Atlassian button, account-switch confirmation checkbox, connection status and account display.
- **Create report:** Jira project search and select, time zone input, period start and end date inputs, manual update form (category, text, owner, add and remove), Jira candidate checkboxes and category selects, Save draft (disabled until connected).
- **Review:** report item editor (category, text, owner), empty-section confirmation checkboxes, version save, approve.
- **Publish:** Confluence space search and select, parent page search and select, title suffix (shown on title collision), proposed title preview, publish action.
- **Global:** console errors and warnings, DevTools Issues, `/health` through the Vite proxy, API behaviour when disconnected.

## 3. End-to-end flow executed

1. Connected Atlassian through the user's regular Chrome. Google sign-in is blocked in automation Chrome.
2. Created a draft: project KAN, 12–18 Oct 2026, manual update. The week had no Jira updates.
3. Saved v2 with Blockers and Next week confirmed empty, then approved.
4. Published to the HR space under the "Human Resources" parent page, after explicit confirmation.
5. Result: https://rahulamin1976.atlassian.net/spaces/HR/pages/360449/KAN+Weekly+Status+2026-10-12+to+2026-10-18

## 4. Bugs found

| # | Severity | Description | Status |
|---|---|---|---|
| 1 | Medium | `GET /api/v1/jira/projects` returned **500** when no Atlassian account was connected. OAuth settings were read before the connection lookup. Expected 401 `NOT_CONNECTED`. | Fixed |
| 2 | Low | DevTools Issue "A form field element should have an id or name attribute": 4 on `/connection`, 12 across the report flow. | Fixed |
| 3 | Info | Connect button returns 503 when `ATLASSIAN_CLIENT_ID` and `ATLASSIAN_CLIENT_SECRET` are unset. | Expected behaviour (configuration) |
| 4 | Info | The DevTools `fill` tool leaves React state empty on `<input type=date>`. | Tooling limitation, not an app bug |

No JavaScript errors or warnings were observed on any page.

## 5. Fixes applied

Both fixes are in commit `cc9fbb3`.

1. **Backend:** `backend/src/services/connection-service.js` (`getAccessToken`) checks the stored connection first and returns 401 `NOT_CONNECTED`. It loads OAuth settings afterwards and returns 503 `ATLASSIAN_NOT_CONFIGURED` if they are missing. Two regression tests were added in `backend/tests/services/connection-service.test.js`.
2. **Frontend:** `name` attributes added to 15 form fields in `ManualUpdateForm`, `CreateReportPage`, `PublishReportPage`, `ReviewReportPage` and `AtlassianConnectionPage`. `JiraCandidateList` and `ReportItemEditor` already had `id`s.

## 6. Current status

| Check | Result |
|---|---|
| Backend tests | 69/69 pass |
| Frontend tests | 18/18 pass |
| Console errors and warnings | None |
| DevTools form-field issue | Gone on `/reports/new` |
| Create, review, approve and publish flow | Pass |

## 7. Limitations and follow-ups

- After the `name` attribute change, only `/reports/new` was re-checked in the browser. Re-check `/connection`, review and publish.
- The NotFound route and error paths (title collision, uncertain publish response) were covered by unit tests only.
- No cross-browser, responsive, accessibility or performance (Lighthouse) testing was done.
- The published Confluence page is test data and can be deleted.
