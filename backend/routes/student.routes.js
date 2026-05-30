const express = require("express");
const router = express.Router();
const studentController = require("../controllers/student.controller");
const verifyToken = require("../middlewares/auth.middleware");
const checkSubscription = require("../middlewares/subscription.middleware");
const allowRoles = require("../middlewares/role.middleware");
const { checkStudentLimit } = require("../middlewares/planLimits.middleware");
const checkManagerPermission = require("../middlewares/checkManagerPermission");
const { cacheMiddleware, invalidateCache } = require("../middlewares/cache.middleware"); // ✅ Phase 3.4
const { bulkImportStudents } = require('../controllers/bulkImport/bulkStudents.controller');
const validate = require("../middlewares/validate.middleware"); // ✅ Phase 7
const studentValidator = require("../validators/student.validator"); // ✅ Phase 7

// All routes require authentication and valid subscription
router.use(verifyToken, checkSubscription);

// Stats Route (must be before :id)
router.get("/stats", allowRoles("super_admin", "admin", "faculty"), studentController.getStudentStats);
router.get("/dashboard-stats", allowRoles("student"), studentController.getDashboardStats);

router.post("/clear-unread-assignments", allowRoles("student"), studentController.clearUnreadAssignments);
router.post("/clear-unread-notes", allowRoles("student"), studentController.clearUnreadNotes);
router.post("/clear-unread-chats", allowRoles("student"), studentController.clearUnreadChats);

// CRUD Routes
router.get("/me", allowRoles("student"), studentController.getMe);
router.get("/lookup", allowRoles("super_admin", "admin", "faculty", "manager"), checkManagerPermission("students.read", ["fees", "attendance", "reports"]), validate(studentValidator.getStudentLookup), cacheMiddleware(300), studentController.getStudentLookup);

// ✅ Phase 3.4: Cache student list for 5 minutes (300s)
router.post(
    "/",
    allowRoles("super_admin", "admin", "faculty", "manager"),
    checkManagerPermission("students.create"),
    checkStudentLimit,
    validate(studentValidator.createStudent),
    invalidateCache("cache:/api/students*"),
    studentController.createStudent
);

// ✅ Phase 3.4: Cache student list GET (5 min), single student GET (10 min)
router.get("/", allowRoles("super_admin", "admin", "faculty", "manager"), checkManagerPermission("students.read", ["fees", "attendance", "reports"]), validate(studentValidator.getStudents), cacheMiddleware(300), studentController.getAllStudents);
router.get("/:id", allowRoles("super_admin", "admin", "faculty", "student", "manager"), checkManagerPermission("students.read", ["fees", "attendance", "reports"]), validate(studentValidator.getStudentById), cacheMiddleware(600), studentController.getStudentById);

router.put("/:id", allowRoles("super_admin", "admin", "faculty", "student", "manager"), checkManagerPermission("students.update"), validate(studentValidator.updateStudent), invalidateCache("cache:/api/students*"), studentController.updateStudent);
router.delete("/:id", allowRoles("super_admin", "admin", "manager"), checkManagerPermission("students.delete"), validate(studentValidator.deleteStudent), invalidateCache("cache:/api/students*"), studentController.deleteStudent);

// Bulk import route
router.post("/bulk-import", allowRoles("admin", "manager"), checkManagerPermission("students.create"), bulkImportStudents);

// Password Management Routes
router.post("/credentials", allowRoles("super_admin", "admin", "manager"), checkManagerPermission("students.read"), studentController.getStudentCredentials);
router.post("/:id/resend-credentials", allowRoles("super_admin", "admin", "manager"), checkManagerPermission("students.update"), studentController.resendStudentCredentials);

module.exports = router;
