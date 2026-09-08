"use strict";

/**
 * Migration 06: Add port column to biometric_devices for TCP/IP LAN gateway
 *
 * port  INTEGER  — device TCP port (default 4370 for ZKTeco/Biomax devices)
 *
 * Nullable for backward-compatibility with existing devices.
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

        // Add port column (default 4370 — standard ZKTeco/Biomax TCP port)
        await addColSafe("biometric_devices", "port", {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
        });

        console.log("✅ Migration 06: Added port column to biometric_devices");
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn("biometric_devices", "port");
        console.log("⬇ Migration 06 rolled back");
    },
};
