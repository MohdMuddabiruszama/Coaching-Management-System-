/**
 * ✅ Phase 7: JWT Token Generation Utility
 * 
 * Two-token architecture:
 *   - Access Token: Short-lived (15 min), sent in Authorization header
 *   - Refresh Token: Long-lived (7 days), stored in DB for revocation support
 * 
 * Why two tokens?
 *   If an access token is stolen, the attacker only has 15 minutes.
 *   Refresh tokens are stored server-side and can be revoked instantly.
 */
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const ACCESS_TOKEN_EXPIRY = "15m";    // 15 minutes
const REFRESH_TOKEN_EXPIRY = "7d";    // 7 days
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

/**
 * Generate a short-lived access token (15 min)
 * Contains user identity claims — used for API authentication
 */
const generateAccessToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            role: user.role,
            institute_id: user.institute_id,
            type: "access",
        },
        process.env.JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
};

/**
 * Generate a long-lived refresh token (7 days)
 * This is a random string (not a JWT) — stored hashed in the DB.
 * Cannot be decoded client-side — only validated server-side.
 */
const generateRefreshToken = () => {
    const token = crypto.randomBytes(40).toString("hex");
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
    return { token, hash, expiresAt };
};

/**
 * Hash a refresh token for DB lookup
 */
const hashRefreshToken = (token) => {
    return crypto.createHash("sha256").update(token).digest("hex");
};

/**
 * Legacy: Generate a single long-lived token (backward compatibility)
 * Used during transition period — will be removed after frontend migration
 */
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            role: user.role,
            institute_id: user.institute_id,
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    hashRefreshToken,
    generateToken, // Legacy — kept for backward compatibility
    ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_EXPIRY,
    REFRESH_TOKEN_EXPIRY_MS,
};
