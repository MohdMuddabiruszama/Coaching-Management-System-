/**
 * ✅ Phase 7: Subscription Validation Schemas
 */
const Joi = require("joi");
const { idParam, pagination, dateISO, paymentStatusEnum } = require("./common.schemas");

const createSubscription = {
    body: Joi.object({
        institute_id: Joi.number().integer().positive().required(),
        plan_id: Joi.number().integer().positive().required(),
        amount_paid: Joi.number().min(0).optional(),
        discount_amount: Joi.number().min(0).optional().default(0),
        subscription_start: dateISO.required(),
        subscription_end: dateISO.required(),
    }),
};

const getAllSubscriptions = {
    query: pagination.keys({
        status: paymentStatusEnum,
    }),
};

const updateStatus = {
    params: idParam,
    body: Joi.object({
        payment_status: Joi.string()
            .valid("pending", "paid", "failed", "unpaid", "refunded")
            .required(),
    }),
};

module.exports = {
    createSubscription,
    getAllSubscriptions,
    updateStatus,
};
