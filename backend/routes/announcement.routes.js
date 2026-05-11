/**
 * Announcement Routes
 * ✅ Phase 7: Joi validation on all inputs
 */

const express = require("express");
const router = express.Router();
const announcementController = require("../controllers/announcement.controller");
const verifyToken = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");
const validate = require("../middlewares/validate.middleware"); // ✅ Phase 7
const annValidator = require("../validators/announcement.validator"); // ✅ Phase 7

router.get("/unread-count", verifyToken, announcementController.getUnreadCount);
router.post("/viewed", verifyToken, validate(annValidator.markAsViewed), announcementController.markAsViewed);
router.post("/", verifyToken, allowRoles("admin", "manager", "faculty"), validate(annValidator.createAnnouncement), announcementController.createAnnouncement);
router.get("/", verifyToken, validate(annValidator.getAnnouncements), announcementController.getAllAnnouncements);
router.delete("/:id", verifyToken, allowRoles("admin", "manager"), validate(annValidator.deleteAnnouncement), announcementController.deleteAnnouncement);

module.exports = router;
