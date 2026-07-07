const sequelize = require('./config/database');
const { models } = require('./models'); // Ensure models are loaded

async function fix() {
  try {
    console.log("Terminating other database connections to release locks...");
    const [res] = await sequelize.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE pid <> pg_backend_pid()
        AND datname = current_database();
    `);
    console.log("Killed other connections. Now altering schema...");
    
    // We import the actual db instance with models loaded.
    const db = require('./models');
    await db.sequelize.sync({ alter: true });
    
    console.log("Database schema successfully altered!");
    process.exit(0);
  } catch (e) {
    console.error("Error:", e);
    process.exit(1);
  }
}

fix();
