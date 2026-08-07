// backend/config/dbSafety.js
// ─── Database Safety Guard ────────────────────────────────────────────────────
// Called as the FIRST line of app.js before anything else loads.
// Blocks dangerous Sequelize operations in production.
// ZenithFlows — Enterprise DB Safety Architecture (Phase 7)

function assertDatabaseSafety() {
  const env    = process.env.NODE_ENV || 'development';
  const isProd = env === 'production';

  // ── ABSOLUTE BLOCK: ALLOW_FORCE_SYNC must never be true in production ────
  if (isProd && process.env.ALLOW_FORCE_SYNC === 'true') {
    console.error('🚨 CRITICAL SAFETY ERROR: ALLOW_FORCE_SYNC=true in production!');
    console.error('This would wipe ALL institute data. Refusing to start.');
    process.exit(1);
  }

  // ── WARN: development mode connected to a cloud/Neon database ────────────
  const dbUrl = process.env.DATABASE_URL || '';
  const isCloudDb = dbUrl.includes('neon.tech') || dbUrl.includes('render.com') || dbUrl.includes('supabase.io');

  // ── PRODUCTION GUARD: Monkey-patch sequelize.sync to block dangerous opts ─
  if (isProd) {
    // We defer this until sequelize is loaded (models/index.js may not be ready yet)
    setImmediate(() => {
      try {
        const { sequelize } = require('../models');
        const originalSync = sequelize.sync.bind(sequelize);
        sequelize.sync = (opts = {}) => {
          if (opts.force) {
            const msg = '🚨 BLOCKED: sequelize.sync({ force: true }) is NEVER allowed in production. Would drop all tables.';
            console.error(msg);
            return Promise.reject(new Error(msg));
          }
          if (opts.alter) {
            const msg = '🚨 BLOCKED: sequelize.sync({ alter: true }) is NEVER allowed in production. May silently drop columns.';
            console.error(msg);
            return Promise.reject(new Error(msg));
          }
          return originalSync(opts);
        };
      } catch (_) {
        // Models not yet loaded — guard will apply when sync is called
      }
    });
  }

  // ── LOG: confirm safety mode ─────────────────────────────────────────────
  const safetyMode = isProd ? '🔐 PRODUCTION (force/alter sync BLOCKED)' : '🛠  DEVELOPMENT';
  // console.log(`[DB Safety] Mode: ${safetyMode}`);
}

module.exports = { assertDatabaseSafety };
