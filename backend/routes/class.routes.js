/**
 * Class Routes
 * Defines API endpoints for class management
 * ✅ Phase 3.4: Redis caching on GET routes
 * ✅ Phase 7: Joi validation on all inputs
 */

const express = require("express");
const router = express.Router();
const classController = require("../controllers/class.controller");
const verifyToken = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");
const { checkClassLimit } = require("../middlewares/planLimits.middleware");
const checkSubscription = require("../middlewares/subscription.middleware");
const checkManagerPermission = require("../middlewares/checkManagerPermission");
const { cacheMiddleware, invalidateCache } = require("../middlewares/cache.middleware"); // ✅ Phase 3.4
const validate = require("../middlewares/validate.middleware"); // ✅ Phase 7
const classValidator = require("../validators/class.validator"); // ✅ Phase 7

// Create Class - Check Limits (invalidates class cache)
router.post("/", verifyToken, checkSubscription, allowRoles("admin", "manager"), checkManagerPermission("classes.create"), checkClassLimit, validate(classValidator.createClass), invalidateCache("cache:/api/classes*"), classController.createClass);

// ✅ Phase 3.4: Cache class list for 10 minutes (600s), single class 15 min
router.get("/", verifyToken, checkSubscription, allowRoles("admin", "faculty", "manager"), checkManagerPermission("classes.read", ["fees", "attendance", "reports", "transport"]), validate(classValidator.getClasses), cacheMiddleware(600), classController.getAllClasses);
router.get("/:id", verifyToken, checkSubscription, allowRoles("admin", "faculty", "manager"), checkManagerPermission("classes.read", ["fees", "attendance", "reports"]), validate(classValidator.getClassById), cacheMiddleware(900), classController.getClassById);
router.put("/:id", verifyToken, checkSubscription, allowRoles("admin", "manager"), checkManagerPermission("classes.update"), validate(classValidator.updateClass), invalidateCache("cache:/api/classes*"), classController.updateClass);
router.delete("/:id", verifyToken, checkSubscription, allowRoles("admin", "manager"), checkManagerPermission("classes.delete"), validate(classValidator.deleteClass), invalidateCache("cache:/api/classes*"), classController.deleteClass);

module.exports = router;
