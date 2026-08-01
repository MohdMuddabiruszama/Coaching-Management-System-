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

const updatePeriod = {
    params: idParam,
    body: Joi.object({
        start_date: dateISO.required(),
        end_date: dateISO.required(),
    }),
};

const toggleTest = {
    params: idParam,
    body: Joi.object({
        is_test: Joi.boolean().required(),
    }),
};

const markPaid = {
    params: idParam,
};

const deleteSubscription = {
    params: idParam,
};

const exportData = {
    query: Joi.object({
        format: Joi.string().valid("excel", "pdf").optional(),
        status: paymentStatusEnum.optional(),
        search: Joi.string().allow("").optional(),
        startDate: dateISO.optional(),
        endDate: dateISO.optional(),
    }),
};

module.exports = {
    createSubscription,
    getAllSubscriptions,
    updateStatus,
    updatePeriod,
    toggleTest,
    markPaid,
    deleteSubscription,
    exportData,
};
