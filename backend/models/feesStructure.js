const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const FeesStructure = sequelize.define("FeesStructure", {
    institute_id: DataTypes.INTEGER,
    class_id: DataTypes.INTEGER,
    subject_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    individual_student_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    fee_type: DataTypes.STRING,
    amount: DataTypes.DECIMAL(10, 2),
    due_date: DataTypes.DATEONLY,
    description: DataTypes.TEXT,
}, {
    tableName:  'fee_structures',
    timestamps: true,
    paranoid:   true,   // ✅ Soft delete
});

module.exports = FeesStructure;
