const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const UsageTracker = sequelize.define("UsageTracker", {
    institute_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    metric: {
        type: DataTypes.STRING(30),
        allowNull: false,
        validate: {
            isIn: [["ai_messages", "storage_mb", "sms_sent", "whatsapp_sent", "chat_messages"]]
        }
    },
    current_value: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    limit_value: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    billing_period_start: {
        type: DataTypes.DATEONLY
    },
    billing_period_end: {
        type: DataTypes.DATEONLY
    },
    last_reset_at: {
        type: DataTypes.DATE
    }
}, {
    tableName: "usage_trackers",
    timestamps: true
});

module.exports = UsageTracker;
