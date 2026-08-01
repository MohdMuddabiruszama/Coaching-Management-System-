const { sequelize } = require('./models');

async function checkTables() {
    try {
        const [results] = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public';
        `);
        console.log("TABLES:", results.map(r => r.table_name));

        // Let's add the columns with unquoted names if they exist
        console.log("Adding to institutes and subscriptions (unquoted)...");
        await sequelize.query(`ALTER TABLE institutes ADD COLUMN IF NOT EXISTS is_test_account BOOLEAN DEFAULT false;`);
        await sequelize.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT false;`);
        console.log("Success");
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit();
}

checkTables();
