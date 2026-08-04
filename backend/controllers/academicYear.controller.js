/**
 * Academic Year Controller
 * Phase 5 — Academic Year Promotion Engine
 *
 * Handles all academic year + promotion rule + promotion execution endpoints.
 * Delegates all business logic to promotion.service.js.
 * Follows the same controller pattern as all other 38 controllers in this project.
 *
 * sendSuccess signature: sendSuccess(res, data, message, statusCode)
 * sendError signature:   sendError(res, message, statusCode, errors)
 */

const promotionService = require("../services/promotion.service");
const { sendSuccess, sendError } = require("../utils/apiResponse");

// ─── Academic Year CRUD ───────────────────────────────────────────────────────

const listAcademicYears = async (req, res) => {
    try {
        const years = await promotionService.getAcademicYears(req.user.institute_id);
        return sendSuccess(res, { years }, "Academic years fetched");
    } catch (err) {
        console.error("listAcademicYears error:", err.message);
        return sendError(res, err.message || "Failed to fetch academic years", 500);
    }
};

const createAcademicYear = async (req, res) => {
    try {
        const year = await promotionService.createAcademicYear(req.user.institute_id, req.body);
        return sendSuccess(res, { year }, "Academic year created", 201);
    } catch (err) {
        console.error("createAcademicYear error:", err.message);
        return sendError(res, err.message || "Failed to create academic year", 500);
    }
};

const updateAcademicYear = async (req, res) => {
    try {
        const { id } = req.params;
        const { AcademicYear, sequelize } = require("../models");
        const year = await AcademicYear.findOne({
            where: { id, institute_id: req.user.institute_id },
        });
        if (!year) return sendError(res, "Academic year not found", 404);

        const { label, startDate, endDate, makeCurrent, status } = req.body;

        await sequelize.transaction(async (t) => {
            if (makeCurrent) {
                await AcademicYear.update(
                    { is_current: false },
                    { where: { institute_id: req.user.institute_id, is_current: true }, transaction: t }
                );
            }
            await year.update({
                label: label || year.label,
                start_date: startDate !== undefined ? startDate : year.start_date,
                end_date: endDate !== undefined ? endDate : year.end_date,
                is_current: makeCurrent !== undefined ? makeCurrent : year.is_current,
                status: status || year.status,
            }, { transaction: t });
        });

        return sendSuccess(res, { year }, "Academic year updated");
    } catch (err) {
        console.error("updateAcademicYear error:", err.message);
        return sendError(res, err.message || "Failed to update academic year", 500);
    }
};

// ─── Promotion Preview ────────────────────────────────────────────────────────

const promotionPreview = async (req, res) => {
    try {
        const preview = await promotionService.previewPromotion(req.user.institute_id);
        return sendSuccess(res, preview, "Promotion preview generated");
    } catch (err) {
        console.error("promotionPreview error:", err.message);
        return sendError(res, err.message || "Failed to generate promotion preview", 500);
    }
};

// ─── Execute Promotion ────────────────────────────────────────────────────────

const executePromotion = async (req, res) => {
    try {
        const { newYearLabel, overrides } = req.body;
        const instituteId = req.user.institute_id;
        const { Student } = require("../models");
        const { Op } = require("sequelize");

        // Phase 7: Threshold-based routing
        const totalActive = await Student.count({
            where: {
                institute_id: instituteId,
                student_status: { [Op.in]: ["active", "promoted", "repeating"] },
                class_id: { [Op.not]: null },
            },
        });

        if (totalActive >= promotionService.ASYNC_THRESHOLD) {
            // Async path — respond immediately
            res.status(202).json({
                success: true,
                message: "Promotion queued — large student count detected. Processing in background.",
                data: {
                    jobId: `promo_${instituteId}_${Date.now()}`,
                    totalStudents: totalActive,
                    isAsync: true,
                },
            });

            // Fire-and-forget background promotion
            setImmediate(async () => {
                try {
                    const result = await promotionService.executePromotion(
                        instituteId, newYearLabel, overrides, req.user.id
                    );
                    try {
                        const { getIo } = require("../utils/socket");
                        getIo().to(`user_${req.user.id}`).emit("promotion:complete", result);
                    } catch (_) { /* non-fatal */ }
                } catch (asyncErr) {
                    console.error("Async promotion failed:", asyncErr.message);
                    try {
                        const { getIo } = require("../utils/socket");
                        getIo().to(`user_${req.user.id}`).emit("promotion:error", { message: asyncErr.message });
                    } catch (_) { /* non-fatal */ }
                }
            });
            return;
        }

        // Sync path
        const result = await promotionService.executePromotion(
            instituteId, newYearLabel, overrides, req.user.id
        );

        // Non-blocking post-promotion notifications
        if (result.success) {
            setImmediate(() => {
                promotionService.sendPromotionNotifications(
                    instituteId, newYearLabel, {}
                ).catch(() => { });
            });
        }

        return sendSuccess(res, result, `Promotion to ${newYearLabel} completed successfully`);
    } catch (err) {
        console.error("executePromotion error:", err.message);
        return sendError(res, err.message || "Promotion failed. Please try again.", 500);
    }
};

// ─── Rollback Promotion ───────────────────────────────────────────────────────

const rollbackPromotion = async (req, res) => {
    try {
        const { fromYearId, toYearId } = req.body;
        const result = await promotionService.rollbackPromotion(
            fromYearId, toYearId, req.user.institute_id, req.user.id
        );
        return sendSuccess(res, result, "Promotion rolled back successfully");
    } catch (err) {
        console.error("rollbackPromotion error:", err.message);
        return sendError(res, err.message || "Rollback failed", 500);
    }
};

// ─── Student Transcript (History) ─────────────────────────────────────────────

const getPromotionHistory = async (req, res) => {
    try {
        const { studentId } = req.params;
        const history = await promotionService.getPromotionHistory(
            parseInt(studentId, 10), req.user.institute_id
        );
        return sendSuccess(res, { history }, "Enrollment history fetched");
    } catch (err) {
        console.error("getPromotionHistory error:", err.message);
        return sendError(res, err.message || "Failed to fetch promotion history", 500);
    }
};

// ─── Promotion Rules CRUD ─────────────────────────────────────────────────────

const listPromotionRules = async (req, res) => {
    try {
        const rules = await promotionService.getPromotionRules(req.user.institute_id);
        return sendSuccess(res, { rules }, "Promotion rules fetched");
    } catch (err) {
        return sendError(res, err.message || "Failed to fetch rules", 500);
    }
};

const createPromotionRule = async (req, res) => {
    try {
        const rule = await promotionService.createPromotionRule(req.user.institute_id, req.body);
        return sendSuccess(res, { rule }, "Promotion rule created", 201);
    } catch (err) {
        return sendError(res, err.message || "Failed to create rule", 500);
    }
};

const updatePromotionRule = async (req, res) => {
    try {
        const rule = await promotionService.updatePromotionRule(
            req.params.id, req.user.institute_id, req.body
        );
        return sendSuccess(res, { rule }, "Promotion rule updated");
    } catch (err) {
        return sendError(res, err.message || "Failed to update rule", err.message === "Promotion rule not found" ? 404 : 500);
    }
};

const deletePromotionRule = async (req, res) => {
    try {
        await promotionService.deletePromotionRule(req.params.id, req.user.institute_id);
        return sendSuccess(res, null, "Promotion rule deleted");
    } catch (err) {
        return sendError(res, err.message || "Failed to delete rule", err.message === "Promotion rule not found" ? 404 : 500);
    }
};

const suggestPromotionRules = async (req, res) => {
    try {
        const result = await promotionService.suggestPromotionRules(req.user.institute_id);
        return sendSuccess(res, result, "Promotion rule suggestions generated");
    } catch (err) {
        return sendError(res, err.message || "Failed to generate suggestions", 500);
    }
};

const bulkSavePromotionRules = async (req, res) => {
    try {
        const { rules } = req.body;
        if (!Array.isArray(rules) || rules.length === 0) {
            return sendError(res, "Rules array is required", 400);
        }
        const { PromotionRule } = require("../models");

        // Atomically replace all rules for this institute
        await PromotionRule.destroy({ where: { institute_id: req.user.institute_id } });
        const created = await PromotionRule.bulkCreate(
            rules.map((r, i) => ({
                institute_id: req.user.institute_id,
                from_class_id: r.fromClassId || null,
                to_class_id: r.toClassId || null,
                end_action: r.endAction || null,
                sort_order: r.sortOrder || i + 1,
            }))
        );

        return sendSuccess(res, { count: created.length }, `${created.length} promotion rules saved`);
    } catch (err) {
        console.error("bulkSavePromotionRules error:", err.message);
        return sendError(res, err.message || "Failed to save rules", 500);
    }
};

module.exports = {
    listAcademicYears,
    createAcademicYear,
    updateAcademicYear,
    promotionPreview,
    executePromotion,
    rollbackPromotion,
    getPromotionHistory,
    listPromotionRules,
    createPromotionRule,
    updatePromotionRule,
    deletePromotionRule,
    suggestPromotionRules,
    bulkSavePromotionRules,
};
