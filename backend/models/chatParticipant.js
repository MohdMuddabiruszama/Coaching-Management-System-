const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ChatParticipant = sequelize.define("ChatParticipant", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    room_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: "chat_rooms",
            key: "id",
        },
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: "users",
            key: "id",
        },
    },
    role: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    last_read_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    timestamps: false,
    tableName: "chat_participants",
    indexes: [
        { unique: true, fields: ["room_id", "user_id"] },
        { fields: ["user_id"] },
        { fields: ["user_id", "last_read_at"] },
    ]
});

module.exports = ChatParticipant;
