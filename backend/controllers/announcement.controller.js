/**
 * Announcement Controller — Smart Announcement System (Phase 3)
 * All 9 handlers. Uses announcementService for business logic.
 */

const { Op } = require("sequelize");
const { Announcement, User, Student, Subject } = require("../models");
const announcementService = require("../services/announcement.service");

// ─── CREATE ───────────────────────────────────────────────────────────────────
exports.createAnnouncement = async (req, res) => {
    try {
        const {
            title, content, target_audience, priority,
            is_pinned, expires_at, target_class, subject_id,
        } = req.body;

        const announcement = await Announcement.create({
            institute_id:    req.user.institute_id,
            title,
            content,
            target_audience: target_audience || "all",
            priority:        priority || "normal",
            is_pinned:       is_pinned || false,
            expires_at:      expires_at || null,
            target_class:    target_class || null,
            subject_id:      subject_id || null,
            created_by:      req.user.id,
            posted_by:       req.user.name || req.user.username || null,
        });

        return res.status(201).json({
            success: true,
            message: "Announcement created successfully",
            data: announcement,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── UPDATE (Edit) ────────────────────────────────────────────────────────────
exports.updateAnnouncement = async (req, res) => {
    try {
        const ann = await Announcement.findOne({
            where: { id: req.params.id, institute_id: req.user.institute_id },
        });

        if (!ann) {
            return res.status(404).json({ success: false, message: "Announcement not found" });
        }

        // Faculty can only edit their own announcements
        if (req.user.role === "faculty" && ann.created_by !== req.user.id) {
            return res.status(403).json({ success: false, message: "Cannot edit other faculty's announcements" });
        }

        const { title, content, target_audience, priority, is_pinned, expires_at, target_class, subject_id } = req.body;

        await ann.update({
            title,
            content,
            target_audience,
            priority,
            is_pinned,
            expires_at,
            target_class,
            subject_id,
            updated_at: new Date(),
        });

        return res.json({ success: true, data: ann });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── DELETE ───────────────────────────────────────────────────────────────────
exports.deleteAnnouncement = async (req, res) => {
    try {
        const ann = await Announcement.findOne({
            where: { id: req.params.id, institute_id: req.user.institute_id },
        });

        if (!ann) {
            return res.status(404).json({ success: false, message: "Announcement not found" });
        }

        // Faculty can only delete their own
        if (req.user.role === "faculty" && ann.created_by !== req.user.id) {
            return res.status(403).json({ success: false, message: "Cannot delete other faculty's announcements" });
        }

        await ann.destroy();
        return res.json({ success: true, message: "Announcement deleted successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── GET ALL (Admin/Manager) ──────────────────────────────────────────────────
exports.getAllAnnouncements = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const institute_id = req.user.institute_id;
        const offset = (page - 1) * limit;

        const { count, rows } = await Announcement.findAndCountAll({
            where: { institute_id },
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [["is_pinned", "DESC"], ["created_at", "DESC"]],
            include: [
                { model: User, as: "creator", attributes: ["id", "name", "role"] },
                { model: Subject, attributes: ["id", "name"] },
            ],
        });

        return res.json({
            success: true,
            data: {
                announcements: rows,
                pagination: { total: count, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(count / limit) },
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── GET MINE (Faculty — own announcements only) ───────────────────────────────
exports.getMyAnnouncements = async (req, res) => {
    try {
        const announcements = await Announcement.findAll({
            where: { institute_id: req.user.institute_id, created_by: req.user.id },
            order: [["created_at", "DESC"]],
            include: [{ model: Subject, attributes: ["id", "name"] }],
        });
        return res.json({ success: true, data: announcements });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── GET INSTITUTE ANNOUNCEMENTS (Student/Parent — with read status) ──────────
exports.getInstituteAnnouncements = async (req, res) => {
    try {
        const list = await announcementService.getAnnouncementsForUser(
            req.user.id,
            req.user.role,
            req.user.institute_id,
            req.user.class_id || null
        );
        return res.json({ success: true, data: list });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── GET INSTITUTE ANNOUNCEMENTS (Faculty — institute's announcements, read-only) ─
exports.getInstituteAnnouncementsForFaculty = async (req, res) => {
    try {
        const list = await announcementService.getAnnouncementsForUser(
            req.user.id,
            "faculty",
            req.user.institute_id
        );
        return res.json({ success: true, data: list });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── GET UNREAD COUNT (Bell icon — all roles) ─────────────────────────────────
// Returns: { count: 3, highest_priority: 'urgent' }
// Bell color logic: urgent=red, high=orange, normal=blue, null=gray
exports.getUnreadCount = async (req, res) => {
    try {
        const result = await announcementService.getUnreadCount(
            req.user.id,
            req.user.role,
            req.user.institute_id
        );
        return res.json({ success: true, data: result, count: result.count });
    } catch (error) {
        // Silent fail — don't break dashboards
        return res.json({ success: true, data: { count: 0, highest_priority: null }, count: 0 });
    }
};

// ─── MARK AS READ (individual) ────────────────────────────────────────────────
exports.markAsRead = async (req, res) => {
    try {
        await announcementService.markAsRead(req.params.id, req.user.id);
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── MARK ALL AS READ ─────────────────────────────────────────────────────────
exports.markAllAsRead = async (req, res) => {
    try {
        const count = await announcementService.markAllAsRead(
            req.user.id,
            req.user.role,
            req.user.institute_id
        );
        return res.json({ success: true, data: { marked_count: count } });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── MARK AS VIEWED (legacy — kept for backward compat) ───────────────────────
exports.markAsViewed = async (req, res) => {
    try {
        // Delegate to markAllAsRead for the new system
        await announcementService.markAllAsRead(
            req.user.id,
            req.user.role,
            req.user.institute_id
        );
        return res.status(200).json({ success: true, message: "Announcements marked as viewed" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = exports;
