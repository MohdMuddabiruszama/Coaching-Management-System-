/**
 * add_phone_index.js
 * ─────────────────
 * One-time migration: adds an index on users.phone for fast phone-based login lookups.
 * Run once: node backend/scripts/add_phone_index.js
 */

const sequelize = require("../config/database");

async function addPhoneIndex() {
    const qi = sequelize.getQueryInterface();
    const indexName = "idx_users_phone";

    try {
        // Check if index already exists to make this script idempotent
        const [results] = await sequelize.query(`SELECT indexname FROM pg_indexes WHERE tablename = 'users' AND indexname = '${indexName}'`);
        if (results.length > 0) {
            console.log(`✅ Index '${indexName}' already exists — skipping.`);
        } else {
            await qi.addIndex("users", ["phone"], {
                name: indexName,
                type: "INDEX"
            });
            console.log(`✅ Index '${indexName}' created on users.phone successfully.`);
        }
    } catch (err) {
        console.error("❌ Failed to create index:", err.message);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

addPhoneIndex();
