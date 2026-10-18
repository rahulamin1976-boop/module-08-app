CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jira_project_id TEXT NOT NULL UNIQUE,
  jira_project_key TEXT NOT NULL,
  name TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider = 'atlassian_cloud'),
  cloud_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  access_token_ciphertext TEXT NOT NULL,
  refresh_token_ciphertext TEXT NOT NULL,
  encryption_key_reference TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider)
);

CREATE TABLE status_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  created_by_account_id TEXT NOT NULL,
  approved_by_account_id TEXT,
  last_edited_by_account_id TEXT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  timezone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'publishing', 'published')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  source_snapshot JSONB,
  confirmed_empty_categories TEXT[] NOT NULL DEFAULT '{}'
    CHECK (
      confirmed_empty_categories <@
      ARRAY['accomplishment', 'blocker', 'next_week']::TEXT[]
    ),
  warnings JSONB NOT NULL DEFAULT '[]'::JSONB
    CHECK (jsonb_typeof(warnings) = 'array'),
  confluence_idempotency_key UUID GENERATED ALWAYS AS (id) STORED UNIQUE,
  confluence_parent_page_id TEXT,
  confluence_space_id TEXT,
  confluence_page_id TEXT,
  confluence_page_url TEXT,
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (period_start <= period_end),
  CHECK (
    (status = 'draft' AND approved_by_account_id IS NULL AND approved_at IS NULL
      AND published_at IS NULL AND confluence_page_id IS NULL
      AND confluence_page_url IS NULL)
    OR
    (status = 'approved' AND approved_by_account_id IS NOT NULL
      AND approved_at IS NOT NULL AND published_at IS NULL
      AND confluence_page_id IS NULL AND confluence_page_url IS NULL)
    OR
    (status = 'publishing' AND approved_by_account_id IS NOT NULL
      AND approved_at IS NOT NULL AND confluence_space_id IS NOT NULL
      AND confluence_parent_page_id IS NOT NULL AND published_at IS NULL)
    OR
    (status = 'published' AND approved_by_account_id IS NOT NULL
      AND approved_at IS NOT NULL AND confluence_page_id IS NOT NULL
      AND confluence_page_url IS NOT NULL AND published_at IS NOT NULL)
  )
);

CREATE TABLE report_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES status_reports(id) ON DELETE CASCADE,
  category TEXT NOT NULL
    CHECK (category IN ('accomplishment', 'blocker', 'next_week')),
  text TEXT NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 2000),
  source_type TEXT NOT NULL
    CHECK (source_type IN ('jira', 'manual', 'user_edited')),
  source_reference TEXT,
  source_snapshot JSONB,
  edited_by_account_id TEXT,
  owner TEXT CHECK (owner IS NULL OR length(owner) <= 120),
  source_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (source_type = 'jira' AND source_reference IS NOT NULL
      AND source_snapshot IS NOT NULL)
    OR (source_type = 'manual' AND source_snapshot IS NULL)
    OR source_type = 'user_edited'
  )
);

CREATE TABLE report_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES status_reports(id) ON DELETE CASCADE,
  actor_account_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (
    action IN (
      'created',
      'edited',
      'approved',
      'approval_withdrawn',
      'publish_started',
      'published',
      'publish_failed',
      'deleted'
    )
  ),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  details JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (jsonb_typeof(details) = 'object')
);

CREATE INDEX status_reports_project_updated_idx
  ON status_reports (project_id, updated_at DESC);
CREATE INDEX status_reports_status_updated_idx
  ON status_reports (status, updated_at DESC);
CREATE INDEX report_items_report_category_idx
  ON report_items (report_id, category, created_at, id);
CREATE INDEX report_audit_events_report_time_idx
  ON report_audit_events (report_id, occurred_at, id);
