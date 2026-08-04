// backend/config/umzug.js
// ─── Umzug Migration Engine ───────────────────────────────────────────────────
// Tracks every schema change in the SequelizeMeta table.
// Each migration file runs EXACTLY ONCE — never again after first apply.
// ZenithFlows — Enterprise DB Safety Architecture (Phase 1)

const { Umzug, SequelizeStorage } = require('umzug');
const path = require('path');
const { sequelize } = require('../models');

const umzug = new Umzug({
  migrations: {
    // Auto-discover all .js files in the migrations folder (sorted alphabetically)
    glob: path.join(__dirname, '../migrations/*.js').replace(/\\/g, '/'),
    resolve: ({ name, path: mPath, context }) => {
      const migration = require(mPath);
      return {
        name,
        up:   async () => migration.up(context.queryInterface, context.Sequelize),
        down: async () => migration.down(context.queryInterface, context.Sequelize),
      };
    },
  },
  context: {
    queryInterface: sequelize.getQueryInterface(),
    Sequelize:      sequelize.constructor,
  },
  storage: new SequelizeStorage({
    sequelize,
    // Creates a 'SequelizeMeta' table to track which migrations have run.
    // If a migration name appears here → it will NEVER run again.
    tableName: 'SequelizeMeta',
  }),
  logger: {
    info:  ({ event, name }) => console.log(`  [Migration] ${event}: ${name}`),
    warn:  (msg) => console.warn('  [Migration] WARNING:', msg),
    error: (msg) => console.error('  [Migration] ERROR:', msg),
    debug: () => {},
  },
});

module.exports = umzug;
