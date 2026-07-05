const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification.controller");
// All notification routes require authentication (mounted with verifyToken in app.js)

// Notifications Core
router.get("/", notificationController.getNotifications);
router.get("/unread-count", notificationController.getUnreadCount);
router.patch("/mark-read", notificationController.markAsRead);
router.delete("/:id", notificationController.deleteNotification);

// Devices
router.post("/device/register", notificationController.registerDeviceToken);

// Preferences
router.get("/prefs", notificationController.getNotificationPrefs);
router.put("/prefs", notificationController.updateNotificationPrefs);

module.exports = router;
