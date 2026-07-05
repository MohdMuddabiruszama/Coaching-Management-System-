const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const NotificationPref = sequelize.define("NotificationPref", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        type: {
            type: DataTypes.STRING(60),
            allowNull: false,
        },
        push_enabled: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        email_enabled: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        quiet_start: {
            type: DataTypes.TIME,
            allowNull: true,
        },
        quiet_end: {
            type: DataTypes.TIME,
            allowNull: true,
        },
    }, {
        tableName: "notification_prefs",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
        indexes: [
            {
                unique: true,
                fields: ["user_id", "type"],
            }
        ]
    });

module.exports = NotificationPref;
