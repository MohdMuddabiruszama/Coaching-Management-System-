const { Notification, DeviceToken, NotificationPref } = require("../models");
const { Op } = require("sequelize");

// 1. GET /api/notifications
exports.getNotifications = async (req, res) => {
    try {
        const { user } = req;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const notifications = await Notification.findAll({
            where: {
                user_id: user.id,
                institute_id: user.institute_id,
                archived_at: null
            },
            order: [["created_at", "DESC"]],
            limit,
            offset,
        });

        // Get total count for pagination info
        const total = await Notification.count({
            where: {
                user_id: user.id,
                institute_id: user.institute_id,
                archived_at: null
            }
        });

        return res.status(200).json({
            success: true,
            data: notifications,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch notifications." });
    }
};

// 2. GET /api/notifications/unread-count
exports.getUnreadCount = async (req, res) => {
    try {
        const { user } = req;
        const count = await Notification.count({
            where: {
                user_id: user.id,
                institute_id: user.institute_id,
                is_read: false,
                archived_at: null
            }
        });

        return res.status(200).json({ success: true, count });
    } catch (error) {
        console.error("Error fetching unread count:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch unread count." });
    }
};

// 3. PATCH /api/notifications/mark-read
exports.markAsRead = async (req, res) => {
    try {
        const { user } = req;
        const { ids, all } = req.body;

        const whereClause = {
            user_id: user.id,
            institute_id: user.institute_id,
        };

        if (!all) {
            if (!Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({ success: false, message: "Must provide ids array or all: true" });
            }
            whereClause.id = { [Op.in]: ids };
        }

        await Notification.update(
            { is_read: true },
            { where: whereClause }
        );

        return res.status(200).json({ success: true, message: "Notifications marked as read." });
    } catch (error) {
        console.error("Error marking as read:", error);
        return res.status(500).json({ success: false, message: "Failed to mark notifications as read." });
    }
};

// 4. DELETE /api/notifications/:id
exports.deleteNotification = async (req, res) => {
    try {
        const { user } = req;
        const { id } = req.params;

        // Soft delete
        await Notification.update(
            { archived_at: new Date() },
            {
                where: {
                    id,
                    user_id: user.id,
                    institute_id: user.institute_id
                }
            }
        );

        return res.status(200).json({ success: true, message: "Notification deleted." });
    } catch (error) {
        console.error("Error deleting notification:", error);
        return res.status(500).json({ success: false, message: "Failed to delete notification." });
    }
};

// 5. POST /api/device/register
exports.registerDeviceToken = async (req, res) => {
    try {
        const { user } = req;
        const { fcm_token, platform } = req.body;

        if (!fcm_token) {
            return res.status(400).json({ success: false, message: "fcm_token is required." });
        }

        // Destroy any existing records for this exact token to prevent duplicates
        // (e.g., if the user switches from Student to Parent account on the same device)
        await DeviceToken.destroy({ where: { fcm_token } });

        // Create a single fresh record bound to the CURRENT active user
        await DeviceToken.create({
            user_id: user.id,
            fcm_token,
            platform,
            is_active: true,
            last_seen: new Date()
        });

        return res.status(200).json({ success: true, message: "Device registered for push notifications." });
    } catch (error) {
        console.error("Error registering device token:", error);
        return res.status(500).json({ success: false, message: "Failed to register device token." });
    }
};

// 6. GET /api/notification-prefs
exports.getNotificationPrefs = async (req, res) => {
    try {
        const { user } = req;
        const prefs = await NotificationPref.findAll({
            where: { user_id: user.id }
        });
        return res.status(200).json({ success: true, data: prefs });
    } catch (error) {
        console.error("Error fetching notification prefs:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch preferences." });
    }
};

// 7. PUT /api/notification-prefs
exports.updateNotificationPrefs = async (req, res) => {
    try {
        const { user } = req;
        const { prefs } = req.body; // Array of { type, push_enabled, email_enabled, quiet_start, quiet_end }

        if (!Array.isArray(prefs)) {
            return res.status(400).json({ success: false, message: "prefs must be an array." });
        }

        for (const pref of prefs) {
            if (!pref.type) continue;
            
            await NotificationPref.upsert({
                user_id: user.id,
                type: pref.type,
                push_enabled: pref.push_enabled !== undefined ? pref.push_enabled : true,
                email_enabled: pref.email_enabled !== undefined ? pref.email_enabled : false,
                quiet_start: pref.quiet_start || null,
                quiet_end: pref.quiet_end || null,
            });
        }

        return res.status(200).json({ success: true, message: "Preferences updated." });
    } catch (error) {
        console.error("Error updating notification prefs:", error);
        return res.status(500).json({ success: false, message: "Failed to update preferences." });
    }
};
