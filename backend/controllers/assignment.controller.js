const {
    Assignment,
    AssignmentSubmission,
    AssignmentSubmissionHistory,
    AssignmentSetting,
    Class,
    Subject,
    Student,
    User,
    sequelize
} = require("../models");
const { Op } = require("sequelize");
const cloudinary = require("../config/cloudinary");

// Helper: silently delete a Cloudinary asset
async function destroyCloudinary(url, resourceType = "raw") {
    if (!url || !url.includes("cloudinary.com")) return;
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i);
    const publicId = match ? match[1] : null;
    if (!publicId) return;
    try { await cloudinary.uploader.destroy(publicId, { resource_type: resourceType }); } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function calculateGrade(obtained, max) {
    if (!max || max === 0) return null;
    const pct = (obtained / max) * 100;
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    if (pct >= 40) return 'D';
    return 'F';
}

async function ensureSettings(institute_id) {
    const [settings] = await AssignmentSetting.findOrCreate({
        where: { institute_id },
        defaults: { institute_id }
    });
    return settings;
}

// ─────────────────────────────────────────────────────────────────────────────
// FACULTY — CREATE / MANAGE ASSIGNMENTS
// ─────────────────────────────────────────────────────────────────────────────

exports.createAssignment = async (req, res) => {
    try {
        const { title, description, class_id, subject_id, due_date, max_marks, allowed_file_types, max_file_size_mb, allow_late_submission, status } = req.body;
        const institute_id = req.user.institute_id;
        
        let faculty_id = req.user.id; // Default to the logged-in user (if faculty)
        if (req.user.role === 'admin' || req.user.role === 'superadmin' || req.user.role === 'owner' || req.user.role === 'manager') {
            if (!req.body.faculty_id) {
                return res.status(400).json({ success: false, message: 'Faculty owner must be selected when created by admin' });
            }
            faculty_id = req.body.faculty_id;
        }

        if (new Date(due_date) <= new Date(Date.now() + 60 * 60 * 1000) && status !== 'draft') {
            return res.status(400).json({ success: false, message: 'Due date must be at least 1 hour in the future' });
        }

        let reference_file_url = null;
        let reference_file_type = null;
        if (req.file) {
            reference_file_url = req.file.path; // Cloudinary permanent URL
            reference_file_type = req.file.mimetype;
        }

        const assignment = await Assignment.create({
            institute_id,
            faculty_id,
            class_id,
            subject_id,
            title,
            description,
            due_date,
            max_marks,
            allowed_file_types: allowed_file_types ? JSON.parse(allowed_file_types) : undefined,
            max_file_size_mb: max_file_size_mb || 10,
            allow_late_submission: allow_late_submission !== undefined ? allow_late_submission === 'true' || allow_late_submission === true : true,
            status: status || 'draft',
            reference_file_url,
            reference_file_type
        });

        res.status(201).json({ success: true, message: 'Assignment created successfully', assignment });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getFacultyAssignments = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const faculty_id = req.user.id;

        const assignments = await Assignment.findAll({
            where: { institute_id, faculty_id },
            include: [
                { model: Class, attributes: ['id', 'name'] },
                { model: Subject, attributes: ['id', 'name'] }
            ],
            order: [['due_date', 'DESC']]
        });

        const assignmentsWithStats = await Promise.all(assignments.map(async (asg) => {
            const stats = await AssignmentSubmission.findAll({
                where: { assignment_id: asg.id },
                attributes: [
                    'status',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                group: ['status']
            });

            const totalStudents = await Student.count({
                include: [{ model: Class, where: { id: asg.class_id } }],
                where: { institute_id }
            });

            let submittedCount = 0, gradedCount = 0, pendingGradingCount = 0, lateCount = 0;
            stats.forEach(s => {
                const sType = s.getDataValue('status');
                const sCount = parseInt(s.getDataValue('count'));
                if (['submitted', 'resubmit_requested'].includes(sType)) { pendingGradingCount += sCount; submittedCount += sCount; }
                if (sType === 'late') { pendingGradingCount += sCount; submittedCount += sCount; lateCount += sCount; }
                if (sType === 'graded') { gradedCount += sCount; submittedCount += sCount; }
            });

            const asgJson = asg.toJSON();
            asgJson.stats = { total_students: totalStudents, total_submissions: submittedCount, graded: gradedCount, pending_grading: pendingGradingCount, late: lateCount };
            return asgJson;
        }));

        res.status(200).json({ success: true, assignments: assignmentsWithStats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAssignmentDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;
        const assignment = await Assignment.findOne({
            where: { id, institute_id },
            include: [
                { model: Class, attributes: ['id', 'name'] },
                { model: Subject, attributes: ['id', 'name'] },
                { model: User, as: 'faculty', attributes: ['id', 'name'] }
            ]
        });
        if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
        res.status(200).json({ success: true, assignment });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAssignmentSummary = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;
        const assignment = await Assignment.findOne({ where: { id, institute_id } });
        if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

        const totalStudents = await Student.count({
            include: [{ model: Class, where: { id: assignment.class_id } }],
            where: { institute_id }
        });

        const submitted = await AssignmentSubmission.count({ where: { assignment_id: id, status: { [Op.in]: ['submitted', 'late', 'graded', 'resubmit_requested'] } } });
        const graded = await AssignmentSubmission.count({ where: { assignment_id: id, status: 'graded' } });
        const pending = await AssignmentSubmission.count({ where: { assignment_id: id, status: { [Op.in]: ['submitted', 'late', 'resubmit_requested'] } } });
        const late = await AssignmentSubmission.count({ where: { assignment_id: id, is_late: true } });

        const avgResult = await AssignmentSubmission.findOne({
            where: { assignment_id: id, status: 'graded', marks_obtained: { [Op.not]: null } },
            attributes: [[sequelize.fn('AVG', sequelize.col('marks_obtained')), 'avg_marks']]
        });
        const avg_marks = avgResult?.getDataValue('avg_marks') ? parseFloat(avgResult.getDataValue('avg_marks')).toFixed(2) : null;

        res.status(200).json({ success: true, summary: { total_students: totalStudents, submitted, graded, pending_grading: pending, not_submitted: Math.max(0, totalStudents - submitted), late, avg_marks } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateAssignment = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;
        const { title, description, class_id, subject_id, due_date, max_marks, allowed_file_types, max_file_size_mb, allow_late_submission } = req.body;
        
        const assignment = await Assignment.findOne({ where: { id, institute_id } });
        if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
        
        if (req.user.role === 'faculty' && assignment.faculty_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not authorized to update this assignment' });
        }

        const updateData = {
            title: title || assignment.title,
            description: description !== undefined ? description : assignment.description,
            class_id: class_id || assignment.class_id,
            subject_id: subject_id || assignment.subject_id,
            due_date: due_date || assignment.due_date,
            max_marks: max_marks !== undefined ? max_marks : assignment.max_marks,
            allowed_file_types: allowed_file_types ? JSON.parse(allowed_file_types) : assignment.allowed_file_types,
            max_file_size_mb: max_file_size_mb || assignment.max_file_size_mb,
            allow_late_submission: allow_late_submission !== undefined ? (allow_late_submission === 'true' || allow_late_submission === true) : assignment.allow_late_submission,
        };

        if (req.user.role === 'admin' || req.user.role === 'superadmin' || req.user.role === 'owner' || req.user.role === 'manager') {
            if (req.body.faculty_id) {
                updateData.faculty_id = req.body.faculty_id;
            }
        }

        const submissionsCount = await AssignmentSubmission.count({ where: { assignment_id: id } });
        if (submissionsCount > 0) {
            await assignment.update({ title: updateData.title, description: updateData.description });
        } else {
            await assignment.update(updateData);
        }
        res.status(200).json({ success: true, message: 'Assignment updated successfully', assignment });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.publishAssignment = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;
        const assignment = await Assignment.findOne({ where: { id, institute_id } });
        if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
        if (assignment.status !== 'draft') return res.status(400).json({ success: false, message: 'Assignment is already published/closed' });
        await assignment.update({ status: 'published' });
        res.status(200).json({ success: true, message: 'Assignment published successfully', assignment });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.closeAssignment = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;
        const assignment = await Assignment.findOne({ where: { id, institute_id } });
        if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
        await assignment.update({ status: 'closed' });
        res.status(200).json({ success: true, message: 'Assignment closed', assignment });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteAssignment = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;
        const assignment = await Assignment.findOne({ where: { id, institute_id } });
        if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
        if (req.user.role === 'faculty' && assignment.faculty_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
        if (assignment.status !== 'draft') return res.status(400).json({ success: false, message: 'Only draft assignments can be deleted' });
        const count = await AssignmentSubmission.count({ where: { assignment_id: id } });
        if (count > 0) return res.status(400).json({ success: false, message: 'Cannot delete assignment with submissions' });
        // Delete reference file from Cloudinary if exists
        if (assignment.reference_file_url) {
            destroyCloudinary(assignment.reference_file_url);
        }
        await assignment.destroy();
        res.status(200).json({ success: true, message: 'Assignment deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getSubmissions = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;
        const assignment = await Assignment.findOne({ where: { id, institute_id } });
        if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

        const students = await Student.findAll({
            include: [
                { model: Class, where: { id: assignment.class_id }, attributes: [] },
                { model: User, attributes: ['id', 'name', 'email', 'phone'] }
            ],
            where: { institute_id }
        });

        const submissionsList = await AssignmentSubmission.findAll({ where: { assignment_id: id, institute_id } });
        const submissionsMap = new Map();
        submissionsList.forEach(s => submissionsMap.set(s.student_id, s));

        const roster = students.map(stu => {
            const sub = submissionsMap.get(stu.id);
            return {
                id: sub ? sub.id : `pending-${stu.id}`,
                Student: stu,
                student_id: stu.id,
                status: sub ? sub.status : 'pending',
                submitted_at: sub ? sub.submitted_at : null,
                is_late: sub ? sub.is_late : false,
                late_by_minutes: sub ? sub.late_by_minutes : 0,
                submission_file_url: sub ? sub.submission_file_url : null,
                submission_file_name: sub ? sub.submission_file_name : null,
                submission_file_size_kb: sub ? sub.submission_file_size_kb : null,
                marks_obtained: sub ? sub.marks_obtained : null,
                grade: sub ? sub.grade : null,
                feedback: sub ? sub.feedback : null,
                attempt_number: sub ? sub.attempt_number : 0,
                resubmit_reason: sub ? sub.resubmit_reason : null
            };
        });

        res.status(200).json({ success: true, submissions: roster, assignment });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.gradeSubmission = async (req, res) => {
    try {
        const { asgId, subId } = req.params;
        const { marks_obtained, grade, feedback } = req.body;
        const institute_id = req.user.institute_id;

        const assignment = await Assignment.findOne({ where: { id: asgId, institute_id } });
        if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
        if (req.user.role === 'faculty' && assignment.faculty_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'You can only grade your own assignments' });
        }

        const submission = await AssignmentSubmission.findOne({ where: { id: subId, assignment_id: asgId } });
        if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });
        if (submission.status === 'pending') return res.status(400).json({ success: false, message: 'Cannot grade a pending submission' });

        const marks = parseFloat(marks_obtained);
        const max = parseFloat(assignment.max_marks);
        if (isNaN(marks) || marks > max || marks < 0) {
            return res.status(400).json({ success: false, message: `Marks must be between 0 and ${max}` });
        }

        const calculatedGrade = grade || calculateGrade(marks, max);
        await submission.update({ marks_obtained: marks, grade: calculatedGrade, feedback, status: 'graded', graded_by: req.user.id, graded_at: new Date() });

        res.status(200).json({ success: true, message: 'Graded successfully', submission });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.requestResubmit = async (req, res) => {
    try {
        const { asgId, subId } = req.params;
        const { resubmit_reason } = req.body;
        const institute_id = req.user.institute_id;

        const settings = await ensureSettings(institute_id);
        if (!settings.allow_resubmission) return res.status(400).json({ success: false, message: 'Resubmission is disabled for this institute' });

        const submission = await AssignmentSubmission.findOne({ where: { id: subId, assignment_id: asgId } });
        if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });
        if (submission.attempt_number >= settings.max_resubmit_attempts) {
            return res.status(400).json({ success: false, message: 'Maximum resubmission attempts reached' });
        }

        // Save current to history
        await AssignmentSubmissionHistory.create({
            submission_id: submission.id,
            attempt_number: submission.attempt_number,
            file_url: submission.submission_file_url,
            file_name: submission.submission_file_name,
            submitted_at: submission.submitted_at || new Date()
        });

        await submission.update({ status: 'resubmit_requested', resubmit_reason, attempt_number: submission.attempt_number + 1 });
        res.status(200).json({ success: true, message: 'Resubmission requested', submission });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT — VIEW & SUBMIT
// ─────────────────────────────────────────────────────────────────────────────

exports.getStudentAssignments = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const student = await Student.findOne({
            where: { user_id: req.user.id },
            include: [{ model: Class }, { model: Subject }]
        });
        if (!student) return res.status(404).json({ success: false, message: 'Student record not found' });

        const classIds = student.Classes ? student.Classes.map(c => c.id) : [];
        const subjectIds = student.Subjects ? student.Subjects.map(s => s.id) : [];

        const queryOptions = { institute_id, class_id: { [Op.in]: classIds }, status: { [Op.in]: ['published', 'closed'] } };
        if (!student.is_full_course) queryOptions.subject_id = { [Op.in]: subjectIds };

        const assignments = await Assignment.findAll({
            where: queryOptions,
            include: [
                { model: Class, attributes: ['name'] },
                { model: Subject, attributes: ['name'] },
                { model: User, as: 'faculty', attributes: ['name'] },
                { model: AssignmentSubmission, required: false, where: { student_id: student.id } }
            ],
            order: [['due_date', 'ASC']]
        });

        const formatted = assignments.map(a => {
            const data = a.toJSON();
            const now = new Date();
            const due = new Date(data.due_date);
            data.days_remaining = Math.max(0, Math.ceil((due - now) / (1000 * 60 * 60 * 24)));
            data.hours_remaining = Math.max(0, Math.ceil((due - now) / (1000 * 60 * 60)));
            data.is_overdue = now > due;
            data.my_submission = data.AssignmentSubmissions && data.AssignmentSubmissions.length > 0 ? data.AssignmentSubmissions[0] : null;
            delete data.AssignmentSubmissions;
            return data;
        });

        res.status(200).json({ success: true, assignments: formatted });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getStudentAssignmentDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;
        const student = await Student.findOne({ where: { user_id: req.user.id }, include: [{ model: Class }] });
        if (!student) return res.status(404).json({ success: false, message: 'Student record not found' });

        const classIds = student.Classes ? student.Classes.map(c => c.id) : [];

        const assignment = await Assignment.findOne({
            where: { id, institute_id, class_id: { [Op.in]: classIds }, status: { [Op.in]: ['published', 'closed'] } },
            include: [
                { model: Class, attributes: ['name'] },
                { model: Subject, attributes: ['name'] },
                { model: User, as: 'faculty', attributes: ['name'] },
                { model: AssignmentSubmission, required: false, where: { student_id: student.id } }
            ]
        });
        if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

        const data = assignment.toJSON();
        const now = new Date();
        const due = new Date(data.due_date);
        data.days_remaining = Math.max(0, Math.ceil((due - now) / (1000 * 60 * 60 * 24)));
        data.hours_remaining = Math.max(0, Math.ceil((due - now) / (1000 * 60 * 60)));
        data.is_overdue = now > due;
        data.my_submission = data.AssignmentSubmissions && data.AssignmentSubmissions.length > 0 ? data.AssignmentSubmissions[0] : null;
        if (data.my_submission) {
            data.my_submission.history = await AssignmentSubmissionHistory.findAll({ where: { submission_id: data.my_submission.id } });
        }
        delete data.AssignmentSubmissions;

        res.status(200).json({ success: true, assignment: data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.submitAssignment = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;
        const student = await Student.findOne({ where: { user_id: req.user.id } });
        if (!student) return res.status(404).json({ success: false, message: 'Student record not found' });

        const assignment = await Assignment.findOne({ where: { id, institute_id } });
        if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
        if (!req.file) return res.status(400).json({ success: false, message: 'File is required' });
        if (assignment.status === 'closed' && !assignment.allow_late_submission) {
            return res.status(400).json({ success: false, message: 'Assignment is closed' });
        }

        const fileSizeMb = req.file.size / (1024 * 1024);
        if (fileSizeMb > assignment.max_file_size_mb) {
            return res.status(400).json({ success: false, message: `File size exceeds max limit: ${assignment.max_file_size_mb} MB` });
        }

        const now = new Date();
        const due = new Date(assignment.due_date);
        const isLate = now > due;
        const lateMinutes = isLate ? Math.floor((now - due) / 60000) : 0;

        let submission = await AssignmentSubmission.findOne({ where: { assignment_id: id, student_id: student.id } });

        if (submission) {
            if (['submitted', 'late', 'graded'].includes(submission.status)) {
                return res.status(400).json({ success: false, message: 'You have already submitted this assignment' });
            }
            if (submission.status === 'resubmit_requested') {
                return res.status(400).json({ success: false, message: 'Please use the resubmit endpoint for resubmissions' });
            }
        }

        if (!submission) {
            submission = await AssignmentSubmission.create({
                institute_id,
                assignment_id: id,
                student_id: student.id,
                submission_file_url: req.file.path,  // Cloudinary permanent URL
                submission_file_name: req.file.originalname,
                submission_file_type: req.file.mimetype,
                submission_file_size_kb: Math.ceil(req.file.size / 1024),
                submitted_at: now,
                is_late: isLate,
                late_by_minutes: lateMinutes,
                status: isLate ? 'late' : 'submitted'
            });
        }

        await assignment.increment('total_submissions');
        res.status(200).json({ success: true, message: 'Assignment submitted successfully', submission });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.resubmitAssignment = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;
        const student = await Student.findOne({ where: { user_id: req.user.id } });
        if (!student) return res.status(404).json({ success: false, message: 'Student record not found' });

        const assignment = await Assignment.findOne({ where: { id, institute_id } });
        if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
        if (!req.file) return res.status(400).json({ success: false, message: 'File is required' });

        const submission = await AssignmentSubmission.findOne({ where: { assignment_id: id, student_id: student.id } });
        if (!submission) return res.status(404).json({ success: false, message: 'No submission found to resubmit' });
        if (submission.status !== 'resubmit_requested') {
            return res.status(400).json({ success: false, message: 'Resubmission not requested for this assignment' });
        }

        const settings = await ensureSettings(institute_id);
        if (submission.attempt_number > settings.max_resubmit_attempts) {
            return res.status(400).json({ success: false, message: 'Maximum resubmission attempts reached' });
        }

        const now = new Date();
        const due = new Date(assignment.due_date);
        const isLate = now > due;
        const lateMinutes = isLate ? Math.floor((now - due) / 60000) : 0;

        await submission.update({
            submission_file_url: req.file.path,  // Cloudinary permanent URL
            submission_file_name: req.file.originalname,
            submission_file_type: req.file.mimetype,
            submission_file_size_kb: Math.ceil(req.file.size / 1024),
            submitted_at: now,
            is_late: isLate,
            late_by_minutes: lateMinutes,
            status: isLate ? 'late' : 'submitted',
            resubmit_reason: null
        });

        res.status(200).json({ success: true, message: 'Resubmission successful', submission });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN / OWNER METHODS
// ─────────────────────────────────────────────────────────────────────────────

exports.getAdminAssignments = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const { status, class_id, subject_id, faculty_id } = req.query;
        const where = { institute_id };
        if (status) where.status = status;
        if (class_id) where.class_id = class_id;
        if (subject_id) where.subject_id = subject_id;
        if (faculty_id) where.faculty_id = faculty_id;

        const assignments = await Assignment.findAll({
            where,
            include: [
                { model: Class, attributes: ['name'] },
                { model: Subject, attributes: ['name'] },
                { model: User, as: 'faculty', attributes: ['name'] }
            ],
            order: [['due_date', 'DESC']]
        });

        const enhanced = await Promise.all(assignments.map(async a => {
            const data = a.toJSON();
            const submissions = await AssignmentSubmission.count({ where: { assignment_id: a.id } });
            const graded = await AssignmentSubmission.count({ where: { assignment_id: a.id, status: 'graded' } });
            const totalStudents = await Student.count({
                include: [{ model: Class, where: { id: a.class_id } }],
                where: { institute_id }
            });
            const avgResult = await AssignmentSubmission.findOne({
                where: { assignment_id: a.id, status: 'graded', marks_obtained: { [Op.not]: null } },
                attributes: [[sequelize.fn('AVG', sequelize.col('marks_obtained')), 'avg']]
            });
            data.submissions_count = submissions;
            data.total_students = totalStudents;
            data.graded_count = graded;
            data.avg_score = avgResult?.getDataValue('avg') ? parseFloat(avgResult.getDataValue('avg')).toFixed(1) : null;
            return data;
        }));

        res.status(200).json({ success: true, assignments: enhanced });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAdminStats = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const totalAssignments = await Assignment.count({ where: { institute_id, status: { [Op.in]: ['published', 'closed'] } } });
        const pendingGrading = await AssignmentSubmission.count({ where: { institute_id, status: { [Op.in]: ['submitted', 'late'] } } });
        const totalSubmissions = await AssignmentSubmission.count({ where: { institute_id } });
        const gradedSubmissions = await AssignmentSubmission.count({ where: { institute_id, status: 'graded' } });
        const lateSubmissions = await AssignmentSubmission.count({ where: { institute_id, is_late: true } });

        const avgResult = await AssignmentSubmission.findOne({
            where: { institute_id, status: 'graded', marks_obtained: { [Op.not]: null } },
            attributes: [[sequelize.fn('AVG', sequelize.col('marks_obtained')), 'avg']]
        });
        const avg_score = avgResult?.getDataValue('avg') ? parseFloat(avgResult.getDataValue('avg')).toFixed(1) : '0';

        res.status(200).json({
            success: true,
            stats: {
                total_assignments: totalAssignments,
                pending_grading: pendingGrading,
                total_submissions: totalSubmissions,
                graded_submissions: gradedSubmissions,
                late_submissions: lateSubmissions,
                avg_score,
                submission_rate: totalAssignments > 0 ? Math.round((totalSubmissions / (totalAssignments * 1)) * 100) : 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getPendingGrading = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const submissions = await AssignmentSubmission.findAll({
            where: { institute_id, status: { [Op.in]: ['submitted', 'late', 'resubmit_requested'] } },
            include: [
                { model: Student, include: [{ model: User, attributes: ['name'] }] },
                { model: Assignment, include: [{ model: Subject, attributes: ['name'] }, { model: Class, attributes: ['name'] }] }
            ],
            order: [['submitted_at', 'ASC']]
        });
        res.status(200).json({ success: true, submissions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getOverdueStudents = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const now = new Date();

        // Assignments that are past due
        const overdueAssignments = await Assignment.findAll({
            where: { institute_id, due_date: { [Op.lt]: now }, status: { [Op.in]: ['published', 'closed'] } },
            include: [{ model: Class, attributes: ['id', 'name'] }, { model: Subject, attributes: ['name'] }]
        });

        const overdueData = await Promise.all(overdueAssignments.map(async (asg) => {
            const studentsInClass = await Student.findAll({
                include: [
                    { model: Class, where: { id: asg.class_id }, attributes: [] },
                    { model: User, attributes: ['name', 'email'] }
                ],
                where: { institute_id }
            });

            const submitted = await AssignmentSubmission.findAll({ where: { assignment_id: asg.id }, attributes: ['student_id'] });
            const submittedIds = new Set(submitted.map(s => s.student_id));

            const overdue = studentsInClass.filter(s => !submittedIds.has(s.id)).map(s => ({
                id: s.id,
                name: s.User?.name,
                email: s.User?.email
            }));

            if (overdue.length === 0) return null;
            return {
                assignment: { id: asg.id, title: asg.title, due_date: asg.due_date, class_name: asg.Class?.name, subject_name: asg.Subject?.name },
                overdue_students: overdue,
                count: overdue.length
            };
        }));

        res.status(200).json({ success: true, overdue: overdueData.filter(Boolean) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.exportAssignments = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const assignments = await Assignment.findAll({
            where: { institute_id },
            include: [
                { model: Class, attributes: ['name'] },
                { model: Subject, attributes: ['name'] },
                { model: User, as: 'faculty', attributes: ['name'] }
            ],
            order: [['due_date', 'DESC']]
        });

        // Simple CSV export (without exceljs dependency)
        const rows = [['ID', 'Title', 'Class', 'Subject', 'Faculty', 'Due Date', 'Max Marks', 'Status', 'Total Submissions']];
        for (const a of assignments) {
            rows.push([
                a.id, a.title, a.Class?.name || '', a.Subject?.name || '',
                a.faculty?.name || '', new Date(a.due_date).toLocaleDateString(),
                a.max_marks, a.status, a.total_submissions
            ]);
        }

        const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="assignments-report.csv"');
        res.send(csv);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getStudentAssignmentHistory = async (req, res) => {
    try {
        const { studentId } = req.params;
        const institute_id = req.user.institute_id;
        const student = await Student.findOne({ where: { id: studentId, institute_id }, include: [{ model: User, attributes: ['name'] }] });
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        const submissions = await AssignmentSubmission.findAll({
            where: { student_id: student.id, institute_id },
            include: [{ model: Assignment, include: [{ model: Subject, attributes: ['name'] }, { model: Class, attributes: ['name'] }] }],
            order: [['submitted_at', 'DESC']]
        });

        res.status(200).json({ success: true, student, submissions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getSettings = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const settings = await ensureSettings(institute_id);
        res.status(200).json({ success: true, settings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const settings = await ensureSettings(institute_id);
        await settings.update(req.body);
        res.status(200).json({ success: true, message: 'Settings updated successfully', settings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PARENT METHODS
// ─────────────────────────────────────────────────────────────────────────────

exports.getParentAssignments = async (req, res) => {
    try {
        const { studentId } = req.params;
        const institute_id = req.user.institute_id;

        const student = await Student.findOne({
            where: { id: studentId, institute_id },
            include: [{ model: Class }, { model: Subject }, { model: User, attributes: ['name'] }]
        });
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        const classIds = student.Classes ? student.Classes.map(c => c.id) : [];
        const subjectIds = student.Subjects ? student.Subjects.map(s => s.id) : [];

        const queryOptions = { institute_id, class_id: { [Op.in]: classIds }, status: { [Op.in]: ['published', 'closed'] } };
        if (!student.is_full_course) queryOptions.subject_id = { [Op.in]: subjectIds };

        const assignments = await Assignment.findAll({
            where: queryOptions,
            include: [
                { model: Class, attributes: ['name'] },
                { model: Subject, attributes: ['name'] },
                { model: User, as: 'faculty', attributes: ['name'] },
                { model: AssignmentSubmission, required: false, where: { student_id: student.id } }
            ],
            order: [['due_date', 'ASC']]
        });

        const formatted = assignments.map(a => {
            const data = a.toJSON();
            const now = new Date();
            const due = new Date(data.due_date);
            data.days_remaining = Math.max(0, Math.ceil((due - now) / (1000 * 60 * 60 * 24)));
            data.is_overdue = now > due;
            data.my_submission = data.AssignmentSubmissions && data.AssignmentSubmissions.length > 0 ? data.AssignmentSubmissions[0] : null;
            delete data.AssignmentSubmissions;
            return data;
        });

        res.status(200).json({ success: true, assignments: formatted, student });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
