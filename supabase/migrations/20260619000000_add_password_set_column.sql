-- Migration: add_password_set_column
-- Created:   2026-06-19
-- Purpose:   Tracks whether a newly invited employee or client contact has
--            completed mandatory password creation on their first login.
--
--            The column is intentionally added WITHOUT a DEFAULT so existing
--            rows receive NULL rather than false. The application redirect gate
--            checks password_set = false with strict equality — NULL (every
--            existing accepted user) never satisfies that check and is never
--            redirected. Only rows where AuthContext explicitly writes false
--            during a fresh invitation acceptance trigger /set-password.
--
--            Once the user completes /set-password, the app writes true and
--            the redirect stops firing permanently.
--
-- DO NOT run directly — apply via Supabase Dashboard > SQL Editor.

ALTER TABLE employee
  ADD COLUMN IF NOT EXISTS password_set boolean;

ALTER TABLE client_contact
  ADD COLUMN IF NOT EXISTS password_set boolean;
