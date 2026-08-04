const express = require("express");
const router = express.Router();

const verifyToken = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");

const controller = require("../controllers/superadmin.controller");
const authController = require("../controllers/auth.controller");

// ── OTP Mode Toggle (Superadmin only) ───────────────────────────────────────
router.put("/otp-mode", verifyToken, allowRoles("super_admin"), authController.setOtpMode);

router.get(
    "/dashboard",
    verifyToken,
    allowRoles("super_admin"),
    controller.getDashboardStats
);

router.get(
    "/analytics",
    verifyToken,
    allowRoles("super_admin"),
    controller.getAnalytics
);

router.post(
    "/institutes/:instituteId/upgrade",
    verifyToken,
    allowRoles("super_admin"),
    controller.upgradePlan
);

router.get(
    "/institutes",
    verifyToken,
    allowRoles("super_admin"),
    controller.getAllInstitutes
);

// Phase 3: Get single institute full details
router.get(
    "/institutes/:id/details",
    verifyToken,
    allowRoles("super_admin"),
    controller.getInstituteDetails
);

// Phase 3: Update institute limits & features (per-institute override)
router.put(
    "/institutes/:id/limits",
    verifyToken,
    allowRoles("super_admin"),
    controller.updateInstituteLimits
);

router.put(
    "/institutes/:id/status",
    verifyToken,
    allowRoles("super_admin"),
    controller.updateInstituteStatus
);

router.delete(
    "/institutes/:id",
    verifyToken,
    allowRoles("super_admin"),
    controller.deleteInstitute
);

router.put(
    "/institutes/:id/suspend",
    verifyToken,
    allowRoles("super_admin"),
    controller.suspendInstitute
);

router.put(
    "/institutes/:id/restore",
    verifyToken,
    allowRoles("super_admin"),
    controller.restoreInstitute
);

// Phase 4: Institute Discounts
router.post(
    "/institutes/:id/discounts",
    verifyToken,
    allowRoles("super_admin"),
    controller.applyInstituteDiscount
);

router.delete(
    "/institutes/:id/discounts/:discountId",
    verifyToken,
    allowRoles("super_admin"),
    controller.deleteInstituteDiscount
);

// ─── Phase 3: DB Safety Architecture — Archive & Restore Routes ─────────────

router.patch(
    "/students/:id/archive",
    verifyToken,
    allowRoles("super_admin"),
    controller.archiveStudent
);

router.get(
    "/students/archived",
    verifyToken,
    allowRoles("super_admin"),
    controller.getArchivedStudents
);

router.post(
    "/recovery/:table/:id/restore",
    verifyToken,
    allowRoles("super_admin"),
    controller.restoreDeletedData
);

module.exports = router;
