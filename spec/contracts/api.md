# API Contract Summary

The normative endpoint and request/response requirements are in the **API Contract**
section of [specification.md](../specification.md). This summary identifies the
contract surface for implementation and testing; it does not replace the spec.

## Base behavior

- JSON API under `/api/v1`; bound to loopback and accessed same-origin.
- Errors use `{ "error": { "code": "string", "message": "string" } }`; responses
  never include secrets, authorization codes, or full report text in error messages.
- Exact request schemas reject unknown fields. Dates are ISO `YYYY-MM-DD`; timestamps
  are RFC 3339 UTC.
- Lists return `{ "items": [], "nextCursor": null }` or an opaque cursor. Default
  page size is 50; maximum is 100.
- Status codes include 400 validation, 401 missing/expired authorization, 403
  insufficient provider capability, 404 missing resource, 409 conflict/stale version,
  429 provider rate limit with `Retry-After`, and 503 temporary provider outage.
- Upstream operations have a 15-second deadline and at most two retries for transient
  failures/rate limiting, honoring `Retry-After`; authorization and validation errors
  are not retried.

## Routes

| Method | Route | Contract purpose |
|---|---|---|
| GET | `/integrations/atlassian` | Connection state/account display; never returns credentials. |
| POST | `/integrations/atlassian/oauth/start` | Start OAuth with server-side one-time session-bound state; require account-switch confirmation where applicable. |
| GET | `/integrations/atlassian/oauth/callback` | Validate callback, persist encrypted credentials, redirect with non-sensitive outcome. |
| DELETE | `/integrations/atlassian` | Revoke/remove local credentials; disclose unconfirmed provider revocation. |
| GET | `/jira/projects` | Search projects with cursor pagination. |
| GET | `/jira/projects/{projectId}/updates` | Query candidates by inclusive date range/timezone with cursor pagination. |
| GET | `/confluence/spaces` | Search destination spaces. |
| GET | `/confluence/spaces/{spaceId}/pages` | Search candidate parent pages. |
| GET | `/reports` | List report summaries with optional filters and cursor. |
| POST | `/reports` | Create draft from refetched selected Jira facts and manual facts. |
| GET | `/reports/{reportId}` | Read metadata, items, sections, warnings, version, and publication status. |
| PATCH | `/reports/{reportId}` | Version-checked draft edit; reject stale or non-draft updates. |
| DELETE | `/reports/{reportId}` | Explicitly confirm local deletion; preserve remote Confluence content. |
| POST | `/reports/{reportId}/approve` | Explicitly approve a complete draft and record actor/time. |
| POST | `/reports/{reportId}/withdraw-approval` | Return an approved report to draft and clear current approval metadata. |
| POST | `/reports/{reportId}/publish` | Publish only an approved report; reconcile by stable report UUID; return confirmed page reference. |

## Contract test requirements

- Validate success and failure schemas, unknown-field rejection, limits, pagination,
  and OAuth disconnected/callback states.
- Assert stale versions return 409 and do not overwrite data.
- Assert failed/uncertain provider writes never produce success-shaped API responses.
- Assert local deletion has no remote delete side effect.
- Assert publication retry reconciles the report UUID and does not duplicate or
  overwrite unrelated pages.
