const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const BiometricDevice = sequelize.define("BiometricDevice", {
    institute_id: { type: DataTypes.INTEGER, allowNull: false },
    device_name: { type: DataTypes.STRING(100), allowNull: false },
    device_serial: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    device_type: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["fingerprint", "face", "rfid", "mobile"]] },
        defaultValue: "fingerprint"
    },
    placement_type: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["gate", "classroom"]] },
        defaultValue: "gate"
    },
    room_identifier: { type: DataTypes.STRING(255), allowNull: true },
    location: { type: DataTypes.STRING(100) },
    ip_address: { type: DataTypes.STRING(45) },
    secret_key: { type: DataTypes.STRING(255), allowNull: false },
    status: {
        type: DataTypes.STRING(20),
        // active = normal operation
        // inactive = admin-disabled
        // offline = not seen in > 48h
        // pending = setup wizard in progress (awaiting first punch)
        // connected = first punch received during wizard — confirmed working
        validate: { isIn: [["active", "inactive", "offline", "pending", "connected"]] },
        defaultValue: "active"
    },
    last_sync: { type: DataTypes.DATE },
    // ── Multi-brand device catalog fields (Migration 05) ──────────
    // brand: which manufacturer — 'zkteco' | 'essl' | 'biomax' | 'suprema' | 'realtime' | 'simulator'
    brand: { type: DataTypes.STRING(50), allowNull: true },
    // connection_type: how the device sends punches to us
    connection_type: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    // device_token: per-device webhook token — used in /api/biometric/webhook/:deviceToken
    // Generated at registration time, never changes. Stored unhashed (random 32-byte hex).
    device_token: { type: DataTypes.STRING(64), allowNull: true, unique: true },
    // last_punch_at: timestamp of last successful punch — drives live status monitoring
    // Connected: < 15 min ago | Not seen in 24h: 15min–24h | Offline: > 24h
    last_punch_at: { type: DataTypes.DATE, allowNull: true },
}, {
    tableName: "biometric_devices",
    timestamps: true,
    underscored: true,
});

module.exports = BiometricDevice;
