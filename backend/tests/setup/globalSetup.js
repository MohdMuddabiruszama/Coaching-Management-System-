const { Client } = require("pg");
require("dotenv").config(); // Load backend/.env

module.exports = async () => {
  console.log("\n[Global Setup] Initializing test schema...");

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL is missing in .env");
  }

  // Connect directly to the provided database
  const client = new Client({ connectionString: dbUrl });
  
  try {
    await client.connect();

    // 1. Drop the schema if it exists from a previous crashed run
    await client.query("DROP SCHEMA IF EXISTS student_saas_test CASCADE");

    // 2. Create fresh test schema
    await client.query("CREATE SCHEMA student_saas_test");

    console.log("[Global Setup] Schema 'student_saas_test' created successfully.");
  } catch (err) {
    console.error("[Global Setup] Failed to create test schema:");
    console.error(err.message);
    process.exit(1);
  } finally {
    await client.end();
  }

  // Set test mode
  process.env.NODE_ENV = "test";
};
