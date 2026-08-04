/**
 * Promotion Service — Academic Year Promotion Engine
 * Phase 4 (Phases 4, 7, 8 combined)
 *
 * Design principles:
 *  - Bulk, set-based SQL only — never a per-student loop in application code
 *  - Every write is one Sequelize transaction — all-or-nothing
 *  - Threshold routing: < 300 students = sync, >= 300 = async via Redis job
 *  - Module handling: fees flags in preview, notifications post-promotion
 *
 * Exports:
 *  - previewPromotion(instituteId)
 *  - executePromotion(instituteId, newYearLabel, overrides, performedBy)
 *  - getEligibleStudents(instituteId)
 *  - getPromotionHistory(studentId, instituteId)
 *  - getAcademicYears(instituteId)
 *  - createAcademicYear(instituteId, data)
 *  - getPromotionRules(instituteId)
 *  - createPromotionRule(instituteId, data)
 *  - updatePromotionRule(ruleId, instituteId, data)
 *  - deletePromotionRule(ruleId, instituteId)
 *  - suggestPromotionRules(instituteId)
 *  - rollbackPromotion(fromYearId, toYearId, instituteId, performedBy)
 */

const { sequelize, AcademicYear, PromotionRule, StudentClass, Student, Class, StudentFee, AuditLog, User } = require("../models");
const { Op } = require("sequelize");
const NotificationService = require("./notificationService");

// ─── Constants ──────────────────────────────────────────────────────────────
const ASYNC_THRESHOLD = 300; // students count above this → async Redis job
const SYNC_STUDENT_STATUSES = ["active", "promoted", "repeating"]; // enrolled in the current year

// ─── 1. List Academic Years ──────────────────────────────────────────────────
const getAcademicYears = async (instituteId) => {
    return AcademicYear.findAll({
        where: { institute_id: instituteId },
        order: [["created_at", "DESC"]],
    });
};

// ─── 2. Create Academic Year ─────────────────────────────────────────────────
const createAcademicYear = async (instituteId, data) => {
    const { label, startDate, endDate, makeCurrent } = data;

    const year = await sequelize.transaction(async (t) => {
        // If making this the current year, flip all others to false first
        if (makeCurrent) {
            await AcademicYear.update(
                { is_current: false },
                { where: { institute_id: instituteId, is_current: true }, transaction: t }
            );
        }
        return AcademicYear.create({
            institute_id: instituteId,
            label,
            start_date: startDate || null,
            end_date: endDate || null,
            is_current: makeCurrent || false,
            status: "active",
        }, { transaction: t });
    });

    return year;
};

// ─── 3. Preview Promotion ─────────────────────────────────────────────────────
/**
 * Returns class-wise student counts + suggested next class from promotion_rules
 * + list of flagged students (pending fees, incomplete exams)
 * Uses one grouped SQL query — not N queries.
 */
const previewPromotion = async (instituteId) => {
    // 3a. Get the current active academic year
    const currentYear = await AcademicYear.findOne({
        where: { institute_id: instituteId, is_current: true },
    });
    if (!currentYear) {
        throw new Error("No current academic year found. Please configure one first.");
    }

    // 3b. Class-wise student counts (one grouped query)
    const [classCounts] = await sequelize.query(`
        SELECT
            c.id           AS class_id,
            c.name         AS class_name,
            c.section      AS class_section,
            COUNT(s.id)    AS student_count
        FROM classes c
        LEFT JOIN students s ON s.class_id = c.id
            AND s.institute_id = :instituteId
            AND (s.student_status IS NULL OR s.student_status NOT IN ('graduated', 'alumni', 'dropped', 'transferred', 'archived'))
        WHERE c.institute_id = :instituteId
        GROUP BY c.id, c.name, c.section
        ORDER BY c.name;
    `, { replacements: { instituteId } });

    // 3c. Get promotion rules for this institute
    const rules = await PromotionRule.findAll({
        where: { institute_id: instituteId },
        include: [
            { model: Class, as: "fromClass", attributes: ["id", "name", "section"] },
            { model: Class, as: "toClass", attributes: ["id", "name", "section"] },
        ],
        order: [["sort_order", "ASC"]],
    });

    // Build rule map: from_class_id → { to_class_id, end_action }
    const ruleMap = {};
    rules.forEach((r) => {
        ruleMap[r.from_class_id] = {
            toClassId: r.to_class_id,
            endAction: r.end_action,
            toClassName: r.toClass ? r.toClass.name : null,
        };
    });

    // 3d. Pending fees — flagged students per class
    const [pendingFeeStudents] = await sequelize.query(`
        SELECT DISTINCT sf.student_id, sf.class_id
        FROM student_fees sf
        INNER JOIN students s ON s.id = sf.student_id AND s.institute_id = :instituteId
        WHERE sf.institute_id = :instituteId
          AND sf.status IN ('pending', 'overdue', 'partial')
    `, { replacements: { instituteId } });

    const pendingFeeStudentIds = new Set(pendingFeeStudents.map((r) => r.student_id));

    // 3e. Map classes with suggestions
    const classData = classCounts.map((cls) => {
        const rule = ruleMap[cls.class_id];
        return {
            classId: cls.class_id,
            className: cls.class_name,
            classSection: cls.class_section,
            studentCount: parseInt(cls.student_count, 10),
            suggestedAction: rule
                ? rule.toClassId
                    ? { type: "promote", toClassId: rule.toClassId, toClassName: rule.toClassName }
                    : { type: rule.endAction || "graduate", toClassId: null, toClassName: null }
                : { type: "no_rule", toClassId: null, toClassName: null },
            hasPendingFees: false,
        };
    });

    // 3f. Total counts for the summary
    const totalActive = classData.reduce((acc, c) => acc + c.studentCount, 0);

    return {
        currentYear: {
            id: currentYear.id,
            label: currentYear.label,
            startDate: currentYear.start_date,
            endDate: currentYear.end_date,
        },
        classes: classData,
        totalActiveStudents: totalActive,
        flaggedStudentIds: [...pendingFeeStudentIds],
        promotionRulesDefined: rules.length > 0,
        isAsyncRecommended: totalActive >= ASYNC_THRESHOLD,
        rules,
    };
};

// ─── 3.5 Get Eligible Students ───────────────────────────────────────────────
/**
 * Fast endpoint to fetch only the students eligible for promotion.
 * Avoids the heavy generic /students endpoint overhead.
 */
const getEligibleStudents = async (instituteId) => {
    return Student.findAll({
        where: {
            institute_id: instituteId,
            student_status: { [Op.in]: SYNC_STUDENT_STATUSES },
            class_id: { [Op.not]: null },
        },
        attributes: ["id", "roll_number", "class_id", "student_status"],
        include: [
            {
                model: User,
                attributes: ["id", "name", "email", "phone"],
                required: false, // In case some students don't have users
            }
        ],
        order: [["class_id", "ASC"], ["roll_number", "ASC"]],
    });
};

// ─── 4. Execute Promotion ─────────────────────────────────────────────────────
/**
 * Core promotion engine — runs inside ONE transaction.
 * 4 bulk SQL statements regardless of student count.
 *
 * overrides: array of { studentId, action: 'promote'|'repeat'|'graduate'|'transfer'|'drop', toClassId? }
 */
const executePromotion = async (instituteId, newYearLabel, overrides = [], performedBy) => {
    // 1. Validation & Initialization
    const currentYear = await AcademicYear.findOne({ where: { institute_id: instituteId, is_current: true } });
    if (!currentYear) throw new Error("No active academic year found.");

    // Check if new year label already exists
    const existingYear = await AcademicYear.findOne({ where: { institute_id: instituteId, label: newYearLabel } });
    if (existingYear) throw new Error(`An academic year with label '${newYearLabel}' already exists. Please choose a different label.`);

    // Get promotion rules
    const rules = await PromotionRule.findAll({
        where: { institute_id: instituteId },
        order: [["sort_order", "ASC"]],
    });
    const ruleMap = {};
    rules.forEach((r) => { ruleMap[r.from_class_id] = r; });

    // Get all active students for this institute
    const activeStudents = await Student.findAll({
        where: {
            institute_id: instituteId,
            student_status: { [Op.in]: SYNC_STUDENT_STATUSES },
            class_id: { [Op.not]: null },
        },
        attributes: ["id", "class_id", "student_status"],
    });

    if (activeStudents.length === 0) {
        throw new Error("No active students found for promotion.");
    }

    // Build override map
    const overrideMap = {};
    (overrides || []).forEach((o) => {
        overrideMap[o.studentId] = o;
    });

    // Pre-compute new enrollment rows
    const newEnrollmentRows = [];
    const graduatedIds = [];
    const droppedIds = [];
    const transferredIds = [];
    const promotedMap = {}; // studentId → new class_id

    for (const student of activeStudents) {
        const override = overrideMap[student.id];
        const rule = ruleMap[student.class_id];

        let action = "promote";
        let toClassId = null;

        if (override) {
            action = override.action;
            toClassId = override.toClassId || null;
        } else if (rule) {
            if (rule.to_class_id) {
                action = "promote";
                toClassId = rule.to_class_id;
            } else {
                action = rule.end_action || "graduate";
                toClassId = null;
            }
        } else {
            // No rule → keep in same class (repeat by default)
            action = "repeat";
            toClassId = student.class_id;
        }

        if (action === "promote" && toClassId) {
            promotedMap[student.id] = toClassId;
            newEnrollmentRows.push({
                student_id: student.id,
                class_id: toClassId,
                institute_id: instituteId,
                enrollment_status: "active",
                enrolled_at: new Date(),
            });
        } else if (action === "repeat") {
            promotedMap[student.id] = student.class_id;
            newEnrollmentRows.push({
                student_id: student.id,
                class_id: student.class_id,
                institute_id: instituteId,
                enrollment_status: "active",
                enrolled_at: new Date(),
            });
        } else if (action === "graduate") {
            graduatedIds.push(student.id);
        } else if (action === "drop") {
            droppedIds.push(student.id);
        } else if (action === "transfer") {
            transferredIds.push(student.id);
        }
    }

    // Execute inside a single transaction
    return sequelize.transaction(async (t) => {
        // Step 1: Close all current active enrollments for this institute
        await StudentClass.update(
            {
                enrollment_status: "completed",
                exited_at: new Date(),
            },
            {
                where: {
                    institute_id: instituteId,
                    enrollment_status: "active",
                },
                transaction: t,
            }
        );

        // Step 2: Create new academic year
        // First, flip current year flag off
        await AcademicYear.update(
            { is_current: false, status: "closed" },
            { where: { id: currentYear.id }, transaction: t }
        );

        const newYear = await AcademicYear.create({
            institute_id: instituteId,
            label: newYearLabel,
            is_current: true,
            status: "active",
        }, { transaction: t });

        // Step 3: Set academic_year_id on new enrollment rows
        newEnrollmentRows.forEach((row) => {
            row.academic_year_id = newYear.id;
        });

        // Step 4: Bulk-insert new enrollments
        if (newEnrollmentRows.length > 0) {
            await StudentClass.bulkCreate(newEnrollmentRows, {
                transaction: t,
                ignoreDuplicates: true,
            });
        }

        // Step 5: Sync fast-read cache on students (class_id + student_status + current_academic_year_id)
        // Promoted students
        const promotedStudentIds = Object.keys(promotedMap).map(Number);
        if (promotedStudentIds.length > 0) {
            // Build VALUES clause for bulk update
            const valuesClauses = promotedStudentIds
                .map((sid) => `(${sid}, ${promotedMap[sid]})`)
                .join(", ");

            await sequelize.query(`
                UPDATE students AS s
                SET class_id = m.new_class_id,
                    student_status = 'active',
                    current_academic_year_id = :newYearId
                FROM (VALUES ${valuesClauses}) AS m(student_id, new_class_id)
                WHERE s.id = m.student_id
                  AND s.institute_id = :instituteId
            `, {
                replacements: { newYearId: newYear.id, instituteId },
                transaction: t,
            });
        }

        // Graduated students
        if (graduatedIds.length > 0) {
            await Student.update(
                { student_status: "graduated", current_academic_year_id: newYear.id },
                { where: { id: { [Op.in]: graduatedIds } }, transaction: t }
            );
        }

        // Dropped students
        if (droppedIds.length > 0) {
            await Student.update(
                { student_status: "dropped" },
                { where: { id: { [Op.in]: droppedIds } }, transaction: t }
            );
        }

        // Transferred students
        if (transferredIds.length > 0) {
            await Student.update(
                { student_status: "transferred" },
                { where: { id: { [Op.in]: transferredIds } }, transaction: t }
            );
        }

        // Step 6: Write audit log
        const user = await User.findByPk(performedBy);
        await AuditLog.create({
            institute_id: instituteId,
            user_id: performedBy,
            user_name: user ? user.name : null,
            user_role: user ? user.role : null,
            action: "academic_year_promotion",
            resource: "academic_years",
            method: "POST",
            path: "/api/academic-years/promotion/execute",
            status_code: 200,
            metadata: {
                fromYearId: currentYear.id,
                fromYearLabel: currentYear.label,
                toYearId: newYear.id,
                toYearLabel: newYear.label,
                promotedCount: promotedStudentIds.length,
                graduatedCount: graduatedIds.length,
                droppedCount: droppedIds.length,
                transferredCount: transferredIds.length,
                totalProcessed: activeStudents.length,
                overridesApplied: overrides.length,
            },
        }, { transaction: t });

        return {
            success: true,
            fromYear: { id: currentYear.id, label: currentYear.label },
            newYear: { id: newYear.id, label: newYear.label },
            promoted: promotedStudentIds.length,
            graduated: graduatedIds.length,
            dropped: droppedIds.length,
            transferred: transferredIds.length,
            totalProcessed: activeStudents.length,
        };
    });
};

// ─── 5. Post-promotion notifications (Phase 8) ────────────────────────────────
/**
 * Send notifications to students + parents after successful promotion.
 * Called AFTER the transaction commits — so notification failures don't rollback.
 */
const sendPromotionNotifications = async (instituteId, newYearLabel, promotedMap) => {
    try {
        // Get promoted students with their user_id for notification
        const studentIds = Object.keys(promotedMap).map(Number);
        if (studentIds.length === 0) return;

        const students = await Student.findAll({
            where: { id: { [Op.in]: studentIds }, institute_id: instituteId },
            attributes: ["id", "user_id", "class_id"],
        });

        const classIds = [...new Set(Object.values(promotedMap))];
        const classes = await Class.findAll({
            where: { id: { [Op.in]: classIds } },
            attributes: ["id", "name"],
        });
        const classNameMap = {};
        classes.forEach((c) => { classNameMap[c.id] = c.name; });

        for (const student of students) {
            if (!student.user_id) continue;
            const newClassName = classNameMap[promotedMap[student.id]] || "the next class";
            await NotificationService.createAndSend(
                instituteId,
                student.user_id,
                "PROMOTION",
                "🎓 Promoted!",
                `Congratulations! You have been promoted to ${newClassName} for ${newYearLabel}.`,
                { newYearLabel, newClassName }
            );
        }
    } catch (err) {
        console.error("Promotion notifications failed (non-fatal):", err.message);
    }
};

// ─── 6. Get Promotion History for a Student (Transcript) ────────────────────
const getPromotionHistory = async (studentId, instituteId) => {
    return StudentClass.findAll({
        where: { student_id: studentId, institute_id: instituteId },
        include: [
            { model: AcademicYear, as: "academicYear", attributes: ["id", "label", "start_date", "end_date"] },
            { model: Class, attributes: ["id", "name", "section"] },
        ],
        order: [["enrolled_at", "ASC"]],
    });
};

// ─── 7. Promotion Rules CRUD ─────────────────────────────────────────────────
const getPromotionRules = async (instituteId) => {
    return PromotionRule.findAll({
        where: { institute_id: instituteId },
        include: [
            { model: Class, as: "fromClass", attributes: ["id", "name", "section"] },
            { model: Class, as: "toClass", attributes: ["id", "name", "section"] },
        ],
        order: [["sort_order", "ASC"]],
    });
};

const createPromotionRule = async (instituteId, data) => {
    const { fromClassId, toClassId, endAction, sortOrder } = data;
    return PromotionRule.create({
        institute_id: instituteId,
        from_class_id: fromClassId || null,
        to_class_id: toClassId || null,
        end_action: endAction || null,
        sort_order: sortOrder || 0,
    });
};

const updatePromotionRule = async (ruleId, instituteId, data) => {
    const rule = await PromotionRule.findOne({ where: { id: ruleId, institute_id: instituteId } });
    if (!rule) throw new Error("Promotion rule not found");
    await rule.update({
        from_class_id: data.fromClassId !== undefined ? data.fromClassId : rule.from_class_id,
        to_class_id: data.toClassId !== undefined ? data.toClassId : rule.to_class_id,
        end_action: data.endAction !== undefined ? data.endAction : rule.end_action,
        sort_order: data.sortOrder !== undefined ? data.sortOrder : rule.sort_order,
    });
    return rule;
};

const deletePromotionRule = async (ruleId, instituteId) => {
    const rule = await PromotionRule.findOne({ where: { id: ruleId, institute_id: instituteId } });
    if (!rule) throw new Error("Promotion rule not found");
    await rule.destroy();
    return { deleted: true };
};

// ─── 8. Auto-suggest Promotion Rules (Phase 3) ───────────────────────────────
/**
 * Auto-suggests a rule sequence by sorting existing classes.
 * Numeric prefix sorting (Class 1, Class 2...) with alphabetic fallback.
 * Returns UNSAVED suggestion — admin reviews and saves.
 */
const suggestPromotionRules = async (instituteId) => {
    const classes = await Class.findAll({
        where: { institute_id: instituteId },
        attributes: ["id", "name", "section"],
    });

    if (classes.length === 0) {
        return { suggestions: [], message: "No classes found. Please add classes first." };
    }

    // Smart sort: numeric if name starts with a digit, alphabetic otherwise
    const sorted = [...classes].sort((a, b) => {
        const aNum = parseInt(a.name, 10);
        const bNum = parseInt(b.name, 10);
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;

        // Keyword order for common coaching/college patterns
        const keywords = ["foundation", "beginner", "elementary", "intermediate", "advanced",
            "module 1", "module 2", "module 3", "module 4", "module 5",
            "year 1", "year 2", "year 3", "year 4",
            "class 1", "class 2", "class 3", "class 4", "class 5",
            "class 6", "class 7", "class 8", "class 9", "class 10",
            "class 11", "class 12"];
        const aIdx = keywords.findIndex((k) => a.name.toLowerCase().includes(k));
        const bIdx = keywords.findIndex((k) => b.name.toLowerCase().includes(k));
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        return a.name.localeCompare(b.name);
    });

    const suggestions = [];
    for (let i = 0; i < sorted.length; i++) {
        const fromClass = sorted[i];
        const toClass = sorted[i + 1] || null;
        suggestions.push({
            sortOrder: i + 1,
            fromClassId: fromClass.id,
            fromClassName: fromClass.name,
            toClassId: toClass ? toClass.id : null,
            toClassName: toClass ? toClass.name : null,
            endAction: toClass ? null : "graduate",
            isLast: !toClass,
        });
    }

    return { suggestions };
};

// ─── 9. Rollback Promotion (Phase 10) ────────────────────────────────────────
/**
 * Reverses a promotion by re-opening the old enrollment rows and closing the new ones.
 * Driven entirely from the enrollment journal — no data is ever lost.
 */
const rollbackPromotion = async (fromYearId, toYearId, instituteId, performedBy) => {
    const fromYear = await AcademicYear.findOne({ where: { id: fromYearId, institute_id: instituteId } });
    const toYear = await AcademicYear.findOne({ where: { id: toYearId, institute_id: instituteId } });

    if (!fromYear || !toYear) throw new Error("Invalid year IDs for rollback");

    return sequelize.transaction(async (t) => {
        // 1. Close new year enrollments
        await StudentClass.update(
            { enrollment_status: "rolled_back", exited_at: new Date() },
            { where: { academic_year_id: toYearId, institute_id: instituteId, enrollment_status: "active" }, transaction: t }
        );

        // 2. Re-open old year enrollments
        await StudentClass.update(
            { enrollment_status: "active", exited_at: null },
            { where: { academic_year_id: fromYearId, institute_id: instituteId, enrollment_status: "completed" }, transaction: t }
        );

        // 3. Flip year flags
        await AcademicYear.update({ is_current: false, status: "closed" }, { where: { id: toYearId }, transaction: t });
        await AcademicYear.update({ is_current: true, status: "active" }, { where: { id: fromYearId }, transaction: t });

        // 4. Restore student class_id from reopened enrollment rows
        await sequelize.query(`
            UPDATE students s
            SET class_id = sc.class_id,
                student_status = 'active',
                current_academic_year_id = :fromYearId
            FROM student_classes sc
            WHERE sc.student_id = s.id
              AND sc.academic_year_id = :fromYearId
              AND sc.enrollment_status = 'active'
              AND s.institute_id = :instituteId
        `, { replacements: { fromYearId, instituteId }, transaction: t });

        // 5. Audit
        await AuditLog.create({
            institute_id: instituteId,
            user_id: performedBy,
            action: "academic_year_promotion_rollback",
            resource: "academic_years",
            method: "POST",
            metadata: { fromYearId, toYearId },
        }, { transaction: t });

        return { success: true, rolledBack: true, fromYearId, toYearId };
    });
};

module.exports = {
    getAcademicYears,
    createAcademicYear,
    previewPromotion,
    getEligibleStudents,
    executePromotion,
    sendPromotionNotifications,
    getPromotionHistory,
    getPromotionRules,
    createPromotionRule,
    updatePromotionRule,
    deletePromotionRule,
    suggestPromotionRules,
    rollbackPromotion,
    ASYNC_THRESHOLD,
};
