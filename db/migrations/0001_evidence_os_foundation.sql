CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_provider_user_id text NOT NULL UNIQUE,
  email text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  key text NOT NULL,
  UNIQUE (organization_id, key)
);

CREATE TABLE IF NOT EXISTS member_roles (
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role_key text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id, role_key)
);

CREATE TABLE IF NOT EXISTS manager_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  employee_user_id uuid NOT NULL REFERENCES users(id),
  manager_user_id uuid NOT NULL REFERENCES users(id),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz
);

CREATE TABLE IF NOT EXISTS evidence_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  tier text NOT NULL CHECK (tier IN ('system_fact','business_record','user_statement','ai_interpretation')),
  source_type text NOT NULL,
  source_snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_uri text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  captured_by_user_id uuid REFERENCES users(id),
  verification_status text NOT NULL DEFAULT 'draft',
  locked_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  supersedes_id uuid REFERENCES evidence_records(id),
  title text NOT NULL,
  statement text
);

CREATE TABLE IF NOT EXISTS evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  evidence_id uuid NOT NULL REFERENCES evidence_records(id),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  required_for_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evidence_id, entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role_at_time text NOT NULL,
  work_item_key text,
  team_statement text,
  individual_action_statement text,
  impact_statement text,
  validation_status text NOT NULL DEFAULT 'draft',
  impact_verification_status text NOT NULL DEFAULT 'unverified',
  validator_user_id uuid REFERENCES users(id),
  audit_version integer NOT NULL DEFAULT 1,
  dedupe_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, dedupe_key)
);

CREATE TABLE IF NOT EXISTS contribution_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS contribution_type_assignments (
  contribution_id uuid NOT NULL REFERENCES contributions(id),
  contribution_type_id uuid NOT NULL REFERENCES contribution_types(id),
  PRIMARY KEY (contribution_id, contribution_type_id)
);

CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid NOT NULL REFERENCES users(id),
  title text NOT NULL,
  baseline text,
  target text,
  measurement_method text,
  evidence_source text,
  effective_at timestamptz NOT NULL,
  deadline timestamptz,
  manager_id uuid REFERENCES users(id),
  validator_id uuid REFERENCES users(id),
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goal_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  goal_id uuid NOT NULL REFERENCES goals(id),
  previous_target text,
  new_target text,
  reason text,
  communicated_at timestamptz NOT NULL,
  acknowledged_at timestamptz,
  manager_acknowledged_at timestamptz,
  effective_at timestamptz NOT NULL,
  measurement_start timestamptz NOT NULL,
  retrospective_flag boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS validation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  validator_user_id uuid REFERENCES users(id),
  prompt text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  due_at timestamptz,
  created_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS validation_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  request_id uuid NOT NULL REFERENCES validation_requests(id),
  response text NOT NULL CHECK (response IN ('confirmed','partly_confirmed','not_confirmed','insufficient_info','no_response')),
  note text,
  responded_by_user_id uuid REFERENCES users(id),
  responded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  period text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  author_user_id uuid REFERENCES users(id),
  audience text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  variant text NOT NULL,
  narrative text,
  explicit_gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  actor_user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  before_hash text,
  after_hash text,
  request_id text,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_records_org ON evidence_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_contributions_org_user ON contributions(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_org_created ON audit_events(organization_id, created_at DESC);

