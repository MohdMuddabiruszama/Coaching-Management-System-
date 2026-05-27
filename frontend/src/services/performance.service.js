/**
 * Performance Service — Frontend API layer
 * All performance-related API calls for Student, Faculty, Parent, Admin.
 */
import api from './api';

const performanceService = {
    // ── Student ──────────────────────────────────────────────────────────
    /** Student: own score + subject breakdown */
    getMyPerformance: () =>
        api.get('/performance/me').then(r => r.data.data),

    /** Student: 6-month trend */
    getMyTrend: () =>
        api.get('/performance/me/trend').then(r => r.data.data),

    // ── Faculty ──────────────────────────────────────────────────────────
    /** Faculty: get their own classes (for class picker) */
    getFacultyClasses: () =>
        api.get('/performance/faculty/classes').then(r => r.data.data),

    /** Faculty/Admin: class performance ranked table */
    getClassPerformance: (classId, subjectId = null) => {
        const params = subjectId ? `?subjectId=${subjectId}` : '';
        return api.get(`/performance/class/${classId}${params}`).then(r => r.data.data);
    },

    // ── Parent ───────────────────────────────────────────────────────────
    /** Parent: linked child performance */
    getChildPerformance: (studentId) =>
        api.get(`/performance/student/${studentId}`).then(r => r.data.data),

    // ── Admin ─────────────────────────────────────────────────────────────
    /** Admin: institute-wide overview */
    getInstituteOverview: () =>
        api.get('/performance/institute').then(r => r.data.data),

    /** Admin/Faculty: at-risk students (optional classId filter) */
    getAtRisk: (classId) => {
        const params = classId ? `?classId=${classId}` : '';
        return api.get(`/performance/at-risk${params}`).then(r => r.data.data);
    },
};

export default performanceService;
