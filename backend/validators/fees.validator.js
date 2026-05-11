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
        subject_id: Joi.number().integer().positive().optional().allow(null),
        individual_student_id: Joi.number().integer().positive().optional().allow(null),
        fee_type: feeTypeEnum,
        amount: Joi.number().positive().max(10000000).required()
            .messages({ "number.positive": "Amount must be greater than 0" }),
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
        student_id: Joi.number().integer().positive().optional(), // Optional for student self-pay
        fee_structure_id: Joi.number().integer().positive().required(),
        amount: Joi.number().positive().max(10000000).required()
            .messages({ "number.positive": "Payment amount must be positive" }),
        payment_method: paymentMethodEnum,
        transaction_id: Joi.string().max(100).optional().allow("", null),
        payment_date: dateISO.optional(),
        remarks: Joi.string().max(500).optional().allow("", null),
        reminder_date: dateISO.optional().allow(null),
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
