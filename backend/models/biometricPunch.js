const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const BiometricPunch = sequelize.define("BiometricPunch", {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    institute_id: { type: DataTypes.INTEGER, allowNull: false },
    device_id: { type: DataTypes.INTEGER, allowNull: false },
    device_user_id: { type: DataTypes.STRING(50), allowNull: false },
    punch_time: { type: DataTypes.DATE, allowNull: false },
    punch_type: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["in", "out", "break"]] },
        defaultValue: "in"
    },
    raw_payload: { type: DataTypes.JSONB },
    processed: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
    tableName: "biometric_punches",
    timestamps: true,
    underscored: true,
    indexes: [
        {
            name: "idx_bp_device_user_time",
            fields: ["device_id", "device_user_id", "punch_time"]
        }
    ]
});

module.exports = BiometricPunch;
