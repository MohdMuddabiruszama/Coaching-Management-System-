/**
 * ✅ Phase 7: Salary Validation Schemas
 */
const Joi = require("joi");
const { idParam, pagination, dateISO } = require("./common.schemas");

const createSalary = {
    body: Joi.object({
        faculty_id: Joi.number().integer().positive().required(),
        month_year: Joi.string().pattern(/^\d{4}-\d{2}$/).required()
            .messages({ "string.pattern.base": "Month must be YYYY-MM format" }),
        base_salary: Joi.number().min(0).max(10000000).required(),
        bonus: Joi.number().min(0).optional().default(0),
        deductions: Joi.number().min(0).optional().default(0),
        net_salary: Joi.number().min(0).optional(),
        payment_method: Joi.string().max(50).optional().allow("", null),
        remarks: Joi.string().max(500).optional().allow("", null),
    }),
};

const getSalaries = {
    query: pagination.keys({
        faculty_id: Joi.number().integer().positive().optional(),
        month_year: Joi.string().pattern(/^\d{4}-\d{2}$/).optional(),
        status: Joi.string().valid("pending", "paid", "on_hold").optional(),
    }),
};

const getSalaryReport = {
    query: Joi.object({
        month_year: Joi.string().pattern(/^\d{4}-\d{2}$/).optional(),
    }),
};

const paySalary = { params: idParam };

const updateSalary = {
    params: idParam,
    body: Joi.object({
        base_salary: Joi.number().min(0).max(10000000).optional(),
        bonus: Joi.number().min(0).optional(),
        deductions: Joi.number().min(0).optional(),
        net_salary: Joi.number().min(0).optional(),
        payment_method: Joi.string().max(50).optional().allow("", null),
        remarks: Joi.string().max(500).optional().allow("", null),
    }),
};

const deleteSalary = { params: idParam };

module.exports = { createSalary, getSalaries, getSalaryReport, paySalary, updateSalary, deleteSalary };
