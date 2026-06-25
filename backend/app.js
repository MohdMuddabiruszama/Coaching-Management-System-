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
// Global rate limiter: 200 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests — please try again later." },
  skip: (req) => req.ip === "127.0.0.1" || req.ip === "::1", // Don't limit localhost
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
  skip: (req) => req.ip === "127.0.0.1" || req.ip === "::1", // Don't limit localhost during dev
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

/**
 * Health Check Endpoint (Simple)
 * Returns server status
 */
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "🎓 ZenithFlows API is running",
    version: "1.1.5",
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
    version: "1.1.5",
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
app.use("/api/students", require("./routes/student.routes"));
app.use("/api/faculty", require("./routes/faculty.routes"));
app.use("/api/faculty-attendance", require("./routes/facultyAttendance.routes"));
app.use("/api/classes", require("./routes/class.routes"));
app.use("/api/subjects", require("./routes/subject.routes"));
app.use("/api/attendance", require("./routes/attendance.routes"));
app.use("/api/reports", require("./routes/reports.routes"));
app.use("/api/exams", require("./routes/exam.routes"));
app.use("/api/fees", require("./routes/fees.routes"));
app.use("/api/announcements", require("./routes/announcement.routes"));
app.use("/api/subscriptions", require("./routes/subscription.routes"));
app.use("/api/plans", require("./routes/plan.routes"));
app.use("/api/payment", require("./routes/payment.routes"));
app.use("/api/invoices", require("./routes/invoice.routes"));
app.use("/api/expenses", require("./routes/expense.routes"));
app.use("/api/transport-fees", require("./routes/transportFee.routes"));
app.use("/api/salary", require("./routes/salary.routes"));          // Faculty Salary Management
app.use("/api/finance", require("./routes/finance.routes"));         // Finance Analytics (Admin Only)
app.use("/api/manager", require("./routes/manager.routes"));
app.use("/api/timetable", require("./routes/timetable.routes"));
// Webhook route already mounted above
app.use("/api/chat", require("./routes/chat.routes"));
app.use("/api/parents", require("./routes/parent.routes"));
app.use("/api/biometric", require("./routes/biometric.routes"));
app.use("/api/notes", require("./routes/note.routes"));
app.use("/api/assignments", require("./routes/assignment.routes"));
app.use("/api/performance", require("./routes/performance.routes")); // ✅ Student Performance System
app.use("/api/mobile", require("./routes/mobileDashboard.routes")); // ✅ Phase 2C: Bundled mobile dashboard APIs

// Public Web Page routes
app.use("/api/admin/public-page", require("./routes/publicPage.routes"));
app.use("/api/admin/enquiries", require("./routes/enquiry.routes"));
app.use("/api/public", require("./routes/publicSite.routes"));
app.use("/api/leads", require("./routes/lead.routes"));
app.use("/api/lifetime", require("./routes/lifetime.routes")); // Lifetime plan

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

/**
 * Central Error Handling Middleware
 * Catches all errors and returns standardized response
 */
const Sentry = require("@sentry/node");
Sentry.setupExpressErrorHandler(app); // ✅ Setup Sentry Express Error Handler BEFORE custom error middleware

app.use((err, req, res, next) => {
  console.error("âŒ Error:", err);

  // Sequelize validation errors
  if (err.name === "SequelizeValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors: err.errors.map((e) => ({
        field: e.path,
        message: e.message,
      })),
    });
  }

  // Sequelize unique constraint errors
  if (err.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({
      success: false,
      message: "Duplicate entry",
      field: err.errors[0]?.path,
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token expired",
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// ============================================
// DATABASE SYNCHRONIZATION
// ============================================

/**
 * Sync database models
 * Creates tables if they don't exist
 * Use { alter: true } in development, { force: false } in production
 */

// Creation Logic: The command that actually creates or updates the tables in the database
const { sequelize } = require("./models");

const syncDatabase = async () => {
  try {
    const runStartupMigrations = process.env.RUN_STARTUP_MIGRATIONS === "true";

    // Test database connection first
    await sequelize.authenticate();
    console.log("âœ… Database connection established successfully");

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // NOTE: MySQL-specific index cleanup removed.
    // PostgreSQL manages indexes efficiently and does not suffer
    // from the same index duplication issues as MySQL.
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // SAFE SYNC: alter:false only creates missing tables,
    // never modifies existing tables (prevents index duplication)
    // Plus a few one-time ALTERs wrapped in try/catch so they are
    // effectively no-ops once applied.
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (runStartupMigrations) {
    console.log("Startup schema migrations enabled via RUN_STARTUP_MIGRATIONS=true");

    try {
      await sequelize.query(`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS code VARCHAR(50) DEFAULT NULL;`);
    } catch (e) { }

    try {
      await sequelize.query(`ALTER TABLE students ADD COLUMN is_full_course BOOLEAN DEFAULT false;`);
    } catch (e) { }

    try {
      await sequelize.query(`ALTER TABLE student_fees ADD COLUMN reminder_date DATE;`);
    } catch (e) { }

    // Ensure discount_amount exists on subscriptions for superadmin analytics
    try {
      await sequelize.query(`ALTER TABLE subscriptions ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0;`);
    } catch (e) { }

    try {
      await sequelize.query(`ALTER TABLE subscriptions ADD COLUMN tax_amount DECIMAL(10,2) DEFAULT 0;`);
    } catch (e) { }

    // Biometric attendance columns (PostgreSQL-compatible â€” use VARCHAR instead of ENUM)
    try { await sequelize.query(`ALTER TABLE attendances ADD COLUMN marked_by_type VARCHAR(20) DEFAULT 'manual';`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE attendances ADD COLUMN biometric_punch_id BIGINT NULL;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE attendances ADD COLUMN time_in TIME NULL;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE attendances ADD COLUMN time_out TIME NULL;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE attendances ADD COLUMN is_late BOOLEAN DEFAULT false;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE attendances ADD COLUMN late_by_minutes INT DEFAULT 0;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE attendances ADD COLUMN is_half_day BOOLEAN DEFAULT false;`); } catch (e) { }
    // Modify attendance status type to include half_day (PostgreSQL-safe â€” no-op if already correct)
    try {
      await sequelize.query(`ALTER TABLE attendances ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'present';`);
    } catch (e) { /* ignore â€” column already exists */ }

    // Public Web Page feature columns
    try { await sequelize.query(`ALTER TABLE plans ADD COLUMN feature_public_page BOOLEAN DEFAULT false;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE institutes ADD COLUMN current_feature_public_page BOOLEAN DEFAULT false;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE institute_reviews ADD COLUMN sort_order INT DEFAULT 0;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE institute_reviews ADD COLUMN is_approved BOOLEAN DEFAULT true;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE institute_gallery_photos ADD COLUMN sort_order INT DEFAULT 0;`); } catch (e) { }

    // Finance Module feature columns (Finance.md Phase 6 / Section 6)
    try { await sequelize.query(`ALTER TABLE plans ADD COLUMN feature_fees BOOLEAN DEFAULT true;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE plans ADD COLUMN feature_salary BOOLEAN DEFAULT false;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE plans ADD COLUMN feature_expenses BOOLEAN DEFAULT false;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE plans ADD COLUMN feature_finance_reports BOOLEAN DEFAULT false;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE plans ADD COLUMN feature_transport_fees BOOLEAN DEFAULT false;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE plans ADD COLUMN feature_finance BOOLEAN DEFAULT false;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE institutes ADD COLUMN current_feature_finance BOOLEAN DEFAULT false;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE institutes ADD COLUMN current_feature_expenses BOOLEAN DEFAULT false;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE institutes ADD COLUMN current_feature_salary BOOLEAN DEFAULT false;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE institutes ADD COLUMN current_feature_mobile_app BOOLEAN DEFAULT false;`); } catch (e) { }
    console.log("âœ… Finance & Mobile module feature columns ensured");

    // â”€â”€ Manager Type columns (CreateManager.md â€” Phase 1 DB changes) â”€â”€â”€â”€â”€â”€â”€â”€
    // PostgreSQL-safe: CREATE TYPE IF NOT EXISTS, then ADD COLUMN IF NOT EXISTS
    try {
      await sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE "enum_users_manager_type" AS ENUM ('fees', 'data', 'academic', 'ops', 'hr', 'custom');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
      `);
    } catch (e) { /* type already exists */ }
    try {
      await sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_type "enum_users_manager_type" DEFAULT 'custom';`);
    } catch (e) { }
    try {
      await sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_type_label VARCHAR(50) DEFAULT NULL;`);
    } catch (e) { }
    console.log("âœ… Manager type columns ensured on users table");

    // --- Lifetime Plan DB columns (Lifetime_Access.md Phase 1) ---
    try { await sequelize.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_lifetime BOOLEAN NOT NULL DEFAULT FALSE;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS lifetime_price DECIMAL(10,2) DEFAULT NULL;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS lifetime_slots_total INTEGER DEFAULT 100;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS lifetime_slots_used INTEGER DEFAULT 0;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_students_lifetime INTEGER DEFAULT -1;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_faculty_lifetime INTEGER DEFAULT -1;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_managers_lifetime INTEGER DEFAULT -1;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS lifetime_bonus_subdomain BOOLEAN DEFAULT TRUE;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS lifetime_bonus_priority_support BOOLEAN DEFAULT TRUE;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS lifetime_bonus_unlimited_export BOOLEAN DEFAULT TRUE;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE institutes ADD COLUMN IF NOT EXISTS is_lifetime_member BOOLEAN NOT NULL DEFAULT FALSE;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE institutes ADD COLUMN IF NOT EXISTS lifetime_purchased_at TIMESTAMPTZ DEFAULT NULL;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE institutes ADD COLUMN IF NOT EXISTS lifetime_plan_id INTEGER DEFAULT NULL;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE institutes ADD COLUMN IF NOT EXISTS founding_member BOOLEAN DEFAULT FALSE;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE institutes ADD COLUMN IF NOT EXISTS custom_subdomain VARCHAR(100) DEFAULT NULL;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_reason VARCHAR(200) DEFAULT NULL;`); } catch (e) { }
    console.log('âœ… Lifetime plan columns ensured');

    // Free Trial columns
    try { await sequelize.query(`ALTER TABLE plans ADD COLUMN is_free_trial BOOLEAN DEFAULT false;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE plans ADD COLUMN trial_days INT DEFAULT 14;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE institutes ADD COLUMN has_used_trial BOOLEAN DEFAULT false;`); } catch (e) { }
    // â”€â”€ Bulk Import Logs Table (bulk.md Phase 1) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS bulk_import_logs (
          id           SERIAL PRIMARY KEY,
          institute_id INT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
          import_type  VARCHAR(20) NOT NULL,
          imported_by  INT NOT NULL REFERENCES users(id),
          total_rows   INT DEFAULT 0,
          success_rows INT DEFAULT 0,
          failed_rows  INT DEFAULT 0,
          error_report JSONB,
          status       VARCHAR(20) DEFAULT 'completed',
          created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
    } catch (e) { /* table already exists */ }
    try { await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_bulk_logs_institute ON bulk_import_logs(institute_id, created_at DESC);`); } catch (e) { }
    console.log('âœ… bulk_import_logs table ensured');

    // ── Phase 1: Student Password System ─────────────────────────────────────
    try {
      await sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_first_login BOOLEAN DEFAULT TRUE;`);
      await sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS temp_password_expires_at TIMESTAMPTZ;`);
      await sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS credentials_sent_at TIMESTAMPTZ;`);
      await sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS initial_password VARCHAR(255);`);
      console.log('✅ Student Password columns ensured');
    } catch (e) {
      console.error('Error adding Student Password columns:', e.message);
    }

    // ── Phase 5A: FCM Push Token columns (Mobile App) ────────────────────────
    try {
      await sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token VARCHAR(500) DEFAULT NULL;`);
      await sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_platform VARCHAR(20) DEFAULT NULL;`);
      console.log('✅ FCM token columns ensured on users table');
    } catch (e) {
      console.error('Error adding FCM token columns:', e.message);
    }

    // ── Dashboard Unread Tracking ─────────────────────────────────────
    try {
      await sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_assignment_seen_at TIMESTAMPTZ;`);
      await sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_note_seen_at TIMESTAMPTZ;`);
      await sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_enquiry_seen_at TIMESTAMPTZ;`);
      console.log('✅ Dashboard Unread Tracking columns ensured');
    } catch (e) {
      console.error('Error adding Dashboard Unread Tracking columns:', e.message);
    }

    // ── Exam Result System (Approach B) ──────────────────────────────────────
    // Using VARCHAR(20) for exam_type — avoids PostgreSQL ENUM type creation issues
    // Same pattern as marked_by_type on attendances table
    try { await sequelize.query(`ALTER TABLE exams ADD COLUMN IF NOT EXISTS exam_type VARCHAR(20) NOT NULL DEFAULT 'unit_test';`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE exams ADD COLUMN IF NOT EXISTS marks_locked BOOLEAN NOT NULL DEFAULT FALSE;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE exams ADD COLUMN IF NOT EXISTS marks_locked_at TIMESTAMPTZ NULL;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE exams ADD COLUMN IF NOT EXISTS marks_locked_by INTEGER NULL;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE marks ADD COLUMN IF NOT EXISTS is_absent BOOLEAN NOT NULL DEFAULT FALSE;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE marks ADD COLUMN IF NOT EXISTS remarks VARCHAR(200) NULL;`); } catch (e) { }
    // Performance indexes for RANK() window function queries
    try { await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_marks_exam_id ON marks(exam_id);`); } catch (e) { }
    try { await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_marks_student_id ON marks(student_id);`); } catch (e) { }
    try { await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_exams_locked ON exams(marks_locked);`); } catch (e) { }
    console.log('✅ Exam Result System columns ensured');

    // ── Timetable Slots per Class ──────────────────────────────────────
    try {
      await sequelize.query(`ALTER TABLE timetable_slots ADD COLUMN IF NOT EXISTS class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE;`);
      console.log('✅ Timetable Slots class_id column ensured');
    } catch (e) {
      console.error('Error adding class_id to timetable_slots:', e.message);
    }

    // ── Break Support for Timetable ──────────────────────────────────────
    try {
      await sequelize.query(`ALTER TABLE timetables ADD COLUMN IF NOT EXISTS is_break BOOLEAN NOT NULL DEFAULT FALSE;`);
      await sequelize.query(`ALTER TABLE timetables ADD COLUMN IF NOT EXISTS break_label VARCHAR(100) DEFAULT NULL;`);
      await sequelize.query(`ALTER TABLE timetables ALTER COLUMN subject_id DROP NOT NULL;`);
      await sequelize.query(`ALTER TABLE timetables ALTER COLUMN faculty_id DROP NOT NULL;`);
      console.log('✅ Timetable break columns ensured');
    } catch (e) {
      console.error('Error adding break columns to timetables:', e.message);
    }

    // ── Chat Message Limit (Subscription Plan Feature) ────────────────────────
    try { await sequelize.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_chat_messages INTEGER NOT NULL DEFAULT 500;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE institutes ADD COLUMN IF NOT EXISTS current_limit_chat_messages INTEGER DEFAULT 500;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE institutes ADD COLUMN IF NOT EXISTS current_feature_chat BOOLEAN DEFAULT FALSE;`); } catch (e) { }
    console.log('✅ Chat message limit columns ensured');

    // ── Faculty Salary Management — Phase 1 DB (Faculty Salary.md) ──────────
    // Add new columns to faculty_salaries (payment_due_date, salary_slip_url, auto_generated)
    try { await sequelize.query(`ALTER TABLE faculty_salaries ADD COLUMN IF NOT EXISTS payment_due_date DATE NULL;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE faculty_salaries ADD COLUMN IF NOT EXISTS salary_slip_url VARCHAR(500) NULL;`); } catch (e) { }
    try { await sequelize.query(`ALTER TABLE faculty_salaries ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN NOT NULL DEFAULT FALSE;`); } catch (e) { }
    // Performance indexes for faculty_salaries
    try { await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_fs_institute_month ON faculty_salaries(institute_id, month_year);`); } catch (e) { }
    try { await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_fs_faculty_month ON faculty_salaries(faculty_id, month_year);`); } catch (e) { }
    try { await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_fs_status ON faculty_salaries(institute_id, status);`); } catch (e) { }
    try { await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_fs_due_date ON faculty_salaries(payment_due_date);`); } catch (e) { }
    // Create faculty_salary_settings table (base salary per faculty, used by auto-generate cron)
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS faculty_salary_settings (
          id                    SERIAL PRIMARY KEY,
          institute_id          INT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
          faculty_id            INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          basic_salary          DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          allowances            DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          salary_due_day        SMALLINT NOT NULL DEFAULT 5,
          working_days_default  SMALLINT NOT NULL DEFAULT 26,
          is_active             BOOLEAN NOT NULL DEFAULT TRUE,
          created_at            TIMESTAMPTZ DEFAULT NOW(),
          updated_at            TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE (faculty_id, institute_id)
        );
      `);
    } catch (e) { /* table already exists */ }
    try { await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_fss_institute ON faculty_salary_settings(institute_id);`); } catch (e) { }
    console.log('✅ Faculty Salary Management schema ensured (payment_due_date, settings table, indexes)');

    // Auto-sync other schema changes using alter for the explicit models to make sure everything matches
    try {
      const { Institute, InstitutePublicProfile, InstituteGalleryPhoto, InstituteReview, PublicEnquiry, Subscription, Plan, User, LandingPageView, Coupon, AddOn, InstituteAddOn, SubscriptionEvent, UsageTracker } = require('./models');
      await InstitutePublicProfile.sync({ alter: true });
      await InstituteGalleryPhoto.sync({ alter: true });
      await InstituteReview.sync({ alter: true });
      await PublicEnquiry.sync({ alter: true });
      
      // Sync new models before Subscription to prevent foreign key constraint errors
      await Coupon.sync({ alter: true });
      await AddOn.sync({ alter: true });
      await InstituteAddOn.sync({ alter: true });
      await UsageTracker.sync({ alter: true });
      
      await Subscription.sync({ alter: true });
      await SubscriptionEvent.sync({ alter: true });
      
      await Plan.sync({ alter: true });
      await Institute.sync({ alter: true }); // ✅ picks up current_limit_chat_messages
      await User.sync({ alter: true });  // ✅ picks up manager_type + manager_type_label
      await LandingPageView.sync({ alter: true });
    } catch (e) { console.error("Error auto-syncing explicit models:", e); }
    } else {
      console.log("Startup schema migrations skipped. Set RUN_STARTUP_MIGRATIONS=true to apply ALTER/index maintenance.");
    }

    await sequelize.sync({ alter: false });
    console.log("âœ… Database synchronized successfully");

    if (runStartupMigrations) {
    // Add indexes for performance (public page tables)
    try { await sequelize.query(`CREATE INDEX idx_profile_slug ON institute_public_profiles(slug);`); } catch (e) { }
    try { await sequelize.query(`CREATE INDEX idx_gallery_inst ON institute_gallery_photos(institute_id);`); } catch (e) { }
    try { await sequelize.query(`CREATE INDEX idx_reviews_inst ON institute_reviews(institute_id);`); } catch (e) { }
    try { await sequelize.query(`CREATE INDEX idx_enquiry_inst ON public_enquiries(institute_id, status, created_at);`); } catch (e) { }

    // âœ… Phase 2.2: Critical Performance Indexes
    // Students - fast lookups by institute + class (most common query)
    try { await sequelize.query(`CREATE INDEX idx_students_inst_class ON students(institute_id, class_id);`); } catch (e) { }
    try { await sequelize.query(`CREATE INDEX idx_students_user ON students(user_id);`); } catch (e) { }

    // Attendance - fast date-range lookups (most frequent query)
    try { await sequelize.query(`CREATE INDEX idx_att_student_date ON attendances(student_id, date);`); } catch (e) { }
    try { await sequelize.query(`CREATE INDEX idx_att_inst_date ON attendances(institute_id, date);`); } catch (e) { }
    try { await sequelize.query(`CREATE INDEX idx_att_class_date ON attendances(class_id, date);`); } catch (e) { }

    // Subscriptions - fast middleware checks (called on every authenticated request)
    try { await sequelize.query(`CREATE INDEX idx_sub_inst_status ON subscriptions(institute_id, payment_status);`); } catch (e) { }
    try { await sequelize.query(`CREATE INDEX idx_sub_end_date ON subscriptions(end_date);`); } catch (e) { }

    // Subjects - class + institute lookups
    try { await sequelize.query(`CREATE INDEX idx_subjects_class_inst ON subjects(class_id, institute_id);`); } catch (e) { }

    // Faculty - institute lookups
    try { await sequelize.query(`CREATE INDEX idx_faculty_inst ON faculty(institute_id);`); } catch (e) { }

    // Student fees - fast fee tracking
    try { await sequelize.query(`CREATE INDEX idx_sfee_student ON student_fees(student_id, institute_id);`); } catch (e) { }
    try { await sequelize.query(`CREATE INDEX idx_sfee_due ON student_fees(due_date, status);`); } catch (e) { }

    // Exams - institute + class lookups
    try { await sequelize.query(`CREATE INDEX idx_exams_inst ON exams(institute_id, class_id);`); } catch (e) { }

    // ── Chat Performance Indexes (Phase 3: Chat Optimization) ──────────────────
    // chat_messages: most queried table — full table scans without these
    try { await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_chatmsg_room_created ON chat_messages(room_id, created_at DESC);`); } catch (e) { }
    try { await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_chatmsg_sender ON chat_messages(sender_id);`); } catch (e) { }
    // chat_participants: queried on every room load and unread count
    try { await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_chatpart_room_user ON chat_participants(room_id, user_id);`); } catch (e) { }
    try { await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_chatpart_user ON chat_participants(user_id);`); } catch (e) { }
    try { await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_chatpart_lastread ON chat_participants(user_id, last_read_at);`); } catch (e) { }
    // chat_rooms: always filtered by institute_id
    try { await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_chatroom_institute ON chat_rooms(institute_id, type);`); } catch (e) { }
    try { await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_chatroom_faculty ON chat_rooms(faculty_id);`); } catch (e) { }
    try { await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_chatroom_subject ON chat_rooms(subject_id);`); } catch (e) { }
    console.log("✅ Chat performance indexes verified/created");

    console.log("âœ… Phase 2.2: Performance indexes verified/created");
    }

    // Seed plans if not exists
    const seedPlans = require("./seeders/seedPlans");
    await seedPlans();

    // Create super admin if not exists
    const createSuperAdmin = require("./seeders/createSuperAdmin");
    await createSuperAdmin();
  } catch (error) {
    console.error("âŒ Database error:", error.message);
    console.error("Please ensure PostgreSQL is running and database exists / credentials are correct");
  }
};

// Sync database on startup (only in development/production, NOT in tests)
if (process.env.NODE_ENV !== "test") {
  syncDatabase();
}

module.exports = app;
