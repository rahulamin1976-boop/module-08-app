# Module 18 Completion Report

## Target Application
- URL: http://127.0.0.1:5173 (localhost:5173; backend API proxied to localhost:3001)

## QA Findings
| # | Category | Finding | Severity | MCP Tool Used |
|---|----------|---------|----------|---------------|
| 1 | Network / console error | `POST /api/v1/integrations/atlassian/oauth/start` returned 503 (reqid=67) when "Connect Atlassian" was clicked, with console error "Failed to load resource: the server responded with a status of 503 (Service Unavailable)". Cause: Atlassian OAuth client ID and secret are not configured. | High | list_network_requests |
| 2 | Accessibility | Lighthouse `color-contrast` audit failed on 17 nodes on `/reports/new`, for example the sidebar "WORKSPACE" heading (2.56:1) and the "Atlassian automation" text (3.97:1). Expected 4.5:1. Accessibility score 96. | Medium | lighthouse_audit |
| 3 | Network / console error | `GET /favicon.ico` returned 404 (reqid=32) on the home page, with console error "Failed to load resource: the server responded with a status of 404 (Not Found)". | Low | list_console_messages |
| 4 | SEO | Lighthouse `meta-description` audit failed (no meta description) and `robots-txt` audit failed (invalid, 18 errors). SEO score 60. | Low | lighthouse_audit |
| 5 | Form / UX | On `/reports/new`, "Save draft" stays disabled and the Jira project dropdown is disabled after filling Category, Update text and Owner, because Atlassian is not connected. The form cannot be submitted. | Medium | fill_form |

## MCP Tools Used
- new_page
- navigate_page
- take_snapshot
- take_screenshot
- click
- fill_form
- list_console_messages
- list_network_requests
- lighthouse_audit
