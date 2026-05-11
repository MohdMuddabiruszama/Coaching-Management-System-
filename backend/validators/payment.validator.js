/**
 * ✅ Phase 7: Payment Validation Schemas
 * Joi schemas for Razorpay payment initiation & verification.
 */
const Joi = require("joi");

const initiatePayment = {
    body: Joi.object({
        planId: Joi.number().integer().positive().required()
            .messages({ "any.required": "Plan ID is required" }),
        billingCycle: Joi.string().valid("monthly", "yearly").default("monthly"),
        coupon_code: Joi.string().max(50).optional().allow("", null),
        testMode: Joi.boolean().optional(),
    }),
};

const verifyPayment = {
    body: Joi.object({
        razorpay_order_id: Joi.string().min(5).max(100).required(),
        razorpay_payment_id: Joi.string().min(5).max(100).required(),
        razorpay_signature: Joi.string().min(10).max(256).required(),
        planId: Joi.number().integer().positive().required(),
        billingCycle: Joi.string().valid("monthly", "yearly").default("monthly"),
    }),
};

const createFeeOrder = {
    body: Joi.object({
        student_fee_id: Joi.number().integer().positive().required(),
        amount: Joi.number().positive().max(10000000).required()
            .messages({ "number.positive": "Amount must be positive" }),
        testMode: Joi.boolean().optional(),
    }),
};

const verifyFeePayment = {
    body: Joi.object({
        razorpay_order_id: Joi.string().min(5).max(100).required(),
        razorpay_payment_id: Joi.string().min(5).max(100).required(),
        razorpay_signature: Joi.string().min(10).max(256).required(),
        student_fee_id: Joi.number().integer().positive().required(),
        amount: Joi.number().positive().max(10000000).required(),
    }),
};

module.exports = {
    initiatePayment,
    verifyPayment,
    createFeeOrder,
    verifyFeePayment,
};
