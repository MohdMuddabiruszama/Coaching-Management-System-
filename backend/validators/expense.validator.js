/**
 * ✅ Phase 7: Expense Validation Schemas
 */
const Joi = require("joi");
const { idParam, pagination, dateISO } = require("./common.schemas");

const addExpense = {
    body: Joi.object({
        category: Joi.string().trim().min(1).max(100).required()
            .messages({ "string.empty": "Expense category is required" }),
        amount: Joi.number().positive().max(100000000).required(),
        description: Joi.string().max(500).optional().allow("", null),
        expense_date: dateISO.optional(),
        payment_method: Joi.string().max(50).optional().allow("", null),
        vendor: Joi.string().max(200).optional().allow("", null),
        receipt_number: Joi.string().max(100).optional().allow("", null),
    }),
};

const getExpenses = {
    query: pagination.keys({
        category: Joi.string().max(100).optional(),
        start_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
        end_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }),
};

const deleteExpense = {
    params: idParam,
};

module.exports = {
    addExpense,
    getExpenses,
    deleteExpense,
};
