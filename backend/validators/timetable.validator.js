/**
 * ✅ Phase 7: Timetable Validation Schemas
 * Fixed:
 *   - createEntry: `day` → `day_of_week` (matches frontend + controller)
 *   - createEntry: `room` → `room_number` (matches frontend + controller)
 *   - All ID fields now accept string OR number (from <select> elements)
 *   - createSlot: start_time/end_time pattern accepts HH:MM or HH:MM:SS (browser sends both)
 *   - getByClass / getByFaculty: params are strings in URL, accept string or number
 */
const Joi = require("joi");
const { idParam } = require("./common.schemas");

// Accept string or number for IDs (browser <select> always sends strings)
const idField = (required = true) => {
    const base = Joi.alternatives().try(
        Joi.number().integer().positive(),
        Joi.string().pattern(/^\d+$/)
    );
    return required ? base.required() : base.optional().allow("", null);
};

const createSlot = {
    body: Joi.object({
        label: Joi.string().trim().max(50).optional().allow("", null),
        // Browser <input type="time"> sends HH:MM or HH:MM:SS
        start_time: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).required()
            .messages({ "string.pattern.base": "Start time must be in HH:MM format" }),
        end_time: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).required()
            .messages({ "string.pattern.base": "End time must be in HH:MM format" }),
        slot_type: Joi.string().valid("lecture", "break", "lab").optional().default("lecture"),
    }),
};

const deleteSlot = { params: idParam };

const createEntry = {
    body: Joi.object({
        class_id: idField(true),
        subject_id: idField(true),
        faculty_id: idField(false),     // optional in some setups
        slot_id: idField(true),
        // Frontend sends day_of_week (NOT "day")
        day_of_week: Joi.string()
            .valid("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
            .required()
            .messages({ "any.only": "Day must be a valid weekday name" }),
        // Frontend sends room_number (NOT "room")
        room_number: Joi.string().max(50).optional().allow("", null),
    }),
};

const updateEntry = {
    params: idParam,
    body: Joi.object({
        class_id: idField(false),
        subject_id: idField(false),
        faculty_id: idField(false),
        slot_id: idField(false),
        day_of_week: Joi.string()
            .valid("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
            .optional(),
        room_number: Joi.string().max(50).optional().allow("", null),
    }),
};

const deleteEntry = { params: idParam };

// URL params are always strings — accept string or number
const getByClass = {
    params: Joi.object({
        class_id: Joi.alternatives().try(
            Joi.number().integer().positive(),
            Joi.string().pattern(/^\d+$/)
        ).required(),
    }),
};

const getByFaculty = {
    params: Joi.object({
        faculty_id: Joi.alternatives().try(
            Joi.number().integer().positive(),
            Joi.string().valid("me"),
            Joi.string().pattern(/^\d+$/)
        ).required(),
    }),
};

module.exports = { createSlot, deleteSlot, createEntry, updateEntry, deleteEntry, getByClass, getByFaculty };
