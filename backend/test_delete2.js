const { Op } = require("sequelize");
const { sequelize,
    Institute, User, Subscription, Plan, Student, Faculty,
    Class, Subject, Assignment, Attendance, Mark, Payment,
    StudentFee, StudentFeePayment, FeesStructure, AssignmentSubmission,
    ChatRoom, ChatMessage, ChatParticipant,
    Timetable, TimetableSlot,
    BiometricDevice, BiometricPunch, BiometricEnrollment,
    Note, NoteDownload, Expense,
    InstitutePublicProfile, InstituteGalleryPhoto, InstituteReview, PublicEnquiry, InstituteDiscount,
    RazorpayOrder, RazorpayPayment, Invoice, FeeDiscountLog,
    FacultyAttendance, FacultySalary, ClassSession, Exam, AssignmentSetting,
    StudentClass, StudentSubject, StudentParent, Announcement, TransportFee,
    BiometricSettings, AssignmentSubmissionHistory,
    SlowRequestLog, AuditLog, BulkImportLog, UsageTracker, InstituteAddOn, SubscriptionEvent
} = require("./models");

async function run() {
    const id = 17;
    const t = await sequelize.transaction();
    try {
        console.log("Starting deletion for 17");
        await AssignmentSubmissionHistory.destroy({
            where: {},
            include: [{ model: AssignmentSubmission, where: { institute_id: id }, required: true }],
            transaction: t
        }).catch(async () => {
            const submissions = await AssignmentSubmission.findAll({
                where: { institute_id: id },
                attributes: ['id'],
                transaction: t
            });
            const submissionIds = submissions.map(s => s.id);
            if (submissionIds.length > 0) {
                await AssignmentSubmissionHistory.destroy({
                    where: { submission_id: { [Op.in]: submissionIds } },
                    transaction: t
                });
            }
        });

        await NoteDownload.destroy({
            where: {},
            include: [{ model: Note, where: { institute_id: id }, required: true }],
            transaction: t
        }).catch(async () => {
            const notes = await Note.findAll({ where: { institute_id: id }, attributes: ['id'], transaction: t });
            const noteIds = notes.map(n => n.id);
            if (noteIds.length > 0) {
                await NoteDownload.destroy({ where: { note_id: { [Op.in]: noteIds } }, transaction: t });
            }
        });

        await Invoice.destroy({ where: { institute_id: id }, transaction: t });
        await FeeDiscountLog.destroy({ where: { institute_id: id }, transaction: t });

        const devices = await BiometricDevice.findAll({
            where: { institute_id: id },
            attributes: ['id'],
            transaction: t
        });
        const deviceIds = devices.map(d => d.id);
        if (deviceIds.length > 0) {
            await BiometricPunch.destroy({ where: { device_id: { [Op.in]: deviceIds } }, transaction: t });
            await BiometricEnrollment.destroy({ where: { device_id: { [Op.in]: deviceIds } }, transaction: t });
        }

        const rooms = await ChatRoom.findAll({
            where: { institute_id: id },
            attributes: ['id'],
            transaction: t
        });
        const roomIds = rooms.map(r => r.id);
        if (roomIds.length > 0) {
            await ChatMessage.destroy({ where: { room_id: { [Op.in]: roomIds } }, transaction: t });
            await ChatParticipant.destroy({ where: { room_id: { [Op.in]: roomIds } }, transaction: t });
        }

        await AssignmentSubmission.destroy({ where: { institute_id: id }, transaction: t });
        await Mark.destroy({ where: { institute_id: id }, transaction: t });
        await StudentFeePayment.destroy({ where: { institute_id: id }, transaction: t });
        await StudentFee.destroy({ where: { institute_id: id }, transaction: t });
        await Payment.destroy({ where: { institute_id: id }, transaction: t });
        await Attendance.destroy({ where: { institute_id: id }, transaction: t });
        await FacultyAttendance.destroy({ where: { institute_id: id }, transaction: t });
        await FacultySalary.destroy({ where: { institute_id: id }, transaction: t });
        await ClassSession.destroy({ where: { institute_id: id }, transaction: t });
        await Timetable.destroy({ where: { institute_id: id }, transaction: t });
        await TimetableSlot.destroy({ where: { institute_id: id }, transaction: t });
        await Exam.destroy({ where: { institute_id: id }, transaction: t });
        await AssignmentSetting.destroy({ where: { institute_id: id }, transaction: t });
        await Assignment.destroy({ where: { institute_id: id }, transaction: t });
        await Note.destroy({ where: { institute_id: id }, transaction: t });
        await ChatRoom.destroy({ where: { institute_id: id }, transaction: t });
        await BiometricDevice.destroy({ where: { institute_id: id }, transaction: t });
        await BiometricSettings.destroy({ where: { institute_id: id }, transaction: t });
        await Announcement.destroy({ where: { institute_id: id }, transaction: t });
        await Expense.destroy({ where: { institute_id: id }, transaction: t });
        await TransportFee.destroy({ where: { institute_id: id }, transaction: t });
        await RazorpayPayment.destroy({ where: { institute_id: id }, transaction: t });
        await RazorpayOrder.destroy({ where: { institute_id: id }, transaction: t });
        await StudentClass.destroy({ where: { institute_id: id }, transaction: t });
        await StudentSubject.destroy({ where: { institute_id: id }, transaction: t });

        const students = await Student.findAll({
            where: { institute_id: id },
            attributes: ['id'],
            transaction: t
        });
        const studentIds = students.map(s => s.id);
        if (studentIds.length > 0) {
            await StudentParent.destroy({ where: { student_id: { [Op.in]: studentIds } }, transaction: t });
        }

        await FeesStructure.destroy({ where: { institute_id: id }, transaction: t });
        await Subject.destroy({ where: { institute_id: id }, transaction: t });
        await Student.destroy({ where: { institute_id: id }, transaction: t });
        await Faculty.destroy({ where: { institute_id: id }, transaction: t });
        await Class.destroy({ where: { institute_id: id }, transaction: t });
        await SlowRequestLog.destroy({ where: { institute_id: id }, transaction: t });
        await AuditLog.destroy({ where: { institute_id: id }, transaction: t });
        await BulkImportLog.destroy({ where: { institute_id: id }, transaction: t });
        await UsageTracker.destroy({ where: { institute_id: id }, transaction: t });
        await InstituteAddOn.destroy({ where: { institute_id: id }, transaction: t });
        await SubscriptionEvent.destroy({ where: { institute_id: id }, transaction: t });
        await User.destroy({
            where: {
                institute_id: id,
                role: { [Op.in]: ['admin', 'manager', 'faculty', 'student'] }
            },
            transaction: t
        });

        await InstitutePublicProfile.destroy({ where: { institute_id: id }, transaction: t });
        await InstituteGalleryPhoto.destroy({ where: { institute_id: id }, transaction: t });
        await InstituteReview.destroy({ where: { institute_id: id }, transaction: t });
        await PublicEnquiry.destroy({ where: { institute_id: id }, transaction: t });
        await InstituteDiscount.destroy({ where: { institute_id: id }, transaction: t });
        await Subscription.destroy({ where: { institute_id: id }, transaction: t });

        const institute = await Institute.findByPk(id);
        await institute.destroy({ transaction: t });

        await t.rollback();
        console.log('SUCCESS! Rolled back successfully.');
    } catch (e) {
        await t.rollback();
        console.log('--- ERROR ---');
        console.log(e);
    }
    process.exit(0);
}

run();
