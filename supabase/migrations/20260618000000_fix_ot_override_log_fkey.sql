-- Fix: ot_override_log.shift_id FK to use ON DELETE CASCADE
--
-- The ot_override_log table records when a supervisor overrides an OT warning
-- to create a shift. Each row is tied to a specific shift_id and has no
-- meaningful standalone existence once that shift is deleted — the override
-- decision was made for that shift, not as a freestanding audit record.
-- Therefore ON DELETE CASCADE is correct: remove the log row when its shift
-- is removed, rather than blocking the shift delete with RESTRICT.
--
-- If your schema has a different FK name, replace "ot_override_log_shift_id_fkey"
-- with the actual constraint name from \d ot_override_log in psql.

ALTER TABLE ot_override_log
  DROP CONSTRAINT IF EXISTS ot_override_log_shift_id_fkey;

ALTER TABLE ot_override_log
  ADD CONSTRAINT ot_override_log_shift_id_fkey
    FOREIGN KEY (shift_id)
    REFERENCES shift(id)
    ON DELETE CASCADE;
