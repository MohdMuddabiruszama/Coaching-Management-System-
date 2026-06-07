/**
 * Mark Service — Frontend API layer (Phase 8)
 * All mark-related API calls for Faculty, Student and Parent.
 * No page component should import api.js directly for mark calls.
 */
import api from './api';

const markService = {
    // ─── Faculty ──────────────────────────────────────────────
    // Get all marks for a specific exam
    getForExam: (examId) =>
        api.get(`/exams/${examId}/marks`).then(r => r.data.data),

    // Save / update a student's mark (upsert)
    save: (data) =>
        api.post('/exams/marks', data).then(r => r.data),

    // Bulk save
    bulkSave: (data) =>
        api.post('/exams/marks/bulk', data).then(r => r.data),

    // ─── Student ──────────────────────────────────────────────
    // All locked exam marks with %, rank, grade, subject
    getAll: () =>
        api.get('/exams/student/all').then(r => r.data.data),

    // Multi-subject scorecard for one exam name
    getScorecard: (examName) =>
        api.get(`/exams/student/scorecard?examName=${encodeURIComponent(examName)}`).then(r => r.data.data),

    // Performance trend data for chart
    getTrend: () =>
        api.get('/exams/student/trend').then(r => r.data.data),

    // Download PDF result card — triggers browser download
    downloadPDF: (examName) =>
        api.get(
            `/exams/student/result-pdf?examName=${encodeURIComponent(examName)}`,
            { responseType: 'blob' }
        ).then(r => {
            const url = URL.createObjectURL(r.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `result_${examName.replace(/\s+/g, '_')}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }),

    // ─── Parent ───────────────────────────────────────────────
    // Marks for parent's linked child
    getParentChild: (studentId) =>
        api.get(`/exams/parent/child/${studentId}`).then(r => r.data.data),
};

export default markService;
