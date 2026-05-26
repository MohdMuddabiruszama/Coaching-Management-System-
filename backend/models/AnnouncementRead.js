/**
 * AnnouncementRead model
 * Tracks which user has read which announcement.
 * Phase 1 — Smart Announcement System
 */
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const AnnouncementRead = sequelize.define(
    "AnnouncementRead",
    {
        announcement_id: { type: DataTypes.INTEGER, allowNull: false },
        user_id:         { type: DataTypes.INTEGER, allowNull: false },
        read_at:         { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    {
        tableName: "announcement_reads",
        timestamps: false,
        indexes: [
            {
                unique: true,
                fields: ["announcement_id", "user_id"],
                name: "uq_ann_user",
            },
        ],
    }
);

module.exports = AnnouncementRead;
