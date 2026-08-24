const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const FacultyAttendance = sequelize.define("FacultyAttendance", {
    institute_id: DataTypes.INTEGER,
    faculty_id: DataTypes.INTEGER,
    date: DataTypes.DATEONLY,
    status: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["present", "absent", "late", "half_day", "holiday"]] }
    },
    marked_by: DataTypes.INTEGER, // admin ID who marked it or self if smart QR
    remarks: DataTypes.TEXT,
    marked_by_type: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["manual", "qr", "biometric"]] },
        defaultValue: "manual"
    },
    source_meta: { type: DataTypes.JSON, allowNull: true },
    version: { type: DataTypes.INTEGER, defaultValue: 1 },
    time_in: { type: DataTypes.TIME, allowNull: true },
    time_out: { type: DataTypes.TIME, allowNull: true },
}, {
    tableName: "faculty_attendances",
    timestamps: true,
    underscored: true,
    indexes: [
        {
            name: "faculty_attendance_unique_daily",
            unique: true,
            fields: ["institute_id", "faculty_id", "date"]
        },
        {
            name: "idx_faculty_attendance_report",
            fields: ["institute_id", "status", "marked_by_type", "date"]
        }
    ]
});

module.exports = FacultyAttendance;
