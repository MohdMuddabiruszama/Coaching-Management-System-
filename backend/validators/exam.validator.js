/**
 * ✅ Exam Validation Schemas — Phase 3 (Approach B)
 * Joi schemas for all exam CRUD, marks entry, and new endpoints.
 */
const Joi = require('joi');
const { idParam, pagination, dateISO } = require('./common.schemas');

// Allowed exam types
const EXAM_TYPES = ['unit_test', 'midterm', 'final', 'mock', 'practical', 'other'];

const createExam = {
    body: Joi.object({
        name: Joi.string().trim().min(2).max(200).required()
            .messages({ 'string.empty': 'Exam name is required' }),
        subject_id: Joi.number().integer().positive().required(),
        class_id: Joi.number().integer().positive().required(),
        exam_date: dateISO.required(),
        total_marks: Joi.number().positive().max(1000).required(),
        passing_marks: Joi.number().min(0).max(Joi.ref('total_marks')).required()
            .messages({ 'number.max': 'Passing marks cannot exceed total marks' }),
        exam_type: Joi.string().max(20).default('unit_test').optional(),
    }),
};

const getExams = {
    query: pagination.keys({
        class_id: Joi.number().integer().positive().optional(),
        subject_id: Joi.number().integer().positive().optional(),
    }),
};

const enterMarks = {
    body: Joi.object({
        exam_id: Joi.number().integer().positive().required(),
        student_id: Joi.number().integer().positive().required(),
        marks_obtained: Joi.number().min(0).max(1000).when('is_absent', {
            is: true,
            then: Joi.optional().allow(null),
            otherwise: Joi.required(),
        }),
        is_absent: Joi.boolean().default(false).optional(),
        remarks: Joi.string().max(200).optional().allow('', null),
    }),
};

const getExamMarks = {
    params: Joi.object({
        exam_id: Joi.number().integer().positive().required(),
    }),
};

const getStudentResults = {
    params: Joi.object({
        student_id: Joi.number().integer().positive().required(),
    }),
};

const deleteExam = {
    params: idParam,
};

// ─── New schemas for Phase 3 endpoints ───────────────────────

const updateExam = {
    params: idParam,
    body: Joi.object({
        name: Joi.string().trim().min(2).max(200).optional(),
        exam_date: dateISO.optional(),
        total_marks: Joi.number().positive().max(1000).optional(),
        passing_marks: Joi.number().min(0).optional(),
        exam_type: Joi.string().max(20).optional(),
    }),
};

module.exports = {
    createExam,
    getExams,
    enterMarks,
    getExamMarks,
    getStudentResults,
    deleteExam,
    updateExam,
};
