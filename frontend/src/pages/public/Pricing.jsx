/**
 * Public Pricing Page
 * Displays available subscription plans
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import PublicNavbar from "../../components/layout/PublicNavbar";
import "./Public.css";

const Pricing = () => {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const res = await api.get("/plans");
            const activePlans = (res.data.data || []).filter(p => p.status === "active" && !p.is_hidden);
            setPlans(activePlans);
        } catch (error) {
            console.error("Error fetching plans:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="public-container">
            <PublicNavbar />

            <header className="hero-section" style={{ padding: "4rem 2rem" }}>
                <h1 className="hero-title">Simple, Transparent Pricing</h1>
                <p className="hero-subtitle">Choose a plan that fits your institute's size and needs.</p>
            </header>

            <section className="pricing-section">
                <div className="pricing-grid">
                    {loading ? (
                        <div style={{ textAlign: "center", width: "100%", fontSize: "1.2rem" }}>Loading plans...</div>
                    ) : plans.length === 0 ? (
                        <div style={{ textAlign: "center", width: "100%" }}>No plans available at the moment.</div>
                    ) : (
                        plans.map(plan => (
                            <div key={plan.id} className="pricing-card">
                                <h3 className="plan-name">{plan.name}</h3>
                                <div className="plan-price">
                                    ₹{plan.price}<span>/mo</span>
                                </div>
                                <div style={{ borderBottom: "1px solid #e5e7eb", margin: "1rem 0" }}></div>
                                <ul className="plan-features">
                                    <li><span className="check-icon">✓</span> <strong>{plan.student_limit}</strong> Students</li>
                                    <li><span className="check-icon">✓</span> <strong>{plan.faculty_limit || 10}</strong> Faculty Members</li>
                                    <li><span className={plan.feature_attendance ? "check-icon" : "close-icon"}>{plan.feature_attendance ? "✓" : "×"}</span> Attendance System</li>
                                    <li><span className={plan.feature_fees ? "check-icon" : "close-icon"}>{plan.feature_fees ? "✓" : "×"}</span> Fee Management</li>
                                    <li><span className={plan.feature_exams ? "check-icon" : "close-icon"}>{plan.feature_exams ? "✓" : "×"}</span> Examination Features</li>
                                    <li><span className={plan.feature_reports ? "check-icon" : "close-icon"}>{plan.feature_reports ? "✓" : "×"}</span> Analytics & Reports</li>
                                    <li><span className={plan.feature_parent_portal ? "check-icon" : "close-icon"}>{plan.feature_parent_portal ? "✓" : "×"}</span> Parent Portal Access</li>
                                </ul>
                                <Link to={`/register?plan=${plan.id}`} className="plan-btn">
                                    Select {plan.name}
                                </Link>
                            </div>
                        ))
                    )}
                </div>
            </section>

            <footer className="footer" style={{ background: "#1f2937", color: "white", padding: "2rem", textAlign: "center" }}>
                <p>© 2026 ZF Solution. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default Pricing;
