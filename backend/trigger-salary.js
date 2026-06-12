const { generateMonthlySalaries } = require('./services/salaryAutoGenerate.service');
const { sequelize } = require('./models');

async function testSalaryCron() {
    console.log("=== Testing Salary Auto-Generation ===");
    try {
        // You can pass a specific month here, e.g. "2026-05", or leave it empty to use the current month.
        const result = await generateMonthlySalaries(); 
        console.log("\nSuccess! Results:", result);
    } catch (err) {
        console.error("Error generating salaries:", err);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

testSalaryCron();
