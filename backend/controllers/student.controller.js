/**
 * Student Controller
 * Handles CRUD operations for students
 * Implements institute-level data isolation
 */

const { sequelize, Student, User, Class, Institute, Plan, Subject, StudentSubject, StudentClass, Faculty, StudentParent } = require("../models");
const { Op } = require("sequelize");
const { hashPassword } = require("../utils/hashPassword");

/**
 * Create a new student
 * @route POST /api/students
 * @access Admin, Faculty
 */

exports.createStudent = async (req, res) => {
    let transaction;
    try {
        const {
            name,
            email,
            phone,
            password,
            roll_number,
            class_id,
            admission_date,
            date_of_birth,
            gender,
            address,
            subject_ids, // New array of selected subject ids
            class_ids, // New array of selected class ids
            status // New field for account status
        } = req.body;

        const institute_id = req.user.institute_id;

        transaction = await sequelize.transaction();

        // Check Plan Limits
        const institute = await Institute.findByPk(institute_id, {
            include: [{ model: Plan }],
            transaction,
        });

        if (institute && institute.Plan) {
            const studentCount = await Student.count({ where: { institute_id }, transaction });
            const limitStudents = institute.current_limit_students || institute.Plan.max_students;
            if (limitStudents && studentCount >= limitStudents) {
                await transaction.rollback();
                transaction = null;
                return res.status(403).json({
                    success: false,
                    message: `Plan limit reached. Your plan allows a maximum of ${limitStudents} students. Upgrade your plan to add more.`
                });
            }
        }

        // Check if student email already exists in this institute
        const existingUser = await User.findOne({
            where: { email, institute_id },
            transaction,
        });

        if (existingUser) {
            await transaction.rollback();
            transaction = null;
            return res.status(409).json({
                success: false,
                message: "Student with this email already exists in your institute",
            });
        }

        // Validate mandatory date fields BEFORE creating any DB records
        if (!date_of_birth || isNaN(new Date(date_of_birth))) {
            await transaction.rollback();
            transaction = null;
            return res.status(400).json({
                success: false,
                message: "Date of Birth is required and must be a valid date (YYYY-MM-DD).",
            });
        }
        if (!admission_date || isNaN(new Date(admission_date))) {
            await transaction.rollback();
            transaction = null;
            return res.status(400).json({
                success: false,
                message: "Admission Date is required and must be a valid date (YYYY-MM-DD).",
            });
        }

        // Hash password
        const { generateTempPassword } = require('../utils/passwordGenerator');
        const tempPassword = generateTempPassword();
        const password_hash = await hashPassword(tempPassword);

        // Set temp password expiry (7 days)
        const temp_password_expires_at = new Date();
        temp_password_expires_at.setDate(temp_password_expires_at.getDate() + 7);

        // Create user account for student
        const user = await User.create({
            institute_id,
            role: "student",
            name,
            email,
            phone,
            password_hash,
            status: status || "active",
            is_first_login: true,
            temp_password_expires_at,
            credentials_sent_at: email ? new Date() : null,
            initial_password: tempPassword
        }, { transaction });


        // Create student record â€” if this fails, rollback the user to avoid orphan
        let student;
        try {
            student = await Student.create({
                institute_id,
                user_id: user.id || user.user_id,
                roll_number,
                admission_date: admission_date,
                date_of_birth: date_of_birth,
                gender: gender ? gender.toLowerCase() : null,
                address,
                is_full_course: subject_ids && Array.isArray(subject_ids) ? subject_ids.includes("full_course") : false,
            }, { transaction });
        } catch (studentError) {
            // Cleanup orphaned user so admin can retry with same email
            throw studentError;
        }

        // Add classes if provided
        if (class_ids && Array.isArray(class_ids) && class_ids.length > 0) {
            const studentClasses = class_ids.map(c_id => ({
                student_id: student.id,
                class_id: parseInt(c_id),
                institute_id: institute_id
            }));
            await StudentClass.bulkCreate(studentClasses, { transaction });
        }

        // Add subjects if provided
        if (subject_ids && Array.isArray(subject_ids) && subject_ids.length > 0) {
            let actualSubjectIds = subject_ids.filter(id => id !== "full_course");

            if (subject_ids.includes("full_course") && class_ids && class_ids.length > 0) {
                const subjectsForClasses = await Subject.findAll({
                    where: { institute_id, class_id: { [Op.in]: class_ids } },
                    transaction,
                });
                const allSubIds = subjectsForClasses.map(s => s.id.toString());
                actualSubjectIds = [...new Set([...actualSubjectIds, ...allSubIds])];
            }

            if (actualSubjectIds.length > 0) {
                const studentSubjects = actualSubjectIds.map(sub_id => ({
                    student_id: student.id,
                    subject_id: parseInt(sub_id),
                    institute_id: institute_id
                }));
                await StudentSubject.bulkCreate(studentSubjects, { transaction });
            }
        }

        await transaction.commit();
        transaction = null;

        let emailSent = false;
        let showPasswordOnScreen = true;

        if (email) {
            try {
                const { sendStudentWelcomeEmail } = require('../services/email.service');
                await sendStudentWelcomeEmail({
                    to: email,
                    studentName: name,
                    instituteName: institute && institute.name ? institute.name : 'Your Institute',
                    email,
                    tempPassword
                });
                emailSent = true;
                showPasswordOnScreen = false;
            } catch (err) {
                console.error('Failed to send welcome email:', err.message);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Student created successfully',
            showPasswordOnScreen,
            initial_password: showPasswordOnScreen ? tempPassword : null,
            data: {
                student,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                },
            },
        });
    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error("========== BACKEND ERROR ==========");
        console.error(error);
        console.error("Name:", error.name);
        console.error("Message:", error.message);
        console.error("Stack:", error.stack);
        console.error("===================================");
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * Get all students for an institute
 * @route GET /api/students
 * @access Admin, Faculty
 */
exports.getAllStudents = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = "", class_id, cursor } = req.query;
        const institute_id = req.user.institute_id;
        const parsedLimit = Math.min(parseInt(limit, 10) || 10, 10000);
        const offset = (parseInt(page, 10) - 1) * parsedLimit;

        // Build where clause
        const whereClause = { institute_id };
        if (cursor) whereClause.id = { [Op.lt]: cursor };

        // Search filter
        const userWhereClause = search
            ? {
                [Op.or]: [
                    { name: { [Op.like]: `%${search}%` } },
                    { email: { [Op.like]: `%${search}%` } },
                ],
            }
            : {};

        // If class_id filter is specific, we still need to filter students that belong to this class
        const classIncludeOptions = {
            model: Class,
            attributes: ["id", "name", "section"],
            through: { attributes: [] },
            required: class_id ? true : false,
        };

        if (class_id) {
            classIncludeOptions.where = { id: class_id };
        }

        let subjectIncludeOptions = {
            model: Subject,
            attributes: ["id", "name"],
            through: { attributes: [] }
        };

        if (req.user.role === 'faculty') {
            const facultyRecord = await Faculty.findOne({ where: { user_id: req.user.id } });
            if (facultyRecord) {
                subjectIncludeOptions.where = { faculty_id: facultyRecord.id };
                subjectIncludeOptions.required = true;
            } else {
                return res.status(200).json({ success: true, message: "Students retrieved successfully", data: [], count: 0 });
            }
        }

        const queryOptions = {
            where: whereClause,
            limit: cursor ? parsedLimit + 1 : parsedLimit,
            order: [["id", "DESC"]],
            include: [
                {
                    model: User,
                    attributes: ["id", "name", "email", "phone", "status"],
                    where: userWhereClause,
                    required: search ? true : false,
                },
                {
                    ...classIncludeOptions
                },
                subjectIncludeOptions
            ],
            distinct: true,
        };

        if (!cursor) queryOptions.offset = parseInt(offset, 10);

        if (cursor) {
            const rows = await Student.findAll(queryOptions);
            const hasMore = rows.length > parsedLimit;
            const data = hasMore ? rows.slice(0, parsedLimit) : rows;

            return res.status(200).json({
                success: true,
                message: "Students retrieved successfully",
                data,
                count: data.length,
                nextCursor: hasMore && data.length ? data[data.length - 1].id : null,
                hasMore,
            });
        }

        const { count, rows } = await Student.findAndCountAll(queryOptions);

        res.status(200).json({
            success: true,
            message: "Students retrieved successfully",
            data: rows,
            count: count
        });
    } catch (error) {
        console.error("Get All Students Error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * Get student by ID
 * @route GET /api/students/:id
 * @access Admin, Faculty, Student (own record)
 */
exports.getMe = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const user_id = req.user.id;

        const student = await Student.findOne({
            where: { user_id, institute_id },
            include: [
                {
                    model: User,
                    attributes: ["id", "name", "email", "phone", "status"],
                },
                {
                    model: Class,
                    attributes: ["id", "name", "section"],
                    through: { attributes: [] }
                },
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
                    model: User,
                    as: "Parents",
                    attributes: ["id", "name", "phone"],
                    through: { attributes: ["relationship"] }
                }
            ],
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student record not found",
            });
        }

        let responseData = student.toJSON ? student.toJSON() : student;
        if (responseData.is_full_course && responseData.Classes && responseData.Classes.length > 0) {
            const classIds = responseData.Classes.map(c => c.id);
            const allSubjects = await Subject.findAll({
                where: { institute_id, class_id: { [Op.in]: classIds } },
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

        res.status(200).json({
            success: true,
            message: "Student retrieved successfully",
            data: responseData,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.getStudentLookup = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const { class_id, search = "", limit = 100 } = req.query;
        const maxLimit = Math.min(parseInt(limit, 10) || 100, 5000);

        const userWhereClause = search
            ? {
                [Op.or]: [
                    { name: { [Op.like]: `%${search}%` } },
                    { email: { [Op.like]: `%${search}%` } },
                ],
            }
            : {};

        const classInclude = {
            model: Class,
            attributes: ["id", "name", "section"],
            through: { attributes: [] },
            required: Boolean(class_id),
        };

        if (class_id) {
            classInclude.where = { id: class_id };
        }

        const students = await Student.findAll({
            where: { institute_id },
            attributes: ["id", "roll_number"],
            include: [
                {
                    model: User,
                    attributes: ["id", "name", "email", "phone", "status"],
                    where: userWhereClause,
                    required: Boolean(search),
                },
                classInclude,
            ],
            order: [[User, "name", "ASC"]],
            limit: maxLimit,
            subQuery: false,
        });

        res.status(200).json({
            success: true,
            message: "Student lookup retrieved successfully",
            data: students,
        });
    } catch (error) {
        console.error("Student lookup error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
exports.getStudentById = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;

        const student = await Student.findOne({
            where: { id, institute_id },
            include: [
                {
                    model: User,
                    attributes: ["id", "name", "email", "phone", "status"],
                },
                {
                    model: Class,
                    attributes: ["id", "name", "section"],
                    through: { attributes: [] }
                },
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
                    model: User,
                    as: "Parents",
                    attributes: ["id", "name", "phone"],
                    through: { attributes: ["relationship"] }
                }
            ],
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found",
            });
        }

        // If student role, ensure they can only access their own record
        if (req.user.role === "student" && student.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Access forbidden",
            });
        }

        let responseData = student.toJSON ? student.toJSON() : student;
        if (responseData.is_full_course && responseData.Classes && responseData.Classes.length > 0) {
            const classIds = responseData.Classes.map(c => c.id);
            const allSubjects = await Subject.findAll({
                where: { institute_id, class_id: { [Op.in]: classIds } },
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

        res.status(200).json({
            success: true,
            message: "Student retrieved successfully",
            data: responseData,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * Update student
 * @route PUT /api/students/:id
 * @access Admin, Faculty
 */
exports.updateStudent = async (req, res) => {
    let transaction;
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;
        const {
            name,
            email,
            phone,
            roll_number,
            class_id,
            admission_date,
            date_of_birth,
            gender,
            address,
            subject_ids,
            class_ids,
            status
        } = req.body;

        transaction = await sequelize.transaction();

        const student = await Student.findOne({
            where: { id, institute_id },
            include: [{ model: User }],
            transaction,
        });

        if (!student) {
            await transaction.rollback();
            transaction = null;
            return res.status(404).json({
                success: false,
                message: "Student not found",
            });
        }

        // Update user details
        if (name || email || phone || status) {
            await student.User.update({
                name: name || student.User.name,
                email: email || student.User.email,
                phone: phone || student.User.phone,
                status: status || student.User.status,
            }, { transaction });
        }

        // Update student details
        await student.update({
            roll_number: roll_number || student.roll_number,
            admission_date: admission_date || student.admission_date,
            date_of_birth: date_of_birth || student.date_of_birth,
            gender: gender || student.gender,
            address: address || student.address,
            is_full_course: subject_ids && Array.isArray(subject_ids) ? subject_ids.includes("full_course") : student.is_full_course,
        }, { transaction });

        // Update classes if provided
        if (class_ids && Array.isArray(class_ids)) {
            await StudentClass.destroy({ where: { student_id: id }, transaction });

            if (class_ids.length > 0) {
                const studentClasses = class_ids.map(c_id => ({
                    student_id: student.id,
                    class_id: parseInt(c_id),
                    institute_id: institute_id
                }));
                await StudentClass.bulkCreate(studentClasses, { transaction });
            }
        }

        // Update subjects if provided
        if (subject_ids && Array.isArray(subject_ids)) {
            // Remove existing subjects for this student
            await StudentSubject.destroy({ where: { student_id: id }, transaction });

            // Add new ones
            let actualSubjectIds = subject_ids.filter(sub_id => sub_id !== "full_course");

            if (subject_ids.includes("full_course")) {
                let currentClassIds = class_ids;
                if (!currentClassIds || currentClassIds.length === 0) {
                    const studentClasses = await StudentClass.findAll({ where: { student_id: id }, transaction });
                    currentClassIds = studentClasses.map(sc => sc.class_id);
                }

                if (currentClassIds && currentClassIds.length > 0) {
                    const subjectsForClasses = await Subject.findAll({
                        where: { institute_id, class_id: { [Op.in]: currentClassIds } },
                        transaction,
                    });
                    const allSubIds = subjectsForClasses.map(s => s.id.toString());
                    actualSubjectIds = [...new Set([...actualSubjectIds, ...allSubIds])];
                }
            }

            if (actualSubjectIds.length > 0) {
                const studentSubjects = actualSubjectIds.map(sub_id => ({
                    student_id: student.id,
                    subject_id: parseInt(sub_id),
                    institute_id: institute_id
                }));
                await StudentSubject.bulkCreate(studentSubjects, { transaction });
            }
        }

        await transaction.commit();
        transaction = null;

        res.status(200).json({
            success: true,
            message: "Student updated successfully",
            data: student,
        });
    } catch (error) {
        if (transaction) await transaction.rollback();
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * Delete student
 * @route DELETE /api/students/:id
 * @access Admin only
 */
exports.deleteStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;

        const student = await Student.findOne({
            where: { id, institute_id },
            include: [{ model: User }],
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found",
            });
        }

        // Delete user account
        await student.User.destroy();

        // Delete student record
        await student.destroy();

        res.status(200).json({
            success: true,
            message: "Student deleted successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * Delete multiple students
 * @route POST /api/students/bulk-delete
 * @access Admin only
 */
exports.bulkDeleteStudents = async (req, res) => {
    let transaction;
    try {
        const { student_ids } = req.body;
        const institute_id = req.user.institute_id;

        if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
            return res.status(400).json({ success: false, message: "No students selected for deletion" });
        }

        transaction = await sequelize.transaction();

        const students = await Student.findAll({
            where: { id: { [Op.in]: student_ids }, institute_id },
            include: [{ model: User }],
            transaction
        });

        if (students.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: "No valid students found to delete" });
        }

        const userIds = students.map(s => s.user_id).filter(id => id);
        const studentIdsToDelete = students.map(s => s.id);

        if (userIds.length > 0) {
            await User.destroy({ where: { id: { [Op.in]: userIds }, institute_id }, transaction });
        }
        
        if (studentIdsToDelete.length > 0) {
            await Student.destroy({ where: { id: { [Op.in]: studentIdsToDelete }, institute_id }, transaction });
        }

        await transaction.commit();

        res.status(200).json({
            success: true,
            message: `${students.length} student(s) deleted successfully`,
        });
    } catch (error) {
        if (transaction) await transaction.rollback();
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * Get student statistics
 * @route GET /api/students/stats
 * @access Admin, Faculty
 */
exports.getStudentStats = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;

        // ✅ Phase A Bonus: Run all 3 counts in parallel (was serial — 3x faster)
        const [totalStudents, activeStudents, blockedStudents] = await Promise.all([
            Student.count({ where: { institute_id } }),
            Student.count({
                where: { institute_id },
                include: [{ model: User, where: { status: "active" } }],
            }),
            Student.count({
                where: { institute_id },
                include: [{ model: User, where: { status: "blocked" } }],
            }),
        ]);

        res.status(200).json({
            success: true,
            message: "Student statistics retrieved successfully",
            data: {
                total: totalStudents,
                active: activeStudents,
                blocked: blockedStudents,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


/**
 * Resend student credentials (generates a new password)
 * @route POST /api/students/:id/resend-credentials
 * @access Admin
 */
exports.resendStudentCredentials = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;

        const student = await Student.findOne({
            where: { id, institute_id },
            include: [{ model: User }],
        });

        if (!student) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }

        // 5-minute cooldown check
        const lastSent = student.User.credentials_sent_at;
        if (lastSent && new Date() - new Date(lastSent) < 5 * 60 * 1000) {
            return res.status(429).json({
                success: false,
                message: "Please wait 5 minutes before resending credentials."
            });
        }

        // Generate new temporary password
        const { generateTempPassword } = require('../utils/passwordGenerator');
        const tempPassword = generateTempPassword();
        const password_hash = await hashPassword(tempPassword);

        const temp_password_expires_at = new Date();
        temp_password_expires_at.setDate(temp_password_expires_at.getDate() + 7);

        await student.User.update({
            password_hash,
            is_first_login: true,
            temp_password_expires_at,
            credentials_sent_at: new Date(),
            initial_password: tempPassword
        });

        let emailSent = false;
        let showPasswordOnScreen = true;

        if (student.User.email) {
            try {
                const institute = await Institute.findByPk(institute_id);
                const { sendStudentWelcomeEmail } = require('../services/email.service');
                await sendStudentWelcomeEmail({
                    to: student.User.email,
                    studentName: student.User.name,
                    instituteName: institute ? institute.name : "Your Institute",
                    email: student.User.email,
                    tempPassword
                });
                emailSent = true;
                showPasswordOnScreen = false;
            } catch (err) {
                console.error("Failed to resend credentials email:", err.message);
            }
        }

        res.status(200).json({
            success: true,
            message: emailSent ? "Credentials sent via email" : "Email failed, view credentials on screen",
            showPasswordOnScreen,
            initial_password: showPasswordOnScreen ? tempPassword : null
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get current initial passwords for selected students.
 * If a student has no initial_password (pre-existing student), auto-generates
 * and persists a new temp password so the admin always gets a real credential.
 * @route POST /api/students/credentials
 * @access Admin
 */
exports.getStudentCredentials = async (req, res) => {
    try {
        const { student_ids } = req.body;
        const institute_id = req.user.institute_id;

        if (!Array.isArray(student_ids) || student_ids.length === 0) {
            return res.status(400).json({ success: false, message: "No students selected" });
        }

        const { generateTempPassword } = require('../utils/passwordGenerator');

        const students = await Student.findAll({
            where: { id: { [Op.in]: student_ids }, institute_id },
            include: [{ model: User, attributes: ['id', 'name', 'email', 'initial_password', 'is_first_login'] }]
        });

        const credentials = [];

        for (const s of students) {
            let password = s.User.initial_password;
            let status = 'active'; // has a stored password

            if (!password) {
                if (!s.User.is_first_login) {
                    // Student already changed their password — respect their privacy
                    status = 'changed';
                    password = null;
                } else {
                    // is_first_login is still true but initial_password is NULL.
                    // This happens for students created before this feature was added.
                    // Auto-generate a fresh temp password, hash it, and persist it.
                    const tempPassword = generateTempPassword();
                    const password_hash = await hashPassword(tempPassword);

                    const tempExpiry = new Date();
                    tempExpiry.setDate(tempExpiry.getDate() + 7);

                    await s.User.update({
                        password_hash,
                        initial_password: tempPassword,
                        is_first_login: true,
                        temp_password_expires_at: tempExpiry,
                        credentials_sent_at: new Date(),
                    });

                    password = tempPassword;
                    status = 'generated'; // freshly generated now
                }
            }

            credentials.push({
                id: s.id,
                roll_number: s.roll_number,
                name: s.User.name,
                email: s.User.email,
                password,
                status, // 'active' | 'generated' | 'changed'
            });
        }

        res.status(200).json({
            success: true,
            data: credentials
        });

    } catch (error) {
        console.error('getStudentCredentials error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get student dashboard statistics (unread assignments, notes)
 * @route GET /api/students/dashboard-stats
 * @access Student
 */
exports.getDashboardStats = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const user_id = req.user.id;

        const { Student, Class, Subject } = require("../models");
        const student = await Student.findOne({
            where: { user_id, institute_id },
            include: [
                { model: Class, through: { attributes: [] } },
                { model: Subject, through: { attributes: [] } }
            ]
        });

        if (!student) {
            return res.status(404).json({ success: false, message: "Student record not found" });
        }

        const classIds = student.Classes ? student.Classes.map(c => c.id) : [];
        const subjectIds = student.Subjects ? student.Subjects.map(s => s.id) : [];

        const { Assignment, Note, User } = require("../models");
        const { Op } = require("sequelize");

        const dbUser = await User.findByPk(user_id, {
            attributes: ['last_assignment_seen_at', 'last_note_seen_at']
        });

        // Calculate unread assignments
        let assignmentWhere = { institute_id, status: { [Op.in]: ['published', 'closed'] } };
        if (dbUser && dbUser.last_assignment_seen_at) {
            assignmentWhere.created_at = { [Op.gt]: dbUser.last_assignment_seen_at };
        }
        
        let assignmentOr = [];
        if (classIds.length > 0) assignmentOr.push({ class_id: { [Op.in]: classIds } });
        if (!student.is_full_course && subjectIds.length > 0) assignmentOr.push({ subject_id: { [Op.in]: subjectIds } });
        
        if (assignmentOr.length > 0) {
            assignmentWhere[Op.or] = assignmentOr;
        } else {
            // No classes or subjects assigned
            assignmentWhere.id = null; // force 0
        }

        // Build noteWhere filter before running both counts in parallel
        let noteWhere = { institute_id };
        if (dbUser && dbUser.last_note_seen_at) {
            noteWhere.created_at = { [Op.gt]: dbUser.last_note_seen_at };
        }
        let noteOr = [];
        if (classIds.length > 0) noteOr.push({ class_id: { [Op.in]: classIds } });
        if (subjectIds.length > 0) noteOr.push({ subject_id: { [Op.in]: subjectIds } });
        if (noteOr.length > 0) {
            noteWhere[Op.or] = noteOr;
        } else {
            noteWhere.id = null; // force 0
        }

        // ✅ Phase A Bonus: Run both counts in parallel (was serial — 2x faster)
        const [unreadAssignmentCount, unreadNotesCount] = await Promise.all([
            Assignment.count({ where: assignmentWhere }),
            Note.count({ where: noteWhere }),
        ]);

        res.status(200).json({
            success: true,
            unreadAssignmentCount,
            unreadNotesCount
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Clear unread assignments
 */
exports.clearUnreadAssignments = async (req, res) => {
    try {
        const { User } = require("../models");
        await User.update({ last_assignment_seen_at: new Date() }, { where: { id: req.user.id } });
        res.status(200).json({ success: true, message: "Cleared unread assignments count" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Clear unread notes
 */
exports.clearUnreadNotes = async (req, res) => {
    try {
        const { User } = require("../models");
        await User.update({ last_note_seen_at: new Date() }, { where: { id: req.user.id } });
        res.status(200).json({ success: true, message: "Cleared unread notes count" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Clear unread chats for student (marks all chat rooms as read)
 */
exports.clearUnreadChats = async (req, res) => {
    try {
        const { ChatParticipant } = require("../models");
        await ChatParticipant.update({ last_read_at: new Date() }, { where: { user_id: req.user.id } });
        res.status(200).json({ success: true, message: "Cleared unread chats count" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = exports;

