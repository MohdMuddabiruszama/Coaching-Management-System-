/**
 * ✅ Phase 7: Faculty Validation Schemas
 */
const Joi = require("joi");
const { idParam, pagination, email, phone, genderEnum } = require("./common.schemas");

const createFaculty = {
    body: Joi.object({
        name: Joi.string().trim().min(2).max(100).required(),
        email: email.required(),
        phone: phone.optional().allow("", null),
        qualification: Joi.string().max(200).optional().allow("", null),
        experience: Joi.string().max(100).optional().allow("", null),
        gender: genderEnum,
        address: Joi.string().max(500).optional().allow("", null),
        subject_ids: Joi.array().items(Joi.number().integer().positive()).optional(),
        class_ids: Joi.array().items(Joi.number().integer().positive()).optional(),
        status: Joi.string().valid("active", "blocked", "inactive").optional(),
    }),
};

const updateFaculty = {
    params: idParam,
    body: Joi.object({
        name: Joi.string().trim().min(2).max(100).optional(),
        email: email.optional(),
        phone: phone.optional().allow("", null),
        qualification: Joi.string().max(200).optional().allow("", null),
        experience: Joi.string().max(100).optional().allow("", null),
        gender: genderEnum,
        address: Joi.string().max(500).optional().allow("", null),
        subject_ids: Joi.array().items(Joi.number().integer().positive()).optional(),
        class_ids: Joi.array().items(Joi.number().integer().positive()).optional(),
        status: Joi.string().valid("active", "blocked", "inactive").optional(),
    }),
};

const getFaculty = {
    query: pagination,
};

const getFacultyById = {
    params: idParam,
};

const deleteFaculty = {
    params: idParam,
};

module.exports = {
    createFaculty,
    updateFaculty,
    getFaculty,
    getFacultyById,
    deleteFaculty,
};
