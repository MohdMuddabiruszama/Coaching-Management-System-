"use strict";

/**
 * Migration 05: Add brand, connection_type, device_token, last_punch_at to biometric_devices
 *
 * brand           VARCHAR(50)   — 'zkteco' | 'essl' | 'biomax' | 'suprema' | 'realtime' | 'simulator'
 * connection_type VARCHAR(20)   — 'lan_push' | 'cloud_gateway'
 * device_token    VARCHAR(64)   — per-device webhook URL token (UNIQUE)
 * last_punch_at   TIMESTAMP     — timestamp of last successful punch (for status monitoring)
 *
 * All columns nullable for backward-compatibility with existing devices.
 */

const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface, Sequelize) {
        const addColSafe = async (table, col, opts) => {
            try {
                await queryInterface.addColumn(table, col, opts);
            } catch(e) {
                if (!e.message.includes('already exists')) {
                    throw e;
                }
            }
        };

        // Add brand column
        await addColSafe("biometric_devices", "brand", {
            type: DataTypes.STRING(50),
            allowNull: true,
            defaultValue: null,
        });

        // Add connection_type column
        await addColSafe("biometric_devices", "connection_type", {
            type: DataTypes.STRING(20),
            allowNull: true,
            defaultValue: null,
        });

        // Add device_token column (unique per device — used in webhook URL)
        await addColSafe("biometric_devices", "device_token", {
            type: DataTypes.STRING(64),
            allowNull: true,
            defaultValue: null,
            unique: true,
        });

        // Add last_punch_at column (replaces last_sync for status monitoring)
        await addColSafe("biometric_devices", "last_punch_at", {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null,
        });

        // Add index on device_token for O(1) webhook lookup
        try {
            await queryInterface.addIndex("biometric_devices", ["device_token"], {
                name: "idx_biometric_devices_token",
                unique: true,
                where: { device_token: { [require("sequelize").Op.ne]: null } },
            });
        } catch(e) {
            if (!e.message.includes('already exists')) throw e;
        }

        console.log("✅ Migration 05: Added brand, connection_type, device_token, last_punch_at to biometric_devices");
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeIndex("biometric_devices", "idx_biometric_devices_token").catch(() => {});
        await queryInterface.removeColumn("biometric_devices", "last_punch_at");
        await queryInterface.removeColumn("biometric_devices", "device_token");
        await queryInterface.removeColumn("biometric_devices", "connection_type");
        await queryInterface.removeColumn("biometric_devices", "brand");

        console.log("⬇ Migration 05 rolled back");
    },
};
