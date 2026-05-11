/**
 * ✅ Phase 7: Timetable Validation Schemas
 */
const Joi = require("joi");
const { idParam } = require("./common.schemas");

const createSlot = {
    body: Joi.object({
        label: Joi.string().trim().max(50).optional().allow("", null),
        start_time: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
        end_time: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
        slot_type: Joi.string().valid("lecture", "break", "lab").optional().default("lecture"),
    }),
};

const deleteSlot = { params: idParam };

const createEntry = {
    body: Joi.object({
        class_id: Joi.number().integer().positive().required(),
        subject_id: Joi.number().integer().positive().required(),
        faculty_id: Joi.number().integer().positive().optional().allow(null),
        slot_id: Joi.number().integer().positive().required(),
        day: Joi.string().valid("Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday").required(),
        room: Joi.string().max(50).optional().allow("", null),
    }),
};

const updateEntry = { params: idParam, body: createEntry.body };
const deleteEntry = { params: idParam };

const getByClass = {
    params: Joi.object({ class_id: Joi.number().integer().positive().required() }),
};
const getByFaculty = {
    params: Joi.object({ faculty_id: Joi.number().integer().positive().required() }),
};

module.exports = { createSlot, deleteSlot, createEntry, updateEntry, deleteEntry, getByClass, getByFaculty };
