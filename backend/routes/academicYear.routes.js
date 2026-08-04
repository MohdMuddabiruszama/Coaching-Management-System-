/**
 * Academic Year Routes
 * Phase 5 (+ Phase 6 permissions) — Academic Year Promotion Engine
 *
 * Permission model:
 *  - Super Admin  : all routes (cross-institute support)
 *  - Admin        : full access (list, create, preview, execute, rollback, rules)
 *  - Manager (academic type) : preview + execute only via checkManagerPermission
 *  - Faculty / Student / Parent : blocked at allowRoles level
 *
 * Tenant safety: req.user.institute_id is always used — admins can never
 * touch another institute's students.
 */

const express = require("express");
const router = express.Router();

const verifyToken = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");
const checkManagerPermission = require("../middlewares/checkManagerPermission");
const validate = require("../middlewares/validate.middleware");
const schema = require("../validators/academicYear.validator");
const ctrl = require("../controllers/academicYear.controller");

// ─── Shared middleware for all academic year routes ───────────────────────────
// All routes require authentication
router.use(verifyToken);

// ─── Academic Year CRUD ───────────────────────────────────────────────────────

// GET /api/academic-years — list all academic years for the institute
router.get(
    "/",
    allowRoles("admin", "manager", "super_admin"),
    ctrl.listAcademicYears
);

// POST /api/academic-years — create a new academic year
router.post(
    "/",
    allowRoles("admin", "super_admin"),
    validate(schema.createAcademicYear),
    ctrl.createAcademicYear
);

// PATCH /api/academic-years/:id — update academic year (label, dates, make current)
router.patch(
    "/:id",
    allowRoles("admin", "super_admin"),
    validate(schema.updateAcademicYear),
    ctrl.updateAcademicYear
);

// ─── Promotion Rules CRUD ─────────────────────────────────────────────────────

// GET /api/academic-years/rules — list promotion rules
router.get(
    "/rules",
    allowRoles("admin", "manager", "super_admin"),
    checkManagerPermission("academic_year_promotion"),
    ctrl.listPromotionRules
);

// POST /api/academic-years/rules — create one promotion rule
router.post(
    "/rules",
    allowRoles("admin", "super_admin"),
    validate(schema.createPromotionRule),
    ctrl.createPromotionRule
);

// PUT /api/academic-years/rules/:id — update a promotion rule
router.put(
    "/rules/:id",
    allowRoles("admin", "super_admin"),
    validate(schema.updatePromotionRule),
    ctrl.updatePromotionRule
);

// DELETE /api/academic-years/rules/:id — delete a promotion rule
router.delete(
    "/rules/:id",
    allowRoles("admin", "super_admin"),
    validate(schema.deletePromotionRule),
    ctrl.deletePromotionRule
);

// GET /api/academic-years/rules/suggest — auto-suggest promotion sequence
router.get(
    "/rules/suggest",
    allowRoles("admin", "super_admin"),
    ctrl.suggestPromotionRules
);

// POST /api/academic-years/rules/bulk — bulk-save a full rule sequence
router.post(
    "/rules/bulk",
    allowRoles("admin", "super_admin"),
    ctrl.bulkSavePromotionRules
);

// ─── Promotion Actions ────────────────────────────────────────────────────────

// GET /api/academic-years/promotion/preview — preview promotion for the institute
router.get(
    "/promotion/preview",
    allowRoles("admin", "manager", "super_admin"),
    checkManagerPermission("academic_year_promotion"),
    ctrl.promotionPreview
);

// POST /api/academic-years/promotion/execute — execute the promotion (Phase 4 + 7)
router.post(
    "/promotion/execute",
    allowRoles("admin", "super_admin"),
    checkManagerPermission("academic_year_promotion"),
    validate(schema.executePromotion),
    ctrl.executePromotion
);

// POST /api/academic-years/promotion/rollback — rollback a promotion (Phase 10)
router.post(
    "/promotion/rollback",
    allowRoles("admin", "super_admin"),
    validate(schema.rollbackPromotion),
    ctrl.rollbackPromotion
);

// ─── Student Transcript ───────────────────────────────────────────────────────

// GET /api/academic-years/history/:studentId — full enrollment history for one student
router.get(
    "/history/:studentId",
    allowRoles("admin", "manager", "super_admin"),
    validate(schema.getHistory),
    ctrl.getPromotionHistory
);

module.exports = router;
