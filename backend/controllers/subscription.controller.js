/**
 * Subscription Controller
 * Handles subscription management for Super Admin
 * Enhanced with: test mode toggle, metrics, server-side export, mark-paid, delete
 */

const { Subscription, Institute, Plan } = require("../models");
const { bustAnalyticsCache } = require("./superadmin.controller");
const subService = require("../services/subscription.service");
const { catchAsync } = require("../utils/catchAsync");
const { exportExcel, exportPDF } = require("../utils/exportSubscriptions");
const socketUtils = require("../utils/socket");
const AppError = require("../utils/AppError");

// ─── GET: Enhanced List + Metrics (parallel) ──────────────────
exports.getAllSubscriptions = catchAsync(async (req, res) => {
    const filters = {
        page: req.query.page || 1,
        limit: req.query.limit || 50,
        search: req.query.search || '',
        status: req.query.status || 'all',
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null,
    };

    // Run BOTH queries in parallel
    const [metrics, list] = await Promise.all([
        subService.getMetrics(filters),
        subService.getSubscriptionList(filters),
    ]);

    return res.status(200).json({
        success: true,
        metrics,
        data: {
            subscriptions: list.data,
            pagination: list.pagination,
        },
    });
});

// ─── POST: Create Subscription ────────────────────────────────
exports.createSubscription = catchAsync(async (req, res) => {
    const { institute_id, plan_id, amount_paid, discount_amount, subscription_start, subscription_end } = req.body;

    // Inherit is_test from institute
    const institute = await Institute.findByPk(institute_id);
    const isTest = institute ? institute.is_test_account : false;

    const subscription = await Subscription.create({
        institute_id,
        plan_id,
        amount_paid,
        discount_amount: discount_amount || 0,
        payment_status: "pending",
        start_date: subscription_start,
        end_date: subscription_end,
        is_test: isTest,
    });

    subService.bustMetricsCache();

    res.status(201).json({
        success: true,
        message: "Subscription created successfully",
        data: subscription,
    });
});

// ─── PATCH: Update Status ─────────────────────────────────────
exports.updateSubscriptionStatus = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { payment_status } = req.body;

    const subscription = await Subscription.findByPk(id);
    if (!subscription) {
        return res.status(404).json({ success: false, message: "Subscription not found" });
    }

    await subscription.update({ payment_status });
    bustAnalyticsCache();
    subService.bustMetricsCache();

    // Emit real-time update
    const io = socketUtils.getIo();
    if (io) {
        io.to('superadmin').emit('subscription_updated', {
            type: 'status_updated',
            subscription_id: id,
            payment_status,
        });
    }

    res.status(200).json({
        success: true,
        message: "Subscription status updated successfully",
        data: subscription,
    });
});

// ─── PATCH: Update Period ─────────────────────────────────────
exports.updateSubscriptionPeriod = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { start_date, end_date } = req.body;

    const subscription = await Subscription.findByPk(id);
    if (!subscription) {
        return res.status(404).json({ success: false, message: "Subscription not found" });
    }

    await subscription.update({ start_date, end_date });
    bustAnalyticsCache();

    if (subscription.status === 'active' || subscription.payment_status === 'paid') {
        const institute = await Institute.findByPk(subscription.institute_id);
        if (institute) {
            // Find the true latest paid subscription for this institute
            const latestSub = await Subscription.findOne({
                where: { institute_id: subscription.institute_id, payment_status: 'paid' },
                order: [['end_date', 'DESC']]
            });
            if (latestSub) {
                await institute.update({
                    subscription_start: latestSub.start_date,
                    subscription_end: latestSub.end_date
                });
            } else {
                // Fallback to the edited subscription if no other paid ones exist
                await institute.update({
                    subscription_start: start_date,
                    subscription_end: end_date
                });
            }
        }
    }

    subService.bustMetricsCache();

    res.status(200).json({
        success: true,
        message: "Subscription period updated successfully",
        data: subscription,
    });
});

// ─── PATCH: Toggle Test Mode ──────────────────────────────────
exports.toggleTest = catchAsync(async (req, res) => {
    const { id } = req.params; // institute id
    const { is_test } = req.body;

    if (typeof is_test !== 'boolean') {
        return res.status(400).json({ success: false, message: 'is_test must be a boolean' });
    }

    const institute = await Institute.findByPk(id);
    if (!institute) {
        return res.status(404).json({ success: false, message: 'Institute not found' });
    }

    const result = await subService.toggleTestMode(id, is_test);

    // Emit real-time update
    const io = socketUtils.getIo();
    if (io) {
        io.to('superadmin').emit('subscription_updated', {
            type: 'test_mode_toggled',
            institute_id: id,
            is_test,
        });
    }

    return res.json({ success: true, data: result });
});

// ─── PUT: Mark as Paid ────────────────────────────────────────
exports.markPaid = catchAsync(async (req, res) => {
    const sub = await Subscription.findByPk(req.params.id);
    if (!sub) {
        return res.status(404).json({ success: false, message: 'Subscription not found' });
    }
    if (sub.payment_status === 'paid') {
        return res.status(400).json({ success: false, message: 'Already paid' });
    }

    await sub.update({
        payment_status: 'paid',
        paid_at: new Date(),
    });

    bustAnalyticsCache();
    subService.bustMetricsCache();

    const io = socketUtils.getIo();
    if (io) {
        io.to('superadmin').emit('subscription_updated', {
            type: 'payment_recorded',
            subscription_id: sub.id,
        });
    }

    return res.json({ success: true, message: 'Subscription marked as paid', data: sub });
});

// ─── DELETE: Remove Subscription ──────────────────────────────
exports.deleteSubscription = catchAsync(async (req, res) => {
    const { id } = req.params;
    const subscription = await Subscription.findByPk(id);

    if (!subscription) {
        return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    if (subscription.payment_status === 'paid') {
        return res.status(400).json({ success: false, message: 'Cannot delete a paid subscription' });
    }

    await subscription.destroy();
    subService.bustMetricsCache();
    return res.json({ success: true, message: 'Subscription deleted' });
});

// ─── PATCH: Exclude Transaction (Hide from Analytics) ─────────
exports.excludeSubscription = catchAsync(async (req, res) => {
    const { id } = req.params;
    const subscription = await Subscription.findByPk(id);

    if (!subscription) {
        return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    await subscription.update({ is_test: true });
    
    const { bustAnalyticsCache } = require("./superadmin.controller");
    bustAnalyticsCache();
    subService.bustMetricsCache();
    
    // Emit real-time update
    const io = socketUtils.getIo();
    if (io) {
        io.to('superadmin').emit('subscription_updated', {
            type: 'subscription_excluded',
            subscription_id: id
        });
    }

    return res.json({ success: true, message: 'Transaction removed from analytics' });
});

// ─── GET: Export (Excel / PDF) ────────────────────────────────
exports.exportData = catchAsync(async (req, res) => {
    const { format = 'excel', ...filterParams } = req.query;
    const filters = {
        search: filterParams.search || '',
        status: filterParams.status || 'all',
        startDate: filterParams.startDate || null,
        endDate: filterParams.endDate || null,
        page: 1,
        limit: 10000,
    };

    const { data } = await subService.getSubscriptionList(filters);

    if (format === 'excel') return exportExcel(res, data);
    if (format === 'pdf') return exportPDF(res, data);
    return res.status(400).json({ success: false, message: 'format must be excel or pdf' });
});

module.exports = exports;
