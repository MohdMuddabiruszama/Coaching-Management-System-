/**
 * Salary Auto-Generate Service
 * Phase 4 — Faculty Salary.md
 *
 * On the 1st of every month at 00:01 AM IST, auto-creates PENDING salary
 * records for all active faculty based on their salary settings.
 *
 * Admin never has to manually create salary records — just review & click Pay.
 *
 * Performance: BATCH INSERT — one query per month, not one per faculty.
 */

const { FacultySalarySettings, FacultySalary, Faculty } = require("../models");
const { computeNetSalary, buildDueDate, getCurrentMonthYear } = require("../utils/salaryCalc");

/**
 * Auto-generate pending salary records for ALL active faculty
 * across ALL active institutes for the target month.
 *
 * @param {string|null} month_year - Target month (YYYY-MM). Defaults to current month.
 * @returns {{ generated: number, skipped: number }}
 */
async function generateMonthlySalaries(month_year = null) {
    const targetMonth = month_year || getCurrentMonthYear();
    console.log(`[Salary Cron] Auto-generating salaries for ${targetMonth}...`);

    // Get ALL active salary settings across ALL institutes in one query
    const settings = await FacultySalarySettings.findAll({
        where:      { is_active: true },
        attributes: ['id', 'institute_id', 'faculty_id', 'basic_salary',
                     'allowances', 'salary_due_day', 'working_days_default'],
        raw: true,
    });

    if (!settings.length) {
        console.log('[Salary Cron] No active salary settings found. Nothing to generate.');
        return { generated: 0, skipped: 0 };
    }

    // Fetch actual Faculty IDs for these User IDs
    const userIds = settings.map(s => s.faculty_id);
    const faculties = await Faculty.findAll({
        where: { user_id: userIds },
        attributes: ['id', 'user_id', 'institute_id'],
        raw: true,
    });
    
    const facultyIdMap = {};
    for (const f of faculties) {
        facultyIdMap[`${f.user_id}_${f.institute_id}`] = f.id;
    }

    // Check which faculty ALREADY have a record for this month
    const existingFacultyIds = new Set(
        (await FacultySalary.findAll({
            where: {
                month_year: targetMonth,
                faculty_id: Object.values(facultyIdMap),  // scoped to actual faculty IDs
            },
            attributes: ['faculty_id', 'institute_id'],
            raw: true,
        })).map(r => `${r.faculty_id}_${r.institute_id}`)     // composite key
    );

    // Build batch insert array
    const toCreate = [];
    let skipped    = 0;

    for (const s of settings) {
        const actualFacultyId = facultyIdMap[`${s.faculty_id}_${s.institute_id}`];
        if (!actualFacultyId) continue; // Skip if no mapping found

        const compositeKey = `${actualFacultyId}_${s.institute_id}`;
        if (existingFacultyIds.has(compositeKey)) { skipped++; continue; }

        const { net_salary } = computeNetSalary({
            basic_salary: s.basic_salary,
            allowances:   s.allowances,
            deductions:   0,
            advance_paid: 0,
            present_days: s.working_days_default, // full attendance assumed initially
            working_days: s.working_days_default,
        });

        toCreate.push({
            institute_id:    s.institute_id,
            faculty_id:      actualFacultyId,
            month_year:      targetMonth,
            basic_salary:    s.basic_salary,
            allowances:      s.allowances,
            deductions:      0,
            advance_paid:    0,
            net_salary,
            working_days:    s.working_days_default,
            present_days:    s.working_days_default,
            payment_due_date: buildDueDate(targetMonth, s.salary_due_day),
            status:          'pending',
            auto_generated:  true,
        });
    }

    // BATCH INSERT
    if (toCreate.length > 0) {
        await FacultySalary.bulkCreate(toCreate, {
            ignoreDuplicates: true,
        });
    }

    console.log(`[Salary Cron] Done: ${toCreate.length} created, ${skipped} skipped (already exist).`);
    return { generated: toCreate.length, skipped };
}

module.exports = { generateMonthlySalaries };
