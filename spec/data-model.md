# Data Model: Atlassian Weekly Status Automation

PostgreSQL 15 is the persistent store. Structured report items are canonical; rendered
Markdown and Confluence page content are derived. Foreign keys, required fields,
unique constraints, and allowed values below are implementation requirements from
[specification.md](./specification.md).

## Entities

### Project

- `id`: UUID primary key.
- `jira_project_id`: required unique Jira identifier.
- `jira_project_key`: required Jira key.
- `name`: required display name.
- `last_synced_at`: nullable timestamp of most recent successful refresh.
- `created_at`, `updated_at`: timestamps.
- Relationship: one project has many status reports.

### Atlassian connection

- `id`: UUID primary key; `provider`: initially `atlassian_cloud`.
- `cloud_id`, `account_id`: required site and connected account identifiers.
- `site_url`: required HTTPS URL for constructing user-facing Jira issue links.
- `account_display_name`: required non-secret display name shown for the connected actor.
- `access_token_ciphertext`, `refresh_token_ciphertext`: encrypted credentials only.
- `encryption_key_reference`: reference to configuration-provided key, never key
  material.
- `expires_at`, `scopes`, `created_at`, `updated_at`.
- Prototype constraint: one active connection. A different account cannot inherit
  existing report ownership without explicit confirmation; existing reports are not
  reassigned.

### Status report

- `id`: UUID primary key and stable publication identity.
- `project_id`: required foreign key to Project.
- `created_by_account_id`: required creator account.
- `approved_by_account_id`, `last_edited_by_account_id`: nullable actor identifiers.
- `period_start`, `period_end`: inclusive dates with `period_start <= period_end`.
- `timezone`: required IANA timezone.
- `status`: `draft`, `approved`, `publishing`, or `published`.
- `version`: positive optimistic concurrency version, incremented on successful edit.
- `source_snapshot`: retrieval window and selected Jira evidence; no credentials.
- `confirmed_empty_categories`: subset of `accomplishment`, `blocker`, `next_week`.
- `warnings`: persisted non-sensitive source/data warnings.
- `confluence_idempotency_key`: unique stable UUID derived from report ID.
- `confluence_parent_page_id`, `confluence_space_id`: destination metadata.
- `confluence_page_title`: confirmed destination title, including any user-approved
  disambiguating suffix.
- `confluence_page_id`, `confluence_page_url`: set only after confirmed publication.
- `approved_at`, `published_at`, `created_at`, `updated_at`.
- Uniqueness: duplicate project/period reports are permitted.

### Report item

- `id`: UUID primary key; `report_id`: required foreign key, cascade-deleted with report.
- `category`: `accomplishment`, `blocker`, or `next_week`.
- `position`: non-negative order within the report category.
- `text`: required 1–2,000 characters after trimming for manual items.
- `source_type`: `jira`, `manual`, or `user_edited`.
- `source_reference`: Jira issue key/URL or null for manual source.
- `source_snapshot`: immutable selected Jira facts or null for manual source.
- `edited_by_account_id`, `owner`, `source_updated_at`, `created_at`, `updated_at`.
- Relationship: each report has ordered report items, grouped by category.

### Report audit event

- `id`: UUID primary key; `report_id`: required foreign key and cascade deletion.
- `actor_account_id`, `action`, `occurred_at`: required actor/action/time.
- `details`: non-sensitive metadata only; no tokens or full report body.
- Actions include creation, edit, approval, approval withdrawal, publication start,
  publication success/failure, and deletion.

## Lifecycle

```text
draft -> approved -> publishing -> published
  ^         |             |
  |         |             +-> approved (recoverable failure)
  +---------+ (approval withdrawal)
```

- Only drafts may be edited; a user withdraws approval before editing an approved
  report. Published reports are immutable.
- `draft`: no approval/publication timestamps.
- `approved`: approver and approval timestamp are present.
- `publishing`: approval and destination are present.
- `published`: page ID, page URL, approver, approval timestamp, and publication
  timestamp are present.
- Stale writes fail with HTTP 409; report update, version increment, and audit event
  are committed atomically.
- Confirmed-empty categories require successful Jira retrieval and no item in that
  category. Source-failure warnings persist; failed retrieval is never an empty result.
- Deleting a report cascades local items and audit events but does not delete a remote
  Confluence page.

## Core validation

- Dates are valid ISO calendar dates, ordered, and interpreted inclusively in the
  stored IANA timezone.
- Project/space search text is 1–100 characters; owner is at most 120 characters;
  title is 1–255 characters.
- Report output is generated from canonical facts, has exactly three required
  sections, and is blocked from approval/publication if it exceeds 20 lines or has an
  unconfirmed empty category.
- Database fields and precise API validation are aligned with the authoritative
  specification; use migrations to enforce persistence-level invariants where
  expressible.
