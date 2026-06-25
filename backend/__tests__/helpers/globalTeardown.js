/**
 * Global Jest Teardown
 * Runs ONCE after all test suites complete.
 * - Closes DB connections to prevent Jest from hanging.
 */

module.exports = async () => {
  try {
    const { sequelize } = require("../../models");
    await sequelize.close();
    console.log("   ✅ Test database connection closed");
  } catch (error) {
    console.log("   ❌ Error closing test DB connection:", error.message);
  }
  console.log("\n🏁 ZenithFlows — Test Suite Complete");
};
