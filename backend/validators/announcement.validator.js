/**
 * Announcement Validation Schemas — Smart Announcement System (Phase 3 update)
 */
const Joi = require("joi");
const { idParam, pagination } = require("./common.schemas");

const createAnnouncement = {
    body: Joi.object({
        title: Joi.string().trim().min(2).max(200).required()
            .messages({ "string.empty": "Title is required" }),
        content: Joi.string().trim().min(1).max(5000).required()
            .messages({ "string.empty": "Content is required" }),
        target_audience: Joi.string()
            .valid("all", "students", "faculty", "parents")
            .default("all"),
        priority: Joi.string()
            .valid("normal", "high", "urgent")
            .default("normal"),
        is_pinned:    Joi.boolean().default(false),
        expires_at:   Joi.string().isoDate().allow(null, "").optional(),
        target_class: Joi.number().integer().positive().allow(null).optional(),
        subject_id:   Joi.number().integer().positive().allow(null).optional(),
    }),
};

const updateAnnouncement = {
    params: idParam,
    body: Joi.object({
        title:           Joi.string().trim().min(2).max(200).optional(),
        content:         Joi.string().trim().min(1).max(5000).optional(),
        target_audience: Joi.string().valid("all", "students", "faculty", "parents").optional(),
        priority:        Joi.string().valid("normal", "high", "urgent").optional(),
        is_pinned:       Joi.boolean().optional(),
        expires_at:      Joi.string().isoDate().allow(null, "").optional(),
        target_class:    Joi.number().integer().positive().allow(null).optional(),
        subject_id:      Joi.number().integer().positive().allow(null).optional(),
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
        announcement_ids: Joi.array().items(Joi.number().integer().positive()).optional(),
    }).optional(),
};

module.exports = {
    createAnnouncement,
    updateAnnouncement,
    getAnnouncements,
    deleteAnnouncement,
    markAsViewed,
};
