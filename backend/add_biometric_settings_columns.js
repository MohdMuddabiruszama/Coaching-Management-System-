const sequelize = require('./config/database');

async function migrate() {
  try {
    console.log("Terminating locks...");
    await sequelize.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE pid <> pg_backend_pid()
        AND datname = current_database();
    `);

    console.log("Adding columns to biometric_settings...");
    await sequelize.query(`
      ALTER TABLE biometric_settings 
      ADD COLUMN IF NOT EXISTS attendance_mode VARCHAR(20) DEFAULT 'class_based',
      ADD COLUMN IF NOT EXISTS subject_mode VARCHAR(20) DEFAULT 'automatic';
    `);

    console.log("Adding columns to biometric_devices...");
    await sequelize.query(`
      ALTER TABLE biometric_devices 
      ADD COLUMN IF NOT EXISTS device_type VARCHAR(20) DEFAULT 'gate',
      ADD COLUMN IF NOT EXISTS room_identifier VARCHAR(255) NULL;
    `);

    console.log("Schema manually altered successfully!");
    process.exit(0);
  } catch (e) {
    console.error("Error:", e);
    process.exit(1);
  }
}

migrate();
