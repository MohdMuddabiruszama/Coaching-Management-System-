/**
 * Exam Routes — Phase 3 (Approach B)
 * ✅ All existing routes preserved
 * ✅ 8 new routes added for full exam result system
 * ⚠️  Static routes (/student/*, /parent/*) are ABOVE param routes (/:id)
 *     to prevent Express matching 'student' as an :id value
 */

const express = require('express');
const router = express.Router();
const examController = require('../controllers/exam.controller');
const verifyToken = require('../middlewares/auth.middleware');
const allowRoles = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const examValidator = require('../validators/exam.validator');

// ═══════════════════════════════════════════════════════════════
// STATIC ROUTES — must come BEFORE any /:id param routes
// ═══════════════════════════════════════════════════════════════

// Student: all locked exam marks with %, rank, grade, subject
router.get(
    '/student/all',
    verifyToken,
    allowRoles('student'),
    examController.getStudentMarks
);

// Student: multi-subject scorecard for one exam
router.get(
    '/student/scorecard',
    verifyToken,
    allowRoles('student'),
    examController.getStudentScorecard
);

// Student: performance trend data for chart
router.get(
    '/student/trend',
    verifyToken,
    allowRoles('student'),
    examController.getStudentTrend
);

// Student: download PDF result card
router.get(
    '/student/result-pdf',
    verifyToken,
    allowRoles('student'),
    examController.downloadResultCard
);

// Parent: marks for a linked child (auth check inside controller)
router.get(
    '/parent/child/:studentId',
    verifyToken,
    allowRoles('parent'),
    examController.getParentChildMarks
);

// ═══════════════════════════════════════════════════════════════
// EXISTING ROUTES — preserved unchanged
// ═══════════════════════════════════════════════════════════════

// Create exam (admin/faculty)
router.post(
    '/',
    verifyToken,
    allowRoles('admin', 'faculty'),
    validate(examValidator.createExam),
    examController.createExam
);

// Get all exams (admin/faculty)
router.get(
    '/',
    verifyToken,
    allowRoles('admin', 'faculty'),
    validate(examValidator.getExams),
    examController.getAllExams
);

// Enter/update marks (admin/faculty)
router.post(
    '/marks',
    verifyToken,
    allowRoles('admin', 'faculty'),
    validate(examValidator.enterMarks),
    examController.enterMarks
);

// Get all marks for an exam (admin/faculty)
router.get(
    '/:exam_id/marks',
    verifyToken,
    allowRoles('admin', 'faculty'),
    validate(examValidator.getExamMarks),
    examController.getExamMarks
);

// Get results for a specific student (admin/faculty/student)
router.get(
    '/results/:student_id',
    verifyToken,
    allowRoles('admin', 'faculty', 'student'),
    validate(examValidator.getStudentResults),
    examController.getStudentResults
);

// ═══════════════════════════════════════════════════════════════
// NEW: /:id param routes — come AFTER all static routes
// ═══════════════════════════════════════════════════════════════

// Update exam (admin only, blocked when locked)
router.put(
    '/:id',
    verifyToken,
    allowRoles('admin', 'manager'),
    validate(examValidator.updateExam),
    examController.updateExam
);

// Lock marks — publish results to students (admin/faculty)
router.patch(
    '/:id/lock',
    verifyToken,
    allowRoles('admin', 'manager', 'faculty'),
    examController.lockMarks
);

// Full results + stats for one exam (admin/faculty)
router.get(
    '/:id/results',
    verifyToken,
    allowRoles('admin', 'manager', 'faculty'),
    examController.getExamResults
);

// Delete exam (admin only, blocked when locked)
router.delete(
    '/:id',
    verifyToken,
    allowRoles('admin', 'manager'),
    validate(examValidator.deleteExam),
    examController.deleteExam
);

module.exports = router;
