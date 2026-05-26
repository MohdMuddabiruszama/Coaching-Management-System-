/**
 * Exam Service — Frontend API layer (Phase 8)
 * All exam-related API calls go through here.
 * No page component should import api.js directly for exam calls.
 */
import api from './api';

const examService = {
    // Get all exams (admin/faculty)
    getAll: (params = {}) =>
        api.get('/exams', { params }).then(r => r.data.data),

    // Create a new exam
    create: (data) =>
        api.post('/exams', data).then(r => r.data.data),

    // Update exam (blocked when locked)
    update: (id, data) =>
        api.put(`/exams/${id}`, data).then(r => r.data.data),

    // Delete exam
    delete: (id) =>
        api.delete(`/exams/${id}`).then(r => r.data),

    // Lock marks — publishes results to students
    lockMarks: (id) =>
        api.patch(`/exams/${id}/lock`).then(r => r.data),

    // Get full results + stats for one exam (admin/faculty)
    getResults: (id) =>
        api.get(`/exams/${id}/results`).then(r => r.data.data),
};

export default examService;
