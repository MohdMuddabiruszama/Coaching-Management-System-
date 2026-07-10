const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const FacultyPeriodAttendance = sequelize.define("FacultyPeriodAttendance", {
    institute_id: { type: DataTypes.INTEGER, allowNull: false },
    faculty_id: { type: DataTypes.INTEGER, allowNull: false },
    timetable_entry_id: { type: DataTypes.INTEGER, allowNull: true },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    status: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["present", "absent", "late", "half_day", "holiday"]] }
    },
    marked_by_type: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["manual", "qr", "biometric"]] },
        defaultValue: "manual"
    },
    marked_by: { type: DataTypes.INTEGER, allowNull: true },
    source_meta: { type: DataTypes.JSON, allowNull: true },
    version: { type: DataTypes.INTEGER, defaultValue: 1 },
    time_in: { type: DataTypes.TIME, allowNull: true },
    time_out: { type: DataTypes.TIME, allowNull: true },
    remarks: { type: DataTypes.TEXT, allowNull: true },
}, {
    tableName: "faculty_period_attendances",
    timestamps: true,
    underscored: true,
    indexes: [
        {
            name: "faculty_period_attendance_unique",
            unique: true,
            fields: ["institute_id", "faculty_id", "date", "timetable_entry_id"]
        }
    ]
});

module.exports = FacultyPeriodAttendance;
