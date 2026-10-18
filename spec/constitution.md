<!--
Sync Impact Report
Version: 1.0.0 -> 1.1.0 (added project identity and concrete stack/repository standards)
Modified principles: none
Added sections: Project Identity, Technical Stack and Repository Conventions
Removed sections: none
Follow-up TODOs: confirm the formal ratification date
-->

# Atlassian Weekly Status Automation Constitution

## Project Identity

**Project name:** Atlassian Weekly Status Automation.

**Purpose:** Help project managers and team leads prepare accurate, concise weekly
leadership status reports from verified project information, communicate progress and
blockers, and reduce manual report preparation.

**Target users:** Project managers and team leads who collect project updates and report
progress, risks, decisions, and measures to leadership.

## Core Principles

### I. Specification Before Implementation
Every product change MUST have an approved, testable specification before implementation
begins. Ambiguities affecting user behavior, report content, data handling, or external
integrations MUST be resolved or recorded as explicit assumptions before planning.

### II. Evidence-Based Reporting
Reports MUST include only information supplied by the user or verified from an authorized
source. Missing dates, measures, owners, accomplishments, and blocker details MUST be
identified as unavailable rather than invented. Generated reports MUST distinguish
reported facts from unassessed status.

### III. Safe and Authorized Integrations
Jira and Confluence operations MUST use authorized interfaces and least-privilege
credentials. Secrets MUST NOT be committed or exposed in logs, user-visible errors, or
generated artifacts. Any action that creates or modifies Atlassian content MUST be
visible to and attributable by the user.

### IV. Clear Application Boundaries
The React frontend MUST communicate with the Node.js/Express backend through explicit
API contracts. Atlassian credentials, authorization checks, validation, and integration
rules MUST remain on the backend; browser-side checks alone are insufficient.

### V. Reliable, Verifiable Behavior
External-service errors and rate limits MUST be handled explicitly, and the application
MUST NOT report success when an operation failed. Automated tests MUST cover important
user behavior, API contracts, and integration failure paths. Live Atlassian tests MUST
be distinguished from repeatable local tests.

## Technical Stack and Repository Conventions

- Frontend: React 18.3.1 with Vite 8.3.4.
- Backend: Node.js 24.22.0 LTS with Express 5.3.0.
- Database: PostgreSQL 15.x, run through Docker Compose V2 for local development.
- Package manager: npm 11.19.1.
- The repository MUST retain these frontend/backend boundaries:

  ```text
  frontend/
    src/
      components/
      pages/
      services/
      hooks/
  backend/
    src/
      middleware/
      routes/
      services/
      integrations/
      db/
    tests/
  spec/
  docker-compose.yml
  ```

- React component files and component names MUST use PascalCase. React hooks MUST use
  the `use` prefix and camelCase names. Frontend utilities, services, and other
  non-component files MUST use kebab-case names.
- Backend modules MUST use kebab-case file names and be grouped by responsibility:
  routes map HTTP requests, services hold application behavior, integrations communicate
  with Atlassian, and database modules own persistence.
- JavaScript variables and functions MUST use camelCase. Immutable configuration
  constants MUST use UPPER_SNAKE_CASE. PostgreSQL tables and columns MUST use snake_case.
- Tests MUST use descriptive `*.test.js` or `*.test.jsx` names and reside beside the
  code they verify or under the corresponding `tests/` category.
- Each file MUST have one clear responsibility. Shared logic MUST be reused rather than
  copied between frontend and backend. API payloads MUST be documented and validated at
  the backend boundary.
- Environment-specific configuration and credentials MUST be supplied outside
  committed source files. Example environment files MUST contain placeholders only.

## Development Workflow

- Follow the installed Spec Kit workflow: specify, clarify, plan, checklist, tasks,
  analyze, implement, and converge.
- Do not begin implementation while consequential product, privacy, security, or
  integration requirements remain unresolved.
- Database changes MUST be documented and verified against PostgreSQL 15.
- Run relevant automated checks and report checks that could not be run, including
  live-service checks.
- Update the specification and related documentation when approved behavior or setup
  conventions change.

## Governance

This constitution governs project specifications, plans, implementation, and review.
Contributors MUST check proposed changes against these principles before implementation
and during review. Amendments MUST update this document, increment its semantic version,
and record the reason. Breaking changes to principles require a major version; new
principles or materially expanded guidance require a minor version; clarifications
require a patch version. Conflicts between a feature specification and this constitution
MUST be resolved explicitly before planning or implementation.

**Version**: 1.1.0 | **Ratified**: TODO(RATIFICATION_DATE) | **Last Amended**: 2026-10-18
