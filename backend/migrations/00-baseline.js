// backend/migrations/00-baseline.js
// ─── Baseline Migration ───────────────────────────────────────────────────────
// Extracted from the raw ALTER TABLE blocks that previously lived in app.js.
// This migration runs EXACTLY ONCE (tracked in SequelizeMeta table).
// All columns use "add if missing" guards so it is safe to run on any DB state.
// ZenithFlows — Enterprise DB Safety Architecture (Phase 2)

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const DT = Sequelize.DataTypes;
    
    try {
      console.log('  [00-baseline] Applying baseline schema migrations...');

      // ── Helper: add column only if it doesn't exist ────────────────────────
      async function addIfMissing(table, column, definition) {
        try {
          const desc = await queryInterface.describeTable(table);
          if (!desc[column]) {
            await queryInterface.addColumn(table, column, definition);
            console.log(`    + ${table}.${column}`);
          }
        } catch (e) {
          // Table might not exist yet — sequelize.sync({ alter:false }) creates it
          // Migration will still be tracked as applied
        }
      }

      // ── Helper: create index ignoring "already exists" errors ─────────────
      async function addIndex(sql) {
        try {
          await queryInterface.sequelize.query(sql);
        } catch (e) {
          console.log(`    ~ Skipping index (likely missing columns or already exists): ${sql.substring(0, 50)}...`);
        }
      }

      // ── Institutes ────────────────────────────────────────────────────────
      await addIfMissing('institutes', 'is_test_account',                { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('institutes', 'is_lifetime_member',             { type: DT.BOOLEAN, defaultValue: false, allowNull: false });
      await addIfMissing('institutes', 'lifetime_purchased_at',          { type: DT.DATE, allowNull: true });
      await addIfMissing('institutes', 'lifetime_plan_id',               { type: DT.INTEGER, allowNull: true });
      await addIfMissing('institutes', 'founding_member',                { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('institutes', 'custom_subdomain',               { type: DT.STRING(100), allowNull: true });
      await addIfMissing('institutes', 'has_used_trial',                 { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('institutes', 'student_attendance_mode',        { type: DT.STRING(20), defaultValue: 'subject_based' });
      await addIfMissing('institutes', 'qr_notify_main_gate_in',        { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('institutes', 'qr_notify_main_gate_out',       { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('institutes', 'qr_notify_subject_in',          { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('institutes', 'qr_notify_subject_out',         { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('institutes', 'qr_notify_parent_on_late',      { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('institutes', 'qr_notify_parent_on_absent',    { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('institutes', 'current_feature_public_page',   { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('institutes', 'current_feature_finance',       { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('institutes', 'current_feature_expenses',      { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('institutes', 'current_feature_salary',        { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('institutes', 'current_feature_mobile_app',    { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('institutes', 'current_limit_managers',        { type: DT.INTEGER, defaultValue: 1 });
      await addIfMissing('institutes', 'current_limit_chat_messages',   { type: DT.INTEGER, defaultValue: 500 });
      await addIfMissing('institutes', 'current_feature_chat',          { type: DT.BOOLEAN, defaultValue: false });

      // ── Subscriptions ─────────────────────────────────────────────────────
      await addIfMissing('subscriptions', 'is_test',            { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('subscriptions', 'discount_amount',    { type: DT.DECIMAL(10, 2), defaultValue: 0 });
      await addIfMissing('subscriptions', 'tax_amount',         { type: DT.DECIMAL(10, 2), defaultValue: 0 });
      await addIfMissing('subscriptions', 'cancelled_reason',   { type: DT.STRING(200), allowNull: true });

      // ── Plans ────────────────────────────────────────────────────────────
      await addIfMissing('plans', 'feature_public_page',                 { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('plans', 'feature_fees',                        { type: DT.BOOLEAN, defaultValue: true });
      await addIfMissing('plans', 'feature_salary',                      { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('plans', 'feature_expenses',                    { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('plans', 'feature_finance_reports',             { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('plans', 'feature_transport_fees',              { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('plans', 'feature_finance',                     { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('plans', 'max_managers',                        { type: DT.INTEGER, defaultValue: 1, allowNull: false });
      await addIfMissing('plans', 'is_lifetime',                         { type: DT.BOOLEAN, defaultValue: false, allowNull: false });
      await addIfMissing('plans', 'lifetime_price',                      { type: DT.DECIMAL(10, 2), allowNull: true });
      await addIfMissing('plans', 'lifetime_slots_total',                { type: DT.INTEGER, defaultValue: 100 });
      await addIfMissing('plans', 'lifetime_slots_used',                 { type: DT.INTEGER, defaultValue: 0 });
      await addIfMissing('plans', 'max_students_lifetime',               { type: DT.INTEGER, defaultValue: -1 });
      await addIfMissing('plans', 'max_faculty_lifetime',                { type: DT.INTEGER, defaultValue: -1 });
      await addIfMissing('plans', 'max_managers_lifetime',               { type: DT.INTEGER, defaultValue: -1 });
      await addIfMissing('plans', 'lifetime_bonus_subdomain',            { type: DT.BOOLEAN, defaultValue: true });
      await addIfMissing('plans', 'lifetime_bonus_priority_support',     { type: DT.BOOLEAN, defaultValue: true });
      await addIfMissing('plans', 'lifetime_bonus_unlimited_export',     { type: DT.BOOLEAN, defaultValue: true });
      await addIfMissing('plans', 'is_free_trial',                       { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('plans', 'trial_days',                          { type: DT.INTEGER, defaultValue: 14 });
      await addIfMissing('plans', 'max_chat_messages',                   { type: DT.INTEGER, defaultValue: 500, allowNull: false });

      // ── Users ────────────────────────────────────────────────────────────
      await addIfMissing('users', 'manager_type_label',           { type: DT.STRING(50), allowNull: true });
      await addIfMissing('users', 'is_first_login',               { type: DT.BOOLEAN, defaultValue: true, allowNull: true });
      await addIfMissing('users', 'temp_password_expires_at',     { type: DT.DATE, allowNull: true });
      await addIfMissing('users', 'credentials_sent_at',          { type: DT.DATE, allowNull: true });
      await addIfMissing('users', 'initial_password',             { type: DT.STRING(255), allowNull: true });
      await addIfMissing('users', 'fcm_token',                    { type: DT.STRING(500), allowNull: true });
      await addIfMissing('users', 'fcm_platform',                 { type: DT.STRING(20), allowNull: true });
      await addIfMissing('users', 'last_assignment_seen_at',      { type: DT.DATE, allowNull: true });
      await addIfMissing('users', 'last_note_seen_at',            { type: DT.DATE, allowNull: true });
      await addIfMissing('users', 'last_enquiry_seen_at',         { type: DT.DATE, allowNull: true });

      // ── Students ──────────────────────────────────────────────────────────
      await addIfMissing('students', 'is_full_course',             { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('students', 'student_status',             { type: DT.STRING(20), defaultValue: 'active' });
      await addIfMissing('students', 'current_academic_year_id',   { type: DT.INTEGER, allowNull: true });

      // ── Subjects ─────────────────────────────────────────────────────────
      await addIfMissing('subjects', 'code', { type: DT.STRING(50), allowNull: true });

      // ── Faculty ──────────────────────────────────────────────────────────
      await addIfMissing('faculty', 'address', { type: DT.STRING(500), allowNull: true });
      // Remove salary column from faculty if still exists (moved to faculty_salaries)
      try {
        const facDesc = await queryInterface.describeTable('faculty');
        if (facDesc.salary) {
          await queryInterface.removeColumn('faculty', 'salary', { transaction: t });
          console.log('    - faculty.salary (moved to faculty_salaries)');
        }
      } catch (_) {}

      // ── Attendances ──────────────────────────────────────────────────────
      await addIfMissing('attendances', 'marked_by_type',       { type: DT.STRING(20), defaultValue: 'manual' });
      await addIfMissing('attendances', 'biometric_punch_id',   { type: DT.BIGINT, allowNull: true });
      await addIfMissing('attendances', 'time_in',              { type: DT.TIME, allowNull: true });
      await addIfMissing('attendances', 'time_out',             { type: DT.TIME, allowNull: true });
      await addIfMissing('attendances', 'is_late',              { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('attendances', 'late_by_minutes',      { type: DT.INTEGER, defaultValue: 0 });
      await addIfMissing('attendances', 'is_half_day',          { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('attendances', 'source_meta',          { type: DT.JSONB, allowNull: true });
      await addIfMissing('attendances', 'version',              { type: DT.INTEGER, defaultValue: 1 });
      await addIfMissing('attendances', 'status',               { type: DT.STRING(20), defaultValue: 'present' });

      // ── Faculty Attendances ───────────────────────────────────────────────
      await addIfMissing('faculty_attendances', 'time_in',  { type: DT.TIME, allowNull: true });
      await addIfMissing('faculty_attendances', 'time_out', { type: DT.TIME, allowNull: true });

      // ── Biometric Settings ────────────────────────────────────────────────
      await addIfMissing('biometric_settings', 'attendance_mode',              { type: DT.STRING(20), defaultValue: 'class_based' });
      await addIfMissing('biometric_settings', 'subject_mode',                 { type: DT.STRING(20), defaultValue: 'automatic' });
      await addIfMissing('biometric_settings', 'enforce_subject_enrollment',   { type: DT.BOOLEAN, defaultValue: true });
      await addIfMissing('biometric_settings', 'notify_main_gate_in',         { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('biometric_settings', 'notify_main_gate_out',        { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('biometric_settings', 'notify_subject_in',           { type: DT.BOOLEAN, defaultValue: false });
      await addIfMissing('biometric_settings', 'notify_subject_out',          { type: DT.BOOLEAN, defaultValue: false });

      // ── Biometric Devices ─────────────────────────────────────────────────
      await addIfMissing('biometric_devices', 'device_type',       { type: DT.STRING(20), defaultValue: 'gate' });
      await addIfMissing('biometric_devices', 'room_identifier',   { type: DT.STRING(255), allowNull: true });

      // ── Institute Reviews & Gallery ───────────────────────────────────────
      await addIfMissing('institute_reviews',      'sort_order',   { type: DT.INTEGER, defaultValue: 0 });
      await addIfMissing('institute_reviews',      'is_approved',  { type: DT.BOOLEAN, defaultValue: true });
      await addIfMissing('institute_gallery_photos','sort_order',  { type: DT.INTEGER, defaultValue: 0 });

      // ── Student Fees ──────────────────────────────────────────────────────
      await addIfMissing('student_fees', 'reminder_date', { type: DT.DATEONLY, allowNull: true });

      // ── Exams & Marks ─────────────────────────────────────────────────────
      await addIfMissing('exams', 'exam_type',         { type: DT.STRING(20), defaultValue: 'unit_test', allowNull: false });
      await addIfMissing('exams', 'marks_locked',      { type: DT.BOOLEAN, defaultValue: false, allowNull: false });
      await addIfMissing('exams', 'marks_locked_at',   { type: DT.DATE, allowNull: true });
      await addIfMissing('exams', 'marks_locked_by',   { type: DT.INTEGER, allowNull: true });
      await addIfMissing('marks', 'is_absent',         { type: DT.BOOLEAN, defaultValue: false, allowNull: false });
      await addIfMissing('marks', 'remarks',           { type: DT.STRING(200), allowNull: true });

      // ── Timetable ─────────────────────────────────────────────────────────
      await addIfMissing('timetable_slots', 'class_id', { type: DT.INTEGER, allowNull: true });
      await addIfMissing('timetables', 'is_break',    { type: DT.BOOLEAN, defaultValue: false, allowNull: false });
      await addIfMissing('timetables', 'break_label', { type: DT.STRING(100), allowNull: true });
      // Make subject_id and faculty_id nullable for break rows
      try {
        await queryInterface.sequelize.query(`ALTER TABLE timetables ALTER COLUMN subject_id DROP NOT NULL;`, { transaction: t });
        await queryInterface.sequelize.query(`ALTER TABLE timetables ALTER COLUMN faculty_id DROP NOT NULL;`, { transaction: t });
      } catch (_) {}

      // ── Faculty Salaries ──────────────────────────────────────────────────
      await addIfMissing('faculty_salaries', 'payment_due_date', { type: DT.DATEONLY, allowNull: true });
      await addIfMissing('faculty_salaries', 'salary_slip_url',  { type: DT.STRING(500), allowNull: true });
      await addIfMissing('faculty_salaries', 'auto_generated',   { type: DT.BOOLEAN, defaultValue: false, allowNull: false });

      // ── Student Classes (Enrollment Journal for Academic Year Engine) ──────
      await addIfMissing('student_classes', 'academic_year_id',    { type: DT.INTEGER, allowNull: true });
      await addIfMissing('student_classes', 'enrollment_status',   { type: DT.STRING(20), defaultValue: 'active' });
      await addIfMissing('student_classes', 'enrolled_at',         { type: DT.DATEONLY, allowNull: true });
      await addIfMissing('student_classes', 'exited_at',           { type: DT.DATEONLY, allowNull: true });

      // ── Manager Type ENUM (PostgreSQL-safe) ───────────────────────────────
      try {
        await queryInterface.sequelize.query(`
          DO $$ BEGIN
            CREATE TYPE "enum_users_manager_type" AS ENUM ('fees', 'data', 'academic', 'ops', 'hr', 'custom');
          EXCEPTION WHEN duplicate_object THEN null;
          END $$;
        `, { transaction: t });
        await queryInterface.sequelize.query(
          `ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_type "enum_users_manager_type" DEFAULT 'custom';`,
          { transaction: t }
        );
      } catch (_) {}

      // ── Performance Indexes ───────────────────────────────────────────────
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_subs_created_at ON subscriptions (created_at);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_subs_is_test_created_at ON subscriptions (is_test, created_at);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_sub_inst_status ON subscriptions (institute_id, payment_status);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_sub_end_date ON subscriptions (end_date);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_students_inst_class ON students (institute_id, class_id);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_students_user ON students (user_id);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_att_student_date ON attendances (student_id, date);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_att_inst_date ON attendances (institute_id, date);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_att_class_date ON attendances (class_id, date);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_subjects_class_inst ON subjects (class_id, institute_id);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_faculty_inst ON faculty (institute_id);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_sfee_student ON student_fees (student_id, institute_id);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_sfee_due ON student_fees (due_date, status);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_exams_inst ON exams (institute_id, class_id);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_marks_exam_id ON marks (exam_id);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_marks_student_id ON marks (student_id);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_exams_locked ON exams (marks_locked);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_fs_institute_month ON faculty_salaries (institute_id, month_year);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_fs_faculty_month ON faculty_salaries (faculty_id, month_year);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_fs_status ON faculty_salaries (institute_id, status);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_fs_due_date ON faculty_salaries (payment_due_date);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_bulk_logs_institute ON bulk_import_logs (institute_id, created_at DESC);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_chatmsg_room_created ON chat_messages (room_id, created_at DESC);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_chatmsg_sender ON chat_messages (sender_id);`);
      await addIndex(`CREATE UNIQUE INDEX IF NOT EXISTS idx_chatpart_room_user ON chat_participants (room_id, user_id);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_chatpart_user ON chat_participants (user_id);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_chatroom_institute ON chat_rooms (institute_id, type);`);
      // Academic Year Promotion indexes
      await addIndex(`CREATE UNIQUE INDEX IF NOT EXISTS uq_one_current_year ON academic_years (institute_id) WHERE is_current = true;`);
      await addIndex(`CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_enrollment ON student_classes (student_id) WHERE enrollment_status = 'active';`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_sc_year ON student_classes (academic_year_id, class_id);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_promo_rules_inst ON promotion_rules (institute_id, sort_order);`);
      // Public page indexes
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_profile_slug ON institute_public_profiles (slug);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_gallery_inst ON institute_gallery_photos (institute_id);`);
      await addIndex(`CREATE INDEX IF NOT EXISTS idx_reviews_inst ON institute_reviews (institute_id);`);

      console.log('  [00-baseline] Baseline migration complete.');
    } catch (err) {
      console.error('  [00-baseline] Failed:', err.message);
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    for (const idx of idxNames) {
      try {
        await queryInterface.sequelize.query(`DROP INDEX IF EXISTS ${idx};`);
      } catch (_) {}
    }
  },
};
