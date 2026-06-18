-- The performance_review table was created via the Supabase dashboard without the
-- five per-category rating columns. The UI writes to all five; this migration adds
-- them using IF NOT EXISTS so it is safe to run even if any already exist.

ALTER TABLE performance_review
  ADD COLUMN IF NOT EXISTS attendance      smallint NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS professionalism smallint NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS performance     smallint NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS communication   smallint NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS teamwork        smallint NOT NULL DEFAULT 3;
