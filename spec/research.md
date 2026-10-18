# Research: Atlassian Weekly Status Automation

## Decisions

### Canonical report representation

- **Decision**: Persist structured report items, Jira snapshots, provenance, warnings,
  confirmed-empty categories, lifecycle metadata, and version in PostgreSQL. Derive
  Markdown and published content from the structured model.
- **Rationale**: One authoritative representation avoids synchronization errors
  between editable text and source attribution. Use a transactional version
  compare-and-swap for edits and write the audit event in the same transaction.
- **Alternatives considered**: Store only rendered Markdown (loses field-level source
  evidence); store both Markdown and items as independently editable data (allows
  contradictory representations).

### Local application boundary

- **Decision**: Bind application services to loopback, route frontend `/api` requests
  through a same-origin development proxy, and validate Host/Origin plus same-origin
  state-changing requests on the backend. Keep PostgreSQL unavailable to other
  network users.
- **Rationale**: Separate development ports can otherwise create cross-origin
  behavior that conflicts with the spec's local-only boundary.
- **Alternatives considered**: Permissive CORS (weakens the same-origin rule); expose
  the database on a public interface (unnecessary for local development).

### OAuth lifecycle

- **Decision**: Keep authorization-code handling and tokens on the backend; enforce
  session-bound, single-use, short-lived OAuth state; encrypt credentials using
  configuration outside the repository/database; serialize refresh-token rotation
  per connection and atomically persist replacements.
- **Rationale**: OAuth state prevents callback forgery, and serialized refresh avoids
  racing rotated credentials.
- **Alternatives considered**: Browser-held tokens (exposes credentials); concurrent
  refresh attempts (can invalidate a rotated token); storing encryption keys beside
  ciphertext (does not protect credentials at rest).
- **Implementation prerequisite**: Verify the registered callback URI, exact scope
  identifiers, connected account discovery, and test-site access before live OAuth
  acceptance tests.

### Jira evidence capture

- **Decision**: Query candidates by selected project and inclusive report period using
  the selected IANA timezone, request only required fields, paginate/deduplicate by
  issue ID, and persist a snapshot for each selected issue.
- **Rationale**: The saved report must remain explainable even if Jira later changes.
- **Alternatives considered**: Re-query Jira whenever a draft is viewed (changes
  evidence without user intent); infer report category from issue status (not reliable
  evidence of accomplishments, blockers, or plans).

### Confluence publication recovery

- **Decision**: Persist a publication intent before calling Confluence, use the report
  UUID as stable identity, and reconcile uncertain outcomes before retrying. Store the
  UUID as a Confluence content property after page creation. If the UUID property is
  not found after an uncertain create, compare the selected parent/title and surface
  ambiguity rather than blindly creating another page or overwriting unrelated content.
- **Rationale**: Page creation and content-property storage are separate operations,
  so a lost response can occur between them.
- **Alternatives considered**: Blindly retry create (can duplicate pages); update by
  title alone (can overwrite unrelated content); claim at-most-once publication
  without reconciliation (cannot recover uncertain responses).
- **Implementation prerequisite**: Validate the live page-create/property API sequence
  and failure behavior against the designated test site.

## Validation and Milestone Dependencies

1. Register OAuth app and test callback, scopes, account identity, and test-site
   permissions.
2. Establish database and API contracts, lifecycle constraints, and atomic optimistic
   updates.
3. Verify same-origin development proxy, loopback binding, OAuth state, encryption,
   refresh rotation, and redaction with local tests.
4. Verify Jira timezone boundaries, pagination, source failure, and snapshot handling
   with repeatable provider mocks.
5. Verify Confluence uncertain-create recovery and title collisions with mocks and,
   where available, live integration tests.
6. Complete UI/end-to-end, 20-line report format, empty/warning persistence, and
   accessibility acceptance scenarios.
