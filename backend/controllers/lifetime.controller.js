/**
 * Lifetime Access Controller
 * Handles: lifetime plan info (public), order creation, payment verification,
 * manual activation (super admin), revoke (super admin)
 */

const { Institute, Plan, Subscription } = require('../models');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const getRazorpay = () => {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error('Razorpay credentials not configured');
    }
    return new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
};

// ─── Helper: All features ON for lifetime ───────────────────────────────────
const LIFETIME_FEATURES = {
    is_lifetime_member: true,
    status: 'active',
    current_feature_attendance: 'advanced',
    current_feature_auto_attendance: true,
    current_feature_fees: true,
    current_feature_finance: true,
    current_feature_salary: true,
    current_feature_reports: 'advanced',
    current_feature_announcements: true,
    current_feature_export: true,
    current_feature_timetable: true,
    current_feature_whatsapp: true,
    current_feature_custom_branding: true,
    current_feature_multi_branch: true,
    current_feature_api_access: true,
    current_feature_public_page: true,
    current_feature_assignment: true,
    current_feature_transport: true,
    current_feature_mobile_app: true,
    // -1 = unlimited
    current_limit_students: -1,
    current_limit_faculty: -1,
    current_limit_classes: -1,
    current_limit_admins: -1,
    current_limit_chat_messages: -1,  // Unlimited for lifetime members
};

// ─── 1. GET /api/lifetime/info  (public) ─────────────────────────────────────
exports.getLifetimePlanInfo = async (req, res) => {
    try {
        const plan = await Plan.findOne({
            where: { is_lifetime: true, status: 'active' },
            attributes: [
                'id', 'name', 'description', 'price', 'lifetime_price',
                'lifetime_slots_total', 'lifetime_slots_used',
                'lifetime_bonus_subdomain', 'lifetime_bonus_priority_support',
                'lifetime_bonus_unlimited_export',
                'max_students', 'max_faculty'
            ]
        });

        if (!plan) {
            return res.status(404).json({ success: false, message: 'Lifetime plan not currently available.' });
        }

        const slotsRemaining = plan.lifetime_slots_total - plan.lifetime_slots_used;
        const isFoundingAvailable = plan.lifetime_slots_used < (plan.lifetime_slots_total || 100);
        
        // Treat lifetime_price as the offer price and price as the standard price
        const currentPrice = Number(plan.lifetime_price || 19999);
        const standardPrice = Number(plan.price || 39999);

        return res.status(200).json({
            success: true,
            plan: {
                ...plan.toJSON(),
                slots_remaining: slotsRemaining,
                is_founding_available: isFoundingAvailable,
                founding_price: currentPrice,
                standard_price: standardPrice,
                current_price: currentPrice,
            }
        });
    } catch (error) {
        console.error('getLifetimePlanInfo error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ─── 2. POST /api/lifetime/order  (admin only) ───────────────────────────────
exports.createLifetimeOrder = async (req, res) => {
    try {
        const institute = await Institute.findByPk(req.user.institute_id);
        if (!institute) return res.status(404).json({ success: false, message: 'Institute not found.' });

        if (institute.is_lifetime_member) {
            return res.status(400).json({
                success: false,
                message: 'Your institute already has Lifetime Access.'
            });
        }

        const lifetimePlan = await Plan.findOne({ where: { is_lifetime: true, status: 'active' } });
        if (!lifetimePlan) {
            return res.status(404).json({ success: false, message: 'Lifetime plan is not currently available.' });
        }

        if (lifetimePlan.lifetime_slots_used >= lifetimePlan.lifetime_slots_total) {
            return res.status(400).json({
                success: false,
                message: 'All lifetime slots are filled. Please join the waitlist.',
                slots_full: true
            });
        }

        const slotsRemaining = lifetimePlan.lifetime_slots_total - lifetimePlan.lifetime_slots_used;
        const isFoundingMember = lifetimePlan.lifetime_slots_used < (lifetimePlan.lifetime_slots_total || 100);
        const price = Number(lifetimePlan.lifetime_price || 19999);

        const razorpay = getRazorpay();
        const order = await razorpay.orders.create({
            amount: price * 100,
            currency: 'INR',
            receipt: `lifetime_${institute.id}_${Date.now()}`,
            notes: {
                institute_id: String(institute.id),
                plan_type: 'lifetime',
                is_founding_member: String(isFoundingMember)
            }
        });

        return res.status(200).json({
            success: true,
            order_id: order.id,
            amount: price,
            currency: 'INR',
            is_founding_member: isFoundingMember,
            slots_remaining: slotsRemaining,
            razorpay_key: process.env.RAZORPAY_KEY_ID,
            plan: {
                id: lifetimePlan.id,
                name: lifetimePlan.name
            }
        });
    } catch (error) {
        console.error('createLifetimeOrder error:', error);
        res.status(500).json({ success: false, message: 'Failed to create order. ' + error.message });
    }
};

// ─── 3. POST /api/lifetime/verify  (admin only) ──────────────────────────────
exports.verifyLifetimePayment = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    try {
        // Verify Razorpay signature
        const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
        const expectedSign = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(sign)
            .digest('hex');

        if (expectedSign !== razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Invalid payment signature. Please contact support.' });
        }

        const institute = await Institute.findByPk(req.user.institute_id);
        if (!institute) return res.status(404).json({ success: false, message: 'Institute not found.' });

        if (institute.is_lifetime_member) {
            return res.status(400).json({ success: false, message: 'Institute is already a lifetime member.' });
        }

        const lifetimePlan = await Plan.findOne({ where: { is_lifetime: true } });
        if (!lifetimePlan) return res.status(404).json({ success: false, message: 'Lifetime plan not found.' });

        const isFoundingMember = lifetimePlan.lifetime_slots_used < (lifetimePlan.lifetime_slots_total || 100);

        // Activate lifetime access + unlock all features + set unlimited limits
        await institute.update({
            ...LIFETIME_FEATURES,
            lifetime_purchased_at: new Date(),
            lifetime_plan_id: lifetimePlan.id,
            founding_member: isFoundingMember,
            subscription_end: null,   // Clear expiry — lifetime members NEVER expire
            subscription_start: new Date(), // Reset start to activation date
        });

        // Increment slot counter
        await lifetimePlan.increment('lifetime_slots_used');

        // Cancel any active subscriptions (no more billing needed)
        try {
            await Subscription.update(
                { status: 'cancelled', cancelled_reason: 'Upgraded to Lifetime Access' },
                { where: { institute_id: institute.id, status: 'active' } }
            );
        } catch (subErr) {
            // Non-fatal — subscriptions table may not have cancelled_reason yet
            console.warn('Could not cancel subscriptions (non-fatal):', subErr.message);
        }

        return res.status(200).json({
            success: true,
            message: 'Lifetime Access activated successfully! Welcome to the family. 🎉',
            is_founding_member: isFoundingMember,
            payment_id: razorpay_payment_id
        });
    } catch (error) {
        console.error('verifyLifetimePayment error:', error);
        res.status(500).json({ success: false, message: 'Payment verification failed. Please contact support with payment ID: ' + (razorpay_payment_id || 'N/A') });
    }
};

// ─── 4. POST /api/lifetime/activate/:institute_id  (super admin only) ────────
// Manual activation for cases where Razorpay webhook/verify fails
exports.manualActivateLifetime = async (req, res) => {
    try {
        const { institute_id } = req.params;
        const { payment_id, is_founding } = req.body;

        const institute = await Institute.findByPk(institute_id);
        if (!institute) return res.status(404).json({ success: false, message: 'Institute not found.' });

        const lifetimePlan = await Plan.findOne({ where: { is_lifetime: true } });
        const isFoundingMember = is_founding === true || is_founding === 'true';

        await institute.update({
            ...LIFETIME_FEATURES,
            lifetime_purchased_at: new Date(),
            lifetime_plan_id: lifetimePlan?.id || null,
            founding_member: isFoundingMember,
            subscription_end: null,   // Clear expiry — lifetime members NEVER expire
            subscription_start: new Date(), // Reset start to activation date
        });

        if (lifetimePlan) {
            await lifetimePlan.increment('lifetime_slots_used');
        }

        console.log(`[SUPERADMIN] Manually activated lifetime for institute ${institute_id}. Payment: ${payment_id}. By: ${req.user.id}`);

        return res.status(200).json({
            success: true,
            message: `Lifetime access activated for ${institute.name}.`,
            is_founding_member: isFoundingMember
        });
    } catch (error) {
        console.error('manualActivateLifetime error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── 5. POST /api/lifetime/revoke/:institute_id  (super admin only) ──────────
// Revoke lifetime (fraud / refund case)
exports.revokeLifetimeAccess = async (req, res) => {
    try {
        const { institute_id } = req.params;
        const { reason } = req.body;

        const institute = await Institute.findByPk(institute_id, { include: [{ model: Plan }] });
        if (!institute) return res.status(404).json({ success: false, message: 'Institute not found.' });

        if (!institute.is_lifetime_member) {
            return res.status(400).json({ success: false, message: 'This institute is not a lifetime member.' });
        }

        // Decrement slot count on the lifetime plan
        if (institute.lifetime_plan_id) {
            const lifetimePlan = await Plan.findByPk(institute.lifetime_plan_id);
            if (lifetimePlan && lifetimePlan.lifetime_slots_used > 0) {
                await lifetimePlan.decrement('lifetime_slots_used');
            }
        }

        // Reset to expired/basic state
        await institute.update({
            is_lifetime_member: false,
            founding_member: false,
            lifetime_purchased_at: null,
            lifetime_plan_id: null,
            status: 'expired',
            current_limit_students: 100,
            current_limit_faculty: 5,
            current_limit_classes: 5,
            current_limit_admins: 1,
            current_limit_chat_messages: 500,
        });

        console.log(`[SUPERADMIN] Revoked lifetime for institute ${institute_id}. Reason: ${reason}. By: ${req.user.id}`);

        return res.status(200).json({
            success: true,
            message: `Lifetime access revoked for ${institute.name}. Reason: ${reason || 'Not specified'}`
        });
    } catch (error) {
        console.error('revokeLifetimeAccess error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
