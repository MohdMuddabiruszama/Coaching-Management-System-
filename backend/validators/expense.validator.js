/**
 * ✅ Phase 7: Expense Validation Schemas
 * Fixed: added `title`, renamed `expense_date` → `date`, accept amount as string OR number
 */
const Joi = require("joi");
const { idParam, dateISO } = require("./common.schemas");

const addExpense = {
    body: Joi.object({
        title: Joi.string().trim().min(1).max(255).required()
            .messages({
                "string.empty": "Expense title is required",
                "any.required": "Expense title is required"
            }),
        category: Joi.string().trim().min(1).max(100).required()
            .messages({
                "string.empty": "Expense category is required",
                "any.required": "Expense category is required"
            }),
        amount: Joi.alternatives().try(
            Joi.number().positive().max(100000000),
            Joi.string().pattern(/^\d+(\.\d{1,2})?$/)
        ).required()
            .messages({ "any.required": "Amount is required" }),
        date: Joi.alternatives().try(
            dateISO,
            Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)
        ).optional().allow(null, ""),
        description: Joi.string().max(500).optional().allow("", null),
    }),
};

const getExpenses = {
    query: Joi.object({
        period: Joi.string().valid("current_month", "month", "year", "all").optional(),
        dateValue: Joi.string().optional().allow(""),
        category: Joi.string().max(100).optional().allow(""),
        start_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
        end_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(100).optional(),
        search: Joi.string().max(200).optional().allow(""),
        sortBy: Joi.string().max(50).optional(),
        order: Joi.string().valid("ASC", "DESC", "asc", "desc").optional(),
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
