/**
 * Academic Year — Joi Validation Schemas
 * Phase 5 — Academic Year Promotion Engine
 *
 * Follows the same pattern as existing validators (e.g., student.validator.js, exam.validator.js)
 */
const Joi = require("joi");
const { idParam, pagination } = require("./common.schemas");

// ─── Academic Year ────────────────────────────────────────────────────────────

const createAcademicYear = {
    body: Joi.object({
        label: Joi.string().trim().max(20).required()
            .messages({ "string.empty": "Academic year label is required (e.g. 2025-26)" }),
        startDate: Joi.date().iso().optional().allow(null, ""),
        endDate: Joi.date().iso().min(Joi.ref("startDate")).optional().allow(null, ""),
        makeCurrent: Joi.boolean().default(false),
    }),
};

const updateAcademicYear = {
    params: idParam,
    body: Joi.object({
        label: Joi.string().trim().max(20).optional(),
        startDate: Joi.date().iso().optional().allow(null, ""),
        endDate: Joi.date().iso().optional().allow(null, ""),
        makeCurrent: Joi.boolean().optional(),
        status: Joi.string().valid("active", "closed").optional(),
    }),
};

// ─── Promotion Rules ──────────────────────────────────────────────────────────

const createPromotionRule = {
    body: Joi.object({
        fromClassId: Joi.number().integer().positive().optional().allow(null),
        toClassId: Joi.number().integer().positive().optional().allow(null),
        endAction: Joi.string().valid("graduate", "course_completed", "alumni").optional().allow(null, ""),
        sortOrder: Joi.number().integer().min(0).optional(),
    }),
};

const updatePromotionRule = {
    params: idParam,
    body: Joi.object({
        fromClassId: Joi.number().integer().positive().optional().allow(null),
        toClassId: Joi.number().integer().positive().optional().allow(null),
        endAction: Joi.string().valid("graduate", "course_completed", "alumni").optional().allow(null, ""),
        sortOrder: Joi.number().integer().min(0).optional(),
    }),
};

const deletePromotionRule = {
    params: idParam,
};

// ─── Promotion Execution ──────────────────────────────────────────────────────

const executePromotion = {
    body: Joi.object({
        newYearLabel: Joi.string().trim().max(20).required()
            .messages({ "string.empty": "New academic year label is required (e.g. 2026-27)" }),
        confirmation: Joi.string().valid("PROMOTE").required()
            .messages({ "any.only": "Type PROMOTE to confirm the promotion" }),
        overrides: Joi.array().items(
            Joi.object({
                studentId: Joi.number().integer().positive().required(),
                action: Joi.string().valid("promote", "repeat", "graduate", "transfer", "drop").required(),
                toClassId: Joi.number().integer().positive().optional().allow(null),
            })
        ).optional().default([]),
    }),
};

const rollbackPromotion = {
    body: Joi.object({
        fromYearId: Joi.number().integer().positive().required(),
        toYearId: Joi.number().integer().positive().required(),
        confirmation: Joi.string().valid("ROLLBACK").required()
            .messages({ "any.only": "Type ROLLBACK to confirm the rollback" }),
    }),
};

const getHistory = {
    params: Joi.object({
        studentId: Joi.number().integer().positive().required(),
    }),
};

module.exports = {
    createAcademicYear,
    updateAcademicYear,
    createPromotionRule,
    updatePromotionRule,
    deletePromotionRule,
    executePromotion,
    rollbackPromotion,
    getHistory,
};
