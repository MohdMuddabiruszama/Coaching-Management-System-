/**
 * Subscription Controller
 * Handles subscription management
 */

const { Subscription, Institute, Plan } = require("../models");

exports.createSubscription = async (req, res) => {
    try {
        const { institute_id, plan_id, amount_paid, discount_amount, subscription_start, subscription_end } = req.body;

        const subscription = await Subscription.create({
            institute_id,
            plan_id,
            amount_paid,
            discount_amount: discount_amount || 0,
            payment_status: "pending",
            start_date: subscription_start,
            end_date: subscription_end,
        });

        res.status(201).json({
            success: true,
            message: "Subscription created successfully",
            data: subscription,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.getAllSubscriptions = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            status,
            plan_id,
            search,
            sort_by = "createdAt",
            sort_order = "DESC",
        } = req.query;

        // Clamp limit: min 1, max 200
        const safeLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
        const offset = (Math.max(parseInt(page) || 1, 1) - 1) * safeLimit;

        // Build subscription-level where clause
        const whereClause = {};
        if (status) whereClause.payment_status = status;
        if (plan_id) whereClause.plan_id = parseInt(plan_id);

        // Allowed sort columns (whitelist to prevent SQL injection)
        const allowedSortCols = ["createdAt", "amount_paid", "discount_amount", "start_date", "end_date", "payment_status"];
        const safeSortBy = allowedSortCols.includes(sort_by) ? sort_by : "createdAt";
        const safeSortOrder = sort_order?.toUpperCase() === "ASC" ? "ASC" : "DESC";

        // Build institute include — add name/email search if provided
        const instituteInclude = {
            model: Institute,
            attributes: ["id", "name", "email"],
        };
        if (search && search.trim()) {
            const { Op } = require("sequelize");
            const term = `%${search.trim()}%`;
            instituteInclude.where = {
                [Op.or]: [
                    { name: { [Op.iLike]: term } },
                    { email: { [Op.iLike]: term } },
                ],
            };
            // Required so we only return subscriptions whose institute matches
            instituteInclude.required = true;
        }

        const { count, rows } = await Subscription.findAndCountAll({
            where: whereClause,
            limit: safeLimit,
            offset,
            order: [[safeSortBy, safeSortOrder]],
            include: [
                instituteInclude,
                {
                    model: Plan,
                    attributes: ["id", "name", "price", "yearly_price", "lifetime_price"],
                },
            ],
        });

        // Annotate each subscription with a computed discount_applied flag for easy frontend use
        const subscriptions = rows.map((sub) => {
            const plain = sub.toJSON ? sub.toJSON() : sub;
            
            // Recompute discount if it's 0 but there should be an annual discount
            // This fixes historical records before discount_amount was tracked
            let savedDiscount = parseFloat(plain.discount_amount || 0);
            let originalPreTax = plain.Plan?.price ? parseFloat(plain.Plan.price) : 0;
            
            if (plain.billing_cycle === 'yearly') {
                originalPreTax *= 12;
            }
            
            const gstPercent = plain.Plan?.gst_percent != null ? parseFloat(plain.Plan.gst_percent) : 2;
            const originalPostTax = originalPreTax * (1 + (gstPercent / 100));
            
            if (savedDiscount === 0 && plain.billing_cycle === 'yearly') {
                const paidAmt = parseFloat(plain.amount_paid || 0);
                if (paidAmt < originalPostTax - 1) { // 1 rupee margin
                    savedDiscount = originalPostTax - paidAmt;
                }
            }
            
            plain.discount_applied = savedDiscount > 0;
            plain.original_price = plain.discount_applied ? originalPostTax : parseFloat(plain.amount_paid);
            plain.discount_amount = savedDiscount;
            
            return plain;
        });

        res.status(200).json({
            success: true,
            message: "Subscriptions retrieved successfully",
            data: {
                subscriptions,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: safeLimit,
                    totalPages: Math.ceil(count / safeLimit),
                },
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.updateSubscriptionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { payment_status } = req.body;

        const subscription = await Subscription.findByPk(id);

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: "Subscription not found",
            });
        }

        await subscription.update({ payment_status });

        res.status(200).json({
            success: true,
            message: "Subscription status updated successfully",
            data: subscription,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.updateSubscriptionPeriod = async (req, res) => {
    try {
        const { id } = req.params;
        const { start_date, end_date } = req.body;

        const subscription = await Subscription.findByPk(id);

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: "Subscription not found",
            });
        }

        await subscription.update({ start_date, end_date });

        // If this is the active subscription for the institute, update the institute's end date
        if (subscription.status === 'active' || subscription.payment_status === 'paid') {
            const institute = await Institute.findByPk(subscription.institute_id);
            if (institute) {
                // Determine if this subscription is the latest active one
                const latestSub = await Subscription.findOne({
                    where: { institute_id: subscription.institute_id, payment_status: 'paid' },
                    order: [['end_date', 'DESC']]
                });
                if (latestSub && latestSub.id === subscription.id) {
                    await institute.update({ 
                        subscription_start: start_date, 
                        subscription_end: end_date 
                    });
                }
            }
        }

        res.status(200).json({
            success: true,
            message: "Subscription period updated successfully",
            data: subscription,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

module.exports = exports;
