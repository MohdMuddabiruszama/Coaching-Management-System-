/**
 * ✅ Phase 7: Student Validation Schemas
 * Joi schemas for student CRUD endpoints.
 */
const Joi = require("joi");
const { idParam, pagination, email, phone, genderEnum, dateISO } = require("./common.schemas");

const createStudent = {
    body: Joi.object({
        name: Joi.string().trim().min(2).max(100).required()
            .messages({ "string.min": "Student name must be at least 2 characters" }),
        email: email.required(),
        phone: phone.optional().allow("", null),
        roll_number: Joi.string().max(50).optional().allow("", null),
        class_id: Joi.number().integer().positive().optional().allow(null),
        admission_date: dateISO.required()
            .messages({ "date.format": "Admission date must be a valid ISO date" }),
        date_of_birth: dateISO.required()
            .messages({ "date.format": "Date of birth must be a valid ISO date" }),
        gender: genderEnum,
        address: Joi.string().max(500).optional().allow("", null),
        subject_ids: Joi.array().items(
            Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().valid("full_course"))
        ).optional(),
        class_ids: Joi.array().items(Joi.number().integer().positive()).optional(),
        status: Joi.string().valid("active", "blocked", "inactive").optional(),
    }),
};

const updateStudent = {
    params: idParam,
    body: Joi.object({
        name: Joi.string().trim().min(2).max(100).optional(),
        email: email.optional(),
        phone: phone.optional().allow("", null),
        roll_number: Joi.string().max(50).optional().allow("", null),
        class_id: Joi.number().integer().positive().optional().allow(null),
        admission_date: dateISO.optional(),
        date_of_birth: dateISO.optional(),
        gender: genderEnum,
        address: Joi.string().max(500).optional().allow("", null),
        subject_ids: Joi.array().items(
            Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().valid("full_course"))
        ).optional(),
        class_ids: Joi.array().items(Joi.number().integer().positive()).optional(),
        status: Joi.string().valid("active", "blocked", "inactive").optional(),
    }),
};

const getStudents = {
    query: pagination.keys({
        class_id: Joi.number().integer().positive().optional(),
    }),
};

const getStudentById = {
    params: idParam,
};

const deleteStudent = {
    params: idParam,
};

const getStudentLookup = {
    query: Joi.object({
        class_id: Joi.number().integer().positive().optional(),
        search: Joi.string().max(200).allow("").optional(),
        limit: Joi.number().integer().min(1).max(200).default(100),
    }),
};

module.exports = {
    createStudent,
    updateStudent,
    getStudents,
    getStudentById,
    deleteStudent,
    getStudentLookup,
};
