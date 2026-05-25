/**
 * ✅ Phase 7: Attendance Validation Schemas
 * Joi schemas for attendance endpoints (bulk mark, grid, update, smart QR).
 */
const Joi = require("joi");
const { idParam, classSubjectDateParams, attendanceStatusEnum, dateISO } = require("./common.schemas");

const markBulk = {
    body: Joi.object({
        class_id: Joi.number().integer().positive().required(),
        subject_id: Joi.number().integer().positive().optional().allow(null),
        date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
            .messages({ "string.pattern.base": "Date must be YYYY-MM-DD" }),
        attendance_data: Joi.array().items(
            Joi.object({
                student_id: Joi.number().integer().positive().required(),
                status: Joi.string().valid("present", "absent", "late", "half_day", "holiday", "pending").required(),
                remarks: Joi.string().max(300).optional().allow("", null),
            })
        ).min(1).required()
            .messages({ "array.min": "At least one attendance record is required" }),
    }),
};

const getByDate = {
    params: classSubjectDateParams,
};

const getGrid = {
    params: Joi.object({
        class_id: Joi.number().integer().positive().required(),
        subject_id: Joi.number().integer().positive().required(),
    }),
    query: Joi.object({
        start_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
        end_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    }),
};

const updateAttendance = {
    params: idParam,
    body: Joi.object({
        status: attendanceStatusEnum,
        remarks: Joi.string().max(300).optional().allow("", null),
    }),
};

const deleteAttendance = {
    params: idParam,
};

const getStudentReport = {
    params: Joi.object({
        student_id: Joi.number().integer().positive().required(),
    }),
    query: Joi.object({
        start_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
        end_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
        month: Joi.number().integer().min(1).max(12).optional(),
        year: Joi.number().integer().min(2000).max(2100).optional(),
        subject_id: Joi.number().integer().positive().optional(),
    }),
};

const getClassSummary = {
    params: Joi.object({
        class_id: Joi.number().integer().positive().required(),
    }),
    query: Joi.object({
        start_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
        end_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }),
};

const startSession = {
    body: Joi.object({
        class_id: Joi.number().integer().positive().required(),
        subject_id: Joi.number().integer().positive().optional().allow(null),
    }),
};

const markByQR = {
    body: Joi.object({
        session_token: Joi.string().min(10).max(128).required(),
        date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }),
};

const markByStudentQR = {
    body: Joi.object({
        qr_code: Joi.string().min(1).required()
            .messages({ "string.empty": "QR code is required", "any.required": "QR code is required" }),
        class_id: Joi.number().integer().positive().required()
            .messages({ "any.required": "Class is required" }),
        subject_id: Joi.alternatives().try(
            Joi.number().integer().positive(),
            Joi.string().valid("", "null")
        ).optional().allow(null),
        date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional()
            .messages({ "string.pattern.base": "Date must be YYYY-MM-DD" }),
    }),
};

const getDashboard = {
    query: Joi.object({
        date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }),
};

module.exports = {
    markBulk,
    getByDate,
    getGrid,
    updateAttendance,
    deleteAttendance,
    getStudentReport,
    getClassSummary,
    startSession,
    markByQR,
    markByStudentQR,
    getDashboard,
};
