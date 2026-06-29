/**
 * Super Admin - Plans Management
 * Create and manage subscription plans
 */

import { useState, useEffect } from "react";
import api from "../../services/api";
import BackButton from "../../components/common/BackButton";
import ThemeSelector from "../../components/ThemeSelector";
// Using the same dashboard CSS for consistency
import "../admin/Dashboard.css";
import "./Plans.css";

function Plans() {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);

    // Initial State Matching Database Model
    const initialFormState = {
        id: null,
        name: "",
        price: "",
        description: "",

        // Limits
        max_students: 100,
        max_faculty: 5,
        max_classes: 5,
        max_admin_users: 1,

        // Core Features (Usually true)
        feature_students: true,
        feature_faculty: true,
        feature_classes: true,
        feature_subjects: true,

        // Advanced/Enum Features
        feature_attendance: 'basic', // none, basic, advanced
        feature_reports: 'none',   // none, basic, advanced

        // Boolean Features
        feature_auto_attendance: false,
        feature_fees: false,
        feature_finance: false,
        feature_salary: false,
        feature_announcements: false,
        feature_exams: false,
        feature_timetable: false,
        feature_notes: false,
        feature_chat: false,
        feature_export: false,
        feature_email: false,
        feature_sms: false,
        feature_whatsapp: false,
        feature_custom_branding: false,
        feature_multi_branch: false,
        feature_api_access: false,
        feature_parent_portal: false,
        feature_mobile_app: false,
        feature_public_page: false,
        feature_assignment: false,
        feature_performance_hub: false,
        feature_transport: false,

        is_free_trial: false,
        trial_days: 0,

        // Lifetime Plan
        is_lifetime: false,
        lifetime_price: "",
        lifetime_slots_total: 100,

        max_chat_messages: 500,

        razorpay_plan_id: "",
        is_popular: false,
        is_hidden: false,
        yearly_discount_percent: 0,
        gst_percent: 2
    };

    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const response = await api.get("/plans");
            setPlans(response.data.data || []);
        } catch (error) {
            console.error("Error fetching plans:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...formData };
            // Ensure numeric values are numbers, handle empty strings
            payload.price = payload.price !== "" && payload.price !== null ? parseFloat(payload.price) : 0;
            payload.max_students = payload.max_students !== "" && payload.max_students !== null ? parseInt(payload.max_students) : 100;
            payload.max_faculty = payload.max_faculty !== "" && payload.max_faculty !== null ? parseInt(payload.max_faculty) : 5;
            payload.max_classes = payload.max_classes !== "" && payload.max_classes !== null ? parseInt(payload.max_classes) : 5;
            payload.max_admin_users = payload.max_admin_users !== "" && payload.max_admin_users !== null ? parseInt(payload.max_admin_users) : 1;
            payload.trial_days = payload.trial_days !== "" && payload.trial_days !== null ? parseInt(payload.trial_days) : 0;
            payload.max_chat_messages = payload.max_chat_messages !== "" && payload.max_chat_messages !== null ? parseInt(payload.max_chat_messages) : 500;
            payload.lifetime_price = payload.lifetime_price !== "" && payload.lifetime_price !== null ? parseFloat(payload.lifetime_price) : null;
            payload.lifetime_slots_total = payload.lifetime_slots_total !== "" && payload.lifetime_slots_total !== null ? parseInt(payload.lifetime_slots_total) : 100;
            payload.yearly_discount_percent = payload.yearly_discount_percent !== "" && payload.yearly_discount_percent !== null ? parseInt(payload.yearly_discount_percent) : 0;
            payload.gst_percent = payload.gst_percent !== "" && payload.gst_percent !== null ? parseInt(payload.gst_percent) : 2;

            if (editMode) {
                await api.put(`/plans/${formData.id}`, payload);
                alert("Plan updated successfully");
            } else {
                const { id, ...data } = payload;
                await api.post("/plans", data);
                alert("Plan created successfully");
            }
            setShowModal(false);
            resetForm();
            fetchPlans();
        } catch (error) {
            alert("Error: " + (error.response?.data?.message || error.message));
        }
    };

    const handleEdit = (plan) => {
        setFormData(plan);
        setEditMode(true);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this plan?")) return;

        try {
            await api.delete(`/plans/${id}`);
            alert("Plan deleted successfully");
            fetchPlans();
        } catch (error) {
            alert("Error deleting plan: " + (error.response?.data?.message || error.message));
        }
    };

    const resetForm = () => {
        setFormData(initialFormState);
        setEditMode(false);
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === "checkbox" ? checked : value,
        });
    };

    if (loading) {
        return <div className="dashboard-container">Loading...</div>;
    }

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <h1>📋 Plans Management</h1>
                    <p>Create and manage subscription plans & feature limits</p>
                </div>
                <div className="dashboard-header-right">
                    <ThemeSelector />
                    <BackButton />
                    <button
                        onClick={() => {
                            resetForm();
                            setShowModal(true);
                        }}
                        className="btn btn-primary"
                    >
                        + Create Plan
                    </button>
                </div>
            </div>

            {/* Plans Grid */}
            <div className="stats-grid">
                {plans.length === 0 ? (
                    <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "2rem" }}>
                        No plans found. Create one to get started.
                    </div>
                ) : (
                    plans.map((plan) => (
                        <div key={plan.id} className="card" style={{ padding: "1.5rem", position: 'relative', ...(plan.is_lifetime ? { border: '2px solid #7c3aed', background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(0,0,0,0))' } : {}) }}>
                            {plan.is_popular && (
                                <div style={{
                                    position: 'absolute', top: 10, right: 10,
                                    background: '#fcd34d', padding: '2px 8px',
                                    borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold'
                                }}>
                                    Most Popular
                                </div>
                            )}
                            {plan.is_lifetime && (
                                <div style={{ position: 'absolute', top: 10, left: 10, background: 'linear-gradient(90deg,#7c3aed,#4f46e5)', color: '#fff', padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                    💎 LIFETIME
                                </div>
                            )}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "1rem" }}>
                                <h3 style={{ margin: 0, fontSize: "1.5rem", color: "#6366f1" }}>{plan.name}</h3>
                            </div>

                            <div style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "1rem" }}>
                                {plan.is_free_trial ? (
                                    <>
                                        <span style={{ textDecoration: "line-through", color: "#9ca3af", marginRight: "0.5rem", fontSize: "1.2rem" }}>
                                            ₹{plan.price}
                                        </span>
                                        <span style={{ color: "#10b981" }}>$0.00</span>
                                    </>
                                ) : (
                                    <>₹{plan.price}</>
                                )}
                                <span style={{ fontSize: "0.875rem", fontWeight: "normal", color: "#6b7280" }}> / month</span>
                            </div>

                            <div style={{ marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "1px solid #e5e7eb", fontSize: "0.9rem" }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                                    <div><strong>Students:</strong> {plan.max_students}</div>
                                    <div><strong>Faculty:</strong> {plan.max_faculty}</div>
                                    <div><strong>Classes:</strong> {plan.max_classes}</div>
                                    <div><strong>Admins:</strong> {plan.max_admin_users}</div>
                                    {plan.feature_chat && (
                                        <div style={{ gridColumn: '1 / -1', color: '#6366f1' }}>
                                            <strong>💬 Chat Limit:</strong> {plan.max_chat_messages === -1 ? '∞ Unlimited' : `${plan.max_chat_messages} msgs/mo`}
                                        </div>
                                    )}
                                    {plan.is_free_trial && (
                                        <div style={{ gridColumn: '1 / -1', color: '#10b981', fontWeight: 'bold' }}>
                                            <strong>Trial Days:</strong> {plan.trial_days}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.85rem" }}>
                                <li style={{ marginBottom: "0.3rem", display: "flex", justifyContent: "space-between" }}>
                                    Attendance: <strong>{plan.feature_attendance !== 'none' ? plan.feature_attendance.toUpperCase() : "❌"}</strong>
                                </li>
                                <li style={{ marginBottom: "0.3rem", display: "flex", justifyContent: "space-between" }}>
                                    Smart Attendance: <span>{plan.feature_auto_attendance ? "✅" : "❌"}</span>
                                </li>
                                <li style={{ marginBottom: "0.3rem", display: "flex", justifyContent: "space-between" }}>
                                    Reports: <strong>{plan.feature_reports !== 'none' ? plan.feature_reports.toUpperCase() : "❌"}</strong>
                                </li>
                                <li style={{ marginBottom: "0.3rem", display: "flex", justifyContent: "space-between" }}>
                                    Fees: <span>{plan.feature_fees ? "✅" : "❌"}</span>
                                </li>
                                <li style={{ marginBottom: "0.3rem", display: "flex", justifyContent: "space-between" }}>
                                    Finance Dashboard: <span>{plan.feature_finance ? "✅" : "❌"}</span>
                                </li>
                                <li style={{ marginBottom: "0.3rem", display: "flex", justifyContent: "space-between" }}>
                                    Faculty Salary: <span>{plan.feature_salary ? "✅" : "❌"}</span>
                                </li>
                                <li style={{ marginBottom: "0.3rem", display: "flex", justifyContent: "space-between" }}>
                                    Exams: <span>{plan.feature_exams ? "✅" : "❌"}</span>
                                </li>
                                <li style={{ marginBottom: "0.3rem", display: "flex", justifyContent: "space-between" }}>
                                    Timetable: <span>{plan.feature_timetable ? "✅" : "❌"}</span>
                                </li>
                                <li style={{ marginBottom: "0.3rem", display: "flex", justifyContent: "space-between" }}>
                                    Assignments: <span>{plan.feature_assignment ? "✅" : "❌"}</span>
                                </li>
                                <li style={{ marginBottom: "0.3rem", display: "flex", justifyContent: "space-between" }}>
                                    Performance Hub: <span>{plan.feature_performance_hub ? "✅" : "❌"}</span>
                                </li>
                                <li style={{ marginBottom: "0.3rem", display: "flex", justifyContent: "space-between" }}>
                                    Finances & Transport: <span>{plan.feature_transport ? "✅" : "❌"}</span>
                                </li>
                                <li style={{ marginBottom: "0.3rem", display: "flex", justifyContent: "space-between" }}>
                                    Notes: <span>{plan.feature_notes ? "✅" : "❌"}</span>
                                </li>
                                <li style={{ marginBottom: "0.3rem", display: "flex", justifyContent: "space-between" }}>
                                    Academic Chat: <span>{plan.feature_chat ? "✅" : "❌"}</span>
                                </li>
                                <li style={{ marginBottom: "0.3rem", display: "flex", justifyContent: "space-between" }}>
                                    Export Data: <span>{plan.feature_export ? "✅" : "❌"}</span>
                                </li>
                                <li style={{ marginBottom: "0.3rem", display: "flex", justifyContent: "space-between" }}>
                                    Announcements: <span>{plan.feature_announcements ? "✅" : "❌"}</span>
                                </li>
                            </ul>

                            <div style={{ display: "flex", gap: "0.5rem", marginTop: '1rem' }}>
                                <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => handleEdit(plan)}
                                    style={{ flex: 1 }}
                                >
                                    Edit
                                </button>
                                <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => handleDelete(plan.id)}
                                    style={{ flex: 1 }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="plans-modal-overlay">
                    <div className="plans-modal">
                        <div className="plans-modal-header">
                            <h2 className="plans-modal-title">{editMode ? "Edit Subscription Plan" : "Create New Subscription Plan"}</h2>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <ThemeSelector />
                                <button
                                    onClick={() => setShowModal(false)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        fontSize: '1.5rem',
                                        cursor: 'pointer',
                                        color: 'var(--text-secondary)'
                                    }}
                                >
                                    ×
                                </button>
                            </div>
                        </div>

                        <div className="plans-modal-body">
                            <form id="planForm" onSubmit={handleSubmit}>
                                {/* Basic Info Section */}
                                <div className="form-section">
                                    <h3 className="form-section-title">Basic Information</h3>
                                    <div className="form-grid-2">
                                        <div className="form-group">
                                            <label className="form-label">Plan Name</label>
                                            <input
                                                type="text"
                                                name="name"
                                                className="form-input"
                                                value={formData.name}
                                                onChange={handleChange}
                                                placeholder="e.g. Starter Plan"
                                                required
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">{formData.is_lifetime ? "Standard Price (Crossed Out ₹)" : "Price (₹ / month)"}</label>
                                            <input
                                                type="number"
                                                name="price"
                                                className="form-input"
                                                value={formData.price}
                                                onChange={handleChange}
                                                placeholder="e.g. 999"
                                                required
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">Annual Discount (%)</label>
                                            <input
                                                type="number"
                                                name="yearly_discount_percent"
                                                className="form-input"
                                                value={formData.yearly_discount_percent}
                                                onChange={handleChange}
                                                placeholder="e.g. 20"
                                                min="0"
                                                max="100"
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">GST (%)</label>
                                            <input
                                                type="number"
                                                name="gst_percent"
                                                className="form-input"
                                                value={formData.gst_percent}
                                                onChange={handleChange}
                                                placeholder="e.g. 2"
                                                min="0"
                                                max="100"
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Description (Optional)</label>
                                        <textarea
                                            name="description"
                                            className="form-textarea"
                                            value={formData.description || ''}
                                            onChange={handleChange}
                                            rows="2"
                                            placeholder="Brief summary of who this plan is for..."
                                        ></textarea>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Razorpay Plan ID (Optional)</label>
                                        <input
                                            type="text"
                                            name="razorpay_plan_id"
                                            className="form-input"
                                            value={formData.razorpay_plan_id || ""}
                                            onChange={handleChange}
                                            placeholder="plan_123456"
                                        />
                                    </div>
                                </div>

                                {/* Limits Section */}
                                <div className="form-section">
                                    <h3 className="form-section-title">Resource Limits</h3>
                                    <div className="form-grid-4">
                                        <div className="limit-input-group">
                                            <label>Max Students</label>
                                            <input
                                                type="number"
                                                name="max_students"
                                                className="form-input"
                                                value={formData.max_students}
                                                onChange={handleChange}
                                                required
                                            />
                                        </div>
                                        <div className="limit-input-group">
                                            <label>Max Faculty</label>
                                            <input
                                                type="number"
                                                name="max_faculty"
                                                className="form-input"
                                                value={formData.max_faculty}
                                                onChange={handleChange}
                                                required
                                            />
                                        </div>
                                        <div className="limit-input-group">
                                            <label>Max Classes</label>
                                            <input
                                                type="number"
                                                name="max_classes"
                                                className="form-input"
                                                value={formData.max_classes}
                                                onChange={handleChange}
                                                required
                                            />
                                        </div>
                                        <div className="limit-input-group">
                                            <label>Max Admins</label>
                                            <input
                                                type="number"
                                                name="max_admin_users"
                                                className="form-input"
                                                value={formData.max_admin_users}
                                                onChange={handleChange}
                                                required
                                            />
                                        </div>
                                        {formData.is_free_trial && (
                                            <div className="limit-input-group">
                                                <label>Trial Days</label>
                                                <input
                                                    type="number"
                                                    name="trial_days"
                                                    className="form-input"
                                                    value={formData.trial_days}
                                                    onChange={handleChange}
                                                    required
                                                />
                                            </div>
                                        )}
                                        {formData.is_lifetime && (
                                            <>
                                                <div className="limit-input-group">
                                                    <label>💎 Offer Price (₹)</label>
                                                    <input
                                                        type="number"
                                                        name="lifetime_price"
                                                        className="form-input"
                                                        value={formData.lifetime_price}
                                                        onChange={handleChange}
                                                        placeholder="19999"
                                                    />
                                                </div>
                                                <div className="limit-input-group">
                                                    <label>🔓 Total Slots</label>
                                                    <input
                                                        type="number"
                                                        name="lifetime_slots_total"
                                                        className="form-input"
                                                        value={formData.lifetime_slots_total}
                                                        onChange={handleChange}
                                                        placeholder="100"
                                                    />
                                                </div>
                                            </>
                                        )}
                                        {formData.feature_chat && (
                                            <div className="limit-input-group">
                                                <label>💬 Max Chat/Msg</label>
                                                <input
                                                    type="number"
                                                    name="max_chat_messages"
                                                    className="form-input"
                                                    value={formData.max_chat_messages}
                                                    onChange={handleChange}
                                                    min="1"
                                                    placeholder="500"
                                                    title="Monthly message limit per institute. -1 = unlimited."
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Feature Settings */}
                                <div className="form-section">
                                    <h3 className="form-section-title">Advanced Features</h3>
                                    <div className="form-grid-2">
                                        <div className="form-group">
                                            <label className="form-label">Attendance System</label>
                                            <select
                                                name="feature_attendance"
                                                className="form-select"
                                                value={formData.feature_attendance}
                                                onChange={handleChange}
                                            >
                                                <option value="none">None (Disabled)</option>
                                                <option value="basic">Basic (Mark Only)</option>
                                                <option value="advanced">Advanced (Reports & Logic)</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Reporting Capabilities</label>
                                            <select
                                                name="feature_reports"
                                                className="form-select"
                                                value={formData.feature_reports}
                                                onChange={handleChange}
                                            >
                                                <option value="none">None (Disabled)</option>
                                                <option value="basic">Basic Stats</option>
                                                <option value="advanced">Advanced Analytics</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Toggles */}
                                <div className="form-section">
                                    <h3 className="form-section-title">Feature Toggles</h3>
                                    <div className="feature-grid">
                                        {[
                                            { key: 'feature_auto_attendance', label: 'Smart Attendance' },
                                            { key: 'feature_fees', label: 'Fees Management' },
                                            { key: 'feature_finance', label: '🏦 Finance Dashboard' },
                                            { key: 'feature_expenses', label: 'Expenses' },
                                            { key: 'feature_salary', label: 'Faculty Salary Management' },
                                            { key: 'feature_announcements', label: 'Announcements' },
                                            { key: 'feature_exams', label: 'Examinations' },
                                            { key: 'feature_timetable', label: 'Master Timetable' },
                                            { key: 'feature_notes', label: 'My Notes' },
                                            { key: 'feature_chat', label: 'Academic Chats' },
                                            { key: 'feature_export', label: 'Export Data' },
                                            { key: 'feature_email', label: 'Email Notifs' },
                                            { key: 'feature_sms', label: 'SMS Integration' },
                                            { key: 'feature_whatsapp', label: 'WhatsApp' },
                                            { key: 'feature_custom_branding', label: 'Custom Branding' },
                                            { key: 'feature_multi_branch', label: 'Multi-Branch' },
                                            { key: 'feature_api_access', label: 'API Access' },
                                            { key: 'feature_parent_portal', label: 'Parent Portal' },
                                            { key: 'feature_mobile_app', label: 'Mobile App' },
                                            { key: 'feature_public_page', label: '🌐 Public Web Page' },
                                            { key: 'feature_assignment', label: '📝 Assignments' },
                                            { key: 'feature_performance_hub', label: '🎯 Performance Hub' },
                                            { key: 'feature_transport', label: '🚌 Finances & Transport' },
                                            { key: 'is_free_trial', label: 'Start Free Trial' },
                                            { key: 'is_popular', label: 'Mark as Popular' },
                                            { key: 'is_hidden', label: 'Hide Plan from Public' },
                                            { key: 'is_lifetime', label: '💎 Lifetime Plan (One-Time)' },
                                        ].map(feature => (
                                            <label key={feature.key} className="feature-checkbox">
                                                <input
                                                    type="checkbox"
                                                    name={feature.key}
                                                    checked={formData[feature.key]}
                                                    onChange={handleChange}
                                                />
                                                <span className="feature-label-text">{feature.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="plans-modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                Cancel
                            </button>
                            <button type="submit" form="planForm" className="btn btn-primary">
                                {editMode ? "Save Changes" : "Create Plan"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Plans;
