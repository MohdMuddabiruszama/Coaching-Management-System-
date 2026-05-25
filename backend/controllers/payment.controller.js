const { Plan, Subscription, Institute, RazorpayPayment, RazorpayOrder, Invoice } = require("../models");
const paymentService = require("../services/payment.service");
const invoiceService = require("../services/invoice.service");

const getPlanAmountForCycle = (plan, billingCycle = "monthly") => {
    if (plan.is_lifetime) {
        const used = plan.lifetime_slots_used || 0;
        const total = plan.lifetime_slots_total || 100;
        // If slots are available and lifetime_price is set, use offer price
        if (used < total && plan.lifetime_price !== null && plan.lifetime_price !== undefined) {
            return Number(plan.lifetime_price);
        }
        // Otherwise use standard lifetime price
        return Number(plan.price);
    }

    if (billingCycle === "yearly") {
        if (plan.yearly_price !== null && plan.yearly_price !== undefined) {
            return Number(plan.yearly_price);
        }

        const discountPercent = Number(plan.yearly_discount_percent ?? 20);
        return Number(plan.price) * 12 * ((100 - discountPercent) / 100);
    }

    return Number(plan.price);
};

const getPlanSnapshot = (plan, billingCycle = "monthly") => ({
    current_limit_students: plan.max_students,
    current_limit_faculty: plan.max_faculty,
    current_limit_classes: plan.max_classes,
    current_limit_admins: plan.max_admin_users,
    current_platform_type: plan.platform_type,
    current_billing_cycle: billingCycle,
    current_limit_branches: plan.max_branches,
    current_limit_storage_mb: plan.max_storage_mb,
    current_limit_ai_messages: plan.max_ai_messages,
    current_feature_attendance: plan.feature_attendance,
    current_feature_auto_attendance: plan.feature_auto_attendance,
    current_feature_fees: plan.feature_fees,
    current_feature_finance: plan.feature_finance,
    current_feature_salary: plan.feature_salary,
    current_feature_reports: plan.feature_reports,
    current_feature_announcements: plan.feature_announcements,
    current_feature_export: plan.feature_export,
    current_feature_timetable: plan.feature_timetable,
    current_feature_whatsapp: plan.feature_whatsapp,
    current_feature_custom_branding: plan.feature_custom_branding,
    current_feature_multi_branch: plan.feature_multi_branch,
    current_feature_api_access: plan.feature_api_access,
    current_feature_assignment: plan.feature_assignment,
    current_feature_transport: plan.feature_transport,
    current_feature_public_page: plan.feature_public_page,
    current_feature_mobile_app: plan.feature_mobile_app,
    current_feature_push_notifications: plan.feature_push_notifications,
    current_feature_offline_attendance: plan.feature_offline_attendance,
    current_feature_parent_app: plan.feature_parent_app,
    current_feature_student_app: plan.feature_student_app
});

/**
 * Initiate Payment (Create Order)
 */
exports.initiatePayment = async (req, res) => {
    try {
        const { planId, billingCycle, coupon_code, testMode } = req.body;
        const instituteId = req.user.institute_id;

        const plan = await Plan.findByPk(planId);
        if (!plan) return res.status(404).json({ message: "Plan not found" });
        if (plan.contact_sales) {
            return res.status(400).json({
                success: false,
                message: "This plan requires contacting sales."
            });
        }

        const institute = await Institute.findByPk(instituteId);

        // Immediate activation for free trial
        if (plan.is_free_trial && !institute.has_used_trial) {
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + (plan.trial_days || 14));

            // Create Trial Subscription
            await Subscription.create({
                institute_id: instituteId,
                plan_id: planId,
                start_date: startDate,
                end_date: endDate,
                billing_cycle: "monthly",
                platform_type: plan.platform_type,
                status: "trialing",
                payment_status: "paid",
                transaction_reference: "free_trial",
                amount_paid: 0
            });

            // Update Institute
            await institute.update({
                status: "active",
                plan_id: planId,
                subscription_start: startDate,
                subscription_end: endDate,
                has_used_trial: true,
                trial_ends_at: endDate,
                ...getPlanSnapshot(plan, "monthly")
            });

            return res.json({ success: true, trial_activated: true });
        }

        // Calculate amount for paid plans
        const amount = getPlanAmountForCycle(plan, billingCycle);
        
        // Apply GST @ 2%
        const tax_amount = amount * 0.02;
        const total = amount + tax_amount;

        let orderInfo;
        if (testMode) {
            const amount_paise = Math.round(total * 100);
            const mockOrderId = `order_mock_${Date.now()}`;
            const order = await RazorpayOrder.create({
                institute_id: instituteId, 
                order_type: 'subscription', 
                reference_id: planId,
                razorpay_order_id: mockOrderId,
                amount: amount_paise,
                amount_display: total,
                currency: 'INR',
                receipt: `rcpt_mock_${Date.now()}`,
                status: 'pending',
                notes: { plan_id: planId, billingCycle }
            });
            orderInfo = {
                razorpay_order_id: mockOrderId,
                amount_paise,
                amount_rupees: total,
                receipt: order.receipt
            };
        } else {
            orderInfo = await paymentService.createOrder({
                institute_id: instituteId,
                amount_rupees: total,
                order_type: 'subscription',
                reference_id: planId,
                notes: { plan_id: planId, billingCycle }
            });
        }

        res.json({
            success: true,
            order: {
                id: orderInfo.razorpay_order_id,
                amount: orderInfo.amount_paise,
                currency: "INR"
            },
            key: testMode ? "rzp_test_mock" : (process.env.RAZORPAY_KEY_ID || "rzp_test_1234567890"),
            institute_name: institute.name,
            plan_name: plan.name
        });

    } catch (error) {
        console.error("Payment initiation error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Verify Payment and Update Subscription
 */
exports.verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId, billingCycle } = req.body;
        const instituteId = req.user.institute_id;
        
        // Find order
        const order = await RazorpayOrder.findOne({ where: { razorpay_order_id } });
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        // Verify Signature
        const isValid = paymentService.verifySignature({
            order_id: razorpay_order_id, 
            payment_id: razorpay_payment_id, 
            signature: razorpay_signature
        });

        if (!isValid && !razorpay_order_id.startsWith("order_mock_")) {
            return res.status(400).json({ success: false, message: "Invalid payment signature — possible fraud" });
        }

        // Update RazorpayOrder
        await order.update({ status: 'paid' });

        // Save to RazorpayPayments
        const rzpPayment = await RazorpayPayment.create({
            institute_id: instituteId,
            order_id: order.id,
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            signature_verified: true,
            amount_paid: order.amount,
            paid_at: new Date()
        });

        // Update/Create Subscription
        const plan = await Plan.findByPk(planId);

        let amount = getPlanAmountForCycle(plan, billingCycle);
        let durationMonths = 1;
        if (billingCycle === 'yearly') {
            durationMonths = 12;
        }

        const tax_amount = amount * 0.02;
        const final_paid = amount + tax_amount;

        const startDate = new Date();
        let endDate = null;
        if (!plan.is_lifetime) {
            endDate = new Date();
            endDate.setMonth(endDate.getMonth() + durationMonths);
        }

        // Generate Invoice Number
        const invoiceNumber = `INV-${new Date().getFullYear()}-${instituteId}-${String(Date.now()).slice(-4)}`;

        const subscription = await Subscription.create({
            institute_id: instituteId,
            plan_id: planId,
            start_date: startDate,
            end_date: endDate,
            billing_cycle: billingCycle || "monthly",
            platform_type: plan.platform_type,
            status: "active",
            payment_status: "paid",
            transaction_reference: razorpay_payment_id,
            amount_paid: final_paid,
            razorpay_order_id,
            razorpay_payment_id,
            invoice_number: invoiceNumber,
            tax_amount,
            paid_at: new Date()
        });
        
        // Generate PDF Invoice
        let invoiceData = null;
        try {
            const institute = await Institute.findByPk(instituteId);
            invoiceData = await invoiceService.generateInvoice({
                institute,
                plan,
                subscription: {
                    start_date: startDate,
                    end_date: endDate,
                    billing_cycle: billingCycle,
                    razorpay_payment_id: razorpay_payment_id,
                    amount: final_paid,
                    tax_amount: tax_amount
                }
            });
        } catch (err) {
            console.error("Error generating invoice PDF:", err);
        }

        // Generate Invoice record
        await Invoice.create({
            institute_id: instituteId,
            payment_id: rzpPayment.id,
            invoice_type: 'subscription',
            invoice_number: invoiceData ? invoiceData.invoiceNumber : invoiceNumber,
            invoice_date: new Date(),
            subtotal: amount,
            tax_amount: tax_amount,
            total_amount: final_paid,
            file_path: invoiceData ? invoiceData.filePath : null
        });

        // Activate Institute
        await Institute.update(
            {
                status: "active",
                plan_id: planId,
                subscription_start: startDate,
                subscription_end: endDate,
                trial_ends_at: null,
                grace_period_ends_at: null,
                ...(plan.is_lifetime ? { is_lifetime_member: true, lifetime_purchased_at: new Date(), lifetime_plan_id: planId, founding_member: (plan.lifetime_slots_used || 0) < (plan.lifetime_slots_total || 100) } : {}),
                ...getPlanSnapshot(plan, billingCycle || "monthly")
            },
            { where: { id: instituteId } }
        );

        res.json({
            success: true,
            message: "Payment successful and subscription activated",
            data: { redirect: "/admin/dashboard", subscription_end: endDate }
        });

        if (plan.is_lifetime) {
            await plan.increment("lifetime_slots_used");
        }

    } catch (error) {
        console.error("Payment verification error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Phase 4: Create Student Fee Order
 */
exports.createFeeOrder = async (req, res) => {
    try {
        const { student_fee_id, amount, testMode } = req.body;
        const instituteId = req.user.institute_id;
        
        const { StudentFee } = require("../models");
        const fee = await StudentFee.findOne({ where: { id: student_fee_id, institute_id: instituteId }});
        if (!fee) return res.status(404).json({ success: false, message: "Fee record not found" });

        if (amount <= 0 || amount > fee.due_amount) {
            return res.status(400).json({ success: false, message: "Invalid payment amount" });
        }

        let orderInfo;
        if (testMode) {
            const amount_paise = Math.round(amount * 100);
            const mockOrderId = `order_mock_${Date.now()}`;
            const order = await RazorpayOrder.create({
                institute_id: instituteId, 
                order_type: 'student_fee', 
                reference_id: student_fee_id,
                razorpay_order_id: mockOrderId,
                amount: amount_paise,
                amount_display: amount,
                currency: 'INR',
                receipt: `rcpt_mock_${Date.now()}`,
                status: 'pending',
                notes: { student_fee_id, amount, source: 'online' }
            });
            orderInfo = {
                razorpay_order_id: mockOrderId,
                amount_paise,
                amount_rupees: amount,
                receipt: order.receipt
            };
        } else {
            orderInfo = await paymentService.createOrder({
                institute_id: instituteId,
                amount_rupees: amount,
                order_type: 'student_fee',
                reference_id: student_fee_id,
                notes: { student_fee_id, amount, source: 'online' }
            });
        }

        res.json({
            success: true,
            order: {
                id: orderInfo.razorpay_order_id,
                amount: orderInfo.amount_paise,
                currency: "INR"
            },
            key: testMode ? "rzp_test_mock" : (process.env.RAZORPAY_KEY_ID || "rzp_test_1234567890")
        });

    } catch (error) {
        console.error("Fee order creation error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Phase 4: Verify Student Fee Payment
 */
exports.verifyFeePayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, student_fee_id, amount } = req.body;
        const instituteId = req.user.institute_id;
        
        const { StudentFee, StudentFeePayment, Payment } = require("../models");

        // Find order
        const order = await RazorpayOrder.findOne({ where: { razorpay_order_id } });
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        // Verify Signature
        const isValid = paymentService.verifySignature({
            order_id: razorpay_order_id, 
            payment_id: razorpay_payment_id, 
            signature: razorpay_signature
        });

        if (!isValid && !razorpay_order_id.startsWith("order_mock_")) {
            return res.status(400).json({ success: false, message: "Invalid payment signature" });
        }

        await order.update({ status: 'paid' });

        const rzpPayment = await RazorpayPayment.create({
            institute_id: instituteId,
            order_id: order.id,
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            signature_verified: true,
            amount_paid: order.amount,
            paid_at: new Date()
        });

        const fee = await StudentFee.findOne({ where: { id: student_fee_id, institute_id: instituteId }});
        if (!fee) return res.status(404).json({ success: false, message: "Fee record not found" });

        const newPaidAmount = Number(fee.paid_amount) + Number(amount);
        const newDueAmount = Number(fee.final_amount) - newPaidAmount;
        
        await fee.update({
            paid_amount: newPaidAmount,
            due_amount: newDueAmount,
            status: newDueAmount <= 0 ? 'paid' : 'partial'
        });

        const receiptNumber = `RCPT-${new Date().getFullYear()}-${instituteId}-${String(Date.now()).slice(-5)}`;

        await StudentFeePayment.create({
            institute_id: instituteId,
            student_fee_id: fee.id,
            student_id: fee.student_id,
            razorpay_order_id,
            razorpay_payment_id,
            amount_paid: amount,
            payment_method: "online",
            payment_status: "paid",
            receipt_number: receiptNumber,
            paid_at: new Date(),
            collected_by: req.user.id
        });
        
        // Also keep legacy Payment record if the UI depends on it
        // The Payment component also used "P_XYZ"
        await Payment.create({
            institute_id: instituteId,
            student_id: fee.student_id,
            fee_structure_id: fee.fee_structure_id,
            amount_paid: amount,
            payment_date: new Date(),
            payment_method: "online",
            transaction_id: receiptNumber,
            status: "success",
            collected_by: req.user.id,
            remarks: "Online Razorpay Payment"
        });

        // Generate Invoice record for fee
        await Invoice.create({
            institute_id: instituteId,
            payment_id: rzpPayment.id,
            invoice_type: 'student_fee',
            invoice_number: receiptNumber,
            invoice_date: new Date(),
            subtotal: amount,
            tax_amount: 0,
            total_amount: amount
        });

        res.json({
            success: true,
            message: "Fee payment successful",
            new_due_amount: newDueAmount,
            receipt_number: receiptNumber
        });

    } catch (error) {
        console.error("Fee verification error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
