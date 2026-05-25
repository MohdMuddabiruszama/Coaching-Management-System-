/**
 * ✅ Phase 7: Fees Validation Schemas
 * Joi schemas for fee structure, payment, and discount endpoints.
 */
const Joi = require("joi");
const { idParam, pagination, feeTypeEnum, paymentMethodEnum, dateISO } = require("./common.schemas");

const createStructure = {
    body: Joi.object({
        class_id: Joi.number().integer().positive().required()
            .messages({ "any.required": "Class ID is required" }),
        subject_id: Joi.alternatives().try(
            Joi.number().integer().positive(),
            Joi.string().valid("", "null")
        ).optional().allow(null, ""),
        individual_student_id: Joi.alternatives().try(
            Joi.number().integer().positive(),
            Joi.string().valid("", "null")
        ).optional().allow(null, ""),
        student_target: Joi.string().valid("all", "individual").optional().default("all"),
        fee_type: feeTypeEnum,
        amount: Joi.alternatives().try(
            Joi.number().positive().max(10000000),
            Joi.string().pattern(/^\d+(\.\d{1,2})?$/)
        ).required()
            .messages({ "any.required": "Amount is required" }),
        due_date: dateISO.required()
            .messages({ "any.required": "Due date is required" }),
        description: Joi.string().max(500).optional().allow("", null),
    }),
};

const updateStructure = {
    params: idParam,
    body: Joi.object({
        class_id: Joi.number().integer().positive().optional(),
        subject_id: Joi.number().integer().positive().optional().allow(null),
        individual_student_id: Joi.number().integer().positive().optional().allow(null),
        fee_type: Joi.string().valid("Tuition Fee", "Exam Fee", "Library Fee", "Transport Fee", "Other").optional(),
        amount: Joi.number().positive().max(10000000).optional(),
        due_date: dateISO.optional(),
        description: Joi.string().max(500).optional().allow("", null),
    }),
};

const deleteStructure = {
    params: idParam,
};

const getStructures = {
    query: Joi.object({
        class_id: Joi.number().integer().positive().optional(),
    }),
};

const recordPayment = {
    body: Joi.object({
        student_id: Joi.alternatives().try(
            Joi.number().integer().positive(),
            Joi.string().pattern(/^\d+$/)
        ).optional().allow(null), // Optional for student self-pay; also sent as string from some clients
        fee_structure_id: Joi.alternatives().try(
            Joi.number().integer().positive(),
            Joi.string().pattern(/^\d+$/)
        ).optional().allow(null), // Optional — dummy fees have no fee_structure_id
        amount: Joi.alternatives().try(
            Joi.number().positive().max(10000000),
            Joi.string().pattern(/^\d+(\.\d{1,2})?$/)
        ).required()
            .messages({ "any.required": "Payment amount is required", "alternatives.match": "Payment amount must be a positive number" }),
        payment_method: paymentMethodEnum,
        transaction_id: Joi.string().max(100).optional().allow("", null),
        payment_date: Joi.alternatives().try(dateISO, Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)).optional(),
        remarks: Joi.string().max(500).optional().allow("", null),
        reminder_date: Joi.alternatives().try(dateISO, Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)).optional().allow(null, ""),
    }),
};

const getPayments = {
    query: pagination.keys({
        student_id: Joi.number().integer().positive().optional(),
    }),
};

const getStudentPayments = {
    params: Joi.object({
        student_id: Joi.number().integer().positive().required(),
    }),
};

const applyDiscount = {
    body: Joi.object({
        student_fee_id: Joi.number().integer().positive().required(),
        discount_amount: Joi.number().positive().max(10000000).required()
            .messages({ "number.positive": "Discount must be positive" }),
        reason: Joi.string().max(300).optional().allow("", null),
    }),
};

const updateReminder = {
    params: idParam,
    body: Joi.object({
        reminder_date: dateISO.required(),
    }),
};

module.exports = {
    createStructure,
    updateStructure,
    deleteStructure,
    getStructures,
    recordPayment,
    getPayments,
    getStudentPayments,
    applyDiscount,
    updateReminder,
};
