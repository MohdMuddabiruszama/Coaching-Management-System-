const { Timetable, TimetableSlot, Class, Subject, Faculty, User } = require("../models");
const { Op } = require("sequelize");

// --- SLOT MANAGEMENT ---

exports.createSlot = async (req, res) => {
    try {
        const { start_time, end_time, class_id } = req.body;
        const institute_id = req.user.institute_id;

        if (!class_id) {
            return res.status(400).json({ success: false, message: "class_id is required" });
        }

        const slot = await TimetableSlot.create({
            institute_id,
            class_id,
            start_time,
            end_time
        });

        res.status(201).json({ success: true, message: "Slot created successfully", data: slot });
    } catch (error) {
        console.error("Error creating slot:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

exports.getSlots = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const { class_id } = req.query;
        
        let whereClause = { institute_id };
        if (class_id) {
            whereClause.class_id = class_id;
        }

        const slots = await TimetableSlot.findAll({
            where: whereClause,
            order: [['start_time', 'ASC']]
        });
        res.status(200).json({ success: true, data: slots });
    } catch (error) {
        console.error("Error fetching slots:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

exports.deleteSlot = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;

        // Check if slot is in use
        const existingTimetable = await Timetable.findOne({ where: { slot_id: id, institute_id } });
        if (existingTimetable) {
            return res.status(400).json({ success: false, message: "Cannot delete slot, it is being used in the timetable" });
        }

        const deleted = await TimetableSlot.destroy({ where: { id, institute_id } });
        if (!deleted) {
            return res.status(404).json({ success: false, message: "Slot not found" });
        }

        res.status(200).json({ success: true, message: "Slot deleted successfully" });
    } catch (error) {
        console.error("Error deleting slot:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// --- TIMETABLE MANAGEMENT ---

exports.createTimetableEntry = async (req, res) => {
    try {
        const { class_id, subject_id, faculty_id, slot_id, day_of_week, room_number, is_break, break_label } = req.body;
        const institute_id = req.user.institute_id;
        const isBreak = is_break === true || is_break === 'true';

        const newSlot = await TimetableSlot.findOne({ where: { id: slot_id, institute_id } });
        if (!newSlot) {
            return res.status(404).json({ success: false, message: "Selected time slot not found." });
        }

        // Validation 1: No Double Class Booking (Time Overlap) — applies to all types including breaks
        const classConflict = await Timetable.findOne({
            where: { institute_id, class_id, day_of_week },
            include: [{
                model: TimetableSlot,
                required: true,
                where: {
                    start_time: { [Op.lt]: newSlot.end_time },
                    end_time: { [Op.gt]: newSlot.start_time }
                }
            }]
        });
        if (classConflict) {
            return res.status(400).json({ success: false, message: "Conflicts: This class already has an entry during this time period." });
        }

        // Validation 2: No Faculty Double Booking — only for non-break entries
        if (!isBreak && faculty_id) {
            const facultyConflict = await Timetable.findOne({
                where: { institute_id, faculty_id, day_of_week, is_break: false },
                include: [{
                    model: TimetableSlot,
                    required: true,
                    where: {
                        start_time: { [Op.lt]: newSlot.end_time },
                        end_time: { [Op.gt]: newSlot.start_time }
                    }
                }]
            });
            if (facultyConflict) {
                return res.status(400).json({ success: false, message: "Conflicts: This faculty is already assigned to another class during this time period." });
            }
        }

        const timetable = await Timetable.create({
            institute_id,
            class_id,
            subject_id: isBreak ? null : subject_id,
            faculty_id: isBreak ? null : faculty_id,
            slot_id,
            day_of_week,
            room_number: isBreak ? null : room_number,
            is_break: isBreak,
            break_label: isBreak ? (break_label || 'Break') : null,
            created_by: req.user.id
        });

        res.status(201).json({ success: true, message: "Timetable entry created successfully", data: timetable });
    } catch (error) {
        console.error("Error creating timetable entry:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

exports.deleteTimetableEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;

        const deleted = await Timetable.destroy({ where: { id, institute_id } });
        if (!deleted) {
            return res.status(404).json({ success: false, message: "Timetable entry not found" });
        }

        res.status(200).json({ success: true, message: "Timetable entry deleted successfully" });
    } catch (error) {
        console.error("Error deleting timetable entry:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

exports.getTimetableByClass = async (req, res) => {
    try {
        const { class_id } = req.params;
        const institute_id = req.user.institute_id;

        const timetables = await Timetable.findAll({
            where: { institute_id, class_id },
            include: [
                { model: Subject, attributes: ['id', 'name'] },
                { model: Faculty, attributes: ['id'], include: [{ model: User, attributes: ['name'] }] },
                { model: TimetableSlot, attributes: ['id', 'start_time', 'end_time'] }
            ]
        });

        res.status(200).json({ success: true, data: timetables });
    } catch (error) {
        console.error("Error fetching timetable by class:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

exports.getTimetableByFaculty = async (req, res) => {
    try {
        let { faculty_id } = req.params;
        const institute_id = req.user.institute_id;

        if (faculty_id === 'me') {
            const facultyRecord = await Faculty.findOne({ where: { user_id: req.user.id } });
            if (!facultyRecord) {
                return res.status(404).json({ success: false, message: "Faculty profile not found" });
            }
            faculty_id = facultyRecord.id;
        }

        const timetables = await Timetable.findAll({
            where: { institute_id, faculty_id },
            include: [
                { model: Class, attributes: ['id', 'name', 'section'] },
                { model: Subject, attributes: ['id', 'name'] },
                { model: TimetableSlot, attributes: ['id', 'start_time', 'end_time'] }
            ]
        });

        res.status(200).json({ success: true, data: timetables });
    } catch (error) {
        console.error("Error fetching timetable by faculty:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

exports.updateTimetableEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const { class_id, subject_id, faculty_id, slot_id, day_of_week, room_number } = req.body;
        const institute_id = req.user.institute_id;

        const entry = await Timetable.findOne({ where: { id, institute_id } });
        if (!entry) {
            return res.status(404).json({ success: false, message: "Timetable entry not found" });
        }

        const newSlot = await TimetableSlot.findOne({ where: { id: slot_id, institute_id } });
        if (!newSlot) {
            return res.status(404).json({ success: false, message: "Selected time slot not found." });
        }

        // Validation 1: No Double Class Booking (exclude current entry, Time Overlap)
        const classConflict = await Timetable.findOne({
            where: { institute_id, class_id, day_of_week, id: { [Op.ne]: id } },
            include: [{
                model: TimetableSlot,
                required: true,
                where: {
                    start_time: { [Op.lt]: newSlot.end_time },
                    end_time: { [Op.gt]: newSlot.start_time }
                }
            }]
        });
        if (classConflict) {
            return res.status(400).json({ success: false, message: "Conflicts: This class already has a subject assigned during this time period." });
        }

        // Validation 2: No Faculty Double Booking (exclude current entry, Time Overlap)
        if (faculty_id) {
            const facultyConflict = await Timetable.findOne({
                where: { institute_id, faculty_id, day_of_week, id: { [Op.ne]: id } },
                include: [{
                    model: TimetableSlot,
                    required: true,
                    where: {
                        start_time: { [Op.lt]: newSlot.end_time },
                        end_time: { [Op.gt]: newSlot.start_time }
                    }
                }]
            });
            if (facultyConflict) {
                return res.status(400).json({ success: false, message: "Conflicts: This faculty is already assigned to another class during this time period." });
            }
        }

        await entry.update({
            class_id, subject_id, faculty_id, slot_id, day_of_week, room_number
        });

        res.status(200).json({ success: true, message: "Timetable entry updated successfully", data: entry });
    } catch (error) {
        console.error("Error updating timetable entry:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

