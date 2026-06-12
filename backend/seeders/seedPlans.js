/**
 * Seed finalized SaaS plans.
 */

const { Plan } = require("../models");

const seedPlans = async () => {
    try {
        const existingPlansCount = await Plan.count();
        if (existingPlansCount > 0) {
            console.log(`[Seeder] Plans already exist (${existingPlansCount}). Skipping plan seeding.`);
            return;
        }

        console.log("Seeding initial plans...");

        const baseFeatureSet = {
            feature_students: true,
            feature_attendance: "basic",
            feature_scan_qr: true,
            feature_classes: true,
            feature_subjects: true,
            feature_notes: true,
            feature_assignment: true,
            feature_announcements: true,
            feature_public_page: true,
            feature_fees: true,
            feature_mobile_app: true,
            feature_reports: "basic",
            feature_auto_attendance: false,
            feature_finance: false,
            feature_salary: false,
            feature_exams: false,
            feature_export: false,
            feature_email: false,
            feature_sms: false,
            feature_whatsapp: false,
            feature_timetable: false,
            feature_chat: false,
            feature_custom_branding: false,
            feature_multi_branch: false,
            feature_api_access: false,
            feature_parent_portal: false,
            feature_transport: false,
            feature_push_notifications: false,
            feature_offline_attendance: false,
            feature_parent_app: false,
            feature_student_app: false,
            feature_mobile_biometric: false,
            feature_faculty: false,
            feature_faculty_attendance: false,
            feature_faculty_tracker: false,
            feature_performance_analytics: false,
            feature_biometric: false,
            status: "active"
        };

        const basicFeatureSet = {
            ...baseFeatureSet,
            feature_faculty: true,
            feature_faculty_attendance: true,
            feature_faculty_tracker: true,
            feature_parent_portal: true,
            feature_exams: true,
            feature_timetable: true,
            feature_finance: true,
            feature_chat: true,
        };

        const proFeatureSet = {
            ...basicFeatureSet,
            feature_salary: true,
            feature_performance_analytics: true,
            feature_biometric: true,
            feature_reports: "advanced",
        };

        const enterpriseFeatureSet = {
            ...proFeatureSet,
            feature_custom_branding: true,
            feature_multi_branch: true,
            feature_api_access: true,
            feature_transport: true,
            feature_email: true,
            feature_sms: true,
            feature_whatsapp: true,
        };

        const plans = [
            // WEB ONLY PLANS
            {
                ...baseFeatureSet,
                name: "Starter",
                description: "Coaching & tuition centres",
                price: 999,
                yearly_price: 9990,
                platform_type: "web_only",
                max_students: 200,
                max_faculty: 15,
                max_classes: 15,
                max_admin_users: 3,
                max_storage_mb: 5120, // 5 GB
                max_ai_messages: 50,
                feature_count: 14,
                display_order: 10
            },
            {
                ...basicFeatureSet,
                name: "Basic",
                description: "Primary & secondary schools",
                price: 2499,
                yearly_price: 24990,
                platform_type: "web_only",
                max_students: 800,
                max_faculty: 60,
                max_classes: 60,
                max_admin_users: 8,
                max_storage_mb: 20480, // 20 GB
                max_ai_messages: 250,
                feature_count: 20,
                is_popular: true,
                display_order: 20
            },
            {
                ...proFeatureSet,
                name: "Professional",
                description: "Colleges & large schools",
                price: 5999,
                yearly_price: 59990,
                platform_type: "web_only",
                max_students: 3000,
                max_faculty: 200,
                max_classes: 200,
                max_admin_users: 20,
                max_storage_mb: 102400, // 100 GB
                max_ai_messages: 1000,
                max_biometric_devices: 5,
                feature_count: 25,
                display_order: 30
            },
            {
                ...enterpriseFeatureSet,
                name: "Enterprise",
                description: "Universities & multi-branch",
                price: 12999,
                yearly_price: 129990,
                platform_type: "web_only",
                max_students: -1,
                max_faculty: -1,
                max_classes: -1,
                max_admin_users: -1,
                max_storage_mb: -1,
                max_ai_messages: -1,
                max_biometric_devices: -1,
                feature_count: 27,
                display_order: 40
            },

            // WEB + MOBILE APP PLANS
            {
                ...baseFeatureSet,
                name: "Starter + android",
                description: "Starter features bundled with android apps.",
                price: 1499,
                yearly_price: 14990,
                platform_type: "web_android",
                max_students: 200,
                max_faculty: 15,
                max_classes: 15,
                max_admin_users: 3,
                max_storage_mb: 5120,
                max_ai_messages: 50,
                feature_count: 14,
                display_order: 50
            },
            {
                ...basicFeatureSet,
                name: "Basic + android",
                description: "Basic features bundled with android apps.",
                price: 3499,
                yearly_price: 34990,
                platform_type: "web_android",
                max_students: 800,
                max_faculty: 60,
                max_classes: 60,
                max_admin_users: 8,
                max_storage_mb: 20480,
                max_ai_messages: 250,
                feature_count: 20,
                is_popular: true,
                display_order: 60
            },
            {
                ...proFeatureSet,
                name: "Professional + android",
                description: "Professional features bundled with android apps.",
                price: 7999,
                yearly_price: 79990,
                platform_type: "web_android",
                max_students: 3000,
                max_faculty: 200,
                max_classes: 200,
                max_admin_users: 20,
                max_storage_mb: 102400,
                max_ai_messages: 1000,
                max_biometric_devices: 5,
                feature_count: 25,
                display_order: 70
            },
            {
                ...enterpriseFeatureSet,
                name: "Enterprise + android",
                description: "Enterprise features bundled with android apps.",
                price: 16999,
                yearly_price: 169990,
                platform_type: "web_android",
                max_students: -1,
                max_faculty: -1,
                max_classes: -1,
                max_admin_users: -1,
                max_storage_mb: -1,
                max_ai_messages: -1,
                max_biometric_devices: -1,
                feature_count: 27,
                display_order: 80
            }
        ];

        // Bulk insert new plans for performance
        const createdPlans = await Plan.bulkCreate(plans, { returning: true });
        const byName = Object.fromEntries(createdPlans.map((plan) => [plan.name, plan]));

        // Pair the plans efficiently in parallel
        await Promise.all([
            byName.Starter?.update({ paired_plan_id: byName["Starter+"]?.id }),
            byName["Starter+"]?.update({ paired_plan_id: byName.Starter?.id }),
            byName.Basic?.update({ paired_plan_id: byName["Basic+"]?.id }),
            byName["Basic+"]?.update({ paired_plan_id: byName.Basic?.id }),
            byName.Professional?.update({ paired_plan_id: byName["Professional+"]?.id }),
            byName["Professional+"]?.update({ paired_plan_id: byName.Professional?.id }),
            byName.Enterprise?.update({ paired_plan_id: byName["Enterprise+"]?.id }),
            byName["Enterprise+"]?.update({ paired_plan_id: byName.Enterprise?.id })
        ]);

        console.log("Plans seeded successfully. Replaced with highly optimized configurations.");
    } catch (error) {
        console.error("Error seeding plans:", error);
        throw error;
    }
};

module.exports = seedPlans;
