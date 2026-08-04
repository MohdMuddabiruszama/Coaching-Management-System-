const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const AuditLog = sequelize.define("AuditLog", {
    // ── Existing fields (preserved) ──────────────────────────────────────────
    institute_id: DataTypes.INTEGER,
    user_id:      DataTypes.INTEGER,
    user_role:    DataTypes.STRING(30),
    user_name:    DataTypes.STRING,
    method:       DataTypes.STRING(10),
    path:         DataTypes.STRING(500),
    action:       DataTypes.STRING(80),
    resource:     DataTypes.STRING(80),
    status_code:  DataTypes.INTEGER,
    ip_address:   DataTypes.STRING(80),
    user_agent:   DataTypes.TEXT,
    request_id:   DataTypes.STRING(80),
    metadata: {
        type:         DataTypes.JSONB,
        defaultValue: {},
    },
    // ── Extended fields (Phase 4 — full audit trail) ─────────────────────────
    entity_type: {
        type:      DataTypes.STRING(50),
        allowNull: true,
        comment:   'e.g. Student, Fee, Exam, Institute, Faculty',
    },
    entity_id: {
        type:      DataTypes.INTEGER,
        allowNull: true,
        comment:   'Primary key of the affected row',
    },
    old_value: {
        type:      DataTypes.JSONB,
        allowNull: true,
        comment:   'Full row data BEFORE the change',
    },
    new_value: {
        type:      DataTypes.JSONB,
        allowNull: true,
        comment:   'Full row data AFTER the change',
    },
    remarks: {
        type:      DataTypes.TEXT,
        allowNull: true,
    },
}, {
    tableName: "audit_logs",
    timestamps: true,
    updatedAt:  false,
});

module.exports = AuditLog;
