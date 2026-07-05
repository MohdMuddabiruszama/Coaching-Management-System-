/**
 * Attendance Controller - Professional Implementation
 * Implements all features from attendance.md blueprint
 */

const { Attendance, Student, Class, User, Institute, Plan, ClassSession } = require("../models");
const { Op } = require("sequelize");
const crypto = require("crypto");
const NotificationService = require("../services/notificationService");

/**
 * Mark Bulk Attendance for a Class
 * @route POST /api/attendance/bulk
 * @access Admin, Faculty
 */const { catchAsync } = require("../utils/catchAsync");
exports.markBulkAttendance = catchAsync(async (req, res) => {
  try {
    const { class_id, subject_id, date, attendance_data } = req.body;
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
      if (item.status === "pending") continue; // Skip unmarked students

      const existing = await Attendance.findOne({
        where: {
          institute_id,
          student_id: item.student_id,
          class_id,
          subject_id: subject_id || null,
          date
        }
      });

      if (existing) {
        // Update existing record (allows faculty to override QR or absent marks)
        await existing.update({
          status: item.status,
          remarks: item.remarks || existing.remarks,
          marked_by
        });
        results.push(existing);
      } else {
        // Create new record
        const created = await Attendance.create({
          institute_id,
          student_id: item.student_id,
          class_id,
          subject_id: subject_id || null,
          date,
          status: item.status,
          remarks: item.remarks || null,
          marked_by
        });
        results.push(created);
        
        // Notify if present, absent, or late
        if (["present", "absent", "late"].includes(item.status)) {
          const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
          const statusCapitalized = item.status.charAt(0).toUpperCase() + item.status.slice(1);
          
          NotificationService.notifyStudentAndParents(
             institute_id, 
             item.student_id, 
             `attendance_${item.status}`, 
             `${statusCapitalized} Alert`, 
             `You were marked ${item.status} on ${date} at ${currentTime}.`,
             `/student/attendance`
          );
        }
      }
    }

    res.status(201).json({
      success: true,
      message: `Attendance marked successfully for ${results.length} students`,
      data: results
    });
  } catch (error) {
    console.error("Bulk attendance error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Get Attendance for a specific date and class
 * @route GET /api/attendance/class/:class_id/date/:date
 * @access Admin, Faculty
 */
exports.getClassAttendanceByDate = catchAsync(async (req, res) => {
  try {
    const { class_id, subject_id, date } = req.params;
    const institute_id = req.user.institute_id;

    console.log('getClassAttendanceByDate called:', { class_id, subject_id, date, institute_id });

    const whereClause = {
      institute_id,
      [Op.and]: [
      {
        [Op.or]: [
        { admission_date: null },
        { admission_date: { [Op.lte]: date } }]

      },
      {
        [Op.or]: [
        { leave_date: null },
        { leave_date: { [Op.gte]: date } }]

      }]

    };

    const includeOptions = [
    {
      model: User,
      attributes: ['id', 'name', 'email']
    },
    {
      model: Class,
      where: { id: class_id },
      attributes: [],
      through: { attributes: [] }
    }];


    // Strict filtering: Only fetch students enrolled in this exact Subject
    if (subject_id && subject_id !== 'undefined' && subject_id !== 'null') {
      const { Subject } = require('../models');
      includeOptions.push({
        model: Subject,
        where: { id: subject_id },
        attributes: ["id"],
        through: { attributes: [] },
        required: false // LEFT JOIN so we don't filter out full course students
      });
    }

    // Get all students in the class/subject matching the date criteria
    const allStudents = await Student.findAll({
      where: whereClause,
      include: includeOptions,
      order: [['roll_number', 'ASC']]
    });

    let students = allStudents;
    if (subject_id && subject_id !== 'undefined' && subject_id !== 'null') {
      students = allStudents.filter((s) => s.is_full_course || s.Subjects && s.Subjects.length > 0);
    }

    console.log('Found students:', students.length);

    // Get attendance records for this date
    const attendanceRecords = await Attendance.findAll({
      where: { class_id, subject_id, date, institute_id },
      include: [{ model: User, as: 'marker', attributes: ['name', 'role'] }]
    });

    // Map attendance to students
    const attendanceMap = {};
    attendanceRecords.forEach((record) => {
      attendanceMap[record.student_id] = record;
    });

    const result = students.map((student) => ({
      student_id: student.id,
      roll_number: student.roll_number,
      name: student.User?.name,
      email: student.User?.email,
      attendance: attendanceMap[student.id] || null
    }));

    res.status(200).json({
      success: true,
      data: result,
      summary: {
        total: students.length,
        marked: attendanceRecords.length,
        present: attendanceRecords.filter((r) => r.status === 'present').length,
        absent: attendanceRecords.filter((r) => r.status === 'absent').length,
        late: attendanceRecords.filter((r) => r.status === 'late').length,
        holiday: attendanceRecords.filter((r) => r.status === 'holiday').length
      }
    });
  } catch (error) {
    console.error("Error in getClassAttendanceByDate:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Get class attendance grid
 * @route GET /api/attendance/class/:class_id/subject/:subject_id/grid
 * @access Admin, Faculty
 */
exports.getClassAttendanceGrid = catchAsync(async (req, res) => {
  try {
    const { class_id, subject_id } = req.params;
    const { start_date, end_date } = req.query;
    const institute_id = req.user.institute_id;

    if (!class_id || !subject_id || !start_date || !end_date) {
      return res.status(400).json({ success: false, message: "Missing required parameters" });
    }

    const { Student, User, Subject, Class } = require('../models');

    // Fetch students enrolled in this class and optionally subject
    const includeOptions = [
    {
      model: User,
      attributes: ['name', 'email']
    },
    {
      model: Class,
      where: { id: class_id },
      attributes: [],
      through: { attributes: [] }
    }];


    if (subject_id && subject_id !== 'undefined' && subject_id !== 'null') {
      includeOptions.push({
        model: Subject,
        where: { id: subject_id },
        attributes: ["id"],
        through: { attributes: [] },
        required: false
      });
    }

    const allStudents = await Student.findAll({
      where: { institute_id },
      include: includeOptions,
      order: [['roll_number', 'ASC']]
    });

    let students = allStudents;
    if (subject_id && subject_id !== 'undefined' && subject_id !== 'null') {
      students = allStudents.filter((s) => s.is_full_course || s.Subjects && s.Subjects.length > 0);
    }

    const attendanceRecords = await Attendance.findAll({
      where: {
        institute_id,
        class_id,
        subject_id,
        date: { [Op.between]: [start_date, end_date] }
      },
      order: [['date', 'ASC']]
    });

    const result = students.map((student) => {
      const stuRecords = attendanceRecords.filter((r) => r.student_id === student.id);
      const total = stuRecords.length;
      const holidays = stuRecords.filter((r) => r.status === 'holiday').length;
      const workingDays = total - holidays;
      const present = stuRecords.filter((r) => r.status === 'present').length;
      const percentage = workingDays > 0 ? (present / workingDays * 100).toFixed(2) : 0;

      // Map dates specifically
      const daily = {};
      stuRecords.forEach((r) => {
        daily[r.date] = r.status;
      });

      return {
        student_id: student.id,
        roll_number: student.roll_number,
        name: student.User?.name,
        total_days: total,
        working_days: workingDays,
        present_days: present,
        absent_days: stuRecords.filter((r) => r.status === 'absent').length,
        late_days: stuRecords.filter((r) => r.status === 'late').length,
        holiday_days: holidays,
        percentage: parseFloat(percentage),
        daily: daily
      };
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Error in getClassAttendanceGrid:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Update Attendance (Admin only, with restrictions)
 * @route PUT /api/attendance/:id
 * @access Admin only
 */
exports.updateAttendance = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;
    const institute_id = req.user.institute_id;

    const attendance = await Attendance.findOne({
      where: { id, institute_id }
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found"
      });
    }

    // Check if attendance is older than 7 days (configurable rule)
    const daysDiff = Math.floor((new Date() - new Date(attendance.date)) / (1000 * 60 * 60 * 24));
    if (daysDiff > 7 && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Cannot edit attendance older than 7 days. Contact admin."
      });
    }

    await attendance.update({ status, remarks });

    if (["present", "absent", "late"].includes(status)) {
       const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
       const statusCapitalized = status.charAt(0).toUpperCase() + status.slice(1);
       
       NotificationService.notifyStudentAndParents(
          institute_id, 
          attendance.student_id, 
          `attendance_${status}`, 
          `${statusCapitalized} Alert`, 
          `You were marked ${status} on ${attendance.date} at ${currentTime}.`,
          `/student/attendance`
       );
    }

    res.status(200).json({
      success: true,
      message: "Attendance updated successfully",
      data: attendance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Get Student Attendance Report
 * @route GET /api/attendance/student/:student_id/report
 * @access Admin, Faculty, Student (own)
 */
exports.getStudentAttendanceReport = catchAsync(async (req, res) => {
  try {
    const { student_id } = req.params;
    const { start_date, end_date, month, year, subject_id } = req.query; // Phase 2: subject_id filter
    const institute_id = req.user.institute_id;

    // Build date filter
    let dateFilter = null;
    if (start_date && end_date) {
      dateFilter = { [Op.between]: [start_date, end_date] };
    } else if (month && year) {
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0);
      dateFilter = { [Op.between]: [startOfMonth, endOfMonth] };
    }

    const whereClause = { institute_id, student_id };
    if (dateFilter) {
      whereClause.date = dateFilter;
    }
    // Phase 2: Filter by subject_id if provided
    if (subject_id) {
      whereClause.subject_id = subject_id;
    }

    const records = await Attendance.findAll({
      where: whereClause,
      order: [['date', 'DESC']], // most recent first
      include: [
      {
        model: Class,
        attributes: ['id', 'name']
      },
      {
        model: require('../models').Subject,
        attributes: ['id', 'name']
      }]

    });

    // Phase 1: Working days EXCLUDES holidays — calculate distinct dates for daily counts
    const uniqueDatesMap = {};
    records.forEach((r) => {
      if (!uniqueDatesMap[r.date]) uniqueDatesMap[r.date] = [];
      uniqueDatesMap[r.date].push(r.status);
    });

    let totalDays = 0,workingDays = 0,presentDays = 0,absentDays = 0,lateDays = 0,holidays = 0;

    Object.values(uniqueDatesMap).forEach((statuses) => {
      totalDays++;
      if (statuses.includes('holiday')) {
        holidays++;
      } else {
        workingDays++;
        if (statuses.includes('present') || statuses.includes('half_day')) {
          presentDays++;
        } else if (statuses.includes('late')) {
          lateDays++;
        } else if (statuses.includes('absent')) {
          absentDays++;
        }
      }
    });

    // Phase 2: Calculate actual session attendance for the percentage / average
    let sessionWorking = 0,sessionPresent = 0,sessionLate = 0;
    records.forEach((r) => {
      if (r.status !== 'holiday') {
        sessionWorking++;
        if (r.status === 'present' || r.status === 'half_day') sessionPresent++;else
        if (r.status === 'late') sessionLate++;
      }
    });

    const percentage = sessionWorking > 0 ? ((sessionPresent + sessionLate) / sessionWorking * 100).toFixed(2) : 0;

    res.status(200).json({
      success: true,
      data: {
        records,
        summary: {
          total_days: totalDays,
          working_days: workingDays, // Correctly distinct working days
          present_days: presentDays,
          absent_days: absentDays,
          late_days: lateDays,
          holiday_days: holidays,
          attendance_percentage: parseFloat(percentage),
          percentage: parseFloat(percentage)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Get Class Attendance Summary
 * @route GET /api/attendance/class/:class_id/summary
 * @access Admin, Faculty
 */
exports.getClassAttendanceSummary = catchAsync(async (req, res) => {
  try {
    const { class_id } = req.params;
    const { start_date, end_date } = req.query;
    const institute_id = req.user.institute_id;

    const whereClause = { institute_id, class_id };
    if (start_date && end_date) {
      whereClause.date = { [Op.between]: [start_date, end_date] };
    }

    const students = await Student.findAll({
      where: { institute_id },
      include: [
      { model: User, attributes: ['name'] },
      { model: Class, where: { id: class_id }, attributes: [], through: { attributes: [] } }]

    });

    const attendanceData = await Promise.all(students.map(async (student) => {
      const records = await Attendance.findAll({
        where: { ...whereClause, student_id: student.id }
      });

      const uniqueDatesMap = {};
      records.forEach((r) => {
        if (!uniqueDatesMap[r.date]) uniqueDatesMap[r.date] = [];
        uniqueDatesMap[r.date].push(r.status);
      });

      let total = 0,workingDays = 0,present = 0,absent = 0,late = 0,holidays = 0;

      Object.values(uniqueDatesMap).forEach((statuses) => {
        total++;
        if (statuses.includes('holiday')) {
          holidays++;
        } else {
          workingDays++;
          if (statuses.includes('present') || statuses.includes('half_day')) {
            present++;
          } else if (statuses.includes('late')) {
            late++;
          } else if (statuses.includes('absent')) {
            absent++;
          }
        }
      });

      let sessionWorking = 0,sessionPresent = 0,sessionLate = 0;
      records.forEach((r) => {
        if (r.status !== 'holiday') {
          sessionWorking++;
          if (r.status === 'present' || r.status === 'half_day') sessionPresent++;else
          if (r.status === 'late') sessionLate++;
        }
      });

      const percentage = sessionWorking > 0 ? ((sessionPresent + sessionLate) / sessionWorking * 100).toFixed(2) : 0;

      return {
        student_id: student.id,
        roll_number: student.roll_number,
        name: student.User?.name,
        total_days: total,
        working_days: workingDays,
        present_days: present,
        absent_days: absent,
        late_days: late,
        holiday_days: holidays,
        percentage: parseFloat(percentage)
      };
    }));

    // Sort by percentage (lowest first to identify at-risk students)
    attendanceData.sort((a, b) => a.percentage - b.percentage);

    res.status(200).json({
      success: true,
      data: attendanceData,
      at_risk_students: attendanceData.filter((s) => s.percentage < 75)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Get Attendance Dashboard Stats
 * @route GET /api/attendance/dashboard
 * @access Admin, Faculty
 */
exports.getAttendanceDashboard = catchAsync(async (req, res) => {
  try {
    const institute_id = req.user.institute_id;
    const today = req.query.date || new Date().toISOString().split('T')[0];

    console.log('Dashboard request for institute:', institute_id, 'date:', today);

    // Today's attendance
    const todayAttendance = await Attendance.findAll({
      where: { institute_id, date: today }
    });

    console.log('Today attendance records:', todayAttendance.length);

    const todayHolidays = todayAttendance.filter((r) => r.status === 'holiday').length;
    const todayPresent = todayAttendance.filter((r) => r.status === 'present').length;
    const todayTotal = todayAttendance.length;
    const todayWorking = todayTotal - todayHolidays;
    const todayPercentage = todayWorking > 0 ? (todayPresent / todayWorking * 100).toFixed(2) : 0;

    // This month's average
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthStr = startOfMonth.toISOString().split('T')[0];

    console.log('Fetching month attendance from:', startOfMonthStr);

    const monthAttendance = await Attendance.findAll({
      where: {
        institute_id,
        date: { [Op.gte]: startOfMonthStr }
      }
    });

    console.log('Month attendance records:', monthAttendance.length);

    const monthHolidays = monthAttendance.filter((r) => r.status === 'holiday').length;
    const monthPresent = monthAttendance.filter((r) => r.status === 'present').length;
    const monthTotal = monthAttendance.length;
    const monthWorking = monthTotal - monthHolidays;
    const monthPercentage = monthWorking > 0 ? (monthPresent / monthWorking * 100).toFixed(2) : 0;

    // Students below 75%
    const students = await Student.findAll({ where: { institute_id } });
    const lowAttendanceStudents = [];

    console.log('Checking attendance for', students.length, 'students');

    for (const student of students) {
      const records = await Attendance.findAll({
        where: { institute_id, student_id: student.id }
      });
      const total = records.length;
      const holidays = records.filter((r) => r.status === 'holiday').length;
      const workingDays = total - holidays;
      const present = records.filter((r) => r.status === 'present').length;
      const percentage = workingDays > 0 ? present / workingDays * 100 : 0;

      if (percentage < 75 && workingDays > 0) {
        lowAttendanceStudents.push({
          student_id: student.id,
          roll_number: student.roll_number,
          percentage: percentage.toFixed(2)
        });
      }
    }

    // Calculate Pending Classes for Faculty
    let pending_classes = [];
    if (req.user.role === 'faculty') {
      const { Faculty, Subject, Class } = require('../models');
      const facultyUser = await Faculty.findOne({ where: { user_id: req.user.id } });
      if (facultyUser) {
        const subjects = await Subject.findAll({
          where: { faculty_id: facultyUser.id, institute_id },
          include: [{ model: Class, attributes: ['id', 'name', 'section'] }]
        });

        for (const sub of subjects) {
          const count = await Attendance.count({
            where: {
              institute_id,
              subject_id: sub.id,
              class_id: sub.class_id,
              date: today
            }
          });
          if (count === 0 && sub.Class) {
            pending_classes.push({
              class_id: sub.class_id,
              class_name: `${sub.Class.name} ${sub.Class.section ? '- ' + sub.Class.section : ''}`,
              subject_id: sub.id,
              subject_name: sub.name
            });
          }
        }
      }
    }

    res.status(200).json({
      success: true,
      data: {
        today: {
          total: todayTotal,
          present: todayPresent,
          percentage: parseFloat(todayPercentage)
        },
        this_month: {
          total: monthTotal,
          present: monthPresent,
          percentage: parseFloat(monthPercentage)
        },
        low_attendance_count: lowAttendanceStudents.length,
        low_attendance_students: lowAttendanceStudents.slice(0, 10), // Top 10
        pending_classes
      }
    });
  } catch (error) {
    console.error("Error in getAttendanceDashboard:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Delete Attendance Record
 * @route DELETE /api/attendance/:id
 * @access Admin only
 */
exports.deleteAttendance = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const institute_id = req.user.institute_id;

    const attendance = await Attendance.findOne({
      where: { id, institute_id }
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found"
      });
    }

    await attendance.destroy();

    res.status(200).json({
      success: true,
      message: "Attendance record deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * --- SMART ATTENDANCE (QR) ---
 */

exports.startSmartSession = catchAsync(async (req, res) => {
  try {
    const { class_id, subject_id } = req.body;
    const institute_id = req.user.institute_id;
    const faculty_id = req.user.id;

    // Check if there's already an active session for this class AND subject
    const existingSession = await ClassSession.findOne({
      where: {
        class_id,
        subject_id: subject_id || null,
        institute_id,
        is_active: true,
        expires_at: { [Op.gt]: new Date() }
      }
    });

    if (existingSession) {
      return res.status(400).json({
        success: false,
        message: "A smart attendance session is already active for this class",
        data: existingSession
      });
    }

    // Generate token
    const session_token = crypto.randomBytes(32).toString("hex");
    const expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const newSession = await ClassSession.create({
      institute_id,
      class_id,
      subject_id: subject_id || null,
      faculty_id,
      session_token,
      expires_at
    });

    res.status(201).json({
      success: true,
      message: "Smart session started successfully",
      data: {
        session_token: newSession.session_token,
        expires_at: newSession.expires_at,
        id: newSession.id
      }
    });
  } catch (error) {
    console.error("Start smart session error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

exports.getActiveSession = catchAsync(async (req, res) => {
  try {
    const { class_id } = req.params;
    const institute_id = req.user.institute_id;

    const whereClause = {
      institute_id,
      is_active: true,
      expires_at: { [Op.gt]: new Date() }
    };

    if (class_id === "current") {
      whereClause.faculty_id = req.user.id;
    } else {
      whereClause.class_id = class_id;
    }

    const session = await ClassSession.findOne({
      where: whereClause,
      order: [['created_at', 'DESC']]
    });

    if (!session) {
      return res.status(200).json({ success: true, data: null }); // Returning 200 with null is cleaner for frontend
    }

    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error("Get active session error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

exports.endSmartSession = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const institute_id = req.user.institute_id;

    const session = await ClassSession.findOne({
      where: { id, institute_id, is_active: true }
    });

    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found or already ended" });
    }

    await session.update({
      is_active: false,
      end_time: new Date()
    });

    res.status(200).json({
      success: true,
      message: "Session ended successfully"
    });
  } catch (error) {
    console.error("End smart session error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

exports.markAttendanceByQR = catchAsync(async (req, res) => {
  try {
    const { session_token, date } = req.body;
    const student_user_id = req.user.id;
    const institute_id = req.user.institute_id;

    // Find Student record
    const student = await Student.findOne({ where: { user_id: student_user_id, institute_id } });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student record not found" });
    }
    const student_id = student.id;

    // Verify session
    const session = await ClassSession.findOne({
      where: {
        session_token,
        institute_id,
        is_active: true,
        expires_at: { [Op.gt]: new Date() }
      }
    });

    if (!session) {
      return res.status(400).json({ success: false, message: "Invalid or expired session token" });
    }

    // Phase 1: Check if student is enrolled in the session's subject
    if (session.subject_id && !student.is_full_course) {
      const { StudentSubject } = require('../models');
      const enrollment = await StudentSubject.findOne({
        where: {
          student_id: student_id,
          subject_id: session.subject_id
        }
      });
      if (!enrollment) {
        return res.status(403).json({
          success: false,
          message: "You are not enrolled in this subject, therefore you cannot mark attendance for it."
        });
      }
    } else if (session.class_id) {
      // If it's a class-level attendance, check if the student belongs to the class
      const { StudentClass } = require('../models');
      const classEnrollment = await StudentClass.findOne({
        where: {
          student_id: student_id,
          class_id: session.class_id
        }
      });
      if (!classEnrollment) {
        return res.status(403).json({
          success: false,
          message: "You are not enrolled in this class, therefore you cannot mark attendance for it."
        });
      }
    }

    const targetDate = date || new Date().toISOString().split('T')[0];

    // Check if admission date is valid
    if (student.admission_date && new Date(targetDate) < new Date(student.admission_date)) {
      return res.status(400).json({
        success: false,
        message: "You cannot mark attendance for a date before your admission date."
      });
    }

    // Check if already marked today for this subjective class via the token's subject_id
    const existingAttendance = await Attendance.findOne({
      where: {
        student_id,
        institute_id,
        class_id: session.class_id,
        subject_id: session.subject_id || null,
        date: targetDate
      }
    });

    if (existingAttendance) {
      return res.status(400).json({ success: false, message: "Attendance already marked for today!" });
    }

    // Mark attendance
    await Attendance.create({
      institute_id,
      student_id,
      class_id: session.class_id,
      subject_id: session.subject_id || null,
      date: targetDate,
      status: "present",
      marked_by: session.faculty_id,
      remarks: "Smart Attendance (QR)"
    });

    res.status(200).json({ success: true, message: "Attendance marked successfully! ✅" });

  } catch (error) {
    console.error("Mark by QR error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

exports.markAttendanceByStudentQR = catchAsync(async (req, res) => {
  try {
    const { qr_code, class_id, subject_id, date } = req.body;
    const institute_id = req.user.institute_id;
    const faculty_id = req.user.id;

    if (!qr_code || !qr_code.startsWith("STUDENT_QR_")) {
      return res.status(400).json({ success: false, message: "Invalid QR format. Must be a valid student QR code." });
    }

    const student_id = qr_code.split("STUDENT_QR_")[1];

    // Find Student (include User for name in response messages)
    const student = await Student.findOne({
      where: { id: student_id, institute_id },
      include: [{ model: User, attributes: ['name', 'email'] }]
    });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student record not found in your institute" });
    }

    // Verify enrollments
    if (subject_id && !student.is_full_course) {
      const { StudentSubject } = require('../models');
      const enrollment = await StudentSubject.findOne({
        where: { student_id, subject_id: subject_id }
      });
      if (!enrollment) {
        return res.status(403).json({ success: false, message: "Student is not enrolled in this subject" });
      }
    } else if (class_id) {
      const { StudentClass } = require('../models');
      const enrollment = await StudentClass.findOne({
        where: { student_id, class_id }
      });
      if (!enrollment) {
        return res.status(403).json({ success: false, message: "Student is not enrolled in this class" });
      }
    } else if (subject_id && student.is_full_course) {
      const { Subject, StudentClass } = require('../models');
      const subj = await Subject.findOne({ where: { id: subject_id } });
      if (subj) {
        const enrollment = await StudentClass.findOne({
          where: { student_id, class_id: subj.class_id }
        });
        if (!enrollment) {
          return res.status(403).json({ success: false, message: "Student is not enrolled in the class for this subject" });
        }
      } else {
        return res.status(403).json({ success: false, message: "Subject not found" });
      }
    }

    const targetDate = date || new Date().toISOString().split('T')[0];

    // Ensure student has admission before marking attendance
    if (student.admission_date && new Date(targetDate) < new Date(student.admission_date)) {
      return res.status(400).json({ success: false, message: "Cannot mark attendance before admission date." });
    }

    // Check already marked
    const existingAttendance = await Attendance.findOne({
      where: {
        student_id,
        institute_id,
        class_id,
        subject_id: subject_id || null,
        date: targetDate
      }
    });

    if (existingAttendance) {
      if (existingAttendance.status === 'present') {
        return res.status(400).json({ success: false, message: `Attendance already marked present today for ${student.User?.name || 'this student'}!` });
      } else {
        // override absent to present
        await existingAttendance.update({ status: 'present', marked_by: faculty_id, remarks: "Smart Attendance (QR)" });
        return res.status(200).json({ success: true, message: `Attendance updated to Present for ${student.User?.name || 'Student'} ✅` });
      }
    }

    await Attendance.create({
      institute_id,
      student_id,
      class_id,
      subject_id: subject_id || null,
      date: targetDate,
      status: "present",
      marked_by: faculty_id,
      remarks: "Smart Attendance (QR)"
    });

    res.status(200).json({ success: true, message: `Attendance marked successfully for ${student.User?.name || 'Student'}! ✅` });

  } catch (error) {
    console.error("Mark by Student QR error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = exports;