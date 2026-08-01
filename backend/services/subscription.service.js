/**
 * Subscription Service
 * Optimised queries for subscription metrics and list.
 * Metrics cached with node-cache (30s TTL), busted on any mutation.
 */

const { sequelize, Subscription, Institute, Plan } = require('../models');
const { Op } = require('sequelize');
const NodeCache = require('node-cache');

// ─── Cache: 30 second TTL on metrics ─────────────────────────
const metricsCache = new NodeCache({ stdTTL: 30, checkperiod: 10 });

// ─── FUNCTION 1: buildWhereClause ─────────────────────────────
function buildWhereClause({ search, status, startDate, endDate, plan }) {
    const subWhere = {};
    const instWhere = {};
    const planWhere = {};

    if (status && status !== 'all' && status !== '') {
        subWhere.payment_status = status;
    }

    if (startDate && endDate) {
        subWhere.start_date = { [Op.between]: [startDate, endDate] };
    }

    if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        instWhere[Op.or] = [
            { name: { [Op.iLike]: term } },
            { email: { [Op.iLike]: term } },
        ];
    }
    
    if (plan && plan.trim() && plan !== 'all') {
        planWhere.name = { [Op.iLike]: plan.trim() };
    }

    return { subWhere, instWhere, planWhere };
}

// ─── FUNCTION 2: getMetrics ───────────────────────────────────
async function getMetrics(filters) {
    const cacheKey = `sub_metrics_${JSON.stringify(filters)}`;
    const cached = metricsCache.get(cacheKey);
    if (cached) return cached;

    const { subWhere, instWhere, planWhere } = buildWhereClause(filters);

    // Build dynamic WHERE clauses for raw SQL
    const replacements = {};
    const conditions = ['s.is_test = FALSE'];

    if (subWhere.payment_status) {
        conditions.push('s.payment_status = :status');
        replacements.status = subWhere.payment_status;
    }

    if (subWhere.start_date) {
        conditions.push('s.start_date BETWEEN :startDate AND :endDate');
        replacements.startDate = filters.startDate;
        replacements.endDate = filters.endDate;
    }

    if (instWhere[Op.or]) {
        conditions.push('(i.name ILIKE :search OR i.email ILIKE :search)');
        replacements.search = `%${filters.search.trim()}%`;
    }
    
    let joinPlans = false;
    if (planWhere.name) {
        joinPlans = true;
        conditions.push('p.name ILIKE :planName');
        replacements.planName = filters.plan;
    }

    const whereStr = conditions.join(' AND ');

    const [metrics] = await sequelize.query(`
        SELECT
            COUNT(s.id)                          AS total_subscriptions,
            COALESCE(SUM(s.amount_paid), 0)      AS total_revenue,
            COALESCE(SUM(s.discount_amount), 0)  AS total_discounts,
            COALESCE(SUM(s.tax_amount), 0)       AS total_gst,
            COUNT(CASE WHEN s.payment_status = 'paid'    THEN 1 END) AS paid_count,
            COUNT(CASE WHEN s.payment_status = 'pending' THEN 1 END) AS pending_count,
            COUNT(CASE WHEN s.payment_status = 'failed'  THEN 1 END) AS failed_count
        FROM subscriptions s
        JOIN institutes i ON i.id = s.institute_id
        ${joinPlans ? 'LEFT JOIN plans p ON p.id = s.plan_id' : ''}
        WHERE ${whereStr}
    `, {
        replacements,
        type: sequelize.QueryTypes.SELECT,
    });

    // Count test institutes separately (not filtered by is_test = FALSE)
    const [testCount] = await sequelize.query(`
        SELECT COUNT(DISTINCT i.id) AS test_count
        FROM institutes i
        WHERE i.is_test_account = TRUE
    `, { type: sequelize.QueryTypes.SELECT });

    const result = {
        total_subscriptions: parseInt(metrics.total_subscriptions) || 0,
        total_revenue: parseFloat(metrics.total_revenue) || 0,
        total_discounts: parseFloat(metrics.total_discounts) || 0,
        total_gst: parseFloat(metrics.total_gst) || 0,
        paid_count: parseInt(metrics.paid_count) || 0,
        pending_count: parseInt(metrics.pending_count) || 0,
        failed_count: parseInt(metrics.failed_count) || 0,
        test_count: parseInt(testCount.test_count) || 0,
    };

    metricsCache.set(cacheKey, result);
    return result;
}

// ─── FUNCTION 3: getSubscriptionList ──────────────────────────
async function getSubscriptionList(filters) {
    const { page = 1, limit = 10 } = filters;
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * parseInt(limit);
    const { subWhere, instWhere, planWhere } = buildWhereClause(filters);

    const instituteInclude = {
        model: Institute,
        attributes: ['id', 'name', 'email', 'is_test_account'],
        required: true,
    };
    if (Object.keys(instWhere).length) {
        instituteInclude.where = instWhere;
    }
    
    const planInclude = {
        model: Plan,
        attributes: ['id', 'name', 'platform_type', 'price', 'yearly_price', 'gst_percent'],
        required: Object.keys(planWhere).length > 0,
    };
    if (Object.keys(planWhere).length) {
        planInclude.where = planWhere;
    }

    const { count, rows } = await Subscription.findAndCountAll({
        where: subWhere,
        limit: parseInt(limit),
        offset,
        order: [['createdAt', 'DESC']],
        include: [
            instituteInclude,
            planInclude
        ],
    });

    // Annotate each subscription with computed original_price (matching existing logic)
    const data = rows.map((sub) => {
        const plain = sub.toJSON ? sub.toJSON() : sub;

        let savedDiscount = parseFloat(plain.discount_amount || 0);
        let originalPreTax = plain.Plan?.price ? parseFloat(plain.Plan.price) : 0;

        if (plain.billing_cycle === 'yearly') {
            originalPreTax *= 12;
        }

        const gstPercent = plain.Plan?.gst_percent != null ? parseFloat(plain.Plan.gst_percent) : 2;
        const originalPostTax = originalPreTax * (1 + (gstPercent / 100));

        if (savedDiscount === 0 && plain.billing_cycle === 'yearly') {
            const paidAmt = parseFloat(plain.amount_paid || 0);
            if (paidAmt < originalPostTax - 1) {
                savedDiscount = originalPostTax - paidAmt;
            }
        }

        plain.discount_applied = savedDiscount > 0;
        plain.original_price = plain.discount_applied ? originalPostTax : parseFloat(plain.amount_paid);
        plain.discount_amount = savedDiscount;

        return plain;
    });

    return {
        data,
        pagination: {
            total: count,
            page: parseInt(page),
            totalPages: Math.ceil(count / parseInt(limit)),
        },
    };
}

// ─── FUNCTION 4: toggleTestMode ───────────────────────────────
async function toggleTestMode(instituteId, isTest) {
    const t = await sequelize.transaction();
    try {
        await Institute.update(
            { is_test_account: isTest },
            { where: { id: instituteId }, transaction: t }
        );

        await Subscription.update(
            { is_test: isTest },
            { where: { institute_id: instituteId }, transaction: t }
        );

        await t.commit();
        metricsCache.flushAll();

        return { institute_id: parseInt(instituteId), is_test: isTest };
    } catch (err) {
        await t.rollback();
        throw err;
    }
}

// ─── FUNCTION 5: bustCache ────────────────────────────────────
function bustMetricsCache() {
    metricsCache.flushAll();
}

module.exports = {
    getMetrics,
    getSubscriptionList,
    toggleTestMode,
    bustMetricsCache,
};
