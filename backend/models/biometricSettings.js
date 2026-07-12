const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const BiometricSettings = sequelize.define("BiometricSettings", {
    institute_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
    attendance_mode: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["class_based", "subject_based"]] },
        defaultValue: "class_based"
    },
    subject_mode: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["automatic", "manual"]] },
        defaultValue: "automatic"
    },
    enforce_subject_enrollment: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: true 
    },
    late_threshold_minutes: { type: DataTypes.INTEGER, defaultValue: 15 },
    half_day_threshold_minutes: { type: DataTypes.INTEGER, defaultValue: 120 },
    working_days: {
        type: DataTypes.JSONB,
        defaultValue: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    },
    class_start_time: { type: DataTypes.TIME, defaultValue: "09:00:00" },
    notify_parent_on_absent: { type: DataTypes.BOOLEAN, defaultValue: true },
    notify_parent_on_late: { type: DataTypes.BOOLEAN, defaultValue: false },
    notify_parent_on_present: { type: DataTypes.BOOLEAN, defaultValue: false },
    // Granular punch notifications
    notify_main_gate_in: { type: DataTypes.BOOLEAN, defaultValue: false },
    notify_main_gate_out: { type: DataTypes.BOOLEAN, defaultValue: false },
    notify_subject_in: { type: DataTypes.BOOLEAN, defaultValue: false },
    notify_subject_out: { type: DataTypes.BOOLEAN, defaultValue: false },
    duplicate_punch_window_secs: { type: DataTypes.INTEGER, defaultValue: 300 },
}, {
    tableName: "biometric_settings",
    timestamps: true,
    underscored: true,
});

module.exports = BiometricSettings;
