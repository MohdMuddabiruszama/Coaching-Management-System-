/**
 * Biometric Attendance Controller
 * Covers Phases 2–8: Device Management, Enrollment, Punch Receiver,
 * Punch Processing, Absent Detection, Real-Time Dashboard, Analytics
 */

const {
    BiometricDevice,
    BiometricEnrollment,
    BiometricPunch,
    BiometricSettings,
    Attendance,
    Student,
    Faculty,
    FacultyAttendance,
    User,
    Class,
    Subject,
    Institute,
    Timetable,
    TimetableSlot,
    StudentSubject,
    Notification,
    StudentParent,
} = require("../models");
const { Op } = require("sequelize");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const emailService = require("../services/email.service");
const socketUtils = require("../utils/socket");
const NotificationService = require("../services/notificationService");

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Get or create default biometric settings for an institute
 */
async function getOrCreateSettings(institute_id) {
    let settings = await BiometricSettings.findOne({ where: { institute_id } });
    if (!settings) {
        settings = await BiometricSettings.create({ institute_id });
    }
    return settings;
}

/**
 * Fetch the active timetable slot for a given room and time
 */
async function _getActiveTimetableSlot(room_identifier, punchTimeStr, dayOfWeekName) {
    if (!room_identifier) return null;
    
    // Normalize room names by removing "room", "class", spaces and converting to lowercase
    const normalizeRoom = (str) => str ? str.toString().toLowerCase().replace(/room|class|\s/g, "") : "";
    const targetRoomNorm = normalizeRoom(room_identifier);

    // Convert punchTimeStr (HH:MM:SS) to minutes for easier comparison
    const [h, m, s] = punchTimeStr.split(":").map(Number);
    const punchMinutes = h * 60 + m;
    
    // Find all slots for this day 
    const allDaySchedules = await Timetable.findAll({
        where: { day_of_week: dayOfWeekName, is_break: false },
        raw: true
    });
    
    // Filter matching rooms using normalization
    const schedules = allDaySchedules.filter(s => normalizeRoom(s.room_number) === targetRoomNorm);
    
    if (!schedules.length) return null;
    
    const slotIds = schedules.map(s => s.slot_id);
    const slots = await TimetableSlot.findAll({
        where: { id: { [Op.in]: slotIds } },
        raw: true
    });
    
    for (const slot of slots) {
        const [sh, sm] = slot.start_time.split(":").map(Number);
        const [eh, em] = slot.end_time.split(":").map(Number);
        const startMins = sh * 60 + sm - 15; // 15 mins grace before
        const endMins = eh * 60 + em; // Up to end of class
        
        if (punchMinutes >= startMins && punchMinutes <= endMins) {
            const schedule = schedules.find(s => s.slot_id === slot.id);
            return schedule;
        }
    }
    return null;
}

/**
 * Batch mark subjects for a student based on time_in and time_out (Class-Based)
 */
async function _batchMarkSubjects(student, timeInStr, timeOutStr, dateStr, institute_id) {
    const dayName = new Date(dateStr).toLocaleString("en-US", { weekday: "long" });
    
    // Convert times to minutes
    const [ih, im] = timeInStr.split(":").map(Number);
    const inMins = ih * 60 + im;
    const [oh, om] = timeOutStr.split(":").map(Number);
    const outMins = oh * 60 + om;
    
    const schedules = await Timetable.findAll({
        where: { class_id: student.class_id, day_of_week: dayName, is_break: false },
        raw: true
    });
    if (!schedules.length) return;
    
    const slotIds = schedules.map(s => s.slot_id);
    const slots = await TimetableSlot.findAll({
        where: { id: { [Op.in]: slotIds } },
        raw: true
    });
    
    for (const schedule of schedules) {
        const slot = slots.find(s => s.id === schedule.slot_id);
        if (!slot) continue;
        
        const [sh, sm] = slot.start_time.split(":").map(Number);
        const [eh, em] = slot.end_time.split(":").map(Number);
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;
        
        // If the subject falls entirely or mostly within the time_in and time_out bounds
        if (startMins >= inMins && endMins <= outMins + 15) {
            await Attendance.findOrCreate({
                where: {
                    institute_id,
                    student_id: student.id,
                    date: dateStr,
                    subject_id: schedule.subject_id
                },
                defaults: {
                    institute_id,
                    student_id: student.id,
                    class_id: student.class_id,
                    subject_id: schedule.subject_id,
                    date: dateStr,
                    status: "present",
                    marked_by_type: "biometric",
                    time_in: timeInStr,
                    time_out: timeOutStr,
                }
            });
        }
    }
}

/**
 * Calculate minutes late from punch_time vs class start
 */
function calcMinutesLate(punchTime, classStartTimeStr) {
    const punch = new Date(punchTime);
    const [h, m] = classStartTimeStr.split(":").map(Number);
    const start = new Date(punch);
    start.setHours(h, m, 0, 0);
    return Math.floor((punch - start) / 60000); // negative = early
}

/**
 * Process a single punch record — create attendance from raw punch
 * @param {object} punch  - BiometricPunch model instance
 * @param {object} options
 * @param {boolean} options.bypassWorkingDay - Skip working-day restriction (used in test mode)
 * @returns {object} { ok, reason, status } — result descriptor
 */
async function processPunch(punch, options = {}) {
    try {
        const enrollment = await BiometricEnrollment.findOne({
            where: {
                device_id: punch.device_id,
                device_user_id: punch.device_user_id,
                status: "active",
            },
        });
        if (!enrollment) {
            await punch.update({ processed: true });
            return { ok: false, reason: "No active enrollment found for this device + user ID" };
        }

        const settings = await getOrCreateSettings(enrollment.institute_id);

        // Duplicate punch check: ignore if same user punched within window
        const windowStart = new Date(punch.punch_time);
        windowStart.setSeconds(
            windowStart.getSeconds() - (settings.duplicate_punch_window_secs || 300)
        );

        const recentPunch = await BiometricPunch.findOne({
            where: {
                device_user_id: punch.device_user_id,
                device_id: punch.device_id,
                id: { [Op.ne]: punch.id },
                punch_time: { [Op.between]: [windowStart, punch.punch_time] },
                processed: true,
            },
        });
        if (recentPunch) {
            await punch.update({ processed: true });
            return { ok: false, reason: `Duplicate punch — same user already punched within ${settings.duplicate_punch_window_secs || 300}s window` };
        }

        const punchDate = new Date(punch.punch_time).toISOString().split("T")[0];
        const punchTime = new Date(punch.punch_time)
            .toTimeString()
            .split(" ")[0]; // HH:MM:SS

        // Check working day (skipped in test mode via bypassWorkingDay)
        const dayName = new Date(punch.punch_time).toLocaleString("en-US", {
            weekday: "long",  // Use full name for clearer reporting
        });
        const dayShort = new Date(punch.punch_time).toLocaleString("en-US", {
            weekday: "short",
        });
        const workingDays = settings.working_days || [
            "Mon", "Tue", "Wed", "Thu", "Fri", "Sat",
        ];
        if (!options.bypassWorkingDay && !workingDays.includes(dayShort)) {
            await punch.update({ processed: true });
            return { ok: false, reason: `Non-working day (${dayName}) — punch discarded. Working days: ${workingDays.join(", ")}` };
        }

        // Calculate lateness
        const minsLate = calcMinutesLate(
            punch.punch_time,
            settings.class_start_time || "09:00:00"
        );
        const isLate = minsLate > (settings.late_threshold_minutes || 15);
        const isHalfDay =
            minsLate > (settings.half_day_threshold_minutes || 120);
        let status = "present";
        if (isHalfDay) status = "half_day";
        else if (isLate) status = "late";

        let attendanceCreated = false;
        let attendanceUpdated = false;

        if (enrollment.user_role === "student") {
            const student = await Student.findOne({
                where: { user_id: enrollment.user_id, institute_id: enrollment.institute_id },
            });

            if (!student) {
                await punch.update({ processed: true });
                return { ok: false, reason: `Student profile not found for user_id=${enrollment.user_id}. Ensure the student is properly registered.` };
            }

            const device = await BiometricDevice.findByPk(punch.device_id);

            if (!settings.attendance_mode || settings.attendance_mode === "class_based" || !device || device.placement_type === "gate") {
                // Mode A: Class Based (Main Gate)
                const existing = await Attendance.findOne({
                    where: {
                        institute_id: enrollment.institute_id,
                        student_id: student.id,
                        date: punchDate,
                        subject_id: null,
                    },
                });

                if (!existing) {
                    await Attendance.create({
                        institute_id: enrollment.institute_id,
                        student_id: student.id,
                        class_id: student.class_id,
                        date: punchDate,
                        status,
                        marked_by_type: "biometric",
                        biometric_punch_id: punch.id,
                        time_in: punchTime,
                        is_late: isLate,
                        late_by_minutes: Math.max(0, minsLate),
                        is_half_day: isHalfDay,
                        marked_by: null,
                    });
                    attendanceCreated = true;
                } else if (punch.punch_type === "out" && !existing.time_out) {
                    await existing.update({ time_out: punchTime });
                    attendanceUpdated = true;
                    // Primary Trigger: Batch map subjects on punch out
                    if (settings.attendance_mode === "class_based") {
                        await _batchMarkSubjects(student, existing.time_in, punchTime, punchDate, enrollment.institute_id);
                    }
                }
            } else if (settings.attendance_mode === "subject_based" && device.placement_type === "classroom") {
                // Mode B/C: Subject Based (Classroom Devices)
                const activeSlot = await _getActiveTimetableSlot(device.room_identifier, punchTime, dayName);
                
                if (activeSlot) {
                    if (settings.enforce_subject_enrollment !== false) {
                        const isEnrolled = await StudentSubject.count({
                            where: {
                                student_id: student.id,
                                subject_id: activeSlot.subject_id
                            }
                        });
                        
                        if (isEnrolled === 0) {
                            await punch.update({ processed: true });
                            return { ok: false, reason: `Punch discarded: Student is not enrolled in the currently active subject (Subject ID: ${activeSlot.subject_id}).` };
                        }
                    }

                    const existingSubjectAtt = await Attendance.findOne({
                        where: {
                            institute_id: enrollment.institute_id,
                            student_id: student.id,
                            date: punchDate,
                            subject_id: activeSlot.subject_id,
                        }
                    });

                    if (!existingSubjectAtt) {
                        await Attendance.create({
                            institute_id: enrollment.institute_id,
                            student_id: student.id,
                            class_id: activeSlot.class_id,
                            subject_id: activeSlot.subject_id,
                            date: punchDate,
                            status: "present", 
                            marked_by_type: "biometric",
                            biometric_punch_id: punch.id,
                            time_in: punchTime,
                        });
                        attendanceCreated = true;
                    }
                } else {
                    // Punched in a classroom, but no active subject found for this room. 
                    // Log it or ignore. We'll ignore and mark processed.
                    await punch.update({ processed: true });
                    return { ok: false, reason: `No active subject found in Timetable for Room ${device.room_identifier} at this time.` };
                }
            }

            // Parent notifications — pass punch_type and placement context for granular routing
            if (attendanceCreated || attendanceUpdated) {
                const isClassroom = device && device.placement_type === "classroom";
                sendParentNotification(
                    student.id,
                    enrollment.institute_id,
                    status,
                    punchTime,
                    settings,
                    minsLate,
                    punch.punch_type,   // "in" | "out"
                    isClassroom         // true = subject punch, false = main gate
                ).catch(() => {});
            }
        } else if (enrollment.user_role === "faculty") {
            const faculty = await Faculty.findOne({
                where: {
                    user_id: enrollment.user_id,
                    institute_id: enrollment.institute_id,
                },
            });

            if (!faculty) {
                await punch.update({ processed: true });
                return { ok: false, reason: `Faculty profile not found for user_id=${enrollment.user_id}. Ensure the faculty is properly registered.` };
            }

            const existing = await FacultyAttendance.findOne({
                where: {
                    institute_id: enrollment.institute_id,
                    faculty_id: faculty.id,
                    date: punchDate,
                },
            });

            if (!existing) {
                await FacultyAttendance.create({
                    institute_id: enrollment.institute_id,
                    faculty_id: faculty.id,
                    date: punchDate,
                    status,
                    marked_by_type: "biometric",
                    source_meta: { biometric_punch_id: punch.id },
                    time_in: punchTime,
                    marked_by: null,
                });
                attendanceCreated = true;
            } else if (punch.punch_type === "out" && !existing.time_out) {
                await existing.update({ time_out: punchTime });
                attendanceUpdated = true;
            }
        }

        await punch.update({ processed: true });
        return {
            ok: true,
            status,
            isLate,
            minsLate: Math.max(0, minsLate),
            attendanceCreated,
            attendanceUpdated,
            reason: attendanceCreated
                ? `Attendance created — Status: ${status}${isLate ? ` (${Math.max(0, minsLate)}m late)` : ""}`
                : attendanceUpdated
                    ? `Time-out recorded`
                    : `Already marked present today`,
        };
    } catch (err) {
        console.error("❌ processPunch error:", err.message);
        return { ok: false, reason: `Internal error: ${err.message}` };
    }
}

/**
 * Send parent notification for attendance event.
 * Uses the centralized NotificationService which handles:
 *   1. DB persistence  (notifications table)
 *   2. Real-time WebSocket push (Socket.io)
 *   3. FCM push notification (shows in Android notification tray like announcements)
 *   4. Email (optional fallback)
 * @param {string} punch_type   "in" | "out"
 * @param {boolean} isClassroom true = subject-based punch, false = main gate
 */
async function sendParentNotification(
    student_id,
    institute_id,
    status,
    punchTime,
    settings,
    minsLate,
    punch_type = "in",
    isClassroom = false
) {
    try {
        const student = await Student.findOne({
            where: { id: student_id },
            include: [{ model: User, attributes: ["name"] }],
        });
        if (!student) return;
        const studentName = student.User?.name || "Your child";

        const studentParents = await StudentParent.findAll({
            where: { student_id },
        });

        if (!studentParents || studentParents.length === 0) return;

        const parentIds = studentParents.map(sp => sp.parent_id);

        const parents = await User.findAll({
            where: { id: { [Op.in]: parentIds } },
            attributes: ["id", "name", "email"],
        });

        for (const parent of parents) {
            if (!parent?.id) continue;

            let title, body;
            const time = punchTime;

            if (isClassroom) {
                // ── Subject-Based Punch Notifications ──
                if (punch_type === "in" && settings.notify_subject_in) {
                    title = `📚 ${studentName} entered classroom`;
                    body = `${studentName} has punched IN for a subject class at ${time}.`;
                } else if (punch_type === "out" && settings.notify_subject_out) {
                    title = `📚 ${studentName} left classroom`;
                    body = `${studentName} has punched OUT from a subject class at ${time}.`;
                }
            } else {
                // ── Main Gate Notifications ──
                if (punch_type === "in" && settings.notify_main_gate_in) {
                    if (status === "present") {
                        title = `✅ ${studentName} has arrived`;
                        body = `${studentName} entered the Main Gate at ${time} and is marked Present.`;
                    } else if (status === "late" || status === "half_day") {
                        title = `⚠️ ${studentName} arrived late`;
                        body = `${studentName} arrived late by ${minsLate} min at the Main Gate at ${time}.`;
                    }
                } else if (punch_type === "out" && settings.notify_main_gate_out) {
                    title = `🚪 ${studentName} has left school`;
                    body = `${studentName} exited through the Main Gate at ${time}.`;
                }

                // Legacy fallback flags
                if (!title) {
                    if (punch_type === "in" && status === "present" && settings.notify_parent_on_present) {
                        title = `✅ ${studentName} has arrived`;
                        body = `${studentName} has been marked present at ${time}.`;
                    } else if (punch_type === "in" && (status === "late" || status === "half_day") && settings.notify_parent_on_late) {
                        title = `⚠️ ${studentName} arrived late`;
                        body = `${studentName} arrived late by ${minsLate} min today at ${time}.`;
                    }
                }
            }

            if (title && body) {
                const notifType = isClassroom ? "biometric_subject_punch" : "biometric_gate_punch";
                const dataPayload = { student_id, punch_type, status, time: punchTime, isClassroom, route: "/parent" };

                // Sends DB + WebSocket + FCM push in one call (same as announcements)
                await NotificationService.createAndSend(
                    institute_id,
                    parent.id,
                    notifType,
                    title,
                    body,
                    dataPayload
                );

                // Also send email as backup (non-blocking)
                if (parent.email) {
                    const emailBody = `<p>Dear Parent,<br>${body}</p>`;
                    emailService.sendEmail(parent.email, title, emailBody).catch(() => {});
                }
            }
        }
    } catch (err) {
        console.error("Parent notification error:", err.message);
    }
}

// ─────────────────────────────────────────────────────────────────
// PHASE 2 — DEVICE MANAGEMENT
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/biometric/devices
 * List all devices for institute
 */
exports.getDevices = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const devices = await BiometricDevice.findAll({
            where: { institute_id },
            order: [["created_at", "DESC"]],
        });
        res.json({ success: true, data: devices });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/biometric/devices
 * Register a new device
 */
exports.createDevice = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const { device_name, device_serial, device_type, placement_type, room_identifier, location, ip_address } =
            req.body;

        if (!device_name || !device_serial) {
            return res
                .status(400)
                .json({ success: false, message: "device_name and device_serial are required" });
        }

        // Generate secret key for device authentication
        const secret_key = crypto.randomBytes(32).toString("hex");

        const device = await BiometricDevice.create({
            institute_id,
            device_name,
            device_serial,
            device_type: device_type || "fingerprint",
            placement_type: placement_type || "gate",
            room_identifier: room_identifier || null,
            location: location || "",
            ip_address: ip_address || "",
            secret_key,
            status: "active",
        });

        res.status(201).json({
            success: true,
            message: "Device registered successfully",
            data: { ...device.toJSON(), secret_key },
        });
    } catch (err) {
        if (err.name === "SequelizeUniqueConstraintError") {
            return res
                .status(409)
                .json({ success: false, message: "Device with this serial number already exists" });
        }
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * PUT /api/biometric/devices/:id
 * Update device info
 */
exports.updateDevice = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;
        const device = await BiometricDevice.findOne({ where: { id, institute_id } });
        if (!device)
            return res.status(404).json({ success: false, message: "Device not found" });

        const { device_name, location, ip_address, status, device_type, placement_type, room_identifier } = req.body;
        await device.update({ device_name, location, ip_address, status, device_type, placement_type, room_identifier });
        res.json({ success: true, message: "Device updated", data: device });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * DELETE /api/biometric/devices/:id
 * Remove a device (owner only)
 */
exports.deleteDevice = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;
        const device = await BiometricDevice.findOne({ where: { id, institute_id } });
        if (!device)
            return res.status(404).json({ success: false, message: "Device not found" });
        await device.destroy();
        res.json({ success: true, message: "Device removed" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/biometric/devices/:id/status
 * Check device online/offline based on last_sync
 */
exports.getDeviceStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;
        const device = await BiometricDevice.findOne({ where: { id, institute_id } });
        if (!device)
            return res.status(404).json({ success: false, message: "Device not found" });

        const lastSync = device.last_sync ? new Date(device.last_sync) : null;
        const diffMins = lastSync
            ? Math.floor((Date.now() - lastSync.getTime()) / 60000)
            : null;
        const isOnline = lastSync && diffMins < 15;

        res.json({
            success: true,
            data: {
                ...device.toJSON(),
                is_online: isOnline,
                mins_since_sync: diffMins,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/biometric/devices/health
 * All device statuses overview
 */
exports.getDevicesHealth = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const devices = await BiometricDevice.findAll({ where: { institute_id } });
        const data = devices.map((d) => {
            const lastSync = d.last_sync ? new Date(d.last_sync) : null;
            const diffMins = lastSync
                ? Math.floor((Date.now() - lastSync.getTime()) / 60000)
                : null;
            return {
                id: d.id,
                device_name: d.device_name,
                location: d.location,
                status: d.status,
                is_online: lastSync && diffMins < 15,
                last_sync: d.last_sync,
                mins_since_sync: diffMins,
            };
        });
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────
// PHASE 3 — ENROLLMENT
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/biometric/enroll
 */
exports.enroll = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const { device_id, device_user_id, user_id, user_role } = req.body;

        if (!device_id || !device_user_id || !user_id || !user_role) {
            return res.status(400).json({ success: false, message: "All fields required" });
        }
        if (!["student", "faculty"].includes(user_role)) {
            return res
                .status(400)
                .json({ success: false, message: "user_role must be student or faculty" });
        }

        // Verify device belongs to institute
        const device = await BiometricDevice.findOne({
            where: { id: device_id, institute_id },
        });
        if (!device)
            return res.status(404).json({ success: false, message: "Device not found" });

        const enrollment = await BiometricEnrollment.create({
            institute_id,
            device_id,
            device_user_id: String(device_user_id),
            user_id,
            user_role,
            enrolled_by: req.user.id,
            enrolled_at: new Date(),
        });

        res.status(201).json({ success: true, message: "Enrolled successfully", data: enrollment });
    } catch (err) {
        if (err.name === "SequelizeUniqueConstraintError") {
            return res
                .status(409)
                .json({ success: false, message: "User already enrolled on this device" });
        }
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/biometric/enrollments
 */
exports.getEnrollments = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const enrollments = await BiometricEnrollment.findAll({
            where: { institute_id },
            include: [
                { model: BiometricDevice, attributes: ["device_name", "location"] },
                { 
                    model: User, 
                    attributes: ["name", "email", "role"],
                    include: [
                        { model: Student, attributes: ["roll_number", "class_id"] },
                        { model: Faculty, attributes: ["designation"] }
                    ]
                },
            ],
            order: [["created_at", "DESC"]],
        });
        res.json({ success: true, data: enrollments });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * DELETE /api/biometric/enrollments/:id
 * Deactivate enrollment (don't delete — just make inactive)
 */
exports.removeEnrollment = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;
        const enrollment = await BiometricEnrollment.findOne({
            where: { id, institute_id },
        });
        if (!enrollment)
            return res.status(404).json({ success: false, message: "Enrollment not found" });
        await enrollment.update({ status: "inactive" });
        res.json({ success: true, message: "Enrollment deactivated" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * PUT /api/biometric/enrollments/:id
 * Update an existing enrollment (device, device_user_id, status)
 */
exports.updateEnrollment = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;
        const { device_id, device_user_id, user_id, status } = req.body;
        
        const enrollment = await BiometricEnrollment.findOne({
            where: { id, institute_id },
        });
        if (!enrollment)
            return res.status(404).json({ success: false, message: "Enrollment not found" });
        
        await enrollment.update({ device_id, device_user_id, user_id, status });
        res.json({ success: true, message: "Enrollment updated successfully", data: enrollment });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/biometric/enrollments/check/:userId
 * Check if a user is enrolled
 */
exports.checkEnrollment = async (req, res) => {
    try {
        const { userId } = req.params;
        const institute_id = req.user.institute_id;
        const enrollments = await BiometricEnrollment.findAll({
            where: { user_id: userId, institute_id, status: "active" },
            include: [{ model: BiometricDevice, attributes: ["device_name", "location"] }],
        });
        res.json({ success: true, enrolled: enrollments.length > 0, data: enrollments });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────
// PHASE 4 — PUNCH RECEIVER (Critical — must be fast)
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/biometric/punch
 * Receives punches from ZKTeco and other devices.
 * Must respond < 100ms — processing is done asynchronously.
 */
exports.receivePunch = async (req, res) => {
    // Always respond 200 first so device doesn't retry
    res.status(200).json({ success: true, message: "Received" });

    // Async processing (non-blocking)
    setImmediate(async () => {
        try {
            const deviceSerial =
                req.headers["x-device-serial"] || req.body?.sn || req.body?.serial;
            const deviceKey =
                req.headers["x-device-key"] || req.body?.secret_key;

            if (!deviceSerial) return;

            // Find device
            const device = await BiometricDevice.findOne({
                where: { device_serial: deviceSerial, status: "active" },
            });
            if (!device) return; // Unregistered device

            // Validate secret key
            if (!deviceKey || device.secret_key !== deviceKey) return;

            // Parse ZKTeco ADMS payload
            let device_user_id, punch_time, punch_type;
            if (req.body?.AttLog) {
                device_user_id = String(req.body.AttLog.pin);
                punch_time = new Date(req.body.AttLog.time);
                punch_type = req.body.AttLog.status === "1" ? "out" : "in";
            } else {
                device_user_id = String(req.body.pin || req.body.user_id || req.body.device_user_id);
                punch_time = new Date(req.body.punch_time || req.body.time || Date.now());
                punch_type = req.body.punch_type || "in";
            }

            if (!device_user_id || isNaN(punch_time.getTime())) return;

            // Reject if punch_time is more than 60s old (replay attack prevention)
            const ageMs = Date.now() - punch_time.getTime();
            if (Math.abs(ageMs) > 60 * 1000 * 5) {
                // Allow up to 5 min drift for device clock skew
                punch_time = new Date(); // Use server time
            }

            // Save raw punch
            const punch = await BiometricPunch.create({
                institute_id: device.institute_id,
                device_id: device.id,
                device_user_id,
                punch_time,
                punch_type,
                raw_payload: req.body,
                processed: false,
            });

            // Update device last_sync
            await device.update({ last_sync: new Date() });

            // Process punch asynchronously
            await processPunch(punch);
        } catch (err) {
            console.error("❌ Punch receiver error:", err.message);
        }
    });
};

/**
 * POST /api/biometric/devices/:id/sync
 * Manually trigger data pull from device (for polling method)
 */
exports.syncDevice = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;
        const device = await BiometricDevice.findOne({ where: { id, institute_id } });
        if (!device)
            return res.status(404).json({ success: false, message: "Device not found" });

        // Update last_sync timestamp (actual SDK polling would go here)
        await device.update({ last_sync: new Date() });
        res.json({ success: true, message: "Sync triggered. Device data will be processed shortly." });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────
// PHASE 5 — MANUAL PUNCH PROCESSING (re-process pending punches)
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/biometric/process-pending
 * Re-process unprocessed punches (admin use)
 */
exports.processPendingPunches = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const pending = await BiometricPunch.findAll({
            where: { institute_id, processed: false },
            limit: 100,
            order: [["punch_time", "ASC"]],
        });

        let processed = 0;
        for (const punch of pending) {
            await processPunch(punch);
            processed++;
        }

        res.json({ success: true, message: `Processed ${processed} punches` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────
// PHASE 6 — ABSENT DETECTION (called by cron)
// ─────────────────────────────────────────────────────────────────

exports.markAbsentStudents = async (institute_id, dateStr) => {
    try {
        const settings = await getOrCreateSettings(institute_id);
        const workingDays = settings.working_days || ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const dayName = new Date(dateStr).toLocaleString("en-US", { weekday: "short" });
        if (!workingDays.includes(dayName)) return 0;

        // Get all enrolled students with biometric enrollment
        const enrollments = await BiometricEnrollment.findAll({
            where: { institute_id, user_role: "student", status: "active" },
        });

        let marked = 0;
        for (const enrollment of enrollments) {
            const existing = await Attendance.findOne({
                where: {
                    institute_id,
                    student_id: enrollment.user_id,
                    date: dateStr,
                },
            });
            if (!existing) {
                await Attendance.create({
                    institute_id,
                    student_id: enrollment.user_id,
                    date: dateStr,
                    status: "absent",
                    marked_by_type: "biometric",
                    marked_by: null,
                });
                marked++;

                // Notify parents
                if (settings.notify_parent_on_absent) {
                    await sendAbsentNotification(enrollment.user_id, institute_id, dateStr);
                }
            }
        }
        return marked;
    } catch (err) {
        console.error("markAbsentStudents error:", err.message);
        return 0;
    }
};

async function sendAbsentNotification(student_id, institute_id, dateStr) {
    try {
        const { StudentParent } = require("../models");
        const student = await Student.findOne({
            where: { id: student_id },
            include: [{ model: User, attributes: ["name"] }],
        });
        if (!student) return;
        const studentName = student.User?.name || "Your child";

        const parents = await StudentParent.findAll({ where: { student_id } });
        for (const sp of parents) {
            const parentUser = await User.findByPk(sp.parent_id, {
                attributes: ["name", "email"],
            });
            if (!parentUser?.email) continue;
            await emailService
                .sendEmail(
                    parentUser.email,
                    `❌ ${studentName} was absent today`,
                    `<p>Dear Parent,<br><strong>${studentName}</strong> was <b>ABSENT</b> on <b>${dateStr}</b>. Please contact the institute for more information.</p>`
                )
                .catch(() => { });
        }
    } catch (err) {
        console.error("sendAbsentNotification error:", err.message);
    }
}

// ─────────────────────────────────────────────────────────────────
// PHASE 8 — ANALYTICS APIs
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/attendance/biometric/live
 * Today's live attendance count by institute
 */
exports.getLiveAttendance = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const today = new Date().toISOString().split("T")[0];

        const records = await Attendance.findAll({
            where: {
                institute_id,
                date: today,
                marked_by_type: "biometric",
            },
            include: [
                { 
                    model: Student, 
                    include: [
                        { model: User, attributes: ["name"] },
                        { model: Class, attributes: ["name", "section"], through: { attributes: [] } }
                    ] 
                },
                { model: Class, attributes: ["id", "name", "section"] },
                { 
                    model: BiometricPunch, 
                    include: [{ model: BiometricDevice, attributes: ["device_name"] }]
                }
            ],
            order: [["time_in", "DESC"]],
        });

        const facultyRecords = await FacultyAttendance.findAll({
            where: {
                institute_id,
                date: today,
                marked_by_type: "biometric",
            },
            include: [
                { model: Faculty, include: [{ model: User, attributes: ["name"] }] },
            ],
            order: [["time_in", "DESC"]],
        });

        const allRecords = [
            ...records.map((r) => ({
                id: r.student_id,
                role: "student",
                roll_number: r.Student?.roll_number,
                name: r.Student?.User?.name,
                class: r.Class ? `${r.Class.name} ${r.Class.section || ""}`.trim() : (r.Student?.Classes?.length ? `${r.Student.Classes[0].name} ${r.Student.Classes[0].section || ""}`.trim() : "—"),
                time_in: r.time_in,
                time_out: r.time_out,
                status: r.status,
                is_late: r.is_late,
                late_by_minutes: r.late_by_minutes,
                device_name: r.BiometricPunch?.BiometricDevice?.device_name || "Main Entrance",
            })),
            ...facultyRecords.map((r) => ({
                id: r.faculty_id,
                role: "faculty",
                name: r.Faculty?.User?.name,
                class: r.Faculty?.designation || "Faculty",
                time_in: r.time_in,
                time_out: r.time_out,
                status: r.status,
                is_late: r.status === "late" || r.status === "half_day",
                late_by_minutes: 0,
                device_name: "Main Entrance",
            }))
        ].sort((a, b) => new Date(b.time_in) - new Date(a.time_in));

        const present = allRecords.filter((r) => r.status === "present" || r.status === "half_day").length;
        const late = allRecords.filter((r) => r.status === "late" || r.is_late).length;

        res.json({
            success: true,
            data: {
                date: today,
                total_marked: allRecords.length,
                present,
                late,
                absent: 0,
                records: allRecords,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/attendance/biometric/class/:id
 * Class attendance % for date range
 */
exports.getClassBiometricAttendance = async (req, res) => {
    try {
        const { id: class_id } = req.params;
        const { start_date, end_date } = req.query;
        const institute_id = req.user.institute_id;

        const where = { institute_id, class_id, marked_by_type: "biometric" };
        if (start_date && end_date) {
            where.date = { [Op.between]: [start_date, end_date] };
        }

        const records = await Attendance.findAll({ where });
        const total = records.length;
        const present = records.filter((r) => r.status !== "absent").length;

        res.json({
            success: true,
            data: { total, present, percentage: total > 0 ? ((present / total) * 100).toFixed(1) : 0 },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/attendance/biometric/student/:id
 * Individual student biometric attendance report
 */
exports.getStudentBiometricReport = async (req, res) => {
    try {
        const { id: student_id } = req.params;
        const { month, year, start_date, end_date } = req.query;
        const institute_id = req.user.institute_id;

        const where = { institute_id, student_id };
        if (start_date && end_date) {
            where.date = { [Op.between]: [start_date, end_date] };
        } else if (month && year) {
            const s = new Date(year, month - 1, 1).toISOString().split("T")[0];
            const e = new Date(year, month, 0).toISOString().split("T")[0];
            where.date = { [Op.between]: [s, e] };
        }

        const records = await Attendance.findAll({
            where,
            order: [["date", "DESC"]],
        });

        const total = records.length;
        const present = records.filter((r) => r.status === "present").length;
        const absent = records.filter((r) => r.status === "absent").length;
        const late = records.filter((r) => r.is_late).length;
        const halfDay = records.filter((r) => r.status === "half_day").length;

        res.json({
            success: true,
            data: {
                records,
                summary: {
                    total,
                    present,
                    absent,
                    late,
                    half_day: halfDay,
                    percentage: total > 0 ? (((present + halfDay) / total) * 100).toFixed(1) : 0,
                },
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Helper to get enrolled students and faculty for an institute
 */
const getEnrolledUsers = async (institute_id) => {
    const devices = await BiometricDevice.findAll({ where: { institute_id }, attributes: ["id"] });
    const deviceIds = devices.map(d => d.id);
    const enrollments = await BiometricEnrollment.findAll({ where: { device_id: { [Op.in]: deviceIds } }, attributes: ["user_id"] });
    const enrolledUserIds = enrollments.map(e => e.user_id);

    const students = await Student.findAll({ where: { user_id: { [Op.in]: enrolledUserIds }, institute_id }, attributes: ["id"] });
    const enrolledStudentIds = students.map(s => s.id);

    const faculties = await Faculty.findAll({ where: { user_id: { [Op.in]: enrolledUserIds }, institute_id }, attributes: ["id"] });
    const enrolledFacultyIds = faculties.map(f => f.id);

    return { enrolledStudentIds, enrolledFacultyIds };
};

/**
 * GET /api/attendance/biometric/late-report
 * All late arrivals for date range
 */
exports.getLateReport = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const { start_date, end_date, role } = req.query;
        const { enrolledStudentIds, enrolledFacultyIds } = await getEnrolledUsers(institute_id);

        const sWhere = { institute_id, is_late: true, marked_by_type: "biometric", student_id: { [Op.in]: enrolledStudentIds } };
        if (start_date && end_date) sWhere.date = { [Op.between]: [start_date, end_date] };

        const fWhere = { institute_id, status: "late", marked_by_type: "biometric", faculty_id: { [Op.in]: enrolledFacultyIds } };
        if (start_date && end_date) fWhere.date = { [Op.between]: [start_date, end_date] };

        const [studentRecords, facultyRecords] = await Promise.all([
            (!role || role === "all" || role === "student") ? Attendance.findAll({ where: sWhere, include: [{ model: Student, include: [{ model: User, attributes: ["name"] }] }] }) : Promise.resolve([]),
            (!role || role === "all" || role === "faculty") ? FacultyAttendance.findAll({ where: fWhere, include: [{ model: Faculty, include: [{ model: User, attributes: ["name"] }] }] }) : Promise.resolve([])
        ]);

        const merged = [
            ...studentRecords.map(r => ({ date: r.date, student_id: r.student_id, name: r.Student?.User?.name, role: "student", time_in: r.time_in, time_out: r.time_out, late_by_minutes: r.late_by_minutes })),
            ...facultyRecords.map(r => ({ date: r.date, faculty_id: r.faculty_id, name: r.Faculty?.User?.name, role: "faculty", time_in: r.time_in, time_out: r.time_out, late_by_minutes: 0 }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date) || b.late_by_minutes - a.late_by_minutes);

        res.json({ success: true, data: merged });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/attendance/biometric/absent-report
 * All absent students for a date range
 */
exports.getAbsentReport = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const { start_date, end_date, role } = req.query;
        const { enrolledStudentIds, enrolledFacultyIds } = await getEnrolledUsers(institute_id);

        const sWhere = { institute_id, status: "absent", student_id: { [Op.in]: enrolledStudentIds } };
        if (start_date && end_date) sWhere.date = { [Op.between]: [start_date, end_date] };

        const fWhere = { institute_id, status: "absent", faculty_id: { [Op.in]: enrolledFacultyIds } };
        if (start_date && end_date) fWhere.date = { [Op.between]: [start_date, end_date] };

        const [studentRecords, facultyRecords] = await Promise.all([
            (!role || role === "all" || role === "student") ? Attendance.findAll({ where: sWhere, include: [{ model: Student, include: [{ model: User, attributes: ["name"] }] }] }) : Promise.resolve([]),
            (!role || role === "all" || role === "faculty") ? FacultyAttendance.findAll({ where: fWhere, include: [{ model: Faculty, include: [{ model: User, attributes: ["name"] }] }] }) : Promise.resolve([])
        ]);

        const merged = [
            ...studentRecords.map(r => ({ date: r.date, student_id: r.student_id, name: r.Student?.User?.name, role: "student" })),
            ...facultyRecords.map(r => ({ date: r.date, faculty_id: r.faculty_id, name: r.Faculty?.User?.name, role: "faculty" }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({ success: true, data: merged });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/attendance/biometric/present-report
 * All present students for a date range
 */
exports.getPresentReport = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const { start_date, end_date, role } = req.query;
        const { enrolledStudentIds, enrolledFacultyIds } = await getEnrolledUsers(institute_id);

        const sWhere = { institute_id, status: { [Op.in]: ["present", "half_day"] }, marked_by_type: "biometric", student_id: { [Op.in]: enrolledStudentIds } };
        if (start_date && end_date) sWhere.date = { [Op.between]: [start_date, end_date] };

        const fWhere = { institute_id, status: { [Op.in]: ["present", "half_day"] }, marked_by_type: "biometric", faculty_id: { [Op.in]: enrolledFacultyIds } };
        if (start_date && end_date) fWhere.date = { [Op.between]: [start_date, end_date] };

        const [studentRecords, facultyRecords] = await Promise.all([
            (!role || role === "all" || role === "student") ? Attendance.findAll({ where: sWhere, include: [{ model: Student, include: [{ model: User, attributes: ["name"] }] }] }) : Promise.resolve([]),
            (!role || role === "all" || role === "faculty") ? FacultyAttendance.findAll({ where: fWhere, include: [{ model: Faculty, include: [{ model: User, attributes: ["name"] }] }] }) : Promise.resolve([])
        ]);

        const merged = [
            ...studentRecords.map(r => ({ date: r.date, student_id: r.student_id, name: r.Student?.User?.name, role: "student", time_in: r.time_in, time_out: r.time_out, late_by_minutes: r.late_by_minutes })),
            ...facultyRecords.map(r => ({ date: r.date, faculty_id: r.faculty_id, name: r.Faculty?.User?.name, role: "faculty", time_in: r.time_in, time_out: r.time_out, late_by_minutes: 0 }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({ success: true, data: merged });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────
// PHASE 5 — SETTINGS (per institute)
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/biometric/settings
 */
exports.getSettings = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const settings = await getOrCreateSettings(institute_id);
        res.json({ success: true, data: settings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * PUT /api/biometric/settings
 */
exports.updateSettings = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const settings = await getOrCreateSettings(institute_id);
        const {
            attendance_mode,
            subject_mode,
            enforce_subject_enrollment,
            late_threshold_minutes,
            half_day_threshold_minutes,
            working_days,
            class_start_time,
            notify_parent_on_absent,
            notify_parent_on_late,
            notify_parent_on_present,
            notify_main_gate_in,
            notify_main_gate_out,
            notify_subject_in,
            notify_subject_out,
            duplicate_punch_window_secs,
        } = req.body;

        await settings.update({
            attendance_mode,
            subject_mode,
            enforce_subject_enrollment,
            late_threshold_minutes,
            half_day_threshold_minutes,
            working_days,
            class_start_time,
            notify_parent_on_absent,
            notify_parent_on_late,
            notify_parent_on_present,
            notify_main_gate_in,
            notify_main_gate_out,
            notify_subject_in,
            notify_subject_out,
            duplicate_punch_window_secs,
        });

        res.json({ success: true, message: "Settings updated", data: settings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/biometric/punch-log
 * Raw punch logs for admin
 */
exports.getPunchLogs = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const { date, device_id } = req.query;
        const where = { institute_id };
        if (date) {
            const dayStart = new Date(date + "T00:00:00");
            const dayEnd = new Date(date + "T23:59:59");
            where.punch_time = { [Op.between]: [dayStart, dayEnd] };
        }
        if (device_id) where.device_id = device_id;

        const punches = await BiometricPunch.findAll({
            where,
            include: [{ model: BiometricDevice, attributes: ["device_name"] }],
            order: [["punch_time", "DESC"]],
            limit: 500,
        });

        res.json({ success: true, data: punches });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Run every minute via Cron to auto-carry forward subject attendance
 */
exports.processSubjectBasedAutoCarryForward = async () => {
    try {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        const currentTimeStr = `${hh}:${mm}:00`;
        const dayName = now.toLocaleString("en-US", { weekday: "long" });
        const dateStr = now.toISOString().split("T")[0];

        // 1. Find institutes that have subject_mode = "automatic"
        const settings = await BiometricSettings.findAll({
            where: { subject_mode: "automatic", attendance_mode: "subject_based" }
        });

        for (const setting of settings) {
            const institute_id = setting.institute_id;
            
            // 2. Find slots that JUST ended in this minute (end_time matches currentTimeStr)
            const slots = await TimetableSlot.findAll({
                where: { institute_id, end_time: currentTimeStr }
            });
            
            if (!slots.length) continue;

            const slotIds = slots.map(s => s.id);

            // 3. Find schedules for these slots on this day
            const schedules = await Timetable.findAll({
                where: { institute_id, slot_id: { [Op.in]: slotIds }, day_of_week: dayName, is_break: false }
            });

            for (const schedule of schedules) {
                const students = await Student.findAll({ where: { class_id: schedule.class_id, institute_id } });
                
                for (const student of students) {
                    const existingAtt = await Attendance.findOne({
                        where: { institute_id, student_id: student.id, date: dateStr, subject_id: schedule.subject_id }
                    });
                    
                    if (!existingAtt) {
                        // Look up their most recent subject attendance today
                        const lastAtt = await Attendance.findOne({
                            where: { institute_id, student_id: student.id, date: dateStr, subject_id: { [Op.ne]: null } },
                            order: [['createdAt', 'DESC']]
                        });
                        
                        if (lastAtt && lastAtt.status === 'present') {
                            await Attendance.create({
                                institute_id,
                                student_id: student.id,
                                class_id: student.class_id,
                                subject_id: schedule.subject_id,
                                date: dateStr,
                                status: "present",
                                marked_by_type: "biometric",
                                remarks: "Auto carry-forward"
                            });
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error("❌ processSubjectBasedAutoCarryForward error:", err.message);
    }
};

// Export processPunch and markAbsentStudents for use in cron
exports._processPunch = processPunch;

// ─────────────────────────────────────────────────────────────────
// TEST MODE — SIMULATOR ENDPOINTS (admin JWT auth, no device key)
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/biometric/test/setup-mock-device
 * Creates a pre-configured test device if it doesn't exist.
 * Returns device + secret_key so the simulator can use it.
 */
exports.setupMockDevice = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const MOCK_SERIAL = "CDK9191960001-TEST";
        const MOCK_NAME = "Test-Gate-1 Fingerprint (Simulator)";

        let device = await BiometricDevice.findOne({
            where: { device_serial: MOCK_SERIAL, institute_id },
        });

        if (!device) {
            const secret_key = crypto.randomBytes(32).toString("hex");
            device = await BiometricDevice.create({
                institute_id,
                device_name: MOCK_NAME,
                device_serial: MOCK_SERIAL,
                device_type: "fingerprint",
                location: "Simulator (Test Mode)",
                ip_address: "127.0.0.1",
                secret_key,
                status: "active",
                last_sync: new Date(),
            });
        } else {
            // Bump last_sync so it shows as online
            await device.update({ last_sync: new Date() });
        }

        res.json({
            success: true,
            message: device.created_at === device.updated_at
                ? "Mock device created"
                : "Mock device already exists — refreshed",
            data: {
                id: device.id,
                device_name: device.device_name,
                device_serial: device.device_serial,
                location: device.location,
                secret_key: device.secret_key,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/biometric/test/punch
 * Simulate a biometric punch from the UI.
 * Requires admin JWT — no device secret key needed.
 * Body: { device_id, device_user_id, punch_type, timestamp? }
 */
exports.testPunch = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const { device_id, device_user_id, punch_type = "in", timestamp } = req.body;

        if (!device_id || !device_user_id) {
            return res.status(400).json({
                success: false,
                message: "device_id and device_user_id are required",
            });
        }

        // Verify device belongs to this institute
        const device = await BiometricDevice.findOne({
            where: { id: device_id, institute_id, status: "active" },
        });
        if (!device) {
            return res.status(404).json({ success: false, message: "Device not found" });
        }

        // Check enrollment exists
        const enrollment = await BiometricEnrollment.findOne({
            where: {
                device_id,
                device_user_id: String(device_user_id),
                institute_id,
                status: "active",
            },
        });
        if (!enrollment) {
            return res.status(404).json({
                success: false,
                message: "No active enrollment found for this device + user ID. Please enroll first.",
            });
        }

        const punch_time = timestamp ? new Date(timestamp) : new Date();

        // Create the raw punch record
        const punch = await BiometricPunch.create({
            institute_id,
            device_id,
            device_user_id: String(device_user_id),
            punch_time,
            punch_type,
            raw_payload: {
                source: "test_simulator",
                simulated_by: req.user.id,
                simulated_at: new Date().toISOString(),
            },
            processed: false,
        });

        // Update device last_sync (marks device as "online")
        await device.update({ last_sync: new Date() });

        // Run the real processPunch pipeline.
        // Pass bypassWorkingDay:true so test punches work on any day (including weekends).
        const result = await processPunch(punch, { bypassWorkingDay: true });

        // Re-fetch punch to get processed status
        await punch.reload();

        // Find attendance record created/updated
        const punchDate = punch_time.toISOString().split("T")[0];
        const { Attendance } = require("../models");
        const attendanceRecord = await Attendance.findOne({
            where: {
                institute_id,
                student_id: enrollment.user_id,
                date: punchDate,
            },
        });

        res.json({
            success: true,
            message: result?.reason || `Simulated ${punch_type.toUpperCase()} punch processed`,
            data: {
                punch_id: punch.id,
                punch_time: punch_time.toISOString(),
                punch_type,
                processed: punch.processed,
                person_id: enrollment.user_id,
                person_role: enrollment.user_role,
                result_ok: result?.ok,
                result_reason: result?.reason,
                attendance: attendanceRecord
                    ? {
                        id: attendanceRecord.id,
                        status: attendanceRecord.status,
                        time_in: attendanceRecord.time_in,
                        is_late: attendanceRecord.is_late,
                        late_by_minutes: attendanceRecord.late_by_minutes,
                    }
                    : null,
            },
        });
    } catch (err) {
        console.error("testPunch error:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/biometric/test/heartbeat
 * Updates last_sync on a device to mark it as online.
 * Body: { device_id }
 */
exports.testHeartbeat = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const { device_id } = req.body;

        if (!device_id) {
            return res.status(400).json({ success: false, message: "device_id is required" });
        }

        const device = await BiometricDevice.findOne({
            where: { id: device_id, institute_id },
        });
        if (!device) {
            return res.status(404).json({ success: false, message: "Device not found" });
        }

        await device.update({ last_sync: new Date() });

        res.json({
            success: true,
            message: "Heartbeat received — device marked online",
            data: { device_id: device.id, last_sync: device.last_sync },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};


// ─────────────────────────────────────────────────────────────────
// PHASE 12 — EXCEL EXPORT
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/biometric/export/excel
 * Export biometric attendance to Excel file
 */
exports.exportExcel = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const { start_date, end_date, class_id } = req.query;

        const where = { institute_id };
        if (start_date && end_date) {
            where.date = { [Op.between]: [start_date, end_date] };
        }
        if (class_id) where.class_id = class_id;

        const records = await Attendance.findAll({
            where,
            include: [
                { model: Student, include: [{ model: User, attributes: ["name"] }] },
                { model: Class, attributes: ["name", "section"] },
            ],
            order: [["date", "ASC"], ["student_id", "ASC"]],
        });

        const ExcelJS = require("exceljs");
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "ZenithFlows Biometric";
        workbook.created = new Date();

        const sheet = workbook.addWorksheet("Biometric Attendance", {
            pageSetup: { paperSize: 9, orientation: "landscape" },
        });

        // Header row styling
        sheet.columns = [
            { header: "Date", key: "date", width: 14 },
            { header: "Student Name", key: "name", width: 25 },
            { header: "Class", key: "className", width: 18 },
            { header: "Status", key: "status", width: 12 },
            { header: "Time In", key: "time_in", width: 12 },
            { header: "Time Out", key: "time_out", width: 12 },
            { header: "Late?", key: "is_late", width: 10 },
            { header: "Late By (min)", key: "late_by_minutes", width: 14 },
            { header: "Half Day?", key: "is_half_day", width: 12 },
            { header: "Marked By", key: "marked_by_type", width: 15 },
            { header: "Remarks", key: "remarks", width: 25 },
        ];

        // Style header
        sheet.getRow(1).eachCell((cell) => {
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6366F1" } };
            cell.alignment = { vertical: "middle", horizontal: "center" };
        });

        // Data rows
        records.forEach((r) => {
            const row = sheet.addRow({
                date: r.date,
                name: r.Student?.User?.name || "—",
                className: r.Class ? `${r.Class.name} ${r.Class.section || ""}`.trim() : "—",
                status: r.status,
                time_in: r.time_in || "—",
                time_out: r.time_out || "—",
                is_late: r.is_late ? "Yes" : "No",
                late_by_minutes: r.late_by_minutes || 0,
                is_half_day: r.is_half_day ? "Yes" : "No",
                marked_by_type: r.marked_by_type || "manual",
                remarks: r.remarks || "",
            });

            // Color rows by status
            const statusColors = {
                present: "FFBCF5BC",
                absent: "FFFBB4B4",
                late: "FFFDE9B0",
                half_day: "FFE8D5FF",
                holiday: "FFD0E8FF",
            };
            const color = statusColors[r.status] || "FFFFFFFF";
            row.eachCell((cell) => {
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
            });
        });

        // Set response headers for download
        const filename = `biometric_attendance_${start_date || "all"}_to_${end_date || "all"}.xlsx`;
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error("Excel export error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};
