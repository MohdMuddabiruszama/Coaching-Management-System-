/**
 * Mobile Dashboard Routes
 * Phase 2C — Bundled single-call dashboard APIs for Capacitor mobile app
 */

const express    = require("express");
const router     = express.Router();
const verifyToken = require("../middlewares/auth.middleware");
const ctrl       = require("../controllers/mobileDashboard.controller");

// All mobile routes require authentication
router.use(verifyToken);

// ── Dashboard Endpoints ───────────────────────────────────────────────────────
/** GET /api/mobile/student/dashboard — Student bundled dashboard */
router.get("/student/dashboard",  ctrl.getStudentDashboard);

/** GET /api/mobile/faculty/dashboard — Faculty bundled dashboard */
router.get("/faculty/dashboard",  ctrl.getFacultyDashboard);

/** GET /api/mobile/parent/dashboard — Parent bundled dashboard */
router.get("/parent/dashboard",   ctrl.getParentDashboard);

// ── Phase 5A: FCM Push Token ──────────────────────────────────────────────────
/** POST /api/mobile/fcm-token — Register device FCM token */
router.post("/fcm-token",   ctrl.registerFcmToken);

/** DELETE /api/mobile/fcm-token — Remove device FCM token on logout */
router.delete("/fcm-token", ctrl.removeFcmToken);

module.exports = router;
