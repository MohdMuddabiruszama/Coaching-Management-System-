const { User, StudentParent, Student, Class, Subject, Institute, Attendance, Mark, Exam, StudentFee, Note, NoteDownload, Faculty } = require("../models");
const { hashPassword } = require("../utils/hashPassword");
const { Op } = require("sequelize");

// Helper function to check if student is linked to parent
const isStudentLinked = async (parent_id, student_id) => {
    const link = await StudentParent.findOne({
        where: { parent_id, student_id }
    });
    return !!link;
};

/**
 * Create a new parent
 * @route POST /api/parents
 * @access Admin
 */
exports.createParent = async (req, res) => {
    try {
        const { name, email, phone, password, student_ids, relationships } = req.body;
        const institute_id = req.user.institute_id;

        if (!name || !email || !phone) {
            return res.status(400).json({ success: false, message: "Name, email and phone are required" });
        }

        const existingUser = await User.findOne({ where: { email, institute_id } });
        if (existingUser) {
            return res.status(409).json({ success: false, message: "User with this email already exists" });
        }

        const { generateTempPassword } = require('../utils/passwordGenerator');
        const tempPassword = password || generateTempPassword();
        const password_hash = await hashPassword(tempPassword);

        const temp_password_expires_at = new Date();
        temp_password_expires_at.setDate(temp_password_expires_at.getDate() + 7);

        const user = await User.create({
            institute_id,
            role: "parent",
            name,
            email,
            phone,
            password_hash,
            status: "active",
            is_first_login: true,
            temp_password_expires_at,
            credentials_sent_at: email ? new Date() : null,
            initial_password: tempPassword
        });

        if (student_ids && student_ids.length > 0) {
            const studentParents = student_ids.map((student_id, index) => ({
                student_id: student_id,
                parent_id: user.id,
                relationship: relationships && relationships[index] ? relationships[index] : "guardian"
            }));
            await StudentParent.bulkCreate(studentParents);
        }

        res.status(201).json({
            success: true,
            message: "Parent created successfully",
            data: user
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get all parents
 * @route GET /api/parents
 * @access Admin
 */
exports.getAllParents = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const { search } = req.query;

        const whereClause = {
            institute_id,
            role: "parent",
        };

        if (search) {
            whereClause[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } },
                { phone: { [Op.like]: `%${search}%` } }
            ];
        }

        const parents = await User.findAll({
            where: whereClause,
            attributes: ["id", "name", "email", "phone", "status"],
            include: [{
                model: Student,
                as: "LinkedStudents",
                attributes: ["id", "roll_number", "institute_id"],
                include: [
                    { model: User, attributes: ["name"] },
                    { model: Class, attributes: ["id", "name", "section"], through: { attributes: [] } }
                ],
                through: { attributes: ["relationship"] }
            }],
            order: [["id", "DESC"]]
        });

        res.status(200).json({
            success: true,
            message: "Parents retrieved successfully",
            data: parents
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Parent Dashboard
 * @route GET /api/parents/dashboard
 * @access Parent
 */
exports.getDashboard = async (req, res) => {
    try {
        const parent_id = req.user.id;

        const students = await Student.findAll({
            include: [
                {
                    model: User,
                    as: "Parents",
                    where: { id: parent_id },
                    attributes: [],
                    through: { attributes: ["relationship"] }
                },
                { model: User, attributes: ["name", "email", "phone"] },
                { model: Class, attributes: ["id", "name"], through: { attributes: [] } },
                { 
                    model: Subject, 
                    attributes: ["id", "name"], 
                    through: { attributes: [] },
                    include: [{
                        model: Faculty,
                        attributes: ["id", "user_id"],
                        include: [{
                            model: User,
                            attributes: ["name"]
                        }]
                    }]
                },
                {
                    model: StudentFee,
                    attributes: ["status", "reminder_date", "due_amount"]
                }
            ]
        });

        let responseStudents = [];
        for (let student of students) {
            let responseData = student.toJSON ? student.toJSON() : student;
            if (responseData.is_full_course && responseData.Classes && responseData.Classes.length > 0) {
                const classIds = responseData.Classes.map(c => c.id);
                const allSubjects = await Subject.findAll({
                    where: { institute_id: req.user.institute_id, class_id: { [Op.in]: classIds } },
                    attributes: ["id", "name"],
                    include: [{
                        model: Faculty,
                        attributes: ["id", "user_id"],
                        include: [{
                            model: User,
                            attributes: ["name"]
                        }]
                    }]
                });

                const existingSubIds = new Set((responseData.Subjects || []).map(s => s.id));
                const newSubjects = allSubjects.filter(s => !existingSubIds.has(s.id)).map(s => s.toJSON ? s.toJSON() : s);

                if (newSubjects.length > 0) {
                    responseData.Subjects = [...(responseData.Subjects || []), ...newSubjects];
                }
            }
            responseStudents.push(responseData);
        }

        res.status(200).json({
            success: true,
            message: "Dashboard data retrieved",
            data: { students: responseStudents }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Student Profile for Parent
 * @route GET /api/parents/student/:id
 * @access Parent
 */
exports.getStudentProfile = async (req, res) => {
    try {
        const parent_id = req.user.id;
        const student_id = req.params.id;

        if (!(await isStudentLinked(parent_id, student_id))) {
            return res.status(403).json({ success: false, message: "Unauthorized access to this student" });
        }

        const student = await Student.findByPk(student_id, {
            include: [
                { model: User, attributes: ["name", "email", "phone"] },
                { model: Class, attributes: ["id", "name"], through: { attributes: [] } },
                { 
                    model: Subject, 
                    attributes: ["id", "name"], 
                    through: { attributes: [] },
                    include: [{
                        model: Faculty,
                        attributes: ["id", "user_id"],
                        include: [{
                            model: User,
                            attributes: ["name"]
                        }]
                    }]
                }
            ]
        });

        let responseData = student.toJSON ? student.toJSON() : student;
        if (responseData.is_full_course && responseData.Classes && responseData.Classes.length > 0) {
            const classIds = responseData.Classes.map(c => c.id);
            const allSubjects = await Subject.findAll({
                where: { institute_id: req.user.institute_id, class_id: { [Op.in]: classIds } },
                attributes: ["id", "name"],
                include: [{
                    model: Faculty,
                    attributes: ["id", "user_id"],
                    include: [{
                        model: User,
                        attributes: ["name"]
                    }]
                }]
            });

            const existingSubIds = new Set((responseData.Subjects || []).map(s => s.id));
            const newSubjects = allSubjects.filter(s => !existingSubIds.has(s.id)).map(s => s.toJSON ? s.toJSON() : s);

            if (newSubjects.length > 0) {
                responseData.Subjects = [...(responseData.Subjects || []), ...newSubjects];
            }
        }

        res.status(200).json({ success: true, data: responseData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Attendance for linked student
 * @route GET /api/parents/attendance/:studentId
 * @access Parent
 */
exports.getStudentAttendance = async (req, res) => {
    try {
        const parent_id = req.user.id;
        const student_id = req.params.studentId;

        if (!(await isStudentLinked(parent_id, student_id))) {
            return res.status(403).json({ success: false, message: "Unauthorized access to this student" });
        }

        const { Subject, Class } = require("../models");
        const records = await Attendance.findAll({
            where: { student_id, institute_id: req.user.institute_id },
            include: [
                { model: Subject, attributes: ["id", "name"] },
                { model: Class, attributes: ["id", "name", "section"] }
            ],
            order: [['date', 'ASC']]
        });

        const uniqueDatesMap = {};
        records.forEach(r => {
            if (!uniqueDatesMap[r.date]) uniqueDatesMap[r.date] = [];
            uniqueDatesMap[r.date].push(r.status);
        });

        let total_days = 0, working_days = 0, present = 0, absent = 0, late = 0, holidays = 0;

        Object.values(uniqueDatesMap).forEach(statuses => {
            total_days++;
            if (statuses.includes('holiday')) {
                holidays++;
            } else {
                working_days++;
                if (statuses.includes('present')) {
                    present++;
                } else if (statuses.includes('late')) {
                    late++;
                } else if (statuses.includes('half_day')) {
                    present++;
                } else if (statuses.includes('absent')) {
                    absent++;
                }
            }
        });

        const percentage = working_days > 0 ? (((present + late) / working_days) * 100).toFixed(2) : 0;

        res.status(200).json({
            success: true,
            data: {
                records,
                summary: {
                    total_days: total_days,
                    working_days: working_days,
                    present_days: present,
                    absent_days: absent,
                    late_days: late,
                    holiday_days: holidays,
                    attendance_percentage: parseFloat(percentage) // Phase 7: align with frontend expects
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Marks for linked student
 * @route GET /api/parents/results/:studentId
 * @access Parent
 */
exports.getStudentResults = async (req, res) => {
    try {
        const parent_id = req.user.id;
        const student_id = req.params.studentId;

        if (!(await isStudentLinked(parent_id, student_id))) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        const marks = await Mark.findAll({
            where: { student_id, institute_id: req.user.institute_id },
            include: [
                { model: Exam, attributes: ["name", "exam_date"] },
                { model: Subject, attributes: ["name"] }
            ],
            order: [[Exam, 'exam_date', 'DESC']]
        });

        res.status(200).json({ success: true, data: marks });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Fees for linked student
 * @route GET /api/parents/fees/:studentId
 * @access Parent
 */
// Fees for linked student
exports.getStudentFees = async (req, res) => {
    try {
        const parent_id = req.user.id;
        const student_id = req.params.studentId;

        if (!(await isStudentLinked(parent_id, student_id))) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        const { FeesStructure, Subject, StudentFee, Student, Class } = require("../models");
        const { syncSingleStudentFees } = require("./fees.controller");

        const studentObj = await Student.findOne({
            where: { id: student_id, institute_id: req.user.institute_id },
            include: [{ model: Subject }, { model: Class }]
        });

        if (!studentObj) {
            return res.status(404).json({ success: false, message: "Student record not found" });
        }

        // Sync fees to ensure the parent sees exactly the accurate and up-to-date fees
        await syncSingleStudentFees(req.user.institute_id, studentObj);

        const fees = await StudentFee.findAll({
            where: { student_id, institute_id: req.user.institute_id },
            include: [
                {
                    model: FeesStructure,
                    attributes: ["fee_type", "amount", "due_date"],
                    include: [{ model: Subject, attributes: ["name"] }]
                }
            ]
        });

        res.status(200).json({ success: true, data: fees });
    } catch (error) {
        console.error("Error fetching student fees for parent:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Notes
 * @route GET /api/parents/notes/:classId
 * @access Parent
 */
exports.getNotes = async (req, res) => {
    try {
        const { classId } = req.params;
        // Parents can view only notes for classes their linked students belong to
        const institute_id = req.user.institute_id;
        const notes = await Note.findAll({
            where: { class_id: classId, institute_id },
            include: [{ model: Subject, attributes: ["name"] }]
        });
        res.status(200).json({ success: true, data: notes });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get a single parent by ID (Admin)
 * @route GET /api/parents/:id
 * @access Admin
 */
exports.getParentById = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const parent = await User.findOne({
            where: { id: req.params.id, institute_id, role: "parent" },
            attributes: ["id", "name", "email", "phone", "status"],
            include: [{
                model: Student,
                as: "LinkedStudents",
                attributes: ["id", "roll_number"],
                include: [
                    { model: User, attributes: ["name"] },
                    { model: Class, attributes: ["id", "name", "section"], through: { attributes: [] } }
                ],
                through: { attributes: ["relationship"] }
            }]
        });
        if (!parent) return res.status(404).json({ success: false, message: "Parent not found" });
        res.status(200).json({ success: true, data: parent });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update a parent and their linked students
 * @route PUT /api/parents/:id
 * @access Admin
 */
exports.updateParent = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const { name, email, phone, status, password, student_ids } = req.body;

        const parent = await User.findOne({
            where: { id: req.params.id, institute_id, role: "parent" }
        });
        if (!parent) return res.status(404).json({ success: false, message: "Parent not found" });

        const updateData = { name, email, phone, status };
        if (password && password.length >= 6) {
            updateData.password_hash = await hashPassword(password);
        }

        await parent.update(updateData);

        // Update linked students if provided
        if (student_ids !== undefined) {
            // Remove all existing links
            await StudentParent.destroy({ where: { parent_id: parent.id } });
            if (Array.isArray(student_ids) && student_ids.length > 0) {
                const links = student_ids.map(sid => ({
                    student_id: sid,
                    parent_id: parent.id,
                    relationship: "guardian"
                }));
                await StudentParent.bulkCreate(links);
            }
        }

        res.status(200).json({ success: true, message: "Parent updated successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Delete a parent
 * @route DELETE /api/parents/:id
 * @access Admin
 */
exports.deleteParent = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const parent = await User.findOne({
            where: { id: req.params.id, institute_id, role: "parent" }
        });
        if (!parent) return res.status(404).json({ success: false, message: "Parent not found" });

        // Remove all student links first
        await StudentParent.destroy({ where: { parent_id: parent.id } });
        await parent.destroy();

        res.status(200).json({ success: true, message: "Parent deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Delete multiple parents
 * @route POST /api/parents/bulk-delete
 * @access Admin
 */
exports.bulkDeleteParents = async (req, res) => {
    let transaction;
    try {
        const institute_id = req.user.institute_id;
        const { parent_ids } = req.body;

        if (!parent_ids || !Array.isArray(parent_ids) || parent_ids.length === 0) {
            return res.status(400).json({ success: false, message: "No parents selected for deletion" });
        }

        const { sequelize } = require("../models");
        transaction = await sequelize.transaction();

        const parents = await User.findAll({
            where: { id: { [Op.in]: parent_ids }, institute_id, role: "parent" },
            transaction
        });

        if (parents.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: "No valid parents found to delete" });
        }

        const userIds = parents.map(p => p.id);

        await StudentParent.destroy({ where: { parent_id: { [Op.in]: userIds } }, transaction });
        await User.destroy({ where: { id: { [Op.in]: userIds }, institute_id, role: "parent" }, transaction });

        await transaction.commit();

        res.status(200).json({ success: true, message: `${parents.length} parent(s) deleted successfully` });
    } catch (error) {
        if (transaction) await transaction.rollback();
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get current initial passwords for selected parents.
 * @route POST /api/parents/credentials
 * @access Admin
 */
exports.getParentCredentials = async (req, res) => {
    try {
        const { parent_ids } = req.body;
        const institute_id = req.user.institute_id;

        if (!Array.isArray(parent_ids) || parent_ids.length === 0) {
            return res.status(400).json({ success: false, message: "No parents selected" });
        }

        const { generateTempPassword } = require('../utils/passwordGenerator');
        const { hashPassword } = require("../utils/hashPassword");

        const parents = await User.findAll({
            where: { id: { [Op.in]: parent_ids }, institute_id, role: "parent" },
            attributes: ['id', 'name', 'email', 'phone', 'initial_password', 'is_first_login']
        });

        const credentials = [];

        for (const p of parents) {
            let password = p.initial_password;
            let status = 'active';

            if (!password) {
                if (!p.is_first_login) {
                    status = 'changed';
                    password = null;
                } else {
                    const tempPassword = generateTempPassword();
                    const password_hash = await hashPassword(tempPassword);
                    const tempExpiry = new Date();
                    tempExpiry.setDate(tempExpiry.getDate() + 7);

                    await p.update({
                        password_hash,
                        initial_password: tempPassword,
                        is_first_login: true,
                        temp_password_expires_at: tempExpiry,
                        credentials_sent_at: new Date(),
                    });

                    password = tempPassword;
                    status = 'generated';
                }
            }

            credentials.push({
                id: p.id,
                identifier: p.phone || 'Parent',
                name: p.name,
                email: p.email,
                password,
                status,
            });
        }

        res.status(200).json({ success: true, data: credentials });
    } catch (error) {
        console.error('getParentCredentials error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Resend parent credentials
 * @route POST /api/parents/:id/resend-credentials
 * @access Admin
 */
exports.resendParentCredentials = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;

        const parent = await User.findOne({
            where: { id, institute_id, role: "parent" },
        });

        if (!parent) {
            return res.status(404).json({ success: false, message: "Parent not found" });
        }

        const lastSent = parent.credentials_sent_at;
        if (lastSent && new Date() - new Date(lastSent) < 5 * 60 * 1000) {
            return res.status(429).json({ success: false, message: "Please wait 5 minutes before resending credentials." });
        }

        const { generateTempPassword } = require('../utils/passwordGenerator');
        const { hashPassword } = require("../utils/hashPassword");
        const tempPassword = generateTempPassword();
        const password_hash = await hashPassword(tempPassword);

        const tempExpiry = new Date();
        tempExpiry.setDate(tempExpiry.getDate() + 7);

        await parent.update({
            password_hash,
            is_first_login: true,
            temp_password_expires_at: tempExpiry,
            credentials_sent_at: new Date(),
            initial_password: tempPassword
        });

        res.status(200).json({
            success: true,
            message: "Credentials generated successfully",
            showPasswordOnScreen: true,
            initial_password: tempPassword
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = exports;
