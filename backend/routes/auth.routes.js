const express    = require("express");
const router     = express.Router();
const rateLimit  = require("express-rate-limit");
const authController = require("../controllers/auth.controller");
const verifyToken    = require("../middlewares/auth.middleware");
const uploadLogo     = require("../middlewares/upload.middleware");
const validate       = require("../middlewares/validate.middleware"); // ✅ Phase 7: Joi Validation
const authValidator  = require("../validators/auth.validator");

// ── Rate limiter: max 5 OTP-email requests per IP per 15 minutes ────────────
const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many OTP requests. Please try again after 15 minutes." }
});

// ── Legacy routes (kept for backward compatibility) ─────────────────────────
router.post("/register",           uploadLogo.single("logo"), authController.register);
router.post("/register-institute", uploadLogo.single("logo"), authController.registerInstitute);
router.post("/send-otp",           authController.sendOtp);

// ── Public: OTP Mode status (no auth required) ───────────────────────────────
router.get("/otp-mode", authController.getOtpMode);

// ── Public: App Version Config (no auth required) ────────────────────────────
router.get("/app-version", (req, res) => {
    res.json({
        success: true,
        minVersion: process.env.MIN_APP_VERSION || "1.0.0",
        latestVersion: process.env.LATEST_APP_VERSION || "1.0.0",
        playStoreUrl: process.env.PLAY_STORE_URL || "https://play.google.com/store/apps/details?id=com.yourapp.id",
        appStoreUrl: process.env.APP_STORE_URL || "https://apps.apple.com/app/idYOUR_APP_ID"
    });
});

// ── Auth ─────────────────────────────────────────────────────────────────────
router.post("/login",            validate(authValidator.login), authController.login);
router.post("/logout",           authController.logout);
router.post("/change-password",  verifyToken, validate(authValidator.changePassword), authController.changePassword);
router.get( "/profile",          verifyToken, authController.getProfile);
router.put( "/profile",          verifyToken, authController.updateProfile);
router.put( "/theme",            verifyToken, authController.saveTheme);

// ── NEW: Registration with OTP ───────────────────────────────────────────────
router.post("/register-init",       otpLimiter, validate(authValidator.registerInit), authController.registerInit);
router.post("/verify-registration", uploadLogo.single("logo"), validate(authValidator.verifyRegistration), authController.verifyRegistrationOtp);
router.post("/resend-otp",                      authController.resendOtp);

// ── NEW: Forgot Password with OTP ────────────────────────────────────────────
router.post("/forgot-password",  otpLimiter, validate(authValidator.forgotPassword), authController.forgotPassword);
router.post("/reset-password",               validate(authValidator.resetPassword), authController.resetPassword);

// ── ✅ Phase 7: Token Refresh & Session Management ───────────────────────────
router.post("/refresh",          validate(authValidator.refreshToken), authController.refreshAccessToken);      // No auth — refresh token is the credential
router.post("/revoke-sessions",  verifyToken, authController.revokeAllSessions); // Requires auth — logout all devices

// ── DB Health Check ──────────────────────────────────────────────────────────
const sequelize = require("../config/database");
router.get("/test-db", async (req, res) => {
    try {
        await sequelize.authenticate();
        const [tables] = await sequelize.query("SHOW TABLES");
        const [dbInfo]  = await sequelize.query("SELECT DATABASE() as current_db");
        res.json({
            success: true,
            message: "Database connected successfully",
            database: dbInfo[0].current_db,
            tables: tables.map(t => Object.values(t)[0])
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

