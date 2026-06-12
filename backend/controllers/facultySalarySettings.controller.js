/**
 * Faculty Salary Settings Controller
 * Phase 5 — Faculty Salary.md
 *
 * Admin sets base salary per faculty ONCE.
 * The auto-generate cron reads these settings every month.
 * No need to re-enter salary details month after month.
 */

const { FacultySalarySettings, Faculty, User } = require("../models");

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL SETTINGS — single JOIN query
// ─────────────────────────────────────────────────────────────────────────────
exports.getSettings = async (req, res) => {
    try {
        const iid = req.user.institute_id;

        // Single JOIN query: settings + faculty name
        const settings = await FacultySalarySettings.findAll({
            where: { institute_id: iid },
            include: [{
                model:      User,
                as:         'faculty',
                attributes: ['id', 'name', 'email'],
            }],
            order: [['createdAt', 'ASC']],
        });

        res.json({ success: true, data: settings });
    } catch (err) {
        console.error("getSettings error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPSERT SETTINGS — create if not exists, update if exists — 1 DB call
// ─────────────────────────────────────────────────────────────────────────────
exports.upsertSettings = async (req, res) => {
    try {
        const iid = req.user.institute_id;
        const {
            faculty_id, basic_salary, allowances = 0,
            salary_due_day = 5, working_days_default = 26,
        } = req.body;

        if (!faculty_id || !basic_salary) {
            return res.status(400).json({ success: false, message: "faculty_id and basic_salary are required" });
        }

        // Verify faculty belongs to this institute
        const faculty = await Faculty.findOne({
            where: { user_id: faculty_id, institute_id: iid },
            include: [{ model: User, attributes: ['id', 'name', 'email'] }],
            attributes: ['id', 'user_id'],
        });
        if (!faculty) {
            return res.status(404).json({ success: false, message: "Faculty not found in this institute" });
        }

        // UPSERT: PostgreSQL ON CONFLICT DO UPDATE — 1 DB call
        const [settings, created] = await FacultySalarySettings.upsert({
            institute_id:         iid,
            faculty_id:           parseInt(faculty_id),
            basic_salary:         parseFloat(basic_salary),
            allowances:           parseFloat(allowances) || 0,
            salary_due_day:       Math.min(parseInt(salary_due_day) || 5, 28),
            working_days_default: parseInt(working_days_default) || 26,
            is_active:            true,
        }, { returning: true });

        res.status(created ? 201 : 200).json({
            success: true,
            message: created ? 'Salary settings created' : 'Salary settings updated',
            data: { 
                settings, 
                faculty_name: faculty.User?.name,
                faculty_email: faculty.User?.email
            },
        });
    } catch (err) {
        console.error("upsertSettings error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE SETTINGS — remove salary config for a faculty
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteSettings = async (req, res) => {
    try {
        const iid = req.user.institute_id;
        const { faculty_id } = req.params;

        const settings = await FacultySalarySettings.findOne({
            where: { faculty_id, institute_id: iid },
        });
        if (!settings) {
            return res.status(404).json({ success: false, message: "Salary settings not found" });
        }

        await settings.destroy();
        res.json({ success: true, message: "Salary settings deleted" });
    } catch (err) {
        console.error("deleteSettings error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};
