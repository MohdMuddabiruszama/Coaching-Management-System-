const {
    sequelize,
    Institute, Subscription, Plan, Student, Faculty, User,
    Class, Subject, Attendance, FeesStructure, Payment, Announcement,
    Exam, Mark, ClassSession, Expense, Assignment, StudentParent,
    InstituteDiscount,
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
    Lead, RefreshToken, DeviceToken, Notification, NotificationPref, AnnouncementRead
} = require("../models");
const { Op, fn, col, literal, Sequelize } = require("sequelize");
const emailService = require("../services/email.service");
const invoiceService = require("../services/invoice.service");
const NodeCache = require('node-cache');
const fs = require('fs');
const path = require('path');

const SETTINGS_FILE_PATH = path.join(__dirname, '../config/systemSettings.json');

// TTL 30 min, checkperiod 60s
const analyticsCache = new NodeCache({ stdTTL: 1800, checkperiod: 60 });
const CACHE_KEY = 'superadmin:analytics';


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
                where: { payment_status: "paid", is_test: false }
            }),
            Subscription.findAll({
                attributes: [[fn("SUM", col("amount_paid")), "total"]],
                where: {
                    payment_status: "paid",
                    is_test: false,
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
    const { startDate, endDate, trendType = 'monthly' } = req.query;
    
    // 1. Determine Current Period Boundaries
    let currentStart = new Date();
    currentStart.setMonth(currentStart.getMonth() - 12);
    currentStart.setDate(1);
    currentStart.setHours(0, 0, 0, 0);
    
    let currentEnd = new Date();
    
    if (startDate && endDate) {
      currentStart = new Date(startDate);
      currentEnd = new Date(endDate);
      currentEnd.setHours(23, 59, 59, 999);
    }
    
    // 2. Determine Previous Period Boundaries
    const durationMs = currentEnd.getTime() - currentStart.getTime();
    const previousStart = new Date(currentStart.getTime() - durationMs);
    const previousEnd = new Date(currentEnd.getTime() - durationMs);
    
    // 3. Dynamic Cache Key
    const cacheKey = `analytics_${currentStart.toISOString().split('T')[0]}_${currentEnd.toISOString().split('T')[0]}_${trendType}`;
    const cached = analyticsCache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }
  
    // 4. Concurrent Queries
    const [
      monthlyRevenueRaw, 
      planDistributionRaw,
      currentAggregates,
      previousAggregates,
      activeCount,
      expiredCount,
      suspendedCount,
      totalStudents,
      totalFaculty,
      totalManagers,
      totalParents,
      totalAdmins
    ] = await Promise.all([
      // Monthly Revenue Trend (Current Period)
      Subscription.findAll({
        attributes: [
          [Sequelize.fn('EXTRACT', Sequelize.literal(trendType === 'weekly' ? 'WEEK FROM "created_at"' : 'MONTH FROM "created_at"')), 'period'],
          [Sequelize.fn('EXTRACT', Sequelize.literal('YEAR FROM "created_at"')), 'year'],
          [Sequelize.fn('SUM', Sequelize.col('amount_paid')), 'totalRevenue'],
        ],
        where: {
          payment_status: "paid",
          is_test: false,
          createdAt: { [Op.between]: [currentStart, currentEnd] },
        },
        group: [
          Sequelize.literal('EXTRACT(YEAR FROM "created_at")'),
          Sequelize.literal(`EXTRACT(${trendType === 'weekly' ? 'WEEK' : 'MONTH'} FROM "created_at")`),
        ],
        order: [
          [Sequelize.literal('EXTRACT(YEAR FROM "created_at")'), 'ASC'],
          [Sequelize.literal(`EXTRACT(${trendType === 'weekly' ? 'WEEK' : 'MONTH'} FROM "created_at")`), 'ASC'],
        ],
        raw: true,
      }),
      
      // Plan Distribution (Current Period)
      Subscription.findAll({
        attributes: [
          'plan_id',
          [Sequelize.fn('COUNT', Sequelize.col('Subscription.id')), 'count'],
          [Sequelize.fn('SUM', Sequelize.col('amount_paid')), 'revenue'],
        ],
        include: [{ model: Plan, attributes: ["name"] }],
        where: {
          is_test: false,
          payment_status: "paid",
          createdAt: { [Op.between]: [currentStart, currentEnd] },
        },
        group: ['plan_id', 'Plan.id', 'Plan.name'],
        raw: true,
      }),
      
      // Current Period Metrics (Revenue, Discounts, Subscriptions)
      Subscription.findAll({
        attributes: [
          [Sequelize.fn('SUM', Sequelize.col('amount_paid')), 'totalRevenue'],
          [Sequelize.fn('SUM', Sequelize.col('discount_amount')), 'totalDiscounts'],
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'totalSubscriptions'],
          [Sequelize.fn('SUM', Sequelize.literal(`CASE WHEN status = 'active' THEN 1 ELSE 0 END`)), 'activeSubscriptions']
        ],
        where: {
          payment_status: "paid",
          is_test: false,
          createdAt: { [Op.between]: [currentStart, currentEnd] }
        },
        raw: true
      }),
      
      // Previous Period Metrics (Revenue, Discounts, Subscriptions)
      Subscription.findAll({
        attributes: [
          [Sequelize.fn('SUM', Sequelize.col('amount_paid')), 'totalRevenue'],
          [Sequelize.fn('SUM', Sequelize.col('discount_amount')), 'totalDiscounts'],
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'totalSubscriptions'],
          [Sequelize.fn('SUM', Sequelize.literal(`CASE WHEN status = 'active' THEN 1 ELSE 0 END`)), 'activeSubscriptions']
        ],
        where: {
          payment_status: "paid",
          is_test: false,
          createdAt: { [Op.between]: [previousStart, previousEnd] }
        },
        raw: true
      }),

      Institute.count({ where: { status: "active" } }),
      Institute.count({ where: { status: "expired" } }),
      Institute.count({ where: { status: "suspended" } }),
      Student.count(),
      Faculty.count(),
      User.count({ where: { role: "manager" } }),
      User.count({ where: { role: "parent" } }),
      User.count({ where: { role: "admin" } })
    ]);
 
    const payload = {
      monthlyRevenue: monthlyRevenueRaw,
      planDistribution: planDistributionRaw,
      currentPeriod: currentAggregates[0],
      previousPeriod: previousAggregates[0],
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
      },
      dateRange: { currentStart, currentEnd, previousStart, previousEnd },
      generatedAt: new Date().toISOString(),
    };
 
    analyticsCache.set(cacheKey, payload);
    return res.json({ ...payload, cached: false });
  } catch (err) {
    console.error('getAnalytics error:', err);
    return res.status(500).json({ message: 'Failed to load analytics' });
  }
};

// Export so any write path (webhook, admin create/update) can bust it
exports.bustAnalyticsCache = () => {
  analyticsCache.flushAll();
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
            discounts,
            totalExams,
            totalNotes,
            storageTracker,
            activeSessions
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
            }),
            Exam.count({ where: { institute_id: id } }),
            Note.count({ where: { institute_id: id } }),
            UsageTracker.findOne({ where: { institute_id: id, metric: "storage_mb" } }),
            RefreshToken.findAll({
                where: {
                    is_revoked: false,
                    expires_at: { [Op.gt]: new Date() }
                },
                include: [{
                    model: User,
                    where: { institute_id: id, role: 'admin' },
                    attributes: ['id', 'name', 'email']
                }],
                order: [['created_at', 'DESC']]
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
                totalFeatures,
                totalExams,
                totalNotes,
                storageUsed: storageTracker ? storageTracker.current_value : 0
            },
            latestSubscription,
            discounts: discounts || [],
            activeSessions: activeSessions || []
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
            current_limit_managers,
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
            current_feature_chat,
            // Override Expiration
            overrides_expire_at
        } = req.body;

        const { Plan } = require("../models");
        const institute = await Institute.findByPk(id, { include: [{ model: Plan }] });
        if (!institute) return res.status(404).json({ error: "Institute not found" });

        const updates = {};
        if (current_limit_students !== undefined) updates.current_limit_students = parseInt(current_limit_students);
        if (current_limit_faculty !== undefined) updates.current_limit_faculty = parseInt(current_limit_faculty);
        if (current_limit_classes !== undefined) updates.current_limit_classes = parseInt(current_limit_classes);
        if (current_limit_admins !== undefined) updates.current_limit_admins = parseInt(current_limit_admins);
        if (current_limit_managers !== undefined) updates.current_limit_managers = parseInt(current_limit_managers);
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

        // ── Tier 6: Users (admin, managers, faculty, student for this institute) ─
        // We must first delete any dependent records (tokens, notifications) 
        // to prevent Foreign Key constraint violations before deleting the Users.
        const users = await User.findAll({
            where: {
                institute_id: id,
                role: { [Op.in]: ['admin', 'manager', 'faculty', 'student'] }
            },
            attributes: ['id'],
            transaction: t
        });

        const userIds = users.map(u => u.id);

        if (userIds.length > 0) {
            await RefreshToken.destroy({ where: { user_id: { [Op.in]: userIds } }, transaction: t });
            await DeviceToken.destroy({ where: { user_id: { [Op.in]: userIds } }, transaction: t });
            await Notification.destroy({ where: { user_id: { [Op.in]: userIds } }, transaction: t });
            await NotificationPref.destroy({ where: { user_id: { [Op.in]: userIds } }, transaction: t });
            await AnnouncementRead.destroy({ where: { user_id: { [Op.in]: userIds } }, transaction: t });

            await User.destroy({ where: { id: { [Op.in]: userIds } }, transaction: t });
        }

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
            current_feature_expenses: newPlan.feature_expenses || false,
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
            current_feature_mobile_app: newPlan.feature_mobile_app || false,
            current_feature_chat: newPlan.feature_chat || false,
            current_feature_push_notifications: newPlan.feature_push_notifications || false,
            current_feature_offline_attendance: newPlan.feature_offline_attendance || false,
            current_feature_parent_app: newPlan.feature_parent_app || false,
            current_feature_student_app: newPlan.feature_student_app || false,
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

// ─── Phase 3: DB Safety Architecture — Archive & Restore Endpoints ──────────

const { auditLog } = require('../utils/audit');

exports.archiveStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'archived', 'graduated'
        const { Student } = require("../models");

        const student = await Student.findByPk(id);
        if (!student) return res.status(404).json({ error: "Student not found" });

        const oldData = student.toJSON();
        student.student_status = status || 'archived';
        await student.save();

        // Log the archive action
        await auditLog({
            req,
            action: `student.archive`,
            entity_type: 'Student',
            entity_id: student.id,
            old_value: oldData,
            new_value: student.toJSON(),
            remarks: `Student marked as ${student.student_status} by SuperAdmin`
        });

        res.json({ success: true, message: `Student successfully marked as ${student.student_status}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getArchivedStudents = async (req, res) => {
    try {
        const { Student, User, Institute } = require("../models");
        const { Op } = require("sequelize");

        const students = await Student.findAll({
            where: {
                student_status: { [Op.in]: ['archived', 'graduated'] }
            },
            include: [
                { model: User, as: "user", attributes: ["name", "email", "phone"] },
                { model: Institute, as: "institute", attributes: ["name"] }
            ],
            // Also include students who were soft deleted
            paranoid: false
        });

        res.json({ success: true, data: students });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.restoreDeletedData = async (req, res) => {
    try {
        const { table, id } = req.params;
        const models = require("../models");
        
        // Map table name param to Sequelize Model name
        const modelMap = {
            'students': 'Student',
            'users': 'User',
            'institutes': 'Institute',
            'classes': 'Class',
            'subjects': 'Subject',
            'fees': 'FeesStructure',
            'attendances': 'Attendance',
            'marks': 'Mark',
            'faculty_salaries': 'FacultySalary',
        };

        const modelName = modelMap[table];
        if (!modelName || !models[modelName]) {
            return res.status(400).json({ error: "Invalid table or model not found for recovery" });
        }

        const Model = models[modelName];
        
        // Verify it was actually deleted
        const record = await Model.findOne({
            where: { id },
            paranoid: false
        });

        if (!record) return res.status(404).json({ error: "Record not found" });
        if (record.deleted_at === null) return res.status(400).json({ error: "Record is not deleted" });

        // Restore it
        await record.restore();

        await auditLog({
            req,
            action: `${table}.restore`,
            entity_type: modelName,
            entity_id: id,
            old_value: { deleted_at: record.deleted_at },
            new_value: { deleted_at: null },
            remarks: `Record recovered from soft delete by SuperAdmin`
        });

        res.json({ success: true, message: `Record in ${table} successfully restored.` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// ─────────────────────────────────────────────────────────────
// SYSTEM LOGS — Audit Logs + Slow Request Logs
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/superadmin/system-logs
 * Returns paginated audit_logs with optional filters.
 * Single query with WHERE conditions — minimum DB round-trips.
 */
exports.getSystemLogs = async (req, res) => {
    try {
        const {
            page       = 1,
            limit      = 50,
            type       = 'audit',      // 'audit' | 'slow'
            action,
            role,
            institute_id,
            entity_type,
            start_date,
            end_date,
            search,
            level,                     // 'error' | 'warn' | 'info' — for slow logs
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const pageLimit = Math.min(parseInt(limit), 200); // cap at 200 rows

        if (type === 'slow') {
            // ── Slow Request Logs ────────────────────────────────────────────
            const where = {};
            if (institute_id) where.institute_id = parseInt(institute_id);
            if (role)         where.user_role    = role;
            if (search)       where.path         = { [Op.iLike]: `%${search}%` };
            if (level === 'error')  where.status_code = { [Op.gte]: 500 };
            else if (level === 'warn') where.status_code = { [Op.between]: [400, 499] };
            if (start_date || end_date) {
                where.createdAt = {};
                if (start_date) where.createdAt[Op.gte] = new Date(start_date);
                if (end_date)   where.createdAt[Op.lte] = new Date(new Date(end_date).setHours(23,59,59,999));
            }

            const { count, rows } = await SlowRequestLog.findAndCountAll({
                where,
                order: [['createdAt', 'DESC']],
                limit: pageLimit,
                offset,
                raw: true,
            });

            return res.json({
                success: true,
                data:    rows,
                total:   count,
                page:    parseInt(page),
                limit:   pageLimit,
                pages:   Math.ceil(count / pageLimit),
            });
        }

        // ── Audit Logs (default) ─────────────────────────────────────────────
        const where = {};
        if (action)       where.action       = { [Op.iLike]: `%${action}%` };
        if (role)         where.user_role    = role;
        if (institute_id) where.institute_id = parseInt(institute_id);
        if (entity_type)  where.entity_type  = entity_type;
        if (search) {
            where[Op.or] = [
                { action:      { [Op.iLike]: `%${search}%` } },
                { entity_type: { [Op.iLike]: `%${search}%` } },
                { user_name:   { [Op.iLike]: `%${search}%` } },
                { path:        { [Op.iLike]: `%${search}%` } },
                { remarks:     { [Op.iLike]: `%${search}%` } },
            ];
        }
        if (level === 'error') where.status_code = { [Op.gte]: 500 };
        else if (level === 'warn') where.status_code = { [Op.between]: [400, 499] };
        if (start_date || end_date) {
            where.createdAt = {};
            if (start_date) where.createdAt[Op.gte] = new Date(start_date);
            if (end_date)   where.createdAt[Op.lte] = new Date(new Date(end_date).setHours(23,59,59,999));
        }

        const { count, rows } = await AuditLog.findAndCountAll({
            where,
            order: [['createdAt', 'DESC']],
            limit: pageLimit,
            offset,
            raw: true,
        });

        return res.json({
            success: true,
            data:    rows,
            total:   count,
            page:    parseInt(page),
            limit:   pageLimit,
            pages:   Math.ceil(count / pageLimit),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/superadmin/system-logs/stats
 * Returns summary stats for the System Logs dashboard header.
 * All 4 counts fired in parallel — single round-trip.
 */
// ─── System Logs & Settings ──────────────────────────────────────────────────
exports.getSystemSettings = async (req, res) => {
    try {
        if (!fs.existsSync(SETTINGS_FILE_PATH)) {
            return res.status(200).json({ success: true, settings: { autoLogoutTimer: 15 } });
        }
        const data = fs.readFileSync(SETTINGS_FILE_PATH, 'utf8');
        res.status(200).json({ success: true, settings: JSON.parse(data) });
    } catch (error) {
        console.error("Error reading system settings:", error);
        res.status(500).json({ success: false, message: "Error fetching system settings" });
    }
};

exports.updateSystemSettings = async (req, res) => {
    try {
        const { autoLogoutTimer } = req.body;
        
        let settings = { autoLogoutTimer: 15 };
        if (fs.existsSync(SETTINGS_FILE_PATH)) {
            settings = JSON.parse(fs.readFileSync(SETTINGS_FILE_PATH, 'utf8'));
        }
        
        if (autoLogoutTimer !== undefined) {
            settings.autoLogoutTimer = parseInt(autoLogoutTimer, 10);
        }
        
        fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(settings, null, 2));
        res.status(200).json({ success: true, message: "Settings updated successfully", settings });
    } catch (error) {
        console.error("Error updating system settings:", error);
        res.status(500).json({ success: false, message: "Error updating system settings" });
    }
};

exports.getSystemLogStats = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        let dateWhere = {};
        if (start_date || end_date) {
            dateWhere.createdAt = {};
            if (start_date) dateWhere.createdAt[Op.gte] = new Date(start_date);
            if (end_date)   dateWhere.createdAt[Op.lte] = new Date(new Date(end_date).setHours(23,59,59,999));
        }

        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // For Last 24h & 7d, if there's a custom date range, we might just intersect or ignore it.
        // Usually, in a filtered view, "Last 24h" means "Last 24h within that range", or just relative to now.
        // We'll intersect it with dateWhere if present.
        const last24hWhere = { ...dateWhere };
        if (last24hWhere.createdAt) {
             last24hWhere.createdAt = { ...last24hWhere.createdAt, [Op.gte]: new Date(Math.max(oneDayAgo, last24hWhere.createdAt[Op.gte] || 0)) };
        } else {
             last24hWhere.createdAt = { [Op.gte]: oneDayAgo };
        }

        const last7dWhere = { ...dateWhere };
        if (last7dWhere.createdAt) {
             last7dWhere.createdAt = { ...last7dWhere.createdAt, [Op.gte]: new Date(Math.max(oneWeekAgo, last7dWhere.createdAt[Op.gte] || 0)) };
        } else {
             last7dWhere.createdAt = { [Op.gte]: oneWeekAgo };
        }

        const [
            totalAuditLogs,
            auditLast24h,
            totalSlowRequests,
            errorCount,
            criticalActions,
        ] = await Promise.all([
            AuditLog.count({ where: dateWhere }),
            AuditLog.count({ where: last24hWhere }),
            SlowRequestLog.count({ where: dateWhere }),
            SlowRequestLog.count({ where: { ...dateWhere, status_code: { [Op.gte]: 500 } } }),
            AuditLog.count({
                where: {
                    ...last7dWhere,
                    action: {
                        [Op.or]: [
                            { [Op.like]: '%delete%' },
                            { [Op.like]: '%suspend%' },
                            { [Op.like]: '%cancel%' }
                        ]
                    }
                }
            }),
        ]);

        return res.json({
            success: true,
            stats: {
                totalAuditLogs,
                auditLast24h,
                totalSlowRequests,
                errorCount,
                criticalActions,
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────
// USERS MANAGEMENT — List all platform users (paginated + filtered)
// GET /api/superadmin/users
// ─────────────────────────────────────────────────────────────
exports.getUsers = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search = '',
            role = '',
            status = '',
            institute_id = '',
            sortBy = 'createdAt',
            sortOrder = 'DESC',
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Build where clause
        const where = {};

        // Exclude super_admin from listing (security)
        where.role = { [Op.ne]: 'super_admin' };

        if (role && role !== 'all') {
            where.role = role;
        }
        if (status && status !== 'all') {
            where.status = status;
        }
        if (institute_id) {
            where.institute_id = parseInt(institute_id);
        }
        if (search && search.trim()) {
            where[Op.or] = [
                { name: { [Op.iLike]: `%${search.trim()}%` } },
                { email: { [Op.iLike]: `%${search.trim()}%` } },
                { phone: { [Op.iLike]: `%${search.trim()}%` } },
            ];
        }

        // Whitelist sort columns to prevent SQL injection
        const allowedSortCols = ['createdAt', 'name', 'email', 'role', 'status'];
        const safeSort = allowedSortCols.includes(sortBy) ? sortBy : 'createdAt';
        const safeOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

        const { count, rows } = await User.findAndCountAll({
            where,
            attributes: [
                'id', 'name', 'email', 'phone', 'role', 'status',
                'institute_id', 'createdAt', 'updatedAt',
                'manager_type', 'manager_type_label',
                'credentials_sent_at', 'last_announcement_seen_at'
            ],
            include: [
                {
                    model: Institute,
                    as: 'Institute',
                    attributes: ['id', 'name'],
                    required: false,
                }
            ],
            order: [[safeSort, safeOrder]],
            limit: parseInt(limit),
            offset,
        });

        // Summary counts — run in parallel for speed
        const [totalAll, totalActive, totalBlocked, byRole] = await Promise.all([
            User.count({ where: { role: { [Op.ne]: 'super_admin' } } }),
            User.count({ where: { role: { [Op.ne]: 'super_admin' }, status: 'active' } }),
            User.count({ where: { role: { [Op.ne]: 'super_admin' }, status: 'blocked' } }),
            User.findAll({
                attributes: ['role', [fn('COUNT', col('id')), 'count']],
                where: { role: { [Op.ne]: 'super_admin' } },
                group: ['role'],
                raw: true,
            }),
        ]);

        const roleCounts = {};
        byRole.forEach(r => { roleCounts[r.role] = parseInt(r.count); });

        return res.json({
            success: true,
            users: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / parseInt(limit)),
            },
            summary: {
                total: totalAll,
                active: totalActive,
                blocked: totalBlocked,
                byRole: roleCounts,
            },
        });
    } catch (error) {
        console.error('getUsers error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────
// UPDATE USER STATUS — block / unblock
// PUT /api/superadmin/users/:id/status
// ─────────────────────────────────────────────────────────────
exports.updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['active', 'blocked'].includes(status)) {
            return res.status(400).json({ error: 'Status must be "active" or "blocked"' });
        }

        const user = await User.findByPk(id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.role === 'super_admin') return res.status(403).json({ error: 'Cannot modify super admin' });

        await user.update({ status });
        return res.json({ success: true, message: `User ${status === 'active' ? 'unblocked' : 'blocked'} successfully`, user });
    } catch (error) {
        console.error('updateUserStatus error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────
// DELETE USER — soft-delete
// DELETE /api/superadmin/users/:id
// ─────────────────────────────────────────────────────────────
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findByPk(id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.role === 'super_admin') return res.status(403).json({ error: 'Cannot delete super admin' });

        await user.destroy(); // soft-delete (paranoid: true)
        return res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('deleteUser error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────
// RECORD OFFLINE / CASH PAYMENT
// POST /api/superadmin/institutes/:id/offline-payment
// ─────────────────────────────────────────────────────────────
exports.recordOfflinePayment = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const instituteId = req.params.id;
        const { plan_id, amount_paid, payment_mode, reference_number, notes } = req.body;

        const institute = await Institute.findByPk(instituteId, { transaction: t });
        if (!institute) throw new Error("Institute not found");

        const plan = await Plan.findByPk(plan_id, { transaction: t });
        if (!plan) throw new Error("Plan not found");

        // Calculate subscription end date (assume 1 month by default unless yearly price matches amount)
        const isYearly = parseFloat(amount_paid) >= parseFloat(plan.yearly_price || 999999);
        const durationMonths = isYearly ? 12 : 1;
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + durationMonths);

        // 1. Create Subscription
        const subscription = await Subscription.create({
            institute_id: instituteId,
            plan_id: plan.id,
            start_date: startDate,
            end_date: endDate,
            payment_status: "paid",
            transaction_reference: `${payment_mode.toUpperCase()}-${reference_number || Date.now()}`,
            amount_paid: amount_paid,
            is_test: institute.is_test_account,
            paid_at: new Date()
        }, { transaction: t });

        // 2. Snapshot plan limits & features to Institute
        await institute.update({
            plan_id: plan.id,
            subscription_start: startDate,
            subscription_end: endDate,
            status: "active",
            current_limit_students: plan.max_students,
            current_limit_faculty: plan.max_faculty,
            current_limit_classes: plan.max_classes,
            current_limit_admins: plan.max_admin_users,
            current_limit_chat_messages: plan.max_chat_messages || 500,
            current_feature_attendance: plan.feature_attendance,
            current_feature_auto_attendance: plan.feature_auto_attendance,
            current_feature_fees: plan.feature_fees,
            current_feature_finance: plan.feature_finance,
            current_feature_salary: plan.feature_salary,
            current_feature_reports: plan.feature_reports,
            current_feature_announcements: plan.feature_announcements,
            current_feature_export: plan.feature_export,
            current_feature_timetable: plan.feature_timetable,
            current_feature_whatsapp: plan.feature_whatsapp,
            current_feature_custom_branding: plan.feature_custom_branding,
            current_feature_multi_branch: plan.feature_multi_branch,
            current_feature_api_access: plan.feature_api_access,
        }, { transaction: t });

        await t.commit();
        
        // 3. Generate Invoice (Soft failure if it crashes)
        try {
            const invoiceData = await invoiceService.generateInvoice({
                institute,
                plan,
                subscription,
            });
            if (invoiceData && invoiceData.filePath) {
                await Invoice.create({
                    institute_id: instituteId,
                    payment_id: subscription.id,
                    invoice_type: 'subscription',
                    invoice_number: invoiceData.invoiceNumber,
                    invoice_date: new Date(),
                    subtotal: amount_paid,
                    tax_amount: 0,
                    total_amount: amount_paid,
                    pdf_url: invoiceData.filePath
                });
            }
        } catch (invErr) {
            console.error("Offline invoice generation failed:", invErr);
        }
        
        // Clear all analytics caches
        analyticsCache.flushAll();

        // 4. Send Email Notification
        try {
            await emailService.sendEmail(
                institute.email,
                "Payment Received & Subscription Activated",
                `<h2>Payment Received Successfully</h2>
                <p>Dear ${institute.name},</p>
                <p>We have successfully received your payment via <strong>${payment_mode}</strong>.</p>
                <p><strong>Plan:</strong> ${plan.name}</p>
                <p><strong>Amount Paid:</strong> ₹${amount_paid}</p>
                <p><strong>Valid Until:</strong> ${endDate.toLocaleDateString()}</p>
                <p>Your subscription is now active! Please login to your dashboard to access your features.</p>
                <br>
                <p>Best regards,<br>ZenithFlows Team</p>`
            );
        } catch (emailErr) {
            console.error("Email sending failed:", emailErr);
        }

        res.status(200).json({ success: true, message: "Offline payment recorded successfully" });
    } catch (error) {
        await t.rollback();
        console.error("Offline payment error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────
// SUPER ADMIN IMPERSONATION ("Login As")
// POST /api/superadmin/users/:id/impersonate
// ─────────────────────────────────────────────────────────────
const { generateAccessToken, generateRefreshToken } = require("../utils/generateToken");

exports.impersonateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const targetUserId = parseInt(id, 10);
        
        // Ensure superadmin cannot impersonate another superadmin
        const targetUser = await User.findByPk(targetUserId, {
            include: [{ model: Institute }]
        });
        
        if (!targetUser) {
            return res.status(404).json({ success: false, message: "Target user not found" });
        }
        
        if (targetUser.role === 'super_admin') {
            return res.status(403).json({ success: false, message: "Cannot impersonate another super admin" });
        }
        
        // Generate tokens for the target user
        const instituteData = targetUser.Institute ? { name: targetUser.Institute.name } : null;
        
        const accessToken = generateAccessToken(targetUser, instituteData);
        const refresh = generateRefreshToken('web');
        
        // Optional: Save refresh token to DB for the impersonated session
        await RefreshToken.create({
            user_id: targetUser.id,
            token_hash: refresh.hash,
            expires_at: refresh.expiresAt,
            device_info: "Superadmin Impersonation",
            source: 'web',
            ip_address: req.ip
        });
        
        let features = {};
        if (targetUser.Institute && targetUser.Institute.plan_id) {
            // Need to fetch plan since it might not be included
            const plan = await Plan.findByPk(targetUser.Institute.plan_id);
            if (plan) {
                const { computeFeatures } = require('../middlewares/planLimits.middleware');
                features = computeFeatures(targetUser.Institute, plan);
                targetUser.Institute.Plan = plan; // Assign for below
            }
        }
        
        let instituteLogo = targetUser.Institute?.logo || null;
        
        res.json({
            success: true,
            message: `Successfully logged in as ${targetUser.name}`,
            token: accessToken, // backward compatibility
            accessToken,
            refreshToken: refresh.token,
            user: {
                id: targetUser.id,
                name: targetUser.name,
                email: targetUser.email,
                role: targetUser.role,
                status: targetUser.status,
                is_first_login: targetUser.is_first_login,
                institute_id: targetUser.institute_id,
                institute_name: targetUser.Institute?.name,
                institute_status: targetUser.Institute?.status,
                institute_logo: instituteLogo,
                subscription_end: targetUser.Institute?.subscription_end,
                is_lifetime_member: targetUser.Institute?.is_lifetime_member || false,
                plan_name: targetUser.Institute?.Plan?.name,
                features,
                permissions: targetUser.permissions || [],
                theme_dark: targetUser.theme_dark ?? false,
                theme_style: targetUser.theme_style ?? "simple"
            }
        });
    } catch (error) {
        console.error("Impersonation error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
