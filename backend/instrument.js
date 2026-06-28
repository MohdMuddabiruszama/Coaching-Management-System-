/**
 * ✅ PHASE 9: Sentry Configuration — Optimized for Production
 * ─────────────────────────────────────────────────────────────────────────────
 * Changes from default:
 *  - tracesSampleRate: 1.0 → 0.2 in production (saves 80% of Sentry quota)
 *  - environment tag: dev/production for filtering in Sentry dashboard
 *  - beforeSend: skip expected operational errors (404, 401, 422) that flood
 *    the error dashboard without being actionable bugs
 * ─────────────────────────────────────────────────────────────────────────────
 */

const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

const isProd = process.env.NODE_ENV === "production";

Sentry.init({
  dsn: "https://61e738ffbd23fd475b73877e2d96f30f@o4511373536133120.ingest.de.sentry.io/4511373542752336",

  integrations: [
    nodeProfilingIntegration(),
  ],

  // ✅ Phase 9: Reduce from 100% → 20% in production to save Sentry quota.
  // In dev, keep 100% for full visibility.
  tracesSampleRate:   isProd ? 0.2 : 1.0,
  profilesSampleRate: isProd ? 0.2 : 1.0,

  // ✅ Phase 9: Tag every event with environment for Sentry dashboard filtering
  environment: process.env.NODE_ENV || "development",
  release:     process.env.RENDER_GIT_COMMIT || process.env.npm_package_version,

  // ✅ Phase 9: beforeSend — filter noise before it hits Sentry
  beforeSend(event, hint) {
    const err = hint?.originalException;
    if (!err) return event;

    // Skip operational errors — these are expected (user errors, not bugs)
    // They're logged to our Winston logger; no Sentry alert needed
    if (err.isOperational === true) return null;

    // Skip common HTTP client errors (not bugs — user/client issues)
    const operationalStatusCodes = [400, 401, 403, 404, 409, 422, 429];
    if (err.statusCode && operationalStatusCodes.includes(err.statusCode)) return null;

    // For non-operational (unexpected) errors, enrich with context if available
    // Note: req context is set by Sentry's express middleware automatically
    return event;
  },
});

