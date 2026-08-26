const { Notification, DeviceToken, NotificationPref } = require("../models");
const { Op } = require("sequelize");
const { getIo } = require("../utils/socket");
const { sendPushNotification } = require("../config/firebase");

/**
 * Centralized Notification Service
 * Handles creating DB records and (in later phases) pushing to WebSockets and FCM.
 */
class NotificationService {
    /**
     * Create and send a notification
     * @param {number} instituteId
     * @param {number} userId
     * @param {string} type - Notification Type Enum
     * @param {string} title
     * @param {string} body
     * @param {object} data - Extra JSON payload
     */
    static async createAndSend(instituteId, userId, type, title, body, data = {}) {
        try {
            // 1. Check user preferences
            const pref = await NotificationPref.findOne({
                where: { user_id: userId, type }
            });

            // If user explicitly disabled this type of push/in-app alert
            if (pref && pref.push_enabled === false) {
                // We still save it to the DB so they can see it in their notification center,
                // but we might skip FCM/WS push (handled in later phases)
            }

            // 2. Save to database
            const notification = await Notification.create({
                institute_id: instituteId,
                user_id: userId,
                type,
                title,
                body,
                data_json: data
            });

            // 3. Emit via WebSocket
            try {
                const io = getIo();
                if (io) {
                    io.to(`user_${userId}`).emit("notification", notification);
                }
            } catch (wsError) {
                console.error("WebSocket emit failed:", wsError.message);
            }

            // 4. Send via FCM (if outside quiet hours and push enabled)
            // A. Check user preferences for this type
            let pushEnabled = true;

            if (pref) {
                if (pref.push_enabled === false) {
                    pushEnabled = false;
                } else if (pref.quiet_start && pref.quiet_end) {
                    // Check quiet hours (basic implementation)
                    const now = new Date();
                    const currentHour = now.getHours();
                    const currentMin = now.getMinutes();
                    const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}:00`;
                    
                    if (currentTime >= pref.quiet_start && currentTime <= pref.quiet_end) {
                        pushEnabled = false; // Currently in quiet hours
                    }
                }
            }

            if (pushEnabled) {
                // Fetch active device tokens
                const devices = await DeviceToken.findAll({
                    where: { user_id: userId, is_active: true }
                });

                if (devices.length > 0) {
                    const tokens = devices.map(d => d.fcm_token);
                    const pushPayload = {
                        title,
                        body,
                        data: {
                            type,
                            route: data.route || data.link || "",
                            notification_id: notification.id.toString(),
                        }
                    };

                    const result = await sendPushNotification(tokens, pushPayload);
                    
                    // Cleanup inactive tokens
                    if (result && result.failedTokens && result.failedTokens.length > 0) {
                        await DeviceToken.update(
                            { is_active: false },
                            { where: { fcm_token: { [Op.in]: result.failedTokens } } }
                        );
                    }
                }
            }
            return notification;
        } catch (error) {
            console.error("Error in NotificationService.createAndSend:", error);
            // We do not throw, so calling functions (like attendance) don't crash if notifications fail
        }
    }

    /**
     * Helper to send notification to a student and their linked parents
     */
    static async notifyStudentAndParents(instituteId, studentId, type, title, message, link = null, data = {}) {
        try {
            const { Student, StudentParent } = require("../models");
            
            // 1. Get Student's user_id and name
            const student = await Student.findOne({ 
                where: { id: studentId, institute_id: instituteId },
                include: [{ model: require('../models').User, as: 'User', attributes: ['name'] }]
            });
            if (!student) return;
            
            const studentName = student.User ? student.User.name : "Student";

            // Notify Student
            const payload = { route: link, ...data };
            await this.createAndSend(instituteId, student.user_id, type, title, message, payload);

            // 2. Get Parents' user_ids
            const parentLinks = await StudentParent.findAll({ where: { student_id: studentId } });
            
            // 3. Format Parent Message
            let parentMessage = message;
            if (parentMessage.startsWith("You were ")) {
                parentMessage = parentMessage.replace("You were ", `${studentName} was `);
            } else if (parentMessage.startsWith("You ")) {
                parentMessage = parentMessage.replace("You ", `${studentName} `);
            } else if (parentMessage.startsWith("Your ")) {
                parentMessage = parentMessage.replace("Your ", `${studentName}'s `);
            } else {
                parentMessage = `${studentName}: ${parentMessage}`;
            }
            
            for (const pl of parentLinks) {
                await this.createAndSend(instituteId, pl.parent_id, type, title, parentMessage, payload);
            }
        } catch (error) {
            console.error("Error in notifyStudentAndParents:", error);
        }
    }

    /**
     * Highly optimized bulk notification for an entire class of students and their parents.
     * Generates O(1) network/DB operations to maximize performance.
     */
    static async bulkNotifyClass(instituteId, classId, type, title, baseMessage, link = null, data = {}) {
        try {
            const { Student, StudentParent, User } = require("../models");
            
            // 1. Fetch all students in class
            const students = await Student.findAll({ 
                where: { class_id: classId, institute_id: instituteId },
                include: [{ model: User, as: 'User', attributes: ['name'] }]
            });
            if (!students.length) return;

            const studentIds = students.map(s => s.id);
            const parentLinks = await StudentParent.findAll({ 
                where: { student_id: studentIds }
            });

            // Map parents to student names
            const parentMap = {}; // parent_id -> [studentName, ...]
            parentLinks.forEach(pl => {
                const stu = students.find(s => s.id === pl.student_id);
                if (stu && stu.User) {
                    if (!parentMap[pl.parent_id]) parentMap[pl.parent_id] = [];
                    parentMap[pl.parent_id].push(stu.User.name);
                }
            });

            const notificationsToCreate = [];
            const userIdsToNotify = new Set();
            const payload = { route: link, ...data };

            // Student Notifications
            for (const stu of students) {
                if (stu.user_id) {
                    userIdsToNotify.add(stu.user_id);
                    notificationsToCreate.push({
                        institute_id: instituteId,
                        user_id: stu.user_id,
                        type,
                        title,
                        body: baseMessage,
                        data_json: payload,
                        is_read: false
                    });
                }
            }

            // Parent Notifications
            for (const parentId of Object.keys(parentMap)) {
                userIdsToNotify.add(parseInt(parentId));
                const stuNames = parentMap[parentId].join(" & ");
                let parentMessage = baseMessage;
                
                if (parentMessage.startsWith("You were ")) {
                    parentMessage = parentMessage.replace("You were ", `${stuNames} was `);
                } else if (parentMessage.startsWith("You ")) {
                    parentMessage = parentMessage.replace("You ", `${stuNames} `);
                } else if (parentMessage.startsWith("Your ")) {
                    parentMessage = parentMessage.replace("Your ", `${stuNames}'s `);
                } else {
                    parentMessage = `${stuNames}: ${parentMessage}`;
                }
                
                notificationsToCreate.push({
                    institute_id: instituteId,
                    user_id: parseInt(parentId),
                    type,
                    title,
                    body: parentMessage,
                    data_json: payload,
                    is_read: false
                });
            }

            if (notificationsToCreate.length === 0) return;

            // 2. Fetch all preferences for these users
            const prefs = await NotificationPref.findAll({
                where: { user_id: Array.from(userIdsToNotify), type }
            });
            const prefMap = {};
            prefs.forEach(p => prefMap[p.user_id] = p);

            // 3. Bulk Insert DB
            const createdNotifs = await Notification.bulkCreate(notificationsToCreate);

            // 4. Fire WebSockets
            const io = getIo();
            if (io) {
                for (const notif of createdNotifs) {
                    io.to(`user_${notif.user_id}`).emit("notification", notif);
                }
            }

            // 5. Gather Device Tokens for FCM
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`;
            
            const validUserIdsForPush = Array.from(userIdsToNotify).filter(uid => {
                const p = prefMap[uid];
                if (p && p.push_enabled === false) return false;
                if (p && p.quiet_start && p.quiet_end) {
                    if (currentTime >= p.quiet_start && currentTime <= p.quiet_end) return false;
                }
                return true;
            });

            if (validUserIdsForPush.length > 0) {
                const devices = await DeviceToken.findAll({
                    where: { user_id: validUserIdsForPush, is_active: true }
                });
                
                if (devices.length > 0) {
                    const bodyToTokens = {};
                    createdNotifs.forEach(notif => {
                        if (validUserIdsForPush.includes(notif.user_id)) {
                            const userTokens = devices.filter(d => d.user_id === notif.user_id).map(d => d.fcm_token);
                            if (userTokens.length > 0) {
                                if (!bodyToTokens[notif.body]) bodyToTokens[notif.body] = [];
                                bodyToTokens[notif.body].push(...userTokens);
                            }
                        }
                    });

                    // Send pushes grouped by notification message body
                    for (const [msgBody, tokens] of Object.entries(bodyToTokens)) {
                        const pushPayload = {
                            title,
                            body: msgBody,
                            data: { type, route: link || "", notification_id: "bulk" }
                        };
                        const result = await sendPushNotification(tokens, pushPayload);
                        
                        if (result && result.failedTokens && result.failedTokens.length > 0) {
                            await DeviceToken.update(
                                { is_active: false },
                                { where: { fcm_token: result.failedTokens } }
                            );
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Error in bulkNotifyClass:", error);
        }
    }
}

module.exports = NotificationService;
