/**
 * ✅ Phase 7: Announcement Validation Schemas
 */
const Joi = require("joi");
const { idParam, pagination } = require("./common.schemas");

const createAnnouncement = {
    body: Joi.object({
        title: Joi.string().trim().min(2).max(200).required()
            .messages({ "string.empty": "Title is required" }),
        content: Joi.string().trim().min(1).max(5000).required()
            .messages({ "string.empty": "Content is required" }),
        target_roles: Joi.array().items(
            Joi.string().valid("admin", "faculty", "student", "parent", "manager")
        ).optional(),
        target_class_ids: Joi.array().items(Joi.number().integer().positive()).optional(),
        priority: Joi.string().valid("low", "medium", "high").default("medium"),
    }),
};

const getAnnouncements = {
    query: pagination,
};

const deleteAnnouncement = {
    params: idParam,
};

const markAsViewed = {
    body: Joi.object({
        announcement_ids: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
    }),
};

module.exports = {
    createAnnouncement,
    getAnnouncements,
    deleteAnnouncement,
    markAsViewed,
};
