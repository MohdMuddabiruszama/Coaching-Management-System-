/**
 * Performance Controller — Phase 2 (Approach B)
 * Provides role-specific performance views for all 5 roles.
 * All auth via existing verifyToken + allowRoles middleware.
 */

const {
    getStudentScore,
    getSubjectBreakdown,
    getStudentTrend,
    getClassScores,
    getInstituteOverview,
} = require('../services/performance.service');
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// ── Helpers ────────────────────────────────────────────────────────────────

/** Get student record from a user id */
async function getStudentByUserId(userId, instituteId) {
    const rows = await sequelize.query(
        `SELECT id FROM students WHERE user_id = :uid AND institute_id = :iid LIMIT 1`,
        { replacements: { uid: userId, iid: instituteId }, type: QueryTypes.SELECT }
    );
    return rows[0] || null;
}

/** Get faculty's assigned class ids */
async function getFacultyClassIds(userId, instituteId) {
    const rows = await sequelize.query(`
        SELECT DISTINCT class_id FROM subjects
        WHERE faculty_id = (SELECT id FROM faculty WHERE user_id = :uid AND institute_id = :iid LIMIT 1)
          AND institute_id = :iid
    `, { replacements: { uid: userId, iid: instituteId }, type: QueryTypes.SELECT });
    return rows.map(r => r.class_id);
}

// ── Endpoint Handlers ──────────────────────────────────────────────────────

/**
 * GET /api/performance/me
 * Student sees own score + subject breakdown
 */
const getMyPerformance = async (req, res) => {
    try {
        const { id: userId, institute_id: instituteId } = req.user;

        const student = await getStudentByUserId(userId, instituteId);
        if (!student) return sendError(res, 'Student record not found', 404);

        const [score, subjects] = await Promise.all([
            getStudentScore(student.id, instituteId),
            getSubjectBreakdown(student.id, instituteId),
        ]);

        const weakSubjects = subjects.filter(s => s.below_passing);

        sendSuccess(res, { score, subjects, weak_subjects: weakSubjects }, 'Performance data retrieved');
    } catch (err) {
        console.error('Performance me error:', err);
        sendError(res, 'Failed to fetch performance data', 500);
    }
};

/**
 * GET /api/performance/me/trend
 * Student sees own 6-month trend
 */
const getMyTrend = async (req, res) => {
    try {
        const { id: userId, institute_id: instituteId } = req.user;

        const student = await getStudentByUserId(userId, instituteId);
        if (!student) return sendError(res, 'Student record not found', 404);

        const trend = await getStudentTrend(student.id, instituteId);
        sendSuccess(res, { trend }, 'Trend data retrieved');
    } catch (err) {
        console.error('Performance trend error:', err);
        sendError(res, 'Failed to fetch trend data', 500);
    }
};

/**
 * GET /api/performance/class/:classId
 * Faculty sees class performance ranked table
 */
const getClassPerformance = async (req, res) => {
    try {
        const { institute_id: instituteId, id: userId, role } = req.user;
        const classId = parseInt(req.params.classId);
        const subjectId = req.query.subjectId ? parseInt(req.query.subjectId) : null;

        if (!classId) return sendError(res, 'classId is required', 400);

        // Faculty: verify they teach in this class
        if (role === 'faculty') {
            const classIds = await getFacultyClassIds(userId, instituteId);
            if (!classIds.includes(classId)) {
                return sendError(res, 'Access denied: you do not teach in this class', 403);
            }
        }

        const facultyFilterId = role === 'faculty' ? userId : null;
        const scores = await getClassScores(classId, instituteId, facultyFilterId, subjectId);

        // Stats
        const avgScore  = scores.length > 0 ? Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length) : 0;
        const passRate  = scores.length > 0 ? Math.round((scores.filter(r => r.score >= 50).length / scores.length) * 100) : 0;
        const highest   = scores.length > 0 ? scores[0].score : 0;
        const atRisk    = scores.filter(r => r.status === 'at_risk');

        // Grade distribution
        const gradeDist = { 'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };
        scores.forEach(s => { if (gradeDist[s.grade] !== undefined) gradeDist[s.grade]++; });

        sendSuccess(res, {
            students:    scores,
            at_risk:     atRisk,
            stats: { avg_score: avgScore, pass_rate: passRate, highest, at_risk_count: atRisk.length, total: scores.length },
            grade_distribution: gradeDist,
        }, 'Class performance retrieved');
    } catch (err) {
        console.error('Class performance error:', err);
        sendError(res, 'Failed to fetch class performance', 500);
    }
};

/**
 * GET /api/performance/student/:id
 * Parent sees their linked child's performance (with auth check)
 */
const getChildPerformance = async (req, res) => {
    try {
        const { id: parentUserId, institute_id: instituteId } = req.user;
        const studentId = parseInt(req.params.id);

        if (!studentId) return sendError(res, 'studentId is required', 400);

        // Verify parent-child relationship
        const link = await sequelize.query(
            `SELECT 1 FROM student_parents WHERE parent_id = :pid AND student_id = :sid LIMIT 1`,
            { replacements: { pid: parentUserId, sid: studentId }, type: QueryTypes.SELECT }
        );
        if (!link.length) return sendError(res, 'Access denied: student not linked to your account', 403);

        const [score, subjects, trend] = await Promise.all([
            getStudentScore(studentId, instituteId),
            getSubjectBreakdown(studentId, instituteId),
            getStudentTrend(studentId, instituteId),
        ]);

        const weakSubjects = subjects.filter(s => s.below_passing);
        const concerns = [];
        if (score.att_pct < 75)  concerns.push({ type: 'attendance', message: `Attendance below 75% (${score.att_pct}%)` });
        weakSubjects.forEach(s => concerns.push({ type: 'subject', message: `Below passing in ${s.subject_name} (${s.avg_pct}%)` }));

        sendSuccess(res, { score, subjects, weak_subjects: weakSubjects, trend, concerns }, 'Child performance retrieved');
    } catch (err) {
        console.error('Child performance error:', err);
        sendError(res, 'Failed to fetch child performance', 500);
    }
};

/**
 * GET /api/performance/institute
 * Admin/Manager sees institute-wide overview
 */
const getInstitutePerformance = async (req, res) => {
    try {
        const { institute_id: instituteId } = req.user;
        const overview = await getInstituteOverview(instituteId);
        sendSuccess(res, overview, 'Institute performance overview retrieved');
    } catch (err) {
        console.error('Institute performance error:', err);
        sendError(res, 'Failed to fetch institute performance', 500);
    }
};

/**
 * GET /api/performance/at-risk
 * Admin/Faculty sees at-risk student list (optionally filtered by classId)
 */
const getAtRiskStudents = async (req, res) => {
    try {
        const { institute_id: instituteId, id: userId, role } = req.user;
        const { classId } = req.query;

        let classIds = [];

        if (classId) {
            classIds = [parseInt(classId)];
        } else if (role === 'faculty') {
            classIds = await getFacultyClassIds(userId, instituteId);
        } else {
            // Admin: get all class ids
            const rows = await sequelize.query(
                `SELECT id FROM classes WHERE institute_id = :iid`,
                { replacements: { iid: instituteId }, type: QueryTypes.SELECT }
            );
            classIds = rows.map(r => r.id);
        }

        const allAtRisk = [];
        for (const cid of classIds) {
            const scores = await getClassScores(cid, instituteId);
            const atRisk = scores.filter(s => s.status === 'at_risk');
            // Get class name
            const classRow = await sequelize.query(
                `SELECT name FROM classes WHERE id = :cid LIMIT 1`,
                { replacements: { cid }, type: QueryTypes.SELECT }
            );
            atRisk.forEach(s => allAtRisk.push({ ...s, class_name: classRow[0]?.name || '' }));
        }

        allAtRisk.sort((a, b) => a.score - b.score); // Worst first

        sendSuccess(res, { at_risk: allAtRisk, count: allAtRisk.length }, 'At-risk students retrieved');
    } catch (err) {
        console.error('At-risk error:', err);
        sendError(res, 'Failed to fetch at-risk students', 500);
    }
};

/**
 * GET /api/performance/faculty/classes
 * Faculty gets the list of their own classes (for dropdown)
 */
const getFacultyClasses = async (req, res) => {
    try {
        const { id: userId, institute_id: instituteId } = req.user;

        const classes = await sequelize.query(`
            SELECT DISTINCT c.id, c.name, c.section
            FROM classes c
            JOIN subjects sub ON sub.class_id = c.id
            JOIN faculty f ON f.id = sub.faculty_id
            WHERE f.user_id = :uid AND c.institute_id = :iid
            ORDER BY c.name
        `, { replacements: { uid: userId, iid: instituteId }, type: QueryTypes.SELECT });

        sendSuccess(res, { classes }, 'Faculty classes retrieved');
    } catch (err) {
        console.error('Faculty classes error:', err);
        sendError(res, 'Failed to fetch faculty classes', 500);
    }
};

module.exports = {
    getMyPerformance,
    getMyTrend,
    getClassPerformance,
    getChildPerformance,
    getInstitutePerformance,
    getAtRiskStudents,
    getFacultyClasses,
};
