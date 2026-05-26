/**
 * Exam Result Service — Phase 2 (PostgreSQL-compatible)
 * ✅ Uses CAST() for DECIMAL comparisons
 * ✅ Uses boolean literals (true/false) not 1/0
 * ✅ student_id in marks = students.id (not users.id)
 */

const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

// ─── Grade calculator (pure function) ────────────────────────
function getGrade(pct) {
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    if (pct >= 40) return 'D';
    return 'F';
}

// ─── FUNCTION 1: getExamResults ───────────────────────────────
// All students for ONE exam — with rank, percentage, grade
async function getExamResults(examId, instituteId) {
    const results = await sequelize.query(`
        SELECT
            s.id              AS student_id,
            u.name            AS student_name,
            s.roll_number     AS roll_no,
            m.marks_obtained,
            m.is_absent,
            m.remarks,
            e.total_marks,
            e.passing_marks,
            e.exam_type,
            CASE WHEN m.is_absent = true OR m.marks_obtained IS NULL THEN NULL
                 ELSE ROUND(CAST(m.marks_obtained AS NUMERIC) / CAST(e.total_marks AS NUMERIC) * 100, 2)
            END AS percentage,
            CASE WHEN m.is_absent = true OR m.marks_obtained IS NULL THEN 'Absent'
                 WHEN CAST(m.marks_obtained AS NUMERIC) >= CAST(e.passing_marks AS NUMERIC) THEN 'Pass'
                 ELSE 'Fail'
            END AS status,
            RANK() OVER (
                ORDER BY
                    CASE WHEN m.is_absent = true OR m.marks_obtained IS NULL THEN 0
                         ELSE CAST(m.marks_obtained AS NUMERIC) END DESC
            ) AS rank_in_class
        FROM marks m
        JOIN students s ON s.id   = m.student_id
        JOIN users    u ON u.id   = s.user_id
        JOIN exams    e ON e.id   = m.exam_id
        WHERE m.exam_id       = :examId
          AND e.institute_id  = :instituteId
        ORDER BY rank_in_class ASC
    `, { replacements: { examId, instituteId }, type: QueryTypes.SELECT });

    return results.map(r => ({
        ...r,
        grade: r.percentage !== null ? getGrade(parseFloat(r.percentage)) : 'AB',
    }));
}

// ─── FUNCTION 2: computeStats ─────────────────────────────────
// Zero extra DB calls — computed from already-fetched results array
function computeStats(results, passingMarks) {
    const appeared = results.filter(r => !r.is_absent && r.marks_obtained !== null);
    const passed   = appeared.filter(r => parseFloat(r.marks_obtained) >= parseFloat(passingMarks));
    const marks    = appeared.map(r => parseFloat(r.marks_obtained));

    return {
        total_students:  results.length,
        appeared:        appeared.length,
        absent:          results.length - appeared.length,
        passed:          passed.length,
        failed:          appeared.length - passed.length,
        pass_percentage: appeared.length > 0
            ? ((passed.length / appeared.length) * 100).toFixed(2)
            : '0.00',
        average_marks: marks.length > 0
            ? (marks.reduce((a, b) => a + b, 0) / marks.length).toFixed(2)
            : '0.00',
        highest_marks: marks.length > 0 ? Math.max(...marks) : 0,
        lowest_marks:  marks.length > 0 ? Math.min(...marks) : 0,
    };
}

// ─── FUNCTION 3: getStudentScorecard ──────────────────────────
// Multi-subject scorecard for a student for one exam name
async function getStudentScorecard(studentId, examName, instituteId) {
    const rows = await sequelize.query(`
        SELECT
            e.name       AS exam_name,
            e.exam_date,
            e.exam_type,
            sub.name     AS subject_name,
            m.marks_obtained,
            m.is_absent,
            e.total_marks,
            e.passing_marks,
            CASE WHEN m.marks_obtained IS NULL THEN NULL
                 ELSE ROUND(CAST(m.marks_obtained AS NUMERIC) / CAST(e.total_marks AS NUMERIC) * 100, 2)
            END AS percentage
        FROM marks m
        JOIN exams    e   ON e.id  = m.exam_id
        JOIN subjects sub ON sub.id = e.subject_id
        WHERE m.student_id    = :studentId
          AND e.name          = :examName
          AND e.institute_id  = :instituteId
          AND (m.is_absent = false OR m.is_absent IS NULL)
          AND m.marks_obtained IS NOT NULL
        ORDER BY sub.name ASC
    `, { replacements: { studentId, examName, instituteId }, type: QueryTypes.SELECT });

    if (!rows.length) return null;

    const totalObtained = rows.reduce((s, r) => s + parseFloat(r.marks_obtained), 0);
    const totalMaximum  = rows.reduce((s, r) => s + parseFloat(r.total_marks), 0);
    const overallPct    = totalMaximum > 0
        ? ((totalObtained / totalMaximum) * 100).toFixed(2)
        : '0.00';

    return {
        exam_name:          rows[0].exam_name,
        exam_date:          rows[0].exam_date,
        exam_type:          rows[0].exam_type,
        subjects: rows.map(r => ({
            subject:        r.subject_name,
            marks_obtained: parseFloat(r.marks_obtained),
            total_marks:    parseFloat(r.total_marks),
            passing_marks:  parseFloat(r.passing_marks),
            percentage:     r.percentage,
            status:         parseFloat(r.marks_obtained) >= parseFloat(r.passing_marks) ? 'Pass' : 'Fail',
            grade:          r.percentage !== null ? getGrade(parseFloat(r.percentage)) : 'F',
        })),
        total_obtained:     totalObtained,
        total_maximum:      totalMaximum,
        overall_percentage: overallPct,
        overall_status:     rows.every(r => parseFloat(r.marks_obtained) >= parseFloat(r.passing_marks)) ? 'Pass' : 'Fail',
        overall_grade:      getGrade(parseFloat(overallPct)),
    };
}

// ─── FUNCTION 4: getStudentTrend ──────────────────────────────
// Performance history for chart — locked exams only
async function getStudentTrend(studentId, instituteId) {
    return sequelize.query(`
        SELECT
            e.name       AS exam_name,
            e.exam_date,
            sub.name     AS subject_name,
            ROUND(CAST(m.marks_obtained AS NUMERIC) / CAST(e.total_marks AS NUMERIC) * 100, 2) AS percentage
        FROM marks m
        JOIN exams    e   ON e.id  = m.exam_id
        JOIN subjects sub ON sub.id = e.subject_id
        WHERE m.student_id    = :studentId
          AND e.institute_id  = :instituteId
          AND (m.is_absent = false OR m.is_absent IS NULL)
          AND m.marks_obtained IS NOT NULL
          AND e.marks_locked  = true
        ORDER BY e.exam_date ASC
        LIMIT 50
    `, { replacements: { studentId, instituteId }, type: QueryTypes.SELECT });
}

module.exports = { getExamResults, computeStats, getStudentScorecard, getStudentTrend, getGrade };
