const { Institute, User, Plan, Subscription, InstitutePublicProfile } = require("../models");
const { hashPassword, comparePassword } = require("../utils/hashPassword");
const { computeFeatures } = require("../middlewares/planLimits.middleware");

exports.registerInstitute = async (data) => {
    // Handle both snake_case and camelCase inputs
    const instituteName = data.instituteName || data.name;
    const planId = data.planId || data.plan_id;
    const { email, password, phone, address, city, state, pincode, zip_code } = data;
    const finalZipCode = zip_code || pincode; // Handle both keys

    if (!instituteName || !email || !password || !phone || !address || !planId) {
        throw new Error("All fields are required, including plan selection.");
    }

    // Check if email already exists
    const existingInstitute = await Institute.findOne({ where: { email } });
    if (existingInstitute) {
        throw new Error("This email is already registered as an institute.");
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
        throw new Error("This email is already registered as a user.");
    }

    let subscriptionStart = null;
    let subscriptionEnd = null;
    let instituteStatus = "pending";
    let hasUsedTrial = false;
    let plan = null;

    if (planId) {
        plan = await Plan.findByPk(planId);
        if (plan) {
            subscriptionStart = new Date();
            const endDate = new Date();
            
            if (plan.is_free_trial) {
                endDate.setDate(endDate.getDate() + (plan.trial_days || 14));
                instituteStatus = "active";
                hasUsedTrial = true;
            } else {
                endDate.setDate(endDate.getDate() + 30); // Default 30 days
                // If free plan (but not trial), activate immediately
                if (Number(plan.price) === 0) {
                    instituteStatus = "active";
                } else {
                    // If paid plan, subscription starts AFTER payment
                    subscriptionStart = null;
                    subscriptionEnd = null;
                }
            }
            if (!plan.is_free_trial || (plan.is_free_trial && instituteStatus === "active")) {
                subscriptionEnd = endDate;
            }
        }
    }

    // Create Institute
    const institute = await Institute.create({
        name: instituteName,
        email,
        phone,
        address,
        city,
        state,
        zip_code: finalZipCode,
        plan_id: planId || null,
        status: instituteStatus,
        subscription_start: instituteStatus === 'active' ? subscriptionStart : null,
        subscription_end: instituteStatus === 'active' ? subscriptionEnd : null,
        // Snapshot limits
        current_limit_students: plan ? plan.max_students : 50,
        current_limit_faculty: plan ? plan.max_faculty : 5,
        current_limit_classes: plan ? plan.max_classes : 5,
        current_limit_admins: plan ? plan.max_admin_users : 1,
        current_limit_chat_messages: plan ? (plan.max_chat_messages || 500) : 500,

        // Snapshot features
        current_feature_attendance: plan ? plan.feature_attendance : 'basic',
        current_feature_auto_attendance: plan ? plan.feature_auto_attendance : false,
        current_feature_fees: plan ? plan.feature_fees : false,
        current_feature_finance: plan ? plan.feature_finance : false,
        current_feature_expenses: plan ? plan.feature_expenses : false,
        current_feature_salary: plan ? plan.feature_salary : false,
        current_feature_reports: plan ? plan.feature_reports : 'none',
        current_feature_announcements: plan ? plan.feature_announcements : false,
        current_feature_export: plan ? plan.feature_export : false,
        current_feature_timetable: plan ? plan.feature_timetable : false,
        current_feature_whatsapp: plan ? plan.feature_whatsapp : false,
        current_feature_custom_branding: plan ? plan.feature_custom_branding : false,
        current_feature_multi_branch: plan ? plan.feature_multi_branch : false,
        current_feature_api_access: plan ? plan.feature_api_access : false,
        current_feature_assignment: plan ? plan.feature_assignment : false,
        current_feature_performance_hub: plan ? plan.feature_performance_hub : false,
        current_feature_transport: plan ? plan.feature_transport : false,
        current_feature_mobile_app: plan ? plan.feature_mobile_app : false,
        current_feature_public_page: plan ? plan.feature_public_page : false,
        current_feature_chat: plan ? plan.feature_chat : false,
        current_feature_push_notifications: plan ? plan.feature_push_notifications : false,
        current_feature_offline_attendance: plan ? plan.feature_offline_attendance : false,
        current_feature_parent_app: plan ? plan.feature_parent_app : false,
        current_feature_student_app: plan ? plan.feature_student_app : false,
        has_used_trial: hasUsedTrial,
        logo: data.logo || null,
    });

    if (data.logo) {
        const slugBase = instituteName ? instituteName.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'institute';
        const uniqueSlug = `${slugBase}-${Date.now()}`;
        await InstitutePublicProfile.create({
            institute_id: institute.id,
            slug: uniqueSlug.replace(/^-+|-+$/g, ''), // cleans trailing dashes
            logo_url: data.logo,
            theme_color: '#4f46e5'
        });
    }

    // Hash Password
    const hashedPassword = await hashPassword(password);

    // Create Admin User
    const adminUser = await User.create({
        institute_id: institute.id,
        role: "admin",
        name: instituteName, // Use institute name as admin name initially
        email,
        phone,
        password_hash: hashedPassword,
        status: "active",
    });

    // Create Pending Subscription
    if (planId && plan) {
        const paymentStatus = instituteStatus === "active" ? "paid" : "pending";
        const amountPaid = instituteStatus === "active" ? 0 : 0; // Even if paid (free), amount is 0. If pending (paid), amount is 0 until payment.

        await Subscription.create({
            institute_id: institute.id,
            plan_id: planId,
            start_date: subscriptionStart,
            end_date: subscriptionEnd, // This might be null if pending
            payment_status: paymentStatus,
            amount_paid: amountPaid,
        });
    }

    return { institute, adminUser };
};

exports.loginUser = async (email, password) => {
    const user = await User.findOne({
        where: { email },
        include: [
            {
                model: Institute,
                include: [{ model: Plan }] // Include Plan to check limits
            }
        ]
    });

    if (!user) throw new Error("User not found");

    // We removed the throw for blocked students/parents here.
    // They will now login successfully but be caught by ProtectedRoute's BlockedScreen
    // resulting in the desired Phase 7 "Account Suspended" page.

    // Check Password match
    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) throw new Error("Incorrect password");

    // --- Admin Limit Enforcement ---
    // If user is an admin, check if they are within the allowed limit (Grandfathering Logic)
    if (user.role === 'admin' && user.Institute) {
        const institute = user.Institute;
        // Determine Limit (Snapshot > Plan)
        const adminLimit = institute.current_limit_admins || (institute.Plan ? institute.Plan.max_admin_users : 1);

        // Fetch all active admins sorted by creation time (Oldest first)
        const allAdmins = await User.findAll({
            where: {
                institute_id: user.institute_id,
                role: 'admin',
                status: 'active'
            },
            order: [['created_at', 'ASC']],
            attributes: ['id', 'created_at']
        });

        // The first 'adminLimit' users are allowed. Others are blocked.
        const allowedAdmins = allAdmins.slice(0, adminLimit);
        const isAllowed = allowedAdmins.some(admin => admin.id === user.id);

        if (!isAllowed) {
            throw new Error(`Your plan allows only ${adminLimit} admin(s). You are restricted as an additional admin. Please upgrade your plan.`);
        }
    }

    return user;
};

exports.changePassword = async (userId, oldPassword, newPassword) => {
    const user = await User.findByPk(userId);
    if (!user) throw new Error("User not found");

    const isMatch = await comparePassword(oldPassword, user.password_hash);
    if (!isMatch) throw new Error("Incorrect old password");

    const hashedPassword = await hashPassword(newPassword);
    await user.update({ password_hash: hashedPassword });

    return true;
};

exports.getProfile = async (userId) => {
    const user = await User.findByPk(userId, {
        attributes: ['id', 'name', 'email', 'role', 'status', 'is_first_login', 'institute_id', 'permissions', 'theme_dark', 'theme_style', 'created_at', 'createdAt'],
        include: [{
            model: Institute,
            include: [{ model: Plan }] // Include Plan details
        }]
    });
    if (!user) throw new Error("User not found");

    let features = {};
    if (user.Institute && user.Institute.Plan) {
        const plan = user.Institute.Plan;
        features = computeFeatures(user.Institute, plan);
    }

    const userData = user.toJSON();
    userData.features = features;
    userData.institute_name = user.Institute?.name;
    userData.institute_status = user.Institute?.status;
    userData.institute_phone = user.Institute?.phone;
    userData.institute_logo = user.Institute?.logo || null;
    // Lifetime and subscription fields needed by frontend for expiry checks
    userData.is_lifetime_member = user.Institute?.is_lifetime_member || false;
    userData.subscription_end = user.Institute?.subscription_end || null;
    if (!userData.institute_logo) {
        try {
            const publicProfile = await InstitutePublicProfile.findOne({
                where: { institute_id: user.institute_id },
                attributes: ['logo_url']
            });
            userData.institute_logo = publicProfile?.logo_url || null;
        } catch (_) {
        }
    }
    return userData;
};

exports.updateProfile = async (userId, data) => {
    const user = await User.findByPk(userId);
    if (!user) throw new Error("User not found");

    await user.update(data);
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        institute_id: user.institute_id,
        permissions: user.permissions || [],
        theme_dark: user.theme_dark ?? false,
        theme_style: user.theme_style ?? "simple",
    };
};
