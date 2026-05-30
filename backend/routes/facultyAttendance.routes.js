const express = require("express");
const router = express.Router();
const controller = require("../controllers/facultyAttendance.controller");
const verifyToken = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");

// Generate QR Code (Admin)
router.post("/generate-qr", verifyToken, allowRoles("admin", "super_admin"), controller.generateQR);

// Mark via QR (Admin scans it)
router.post("/mark-by-qr", verifyToken, allowRoles("admin", "super_admin"), controller.markByQR);

// Get Report (Admin)
router.get("/report", verifyToken, allowRoles("admin", "super_admin"), controller.getReport);

// Get Grid (Admin)
router.get("/grid", verifyToken, allowRoles("admin", "super_admin"), controller.getGrid);

// Get Dashboard Stats (Admin)
router.get("/dashboard", verifyToken, allowRoles("admin", "super_admin"), controller.getDashboardStats);

// Get Faculty Attendance by Date (Admin)
router.get("/date/:date", verifyToken, allowRoles("admin", "super_admin"), controller.getFacultyAttendanceByDate);

// Manual Mark (Admin)
router.post("/manual", verifyToken, allowRoles("admin", "super_admin"), controller.markManual);

// Bulk Update Grid (Admin)
router.post("/grid-update", verifyToken, allowRoles("admin", "super_admin"), controller.updateGridBulk);

module.exports = router;
