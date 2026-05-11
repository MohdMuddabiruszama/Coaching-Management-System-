/**
 * Faculty Salary Routes
 * Handles monthly salary CRUD, payment marking, and salary reports
 */

const express = require("express");
const router = express.Router();
const salaryCtrl = require("../controllers/facultySalary.controller");
const verifyToken = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");
const checkFeatureAccess = require("../middlewares/checkFeatureAccess");
const checkManagerPermission = require("../middlewares/checkManagerPermission");
const validate = require("../middlewares/validate.middleware"); // ✅ Phase 7
const salaryValidator = require("../validators/salary.validator"); // ✅ Phase 7

// Create a salary record
router.post("/", verifyToken, allowRoles("admin", "manager"), checkManagerPermission("salary.create"), checkFeatureAccess("feature_salary"), validate(salaryValidator.createSalary), salaryCtrl.createSalary);

// Get all salary records (filterable by month_year, faculty_id, status)
router.get("/", verifyToken, allowRoles("admin", "manager"), checkManagerPermission("salary.read"), checkFeatureAccess("feature_salary"), validate(salaryValidator.getSalaries), salaryCtrl.getAllSalaries);

// Monthly salary report / summary
router.get("/report", verifyToken, allowRoles("admin", "manager"), checkManagerPermission("salary.read"), checkFeatureAccess("feature_salary"), validate(salaryValidator.getSalaryReport), salaryCtrl.getSalaryMonthReport);

// Mark salary as paid
router.put("/:id/pay", verifyToken, allowRoles("admin", "manager"), checkManagerPermission("salary.update"), checkFeatureAccess("feature_salary"), validate(salaryValidator.paySalary), salaryCtrl.paySalary);

// Update salary record (correct values before payment)
router.put("/:id", verifyToken, allowRoles("admin", "manager"), checkManagerPermission("salary.update"), checkFeatureAccess("feature_salary"), validate(salaryValidator.updateSalary), salaryCtrl.updateSalary);

// Delete salary record (only pending/on_hold)
router.delete("/:id", verifyToken, allowRoles("admin", "manager"), checkManagerPermission("salary.delete"), checkFeatureAccess("feature_salary"), validate(salaryValidator.deleteSalary), salaryCtrl.deleteSalary);

module.exports = router;
