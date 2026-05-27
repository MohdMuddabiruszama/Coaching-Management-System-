/**
 * Plan Model
 * Defines subscription plans with limits and features.
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

    // Limits
    is_free_trial: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    trial_days: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
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

    // Core Features
    feature_students: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    feature_faculty: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    feature_classes: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    feature_subjects: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },

    // Advanced Features
    feature_attendance: {
        type: DataTypes.STRING(10),
        validate: { isIn: [["none", "basic", "advanced"]] },
        defaultValue: "basic"
    },
    feature_auto_attendance: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_fees: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_finance: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_salary: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_reports: {
        type: DataTypes.STRING(10),
        validate: { isIn: [["none", "basic", "advanced"]] },
        defaultValue: "none"
    },
    feature_announcements: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_exams: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_export: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
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
    feature_timetable: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_notes: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_chat: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },

    // Platform and billing
    platform_type: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["web_only", "web_android", "all"]] },
        defaultValue: "web_only"
    },
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
        defaultValue: 20
    },
    contact_sales: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },

    // Extended usage limits
    max_branches: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    max_storage_mb: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1024
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

    // Mobile features
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

    // Display
    display_order: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },

    // ─── Platform & Billing ────────────────────────────────────────────────────
    platform_type: {
        type: DataTypes.STRING(20),
        validate: { isIn: [['web_only', 'web_android', 'all']] },
        defaultValue: 'web_only'
    },
    // ID of the paired plan (e.g. Growth web_only links to Growth+ web_android)
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
        defaultValue: 20
    },
    // If true, CTA shows "Contact Sales" — no public price shown
    contact_sales: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },

    // ─── Usage Limits ──────────────────────────────────────────────────────────
    max_branches: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    max_storage_mb: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1024  // 1 GB default
    },
    max_ai_messages: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 50
    },
    max_biometric_devices: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },

    // ─── Mobile-Specific Features ──────────────────────────────────────────────
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

    // ─── Display ───────────────────────────────────────────────────────────────
    display_order: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },

    // Premium Features
    feature_custom_branding: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_multi_branch: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_api_access: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_parent_portal: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_mobile_app: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_public_page: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_assignment: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_performance_hub: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    feature_transport: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },

    // Plan Status
    status: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["active", "inactive", "archived"]] },
        defaultValue: "active"
    },
    is_popular: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },

    // Razorpay Orders API integration stores one-time payment references elsewhere.
    razorpay_plan_id: {
        type: DataTypes.STRING,
        allowNull: true
    },

    // Lifetime Plan Fields
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
