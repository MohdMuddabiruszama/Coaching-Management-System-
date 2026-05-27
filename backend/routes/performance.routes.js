/**
 * Performance Routes — Phase 2 (Approach B)
 * All routes protected with verifyToken + allowRoles
 */

const router = require('express').Router();
const verifyToken = require('../middlewares/auth.middleware');
const allowRoles  = require('../middlewares/role.middleware');
const {
    getMyPerformance,
    getMyTrend,
    getClassPerformance,
    getChildPerformance,
    getInstitutePerformance,
    getAtRiskStudents,
    getFacultyClasses,
} = require('../controllers/performance.controller');

// ── Student ────────────────────────────────────────────────────────────────
router.get('/me',       verifyToken, allowRoles('student'), getMyPerformance);
router.get('/me/trend', verifyToken, allowRoles('student'), getMyTrend);

// ── Faculty ────────────────────────────────────────────────────────────────
router.get('/faculty/classes',      verifyToken, allowRoles('faculty'), getFacultyClasses);
router.get('/class/:classId',       verifyToken, allowRoles('faculty', 'admin', 'manager'), getClassPerformance);

// ── Parent ─────────────────────────────────────────────────────────────────
router.get('/student/:id',          verifyToken, allowRoles('parent'), getChildPerformance);

// ── Admin / Manager ────────────────────────────────────────────────────────
router.get('/institute',            verifyToken, allowRoles('admin', 'manager'), getInstitutePerformance);
router.get('/at-risk',              verifyToken, allowRoles('admin', 'manager', 'faculty'), getAtRiskStudents);

module.exports = router;
