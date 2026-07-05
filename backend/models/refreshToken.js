/**
 * ✅ Phase 7: Refresh Token Model
 * Stores refresh tokens in DB for secure session management.
 * Enables: token revocation, "view active sessions", "logout all devices".
 */
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const RefreshToken = sequelize.define("RefreshToken", {
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    token_hash: {
        type: DataTypes.STRING(128),
        allowNull: false,
        unique: true,
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    device_info: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    source: {
        type: DataTypes.ENUM('web', 'mobile'),
        allowNull: true,
        defaultValue: 'web'
    },
    ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
    },
    is_revoked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
}, {
    tableName: "refresh_tokens",
    timestamps: true,
    underscored: true,
    indexes: [
        { fields: ["user_id"] },
        { fields: ["token_hash"], unique: true },
        { fields: ["expires_at"] },
    ],
});

module.exports = RefreshToken;
