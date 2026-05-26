-- ═══════════════════════════════════════════════════════════════
-- EXAM RESULT SYSTEM — Database Migration (PostgreSQL)
-- ⚠️  NOTE: This file is for MANUAL reference only.
--     The app.js startup migration already adds these columns
--     automatically on restart (RUN_STARTUP_MIGRATIONS=true).
--     Only run this manually if you have NOT restarted the server.
-- ═══════════════════════════════════════════════════════════════

-- STEP 1: Add new columns to the exams table
-- Using VARCHAR(20) instead of ENUM (avoids PG ENUM type complexity)
ALTER TABLE exams ADD COLUMN IF NOT EXISTS exam_type      VARCHAR(20)  NOT NULL DEFAULT 'unit_test';
ALTER TABLE exams ADD COLUMN IF NOT EXISTS marks_locked   BOOLEAN      NOT NULL DEFAULT FALSE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS marks_locked_at TIMESTAMPTZ NULL;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS marks_locked_by INTEGER     NULL;

-- STEP 2: Add new columns to the marks table
ALTER TABLE marks ADD COLUMN IF NOT EXISTS is_absent BOOLEAN     NOT NULL DEFAULT FALSE;
ALTER TABLE marks ADD COLUMN IF NOT EXISTS remarks   VARCHAR(200) NULL;

-- STEP 3: Performance indexes for RANK() window function
CREATE INDEX IF NOT EXISTS idx_marks_exam_id    ON marks(exam_id);
CREATE INDEX IF NOT EXISTS idx_marks_student_id ON marks(student_id);
CREATE INDEX IF NOT EXISTS idx_exams_locked     ON exams(marks_locked);

-- ═══════════════════════════════════════════════════════════════
-- VERIFICATION (run after migration)
-- ═══════════════════════════════════════════════════════════════
-- SELECT column_name, data_type, column_default, is_nullable
--   FROM information_schema.columns
--   WHERE table_name IN ('exams','marks')
--   AND column_name IN ('exam_type','marks_locked','marks_locked_at','marks_locked_by','is_absent','remarks')
--   ORDER BY table_name, ordinal_position;
