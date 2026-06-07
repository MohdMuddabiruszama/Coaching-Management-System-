/**
 * Faculty Routes
 * Defines API endpoints for faculty management
 */

const express = require("express");
const router = express.Router();
const facultyController = require("../controllers/faculty.controller");
const verifyToken = require("../middlewares/auth.middleware");
const checkSubscription = require("../middlewares/subscription.middleware");
const allowRoles = require("../middlewares/role.middleware");

/**
 * @route   POST /api/faculty
 * @desc    Create a new faculty member
 * @access  Admin only
 */
const { checkFacultyLimit } = require("../middlewares/planLimits.middleware");
const checkManagerPermission = require("../middlewares/checkManagerPermission");
const { bulkImportFaculty } = require('../controllers/bulkImport/bulkFaculty.controller');
const validate = require("../middlewares/validate.middleware"); // ✅ Phase 7
const facValidator = require("../validators/faculty.validator"); // ✅ Phase 7

router.get("/me", verifyToken, checkSubscription, allowRoles("faculty"), facultyController.getMe);
router.get("/dashboard-stats", verifyToken, checkSubscription, allowRoles("faculty"), facultyController.getDashboardStats);
router.post("/", verifyToken, checkSubscription, allowRoles("admin", "manager"), checkManagerPermission("faculty.create"), checkFacultyLimit, validate(facValidator.createFaculty), facultyController.createFaculty);

/**
 * @route   GET /api/faculty
 * @desc    Get all faculty members with pagination and search
 * @access  Admin, Faculty
 */
router.get("/", verifyToken, checkSubscription, allowRoles("admin", "faculty", "manager"), checkManagerPermission("faculty.read"), validate(facValidator.getFaculty), facultyController.getAllFaculty);

/**
 * @route   GET /api/faculty/:id
 * @desc    Get faculty by ID
 * @access  Admin, Faculty (own record)
 */
router.get("/:id", verifyToken, checkSubscription, allowRoles("admin", "faculty", "manager"), checkManagerPermission("faculty.read"), validate(facValidator.getFacultyById), facultyController.getFacultyById);

/**
 * @route   PUT /api/faculty/:id
 * @desc    Update faculty details
 * @access  Admin, Faculty (own record)
 */
router.put("/:id", verifyToken, checkSubscription, allowRoles("admin", "faculty", "manager"), checkManagerPermission("faculty.update"), validate(facValidator.updateFaculty), facultyController.updateFaculty);

/**
 * @route   DELETE /api/faculty/:id
 * @desc    Delete faculty
 * @access  Admin only
 */
router.delete("/:id", verifyToken, checkSubscription, allowRoles("admin", "manager"), checkManagerPermission("faculty.delete"), validate(facValidator.deleteFaculty), facultyController.deleteFaculty);

// Credentials
router.post("/credentials", verifyToken, allowRoles("admin", "manager"), facultyController.getFacultyCredentials);
router.post("/:id/resend-credentials", verifyToken, allowRoles("admin", "manager"), facultyController.resendFacultyCredentials);

// Bulk import route
router.post("/bulk-import", verifyToken, checkSubscription, allowRoles("admin", "manager"), checkManagerPermission("faculty.create"), bulkImportFaculty);

module.exports = router;
