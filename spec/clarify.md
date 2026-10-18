# Senior Specification Review: Gaps, Contradictions, and Clarifications

**Reviewed**: 2026-10-18  
**Inputs**: [`constitution.md`](./constitution.md) and
[`specification.md`](./specification.md)  
**Scope**: Requirements/design review only. At the time of the initial review, neither
source file was modified.

## Executive Summary

The initial review below identified 26 gaps. Each now has an explicit answered or
out-of-scope disposition in [`specification.md`](./specification.md), including
security, data, API, lifecycle, and acceptance decisions. The disposition table below
is the current status; the detailed findings that follow are preserved as the review
record.

The separate Spec Kit active-feature mismatch remains explicitly out of scope for this
specification task. The active feature still resolves to `specs/001-task-tracker`, so
Spec Kit commands must not be assumed to operate on `spec/specification.md`.

## Resolution Status

| Finding | Disposition | Decision recorded in specification |
|---:|---|---|
| 1 | Answered | Single-user, local-only application; app-level authentication and roles are out of scope. |
| 2 | Answered | Connected account attribution and report audit events; not a tamper-proof compliance log. |
| 3 | Answered | Project/period in Confluence title; approval state is visible in the app only, not in the Confluence title/body. |
| 4 | Answered | Stable report identity and idempotent reconciliation prevent duplicate pages. |
| 5 | Answered | Backend refetches selected Jira issues and stores immutable source snapshots. |
| 6 | Answered | Structured items are canonical; material edits are marked user-edited and retain original provenance. |
| 7 | Answered | Explicit draft/approval/publication state transitions; published reports are immutable. |
| 8 | Answered | User-selected parent page, inherited permissions, collision conflict, and content conversion rules. |
| 9 | Answered | OAuth state binding/expiry, token encryption, refresh/revocation behavior, redaction, least privilege, and scope verification. |
| 10 | Answered | One local user and one connected Atlassian account; reconnection does not transfer ownership. |
| 11 | Answered | Local retention until explicit deletion; remote Confluence content is not deleted. |
| 12 | Answered | Inclusive dates in selected timezone, defaulting to site timezone then UTC. |
| 13 | Answered | Empty categories require explicit confirmation after successful Jira retrieval; confirmations and source warnings persist. |
| 14 | Answered | Risks use `Risk:` under Blockers; mitigations and support actions go under Next week. |
| 15 | Answered | Approval/publication blocked above 20 lines; no silent truncation or rewriting. |
| 16 | Answered | Endpoint schemas, errors, pagination, deadlines, retries, and bounds are specified. |
| 17 | Answered | Optimistic version checks reject stale concurrent-tab edits with HTTP 409. |
| 18 | Answered | Candidate selection, date window, deduplication, pagination, and user categorization are defined. |
| 19 | Answered | Actor, version, snapshots, report items, empty confirmations, warnings, publication identity, and audit fields are modeled. |
| 20 | Answered | Lifecycle states and required metadata invariants are explicit. |
| 21 | Answered | Core flows target WCAG 2.2 AA; formal third-party certification, localization, and mobile optimization are out of scope. |
| 22 | Out of scope | Production availability, backups, disaster recovery, telemetry, and production-scale targets; bounded upstream timeouts/retries remain specified. |
| 23 | Answered | Logs exclude secrets/report body; local retention and deletion behavior are explicit. |
| 24 | Answered | Measurable success criteria include repeatable acceptance tests and accessibility validation. |
| 25 | Answered | Constitution versions are baseline; dependency lockfiles and reviewed upgrades are required. |
| 26 | Out of scope | Ratification-date administration remains a sponsor TODO and does not block the prototype spec. |
| 27 | Out of scope | Spec Kit active-feature migration; `specs/001-task-tracker` remains active until deliberately migrated. |

## Critical Gaps and Contradictions

### 1. Application identity, authentication, and authorization are undefined

**Evidence**: The constitution names project managers and team leads, but the
specification does not define application sign-in, the number of supported users,
workspace tenancy, or which user may view, edit, approve, or publish a report.
Atlassian OAuth connects an Atlassian account; it does not by itself define the
application's own user session or report access policy.

**Impact**: API authorization, data ownership, UI flows, and the database ownership
model cannot be designed safely. If the application is reachable by multiple users,
one global connection and unscoped report endpoints could expose project updates and
reports across users or teams.

**Clarify**: Is this a single-user local tool or a multi-user application? If
multi-user, define sign-in, user/workspace boundaries, and roles for report creation,
editing, approval, and publication.

### 2. Attribution principle cannot be satisfied by the specified data model

**Evidence**: Constitution principle III requires actions that create or modify
Atlassian content to be visible and attributable by the user. `status_reports` stores
approval and publication timestamps but no actor identifiers; `report_items` also has
no creator/editor identity, and no audit/event entity is defined.

**Impact**: The system cannot prove who approved or published a Confluence page, or
who changed report content before publication. This conflicts with a stated
non-negotiable governance principle.

**Clarify**: Which actions require an audit trail, and should it record the
application user, Atlassian account, timestamp, action, and before/after values?

### 3. Shared report identity conflicts with the required three-section format

**Evidence**: FR-018 prohibits a standalone summary, reporting-period header, or any
section beyond Accomplishments, Blockers, and Next week. SC-006 nevertheless requires
users to identify the project, reporting period, and approval state from every saved
or shared report. The data model stores the period and state, but the Confluence
publication requirement does not specify that they appear in the page title or
metadata.

**Impact**: A published report may be separated from the application and become
ambiguous or appear unapproved. The acceptance criterion is not guaranteed by the
specified output format.

**Clarify**: May the Confluence page title or page properties carry the project,
period, and approval state outside the three-section report body? Define the exact
title/metadata rule, or revise SC-006/FR-018.

### 4. Publication retries have no deterministic duplicate-prevention contract

**Evidence**: An edge case says the application should avoid duplicate pages “or
clearly informs the user if duplicate prevention cannot be guaranteed.” The publish API
has no idempotency key or reconciliation behavior. The data model includes
`publishing` and `publish_failed`, but does not describe a timeout after Confluence
created the page and before the application received its response.

**Impact**: A retry may create multiple leadership pages, while the current
requirement permits either prevention or an unspecified warning. This is not a
deterministic acceptance test.

**Clarify**: Must publishing be idempotent? Define how the application detects an
already-created page and what happens after an uncertain timeout before retry.

### 5. Jira update input contract does not establish trusted source facts

**Evidence**: The update-candidate GET returns issue fields, but POST `/reports`
accepts `issueKey` and a user-selected category only. The spec does not say whether
the backend refetches and validates those issues before saving, or whether the client
can submit stale or altered content. `report_items.source_reference` preserves an
issue key/URL but not a defined immutable snapshot of the factual text shown in the
report.

**Impact**: The evidence-based reporting principle is difficult to verify later.
Client manipulation, issue changes after selection, or deleted issues may result in
untraceable report statements.

**Clarify**: On report creation, does the backend refetch selected Jira issues and
persist a source snapshot (summary, status, relevant dates, URL, retrieval time) for
the report? Define which Jira fields are considered evidence and how stale data is
handled.

### 6. Report content and source items can diverge

**Evidence**: `status_reports` stores three editable section strings while
`report_items` separately stores categorized facts. The spec does not define whether
the strings are generated from the items, whether users edit items or only rendered
text, or how a save synchronizes the two representations. The PATCH contract accepts
“section content and/or manual updates” without precedence rules.

**Impact**: The saved text may no longer match the source items or provenance, making
the claim that all facts are traceable unverifiable after editing.

**Clarify**: Which is authoritative after draft edits: structured report items or
section text? Define whether edits are stored as item-level changes, free-form text,
or both, and how changed text retains or loses provenance.

## High-Priority Ambiguities

### 7. Approval policy and lifecycle transitions are incomplete

**Evidence**: A user may review, edit, approve, and publish. The model permits only
drafts to be edited and stores `approved_at`, but does not define who approves,
whether the author may approve their own report, whether approval can be revoked, or
what happens if a draft is edited after approval. The retry transition from
`publish_failed` is also unspecified.

**Impact**: UI action availability, endpoint authorization, status constraints, and
tests cannot be derived consistently.

**Clarify**: Define allowed status transitions and the actor allowed at each
transition, including edits after approval, approval revocation, and retry after
publication failure.

### 8. Confluence publication details are insufficient

**Evidence**: The screen asks for a space and page title; the endpoint accepts
`confluenceSpaceId` and `pageTitle`; the data model persists space/page IDs and URL.
There is no rule for parent page, title collisions, page body representation,
formatting/conversion of Markdown, page updates versus create-only, or destination
permissions.

**Impact**: Different implementations can publish materially different pages, and
success/failure behavior is not fully testable.

**Clarify**: Define whether publication creates a child page or a top-level page,
whether an existing page can be updated, how Markdown is rendered in Confluence, and
how title collisions and insufficient space permissions are handled.

### 9. OAuth and credential-security requirements are not operationally complete

**Evidence**: The spec selects Atlassian Cloud OAuth 2.0, encrypted tokens, and
one-time state, but does not define credential-encryption key management, OAuth state
binding/expiry, callback errors, token refresh/revocation, or which OAuth scopes are
approved. “Scopes required by the workflow” is not a concrete allowlist.

**Impact**: The security principle cannot be validated, and token lifecycle and
connection recovery are unspecified.

**Clarify**: Specify the allowed OAuth scopes, state/session binding and expiry,
refresh/revocation behavior, and how encryption keys are provisioned and rotated.

### 10. “One active Atlassian connection” has no ownership boundary

**Evidence**: The model says the initial local installation has one active connection,
while the target users include multiple project managers and team leads. There is one
global-looking `integration_connections` entity and no user/workspace foreign key.

**Impact**: It is unclear whether all users share one Atlassian account or connect
their own account, and who owns reports when a connection is changed or disconnected.

**Clarify**: Confirm the single-user/local assumption or define per-user/per-workspace
connections and report ownership.

### 11. Report retention is both required and undecided

**Evidence**: The assumptions say retention is “limited to the minimum needed” until
a policy is decided. At the same time, the API lists reports and the data model
persists them; no deletion, expiry, archive, or retention behavior is specified.
Disconnecting Atlassian explicitly leaves reports in place.

**Impact**: Storage lifecycle, privacy expectations, user controls, and compliance
cannot be determined.

**Clarify**: Define whether reports persist indefinitely, expire after a period, or
can be deleted by their owner; specify whether deleting a report affects a published
Confluence page or source snapshots.

### 12. Reporting period and “next week” boundaries are unclear

**Evidence**: The source report describes a Monday–Friday period, while the feature
accepts arbitrary start/end dates and calls a section “Next week.” Date-only fields are
used, but no timezone, locale, inclusive-boundary, holiday, or week-start rule is
defined.

**Impact**: Jira items may be included or omitted inconsistently, especially around
date boundaries and non-Monday-starting reporting periods.

**Clarify**: Define whether periods default to Monday–Friday, whether endpoints are
inclusive, which timezone is used to select Jira updates, and whether “Next week”
means the immediately following calendar week or the next working week.

### 13. “Missing” and “empty” report section behavior is inconsistent

**Evidence**: Requirements say missing details are labelled unavailable and an empty
category states no items were reported. The supplied generation instructions require
a bullet for every empty section. No exact wording or distinction between “none
reported,” “source returned no items,” and “source failed” is prescribed.

**Impact**: A reader could interpret lack of data as confirmation that there are no
blockers or accomplishments.

**Clarify**: Specify exact empty-section text and separate confirmed-none, not-provided,
and failed-to-load states.

### 14. “Risks,” “blockers,” and “decisions/support” do not map cleanly to the chosen layout

**Evidence**: The original detailed report has separate risks/blockers and
decisions/support sections. The chosen output has only Accomplishments, Blockers, and
Next week. FR-004 merges risks into Blockers and says decisions may be included when
relevant, but does not explain where leadership support requests go.

**Impact**: Important risk or decision information may be omitted, or users may
misclassify risks as blockers.

**Clarify**: Define how risks, mitigations, leadership decisions, and support requests
map to the three sections and how they are labelled.

### 15. Report length policy may conflict with evidence preservation

**Evidence**: Reports must stay within 20 lines, while the system must not silently
drop facts. No behavior is specified when verified content exceeds the cap or which
content has priority.

**Impact**: The product cannot satisfy both constraints for large updates without a
defined summarization, selection, or blocking behavior.

**Clarify**: When a report exceeds 20 lines, should users select items to include,
should the system offer a clearly marked summary, or should it block publication until
the report is shortened?

### 16. API contracts are endpoint outlines, not complete contracts

**Evidence**: The endpoint table names high-level inputs and outputs, but most payloads
do not have schemas, required/optional fields, limits, sorting/pagination, or concrete
response examples. `GET /integrations/atlassian` is unspecified when disconnected;
OAuth callback response/error behavior is unspecified. A retryable error is required
without a defined HTTP status or retry guidance.

**Impact**: Frontend/backend contract tests and integration implementation may disagree.

**Clarify**: Specify request/response schemas and validation limits for every endpoint,
including disconnected state, OAuth callback failures, pagination, rate limiting
(including `429`), and retryable service outages.

### 17. Concurrency and stale-draft behavior are unspecified

**Evidence**: A report can be edited and approved, but there is no version field,
updated-at precondition, conflict response, or behavior for two tabs/users editing
simultaneously.

**Impact**: Later edits can overwrite earlier work, or a stale draft could be approved
and published without the user noticing.

**Clarify**: Is concurrent editing in scope? If so, define conflict detection and
resolution; otherwise state the single-editor constraint and reject stale updates.

### 18. Jira project and issue selection rules need detail

**Evidence**: The update-candidate endpoint accepts dates but does not define which
Jira issue events qualify, how projects are scoped, which statuses/issue types are
included, how pagination works, or how duplicates and changed issues are treated.

**Impact**: Candidate updates may be incomplete or irrelevant, and test fixtures
cannot establish expected results.

**Clarify**: Define the candidate-selection rule (for example, issues updated during
the period), any issue-type/status filters, pagination limits, and whether items
created during the period but not updated are included.

### 19. The database does not fully represent specified report metadata

**Evidence**: Reports are associated with a project and dates, but no report title,
author, approver identity, created-by identity, rendered Markdown, per-section warning
state, or stable idempotency key is defined. `source_snapshot` is JSONB without a
schema, while `report_items` also holds source references.

**Impact**: Several UI/API requirements depend on data that has no authoritative
persistent representation.

**Clarify**: Identify authoritative fields and retention needs for ownership,
approval/audit, rendered output, warnings, source snapshots, and publication retries.

### 20. Database status constraints are not specified as enforceable invariants

**Evidence**: `status` and `category` are described as allowed text values, but no
behavior is defined for invalid transitions, publication failure persistence, or
whether published reports are immutable. Nullable publication fields and timestamps
are not tied to status rules.

**Impact**: Invalid state combinations can be stored and surfaced as contradictory UI
states.

**Clarify**: Define invariants, such as which timestamps and Confluence identifiers
must be present for each status and which status transitions are allowed.

## Additional Quality and Scope Gaps

### 21. Accessibility, responsive behavior, and language support are absent

The constitution and screens do not state keyboard accessibility, screen-reader
support, minimum responsive viewport, or supported language/date formatting. These
affect acceptance for a browser-based user workflow.

**Clarify**: State the accessibility target and whether the first version is desktop-only
and English-only.

### 22. Operational expectations are not measurable

The spec defines a five-minute report-preparation goal but no availability target,
maximum Jira/Confluence response wait, retry/backoff limit, database backup/recovery
expectation, or supported local deployment environment.

**Impact**: “Retryable” and “temporary unavailability” cannot be verified consistently.

**Clarify**: Set user-visible timeout/retry behavior and local data recovery expectations;
state whether production availability is in scope.

### 23. Logging and privacy boundaries are incomplete

The spec prohibits credentials in logs but does not say whether report contents,
issue summaries, account identifiers, or OAuth callback parameters may be logged, nor
how long logs are retained.

**Impact**: The privacy posture for potentially sensitive project updates is unclear.

**Clarify**: Define permitted log fields, redaction rules, and retention for report and
integration activity.

### 24. Success criteria are partly non-measurable or method-free

SC-004 (“A user can review and correct a draft”) is a capability, not a measurable
threshold. SC-002 and SC-003 state 100% but define no representative dataset, sample
size, or evaluation procedure. SC-001 does not specify how the five-minute timing is
measured.

**Clarify**: Define a repeatable acceptance method and a concrete usability/performance
threshold for each criterion.

### 25. Constitution stack conventions are exact but lack version-change policy

The constitution pins React, Vite, Node, Express, PostgreSQL, and npm versions but does
not define whether these are exact runtime pins, initial baseline versions, or minimum
versions, nor how upgrades are approved. The stack is not duplicated in the
user-focused specification, which is reasonable, but version governance should remain
explicit in the implementation plan.

**Clarify**: Confirm whether versions are exact pins and specify the compatibility/update
policy, including how Vite and Node upgrades are reviewed.

### 26. Constitution contains an unresolved ratification placeholder

`constitution.md` retains `TODO(RATIFICATION_DATE)` despite its version being marked
ratified at 1.1.0. This is a governance placeholder, not a product behavior issue.

**Clarify**: Supply the formal adoption date or revise the governance wording so the
document is not represented as formally ratified before approval.

## Spec Kit Workflow Mismatch

The repository's `.specify/feature.json` points to `specs/001-task-tracker`, and the
prerequisite script resolves that directory as the active feature. This review was
explicitly requested for `spec/specification.md`. Running `/speckit-clarify`, `/speckit-plan`,
or downstream Spec Kit commands without changing the active feature path may operate on
the older Taskify draft rather than this Atlassian report specification.

**Required before using Spec Kit commands on this feature**: set the active feature
directory to `spec` only if the installed workflow supports a non-numbered directory,
or create/migrate the specification into a numbered `specs/` feature directory and
update `.specify/feature.json`.

## Cross-Document Consistency Check

| Constitution principle or convention | Specification evidence | Review |
|---|---|---|
| Reports use verified facts and expose missing information | Source items and missing-data warnings are required | Directionally aligned; source snapshots and edited-text provenance need definition (findings 5–6). |
| Atlassian actions are attributable to users | Approval/publish timestamps exist, actor fields do not | Not satisfied by the proposed model (finding 2). |
| Least-privilege access | OAuth scopes are described only as “needed” | No concrete scope allowlist or review gate (finding 9). |
| Integration failures are explicit | General error object and retryable failure behavior are stated | HTTP/retry contracts remain incomplete (finding 16). |
| API payloads are documented and validated | Endpoint summary and one create example are supplied | Partial: most endpoint schemas and bounds are absent (finding 16). |
| Stack and folder conventions | Defined in constitution | Consistent at a high level; version pin/update semantics remain unclear (finding 25). |

## Recommended Resolution Order

1. Resolve application user identity, authorization, connection ownership, and audit
   attribution (findings 1, 2, and 10).
2. Resolve report identity/format, source data snapshots, and source-to-text editing
   (findings 3, 5, and 6).
3. Define publication lifecycle, retry/idempotency, and Confluence page semantics
   (findings 4, 7, and 8).
4. Define retention, reporting-period rules, empty states, and risks/decisions mapping
   (findings 11–15).
5. Complete API schemas, concurrency, Jira selection, and database invariants
   (findings 16–20).
6. Set operational, accessibility, logging, measurement, and governance targets
   (findings 21–26).
