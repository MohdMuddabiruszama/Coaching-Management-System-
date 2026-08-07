const { Client } = require("pg");
require("dotenv").config();

async function kill() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const res = await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND state IN ('idle', 'idle in transaction');
    `);
    console.log("Terminated idle connections:", res.rowCount);
    await client.end();
}
kill().catch(console.error);
