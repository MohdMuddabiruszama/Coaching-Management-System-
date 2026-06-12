/**
 * Fix Pricing Plans - Updates ALL plans in DB to match the new pricing structure
 * Run from pre-dep root: node fixPricingPlans.js
 */

const path = require('path');
// Load env from backend/.env
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

const sequelize = require('./backend/config/database');
const Plan = require('./backend/models/plan');

const NEW_PLANS = [
    // ── WEB ONLY ─────────────────────────────────────────────────────────────
    {
        name: 'Starter',
        platform_type: 'web_only',
        description: 'Coaching & tuition centres',
        price: 999,
        yearly_price: 9990,
        max_students: 200,
        max_faculty: 15,
        max_admin_users: 3,
        max_classes: 10,
        max_storage_mb: 5120,        // 5 GB
        max_ai_messages: 100,
        is_popular: false,
        is_free_trial: false,
        contact_sales: false,
        display_order: 10,
        // features
        feature_attendance: 'basic',
        feature_fees: true,
        feature_exams: true,
        feature_timetable: true,
        feature_announcements: true,
        feature_reports: 'basic',
        feature_export: true,
        feature_notes: true,
        feature_chat: false,
        feature_finance: false,
        feature_salary: false,
        feature_sms: false,
        feature_email: false,
        feature_whatsapp: false,
        feature_parent_portal: false,
        feature_custom_branding: false,
        feature_multi_branch: false,
        feature_api_access: false,
        feature_public_page: false,
        feature_assignment: false,
        feature_transport: false,
        feature_mobile_app: false,
        feature_push_notifications: false,
        feature_offline_attendance: false,
        feature_parent_app: false,
        feature_student_app: false,
        status: 'active',
    },
    {
        name: 'Basic',
        platform_type: 'web_only',
        description: 'Primary & secondary schools',
        price: 2499,
        yearly_price: 24990,
        max_students: 800,
        max_faculty: 60,
        max_admin_users: 8,
        max_classes: 30,
        max_storage_mb: 20480,       // 20 GB
        max_ai_messages: 500,
        is_popular: true,
        is_free_trial: false,
        contact_sales: false,
        display_order: 20,
        feature_attendance: 'advanced',
        feature_fees: true,
        feature_exams: true,
        feature_timetable: true,
        feature_announcements: true,
        feature_reports: 'advanced',
        feature_export: true,
        feature_notes: true,
        feature_chat: true,
        feature_finance: true,
        feature_salary: false,
        feature_sms: true,
        feature_email: true,
        feature_whatsapp: false,
        feature_parent_portal: true,
        feature_custom_branding: false,
        feature_multi_branch: false,
        feature_api_access: false,
        feature_public_page: false,
        feature_assignment: true,
        feature_transport: false,
        feature_mobile_app: false,
        feature_push_notifications: false,
        feature_offline_attendance: false,
        feature_parent_app: false,
        feature_student_app: false,
        status: 'active',
    },
    {
        name: 'Professional',
        platform_type: 'web_only',
        description: 'Colleges & large schools',
        price: 5999,
        yearly_price: 59990,
        max_students: 3000,
        max_faculty: 200,
        max_admin_users: 20,
        max_classes: 100,
        max_storage_mb: 102400,      // 100 GB
        max_ai_messages: 2000,
        is_popular: false,
        is_free_trial: false,
        contact_sales: false,
        display_order: 30,
        feature_attendance: 'advanced',
        feature_auto_attendance: true,
        feature_fees: true,
        feature_exams: true,
        feature_timetable: true,
        feature_announcements: true,
        feature_reports: 'advanced',
        feature_export: true,
        feature_notes: true,
        feature_chat: true,
        feature_finance: true,
        feature_salary: true,
        feature_sms: true,
        feature_email: true,
        feature_whatsapp: true,
        feature_parent_portal: true,
        feature_custom_branding: true,
        feature_multi_branch: false,
        feature_api_access: true,
        feature_public_page: true,
        feature_assignment: true,
        feature_transport: true,
        feature_mobile_app: false,
        feature_push_notifications: false,
        feature_offline_attendance: false,
        feature_parent_app: false,
        feature_student_app: false,
        status: 'active',
    },
    {
        name: 'Enterprise',
        platform_type: 'web_only',
        description: 'Universities & multi-branch',
        price: 12999,
        yearly_price: 129990,
        max_students: -1,
        max_faculty: -1,
        max_admin_users: -1,
        max_classes: -1,
        max_storage_mb: -1,
        max_ai_messages: -1,
        is_popular: false,
        is_free_trial: false,
        contact_sales: false,        // show price, not "contact sales"
        display_order: 40,
        feature_attendance: 'advanced',
        feature_auto_attendance: true,
        feature_fees: true,
        feature_exams: true,
        feature_timetable: true,
        feature_announcements: true,
        feature_reports: 'advanced',
        feature_export: true,
        feature_notes: true,
        feature_chat: true,
        feature_finance: true,
        feature_salary: true,
        feature_sms: true,
        feature_email: true,
        feature_whatsapp: true,
        feature_parent_portal: true,
        feature_custom_branding: true,
        feature_multi_branch: true,
        feature_api_access: true,
        feature_public_page: true,
        feature_assignment: true,
        feature_transport: true,
        feature_mobile_app: false,
        feature_push_notifications: false,
        feature_offline_attendance: false,
        feature_parent_app: false,
        feature_student_app: false,
        status: 'active',
    },

    // ── WEB + MOBILE (web_android) ────────────────────────────────────────────
    {
        name: 'Starter',
        platform_type: 'web_android',
        description: 'Coaching & tuition centres',
        price: 1499,
        yearly_price: 14990,
        max_students: 200,
        max_faculty: 15,
        max_admin_users: 3,
        max_classes: 10,
        max_storage_mb: 5120,
        max_ai_messages: 100,
        is_popular: false,
        is_free_trial: false,
        contact_sales: false,
        display_order: 50,
        feature_attendance: 'basic',
        feature_fees: true,
        feature_exams: true,
        feature_timetable: true,
        feature_announcements: true,
        feature_reports: 'basic',
        feature_export: true,
        feature_notes: true,
        feature_chat: false,
        feature_finance: false,
        feature_salary: false,
        feature_sms: false,
        feature_email: false,
        feature_whatsapp: false,
        feature_parent_portal: false,
        feature_custom_branding: false,
        feature_multi_branch: false,
        feature_api_access: false,
        feature_public_page: false,
        feature_assignment: false,
        feature_transport: false,
        feature_mobile_app: true,
        feature_push_notifications: true,
        feature_offline_attendance: false,
        feature_parent_app: false,
        feature_student_app: true,
        status: 'active',
    },
    {
        name: 'Basic',
        platform_type: 'web_android',
        description: 'Primary & secondary schools',
        price: 3499,
        yearly_price: 34990,
        max_students: 800,
        max_faculty: 60,
        max_admin_users: 8,
        max_classes: 30,
        max_storage_mb: 20480,
        max_ai_messages: 500,
        is_popular: true,
        is_free_trial: false,
        contact_sales: false,
        display_order: 60,
        feature_attendance: 'advanced',
        feature_fees: true,
        feature_exams: true,
        feature_timetable: true,
        feature_announcements: true,
        feature_reports: 'advanced',
        feature_export: true,
        feature_notes: true,
        feature_chat: true,
        feature_finance: true,
        feature_salary: false,
        feature_sms: true,
        feature_email: true,
        feature_whatsapp: false,
        feature_parent_portal: true,
        feature_custom_branding: false,
        feature_multi_branch: false,
        feature_api_access: false,
        feature_public_page: false,
        feature_assignment: true,
        feature_transport: false,
        feature_mobile_app: true,
        feature_push_notifications: true,
        feature_offline_attendance: false,
        feature_parent_app: true,
        feature_student_app: true,
        status: 'active',
    },
    {
        name: 'Professional',
        platform_type: 'web_android',
        description: 'Colleges & large schools',
        price: 7999,
        yearly_price: 79990,
        max_students: 3000,
        max_faculty: 200,
        max_admin_users: 20,
        max_classes: 100,
        max_storage_mb: 102400,
        max_ai_messages: 2000,
        is_popular: false,
        is_free_trial: false,
        contact_sales: false,
        display_order: 70,
        feature_attendance: 'advanced',
        feature_auto_attendance: true,
        feature_fees: true,
        feature_exams: true,
        feature_timetable: true,
        feature_announcements: true,
        feature_reports: 'advanced',
        feature_export: true,
        feature_notes: true,
        feature_chat: true,
        feature_finance: true,
        feature_salary: true,
        feature_sms: true,
        feature_email: true,
        feature_whatsapp: true,
        feature_parent_portal: true,
        feature_custom_branding: true,
        feature_multi_branch: false,
        feature_api_access: true,
        feature_public_page: true,
        feature_assignment: true,
        feature_transport: true,
        feature_mobile_app: true,
        feature_push_notifications: true,
        feature_offline_attendance: true,
        feature_parent_app: true,
        feature_student_app: true,
        status: 'active',
    },
    {
        name: 'Enterprise',
        platform_type: 'web_android',
        description: 'Universities & multi-branch',
        price: 16999,
        yearly_price: 169990,
        max_students: -1,
        max_faculty: -1,
        max_admin_users: -1,
        max_classes: -1,
        max_storage_mb: -1,
        max_ai_messages: -1,
        is_popular: false,
        is_free_trial: false,
        contact_sales: false,
        display_order: 80,
        feature_attendance: 'advanced',
        feature_auto_attendance: true,
        feature_fees: true,
        feature_exams: true,
        feature_timetable: true,
        feature_announcements: true,
        feature_reports: 'advanced',
        feature_export: true,
        feature_notes: true,
        feature_chat: true,
        feature_finance: true,
        feature_salary: true,
        feature_sms: true,
        feature_email: true,
        feature_whatsapp: true,
        feature_parent_portal: true,
        feature_custom_branding: true,
        feature_multi_branch: true,
        feature_api_access: true,
        feature_public_page: true,
        feature_assignment: true,
        feature_transport: true,
        feature_mobile_app: true,
        feature_push_notifications: true,
        feature_offline_attendance: true,
        feature_parent_app: true,
        feature_student_app: true,
        feature_mobile_biometric: true,
        status: 'active',
    },
];

// Count features enabled for a plan (boolean true features)
function countFeatures(plan) {
    const featureKeys = [
        'feature_students', 'feature_faculty', 'feature_classes', 'feature_subjects',
        'feature_fees', 'feature_finance', 'feature_salary', 'feature_announcements',
        'feature_exams', 'feature_export', 'feature_email', 'feature_sms',
        'feature_whatsapp', 'feature_timetable', 'feature_notes', 'feature_chat',
        'feature_custom_branding', 'feature_multi_branch', 'feature_api_access',
        'feature_parent_portal', 'feature_mobile_app', 'feature_public_page',
        'feature_assignment', 'feature_transport', 'feature_push_notifications',
        'feature_offline_attendance', 'feature_parent_app', 'feature_student_app',
    ];
    let count = 0;
    for (const k of featureKeys) {
        if (plan[k] === true) count++;
    }
    // attendance counts as 1 if not 'none'
    if (plan.feature_attendance && plan.feature_attendance !== 'none') count++;
    // reports counts as 1 if not 'none'
    if (plan.feature_reports && plan.feature_reports !== 'none') count++;
    return count;
}

async function run() {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected');

        // Delete old non-lifetime plans and re-insert
        const deleted = await Plan.destroy({
            where: { is_lifetime: false }
        });
        console.log(`🗑  Deleted ${deleted} old plans`);

        // Insert new plans
        const created = await Plan.bulkCreate(NEW_PLANS, { returning: true });
        console.log(`✅ Created ${created.length} plans`);

        // Pair web_only ↔ web_android plans by name
        const byName = {};
        for (const p of created) {
            if (!byName[p.name]) byName[p.name] = {};
            byName[p.name][p.platform_type] = p;
        }

        const pairUpdates = [];
        for (const name of Object.keys(byName)) {
            const wo = byName[name]['web_only'];
            const wa = byName[name]['web_android'];
            if (wo && wa) {
                pairUpdates.push(wo.update({ paired_plan_id: wa.id }));
                pairUpdates.push(wa.update({ paired_plan_id: wo.id }));
            }
        }
        await Promise.all(pairUpdates);
        console.log('🔗 Plans paired (web_only ↔ web_android)');

        // Print summary
        console.log('\n📋 Plan Summary:');
        for (const p of created) {
            const featCount = countFeatures(p);
            const storage = p.max_storage_mb === -1 ? 'Unlimited' : `${(p.max_storage_mb / 1024).toFixed(0)} GB`;
            const students = p.max_students === -1 ? 'Unlimited' : p.max_students;
            const admins = p.max_admin_users === -1 ? 'Unlimited' : p.max_admin_users;
            const faculty = p.max_faculty === -1 ? 'Unlimited' : p.max_faculty;
            console.log(
                `  [${p.platform_type}] ${p.name.padEnd(14)} ` +
                `₹${p.price}/mo | ₹${p.yearly_price}/yr | ` +
                `${students} students | ${admins} admins | ${faculty} faculty | ` +
                `${featCount} features | ${storage}`
            );
        }

        await sequelize.close();
        console.log('\n✅ Done! Plans updated successfully.');
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

run();
