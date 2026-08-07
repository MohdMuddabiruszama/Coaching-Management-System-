require("dotenv").config();
process.env.NODE_ENV = "test";
const sequelize = require("./config/database");
require("./models");

async function run() {
    console.log("Starting sync...");
    try {
        await sequelize.sync({ force: true, logging: console.log });
        console.log("Sync complete!");
    } catch (e) {
        console.error("Sync failed:", e);
    } finally {
        await sequelize.close();
    }
}
run();
