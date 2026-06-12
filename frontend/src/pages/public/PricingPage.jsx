/**
 * PricingPage — Professional SaaS Pricing Experience
 * Features: Billing / Platform toggles (image-matched),
 *           compact cards with icon · name · desc · price · savings · stats,
 *           feature comparison modal, premium lifetime section
 */

import { useState, useEffect, useContext, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import api from "../../services/api";
import Navbar from "../../components/landing/Navbar";
import Footer from "../../components/landing/Footer";
import "../../styles/landing.css";
import "./PricingPage.css";

/* ── plan icons ── */
const PLAN_ICONS = { Starter:'🪴', Basic:'📖', Professional:'🚀', Enterprise:'🏛️' };

/* ── storage label ── */
function storageLabel(mb) {
    if (mb === -1 || mb == null) return 'Unlimited';
    if (mb >= 1024) return `${(mb / 1024).toFixed(0)} GB`;
    return `${mb} MB`;
}

/* ───────── Feature comparison data (26 features per spec) ───────── */
const COMPARISON_FEATURES = [
    { section: "Attendance" },
    { label: "Manage Student Attendance", key: "feature_attendance", format: v => v && v !== 'none' ? (v === 'advanced' ? 'Advanced' : 'Basic') : '—' },
    { label: "View Attendance",           key: "feature_attendance", format: v => v && v !== 'none' ? '\u2713' : '—' },
    { label: "Scan Student QR Code",      key: "feature_scan_qr",          bool: true },
    { label: "Faculty Attendance",        key: "feature_faculty_attendance",bool: true },
    { label: "View Faculty Tracker",      key: "feature_faculty_tracker",   bool: true },
    { label: "Scan Faculty QR Code",      key: "feature_faculty_tracker",   bool: true },
    { label: "Biometric Attendance",      key: "feature_biometric",         bool: true },
    { section: "People Management" },
    { label: "Manage Admin / Managers",   key: "feature_students",          bool: true },
    { label: "Manage Students",           key: "feature_students",          bool: true },
    { label: "Manage Classes & Subjects", key: "feature_classes",           bool: true },
    { label: "Manage Faculty",            key: "feature_faculty",           bool: true },
    { label: "Manage Parents",            key: "feature_parent_portal",     bool: true },
    { section: "Finance" },
    { label: "Collect Fees",              key: "feature_fees",              bool: true },
    { label: "Finances & Expenses",       key: "feature_finance",           bool: true },
    { label: "Salary Management",         key: "feature_salary",            bool: true },
    { section: "Academics" },
    { label: "Manage Exams",              key: "feature_exams",             bool: true },
    { label: "Master Timetable",          key: "feature_timetable",         bool: true },
    { label: "Assignments",               key: "feature_assignment",        bool: true },
    { label: "Exam Reports",              key: "feature_export",            bool: true },
    { section: "Communication & Content" },
    { label: "Announcements",             key: "feature_announcements",     bool: true },
    { label: "All Notes",                 key: "feature_notes",             bool: true },
    { label: "Chat Monitor",              key: "feature_chat",              bool: true },
    { section: "Reports & Analytics" },
    { label: "Reports & Analytics",       key: "feature_reports", format: v => v === 'advanced' ? 'Advanced' : v === 'basic' ? 'Standard' : '—' },
    { label: "Student Performance Analytics", key: "feature_performance_analytics", bool: true },
    { label: "Faculty Performance Analytics", key: "feature_performance_analytics", bool: true },
    { section: "Communication Channels" },
    { label: "SMS Notifications",         key: "feature_sms",               bool: true },
    { label: "Email Notifications",       key: "feature_email",             bool: true },
    { label: "WhatsApp",                  key: "feature_whatsapp",          bool: true },
    { section: "Institute Web Page" },
    { label: "Institute Public Web Page", key: "feature_public_page",       bool: true },
    { label: "Custom Domain & Branding",  key: "feature_custom_branding",   bool: true },
    { section: "Advanced" },
    { label: "API Access",                key: "feature_api_access",        bool: true },
    { label: "Multi-Branch Management",   key: "feature_multi_branch",      bool: true },
    { section: "Limits" },
    { label: "Max Students",  key: "max_students",   format: v => v === -1 ? "Unlimited" : `Up to ${v?.toLocaleString('en-IN')}` },
    { label: "Max Admins",    key: "max_admin_users",format: v => v === -1 ? "Unlimited" : `${v}` },
    { label: "Max Faculty",   key: "max_faculty",    format: v => v === -1 ? "Unlimited" : `${v}` },
    { label: "Storage",       key: "max_storage_mb", format: v => storageLabel(v) },
    { section: "Mobile (Web + Mobile only)" },
    { label: "Mobile App Access",    key: "feature_mobile_app",           bool: true },
    { label: "Push Notifications",   key: "feature_push_notifications",   bool: true },
    { label: "Offline Attendance",   key: "feature_offline_attendance",   bool: true },
    { label: "Parent App",           key: "feature_parent_app",           bool: true },
    { label: "Student App",          key: "feature_student_app",          bool: true },
];

/* ───────── FAQ data ───────── */
const FAQS = [
    { q: "Can I change my plan later?", a: "Yes! You can upgrade or downgrade at any time. Upgrades take effect immediately with prorated billing, and downgrades apply at the end of your current billing cycle." },
    { q: "Is there a free trial?", a: "Yes, every new institute gets a full 14-day free trial with access to all Starter features. No credit card required." },
    { q: "What payment methods do you accept?", a: "We accept all major credit/debit cards, UPI, net banking, and popular digital wallets through Razorpay's secure payment gateway." },
    { q: "What's the difference between Web Only and Web + Android?", a: "Web Only gives your institute access via the browser. Web + Android plans include a branded Android mobile app for parents, students, and faculty with push notifications and offline features." },
    { q: "Is my data secure?", a: "Absolutely. We use bank-level encryption (TLS 1.3), automated daily backups, and role-based access controls. Your data is isolated per institute." },
    { q: "What does Lifetime Access include?", a: "A one-time payment gives you permanent access to all features with no recurring charges. Includes all future feature updates and priority support." },
];

function PricingPage() {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const fetchedRef = useRef(false);
    const [plans, setPlans] = useState([]);
    const [lifetimePlan, setLifetimePlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [billingCycle, setBillingCycle] = useState("monthly");
    const [activeTab, setActiveTab] = useState("web_only");
    const [showModal, setShowModal] = useState(false);
    const [modalPlan, setModalPlan] = useState(null);
    const [openFaq, setOpenFaq] = useState(null);

    /* ── single combined API call (no duplicate fetches) ── */
    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;
        Promise.all([
            api.get("/plans"),
            api.get("/lifetime/info").catch(() => null),
        ]).then(([plansRes, ltRes]) => {
            const activePlans = (plansRes.data.data || [])
                .filter(p => p.status === "active" && !p.is_lifetime && !p.is_hidden)
                .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
            setPlans(activePlans);
            if (ltRes?.data?.success) setLifetimePlan(ltRes.data.plan);
        }).catch(err => console.error("Error fetching plans:", err))
          .finally(() => setLoading(false));
    }, []);

    const handleChoosePlan = (plan) => {
        if (plan.contact_sales) { navigate("/contact"); return; }
        if (user && user.role === "admin") {
            navigate(`/checkout?plan_id=${plan.id}&cycle=${billingCycle}`);
        } else {
            localStorage.setItem("selectedPlan", plan.id);
            navigate("/register");
        }
    };

    const handleChooseLifetime = () => {
        if (user && user.role === "admin") navigate("/billing?tab=lifetime");
        else navigate("/register?intent=lifetime");
    };

    const filteredPlans = plans.filter(p => p.platform_type === activeTab);

    const getPrice = (plan) => {
        if (plan.contact_sales) return null;
        if (billingCycle === "yearly" && plan.yearly_price) return Number(plan.yearly_price);
        return Number(plan.price);
    };

    const getSavings = (plan) => {
        if (billingCycle !== "yearly" || !plan.yearly_price || !plan.price) return null;
        const saved = Number(plan.price) * 12 - Number(plan.yearly_price);
        return saved > 0 ? saved : null;
    };

    const formatPrice = (num) => {
        if (!num && num !== 0) return "";
        return num.toLocaleString("en-IN");
    };

    if (loading) {
        return (
            <div className="landing-root sp-pricing" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                <Navbar />
                <div style={{ textAlign: "center", padding: "10rem 2rem", color: "#94a3b8", flex: 1 }}>Loading plans...</div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="landing-root sp-pricing" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Navbar />
            
            <main style={{ flex: 1, paddingBottom: '4rem' }}>
                {/* ── Header ── */}
                <header className="sp-header" style={{ paddingTop: '100px' }}>
                <div className="sp-badge">Transparent Pricing</div>
                <h1 className="sp-title">Choose the Perfect Plan for Your Institute</h1>
                <p className="sp-subtitle">
                    No hidden fees. Cancel anytime. Start with our 14-day free trial — no credit card required.
                </p>
            </header>

            {/* ── Trust Bar ── */}
            <div className="sp-trust-bar">
                <div className="sp-trust-item"><span className="icon">🔒</span> Secure Payments</div>
                <div className="sp-trust-item"><span className="icon">⚡</span> Instant Setup</div>
                <div className="sp-trust-item"><span className="icon">📞</span> Free Support</div>
                <div className="sp-trust-item"><span className="icon">🔄</span> Cancel Anytime</div>
            </div>

            {/* ── Controls: Billing + Platform ── */}
            <div className="sp-controls">
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <span className="sp-ctrl-label">Billing:</span>
                    <div className="sp-billing-toggle">
                        <button
                            className={`sp-billing-btn ${billingCycle === "monthly" ? "active" : ""}`}
                            onClick={() => setBillingCycle("monthly")}
                        >
                            Monthly
                        </button>
                        <button
                            className={`sp-billing-btn ${billingCycle === "yearly" ? "active" : ""}`}
                            onClick={() => setBillingCycle("yearly")}
                        >
                            Yearly <span className="sp-save-tag">save 2 months</span>
                        </button>
                    </div>
                </div>

                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <span className="sp-ctrl-label">Platform:</span>
                    <div className="sp-platform-tabs">
                        <button
                            className={`sp-platform-tab ${activeTab === "web_only" ? "active" : ""}`}
                            onClick={() => setActiveTab("web_only")}
                        >
                            Web only
                        </button>
                        <button
                            className={`sp-platform-tab ${activeTab === "web_android" ? "active" : ""}`}
                            onClick={() => setActiveTab("web_android")}
                        >
                            Web + Mobile app <span className="sp-extra-tag">+extra</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Plan Cards ── */}
            <style>{`
                .sp-plan-card:hover  { transform: translateY(-5px) !important; box-shadow: 0 16px 40px rgba(0,0,0,0.35) !important; }
                .sp-plan-card:active { transform: translateY(0) scale(0.98) !important; }
                .sp-cta-btn:hover    { filter: brightness(1.12); transform: translateY(-1px); }
                .sp-cta-btn:active   { filter: brightness(0.95); transform: translateY(1px); }
            `}</style>
            <div className="sp-plans-container">
                <div className="sp-plans-grid">
                    {filteredPlans.map((plan) => {
                        const price    = getPrice(plan);
                        const savings  = getSavings(plan);
                        const isTrial  = plan.is_free_trial;
                        const isPopular = plan.is_popular;
                        const isEnterprise = plan.contact_sales;
                        const icon     = PLAN_ICONS[plan.name] || '📋';
                        const fCount   = plan.feature_count ?? 0;  // from DB spec
                        const storage  = storageLabel(plan.max_storage_mb);
                        const students = plan.max_students    === -1 ? 'Unlimited' : plan.max_students?.toLocaleString('en-IN');
                        const admins   = plan.max_admin_users === -1 ? 'Unlimited' : plan.max_admin_users;
                        const faculty  = plan.max_faculty     === -1 ? 'Unlimited' : plan.max_faculty?.toLocaleString('en-IN');

                        return (
                            <div
                                key={plan.id}
                                className={`sp-plan-card ${isPopular ? "popular" : ""}`}
                            >
                                {isPopular && <div className="sp-popular-tag">Most popular</div>}

                                {/* Icon · Name · Description */}
                                <div className="sp-plan-icon">{icon}</div>
                                <h3 className="sp-plan-name">{plan.name}</h3>
                                <div className="sp-plan-desc">{plan.description || ''}</div>

                                {/* Price */}
                                {isEnterprise ? (
                                    <div className="sp-price-block">
                                        <span className="sp-price-amount" style={{ fontSize:'1.6rem' }}>Contact Sales</span>
                                    </div>
                                ) : (
                                    <div className="sp-price-block">
                                        <span className="sp-currency">₹</span>
                                        <span className="sp-price-amount">{formatPrice(price)}</span>
                                        <span className="sp-price-period">per {billingCycle === "yearly" ? "year" : "month"}</span>
                                    </div>
                                )}

                                {/* Savings row (yearly only) */}
                                <div className="sp-save-row">
                                    {savings ? `Save ₹${formatPrice(savings)}/yr` : '\u00A0'}
                                </div>

                                <hr className="sp-divider" />

                                {/* Stats grid */}
                                <div className="sp-stats-grid">
                                    <div className="sp-stat-line">
                                        <strong>{students}</strong>
                                        <span className="sp-muted"> students</span>
                                    </div>
                                    <div className="sp-stat-line">
                                        <strong>{admins} admins</strong>
                                        <span className="sp-muted"> · </span>
                                        <strong>{faculty} faculty</strong>
                                    </div>
                                    <div className="sp-stat-line">
                                        <strong>{fCount} features</strong>
                                        <span className="sp-muted"> · </span>
                                        <strong>{storage}</strong>
                                        <span className="sp-muted"> storage</span>
                                    </div>
                                </div>

                                {/* CTA */}
                                <button
                                    className={`sp-cta-btn ${isEnterprise ? "sales" : isPopular ? "primary" : "outline"}`}
                                    onClick={() => handleChoosePlan(plan)}
                                >
                                    {isTrial ? "🎁 Start Free Trial" : isEnterprise ? "📞 Contact Sales" : `Get ${plan.name}`}
                                </button>

                            </div>
                        );
                    })}
                </div>

                <div className="sp-compare-row"></div>
            </div>

            {/* ── Lifetime Access Premium Section ── */}
            {lifetimePlan && (
                <div className="sp-lifetime-section">
                    <div className="sp-lifetime-card">
                        <div className="sp-lifetime-badge">💎 Best Long-Term Value</div>

                        <div className="sp-lifetime-header">
                            <div className="sp-lifetime-info">
                                <h2>Lifetime Access</h2>
                                <p>Pay once. Use forever. No recurring charges — ever.</p>

                                <div className="sp-lifetime-perks">
                                    <span>✅ Unlimited students & faculty</span>
                                    <span>✅ All premium features forever</span>
                                    <span>✅ Full finance & salary module</span>
                                    <span>✅ Priority 24/7 support</span>
                                    <span>✅ Custom subdomain</span>
                                    <span>✅ Free future updates</span>
                                </div>
                            </div>

                            <div className="sp-lifetime-price-box">
                                {lifetimePlan.is_founding_available && (
                                    <div style={{ textDecoration: "line-through", color: "#a78bfa", fontSize: "1rem", marginBottom: 4 }}>
                                        ₹{lifetimePlan.standard_price?.toLocaleString("en-IN") || "24,999"}
                                    </div>
                                )}
                                <div className="sp-lifetime-price">
                                    ₹{lifetimePlan.current_price?.toLocaleString("en-IN") || "19,999"}
                                </div>
                                <div className="sp-lifetime-label">One-time payment</div>

                                {lifetimePlan.slots_remaining != null && (
                                    <div style={{ fontSize: "0.78rem", color: "#fca5a5", marginBottom: 12, fontWeight: 600 }}>
                                        ⚡ Only {lifetimePlan.slots_remaining} slots left!
                                    </div>
                                )}

                                <button className="sp-lifetime-cta" onClick={handleChooseLifetime}>
                                    💎 Get Lifetime Access
                                </button>
                                <div style={{ color: "#9ca3af", fontSize: "0.72rem", marginTop: 8 }}>
                                    🔒 Secure payment via Razorpay
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Feature Comparison Modal ── */}
            {showModal && (
                <div className="sp-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="sp-modal" onClick={e => e.stopPropagation()}>
                        <button className="sp-modal-close" onClick={() => setShowModal(false)}>✕</button>

                        <h2>{modalPlan ? `${modalPlan.name} — Features` : "Compare All Plans"}</h2>

                        <div style={{ overflowX: "auto" }}>
                            <table className="sp-compare-table">
                                <thead>
                                    <tr>
                                        <th>Feature</th>
                                        {modalPlan ? (
                                            <th>{modalPlan.name}</th>
                                        ) : (
                                            filteredPlans.map(p => <th key={p.id}>{p.name}</th>)
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {COMPARISON_FEATURES.map((feat, idx) => {
                                        if (feat.section) {
                                            return (
                                                <tr key={idx} className="section-row">
                                                    <td colSpan={modalPlan ? 2 : filteredPlans.length + 1}>{feat.section}</td>
                                                </tr>
                                            );
                                        }

                                        const renderVal = (plan) => {
                                            const val = plan[feat.key];
                                            if (feat.bool) {
                                                return val ? <span className="sp-check">✓</span> : <span className="sp-cross">—</span>;
                                            }
                                            if (feat.format) return feat.format(val);
                                            return val != null ? String(val) : "—";
                                        };

                                        return (
                                            <tr key={idx}>
                                                <td className="feature-name">{feat.label}</td>
                                                {modalPlan ? (
                                                    <td>{renderVal(modalPlan)}</td>
                                                ) : (
                                                    filteredPlans.map(p => <td key={p.id}>{renderVal(p)}</td>)
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Final CTA ── */}
            <section style={{ textAlign: "center", padding: "2rem 1.5rem 4rem" }}>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#fff", marginBottom: 8 }}>Still have questions?</h2>
                <p style={{ color: "#94a3b8", marginBottom: 20 }}>Our team is here to help you choose the right plan</p>
                <Link
                    to="/contact"
                    style={{
                        display: "inline-block",
                        padding: "12px 32px",
                        background: "linear-gradient(135deg, #6366f1, #818cf8)",
                        color: "#fff",
                        borderRadius: 12,
                        fontWeight: 700,
                        textDecoration: "none",
                        transition: "all 0.25s",
                    }}
                >
                    Contact Us
                </Link>
            </section>
            </main>

            <Footer />
        </div>
    );
}

export default PricingPage;
