/**
 * Super Admin - Plans Management
 * Create and manage subscription plans
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
    const [expandedPlans, setExpandedPlans] = useState({});

    const toggleFeatures = (id) => {
        setExpandedPlans(prev => ({...prev, [id]: !prev[id]}));
    };

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
        max_managers: 1,

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
            const response = await api.get("/plans?include_hidden=true");
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
            payload.max_managers = payload.max_managers !== "" && payload.max_managers !== null ? parseInt(payload.max_managers) : 1;
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
        return <div className="pm-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}><p>Loading...</p></div>;
    }

    const totalPlans = plans.length;
    const activePlans = plans.filter(p => !p.is_hidden).length; // assuming active is not hidden
    const trialPlans = plans.filter(p => p.is_free_trial).length;
    const inactivePlans = plans.filter(p => p.is_hidden).length;

    return (
        <div className="pm-container">
            <div className="pm-breadcrumb">
                <Link to="/superadmin/dashboard">🏠 Dashboard</Link> &gt; <span>Plans Management</span>
            </div>

            {/* Header */}
            <div className="pm-header">
                <div className="pm-header-left" style={{ display: 'flex', gap: '1rem' }}>
                    <div className="pm-header-icon">📋</div>
                    <div>
                        <h1>Plans Management</h1>
                        <p>Create and manage subscription plans & feature limits</p>
                    </div>
                </div>
                <div className="pm-header-right">
                    <button className="pm-btn-secondary" onClick={() => alert("Export functionality coming soon!")}>
                        <span style={{ fontSize: '1.2rem' }}>📥</span> Export Plans
                    </button>
                    <button className="pm-btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
                        + Create New Plan
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="pm-stats-grid">
                <div className="pm-stat-card">
                    <div className="pm-stat-icon-wrap total">📋</div>
                    <div className="pm-stat-content">
                        <h3>{totalPlans}</h3>
                        <p>Total Plans</p>
                        <span>All subscription plans</span>
                    </div>
                </div>
                <div className="pm-stat-card">
                    <div className="pm-stat-icon-wrap active">✅</div>
                    <div className="pm-stat-content">
                        <h3>{activePlans}</h3>
                        <p>Active Plans</p>
                        <span>Currently active</span>
                    </div>
                </div>
                <div className="pm-stat-card">
                    <div className="pm-stat-icon-wrap trial">🕒</div>
                    <div className="pm-stat-content">
                        <h3>{trialPlans}</h3>
                        <p>Trial Plan</p>
                        <span>Free trial available</span>
                    </div>
                </div>
                <div className="pm-stat-card">
                    <div className="pm-stat-icon-wrap inactive">⏸️</div>
                    <div className="pm-stat-content">
                        <h3>{inactivePlans}</h3>
                        <p>Inactive Plans</p>
                        <span>Currently inactive</span>
                    </div>
                </div>
            </div>

            {/* Plans Grid */}
            <div className="pm-plans-grid">
                {plans.length === 0 ? (
                    <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "3rem", color: '#64748b' }}>
                        No plans found. Create one to get started.
                    </div>
                ) : (
                    plans.map((plan) => {
                        // Calculate features
                        const mainFeatures = [
                            { name: 'Basic Attendance', active: plan.feature_attendance !== 'none' },
                            { name: 'Reports', active: plan.feature_reports !== 'none' },
                            { name: 'Fees Management', active: plan.feature_fees },
                            { name: 'Finance Dashboard', active: plan.feature_finance },
                        ];
                        
                        const allFeatures = [
                            { name: 'Smart Attendance', active: plan.feature_auto_attendance },
                            { name: 'Faculty Salary', active: plan.feature_salary },
                            { name: 'Announcements', active: plan.feature_announcements },
                            { name: 'Exams', active: plan.feature_exams },
                            { name: 'Timetable', active: plan.feature_timetable },
                            { name: 'Notes', active: plan.feature_notes },
                            { name: 'Academic Chat', active: plan.feature_chat },
                            { name: 'Export Data', active: plan.feature_export },
                            { name: 'Email Notifs', active: plan.feature_email },
                            { name: 'SMS', active: plan.feature_sms },
                            { name: 'WhatsApp', active: plan.feature_whatsapp },
                            { name: 'Custom Branding', active: plan.feature_custom_branding },
                            { name: 'Multi-Branch', active: plan.feature_multi_branch },
                            { name: 'API Access', active: plan.feature_api_access },
                            { name: 'Parent Portal', active: plan.feature_parent_portal },
                            { name: 'Mobile App', active: plan.feature_mobile_app },
                            { name: 'Public Page', active: plan.feature_public_page },
                            { name: 'Assignments', active: plan.feature_assignment },
                            { name: 'Performance Hub', active: plan.feature_performance_hub },
                            { name: 'Finances & Transport', active: plan.feature_transport }
                        ];
                        const activeMoreFeaturesCount = allFeatures.filter(f => f.active).length;

                        return (
                            <div key={plan.id} className="pm-plan-card">
                                {plan.is_popular && <div className="pm-plan-tag">⭐ Most Popular</div>}
                                {plan.is_lifetime && <div className="pm-plan-tag best-value">💎 Best Value</div>}
                                
                                <div className="pm-plan-header">
                                    <h2>{plan.name}</h2>
                                    <p>{plan.description || "Comprehensive plan for your institute."}</p>
                                </div>

                                <div className="pm-plan-price">
                                    {plan.is_free_trial ? (
                                        <>
                                            <span className="pm-price-main">₹0.00</span>
                                            <span className="pm-price-old">₹{plan.price}</span>
                                            <span className="pm-price-period">/ month</span>
                                        </>
                                    ) : plan.is_lifetime ? (
                                        <>
                                            <span className="pm-price-main">₹{plan.lifetime_price || plan.price}</span>
                                            <span className="pm-price-period">/ one-time</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="pm-price-main">₹{plan.price}</span>
                                            <span className="pm-price-period">/ month</span>
                                        </>
                                    )}
                                </div>

                                {plan.is_free_trial ? (
                                    <div className="pm-plan-badge trial">Trial Plan</div>
                                ) : plan.is_hidden ? (
                                    <div className="pm-plan-badge inactive">Inactive Plan</div>
                                ) : (
                                    <div className="pm-plan-badge active">Active Plan</div>
                                )}

                                <ul className="pm-limits-list">
                                    <li className="pm-limit-item">
                                        <div className="pm-limit-left"><span className="pm-limit-icon">🧑‍🎓</span> Students</div>
                                        <span className="pm-limit-value">{plan.max_students}</span>
                                    </li>
                                    <li className="pm-limit-item">
                                        <div className="pm-limit-left"><span className="pm-limit-icon">👨‍🏫</span> Faculty</div>
                                        <span className="pm-limit-value">{plan.max_faculty}</span>
                                    </li>
                                    <li className="pm-limit-item">
                                        <div className="pm-limit-left"><span className="pm-limit-icon">🏫</span> Classes</div>
                                        <span className="pm-limit-value">{plan.max_classes}</span>
                                    </li>
                                    <li className="pm-limit-item">
                                        <div className="pm-limit-left"><span className="pm-limit-icon">👨‍💼</span> Admins</div>
                                        <span className="pm-limit-value">{plan.max_admin_users}</span>
                                    </li>
                                    <li className="pm-limit-item">
                                        <div className="pm-limit-left"><span className="pm-limit-icon">👥</span> Managers</div>
                                        <span className="pm-limit-value">{plan.max_managers}</span>
                                    </li>
                                </ul>

                                <div className="pm-features-title">Key Features</div>
                                <ul className="pm-features-list">
                                    {mainFeatures.map((feat, idx) => (
                                        <li key={idx} className="pm-feature-item">
                                            {feat.active ? (
                                                <span className="pm-feature-check">✓</span>
                                            ) : (
                                                <span className="pm-feature-cross">✕</span>
                                            )}
                                            {feat.name}
                                        </li>
                                    ))}
                                </ul>
                                
                                {activeMoreFeaturesCount > 0 && (
                                    <button 
                                        className="pm-more-features" 
                                        onClick={() => toggleFeatures(plan.id)}
                                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                    >
                                        {expandedPlans[plan.id] ? '- Hide features' : `+ ${activeMoreFeaturesCount} more features`}
                                    </button>
                                )}

                                {expandedPlans[plan.id] && (
                                    <ul className="pm-features-list" style={{ marginTop: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                                        {allFeatures.map((feat, idx) => (
                                            <li key={`ext-${idx}`} className="pm-feature-item">
                                                {feat.active ? (
                                                    <span className="pm-feature-check">✓</span>
                                                ) : (
                                                    <span className="pm-feature-cross">✕</span>
                                                )}
                                                {feat.name}
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                <div className="pm-plan-actions">
                                    <button className="pm-btn-edit" onClick={() => handleEdit(plan)}>Edit</button>
                                    <button className="pm-btn-more" onClick={() => handleDelete(plan.id)} title="Delete Plan">⋮</button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Bottom Banner */}
            <div className="pm-bottom-banner">
                <div className="pm-banner-content">
                    <div className="pm-banner-icon">⚙️</div>
                    <div className="pm-banner-text">
                        <h3>Need a custom plan?</h3>
                        <p>Create a plan that perfectly fits your institute's requirements.</p>
                    </div>
                </div>
                <button className="pm-btn-custom" onClick={() => { resetForm(); setShowModal(true); }}>
                    <span>📝</span> Create Custom Plan
                </button>
            </div>

            {/* Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 9999, padding: '1rem'
                }} onClick={() => setShowModal(false)}>
                    <div style={{
                        background: '#fff', borderRadius: 16, padding: '0', maxWidth: 850,
                        width: '100%', boxShadow: '0 25px 80px rgba(79, 70, 229, 0.2)',
                        color: '#1f2937', animation: 'fadeIn 0.2s ease', maxHeight: '90vh',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden'
                    }} onClick={e => e.stopPropagation()}>
                        
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '1.5rem 2rem', background: 'linear-gradient(to right, #F8FAFC, #FFFFFF)',
                            borderBottom: '1px solid #E2E8F0'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{
                                    background: 'linear-gradient(135deg, #E0E7FF, #C7D2FE)',
                                    borderRadius: '50%', width: 52, height: 52,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <span style={{ fontSize: 24 }}>{editMode ? "✏️" : "✨"}</span>
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, color: '#3730A3', fontSize: 20, fontWeight: 700 }}>
                                        {editMode ? "Edit Subscription Plan" : "Create New Subscription Plan"}
                                    </h2>
                                    <p style={{ margin: '2px 0 0', color: '#6B7280', fontSize: 13 }}>
                                        {editMode ? "Update plan features and pricing." : "Configure a new subscription package for institutes."}
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                                <ThemeSelector />
                                <button
                                    onClick={() => setShowModal(false)}
                                    style={{
                                        background: '#F3F4F6', border: 'none',
                                        width: 36, height: 36, borderRadius: '50%',
                                        fontSize: '1.25rem', cursor: 'pointer', color: '#4B5563',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        transition: 'background 0.2s'
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="plans-modal-body" style={{ padding: '2rem', overflowY: 'auto' }}>
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
                                        <div className="limit-input-group">
                                            <label>Max Managers</label>
                                            <input
                                                type="number"
                                                name="max_managers"
                                                className="form-input"
                                                value={formData.max_managers}
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

                        <div style={{
                            padding: '1.25rem 2rem', background: '#F8FAFC',
                            borderTop: '1px solid #E2E8F0', display: 'flex',
                            justifyContent: 'flex-end', gap: '1rem'
                        }}>
                            <button type="button" onClick={() => setShowModal(false)}
                                style={{
                                    padding: '10px 20px', borderRadius: 8, border: '1px solid #D1D5DB',
                                    background: '#fff', cursor: 'pointer', fontSize: 14,
                                    color: '#4B5563', fontWeight: 600, transition: 'all 0.2s'
                                }}>
                                Cancel
                            </button>
                            <button type="submit" form="planForm"
                                style={{
                                    padding: '10px 24px', borderRadius: 8, border: 'none',
                                    background: 'linear-gradient(135deg, #4F46E5, #4338CA)',
                                    color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700,
                                    boxShadow: '0 4px 15px rgba(79, 70, 229, 0.3)', transition: 'all 0.2s'
                                }}>
                                {editMode ? "✅ Save Changes" : "✨ Create Plan"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Plans;
