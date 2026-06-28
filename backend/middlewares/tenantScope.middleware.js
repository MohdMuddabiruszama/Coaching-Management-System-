/**
 * ✅ PHASE 10: Multi-Tenant Scope Safety Net
 * ─────────────────────────────────────────────────────────────────────────────
 * This middleware is a safety net — it VALIDATES that every authenticated
 * request has a valid institute_id before reaching any controller.
 *
 * Without this, a single missing `institute_id` filter in a query could
 * accidentally expose data from ALL institutes — a silent, critical bug.
 *
 * This middleware:
 *   1. Rejects requests where req.user.institute_id is missing (except super_admin)
 *   2. Attaches req.instituteId as a convenient shorthand for controllers
 *   3. Is mounted AFTER auth middleware on all protected routes
 *
 * Mount in app.js on specific route groups:
 *   const tenantScope = require('./middlewares/tenantScope.middleware');
 *   app.use('/api/students',   authMiddleware, tenantScope, ...);
 *   app.use('/api/faculty',    authMiddleware, tenantScope, ...);
 *   app.use('/api/attendance', authMiddleware, tenantScope, ...);
 *   etc.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { AuthError } = require("../utils/AppError");

/**
 * Roles that are allowed to operate WITHOUT an institute_id.
 * super_admin manages all institutes and should NOT be filtered.
 */
const GLOBAL_ROLES = new Set(["super_admin"]);

const tenantScope = (req, res, next) => {
    const user = req.user;

    // No user = auth middleware didn't run or failed — should not reach here
    if (!user) {
        return next(new AuthError("Authentication required"));
    }

    // Global roles (super_admin) bypass tenant scoping
    if (GLOBAL_ROLES.has(user.role)) {
        req.instituteId = null; // Explicit: super_admin has no single institute
        return next();
    }

    // All other roles MUST have institute_id
    if (!user.institute_id) {
        return next(
            new AuthError(
                "No institute context found. Please log in again."
            )
        );
    }

    // ✅ Attach convenient shorthand for use in controllers
    // Controllers can use req.instituteId instead of req.user.institute_id
    req.instituteId = user.institute_id;

    next();
};

module.exports = tenantScope;
