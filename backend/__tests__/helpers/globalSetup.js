/**
 * Global Jest Setup
 * Runs ONCE before all test suites.
 * - Loads .env.test
 * - Verifies the test database connection
 */

const path = require("path");

module.exports = async () => {
  // Load test environment variables
  require("dotenv").config({ path: path.resolve(__dirname, "../../.env.test") });

  console.log("\n🧪 ZenithFlows — Test Suite Starting");
  console.log(`   DB : ${process.env.DATABASE_URL}`);
  console.log(`   ENV: ${process.env.NODE_ENV}\n`);

  try {
    const { sequelize } = require("../../models");
    await sequelize.sync({ force: true });
    console.log("   ✅ Test database synchronized");
  } catch (error) {
    console.error("   ❌ Failed to sync test database:", error.message);
  }
};
