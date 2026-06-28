/**
 * ✅ PHASE 2: Custom Error Class Hierarchy
 * ─────────────────────────────────────────────────────────────────────────────
 * AppError is the base class for all operational (expected) errors.
 * The isOperational flag distinguishes "expected" errors (like 404, validation)
 * from "unexpected" bugs (like TypeError on undefined).
 *
 * Operational errors → clean user-friendly message sent to client
 * Non-operational errors → generic "Internal server error" sent to client,
 *                          full details logged internally
 *
 * Usage in controllers:
 *   throw new NotFoundError('Student');
 *   throw new DuplicateError('email');
 *   throw new BusinessRuleError('Cannot mark attendance for future dates');
 *   throw new AppError('Custom message', 422, 'CUSTOM_CODE');
 * ─────────────────────────────────────────────────────────────────────────────
 */

class AppError extends Error {
    /**
     * @param {string} message    - User-facing error message
     * @param {number} statusCode - HTTP status code (400, 403, 404, 409, 422, etc.)
     * @param {string} errorCode  - Machine-readable code for frontend handling
     * @param {any}    details    - Optional additional details (validation field list, etc.)
     */
    constructor(message, statusCode = 500, errorCode = null, details = null) {
        super(message);
        this.name        = this.constructor.name;
        this.statusCode  = statusCode;
        this.errorCode   = errorCode;
        this.details     = details;
        this.isOperational = true; // Distinguishes expected errors from bugs
        Error.captureStackTrace(this, this.constructor);
    }
}

// ── 400 Bad Request ────────────────────────────────────────────────────────
class ValidationError extends AppError {
    constructor(message, details = null) {
        super(message, 400, "VALIDATION_ERROR", details);
    }
}

// ── 401 Unauthorized ──────────────────────────────────────────────────────
class AuthError extends AppError {
    constructor(message = "Authentication required") {
        super(message, 401, "AUTH_ERROR");
    }
}

// ── 403 Forbidden ─────────────────────────────────────────────────────────
class ForbiddenError extends AppError {
    constructor(message = "You do not have permission to perform this action") {
        super(message, 403, "FORBIDDEN");
    }
}

// ── 404 Not Found ─────────────────────────────────────────────────────────
class NotFoundError extends AppError {
    constructor(resource = "Resource") {
        super(`${resource} not found`, 404, "NOT_FOUND");
    }
}

// ── 409 Conflict / Duplicate ───────────────────────────────────────────────
class DuplicateError extends AppError {
    constructor(field = "Value") {
        super(`${field} already exists`, 409, "DUPLICATE_ENTRY");
    }
}

// ── 422 Business Rule Violation ───────────────────────────────────────────
// Use when the request is syntactically valid but violates business logic
// (e.g., marking attendance for a future date, paying an already-paid fee)
class BusinessRuleError extends AppError {
    constructor(message) {
        super(message, 422, "BUSINESS_RULE_VIOLATION");
    }
}

// ── 429 Rate Limit ────────────────────────────────────────────────────────
class RateLimitError extends AppError {
    constructor(message = "Too many requests — please try again later") {
        super(message, 429, "RATE_LIMIT_EXCEEDED");
    }
}

// ── 503 Service Unavailable ───────────────────────────────────────────────
// Use when a dependency (DB, Razorpay, Cloudinary) is temporarily unavailable
class ServiceUnavailableError extends AppError {
    constructor(service = "Service") {
        super(
            `${service} is temporarily unavailable. Please try again in a moment.`,
            503,
            "SERVICE_UNAVAILABLE"
        );
    }
}

module.exports = {
    AppError,
    ValidationError,
    AuthError,
    ForbiddenError,
    NotFoundError,
    DuplicateError,
    BusinessRuleError,
    RateLimitError,
    ServiceUnavailableError,
};
