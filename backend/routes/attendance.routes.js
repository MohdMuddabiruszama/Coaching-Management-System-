/**
 * Attendance Routes
 * Implements role-based and plan-based access control
 * ✅ Phase 7: Joi validation on all inputs
 */

const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendance.controller");
const verifyToken = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");
const checkFeatureAccess = require("../middlewares/checkFeatureAccess");
const validate = require("../middlewares/validate.middleware"); // ✅ Phase 7
const attValidator = require("../validators/attendance.validator"); // ✅ Phase 7

// All routes require authentication and attendance feature
router.use(verifyToken, checkFeatureAccess("feature_attendance"));

// Bulk mark attendance for a class
router.post("/bulk", allowRoles("admin", "faculty"), validate(attValidator.markBulk), attendanceController.markBulkAttendance);

// Get attendance for specific class, subject, and date
router.get("/class/:class_id/subject/:subject_id/date/:date", allowRoles("admin", "faculty"), validate(attValidator.getByDate), attendanceController.getClassAttendanceByDate);

// Get attendance grid data for class and subject matching date ranges
router.get("/class/:class_id/subject/:subject_id/grid", allowRoles("admin", "faculty"), validate(attValidator.getGrid), attendanceController.getClassAttendanceGrid);

// Update attendance (admin only)
router.put("/:id", allowRoles("admin"), validate(attValidator.updateAttendance), attendanceController.updateAttendance);

// Delete attendance (admin only)
router.delete("/:id", allowRoles("admin"), validate(attValidator.deleteAttendance), attendanceController.deleteAttendance);

// Student attendance report
router.get("/student/:student_id/report", allowRoles("admin", "faculty", "student"), validate(attValidator.getStudentReport), attendanceController.getStudentAttendanceReport);

// Class attendance summary
router.get("/class/:class_id/summary", allowRoles("admin", "faculty"), validate(attValidator.getClassSummary), attendanceController.getClassAttendanceSummary);

// --- SMART ATTENDANCE ROUTES ---
router.post("/start-session", checkFeatureAccess("feature_auto_attendance"), allowRoles("admin", "faculty"), validate(attValidator.startSession), attendanceController.startSmartSession);
router.post("/end-session/:id", checkFeatureAccess("feature_auto_attendance"), allowRoles("admin", "faculty"), attendanceController.endSmartSession);
router.get("/active-session/:class_id", checkFeatureAccess("feature_auto_attendance"), allowRoles("admin", "faculty"), attendanceController.getActiveSession);
router.post("/mark-by-qr", checkFeatureAccess("feature_auto_attendance"), allowRoles("student"), validate(attValidator.markByQR), attendanceController.markAttendanceByQR);
router.post("/mark-student-qr", checkFeatureAccess("feature_auto_attendance"), allowRoles("admin", "faculty"), validate(attValidator.markByStudentQR), attendanceController.markAttendanceByStudentQR);

// Attendance dashboard stats
router.get("/dashboard", allowRoles("admin", "faculty"), validate(attValidator.getDashboard), attendanceController.getAttendanceDashboard);

module.exports = router;
