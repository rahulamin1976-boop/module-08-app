# Task and Artifact Analysis

**Scope**: Read-only assessment of [specification.md](./specification.md),
[plan.md](./plan.md), and [tasks.md](./tasks.md), using the project constitution,
[data-model.md](./data-model.md), and [API contract](./contracts/api.md) as supporting
context.

**Method note**: The Spec Kit prerequisite script was run once but failed because the
active feature still resolves to `specs/001-task-tracker`, whose plan is absent. The
requested artifacts under `spec/` were analyzed directly. No analyzed source artifact
was changed.

## Summary

The task list follows the four implementation phases and groups feature work under
US1–US3. All 41 tasks have titles, descriptions, acceptance criteria, and dependencies;
the listed dependency IDs exist. The highest risks are the unresolved contract for
Confluence recovery when page creation succeeds but storing its UUID property fails,
missing ordering for canonical report items, ambiguous ownership of Jira project
routes, and gaps in test/runtime packaging and acceptance-result recording.

**Overall assessment**: Useful implementation breakdown, but address the High findings
below before treating the tasks as implementation-ready. The project-local Spec Kit
active-feature mismatch also means future automated Spec Kit commands may target the
wrong feature.

## Findings

| ID | Category | Severity | Location(s) | Finding | Recommendation |
|---|---|---|---|---|---|
| A1 | Inconsistency | High | `.specify/scripts/bash/check-prerequisites.sh`; `spec/plan.md`; `spec/tasks.md` | Spec Kit resolves to `specs/001-task-tracker`, not the authoritative artifacts in `spec/`. The analyze prerequisite failed because the active feature plan is missing. | Deliberately migrate/configure the active feature before relying on automated Spec Kit task/analyze/implement commands. |
| A2 | Data model gap | High | `spec/specification.md` FR-024; `spec/data-model.md` Report item; T005, T018, T026 | Report items are canonical and must render in a stable order, but the data model has no ordering field or explicit order rule. Database/query ordering could therefore change report content. | Add an item position/order rule to the specification and data model, then require persistence and ordering tests in T005/T018/T026. |
| A3 | Integration recovery gap | High | `spec/specification.md` FR-026/FR-050; `spec/research.md` Confluence recovery; T016, T032, T035, T038 | Page creation and UUID-property storage are separate operations. If page creation succeeds but the property write or response is lost, UUID lookup alone cannot prove whether the page exists. T032 does not specify how to resolve this missing-property case while preserving the no-duplicate guarantee. | Define a deterministic reconciliation rule using the selected parent and exact title plus content verification, or specify an explicit ambiguous outcome that prevents blind retry. Test the property-write failure separately. |
| A4 | Task ownership ambiguity | Medium | `spec/contracts/api.md` routes; T017, T019 | `GET /jira/projects` is the documented route, while T017 assigns project search to `jira-routes.js` and T019 assigns project lookup to `project-routes.js`. These tasks can create duplicate or competing route implementations. | Assign all `/jira/projects` endpoints to one route module/service and make the other task explicitly report-only. |
| A5 | Missing implementation slice | High | `spec/plan.md` same-origin risk; `spec/tasks.md` T009/T036; `spec/quickstart.md` startup | The plan requires a same-origin local entry point for normal use as well as the Vite development proxy. Tasks configure the dev proxy but do not implement how a built frontend is served with the API in local use. | Add a packaging/production-local serving task and acceptance test for built frontend + API on one loopback origin. |
| A6 | Missing integration task | High | `spec/specification.md` FR-028; `spec/tasks.md` T016/T032/T035; `spec/research.md` Confluence publication | T016 only implements Jira and Confluence *read* adapters, while T032 requires child-page creation and content-property read/write operations. There is no explicit Confluence body conversion task or preservation test for Markdown headings, bullets, and links. | Split/extend the Confluence adapter task to include create/read-property operations and add a Markdown-to-Confluence converter plus contract tests for preserved structure and links. |
| A7 | Coverage weakness | Medium | `spec/specification.md` FR-032/FR-005/FR-006; T026/T028 | Rendering acceptance verifies section order, bullets, line count, and empty categories, but does not explicitly verify `Risk:` labeling, mapping mitigations/support requests to Next week, or labeling missing/unassessed facts without invention. | Add those exact behavior assertions to T026 and renderer tests in T028. |
| A8 | Coverage weakness | Medium | `spec/specification.md` SC-003/SC-006; T027/T028/T034/T041 | No task explicitly verifies missing required details are rendered as unavailable/not provided/not assessed (SC-003), or that project, period, and approval/publication state remain identifiable in the saved view/page title plus app metadata (SC-006). | Add testable assertions to review and publication UI tests, and include both criteria in T041's recorded results. |
| A9 | Tooling ambiguity | Medium | `spec/plan.md` Technical Context; T001, T007, T008, T013, T036, T039 | Backend tests allow “Node test runner or repository-standard runner”; frontend acceptance assumes component, accessibility, and E2E tooling, but no concrete test runner/browser automation/accessibility tool is selected or installed by a task. | Choose the repository-supported test stack before T007/T013; add explicit dependency/configuration tasks for frontend unit, E2E, and accessibility tooling, or narrow criteria to available tooling. |
| A10 | Audit/lifecycle omission | Medium | `spec/specification.md` FR-020/FR-054; T029/T032/T033 | Audit events need actor/action/time for every publication attempt and report edit, but report deletion cascades audit history and T029 describes actors/timestamps without explicitly requiring a deletion event before cascade. | Specify and test the deletion audit event's intended behavior (record transactionally before removal, understanding it is removed with the report) or omit the unreachable event from the action enum. |
| A11 | Acceptance artifact gap | Medium | `spec/plan.md` Phase 4; `spec/tasks.md` T041; `spec/quickstart.md` | T041 says “record pass/fail” but provides no durable results file/path. The quickstart describes scenarios, not a results record. | Name a tracked or deliberately non-tracked validation-results artifact and update T041's output criteria accordingly. |
| A12 | Task boundary / UI gap | Medium | `spec/specification.md` FR-039/FR-047 and Weekly Reports screen; T034 | Delete is a report-list action in the product model, but T034 assigns delete confirmation to Review/Publish pages and does not name the Weekly Reports UI. A user may have no obvious delete entry point. | Specify the delete action's screen/location and include `WeeklyReportsPage.jsx` and its tests in T034/T035. |
| A13 | External dependency risk | Medium | `spec/plan.md` Key Dependencies; T014–T016, T031–T032 | OAuth app registration, exact scopes, callback URI, test site, and parent-page permissions are external prerequisites, but there is no explicit readiness gate/task to validate them before implementation depends on live flows. | Add a preflight task/checklist with owner, evidence, and a mock-only continuation path if external setup is delayed. |
| A14 | Data security detail | Low | `spec/tasks.md` T014; `spec/constitution.md` module responsibilities | Token encryption is placed at `backend/src/db/token-encryption.js`; the constitution says database modules own persistence and integrations own provider communication. Encryption is cross-cutting security logic rather than persistence itself. | Put the encryption helper in a security/crypto module or state why it belongs under `db/`; keep DB persistence responsible only for ciphertext storage. |
| A15 | Test scope precision | Low | `spec/specification.md` SC-007; T035/T038/T041 | T041 includes 100 retry scenarios, but the detailed test tasks do not explicitly pin the exact count, deterministic fixture, or definition of a completed retry scenario. | Specify the repeatable harness and assert exactly 100 uncertain-response runs produce exactly one page per report. |

## Task-by-Task Complexity, Risk, and Dependencies

Complexity estimates reflect implementation uncertainty and integration surface:
**Low** (localized/configuration), **Medium** (multiple components or behavior),
**High** (security, lifecycle, external-system recovery, or cross-layer state).

| Task | Complexity | Main risk | Dependencies |
|---|---|---|---|
| T001 | Medium | Runtime/package versions or scripts conflict with existing manifests. | None |
| T002 | Low | Compose port binding or health check exposes/misreports database availability. | None |
| T003 | Medium | Required environment settings may be incomplete; binding/secret logging must be correct. | T001 |
| T004 | Medium | Migration runner, connection lifecycle, and test DB config need coordination. | T002, T003 |
| T005 | High | Lifecycle constraints, cascades, and required fields must match the final model; item order is missing. | T004 |
| T006 | High | Broad middleware responsibility risks inconsistent validation and overly permissive origin checks. | T001, T003 |
| T007 | Medium | Requires stable DB/test setup; tests can become brittle if middleware contracts remain unsettled. | T004, T005, T006 |
| T008 | Medium | Frontend test tooling and exact versions are not fully selected. | None |
| T009 | Medium | Proxy must remain same-origin without weakening the loopback/Host/Origin model. | T008 |
| T010 | Medium | API client errors must preserve HTTP/status details without leaking provider data. | T008 |
| T011 | Medium | Route package and final URL conventions are not specified. | T008 |
| T012 | Medium | Multiple page shells touch many files and may diverge from the spec's screen states. | T011 |
| T013 | Medium | Test runner/tooling and accessibility assertions are not defined. | T009, T010, T011, T012 |
| T014 | High | OAuth state, encryption key provisioning, refresh rotation, and account replacement are security-sensitive. | T003, T004, T005, T006 |
| T015 | Medium | Callback/disconnect behavior depends on OAuth service and provider revocation semantics. | T006, T014 |
| T016 | High | Retry policy can duplicate non-idempotent writes if later reused; currently only read operations are explicit. | T003, T006 |
| T017 | High | Timezone boundary conversion, provider query semantics, pagination, and deduplication are easy to get wrong. | T006, T016 |
| T018 | High | Jira refetch races, provenance integrity, manual fallback, and transactional persistence interact. | T005, T014, T017 |
| T019 | Medium | Route ownership overlaps T017 for Jira project search; schema requirements are broad. | T006, T018 |
| T020 | Medium | Candidate selection/category UX must handle paging, failures, and timezone consistently. | T009, T010, T012, T017 |
| T021 | Medium | Form limits and persisted warning behavior must match backend contracts. | T010, T020 |
| T022 | Medium | Provider fixtures must accurately model date windows, failures, and snapshots. | T017, T018, T019 |
| T023 | Medium | UI tests depend on a selected test runner and realistic API-state fixtures. | T020, T021 |
| T024 | High | Compare-and-swap edits, audit insertion, and item changes must be atomic. | T018, T019 |
| T025 | Medium | Nested schema validation and ownership checks may drift from the API contract. | T006, T019, T024 |
| T026 | High | Renderer must enforce format, semantics, line count, empty/failure distinction, and completeness. | T018 |
| T027 | High | Provenance-safe editing and conflict recovery involve nuanced client state. | T010, T012, T025, T026 |
| T028 | Medium | Coverage spans DB, service, API, renderer, and UI; test data should remain consistent. | T024, T025, T026, T027 |
| T029 | High | Approval and deletion transitions must maintain lifecycle invariants and audit semantics. | T018, T024, T026 |
| T030 | Medium | Confirmation and status-code behavior must match service transitions exactly. | T025, T029 |
| T031 | Medium | Title collision handling and destination pagination depend on provider capabilities. | T006, T016 |
| T032 | High | Multi-call Confluence create/property/reconcile workflow has uncertain outcomes. | T016, T029, T031 |
| T033 | Medium | Endpoint must distinguish confirmed success from uncertain provider outcome. | T030, T032 |
| T034 | Medium | Approval/delete/destination/publish UI combines several stateful screens; delete location is unclear. | T027, T030, T031, T033 |
| T035 | High | Must simulate uncertain provider behavior and prove idempotency, not just happy path. | T029, T030, T031, T032, T033, T034 |
| T036 | High | End-to-end test needs complete stack, browser tooling, stable mocks, and isolation. | T023, T028, T035 |
| T037 | High | Security tests must be meaningful and avoid asserting implementation details only. | T014, T015 |
| T038 | High | Timeouts, retries, and provider failure sequences are timing-sensitive; deterministic clocks needed. | T016, T032, T033 |
| T039 | High | WCAG 2.2 AA validation requires chosen tooling plus manual assistive-technology checks. | T015, T023, T028, T034 |
| T040 | Low | Setup instructions may become stale unless tested against clean-checkout commands. | T001, T002, T004, T008, T036, T038 |
| T041 | Medium | Acceptance record lacks a named output artifact; 100-run/latency checks need repeatable harnesses. | T036, T037, T038, T039, T040 |

## Requirement and Success-Criterion Coverage

Every FR/SC is associated with at least one task by inference; rows marked **partial**
have a task reference but lack a complete, explicit acceptance assertion.

| Requirement(s) | Task coverage | Assessment |
|---|---|---|
| FR-001–FR-004 | T017–T021, T026 | Partial: FR-004's risk/support mapping needs explicit tests (A7). |
| FR-005–FR-007 | T018, T026, T028 | Partial: unavailable/not-assessed labels and no-invention need explicit test assertions (A7/A8). |
| FR-008–FR-010 | T024–T028, T034, T036 | Covered; loading/failure feedback is present in shell tasks, with deeper end-to-end coverage. |
| FR-011–FR-018 | T026, T029–T035, T039 | Partial: Confluence Markdown conversion/preservation is not assigned (A6). |
| FR-019–FR-021 | T003, T006, T014–T015, T037 | Covered, subject to local built-app serving gap (A5). |
| FR-022–FR-024 | T017–T018, T024–T028 | Partial: canonical ordering is undefined in the model (A2). |
| FR-025–FR-028 | T031–T035 | Partial: retry recovery/content conversion needs explicit implementation (A3/A6). |
| FR-029–FR-030 | T014–T016, T037 | Partial: external OAuth setup is a dependency but has no readiness task (A13). |
| FR-031–FR-033 | T018, T026–T028, T041 | Partial: semantic formatting assertions need expanding (A7). |
| FR-034, FR-039, FR-047 | T029–T030, T034–T035 | Partial: UI delete entry point is not assigned to report list (A12). |
| FR-035 | T024–T028, T036 | Covered. |
| FR-036–FR-037 | T006, T017, T019, T022, T025, T030, T033 | Partial: Jira project route ownership is ambiguous (A4). |
| FR-038 | T005, T029–T030, T032–T035 | Covered, pending database/lifecycle alignment. |
| FR-040 | T011–T013, T027, T034, T039 | Partial: automated/manual accessibility toolchain not specified (A9). |
| FR-041 | T018, T021–T023 | Covered. |
| FR-042 | T003, T006, T009, T037 | Partial: same-origin local production serving is not tasked (A5). |
| FR-043–FR-044 | T014–T015, T029, T031, T034 | Partial: actor display/permission inheritance should be asserted in integration tests. |
| FR-045–FR-046 | T006, T017–T018, T020–T021, T025, T031 | Covered for date/length validation; timezone/date boundary tests should remain mandatory. |
| FR-048 | T003, T014, T037 | Partial: encryption-key configuration/error behavior needs explicit acceptance tests. |
| FR-049–FR-050 | T031–T035, T038 | Partial: page property write failure recovery is unresolved (A3). |
| FR-051 | T006, T019, T025, T030, T033 | Partial: exact nested schemas and per-route responses need contract tests (A9). |
| FR-052 | T005, T029–T033 | Covered, with lifecycle constraints tested at DB and service layers. |
| FR-053–FR-055 | T014–T015, T024, T029, T032–T033, T037 | Partial: deletion audit behavior and provider revocation/refresh failure tests need clarity (A10). |
| FR-056–FR-057 | T018, T021–T023, T026–T028, T041 | Covered, provided persisted warning and empty-confirmation integration tests run. |
| SC-001–SC-006 | T022–T028, T034, T036, T041 | Partial: draft-time and identity/status criteria are not individually asserted (A8). |
| SC-007 | T035, T038, T041 | Partial: exactly 100 repetitions and one-page assertion need explicit test definition (A15). |
| SC-008–SC-010 | T024, T028, T036–T039, T041 | Covered, subject to selected browser/accessibility tooling. |
| SC-011–SC-012 | T016, T018, T022, T038, T041 | Partial: percentile measurement and exact repeated-case counts need a fixed harness. |
| SC-013–SC-015 | T026–T029, T036, T039, T041 | Partial: accessibility tooling and durable result artifact are unresolved (A9/A11). |

## Dependency and Parallelism Review

- **Critical path**: T001/T003 and T002 → T004 → T005 → US1 persistence and Jira
  retrieval → US2 editing/rendering → US3 approval/publication → T035/T036/T041.
- **Valid parallel work**: T001 with T002; frontend package/proxy/shell work after
  dependency setup; independent OAuth and Jira client modules after shared middleware;
  independent renderer and review UI after canonical item/API shapes are fixed.
- **Risky parallel work**: Do not parallelize T017 and T019 until project-search route
  ownership is resolved. Do not begin T032 against a read-only Confluence client.
  T027 cannot be independently testable before the report-read/update response shape is
  stable.
- **Dependency consistency**: All declared dependencies point to existing earlier
  tasks; no cycles or self-dependencies found. T008 is independent of backend setup as
  intended, but Phase 2 must not be represented as blocked on all Phase 1 tasks if only
  the UI shell is being built.

## Constitution Alignment

No direct violation of the project constitution is evident. The planned server-side
credential boundary, evidence-based report construction, explicit API validation,
attribution, and repeatable failure tests align with the principles. Risks requiring
attention:

- T032 must not weaken the principle that external writes are authorized, visible, and
  attributable.
- T003/T006/T009 and the missing local serving task must preserve loopback-only and
  same-origin protections in development and normal local use.
- The task plan should keep live Atlassian tests separate from deterministic local
  tests, as required by the constitution.

## Metrics

- **Functional requirements**: 57 (FR-001–FR-057)
- **Buildable success criteria**: 15 (SC-001–SC-015)
- **Tasks**: 41
- **Tasks by story**: US1 10; US2 5; US3 7; setup/cross-cutting 19
- **Coverage**: 72/72 buildable requirement and success-criterion IDs have at least
  one mapped task (100% mapped); 14 grouped rows above remain partial on explicit
  acceptance or integration details.
- **Complexity distribution**: Low 2; Medium 23; High 16.
- **High findings**: 5 (A1, A2, A3, A5, A6).
- **Ambiguity/underspecification findings**: 15 total; duplications: 0 confirmed;
  wording/ownership overlap is reported as ambiguity rather than duplicate behavior.

## Next Actions

1. Resolve A2, A3, A5, and A6 before implementing report rendering or publication.
2. Resolve A4 and A12 before splitting backend route and UI work across contributors.
3. Fix the active Spec Kit feature path before invoking `/speckit-tasks`,
   `/speckit-analyze`, or `/speckit-implement` against this project.
4. Add explicit acceptance assertions and test-tool selection for A7–A11 and A15.

No source tasks or plans were changed by this analysis.
