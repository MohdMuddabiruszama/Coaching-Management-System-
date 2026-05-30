const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");
const adminController = require("../controllers/admin.controller");
const checkSubscription = require("../middlewares/subscription.middleware");

const { getUsageStats } = require("../middlewares/planLimits.middleware");

// Dashboard Stats
router.get(
    "/stats",
    verifyToken,
    checkSubscription,
    allowRoles("admin", "manager"),
    adminController.getDashboardStats
);

// Clear Unread Counts
router.post(
    "/clear-unread-announcements",
    verifyToken,
    checkSubscription,
    allowRoles("admin", "manager"),
    adminController.clearUnreadAnnouncements
);

router.post(
    "/clear-unread-chats",
    verifyToken,
    checkSubscription,
    allowRoles("admin", "manager"),
    adminController.clearUnreadChats
);

router.post(
    "/clear-unread-assignments",
    verifyToken,
    checkSubscription,
    allowRoles("admin", "manager"),
    adminController.clearUnreadAssignments
);

router.post(
    "/clear-unread-notes",
    verifyToken,
    checkSubscription,
    allowRoles("admin", "manager"),
    adminController.clearUnreadNotes
);

router.post(
    "/clear-unread-enquiries",
    verifyToken,
    checkSubscription,
    allowRoles("admin", "manager"),
    adminController.clearUnreadEnquiries
);


// Plan Usage Stats
router.get(
    "/usage",
    verifyToken,
    checkSubscription,
    allowRoles("admin", "manager"),
    getUsageStats
);

// --- Admin Management Routes ---

// Get all admins
router.get(
    "/admins",
    verifyToken,
    checkSubscription,
    allowRoles("admin"),
    adminController.getAllAdmins
);

// Create new admin
router.post(
    "/admins",
    verifyToken,
    checkSubscription,
    allowRoles("admin"),
    adminController.createAdmin
);

// Delete admin
router.delete(
    "/admins/:id",
    verifyToken,
    checkSubscription,
    allowRoles("admin"),
    adminController.deleteAdmin
);

// Update admin
router.put(
    "/admins/:id",
    verifyToken,
    checkSubscription,
    allowRoles("admin"),
    adminController.updateAdmin
);

module.exports = router;
