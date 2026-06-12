const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const TimetableSlot = sequelize.define("TimetableSlot", {
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
    start_time: {
        type: DataTypes.TIME,
        allowNull: false,
    },
    end_time: {
        type: DataTypes.TIME,
        allowNull: false,
    },
}, {
    tableName: "timetable_slots",
    timestamps: true,
});

module.exports = TimetableSlot;
