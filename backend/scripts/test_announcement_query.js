require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Announcement, User, Subject } = require("../models");
const sequelize = require("../config/database");

async function testQuery() {
    try {
        console.log("Testing Announcement query...");
        
        const res = await Announcement.findAndCountAll({
            where: { institute_id: 1 },
            limit: 10,
            offset: 0,
            order: [["is_pinned", "DESC"], ["created_at", "DESC"]],
            include: [
                { model: User, as: "creator", attributes: ["id", "name", "role"] },
                { model: Subject, attributes: ["id", "name"] },
            ],
        });
        
        console.log("Query successful! Count:", res.count);
    } catch (err) {
        console.error("Query failed with error:");
        console.error(err.message);
        console.error(err.sql);
    } finally {
        await sequelize.close();
    }
}

testQuery();
