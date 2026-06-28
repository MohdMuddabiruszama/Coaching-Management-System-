const express = require("express");
const router = express.Router();
const assignmentController = require("../controllers/assignment.controller");
const verifyToken = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");
const { uploadAssignment } = require("../utils/uploadAssignment");

// ─── Admin / Owner / Manager Routes (MUST come before /:id) ──────────────────
router.get("/admin/all", verifyToken, allowRoles("admin", "owner", "manager", "super_admin"), assignmentController.getAdminAssignments);
router.get("/admin/stats", verifyToken, allowRoles("admin", "owner", "manager", "super_admin"), assignmentController.getAdminStats);
router.get("/admin/pending-grading", verifyToken, allowRoles("admin", "owner", "manager"), assignmentController.getPendingGrading);
router.get("/admin/overdue-students", verifyToken, allowRoles("admin", "owner", "manager"), assignmentController.getOverdueStudents);
router.get("/admin/export", verifyToken, allowRoles("owner", "admin", "manager"), assignmentController.exportAssignments);
router.get("/admin/student/:studentId", verifyToken, allowRoles("admin", "owner", "manager"), assignmentController.getStudentAssignmentHistory);
router.get("/admin/settings", verifyToken, allowRoles("owner", "admin", "manager"), assignmentController.getSettings);
router.put("/admin/settings", verifyToken, allowRoles("owner", "admin"), assignmentController.updateSettings);

// ─── Student Routes (MUST come before /:id) ───────────────────────────────────
router.get("/student/all", verifyToken, allowRoles("student"), assignmentController.getStudentAssignments);
router.get("/student/:id", verifyToken, allowRoles("student"), assignmentController.getStudentAssignmentDetails);
router.post("/student/:id/submit", verifyToken, allowRoles("student"), uploadAssignment.single("submission_file"), assignmentController.submitAssignment);
router.patch("/student/:id/resubmit", verifyToken, allowRoles("student"), uploadAssignment.single("submission_file"), assignmentController.resubmitAssignment);

// ─── Parent Routes (MUST come before /:id) ────────────────────────────────────
router.get("/parent/child/:studentId", verifyToken, allowRoles("parent"), assignmentController.getParentAssignments);

// ─── Faculty Routes ───────────────────────────────────────────────────────────
router.post("/", verifyToken, allowRoles("faculty", "admin", "owner", "manager"), uploadAssignment.single("reference_file"), assignmentController.createAssignment);
router.get("/", verifyToken, allowRoles("faculty"), assignmentController.getFacultyAssignments);
router.get("/:id/submissions", verifyToken, allowRoles("faculty", "admin", "owner", "manager"), assignmentController.getSubmissions);
router.get("/:id/summary", verifyToken, allowRoles("faculty", "admin", "owner", "manager"), assignmentController.getAssignmentSummary);
router.put("/:id", verifyToken, allowRoles("faculty", "admin", "owner", "manager"), assignmentController.updateAssignment);
router.patch("/:id/publish", verifyToken, allowRoles("faculty", "admin", "owner", "manager"), assignmentController.publishAssignment);
router.patch("/:id/close", verifyToken, allowRoles("faculty", "admin", "owner", "manager"), assignmentController.closeAssignment);
router.delete("/:id", verifyToken, allowRoles("faculty", "admin", "owner", "manager"), assignmentController.deleteAssignment);
router.get("/:id", verifyToken, allowRoles("faculty", "admin", "owner", "manager"), assignmentController.getAssignmentDetails);

// ─── Grading Routes ───────────────────────────────────────────────────────────
router.patch("/:asgId/submissions/:subId/grade", verifyToken, allowRoles("faculty", "admin", "owner", "manager"), assignmentController.gradeSubmission);
router.patch("/:asgId/submissions/:subId/request-resubmit", verifyToken, allowRoles("faculty", "admin", "owner", "manager"), assignmentController.requestResubmit);

module.exports = router;
