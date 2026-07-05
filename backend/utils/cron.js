const cron = require("node-cron");
const { Institute, Subscription } = require("../models");
const { Op } = require("sequelize");
const emailService = require("../services/email.service");

cron.schedule("0 0 * * *", async () => {
    console.log("Running daily subscription check...");

    const today = new Date();

    // === LIFETIME BYPASS: Do NOT expire lifetime member subscriptions ===
    const expiredSubs = await Subscription.findAll({
        where: {
            end_date: { [Op.lt]: today },
            payment_status: "paid"
        },
        include: [{
            model: Institute,
            // Exclude lifetime members — they never expire
            where: { is_lifetime_member: { [Op.not]: true } },
            attributes: ['id', 'is_lifetime_member']
        }]
    });

    for (const sub of expiredSubs) {
        await sub.update({ payment_status: "unpaid" });

        await Institute.update(
            { status: "inactive" },
            { where: { id: sub.institute_id } }
        );
    }

    console.log(`Expired ${expiredSubs.length} subscriptions.`);
});

cron.schedule("0 9 * * *", async () => {
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + 3);

    // === LIFETIME BYPASS: Do NOT send expiry warnings to lifetime members ===
    const expiringSubs = await Subscription.findAll({
        where: {
            end_date: { [Op.eq]: warningDate.toISOString().split('T')[0] },
            payment_status: "paid"
        },
        include: [{
            model: Institute,
            // Exclude lifetime members — they never get expiry warnings
            where: { is_lifetime_member: { [Op.not]: true } },
            attributes: ['id', 'email', 'is_lifetime_member']
        }]
    });

    for (const sub of expiringSubs) {
        const institute = await Institute.findByPk(sub.institute_id);
        if (institute) {
            await emailService.sendEmail(
                institute.email,
                "Subscription Expiring Soon",
                `
                <h3>Your Subscription is Expiring</h3>
                <p>Your plan will expire on ${sub.end_date}</p>
                <p>Please renew to avoid service interruption.</p>
                `
            );
        }
    }
    console.log(`Sent ${expiringSubs.length} subscription warnings.`);
});

// ─────────────────────────────────────────────────────────────────
// PHASE 6 — BIOMETRIC ABSENT DETECTION
// Runs every day at 11:00 PM — marks absent for enrolled students
// who never punched in today.
// ─────────────────────────────────────────────────────────────────
cron.schedule("0 23 * * *", async () => {
    console.log("🔐 Running biometric absent detection...");
    try {
        const { BiometricSettings, Institute } = require("../models");
        const biometricCtrl = require("../controllers/biometric.controller");

        // Get all institutes with biometric settings
        const settings = await BiometricSettings.findAll();
        const today = new Date().toISOString().split("T")[0];

        for (const setting of settings) {
            const marked = await biometricCtrl.markAbsentStudents(setting.institute_id, today);
            if (marked > 0) {
                console.log(`   ✓ Institute ${setting.institute_id}: ${marked} absent records created`);
            }
        }
        console.log("✅ Biometric absent detection complete.");
    } catch (err) {
        console.error("❌ Absent detection cron error:", err.message);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// MONTHLY SALARY AUTO-GENERATE (Faculty Salary.md — Phase 4)
// Runs on the 1st of every month at 00:01 AM IST.
// Creates pending salary records for all active faculty from their settings.
// Admin only needs to review & click Pay — no manual record creation needed.
// ─────────────────────────────────────────────────────────────────────────────
cron.schedule("1 0 1 * *", async () => {
    console.log("[Salary Cron] 🕛 Running monthly salary auto-generate (1st of month)...");
    try {
        const { generateMonthlySalaries } = require("../services/salaryAutoGenerate.service");
        const result = await generateMonthlySalaries();
        console.log(`[Salary Cron] ✅ Complete: ${JSON.stringify(result)}`);
    } catch (err) {
        console.error("[Salary Cron] ❌ Failed:", err.message);
        // In production: alert via email/Sentry here
    }
}, {
    timezone: "Asia/Kolkata",  // IST timezone for Indian institutes
});

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION SYSTEM CRONS (Phase 5)
// ─────────────────────────────────────────────────────────────────────────────
const NotificationService = require('../services/notificationService');
const { StudentFee, Attendance, NotificationPref } = require('../models');

// Daily 9:00 AM — Fee Due Reminder
cron.schedule('0 9 * * *', async () => {
    console.log("[CRON] Running Daily 9:00 AM Fee Due Reminder");
    try {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 3);
        const targetDateString = targetDate.toISOString().split('T')[0];

        const { FeesStructure } = require('../models');
        const fees = await StudentFee.findAll({
            where: {
                status: { [Op.ne]: 'paid' }
            },
            include: [{
                model: FeesStructure,
                where: { due_date: targetDateString }
            }]
        });

        for (const fee of fees) {
            await NotificationService.notifyStudentAndParents(
                fee.institute_id,
                fee.student_id,
                "fee_due",
                "Fee Due Reminder",
                `Your fee of ₹${fee.due_amount} is due on ${targetDateString}.`,
                `/student/fees`
            );
        }
    } catch (err) {
        console.error("[CRON] Fee Due Reminder Error:", err);
    }
});

// Daily 8:00 PM — Low Attendance Alert
cron.schedule('0 20 * * *', async () => {
    console.log("[CRON] Running Daily 8:00 PM Low Attendance Alert");
    try {
        const { sequelize } = require('../models');
        const lowAttendanceStudents = await sequelize.query(`
            SELECT student_id, institute_id, 
                   SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) * 100.0 / COUNT(id) as attendance_percent
            FROM attendance
            GROUP BY student_id, institute_id
            HAVING SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) * 100.0 / COUNT(id) < 75
        `, { type: sequelize.QueryTypes.SELECT });

        for (const row of lowAttendanceStudents) {
            await NotificationService.notifyStudentAndParents(
                row.institute_id,
                row.student_id,
                "low_attendance",
                "Low Attendance Alert",
                `Your attendance is currently at ${parseFloat(row.attendance_percent).toFixed(1)}%, which is below the 75% requirement.`,
                `/student/attendance`
            );
        }
    } catch (err) {
        console.error("[CRON] Low Attendance Alert Error:", err);
    }
});

// Daily 7:00 AM — DND Flush Queue
cron.schedule('0 7 * * *', async () => {
    console.log("[CRON] Running Daily 7:00 AM DND Flush Queue");
    // Placeholder: Flush queued notifications
});

// Weekly Sunday 8:00 AM — Email Digest
cron.schedule('0 8 * * 0', async () => {
    console.log("[CRON] Running Weekly Email Digest");
    try {
        const { User, Notification } = require('../models');
        const emailService = require('../services/email.service');
        
        // Find users who opted in for weekly digest
        const prefs = await NotificationPref.findAll({
            where: { email_enabled: true } // Assuming email_enabled means weekly digest for now
        });

        for (const pref of prefs) {
            const user = await User.findByPk(pref.user_id);
            if (!user) continue;

            const unreadNotifs = await Notification.findAll({
                where: { user_id: user.id, is_read: false }
            });

            if (unreadNotifs.length > 0) {
                let digestContent = `<h3>Your Weekly Digest</h3><ul>`;
                for (const n of unreadNotifs) {
                    digestContent += `<li><strong>${n.title}</strong>: ${n.body}</li>`;
                }
                digestContent += `</ul>`;

                await emailService.sendEmail(
                    user.email,
                    "Weekly Notification Digest",
                    digestContent
                );
            }
        }
    } catch (err) {
        console.error("[CRON] Weekly Email Digest Error:", err);
    }
});