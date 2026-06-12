/**
 * Faculty Salary Routes — Complete (Phase 6)
 * Faculty Salary.md
 *
 * Endpoints:
 *   Admin/Manager (feature_salary required):
 *     GET    /api/salary              → list salary records (paginated)
 *     GET    /api/salary/report       → aggregated salary report
 *     POST   /api/salary              → create salary record
 *     PUT    /api/salary/:id          → update salary record
 *     PUT    /api/salary/:id/pay      → mark as paid (with specific date)
 *     DELETE /api/salary/:id          → delete salary record
 *
 *   Settings (base salary per faculty for auto-generate):
 *     GET    /api/salary/settings          → list all faculty settings
 *     POST   /api/salary/settings          → create or update settings
 *     DELETE /api/salary/settings/:faculty_id → remove settings
 *
 *   Admin manual trigger:
 *     POST   /api/salary/admin/generate-month → trigger auto-generate manually
 *
 *   Faculty (own slips only):
 *     GET    /api/salary/my-slips           → view own paid salary slips
 *
 *   PDF Download (admin or own faculty):
 *     GET    /api/salary/:id/slip           → download salary slip PDF
 */

const express = require("express");
const router  = express.Router();

const verifyToken            = require("../middlewares/auth.middleware");
const allowRoles             = require("../middlewares/role.middleware");
const checkFeatureAccess     = require("../middlewares/checkFeatureAccess");
const checkManagerPermission = require("../middlewares/checkManagerPermission");
const validate               = require("../middlewares/validate.middleware");
const salaryValidator        = require("../validators/salary.validator");
const salaryCtrl             = require("../controllers/facultySalary.controller");
const settingsCtrl           = require("../controllers/facultySalarySettings.controller");
const { generateSalarySlipPDF } = require("../services/salarySlip.service");
const { generateMonthlySalaries } = require("../services/salaryAutoGenerate.service");

// ── Shared middleware chains ────────────────────────────────────────────────
const baseAuth = [verifyToken, allowRoles("admin", "manager"), checkFeatureAccess("feature_salary")];
const canRead   = [...baseAuth, checkManagerPermission("salary.read")];
const canWrite  = [...baseAuth, checkManagerPermission("salary.create")];
const canUpdate = [...baseAuth, checkManagerPermission("salary.update")];
const canDelete = [...baseAuth, checkManagerPermission("salary.delete")];

// ── Salary Records ─────────────────────────────────────────────────────────
router.get("/",          ...canRead,   validate(salaryValidator.getSalaries),    salaryCtrl.getAllSalaries);
router.get("/report",    ...canRead,   validate(salaryValidator.getSalaryReport), salaryCtrl.getSalaryReport);
router.post("/",         ...canWrite,  validate(salaryValidator.createSalary),   salaryCtrl.createSalary);
router.put("/:id",       ...canUpdate, validate(salaryValidator.updateSalary),   salaryCtrl.updateSalary);
router.put("/:id/pay",   ...canUpdate, validate(salaryValidator.paySalary),      salaryCtrl.paySalary);
router.delete("/:id",    ...canDelete, validate(salaryValidator.deleteSalary),   salaryCtrl.deleteSalary);

// ── Salary Settings (base salary per faculty) ───────────────────────────────
router.get("/settings",                  ...canRead,   settingsCtrl.getSettings);
router.post("/settings",                 ...canWrite,  validate(salaryValidator.settingsSchema), settingsCtrl.upsertSettings);
router.delete("/settings/:faculty_id",   ...canDelete, settingsCtrl.deleteSettings);

// ── Admin: manual trigger for auto-generate (testing / catch-up) ────────────
router.post("/admin/generate-month", ...canWrite, async (req, res) => {
    try {
        const { month_year } = req.body;
        if (month_year && !/^\d{4}-\d{2}$/.test(month_year)) {
            return res.status(400).json({ success: false, message: "month_year must be YYYY-MM format" });
        }
        const result = await generateMonthlySalaries(month_year || null);
        res.json({ success: true, message: "Salary records generated", data: result });
    } catch (err) {
        console.error("generate-month error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── Faculty: view own paid salary slips ─────────────────────────────────────
router.get("/my-slips", verifyToken, allowRoles("faculty", "admin", "manager"), async (req, res) => {
    try {
        const { FacultySalary, Faculty, User } = require("../models");
        const userId = req.user.id;
        const iid    = req.user.institute_id;

        // For faculty: find their faculty profile to get faculty_id
        let facultyId = null;
        if (req.user.role === "faculty") {
            const fac = await Faculty.findOne({ where: { user_id: userId, institute_id: iid }, attributes: ["id"] });
            if (!fac) return res.status(404).json({ success: false, message: "Faculty profile not found" });
            facultyId = fac.id;
        } else {
            // Admin viewing their own — usually not needed, but safe fallback
            return res.status(403).json({ success: false, message: "This endpoint is for faculty only" });
        }

        const slips = await FacultySalary.findAll({
            where: {
                faculty_id:   facultyId,
                institute_id: iid,
                status:       "paid",  // faculty only sees paid slips
            },
            attributes: [
                "id", "month_year", "basic_salary", "allowances", "deductions",
                "advance_paid", "net_salary", "working_days", "present_days",
                "payment_date", "payment_method", "transaction_ref", "status",
                "payment_due_date", "auto_generated",
            ],
            order: [["month_year", "DESC"]],
        });

        res.json({ success: true, data: slips });
    } catch (err) {
        console.error("my-slips error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── Download Salary Slip PDF ─────────────────────────────────────────────────
// Accessible by: admin (any), manager (own institute), faculty (their own slip)
router.get("/:id/slip", verifyToken, async (req, res) => {
    try {
        const { FacultySalary, Faculty, User, Institute } = require("../models");
        const { id }  = req.params;
        const iid     = req.user.institute_id;
        const role    = req.user.role;

        // Build where clause based on role
        let salaryWhere = { id, institute_id: iid };
        if (role === "faculty") {
            // Faculty can only download their own slip
            const fac = await Faculty.findOne({ where: { user_id: req.user.id, institute_id: iid }, attributes: ["id"] });
            if (!fac) return res.status(404).json({ success: false, message: "Faculty profile not found" });
            salaryWhere.faculty_id = fac.id;
        } else if (role !== "admin" && role !== "manager" && role !== "super_admin") {
            return res.status(403).json({ success: false, message: "Access denied" });
        }

        const salary = await FacultySalary.findOne({ where: salaryWhere });
        if (!salary) {
            return res.status(404).json({ success: false, message: "Salary slip not found" });
        }
        if (salary.status !== "paid") {
            return res.status(400).json({ success: false, message: "Salary slip is only available for paid salaries" });
        }

        // Fetch faculty user + institute info in parallel — O(1)
        const [facultyRecord, institute] = await Promise.all([
            Faculty.findOne({
                where: { id: salary.faculty_id },
                include: [{ model: User, attributes: ["name", "email"] }],
                attributes: ["id"],
            }),
            Institute.findByPk(iid, { attributes: ["name", "address", "phone"] }),
        ]);

        if (!facultyRecord) {
            return res.status(404).json({ success: false, message: "Faculty not found" });
        }

        const facultyInfo  = { name: facultyRecord.User?.name, email: facultyRecord.User?.email };
        const instituteInfo = { name: institute?.name, address: institute?.address, phone: institute?.phone };

        await generateSalarySlipPDF(salary, facultyInfo, instituteInfo, res);
    } catch (err) {
        console.error("salary slip PDF error:", err);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: err.message });
        }
    }
});

module.exports = router;
