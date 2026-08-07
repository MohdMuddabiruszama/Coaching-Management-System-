const sequelize = require("../config/database");

const queries = [
    `ALTER TABLE students ADD COLUMN IF NOT EXISTS is_full_course BOOLEAN DEFAULT false;`,
    `ALTER TABLE student_fees ADD COLUMN IF NOT EXISTS reminder_date DATE;`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0;`,

    `ALTER TABLE attendances ADD COLUMN IF NOT EXISTS marked_by_type VARCHAR(20) DEFAULT 'manual';`,
    `ALTER TABLE attendances ADD COLUMN IF NOT EXISTS biometric_punch_id BIGINT NULL;`,
    `ALTER TABLE attendances ADD COLUMN IF NOT EXISTS time_in TIME NULL;`,
    `ALTER TABLE attendances ADD COLUMN IF NOT EXISTS time_out TIME NULL;`,
    `ALTER TABLE attendances ADD COLUMN IF NOT EXISTS is_late BOOLEAN DEFAULT false;`,
    `ALTER TABLE attendances ADD COLUMN IF NOT EXISTS late_by_minutes INT DEFAULT 0;`,
    `ALTER TABLE attendances ADD COLUMN IF NOT EXISTS is_half_day BOOLEAN DEFAULT false;`,

    `ALTER TABLE plans ADD COLUMN IF NOT EXISTS feature_public_page BOOLEAN DEFAULT false;`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS current_feature_public_page BOOLEAN DEFAULT false;`,
    `ALTER TABLE institute_reviews ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;`,
    `ALTER TABLE institute_reviews ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT true;`,
    `ALTER TABLE institute_gallery_photos ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;`,

    `ALTER TABLE plans ADD COLUMN IF NOT EXISTS feature_fees BOOLEAN DEFAULT true;`,
    `ALTER TABLE plans ADD COLUMN IF NOT EXISTS feature_salary BOOLEAN DEFAULT false;`,
    `ALTER TABLE plans ADD COLUMN IF NOT EXISTS feature_expenses BOOLEAN DEFAULT false;`,
    `ALTER TABLE plans ADD COLUMN IF NOT EXISTS feature_finance_reports BOOLEAN DEFAULT false;`,
    `ALTER TABLE plans ADD COLUMN IF NOT EXISTS feature_transport_fees BOOLEAN DEFAULT false;`,
    `ALTER TABLE plans ADD COLUMN IF NOT EXISTS feature_finance BOOLEAN DEFAULT false;`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS current_feature_finance BOOLEAN DEFAULT false;`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS current_feature_salary BOOLEAN DEFAULT false;`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS current_feature_mobile_app BOOLEAN DEFAULT false;`,

    `DO $$ BEGIN
        CREATE TYPE "enum_users_manager_type" AS ENUM ('fees', 'data', 'academic', 'ops', 'hr', 'custom');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_type "enum_users_manager_type" DEFAULT 'custom';`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_type_label VARCHAR(50) DEFAULT NULL;`,

    `ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_free_trial BOOLEAN DEFAULT false;`,
    `ALTER TABLE plans ADD COLUMN IF NOT EXISTS trial_days INT DEFAULT 14;`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS has_used_trial BOOLEAN DEFAULT false;`,

    `CREATE INDEX IF NOT EXISTS idx_profile_slug ON institute_public_profiles(slug);`,
    `CREATE INDEX IF NOT EXISTS idx_gallery_inst ON institute_gallery_photos(institute_id);`,
    `CREATE INDEX IF NOT EXISTS idx_reviews_inst ON institute_reviews(institute_id);`,
    `CREATE INDEX IF NOT EXISTS idx_enquiry_inst ON public_enquiries(institute_id, status, created_at);`,
    `CREATE INDEX IF NOT EXISTS idx_students_inst_class ON students(institute_id, class_id);`,
    `CREATE INDEX IF NOT EXISTS idx_students_user ON students(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_att_student_date ON attendances(student_id, date);`,
    `CREATE INDEX IF NOT EXISTS idx_att_inst_date ON attendances(institute_id, date);`,
    `CREATE INDEX IF NOT EXISTS idx_att_class_date ON attendances(class_id, date);`,
    `CREATE INDEX IF NOT EXISTS idx_sub_inst_status ON subscriptions(institute_id, payment_status);`,
    `CREATE INDEX IF NOT EXISTS idx_sub_end_date ON subscriptions(end_date);`,
    `CREATE INDEX IF NOT EXISTS idx_subjects_class_inst ON subjects(class_id, institute_id);`,
    `CREATE INDEX IF NOT EXISTS idx_faculty_inst ON faculty(institute_id);`,
    `CREATE INDEX IF NOT EXISTS idx_sfee_student ON student_fees(student_id, institute_id);`,
    `CREATE INDEX IF NOT EXISTS idx_sfee_due ON student_fees(due_date, status);`,
    `CREATE INDEX IF NOT EXISTS idx_exams_inst ON exams(institute_id, class_id);`,
    `CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created ON chat_messages(room_id, created_at);`,
    `CREATE INDEX IF NOT EXISTS idx_chat_participants_user_room ON chat_participants(user_id, room_id);`,

    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS is_test_account BOOLEAN DEFAULT false;`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT false;`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS id_card_settings JSONB DEFAULT '{}'::jsonb;`,
];

async function run() {
    try {
        await sequelize.authenticate();
        for (const query of queries) {
            try {
                await sequelize.query(query);
            } catch (err) {
                console.warn(`Migration query failed (skipping): ${query}`, err.message);
            }
        }
        console.log(`Applied safe migration/index statement(s).`);
    } catch (error) {
        console.error("Safe migration failed:", error);
        process.exitCode = 1;
    } finally {
        await sequelize.close();
    }
}

run();
