const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Notification = sequelize.define("Notification", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        institute_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        type: {
            type: DataTypes.STRING(60),
            allowNull: false,
        },
        title: {
            type: DataTypes.STRING(200),
            allowNull: false,
        },
        body: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        data_json: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        is_read: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        archived_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    }, {
        tableName: "notifications",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
        indexes: [
            {
                fields: ["user_id", "is_read", "created_at"],
            },
            {
                fields: ["institute_id", "type", "created_at"],
            }
        ]
    });

module.exports = Notification;
