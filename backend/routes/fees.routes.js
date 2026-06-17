const express = require("express");
const router = express.Router();
const feesController = require("../controllers/fees.controller");
const verifyToken = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");
const checkFeatureAccess = require("../middlewares/checkFeatureAccess");
const checkManagerPermission = require("../middlewares/checkManagerPermission");
const validate = require("../middlewares/validate.middleware");
const feesValidator = require("../validators/fees.validator");
const { cacheMiddleware, invalidateCache } = require("../middlewares/cache.middleware");

const feeInvalidation = invalidateCache(
    "cache:/api/fees*",
    "cache:/api/admin/stats*",
    "cache:/api/students/dashboard-stats*",
    "cache:/api/parents*"
);

router.post("/structure", verifyToken, allowRoles("admin", "manager"), checkManagerPermission("fees.create"), checkFeatureAccess("feature_fees"), validate(feesValidator.createStructure), feeInvalidation, feesController.createFeeStructure);
router.put("/structure/:id", verifyToken, allowRoles("admin", "manager"), checkManagerPermission("fees.update"), checkFeatureAccess("feature_fees"), validate(feesValidator.updateStructure), feeInvalidation, feesController.updateFeeStructure);
router.delete("/structure/:id", verifyToken, allowRoles("admin", "manager"), checkManagerPermission("fees.delete"), checkFeatureAccess("feature_fees"), validate(feesValidator.deleteStructure), feeInvalidation, feesController.deleteFeeStructure);
router.get("/structure", verifyToken, allowRoles("admin", "faculty", "student", "manager"), checkManagerPermission("fees.read"), checkFeatureAccess("feature_fees"), validate(feesValidator.getStructures), cacheMiddleware(600), feesController.getAllFeeStructures);

router.post("/pay", verifyToken, allowRoles("admin", "student", "manager"), checkManagerPermission("fees.create", ["collect_fees"]), checkFeatureAccess("feature_fees"), validate(feesValidator.recordPayment), feeInvalidation, feesController.recordPayment);
router.get("/payments", verifyToken, allowRoles("admin", "manager"), checkManagerPermission("fees.read", ["collect_fees", "recent_payments", "payment_history"]), checkFeatureAccess("feature_fees"), validate(feesValidator.getPayments), cacheMiddleware(300, { cacheWhen: (req) => !req.query.search }), feesController.getAllPayments);
router.get("/payment/:student_id", verifyToken, allowRoles("admin", "faculty", "student", "manager"), checkManagerPermission("fees.read", ["collect_fees"]), checkFeatureAccess("feature_fees"), validate(feesValidator.getStudentPayments), cacheMiddleware(300), feesController.getStudentPayments);

router.get("/my-fees", verifyToken, allowRoles("student"), checkFeatureAccess("feature_fees"), cacheMiddleware(300, { scope: "user" }), feesController.getMyFees);
router.get("/student-fees", verifyToken, allowRoles("admin", "manager"), checkManagerPermission("fees.read", ["collect_fees"]), checkFeatureAccess("feature_fees"), cacheMiddleware(300, { cacheWhen: (req) => !req.query.search }), feesController.getAssignedStudentFees);
router.post("/discount", verifyToken, allowRoles("admin", "manager"), checkManagerPermission("fees.update"), checkFeatureAccess("feature_fees"), validate(feesValidator.applyDiscount), feeInvalidation, feesController.applyDiscount);
router.get("/discount-logs", verifyToken, allowRoles("admin", "manager"), checkManagerPermission("fees.read"), checkFeatureAccess("feature_fees"), cacheMiddleware(300), feesController.getDiscountLogs);
router.patch("/student-fee/:id/reminder", verifyToken, allowRoles("admin", "manager"), checkManagerPermission("fees.update"), checkFeatureAccess("feature_fees"), validate(feesValidator.updateReminder), feeInvalidation, feesController.updateReminderDate);

module.exports = router;
