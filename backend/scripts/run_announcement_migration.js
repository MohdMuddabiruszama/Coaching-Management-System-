/**
 * Run this script ONCE to apply the Smart Announcement System DB migration.
 * Usage: node backend/scripts/run_announcement_migration.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const sequelize = require("../config/database");

async function runMigration() {
    const queryInterface = sequelize.getQueryInterface();

    console.log("🚀 Starting Smart Announcement System migration...");

    try {
        // 1. Get existing columns in announcements table
        const tableDesc = await queryInterface.describeTable("announcements");
        const existingCols = Object.keys(tableDesc);
        console.log("   Existing columns:", existingCols.join(", "));

        // 2. Add missing columns (safe — won't duplicate)
        const addColumn = async (colName, type) => {
            if (!existingCols.includes(colName)) {
                await queryInterface.addColumn("announcements", colName, type);
                console.log(`   ✅ Added column: ${colName}`);
            } else {
                console.log(`   ⏭  Column already exists: ${colName}`);
            }
        };

        const { DataTypes } = require("sequelize");

        await addColumn("is_pinned",    { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false });
        await addColumn("expires_at",   { type: DataTypes.DATE, allowNull: true });
        await addColumn("updated_at",   { type: DataTypes.DATE, allowNull: true });
        await addColumn("target_class", { type: DataTypes.INTEGER, allowNull: true });
        await addColumn("posted_by",    { type: DataTypes.STRING(200), allowNull: true });

        // 3. Create announcement_reads table if not exists
        const tables = await queryInterface.showAllTables();
        if (!tables.includes("announcement_reads")) {
            await queryInterface.createTable("announcement_reads", {
                id: {
                    type: DataTypes.INTEGER,
                    autoIncrement: true,
                    primaryKey: true,
                },
                announcement_id: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: { model: "announcements", key: "id" },
                    onDelete: "CASCADE",
                },
                user_id: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: { model: "users", key: "id" },
                    onDelete: "CASCADE",
                },
                read_at: {
                    type: DataTypes.DATE,
                    defaultValue: DataTypes.NOW,
                    allowNull: false,
                },
            });
            console.log("   ✅ Created table: announcement_reads");

            // Add unique constraint
            await sequelize.query(
                `ALTER TABLE announcement_reads ADD CONSTRAINT uq_ann_user UNIQUE (announcement_id, user_id);`
            );
            console.log("   ✅ Added unique constraint: uq_ann_user");

            // Add indexes
            await queryInterface.addIndex("announcement_reads", ["user_id"], { name: "idx_ann_reads_user" });
            await queryInterface.addIndex("announcements", ["institute_id"], { name: "idx_ann_institute" });
            console.log("   ✅ Indexes created");
        } else {
            console.log("   ⏭  Table already exists: announcement_reads");
        }

        console.log("\n✅ Migration complete! Smart Announcement System DB is ready.");
    } catch (err) {
        console.error("❌ Migration failed:", err.message);
        console.error(err);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

runMigration();
