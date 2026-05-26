const { ChatRoom, ChatMessage, ChatParticipant, User, Faculty, Student, Class, Subject, Institute, UsageTracker } = require("../models");
const { Op, fn, col } = require("sequelize");

// ─── HELPERS ──────────────────────────────────────────────────────────────

async function ensureParticipant(room_id, user_id, role) {
    const exists = await ChatParticipant.findOne({ where: { room_id, user_id } });
    if (!exists) {
        await ChatParticipant.create({ room_id, user_id, role });
    }
}

// Ensure the direct room exists between a student and a faculty for a specific subject
async function getOrCreateDirectRoom(institute_id, student_user_id, faculty_user_id, subject_id, class_id) {
    const existingRooms = await ChatRoom.findAll({
        where: {
            institute_id,
            type: "direct",
            subject_id: subject_id || null,
        },
        include: [{
            model: ChatParticipant,
        }]
    });

    let room = null;
    if (student_user_id && faculty_user_id) {
        room = existingRooms.find(r => {
            if (!r.ChatParticipants) return false;
            const pIds = r.ChatParticipants.map(p => Number(p.user_id));
            return pIds.includes(Number(student_user_id)) &&
                pIds.includes(Number(faculty_user_id)) &&
                pIds.length === 2;
        });
    }

    if (!room) {
        // Create new direct room
        room = await ChatRoom.create({
            institute_id,
            type: "direct",
            subject_id: subject_id || null,
            class_id: class_id || null,
            name: "Direct Chat",
            target_gender: "both"
        });
        await ensureParticipant(room.id, student_user_id, "student");
        if (faculty_user_id) await ensureParticipant(room.id, faculty_user_id, "faculty");
    }
    return room;
}

// ─── ENDPOINTS ──────────────────────────────────────────────────────────────

// 1. Create Room (For Faculty)
exports.createRoom = async (req, res) => {
    try {
        const { role: userRole, id: userId, institute_id } = req.user;
        const { subject_id, class_id, audience, name } = req.body;

        if (userRole !== "faculty") {
            return res.status(403).json({ success: false, message: "Only faculty can create group rooms." });
        }
        if (!subject_id || !audience || !name) {
            return res.status(400).json({ success: false, message: "subject_id, target audience and room name required" });
        }

        const faculty = await Faculty.findOne({ where: { user_id: userId } });
        if (!faculty) return res.status(404).json({ success: false, message: "Faculty record not found" });

        // target_gender: audience handles 'boys', 'girls', 'both'
        let targetGender = 'both';
        if (audience.toLowerCase() === 'boys') targetGender = 'male';
        if (audience.toLowerCase() === 'girls') targetGender = 'female';

        const newRoom = await ChatRoom.create({
            institute_id,
            class_id: class_id || null,
            subject_id,
            faculty_id: faculty.id,
            type: "group",
            name,
            target_gender: targetGender
        });

        // Add faculty to participant
        await ensureParticipant(newRoom.id, userId, userRole);

        return res.status(201).json({ success: true, message: "Room created successfully", room: newRoom });
    } catch (err) {
        console.error("createRoom:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 2. Delete Room (For Faculty or Admin)
exports.deleteRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { role: userRole, id: userId, institute_id } = req.user;

        const room = await ChatRoom.findOne({ where: { id: roomId, institute_id } });
        if (!room) return res.status(404).json({ success: false, message: "Room not found" });

        // Ensure permission
        if (userRole === "faculty") {
            const faculty = await Faculty.findOne({ where: { user_id: userId } });
            if (!faculty || room.faculty_id !== faculty.id) {
                return res.status(403).json({ success: false, message: "You can only delete your own rooms." });
            }
        } else if (userRole !== "admin" && userRole !== "owner") {
            return res.status(403).json({ success: false, message: "Access denied." });
        }

        // Delete dependencies (messages, participants)
        await ChatParticipant.destroy({ where: { room_id: room.id } });
        await ChatMessage.destroy({ where: { room_id: room.id } });
        await room.destroy();

        return res.status(200).json({ success: true, message: "Room deleted successfully." });
    } catch (err) {
        console.error("deleteRoom:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 3. Send Message
exports.sendMessage = async (req, res) => {
    try {
        const { room_id, message } = req.body;
        const { role: userRole, id: userId, institute_id } = req.user;

        if (!room_id) return res.status(400).json({ success: false, message: "room_id required" });
        if (!message && !req.file) return res.status(400).json({ success: false, message: "message or file required" });

        const room = await ChatRoom.findOne({ where: { id: room_id, institute_id } });
        if (!room) return res.status(404).json({ success: false, message: "Room not found" });

        // ── Chat Message Limit Check ──────────────────────────────────────────
        const institute = await Institute.findByPk(institute_id, {
            attributes: ["current_limit_chat_messages"]
        });
        const limit = institute ? Number(institute.current_limit_chat_messages) : 500;

        // -1 means unlimited (lifetime members)
        if (limit !== -1) {
            // Get or create the usage tracker for this institute's current billing period
            const now = new Date();
            const periodStart = new Date(now.getFullYear(), now.getMonth(), 1); // 1st of current month
            const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);  // last day of month

            const [tracker] = await UsageTracker.findOrCreate({
                where: {
                    institute_id,
                    metric: "chat_messages",
                    billing_period_start: periodStart.toISOString().slice(0, 10)
                },
                defaults: {
                    institute_id,
                    metric: "chat_messages",
                    current_value: 0,
                    limit_value: limit,
                    billing_period_start: periodStart.toISOString().slice(0, 10),
                    billing_period_end: periodEnd.toISOString().slice(0, 10),
                    last_reset_at: periodStart
                }
            });

            // Sync limit in case plan changed since tracker was created
            if (tracker.limit_value !== limit) {
                await tracker.update({ limit_value: limit });
            }

            if (tracker.current_value >= tracker.limit_value) {
                return res.status(403).json({
                    success: false,
                    code: "CHAT_LIMIT_REACHED",
                    message: `Your institute has reached its monthly chat message limit (${tracker.current_value}/${tracker.limit_value}). Please contact your admin to upgrade the plan.`,
                    usage: { used: tracker.current_value, limit: tracker.limit_value }
                });
            }
        }
        // ─────────────────────────────────────────────────────────────────────

        if (userRole !== "admin" && userRole !== "owner") {
            await ensureParticipant(room_id, userId, userRole);
        }

        // Phase 8: For parent, get their linked student's name to display "Parent of [Child]"
        let sender_display_name = null;
        if (userRole === "parent") {
            const { Student, User: UserModel } = require("../models");
            const parentUser = await UserModel.findOne({
                where: { id: userId, institute_id },
                include: [{
                    model: Student,
                    as: "LinkedStudents",
                    include: [{ model: User, attributes: ["name"] }]
                }]
            });
            if (parentUser && parentUser.LinkedStudents && parentUser.LinkedStudents.length > 0) {
                const childName = parentUser.LinkedStudents[0]?.User?.name || "Child";
                sender_display_name = `${parentUser.name || "Parent"} (Parent of ${childName})`;
            }
        }

        const newMsg = await ChatMessage.create({
            room_id,
            sender_id: userId,
            sender_role: userRole,
            message: message || null,
            attachment_url: req.file ? req.file.path : null,  // Cloudinary permanent URL
            attachment_type: req.file ? req.file.mimetype : null,
        });

        // ── Increment usage after successful message save ─────────────────────
        if (limit !== -1) {
            try {
                const now2 = new Date();
                const periodStart2 = new Date(now2.getFullYear(), now2.getMonth(), 1);
                const tracker2 = await UsageTracker.findOne({
                    where: {
                        institute_id,
                        metric: "chat_messages",
                        billing_period_start: periodStart2.toISOString().slice(0, 10)
                    }
                });
                if (tracker2) await tracker2.increment("current_value");
            } catch (usageErr) {
                console.error("[Chat] Usage increment failed (non-fatal):", usageErr.message);
            }
        }
        // ─────────────────────────────────────────────────────────────────────

        return res.status(201).json({ success: true, sender_display_name });
    } catch (err) {
        console.error("sendMessage:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 3b. Get Chat Usage for this Institute
exports.getChatUsage = async (req, res) => {
    try {
        const { institute_id } = req.user;

        const institute = await Institute.findByPk(institute_id, {
            attributes: ["current_limit_chat_messages"]
        });
        const limit = institute ? Number(institute.current_limit_chat_messages) : 500;

        if (limit === -1) {
            return res.status(200).json({ success: true, used: 0, limit: -1, unlimited: true });
        }

        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const tracker = await UsageTracker.findOne({
            where: {
                institute_id,
                metric: "chat_messages",
                billing_period_start: periodStart.toISOString().slice(0, 10)
            }
        });

        const used = tracker ? tracker.current_value : 0;
        return res.status(200).json({
            success: true,
            used,
            limit,
            unlimited: false,
            percent: Math.min(100, Math.round((used / limit) * 100))
        });
    } catch (err) {
        console.error("getChatUsage:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 4. Get Rooms
exports.getRooms = async (req, res) => {
    try {
        const { id: userId, role: userRole, institute_id } = req.user;
        const { type, faculty_id, subject_id, class_id, parent_id } = req.query;

        async function enhanceAndSortRooms(roomsArray) {
            if (!roomsArray.length) return [];

            const roomIds = roomsArray.map(r => r.id);
            const [messageStats, participants] = await Promise.all([
                ChatMessage.findAll({
                    where: { room_id: { [Op.in]: roomIds } },
                    attributes: [
                        "room_id",
                        [fn("COUNT", col("id")), "message_count"],
                        [fn("MAX", col("created_at")), "last_message_at"],
                    ],
                    group: ["room_id"],
                    raw: true,
                }),
                ChatParticipant.findAll({
                    where: { room_id: { [Op.in]: roomIds }, user_id: userId },
                    attributes: ["room_id", "last_read_at"],
                    raw: true,
                }),
            ]);

            const statsByRoom = new Map(messageStats.map(row => [
                Number(row.room_id),
                {
                    message_count: Number(row.message_count || 0),
                    last_message_at: row.last_message_at,
                },
            ]));
            const participantByRoom = new Map(participants.map(p => [Number(p.room_id), p]));

            const unreadFilters = participants
                .filter(p => p.last_read_at)
                .map(p => ({
                    room_id: Number(p.room_id),
                    created_at: { [Op.gt]: p.last_read_at },
                }));

            const unreadRows = unreadFilters.length
                ? await ChatMessage.findAll({
                    where: { [Op.or]: unreadFilters },
                    attributes: ["room_id", [fn("COUNT", col("id")), "unread_count"]],
                    group: ["room_id"],
                    raw: true,
                })
                : [];
            const unreadByRoom = new Map(unreadRows.map(row => [Number(row.room_id), Number(row.unread_count || 0)]));

            const result = roomsArray.map(r => {
                const rData = r.toJSON();
                const stats = statsByRoom.get(Number(r.id)) || { message_count: 0, last_message_at: null };
                const participant = participantByRoom.get(Number(r.id));
                rData.message_count = stats.message_count;
                rData.unread_count = participant?.last_read_at
                    ? (unreadByRoom.get(Number(r.id)) || 0)
                    : stats.message_count;
                rData.last_message_at = stats.last_message_at || r.created_at;
                return rData;
            });

            result.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
            return result;
        }

        const roomInclude = [
            { model: Class, attributes: ["id", "name", "section"] },
            { model: Subject, attributes: ["id", "name"] },
            {
                model: Faculty,
                attributes: ["id", "user_id"],
                include: [{ model: User, attributes: ["id", "name"] }],
                required: false,
            },
            {
                model: ChatParticipant,
                attributes: ["user_id", "role"],
                include: [{ model: User, attributes: ["id", "name"] }],
                required: false,
            }
        ];

        // ── Admin / Manager ── sees all rooms with optional filtering
        if (userRole === "admin" || userRole === "owner" || userRole === "manager") {
            const adminWhere = { institute_id };

            if (type) adminWhere.type = type;
            if (faculty_id) adminWhere.faculty_id = faculty_id;
            if (subject_id) adminWhere.subject_id = subject_id;
            if (class_id) adminWhere.class_id = class_id;

            // Handle parent_id filter (special case: rooms where the parent is a participant)
            if (parent_id) {
                const parentParticipations = await ChatParticipant.findAll({
                    where: { user_id: parent_id },
                    attributes: ['room_id']
                });
                const pRoomIds = parentParticipations.map(p => p.room_id);
                adminWhere.id = { [Op.in]: pRoomIds };
            }

            const rooms = await ChatRoom.findAll({
                where: adminWhere,
                include: roomInclude,
            });
            const enhancedRooms = await enhanceAndSortRooms(rooms);
            return res.status(200).json({ success: true, count: enhancedRooms.length, data: enhancedRooms });
        }

        let roomIds = [];

        // ── Faculty ── sees rooms they created + direct rooms they participate in
        if (userRole === "faculty") {
            const faculty = await Faculty.findOne({ where: { user_id: userId, institute_id } });
            if (faculty) {
                // Rooms created by this faculty
                const createdRooms = await ChatRoom.findAll({ where: { faculty_id: faculty.id, institute_id } });
                createdRooms.forEach(r => roomIds.push(r.id));
            }
        }

        // ── Student ── sees rooms matching their subjects and target gender + direct rooms 
        if (userRole === "student") {
            const student = await Student.findOne({
                where: { user_id: userId, institute_id },
                include: [
                    { model: Subject, through: { attributes: [] }, attributes: ["id"] },
                    { model: Class, through: { attributes: [] }, attributes: ["id"] },
                ],
            });

            if (student) {
                let subIds = student.Subjects?.map(s => s.id) || [];
                const classIds = student.Classes?.map(c => c.id) || [];
                const sGender = student.gender || "none";

                // Phase 4: Full-course students automatically get ALL subjects in their class
                if (student.is_full_course && classIds.length > 0) {
                    const allClassSubjects = await Subject.findAll({
                        where: { class_id: { [Op.in]: classIds } },
                        attributes: ["id"]
                    });
                    const allSubIds = allClassSubjects.map(s => s.id);
                    // Merge with any directly assigned subjects (deduplicate)
                    subIds = [...new Set([...subIds, ...allSubIds])];
                }

                // If still no subjects after merge, fetch all subjects for classes
                if (subIds.length === 0 && classIds.length > 0) {
                    const classSubjects = await Subject.findAll({ where: { class_id: { [Op.in]: classIds } } });
                    subIds = classSubjects.map(s => s.id);
                }

                // Group rooms matching subject AND target gender
                const eligibleRooms = await ChatRoom.findAll({
                    where: {
                        institute_id,
                        type: { [Op.in]: ["group", "subject"] },
                        target_gender: { [Op.in]: ["both", sGender] },
                        [Op.or]: [
                            { subject_id: { [Op.in]: subIds } },
                            { subject_id: null, class_id: { [Op.in]: classIds } }
                        ]
                    }
                });

                eligibleRooms.forEach(r => roomIds.push(r.id));
            }
        }

        // Fetch joined rooms
        const myParticipatedRooms = await ChatRoom.findAll({
            include: [{
                model: ChatParticipant,
                where: { user_id: userId },
                attributes: []
            }],
            attributes: ["id", "type", "subject_id", "class_id"]
        });

        myParticipatedRooms.forEach(r => {
            if (userRole === "student" && r.type !== "direct") {
                // Students only see group rooms if eligible (added above). 
                // Direct chats are explicitly kept.
                return;
            }
            if (userRole === "parent" && r.type !== "direct") {
                return;
            }
            roomIds.push(r.id);
        });

        // Deduplicate
        roomIds = [...new Set(roomIds)];

        if (!roomIds.length) {
            return res.status(200).json({ success: true, count: 0, data: [] });
        }

        // Fetch the full room data
        const rooms = await ChatRoom.findAll({
            where: { id: roomIds, institute_id },
            include: roomInclude,
        });

        const enhancedRooms = await enhanceAndSortRooms(rooms);
        return res.status(200).json({ success: true, count: enhancedRooms.length, data: enhancedRooms });
    } catch (err) {
        console.error("getRooms:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 5. Get Room Messages (with Anonymity)
exports.getRoomMessages = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { id: userId, role: userRole, institute_id } = req.user;

        const room = await ChatRoom.findOne({ where: { id: roomId, institute_id } });
        if (!room) return res.status(404).json({ success: false, message: "Room not found" });

        // Auto-join non-admins
        if (userRole !== "admin" && userRole !== "owner") {
            await ensureParticipant(roomId, userId, userRole);
        }

        const participantToUpdate = await ChatParticipant.findOne({ where: { room_id: roomId, user_id: userId } });
        if (participantToUpdate) {
            participantToUpdate.last_read_at = new Date();
            await participantToUpdate.save();
        }

        let messages = await ChatMessage.findAll({
            where: { room_id: roomId },
            include: [{
                model: User,
                as: "sender",
                attributes: ["id", "name", "role"],
                include: [{ model: Student, attributes: ["gender"] }]
            }],
            order: [["created_at", "ASC"]],
        });

        // Apply Phase 4 logic: Anonymize student names if it's a "group" chat
        if ((room.type === "group" || room.type === "subject") && userRole === "student") {
            messages = messages.map(msg => {
                const plainMsg = msg.get({ plain: true });
                if (plainMsg.sender && plainMsg.sender.role === "student") {
                    plainMsg.sender.name = "";
                    plainMsg.sender.is_hidden_student = true;
                }
                return plainMsg;
            });
        } else {
            // Phase 8: Enrich parent sender names with "Parent of [Child]" for faculty/admin viewing
            const { User: UserModel, Student } = require("../models");
            const plainMessages = await Promise.all(messages.map(async (msg) => {
                const plainMsg = msg.get({ plain: true });
                if (plainMsg.sender && plainMsg.sender.role === "parent") {
                    const parentUser = await UserModel.findOne({
                        where: { id: plainMsg.sender.id, institute_id },
                        include: [{
                            model: Student,
                            as: "LinkedStudents",
                            include: [{ model: User, attributes: ["name"] }]
                        }]
                    });
                    if (parentUser && parentUser.LinkedStudents && parentUser.LinkedStudents.length > 0) {
                        const childName = parentUser.LinkedStudents[0]?.User?.name || "Child";
                        plainMsg.sender.display_name = `${plainMsg.sender.name} (Parent of ${childName})`;
                    }
                }
                return plainMsg;
            }));
            return res.status(200).json({ success: true, count: plainMessages.length, data: plainMessages });
        }

        return res.status(200).json({ success: true, count: messages.length, data: messages });
    } catch (err) {
        console.error("getRoomMessages:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 6. Get or Create Direct Room (Phase 3: Student starting direct chat)
exports.getOrCreateRoom = async (req, res) => {
    try {
        const { type, subject_id, class_id, faculty_user_id } = req.body;
        const { id: userId, role: userRole, institute_id } = req.user;

        // Ensure this endpoint creates Direct chats
        let room;
        if (type === "direct" && (userRole === "student" || userRole === "parent")) {
            let fid = faculty_user_id;
            if (!fid && subject_id) {
                const subject = await Subject.findOne({ where: { id: subject_id }, include: [{ model: Faculty }] });
                if (subject && subject.Faculty) {
                    fid = subject.Faculty.user_id;
                }
            }
            room = await getOrCreateDirectRoom(institute_id, userId, fid, subject_id, class_id);
        } else {
            // General fallback
            let whereClause = { institute_id, type: type || "subject" };
            if (subject_id) whereClause.subject_id = subject_id;

            room = await ChatRoom.findOne({ where: whereClause });
            if (!room) {
                room = await ChatRoom.create({
                    institute_id, type: type || "subject", subject_id, class_id, target_gender: "both"
                });
            }
            await ensureParticipant(room.id, userId, userRole);
        }

        return res.status(200).json({ success: true, room });
    } catch (err) {
        console.error("getOrCreateRoom:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 7. Get Room Participants (with Anonymity)
exports.getRoomParticipants = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { institute_id, role: userRole } = req.user;

        const room = await ChatRoom.findOne({ where: { id: roomId, institute_id } });
        if (!room) return res.status(404).json({ success: false, message: "Room not found" });

        let participants = await ChatParticipant.findAll({
            where: { room_id: roomId },
            include: [{
                model: User,
                attributes: ["id", "name", "role"],
                include: [{ model: Student, attributes: ["gender"] }]
            }],
        });

        // Apply anonymity same as messages
        if ((room.type === "group" || room.type === "subject") && userRole === "student") {
            participants = participants.map(p => {
                const plainP = p.get({ plain: true });
                if (plainP.User && plainP.User.role === "student") {
                    const g = plainP.User.Student?.gender;
                    if (g === "female") plainP.User.name = "Female Student";
                    else if (g === "male") plainP.User.name = "Male Student";
                    else plainP.User.name = "Student";
                }
                return plainP;
            });
        }

        return res.status(200).json({ success: true, data: participants });
    } catch (err) {
        console.error("getRoomParticipants:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 8. Get Total Unread Chat Count
exports.getUnreadChatCount = async (req, res) => {
    try {
        const { id: userId } = req.user;
        let totalUnread = 0;

        const participations = await ChatParticipant.findAll({
            where: { user_id: userId },
            attributes: ['room_id', 'last_read_at']
        });

        for (const p of participations) {
            const count = await ChatMessage.count({
                where: {
                    room_id: p.room_id,
                    created_at: { [Op.gt]: p.last_read_at || new Date(0) }
                }
            });
            totalUnread += count;
        }

        return res.status(200).json({ success: true, count: totalUnread });
    } catch (err) {
        console.error('getUnreadChatCount:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { id: userId, institute_id } = req.user;

        const room = await ChatRoom.findOne({ where: { id: roomId, institute_id } });
        if (!room) return res.status(404).json({ success: false, message: "Room not found" });

        const [participant] = await ChatParticipant.findOrCreate({
            where: { room_id: roomId, user_id: userId },
            defaults: { role: req.user.role }
        });

        participant.last_read_at = new Date();
        await participant.save();

        return res.status(200).json({ success: true, message: "Room marked as read" });
    } catch (err) {
        console.error("markAsRead:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};
