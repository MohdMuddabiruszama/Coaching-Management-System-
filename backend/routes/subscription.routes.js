/**
 * Subscription Routes
 * ✅ Phase 7: Joi validation on all inputs
 */

const express = require("express");
const router = express.Router();
const subscriptionController = require("../controllers/subscription.controller");
const verifyToken = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");
const validate = require("../middlewares/validate.middleware"); // ✅ Phase 7
const subValidator = require("../validators/subscription.validator"); // ✅ Phase 7

router.post("/", verifyToken, allowRoles("super_admin", "admin"), validate(subValidator.createSubscription), subscriptionController.createSubscription);
router.get("/", verifyToken, allowRoles("super_admin"), validate(subValidator.getAllSubscriptions), subscriptionController.getAllSubscriptions);
router.patch("/:id/status", verifyToken, allowRoles("super_admin"), validate(subValidator.updateStatus), subscriptionController.updateSubscriptionStatus);
router.patch("/:id/period", verifyToken, allowRoles("super_admin"), validate(subValidator.updatePeriod), subscriptionController.updateSubscriptionPeriod);

module.exports = router;
