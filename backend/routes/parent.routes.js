const express = require("express");
const router = express.Router();
const parentController = require("../controllers/parent.controller");
const verifyToken = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");
const { bulkImportParents } = require('../controllers/bulkImport/bulkParents.controller');

// Parent Portal Routes
router.get(
    "/dashboard",
    verifyToken,
    allowRoles("parent"),
    parentController.getDashboard
);

router.get(
    "/student/:id",
    verifyToken,
    allowRoles("parent"),
    parentController.getStudentProfile
);

router.get(
    "/attendance/:studentId",
    verifyToken,
    allowRoles("parent"),
    parentController.getStudentAttendance
);

router.get(
    "/results/:studentId",
    verifyToken,
    allowRoles("parent"),
    parentController.getStudentResults
);

router.get(
    "/fees/:studentId",
    verifyToken,
    allowRoles("parent"),
    parentController.getStudentFees
);

router.get(
    "/notes/:classId",
    verifyToken,
    allowRoles("parent"),
    parentController.getNotes
);

// Admin routes for parent management
router.post(
    "/",
    verifyToken,
    allowRoles("admin", "manager"),
    parentController.createParent
);

router.get(
    "/",
    verifyToken,
    allowRoles("admin", "manager"),
    parentController.getAllParents
);

router.put(
    "/:id",
    verifyToken,
    allowRoles("admin", "manager"),
    parentController.updateParent
);

router.delete(
    "/:id",
    verifyToken,
    allowRoles("admin", "manager"),
    parentController.deleteParent
);

router.get(
    "/:id",
    verifyToken,
    allowRoles("admin", "manager"),
    parentController.getParentById
);

// Bulk actions
router.post(
    "/bulk-delete",
    verifyToken,
    allowRoles("admin", "manager"),
    parentController.bulkDeleteParents
);

// Bulk import route
router.post(
    "/bulk-import",
    verifyToken,
    allowRoles("admin", "manager"),
    bulkImportParents
);


// Credentials
router.post(
    "/credentials",
    verifyToken,
    allowRoles("admin", "manager"),
    parentController.getParentCredentials
);
router.post(
    "/:id/resend-credentials",
    verifyToken,
    allowRoles("admin", "manager"),
    parentController.resendParentCredentials
);

module.exports = router;
