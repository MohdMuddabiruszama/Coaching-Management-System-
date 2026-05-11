/**
 * ✅ Phase 7: Subject Validation Schemas
 */
const Joi = require("joi");
const { idParam, pagination } = require("./common.schemas");

const createSubject = {
    body: Joi.object({
        name: Joi.string().trim().min(1).max(100).required(),
        class_id: Joi.number().integer().positive().required(),
        faculty_id: Joi.number().integer().positive().optional().allow(null),
        description: Joi.string().max(500).optional().allow("", null),
    }),
};

const updateSubject = {
    params: idParam,
    body: Joi.object({
        name: Joi.string().trim().min(1).max(100).optional(),
        class_id: Joi.number().integer().positive().optional(),
        faculty_id: Joi.number().integer().positive().optional().allow(null),
        description: Joi.string().max(500).optional().allow("", null),
    }),
};

const getSubjects = {
    query: pagination.keys({ class_id: Joi.number().integer().positive().optional() }),
};

const getSubjectById = { params: idParam };
const deleteSubject = { params: idParam };

module.exports = { createSubject, updateSubject, getSubjects, getSubjectById, deleteSubject };
