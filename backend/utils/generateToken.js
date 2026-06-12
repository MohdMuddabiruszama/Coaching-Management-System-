/**
 * ✅ Phase A Step A3: JWT Token Generation Utility
 *
 * Two-token architecture:
 *   - Access Token:  Short-lived (15 min), Authorization header
 *   - Refresh Token: Long-lived (7 days), stored hashed in DB for revocation
 *
 * Phase A Enhancement:
 *   - Access token now embeds name, email, institute_name, permissions
 *   - This eliminates 2 extra DB lookups per request (was: fetch name, fetch permissions)
 *   - At 1,000 req/min → saves 2,000 DB queries/min just from this change
 *
 * ROLE_PERMISSIONS: Pre-computed permission claims per role.
 *   Avoids a permissions DB lookup on every protected route.
 */
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Phase A: Role → Permission Mapping ──────────────────────────────────────
// Pre-computed permission sets per role.
// Used to embed permissions in JWT — no DB query needed per request.
const ROLE_PERMISSIONS = {
    super_admin: ["*"], // All permissions
    admin: [
        "students:read", "students:write", "students:delete",
        "faculty:read", "faculty:write", "faculty:delete",
        "fees:read", "fees:write",
        "attendance:read", "attendance:write",
        "timetable:read", "timetable:write",
        "announcements:read", "announcements:write",
        "exams:read", "exams:write",
        "reports:read", "reports:export",
        "settings:read", "settings:write",
        "salary:read", "salary:write",
        "expenses:read", "expenses:write",
        "chat:read", "chat:write",
        "notes:read", "notes:write",
        "assignments:read", "assignments:write",
    ],
    manager: [
        "students:read", "students:write",
        "fees:read", "fees:write",
        "attendance:read",
        "reports:read",
        "announcements:read",
    ],
    faculty: [
        "students:read",
        "attendance:read", "attendance:write",
        "timetable:read",
        "exams:read", "exams:write",
        "marks:write",
        "notes:read", "notes:write",
        "assignments:read", "assignments:write",
        "announcements:read",
        "chat:read", "chat:write",
    ],
    student: [
        "profile:read",
        "fees:read",
        "timetable:read",
        "attendance:read",
        "announcements:read",
        "notes:read",
        "assignments:read", "assignments:write",
        "chat:read", "chat:write",
    ],
    parent: [
        "children:read",
        "fees:read",
        "attendance:read",
        "announcements:read",
        "chat:read",
    ],
};

/**
 * ✅ Phase A: Enriched access token — zero extra DB calls per request
 *
 * Embeds: id, role, institute_id, name, email, institute_name, permissions
 * Controllers read from req.user — no DB hit needed for identity info.
 *
 * @param {Object} user - Sequelize User instance or plain object
 * @param {Object} [instituteData] - Optional {name, status} for the institute
 */
const generateAccessToken = (user, instituteData = null) => {
    // Support both Sequelize instances and plain objects
    const plain = user.toJSON ? user.toJSON() : user;

    // Determine institute name from multiple possible sources
    const instituteName =
        instituteData?.name ||
        plain.Institute?.name ||
        plain.institute_name ||
        null;

    // Determine permissions — use DB permissions for manager (custom), else role-based
    const permissions =
        plain.role === "manager" && plain.permissions
            ? plain.permissions           // Manager gets custom per-user permissions from DB
            : (ROLE_PERMISSIONS[plain.role] || []);

    return jwt.sign(
        {
            // ── Identity ──────────────────────────────────────────────────────
            id:           plain.id,
            role:         plain.role,
            institute_id: plain.institute_id,
            type:         "access",

            // ── Phase A: Embedded claims (eliminates extra DB calls) ──────────
            name:           plain.name,
            email:          plain.email,
            institute_name: instituteName,
            permissions,
        },
        process.env.JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
};

/**
 * Generate a long-lived refresh token (7 days).
 * Random bytes — not a JWT. Stored hashed in DB for revocation.
 */
const generateRefreshToken = () => {
    const token = crypto.randomBytes(40).toString("hex");
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
    return { token, hash, expiresAt };
};

/**
 * Hash a refresh token for DB lookup comparison.
 */
const hashRefreshToken = (token) => {
    return crypto.createHash("sha256").update(token).digest("hex");
};

/**
 * Legacy: Long-lived single token (backward compatibility during transition).
 * @deprecated Use generateAccessToken + generateRefreshToken instead.
 */
const generateToken = (user, instituteData = null) => {
    const plain = user.toJSON ? user.toJSON() : user;
    const instituteName = instituteData?.name || plain.Institute?.name || plain.institute_name || null;
    return jwt.sign(
        {
            id:           plain.id,
            role:         plain.role,
            institute_id: plain.institute_id,
            name:         plain.name,
            email:        plain.email,
            institute_name: instituteName,
            permissions:  plain.role === "manager" && plain.permissions
                ? plain.permissions
                : (ROLE_PERMISSIONS[plain.role] || []),
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    hashRefreshToken,
    generateToken,          // Legacy — kept for backward compat
    ROLE_PERMISSIONS,       // Exported for use in auth middleware
    ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_EXPIRY,
    REFRESH_TOKEN_EXPIRY_MS,
};
