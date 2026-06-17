const express = require("express");
const router = express.Router();
const facultyController = require("../controllers/faculty.controller");
const verifyToken = require("../middlewares/auth.middleware");
const checkSubscription = require("../middlewares/subscription.middleware");
const allowRoles = require("../middlewares/role.middleware");
const { checkFacultyLimit } = require("../middlewares/planLimits.middleware");
const checkManagerPermission = require("../middlewares/checkManagerPermission");
const { bulkImportFaculty } = require("../controllers/bulkImport/bulkFaculty.controller");
const validate = require("../middlewares/validate.middleware");
const facValidator = require("../validators/faculty.validator");
const { cacheMiddleware, invalidateCache } = require("../middlewares/cache.middleware");

router.get("/me", verifyToken, checkSubscription, allowRoles("faculty"), facultyController.getMe);
router.get("/dashboard-stats", verifyToken, checkSubscription, allowRoles("faculty"), cacheMiddleware(60, { scope: "user" }), facultyController.getDashboardStats);

router.post(
    "/",
    verifyToken,
    checkSubscription,
    allowRoles("admin", "manager"),
    checkManagerPermission("faculty.create"),
    checkFacultyLimit,
    validate(facValidator.createFaculty),
    invalidateCache("cache:/api/faculty*", "cache:/api/admin/stats*"),
    facultyController.createFaculty
);

router.get(
    "/",
    verifyToken,
    checkSubscription,
    allowRoles("admin", "faculty", "manager"),
    checkManagerPermission("faculty.read"),
    validate(facValidator.getFaculty),
    cacheMiddleware(300, {
        varyByUserRoles: ["faculty"],
        cacheWhen: (req) => !req.query.search,
    }),
    facultyController.getAllFaculty
);

router.get(
    "/:id",
    verifyToken,
    checkSubscription,
    allowRoles("admin", "faculty", "manager"),
    checkManagerPermission("faculty.read"),
    validate(facValidator.getFacultyById),
    cacheMiddleware(600),
    facultyController.getFacultyById
);

router.put(
    "/:id",
    verifyToken,
    checkSubscription,
    allowRoles("admin", "faculty", "manager"),
    checkManagerPermission("faculty.update"),
    validate(facValidator.updateFaculty),
    invalidateCache("cache:/api/faculty*", "cache:/api/admin/stats*"),
    facultyController.updateFaculty
);

router.delete(
    "/:id",
    verifyToken,
    checkSubscription,
    allowRoles("admin", "manager"),
    checkManagerPermission("faculty.delete"),
    validate(facValidator.deleteFaculty),
    invalidateCache("cache:/api/faculty*", "cache:/api/admin/stats*"),
    facultyController.deleteFaculty
);

router.post("/credentials", verifyToken, allowRoles("admin", "manager"), facultyController.getFacultyCredentials);
router.post("/:id/resend-credentials", verifyToken, allowRoles("admin", "manager"), facultyController.resendFacultyCredentials);

router.post(
    "/bulk-delete",
    verifyToken,
    checkSubscription,
    allowRoles("admin", "manager"),
    checkManagerPermission("faculty.delete"),
    invalidateCache("cache:/api/faculty*", "cache:/api/admin/stats*"),
    facultyController.bulkDeleteFaculty
);

router.post(
    "/bulk-import",
    verifyToken,
    checkSubscription,
    allowRoles("admin", "manager"),
    checkManagerPermission("faculty.create"),
    invalidateCache("cache:/api/faculty*", "cache:/api/admin/stats*"),
    bulkImportFaculty
);

module.exports = router;
