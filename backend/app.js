/**
 * Main Application File
 * Configures Express server with middleware, routes, and error handling
 * Implements multi-tenant SaaS architecture for coaching institutes
 * ✅ Phase 1: Compression, Rate Limiting, Optimized CORS
 * ✅ Phase 6: Performance Monitoring
 * ✅ Phase 7: Security Hardening (Helmet, XSS, OTP Rate Limiting)
 */

require("./instrument"); // ✅ Sentry initialization MUST be the very first line
const express = require("express");
const cors = require("cors");
const path = require("path");
const compression = require("compression");               // ✅ Phase 1.2
const rateLimit = require("express-rate-limit");          // ✅ Phase 1.4
const helmet = require("helmet");                         // ✅ Phase 7: HTTP Security Headers
const performanceLogger = require("./middlewares/performance.middleware"); // ✅ Phase 6.1
require("dotenv").config();

// ✅ DB Safety Guard — must run immediately after env is loaded
const { assertDatabaseSafety } = require('./config/dbSafety');
assertDatabaseSafety();

const app = express();

// ============================================
// ✅ PHASE 7: HTTP SECURITY HEADERS (HELMET)
// ============================================
// Adds 11 security headers: X-Content-Type-Options, X-Frame-Options,
// Strict-Transport-Security, X-XSS-Protection, CSP, and more.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com", "https://api.razorpay.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "https://*.cloudinary.com", "blob:"],
      connectSrc: [
        "'self'",
        "https://api.razorpay.com",
        "https://lumberjack.razorpay.com",
        process.env.FRONTEND_URL,
        // Custom domain variants
        "https://zenithflows.in",
        "https://www.zenithflows.in",
        // All allowed origins from env
        ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim()) : []),
        // Backend itself (Render)
        "https://coaching-management-system-24xn.onrender.com",
      ].filter(Boolean),
      frameSrc: ["https://api.razorpay.com", "https://checkout.razorpay.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false, // Allow Cloudinary images to load
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow CDN resources
}));

// ============================================
// ✅ PHASE 1.2: RESPONSE COMPRESSION
// ============================================
// Compress all HTTP responses — reduces payload size by ~70%
app.use(compression({
  level: 6,           // Compression level (0-9): 6 is best speed/size balance
  threshold: 1024,    // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers["x-no-compression"]) return false;
    return compression.filter(req, res);
  },
}));

// ============================================
// ✅ PHASE 6.1: PERFORMANCE MONITORING
// ============================================
app.use(performanceLogger);

// ============================================
// ✅ PHASE 7: XSS SANITIZATION MIDDLEWARE
// ============================================
// Recursively sanitize all string fields in req.body, req.query, req.params
// to prevent stored XSS attacks from user-submitted content.
const xss = require("xss");
const sanitizeObject = (obj) => {
  if (typeof obj === "string") return xss(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (obj && typeof obj === "object") {
    const clean = {};
    for (const [key, value] of Object.entries(obj)) {
      clean[key] = sanitizeObject(value);
    }
    return clean;
  }
  return obj;
};
app.use((req, res, next) => {
  if (req.body && typeof req.body === "object") req.body = sanitizeObject(req.body);
  if (req.query && typeof req.query === "object") req.query = sanitizeObject(req.query);
  if (req.params && typeof req.params === "object") req.params = sanitizeObject(req.params);
  next();
});

// ============================================
// ✅ PHASE 1.4: RATE LIMITING
// ============================================
// Optimized rate limit skipper for development speed and mobile testing
// O(1) time complexity check prevents Redis/memory calls during dev
const skipRateLimiting = (req) => {
  if (process.env.NODE_ENV !== "production") return true;
  return req.ip === "127.0.0.1" || req.ip === "::1";
};

// Global rate limiter: 200 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests — please try again later." },
  skip: skipRateLimiting,
});
app.use("/api/", globalLimiter);

// Strict auth limiter: 10 login attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts — please wait 15 minutes." },
  skip: skipRateLimiting,
});
app.use("/api/auth/login", authLimiter);

// ✅ Phase 7: OTP-specific rate limiter — 5 attempts per 15 minutes per IP
// Prevents brute-force of 6-digit OTP codes (1M combinations)
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many OTP attempts — please wait 15 minutes before trying again." },
  skip: skipRateLimiting,
});
app.use("/api/auth/register-init", otpLimiter);
app.use("/api/auth/verify-registration", otpLimiter);
app.use("/api/auth/forgot-password", otpLimiter);
app.use("/api/auth/reset-password", otpLimiter);
app.use("/api/auth/resend-otp", otpLimiter);

// ============================================
// ✅ PHASE 1.3: OPTIMIZED CORS CONFIGURATION
// ============================================
/**
 * ✅ Phase 7: Environment-Aware CORS Configuration
 * Production: only allow origins from ALLOWED_ORIGINS env var
 * Development: allow localhost variants + Vercel preview branches
 *
 * IMPORTANT: ALLOWED_ORIGINS must be set on Render with ALL allowed domains:
 *   ALLOWED_ORIGINS=https://coaching-management-system-lemon.vercel.app,https://zenithflows.in,https://www.zenithflows.in
 */
const buildAllowedOrigins = () => {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim()).filter(Boolean);
  }
  // Development: permissive list
  return [
    "https://students-saas.vercel.app",
    process.env.FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://localhost",
    "capacitor://localhost",
    "http://10.0.2.2:5000",
  ].filter(Boolean);
};
const allowedOrigins = buildAllowedOrigins();
const isProduction = !!process.env.ALLOWED_ORIGINS;

// Custom-domain root: allow any origin that ends with our root domain
// e.g. zenithflows.in AND www.zenithflows.in AND any future subdomain
const CUSTOM_DOMAIN = process.env.CUSTOM_DOMAIN || "zenithflows.in";

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin) return callback(null, true);

    // Exact match against whitelist
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Always allow the custom domain and all its subdomains (www, app, student, etc.)
    // This is safe because the CUSTOM_DOMAIN is our own controlled domain
    if (
      origin === `https://${CUSTOM_DOMAIN}` ||
      origin === `http://${CUSTOM_DOMAIN}` ||
      origin.endsWith(`.${CUSTOM_DOMAIN}`)
    ) {
      return callback(null, true);
    }

    // In dev only: allow Vercel preview URLs, capacitor, and localhost subdomains
    if (!isProduction) {
      if (origin.endsWith(".vercel.app")) return callback(null, true);
      if (origin.startsWith("capacitor://")) return callback(null, true);
      // Allow local subdomains for multi-tenant dev (e.g., http://it-hub.localhost:5173)
      if (origin.includes(".localhost:")) return callback(null, true);
    }

    // Blocked
    console.warn(`[CORS] Blocked origin: ${origin}`);
    callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "sentry-trace", "baggage", "X-Requested-With"],
  exposedHeaders: ["Content-Range", "X-Content-Range"],
  maxAge: 86400, // Cache preflight for 24 hours
}));

// Handle OPTIONS preflight for all routes explicitly (belt-and-suspenders)
app.options("*", cors());

// ============================================
// ✅ PHASE A — STEP A4: SUBDOMAIN MIDDLEWARE
// ============================================
// Extracts the institute subdomain from every request hostname.
// Production: iitcoaching.zenithflows.in → req.subdomain = 'iitcoaching'
// Local dev:  localhost → req.subdomain = null (no subdomain in dev)
// This enables future subdomain-based routing without changing existing routes.
const { extractSubdomain } = require("./utils/subdomain");
app.use((req, res, next) => {
  req.subdomain = extractSubdomain(req.hostname);
  next();
});


/**
 * Webhook Routes (Must be parsed as raw body for signature verification)
 */
app.use("/api/webhook", express.raw({ type: 'application/json' }), require("./routes/webhook.routes"));

/**
 * Body Parsers
 * Parse JSON and URL-encoded data
 */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/**
 * Static Files
 * Serve local /uploads folder when Cloudinary is NOT configured (dev mode).
 * In production with Cloudinary, all URLs are direct Cloudinary CDN links.
 */
const isCloudinaryReady =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_CLOUD_NAME !== "your_cloud_name" &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_KEY !== "your_api_key";

if (!isCloudinaryReady) {
  // Serve local uploads only when Cloudinary is not set up (local dev fallback)
  app.use("/uploads", express.static(path.join(__dirname, "uploads")));
  console.log("ðŸ“‚ Serving local /uploads (Cloudinary not configured)");
}


// Note: Basic request logging is handled by the performanceLogger middleware above.
// It provides richer data: duration, status codes, slow-request warnings.

// ============================================
// API ROUTES
// ============================================

// ✅ Phase 10: Multi-tenant scope safety net — validate institute_id on every request
const tenantScope = require("./middlewares/tenantScope.middleware");
const verifyToken = require("./middlewares/auth.middleware");

/**
 * Health Check Endpoint (Simple)
 * Returns server status
 */
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "🎓 ZenithFlows API is running",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

/**
 * ✅ Phase 7: Production Health Check Endpoint
 * Deep health check — verifies DB connectivity, Redis status, memory usage.
 * Use this for uptime monitoring (Better Uptime, Railway health checks).
 */
app.get("/api/health", async (req, res) => {
  const startTime = Date.now();
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: "1.0.0",
    checks: {},
  };

  // Database check
  try {
    const { sequelize } = require("./models");
    await sequelize.authenticate();
    health.checks.database = { status: "ok", latency: `${Date.now() - startTime}ms` };
  } catch (err) {
    health.status = "degraded";
    health.checks.database = { status: "error", message: err.message };
  }

  // Redis check
  try {
    const redis = require("./config/redis");
    health.checks.redis = {
      status: redis.isAvailable() ? "ok" : "unavailable",
      note: redis.isAvailable() ? "Connected" : "Caching disabled (non-critical)",
    };
  } catch {
    health.checks.redis = { status: "unavailable" };
  }

  // Memory check
  const memUsage = process.memoryUsage();
  health.checks.memory = {
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
  };

  health.responseTime = `${Date.now() - startTime}ms`;

  const statusCode = health.status === "ok" ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * API Routes
 * All routes are prefixed with /api
 */
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/superadmin", require("./routes/superadmin.routes"));
app.use("/api/admin", require("./routes/admin.routes"));
app.use("/api/institutes", require("./routes/institute.routes"));

// ✅ Phase 10: Core institute-scoped routes use tenantScope middleware
// This ensures every request has a valid institute_id before hitting any controller
app.use("/api/students", [verifyToken, tenantScope], require("./routes/student.routes"));
app.use("/api/faculty", [verifyToken, tenantScope], require("./routes/faculty.routes"));
app.use("/api/faculty-attendance", [verifyToken, tenantScope], require("./routes/facultyAttendance.routes"));
app.use("/api/classes", [verifyToken, tenantScope], require("./routes/class.routes"));
app.use("/api/subjects", [verifyToken, tenantScope], require("./routes/subject.routes"));
app.use("/api/attendance", [verifyToken, tenantScope], require("./routes/attendance.routes"));
app.use("/api/reports", [verifyToken, tenantScope], require("./routes/reports.routes"));
app.use("/api/exams", [verifyToken, tenantScope], require("./routes/exam.routes"));
app.use("/api/fees", [verifyToken, tenantScope], require("./routes/fees.routes"));
app.use("/api/announcements", [verifyToken, tenantScope], require("./routes/announcement.routes"));
app.use("/api/expenses", [verifyToken, tenantScope], require("./routes/expense.routes"));
app.use("/api/transport-fees", [verifyToken, tenantScope], require("./routes/transportFee.routes"));
app.use("/api/salary", [verifyToken, tenantScope], require("./routes/salary.routes"));
app.use("/api/finance", [verifyToken, tenantScope], require("./routes/finance.routes"));
app.use("/api/timetable", [verifyToken, tenantScope], require("./routes/timetable.routes"));
app.use("/api/live-timetable", [verifyToken, tenantScope], require("./routes/liveTimetable.routes"));
app.use("/api/chat", [verifyToken, tenantScope], require("./routes/chat.routes"));
app.use("/api/parents", [verifyToken, tenantScope], require("./routes/parent.routes"));
app.use("/api/notes", [verifyToken, tenantScope], require("./routes/note.routes"));
app.use("/api/assignments", [verifyToken, tenantScope], require("./routes/assignment.routes"));
app.use("/api/performance", [verifyToken, tenantScope], require("./routes/performance.routes"));
app.use("/api/biometric", [verifyToken, tenantScope], require("./routes/biometric.routes"));
app.use("/api/mobile", [verifyToken, tenantScope], require("./routes/mobileDashboard.routes"));
app.use("/api/notifications", [verifyToken, tenantScope], require("./routes/notification.routes"));
// ── Academic Year Promotion Engine (Phase 5) ─────────────────────────────────
app.use("/api/academic-years", [verifyToken, tenantScope], require("./routes/academicYear.routes"));
// Subscription, payment, plans — no tenantScope (cross-institute billing routes)
app.use("/api/subscriptions", require("./routes/subscription.routes"));
app.use("/api/plans", require("./routes/plan.routes"));
app.use("/api/payment", require("./routes/payment.routes"));
app.use("/api/invoices", require("./routes/invoice.routes"));
app.use("/api/manager", require("./routes/manager.routes"));

// Public Web Page routes
app.use("/api/admin/public-page", require("./routes/publicPage.routes"));
app.use("/api/admin/enquiries", require("./routes/enquiry.routes"));
app.use("/api/public", require("./routes/publicSite.routes"));
app.use("/api/leads", require("./routes/lead.routes"));
app.use("/api/lifetime", require("./routes/lifetime.routes"));

// ZKTeco ADMS Routes
app.use("/iclock", require("express").text({ type: ["text/plain", "application/x-www-form-urlencoded"] }), require("./routes/iclock.routes"));

// Per-device biometric webhook (public — authenticated via device_token in URL)
// Must be mounted BEFORE the 404 handler and OUTSIDE the JWT-protected /api/biometric router
// because physical devices don't carry a JWT token.
app.post(
    "/api/biometric/webhook/:deviceToken",
    express.json(),
    require("./controllers/biometric.controller").webhookReceiver
);


// ============================================
// SENTRY TEST ENDPOINT
// ============================================
app.get("/debug-sentry", function mainHandler(req, res) {
  throw new Error("My first Sentry error!");
});

// ============================================
// 404 HANDLER
// ============================================

/**
 * Handle undefined routes
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.url,
  });
});

// ============================================
// GLOBAL ERROR HANDLER 
// ============================================

// ============================================
// ✅ PHASE 2: CENTRALIZED ERROR HANDLER
// ============================================
// Sentry MUST be registered before our custom error middleware
// so Sentry captures errors before we format and send the response.
const Sentry = require("@sentry/node");
Sentry.setupExpressErrorHandler(app);

// Custom centralized error handler — handles AppError, Sequelize, JWT,
// Multer, Joi, connection errors, and unexpected bugs with referenceId.
const errorHandler = require("./middlewares/error.middleware");
app.use(errorHandler);

// ============================================
// DATABASE SYNCHRONIZATION
// ============================================

/**
 * Sync database models
 * Creates tables if they don't exist
 * Use { alter: true } in development, { force: false } in production
 */

// ─── Database Initialization ─────────────────────────────────────────────────
// Uses Umzug for tracked, versioned migrations. Every change runs exactly once.
// NEVER use sequelize.sync({ force: true }) or sync({ alter: true }) here.
// See: backend/config/umzug.js and backend/migrations/ for all schema changes.
const { sequelize } = require("./models");
const umzug = require('./config/umzug');

const syncDatabase = async () => {
  try {

    // STEP 1: Test database connection
    await sequelize.authenticate();

    // STEP 2: Create brand-new tables only (safe — never modifies existing tables)
    await sequelize.sync({ alter: false });

    // STEP 3: Run pending Umzug migrations
    const pending = await umzug.pending();
    if (pending.length > 0) {
      await umzug.up();
    }

    // STEP 4: Seed plans and super admin (data, not schema)
    const seedPlans = require('./seeders/seedPlans');
    await seedPlans();

    const createSuperAdmin = require('./seeders/createSuperAdmin');
    await createSuperAdmin();

  } catch (error) {
    console.error('❌ Database error:', error.message);
    console.error('Please ensure PostgreSQL is running and database exists / credentials are correct');
  }
};

// Sync database on startup (only in development/production, NOT in tests)
if (process.env.NODE_ENV !== 'test') {
  syncDatabase();
}

module.exports = app;
