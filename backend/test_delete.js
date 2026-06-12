const { sequelize, Institute, Subscription, Student, Faculty, Class, AssignmentSubmissionHistory, AssignmentSubmission, NoteDownload, Note, Invoice, FeeDiscountLog, BiometricDevice, BiometricPunch, BiometricEnrollment, ChatRoom, ChatMessage, ChatParticipant, Mark, StudentFeePayment, StudentFee, Payment, Attendance, FacultyAttendance, FacultySalary, ClassSession, Timetable, TimetableSlot, Exam, AssignmentSetting, Assignment, BiometricSettings, Announcement, Expense, TransportFee, RazorpayPayment, RazorpayOrder, StudentClass, StudentSubject, StudentParent, FeesStructure, Subject, User, InstitutePublicProfile, InstituteGalleryPhoto, InstituteReview, PublicEnquiry, InstituteDiscount } = require('./models');

async function testDelete() {
    const id = 17;
    const t = await sequelize.transaction();
    try {
        const institute = await Institute.findByPk(id);
        if (!institute) return console.log('Institute not found');
        
        await institute.destroy({ transaction: t });
        await t.rollback();
        console.log('SUCCESS! Everything cascaded correctly.');
    } catch (error) {
        await t.rollback();
        console.log('--- ERROR ---');
        console.log(error);
    }
    process.exit(0);
}

testDelete();
