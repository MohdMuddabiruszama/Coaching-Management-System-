const cron = require('node-cron');
const { Op } = require('sequelize');
const { StudentFee, Student, Attendance, NotificationPref, Notification } = require('../models');
const NotificationService = require('./notificationService');

class CronService {
    static init() {
        // Daily 9:00 AM — Fee Due Reminder
        cron.schedule('0 9 * * *', async () => {
            console.log("[CRON] Running Daily 9:00 AM Fee Due Reminder");
            try {
                // Find fees due within 3 days (due_date = today + 3)
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
                // In a real scenario, this requires calculating cumulative attendance.
                // For demonstration/phase 5, let's query students with < 75% attendance overall
                // But since we just store daily attendance, it requires an aggregate query.
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
            // In a full implementation, you would queue FCM messages in DB if DND is active,
            // and flush them here. Since we skipped queueing in NotificationService for simplicity,
            // this is a placeholder.
        });

        console.log("[CRON] Cron jobs initialized successfully.");
    }
}

module.exports = CronService;
