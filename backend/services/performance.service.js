/**
 * Performance Service — Phase 1 (Approach B)
 * Weighted composite score engine: Marks 40% + Attendance 30% + Assignments 20% + Engagement 10%
 * Pure computed queries — zero new DB tables.
 * Uses in-memory cache (5-min TTL) to avoid repeated heavy queries.
 */

const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

// ── Weights (marks 50%, attendance 30%, assignments 20%, engagement 0%) ──────
const W = { marks: 0.50, attendance: 0.30, assignments: 0.20, engagement: 0.00 };

// ── In-memory cache ────────────────────────────────────────────────────────
const scoreCache = new Map(); // key: `${instituteId}:${studentId}`, value: { score, cachedAt }
const TTL = 5 * 60 * 1000;   // 5 minutes

/** Invalidate a student's cached score (call after marks/attendance/assignment save) */
const invalidateScore = (instituteId, studentId) => {
    scoreCache.delete(`${instituteId}:${studentId}`);
};

/** Convert numeric score to grade letter */
function scoreToGrade(s) {
    if (s >= 90) return 'A+';
    if (s >= 80) return 'A';
    if (s >= 70) return 'B+';
    if (s >= 60) return 'B';
    if (s >= 50) return 'C';
    if (s >= 40) return 'D';
    return 'F';
}

/** Convert score to status string */
function scoreToStatus(s) {
    if (s >= 75) return 'good';
    if (s >= 50) return 'average';
    return 'at_risk';
}

/**
 * Compute raw score components for a single student.
 * Shared between getStudentScore and getClassScores.
 */
async function computeComponents(studentId, instituteId, subjectId = null) {
    const subjectFilterMarks = subjectId ? ` AND e.subject_id = :subid ` : '';
    const subjectFilterAtt = subjectId ? ` AND subject_id = :subid ` : '';
    const subjectFilterAss = subjectId ? ` AND a.subject_id = :subid ` : '';

    const [marksRows, attRows, assRows, chatRows] = await Promise.all([
        // Marks: avg % across locked exams where student was not absent
        sequelize.query(`
            SELECT AVG((m.marks_obtained / NULLIF(e.total_marks, 0)) * 100) AS avg_pct
            FROM marks m
            JOIN exams e ON e.id = m.exam_id
            WHERE m.student_id = :sid
              AND e.institute_id = :iid
              AND e.marks_locked = true
              AND m.is_absent = false
              ${subjectFilterMarks}
        `, { replacements: { sid: studentId, iid: instituteId, subid: subjectId }, type: QueryTypes.SELECT }),

        // Attendance: present / total working days
        sequelize.query(`
            SELECT
                COUNT(*) FILTER (WHERE status NOT IN ('holiday')) AS working_days,
                COUNT(*) FILTER (WHERE status = 'present') AS present_days
            FROM attendances
            WHERE student_id = :sid AND institute_id = :iid
              ${subjectFilterAtt}
        `, { replacements: { sid: studentId, iid: instituteId, subid: subjectId }, type: QueryTypes.SELECT }),

        // Assignments: submitted or graded / total assigned
        sequelize.query(`
            SELECT
                COUNT(asub.id) AS total,
                COUNT(asub.id) FILTER (WHERE asub.status IN ('submitted','graded','late')) AS submitted
            FROM assignment_submissions asub
            JOIN assignments a ON a.id = asub.assignment_id
            WHERE asub.student_id = :sid AND a.institute_id = :iid
              ${subjectFilterAss}
        `, { replacements: { sid: studentId, iid: instituteId, subid: subjectId }, type: QueryTypes.SELECT }),

        // Engagement: chat messages sent (proxy for engagement score)
        sequelize.query(`
            SELECT COUNT(*) AS msg_count
            FROM chat_messages cm
            JOIN users u ON u.id = cm.sender_id
            JOIN students s ON s.user_id = u.id
            WHERE s.id = :sid AND s.institute_id = :iid
        `, { replacements: { sid: studentId, iid: instituteId }, type: QueryTypes.SELECT }),
    ]);

    const marksPct   = parseFloat(marksRows[0]?.avg_pct) || 0;
    const workingDays = parseInt(attRows[0]?.working_days) || 0;
    const presentDays = parseInt(attRows[0]?.present_days) || 0;
    const attPct     = workingDays > 0 ? (presentDays / workingDays) * 100 : 0;
    const totalAss   = parseInt(assRows[0]?.total) || 0;
    const submittedAss = parseInt(assRows[0]?.submitted) || 0;
    const assPct     = totalAss > 0 ? (submittedAss / totalAss) * 100 : 0;
    const msgCount   = parseInt(chatRows[0]?.msg_count) || 0;
    // Engagement: cap at 50 messages = 100%, linear scale
    const engPct     = Math.min((msgCount / 50) * 100, 100);

    // Dynamic Weight Normalization logic:
    // Base Weights: Marks (50%), Attendance (30%), Assignments (20%).
    // If one of these components has no active records (no data), its weight is redistributed
    // proportionally among the other active components.
    // Engagement is tracked and returned as eng_pct, but has 0% weight in the academic grade.
    const hasMarksData = marksRows[0] && marksRows[0].avg_pct !== null && marksRows[0].avg_pct !== undefined;
    const hasAttendanceData = workingDays > 0;
    const hasAssignmentsData = totalAss > 0;

    let totalActiveWeight = 0;
    let weightedSum = 0;

    if (hasMarksData) {
        totalActiveWeight += 0.50;
        weightedSum += marksPct * 0.50;
    }
    if (hasAttendanceData) {
        totalActiveWeight += 0.30;
        weightedSum += attPct * 0.30;
    }
    if (hasAssignmentsData) {
        totalActiveWeight += 0.20;
        weightedSum += assPct * 0.20;
    }

    const score = totalActiveWeight > 0 ? (weightedSum / totalActiveWeight) : 0;

    return {
        score:       Math.round(score),
        grade:       scoreToGrade(Math.round(score)),
        status:      scoreToStatus(Math.round(score)),
        marks_pct:   Math.round(marksPct),
        att_pct:     Math.round(attPct),
        ass_pct:     Math.round(assPct),
        eng_pct:     Math.round(engPct),
        present_days: presentDays,
        working_days: workingDays,
        submitted_ass: submittedAss,
        total_ass:   totalAss,
    };
}

/**
 * Phase 1A — Single student score (with caching).
 * Called by student self-view, parent view, faculty class view.
 */
async function getStudentScore(studentId, instituteId, subjectId = null) {
    const key = `${instituteId}:${studentId}:${subjectId || 'all'}`;
    const cached = scoreCache.get(key);
    if (cached && Date.now() - cached.cachedAt < TTL) return cached.score;

    const score = await computeComponents(studentId, instituteId, subjectId);
    scoreCache.set(key, { score, cachedAt: Date.now() });
    return score;
}

/**
 * Phase 1B — Subject-level breakdown for a student.
 * Returns array of { subject_name, avg_pct, passing_pct, below_passing }
 */
async function getSubjectBreakdown(studentId, instituteId) {
    const rows = await sequelize.query(`
        SELECT
            sub.name AS subject_name,
            sub.id AS subject_id,
            AVG((m.marks_obtained / NULLIF(e.total_marks, 0)) * 100) AS avg_pct,
            AVG((e.passing_marks / NULLIF(e.total_marks, 0)) * 100) AS passing_pct,
            COUNT(m.id) AS exam_count
        FROM marks m
        JOIN exams e ON e.id = m.exam_id
        JOIN subjects sub ON sub.id = e.subject_id
        WHERE m.student_id = :sid
          AND e.institute_id = :iid
          AND e.marks_locked = true
          AND m.is_absent = false
        GROUP BY sub.id, sub.name
        ORDER BY avg_pct ASC
    `, { replacements: { sid: studentId, iid: instituteId }, type: QueryTypes.SELECT });

    return rows.map(r => ({
        subject_name: r.subject_name,
        subject_id:   r.subject_id,
        avg_pct:      Math.round(parseFloat(r.avg_pct) || 0),
        passing_pct:  Math.round(parseFloat(r.passing_pct) || 40),
        exam_count:   parseInt(r.exam_count) || 0,
        below_passing: (parseFloat(r.avg_pct) || 0) < (parseFloat(r.passing_pct) || 40),
    }));
}

/**
 * Phase 1C — 6-month month-over-month trend for a student.
 * Returns array of { month, marks_pct, att_pct, ass_pct, score }
 */
async function getStudentTrend(studentId, instituteId) {
    const [marksRows, attRows, assRows] = await Promise.all([
        sequelize.query(`
            SELECT
                TO_CHAR(e.exam_date, 'YYYY-MM') AS month,
                AVG((m.marks_obtained / NULLIF(e.total_marks, 0)) * 100) AS marks_pct
            FROM marks m
            JOIN exams e ON e.id = m.exam_id
            WHERE m.student_id = :sid
              AND e.institute_id = :iid
              AND e.marks_locked = true
              AND m.is_absent = false
              AND e.exam_date >= NOW() - INTERVAL '6 months'
            GROUP BY TO_CHAR(e.exam_date, 'YYYY-MM')
            ORDER BY month
        `, { replacements: { sid: studentId, iid: instituteId }, type: QueryTypes.SELECT }),

        sequelize.query(`
            SELECT
                TO_CHAR(date, 'YYYY-MM') AS month,
                COUNT(*) FILTER (WHERE status NOT IN ('holiday')) AS working_days,
                COUNT(*) FILTER (WHERE status = 'present') AS present_days
            FROM attendances
            WHERE student_id = :sid
              AND institute_id = :iid
              AND date >= NOW() - INTERVAL '6 months'
            GROUP BY TO_CHAR(date, 'YYYY-MM')
            ORDER BY month
        `, { replacements: { sid: studentId, iid: instituteId }, type: QueryTypes.SELECT }),

        sequelize.query(`
            SELECT
                TO_CHAR(asub.submitted_at, 'YYYY-MM') AS month,
                COUNT(asub.id) AS submitted
            FROM assignment_submissions asub
            JOIN assignments a ON a.id = asub.assignment_id
            WHERE asub.student_id = :sid
              AND a.institute_id = :iid
              AND asub.submitted_at >= NOW() - INTERVAL '6 months'
              AND asub.status IN ('submitted','graded','late')
            GROUP BY TO_CHAR(asub.submitted_at, 'YYYY-MM')
            ORDER BY month
        `, { replacements: { sid: studentId, iid: instituteId }, type: QueryTypes.SELECT }),
    ]);

    // Merge by month
    const months = [...new Set([
        ...marksRows.map(r => r.month),
        ...attRows.map(r => r.month),
    ])].sort();

    return months.map(month => {
        const m = marksRows.find(r => r.month === month);
        const a = attRows.find(r => r.month === month);
        const as = assRows.find(r => r.month === month);

        const marksPct = Math.round(parseFloat(m?.marks_pct) || 0);
        const workingDays = parseInt(a?.working_days) || 0;
        const presentDays = parseInt(a?.present_days) || 0;
        const attPct = workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 0;
        const assPct = 0; // simplified — count not available in this group

        const hasMonthMarks = m && m.marks_pct !== null && m.marks_pct !== undefined;
        const hasMonthAtt = a && workingDays > 0;

        let trendScoreSum = 0;
        let trendWeightSum = 0;

        if (hasMonthMarks) {
            trendScoreSum += marksPct * 0.50;
            trendWeightSum += 0.50;
        }
        if (hasMonthAtt) {
            trendScoreSum += attPct * 0.30;
            trendWeightSum += 0.30;
        }

        const score = trendWeightSum > 0 ? Math.round(trendScoreSum / trendWeightSum) : 0;

        return { month, marks_pct: marksPct, att_pct: attPct, ass_pct: assPct, score };
    });
}

/**
 * Phase 1D — Class-level scores (faculty/admin view).
 * Returns array sorted by score descending.
 */
async function getClassScores(classId, instituteId, facultyUserId = null, subjectId = null) {
    let query = `
        SELECT DISTINCT s.id AS student_id, u.name AS student_name, s.roll_number
        FROM students s
        JOIN users u ON u.id = s.user_id
        JOIN student_classes sc ON sc.student_id = s.id
    `;
    
    if (facultyUserId || subjectId) {
        query += `
        JOIN student_subjects ss ON ss.student_id = s.id
        JOIN subjects sub ON sub.id = ss.subject_id
        `;
    }
    if (facultyUserId) {
        query += ` JOIN faculty f ON f.id = sub.faculty_id `;
    }
    
    query += ` WHERE sc.class_id = :cid AND s.institute_id = :iid `;
    
    if (facultyUserId) {
        query += ` AND f.user_id = :fuid `;
    }
    if (subjectId) {
        query += ` AND sub.id = :subid `;
    }
    
    query += ` ORDER BY s.roll_number `;

    // Get all students in the class (filtered if faculty or subject)
    const students = await sequelize.query(query, { 
        replacements: { cid: classId, iid: instituteId, fuid: facultyUserId, subid: subjectId }, 
        type: QueryTypes.SELECT 
    });

    if (!students.length) return [];

    // Compute score for each student (using cache)
    const scores = await Promise.all(
        students.map(async (st) => {
            const perf = await getStudentScore(st.student_id, instituteId, subjectId);
            return {
                student_id:   st.student_id,
                student_name: st.student_name,
                roll_number:  st.roll_number,
                ...perf,
            };
        })
    );

    // Sort by score desc, assign rank
    scores.sort((a, b) => b.score - a.score);
    return scores.map((s, i) => ({ ...s, rank: i + 1 }));
}

/**
 * Phase 1E — Institute-wide overview (admin view).
 */
async function getInstituteOverview(instituteId) {
    const [classRows] = await Promise.all([
        sequelize.query(`
            SELECT
                c.id AS class_id,
                c.name AS class_name,
                COUNT(DISTINCT sc.student_id) AS student_count
            FROM classes c
            JOIN student_classes sc ON sc.class_id = c.id
            JOIN students s ON s.id = sc.student_id
            WHERE c.institute_id = :iid
            GROUP BY c.id, c.name
            ORDER BY c.name
        `, { replacements: { iid: instituteId }, type: QueryTypes.SELECT }),
    ]);

    if (!classRows.length) {
        return {
            avg_score: 0, pass_rate: 0, at_risk_count: 0,
            top_class: null, class_breakdown: [], student_count: 0,
        };
    }

    // Compute per-class averages
    const classBreakdown = await Promise.all(classRows.map(async (cls) => {
        const classScores = await getClassScores(cls.class_id, instituteId);
        if (!classScores.length) return { ...cls, avg_score: 0, pass_rate: 0, at_risk: 0 };

        const avgScore = Math.round(classScores.reduce((s, r) => s + r.score, 0) / classScores.length);
        const passRate = Math.round((classScores.filter(r => r.score >= 50).length / classScores.length) * 100);
        const atRisk   = classScores.filter(r => r.status === 'at_risk').length;

        return {
            class_id:   cls.class_id,
            class_name: cls.class_name,
            student_count: classScores.length,
            avg_score:  avgScore,
            pass_rate:  passRate,
            at_risk:    atRisk,
            scores:     classScores,
        };
    }));

    const allScores = classBreakdown.flatMap(c => c.scores || []);
    const totalStudents = allScores.length;

    const overallAvg  = totalStudents > 0
        ? Math.round(allScores.reduce((s, r) => s + r.score, 0) / totalStudents)
        : 0;
    const passRate    = totalStudents > 0
        ? Math.round((allScores.filter(r => r.score >= 50).length / totalStudents) * 100)
        : 0;
    const atRiskCount = allScores.filter(r => r.status === 'at_risk').length;
    const topClass    = classBreakdown.reduce(
        (best, c) => (c.avg_score > (best?.avg_score || -1) ? c : best), null
    );

    return {
        avg_score:       overallAvg,
        pass_rate:       passRate,
        at_risk_count:   atRiskCount,
        student_count:   totalStudents,
        top_class:       topClass ? { name: topClass.class_name, score: topClass.avg_score } : null,
        class_breakdown: classBreakdown.map(({ scores, ...rest }) => rest), // strip raw scores from summary
        all_students:    allScores, // used for top/bottom tables
    };
}

module.exports = {
    getStudentScore,
    getSubjectBreakdown,
    getStudentTrend,
    getClassScores,
    getInstituteOverview,
    invalidateScore,
};
