/**
 * Academic Year Promotion Engine — Phase 1 Migration
 * Enrollment Journal Model (Approach 2)
 *
 * This migration is IDEMPOTENT — safe to run multiple times.
 * All statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
 *
 * Tables / Changes:
 *   1. academic_years          — NEW table (one row per institute per year)
 *   2. student_classes         — EXTEND with 4 new columns (versioned enrollment journal)
 *   3. students                — EXTEND with status + current_academic_year_id
 *   4. promotion_rules         — NEW table (institute-configurable class sequence)
 *   5. Backfill                — One academic_years row + active enrollment per existing student
 *
 * Run: node backend/scripts/academic_year_promotion_migration.js
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const sequelize = require("../config/database");

async function run() {
    console.log("🚀 Academic Year Promotion Migration starting...");

    try {
        await sequelize.authenticate();
        console.log("✅ Database connected");
    } catch (e) {
        console.error("❌ Database connection failed:", e.message);
        process.exit(1);
    }

    // ─── 1. academic_years table ──────────────────────────────────────────────
    try {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS academic_years (
                id              SERIAL PRIMARY KEY,
                institute_id    INTEGER NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
                label           VARCHAR(20) NOT NULL,
                start_date      DATE,
                end_date        DATE,
                is_current      BOOLEAN DEFAULT false,
                status          VARCHAR(20) DEFAULT 'active',
                created_at      TIMESTAMP DEFAULT NOW(),
                updated_at      TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log("✅ academic_years table ensured");
    } catch (e) {
        console.error("Error creating academic_years:", e.message);
    }

    // Partial unique index: only one is_current=true per institute
    try {
        await sequelize.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS uq_one_current_year
            ON academic_years(institute_id) WHERE is_current = true;
        `);
        console.log("✅ Unique index uq_one_current_year ensured");
    } catch (e) {
        // Already exists — safe to ignore
    }

    // ─── 2. Upgrade student_classes into enrollment journal ───────────────────
    try {
        await sequelize.query(`ALTER TABLE student_classes ADD COLUMN IF NOT EXISTS academic_year_id INTEGER REFERENCES academic_years(id);`);
        console.log("✅ student_classes.academic_year_id ensured");
    } catch (e) {
        console.error("Error adding academic_year_id:", e.message);
    }

    try {
        await sequelize.query(`ALTER TABLE student_classes ADD COLUMN IF NOT EXISTS enrollment_status VARCHAR(20) DEFAULT 'active';`);
        console.log("✅ student_classes.enrollment_status ensured");
    } catch (e) {
        console.error("Error adding enrollment_status:", e.message);
    }

    try {
        await sequelize.query(`ALTER TABLE student_classes ADD COLUMN IF NOT EXISTS enrolled_at DATE DEFAULT NOW();`);
        console.log("✅ student_classes.enrolled_at ensured");
    } catch (e) {
        console.error("Error adding enrolled_at:", e.message);
    }

    try {
        await sequelize.query(`ALTER TABLE student_classes ADD COLUMN IF NOT EXISTS exited_at DATE;`);
        console.log("✅ student_classes.exited_at ensured");
    } catch (e) {
        console.error("Error adding exited_at:", e.message);
    }

    // Partial unique index: only one active enrollment per student at a time
    try {
        await sequelize.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_enrollment
            ON student_classes(student_id) WHERE enrollment_status = 'active';
        `);
        console.log("✅ Unique index uq_one_active_enrollment ensured");
    } catch (e) {
        // Already exists
    }

    // Performance index
    try {
        await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_sc_year ON student_classes(academic_year_id, class_id);`);
        console.log("✅ Index idx_sc_year ensured");
    } catch (e) { }

    // ─── 3. Extend students table ─────────────────────────────────────────────
    try {
        await sequelize.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS student_status VARCHAR(20) DEFAULT 'active';`);
        console.log("✅ students.student_status ensured");
    } catch (e) {
        console.error("Error adding student_status:", e.message);
    }

    try {
        await sequelize.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS current_academic_year_id INTEGER REFERENCES academic_years(id);`);
        console.log("✅ students.current_academic_year_id ensured");
    } catch (e) {
        console.error("Error adding current_academic_year_id:", e.message);
    }

    // ─── 4. promotion_rules table ─────────────────────────────────────────────
    try {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS promotion_rules (
                id              SERIAL PRIMARY KEY,
                institute_id    INTEGER NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
                from_class_id   INTEGER REFERENCES classes(id) ON DELETE SET NULL,
                to_class_id     INTEGER REFERENCES classes(id) ON DELETE SET NULL,
                end_action      VARCHAR(20) DEFAULT NULL,
                sort_order      INTEGER DEFAULT 0,
                created_at      TIMESTAMP DEFAULT NOW(),
                updated_at      TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log("✅ promotion_rules table ensured");
    } catch (e) {
        console.error("Error creating promotion_rules:", e.message);
    }

    // Index for fast lookup by institute
    try {
        await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_promo_rules_inst ON promotion_rules(institute_id, sort_order);`);
        console.log("✅ Index idx_promo_rules_inst ensured");
    } catch (e) { }

    // ─── 5. Backfill: Create a current academic year per institute ────────────
    // Only runs for institutes that don't have any academic_years row yet
    try {
        await sequelize.query(`
            INSERT INTO academic_years (institute_id, label, is_current, status, created_at, updated_at)
            SELECT DISTINCT
                i.id,
                TO_CHAR(NOW(), 'YYYY') || '-' || TO_CHAR((NOW() + INTERVAL '1 year'), 'YY') AS label,
                true,
                'active',
                NOW(),
                NOW()
            FROM institutes i
            WHERE NOT EXISTS (
                SELECT 1 FROM academic_years ay WHERE ay.institute_id = i.id
            );
        `);
        console.log("✅ Backfill: academic_years rows created for institutes without one");
    } catch (e) {
        console.error("Error in backfill (academic_years):", e.message);
    }

    // Backfill: Create active student_classes enrollment for students that don't have one yet
    // Uses the student's existing class_id as the class assignment
    try {
        await sequelize.query(`
            INSERT INTO student_classes (student_id, class_id, institute_id, academic_year_id, enrollment_status, enrolled_at, created_at, updated_at)
            SELECT
                s.id AS student_id,
                s.class_id,
                s.institute_id,
                ay.id AS academic_year_id,
                'active' AS enrollment_status,
                NOW() AS enrolled_at,
                NOW() AS created_at,
                NOW() AS updated_at
            FROM students s
            INNER JOIN academic_years ay ON ay.institute_id = s.institute_id AND ay.is_current = true
            WHERE s.class_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM student_classes sc
                  WHERE sc.student_id = s.id AND sc.enrollment_status = 'active'
              );
        `);
        console.log("✅ Backfill: active student_classes rows created for existing students");
    } catch (e) {
        console.error("Error in backfill (student_classes):", e.message);
    }

    // Backfill: Set current_academic_year_id on students
    try {
        await sequelize.query(`
            UPDATE students s
            SET current_academic_year_id = ay.id
            FROM academic_years ay
            WHERE ay.institute_id = s.institute_id
              AND ay.is_current = true
              AND s.current_academic_year_id IS NULL;
        `);
        console.log("✅ Backfill: students.current_academic_year_id set");
    } catch (e) {
        console.error("Error in backfill (current_academic_year_id):", e.message);
    }

    // Set student_status for all existing students without one
    try {
        await sequelize.query(`
            UPDATE students SET student_status = 'active'
            WHERE student_status IS NULL;
        `);
        console.log("✅ Backfill: students.student_status set to active");
    } catch (e) { }

    console.log("\n🎓 Academic Year Promotion Migration completed successfully!");
    process.exit(0);
}

run().catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
});
