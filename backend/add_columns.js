const sequelize = require('./config/database');

async function fix() {
  try {
    console.log("Terminating locks...");
    await sequelize.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE pid <> pg_backend_pid()
        AND datname = current_database();
    `);

    console.log("Adding 'source' column to refresh_tokens...");
    await sequelize.query(`
      ALTER TABLE refresh_tokens 
      ADD COLUMN IF NOT EXISTS source VARCHAR(255) DEFAULT 'web';
    `);

    console.log("Adding 'source' column to leads...");
    await sequelize.query(`
      ALTER TABLE leads 
      ADD COLUMN IF NOT EXISTS source VARCHAR(255) DEFAULT 'landing-page-contact';
    `);

    console.log("Schema manually altered successfully!");
    process.exit(0);
  } catch (e) {
    console.error("Error:", e);
    process.exit(1);
  }
}

fix();
