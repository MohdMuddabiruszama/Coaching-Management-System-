/**
 * Mobile Dashboard Controller
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 2C: Bundled dashboard APIs — ONE call per dashboard load.
 *
 * Instead of the mobile app firing 5–8 separate API requests to render a
 * dashboard, each endpoint below returns everything needed in a single
 * server-side join query. React Query then caches the result for 5 minutes.
 *
 * Endpoints:
 *   GET /api/mobile/student/dashboard
 *   GET /api/mobile/faculty/dashboard
 *   GET /api/mobile/parent/dashboard
 *   POST /api/mobile/fcm-token        (Phase 5A — register FCM push token)
 *   DELETE /api/mobile/fcm-token      (Phase 5A — remove FCM token on logout)
 */

const { Op, fn, col, literal } = require("sequelize");
const {
    sequelize,
    User,
    Student,
    Faculty,
    Class,
    Subject,
    Attendance,
    Exam,
    Mark,
    Announcement,
    AnnouncementRead,
    StudentFee,
    Timetable,
    TimetableSlot,
    Assignment,
    AssignmentSubmission,
    StudentParent,
    FeesStructure,
} = require("../models");
const { getStudentScore } = require("../services/performance.service");

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Current month date range */
const thisMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
};

/** Today's date range */
const today = () => {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end };
};

/** Day of week string for timetable (Monday, Tuesday…) */
const dayName = () => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[new Date().getDay()];
};


// ─────────────────────────────────────────────────────────────────────────────
// STUDENT DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/mobile/student/dashboard
 *
 * Returns in ONE response:
 *  - attendance percentage (current month)
 *  - last 5 exam marks
 *  - next 3 upcoming exams
 *  - latest 5 announcements (unread count)
 *  - fee status (pending fees count + total due)
 *  - today's timetable
 *  - pending assignments count
 */
exports.getStudentDashboard = async (req, res) => {
    try {
        const user         = req.user;
        const instituteId  = user.institute_id;

        // Resolve student record
        const studentRecord = await Student.findOne({
            where: { user_id: user.id, institute_id: instituteId },
            attributes: ["id", "class_id"],
        });

        if (!studentRecord) {
            return res.status(404).json({ success: false, message: "Student profile not found." });
        }

        const studentId = studentRecord.id;
        const classId   = studentRecord.class_id;
        const { start: monthStart, end: monthEnd } = thisMonth();
        const todayDay = dayName();

        // Run all queries in parallel
        const [
            attendanceSummary,
            recentMarks,
            upcomingExams,
            announcements,
            pendingFees,
            todayTimetable,
            pendingAssignmentsCount,
            totalAssignments,
            studentScore,
            totalSubjects,
            unreadChatRecords,
        ] = await Promise.all([
            // 1. Attendance this month
            Attendance.findAll({
                where: {
                    student_id:   studentId,
                    institute_id: instituteId,
                    date:         { [Op.between]: [monthStart, monthEnd] },
                },
                attributes: ["status"],
                raw: true,
            }),

            // 2. Last 5 marks (with exam + subject name)
            sequelize.query(`
                SELECT m.id, m.marks_obtained, e.total_marks, m.is_absent,
                       e.name AS exam_name, e.exam_date,
                       s.name AS subject_name
                FROM   marks m
                JOIN   exams e    ON e.id = m.exam_id
                JOIN   subjects s ON s.id = m.subject_id
                WHERE  m.student_id   = :studentId
                  AND  m.institute_id = :instituteId
                  AND  e.marks_locked = true
                ORDER  BY e.exam_date DESC
                LIMIT  5
            `, {
                replacements: { studentId, instituteId },
                type: sequelize.QueryTypes.SELECT,
            }),

            // 3. Upcoming exams (next 7 days)
            Exam.findAll({
                where: {
                    class_id:     classId,
                    institute_id: instituteId,
                    exam_date:    { [Op.gte]: new Date() },
                },
                include: [{ model: Subject, attributes: ["name"] }],
                order:  [["exam_date", "ASC"]],
                limit:  3,
                attributes: ["id", "name", "exam_date", "total_marks"],
            }),

            // 4. Latest 5 announcements + unread count
            Announcement.findAll({
                where: {
                    institute_id: instituteId,
                    [Op.or]: [
                        { target_audience: "all" },
                        { target_audience: "student" },
                        { target_audience: "students" }
                    ],
                },
                include: [{
                    model:    AnnouncementRead,
                    where:    { user_id: user.id },
                    required: false,
                    attributes: ["id"],
                }],
                order:  [["created_at", "DESC"]],
                limit:  5,
                attributes: ["id", "title", "content", "created_at", "priority"],
            }),

            // 5. Pending fees
            StudentFee.findAll({
                where: {
                    student_id:   studentId,
                    institute_id: instituteId,
                    status:       { [Op.in]: ["pending", "partial"] },
                },
                include: [{ model: FeesStructure, attributes: ["fee_type", "due_date"] }],
                attributes: ["id", "final_amount", "paid_amount"],
            }),

            // 6. Today's timetable for class
            Timetable.findAll({
                where: {
                    class_id:     classId,
                    institute_id: instituteId,
                    day_of_week:  todayDay,
                },
                include: [
                    { model: Subject, attributes: ["name"] },
                    { model: TimetableSlot, attributes: ["start_time", "end_time"] },
                ],
                order: [[TimetableSlot, "start_time", "ASC"]],
            }),

            // 7. Pending assignments count
            Assignment.count({
                where: {
                    class_id:     classId,
                    institute_id: instituteId,
                    due_date:     { [Op.gte]: new Date() },
                },
                include: [{
                    model:    AssignmentSubmission,
                    where:    { student_id: studentId },
                    required: false,
                }],
            }),
            
            // 8. Total assignments count
            Assignment.count({
                where: {
                    class_id:     classId,
                    institute_id: instituteId,
                }
            }),

            // 9. Performance Score
            getStudentScore(studentId, instituteId).catch(() => null),

            // 10. Total Enrolled Courses (Subjects)
            Subject.count({
                where: {
                    class_id:     classId,
                    institute_id: instituteId,
                }
            }),

            // 11. Unread chat messages
            sequelize.query(`
                SELECT COUNT(m.id) AS unread
                FROM chat_messages m
                JOIN chat_participants p ON p.room_id = m.room_id
                WHERE p.user_id = :userId
                  AND m.created_at > p.last_read_at
                  AND m.sender_id != :userId
            `, {
                replacements: { userId: user.id },
                type: sequelize.QueryTypes.SELECT,
            }),
        ]);

        // Calculate attendance percentage
        const totalAtt   = attendanceSummary.length;
        const presentAtt = attendanceSummary.filter(a => a.status === "present").length;
        const attendancePct = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : null;

        // Calculate unread announcements
        const unreadAnnouncements = announcements.filter(
            a => !a.AnnouncementReads || a.AnnouncementReads.length === 0
        ).length;

        // Calculate total fee due
        const totalFeeDue = pendingFees.reduce((sum, f) => {
            const due = parseFloat(f.final_amount || 0) - parseFloat(f.paid_amount || 0);
            return sum + Math.max(0, due);
        }, 0);

        return res.json({
            success: true,
            data: {
                attendance: {
                    percentage:  attendancePct,
                    present:     presentAtt,
                    total:       totalAtt,
                    month:       new Date().toLocaleString("default", { month: "long" }),
                },
                recentMarks: recentMarks.map(m => ({
                    examName:     m.exam_name,
                    subjectName:  m.subject_name,
                    marksObtained: m.marks_obtained,
                    totalMarks:   m.total_marks,
                    isAbsent:     m.is_absent,
                    examDate:     m.exam_date,
                    percentage:   m.total_marks > 0
                        ? Math.round((m.marks_obtained / m.total_marks) * 100)
                        : null,
                })),
                upcomingExams: upcomingExams.map(e => ({
                    id:         e.id,
                    name:       e.name,
                    subject:    e.Subject?.name,
                    examDate:   e.exam_date,
                    totalMarks: e.total_marks,
                })),
                announcements: announcements.map(a => ({
                    id:       a.id,
                    title:    a.title,
                    message:  a.content,
                    priority: a.priority,
                    isRead:   a.AnnouncementReads?.length > 0,
                    date:     a.createdAt || a.created_at,
                })),
                unreadAnnouncementsCount: unreadAnnouncements,
                fees: {
                    hasPendingFees: pendingFees.length > 0,
                    pendingCount:   pendingFees.length,
                    totalDue:       totalFeeDue,
                    nextDueDate:    pendingFees.length > 0
                        ? pendingFees.sort((a, b) => new Date(a.FeesStructure?.due_date) - new Date(b.FeesStructure?.due_date))[0]?.FeesStructure?.due_date
                        : null,
                },
                todaySchedule: todayTimetable.map(t => ({
                    id:        t.id,
                    subject:   t.Subject?.name,
                    startTime: t.TimetableSlot?.start_time,
                    endTime:   t.TimetableSlot?.end_time,
                    isBreak:   t.is_break,
                    breakLabel: t.break_label,
                    room:      t.room_number,
                })),
                pendingAssignments: pendingAssignmentsCount,
                totalAssignments,
                score: studentScore || null,
                totalSubjects,
                unreadChatCount: unreadChatRecords?.[0]?.unread || 0,
            },
        });

    } catch (err) {
        console.error("[Mobile] Student dashboard error:", err);
        return res.status(500).json({ success: false, message: err.message, stack: err.stack });
    }
};


// ─────────────────────────────────────────────────────────────────────────────
// FACULTY DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/mobile/faculty/dashboard
 *
 * Returns in ONE response:
 *  - today's schedule
 *  - total students assigned to faculty's subjects
 *  - attendance stats for today (classes marked vs not yet marked)
 *  - pending marks entries (exams not yet locked)
 *  - latest 5 announcements for faculty
 *  - unread chat count
 */
exports.getFacultyDashboard = async (req, res) => {
    try {
        const user        = req.user;
        const instituteId = user.institute_id;
        const todayDay    = dayName();
        const { start: todayStart, end: todayEnd } = today();

        // Resolve faculty record
        const facultyRecord = await Faculty.findOne({
            where: { user_id: user.id, institute_id: instituteId },
            attributes: ["id"],
        });

        if (!facultyRecord) {
            return res.status(404).json({ success: false, message: "Faculty profile not found." });
        }

        const facultyId = facultyRecord.id;

        // Subjects taught by this faculty
        const mySubjects = await Subject.findAll({
            where: { faculty_id: facultyId, institute_id: instituteId },
            attributes: ["id", "name", "class_id"],
            include: [{ model: Class, attributes: ["name"] }],
        });

        const subjectIds = mySubjects.map(s => s.id);
        const classIds   = [...new Set(mySubjects.map(s => s.class_id).filter(Boolean))];

        const [
            todaySchedule,
            pendingExams,
            announcements,
            attendanceToday,
            totalStudents,
        ] = await Promise.all([
            // 1. Today's timetable for faculty's classes
            Timetable.findAll({
                where: {
                    faculty_id:   facultyId,
                    institute_id: instituteId,
                    day_of_week:  todayDay,
                },
                include: [
                    { model: Subject, attributes: ["name"] },
                    { model: Class,   attributes: ["name"] },
                    { model: TimetableSlot, attributes: ["start_time", "end_time"] },
                ],
                order: [[TimetableSlot, "start_time", "ASC"]],
            }),

            // 2. Exams with pending marks (not locked, past due)
            subjectIds.length > 0
                ? Exam.findAll({
                    where: {
                        subject_id:   { [Op.in]: subjectIds },
                        institute_id: instituteId,
                        marks_locked: false,
                        exam_date:    { [Op.lte]: new Date() },
                    },
                    include: [
                        { model: Subject, attributes: ["name"] },
                        { model: Class,   attributes: ["name"] },
                    ],
                    order: [["exam_date", "DESC"]],
                    limit: 5,
                })
                : Promise.resolve([]),

            // 3. Latest announcements for faculty/all
            Announcement.findAll({
                where: {
                    institute_id: instituteId,
                    [Op.or]: [
                        { target_audience: "all" },
                        { target_audience: "faculty" },
                    ],
                },
                order:  [["created_at", "DESC"]],
                limit:  5,
                attributes: ["id", "title", "content", "created_at", "priority"],
            }),

            // 4. Today's attendance records marked by this faculty
            subjectIds.length > 0
                ? Attendance.count({
                    where: {
                        subject_id:  { [Op.in]: subjectIds },
                        institute_id: instituteId,
                        date:        { [Op.between]: [todayStart, todayEnd] },
                    },
                })
                : Promise.resolve(0),

            // 5. Total distinct students in faculty's classes
            classIds.length > 0
                ? sequelize.query(`
                    SELECT COUNT(DISTINCT sc.student_id) AS total
                    FROM   student_classes sc
                    JOIN   students st ON st.id = sc.student_id AND st.institute_id = :instituteId
                    WHERE  sc.class_id IN (:classIds)
                `, {
                    replacements: { instituteId, classIds: classIds.length ? classIds : [0] },
                    type: sequelize.QueryTypes.SELECT,
                })
                : Promise.resolve([{ total: 0 }]),
        ]);

        return res.json({
            success: true,
            data: {
                todaySchedule: todaySchedule.map(t => ({
                    id:        t.id,
                    subject:   t.Subject?.name,
                    class:     t.Class?.name,
                    startTime: t.TimetableSlot?.start_time,
                    endTime:   t.TimetableSlot?.end_time,
                    isBreak:   t.is_break,
                })),
                mySubjects: mySubjects.map(s => ({
                    id:        s.id,
                    name:      s.name,
                    className: s.Class?.name,
                })),
                pendingMarks: pendingExams.map(e => ({
                    id:      e.id,
                    name:    e.name,
                    subject: e.Subject?.name,
                    class:   e.Class?.name,
                    date:    e.exam_date,
                })),
                announcements: announcements.map(a => ({
                    id:       a.id,
                    title:    a.title,
                    message:  a.content,
                    priority: a.priority,
                    date:     a.created_at,
                })),
                stats: {
                    totalStudents:      parseInt(totalStudents[0]?.total || 0),
                    attendanceToday:    attendanceToday,
                    totalSubjects:      mySubjects.length,
                    pendingMarksCount:  pendingExams.length,
                    classesToday:       todaySchedule.filter(t => !t.is_break).length,
                },
            },
        });

    } catch (err) {
        console.error("[Mobile] Faculty dashboard error:", err);
        return res.status(500).json({ success: false, message: "Failed to load dashboard." });
    }
};


// ─────────────────────────────────────────────────────────────────────────────
// PARENT DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/mobile/parent/dashboard
 *
 * Returns for each linked child:
 *  - attendance percentage this month
 *  - last 5 marks
 *  - pending fee status
 *  - today's timetable
 *  - latest 3 announcements
 */
exports.getParentDashboard = async (req, res) => {
    try {
        const user        = req.user;
        const instituteId = user.institute_id;

        // Get all linked students for this parent
        const linkedStudents = await User.findOne({
            where: { id: user.id },
            include: [{
                model:      Student,
                as:         "LinkedStudents",
                through:    { attributes: [] },
                attributes: ["id", "class_id"],
                include:    [{
                    model:      User,
                    attributes: ["name", "email"],
                }, {
                    model:      Class,
                    attributes: ["name"],
                }],
            }],
        });

        const children = linkedStudents?.LinkedStudents || [];

        if (children.length === 0) {
            return res.json({
                success: true,
                data:    { children: [], announcements: [] },
            });
        }

        const { start: monthStart, end: monthEnd } = thisMonth();
        const todayDay = dayName();

        // Build dashboard for each child
        const childrenData = await Promise.all(
            children.map(async (child) => {
                const studentId = child.id;
                const classId   = child.class_id;

                const [attendance, recentMarks, pendingFees, todaySchedule] = await Promise.all([
                    // Attendance this month
                    Attendance.findAll({
                        where: {
                            student_id:   studentId,
                            institute_id: instituteId,
                            date:         { [Op.between]: [monthStart, monthEnd] },
                        },
                        attributes: ["status"],
                        raw: true,
                    }),

                    // Last 5 marks
                    sequelize.query(`
                        SELECT m.marks_obtained, e.total_marks, m.is_absent,
                               e.name AS exam_name, s.name AS subject_name
                        FROM   marks m
                        JOIN   exams    e ON e.id = m.exam_id AND e.marks_locked = true
                        JOIN   subjects s ON s.id = m.subject_id
                        WHERE  m.student_id   = :studentId
                          AND  m.institute_id = :instituteId
                        ORDER  BY e.exam_date DESC
                        LIMIT  5
                    `, {
                        replacements: { studentId, instituteId },
                        type: sequelize.QueryTypes.SELECT,
                    }),

                    // Pending fees
                    StudentFee.findAll({
                        where: {
                            student_id:   studentId,
                            institute_id: instituteId,
                            status:       { [Op.in]: ["pending", "partial"] },
                        },
                        include: [{ model: FeesStructure, attributes: ["fee_type", "due_date"] }],
                        attributes: ["id", "final_amount", "paid_amount"],
                    }),

                    // Today's timetable
                    classId
                        ? Timetable.findAll({
                            where: {
                                class_id:     classId,
                                institute_id: instituteId,
                                day_of_week:  todayDay,
                            },
                            include: [
                                { model: Subject,       attributes: ["name"] },
                                { model: TimetableSlot, attributes: ["start_time", "end_time"] },
                            ],
                            order: [[TimetableSlot, "start_time", "ASC"]],
                        })
                        : Promise.resolve([]),
                ]);

                const totalAtt   = attendance.length;
                const presentAtt = attendance.filter(a => a.status === "present").length;
                const totalDue   = pendingFees.reduce((sum, f) =>
                    sum + Math.max(0, parseFloat(f.final_amount || 0) - parseFloat(f.paid_amount || 0)), 0);

                return {
                    studentId,
                    name:      child.User?.name || "Student",
                    className: child.Class?.name,
                    attendance: {
                        percentage: totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : null,
                        present:    presentAtt,
                        total:      totalAtt,
                    },
                    recentMarks: recentMarks.map(m => ({
                        examName:     m.exam_name,
                        subjectName:  m.subject_name,
                        marksObtained: m.marks_obtained,
                        totalMarks:   m.total_marks,
                        percentage:   m.total_marks > 0
                            ? Math.round((m.marks_obtained / m.total_marks) * 100)
                            : null,
                    })),
                    fees: {
                        hasPendingFees: pendingFees.length > 0,
                        pendingCount:   pendingFees.length,
                        totalDue,
                    },
                    todaySchedule: todaySchedule.map(t => ({
                        subject:   t.Subject?.name,
                        startTime: t.TimetableSlot?.start_time,
                        endTime:   t.TimetableSlot?.end_time,
                        isBreak:   t.is_break,
                    })),
                };
            })
        );

        // Announcements for all parents
        const announcements = await Announcement.findAll({
            where: {
                institute_id: instituteId,
                [Op.or]: [
                    { target_role: "all" },
                    { target_role: "parent" },
                ],
            },
            order:  [["created_at", "DESC"]],
            limit:  5,
            attributes: ["id", "title", "content", "created_at", "priority"],
        });

        return res.json({
            success: true,
            data: {
                children:      childrenData,
                announcements: announcements.map(a => ({
                    id:       a.id,
                    title:    a.title,
                    message:  a.content,
                    priority: a.priority,
                    date:     a.created_at,
                })),
            },
        });

    } catch (err) {
        console.error("[Mobile] Parent dashboard error:", err);
        return res.status(500).json({ success: false, message: "Failed to load dashboard." });
    }
};


// ─────────────────────────────────────────────────────────────────────────────
// PHASE 5A — FCM PUSH TOKEN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/mobile/fcm-token
 * Body: { token: "FCM_TOKEN_STRING", platform: "android"|"ios" }
 */
exports.registerFcmToken = async (req, res) => {
    try {
        const { token, platform } = req.body;
        if (!token) {
            return res.status(400).json({ success: false, message: "FCM token is required." });
        }

        await User.update(
            { fcm_token: token, fcm_platform: platform || "android" },
            { where: { id: req.user.id } }
        );

        return res.json({ success: true, message: "FCM token registered." });
    } catch (err) {
        console.error("[Mobile] FCM register error:", err);
        return res.status(500).json({ success: false, message: "Failed to register FCM token." });
    }
};

/**
 * DELETE /api/mobile/fcm-token
 */
exports.removeFcmToken = async (req, res) => {
    try {
        await User.update(
            { fcm_token: null },
            { where: { id: req.user.id } }
        );
        return res.json({ success: true, message: "FCM token removed." });
    } catch (err) {
        console.error("[Mobile] FCM remove error:", err);
        return res.status(500).json({ success: false, message: "Failed to remove FCM token." });
    }
};
