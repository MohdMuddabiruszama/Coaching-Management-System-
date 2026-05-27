/**
 * Plan Limit Enforcement Middleware
 * Checks if institute has reached limits based on their plan
 */

const { Institute, Plan, Student, User, Class } = require("../models");
const { Op } = require("sequelize");

const computeFeatures = (institute, plan) => {
    const features = {
        attendance: institute.current_feature_attendance !== 'none' ? institute.current_feature_attendance : plan.feature_attendance,
        auto_attendance: institute.current_feature_auto_attendance !== null ? institute.current_feature_auto_attendance : plan.feature_auto_attendance,
        fees: institute.current_feature_fees !== null ? institute.current_feature_fees : plan.feature_fees,
        finance: institute.current_feature_finance !== null ? institute.current_feature_finance : plan.feature_finance,
        salary: institute.current_feature_salary !== null ? institute.current_feature_salary : plan.feature_salary,
        reports: institute.current_feature_reports || plan.feature_reports,
        announcements: institute.current_feature_announcements !== null ? institute.current_feature_announcements : plan.feature_announcements,
        export: institute.current_feature_export !== null ? institute.current_feature_export : plan.feature_export,
        whatsapp: institute.current_feature_whatsapp !== null ? institute.current_feature_whatsapp : plan.feature_whatsapp,
        custom_branding: institute.current_feature_custom_branding !== null ? institute.current_feature_custom_branding : plan.feature_custom_branding,
        multi_branch: institute.current_feature_multi_branch !== null ? institute.current_feature_multi_branch : plan.feature_multi_branch,
        api_access: institute.current_feature_api_access !== null ? institute.current_feature_api_access : plan.feature_api_access,
        timetable: institute.current_feature_timetable !== undefined && institute.current_feature_timetable !== null ? institute.current_feature_timetable : plan.feature_timetable,
        assignment: institute.current_feature_assignment !== null && institute.current_feature_assignment !== undefined ? institute.current_feature_assignment : (plan.feature_assignment || false),
        transport: institute.current_feature_transport !== null && institute.current_feature_transport !== undefined ? institute.current_feature_transport : (plan.feature_transport || false),
        notes: plan.feature_notes || false,
        chat: plan.feature_chat || false,
        exams: plan.feature_exams || false,
        performance_hub: institute.current_feature_performance_hub !== null && institute.current_feature_performance_hub !== undefined ? institute.current_feature_performance_hub : (plan.feature_performance_hub || false),
        public_page: institute.current_feature_public_page !== null && institute.current_feature_public_page !== undefined ? institute.current_feature_public_page : (plan.feature_public_page || false),
        mobile_app: institute.current_feature_mobile_app !== null && institute.current_feature_mobile_app !== undefined ? institute.current_feature_mobile_app : (plan.feature_mobile_app || false)
    };

    let expiries = {};
    try {
        expiries = (typeof institute.add_on_expiries === 'string' ? JSON.parse(institute.add_on_expiries) : institute.add_on_expiries) || {};
    } catch(e) {}

    const now = new Date();
    Object.keys(features).forEach(key => {
        let expKey = `current_feature_${key}`;
        let expiryRaw = expiries[expKey];
        if (expiryRaw) {
            let expiryDateStr = typeof expiryRaw === 'object' ? expiryRaw.end : expiryRaw;
            if (now > new Date(expiryDateStr)) {
                features[key] = plan[`feature_${key}`] || (typeof features[key] === 'boolean' ? false : 'none');
            }
        }
    });

    return features;
};

/**
 * Check if institute can add more students
 */
const checkStudentLimit = async (req, res, next) => {
    try {
        const institute_id = req.user.institute_id;

        // Get institute with plan
        const institute = await Institute.findByPk(institute_id, {
            include: [{ model: Plan }]
        });

        if (!institute || !institute.Plan) {
            return res.status(400).json({
                success: false,
                message: "Institute or plan not found"
            });
        }

        // === LIFETIME BYPASS: unlimited access ===
        if (institute.is_lifetime_member) return next();

        // Count current students
        const studentCount = await Student.count({
            where: { institute_id }
        });

        // Determine limit (Snapshot first, then Plan fallback)
        const limit_students = institute.current_limit_students || institute.Plan.max_students;

        // -1 = unlimited (lifetime override)
        if (limit_students !== -1 && studentCount >= limit_students) {
            if (req.method === 'GET') return next();
            
            return res.status(403).json({
                success: false,
                message: `Student limit reached! Your plan allows up to ${limit_students} students. Please upgrade your plan.`,
                limit_reached: true,
                current_count: studentCount,
                max_limit: limit_students,
                upgrade_required: true
            });
        }

        next();
    } catch (error) {
        console.error("Error checking student limit:", error);
        res.status(500).json({
            success: false,
            message: "Error checking student limit"
        });
    }
};

/**
 * Check if institute can add more faculty
 */
const checkFacultyLimit = async (req, res, next) => {
    try {
        const institute_id = req.user.institute_id;

        const institute = await Institute.findByPk(institute_id, {
            include: [{ model: Plan }]
        });

        if (!institute || !institute.Plan) {
            return res.status(400).json({
                success: false,
                message: "Institute or plan not found"
            });
        }

        // === LIFETIME BYPASS: unlimited access ===
        if (institute.is_lifetime_member) return next();

        // Count current faculty
        const facultyCount = await User.count({
            where: {
                institute_id,
                role: 'faculty'
            }
        });

        const limit_faculty = institute.current_limit_faculty || institute.Plan.max_faculty;

        // -1 = unlimited
        if (limit_faculty !== -1 && facultyCount >= limit_faculty) {
            if (req.method === 'GET') return next();
            
            return res.status(403).json({
                success: false,
                message: `Faculty limit reached! Your plan allows up to ${limit_faculty} faculty members. Please upgrade your plan.`,
                limit_reached: true,
                current_count: facultyCount,
                max_limit: limit_faculty,
                upgrade_required: true
            });
        }

        next();
    } catch (error) {
        console.error("Error checking faculty limit:", error);
        res.status(500).json({
            success: false,
            message: "Error checking faculty limit"
        });
    }
};

/**
 * Check if institute can add more classes
 */
const checkClassLimit = async (req, res, next) => {
    try {
        const institute_id = req.user.institute_id;

        const institute = await Institute.findByPk(institute_id, {
            include: [{ model: Plan }]
        });

        if (!institute || !institute.Plan) {
            return res.status(400).json({
                success: false,
                message: "Institute or plan not found"
            });
        }

        // Count current classes
        const classCount = await Class.count({
            where: { institute_id }
        });

        const limit_classes = institute.current_limit_classes || institute.Plan.max_classes;

        if (classCount >= limit_classes) {
            if (req.method === 'GET') return next();
            
            return res.status(403).json({
                success: false,
                message: `Class limit reached! Your plan allows up to ${limit_classes} classes. Please upgrade your plan.`,
                limit_reached: true,
                current_count: classCount,
                max_limit: limit_classes,
                upgrade_required: true
            });
        }

        next();
    } catch (error) {
        console.error("Error checking class limit:", error);
        res.status(500).json({
            success: false,
            message: "Error checking class limit"
        });
    }
};

/**
 * Check if institute can add more admin users
 */
const checkAdminUserLimit = async (req, res, next) => {
    try {
        const institute_id = req.user.institute_id;

        const institute = await Institute.findByPk(institute_id, {
            include: [{ model: Plan }]
        });

        if (!institute || !institute.Plan) {
            return res.status(400).json({
                success: false,
                message: "Institute or plan not found"
            });
        }

        // === LIFETIME BYPASS: unlimited access ===
        if (institute.is_lifetime_member) return next();

        // Count current admin users
        const adminCount = await User.count({
            where: {
                institute_id,
                role: 'admin'
            }
        });

        const limit_admins = institute.current_limit_admins || institute.Plan.max_admin_users;

        // -1 = unlimited
        if (limit_admins !== -1 && adminCount >= limit_admins) {
            if (req.method === 'GET') return next();
            
            return res.status(403).json({
                success: false,
                message: `Admin user limit reached! Your plan allows up to ${limit_admins} admin users. Please upgrade your plan.`,
                limit_reached: true,
                current_count: adminCount,
                max_limit: limit_admins,
                upgrade_required: true
            });
        }

        next();
    } catch (error) {
        console.error("Error checking admin user limit:", error);
        res.status(500).json({
            success: false,
            message: "Error checking admin user limit"
        });
    }
};

/**
 * Check if institute has access to a feature
 */
const checkFeatureAccess = (featureName) => {
    return async (req, res, next) => {
        try {
            const institute_id = req.user.institute_id;

            const institute = await Institute.findByPk(institute_id, {
                include: [{ model: Plan }]
            });

            if (!institute || !institute.Plan) {
                return res.status(400).json({
                    success: false,
                    message: "Institute or plan not found"
                });
            }

            // === LIFETIME BYPASS: Lifetime members access ALL features always ===
            if (institute.is_lifetime_member) return next();

            const plan = institute.Plan;

            // Determine feature access, evaluating add_on_expiries
            const features = computeFeatures(institute, plan);

            // NEW RULE: Trial Expiration or General Expiration
            let isExpired = false;
            if (institute.subscription_end) {
                const today = new Date();
                const end = new Date(institute.subscription_end);
                end.setHours(23, 59, 59, 999);
                if (today > end) isExpired = true;
            }

            if (isExpired && req.method !== 'GET') {
                return res.status(403).json({
                    success: false,
                    message: "Your subscription has expired. Your account is in read-only mode.",
                    plan_expired: true,
                    feature_locked: true,
                    upgrade_required: true
                });
            }

            // Check if feature is enabled
            let hasAccess = false;

            switch (featureName) {
                case 'attendance':
                    hasAccess = features.attendance !== 'none';
                    break;
                case 'auto_attendance':
                    hasAccess = features.auto_attendance === true;
                    break;
                case 'fees':
                    hasAccess = features.fees === true;
                    break;
                case 'reports':
                    hasAccess = features.reports !== 'none';
                    break;
                case 'timetable':
                    hasAccess = features.timetable === true;
                    break;
                case 'announcements':
                    hasAccess = features.announcements === true;
                    break;
                case 'export':
                    hasAccess = features.export === true;
                    break;
                case 'whatsapp':
                    hasAccess = features.whatsapp === true;
                    break;
                case 'custom_branding':
                    hasAccess = features.custom_branding === true;
                    break;
                case 'multi_branch':
                    hasAccess = features.multi_branch === true;
                    break;
                case 'api_access':
                    hasAccess = features.api_access === true;
                    break;
                case 'assignment':
                    hasAccess = features.assignment === true;
                    break;
                case 'transport':
                    hasAccess = features.transport === true;
                    break;
                case 'notes':
                    hasAccess = features.notes === true;
                    break;
                case 'chat':
                    hasAccess = features.chat === true;
                    break;
                case 'exams':
                    hasAccess = features.exams === true;
                    break;
                case 'performance_hub':
                    hasAccess = features.performance_hub === true;
                    break;
                case 'public_page':
                    hasAccess = features.public_page === true;
                    break;
                default:
                    hasAccess = true; // Unknown features are allowed by default
            }

            if (!hasAccess && req.method !== 'GET') {
                return res.status(403).json({
                    success: false,
                    message: `This feature is not available in your ${plan.name} plan. Please upgrade to access ${featureName}.`,
                    feature_locked: true,
                    current_plan: plan.name,
                    upgrade_required: true
                });
            }

            next();
        } catch (error) {
            console.error("Error checking feature access:", error);
            res.status(500).json({
                success: false,
                message: "Error checking feature access"
            });
        }
    };
};

/**
 * Get current usage and limits for institute
 */
const getUsageStats = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;

        const institute = await Institute.findByPk(institute_id, {
            include: [{ model: Plan }]
        });

        if (!institute || !institute.Plan) {
            return res.status(400).json({
                success: false,
                message: "Institute or plan not found"
            });
        }

        // Get current counts
        const [studentCount, facultyCount, classCount, adminCount] = await Promise.all([
            Student.count({ where: { institute_id } }),
            User.count({ where: { institute_id, role: 'faculty' } }),
            Class.count({ where: { institute_id } }),
            User.count({ where: { institute_id, role: 'admin' } })
        ]);

        // Determine limits (Snapshot first, then Plan fallback; -1 = unlimited)
        const limit_students = institute.current_limit_students || institute.Plan.max_students;
        const limit_faculty = institute.current_limit_faculty || institute.Plan.max_faculty;
        const limit_classes = institute.current_limit_classes || institute.Plan.max_classes;
        const limit_admins = institute.current_limit_admins || institute.Plan.max_admin_users;

        // Helper: safe percentage (handles -1 unlimited)
        const safePct = (cur, lim) => lim === -1 ? 0 : Math.round((cur / lim) * 100);
        const safeRem = (cur, lim) => lim === -1 ? -1 : Math.max(0, lim - cur);

        res.json({
            success: true,
            data: {
                institute: {
                    subscription_end: institute.subscription_end,
                    has_used_trial: institute.has_used_trial,
                    // Lifetime fields for frontend conditional logic
                    is_lifetime_member: institute.is_lifetime_member || false,
                    founding_member: institute.founding_member || false,
                    lifetime_purchased_at: institute.lifetime_purchased_at || null
                },
                plan: {
                    name: institute.Plan.name,
                    price: institute.Plan.price,
                    is_free_trial: institute.Plan.is_free_trial,
                    trial_days: institute.Plan.trial_days
                },
                usage: {
                    students: {
                        current: studentCount,
                        limit: limit_students === -1 ? '∞' : limit_students,
                        percentage: safePct(studentCount, limit_students),
                        remaining: safeRem(studentCount, limit_students)
                    },
                    faculty: {
                        current: facultyCount,
                        limit: limit_faculty === -1 ? '∞' : limit_faculty,
                        percentage: safePct(facultyCount, limit_faculty),
                        remaining: safeRem(facultyCount, limit_faculty)
                    },
                    classes: {
                        current: classCount,
                        limit: limit_classes === -1 ? '∞' : limit_classes,
                        percentage: safePct(classCount, limit_classes),
                        remaining: safeRem(classCount, limit_classes)
                    },
                    admin_users: {
                        current: adminCount,
                        limit: limit_admins === -1 ? '∞' : limit_admins,
                        percentage: safePct(adminCount, limit_admins),
                        remaining: safeRem(adminCount, limit_admins)
                    }
                },
                features: computeFeatures(institute, institute.Plan)
            }
        });
    } catch (error) {
        console.error("Error getting usage stats:", error);
        res.status(500).json({
            success: false,
            message: "Error getting usage stats"
        });
    }
};

module.exports = {
    checkStudentLimit,
    checkFacultyLimit,
    checkClassLimit,
    checkAdminUserLimit,
    checkFeatureAccess,
    getUsageStats,
    computeFeatures
};
