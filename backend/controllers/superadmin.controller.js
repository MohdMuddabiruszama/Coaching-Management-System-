const {
    sequelize,
    Institute, Subscription, Plan, Student, Faculty, User,
    Class, Subject, Attendance, FeesStructure, Payment, Announcement,
    Exam, Mark, ClassSession, Expense, Assignment, StudentParent,
    InstituteDiscount,
    // All models needed for cascade delete
    StudentFee, StudentFeePayment, AssignmentSubmission,
    ChatRoom, ChatMessage, ChatParticipant,
    Timetable, TimetableSlot,
    BiometricDevice, BiometricPunch, BiometricEnrollment,
    Note, NoteDownload,
    InstitutePublicProfile, InstituteGalleryPhoto, InstituteReview, PublicEnquiry,
    RazorpayOrder, RazorpayPayment, Invoice, FeeDiscountLog,
    FacultyAttendance, FacultySalary, AssignmentSetting,
    StudentClass, StudentSubject, TransportFee,
    BiometricSettings, AssignmentSubmissionHistory,
    SlowRequestLog, AuditLog, BulkImportLog, UsageTracker, InstituteAddOn, SubscriptionEvent,
    Lead
} = require("../models");
const { Op, fn, col, literal } = require("sequelize");

// ─────────────────────────────────────────────────────────────
// PHASE 1: ENHANCED DASHBOARD STATS
// ─────────────────────────────────────────────────────────────
exports.getDashboardStats = async (req, res) => {
    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // ✅ Phase A Bonus: Run all independent queries in parallel
        // Group 1: Core counts — 7 queries fired simultaneously
        const [
            totalInstitutes,
            activeInstitutes,
            expiredInstitutes,
            totalStudents,
            totalFaculty,
            totalManagers,
            totalParents,
        ] = await Promise.all([
            Institute.count(),
            Institute.count({ where: { status: "active" } }),
            Institute.count({ where: { status: "expired" } }),
            Student.count(),
            Faculty.count(),
            User.count({ where: { role: "manager" } }),
            User.count({ where: { role: "parent" } }),
        ]);

        // Group 2: Revenue + plan data — fired simultaneously
        const [revenueResult, monthRevenueResult, totalPlans, freePlan] = await Promise.all([
            Subscription.findAll({
                attributes: [[fn("SUM", col("amount_paid")), "total"]],
                where: { payment_status: "paid" }
            }),
            Subscription.findAll({
                attributes: [[fn("SUM", col("amount_paid")), "total"]],
                where: {
                    payment_status: "paid",
                    createdAt: { [Op.gte]: monthStart }
                }
            }),
            Plan.count({ where: { status: "active" } }),
            Plan.findOne({ where: { price: 0 } }),
        ]);

        const totalRevenue = parseFloat(revenueResult[0]?.dataValues?.total || 0);
        const monthlyRevenue = parseFloat(monthRevenueResult[0]?.dataValues?.total || 0);

        // Group 3: Derived queries (need freePlan result first)
        const { StudentFee, Subscription: SubModel, LandingPageView } = require("../models");
        const freePlanId = freePlan?.id;

        const [
            totalPrivateSchools,
            totalFreeTrialUsers,
            studentDiscountRes,
            subDiscountRes,
            totalLandingPageViews,
            totalLifetimeInstitutes,
            totalFoundingMembers,
            lifetimePlan,
            unreadEnquiriesCount,
        ] = await Promise.all([
            Institute.count({ where: { status: { [Op.in]: ["active", "expired"] } } }),
            freePlanId
                ? Subscription.count({ where: { plan_id: freePlanId } })
                : Promise.resolve(0),
            StudentFee.sum("discount_amount"),
            SubModel.sum("discount_amount"),
            LandingPageView.count(),
            Institute.count({ where: { is_lifetime_member: true } }),
            Institute.count({ where: { founding_member: true } }),
            Plan.findOne({ where: { is_lifetime: true } }),
            Lead.count({ where: { is_read: false } }),
        ]);

        const totalDiscount =
            parseFloat(studentDiscountRes || 0) + parseFloat(subDiscountRes || 0);

        res.json({
            totalInstitutes,
            activeInstitutes,
            expiredInstitutes,
            totalRevenue,
            monthlyRevenue,
            totalStudents,
            totalFaculty,
            totalManagers,
            totalParents,
            totalPlans,
            totalPrivateSchools,
            totalFreeTrialUsers,
            totalDiscount,
            totalLandingPageViews,
            unreadEnquiriesCount,
            // Lifetime stats
            lifetime: {
                total_lifetime_institutes: totalLifetimeInstitutes,
                founding_members: totalFoundingMembers,
                standard_lifetime: totalLifetimeInstitutes - totalFoundingMembers,
                slots_used: lifetimePlan?.lifetime_slots_used || 0,
                slots_total: lifetimePlan?.lifetime_slots_total || 100,
                slots_remaining:
                    (lifetimePlan?.lifetime_slots_total || 100) -
                    (lifetimePlan?.lifetime_slots_used || 0),
                total_lifetime_revenue:
                    totalFoundingMembers * 19999 +
                    (totalLifetimeInstitutes - totalFoundingMembers) * 24999,
            },
        });
    } catch (error) {
        console.error("getDashboardStats error:", error);
        res.status(500).json({ error: error.message });
    }
};


// ─────────────────────────────────────────────────────────────
// PHASE 2: ENHANCED ANALYTICS (with managers)
// ─────────────────────────────────────────────────────────────
exports.getAnalytics = async (req, res) => {
    try {
        // Monthly Revenue (by month of subscription creation) — PostgreSQL compatible
        const monthlyRevenue = await Subscription.findAll({
            attributes: [
                [literal("EXTRACT(MONTH FROM created_at)"), "month"],
                [literal("EXTRACT(YEAR FROM created_at)"), "year"],
                [fn("SUM", col("amount_paid")), "totalRevenue"]
            ],
            where: { payment_status: "paid" },
            group: [literal("EXTRACT(YEAR FROM created_at)"), literal("EXTRACT(MONTH FROM created_at)")],
            order: [[literal("EXTRACT(YEAR FROM created_at)"), "ASC"], [literal("EXTRACT(MONTH FROM created_at)"), "ASC"]],
            limit: 12
        });

        // Plan Distribution
        const planDistribution = await Subscription.findAll({
            attributes: [
                "plan_id",
                [fn("COUNT", col("Subscription.plan_id")), "count"]
            ],
            include: [{ model: Plan, attributes: ["name"] }],
            group: ["plan_id", "Plan.id", "Plan.name"]
        });

        // Active vs Expired Institutes
        const activeCount = await Institute.count({ where: { status: "active" } });
        const expiredCount = await Institute.count({ where: { status: "expired" } });
        const suspendedCount = await Institute.count({ where: { status: "suspended" } });

        // User Demographics: Students, Faculty, Managers, Parents, Admins
        const totalStudents = await Student.count();
        const totalFaculty = await Faculty.count();
        const totalManagers = await User.count({ where: { role: "manager" } });
        const totalParents = await User.count({ where: { role: "parent" } });
        const totalAdmins = await User.count({ where: { role: "admin" } });

        res.json({
            monthlyRevenue,
            planDistribution,
            instituteStatus: {
                active: activeCount,
                expired: expiredCount,
                suspended: suspendedCount
            },
            userDemographics: {
                students: totalStudents,
                faculty: totalFaculty,
                managers: totalManagers,
                parents: totalParents,
                admins: totalAdmins
            }
        });
    } catch (error) {
        console.error("getAnalytics error:", error);
        res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────
// EXISTING: getAllInstitutes (basic list with Plan)
// ─────────────────────────────────────────────────────────────
exports.getAllInstitutes = async (req, res) => {
    try {
        const institutes = await Institute.findAll({
            include: [{ model: Plan }],
            order: [["createdAt", "DESC"]]
        });
        res.json(institutes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────
// PHASE 3: GET SINGLE INSTITUTE FULL DETAILS
// ─────────────────────────────────────────────────────────────
exports.getInstituteDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const institute = await Institute.findByPk(id, {
            include: [{ model: Plan }]
        });
        if (!institute) return res.status(404).json({ error: "Institute not found" });

        // Get all counts in parallel
        const [
            totalStudents,
            totalFaculty,
            totalManagers,
            totalClasses,
            totalSubjects,
            totalAssignments,
            totalParents,
            latestSubscription,
            discounts
        ] = await Promise.all([
            Student.count({ where: { institute_id: id } }),
            Faculty.count({ where: { institute_id: id } }),
            User.count({ where: { institute_id: id, role: "manager" } }),
            Class.count({ where: { institute_id: id } }),
            Subject.count({ where: { institute_id: id } }),
            Assignment.count({ where: { institute_id: id } }),
            // Parents are users linked to students in this institute via StudentParent
            User.count({
                where: { role: "parent" },
                include: [{
                    model: Student,
                    as: "LinkedStudents",
                    where: { institute_id: id },
                    required: true,
                    through: { attributes: [] }
                }]
            }).catch(() => 0),
            Subscription.findOne({
                where: { institute_id: id },
                order: [["createdAt", "DESC"]],
                include: [{ model: Plan }]
            }),
            InstituteDiscount.findAll({
                where: { institute_id: id },
                order: [["createdAt", "DESC"]],
                include: [{ model: User, as: "approver", attributes: ["name"] }]
            })
        ]);

        // Count enabled features in current institute config
        const featureFields = [
            'current_feature_attendance',
            'current_feature_auto_attendance',
            'current_feature_fees',
            'current_feature_finance',
            'current_feature_salary',
            'current_feature_reports',
            'current_feature_announcements',
            'current_feature_export',
            'current_feature_timetable',
            'current_feature_whatsapp',
            'current_feature_custom_branding',
            'current_feature_multi_branch',
            'current_feature_api_access',
            'current_feature_public_page',
            'current_feature_assignment',
            'current_feature_transport',
            'current_feature_mobile_app'
        ];

        let totalFeatures = 0;
        featureFields.forEach(field => {
            const val = institute[field];
            if (val && val !== 'none' && val !== false) totalFeatures++;
        });

        res.json({
            institute,
            stats: {
                totalStudents,
                totalFaculty,
                totalManagers,
                totalClasses,
                totalSubjects,
                totalAssignments,
                totalParents,
                totalFeatures
            },
            latestSubscription,
            discounts: discounts || []
        });
    } catch (error) {
        console.error("getInstituteDetails error:", error);
        res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────
// PHASE 3: UPDATE INSTITUTE LIMITS & FEATURES (custom override)
// Only affects institute's current_* fields, NOT the plan itself
// ─────────────────────────────────────────────────────────────
exports.updateInstituteLimits = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            // Limits
            current_limit_students,
            current_limit_faculty,
            current_limit_classes,
            current_limit_admins,
            current_limit_chat_messages,
            // Feature overrides
            current_feature_attendance,
            current_feature_auto_attendance,
            current_feature_fees,
            current_feature_finance,
            current_feature_expenses,
            current_feature_salary,
            current_feature_reports,
            current_feature_announcements,
            current_feature_export,
            current_feature_timetable,
            current_feature_whatsapp,
            current_feature_custom_branding,
            current_feature_multi_branch,
            current_feature_api_access,
            current_feature_public_page,
            current_feature_assignment,
            current_feature_performance_hub,
            current_feature_transport,
            current_feature_mobile_app,
            current_feature_chat
        } = req.body;

        const { Plan } = require("../models");
        const institute = await Institute.findByPk(id, { include: [{ model: Plan }] });
        if (!institute) return res.status(404).json({ error: "Institute not found" });

        const updates = {};
        if (current_limit_students !== undefined) updates.current_limit_students = parseInt(current_limit_students);
        if (current_limit_faculty !== undefined) updates.current_limit_faculty = parseInt(current_limit_faculty);
        if (current_limit_classes !== undefined) updates.current_limit_classes = parseInt(current_limit_classes);
        if (current_limit_admins !== undefined) updates.current_limit_admins = parseInt(current_limit_admins);
        if (current_limit_chat_messages !== undefined) updates.current_limit_chat_messages = parseInt(current_limit_chat_messages);
        if (current_feature_attendance !== undefined) updates.current_feature_attendance = current_feature_attendance;
        if (current_feature_auto_attendance !== undefined) updates.current_feature_auto_attendance = !!current_feature_auto_attendance;
        if (current_feature_fees !== undefined) updates.current_feature_fees = !!current_feature_fees;
        if (current_feature_finance !== undefined) updates.current_feature_finance = !!current_feature_finance;
        if (current_feature_expenses !== undefined) updates.current_feature_expenses = !!current_feature_expenses;
        if (current_feature_salary !== undefined) updates.current_feature_salary = !!current_feature_salary;
        if (current_feature_reports !== undefined) updates.current_feature_reports = current_feature_reports;
        if (current_feature_announcements !== undefined) updates.current_feature_announcements = !!current_feature_announcements;
        if (current_feature_export !== undefined) updates.current_feature_export = !!current_feature_export;
        if (current_feature_timetable !== undefined) updates.current_feature_timetable = !!current_feature_timetable;
        if (current_feature_whatsapp !== undefined) updates.current_feature_whatsapp = !!current_feature_whatsapp;
        if (current_feature_custom_branding !== undefined) updates.current_feature_custom_branding = !!current_feature_custom_branding;
        if (current_feature_multi_branch !== undefined) updates.current_feature_multi_branch = !!current_feature_multi_branch;
        if (current_feature_api_access !== undefined) updates.current_feature_api_access = !!current_feature_api_access;
        if (current_feature_public_page !== undefined) updates.current_feature_public_page = !!current_feature_public_page;
        if (current_feature_assignment !== undefined) updates.current_feature_assignment = !!current_feature_assignment;
        if (current_feature_performance_hub !== undefined) updates.current_feature_performance_hub = !!current_feature_performance_hub;
        if (current_feature_transport !== undefined) updates.current_feature_transport = !!current_feature_transport;
        if (current_feature_mobile_app !== undefined) updates.current_feature_mobile_app = !!current_feature_mobile_app;
        if (current_feature_chat !== undefined) updates.current_feature_chat = !!current_feature_chat;

        // Add 1-month expiration for manually unlocked Add-on features
        let expiries = {};
        try {
             expiries = (typeof institute.add_on_expiries === 'string' ? JSON.parse(institute.add_on_expiries) : institute.add_on_expiries) || {};
        } catch(e) {}
        
        const booleanFeatures = [
            'current_feature_auto_attendance', 'current_feature_fees', 'current_feature_finance', 'current_feature_expenses',
            'current_feature_salary', 'current_feature_announcements', 'current_feature_export',
            'current_feature_timetable', 'current_feature_whatsapp', 'current_feature_custom_branding',
            'current_feature_multi_branch', 'current_feature_api_access', 'current_feature_public_page',
            'current_feature_assignment', 'current_feature_performance_hub', 'current_feature_transport', 'current_feature_mobile_app', 'current_feature_chat'
        ];

        booleanFeatures.forEach(feature => {
            if (updates[feature] === true) {
                const basePlanFeature = feature.replace('current_', '');
                // If it's NOT in the base plan, lock it after 1 month automatically
                if (institute.Plan && !institute.Plan[basePlanFeature]) {
                    if (!expiries[feature]) {
                        const startDate = new Date();
                        const expiryDate = new Date();
                        expiryDate.setMonth(expiryDate.getMonth() + 1);
                        expiries[feature] = {
                            start: startDate.toISOString(),
                            end: expiryDate.toISOString()
                        };
                    }
                }
            } else if (updates[feature] === false) {
                delete expiries[feature];
            }
        });
        updates.add_on_expiries = expiries;

        await institute.update(updates);

        res.json({ success: true, message: "Institute limits & features updated successfully", institute });
    } catch (error) {
        console.error("updateInstituteLimits error:", error);
        res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────
// EXISTING: updateInstituteStatus
// ─────────────────────────────────────────────────────────────
const { clearInstituteCache } = require("../middlewares/auth.middleware");

exports.updateInstituteStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        await Institute.update({ status }, { where: { id } });
        
        // Immediately invalidate cache so suspended institutes are blocked in real-time
        clearInstituteCache(parseInt(id, 10));
        
        res.json({ message: "Institute status updated" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────
// deleteInstitute — Full Transactional Cascade Delete
// Manually deletes all child records in correct FK order.
// Does NOT rely on DB-level CASCADE (which is not guaranteed in Sequelize).
// ─────────────────────────────────────────────────────────────
exports.deleteInstitute = async (req, res) => {
    const { id } = req.params;

    // ── Step 1: Verify institute exists ──────────────────────────────
    const institute = await Institute.findByPk(id);
    if (!institute) {
        return res.status(404).json({ success: false, message: 'Institute not found' });
    }

    // ── Step 2: Active subscription guard ────────────────────────────
    const activeSubscription = await Subscription.findOne({
        where: {
            institute_id: id,
            payment_status: 'paid',
            end_date: { [Op.gte]: new Date() }
        }
    });

    if (activeSubscription && req.body.force !== true) {
        return res.status(409).json({
            success: false,
            message: 'Institute has an active paid subscription. Check "Force Delete" to confirm.',
            data: {
                subscription_end: activeSubscription.end_date,
                amount_paid: activeSubscription.amount_paid
            }
        });
    }

    // ── Step 3: Collect summary stats before deletion ─────────────────
    const [studentCount, facultyCount, classCount] = await Promise.all([
        Student.count({ where: { institute_id: id } }),
        Faculty.count({ where: { institute_id: id } }),
        Class.count({ where: { institute_id: id } })
    ]);

    console.log(`[SUPER ADMIN DELETE] Starting cascade delete for Institute: ${institute.name} (ID: ${id})`, {
        deleted_by: req.user.id,
        deleted_at: new Date().toISOString(),
        student_count: studentCount,
        faculty_count: facultyCount,
        institute_email: institute.email,
    });

    // ── Step 4: Run full cascade delete inside a transaction ──────────
    // Order matters: Delete leaf nodes first, then parent nodes.
    const t = await sequelize.transaction();
    try {

        // ── Tier 1: Deep leaf nodes (no children) ────────────────────
        // Assignment submission history (child of AssignmentSubmission)
        await AssignmentSubmissionHistory.destroy({
            where: {},
            include: [{ model: AssignmentSubmission, where: { institute_id: id }, required: true }],
            transaction: t
        }).catch(async () => {
            // Fallback: find submission IDs first, then delete history
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

        // Note downloads (child of Note)
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

        // Invoice (child of RazorpayPayment)
        await Invoice.destroy({
            where: { institute_id: id },
            transaction: t
        });

        // Fee Discount Logs (child of StudentFee)
        await FeeDiscountLog.destroy({
            where: { institute_id: id },
            transaction: t
        });

        // Biometric Punches & Enrollments (children of BiometricDevice)
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

        // Chat Messages & Participants (children of ChatRoom)
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

        // Assignment Submissions (child of Assignment)
        await AssignmentSubmission.destroy({ where: { institute_id: id }, transaction: t });

        // Marks (child of Exam/Student)
        await Mark.destroy({ where: { institute_id: id }, transaction: t });

        // ── Tier 2: Direct institute children with sub-children ───────
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

        // ── Tier 3: Junction tables & direct student/faculty relations ─
        // StudentClass and StudentSubject have institute_id — use it directly
        await StudentClass.destroy({ where: { institute_id: id }, transaction: t });
        await StudentSubject.destroy({ where: { institute_id: id }, transaction: t });

        // StudentParent uses student_id — resolve via students list
        const students = await Student.findAll({
            where: { institute_id: id },
            attributes: ['id'],
            transaction: t
        });
        const studentIds = students.map(s => s.id);
        if (studentIds.length > 0) {
            await StudentParent.destroy({ where: { student_id: { [Op.in]: studentIds } }, transaction: t });
        }

        // FeesStructure (parent of Payment/StudentFee — already deleted above)
        await FeesStructure.destroy({ where: { institute_id: id }, transaction: t });

        // Subjects (parent of Attendance, Exams, etc. — already deleted)
        await Subject.destroy({ where: { institute_id: id }, transaction: t });

        // ── Tier 4: Students & Faculty ────────────────────────────────
        await Student.destroy({ where: { institute_id: id }, transaction: t });
        await Faculty.destroy({ where: { institute_id: id }, transaction: t });

        // ── Tier 5: Classes ───────────────────────────────────────────
        await Class.destroy({ where: { institute_id: id }, transaction: t });

        // ── Tier 6: Users (admin, managers, parents for this institute) ─
        // Note: parent users (role = 'parent') linked via StudentParent
        // are NOT deleted to preserve their accounts (they may be linked elsewhere).
        // Only users directly belonging to this institute (admin, manager, faculty, student) are removed.
        
        // Logs and trackers that may reference users
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

        // ── Tier 7: Public page & institute-level data ────────────────
        await InstitutePublicProfile.destroy({ where: { institute_id: id }, transaction: t });
        await InstituteGalleryPhoto.destroy({ where: { institute_id: id }, transaction: t });
        await InstituteReview.destroy({ where: { institute_id: id }, transaction: t });
        await PublicEnquiry.destroy({ where: { institute_id: id }, transaction: t });
        await InstituteDiscount.destroy({ where: { institute_id: id }, transaction: t });

        // ── Tier 8: Subscriptions ─────────────────────────────────────
        await Subscription.destroy({ where: { institute_id: id }, transaction: t });

        // ── Tier 9: Finally delete the Institute record ───────────────
        await institute.destroy({ transaction: t });

        // ── Commit ────────────────────────────────────────────────────
        await t.commit();

        console.log(`[SUPER ADMIN DELETE] ✅ Institute '${institute.name}' (ID: ${id}) fully deleted.`);

        res.status(200).json({
            success: true,
            message: `Institute '${institute.name}' and all associated data have been permanently deleted.`,
            data: {
                deleted_institute: institute.name,
                students_deleted: studentCount,
                faculty_deleted: facultyCount,
                classes_deleted: classCount
            }
        });

    } catch (error) {
        await t.rollback();
        console.error('[DELETE INSTITUTE ERROR] Transaction rolled back:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete institute. All changes have been rolled back.',
            error: error.message
        });
    }
};

// ─────────────────────────────────────────────────────────────
// PHASE 3: SUSPEND / RESTORE INSTITUTE
// ─────────────────────────────────────────────────────────────
exports.suspendInstitute = async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    try {
        const institute = await Institute.findByPk(id);
        if (!institute) {
            return res.status(404).json({ success: false, message: 'Institute not found' });
        }

        if (institute.status === 'suspended') {
            return res.status(409).json({
                success: false,
                message: 'Institute is already suspended'
            });
        }

        // Update institute status to suspended
        await institute.update({ status: 'suspended' });

        // Clear cache so it takes effect instantly
        const { clearInstituteCache } = require("../middlewares/auth.middleware");
        if (typeof clearInstituteCache === "function") clearInstituteCache(parseInt(id, 10));

        // Log the action
        console.log(`[SUSPEND] Institute: ${institute.name} (ID: ${id})`, {
            suspended_by: req.user.id,
            suspended_at: new Date().toISOString(),
            reason: reason || 'No reason provided'
        });

        res.status(200).json({
            success: true,
            message: `Institute '${institute.name}' suspended successfully.`,
            data: { id: institute.id, name: institute.name, status: 'suspended' }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.restoreInstitute = async (req, res) => {
    const { id } = req.params;

    try {
        const institute = await Institute.findByPk(id);
        if (!institute) {
            return res.status(404).json({ success: false, message: 'Institute not found' });
        }

        if (institute.status !== 'suspended') {
            return res.status(409).json({
                success: false,
                message: 'Institute is not suspended'
            });
        }

        await institute.update({ status: 'active' });

        // Clear cache so it takes effect instantly
        const { clearInstituteCache } = require("../middlewares/auth.middleware");
        if (typeof clearInstituteCache === "function") clearInstituteCache(parseInt(id, 10));

        res.status(200).json({
            success: true,
            message: `Institute '${institute.name}' restored successfully.`,
            data: { id: institute.id, name: institute.name, status: 'active' }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────
// EXISTING: upgradePlan
// ─────────────────────────────────────────────────────────────
exports.upgradePlan = async (req, res) => {
    try {
        const { instituteId } = req.params;
        const { newPlanId, durationMonths } = req.body;

        const institute = await Institute.findByPk(instituteId);
        if (!institute) return res.status(404).json({ error: "Institute not found" });

        const newPlan = await Plan.findByPk(newPlanId);
        if (!newPlan) return res.status(404).json({ error: "Plan not found" });

        const startDate = new Date();
        const endDate = new Date();
        // If it's a lifetime plan, we don't really have an end date, but we can set it far in the future
        // or just let it be ignored since lifetime institutes never expire.
        endDate.setMonth(endDate.getMonth() + (newPlan.is_lifetime ? 1200 : durationMonths));

        // Check for active discounts for this institute
        const activeDiscount = await InstituteDiscount.findOne({
            where: { institute_id: instituteId, status: "active" },
            order: [["createdAt", "DESC"]]
        });

        let finalAmount = parseFloat(newPlan.price);
        let discountAmount = 0;

        if (activeDiscount) {
            if (activeDiscount.discount_type === "fixed") {
                discountAmount = parseFloat(activeDiscount.discount_value);
            } else {
                discountAmount = (finalAmount * parseFloat(activeDiscount.discount_value)) / 100;
            }
            finalAmount = Math.max(0, finalAmount - discountAmount);
        }

        const subscription = await Subscription.create({
            institute_id: instituteId,
            plan_id: newPlanId,
            start_date: startDate,
            end_date: endDate,
            payment_status: "paid",
            amount_paid: finalAmount,
            discount_amount: discountAmount
        });

        // Mark discount as used
        if (activeDiscount) {
            await activeDiscount.update({ status: "used" });
        }

        await institute.update({
            plan_id: newPlanId,
            subscription_start: startDate,
            subscription_end: endDate,
            status: "active",
            // Sync limits from new plan
            current_limit_students: newPlan.max_students,
            current_limit_faculty: newPlan.max_faculty,
            current_limit_classes: newPlan.max_classes,
            current_limit_admins: newPlan.max_admin_users,
            current_feature_attendance: newPlan.feature_attendance,
            current_feature_auto_attendance: newPlan.feature_auto_attendance,
            current_feature_fees: newPlan.feature_fees,
            current_feature_finance: newPlan.feature_finance,
            current_feature_salary: newPlan.feature_salary,
            current_feature_reports: newPlan.feature_reports,
            current_feature_announcements: newPlan.feature_announcements,
            current_feature_export: newPlan.feature_export,
            current_feature_timetable: newPlan.feature_timetable,
            current_feature_whatsapp: newPlan.feature_whatsapp,
            current_feature_custom_branding: newPlan.feature_custom_branding,
            current_feature_multi_branch: newPlan.feature_multi_branch,
            current_feature_api_access: newPlan.feature_api_access,
            current_feature_public_page: newPlan.feature_public_page,
            current_feature_assignment: newPlan.feature_assignment || false,
            current_feature_performance_hub: newPlan.feature_performance_hub || false,
            current_feature_transport: newPlan.feature_transport || false,
            current_limit_chat_messages: newPlan.max_chat_messages || 500,
            
            // Sync lifetime flags
            is_lifetime_member: newPlan.is_lifetime || false,
            lifetime_purchased_at: newPlan.is_lifetime ? startDate : null,
            lifetime_plan_id: newPlan.is_lifetime ? newPlanId : null
        });

        // If it was a lifetime plan, increment the slots
        if (newPlan.is_lifetime) {
            await newPlan.increment('lifetime_slots_used');
        }

        res.json({
            message: "Plan upgraded successfully",
            newPlan: newPlan.name,
            validTill: endDate
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────
// PHASE 4: INSTITUTE DISCOUNTS (Superadmin giving discount to Institute)
// ─────────────────────────────────────────────────────────────
exports.applyInstituteDiscount = async (req, res) => {
    try {
        const { id } = req.params;
        const { discount_type, discount_value, reason } = req.body;

        if (!discount_value || isNaN(discount_value)) {
            return res.status(400).json({ error: "Valid discount value is required" });
        }

        const { InstituteDiscount } = require("../models");
        const discount = await InstituteDiscount.create({
            institute_id: id,
            discount_type: discount_type || "fixed",
            discount_value: parseFloat(discount_value),
            reason,
            applied_by: req.user.id,
            status: "active"
        });

        res.json({ success: true, message: "Discount applied successfully", discount });
    } catch (error) {
        console.error("applyInstituteDiscount error:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.deleteInstituteDiscount = async (req, res) => {
    try {
        const { id, discountId } = req.params;
        const { InstituteDiscount } = require("../models");
        await InstituteDiscount.destroy({ where: { id: discountId, institute_id: id } });
        res.json({ message: "Discount deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};