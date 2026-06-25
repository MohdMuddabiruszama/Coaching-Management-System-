/**
 * Lifetime Access Purchase Page (Admin)
 * Allows institute admin to purchase lifetime access via Razorpay
 */

import { useState, useEffect, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import ThemeSelector from "../../components/ThemeSelector";
import "./Dashboard.css";

const LIFETIME_FEATURES = [
    { icon: "👨‍🎓", label: "Unlimited Students & Faculty" },
    { icon: "🎓", label: "All Premium Features Unlocked Forever" },
    { icon: "📊", label: "Advanced Attendance & Biometric" },
    { icon: "💰", label: "Full Finance & Salary Management" },
    { icon: "📱", label: "Custom Branding & Mobile App" },
    { icon: "🔗", label: "API Access & Multi-Branch" },
    { icon: "🎯", label: "Priority Support (24/7)" },
    { icon: "🔄", label: "Free Future Feature Updates" },
    { icon: "🌐", label: "Custom Subdomain" },
    { icon: "♾️", label: "No Monthly/Yearly Fees — Ever" },
];

function LifetimeAccess() {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const [lifetimePlan, setLifetimePlan] = useState(null);
    const [institute, setInstitute] = useState(null);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        fetchData();
        loadRazorpay();
    }, []);

    const loadRazorpay = () => {
        if (document.getElementById("razorpay-script")) return;
        const script = document.createElement("script");
        script.id = "razorpay-script";
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        document.body.appendChild(script);
    };

    const fetchData = async () => {
        try {
            const [planRes, instRes] = await Promise.all([
                api.get("/lifetime/info"),
                api.get(`/institutes/${user.institute_id}`)
            ]);
            if (planRes.data.success) setLifetimePlan(planRes.data.plan);
            setInstitute(instRes.data.data);
        } catch (err) {
            setError("Could not load plan information. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handlePurchase = async () => {
        if (!lifetimePlan) return;
        setPurchasing(true);
        setError("");
        try {
            // 1. Create Razorpay order
            const orderRes = await api.post("/lifetime/order");
            const { order_id, amount, razorpay_key, is_founding_member } = orderRes.data;

            // 2. Open Razorpay checkout
            const options = {
                key: razorpay_key,
                amount: amount * 100,
                currency: "INR",
                name: "ZenithFlows",
                description: is_founding_member ? "💎 Founding Member — Lifetime Access" : "💎 Lifetime Access",
                order_id: order_id,
                prefill: {
                    name: institute?.name || user?.name || "",
                    email: institute?.email || user?.email || "",
                    contact: institute?.phone || "",
                },
                theme: { color: "#7c3aed" },
                modal: {
                    ondismiss: () => { setPurchasing(false); }
                },
                handler: async (response) => {
                    try {
                        // 3. Verify payment
                        const verifyRes = await api.post("/lifetime/verify", {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                        });
                        if (verifyRes.data.success) {
                            setSuccess(true);
                            setTimeout(() => { window.location.href = "/admin/dashboard"; }, 3000);
                        } else {
                            setError(verifyRes.data.message || "Payment verification failed.");
                        }
                    } catch (verifyErr) {
                        setError(verifyErr.response?.data?.message || "Payment verification failed. Please contact support.");
                    } finally {
                        setPurchasing(false);
                    }
                }
            };

            if (!window.Razorpay) {
                setError("Razorpay not loaded. Please refresh and try again.");
                setPurchasing(false);
                return;
            }

            const rzp = new window.Razorpay(options);
            rzp.open();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to initiate payment. Please try again.");
            setPurchasing(false);
        }
    };

    if (loading) {
        return (
            <div className="dashboard-container" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>💎</div>
                    <p>Loading Lifetime Access details...</p>
                </div>
            </div>
        );
    }

    if (institute?.is_lifetime_member) {
        return (
            <div className="dashboard-container">
                <div className="dashboard-header">
                    <h1>💎 Lifetime Access</h1>
                    <div className="dashboard-header-right">
                        <ThemeSelector />
                        <Link to="/admin/dashboard" className="btn btn-secondary">Back</Link>
                    </div>
                </div>
                <div className="card" style={{ maxWidth: "600px", textAlign: "center", padding: "3rem" }}>
                    <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🎉</div>
                    <h2 style={{ color: "#7c3aed", marginBottom: "0.5rem" }}>You're a Lifetime Member!</h2>
                    {institute.founding_member && (
                        <span style={{ background: "#f59e0b", color: "#000", padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 700 }}>
                            🌟 Founding Member
                        </span>
                    )}
                    <p style={{ color: "var(--text-secondary)", marginTop: "1rem" }}>
                        Your institute has lifetime access to all features. No more billing!
                    </p>
                    {institute.lifetime_purchased_at && (
                        <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                            Member since: {new Date(institute.lifetime_purchased_at).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}
                        </p>
                    )}
                    <Link to="/admin/dashboard" className="btn btn-primary" style={{ marginTop: "1.5rem", display: "inline-block" }}>
                        Go to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="dashboard-container" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
                <div className="card" style={{ maxWidth: "500px", textAlign: "center", padding: "3rem" }}>
                    <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🎉</div>
                    <h2 style={{ color: "#7c3aed" }}>Welcome to the Family!</h2>
                    <p>Your Lifetime Access has been activated. Redirecting to dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <h1>💎 Lifetime Access</h1>
                    <p>Pay once. Use forever. No subscriptions.</p>
                </div>
                <div className="dashboard-header-right">
                    <ThemeSelector />
                    <Link to="/admin/dashboard" className="btn btn-secondary">← Back</Link>
                </div>
            </div>

            {!lifetimePlan ? (
                <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
                    <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>
                    <h3>Lifetime Access Not Available</h3>
                    <p style={{ color: "var(--text-secondary)" }}>The lifetime plan is not currently offered. Please check back later or contact support.</p>
                    <Link to="/admin/dashboard" className="btn btn-primary" style={{ marginTop: "1rem", display: "inline-block" }}>Go Back</Link>
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "2rem", maxWidth: "1100px", alignItems: "start" }}>
                    {/* Left: Features */}
                    <div>
                        {/* Urgency banner */}
                        {lifetimePlan.slots_remaining < 20 && (
                            <div style={{ background: "linear-gradient(90deg, #7f1d1d, #991b1b)", color: "#fff", borderRadius: "12px", padding: "14px 20px", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "10px" }}>
                                <span style={{ fontSize: "20px" }}>⚡</span>
                                <div>
                                    <strong>Limited Time Offer!</strong> Only <strong>{lifetimePlan.slots_remaining}</strong> spots remaining out of {lifetimePlan.lifetime_slots_total}.
                                    {lifetimePlan.is_founding_available && " Founding Member pricing ends soon!"}
                                </div>
                            </div>
                        )}

                        {/* Founding Member callout */}
                        {lifetimePlan.is_founding_available && (
                            <div style={{ background: "linear-gradient(135deg, #78350f, #92400e)", color: "#fff", borderRadius: "12px", padding: "16px 20px", marginBottom: "1.5rem", border: "1px solid #f59e0b" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                                    <span style={{ fontSize: "22px" }}>🌟</span>
                                    <strong style={{ fontSize: "16px" }}>You qualify for Founding Member pricing!</strong>
                                </div>
                                <p style={{ margin: 0, fontSize: "14px", color: "#fcd34d" }}>
                                    First 50 institutes get lifetime access at ₹19,999 (save ₹5,000 vs standard ₹24,999).
                                </p>
                            </div>
                        )}

                        <div className="card" style={{ padding: "2rem" }}>
                            <h2 style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "10px" }}>
                                <span>💎</span> Everything Included — Forever
                            </h2>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                {LIFETIME_FEATURES.map((f, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", background: "var(--bg-secondary, #f9fafb)", borderRadius: "8px" }}>
                                        <span style={{ fontSize: "20px" }}>{f.icon}</span>
                                        <span style={{ fontSize: "14px", fontWeight: "500" }}>{f.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="card" style={{ padding: "1.5rem", marginTop: "1.5rem" }}>
                            <h3 style={{ marginBottom: "1rem" }}>💡 Compare: Subscription vs Lifetime</h3>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                                <thead>
                                    <tr style={{ borderBottom: "2px solid var(--border, #e5e7eb)" }}>
                                        <th style={{ textAlign: "left", padding: "10px" }}>Feature</th>
                                        <th style={{ textAlign: "center", padding: "10px", color: "#6b7280" }}>Monthly Plan</th>
                                        <th style={{ textAlign: "center", padding: "10px", color: "#7c3aed" }}>💎 Lifetime</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        ["Recurring fees", "✅ Yes", "❌ None"],
                                        ["Student limit", "Per plan", "Unlimited"],
                                        ["Faculty limit", "Per plan", "Unlimited"],
                                        ["All features", "Based on plan", "All unlocked"],
                                        ["Future updates", "With subscription", "Free forever"],
                                        ["Priority support", "Standard", "24/7 priority"],
                                    ].map(([feat, sub, life]) => (
                                        <tr key={feat} style={{ borderBottom: "1px solid var(--border, #e5e7eb)" }}>
                                            <td style={{ padding: "10px", fontWeight: "500" }}>{feat}</td>
                                            <td style={{ padding: "10px", textAlign: "center", color: "#6b7280" }}>{sub}</td>
                                            <td style={{ padding: "10px", textAlign: "center", color: "#7c3aed", fontWeight: "600" }}>{life}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Right: Checkout */}
                    <div>
                        <div className="card" style={{ padding: "2rem", background: "linear-gradient(135deg, #1a0533, #3b0764)", color: "#fff", position: "sticky", top: "20px" }}>
                            <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                                <div style={{ fontSize: "3rem", marginBottom: "8px" }}>💎</div>
                                <h2 style={{ color: "#fff", margin: "0 0 4px" }}>Lifetime Access</h2>
                                <p style={{ color: "#c4b5fd", fontSize: "14px", margin: 0 }}>Pay once, access forever</p>
                            </div>

                            <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                                {lifetimePlan.is_founding_available && (
                                    <div style={{ textDecoration: "line-through", color: "#a78bfa", fontSize: "16px" }}>
                                        ₹{lifetimePlan.standard_price?.toLocaleString("en-IN") || "24,999"}
                                    </div>
                                )}
                                <div style={{ fontSize: "3.5rem", fontWeight: 900, color: "#fff", lineHeight: 1 }}>
                                    ₹{lifetimePlan.current_price?.toLocaleString("en-IN") || "19,999"}
                                </div>
                                <div style={{ color: "#c4b5fd", fontSize: "13px" }}>one-time payment (incl. taxes)</div>
                                {lifetimePlan.is_founding_available && (
                                    <div style={{ background: "#f59e0b", color: "#000", borderRadius: "8px", padding: "6px 12px", marginTop: "8px", fontSize: "12px", fontWeight: 700 }}>
                                        🌟 FOUNDING MEMBER — Save ₹{((lifetimePlan.standard_price || 24999) - (lifetimePlan.current_price || 19999)).toLocaleString("en-IN")}
                                    </div>
                                )}
                            </div>

                            {/* Slot counter */}
                            <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: "10px", padding: "12px", marginBottom: "1.5rem", textAlign: "center" }}>
                                <div style={{ fontSize: "13px", color: "#e9d5ff", marginBottom: "6px" }}>
                                    Slots filled: {lifetimePlan.lifetime_slots_used || 0} / {lifetimePlan.lifetime_slots_total || 100}
                                </div>
                                <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: "999px", height: "8px", overflow: "hidden" }}>
                                    <div style={{
                                        height: "100%",
                                        borderRadius: "999px",
                                        background: "linear-gradient(90deg, #f59e0b, #ef4444)",
                                        width: `${Math.min(100, ((lifetimePlan.lifetime_slots_used || 0) / (lifetimePlan.lifetime_slots_total || 100)) * 100)}%`,
                                        transition: "width 0.5s ease"
                                    }} />
                                </div>
                                <div style={{ fontSize: "12px", color: "#fca5a5", marginTop: "6px" }}>
                                    ⚡ Only {lifetimePlan.slots_remaining} spots remaining!
                                </div>
                            </div>

                            {error && (
                                <div style={{ background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.5)", borderRadius: "8px", padding: "12px", marginBottom: "1rem", fontSize: "13px", color: "#fca5a5" }}>
                                    ⚠️ {error}
                                </div>
                            )}

                            <button
                                id="btn-purchase-lifetime"
                                onClick={handlePurchase}
                                disabled={purchasing || lifetimePlan.slots_remaining <= 0}
                                style={{
                                    width: "100%",
                                    background: purchasing ? "#6d28d9" : "linear-gradient(135deg, #f59e0b, #d97706)",
                                    color: "#000",
                                    fontWeight: 800,
                                    fontSize: "16px",
                                    padding: "16px",
                                    borderRadius: "12px",
                                    border: "none",
                                    cursor: purchasing ? "wait" : "pointer",
                                    boxShadow: "0 8px 24px rgba(245,158,11,0.4)",
                                    transition: "all 0.2s",
                                    marginBottom: "12px",
                                    opacity: purchasing ? 0.8 : 1
                                }}
                            >
                                {purchasing ? "⟳ Processing..." : "💎 Get Lifetime Access Now"}
                            </button>

                            <div style={{ textAlign: "center", fontSize: "12px", color: "#9ca3af" }}>
                                🔒 Secure payment via Razorpay<br />
                                📜 GST invoice provided<br />
                                ♻️ 7-day refund policy
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default LifetimeAccess;
