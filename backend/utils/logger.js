/**
 * ✅ PHASE 6: Centralized Structured Logger (Winston)
 * ─────────────────────────────────────────────────────────────────────────────
 * Every error log includes institute_id, user_id, role, and request path so
 * you can instantly identify WHICH institute had a problem — essential for
 * a multi-tenant SaaS where many institutes share the same process.
 *
 * Log files are rotated daily and auto-deleted after retention period.
 * Console output is always available for Render/Railway log tailing.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const path = require("path");
const fs   = require("fs");

// ── Ensure logs/ directory exists ─────────────────────────────────────────
const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

let winston;
try {
    winston = require("winston");
    require("winston-daily-rotate-file");
} catch {
    // Graceful fallback if winston is not installed yet
    const fallback = {
        info:  (...a) => console.log(...a),
        warn:  (...a) => console.warn(...a),
        error: (...a) => console.error(...a),
        debug: (...a) => console.debug?.(...a),
    };
    module.exports = { logger: fallback, logError };
    return;
}

const { combine, timestamp, json, colorize, printf, errors } = winston.format;

// ── Console format (human-readable in dev) ────────────────────────────────
const consoleFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0
        ? `\n  ${JSON.stringify(meta, null, 2).replace(/\n/g, "\n  ")}`
        : "";
    return `${ts} [${level}]: ${message}${metaStr}`;
});

// ── Transports ─────────────────────────────────────────────────────────────
const transports = [];

// File: error-only log with 30-day retention
transports.push(new winston.transports.DailyRotateFile({
    filename:    path.join(logsDir, "error-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    level:       "error",
    maxFiles:    "30d",
    zippedArchive: true,
    format:      combine(timestamp(), errors({ stack: true }), json()),
}));

// File: combined log with 14-day retention
transports.push(new winston.transports.DailyRotateFile({
    filename:    path.join(logsDir, "combined-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    maxFiles:    "14d",
    zippedArchive: true,
    format:      combine(timestamp(), errors({ stack: true }), json()),
}));

// Console: always on, human-readable in dev, JSON in production
transports.push(new winston.transports.Console({
    format: process.env.NODE_ENV === "production"
        ? combine(timestamp(), json())
        : combine(
            colorize({ all: true }),
            timestamp({ format: "HH:mm:ss" }),
            consoleFormat,
          ),
}));

// ── Logger Instance ────────────────────────────────────────────────────────
const logger = winston.createLogger({
    level:       process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
    exitOnError: false,  // Never crash the process on a logging error
    transports,
});

/**
 * logError — Structured error logger with multi-tenant context.
 *
 * Always pass req when available so institute_id and user_id are logged.
 * This turns "something broke" into "Institute #34, Admin #112, at /api/fees, 3:42 PM".
 *
 * @param {Error}  err     - The caught error
 * @param {string} type    - Context label (e.g. 'apiError', 'biometricSync')
 * @param {Object} context - Extra fields; req is the Express request object
 */
const logError = (err, type = "error", context = {}) => {
    const { req, ...rest } = context;
    logger.error(err.message || String(err), {
        type,
        errorCode:    err.errorCode   || null,
        isOperational: err.isOperational || false,
        stack:        err.stack       || null,
        // Multi-tenant context — critical for debugging production issues
        institute_id: req?.user?.institute_id || rest.institute_id || null,
        user_id:      req?.user?.id           || rest.user_id      || null,
        role:         req?.user?.role         || rest.role         || null,
        path:         req?.originalUrl        || rest.path         || null,
        method:       req?.method             || rest.method       || null,
        request_id:   req?.requestId          || null,
        timestamp:    new Date().toISOString(),
        ...rest,
    });
};

module.exports = { logger, logError };
