const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ChatMessage = sequelize.define("ChatMessage", {
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
    sender_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: "users",
            key: "id",
        },
    },
    sender_role: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: true, // Can be null if only an attachment is sent
    },
    attachment_url: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    attachment_type: {
        type: DataTypes.STRING,
        allowNull: true,
    },
}, {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    tableName: "chat_messages",
    indexes: [
        { fields: ["room_id", "created_at"] },
        { fields: ["sender_id"] },
    ]
});

module.exports = ChatMessage;
