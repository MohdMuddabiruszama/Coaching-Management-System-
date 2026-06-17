const express = require("express");
const router = express.Router();
const parentController = require("../controllers/parent.controller");
const verifyToken = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");
const { bulkImportParents } = require('../controllers/bulkImport/bulkParents.controller');
const { cacheMiddleware, invalidateCache } = require("../middlewares/cache.middleware");

// Parent Portal Routes
router.get(
    "/dashboard",
    verifyToken,
    allowRoles("parent"),
    cacheMiddleware(120, { scope: "user" }),
    parentController.getDashboard
);

router.get(
    "/student/:id",
    verifyToken,
    allowRoles("parent"),
    cacheMiddleware(300, { scope: "user" }),
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
    invalidateCache("cache:/api/parents*", "cache:/api/students*"),
    parentController.createParent
);

router.get(
    "/",
    verifyToken,
    allowRoles("admin", "manager"),
    cacheMiddleware(300, {
        scope: "tenant",
        cacheWhen: (req) => !req.query.search,
    }),
    parentController.getAllParents
);

router.put(
    "/:id",
    verifyToken,
    allowRoles("admin", "manager"),
    invalidateCache("cache:/api/parents*", "cache:/api/students*"),
    parentController.updateParent
);

router.delete(
    "/:id",
    verifyToken,
    allowRoles("admin", "manager"),
    invalidateCache("cache:/api/parents*", "cache:/api/students*"),
    parentController.deleteParent
);

router.get(
    "/:id",
    verifyToken,
    allowRoles("admin", "manager"),
    cacheMiddleware(600, { scope: "tenant" }),
    parentController.getParentById
);

// Bulk actions
router.post(
    "/bulk-delete",
    verifyToken,
    allowRoles("admin", "manager"),
    invalidateCache("cache:/api/parents*", "cache:/api/students*"),
    parentController.bulkDeleteParents
);

// Bulk import route
router.post(
    "/bulk-import",
    verifyToken,
    allowRoles("admin", "manager"),
    invalidateCache("cache:/api/parents*", "cache:/api/students*"),
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
