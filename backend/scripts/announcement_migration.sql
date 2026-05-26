-- ════════════════════════════════════════════════════════════
-- SMART ANNOUNCEMENT SYSTEM — PostgreSQL Migration
-- Run ONCE against your Neon PostgreSQL database
-- ════════════════════════════════════════════════════════════

-- STEP 1: Add new columns to announcements table (PostgreSQL syntax)
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS is_pinned    BOOLEAN   NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS expires_at   TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS target_class INTEGER   NULL,
  ADD COLUMN IF NOT EXISTS posted_by    VARCHAR(200) NULL;

-- STEP 2: Widen target_audience to VARCHAR so 'parents' value is accepted
-- (already VARCHAR(20) so just update any CHECK constraint if exists)
-- Safe no-op if no constraint
DO $$
BEGIN
  ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_target_audience_check;
  ALTER TABLE announcements ADD CONSTRAINT announcements_target_audience_check
    CHECK (target_audience IN ('all','students','faculty','parents'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- STEP 3: Create announcement_reads table
CREATE TABLE IF NOT EXISTS announcement_reads (
  id              SERIAL PRIMARY KEY,
  announcement_id INTEGER NOT NULL,
  user_id         INTEGER NOT NULL,
  read_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_ann_user UNIQUE (announcement_id, user_id),
  CONSTRAINT fk_ar_announcement FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
  CONSTRAINT fk_ar_user         FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE
);

-- STEP 4: Performance indexes
CREATE INDEX IF NOT EXISTS idx_ann_reads_user ON announcement_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_ann_institute  ON announcements(institute_id);
CREATE INDEX IF NOT EXISTS idx_ann_pinned     ON announcements(is_pinned, "createdAt" DESC);

-- Verify: \d announcement_reads
-- Verify: \d announcements
