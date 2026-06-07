/**
 * Biometric Attendance Routes
 * Covers device management, enrollment, punch receiver, settings, analytics
 */

const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");
const ctrl = require("../controllers/biometric.controller");

// ── Phase 2: Device Management ──────────────────────────────────
router.get("/devices", verifyToken, allowRoles("admin"), ctrl.getDevices);
router.post("/devices", verifyToken, allowRoles("admin"), ctrl.createDevice);
router.put("/devices/:id", verifyToken, allowRoles("admin"), ctrl.updateDevice);
router.delete("/devices/:id", verifyToken, allowRoles("admin"), ctrl.deleteDevice);
router.get("/devices/health", verifyToken, allowRoles("admin"), ctrl.getDevicesHealth);
router.get("/devices/:id/status", verifyToken, allowRoles("admin"), ctrl.getDeviceStatus);
router.post("/devices/:id/sync", verifyToken, allowRoles("admin"), ctrl.syncDevice);

// ── Phase 3: Enrollment ──────────────────────────────────────────
router.post("/enroll", verifyToken, allowRoles("admin"), ctrl.enroll);
router.get("/enrollments", verifyToken, allowRoles("admin"), ctrl.getEnrollments);
router.delete("/enrollments/:id", verifyToken, allowRoles("admin"), ctrl.removeEnrollment);
router.get("/enrollments/check/:userId", verifyToken, allowRoles("admin"), ctrl.checkEnrollment);

// ── Phase 4: Punch Receiver (no auth — device uses secret key) ──
router.post("/punch", ctrl.receivePunch);

// ── Phase 5: Manual Processing ───────────────────────────────────
router.post("/process-pending", verifyToken, allowRoles("admin"), ctrl.processPendingPunches);

// ── Settings ─────────────────────────────────────────────────────
router.get("/settings", verifyToken, allowRoles("admin"), ctrl.getSettings);
router.put("/settings", verifyToken, allowRoles("admin"), ctrl.updateSettings);

// ── Punch logs ───────────────────────────────────────────────────
router.get("/punch-log", verifyToken, allowRoles("admin"), ctrl.getPunchLogs);

// ── Phase 8: Analytics (mounted here & in attendance route) ──────
router.get("/live", verifyToken, allowRoles("admin", "faculty"), ctrl.getLiveAttendance);
router.get("/late-report", verifyToken, allowRoles("admin", "faculty"), ctrl.getLateReport);
router.get("/absent-report", verifyToken, allowRoles("admin", "faculty"), ctrl.getAbsentReport);
router.get("/class/:id", verifyToken, allowRoles("admin", "faculty"), ctrl.getClassBiometricAttendance);
router.get("/student/:id", verifyToken, ctrl.getStudentBiometricReport);

// ── Phase 12: Excel Export ───────────────────────────────────────
router.get("/export/excel", verifyToken, allowRoles("admin"), ctrl.exportExcel);

// ── Test Mode (Simulator — no physical device needed) ────────────
router.post("/test/setup-mock-device", verifyToken, allowRoles("admin"), ctrl.setupMockDevice);
router.post("/test/punch", verifyToken, allowRoles("admin"), ctrl.testPunch);
router.post("/test/heartbeat", verifyToken, allowRoles("admin"), ctrl.testHeartbeat);

module.exports = router;
