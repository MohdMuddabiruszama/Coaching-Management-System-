const sequelize = require('./config/database');

async function fixMigrate() {
  try {
    console.log("Adding placement_type to biometric_devices...");
    await sequelize.query(`
      ALTER TABLE biometric_devices 
      ADD COLUMN IF NOT EXISTS placement_type VARCHAR(20) DEFAULT 'gate';
    `);

    console.log("Schema fix successfully!");
    process.exit(0);
  } catch (e) {
    console.error("Error:", e);
    process.exit(1);
  }
}

fixMigrate();
