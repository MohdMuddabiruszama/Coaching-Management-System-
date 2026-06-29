/**
 * Faculty Controller
 * Handles CRUD operations for faculty members
 * Implements institute-level data isolation
 */

const { Faculty, User, Subject, Institute, Plan, Class, StudentClass } = require("../models");
const { Op } = require("sequelize");
const { hashPassword } = require("../utils/hashPassword");

/**
 * Get own faculty record
 * @route GET /api/faculty/me
 * @access Faculty
 */
exports.getMe = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const user_id = req.user.id;

        const faculty = await Faculty.findOne({
            where: { user_id, institute_id },
            include: [
                {
                    model: User,
                    attributes: ["id", "name", "email", "phone", "status"],
                },
                {
                    model: Subject,
                    attributes: ["id", "name"],
                },
            ],
        });

        if (!faculty) {
            return res.status(404).json({
                success: false,
                message: "Faculty record not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Faculty retrieved successfully",
            data: faculty,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * Create a new faculty member
 * @route POST /api/faculty
 * @access Admin only
 */
exports.createFaculty = async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            password,
            designation,
            address,
            join_date,
        } = req.body;

        const institute_id = req.user.institute_id;

        // Check Plan Limits
        const institute = await Institute.findByPk(institute_id, {
            include: [{ model: Plan }]
        });

        if (institute && institute.Plan) {
            const facultyCount = await Faculty.count({ where: { institute_id } });
            if (institute.Plan.faculty_limit !== null && facultyCount >= institute.Plan.faculty_limit) {
                return res.status(403).json({
                    success: false,
                    message: `Plan limit reached. Your plan allows a maximum of ${institute.Plan.faculty_limit} faculty members. Upgrade your plan to add more.`
                });
            }
        }

        // Check if faculty email already exists anywhere (global uniqueness)
        const existingUser = await User.findOne({
            where: { email },
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Faculty with this email already exists",
            });
        }

        // Hash password
        const { generateTempPassword } = require('../utils/passwordGenerator');
        const tempPassword = password || generateTempPassword();
        const password_hash = await hashPassword(tempPassword);

        const temp_password_expires_at = new Date();
        temp_password_expires_at.setDate(temp_password_expires_at.getDate() + 7);

        // Create user account
        const user = await User.create({
            institute_id,
            role: "faculty",
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

        // Create faculty record
        const faculty = await Faculty.create({
            institute_id,
            user_id: user.id,
            designation,
            address,
            join_date: join_date || new Date(),
        });

        res.status(201).json({
            success: true,
            message: "Faculty created successfully",
            showPasswordOnScreen: true,
            initial_password: tempPassword,
            data: {
                faculty,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                },
            },
        });
    } catch (error) {
        console.error("Create faculty error:", error);
        const errorMessage = error.errors ? error.errors.map(e => e.message).join(', ') : error.message;
        res.status(500).json({
            success: false,
            message: errorMessage,
        });
    }
};

/**
 * Get all faculty members
 * @route GET /api/faculty
 * @access Admin, Faculty
 */
exports.getAllFaculty = async (req, res) => {
    try {
        const { page = 1, limit = 100, search = "", cursor } = req.query;
        const institute_id = req.user.institute_id;
        const parsedLimit = Math.min(parseInt(limit, 10) || 100, 100);
        const offset = (parseInt(page, 10) - 1) * parsedLimit;

        const userWhereClause = search
            ? {
                [Op.or]: [
                    { name: { [Op.like]: `%${search}%` } },
                    { email: { [Op.like]: `%${search}%` } },
                ],
            }
            : {};

        const whereClause = { institute_id };
        if (cursor) whereClause.id = { [Op.lt]: cursor };

        const queryOptions = {
            where: whereClause,
            limit: cursor ? parsedLimit + 1 : parsedLimit,
            order: [["id", "DESC"]],
            distinct: true, // Fix for correct count with includes
            include: [
                {
                    model: User,
                    attributes: ["id", "name", "email", "phone", "status"],
                    where: userWhereClause,
                    required: search ? true : false, // Use INNER JOIN only when searching
                },
                {
                    model: Subject,
                    attributes: ["id", "name"],
                    required: false,
                    include: [
                        {
                            model: Class,
                            attributes: ["id", "name", "section"],
                        }
                    ]
                },
            ],
        };

        if (!cursor) queryOptions.offset = parseInt(offset, 10);

        if (cursor) {
            const rows = await Faculty.findAll(queryOptions);
            const hasMore = rows.length > parsedLimit;
            const data = hasMore ? rows.slice(0, parsedLimit) : rows;

            return res.status(200).json({
                success: true,
                message: "Faculty retrieved successfully",
                data,
                count: data.length,
                nextCursor: hasMore && data.length ? data[data.length - 1].id : null,
                hasMore,
            });
        }

        const { count, rows } = await Faculty.findAndCountAll(queryOptions);

        res.status(200).json({
            success: true,
            message: "Faculty retrieved successfully",
            data: rows, count // Return array directly for easier frontend handling
        });
    } catch (error) {
        console.error("========== GET FACULTY ERROR ==========");
        console.error(error);
        console.error("Message:", error.message);
        console.error("Stack:", error.stack);
        console.error("=======================================");
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * Get faculty by ID
 * @route GET /api/faculty/:id
 * @access Admin, Faculty (own record)
 */
exports.getFacultyById = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;

        const faculty = await Faculty.findOne({
            where: { id, institute_id },
            include: [
                {
                    model: User,
                    attributes: ["id", "name", "email", "phone", "status"],
                },
                {
                    model: Subject,
                    attributes: ["id", "name"],
                },
            ],
        });

        if (!faculty) {
            return res.status(404).json({
                success: false,
                message: "Faculty not found",
            });
        }

        // If faculty role, ensure they can only access their own record
        if (req.user.role === "faculty" && faculty.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Access forbidden",
            });
        }

        res.status(200).json({
            success: true,
            message: "Faculty retrieved successfully",
            data: faculty,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * Update faculty
 * @route PUT /api/faculty/:id
 * @access Admin only
 */
exports.updateFaculty = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;
        const {
            name,
            email,
            phone,
            designation,
            address,
            join_date,
            status,
        } = req.body;

        const faculty = await Faculty.findOne({
            where: { id, institute_id },
            include: [{ model: User }],
        });

        if (!faculty) {
            return res.status(404).json({
                success: false,
                message: "Faculty not found",
            });
        }

        if (req.user.role === "faculty" && faculty.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Access forbidden",
            });
        }

        // Update user details
        if (name !== undefined || email !== undefined || phone !== undefined || status !== undefined) {
            await faculty.User.update({
                name: name !== undefined ? name : faculty.User.name,
                email: email !== undefined ? email : faculty.User.email,
                phone: phone !== undefined ? phone : faculty.User.phone,
                status: status !== undefined ? status : faculty.User.status,
            });
        }

        // Update faculty details
        await faculty.update({
            designation: designation !== undefined ? designation : faculty.designation,
            address: address !== undefined ? address : faculty.address,
            join_date: join_date !== undefined ? join_date : faculty.join_date,
        });

        res.status(200).json({
            success: true,
            message: "Faculty updated successfully",
            data: faculty,
        });
    } catch (error) {
        console.error("Update faculty error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * Delete faculty
 * @route DELETE /api/faculty/:id
 * @access Admin only
 */
exports.deleteFaculty = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;

        const faculty = await Faculty.findOne({
            where: { id, institute_id },
            include: [{ model: User }],
        });

        if (!faculty) {
            return res.status(404).json({
                success: false,
                message: "Faculty not found",
            });
        }

        // Delete user account
        await faculty.User.destroy();

        // Delete faculty record
        await faculty.destroy();

        res.status(200).json({
            success: true,
            message: "Faculty deleted successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * Get current initial passwords for selected faculty.
 * @route POST /api/faculty/credentials
 * @access Admin
 */
exports.getFacultyCredentials = async (req, res) => {
    try {
        const { faculty_ids } = req.body;
        const institute_id = req.user.institute_id;

        if (!Array.isArray(faculty_ids) || faculty_ids.length === 0) {
            return res.status(400).json({ success: false, message: "No faculty selected" });
        }

        const { generateTempPassword } = require('../utils/passwordGenerator');
        const { hashPassword } = require("../utils/hashPassword");

        const faculty = await Faculty.findAll({
            where: { id: { [Op.in]: faculty_ids }, institute_id },
            include: [{ model: User, attributes: ['id', 'name', 'email', 'initial_password', 'is_first_login'] }]
        });

        const credentials = [];

        for (const f of faculty) {
            let password = f.User.initial_password;
            let status = 'active';

            if (!password) {
                if (!f.User.is_first_login) {
                    status = 'changed';
                    password = null;
                } else {
                    const tempPassword = generateTempPassword();
                    const password_hash = await hashPassword(tempPassword);
                    const tempExpiry = new Date();
                    tempExpiry.setDate(tempExpiry.getDate() + 7);

                    await f.User.update({
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
                id: f.id,
                identifier: f.designation || 'Faculty',
                name: f.User.name,
                email: f.User.email,
                password,
                status,
            });
        }

        res.status(200).json({ success: true, data: credentials });
    } catch (error) {
        console.error('getFacultyCredentials error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Resend faculty credentials
 * @route POST /api/faculty/:id/resend-credentials
 * @access Admin
 */
exports.resendFacultyCredentials = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user.institute_id;

        const faculty = await Faculty.findOne({
            where: { id, institute_id },
            include: [{ model: User }],
        });

        if (!faculty) {
            return res.status(404).json({ success: false, message: "Faculty not found" });
        }

        const lastSent = faculty.User.credentials_sent_at;
        if (lastSent && new Date() - new Date(lastSent) < 5 * 60 * 1000) {
            return res.status(429).json({ success: false, message: "Please wait 5 minutes before resending credentials." });
        }

        const { generateTempPassword } = require('../utils/passwordGenerator');
        const { hashPassword } = require("../utils/hashPassword");
        const tempPassword = generateTempPassword();
        const password_hash = await hashPassword(tempPassword);

        const tempExpiry = new Date();
        tempExpiry.setDate(tempExpiry.getDate() + 7);

        await faculty.User.update({
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

/**
 * Get dashboard stats for faculty
 * @route GET /api/faculty/dashboard-stats
 * @access Faculty
 */
exports.getDashboardStats = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const user_id = req.user.id;

        const faculty = await Faculty.findOne({ where: { user_id, institute_id } });
        if (!faculty) {
            return res.status(404).json({ success: false, message: "Faculty not found" });
        }

        const subjects = await Subject.findAll({
            where: { faculty_id: faculty.id, institute_id }
        });

        const teachingSubjectsCount = subjects.length;
        const classIds = [...new Set(subjects.map(s => s.class_id).filter(Boolean))];
        const classesAssignedCount = classIds.length;

        let totalStudentsCount = 0;
        if (classIds.length > 0) {
            totalStudentsCount = await StudentClass.count({
                where: { class_id: { [Op.in]: classIds } },
                distinct: true,
                col: 'student_id'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                teachingSubjectsCount,
                classesAssignedCount,
                totalStudentsCount
            }
        });
    } catch (error) {
        console.error("Dashboard stats error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Bulk delete faculty
 * @route POST /api/faculty/bulk-delete
 * @access Admin only
 */
exports.bulkDeleteFaculty = async (req, res) => {
    try {
        const { faculty_ids } = req.body;
        const institute_id = req.user.institute_id;

        if (!faculty_ids || !Array.isArray(faculty_ids) || faculty_ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide an array of faculty IDs to delete",
            });
        }

        const faculties = await Faculty.findAll({
            where: {
                id: {
                    [Op.in]: faculty_ids,
                },
                institute_id,
            },
        });

        if (faculties.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No matching faculty found to delete",
            });
        }

        const userIds = faculties.map(f => f.user_id);

        // Delete faculty records
        await Faculty.destroy({
            where: {
                id: {
                    [Op.in]: faculties.map(f => f.id),
                },
                institute_id,
            },
        });

        // Delete associated user accounts
        await User.destroy({
            where: {
                id: {
                    [Op.in]: userIds,
                },
                institute_id,
            },
        });

        res.status(200).json({
            success: true,
            message: `Successfully deleted ${faculties.length} faculty members`,
        });
    } catch (error) {
        console.error("Bulk delete faculty error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

module.exports = exports;
