const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Faculty = sequelize.define("Faculty", {
    institute_id: DataTypes.INTEGER,
    user_id: DataTypes.INTEGER,
    designation: DataTypes.STRING,
    address: DataTypes.STRING(500),
    join_date: DataTypes.DATEONLY
}, {
    tableName: 'faculty',  // Explicitly set table name (database uses singular, not plural)
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false  // Database doesn't have updated_at column
});

module.exports = Faculty;
