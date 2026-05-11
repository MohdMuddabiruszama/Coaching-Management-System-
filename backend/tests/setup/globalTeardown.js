const { Client } = require("pg");
require("dotenv").config();

module.exports = async () => {
  console.log("\n[Global Teardown] Cleaning up test schema...");

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return;

  const client = new Client({ connectionString: dbUrl });
  
  try {
    await client.connect();

    // Drop the test schema
    await client.query("DROP SCHEMA IF EXISTS student_saas_test CASCADE");

    console.log("[Global Teardown] Schema 'student_saas_test' dropped successfully.");
  } catch (err) {
    console.error("[Global Teardown] Failed to drop test schema:", err.message);
  } finally {
    await client.end();
  }
};
