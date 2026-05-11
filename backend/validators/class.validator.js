/**
 * ✅ Phase 7: Class Validation Schemas
 * Joi schemas for class CRUD endpoints.
 */
const Joi = require("joi");
const { idParam, pagination } = require("./common.schemas");

const createClass = {
    body: Joi.object({
        name: Joi.string().trim().min(1).max(100).required()
            .messages({ "string.empty": "Class name is required" }),
        section: Joi.string().trim().max(20).optional().allow("", null),
    }),
};

const updateClass = {
    params: idParam,
    body: Joi.object({
        name: Joi.string().trim().min(1).max(100).optional(),
        section: Joi.string().trim().max(20).optional().allow("", null),
        description: Joi.string().max(500).optional().allow("", null),
    }),
};

const getClasses = {
    query: pagination,
};

const getClassById = {
    params: idParam,
};

const deleteClass = {
    params: idParam,
};

module.exports = {
    createClass,
    updateClass,
    getClasses,
    getClassById,
    deleteClass,
};
