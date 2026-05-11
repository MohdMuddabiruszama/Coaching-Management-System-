/**
 * ✅ Phase 7: Exam Validation Schemas
 * Joi schemas for exam CRUD and marks entry.
 */
const Joi = require("joi");
const { idParam, pagination, dateISO } = require("./common.schemas");

const createExam = {
    body: Joi.object({
        name: Joi.string().trim().min(2).max(200).required()
            .messages({ "string.empty": "Exam name is required" }),
        subject_id: Joi.number().integer().positive().required(),
        class_id: Joi.number().integer().positive().required(),
        exam_date: dateISO.required(),
        total_marks: Joi.number().integer().positive().max(1000).required(),
        passing_marks: Joi.number().integer().min(0).max(Joi.ref("total_marks")).required()
            .messages({ "number.max": "Passing marks cannot exceed total marks" }),
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
        marks_obtained: Joi.number().min(0).max(1000).required()
            .messages({ "number.min": "Marks cannot be negative" }),
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

module.exports = {
    createExam,
    getExams,
    enterMarks,
    getExamMarks,
    getStudentResults,
    deleteExam,
};
