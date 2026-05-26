/**
 * Announcement Routes — Smart Announcement System (Phase 3)
 * IMPORTANT: Static routes MUST be BEFORE /:id dynamic routes
 */

const express = require("express");
const router = express.Router();
const announcementController = require("../controllers/announcement.controller");
const verifyToken = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");
const validate = require("../middlewares/validate.middleware");
const annValidator = require("../validators/announcement.validator");

// ── Bell icon — all roles call this on dashboard load ──────────────────────────
router.get(
    "/unread-count",
    verifyToken,
    announcementController.getUnreadCount
);

// ── Mark all as read (static — must be before /:id) ───────────────────────────
router.post(
    "/mark-all-read",
    verifyToken,
    announcementController.markAllAsRead
);

// ── Legacy: mark as viewed (keeps backward compat) ────────────────────────────
router.post(
    "/viewed",
    verifyToken,
    announcementController.markAsViewed
);

// ── Admin/Manager: all institute announcements ────────────────────────────────
router.get(
    "/admin/all",
    verifyToken,
    allowRoles("admin", "manager"),
    announcementController.getAllAnnouncements
);

// ── Faculty: own announcements only ──────────────────────────────────────────
router.get(
    "/faculty/mine",
    verifyToken,
    allowRoles("faculty"),
    announcementController.getMyAnnouncements
);

// ── Faculty: institute announcements (read-only view) ─────────────────────────
router.get(
    "/faculty/institute",
    verifyToken,
    allowRoles("faculty"),
    announcementController.getInstituteAnnouncementsForFaculty
);

// ── All Roles: contextual announcements with read status (for sidebar) ──────────
router.get(
    "/institute",
    verifyToken,
    allowRoles("student", "parent", "faculty", "admin", "manager"),
    announcementController.getInstituteAnnouncements
);

// ── Generic GET / — admin/manager/faculty can use for their own context ────────
router.get(
    "/",
    verifyToken,
    validate(annValidator.getAnnouncements),
    announcementController.getAllAnnouncements
);

// ── Create ─────────────────────────────────────────────────────────────────────
router.post(
    "/",
    verifyToken,
    allowRoles("admin", "manager", "faculty"),
    validate(annValidator.createAnnouncement),
    announcementController.createAnnouncement
);

// ── Update (Edit) ──────────────────────────────────────────────────────────────
router.put(
    "/:id",
    verifyToken,
    allowRoles("admin", "manager", "faculty"),
    validate(annValidator.updateAnnouncement),
    announcementController.updateAnnouncement
);

// ── Mark individual as read ────────────────────────────────────────────────────
router.post(
    "/:id/read",
    verifyToken,
    announcementController.markAsRead
);

// ── Delete ─────────────────────────────────────────────────────────────────────
router.delete(
    "/:id",
    verifyToken,
    allowRoles("admin", "manager", "faculty"),
    validate(annValidator.deleteAnnouncement),
    announcementController.deleteAnnouncement
);

module.exports = router;
