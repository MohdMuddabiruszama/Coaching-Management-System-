const authService = require("../services/auth.service");
const { generateAccessToken, generateRefreshToken, hashRefreshToken, generateToken } = require("../utils/generateToken");
const emailService = require("../services/email.service");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { InstitutePublicProfile, RefreshToken } = require("../models");
const { generateOtp, saveOtp, validateOtp, invalidateOtp } = require("../utils/otp.util");
const { Institute, OtpVerification } = require("../models");
const { Op } = require("sequelize");

// ─── Legacy in-memory cache (kept for backward compat with /send-otp) ───────
const { catchAsync } = require("../utils/catchAsync");const otpCache = new Map();

// ─── OTP Test Mode helper ────────────────────────────────────────────────────
// Returns true when OTP_TEST_MODE env var is 'true' (case-insensitive)
const isTestMode = () => (process.env.OTP_TEST_MODE || "").toLowerCase() === "true";

/**
 * GET /api/auth/otp-mode
 * Public endpoint — returns current OTP mode so the register page
 * can display a banner and auto-fill the test OTP.
 */
exports.getOtpMode = (req, res) => {
  res.json({ success: true, testMode: isTestMode() });
};

/**
 * PUT /api/superadmin/otp-mode  (called from superadmin controller via this helper)
 * Sets OTP_TEST_MODE at runtime (process.env, survives until server restart).
 * For permanent change, edit backend/.env
 */
exports.setOtpMode = (req, res) => {
  const { testMode } = req.body;
  if (typeof testMode !== "boolean") {
    return res.status(400).json({ success: false, message: "testMode must be a boolean" });
  }
  process.env.OTP_TEST_MODE = testMode ? "true" : "false";
  res.json({
    success: true,
    message: `OTP mode switched to ${testMode ? "TEST (no emails)" : "REAL (emails sent)"}`,
    testMode
  });
};


/**
 * Register a new institute
 * Creates institute and admin user
 */
exports.register = catchAsync(async (req, res) => {
  try {
    const payload = { ...req.body };
    if (req.file && req.file.path) {
      payload.logo = req.file.path;
    }
    const result = await authService.registerInstitute(payload);

    // TODO: Send welcome email (emailService not configured yet)
    // const emailService = require("../services/email.service");
    // await emailService.sendEmail(...)

    res.status(201).json({
      success: true,
      message: "Institute registered successfully",
      data: {
        instituteName: result.institute.name,
        email: result.institute.email
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Registration failed"
    });
  }
});

/**
 * Public Institute Registration
 * Creates institute with pending status and admin user
 */
exports.registerInstitute = catchAsync(async (req, res) => {
  try {
    const { name, email, password, phone, address, city, state, pincode, plan_id, otp } = req.body;

    // Handle logo upload
    const logo = req.file ? req.file.path : null;

    // Phase 3: OTP Validation
    if (!otp || otpCache.get(email.trim().toLowerCase()) !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP"
      });
    }
    otpCache.delete(email.trim().toLowerCase());

    // Validation
    if (!name || !email || !password || !phone || !plan_id) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided"
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    // Password validation
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters"
      });
    }

    // Phone validation
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ""))) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number"
      });
    }

    const result = await authService.registerInstitute({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      phone: phone.replace(/\s/g, ""),
      address: address?.trim(),
      city: city?.trim(),
      state: state?.trim(),
      pincode: pincode?.trim(),
      plan_id,
      status: "pending" // Institute starts as pending until payment
    });

    const token = generateAccessToken(result.adminUser);

    res.status(201).json({
      success: true,
      message: "Registration successful! Please complete payment to activate your account.",
      token,
      user: {
        id: result.adminUser.id,
        name: result.adminUser.name,
        email: result.adminUser.email,
        role: result.adminUser.role,
        institute_id: result.institute.id,
        institute_name: result.institute.name
      },
      data: {
        institute_id: result.institute.id,
        email: result.institute.email,
        name: result.institute.name
      }
    });
  } catch (error) {
    console.error("Public registration error:", error);

    // Handle duplicate email
    if (error.message && error.message.includes("email")) {
      return res.status(400).json({
        success: false,
        message: "This email is already registered"
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Registration failed"
    });
  }
});

/**
 * Login user
 * Returns JWT token and user info
 */
exports.login = catchAsync(async (req, res) => {
  try {
    const { email, password, source } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const user = await authService.loginUser(email, password);

    // Check if user's institute is suspended
    if (user.role !== 'super_admin' && user.Institute) {
      const instituteStatus = user.Institute.status;
      if (instituteStatus === 'suspended' || instituteStatus === 'blocked') {
        return res.status(403).json({
          success: false,
          message: "Your institute account has been suspended by the administrator. Please contact support to regain access.",
          code: "INSTITUTE_SUSPENDED"
        });
      }
    }

    // ✅ Phase A + Phase 7: Enriched JWT — embeds name, email, institute_name, permissions
    // This eliminates 2 extra DB lookups per request in auth middleware.
    const instituteData = user.Institute ? { name: user.Institute.name } : null;
    const accessToken = generateAccessToken(user, instituteData);
    const refresh = generateRefreshToken();

    // Store refresh token hash in DB (enables revocation & session management)
    await RefreshToken.create({
      user_id: user.id,
      token_hash: refresh.hash,
      expires_at: refresh.expiresAt,
      device_info: req.headers["user-agent"] || null,
      ip_address: req.ip
    });

    const token = accessToken; // backward compatibility — frontend uses 'token' field

    let features = {};

    // Block mobile app login if plan does not include mobile app feature
    if (source === 'mobile' && user.Institute && user.Institute.Plan) {
      const plan = user.Institute.Plan;
      const hasMobileApp = user.Institute.current_feature_mobile_app !== undefined && user.Institute.current_feature_mobile_app !== null ?
      user.Institute.current_feature_mobile_app :
      plan.feature_mobile_app;

      if (!hasMobileApp) {
        return res.status(403).json({
          success: false,
          message: "Login failed. Your institute's plan does not include Mobile App access. Please log in through the website."
        });
      }
    }

    if (user.Institute && user.Institute.Plan) {
      const plan = user.Institute.Plan;
      const { computeFeatures } = require('../middlewares/planLimits.middleware');
      features = computeFeatures(user.Institute, plan);
    }

    // Fetch institute logo (non-blocking, fallback to public profile)
    let instituteLogo = user.Institute?.logo || null;
    if (!instituteLogo) {
      try {
        const pubProfile = await InstitutePublicProfile.findOne({
          where: { institute_id: user.institute_id },
          attributes: ['logo_url']
        });
        instituteLogo = pubProfile?.logo_url || null;
      } catch (_) {}
    }

    res.json({
      success: true,
      message: "Login successful",
      token,
      accessToken,
      refreshToken: refresh.token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        is_first_login: user.is_first_login,
        institute_id: user.institute_id,
        institute_name: user.Institute?.name,
        institute_status: user.Institute?.status,
        institute_phone: user.Institute?.phone,
        institute_logo: instituteLogo,
        subscription_end: user.Institute?.subscription_end,
        is_lifetime_member: user.Institute?.is_lifetime_member || false,
        plan_name: user.Institute?.Plan?.name,
        features,
        permissions: user.permissions || [],
        theme_dark: user.theme_dark ?? false,
        theme_style: user.theme_style ?? "simple"
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(401).json({
      success: false,
      message: error.message || "Login failed"
    });
  }
});

exports.changePassword = catchAsync(async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    await authService.changePassword(userId, oldPassword, newPassword);

    // If it was their first login, clear the flag and the initial password
    const { User } = require('../models');
    await User.update({
      is_first_login: false,
      initial_password: null
    }, { where: { id: userId } });

    res.status(200).json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

exports.logout = (req, res) => {
  res.status(200).json({
    success: true,
    message: "Logged out successfully"
  });
};

exports.getProfile = catchAsync(async (req, res) => {
  try {
    const user = await authService.getProfile(req.user.id);
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

exports.updateProfile = catchAsync(async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await authService.updateProfile(req.user.id, { name, email });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Save Theme Preference
 * Stores dark/style choice per user in the database
 */
exports.saveTheme = catchAsync(async (req, res) => {
  try {
    const { theme_dark, theme_style } = req.body;
    const User = require("../models/user");
    await User.update(
      {
        ...(theme_dark !== undefined && { theme_dark }),
        ...(theme_style !== undefined && { theme_style })
      },
      { where: { id: req.user.id } }
    );
    res.json({ success: true, message: "Theme saved" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

exports.sendOtp = catchAsync(async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpCache.set(email.trim().toLowerCase(), otp);

    try {
      await emailService.sendEmail(email, "Registration OTP", `<p>Your OTP for registration is: <strong>${otp}</strong></p>`);
    } catch (e) {
      console.log(`Failed to send OTP email configured via SMTP. Falling back logic: OTP for ${email} is ${otp}`);
    }

    // Let it expire in 10 minutes
    setTimeout(() => {
      if (otpCache.get(email.trim().toLowerCase()) === otp) {
        otpCache.delete(email.trim().toLowerCase());
      }
    }, 10 * 60 * 1000);

    const isDev = !process.env.EMAIL_USER || process.env.EMAIL_USER === "your_email@gmail.com";
    res.json({
      success: true,
      message: "OTP sent successfully. Please check your email.",
      devOtp: isDev ? otp : undefined
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to send OTP" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// NEW OTP SYSTEM — DB-backed, secure, resend-limited, attempt-locked
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Step 1 of Registration — Send OTP to email
 * POST /api/auth/register-init
 */
exports.registerInit = catchAsync(async (req, res) => {
  try {
    const { name, email, phone, password, plan_id } = req.body;

    // Validation
    if (!name || !email || !phone || !password || !plan_id) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    // Check if already registered AND verified
    const existing = await Institute.findOne({ where: { email: email.trim().toLowerCase() } });
    if (existing && existing.email_verified) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered. Please login."
      });
    }

    const otp = generateOtp();
    await saveOtp(email.trim().toLowerCase(), otp, "registration");

    // Allow frontend to explicitly request test mode via UI toggle
    const effectiveTestMode = req.body.testMode !== undefined ? req.body.testMode : isTestMode();

    // ── Test Mode: skip email, return OTP directly ─────────────────────────
    if (effectiveTestMode) {
      console.log(`🧪 [TEST MODE] Registration OTP for ${email}: ${otp}`);
      return res.status(200).json({
        success: true,
        message: "✅ Test Mode: OTP generated instantly (no email sent).",
        testMode: true,
        testOtp: otp
      });
    }

    // ── Real Mode: send via email ──────────────────────────────────────────
    try {
      await emailService.sendOtpEmail(email.trim().toLowerCase(), otp, "registration");
    } catch (mailErr) {
      console.error("Email send failed:", mailErr.message);
      return res.status(500).json({ success: false, message: "Email service unavailable. Please try again later." });
    }

    res.status(200).json({
      success: true,
      message: "OTP sent to your email. Please verify to complete registration.",
      testMode: false
    });
  } catch (error) {
    console.error("registerInit error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to send OTP." });
  }
});

/**
 * Step 2 of Registration — Verify OTP and create account
 * POST /api/auth/verify-registration
 */
exports.verifyRegistrationOtp = catchAsync(async (req, res) => {
  try {
    const { email, otp, name, phone, password, plan_id, address, city, state, pincode } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required." });
    }

    const { valid, message, record } = await validateOtp(email.trim().toLowerCase(), otp, "registration");
    if (!valid) return res.status(400).json({ success: false, message });

    // NOTE: Do NOT pre-hash — authService.registerInstitute hashes internally
    // Create Institute (using existing authService for consistency)
    const result = await authService.registerInstitute({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password, // raw — service will hash
      phone: phone.replace(/\s/g, ""),
      address: address?.trim(),
      city: city?.trim(),
      state: state?.trim(),
      pincode: pincode?.trim(),
      plan_id,
      status: "pending", // stays pending until payment
      logo: req.file ? req.file.path : null
    });

    // Mark email as verified after account creation
    await result.institute.update({ email_verified: true });

    // Mark OTP used
    await invalidateOtp(record);

    // \u2705 Phase A: Enriched JWT \u2014 embed institute name at registration time
    const token = generateAccessToken(result.adminUser, { name: result.institute.name });

    res.status(201).json({
      success: true,
      message: "Account created successfully! Please complete payment to activate.",
      token,
      user: {
        id: result.adminUser.id,
        name: result.adminUser.name,
        email: result.adminUser.email,
        role: result.adminUser.role,
        institute_id: result.institute.id,
        institute_name: result.institute.name,
        institute_logo: result.institute.logo
      },
      data: {
        institute_id: result.institute.id,
        email: result.institute.email,
        name: result.institute.name
      }
    });
  } catch (error) {
    console.error("verifyRegistrationOtp error:", error);
    if (error.message && error.message.toLowerCase().includes("email")) {
      return res.status(400).json({ success: false, message: "This email is already registered." });
    }
    res.status(500).json({ success: false, message: error.message || "Verification failed." });
  }
});

/**
 * Forgot Password — Send OTP to registered email
 * POST /api/auth/forgot-password
 */
exports.forgotPassword = catchAsync(async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required." });

    const GENERIC = "If this email is registered, you will receive an OTP shortly.";

    const User = require("../models/user");
    const user = await User.findOne({ where: { email: email.trim().toLowerCase() } });
    if (!user) {
      // Security: never reveal if email exists
      return res.status(200).json({ success: true, message: GENERIC });
    }

    const otp = generateOtp();
    await saveOtp(email.trim().toLowerCase(), otp, "password_reset");

    // ── Test Mode ──────────────────────────────────────────────────────────
    if (isTestMode()) {
      console.log(`🧪 [TEST MODE] Password reset OTP for ${email}: ${otp}`);
      return res.status(200).json({
        success: true,
        message: GENERIC,
        testMode: true,
        testOtp: otp
      });
    }

    // ── Real Mode ──────────────────────────────────────────────────────────
    try {
      await emailService.sendOtpEmail(email.trim().toLowerCase(), otp, "password_reset");
    } catch (mailErr) {
      console.error("Forgot-password email send failed:", mailErr.message);
      return res.status(500).json({ success: false, message: "Email service unavailable. Please try again later." });
    }

    res.status(200).json({ success: true, message: GENERIC, testMode: false });
  } catch (error) {
    console.error("forgotPassword error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to process request." });
  }
});

/**
 * Reset Password — Verify OTP then update password
 * POST /api/auth/reset-password
 */
exports.resetPassword = catchAsync(async (req, res) => {
  try {
    const { email, otp, new_password, confirm_password } = req.body;

    if (!email || !otp || !new_password || !confirm_password) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }
    if (new_password !== confirm_password) {
      return res.status(400).json({ success: false, message: "Passwords do not match." });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
    }

    const { valid, message, record } = await validateOtp(email.trim().toLowerCase(), otp, "password_reset");
    if (!valid) return res.status(400).json({ success: false, message });

    const { hashPassword } = require("../utils/hashPassword");
    const hashed = await hashPassword(new_password);

    // Update the specific User's password
    const User = require("../models/user");
    const user = await User.findOne({ where: { email: email.trim().toLowerCase() } });
    if (!user) {
      return res.status(404).json({ success: false, message: "Account not found." });
    }

    await user.update({ password_hash: hashed });

    await invalidateOtp(record);

    res.status(200).json({ success: true, message: "Password reset successfully. Please login with your new password." });
  } catch (error) {
    console.error("resetPassword error:", error);
    res.status(500).json({ success: false, message: error.message || "Password reset failed." });
  }
});

/**
 * Resend OTP — Rate-limited to 3 resends per session
 * POST /api/auth/resend-otp
 */
exports.resendOtp = catchAsync(async (req, res) => {
  try {
    const { email, type } = req.body;
    if (!email || !type) {
      return res.status(400).json({ success: false, message: "Email and type are required." });
    }
    if (!["registration", "password_reset"].includes(type)) {
      return res.status(400).json({ success: false, message: "Invalid OTP type." });
    }

    // Check existing resend count before creating new OTP
    const existing = await OtpVerification.findOne({
      where: { email: email.trim().toLowerCase(), type, is_used: false },
      order: [["created_at", "DESC"]]
    });

    const maxResend = parseInt(process.env.OTP_MAX_RESEND) || 3;
    if (existing && existing.resend_count >= maxResend) {
      return res.status(429).json({
        success: false,
        message: `Maximum resend limit (${maxResend}) reached. Please restart the process.`
      });
    }

    // Save resend count before deleting old record
    const newResendCount = existing ? existing.resend_count + 1 : 1;

    const otp = generateOtp();
    // saveOtp deletes old unused OTPs for this email+type, then creates fresh one
    const newRecord = await saveOtp(email.trim().toLowerCase(), otp, type);
    // Store cumulative resend count
    await newRecord.update({ resend_count: newResendCount });

    // Allow frontend explicit test mode toggle
    const effectiveTestMode = req.body.testMode !== undefined ? req.body.testMode : isTestMode();

    // ── Test Mode ──────────────────────────────────────────────────────────
    if (effectiveTestMode) {
      console.log(`🧪 [TEST MODE] Resend OTP (${type}) for ${email}: ${otp}`);
      return res.status(200).json({
        success: true,
        message: `✅ Test Mode: New OTP generated instantly. Resends used: ${newResendCount}/${maxResend}`,
        testMode: true,
        testOtp: otp,
        resendCount: newResendCount,
        maxResend
      });
    }

    // ── Real Mode ──────────────────────────────────────────────────────────
    try {
      await emailService.sendOtpEmail(email.trim().toLowerCase(), otp, type);
    } catch (mailErr) {
      console.error("Resend OTP email failed:", mailErr.message);
      return res.status(500).json({ success: false, message: "Email service unavailable." });
    }

    res.status(200).json({
      success: true,
      message: "New OTP sent to your email.",
      testMode: false,
      resendCount: newResendCount,
      maxResend
    });
  } catch (error) {
    console.error("resendOtp error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to resend OTP." });
  }
});

/**
 * ✅ Phase 7: POST /api/auth/refresh
 * Exchange a valid refresh token for a new access token.
 * The refresh token itself is NOT rotated (simplifies mobile clients).
 */
exports.refreshAccessToken = catchAsync(async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ success: false, message: "Refresh token is required." });
    }

    // Hash the incoming token and look it up in DB
    const tokenHash = hashRefreshToken(refreshToken);
    const stored = await RefreshToken.findOne({
      where: { token_hash: tokenHash, is_revoked: false },
      include: [{
        model: require("../models").User,
        // ✅ Phase A: Include all fields needed for enriched JWT generation
        attributes: ["id", "role", "institute_id", "status", "name", "email"],
        include: [{ model: require("../models").Institute, attributes: ["name"] }]
      }]
    });

    if (!stored) {
      return res.status(401).json({ success: false, message: "Invalid or revoked refresh token.", code: "REFRESH_INVALID" });
    }

    // Check expiry
    if (new Date() > new Date(stored.expires_at)) {
      await stored.update({ is_revoked: true });
      return res.status(401).json({ success: false, message: "Refresh token expired. Please log in again.", code: "REFRESH_EXPIRED" });
    }

    // Check user still exists and is active
    const user = stored.User;
    if (!user || user.status === "blocked") {
      await stored.update({ is_revoked: true });
      return res.status(401).json({ success: false, message: "Account is blocked or not found.", code: "ACCOUNT_BLOCKED" });
    }

    // ✅ Phase A: Issue enriched access token — embeds name, email, institute_name
    const instituteData = user.Institute ? { name: user.Institute.name } : null;
    const newAccessToken = generateAccessToken(user, instituteData);

    res.json({
      success: true,
      message: "Token refreshed successfully.",
      token: newAccessToken,
      accessToken: newAccessToken
    });
  } catch (error) {
    console.error("refreshAccessToken error:", error);
    res.status(500).json({ success: false, message: "Failed to refresh token." });
  }
});

/**
 * ✅ Phase 7: POST /api/auth/revoke-sessions
 * Revoke all refresh tokens for the current user (logout from all devices).
 */
exports.revokeAllSessions = catchAsync(async (req, res) => {
  try {
    const userId = req.user.id;

    const count = await RefreshToken.update(
      { is_revoked: true },
      { where: { user_id: userId, is_revoked: false } }
    );

    res.json({
      success: true,
      message: `All sessions revoked. ${count[0]} device(s) logged out.`
    });
  } catch (error) {
    console.error("revokeAllSessions error:", error);
    res.status(500).json({ success: false, message: "Failed to revoke sessions." });
  }
});