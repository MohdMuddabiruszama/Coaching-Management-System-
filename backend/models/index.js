const sequelize = require("../config/database");

// Relationships: The connections between tables (like "One User belongs to One Institute")

const Plan = require("./plan");
const Institute = require("./institute");
const User = require("./user");
const Class = require("./class");
const Student = require("./student");
const Faculty = require("./faculty");
const Subject = require("./subject");
const Attendance = require("./attendance");
const FacultyAttendance = require("./facultyAttendance");
const FeesStructure = require("./feesStructure");
const Payment = require("./payment");
const Announcement = require("./announcement");
const AnnouncementRead = require("./AnnouncementRead");
const Exam = require("./exam");
const Mark = require("./mark");
const Subscription = require("./subscription");
const StudentSubject = require("./studentSubject");
const StudentClass = require("./studentClass");
const ClassSession = require("./classSession");
const Expense = require("./expense");
const TimetableSlot = require("./timetableSlot");
const Timetable = require("./timetable");
const TransportFee = require("./transportFee");
const StudentFee = require("./studentFee");
const FeeDiscountLog = require("./feeDiscountLog");
const Note = require("./note");
const NoteDownload = require("./noteDownload");
const ChatRoom = require("./chatRoom");
const ChatMessage = require("./chatMessage");
const ChatParticipant = require("./chatParticipant");
const StudentParent = require("./studentParent");
const BiometricDevice = require("./biometricDevice");
const BiometricEnrollment = require("./biometricEnrollment");
const BiometricPunch = require("./biometricPunch");
const BiometricSettings = require("./biometricSettings");
const Assignment = require("./assignment");
const AssignmentSubmission = require("./assignmentSubmission");
const AssignmentSubmissionHistory = require("./assignmentSubmissionHistory");
const AssignmentSetting = require("./assignmentSetting");
const RazorpayOrder = require("./razorpayOrder");
const RazorpayPayment = require("./razorpayPayment");
const Invoice = require("./invoice");
const StudentFeePayment = require("./studentFeePayment");
const OtpVerification = require("./otpVerification");
const FacultySalary = require("./facultySalary");
const FacultySalarySettings = require("./facultySalarySettings");
const AuditLog = require("./auditLog");
const SlowRequestLog = require("./slowRequestLog");
const BulkImportLog = require("./BulkImportLog")(require("../config/database"));

// Public Web Page Models
const InstitutePublicProfile = require("./institutePublicProfile");
const InstituteGalleryPhoto = require("./instituteGalleryPhoto");
const InstituteReview = require("./instituteReview");
const PublicEnquiry = require("./publicEnquiry");
const InstituteDiscount = require("./instituteDiscount");

const Lead = require("./lead");
const LandingPageView = require("./landingPageView");
const RefreshToken = require("./refreshToken"); // ✅ Phase 7: Refresh Token model
const AddOn = require("./addOn");
const InstituteAddOn = require("./instituteAddOn");
const SubscriptionEvent = require("./subscriptionEvent");
const Coupon = require("./coupon");
const UsageTracker = require("./usageTracker");

// Associations

Plan.hasMany(Subscription, { foreignKey: "plan_id" });
Subscription.belongsTo(Plan, { foreignKey: "plan_id" });
Plan.belongsTo(Plan, { as: "PairedPlan", foreignKey: "paired_plan_id" });

Plan.hasMany(Institute, { foreignKey: "plan_id" });
Institute.belongsTo(Plan, { foreignKey: "plan_id" });

Institute.hasMany(User, { foreignKey: "institute_id" });
User.belongsTo(Institute, { foreignKey: "institute_id" });

Institute.hasMany(Class, { foreignKey: "institute_id" });
Class.belongsTo(Institute, { foreignKey: "institute_id" });

Institute.hasMany(Student, { foreignKey: "institute_id" });
Student.belongsTo(Institute, { foreignKey: "institute_id" });

Institute.hasMany(Faculty, { foreignKey: "institute_id" });
Faculty.belongsTo(Institute, { foreignKey: "institute_id" });

Student.belongsToMany(Class, { through: StudentClass, foreignKey: "student_id" });
Class.belongsToMany(Student, { through: StudentClass, foreignKey: "class_id" });

Faculty.hasMany(Subject, { foreignKey: "faculty_id" });
Subject.belongsTo(Faculty, { foreignKey: "faculty_id" });

Class.hasMany(Subject, { foreignKey: "class_id" });
Subject.belongsTo(Class, { foreignKey: "class_id" });

Student.belongsToMany(Subject, { through: StudentSubject, foreignKey: "student_id" });
Subject.belongsToMany(Student, { through: StudentSubject, foreignKey: "subject_id" });

Exam.hasMany(Mark, { foreignKey: "exam_id" });
Mark.belongsTo(Exam, { foreignKey: "exam_id" });

Institute.hasMany(Exam, { foreignKey: "institute_id" });
Exam.belongsTo(Institute, { foreignKey: "institute_id" });

Class.hasMany(Exam, { foreignKey: "class_id" });
Exam.belongsTo(Class, { foreignKey: "class_id" });

Subject.hasMany(Exam, { foreignKey: "subject_id" });
Exam.belongsTo(Subject, { foreignKey: "subject_id" });

Student.hasMany(Mark, { foreignKey: "student_id" });
Mark.belongsTo(Student, { foreignKey: "student_id" });

Institute.hasMany(Mark, { foreignKey: "institute_id" });
Mark.belongsTo(Institute, { foreignKey: "institute_id" });

Subject.hasMany(Mark, { foreignKey: "subject_id" });
Mark.belongsTo(Subject, { foreignKey: "subject_id" });

// User <-> Faculty Association
User.hasOne(Faculty, { foreignKey: "user_id" });
Faculty.belongsTo(User, { foreignKey: "user_id" });

// User <-> Student Association
User.hasOne(Student, { foreignKey: "user_id" });
Student.belongsTo(User, { foreignKey: "user_id" });

// Student <-> Parent Association
Student.belongsToMany(User, { through: StudentParent, as: "Parents", foreignKey: "student_id", otherKey: "parent_id" });
User.belongsToMany(Student, { through: StudentParent, as: "LinkedStudents", foreignKey: "parent_id", otherKey: "student_id" });

// Fees Structure Associations
FeesStructure.belongsTo(Class, { foreignKey: "class_id" });
Class.hasMany(FeesStructure, { foreignKey: "class_id" });

FeesStructure.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(FeesStructure, { foreignKey: "institute_id" });

FeesStructure.belongsTo(Subject, { foreignKey: "subject_id" });
Subject.hasMany(FeesStructure, { foreignKey: "subject_id" });

// Payment Associations
Payment.belongsTo(Student, { foreignKey: "student_id" });
Student.hasMany(Payment, { foreignKey: "student_id" });

Payment.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(Payment, { foreignKey: "institute_id" });

Payment.belongsTo(FeesStructure, { foreignKey: "fee_structure_id" });
FeesStructure.hasMany(Payment, { foreignKey: "fee_structure_id" });

Payment.belongsTo(User, { as: "collector", foreignKey: "collected_by" });
User.hasMany(Payment, { foreignKey: "collected_by" });

// StudentFee Associations
StudentFee.belongsTo(Student, { foreignKey: "student_id" });
Student.hasMany(StudentFee, { foreignKey: "student_id" });

StudentFee.belongsTo(Class, { foreignKey: "class_id" });
Class.hasMany(StudentFee, { foreignKey: "class_id" });

StudentFee.belongsTo(FeesStructure, { foreignKey: "fee_structure_id" });
FeesStructure.hasMany(StudentFee, { foreignKey: "fee_structure_id" });

StudentFee.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(StudentFee, { foreignKey: "institute_id" });

// FeeDiscountLog Associations
FeeDiscountLog.belongsTo(StudentFee, { foreignKey: "student_fee_id" });
StudentFee.hasMany(FeeDiscountLog, { foreignKey: "student_fee_id" });

FeeDiscountLog.belongsTo(User, { as: "approver", foreignKey: "approved_by" });
User.hasMany(FeeDiscountLog, { foreignKey: "approved_by" });

FeeDiscountLog.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(FeeDiscountLog, { foreignKey: "institute_id" });

// Announcement Associations
Announcement.belongsTo(User, { as: "creator", foreignKey: "created_by" });
User.hasMany(Announcement, { foreignKey: "created_by" });

Announcement.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(Announcement, { foreignKey: "institute_id" });

Announcement.belongsTo(Subject, { foreignKey: "subject_id" });
Subject.hasMany(Announcement, { foreignKey: "subject_id" });

// AnnouncementRead Associations (Phase 1 — Smart Announcement System)
Announcement.hasMany(AnnouncementRead, { foreignKey: "announcement_id" });
AnnouncementRead.belongsTo(Announcement, { foreignKey: "announcement_id" });
AnnouncementRead.belongsTo(User, { foreignKey: "user_id" });
User.hasMany(AnnouncementRead, { foreignKey: "user_id" });

// Attendance Associations
Attendance.belongsTo(Student, { foreignKey: "student_id" });
Student.hasMany(Attendance, { foreignKey: "student_id" });

Attendance.belongsTo(Class, { foreignKey: "class_id" });
Class.hasMany(Attendance, { foreignKey: "class_id" });

Attendance.belongsTo(Subject, { foreignKey: "subject_id" });
Subject.hasMany(Attendance, { foreignKey: "subject_id" });

Attendance.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(Attendance, { foreignKey: "institute_id" });

Attendance.belongsTo(User, { as: "marker", foreignKey: "marked_by" });
User.hasMany(Attendance, { foreignKey: "marked_by" });

// Faculty Attendance Associations
FacultyAttendance.belongsTo(Faculty, { foreignKey: "faculty_id" });
Faculty.hasMany(FacultyAttendance, { foreignKey: "faculty_id" });

FacultyAttendance.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(FacultyAttendance, { foreignKey: "institute_id" });

FacultyAttendance.belongsTo(User, { as: "marker", foreignKey: "marked_by" });
User.hasMany(FacultyAttendance, { foreignKey: "marked_by" });

// Subscription Associations
Institute.hasMany(Subscription, { foreignKey: "institute_id" });
Subscription.belongsTo(Institute, { foreignKey: "institute_id" });
Coupon.hasMany(Subscription, { foreignKey: "coupon_id" });
Subscription.belongsTo(Coupon, { foreignKey: "coupon_id" });

AddOn.hasMany(InstituteAddOn, { foreignKey: "add_on_id" });
InstituteAddOn.belongsTo(AddOn, { foreignKey: "add_on_id" });

Institute.hasMany(InstituteAddOn, { foreignKey: "institute_id" });
InstituteAddOn.belongsTo(Institute, { foreignKey: "institute_id" });

Institute.hasMany(SubscriptionEvent, { foreignKey: "institute_id" });
SubscriptionEvent.belongsTo(Institute, { foreignKey: "institute_id" });

Subscription.hasMany(SubscriptionEvent, { foreignKey: "subscription_id" });
SubscriptionEvent.belongsTo(Subscription, { foreignKey: "subscription_id" });

Institute.hasMany(UsageTracker, { foreignKey: "institute_id" });
UsageTracker.belongsTo(Institute, { foreignKey: "institute_id" });

// ClassSession Associations
ClassSession.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(ClassSession, { foreignKey: "institute_id" });

ClassSession.belongsTo(Class, { foreignKey: "class_id" });
Class.hasMany(ClassSession, { foreignKey: "class_id" });

// Expense Associations
Institute.hasMany(Expense, { foreignKey: "institute_id" });
Expense.belongsTo(Institute, { foreignKey: "institute_id" });

Expense.belongsTo(User, { as: "creator", foreignKey: "created_by" });
User.hasMany(Expense, { foreignKey: "created_by" });

// TransportFee Associations
TransportFee.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(TransportFee, { foreignKey: "institute_id" });

TransportFee.belongsTo(User, { as: "creator", foreignKey: "created_by" });
User.hasMany(TransportFee, { foreignKey: "created_by" });

ClassSession.belongsTo(Subject, { foreignKey: "subject_id" });
Subject.hasMany(ClassSession, { foreignKey: "subject_id" });

ClassSession.belongsTo(User, { as: "faculty", foreignKey: "faculty_id" });
User.hasMany(ClassSession, { foreignKey: "faculty_id" });

// Timetable Associations
TimetableSlot.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(TimetableSlot, { foreignKey: "institute_id" });

TimetableSlot.belongsTo(Class, { foreignKey: "class_id" });
Class.hasMany(TimetableSlot, { foreignKey: "class_id" });

Timetable.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(Timetable, { foreignKey: "institute_id" });

Timetable.belongsTo(Class, { foreignKey: "class_id" });
Class.hasMany(Timetable, { foreignKey: "class_id" });

Timetable.belongsTo(Subject, { foreignKey: "subject_id" });
Subject.hasMany(Timetable, { foreignKey: "subject_id" });

Timetable.belongsTo(Faculty, { foreignKey: "faculty_id" });
Faculty.hasMany(Timetable, { foreignKey: "faculty_id" });

Timetable.belongsTo(TimetableSlot, { foreignKey: "slot_id" });
TimetableSlot.hasMany(Timetable, { foreignKey: "slot_id" });

Timetable.belongsTo(User, { as: "creator", foreignKey: "created_by" });
User.hasMany(Timetable, { foreignKey: "created_by" });

// Note Associations
Note.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(Note, { foreignKey: "institute_id" });

Note.belongsTo(Faculty, { foreignKey: "faculty_id" });
Faculty.hasMany(Note, { foreignKey: "faculty_id" });

Note.belongsTo(Class, { foreignKey: "class_id" });
Class.hasMany(Note, { foreignKey: "class_id" });

Note.belongsTo(Subject, { foreignKey: "subject_id" });
Subject.hasMany(Note, { foreignKey: "subject_id" });

NoteDownload.belongsTo(Note, { foreignKey: "note_id" });
Note.hasMany(NoteDownload, { foreignKey: "note_id" });

NoteDownload.belongsTo(Student, { foreignKey: "student_id" });
Student.hasMany(NoteDownload, { foreignKey: "student_id" });

// Chat Associations
ChatRoom.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(ChatRoom, { foreignKey: "institute_id" });

ChatRoom.belongsTo(Class, { foreignKey: "class_id" });
Class.hasMany(ChatRoom, { foreignKey: "class_id" });

ChatRoom.belongsTo(Subject, { foreignKey: "subject_id" });
Subject.hasMany(ChatRoom, { foreignKey: "subject_id" });

ChatRoom.belongsTo(Faculty, { foreignKey: "faculty_id" });
Faculty.hasMany(ChatRoom, { foreignKey: "faculty_id" });

ChatMessage.belongsTo(ChatRoom, { foreignKey: "room_id" });
ChatRoom.hasMany(ChatMessage, { foreignKey: "room_id" });

ChatMessage.belongsTo(User, { as: "sender", foreignKey: "sender_id" });
User.hasMany(ChatMessage, { foreignKey: "sender_id" });

ChatParticipant.belongsTo(ChatRoom, { foreignKey: "room_id" });
ChatRoom.hasMany(ChatParticipant, { foreignKey: "room_id" });

ChatParticipant.belongsTo(User, { foreignKey: "user_id" });
User.hasMany(ChatParticipant, { foreignKey: "user_id" });

// Biometric Associations
BiometricDevice.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(BiometricDevice, { foreignKey: "institute_id" });

BiometricEnrollment.belongsTo(BiometricDevice, { foreignKey: "device_id" });
BiometricDevice.hasMany(BiometricEnrollment, { foreignKey: "device_id" });

BiometricEnrollment.belongsTo(User, { foreignKey: "user_id" });
User.hasMany(BiometricEnrollment, { foreignKey: "user_id" });

BiometricEnrollment.belongsTo(User, { as: "enrolledBy", foreignKey: "enrolled_by" });

BiometricPunch.belongsTo(BiometricDevice, { foreignKey: "device_id" });
BiometricDevice.hasMany(BiometricPunch, { foreignKey: "device_id" });

BiometricSettings.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasOne(BiometricSettings, { foreignKey: "institute_id" });

// Assignment Associations
Assignment.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(Assignment, { foreignKey: "institute_id" });

Assignment.belongsTo(User, { as: "faculty", foreignKey: "faculty_id" });
User.hasMany(Assignment, { foreignKey: "faculty_id" });

Assignment.belongsTo(Class, { foreignKey: "class_id" });
Class.hasMany(Assignment, { foreignKey: "class_id" });

Assignment.belongsTo(Subject, { foreignKey: "subject_id" });
Subject.hasMany(Assignment, { foreignKey: "subject_id" });

// AssignmentSubmission Associations
AssignmentSubmission.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(AssignmentSubmission, { foreignKey: "institute_id" });

AssignmentSubmission.belongsTo(Assignment, { foreignKey: "assignment_id" });
Assignment.hasMany(AssignmentSubmission, { foreignKey: "assignment_id" });

AssignmentSubmission.belongsTo(Student, { foreignKey: "student_id" });
Student.hasMany(AssignmentSubmission, { foreignKey: "student_id" });

AssignmentSubmission.belongsTo(User, { as: "grader", foreignKey: "graded_by" });
User.hasMany(AssignmentSubmission, { foreignKey: "graded_by" });

// AssignmentSubmissionHistory Associations
AssignmentSubmissionHistory.belongsTo(AssignmentSubmission, { foreignKey: "submission_id" });
AssignmentSubmission.hasMany(AssignmentSubmissionHistory, { foreignKey: "submission_id" });

// AssignmentSetting Associations
AssignmentSetting.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasOne(AssignmentSetting, { foreignKey: "institute_id" });

// Public Web Page Associations
InstitutePublicProfile.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasOne(InstitutePublicProfile, { foreignKey: "institute_id" });

InstituteGalleryPhoto.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(InstituteGalleryPhoto, { foreignKey: "institute_id" });

InstituteReview.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(InstituteReview, { foreignKey: "institute_id" });

PublicEnquiry.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(PublicEnquiry, { foreignKey: "institute_id" });

// InstituteDiscount Associations
InstituteDiscount.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(InstituteDiscount, { foreignKey: "institute_id" });

InstituteDiscount.belongsTo(User, { as: "approver", foreignKey: "applied_by" });
User.hasMany(InstituteDiscount, { foreignKey: "applied_by" });

// RazorpayOrder Associations
RazorpayOrder.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(RazorpayOrder, { foreignKey: "institute_id" });

// RazorpayPayment Associations
RazorpayPayment.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(RazorpayPayment, { foreignKey: "institute_id" });

RazorpayPayment.belongsTo(RazorpayOrder, { foreignKey: "order_id" });
RazorpayOrder.hasOne(RazorpayPayment, { foreignKey: "order_id" });

// Invoice Associations
Invoice.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(Invoice, { foreignKey: "institute_id" });

Invoice.belongsTo(RazorpayPayment, { foreignKey: "payment_id" });
RazorpayPayment.hasOne(Invoice, { foreignKey: "payment_id" });

// StudentFeePayment Associations
StudentFeePayment.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(StudentFeePayment, { foreignKey: "institute_id" });

StudentFeePayment.belongsTo(StudentFee, { foreignKey: "student_fee_id" });
StudentFee.hasMany(StudentFeePayment, { foreignKey: "student_fee_id" });

StudentFeePayment.belongsTo(Student, { foreignKey: "student_id" });
Student.hasMany(StudentFeePayment, { foreignKey: "student_id" });

StudentFeePayment.belongsTo(User, { as: "collector", foreignKey: "collected_by" });
User.hasMany(StudentFeePayment, { foreignKey: "collected_by" });

// FacultySalary Associations
FacultySalary.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(FacultySalary, { foreignKey: "institute_id" });

FacultySalary.belongsTo(Faculty, { foreignKey: "faculty_id" });
Faculty.hasMany(FacultySalary, { foreignKey: "faculty_id" });

FacultySalary.belongsTo(User, { as: "paidBy", foreignKey: "paid_by" });
User.hasMany(FacultySalary, { foreignKey: "paid_by" });

// FacultySalary ↔ User direct association (for getAllSalaries JOIN)
FacultySalary.belongsTo(User, { as: "facultyUser", foreignKey: "faculty_id" });

// FacultySalarySettings Associations
FacultySalarySettings.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(FacultySalarySettings, { foreignKey: "institute_id" });

FacultySalarySettings.belongsTo(User, { as: "faculty", foreignKey: "faculty_id" });
User.hasMany(FacultySalarySettings, { foreignKey: "faculty_id" });

// Operational Monitoring Associations
AuditLog.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(AuditLog, { foreignKey: "institute_id" });

AuditLog.belongsTo(User, { foreignKey: "user_id" });
User.hasMany(AuditLog, { foreignKey: "user_id" });

SlowRequestLog.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(SlowRequestLog, { foreignKey: "institute_id" });

SlowRequestLog.belongsTo(User, { foreignKey: "user_id" });
User.hasMany(SlowRequestLog, { foreignKey: "user_id" });

// BulkImportLog Associations
BulkImportLog.belongsTo(Institute, { foreignKey: "institute_id" });
Institute.hasMany(BulkImportLog, { foreignKey: "institute_id" });

BulkImportLog.belongsTo(User, { as: "importer", foreignKey: "imported_by" });
User.hasMany(BulkImportLog, { foreignKey: "imported_by" });

// ✅ Phase 7: Refresh Token Associations
RefreshToken.belongsTo(User, { foreignKey: "user_id" });
User.hasMany(RefreshToken, { foreignKey: "user_id" });

module.exports = {
    sequelize,
    Plan,
    Institute,
    User,
    Class,
    Student,
    Faculty,
    Subject,
    Attendance,
    FeesStructure,
    Payment,
    Announcement,
    AnnouncementRead,
    Exam,
    Mark,
    Subscription,
    StudentSubject,
    StudentClass,
    ClassSession,
    Expense,
    TimetableSlot,
    Timetable,
    FacultyAttendance,
    TransportFee,
    StudentFee,
    FeeDiscountLog,
    Note,
    NoteDownload,
    ChatRoom,
    ChatMessage,
    ChatParticipant,
    StudentParent,
    BiometricDevice,
    BiometricEnrollment,
    BiometricPunch,
    BiometricSettings,
    Assignment,
    AssignmentSubmission,
    AssignmentSubmissionHistory,
    AssignmentSetting,
    // Public Web Page
    InstitutePublicProfile,
    InstituteGalleryPhoto,
    InstituteReview,
    PublicEnquiry,
    InstituteDiscount,
    Lead,
    RazorpayOrder,
    RazorpayPayment,
    Invoice,
    StudentFeePayment,
    OtpVerification,
    FacultySalary,
    FacultySalarySettings,
    LandingPageView,
    AuditLog,
    SlowRequestLog,
    BulkImportLog,
    RefreshToken,
    AddOn,
    InstituteAddOn,
    SubscriptionEvent,
    Coupon,
    UsageTracker,
};
