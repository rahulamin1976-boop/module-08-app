# Module 17 Completion Report

## Specification Contents
# Feature Specification: Weekly Atlassian Leadership Status Reports

**Feature Branch**: `001-weekly-status-reports`

**Created**: 2026-10-18

**Status**: Ready for planning — prototype boundaries resolved

**Input**: Project constitution and previously supplied Atlassian weekly status report
and report-generation instructions. The project helps project managers and team leads
prepare evidence-based weekly leadership updates.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Prepare a Weekly Status Report (Priority: P1)

As a project manager or team lead, I want to prepare a weekly status report for a
project so that leadership can understand progress, upcoming work, risks, and required
support without manually assembling the update from scattered information.

**Why this priority**: Producing a useful, trustworthy weekly update is the project's
primary user outcome.

**Independent Test**: Provide a project name, reporting period, accomplishments,
blockers, and next steps; verify a report is produced that contains the provided facts
and clearly identifies missing information.

**Acceptance Scenarios**:

1. **Given** a reporting period and verified project updates, **When** the user requests
   a report, **Then** the report contains only facts supplied or verified for that
   project and period.
2. **Given** a required detail such as an owner, date, or measure is unavailable,
   **When** the report is prepared, **Then** the missing value is identified as not
   provided or not yet assessed instead of being guessed.
3. **Given** an empty accomplishments, blockers, or plans category, **When** the report
   is prepared, **Then** that category clearly states that no items were reported.
4. **Given** the source material reports a variance or blocker without enough detail to
   assess its effect, **When** the report is prepared, **Then** it states that impact
   is not yet assessed and identifies the missing detail.
5. **Given** a report is prepared, **When** it is rendered, **Then** it uses exactly
   three sections in this order: Accomplishments, Blockers, Next week, and does not
   exceed 20 lines including headings and blank lines. Report content uses bullets,
   and the report is returned as Markdown. The project key and reporting period appear
   in the Confluence page title, while publication state is shown in application
   metadata, not as extra report sections.

### User Story 2 - Review and Correct a Draft (Priority: P2)

As a project manager or team lead, I want to review and edit the prepared report before
sharing it so that its wording and interpretation accurately reflect the project update.

**Why this priority**: Human review ensures leadership receives an accountable update
and prevents an automated draft from being mistaken for an approved communication.

**Independent Test**: Prepare a report, change a field or sentence, and verify that the
reviewed version reflects the edit and remains clearly associated with its project and
reporting period.

**Acceptance Scenarios**:

1. **Given** a report draft has been prepared, **When** the user edits its content,
   **Then** the user can review the edited draft before sharing it.
2. **Given** a report contains unavailable or unassessed information, **When** the user
   reviews the draft, **Then** those labels remain visible until the user supplies or
   corrects the information.
3. **Given** report preparation fails because source information is unavailable,
   **When** the user views the result, **Then** the application explains what is
   missing and does not present an incomplete report as successfully verified.

### User Story 3 - Share the Approved Report (Priority: P3)

As a project manager or team lead, I want to share an approved report with its intended
audience so that leadership can access the update in the team's normal workspace.

**Why this priority**: Sharing completes the reporting workflow, but a reliable draft
and review experience provide value independently.

**Independent Test**: Approve a reviewed report and verify that the selected sharing
action either completes successfully with a usable reference or presents an explicit
failure without claiming success.

**Acceptance Scenarios**:

1. **Given** a user-approved report and a configured destination, **When** the user
   requests publication, **Then** the application reports success only after the
   destination confirms the write.
2. **Given** the destination rejects or cannot complete publication, **When** the user
   attempts to share, **Then** the application presents a clear error and retains the
   draft for recovery.
3. **Given** the report has not been approved by the user, **When** a publication action
   is requested, **Then** the application does not publish it.
4. **Given** an approved report and an authorized Atlassian Cloud connection, **When**
   the user chooses to publish, **Then** the application publishes it to a
   user-selected Confluence space and confirms the resulting page reference.

### Edge Cases

- The reporting period is missing, has reversed dates, or is outside available source
  data; the application asks for a valid period or reports the data gap.
- A source returns no matching project updates; the application distinguishes “no
  updates found” from an integration failure.
- A source returns incomplete, duplicated, or conflicting items; the report does not
  silently invent a resolution and identifies the uncertainty for review.
- Atlassian access is denied, credentials are invalid, the service is unavailable, or a
  request is rate-limited; the user receives a useful error and no false success.
- A report has missing measures, owners, dates, or blocker impacts; these are labelled
  unavailable instead of inferred.
- A publish request is retried after a timeout; the application avoids creating
  duplicate pages or clearly informs the user if duplicate prevention cannot be
  guaranteed.
- The user's chosen report layout exceeds its stated length limit; the application
  prevents approval/publication, preserves all facts, and asks the user to edit or
  deselect items.
- Jira returns no matching updates after a successful query; this is distinct from
  Jira being unavailable or returning an authorization error.
- A publication times out after Confluence may have created the page; retry uses the
  same report identity and reconciles the existing page instead of creating a second.
- Two browser tabs submit edits to the same draft; a stale update is rejected and the
  user is asked to reload the latest draft.
- Jira is unavailable while manual updates exist; the system allows a manual-only draft
  with a visible warning, rather than treating unavailable Jira data as an empty result.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let the user identify the project and reporting period
  for each status report.
- **FR-002**: The system MUST obtain report inputs from both an authorized Jira
  connection and user-supplied updates. Users MUST select and categorize Jira update
  candidates; the system MUST NOT infer accomplishments, blockers, or future plans
  from an issue status alone.
- **FR-003**: The system MUST organize report content into the user-approved layout and
  include progress, blockers, and next-period plans.
- **FR-004**: The system MUST place verified accomplishments under Accomplishments,
  verified blockers and risks under Blockers, and verified upcoming actions under
  Next week. It MUST include owners, dates, measures, or decisions only when relevant
  to these sections and supported by verified input.
- **FR-005**: The system MUST NOT invent project facts, dates, owners, measures, blocker
  impacts, or plans.
- **FR-006**: The system MUST label missing facts as unavailable, not provided, or not
  yet assessed, as applicable.
- **FR-007**: The system MUST indicate when a report category has no reported items.
- **FR-008**: The system MUST allow the user to review and edit a draft before it is
  shared externally.
- **FR-009**: The system MUST preserve the association between a report and its project
  and reporting period while the draft is being reviewed.
- **FR-010**: The system MUST provide explicit loading, success, and failure feedback
  for report preparation and sharing actions.
- **FR-011**: The system MUST NOT state that a report was published unless the
  destination confirms the publication.
- **FR-012**: The system MUST keep Atlassian credentials out of browser-visible
  content, logs, and committed files.
- **FR-013**: The system MUST let the user select or confirm the destination
  Confluence space and page location before publishing.
- **FR-014**: The system MUST limit the report to 20 lines, including headings and
  blank lines, and use exactly the sections Accomplishments, Blockers, and Next week,
  in that order.
- **FR-015**: The system MUST publish a report to Confluence only after user approval
  and confirmation of the target space.
- **FR-016**: The system MUST connect to Jira and Confluence using
  Atlassian Cloud with user-authorized OAuth 2.0 access.
- **FR-017**: The system MUST render Markdown with exactly the Accomplishments,
  Blockers, and Next week sections, in that order, using bullet-only report content
  and no more than 20 lines including headings and blank lines.
- **FR-018**: The system MUST NOT add a standalone summary, reporting-period header,
  measures table, or any section beyond the three approved sections.
- **FR-019**: The prototype MUST run as a single-user local application. It MUST bind
  its application interface to the local machine and MUST NOT expose report data or
  Atlassian credentials to other network users.
- **FR-020**: The prototype MUST use the connected Atlassian account as the sole
  application actor. It MUST display that account before approval or publication and
  record its account identifier, action, report identifier, and timestamp for each
  edit, approval, withdrawal, and publication attempt.
- **FR-021**: Application-level accounts, roles, workspace tenancy, and multiple
  application users are out of scope.
- **FR-022**: Jira issue candidates MUST be issues in the selected project whose
  `updated` timestamp falls within the inclusive reporting dates. The backend MUST
  fetch candidate fields directly from Jira and persist a snapshot of each selected
  candidate's issue identifier, key, summary, status, assignee when available,
  updated timestamp, URL, and retrieval time.
- **FR-023**: A Jira issue status MUST NOT determine report category. The user MUST
  explicitly categorize each selected candidate as an accomplishment, blocker, or
  next-week item.
- **FR-024**: Report items MUST be the authoritative editable facts. Rendered section
  text MUST be generated from those items and the fixed section template. Editing a
  fact MUST preserve its source type and reference; an edit that changes the fact
  materially MUST change its provenance to user-edited and retain the original source
  snapshot for review.
- **FR-025**: A saved report MUST contain a project key and reporting period in its
  Confluence page title using the format `{PROJECT_KEY} Weekly Status {YYYY-MM-DD} to
  {YYYY-MM-DD}`. The three-section report body MUST remain unchanged in structure.
- **FR-026**: Publication MUST be idempotent per report. The system MUST use the
  report identifier as a stable publication key, reconcile the target page after an
  uncertain response, and retry by updating/reconciling that same page rather than
  creating a duplicate.
- **FR-027**: Publication MUST create one child page under a user-selected Confluence
  parent page in the selected space. Existing unrelated pages with the proposed title
  MUST cause a conflict requiring a new title or explicit destination choice; the
  system MUST NOT overwrite unrelated pages.
- **FR-028**: The application MUST convert the approved Markdown body to Confluence
  page content while preserving headings, bullet lists, and links. The page title
  carries project and period metadata; approval/publication state MUST remain in
  application UI/metadata and MUST NOT be added to the Confluence page title or
  three-section body.
- **FR-029**: OAuth state MUST be cryptographically random, bound to the initiating
  local browser session, single-use, and valid for no more than 10 minutes. Provider
  tokens MUST be encrypted at rest using an encryption key supplied outside the
  database and source repository. Logs MUST redact authorization codes, tokens, and
  report body content.
- **FR-030**: OAuth permissions MUST be limited to reading Jira projects and issue
  candidates, reading Confluence spaces and page destinations, and creating or
  reconciling the selected Confluence page. Exact provider scope identifiers MUST be
  confirmed against the registered Atlassian OAuth application during implementation.
- **FR-031**: An empty section MUST contain the exact bullet `- No items reported.`
  only after the relevant inputs loaded successfully and the user confirms no items
  belong there. If a source failed, the report MUST instead show a warning bullet
  stating that source data is unavailable and MUST NOT imply there were no items.
- **FR-032**: Risks MUST appear in Blockers with an explicit `Risk:` prefix.
  Mitigations and leadership support requests MUST appear in Next week as explicit
  actions. The system MUST NOT silently omit a risk, decision, or support request
  because it does not have a dedicated section.
- **FR-033**: A report exceeding 20 lines MUST NOT be approved or published until the
  user edits the report or deselects items. The system MUST NOT silently truncate or
  rewrite facts.
- **FR-034**: The prototype MUST retain reports and source snapshots until the local
  user explicitly deletes them. Deleting an application report MUST NOT delete its
  already-published Confluence page. An explicit Confluence page deletion workflow
  is out of scope.
- **FR-035**: The application MUST support concurrent-tab conflict detection using
  the report's update version. An edit based on a stale version MUST return HTTP `409`
  without overwriting the latest saved draft.
- **FR-036**: Jira candidate searches MUST use the reporting period, return at most
  100 candidates per request with cursor-based pagination, and deduplicate candidates
  by Jira issue identifier.
- **FR-037**: All endpoints MUST validate required fields, reject unknown report
  statuses/categories, and return structured errors. List endpoints MUST use cursor
  pagination with a maximum page size of 100.
- **FR-038**: Reports MUST be editable only in `draft`. Approval changes `draft` to
  `approved`; withdrawal changes `approved` back to `draft` and clears approval
  metadata. Publishing changes `approved` to `publishing`, then to `published` after
  confirmed creation or reconciliation, or back to `approved` after a recoverable
  failure. Published reports are immutable in the prototype.
- **FR-039**: The application MUST allow the connected user to delete a saved report
  and all of its source items and audit records. It MUST explain that any published
  Confluence page remains in place.
- **FR-040**: The interface MUST support keyboard operation and semantic screen-reader
  labels for the report-creation, review, approval, and publication flows. Core flows
  MUST conform to WCAG 2.2 AA. The prototype is English-only and desktop-first;
  localization and mobile-specific optimization are out of scope.
- **FR-041**: If Jira is unavailable but manual updates exist, the system MUST allow
  the user to create a draft from manual updates with a visible Jira-unavailable
  warning. It MUST NOT imply that Jira returned no matching items. If Jira loaded
  successfully and returned no items, report creation MAY proceed when the user
  explicitly confirms every empty category. If Jira is unavailable and there are no
  manual updates, report creation MUST be blocked.
- **FR-042**: The local application MUST bind to loopback only, reject requests from
  non-loopback origins, and validate same-origin state-changing requests.
- **FR-043**: Each report MUST retain creator, approver, and last-editor Atlassian
  account identifiers. Connecting another account MUST NOT silently reassign reports
  or approvals created by the prior account.
- **FR-044**: Published Confluence pages MUST inherit access permissions from the
  selected parent page. Custom permission administration and cross-space permission
  changes are out of scope.
- **FR-045**: Reporting-period dates MUST be interpreted as inclusive calendar dates
  in the selected timezone; if no timezone is selected, use the connected Atlassian
  site's timezone, falling back to UTC. The end date is converted to an exclusive
  next-day boundary for Jira timestamp queries.
- **FR-046**: Project/space search strings MUST be 1–100 characters; trimmed manual
  update text MUST be 1–2,000 characters; owner text MUST be at most 120 characters;
  and page titles MUST be 1–255 characters. Invalid values return HTTP `400`.
- **FR-047**: Deleting a report MUST require explicit confirmation and, when the
  report was published, the UI MUST show that its Confluence page will remain.
- **FR-048**: Encryption keys MUST be provided by local environment configuration,
  not stored in the database or source control, and never written to logs. Key
  rotation and external key-management services are out of scope for this prototype.
  A key change requires the connection credentials to be re-encrypted before the old
  key is removed.
- **FR-049**: The Confluence page title MUST follow
  `{PROJECT_KEY} Weekly Status {YYYY-MM-DD} to {YYYY-MM-DD}`. If an unrelated page
  already has that title, the user MAY append a disambiguating suffix after reviewing
  the conflict. The report body MUST NOT contain extra metadata headings.
- **FR-050**: A Confluence page MUST store the report UUID in a content property used
  to locate the report during publication retries. After an uncertain response, the
  application MUST search for that property before attempting page creation.
- **FR-051**: Each API endpoint MUST validate its exact request schema, including
  nested fields, required fields, types, and documented length limits; unknown fields
  MUST return HTTP `400`. List responses MUST use the documented `items` and
  `nextCursor` envelope.
- **FR-052**: Report lifecycle metadata MUST be consistent: `draft` has no approval
  or publication timestamps; `approved` has an approver and approval time;
  `publishing` has an approval and selected destination; and `published` has a
  Confluence page ID, URL, approver, approval time, and publication time.
- **FR-053**: Disconnecting Atlassian MUST remove stored credentials without deleting
  reports. Reconnecting a different Atlassian account MUST require explicit user
  confirmation and MUST NOT transfer or approve existing reports.
- **FR-054**: Each report edit and approval action MUST record the connected actor and
  timestamp while the report exists. Deleting a report deletes its local audit
  history; durable compliance logging is out of scope.
- **FR-055**: The backend MUST refresh an expiring Atlassian access token using the
  provider-issued refresh credential. If refresh fails, it MUST mark the connection
  disconnected and require reconnection without deleting reports. Disconnect MUST
  attempt provider token revocation and remove local credentials; if revocation fails,
  the UI MUST disclose that remote revocation could not be confirmed.
- **FR-056**: Each report MUST persist the categories the user explicitly confirmed
  empty. The exact `- No items reported.` bullet is rendered only for a confirmed
  category with no items after successful Jira retrieval; adding an item clears that
  category's empty confirmation. A failed Jira retrieval cannot be confirmed empty.
  In the draft UI, an empty category that is neither confirmed nor unavailable MUST
  be marked as needing confirmation; approval and publication MUST remain disabled
  until each category has an item, an empty confirmation, or an unavailable warning.
- **FR-057**: Source-unavailable warnings MUST be persisted with the report and shown
  again when the report is reopened. A source failure MUST never be recorded as a
  confirmed empty category.

## User Interface Screens

### 1. Weekly Reports

- Lists saved reports with project, reporting period, status, and last-updated time.
- Provides actions to create a report or reopen a draft.
- Shows an empty state when no reports exist and an actionable error if reports cannot
  be loaded.

### 2. Create Report

- Lets the user choose a Jira project and reporting-period start and end dates.
- Lets the user select a timezone for the date range, defaulting to the connected
  Atlassian site's timezone and then UTC.
- Shows Jira updates found for the selected period and provides fields for user-supplied
  accomplishments, blockers, and next-week actions. The user classifies candidate Jira
  updates into the report sections; the system does not infer report meaning from an
  issue status alone.
- Displays loading, no-results, validation, and source-connection error states.
- Allows a manual-only draft when Jira retrieval fails, with a prominent warning that
  Jira data could not be loaded.
- Lets the user create a draft after reviewing the selected inputs.

### 3. Review Report

- Shows the generated Markdown report with exactly the three approved sections.
- Provides editing controls for report content and makes source-provenance details
  available for each imported or manually entered fact.
- Clearly labels missing facts and empty categories.
- Requires explicit confirmation for empty categories and preserves source-unavailable
  warnings when a draft is saved and reopened.
- Provides Save Draft, Approve, and Publish actions. Publish is unavailable until the
  user approves the draft and selects a destination.
- Shows the connected Atlassian account as the actor for approval and publishing.
- Shows report creator, last editor, version, and approval state.
- Prevents approval and publication when the Markdown preview exceeds 20 lines.

### 4. Publish Report

- Lets the user select a Confluence space and parent page and confirm the destination
  and proposed page title. Published content inherits permissions from the selected
  parent page.
- Shows the report preview and requires an explicit final publish action.
- On success, shows the published page link; on failure, preserves the draft and shows
  a recoverable error.

### 5. Atlassian Connection

- Shows Jira and Confluence connection state and the connected Atlassian account.
- Starts or revokes the user-authorized Atlassian Cloud OAuth 2.0 connection.
- Never displays access or refresh tokens.
- Displays required connection permissions and the connected account before the user
  confirms authorization.

## API Contract

The local application API is JSON over HTTPS under `/api/v1`. It is bound to loopback
and is not exposed to other network users. Error responses use
`{ "error": { "code": "string", "message": "string" } }`; messages MUST NOT expose
credentials or provider tokens. The following endpoints define the initial data flow.

| Method and endpoint | Input | Output and purpose |
|---|---|---|
| `GET /api/v1/integrations/atlassian` | None | Connection state and account display name; never returns tokens. |
| `POST /api/v1/integrations/atlassian/oauth/start` | Optional `{ "confirmAccountSwitch": true }` when changing account | Returns an authorization URL; the server binds one-time OAuth state to the initiating browser session. |
| `GET /api/v1/integrations/atlassian/oauth/callback` | Provider authorization code and state | Validates state, stores protected connection credentials, then redirects to the connection screen. |
| `DELETE /api/v1/integrations/atlassian` | None | Removes local credentials and returns `{ "connected": false, "providerRevoked": <boolean> }`; a failed provider revocation is shown as a warning. |
| `GET /api/v1/jira/projects?query={text}&cursor={cursor}&limit={n}` | Optional search text, cursor, and page size | Returns matching Jira project identifiers, keys, and names for project selection. |
| `GET /api/v1/jira/projects/{projectId}/updates?from={date}&to={date}&timezone={ianaZone}&cursor={cursor}&limit={n}` | Project identifier, inclusive date bounds, IANA timezone, optional cursor and page size | Returns up to 100 Jira issue candidates per page, ordered by issue identifier, including identifier, key, summary, status, assignee when available, updated timestamp, and URL. |
| `GET /api/v1/confluence/spaces?query={text}&cursor={cursor}&limit={n}` | Optional search text, cursor, and page size | Returns available Confluence space identifiers and names for destination selection. |
| `GET /api/v1/confluence/spaces/{spaceId}/pages?query={text}&cursor={cursor}&limit={n}` | Space identifier, optional search text, cursor, and page size | Returns candidate parent pages, up to 100 per page. |
| `GET /api/v1/reports` | Optional `projectId`, `status`, `cursor`, and `limit` filters | Returns report summaries ordered by update time descending, with a default limit of 50 and maximum of 100. |
| `POST /api/v1/reports` | `projectId`, `periodStart`, `periodEnd`, `timezone`, categorized `jiraUpdates[]`, `manualUpdates[]`, and `confirmedEmptyCategories[]` | Refetches and snapshots selected Jira facts, combines manual facts, saves a draft, and returns report identifier, sections, sources, confirmed-empty categories, and warnings. |
| `GET /api/v1/reports/{reportId}` | None | Returns report metadata, version, canonical editable report items, rendered sections, warnings, and publication state. |
| `PATCH /api/v1/reports/{reportId}` | `version`, updated structured `items[]`, and `confirmedEmptyCategories[]` | Saves draft changes only when the submitted version matches the latest version; otherwise returns `409`. |
| `DELETE /api/v1/reports/{reportId}` | `{ "confirm": true }` | Deletes local report, source items, and audit history; never deletes a Confluence page. Returns HTTP `204`. |
| `POST /api/v1/reports/{reportId}/approve` | `{ "confirm": true }` | Changes draft to approved and records actor and time. |
| `POST /api/v1/reports/{reportId}/withdraw-approval` | `{ "confirm": true }` | Returns approved report to draft and clears current approval metadata. |
| `POST /api/v1/reports/{reportId}/publish` | `confluenceSpaceId`, `parentPageId`, `pageTitle`, stable `idempotencyKey` equal to report ID | Creates or reconciles the approved report page and returns status, page identifier, and URL. |

The report creation request accepts data in this shape:

```json
{
  "projectId": "project-uuid",
  "periodStart": "2026-10-12",
  "periodEnd": "2026-10-16",
  "timezone": "UTC",
  "confirmedEmptyCategories": ["blocker"],
  "jiraUpdates": [
    {
      "issueKey": "OPS-123",
      "issueId": "jira-issue-id",
      "category": "accomplishment"
    }
  ],
  "manualUpdates": [
    {
      "category": "accomplishment",
      "text": "Completed the agreed milestone",
      "owner": "Team name"
    }
  ]
}
```

Request field contracts:

| Request | Required fields and validation |
|---|---|
| OAuth start | Empty object for the current account; optional boolean `confirmAccountSwitch` MUST be `true` to replace a different connected/reported account. |
| Jira/Confluence searches | Optional trimmed `query` of 1–100 characters; optional `cursor`; optional integer `limit` from 1–100, default 50. Date searches also require valid `from`, `to`, and IANA `timezone`, with `from <= to`. |
| Report list | Optional valid `projectId`, `status` from `draft`, `approved`, `publishing`, `published`, `cursor`, and `limit` from 1–100, default 50. |
| Report creation | Required `projectId`, ISO dates with `periodStart <= periodEnd`, valid IANA `timezone`, arrays of categorized Jira/manual inputs, and `confirmedEmptyCategories` array. Category is `accomplishment`, `blocker`, or `next_week`; manual text is 1–2,000 characters after trimming and owner is at most 120 characters. At least one source must load successfully or one manual item must be provided. Confirmed-empty values must have no items in that category and require successful Jira retrieval. |
| Draft update | Required positive integer `version`, an `items` array, and `confirmedEmptyCategories` array. Existing item IDs must belong to the report; new items without IDs are manual only. Each item has a valid category, text, and optional owner. Confirmed-empty values must have no items in that category and require a successful Jira snapshot. Client input cannot set source provenance or Jira snapshots. |
| Delete, approve, withdraw | Required JSON boolean `confirm: true`. |
| Publish | Required `confluenceSpaceId`, `parentPageId`, 1–255-character `pageTitle` following the defined title pattern (or a user-confirmed disambiguating suffix), and `idempotencyKey` equal to the report UUID. |

The report creation response includes `id`, `version`, `status`, `project`,
`periodStart`, `periodEnd`, `timezone`, `sections` (Accomplishments, Blockers,
Next week), `sourceItems`, `confirmedEmptyCategories`, and `warnings`.
Jira-sourced, manual, and user-edited facts remain distinguishable in `sourceItems`.

All request bodies reject unknown top-level properties. Dates use ISO `YYYY-MM-DD`;
timestamps use RFC 3339 UTC. Project, space, and report list responses use
`{ "items": [], "nextCursor": null }` or an opaque next cursor; default page size is
50 and maximum is 100. OAuth callback responses redirect to the connection UI and
never expose authorization codes or tokens. OAuth state is held server-side and bound
to a secure, same-site browser session; the authorization URL is the only OAuth-start
response field. `confirmAccountSwitch` is required only when replacing an existing
connection with a different Atlassian account. Approval and withdrawal require
`{ "confirm": true }`. Draft updates use `{ "version": 3, "items": [...] }` and return
the incremented version. Publication accepts
`{ "confluenceSpaceId": "...", "parentPageId": "...", "pageTitle": "...",
"idempotencyKey": "<report-id>" }`.

Endpoint response contracts:

| Endpoint group | Successful response |
|---|---|
| Integration state | `GET` returns `{ "connected": false }` or `{ "connected": true, "account": { "id": "...", "displayName": "..." }, "capabilities": [...], "expiresAt": "..." }`. |
| OAuth start/callback | Start returns `{ "authorizationUrl": "..." }`; callback redirects to the connection screen with a non-sensitive outcome code. |
| Jira projects, updates, Confluence spaces, and parent pages | `{ "items": [...], "nextCursor": null }`; each item contains only the documented ID/key/name or issue/page fields. |
| Report list | `{ "items": [{ "id": "...", "project": {...}, "periodStart": "...", "periodEnd": "...", "timezone": "...", "status": "...", "version": 1, "updatedAt": "..." }], "nextCursor": null }`. |
| Report create/read | Returns report `id`, `version`, `status`, project and period metadata, canonical `items`, rendered `sections`, source provenance, `confirmedEmptyCategories`, and persisted `warnings`. Create returns `201`; read returns `200`. |
| Report update | Returns `{ "id": "...", "version": 4, "status": "draft", "items": [...] }` after a successful version-matched update. |
| Approve/withdraw | Returns `{ "id": "...", "version": 4, "status": "approved" }` or `{ "id": "...", "version": 4, "status": "draft" }`, with current approval metadata where applicable. |
| Report deletion | Returns HTTP `204` with no response body after explicit confirmation. |
| Publication | Returns `{ "id": "...", "status": "published", "confluencePageId": "...", "confluencePageUrl": "..." }` only after page creation or reconciliation is confirmed. |

All JSON errors use `{ "error": { "code": "...", "message": "..." } }`; validation
errors are `400`, missing/expired authorization is `401`, insufficient Atlassian
capability is `403`, absent resources are `404`, state/version/title conflicts are
`409`, provider rate limits are `429` with `Retry-After`, and temporary upstream
unavailability is `503`. Error messages MUST NOT contain secrets or report body text.

Endpoint behavior:

- Requests with invalid project identifiers, invalid dates, reversed date ranges, or
  invalid update categories return HTTP `400`.
- Missing or expired Atlassian authorization returns HTTP `401`; insufficient
  application permissions on the connected Atlassian account return HTTP `403`.
- A report or project that does not exist returns HTTP `404`.
- A report edit based on a stale version returns HTTP `409` with the latest report
  version and MUST NOT overwrite it.
- Atlassian rate limiting returns HTTP `429` with `Retry-After`; temporary upstream
  unavailability returns HTTP `503`. Neither response may create a success-shaped
  report or publication record.
- Upstream operations have a 15-second deadline and at most two automatic retries for
  rate limiting or transient server/network failures, honoring `Retry-After`.
  Authorization and validation failures are not retried.
- List endpoints return `{ "items": [], "nextCursor": null }` or an opaque next cursor,
  with a default page size of 50 and maximum of 100.
- `GET /api/v1/integrations/atlassian` returns `{ "connected": false }` when
  disconnected, or `connected`, account display name, granted capabilities, and expiry
  when connected. Tokens are never included.
- OAuth callback failures redirect to the connection screen with a non-sensitive error
  code; state mismatch, expiry, or reuse returns an authorization failure and does not
  store tokens.
- If Jira retrieval fails but manual updates exist, report creation may continue with
  an explicit persisted warning. With Jira unavailable and no manual updates, it
  returns HTTP `503` and creates no report. If Jira loads successfully with no
  candidates, all empty categories require explicit confirmation before a draft can
  be created.
- Approval conflicts and edits to a non-draft return HTTP `409`.
- Approval of a report with an unconfirmed empty category returns HTTP `409` with
  error code `REPORT_INCOMPLETE`.
- An unrelated Confluence page with the proposed title returns HTTP `409`; it is never
  overwritten.
- Delete requires `{ "confirm": true }` and returns HTTP `204` after local deletion.
- Creating a draft returns HTTP `201`; reads and successful updates return HTTP `200`.
- Publication returns HTTP `200` only after Confluence confirms the page creation.

## Data Model

PostgreSQL 15 stores report drafts, verified source items, project references, and
Atlassian connection metadata.

### `projects`

| Field | Type | Rules and purpose |
|---|---|---|
| `id` | UUID | Primary key used by application endpoints. |
| `jira_project_id` | TEXT | Jira project identifier; unique and required. |
| `jira_project_key` | TEXT | Jira project key; required. |
| `name` | TEXT | Display name; required. |
| `last_synced_at` | TIMESTAMPTZ | Most recent successful project refresh; nullable. |
| `created_at`, `updated_at` | TIMESTAMPTZ | Record creation and last update times. |

Project records are refreshed from Jira when listed or used. They do not duplicate Jira
issue data outside a report's source snapshot.

### `integration_connections`

| Field | Type | Rules and purpose |
|---|---|---|
| `id` | UUID | Primary key. |
| `provider` | TEXT | Required; initially `atlassian_cloud`. |
| `cloud_id` | TEXT | Atlassian Cloud site identifier; required. |
| `site_url` | TEXT | Connected Atlassian site's HTTPS base URL for source links. |
| `account_id` | TEXT | Connected Atlassian account identifier; required and used as the sole local prototype actor. |
| `account_display_name` | TEXT | Non-secret connected-account display name shown before approval or publication. |
| `access_token_ciphertext` | TEXT | Encrypted access token; never returned by application APIs. |
| `refresh_token_ciphertext` | TEXT | Encrypted refresh token; never returned by application APIs. |
| `encryption_key_reference` | TEXT | Reference to the externally supplied key configuration; contains no key material. |
| `expires_at` | TIMESTAMPTZ | Access token expiry. |
| `scopes` | TEXT[] | Granted scopes, limited to required Jira read and Confluence page publishing. |
| `created_at`, `updated_at` | TIMESTAMPTZ | Connection lifecycle timestamps. |

Tokens MUST be encrypted at rest and excluded from logs, API responses, and backups not
approved to contain secrets. OAuth state values are one-time and expire after use.

### `status_reports`

| Field | Type | Rules and purpose |
|---|---|---|
| `id` | UUID | Primary key and report identifier. |
| `project_id` | UUID | Required foreign key to `projects.id`. |
| `created_by_account_id` | TEXT | Required connected Atlassian account that created the report. |
| `approved_by_account_id` | TEXT | Nullable connected account that approved the current version. |
| `last_edited_by_account_id` | TEXT | Nullable connected account that last edited the report. |
| `period_start`, `period_end` | DATE | Required reporting bounds; start MUST be on or before end. |
| `timezone` | TEXT | Required IANA timezone used to interpret inclusive reporting dates. |
| `status` | TEXT | Required; one of `draft`, `approved`, `publishing`, `published`. |
| `version` | INTEGER | Required optimistic-concurrency version; incremented on each successful edit. |
| `source_snapshot` | JSONB | Retrieval window and immutable selected Jira facts; excludes credentials. |
| `confirmed_empty_categories` | TEXT[] | Required; confirmed empty section categories, limited to the three report categories and cleared when an item is added to that category. |
| `warnings` | JSONB | Required; persisted non-sensitive source-unavailable or data-quality warnings displayed when reopening the report. |
| `confluence_idempotency_key` | UUID | Required unique key derived from this report's identifier and used for publication reconciliation. |
| `confluence_parent_page_id` | TEXT | Selected parent page; required when publication is attempted. |
| `confluence_space_id` | TEXT | Nullable until publication destination is selected. |
| `confluence_page_id`, `confluence_page_url` | TEXT | Nullable until publication succeeds. |
| `approved_at`, `published_at` | TIMESTAMPTZ | Nullable lifecycle timestamps. |
| `created_at`, `updated_at` | TIMESTAMPTZ | Record creation and last update times. |

Reports are associated with one project and period. Duplicate creation for the same
project and period is allowed; the user chooses which draft to continue.

### `report_items`

| Field | Type | Rules and purpose |
|---|---|---|
| `id` | UUID | Primary key. |
| `report_id` | UUID | Required foreign key to `status_reports.id`, deleted with its report. |
| `category` | TEXT | Required; one of `accomplishment`, `blocker`, `next_week`. |
| `position` | INTEGER | Required non-negative ordering value within the report category. |
| `text` | TEXT | Required verified or user-supplied fact. |
| `source_type` | TEXT | Required; `jira`, `manual`, or `user_edited`. |
| `source_reference` | TEXT | Jira issue key/URL or null for manual input. |
| `source_snapshot` | JSONB | Immutable Jira fields captured at report creation; null for manual-only items. |
| `edited_by_account_id` | TEXT | Connected Atlassian account that last edited the item; null before edit. |
| `updated_at` | TIMESTAMPTZ | Last item edit time. |
| `owner` | TEXT | Optional owner explicitly present in the source. |
| `source_updated_at` | TIMESTAMPTZ | Optional timestamp from Jira. |
| `created_at` | TIMESTAMPTZ | Record creation time. |

Each report item preserves provenance so the user can distinguish Jira facts from manual
updates and verify report content before approval.

### `report_audit_events`

| Field | Type | Rules and purpose |
|---|---|---|
| `id` | UUID | Primary key. |
| `report_id` | UUID | Required foreign key to `status_reports.id`. |
| `actor_account_id` | TEXT | Required connected Atlassian account identifier for the actor. |
| `action` | TEXT | Required; `created`, `edited`, `approved`, `approval_withdrawn`, `publish_started`, `published`, `publish_failed`, or `deleted`. |
| `occurred_at` | TIMESTAMPTZ | Required action time. |
| `details` | JSONB | Non-sensitive action metadata; MUST NOT contain tokens or full report text. |

Audit events are retained with the report and cascade-delete when the user deletes
that application report. They are not a tamper-proof compliance audit system.

### Data Relationships and Lifecycle

- A project has many status reports.
- A status report has many report items.
- A status report has many audit events.
- The initial local installation has one active Atlassian Cloud connection.
- Creator, approver, and editor identifiers retain the connected account at action
  time. Reconnecting with another account does not transfer existing report ownership.
- A new report starts as `draft`; approval changes it to `approved`; withdrawal returns
  it to `draft`; publication changes it to `publishing` and then `published` after
  confirmation or back to `approved` after a recoverable failure.
- Only drafts can be edited. Published reports are immutable. A user must withdraw
  approval before changing an approved report.
- Disconnecting Atlassian removes stored credentials but does not silently delete saved
  reports.
- Report deletion removes local report data and audit events but never deletes remote
  Confluence content.
- A successful publication stores the stable report identifier as a Confluence content
  property so a retry can locate and reconcile the same page.

### Key Entities

- **Project**: The project whose progress is being reported; identified by a name and,
  when available, a source-system reference.
- **Reporting Period**: The start and end dates that bound the update.
- **Project Update**: A verified or user-provided accomplishment, plan, risk, blocker,
  decision, or measure, with its source and any available owner, date, and impact.
- **Status Report**: A draft or approved leadership update associated with a project
  and reporting period, containing an ordered set of report sections and their content.
- **Publication Destination**: A user-selected workspace location for an approved
  report, if external publication is included.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can prepare a first report draft for one project and one reporting
  period in five minutes or less after the required information is available.
- **SC-002**: In a review of generated reports, 100% of factual statements are traceable
  to user-provided or verified source information.
- **SC-003**: 100% of tested missing required details are identified as unavailable
  rather than filled with invented information.
- **SC-004**: In all acceptance tests, users can edit and review a draft before
  publication; the system rejects every publication attempt for a draft that has not
  been approved.
- **SC-005**: Every tested sharing failure is presented as a failure, and no failed
  operation is reported as a successful publication.
- **SC-006**: In all acceptance tests, users can identify project, reporting period,
  and approval/publication state from the saved report view or published page title
  and application metadata.
- **SC-007**: In 100 consecutive retry tests where Confluence creates a page but the
  client receives an uncertain response, exactly one page exists for the report.
- **SC-008**: In tests using two stale browser tabs, zero stale updates overwrite a
  newer saved report version.
- **SC-009**: In 100% of tested empty-source, source-failure, and authorization-failure
  cases, the report distinguishes confirmed absence of items from unavailable data.
- **SC-010**: Keyboard-only users can complete connection, draft preparation, review,
  approval, and publication without a pointer device.
- **SC-011**: In a local test environment, 95% of Jira project, update, Confluence
  space, and page-selection requests complete within 15 seconds or show the defined
  timeout error.
- **SC-012**: In 100 consecutive tests of Jira-unavailable handling with manual input,
  the system creates a draft only with an explicit source-unavailable warning and
  never reports an empty Jira result.
- **SC-013**: Automated accessibility checks and keyboard/screen-reader acceptance
  tests show that all core flows meet WCAG 2.2 AA; no critical or serious
  accessibility violations remain in those flows.
- **SC-014**: In every test that saves and reopens a draft after an upstream source
  failure, the warning remains visible, and no affected category is rendered as
  confirmed empty.
- **SC-015**: Every tested report with an unconfirmed empty category is blocked from
  approval and publication until the user adds an item, confirms no items, or the
  application records the source as unavailable.

## Assumptions

- The project name is **Atlassian Weekly Status Automation**.
- Primary users are project managers and team leads preparing updates for leadership.
- The report-generation source is the Atlassian weekly status report and instructions
  discovered in prior project materials.
- Report content must remain evidence-based; unavailable facts are called out instead
  of guessed.
- The UI and integrations follow the stack and repository conventions in
  [`constitution.md`](./constitution.md); this specification describes user needs and
  observable behavior rather than implementation design.
- The prototype supports one local user, one connected Atlassian account, one selected
  project, and one reporting period per report.
- The user selected Atlassian Cloud with OAuth 2.0. Exact OAuth scopes MUST be limited
  to the Jira read and Confluence page-publishing operations needed by this workflow.
- Automated prose generation is not required unless explicitly approved; assembling
  and formatting verified facts is sufficient for the first useful workflow.
- The concise three-section report format is the selected output format; the longer
  sample report is background context, not the required layout.
- Reports and source snapshots remain until the user explicitly deletes them; automatic
  expiry is not implemented.
- Reporting-period dates are inclusive calendar dates in a user-selected timezone;
  default to the connected Atlassian site's timezone, then UTC. Jira timestamp queries
  use the UTC instant corresponding to the start date and the exclusive start of the
  day following the end date.
- “Next week” is entered or selected by the user. The application does not infer future
  plans from Jira statuses or automatically calculate working days.
- The application is local-only, English-only, and desktop-first. Multi-user hosting,
  organizational administration, localization, mobile-specific optimization, production
  availability targets, automated backups, and disaster recovery are out of scope.
- Scale is limited to one local human user; no throughput, lifetime report-count, or
  horizontal-scaling target is promised. Paginated searches return at most 100 records
  per page, and saved reports may grow until the user deletes them or local storage is
  exhausted. Bulk import/export, operational metrics, and distributed tracing are out
  of scope.
- The prototype makes no claim of compliance with a named regulation, certification,
  or organizational records-retention policy; such compliance use is out of scope.
- The first version provides functional keyboard and screen-reader support for core
  flows conforming to WCAG 2.2 AA; third-party accessibility certification is out of
  scope.
- Current stack versions in the constitution are the approved initial baseline.
  Package manifests and lockfiles pin installed dependencies. Version upgrades require
  an explicit reviewed change and compatibility validation; automatic dependency
  upgrades are out of scope.
- Constitution ratification-date administration is out of scope for this prototype
  feature; the governance TODO does not block implementation of the weekly reporting
  workflow.

## Clarifications and Prototype Scope Decisions

The following decisions resolve the review findings recorded in
[`clarify.md`](./clarify.md):

1. **Answered — application identity and access (finding 1):** This is a single-user,
   local-only prototype. Application-level sign-in, roles, tenancy, and multi-user
   access are out of scope. The connected Atlassian account is shown and is the sole
   local actor.
2. **Answered — attribution and audit (finding 2):** Approval, edits, publication
   attempts, and deletion record actor account ID, action, report ID, and timestamp in
   `report_audit_events`. This is a product audit trail, not tamper-proof compliance
   logging.
3. **Answered — report identity (finding 3):** The report body remains exactly three
   sections. The Confluence page title contains project key and date range; approval
   and publication state are visible in the application only, not in the page title
   or report body.
4. **Answered — publication retries (finding 4):** Publication is idempotent per
   report. A stable report identifier is used to reconcile uncertain outcomes before
   retrying; one page is created per report.
5. **Answered — trusted Jira facts (finding 5):** The backend refetches selected
   issues and saves immutable field snapshots with retrieval time and source URL.
6. **Answered — edited facts and provenance (finding 6):** Structured report items are
   canonical. Rendered sections derive from them; material edits are marked
   user-edited while the original source snapshot is retained.
7. **Answered — lifecycle (finding 7):** Drafts may be edited. Approval is explicitly
   withdrawn to return to draft before editing. Publication failure returns the report
   to approved for retry; published reports are immutable.
8. **Answered — Confluence behavior (finding 8):** Publication creates a child page
   under a user-selected parent. It does not overwrite unrelated title collisions.
   Markdown headings, bullets, and links are preserved during conversion.
9. **Answered — OAuth safety (finding 9):** OAuth state is random, browser-session
   bound, single-use, and expires after 10 minutes. Tokens are encrypted at rest using
   an external key; refresh and revocation outcomes are defined. Logs omit tokens,
   callback credentials, and report body text. Exact OAuth scope identifiers are
   verified against the registered Atlassian app during implementation.
10. **Answered — connection ownership (finding 10):** Exactly one local user and one
    Atlassian account connection are supported. Per-user and per-workspace connections
    are out of scope.
11. **Answered — retention (finding 11):** Local reports and source snapshots remain
    until user deletion. Deleting the local record does not remove a published page;
    automatic retention and remote deletion are out of scope.
12. **Answered — period boundaries (finding 12):** Dates are inclusive in the
    Atlassian site timezone, falling back to UTC. “Next week” is user-entered and is
    not calculated from calendar/business-day rules.
13. **Answered — missing versus empty (finding 13):** The user explicitly confirms
    empty categories after successful Jira retrieval. Confirmations and source
    warnings are persisted; source failure is identified as unavailable and never
    presented as an empty result.
14. **Answered — risk and decision mapping (finding 14):** Risks use a `Risk:` prefix
    under Blockers. Mitigations, decisions, and leadership support requests are
    explicit actions under Next week.
15. **Answered — 20-line cap (finding 15):** Approval and publication are blocked over
    20 lines; the user edits or deselects items. The application never silently
    truncates or rewrites facts.
16. **Answered — API contract completeness (finding 16):** Endpoints use structured
    JSON errors, bounded cursor pagination, explicit disconnected OAuth state, 400,
    401, 403, 404, 409, 429, and 503 behaviors, 15-second upstream deadlines, and at
    most two transient retries.
17. **Answered — concurrency (finding 17):** Single-user concurrent tabs are supported
    with optimistic version checks; stale writes return 409 without overwriting data.
18. **Answered — Jira selection (finding 18):** Candidates are issues updated in the
    inclusive report period, deduplicated by issue ID, with up to 100 per cursor page.
    The user categorizes each selected issue.
19. **Answered — persistent metadata (finding 19):** Actor identity, approval state,
    version, source snapshots, report items, confirmed-empty categories, warnings,
    publication identifiers, and audit events are represented in the model. Rendered
    Markdown is derived from canonical items.
20. **Answered — status invariants (finding 20):** Allowed transitions are draft to
    approved, approved to draft by withdrawal, approved to publishing, and publishing
    to published or back to approved on failure. Published reports are immutable.
21. **Answered — accessibility and language (finding 21):** Core flows target WCAG
    2.2 AA and support keyboard and screen-reader use. Third-party certification,
    localization, and mobile-specific optimization are out of scope; the interface is
    English and desktop-first.
22. **Out of scope — operations (finding 22):** Production availability, automated
    backup, disaster recovery, telemetry, and production-scale targets are out of
    scope. Individual upstream calls have a 15-second deadline and defined bounded
    retry behavior for this local prototype.
23. **Answered — logging/privacy (finding 23):** Logs contain operational metadata
    only; tokens, callback credentials, and report body content are redacted/omitted.
    Report data retention follows user-controlled local deletion.
24. **Answered — success measurement (finding 24):** Criteria SC-001 through SC-015
    define measurable outcomes for draft creation, traceability, failure
    distinctions, idempotent publication, stale-write protection, latency,
    manual-only fallback, persisted warnings, empty-category readiness, and
    accessibility. Count-based criteria use automated repeated scenarios;
    accessibility uses automated checks plus keyboard/screen-reader acceptance tests.
25. **Answered — stack-version policy (finding 25):** Constitution versions are the
    approved initial baseline; lockfiles pin exact dependencies. Upgrades require
    explicit review and compatibility validation; automatic upgrades are out of scope.
26. **Out of scope — constitution ratification date (finding 26):** Formal governance
    adoption timing is administrative and does not block this prototype; the separate
    constitution TODO remains pending sponsor confirmation.
27. **Out of scope — Spec Kit active-feature migration:** `spec/specification.md` is
    the requested authoritative project specification. The repository's active
    Spec Kit feature remains `specs/001-task-tracker`; changing or migrating that
    workflow configuration is outside this prototype specification task. Do not run
    Spec Kit feature commands against this specification until the path mismatch is
    deliberately migrated.

### Explicitly Out of Scope

- Application login, multiple users, roles, tenancy, and shared connections.
- Atlassian Data Center and authentication methods other than the selected Atlassian
  Cloud OAuth 2.0 connection.
- Automatic classification or inference of report facts from Jira status.
- Automatic prose generation, silent truncation, or automated rewriting of facts.
- Confluence deletion when a local report is deleted.
- Updating unrelated existing Confluence pages, production hosting, uptime guarantees,
  automated backup/disaster recovery, organizational administration, localization,
  mobile-specific optimization, formal accessibility certification, and automated
  dependency upgrades, bulk import/export, operational metrics, distributed tracing,
  named regulatory compliance, and organizational records-retention compliance.
- Migrating the repository's Spec Kit active-feature configuration from
  `specs/001-task-tracker` to the requested `spec/` document.

## Commit History
0037b01 feat: implement weekly Atlassian status reporting

Historical project commits in the original parent repository before this checkout was isolated (command: `git -C /Users/rahul_amin log --oneline -- work/module-08-app`):

e819d95 chore: configure backend package scripts
a871c94 docs: add weekly status automation specification
8de0fad chore: project skeleton for prototype

## Commit Count
1

## Project Files
.dockerignore
.env.example
.github/skills/speckit-analyze/SKILL.md
.github/skills/speckit-checklist/SKILL.md
.github/skills/speckit-clarify/SKILL.md
.github/skills/speckit-constitution/SKILL.md
.github/skills/speckit-converge/SKILL.md
.github/skills/speckit-implement/SKILL.md
.github/skills/speckit-plan/SKILL.md
.github/skills/speckit-specify/SKILL.md
.github/skills/speckit-tasks/SKILL.md
.github/skills/speckit-taskstoissues/SKILL.md
.gitignore
.specify/.gitignore
.specify/init-options.json
.specify/integration.json
.specify/integrations/copilot.manifest.json
.specify/integrations/speckit.manifest.json
.specify/memory/.constitution-template.json
.specify/memory/constitution.md
.specify/scripts/bash/check-prerequisites.sh
.specify/scripts/bash/common.sh
.specify/scripts/bash/create-new-feature.sh
.specify/scripts/bash/resolve-template.sh
.specify/scripts/bash/setup-plan.sh
.specify/scripts/bash/setup-tasks.sh
.specify/templates/checklist-template.md
.specify/templates/constitution-template.md
.specify/templates/plan-template.md
.specify/templates/spec-template.md
.specify/templates/tasks-template.md
.specify/workflows/speckit/workflow.yml
.specify/workflows/workflow-registry.json
README.md
backend/.env.example
backend/package-lock.json
backend/package.json
backend/src/config.js
backend/src/db/migrate.js
backend/src/db/migrations/001-initial-schema.sql
backend/src/db/migrations/002-connection-account-display.sql
backend/src/db/migrations/003-report-item-order.sql
backend/src/db/migrations/004-connection-site-url.sql
backend/src/db/migrations/005-confluence-page-title.sql
backend/src/db/pool.js
backend/src/db/token-encryption.js
backend/src/integrations/atlassian-http.js
backend/src/integrations/atlassian-oauth.js
backend/src/integrations/confluence-client.js
backend/src/integrations/jira-client.js
backend/src/middleware/.gitkeep
backend/src/middleware/error-handler.js
backend/src/middleware/local-origin.js
backend/src/middleware/pagination.js
backend/src/middleware/validate-request.js
backend/src/routes/.gitkeep
backend/src/routes/api-routes.js
backend/src/routes/atlassian-routes.js
backend/src/routes/confluence-routes.js
backend/src/routes/jira-routes.js
backend/src/routes/publication-routes.js
backend/src/routes/report-routes.js
backend/src/server.js
backend/src/services/confluence-destination-service.js
backend/src/services/connection-service.js
backend/src/services/jira-service.js
backend/src/services/publication-service.js
backend/src/services/report-renderer.js
backend/src/services/report-service.js
backend/src/services/report-validation.js
backend/tests/config.test.js
backend/tests/db/migrations.test.js
backend/tests/db/publication-workflow.test.js
backend/tests/db/report-lifecycle.test.js
backend/tests/db/report-workflow.test.js
backend/tests/integrations/atlassian-http.test.js
backend/tests/integrations/confluence-client.test.js
backend/tests/middleware/local-origin.test.js
backend/tests/middleware/pagination.test.js
backend/tests/middleware/validate-request.test.js
backend/tests/routes/atlassian-routes.test.js
backend/tests/routes/confluence-routes.test.js
backend/tests/routes/jira-routes.test.js
backend/tests/routes/publication-routes.test.js
backend/tests/routes/report-routes.test.js
backend/tests/routes/report-update.test.js
backend/tests/security/oauth-crypto.test.js
backend/tests/server.test.js
backend/tests/services/confluence-destination-service.test.js
backend/tests/services/connection-service.test.js
backend/tests/services/jira-service.test.js
backend/tests/services/publication-service.test.js
backend/tests/services/report-renderer.test.js
backend/tests/services/report-service.test.js
docker-compose.yml
frontend/index.html
frontend/package-lock.json
frontend/package.json
frontend/src/App.jsx
frontend/src/components/.gitkeep
frontend/src/components/AppLayout.jsx
frontend/src/components/JiraCandidateList.jsx
frontend/src/components/ManualUpdateForm.jsx
frontend/src/components/PageHeading.jsx
frontend/src/components/PageState.jsx
frontend/src/components/ReportItemEditor.jsx
frontend/src/components/StepList.jsx
frontend/src/main.jsx
frontend/src/pages/.gitkeep
frontend/src/pages/AtlassianConnectionPage.jsx
frontend/src/pages/CreateReportPage.jsx
frontend/src/pages/NotFoundPage.jsx
frontend/src/pages/PublishReportPage.jsx
frontend/src/pages/ReviewReportPage.jsx
frontend/src/pages/WeeklyReportsPage.jsx
frontend/src/services/api-client.js
frontend/src/styles.css
frontend/tests/App.test.js
frontend/tests/CreateReportPage.test.js
frontend/tests/api-client.test.js
frontend/vite.config.js
spec/analyze.md
spec/checklist.md
spec/checklists/requirements.md
spec/clarify.md
spec/constitution.md
spec/contracts/api.md
spec/data-model.md
spec/plan.md
spec/quickstart.md
spec/research.md
spec/specification.md
spec/tasks.md
