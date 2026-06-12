/**
 * Institute Routes
 * Defines API endpoints for institute management
 */

const express = require("express");
const router = express.Router();
const instituteController = require("../controllers/institute.controller");
const verifyToken = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");

/**
 * @route   POST /api/institutes
 * @desc    Create a new institute
 * @access  Super Admin only
 */
router.post("/", verifyToken, allowRoles("super_admin"), instituteController.createInstitute);

/**
 * @route   GET /api/institutes
 * @desc    Get all institutes with pagination and search
 * @access  Super Admin only
 */
router.get("/", verifyToken, allowRoles("super_admin"), instituteController.getAllInstitutes);

/**
 * @route   GET /api/institutes/:id
 * @desc    Get institute by ID
 * @access  Super Admin or Institute Admin
 */
router.get("/:id", verifyToken, allowRoles("super_admin", "admin"), instituteController.getInstituteById);

const uploadLogo = require("../middlewares/upload.middleware");

/**
 * @route   PUT /api/institutes/:id
 * @desc    Update institute details
 * @access  Super Admin or Institute Admin
 */
router.put("/:id", verifyToken, allowRoles("super_admin", "admin"), uploadLogo.single("logo"), instituteController.updateInstitute);

/**
 * @route   PATCH /api/institutes/:id/status
 * @desc    Update institute status (active/suspended/expired)
 * @access  Super Admin only
 */
router.patch("/:id/status", verifyToken, allowRoles("super_admin"), instituteController.updateInstituteStatus);

/**
 * @route   DELETE /api/institutes/:id
 * @desc    Delete institute
 * @access  Super Admin only
 */
// Use /api/superadmin/institutes/:id for deletion instead

module.exports = router;
