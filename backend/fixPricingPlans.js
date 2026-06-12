/**
 * Fix Pricing Plans
 * Aligns DB plan data with Update_Plans.md spec.
 * Uses UPDATE (not DELETE) to avoid FK constraint violations from institutes table.
 *
 * Run: node fixPricingPlans.js  (from backend/ directory)
 *
 * Feature mapping per spec (comparison table):
 *   Starter  = 12 features (from 26-feature list)
 *   Basic    = 18 features
 *   Pro      = 24 features
 *   Enterprise = 26 features (all)
 */

require('dotenv').config();

const sequelize = require('./config/database');
const Plan = require('./models/plan');

// ─── Shared feature sets (cumulative) ────────────────────────────────────────

const STARTER_FEATURES = {
    // Attendance (features 3,4,5)
    feature_attendance: 'basic',
    feature_scan_qr: true,          // #5 Scan Student QR
    feature_faculty_attendance: false,
    feature_faculty_tracker: false,
    feature_biometric: false,
    feature_auto_attendance: false,

    // Finance (feature 13 only)
    feature_fees: true,             // #13 Collect Fees
    feature_finance: false,
    feature_salary: false,

    // Academics
    feature_exams: false,
    feature_timetable: false,
    feature_assignment: true,       // #21 Assignments

    // Communication
    feature_announcements: true,    // #18 Announcements
    feature_notes: true,            // #19 All Notes
    feature_chat: false,

    // Reports
    feature_reports: 'none',
    feature_export: false,
    feature_performance_analytics: false,
    feature_performance_hub: false,

    // Notifications
    feature_email: false,
    feature_sms: false,
    feature_whatsapp: false,

    // Portal / branding
    feature_parent_portal: false,   // #7 Manage Parents — NOT in Starter
    feature_faculty: false,         // #8 Manage Faculty — NOT in Starter
    feature_public_page: true,      // #22 Institute Public Web Page
    feature_custom_branding: false,
    feature_multi_branch: false,
    feature_api_access: false,
    feature_transport: false,
};

const BASIC_FEATURES = {
    ...STARTER_FEATURES,
    // Add Manage Faculty (#8)
    feature_faculty: true,
    // Add Faculty Attendance (#9) + Faculty Tracker (#10, #11)
    feature_faculty_attendance: true,
    feature_faculty_tracker: true,
    // Add Manage Parents (#7)
    feature_parent_portal: true,
    // Add Finances (#14)
    feature_finance: true,
    // Add Reports (#15)
    feature_reports: 'basic',
    // Add Exams (#16)
    feature_exams: true,
    // Add Timetable (#17)
    feature_timetable: true,
    // Add Chat (#20)
    feature_chat: true,
    // Add Exam Reports (#23)
    feature_export: true,
    // Notifications
    feature_email: true,
    feature_sms: true,
};

const PROFESSIONAL_FEATURES = {
    ...BASIC_FEATURES,
    // Advanced attendance
    feature_attendance: 'advanced',
    feature_auto_attendance: true,
    // Add Biometric (#25)
    feature_biometric: true,
    // Add Student + Faculty Performance Analytics (#24, #26)
    feature_performance_analytics: true,
    feature_performance_hub: true,  // keep legacy in sync
    // Advanced reports (#advanced custom)
    feature_reports: 'advanced',
    // Full finance
    feature_salary: true,
    // All notifications
    feature_whatsapp: true,
    // Pro branding
    feature_custom_branding: true,
    feature_api_access: true,
    feature_transport: true,
};

const ENTERPRISE_FEATURES = {
    ...PROFESSIONAL_FEATURES,
    // Feature: Multi-Branch (#27 in comparison table = Enterprise only)
    feature_multi_branch: true,
};

// ─── Web + Mobile additional features ────────────────────────────────────────

const MOBILE_STARTER = {
    feature_mobile_app: true,
    feature_push_notifications: true,
    feature_student_app: true,
    feature_parent_app: false,
    feature_offline_attendance: false,
    feature_mobile_biometric: false,
};
const MOBILE_BASIC = {
    feature_mobile_app: true,
    feature_push_notifications: true,
    feature_student_app: true,
    feature_parent_app: true,
    feature_offline_attendance: false,
    feature_mobile_biometric: false,
};
const MOBILE_PRO = {
    feature_mobile_app: true,
    feature_push_notifications: true,
    feature_student_app: true,
    feature_parent_app: true,
    feature_offline_attendance: true,
    feature_mobile_biometric: true,
};
const MOBILE_ENTERPRISE = { ...MOBILE_PRO };

// ─── Web-only (no mobile features) ───────────────────────────────────────────
const WEB_MOBILE_OFF = {
    feature_mobile_app: false,
    feature_push_notifications: false,
    feature_student_app: false,
    feature_parent_app: false,
    feature_offline_attendance: false,
    feature_mobile_biometric: false,
};

// ─── All 8 plans ─────────────────────────────────────────────────────────────
const NEW_PLANS = [
    // ── WEB ONLY ────────────────────────────────────────────────────────────
    {
        name: 'Starter', platform_type: 'web_only',
        description: 'Coaching & tuition centres',
        price: 999, yearly_price: 9990, yearly_discount_percent: 17,
        max_students: 200, max_faculty: 15, max_admin_users: 3,
        max_classes: 10, max_storage_mb: 5120, max_ai_messages: 100, max_chat_messages: 200, max_biometric_devices: 0,
        feature_count: 12,
        is_popular: false, is_free_trial: false, contact_sales: false,
        display_order: 10, status: 'active',
        ...STARTER_FEATURES, ...WEB_MOBILE_OFF,
    },
    {
        name: 'Basic', platform_type: 'web_only',
        description: 'Primary & secondary schools',
        price: 2499, yearly_price: 24990, yearly_discount_percent: 17,
        max_students: 800, max_faculty: 60, max_admin_users: 8,
        max_classes: 30, max_storage_mb: 20480, max_ai_messages: 500, max_chat_messages: 1000, max_biometric_devices: 0,
        feature_count: 18,
        is_popular: true, is_free_trial: false, contact_sales: false,
        display_order: 20, status: 'active',
        ...BASIC_FEATURES, ...WEB_MOBILE_OFF,
    },
    {
        name: 'Professional', platform_type: 'web_only',
        description: 'Colleges & large schools',
        price: 5999, yearly_price: 59990, yearly_discount_percent: 17,
        max_students: 3000, max_faculty: 200, max_admin_users: 20,
        max_classes: 100, max_storage_mb: 102400, max_ai_messages: 2000, max_chat_messages: 5000, max_biometric_devices: 5,
        feature_count: 24,
        is_popular: false, is_free_trial: false, contact_sales: false,
        display_order: 30, status: 'active',
        ...PROFESSIONAL_FEATURES, ...WEB_MOBILE_OFF,
    },
    {
        name: 'Enterprise', platform_type: 'web_only',
        description: 'Universities & multi-branch',
        price: 12999, yearly_price: 129990, yearly_discount_percent: 17,
        max_students: -1, max_faculty: -1, max_admin_users: -1,
        max_classes: -1, max_storage_mb: -1, max_ai_messages: -1, max_chat_messages: -1, max_biometric_devices: -1,
        feature_count: 26,
        is_popular: false, is_free_trial: false, contact_sales: false,
        display_order: 40, status: 'active',
        ...ENTERPRISE_FEATURES, ...WEB_MOBILE_OFF,
    },

    // ── WEB + MOBILE (web_android) ───────────────────────────────────────────
    {
        name: 'Starter', platform_type: 'web_android',
        description: 'Coaching & tuition centres',
        price: 1499, yearly_price: 14990, yearly_discount_percent: 17,
        max_students: 200, max_faculty: 15, max_admin_users: 3,
        max_classes: 10, max_storage_mb: 5120, max_ai_messages: 100, max_chat_messages: 200, max_biometric_devices: 0,
        feature_count: 12,
        is_popular: false, is_free_trial: false, contact_sales: false,
        display_order: 50, status: 'active',
        ...STARTER_FEATURES, ...MOBILE_STARTER,
    },
    {
        name: 'Basic', platform_type: 'web_android',
        description: 'Primary & secondary schools',
        price: 3499, yearly_price: 34990, yearly_discount_percent: 17,
        max_students: 800, max_faculty: 60, max_admin_users: 8,
        max_classes: 30, max_storage_mb: 20480, max_ai_messages: 500, max_chat_messages: 1000, max_biometric_devices: 0,
        feature_count: 18,
        is_popular: true, is_free_trial: false, contact_sales: false,
        display_order: 60, status: 'active',
        ...BASIC_FEATURES, ...MOBILE_BASIC,
    },
    {
        name: 'Professional', platform_type: 'web_android',
        description: 'Colleges & large schools',
        price: 7999, yearly_price: 79990, yearly_discount_percent: 17,
        max_students: 3000, max_faculty: 200, max_admin_users: 20,
        max_classes: 100, max_storage_mb: 102400, max_ai_messages: 2000, max_chat_messages: 5000, max_biometric_devices: 5,
        feature_count: 24,
        is_popular: false, is_free_trial: false, contact_sales: false,
        display_order: 70, status: 'active',
        ...PROFESSIONAL_FEATURES, ...MOBILE_PRO,
    },
    {
        name: 'Enterprise', platform_type: 'web_android',
        description: 'Universities & multi-branch',
        price: 16999, yearly_price: 169990, yearly_discount_percent: 17,
        max_students: -1, max_faculty: -1, max_admin_users: -1,
        max_classes: -1, max_storage_mb: -1, max_ai_messages: -1, max_chat_messages: -1, max_biometric_devices: -1,
        feature_count: 26,
        is_popular: false, is_free_trial: false, contact_sales: false,
        display_order: 80, status: 'active',
        ...ENTERPRISE_FEATURES, ...MOBILE_ENTERPRISE,
    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function storageLabel(mb) {
    if (mb === -1) return 'Unlimited';
    if (mb >= 1024) return `${(mb / 1024).toFixed(0)} GB`;
    return `${mb} MB`;
}

// ─── Run ──────────────────────────────────────────────────────────────────────
async function run() {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected');

        // Sync only the Plan model to add new columns (ALTER TABLE safe)
        await Plan.sync({ alter: true });
        console.log('✅ Plan table synced (new columns added if missing)');

        let updated = 0, created = 0;

        for (const planData of NEW_PLANS) {
            const { name, platform_type, ...fields } = planData;

            const existing = await Plan.findOne({ where: { name, platform_type } });

            if (existing) {
                await existing.update(fields);
                updated++;
                console.log(`  ✏️  Updated  [${platform_type}] ${name}`);
            } else {
                await Plan.create({ name, platform_type, ...fields });
                created++;
                console.log(`  ➕ Created  [${platform_type}] ${name}`);
            }
        }

        console.log(`\n✅ ${updated} updated, ${created} created`);

        // Re-pair plans by name
        const allPlans = await Plan.findAll({ where: { is_lifetime: false } });
        const byName = {};
        for (const p of allPlans) {
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

        // Summary table
        const finalPlans = await Plan.findAll({
            where: { is_lifetime: false, status: 'active' },
            order: [['display_order', 'ASC']],
        });

        console.log('\n📋 Final Plan Summary:');
        console.log('  Platform       Name          ₹/mo     ₹/yr      Students  Admins  Faculty  Feats  Storage');
        console.log('  ' + '-'.repeat(94));
        for (const p of finalPlans) {
            const stu = p.max_students    === -1 ? 'Unlimited' : p.max_students;
            const adm = p.max_admin_users === -1 ? 'Unlimited' : p.max_admin_users;
            const fac = p.max_faculty     === -1 ? 'Unlimited' : p.max_faculty;
            console.log(
                `  ${p.platform_type.padEnd(14)} ${p.name.padEnd(13)}` +
                ` ${String(p.price).padEnd(8)} ${String(p.yearly_price).padEnd(9)}` +
                ` ${String(stu).padEnd(9)} ${String(adm).padEnd(7)} ${String(fac).padEnd(8)}` +
                ` ${String(p.feature_count).padEnd(6)} ${storageLabel(p.max_storage_mb)}`
            );
        }

        await sequelize.close();
        console.log('\n✅ All done! Restart server to clear plan cache.');
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

run();
