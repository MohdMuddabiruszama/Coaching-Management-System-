const { TimetableSlot, Timetable } = require("../models");

// Simple in-memory cache for Timetable Slots: instituteId -> { classId: [...slots], facultyId: [...slots] }
let cache = {
    classes: {},
    faculties: {}
};

/**
 * Preloads today's timetable slots into memory. Can be called on server boot or lazily.
 */
const preloadTimetable = async (instituteId, dateObj) => {
    const dayOfWeek = dateObj.toLocaleDateString("en-US", { weekday: "long" });

    // Fetch all slots for this institute and weekday
    const timetables = await Timetable.findAll({
        where: { institute_id: instituteId, day_of_week: dayOfWeek },
        include: [{ model: TimetableSlot }]
    });

    if (!cache.classes[instituteId]) cache.classes[instituteId] = {};
    if (!cache.faculties[instituteId]) cache.faculties[instituteId] = {};

    timetables.forEach(t => {
        if (!t.TimetableSlot) return;

        const slotData = {
            id: t.id, // Timetable entry ID
            start: t.TimetableSlot.start_time,
            end: t.TimetableSlot.end_time,
            classId: t.class_id,
            facultyId: t.faculty_id
        };

        // Cache by class
        if (t.class_id) {
            if (!cache.classes[instituteId][t.class_id]) cache.classes[instituteId][t.class_id] = [];
            cache.classes[instituteId][t.class_id].push(slotData);
        }

        // Cache by faculty
        if (t.faculty_id) {
            if (!cache.faculties[instituteId][t.faculty_id]) cache.faculties[instituteId][t.faculty_id] = [];
            cache.faculties[instituteId][t.faculty_id].push(slotData);
        }
    });
};

/**
 * Gets the current period entry ID for a class or faculty. O(1) via in-memory cache.
 */
const getCurrentPeriod = (instituteId, classId, facultyId, dateObj) => {
    // Basic time string comparison (HH:MM:SS)
    const now = dateObj || new Date();
    const timeStr = now.toTimeString().split(" ")[0]; // "HH:MM:SS"

    let slots = [];
    if (classId && cache.classes[instituteId]?.[classId]) {
        slots = cache.classes[instituteId][classId];
    } else if (facultyId && cache.faculties[instituteId]?.[facultyId]) {
        slots = cache.faculties[instituteId][facultyId];
    }

    const currentSlot = slots.find(s => timeStr >= s.start && timeStr <= s.end);
    return currentSlot || null;
};

/**
 * Invalidates cache for a specific institute (e.g. on timetable edit)
 */
const invalidateCache = (instituteId) => {
    delete cache.classes[instituteId];
    delete cache.faculties[instituteId];
};

module.exports = {
    preloadTimetable,
    getCurrentPeriod,
    invalidateCache
};
