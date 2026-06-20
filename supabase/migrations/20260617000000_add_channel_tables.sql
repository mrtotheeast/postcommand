-- Migration: add_channel_tables
-- Created:   2026-06-17
-- Purpose:   Structured channel/group membership layer for Messaging.
--            Adds `channel` and `channel_member` tables, enables RLS matching
--            the app's existing user_profile-anchored auth.uid() pattern, and
--            backfills one General channel + full employee roster per company.
--
-- DO NOT run this file directly — apply via Supabase dashboard SQL editor or CLI:
--   supabase db push   (local)
--   or paste into Dashboard > SQL Editor for the hosted project.

-- ── 1. channel ──────────────────────────────────────────────────────────────────
--
-- One row per named channel per company.  The partial unique index on company_id
-- WHERE is_general = true enforces the "exactly one General channel" invariant at
-- the database level — no application code can accidentally create a second one.

CREATE TABLE channel (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        NOT NULL REFERENCES company(id)   ON DELETE CASCADE,
  name        text        NOT NULL,
  is_general  boolean     NOT NULL DEFAULT false,
  created_by  uuid                 REFERENCES employee(id)  ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Partial unique index: only one row per company may have is_general = true
CREATE UNIQUE INDEX channel_one_general_per_company_idx
  ON channel (company_id)
  WHERE (is_general = true);

-- General index for the most common lookup (company_id filter)
CREATE INDEX channel_company_id_idx
  ON channel (company_id);

-- ── 2. channel_member ───────────────────────────────────────────────────────────
--
-- Join table: which employees belong to which channels.
-- ON DELETE CASCADE on both FKs keeps membership clean when a channel or employee
-- is removed.  added_by tracks who performed the join (null for system/backfill).

CREATE TABLE channel_member (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  uuid        NOT NULL REFERENCES channel(id)   ON DELETE CASCADE,
  employee_id uuid        NOT NULL REFERENCES employee(id)  ON DELETE CASCADE,
  added_by    uuid                 REFERENCES employee(id)  ON DELETE SET NULL,
  joined_at   timestamptz NOT NULL DEFAULT now(),

  UNIQUE (channel_id, employee_id)
);

-- Index for the membership lookup the app will use most often
CREATE INDEX channel_member_employee_id_idx
  ON channel_member (employee_id);

CREATE INDEX channel_member_channel_id_idx
  ON channel_member (channel_id);

-- ── 3. Row-Level Security ────────────────────────────────────────────────────────
--
-- Pattern matches the rest of the codebase: every table is scoped to company_id,
-- resolved by looking up the authenticated user in user_profile (id = auth.uid()).
-- The user_profile table is the single auth anchor — see AuthContext.jsx.
--
-- auth.uid() returns NULL for unauthenticated requests, so the subquery returns
-- zero rows and all policies correctly deny access without an explicit NULL check.

ALTER TABLE channel        ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_member ENABLE ROW LEVEL SECURITY;


-- ── channel policies ─────────────────────────────────────────────────────────────
--
-- SELECT: company-wide read access for all authenticated members.
-- Visibility filtering ("only show channels I belong to") is an application-layer
-- concern handled in Messaging.jsx queries, not enforced here.  Encoding a
-- "member of channel_member" check into a SELECT policy on channel would create a
-- mutually-recursive RLS dependency (channel → channel_member → channel) that
-- Postgres cannot resolve without SECURITY DEFINER functions.  The simpler, correct
-- boundary: RLS enforces company isolation; the app enforces per-channel visibility.

CREATE POLICY "company members can read channels"
  ON channel
  FOR SELECT
  USING (
    company_id = (
      SELECT company_id FROM user_profile WHERE id = auth.uid()
    )
  );

-- INSERT: sergeant and above may create new channels.
-- Roles included: sergeant, lieutenant, chief, chief_app_admin, super_admin.
-- Corporal, officer, hr, accounting, office_staff, client are excluded at the DB level.
CREATE POLICY "sergeant+ can create channels"
  ON channel
  FOR INSERT
  WITH CHECK (
    company_id = (
      SELECT company_id FROM user_profile WHERE id = auth.uid()
    )
    AND (SELECT role FROM user_profile WHERE id = auth.uid())
        IN ('sergeant', 'lieutenant', 'chief', 'chief_app_admin', 'super_admin')
  );

-- UPDATE (rename / modify): lieutenant and above only.
-- Sergeants can create channels but cannot rename or repurpose them after creation.
CREATE POLICY "lieutenant+ can update channels"
  ON channel
  FOR UPDATE
  USING (
    company_id = (
      SELECT company_id FROM user_profile WHERE id = auth.uid()
    )
    AND (SELECT role FROM user_profile WHERE id = auth.uid())
        IN ('lieutenant', 'chief', 'chief_app_admin', 'super_admin')
  )
  WITH CHECK (
    company_id = (
      SELECT company_id FROM user_profile WHERE id = auth.uid()
    )
    AND (SELECT role FROM user_profile WHERE id = auth.uid())
        IN ('lieutenant', 'chief', 'chief_app_admin', 'super_admin')
  );

-- DELETE: lieutenant and above, non-General channels only.
-- The is_general = false guard is a hard DB-level safety net — no role can delete
-- the company-wide General channel, regardless of application logic.
CREATE POLICY "lieutenant+ can delete non-general channels"
  ON channel
  FOR DELETE
  USING (
    is_general = false
    AND company_id = (
      SELECT company_id FROM user_profile WHERE id = auth.uid()
    )
    AND (SELECT role FROM user_profile WHERE id = auth.uid())
        IN ('lieutenant', 'chief', 'chief_app_admin', 'super_admin')
  );


-- ── channel_member policies ───────────────────────────────────────────────────────
--
-- channel_member has no company_id column directly; scope is derived by joining
-- to channel.  The subquery is simple and the channel table is small per company.
--
-- SELECT: company-wide read access for all authenticated members.
-- Same rationale as the channel SELECT policy above — per-channel membership
-- visibility ("only show channels I'm a member of") is an application-layer concern.
-- The app queries channel_member with an employee_id filter when building the
-- officer-visible channel list; RLS here only enforces the company boundary.

CREATE POLICY "company members can read channel_members"
  ON channel_member
  FOR SELECT
  USING (
    channel_id IN (
      SELECT id FROM channel
      WHERE company_id = (
        SELECT company_id FROM user_profile WHERE id = auth.uid()
      )
    )
  );

-- INSERT (primary): lieutenant and above may add any employee to any channel.
-- This covers the normal admin flow: lieutenant manages a group, adds members.
CREATE POLICY "lieutenant+ can insert channel_members"
  ON channel_member
  FOR INSERT
  WITH CHECK (
    channel_id IN (
      SELECT id FROM channel
      WHERE company_id = (
        SELECT company_id FROM user_profile WHERE id = auth.uid()
      )
    )
    AND (SELECT role FROM user_profile WHERE id = auth.uid())
        IN ('lieutenant', 'chief', 'chief_app_admin', 'super_admin')
  );

-- INSERT (exception): a sergeant who just created a channel may add themselves
-- as a member, even though they cannot add others (that requires lieutenant+).
--
-- Why this exception exists: the channel INSERT policy allows sergeants to create
-- channels, but the primary INSERT policy above requires lieutenant+ to add members.
-- Without this exception a sergeant would create a group and immediately be locked
-- out of their own channel.  The two conditions together are tight: the row being
-- inserted must have an employee_id that matches (a) the current user's own
-- employee_id in user_profile AND (b) the created_by field on the target channel.
-- A sergeant cannot use this policy to add anyone else.
--
-- Postgres permissive policies stack with OR, so either the lieutenant+ policy
-- OR this creator-self-join policy can satisfy an INSERT.
CREATE POLICY "channel creator can self-join own channel"
  ON channel_member
  FOR INSERT
  WITH CHECK (
    -- Row being inserted must name the current user's own employee record
    employee_id = (
      SELECT employee_id FROM user_profile WHERE id = auth.uid()
    )
    -- That employee must be the one who created this specific channel
    AND employee_id = (
      SELECT created_by FROM channel WHERE id = channel_id
    )
    -- Channel must still belong to the user's company (safety net)
    AND channel_id IN (
      SELECT id FROM channel
      WHERE company_id = (
        SELECT company_id FROM user_profile WHERE id = auth.uid()
      )
    )
  );

-- DELETE: lieutenant and above, non-General channels only.
-- The is_general = false guard (via the channel subquery) is a hard DB-level safety
-- net — no role can strip the entire roster of the company-wide General channel.
CREATE POLICY "lieutenant+ can delete non-general channel_members"
  ON channel_member
  FOR DELETE
  USING (
    channel_id IN (
      SELECT id FROM channel
      WHERE company_id = (
        SELECT company_id FROM user_profile WHERE id = auth.uid()
      )
        AND is_general = false
    )
    AND (SELECT role FROM user_profile WHERE id = auth.uid())
        IN ('lieutenant', 'chief', 'chief_app_admin', 'super_admin')
  );


-- ── 4. Backfill: one General channel per existing company ─────────────────────────
--
-- Every company that exists at migration time gets exactly one General channel.
-- The partial unique index guarantees idempotency if this migration is re-run.

INSERT INTO channel (company_id, name, is_general)
SELECT id, 'General', true
FROM company
ON CONFLICT DO NOTHING;


-- ── 5. Backfill: auto-join existing employees to their General channel ────────────
--
-- Status values confirmed in the codebase (Personnel.jsx):
--   active      — standard employed
--   probation   — on probation; grouped with active in the Personnel UI tab
--   on_leave    — on leave; still billable
--   inactive    — still employed but not currently scheduled; Personnel "active" tab
--                 includes inactive (line 122-123) so these are NOT departed employees
--   terminated  — departed; has its own UI tab — EXCLUDED
--   suspended   — appears as a UI tab alongside terminated — EXCLUDED
--
-- Decision: include active, probation, on_leave, inactive (all "still employed").
-- Exclude terminated and suspended (departed/removed from duty).
-- If you want to also exclude inactive, change the IN list to ('active','probation','on_leave').
--
-- Going forward, new employees are joined via application code after the
-- employee INSERT in Personnel.jsx (two call sites: ~line 885 manual form,
-- ~line 335 CSV import).
--
-- ON CONFLICT DO NOTHING makes this safe to re-run.

INSERT INTO channel_member (channel_id, employee_id)
SELECT c.id, e.id
FROM   channel  c
JOIN   employee e ON e.company_id = c.company_id
WHERE  c.is_general = true
  AND  e.status IN ('active', 'probation', 'on_leave', 'inactive')
ON CONFLICT (channel_id, employee_id) DO NOTHING;
