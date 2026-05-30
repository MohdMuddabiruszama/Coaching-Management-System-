/**
 * Fees Routes
 * ✅ Phase 7: Joi validation on all inputs
 */

const express = require("express");
const router = express.Router();
const feesController = require("../controllers/fees.controller");
const verifyToken = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");

const checkFeatureAccess = require("../middlewares/checkFeatureAccess");
const checkManagerPermission = require("../middlewares/checkManagerPermission");
const validate = require("../middlewares/validate.middleware"); // ✅ Phase 7
const feesValidator = require("../validators/fees.validator"); // ✅ Phase 7

router.post("/structure", verifyToken, allowRoles("admin", "manager"), checkManagerPermission("fees.create"), checkFeatureAccess("feature_fees"), validate(feesValidator.createStructure), feesController.createFeeStructure);
router.put("/structure/:id", verifyToken, allowRoles("admin", "manager"), checkManagerPermission("fees.update"), checkFeatureAccess("feature_fees"), validate(feesValidator.updateStructure), feesController.updateFeeStructure);
router.delete("/structure/:id", verifyToken, allowRoles("admin", "manager"), checkManagerPermission("fees.delete"), checkFeatureAccess("feature_fees"), validate(feesValidator.deleteStructure), feesController.deleteFeeStructure);
router.get("/structure", verifyToken, allowRoles("admin", "faculty", "student", "manager"), checkManagerPermission("fees.read"), checkFeatureAccess("feature_fees"), validate(feesValidator.getStructures), feesController.getAllFeeStructures);
router.post("/pay", verifyToken, allowRoles("admin", "student", "manager"), checkManagerPermission("fees.create", ["collect_fees"]), checkFeatureAccess("feature_fees"), validate(feesValidator.recordPayment), feesController.recordPayment);
router.get("/payments", verifyToken, allowRoles("admin", "manager"), checkManagerPermission("fees.read", ["collect_fees", "recent_payments", "payment_history"]), checkFeatureAccess("feature_fees"), validate(feesValidator.getPayments), feesController.getAllPayments);
router.get("/payment/:student_id", verifyToken, allowRoles("admin", "faculty", "student", "manager"), checkManagerPermission("fees.read", ["collect_fees"]), checkFeatureAccess("feature_fees"), validate(feesValidator.getStudentPayments), feesController.getStudentPayments);

router.get("/my-fees", verifyToken, allowRoles("student"), checkFeatureAccess("feature_fees"), feesController.getMyFees);
router.get("/student-fees", verifyToken, allowRoles("admin", "manager"), checkManagerPermission("fees.read", ["collect_fees"]), checkFeatureAccess("feature_fees"), feesController.getAssignedStudentFees);
router.post("/discount", verifyToken, allowRoles("admin", "manager"), checkManagerPermission("fees.update"), checkFeatureAccess("feature_fees"), validate(feesValidator.applyDiscount), feesController.applyDiscount);
router.get("/discount-logs", verifyToken, allowRoles("admin", "manager"), checkManagerPermission("fees.read"), checkFeatureAccess("feature_fees"), feesController.getDiscountLogs);
router.patch("/student-fee/:id/reminder", verifyToken, allowRoles("admin", "manager"), checkManagerPermission("fees.update"), checkFeatureAccess("feature_fees"), validate(feesValidator.updateReminder), feesController.updateReminderDate);

module.exports = router;
