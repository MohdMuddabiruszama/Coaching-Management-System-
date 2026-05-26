const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Announcement = sequelize.define("Announcement", {
    institute_id: DataTypes.INTEGER,
    title: DataTypes.STRING,
    content: DataTypes.TEXT,
    target_audience: {
        type: DataTypes.STRING(20),
        defaultValue: 'all',
        // accepts: all, students, faculty, parents
    },
    priority: {
        type: DataTypes.STRING(20),
        defaultValue: 'normal',
        validate: { isIn: [['normal', 'high', 'urgent']] }
    },
    created_by: DataTypes.INTEGER,
    subject_id: DataTypes.INTEGER,   // legacy: subject-specific announcement
    posted_by:    { type: DataTypes.STRING(200), allowNull: true },
    // ── Phase 1 new fields ──────────────────────────────────
    is_pinned:    { type: DataTypes.BOOLEAN, defaultValue: false },
    expires_at:   { type: DataTypes.DATE, allowNull: true },
    target_class: { type: DataTypes.INTEGER, allowNull: true },
    updated_at:   { type: DataTypes.DATE, allowNull: true },
});

module.exports = Announcement;
