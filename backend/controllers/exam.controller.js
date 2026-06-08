/**
 * Exam Controller — Phase 3 (Approach B)
 * ✅ PostgreSQL-compatible: uses raw SQL with proper column references
 * ✅ student_id in marks = students.id (NOT users.id)
 *    → For logged-in student: join marks → exams via students.user_id = req.user.id
 */

const { Exam, Mark, Student, Subject, User, Faculty, StudentParent, Class } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const examResultService = require('../services/examResult.service');

// ─── PDFKit ───────────────────────────────────────────────────
let PDFDocument;
try { PDFDocument = require('pdfkit'); } catch (e) { PDFDocument = null; }

// ═══════════════════════════════════════════════════════════════
// createExam — accepts exam_type
// ═══════════════════════════════════════════════════════════════
exports.createExam = async (req, res) => {
    try {
        const { name, subject_id, class_id, exam_date, total_marks, passing_marks, exam_type } = req.body;
        const institute_id = req.user.institute_id;

        const exam = await Exam.create({
            institute_id,
            name,
            subject_id,
            class_id,
            exam_date,
            total_marks,
            passing_marks,
            exam_type: exam_type || 'unit_test',
        });

        res.status(201).json({ success: true, message: 'Exam created successfully', data: exam });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// getAllExams — unchanged, includes exam_type/marks_locked
// ═══════════════════════════════════════════════════════════════
exports.getAllExams = async (req, res) => {
    try {
        const { page = 1, limit = 10, class_id, subject_id } = req.query;
        const institute_id = req.user.institute_id;
        const offset = (page - 1) * limit;

        const whereClause = { institute_id };
        if (class_id) whereClause.class_id = class_id;
        if (subject_id) whereClause.subject_id = subject_id;

        let subjectWhereClause = {};
        if (req.user.role === 'faculty') {
            const facultyRecord = await Faculty.findOne({ where: { user_id: req.user.id } });
            if (facultyRecord) {
                subjectWhereClause.faculty_id = facultyRecord.id;
            } else {
                return res.status(200).json({
                    success: true,
                    message: 'Exams retrieved successfully',
                    data: { exams: [], pagination: { total: 0, page: 1, limit: parseInt(limit), totalPages: 0 } },
                });
            }
        }

        const { count, rows } = await Exam.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['exam_date', 'DESC']],
            include: [{
                model: Subject,
                attributes: ['id', 'name'],
                where: Object.keys(subjectWhereClause).length ? subjectWhereClause : undefined,
                required: Object.keys(subjectWhereClause).length > 0,
            }, {
                model: Class,
                attributes: ['id', 'name', 'section'],
            }],
        });

        res.status(200).json({
            success: true,
            message: 'Exams retrieved successfully',
            data: {
                exams: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit),
                },
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// enterMarks — with lock check + is_absent + remarks
// ═══════════════════════════════════════════════════════════════
exports.enterMarks = async (req, res) => {
    try {
        const { exam_id, student_id, marks_obtained, is_absent, remarks } = req.body;
        const institute_id = req.user.institute_id;

        const exam = await Exam.findByPk(exam_id);
        if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
        if (exam.marks_locked) {
            return res.status(403).json({ success: false, message: 'Marks are locked for this exam' });
        }

        let mark = await Mark.findOne({ where: { institute_id, exam_id, student_id } });

        let parsedMarks = parseFloat(marks_obtained);
        if (isNaN(parsedMarks)) parsedMarks = null;

        const markData = {
            marks_obtained: is_absent ? null : parsedMarks,
            is_absent: is_absent || false,
            remarks: remarks || null,
        };

        if (mark) {
            await mark.update(markData);
        } else {
            mark = await Mark.create({
                institute_id,
                exam_id,
                student_id,
                subject_id: exam.subject_id,
                ...markData,
            });
        }

        res.status(201).json({ success: true, message: 'Marks saved successfully', data: mark });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// NEW: bulkEnterMarks — bulk upsert for imported CSV
// ═══════════════════════════════════════════════════════════════
exports.bulkEnterMarks = async (req, res) => {
    try {
        const { exam_id, marksData } = req.body;
        const institute_id = req.user.institute_id;

        const exam = await Exam.findByPk(exam_id);
        if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
        if (exam.marks_locked) {
            return res.status(403).json({ success: false, message: 'Marks are locked for this exam' });
        }

        let importedCount = 0;
        for (const md of marksData) {
            let mark = await Mark.findOne({ where: { institute_id, exam_id, student_id: md.student_id } });

            let parsedMarks = parseFloat(md.marks_obtained);
            if (isNaN(parsedMarks)) parsedMarks = null;

            const data = {
                marks_obtained: md.is_absent ? null : parsedMarks,
                is_absent: md.is_absent || false,
                remarks: md.remarks || null,
            };

            if (mark) {
                await mark.update(data);
            } else {
                await Mark.create({
                    institute_id,
                    exam_id,
                    student_id: md.student_id,
                    subject_id: exam.subject_id,
                    ...data,
                });
            }
            importedCount++;
        }

        res.status(200).json({ success: true, message: `${importedCount} marks imported successfully` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// getStudentResults — admin/faculty (by student profile ID)
// ═══════════════════════════════════════════════════════════════
exports.getStudentResults = async (req, res) => {
    try {
        const { student_id } = req.params;
        const institute_id = req.user.institute_id;

        const marks = await Mark.findAll({
            where: { student_id, institute_id },
            include: [{
                model: Exam,
                attributes: ['id', 'name', 'total_marks', 'passing_marks', 'exam_date', 'exam_type', 'marks_locked'],
                include: [{ model: Subject, attributes: ['name'] }],
            }],
            order: [[Exam, 'exam_date', 'DESC']],
        });

        res.status(200).json({ success: true, message: 'Student results retrieved successfully', data: marks });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// getExamMarks — all marks for an exam
// ═══════════════════════════════════════════════════════════════
exports.getExamMarks = async (req, res) => {
    try {
        const { exam_id } = req.params;
        const institute_id = req.user.institute_id;
        const marks = await Mark.findAll({ where: { exam_id, institute_id } });
        res.status(200).json({ success: true, data: marks });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// deleteExam — blocked when locked
// ═══════════════════════════════════════════════════════════════
exports.deleteExam = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;

        const exam = await Exam.findOne({ where: { id, institute_id } });
        if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
        if (exam.marks_locked) {
            return res.status(403).json({ success: false, message: 'Cannot delete a locked exam' });
        }

        await Mark.destroy({ where: { exam_id: id, institute_id } });
        await Exam.destroy({ where: { id, institute_id } });

        res.status(200).json({ success: true, message: 'Exam deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// NEW: updateExam — edit name/date/marks/type (blocked when locked)
// ═══════════════════════════════════════════════════════════════
exports.updateExam = async (req, res) => {
    try {
        const exam = await Exam.findOne({
            where: { id: req.params.id, institute_id: req.user.institute_id },
        });
        if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
        if (exam.marks_locked) {
            return res.status(403).json({ success: false, message: 'Cannot edit a locked exam' });
        }

        const { name, exam_date, total_marks, passing_marks, exam_type } = req.body;
        await exam.update({
            ...(name && { name }),
            ...(exam_date && { exam_date }),
            ...(total_marks && { total_marks }),
            ...(passing_marks !== undefined && { passing_marks }),
            ...(exam_type && { exam_type }),
        });

        return res.json({ success: true, message: 'Exam updated successfully', data: exam });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// NEW: lockMarks — publish results to students
// ✅ FIXED: validates only marks for THIS specific exam
//    Each exam (PT1-Math, PT1-Science) is independent.
//    Math faculty locks Math exam → Science faculty's progress
//    is completely irrelevant.
// ═══════════════════════════════════════════════════════════════
exports.lockMarks = async (req, res) => {
    try {
        const exam = await Exam.findOne({
            where: { id: req.params.id, institute_id: req.user.institute_id },
        });
        if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
        if (exam.marks_locked) {
            return res.status(400).json({ success: false, message: 'This exam is already locked and published.' });
        }

        // Count marks entered specifically for this exam
        // (not class-wide — each exam is independent per subject)
        const marksEntered = await Mark.count({ where: { exam_id: exam.id } });

        if (marksEntered === 0) {
            return res.status(422).json({
                success: false,
                message: 'No marks have been entered for this exam yet. Please enter marks before locking.',
            });
        }

        await exam.update({
            marks_locked:    true,
            marks_locked_at: new Date(),
            marks_locked_by: req.user.id,
        });

        return res.json({
            success: true,
            message: `Marks locked! Results for "${exam.name}" are now visible to students and parents.`,
            data: { locked: true, exam_id: exam.id, exam_name: exam.name },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// NEW: getExamResults — full results + stats (admin/faculty)
// ═══════════════════════════════════════════════════════════════
exports.getExamResults = async (req, res) => {
    try {
        const exam = await Exam.findOne({
            where: { id: req.params.id, institute_id: req.user.institute_id },
            include: [{ model: Subject, attributes: ['id', 'name'] }],
        });
        if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });

        const results = await examResultService.getExamResults(exam.id, exam.institute_id);
        const stats   = examResultService.computeStats(results, exam.passing_marks);

        return res.json({ success: true, data: { exam, results, stats } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// NEW: getStudentMarks — all locked marks for the logged-in student
// ✅ FIX: Computes RANK() over all marks FIRST using a CTE,
//         then filters by the logged-in student.
// ═══════════════════════════════════════════════════════════════
exports.getStudentMarks = async (req, res) => {
    try {
        const marks = await sequelize.query(`
            WITH RankedMarks AS (
                SELECT 
                    m.student_id,
                    m.exam_id,
                    m.marks_obtained,
                    m.is_absent,
                    m.remarks,
                    RANK() OVER (
                        PARTITION BY m.exam_id
                        ORDER BY CASE WHEN m.is_absent = true OR m.marks_obtained IS NULL THEN 0
                                      ELSE CAST(m.marks_obtained AS NUMERIC) END DESC
                    ) AS rank_in_class,
                    (SELECT COUNT(*) FROM marks m2 WHERE m2.exam_id = m.exam_id) AS total_in_class
                FROM marks m
            )
            SELECT
                e.id           AS exam_id,
                e.name         AS exam_name,
                e.exam_type,
                e.exam_date,
                e.total_marks,
                e.passing_marks,
                sub.name       AS subject_name,
                rm.marks_obtained,
                rm.is_absent,
                rm.remarks,
                CASE WHEN rm.is_absent = true OR rm.marks_obtained IS NULL THEN NULL
                     ELSE ROUND(CAST(rm.marks_obtained AS NUMERIC) / CAST(e.total_marks AS NUMERIC) * 100, 2)
                END AS percentage,
                CASE WHEN rm.is_absent = true OR rm.marks_obtained IS NULL THEN 'Absent'
                     WHEN CAST(rm.marks_obtained AS NUMERIC) >= CAST(e.passing_marks AS NUMERIC) THEN 'Pass'
                     ELSE 'Fail'
                END AS status,
                rm.rank_in_class,
                rm.total_in_class
            FROM RankedMarks rm
            JOIN students s   ON s.id   = rm.student_id
            JOIN exams    e   ON e.id   = rm.exam_id
            JOIN subjects sub ON sub.id = e.subject_id
            WHERE s.user_id       = :userId
              AND e.institute_id  = :iid
              AND e.marks_locked  = true
            ORDER BY e.exam_date DESC
        `, {
            replacements: { userId: req.user.id, iid: req.user.institute_id },
            type: QueryTypes.SELECT,
        });

        // Add grade to each row
        const withGrade = marks.map(r => ({
            ...r,
            grade: r.percentage !== null ? examResultService.getGrade(parseFloat(r.percentage)) : 'AB',
        }));

        return res.json({ success: true, data: withGrade });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// NEW: getStudentScorecard — multi-subject for one exam (student)
// ═══════════════════════════════════════════════════════════════
exports.getStudentScorecard = async (req, res) => {
    try {
        const { examName } = req.query;
        if (!examName) {
            return res.status(400).json({ success: false, message: 'examName query parameter is required' });
        }

        // Find student profile from logged-in user
        const student = await Student.findOne({
            where: { user_id: req.user.id, institute_id: req.user.institute_id },
        });
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student profile not found' });
        }

        const scorecard = await examResultService.getStudentScorecard(
            student.id, examName, req.user.institute_id
        );

        if (!scorecard) {
            return res.status(404).json({ success: false, message: 'No results found for this exam' });
        }

        return res.json({ success: true, data: scorecard });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// NEW: getStudentTrend — performance history for chart
// ═══════════════════════════════════════════════════════════════
exports.getStudentTrend = async (req, res) => {
    try {
        const student = await Student.findOne({
            where: { user_id: req.user.id, institute_id: req.user.institute_id },
        });
        if (!student) {
            return res.json({ success: true, data: [] });
        }

        const trend = await examResultService.getStudentTrend(student.id, req.user.institute_id);
        return res.json({ success: true, data: trend });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// NEW: downloadResultCard — PDF result card
// ═══════════════════════════════════════════════════════════════
exports.downloadResultCard = async (req, res) => {
    try {
        if (!PDFDocument) {
            return res.status(500).json({ success: false, message: 'PDF generation not available. Install pdfkit.' });
        }
        const { examName } = req.query;
        if (!examName) {
            return res.status(400).json({ success: false, message: 'examName query parameter is required' });
        }

        const student = await Student.findOne({
            where: { user_id: req.user.id, institute_id: req.user.institute_id },
        });
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student profile not found' });
        }

        const sc = await examResultService.getStudentScorecard(student.id, examName, req.user.institute_id);
        if (!sc) {
            return res.status(404).json({ success: false, message: 'No results found for this exam' });
        }

        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="result_${examName.replace(/\s+/g, '_')}.pdf"`);
        doc.pipe(res);

        doc.fontSize(22).font('Helvetica-Bold').text('RESULT CARD', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(16).font('Helvetica-Bold').text(sc.exam_name, { align: 'center' });
        doc.fontSize(12).font('Helvetica').text(new Date(sc.exam_date).toLocaleDateString('en-IN'), { align: 'center' });
        doc.moveDown(0.3).text(`Type: ${(sc.exam_type || '').replace(/_/g, ' ').toUpperCase()}`, { align: 'center' });
        doc.moveDown(2);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#CCCCCC').moveDown(0.5);

        sc.subjects.forEach(s => {
            doc.fontSize(12).font('Helvetica').text(
                `${s.subject.padEnd(28)} ${String(s.marks_obtained).padStart(4)} / ${String(s.total_marks).padEnd(6)}  ${s.percentage}%   Grade: ${s.grade}   ${s.status}`
            );
            doc.moveDown(0.5);
        });

        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#333333').moveDown(0.5);
        doc.fontSize(14).font('Helvetica-Bold').text(
            `Overall: ${sc.total_obtained} / ${sc.total_maximum}  (${sc.overall_percentage}%)   Grade: ${sc.overall_grade}   — ${sc.overall_status}`
        );
        doc.end();
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// NEW: getParentChildMarks — marks for parent's linked child
// ✅ FIX: studentId param = students.id (student profile ID, not user ID)
// ═══════════════════════════════════════════════════════════════
exports.getParentChildMarks = async (req, res) => {
    try {
        const { studentId } = req.params;
        const parentId = req.user.id;

        // Auth check: verify this student is linked to this parent
        const link = await StudentParent.findOne({
            where: { parent_id: parentId, student_id: studentId },
        });
        if (!link) {
            return res.status(403).json({ success: false, message: 'Not your linked child' });
        }

        const marks = await sequelize.query(`
            SELECT
                e.id           AS exam_id,
                e.name         AS exam_name,
                e.exam_type,
                e.exam_date,
                e.total_marks,
                e.passing_marks,
                sub.name       AS subject_name,
                m.marks_obtained,
                m.is_absent,
                CASE WHEN m.is_absent = true OR m.marks_obtained IS NULL THEN NULL
                     ELSE ROUND(CAST(m.marks_obtained AS NUMERIC) / CAST(e.total_marks AS NUMERIC) * 100, 2)
                END AS percentage,
                CASE WHEN m.is_absent = true OR m.marks_obtained IS NULL THEN 'Absent'
                     WHEN CAST(m.marks_obtained AS NUMERIC) >= CAST(e.passing_marks AS NUMERIC) THEN 'Pass'
                     ELSE 'Fail'
                END AS status
            FROM marks m
            JOIN exams    e   ON e.id  = m.exam_id
            JOIN subjects sub ON sub.id = e.subject_id
            WHERE m.student_id = :sid
              AND e.institute_id = :iid
              AND e.marks_locked = true
            ORDER BY e.exam_date DESC
        `, {
            replacements: { sid: studentId, iid: req.user.institute_id },
            type: QueryTypes.SELECT,
        });

        return res.json({ success: true, data: marks });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = exports;
