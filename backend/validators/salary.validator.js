/**
 * ✅ Salary Validation Schemas — Updated Phase 8
 * Faculty Salary.md — added payment_due_date, payment_date, remarks to paySalary
 * Added settingsSchema for faculty salary settings
 */
const Joi = require("joi");
const { idParam, pagination } = require("./common.schemas");

// Reusable: monetary value (number or numeric string), non-negative, 2 decimal places
const money = Joi.alternatives().try(
    Joi.number().min(0).precision(2).max(10000000),
    Joi.string().pattern(/^\d+(\.\d{1,2})?$/).custom(v => parseFloat(v))
).optional().allow("", null).default(0);

const createSalary = {
    body: Joi.object({
        // faculty_id comes as a string from <select> or number from API
        faculty_id: Joi.alternatives().try(
            Joi.number().integer().positive(),
            Joi.string().pattern(/^\d+$/)
        ).required()
            .messages({ "any.required": "Faculty is required" }),

        month_year: Joi.string().pattern(/^\d{4}-\d{2}$/).required()
            .messages({
                "string.pattern.base": "Month must be YYYY-MM format",
                "any.required":        "Month is required"
            }),

        basic_salary: Joi.alternatives().try(
            Joi.number().min(0.01).max(10000000),
            Joi.string().pattern(/^\d+(\.\d{1,2})?$/)
        ).required()
            .messages({ "any.required": "Basic salary is required" }),

        allowances:   money,
        deductions:   money,
        advance_paid: money,

        working_days: Joi.alternatives().try(
            Joi.number().integer().min(1).max(31),
            Joi.string().pattern(/^\d+$/)
        ).optional().default(26),

        present_days: Joi.alternatives().try(
            Joi.number().integer().min(0).max(31),
            Joi.string().pattern(/^\d+$/)
        ).optional().default(26),

        // ── Phase 8 new fields ──────────────────────────────────────────────
        payment_due_date: Joi.date().iso().optional().allow("", null),
        remarks:          Joi.string().max(500).optional().allow("", null),

        // Optionally override net_salary (if not auto-calculated)
        net_salary: Joi.alternatives().try(
            Joi.number().min(0),
            Joi.string().pattern(/^\d+(\.\d{1,2})?$/)
        ).optional().allow("", null),
    }),
};

const getSalaries = {
    query: pagination.keys({
        faculty_id: Joi.alternatives().try(
            Joi.number().integer().positive(),
            Joi.string().pattern(/^\d+$/)
        ).optional(),
        month_year: Joi.string().pattern(/^\d{4}-\d{2}$/).optional(),
        status:     Joi.string().valid("pending", "paid", "on_hold").optional(),
    }),
};

const getSalaryReport = {
    query: Joi.object({
        month_year: Joi.string().pattern(/^\d{4}-\d{2}$/).optional(),
    }),
};

const paySalary = {
    params: idParam,
    body: Joi.object({
        payment_method:  Joi.string().valid("cash", "bank_transfer", "upi", "cheque").optional().allow("", null),
        transaction_ref: Joi.string().max(200).optional().allow("", null),
        // ── Phase 8: specific payment date + remarks ─────────────────────────
        payment_date:    Joi.date().iso().optional().allow("", null),
        remarks:         Joi.string().max(500).optional().allow("", null),
    }).optional(),
};

const updateSalary = {
    params: idParam,
    body: Joi.object({
        basic_salary: Joi.alternatives().try(
            Joi.number().min(0).max(10000000),
            Joi.string().pattern(/^\d+(\.\d{1,2})?$/)
        ).optional(),
        allowances:   money,
        deductions:   money,
        advance_paid: money,
        working_days: Joi.alternatives().try(
            Joi.number().integer().min(1).max(31),
            Joi.string().pattern(/^\d+$/)
        ).optional(),
        present_days: Joi.alternatives().try(
            Joi.number().integer().min(0).max(31),
            Joi.string().pattern(/^\d+$/)
        ).optional(),
        net_salary: Joi.alternatives().try(
            Joi.number().min(0),
            Joi.string().pattern(/^\d+(\.\d{1,2})?$/)
        ).optional().allow("", null),
        payment_method: Joi.string().max(50).optional().allow("", null),
        status:         Joi.string().valid("pending", "on_hold").optional(), // 'paid' only via /pay
        // ── Phase 8 new fields ──────────────────────────────────────────────
        payment_due_date: Joi.date().iso().optional().allow("", null),
        remarks:          Joi.string().max(500).optional().allow("", null),
        // Backward compat
        faculty_id: Joi.alternatives().try(
            Joi.number().integer().positive(),
            Joi.string().pattern(/^\d+$/)
        ).optional(),
        month_year: Joi.string().pattern(/^\d{4}-\d{2}$/).optional(),
    }),
};

const deleteSalary = { params: idParam };

// ── Phase 8: Salary Settings Schema ─────────────────────────────────────────
const settingsSchema = {
    body: Joi.object({
        faculty_id: Joi.alternatives().try(
            Joi.number().integer().positive(),
            Joi.string().pattern(/^\d+$/)
        ).required().messages({ "any.required": "Faculty is required" }),

        basic_salary: Joi.alternatives().try(
            Joi.number().min(0.01).max(10000000),
            Joi.string().pattern(/^\d+(\.\d{1,2})?$/)
        ).required().messages({ "any.required": "Basic salary is required" }),

        allowances: money,

        salary_due_day: Joi.alternatives().try(
            Joi.number().integer().min(1).max(28),
            Joi.string().pattern(/^\d+$/)
        ).optional().default(5)
            .messages({ "number.max": "salary_due_day must be 1–28 (28 is safe for all months)" }),

        working_days_default: Joi.alternatives().try(
            Joi.number().integer().min(1).max(31),
            Joi.string().pattern(/^\d+$/)
        ).optional().default(26),
    }),
};

module.exports = {
    createSalary, getSalaries, getSalaryReport,
    paySalary, updateSalary, deleteSalary,
    settingsSchema,
};
