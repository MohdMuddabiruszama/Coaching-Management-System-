const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const DeviceToken = sequelize.define("DeviceToken", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        fcm_token: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        platform: {
            type: DataTypes.ENUM("android", "ios", "web"),
            allowNull: true,
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        last_seen: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    }, {
        tableName: "device_tokens",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
        indexes: [
            {
                fields: ["user_id", "is_active"],
            }
        ]
    });

module.exports = DeviceToken;
