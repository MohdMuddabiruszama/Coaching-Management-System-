/**
 * ✅ Phase 7: Salary Validation Schemas
 * Fixed: field names now match what the frontend actually sends
 *   - basic_salary (not base_salary)
 *   - allowances (not bonus)
 *   - advance_paid, working_days, present_days (were missing entirely)
 *   - faculty_id accepts string (from <select>) or number
 */
const Joi = require("joi");
const { idParam, pagination } = require("./common.schemas");

const createSalary = {
    body: Joi.object({
        // faculty_id comes as a string from the <select> element
        faculty_id: Joi.alternatives().try(
            Joi.number().integer().positive(),
            Joi.string().pattern(/^\d+$/)
        ).required()
            .messages({ "any.required": "Faculty is required" }),

        month_year: Joi.string().pattern(/^\d{4}-\d{2}$/).required()
            .messages({ "string.pattern.base": "Month must be YYYY-MM format", "any.required": "Month is required" }),

        // Frontend uses basic_salary (not base_salary)
        basic_salary: Joi.alternatives().try(
            Joi.number().min(0).max(10000000),
            Joi.string().pattern(/^\d+(\.\d{1,2})?$/)
        ).required()
            .messages({ "any.required": "Basic salary is required" }),

        // Frontend uses allowances (not bonus)
        allowances: Joi.alternatives().try(
            Joi.number().min(0),
            Joi.string().pattern(/^\d+(\.\d{1,2})?$/)
        ).optional().allow("", null).default(0),

        deductions: Joi.alternatives().try(
            Joi.number().min(0),
            Joi.string().pattern(/^\d+(\.\d{1,2})?$/)
        ).optional().allow("", null).default(0),

        // Advance payment before salary disbursement
        advance_paid: Joi.alternatives().try(
            Joi.number().min(0),
            Joi.string().pattern(/^\d+(\.\d{1,2})?$/)
        ).optional().allow("", null).default(0),

        // Attendance-based fields for pro-rata calculation
        working_days: Joi.alternatives().try(
            Joi.number().integer().min(1).max(31),
            Joi.string().pattern(/^\d+$/)
        ).optional().default(26),

        present_days: Joi.alternatives().try(
            Joi.number().integer().min(0).max(31),
            Joi.string().pattern(/^\d+$/)
        ).optional().default(26),

        // Optionally override net salary (if not auto-calculated)
        net_salary: Joi.alternatives().try(
            Joi.number().min(0),
            Joi.string().pattern(/^\d+(\.\d{1,2})?$/)
        ).optional().allow("", null),

        remarks: Joi.string().max(500).optional().allow("", null),
    }),
};

const getSalaries = {
    query: pagination.keys({
        faculty_id: Joi.alternatives().try(
            Joi.number().integer().positive(),
            Joi.string().pattern(/^\d+$/)
        ).optional(),
        month_year: Joi.string().pattern(/^\d{4}-\d{2}$/).optional(),
        status: Joi.string().valid("pending", "paid", "on_hold").optional(),
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
        payment_method: Joi.string().max(50).optional().allow("", null),
        transaction_ref: Joi.string().max(200).optional().allow("", null),
    }).optional(),
};

const updateSalary = {
    params: idParam,
    body: Joi.object({
        basic_salary: Joi.alternatives().try(
            Joi.number().min(0).max(10000000),
            Joi.string().pattern(/^\d+(\.\d{1,2})?$/)
        ).optional(),
        allowances: Joi.alternatives().try(
            Joi.number().min(0),
            Joi.string().pattern(/^\d+(\.\d{1,2})?$/)
        ).optional().allow("", null),
        deductions: Joi.alternatives().try(
            Joi.number().min(0),
            Joi.string().pattern(/^\d+(\.\d{1,2})?$/)
        ).optional().allow("", null),
        advance_paid: Joi.alternatives().try(
            Joi.number().min(0),
            Joi.string().pattern(/^\d+(\.\d{1,2})?$/)
        ).optional().allow("", null),
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
        remarks: Joi.string().max(500).optional().allow("", null),
        // Also allow old field names for backward compat
        faculty_id: Joi.alternatives().try(
            Joi.number().integer().positive(),
            Joi.string().pattern(/^\d+$/)
        ).optional(),
        month_year: Joi.string().pattern(/^\d{4}-\d{2}$/).optional(),
    }),
};

const deleteSalary = { params: idParam };

module.exports = { createSalary, getSalaries, getSalaryReport, paySalary, updateSalary, deleteSalary };
