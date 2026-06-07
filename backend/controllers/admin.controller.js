const { Student, Faculty, Class, User, StudentFee, Announcement, ChatMessage, ChatRoom, Assignment, Note, PublicEnquiry, sequelize } = require("../models");
const { Op } = require("sequelize");

exports.getDashboardStats = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;

        const currentUser = await User.findByPk(req.user.id, { attributes: ['last_chat_seen_at', 'last_announcement_seen_at', 'last_assignment_seen_at', 'last_note_seen_at', 'last_enquiry_seen_at'] });
        const lastChatSeenAt = currentUser?.last_chat_seen_at || new Date(0);
        const lastAnnouncementSeenAt = currentUser?.last_announcement_seen_at || new Date(0);
        const lastAssignmentSeenAt = currentUser?.last_assignment_seen_at || new Date(0);
        const lastNoteSeenAt = currentUser?.last_note_seen_at || new Date(0);
        const lastEnquirySeenAt = currentUser?.last_enquiry_seen_at || new Date(0);

        // Run all counts in parallel for performance
        const [
            totalStudents,
            totalFaculty,
            totalClasses,
            totalAdmins,
            totalManagers,
            activeStudents,
            studentFees,
            unreadChatCount,
            unreadAnnouncementCount,
            unreadAssignmentCount,
            unreadNoteCount,
            unreadEnquiryCount
        ] = await Promise.all([
            Student.count({ where: { institute_id } }),
            Faculty.count({ where: { institute_id } }),
            Class.count({ where: { institute_id } }),
            User.count({ where: { institute_id, role: 'admin' } }),
            User.count({ where: { institute_id, role: 'manager' } }),
            Student.count({
                include: [{ model: User, where: { status: "active" } }],
                where: { institute_id }
            }),
            StudentFee.findAll({ where: { institute_id } }),
            ChatMessage.count({
                where: {
                    created_at: { [Op.gt]: lastChatSeenAt },
                    sender_id: { [Op.ne]: req.user.id },
                    room_id: {
                        [Op.in]: sequelize.literal(`(SELECT id FROM chat_rooms WHERE institute_id = ${institute_id})`)
                    }
                }
            }),
            Announcement.count({
                where: {
                    institute_id,
                    created_at: { [Op.gt]: lastAnnouncementSeenAt },
                    created_by: { [Op.ne]: req.user.id }
                }
            }),
            Assignment.count({
                where: {
                    institute_id,
                    created_at: { [Op.gt]: lastAssignmentSeenAt },
                    faculty_id: { [Op.ne]: req.user.id }
                }
            }),
            Note.count({
                where: {
                    institute_id,
                    created_at: { [Op.gt]: lastNoteSeenAt },
                    faculty_id: { [Op.ne]: req.user.id }
                }
            }),
            PublicEnquiry.count({
                where: {
                    institute_id,
                    created_at: { [Op.gt]: lastEnquirySeenAt }
                }
            })
        ]);

        const totalDiscount = studentFees.reduce((sum, sf) => sum + parseFloat(sf.discount_amount || 0), 0);
        const totalDue = studentFees.reduce((sum, sf) => sum + parseFloat(sf.due_amount || 0), 0);

        res.status(200).json({
            success: true,
            data: {
                totalStudents,
                totalFaculty,
                totalClasses,
                totalAdmins,
                totalManagers,
                activeStudents,
                totalDiscount,
                totalDue,
                unreadChatCount,
                unreadAnnouncementCount,
                unreadAssignmentCount,
                unreadNotesCount: unreadNoteCount,
                unreadEnquiryCount
            }
        });

    } catch (error) {
        console.error("Dashboard stats error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.clearUnreadAnnouncements = async (req, res) => {
    try {
        await User.update({ last_announcement_seen_at: new Date() }, { where: { id: req.user.id } });
        res.status(200).json({ success: true, message: "Cleared unread announcements count" });
    } catch (error) {
        console.error("Clear announcements error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.clearUnreadChats = async (req, res) => {
    try {
        await User.update({ last_chat_seen_at: new Date() }, { where: { id: req.user.id } });
        res.status(200).json({ success: true, message: "Cleared unread chats count" });
    } catch (error) {
        console.error("Clear chats error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.clearUnreadAssignments = async (req, res) => {
    try {
        await User.update({ last_assignment_seen_at: new Date() }, { where: { id: req.user.id } });
        res.status(200).json({ success: true, message: "Cleared unread assignments count" });
    } catch (error) {
        console.error("Clear assignments error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.clearUnreadNotes = async (req, res) => {
    try {
        await User.update({ last_note_seen_at: new Date() }, { where: { id: req.user.id } });
        res.status(200).json({ success: true, message: "Cleared unread notes count" });
    } catch (error) {
        console.error("Clear notes error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.clearUnreadEnquiries = async (req, res) => {
    try {
        await User.update({ last_enquiry_seen_at: new Date() }, { where: { id: req.user.id } });
        res.status(200).json({ success: true, message: "Cleared unread enquiries count" });
    } catch (error) {
        console.error("Clear enquiries error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Admin Management ---

const { Institute, Plan } = require("../models");
const { hashPassword } = require("../utils/hashPassword");

exports.getAllAdmins = async (req, res) => {
    try {
        if (req.user.role === 'manager') return res.status(403).json({ success: false, message: "Managers cannot manage secondary admins." });
        const institute_id = req.user.institute_id;
        const { Op } = require('sequelize');
        const admins = await User.findAll({
            where: {
                institute_id,
                role: { [Op.in]: ['admin', 'manager'] }
            },
            attributes: ['id', 'name', 'email', 'phone', 'status', 'created_at', 'role', 'permissions', 'manager_type', 'manager_type_label']
        });

        res.status(200).json({
            success: true,
            data: admins
        });
    } catch (error) {
        console.error("Get admins error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Manager type labels — used when creating a manager
const MANAGER_TYPE_LABELS = {
    fees:     'Fees Manager',
    data:     'Data Manager',
    academic: 'Academic Manager',
    ops:      'Operations Manager',
    hr:       'HR Manager',
    custom:   'Custom Manager',
};

exports.createAdmin = async (req, res) => {
    try {
        if (req.user.role === 'manager') return res.status(403).json({ success: false, message: "Managers cannot create secondary admins." });
        const institute_id = req.user.institute_id;
        const { name, email, password, phone } = req.body;

        // 1. Check Plan Limits
        const institute = await Institute.findByPk(institute_id, {
            include: [{ model: Plan }]
        });

        if (!institute || !institute.Plan) {
            return res.status(403).json({ success: false, message: "No active plan found." });
        }

        const { Op } = require('sequelize');
        const currentAdminCount = await User.count({
            where: { institute_id, role: { [Op.in]: ['admin', 'manager'] } }
        });

        const limit_admins = institute.current_limit_admins || institute.Plan.max_admin_users;

        if (currentAdminCount >= limit_admins) {
            return res.status(403).json({
                success: false,
                message: `Plan limit reached. Your plan allows ${limit_admins} admins. Please upgrade.`
            });
        }

        // 2. Validate Input
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: "Name, email, and password are required." });
        }

        // 3. Create Admin/Manager (second admins are created as managers)
        const hashedPassword = await hashPassword(password);
        const rawType = req.body.manager_type || 'custom';
        const validTypes = ['fees', 'data', 'academic', 'ops', 'hr', 'custom'];
        const managerType = validTypes.includes(rawType) ? rawType : 'custom';

        const newAdmin = await User.create({
            institute_id,
            role: 'manager',
            name,
            email,
            phone,
            password_hash: hashedPassword,
            status: 'active',
            permissions: req.body.permissions || null,
            manager_type: managerType,
            manager_type_label: MANAGER_TYPE_LABELS[managerType] || 'Custom Manager',
        });

        res.status(201).json({
            success: true,
            message: "New admin created successfully.",
            data: {
                id: newAdmin.id,
                name: newAdmin.name,
                email: newAdmin.email
            }
        });

    } catch (error) {
        console.error("Create admin error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteAdmin = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const adminIdToDelete = req.params.id;
        const currentUserId = req.user.id; // From middleware

        if (parseInt(adminIdToDelete) === currentUserId) {
            return res.status(400).json({ success: false, message: "You cannot delete yourself." });
        }

        // Find the FIRST admin created for this institute (lowest ID = primary admin)
        const firstAdmin = await User.findOne({
            where: { institute_id, role: 'admin' },
            order: [['id', 'ASC']]
        });

        // The primary admin cannot be deleted
        if (firstAdmin && firstAdmin.id === parseInt(adminIdToDelete)) {
            return res.status(403).json({
                success: false,
                message: "Permission denied. The original primary admin cannot be deleted."
            });
        }

        // A Manager cannot delete ANY other admin
        if (req.user.role === 'manager') {
            return res.status(403).json({
                success: false,
                message: "Managers cannot remove other administrators."
            });
        }

        const { Op } = require('sequelize');
        const admin = await User.findOne({
            where: {
                id: adminIdToDelete,
                institute_id,
                role: { [Op.in]: ['admin', 'manager'] }
            }
        });

        if (!admin) {
            return res.status(404).json({ success: false, message: "Admin not found." });
        }

        try {
            await admin.destroy();
            res.status(200).json({ success: true, message: "Admin removed successfully." });
        } catch (dbError) {
            if (dbError.name === 'SequelizeForeignKeyConstraintError') {
                return res.status(400).json({
                    success: false,
                    message: "Cannot remove this manager because they have linked records (e.g. they marked attendance or collected fees). Please Edit and Block their account instead."
                });
            }
            throw dbError;
        }

    } catch (error) {
        console.error("Delete admin error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Check if current admin is the primary admin
exports.checkIsPrimaryAdmin = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const currentUserId = req.user.id;

        const firstAdmin = await User.findOne({
            where: { institute_id, role: 'admin' },
            order: [['id', 'ASC']]
        });

        res.status(200).json({
            success: true,
            is_primary: firstAdmin && firstAdmin.id === currentUserId
        });
    } catch (error) {
        console.error("Check primary admin error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateAdmin = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const adminId = req.params.id;
        const { name, email, phone, status } = req.body;

        const { Op } = require('sequelize');
        const admin = await User.findOne({
            where: { id: adminId, institute_id, role: { [Op.in]: ['admin', 'manager'] } }
        });

        if (!admin) {
            return res.status(404).json({ success: false, message: "Admin/Manager not found." });
        }

        // Block Manager from editing Primary Admin
        if (req.user.role === 'manager' && admin.role === 'admin') {
            return res.status(403).json({ success: false, message: "Managers cannot edit primary administrators." });
        }

        await admin.update({
            name,
            email,
            phone,
            status,
            permissions: req.body.permissions !== undefined ? req.body.permissions : admin.permissions
        });

        res.status(200).json({ success: true, message: "Admin updated successfully.", data: admin });

    } catch (error) {
        console.error("Update admin error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}
