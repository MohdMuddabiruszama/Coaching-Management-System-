const express = require("express");
const router = express.Router();
const controller = require("../controllers/payment.controller");
const verifyToken = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware"); // ✅ Phase 7
const paymentValidator = require("../validators/payment.validator"); // ✅ Phase 7

// These routes require authentication as they are for a logged-in admin (even if institute is pending)
router.post("/initiate", verifyToken, validate(paymentValidator.initiatePayment), controller.initiatePayment);
router.post("/verify", verifyToken, validate(paymentValidator.verifyPayment), controller.verifyPayment);

// Phase 4: Student Fee Payments
router.post("/fees/create-order", verifyToken, validate(paymentValidator.createFeeOrder), controller.createFeeOrder);
router.post("/fees/verify", verifyToken, validate(paymentValidator.verifyFeePayment), controller.verifyFeePayment);

module.exports = router;
