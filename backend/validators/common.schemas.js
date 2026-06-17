/**
 * ✅ Phase 7: Common Joi Schema Fragments
 * Reusable building blocks shared across all validators.
 * Centralises patterns like IDs, pagination, emails, dates, etc.
 */
const Joi = require("joi");

// ── Primitives ───────────────────────────────────────────
const id = Joi.number().integer().positive();
const idRequired = id.required();
const idOptional = id.optional();

const stringTrimmed = (min = 1, max = 255) =>
    Joi.string().trim().min(min).max(max);

const email = Joi.string().email().trim().lowercase();

const phone = Joi.string()
    .pattern(/^[0-9]{10,15}$/)
    .messages({ "string.pattern.base": "Phone must be 10-15 digits" });

const dateISO = Joi.date().iso();

const booleanField = Joi.boolean();

// ── Pagination & Filtering (query params) ────────────────
const pagination = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(10000).default(10),
    search: Joi.string().max(200).allow("").default(""),
    cursor: Joi.number().integer().positive().optional(),
    sortBy: Joi.string().max(50).optional(),
    order: Joi.string().valid("ASC", "DESC", "asc", "desc").default("DESC"),
});

// Extended pagination with common filters
const paginationWithFilters = pagination.keys({
    class_id: idOptional,
    subject_id: idOptional,
    student_id: idOptional,
    status: Joi.string().max(30).optional(),
});

// ── Route Params ─────────────────────────────────────────
const idParam = Joi.object({
    id: idRequired.messages({ "any.required": "ID parameter is required" }),
});

const studentIdParam = Joi.object({
    student_id: idRequired,
});

const classSubjectDateParams = Joi.object({
    class_id: idRequired,
    subject_id: idRequired,
    date: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .required()
        .messages({ "string.pattern.base": "Date must be YYYY-MM-DD" }),
});

// ── Enums ────────────────────────────────────────────────
const genderEnum = Joi.string()
    .valid("male", "female", "other", "Male", "Female", "Other")
    .optional()
    .allow("", null);

const paymentMethodEnum = Joi.string()
    .valid(
        // Capitalized (canonical)
        "Cash", "UPI", "Credit Card", "Debit Card", "Net Banking", "Cheque", "Online", "Other",
        // Lowercase (sent by frontend buttons)
        "cash", "online", "cheque", "upi", "credit_card", "debit_card", "net_banking", "other"
    )
    .default("cash");

const feeTypeEnum = Joi.string()
    .valid("Tuition Fee", "Exam Fee", "Library Fee", "Transport Fee", "Other")
    .required();

const attendanceStatusEnum = Joi.string()
    .valid("present", "absent", "late", "half_day", "holiday")
    .required();

const paymentStatusEnum = Joi.string()
    .valid("pending", "paid", "failed", "unpaid", "refunded")
    .optional();

module.exports = {
    id,
    idRequired,
    idOptional,
    stringTrimmed,
    email,
    phone,
    dateISO,
    booleanField,
    pagination,
    paginationWithFilters,
    idParam,
    studentIdParam,
    classSubjectDateParams,
    genderEnum,
    paymentMethodEnum,
    feeTypeEnum,
    attendanceStatusEnum,
    paymentStatusEnum,
};
