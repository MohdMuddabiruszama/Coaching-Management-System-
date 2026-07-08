const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Institute = sequelize.define("Institute", {
    plan_id: DataTypes.INTEGER,
    name: DataTypes.STRING,
    email: { type: DataTypes.STRING, allowNull: false, unique: 'unique_institute_email' },
    phone: DataTypes.STRING,
    address: DataTypes.TEXT,
    city: DataTypes.STRING,
    state: DataTypes.STRING,
    zip_code: DataTypes.STRING,
    logo: DataTypes.STRING,
    subscription_start: DataTypes.DATEONLY,
    subscription_end: DataTypes.DATEONLY,
    status: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["active", "expired", "suspended", "pending"]] }
    },
    email_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    has_used_trial: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },


    // Snapshot of Plan Limits (for grandfathering)
    current_limit_students: {
        type: DataTypes.INTEGER,
        defaultValue: 50 // Default Basic
    },
    current_limit_faculty: {
        type: DataTypes.INTEGER,
        defaultValue: 5
    },
    current_limit_classes: {
        type: DataTypes.INTEGER,
        defaultValue: 5
    },
    current_limit_admins: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    current_limit_managers: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },

    // Snapshot of Features (for grandfathering)
    current_feature_attendance: {
        type: DataTypes.STRING(10),
        validate: { isIn: [['none', 'basic', 'advanced']] },
        defaultValue: 'basic'
    },
    current_feature_auto_attendance: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    current_feature_fees: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    current_feature_finance: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    current_feature_expenses: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    current_feature_salary: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    current_feature_reports: {
        type: DataTypes.STRING(10),
        validate: { isIn: [['none', 'basic', 'advanced']] },
        defaultValue: 'none'
    },
    current_feature_announcements: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    current_feature_export: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    current_feature_timetable: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    current_feature_whatsapp: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    current_feature_custom_branding: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    current_feature_multi_branch: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    current_feature_api_access: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    current_feature_public_page: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    current_feature_assignment: {
        type: DataTypes.BOOLEAN,
        allowNull: true
    },
    current_feature_performance_hub: {
        type: DataTypes.BOOLEAN,
        allowNull: true
    },
    current_feature_transport: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    current_feature_mobile_app: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    current_feature_chat: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    add_on_expiries: {
        type: DataTypes.JSON,
        defaultValue: {}
    },
    current_platform_type: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["web_only", "web_android", "all"]] },
        defaultValue: "web_only"
    },
    current_billing_cycle: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["monthly", "yearly", "lifetime"]] },
        defaultValue: "monthly"
    },
    current_limit_branches: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    current_limit_storage_mb: {
        type: DataTypes.INTEGER,
        defaultValue: 1024
    },
    current_limit_ai_messages: {
        type: DataTypes.INTEGER,
        defaultValue: 50
    },
    current_limit_chat_messages: {
        type: DataTypes.INTEGER,
        defaultValue: 500
    },
    current_feature_push_notifications: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    current_feature_offline_attendance: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    current_feature_parent_app: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    current_feature_student_app: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    trial_ends_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    grace_period_ends_at: {
        type: DataTypes.DATE,
        allowNull: true
    },

    // ─── Lifetime Membership Fields ──────────────────────────────────────────
    is_lifetime_member: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    lifetime_purchased_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    lifetime_plan_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    founding_member: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    custom_subdomain: {
        type: DataTypes.STRING(100),
        allowNull: true
    }
});

module.exports = Institute;
