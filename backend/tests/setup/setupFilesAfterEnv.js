const sequelize = require("../../config/database");

// Increase timeout for DB sync
jest.setTimeout(30000);

beforeAll(async () => {
  // 1. Force sync the database (creates all tables based on models)
  // `force: true` drops existing tables, ensuring a clean slate.
  await sequelize.sync({ force: true });

  // 2. Run necessary seeders
  const seedPlans = require("../../seeders/seedPlans");
  await seedPlans();
});

afterAll(async () => {
  // Close the database connection after all tests in the file complete
  await sequelize.close();
});
