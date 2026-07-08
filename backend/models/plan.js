/**
 * Plan Model
 * Defines subscription plans with limits and features.
 * 26 features across 4 tiers × 2 platforms (web_only / web_android).
 */

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Plan = sequelize.define("Plan", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },

    // ─── Trial ─────────────────────────────────────────────────────────────────
    is_free_trial: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    trial_days: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },

    // ─── Core Limits ───────────────────────────────────────────────────────────
    max_students: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 100
    },
    max_faculty: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5
    },
    max_classes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5
    },
    max_admin_users: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    max_managers: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    max_branches: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    max_storage_mb: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1024    // 1 GB default
    },
    max_ai_messages: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 50
    },
    max_chat_messages: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 500
    },
    max_biometric_devices: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },

    // ─── Platform & Billing ────────────────────────────────────────────────────
    platform_type: {
        type: DataTypes.STRING(20),
        validate: { isIn: [['web_only', 'web_android', 'all']] },
        defaultValue: 'web_only'
    },
    // ID of the paired plan (e.g. Basic web_only ↔ Basic web_android)
    paired_plan_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    yearly_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    yearly_discount_percent: {
        type: DataTypes.INTEGER,
        defaultValue: 17   // ~2 months free = 16.67%
    },
    gst_percent: {
        type: DataTypes.INTEGER,
        defaultValue: 2
    },
    // If true, CTA shows "Contact Sales" — no public price
    contact_sales: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },

    // ─── Marketing Feature Count (matches spec: 12 / 18 / 24 / 26) ────────────
    feature_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },

    // ─── Core Features (always enabled) ───────────────────────────────────────
    feature_students: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    feature_faculty: {
        type: DataTypes.BOOLEAN,
        defaultValue: false   // OFF for Starter, ON for Basic+
    },
    feature_classes: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    feature_subjects: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },

    // ─── Attendance ────────────────────────────────────────────────────────────
    feature_attendance: {
        type: DataTypes.STRING(10),
        validate: { isIn: [["none", "basic", "advanced"]] },
        defaultValue: "basic"
    },
    feature_auto_attendance: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // Feature 5: Scan Student QR (Starter+)
    feature_scan_qr: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // Feature 9: Faculty Attendance (Basic+)
    feature_faculty_attendance: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // Features 10+11: View Faculty Tracker + Scan Faculty QR (Basic+)
    feature_faculty_tracker: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // Feature 25: Biometric Attendance (Pro+)
    feature_biometric: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },

    // ─── Finance & Fees ────────────────────────────────────────────────────────
    // Feature 13: Collect Fees (Starter+)
    feature_fees: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // Feature 14: Finances & Expenses (Basic+)
    feature_finance: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_expenses: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_salary: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },

    // ─── Academics ─────────────────────────────────────────────────────────────
    // Feature 16: Manage Exams (Basic+)
    feature_exams: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // Feature 17: Master Timetable (Basic+)
    feature_timetable: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // Feature 21: Assignments (Starter+)
    feature_assignment: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },

    // ─── Communication & Content ───────────────────────────────────────────────
    // Feature 18: Announcements (Starter+)
    feature_announcements: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // Feature 19: All Notes (Starter+)
    feature_notes: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // Feature 20: Chat Monitor (Basic+)
    feature_chat: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },

    // ─── Reports & Analytics ───────────────────────────────────────────────────
    // Feature 15: Reports & Analytics (Basic+ = basic, Pro+ = advanced)
    feature_reports: {
        type: DataTypes.STRING(10),
        validate: { isIn: [["none", "basic", "advanced"]] },
        defaultValue: "none"
    },
    // Feature 23: Exam Reports (Basic+)
    feature_export: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // Features 24+26: Student + Faculty Performance Analytics (Pro+)
    feature_performance_analytics: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // Legacy alias kept for backward compat with planLimits.middleware
    feature_performance_hub: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },

    // ─── Notifications ─────────────────────────────────────────────────────────
    feature_email: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_sms: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_whatsapp: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },

    // ─── Premium / Branding ────────────────────────────────────────────────────
    feature_custom_branding: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // Feature: Multi-Branch Management (Enterprise)
    feature_multi_branch: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_api_access: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // Feature 7: Manage Parents / Parent Portal (Basic+)
    feature_parent_portal: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // Feature 22: Institute Public Web Page (Starter+)
    feature_public_page: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_transport: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },

    // ─── Mobile App Features ───────────────────────────────────────────────────
    feature_mobile_app: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_push_notifications: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_offline_attendance: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_parent_app: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_student_app: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_mobile_biometric: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },

    // ─── Plan Status & Display ─────────────────────────────────────────────────
    status: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["active", "inactive", "archived"]] },
        defaultValue: "active"
    },
    is_popular: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_hidden: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    display_order: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },

    // ─── Razorpay ──────────────────────────────────────────────────────────────
    razorpay_plan_id: {
        type: DataTypes.STRING,
        allowNull: true
    },

    // ─── Lifetime Plan ─────────────────────────────────────────────────────────
    is_lifetime: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    lifetime_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    lifetime_slots_total: {
        type: DataTypes.INTEGER,
        defaultValue: 100
    },
    lifetime_slots_used: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    max_students_lifetime: {
        type: DataTypes.INTEGER,
        defaultValue: -1
    },
    max_faculty_lifetime: {
        type: DataTypes.INTEGER,
        defaultValue: -1
    },
    max_managers_lifetime: {
        type: DataTypes.INTEGER,
        defaultValue: -1
    },
    lifetime_bonus_subdomain: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    lifetime_bonus_priority_support: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    lifetime_bonus_unlimited_export: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    timestamps: true,
    tableName: "plans"
});

module.exports = Plan;
