const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Timetable = sequelize.define("Timetable", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    institute_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    class_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    subject_id: {
        type: DataTypes.INTEGER,
        allowNull: true, // null for break periods
    },
    faculty_id: {
        type: DataTypes.INTEGER,
        allowNull: true, // null for break periods
    },
    slot_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    day_of_week: {
        type: DataTypes.STRING(20),
        validate: { isIn: [['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']] },
        allowNull: false,
    },
    room_number: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    is_break: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    },
    break_label: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'Break',
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
    }
}, {
    tableName: "timetables",
    timestamps: true,
});

module.exports = Timetable;
