const { FacultyAttendance, Faculty, User, Institute } = require("../models");
const { Op } = require("sequelize");
const crypto = require("crypto");

// Store active QR tokens in memory for simplicity (in a real app, use Redis or DB table)
const activeSessions = new Map();

/**
 * Generate QR code for Faculty Attendance
 * @route POST /api/faculty-attendance/generate-qr
 * @access Admin
 */
exports.generateQR = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;

        // Invalidate old tokens for this institute
        for (const [token, data] of activeSessions.entries()) {
            if (data.institute_id === institute_id) {
                activeSessions.delete(token);
            }
        }

        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        activeSessions.set(token, {
            institute_id,
            expiresAt
        });

        res.status(200).json({
            success: true,
            data: {
                token,
                expiresAt
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Mark Faculty Attendance by QR (Scanned by Admin)
 * @route POST /api/faculty-attendance/mark-by-qr
 * @access Admin
 */
exports.markByQR = async (req, res) => {
    try {
        const { qr_code } = req.body;
        const institute_id = req.user.institute_id;
        const today = new Date().toISOString().split('T')[0];

        // Ensure QR code is like FACULTY_QR_123
        if (!qr_code || !qr_code.startsWith("FACULTY_QR_")) {
            return res.status(400).json({ success: false, message: "Invalid QR Code format." });
        }

        const faculty_id = parseInt(qr_code.split("FACULTY_QR_")[1], 10);

        if (isNaN(faculty_id)) { // Check if parsing resulted in a valid number
            return res.status(400).json({ success: false, message: "Invalid Faculty ID in QR Code." });
        }

        const faculty = await Faculty.findOne({ where: { id: faculty_id, institute_id } });
        if (!faculty) {
            return res.status(404).json({ success: false, message: "Faculty profile not found in your institute." });
        }

        const existing = await FacultyAttendance.findOne({
            where: { faculty_id: faculty.id, date: today, institute_id }
        });

        if (existing) {
            return res.status(400).json({ success: false, message: "Your attendance is already marked for today." });
        }

        const attendance = await FacultyAttendance.create({
            institute_id,
            faculty_id: faculty.id,
            date: today,
            status: "present",
            marked_by: req.user.id,
            remarks: "Marked via Admin Scanner"
        });

        res.status(201).json({
            success: true,
            message: "Attendance marked successfully.",
            data: attendance
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get Faculty Attendance Report
 * @route GET /api/faculty-attendance/report
 * @access Admin
 */
exports.getReport = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const institute_id = req.user.institute_id;

        const whereClause = { institute_id };
        if (start_date && end_date) {
            whereClause.date = { [Op.between]: [start_date, end_date] };
        } else {
            const today = new Date().toISOString().split('T')[0];
            whereClause.date = today;
        }

        const attendances = await FacultyAttendance.findAll({
            where: whereClause,
            include: [
                {
                    model: Faculty,
                    include: [{ model: User, attributes: ['name', 'email', 'phone'] }]
                }
            ],
            order: [['date', 'DESC']]
        });

        // Get all faculty to also show absents if looking at a specific date
        // But for simplicity, we just return the records. The frontend can map them if needed.

        res.status(200).json({
            success: true,
            data: attendances
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get Faculty Attendance Grid (Monthly)
 * @route GET /api/faculty-attendance/grid
 * @access Admin
 */
exports.getGrid = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const institute_id = req.user.institute_id;

        if (!start_date || !end_date) {
            return res.status(400).json({ success: false, message: "Missing start_date or end_date" });
        }

        const facultyList = await Faculty.findAll({
            where: { institute_id },
            include: [{ model: User, attributes: ['name', 'email'] }]
        });

        const attendanceRecords = await FacultyAttendance.findAll({
            where: {
                institute_id,
                date: { [Op.between]: [start_date, end_date] }
            },
            order: [['date', 'ASC']]
        });

        const result = facultyList.map(faculty => {
            const facRecords = attendanceRecords.filter(r => r.faculty_id === faculty.id);
            const total = facRecords.length;
            const holidays = facRecords.filter(r => r.status === 'holiday').length;
            const workingDays = total - holidays;
            const present = facRecords.filter(r => r.status === 'present').length;
            const percentage = workingDays > 0 ? ((present / workingDays) * 100).toFixed(2) : 0;

            const daily = {};
            facRecords.forEach(r => { daily[r.date] = r.status; });

            return {
                faculty_id: faculty.id,
                name: faculty.User?.name,
                department: faculty.department || 'Unassigned',
                designation: faculty.designation || 'Unassigned',
                total_days: total,
                working_days: workingDays,
                present_days: present,
                absent_days: facRecords.filter(r => r.status === 'absent').length,
                late_days: facRecords.filter(r => r.status === 'late').length,
                holiday_days: holidays,
                percentage: parseFloat(percentage),
                daily
            };
        });

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Mark bulky/manual attendance
 * @route POST /api/faculty-attendance/manual
 * @access Admin
 */
exports.markManual = async (req, res) => {
    try {
        const { date, attendance_data } = req.body;
        const institute_id = req.user.institute_id;
        const marked_by = req.user.id;

        // Validate date is not in future (allow 24h for timezone differences)
        const clientDate = new Date(date);
        const serverTomorrow = new Date();
        serverTomorrow.setHours(serverTomorrow.getHours() + 24);

        if (clientDate > serverTomorrow) {
            return res.status(400).json({
                success: false,
                message: "Cannot mark attendance for future dates"
            });
        }

        const results = [];
        for (const item of attendance_data) {
            if (item.status === 'pending') continue;

            const existing = await FacultyAttendance.findOne({
                where: { institute_id, faculty_id: item.faculty_id, date }
            });

            if (existing) {
                await existing.update({
                    status: item.status,
                    remarks: item.remarks,
                    marked_by
                });
                results.push(existing);
            } else {
                const created = await FacultyAttendance.create({
                    institute_id,
                    faculty_id: item.faculty_id,
                    date,
                    status: item.status,
                    remarks: item.remarks,
                    marked_by
                });
                results.push(created);
            }
        }

        res.status(201).json({
            success: true,
            message: `Attendance updated for ${results.length} faculty members.`,
            data: results
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get Faculty Attendance Dashboard Stats
 * @route GET /api/faculty-attendance/dashboard
 * @access Admin
 */
exports.getDashboardStats = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const today = new Date().toISOString().split('T')[0];

        // Total faculty active
        const totalFaculty = await Faculty.count({ where: { institute_id } });

        // Today attendance
        const todayAttendance = await FacultyAttendance.findAll({
            where: { institute_id, date: today }
        });

        const todayPresent = todayAttendance.filter(r => r.status === 'present').length;
        const todayHolidays = todayAttendance.filter(r => r.status === 'holiday').length;
        const todayTotal = totalFaculty; // We judge against total faculty
        const todayWorkingFaculty = totalFaculty - todayHolidays;
        const todayPercentage = todayWorkingFaculty > 0 ? ((todayPresent / todayWorkingFaculty) * 100).toFixed(2) : 0;

        // This month
        const now = new Date();
        const startOfMonthStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const monthAttendance = await FacultyAttendance.findAll({
            where: { institute_id, date: { [Op.gte]: startOfMonthStr } }
        });

        const monthPresent = monthAttendance.filter(r => r.status === 'present').length;
        const monthHolidays = monthAttendance.filter(r => r.status === 'holiday').length;
        const monthTotal = monthAttendance.length;
        const monthWorkingDays = monthTotal - monthHolidays;
        const monthPercentage = monthWorkingDays > 0 ? ((monthPresent / monthWorkingDays) * 100).toFixed(2) : 0;

        // At risk (absent more than 3 times this month for simplicity)
        const absentMap = {};
        monthAttendance.forEach(a => {
            if (a.status === 'absent') {
                absentMap[a.faculty_id] = (absentMap[a.faculty_id] || 0) + 1;
            }
        });
        const lowAttendanceCount = Object.values(absentMap).filter(count => count >= 3).length;

        res.status(200).json({
            success: true,
            data: {
                today: { present: todayPresent, total: todayTotal, percentage: todayPercentage },
                this_month: { present: monthPresent, total: monthTotal, percentage: monthPercentage },
                low_attendance_count: lowAttendanceCount
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get Attendance records mapped with Faculty for a specific date
 * @route GET /api/faculty-attendance/date/:date
 * @access Admin
 */
exports.getFacultyAttendanceByDate = async (req, res) => {
    try {
        const { date } = req.params;
        const institute_id = req.user.institute_id;

        const faculties = await Faculty.findAll({
            where: { institute_id },
            include: [{ model: User, attributes: ['name', 'email'] }]
        });

        const attendances = await FacultyAttendance.findAll({
            where: { institute_id, date }
        });

        const attendanceMap = {};
        attendances.forEach(a => {
            attendanceMap[a.faculty_id] = a;
        });

        const result = faculties.map(f => ({
            faculty_id: f.id,
            name: f.User?.name,
            email: f.User?.email,
            phone: f.phone,
            department: f.department || '-',
            designation: f.designation || '-',
            attendance: attendanceMap[f.id] ? {
                status: attendanceMap[f.id].status,
                remarks: attendanceMap[f.id].remarks,
                marked_at: attendanceMap[f.id].createdAt
            } : null
        }));

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Bulk Update Grid Attendance (Multiple Dates & Faculties)
 * @route POST /api/faculty-attendance/grid-update
 * @access Admin
 */
exports.updateGridBulk = async (req, res) => {
    try {
        const { updates } = req.body;
        const institute_id = req.user.institute_id;
        const marked_by = req.user.id;

        if (!updates || !Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ success: false, message: "No updates provided" });
        }

        // Prevent setting future dates
        const serverTomorrow = new Date();
        serverTomorrow.setHours(serverTomorrow.getHours() + 24);

        const results = [];
        for (const item of updates) {
            const clientDate = new Date(item.date);
            if (clientDate > serverTomorrow) {
                continue; // Skip future dates silently
            }

            // Using findOrCreate then update OR simple findOne
            const existing = await FacultyAttendance.findOne({
                where: { institute_id, faculty_id: item.faculty_id, date: item.date }
            });

            if (existing) {
                if (item.status === 'clear') {
                    await existing.destroy();
                } else {
                    await existing.update({
                        status: item.status,
                        remarks: item.remarks || existing.remarks,
                        marked_by
                    });
                    results.push(existing);
                }
            } else if (item.status !== 'clear') {
                const created = await FacultyAttendance.create({
                    institute_id,
                    faculty_id: item.faculty_id,
                    date: item.date,
                    status: item.status,
                    remarks: item.remarks,
                    marked_by
                });
                results.push(created);
            }
        }

        res.status(200).json({
            success: true,
            message: `Successfully processed ${updates.length} cell updates.`,
            data: results
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = exports;
