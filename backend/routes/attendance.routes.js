/**
 * Attendance Routes
 * Defines API endpoints for attendance management
 */

const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendance.controller");
const verifyToken = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");
const checkSubscription = require("../middlewares/subscription.middleware");
const checkManagerPermission = require("../middlewares/checkManagerPermission");

// Dashboard & Summary
router.get("/dashboard", verifyToken, checkSubscription, allowRoles("admin", "faculty", "manager"), checkManagerPermission("attendance.read"), attendanceController.getAttendanceDashboard);
router.get("/class/:class_id/summary", verifyToken, checkSubscription, allowRoles("admin", "faculty", "manager"), checkManagerPermission("attendance.read"), attendanceController.getClassAttendanceSummary);

// Student Report
router.get("/student/:student_id/report", verifyToken, checkSubscription, allowRoles("admin", "faculty", "student", "parent", "manager"), attendanceController.getStudentAttendanceReport);

// Daily & Grid Attendance
router.get("/class/:class_id/subject/:subject_id/grid", verifyToken, checkSubscription, allowRoles("admin", "faculty", "manager"), checkManagerPermission("attendance.read"), attendanceController.getClassAttendanceGrid);
router.get("/class/:class_id/subject/:subject_id/date/:date", verifyToken, checkSubscription, allowRoles("admin", "faculty", "manager"), checkManagerPermission("attendance.read"), attendanceController.getClassAttendanceByDate);
// Fallback for when subject_id is not provided in URL
router.get("/class/:class_id/date/:date", verifyToken, checkSubscription, allowRoles("admin", "faculty", "manager"), checkManagerPermission("attendance.read"), attendanceController.getClassAttendanceByDate);

// Mutations
router.post("/bulk", verifyToken, checkSubscription, allowRoles("admin", "faculty", "manager"), checkManagerPermission("attendance.create"), attendanceController.markBulkAttendance);
router.put("/:id", verifyToken, checkSubscription, allowRoles("admin", "manager"), checkManagerPermission("attendance.update"), attendanceController.updateAttendance);
router.delete("/:id", verifyToken, checkSubscription, allowRoles("admin", "manager"), checkManagerPermission("attendance.delete"), attendanceController.deleteAttendance);

// Smart QR Session Routes
router.post("/smart/start", verifyToken, checkSubscription, allowRoles("admin", "faculty"), attendanceController.startSmartSession);
router.get("/smart/session/:class_id", verifyToken, checkSubscription, allowRoles("admin", "faculty"), attendanceController.getActiveSession);
router.post("/smart/end/:id", verifyToken, checkSubscription, allowRoles("admin", "faculty"), attendanceController.endSmartSession);
router.post("/smart/mark", verifyToken, checkSubscription, allowRoles("student"), attendanceController.markAttendanceByQR);
router.post("/smart/mark-student", verifyToken, checkSubscription, allowRoles("admin", "faculty", "manager"), attendanceController.markAttendanceByStudentQR);

module.exports = router;
