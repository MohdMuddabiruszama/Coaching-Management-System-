module.exports = {
  testEnvironment: "node",
  globalSetup: "<rootDir>/tests/setup/globalSetup.js",
  globalTeardown: "<rootDir>/tests/setup/globalTeardown.js",
  setupFilesAfterEnv: ["<rootDir>/tests/setup/setupFilesAfterEnv.js"],
  testMatch: ["**/tests/integration/**/*.test.js"],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
