/**
 * Announcement Service — Smart Announcement System (Phase 2)
 * All business logic for announcements: filtering by role, read/unread tracking, bell icon data.
 */
const { Announcement, AnnouncementRead, User, Student, StudentSubject, Subject, Faculty, StudentParent } = require("../models");
const { Op } = require("sequelize");

// ─── FUNCTION 1: getAnnouncementsForUser ─────────────────────────────────────
// Returns announcements visible to a user (role-filtered) with their read status.
// Used by: Student, Faculty (institute view), Parent
async function getAnnouncementsForUser(userId, role, instituteId, classId = null) {
    const now = new Date();

    const whereClause = {
        institute_id: instituteId,
        [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: now } }],
    };

    // Role-based target_audience filter
    if (role === "student") {
        whereClause.target_audience = { [Op.in]: ["all", "students"] };
        // If student is in a specific class, also include class-specific announcements
        if (classId) {
            whereClause[Op.or] = [
                { target_audience: { [Op.in]: ["all", "students"] }, target_class: null },
                { target_class: classId },
            ];
        }
    } else if (role === "faculty") {
        whereClause.target_audience = { [Op.in]: ["all", "faculty"] };
    } else if (role === "parent") {
        whereClause.target_audience = { [Op.in]: ["all", "parents"] };
    }
    // admin/manager: no filter — sees all institute announcements

    const announcements = await Announcement.findAll({
        where: whereClause,
        order: [
            ["is_pinned", "DESC"],
            ["created_at", "DESC"],
        ],
        include: [
            {
                model: AnnouncementRead,
                where: { user_id: userId },
                required: false, // LEFT JOIN — include even if not read
                attributes: ["read_at"],
            },
            {
                model: User,
                as: "creator",
                attributes: ["id", "name", "role"],
            }
        ],
    });

    let mappedAnnouncements = announcements.map((a) => ({
        ...a.toJSON(),
        is_read: a.AnnouncementReads && a.AnnouncementReads.length > 0,
        read_at: a.AnnouncementReads?.[0]?.read_at || null,
    }));

    // --- Phase 3 & 4: Filter Faculty Announcements by Subjects ---
    if (role === "student" || role === "parent") {
        let studentIds = [];
        if (role === "student") {
            const student = await Student.findOne({ where: { user_id: userId } });
            if (student) studentIds.push(student.id);
        } else if (role === "parent") {
            const linkedStudents = await StudentParent.findAll({ where: { parent_id: userId } });
            studentIds = linkedStudents.map(sp => sp.student_id);
        }

        if (studentIds.length > 0) {
            // Get all subjects these students are enrolled in
            const studentSubjects = await StudentSubject.findAll({
                where: { student_id: { [Op.in]: studentIds } }
            });
            const subjectIds = studentSubjects.map(ss => ss.subject_id);

            // Get faculties teaching these subjects
            const subjects = await Subject.findAll({
                where: { id: { [Op.in]: subjectIds } },
                include: [{ model: Faculty, attributes: ['user_id'] }]
            });
            const validFacultyUserIds = subjects.map(s => s.Faculty?.user_id).filter(Boolean);

            mappedAnnouncements = mappedAnnouncements.filter(ann => {
                // If the creator is not faculty (e.g., admin), everyone sees it
                if (ann.creator?.role !== "faculty") return true;
                // If it is from a faculty, the student/parent only sees it if they are taught by them
                return validFacultyUserIds.includes(ann.created_by);
            });
        } else {
            // If student/parent not found or no students linked, only show non-faculty announcements
            mappedAnnouncements = mappedAnnouncements.filter(ann => ann.creator?.role !== "faculty");
        }
    }

    return mappedAnnouncements;
}

// ─── FUNCTION 2: getUnreadCount ───────────────────────────────────────────────
// Returns { count, highest_priority } for the bell icon.
// highest_priority: 'urgent' | 'high' | 'normal' | null
// This drives the bell color on every dashboard.
async function getUnreadCount(userId, role, instituteId) {
    const announcements = await getAnnouncementsForUser(userId, role, instituteId);
    const unread = announcements.filter((a) => !a.is_read);
    const priorities = unread.map((a) => a.priority);

    let highest = null;
    if (priorities.includes("urgent")) highest = "urgent";
    else if (priorities.includes("high")) highest = "high";
    else if (priorities.length > 0) highest = "normal";

    return { count: unread.length, highest_priority: highest };
}

// ─── FUNCTION 3: markAsRead ───────────────────────────────────────────────────
// Safely marks one announcement as read for a user (upsert with unique constraint).
async function markAsRead(announcementId, userId) {
    await AnnouncementRead.findOrCreate({
        where: { announcement_id: announcementId, user_id: userId },
        defaults: { read_at: new Date() },
    });
}

// ─── FUNCTION 4: markAllAsRead ────────────────────────────────────────────────
// Marks all unread announcements as read for a user — single bulk DB call.
async function markAllAsRead(userId, role, instituteId) {
    const announcements = await getAnnouncementsForUser(userId, role, instituteId);
    const unreadIds = announcements.filter((a) => !a.is_read).map((a) => a.id);
    if (!unreadIds.length) return 0;

    const records = unreadIds.map((id) => ({ announcement_id: id, user_id: userId }));
    await AnnouncementRead.bulkCreate(records, { ignoreDuplicates: true });
    return unreadIds.length;
}

module.exports = {
    getAnnouncementsForUser,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
};
