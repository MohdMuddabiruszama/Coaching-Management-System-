/**
 * Payment / Checkout Page — Premium Redesign
 * Handles new subscriptions and renewals with a beautiful UI
 */

import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useRazorpayPayment } from "../../hooks/useRazorpayPayment";
import "./PaymentPage.css";
import zfLogo from "../../assets/zf-logo.png";

function PaymentPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [planId, setPlanId] = useState(searchParams.get("plan_id"));
    const [plan, setPlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [billingCycle, setBillingCycle] = useState("monthly");
    const [hasUsedTrial, setHasUsedTrial] = useState(false);
    const [isTestMode, setIsTestMode] = useState(true);
    const [instituteName, setInstituteName] = useState("");

    useEffect(() => {
        fetchPlanDetails();
    }, [planId]);

    const fetchPlanDetails = async () => {
        try {
            if (!planId) {
                try {
                    const profile = await api.get("/auth/profile");
                    if (profile.data.user && profile.data.user.Institute) {
                        const institute = profile.data.user.Institute;
                        setInstituteName(institute.name || "");
                        if (institute.plan_id) {
                            setPlanId(institute.plan_id);
                            setHasUsedTrial(institute.has_used_trial || false);
                            if (institute.Plan) {
                                setPlan(institute.Plan);
                                setLoading(false);
                                return;
                            }
                        } else {
                            navigate("/pricing");
                            return;
                        }
                    } else {
                        navigate("/login");
                        return;
                    }
                } catch (e) {
                    navigate("/login");
                    return;
                }
            } else {
                try {
                    const profile = await api.get("/auth/profile");
                    if (profile.data.user && profile.data.user.Institute) {
                        setHasUsedTrial(profile.data.user.Institute.has_used_trial || false);
                        setInstituteName(profile.data.user.Institute.name || "");
                    }
                } catch (e) { /* ignore */ }
            }

            const response = await api.get("/plans");
            const currentPlanId = planId || (plan ? plan.id : null);
            if (currentPlanId) {
                const selectedPlan = response.data.data.find(p => p.id === parseInt(currentPlanId));
                if (selectedPlan) {
                    setPlan(selectedPlan);
                } else {
                    alert("Invalid Plan");
                    navigate("/pricing");
                }
            } else {
                navigate("/pricing");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const { initializePayment, isPaymentLoading } = useRazorpayPayment();

    const handlePayment = async () => {
        setProcessing(true);
        try {
            const initResponse = await api.post("/payment/initiate", {
                planId: plan.id,
                billingCycle,
                testMode: isTestMode
            });

            if (initResponse.data.trial_activated) {
                alert("Free Trial Activated Successfully! Redirecting to Dashboard...");
                window.location.href = "/admin/dashboard";
                return;
            }

            const { order, key, institute_name } = initResponse.data;

            if (key === "rzp_test_mock") {
                const confirmMock = window.confirm(
                    `Mock Payment Gateway\n\nPay ₹${order.amount / 100} for ${plan.name}?\n\nClick OK to succeed, Cancel to fail.`
                );
                if (confirmMock) {
                    try {
                        const verifyRes = await api.post("/payment/verify", {
                            razorpay_order_id: order.id,
                            razorpay_payment_id: `pay_mock_${Date.now()}`,
                            razorpay_signature: "mock_signature",
                            planId: plan.id,
                            billingCycle
                        });
                        if (verifyRes.data.success) {
                            alert("Payment Successful! Redirecting to Dashboard...");
                            window.location.href = "/admin/dashboard";
                        }
                    } catch (verifyError) {
                        alert("Payment Verification Failed: " + verifyError.response?.data?.message);
                    }
                } else {
                    try {
                        await api.post("/payment/verify-failure", {
                            razorpay_order_id: order.id,
                            error_description: "User cancelled mock payment",
                            planId: plan.id,
                            billingCycle
                        });
                    } catch (e) {
                        console.error("Failed to record mock payment failure", e);
                    }
                    alert("Payment Failed: User cancelled mock payment");
                }
                setProcessing(false);
            } else {
                setProcessing(false);
                initializePayment({
                    orderConfig: {
                        key,
                        amount: order.amount,
                        currency: order.currency,
                        order_id: order.id,
                    },
                    userConfig: {
                        institute_name: institute_name || instituteName || "ZenithFlows",
                        description: `Subscription for ${plan.name}`,
                        name: "Institute Admin",
                        email: "admin@example.com",
                        contact: ""
                    },
                    onSuccess: async (paymentData) => {
                        try {
                            const verifyRes = await api.post("/payment/verify", {
                                razorpay_order_id: paymentData.razorpay_order_id,
                                razorpay_payment_id: paymentData.razorpay_payment_id,
                                razorpay_signature: paymentData.razorpay_signature,
                                planId: plan.id,
                                billingCycle
                            });
                            if (verifyRes.data.success) {
                                alert("Payment Successful! Redirecting to Dashboard...");
                                window.location.href = "/admin/dashboard";
                            }
                        } catch (verifyError) {
                            alert("Payment Verification Failed: " + verifyError.response?.data?.message);
                        }
                    },
                    onFailure: async (errDesc) => {
                        try {
                            await api.post("/payment/verify-failure", {
                                razorpay_order_id: order.id,
                                error_description: errDesc,
                                planId: plan.id,
                                billingCycle
                            });
                        } catch (e) {
                            console.error("Failed to record payment failure", e);
                        }
                        alert(`Payment Failed: ${errDesc}`);
                    }
                });
            }
        } catch (error) {
            console.error("Payment Error:", error);
            alert("Payment initiation failed: " + (error.response?.data?.message || error.message));
            setProcessing(false);
        }
    };

    const isFree = plan?.is_free_trial && !hasUsedTrial;
    const isLifetime = plan?.is_lifetime;

    const discountPercent = plan?.yearly_discount_percent != null ? Number(plan.yearly_discount_percent) : 0;
    const discountMultiplier = discountPercent / 100;
    const priceMultiplier = 1 - discountMultiplier;

    // Base price (before GST) — mirrors backend getPlanAmountForCycle logic
    // Force Number() to avoid string coercion when values come from the DB as strings
    const price = isFree ? 0
        : isLifetime ? Number(plan?.lifetime_price || plan?.price || 0)
        : billingCycle === "yearly"
            ? Math.round(Number(plan?.price || 0) * 12 * priceMultiplier)
            : Number(plan?.price || 0);

    const gstPercent = plan?.gst_percent != null ? Number(plan.gst_percent) : 2;
    const gstRate = gstPercent / 100;
    const gstAmount = isFree ? 0 : parseFloat((price * gstRate).toFixed(2));
    const totalWithGst = isFree ? 0 : parseFloat(((price + gstAmount)).toFixed(2));

    const monthlyEquiv = isFree ? 0
        : isLifetime ? 0
        : billingCycle === "yearly"
            ? Math.round(Number(plan?.price || 0) * priceMultiplier)
            : Number(plan?.price || 0);

    const savings = !isFree && !isLifetime && billingCycle === "yearly"
        ? Math.round(Number(plan?.price || 0) * 12 * discountMultiplier)
        : 0;

    if (loading) {
        return (
            <div className="checkout-loading-screen">
                <div className="checkout-spinner" />
                <p>Loading your plan...</p>
            </div>
        );
    }

    if (!plan) return null;

    return (
        <div className="checkout-page">
            {/* Animated background */}
            <div className="checkout-bg">
                <div className="checkout-bg-circle c1" />
                <div className="checkout-bg-circle c2" />
                <div className="checkout-bg-circle c3" />
            </div>

            <div className="checkout-wrapper">
                {/* LEFT PANEL — Plan Summary */}
                <div className="checkout-panel checkout-left">
                    {/* Logo + Brand */}
                    <div className="checkout-brand">
                        <img src={zfLogo} alt="ZenithFlows" className="checkout-brand-icon" style={{ height: '40px', width: '40px', objectFit: 'contain', borderRadius: '8px' }} />
                        <span className="checkout-brand-name">ZenithFlows</span>
                    </div>

                    {/* Plan Badge */}
                    <div className="checkout-plan-badge">
                        {isFree ? "🎁 Free Trial" : "⭐ " + plan.name}
                    </div>

                    <h1 className="checkout-left-title">
                        {isFree ? "Start Your Free Trial" : "Complete Your Subscription"}
                    </h1>
                    <p className="checkout-left-sub">
                        {isFree
                            ? `Activate your free trial for ${plan.name} — no credit card required`
                            : instituteName
                                ? `Secure payment for ${instituteName}`
                                : `Secure payment for ${plan.name}`}
                    </p>

                    {/* Billing Cycle Selector */}
                    {!isFree && !isLifetime && (
                        <div className="checkout-billing-toggle">
                            <button
                                className={`checkout-billing-btn ${billingCycle === "monthly" ? "active" : ""}`}
                                onClick={() => setBillingCycle("monthly")}
                            >
                                Monthly
                            </button>
                            <button
                                className={`checkout-billing-btn ${billingCycle === "yearly" ? "active" : ""}`}
                                onClick={() => setBillingCycle("yearly")}
                            >
                                Yearly
                                {discountPercent > 0 && (
                                    <span className="checkout-save-chip">Save {discountPercent}%</span>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Price Display */}
                    <div className="checkout-price-block">
                        <div className="checkout-price-main">
                            <span className="checkout-currency">₹</span>
                            <span className="checkout-amount">
                                {isFree ? "0" : totalWithGst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            {!isFree && !isLifetime && (
                                <span className="checkout-period">
                                    /{billingCycle === "yearly" ? "year" : "mo"}
                                </span>
                            )}
                            {isLifetime && (
                                <span className="checkout-period"> / One-Time</span>
                            )}
                        </div>
                        {!isFree && (
                            <div className="checkout-price-sub" style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.82rem', marginTop: '4px' }}>
                                ₹{price.toLocaleString("en-IN")} + {gstPercent}% GST (₹{gstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })})
                            </div>
                        )}
                        {!isFree && billingCycle === "yearly" && (
                            <div className="checkout-price-sub">
                                ₹{monthlyEquiv.toLocaleString("en-IN")}/mo · You save ₹{savings.toLocaleString("en-IN")}/year
                            </div>
                        )}
                        {isFree && (
                            <div className="checkout-price-sub">No credit card required</div>
                        )}
                    </div>

                    {/* Features / What's included */}
                    <div className="checkout-includes">
                        <p className="checkout-includes-title">What's included:</p>
                        <ul className="checkout-features-list">
                            {[
                                isLifetime ? (plan.max_students_lifetime && plan.max_students_lifetime !== -1 ? `Up to ${plan.max_students_lifetime} students` : "Unlimited students") : (plan.max_students && plan.max_students !== -1 ? `Up to ${plan.max_students} students` : "Unlimited students"),
                                isLifetime ? (plan.max_faculty_lifetime && plan.max_faculty_lifetime !== -1 ? `Up to ${plan.max_faculty_lifetime} faculty members` : "Unlimited faculty members") : (plan.max_faculty && plan.max_faculty !== -1 ? `Up to ${plan.max_faculty} faculty members` : "Unlimited faculty members"),
                                plan.max_classes && plan.max_classes !== -1 ? `Up to ${plan.max_classes} classes` : "Unlimited classes",
                                plan.feature_attendance && "Attendance management",
                                plan.feature_fees && "Fees & payment tracking",
                                plan.feature_finance && "Finance dashboard",
                                plan.feature_timetable && "Timetable management",
                                plan.feature_reports && plan.feature_reports !== "none" && "Reports & analytics",
                                plan.feature_announcements && "Announcements",
                                plan.feature_public_page && "Public institute page",
                            ].filter(Boolean).map((feature, i) => (
                                <li key={i} className="checkout-feature-item">
                                    <span className="checkout-check">✓</span>
                                    {feature}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Trust signals */}
                    <div className="checkout-trust">
                        <div className="checkout-trust-item">
                            <span>🔒</span> SSL Encrypted
                        </div>
                        <div className="checkout-trust-item">
                            <span>↩️</span> Cancel anytime
                        </div>
                        <div className="checkout-trust-item">
                            <span>⚡</span> Instant activation
                        </div>
                    </div>
                </div>

                {/* RIGHT PANEL — Payment Form */}
                <div className="checkout-panel checkout-right">
                    {/* Back to pricing */}
                    <button className="checkout-back-btn" onClick={() => navigate("/pricing")}>
                        ← Back to plans
                    </button>

                    {/* Order Summary Card */}
                    <div className="checkout-summary-card">
                        <h3 className="checkout-summary-title">Order Summary</h3>

                        <div className="checkout-summary-rows">
                            <div className="checkout-summary-row">
                                <span className="checkout-row-label">Plan</span>
                                <span className="checkout-row-value">{plan.name}</span>
                            </div>
                            {!isFree && !isLifetime && (
                                <div className="checkout-summary-row">
                                    <span className="checkout-row-label">Billing cycle</span>
                                    <span className="checkout-row-value">
                                        {billingCycle === "yearly" ? "Annual" : "Monthly"}
                                    </span>
                                </div>
                            )}
                            {isLifetime && (
                                <div className="checkout-summary-row">
                                    <span className="checkout-row-label">Billing cycle</span>
                                    <span className="checkout-row-value">One-Time Payment</span>
                                </div>
                            )}
                            {!isFree && !isLifetime && billingCycle === "yearly" && savings > 0 && discountPercent > 0 && (
                                <div className="checkout-summary-row discount-row">
                                    <span className="checkout-row-label">Annual discount ({discountPercent}%)</span>
                                    <span className="checkout-row-value discount-value">-₹{savings.toLocaleString("en-IN")}</span>
                                </div>
                            )}
                            {!isFree && (
                                <>
                                    <div className="checkout-summary-row">
                                        <span className="checkout-row-label">Subtotal</span>
                                        <span className="checkout-row-value">₹{price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="checkout-summary-row gst-row">
                                        <span className="checkout-row-label">
                                            GST ({gstPercent}%)
                                            <span className="gst-badge">Govt. Tax</span>
                                        </span>
                                        <span className="checkout-row-value gst-value">
                                            +₹{gstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </>
                            )}
                            <div className="checkout-summary-divider" />
                            <div className="checkout-summary-row total-row">
                                <span className="checkout-row-label">Total due today</span>
                                <span className="checkout-row-value total-value">
                                    {isFree ? "Free" : `₹${totalWithGst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                </span>
                            </div>
                            {!isFree && (
                                <div className="checkout-gst-note">
                                    * All prices are inclusive of {gstPercent}% GST as applicable under Indian tax law
                                </div>
                            )}
                        </div>
                    </div>



                    {/* Pay Button */}
                    <button
                        id="checkout-pay-btn"
                        className={`checkout-pay-btn ${processing || isPaymentLoading ? "loading" : ""}`}
                        onClick={handlePayment}
                        disabled={processing || isPaymentLoading}
                    >
                        {processing || isPaymentLoading ? (
                            <span className="checkout-btn-loading">
                                <span className="checkout-btn-spinner" />
                                Processing...
                            </span>
                        ) : (
                            <span className="checkout-btn-text">
                                {isFree
                                    ? "🚀 Start Free Trial"
                                    : `🔒 Pay ₹${totalWithGst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </span>
                        )}
                    </button>

                    {/* Security badge */}
                    <div className="checkout-security-row">
                        <div className="checkout-security-badge">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            Secured by Razorpay
                            {!isFree && (
                                <span className={`checkout-mode-pill ${isTestMode ? "test" : "live"}`}>
                                    {isTestMode ? "Test" : "Live"}
                                </span>
                            )}
                        </div>
                        <div className="checkout-accepted-cards">
                            <span title="Visa">💳</span>
                            <span title="UPI">📱</span>
                            <span title="Net Banking">🏦</span>
                        </div>
                    </div>

                    {/* Guarantee */}
                    <div className="checkout-guarantee">
                        <div className="checkout-guarantee-icon">🛡️</div>
                        <div>
                            <strong>100% Secure & Encrypted</strong>
                            <p>Your payment info is protected by bank-grade 256-bit SSL encryption.</p>
                        </div>
                    </div>

                    {/* Need help */}
                    <div className="checkout-help">
                        Questions? <a href="/contact" className="checkout-help-link">Contact our team →</a>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PaymentPage;
