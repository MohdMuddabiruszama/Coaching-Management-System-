/**
 * ✅ PHASE 2: Centralized Error Handling Middleware
 * ─────────────────────────────────────────────────────────────────────────────
 * This is the SINGLE error pipeline for every route in the application.
 * All errors — whether from controllers, middleware, or Sequelize — flow here.
 *
 * Mount LAST in app.js, after all routes and after Sentry.setupExpressErrorHandler().
 *
 * Error flow:
 *   Controller throws → catchAsync passes to next(err) → this middleware
 *   → classifies error → logs it → sends standardized JSON response
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { sendError, sendValidationError } = require("../utils/apiResponse");
const { AppError }                        = require("../utils/AppError");

// Logger with graceful fallback (in case logger.js hasn't been installed yet)
let logError;
try {
    logError = require("../utils/logger").logError;
} catch {
    logError = (err, type, ctx) => console.error(`[${type}]`, err.message, ctx);
}

// ── Reference ID generator ─────────────────────────────────────────────────
// Attach a unique ID to every 500 error so users can quote it to support
const generateReferenceId = () =>
    `REF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

// ── Main Error Handler ─────────────────────────────────────────────────────
const errorHandler = (err, req, res, next) => {
    // ── Skip if response already started (streaming) ──────────────────────
    if (res.headersSent) return next(err);

    // ── Determine status code ──────────────────────────────────────────────
    const statusCode = err.statusCode || err.status || 500;

    // ── Log the error with full context ────────────────────────────────────
    logError(err, "apiError", { req });

    // ==================================================================
    // SEQUELIZE ERRORS
    // ==================================================================

    // Validation error (model-level constraints)
    if (err.name === "SequelizeValidationError") {
        const errors = err.errors.map((e) => ({ field: e.path, message: e.message }));
        return sendValidationError(res, errors);
    }

    // Unique constraint violation (duplicate key)
    if (err.name === "SequelizeUniqueConstraintError") {
        const field = err.errors?.[0]?.path || "value";
        return sendError(res, `${field} already exists`, 409, null);
    }

    // Foreign key constraint violation
    if (err.name === "SequelizeForeignKeyConstraintError") {
        return sendError(
            res,
            "This record is linked to other data and cannot be deleted",
            409,
            null
        );
    }

    // Database connection errors → 503 (degraded, not 500)
    if (
        err.name === "SequelizeConnectionError" ||
        err.name === "SequelizeConnectionRefusedError" ||
        err.name === "SequelizeConnectionAcquireTimeoutError" ||
        err.name === "SequelizeConnectionTimedOutError" ||
        err.name === "SequelizeHostNotFoundError" ||
        err.name === "SequelizeHostNotReachableError"
    ) {
        return sendError(
            res,
            "Database is temporarily unavailable. Please try again in a moment.",
            503,
            null
        );
    }

    // Deadlock — transient, safe to retry
    if (
        err.name === "SequelizeDatabaseError" &&
        err.parent?.code === "ER_LOCK_DEADLOCK"
    ) {
        return sendError(
            res,
            "Request temporarily failed due to high load. Please try again.",
            503,
            null
        );
    }

    // General Sequelize database error (syntax, constraint, etc.)
    if (err.name === "SequelizeDatabaseError") {
        const isDev = process.env.NODE_ENV === "development";
        return sendError(
            res,
            isDev ? `Database error: ${err.message}` : "A database error occurred. Our team has been notified.",
            500,
            null
        );
    }

    // ==================================================================
    // JWT ERRORS
    // ==================================================================

    if (err.name === "JsonWebTokenError") {
        return sendError(res, "Invalid token. Please log in again.", 401, null);
    }

    if (err.name === "TokenExpiredError") {
        return sendError(res, "Session expired. Please log in again.", 401, null);
    }

    // ==================================================================
    // JOI VALIDATION ERRORS
    // ==================================================================

    if (err.isJoi) {
        const errors = err.details.map((e) => ({
            field:   e.path.join("."),
            message: e.message.replace(/['"]/g, ""),
        }));
        return sendValidationError(res, errors);
    }

    // ==================================================================
    // MULTER FILE UPLOAD ERRORS
    // ==================================================================

    if (err.code === "LIMIT_FILE_SIZE") {
        return sendError(res, "File size too large. Maximum 5MB allowed.", 400, null);
    }

    if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return sendError(res, "Unexpected file field in upload.", 400, null);
    }

    if (err.code === "LIMIT_FILE_COUNT") {
        return sendError(res, "Too many files uploaded at once.", 400, null);
    }

    // ==================================================================
    // OUR CUSTOM AppError (isOperational = true)
    // Shows the actual message to the user — it's safe to do so
    // ==================================================================

    if (err instanceof AppError && err.isOperational) {
        const body = {
            success:   false,
            message:   err.message,
            errorCode: err.errorCode || null,
        };
        if (err.details) body.details = err.details;
        return res.status(err.statusCode).json(body);
    }

    // ==================================================================
    // UNEXPECTED / NON-OPERATIONAL ERRORS (bugs, uncaught conditions)
    // Never expose raw error details to the client in production
    // ==================================================================

    const referenceId = generateReferenceId();

    if (process.env.NODE_ENV === "development") {
        // In dev: full error for debugging
        return res.status(statusCode).json({
            success:   false,
            message:   err.message || "Internal server error",
            stack:     err.stack,
            errorCode: "INTERNAL_ERROR",
            referenceId,
        });
    }

    // In production: safe generic message with reference ID
    return res.status(500).json({
        success:     false,
        message:     "Something went wrong on our end. Our team has been notified.",
        errorCode:   "INTERNAL_ERROR",
        referenceId, // User can quote this to support for faster debugging
    });
};

module.exports = errorHandler;
