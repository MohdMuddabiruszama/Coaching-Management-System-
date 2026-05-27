/**
 * Super Admin — Institute Limits & Features
 * Phase 3: View all institutes, click View to see full details,
 *          customize per-institute plan limits & features without
 *          affecting the global plan for other institutes.
 */

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../../services/api";
import BackButton from "../../components/common/BackButton";
import ThemeSelector from "../../components/ThemeSelector";
import "../admin/Dashboard.css";
import "./Plans.css";

/* ─ helpers ─ */
const fmt = (n) => (n !== undefined && n !== null ? n : "N/A");
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "N/A");

// Smart Attendance is index 0 — the Feature Toggles renderer treats it specially
// (shows QR sub-feature dependency cards beneath it)
const BOOL_FEATURES = [
    { key: "current_feature_auto_attendance", label: "Smart Attendance",       icon: "📸", desc: "QR-based smart attendance system" },
    { key: "current_feature_fees",            label: "Fees Management",        icon: "💰", desc: "Student fee collection & tracking" },
    { key: "current_feature_finance",         label: "Finance Dashboard",      icon: "📊", desc: "Institute-wide finance analytics" },
    { key: "current_feature_salary",          label: "Faculty Salary",         icon: "💼", desc: "Faculty payroll management" },
    { key: "current_feature_assignment",      label: "Assignments",            icon: "📝", desc: "Homework & assignment submissions" },
    { key: "current_feature_performance_hub", label: "Performance Hub",        icon: "📊", desc: "Advanced performance analytics" },
    { key: "current_feature_transport",       label: "Finances & Transport",   icon: "🚌", desc: "Expense tracking & transport fees" },
    { key: "current_feature_announcements",   label: "Announcements",          icon: "📢", desc: "Broadcast notices to users" },
    { key: "current_feature_export",          label: "Export Data",            icon: "📥", desc: "CSV / PDF data exports" },
    { key: "current_feature_timetable",       label: "Timetable",             icon: "📅", desc: "Class & faculty timetables" },
    { key: "current_feature_whatsapp",        label: "WhatsApp Integration",   icon: "💬", desc: "Automated WhatsApp notifications" },
    { key: "current_feature_custom_branding", label: "Custom Branding",       icon: "🎨", desc: "Institute logo & colour themes" },
    { key: "current_feature_multi_branch",    label: "Multi-Branch",          icon: "🏢", desc: "Manage multiple campuses" },
    { key: "current_feature_api_access",      label: "API Access",            icon: "🔌", desc: "External API integration" },
    { key: "current_feature_public_page",     label: "Public Web Page",       icon: "🌐", desc: "Publicly visible institute page" },
    { key: "current_feature_mobile_app",      label: "Mobile App",            icon: "📱", desc: "Mobile application access" },
    { key: "current_feature_chat",            label: "Academic Chats",        icon: "💬", desc: "In-app messaging for users" },
];

// QR sub-features that are gated by Smart Attendance
const QR_SUB_FEATURES = [
    { label: "Scan Student QR", icon: "👨‍🎓", desc: "Students scan QR to mark attendance" },
    { label: "Scan Faculty QR", icon: "👩‍🏫", desc: "Faculty scan QR to mark attendance" },
];

// Reusable inline toggle switch
const ToggleSwitch = ({ val }) => (
    <span style={{
        width: "38px", height: "21px", borderRadius: "11px", display: "inline-block",
        background: val ? "#10b981" : "#d1d5db",
        position: "relative", flexShrink: 0, transition: "background 0.25s"
    }}>
        <span style={{
            position: "absolute", top: "2.5px",
            left: val ? "19px" : "2.5px",
            width: "16px", height: "16px", borderRadius: "50%",
            background: "#fff", transition: "left 0.25s",
            boxShadow: "0 1px 4px rgba(0,0,0,0.25)"
        }} />
    </span>
);

function InstituteLimits() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const [institutes, setInstitutes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    // Detailed view
    const [selected, setSelected] = useState(null);
    const [details, setDetails] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Edit limits form
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({});
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");

    // Active view tab
    const [viewTab, setViewTab] = useState("info"); // info | plan | limits | discounts

    // Discount form
    const [discountForm, setDiscountForm] = useState({ discount_type: "fixed", discount_value: "", reason: "" });
    const [applyingDiscount, setApplyingDiscount] = useState(false);

    useEffect(() => {
        fetchInstitutes();
    }, []);

    // If a ?id= query param is present, auto-open that institute
    useEffect(() => {
        const id = searchParams.get("id");
        if (id && institutes.length > 0) {
            const inst = institutes.find(i => String(i.id) === String(id));
            if (inst) handleView(inst);
        }
    }, [institutes]);

    const fetchInstitutes = async () => {
        try {
            const res = await api.get("/institutes?limit=200");
            setInstitutes(res.data.data?.institutes || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleView = useCallback(async (institute) => {
        setSelected(institute);
        setDetails(null);
        setEditMode(false);
        setDetailLoading(true);
        setViewTab("info");
        setMsg("");
        setSearchParams({ id: institute.id });
        try {
            const res = await api.get(`/superadmin/institutes/${institute.id}/details`);
            setDetails(res.data);
            // Pre-fill form with current institute overrides
            const inst = res.data.institute;
            setFormData({
                current_limit_students: inst.current_limit_students || 0,
                current_limit_faculty: inst.current_limit_faculty || 0,
                current_limit_classes: inst.current_limit_classes || 0,
                current_limit_admins: inst.current_limit_admins || 1,
                current_feature_attendance: inst.current_feature_attendance || "basic",
                current_feature_reports: inst.current_feature_reports || "none",
                current_feature_auto_attendance: !!inst.current_feature_auto_attendance,
                current_feature_fees: !!inst.current_feature_fees,
                current_feature_finance: !!inst.current_feature_finance,
                current_feature_salary: !!inst.current_feature_salary,
                current_feature_announcements: !!inst.current_feature_announcements,
                current_feature_export: !!inst.current_feature_export,
                current_feature_timetable: !!inst.current_feature_timetable,
                current_feature_whatsapp: !!inst.current_feature_whatsapp,
                current_feature_custom_branding: !!inst.current_feature_custom_branding,
                current_feature_multi_branch: !!inst.current_feature_multi_branch,
                current_feature_api_access: !!inst.current_feature_api_access,
                current_feature_public_page: !!inst.current_feature_public_page,
                current_feature_assignment: !!inst.current_feature_assignment,
                current_feature_performance_hub: !!inst.current_feature_performance_hub,
                current_feature_transport: !!inst.current_feature_transport,
                current_feature_chat: !!inst.current_feature_chat,
                current_limit_chat_messages: inst.current_limit_chat_messages || 0,
            });
        } catch (e) {
            console.error(e);
        } finally {
            setDetailLoading(false);
        }
    }, [setSearchParams]);

    const handleSaveLimits = async () => {
        setSaving(true);
        setMsg("");
        try {
            await api.put(`/superadmin/institutes/${selected.id}/limits`, formData);
            setMsg("✅ Institute limits & features updated successfully! Changes affect only this institute.");
            // Refresh details
            const res = await api.get(`/superadmin/institutes/${selected.id}/details`);
            setDetails(res.data);
            setEditMode(false);
        } catch (e) {
            setMsg("❌ Error: " + (e.response?.data?.error || e.message));
        } finally {
            setSaving(false);
        }
    };

    const handleApplyDiscount = async (e) => {
        e.preventDefault();
        setApplyingDiscount(true);
        setMsg("");
        try {
            await api.post(`/superadmin/institutes/${selected.id}/discounts`, discountForm);
            setMsg("✅ Discount applied successfully!");
            // Refresh details
            const res = await api.get(`/superadmin/institutes/${selected.id}/details`);
            setDetails(res.data);
            setDiscountForm({ discount_type: "fixed", discount_value: "", reason: "" });
        } catch (e) {
            setMsg("❌ Error applying discount: " + (e.response?.data?.error || e.message));
        } finally {
            setApplyingDiscount(false);
        }
    };

    const handleDeleteDiscount = async (discountId) => {
        if (!window.confirm("Are you sure you want to delete this discount?")) return;
        try {
            await api.delete(`/superadmin/institutes/${selected.id}/discounts/${discountId}`);
            setMsg("✅ Discount deleted.");
            const res = await api.get(`/superadmin/institutes/${selected.id}/details`);
            setDetails(res.data);
        } catch (e) {
            setMsg("❌ Error deleting discount.");
        }
    };

    const handleSync = async () => {
        if (!details?.institute?.Plan) {
            setMsg("❌ No plan assigned to this institute.");
            return;
        }
        const plan = details.institute.Plan;
        setFormData(prev => ({
            ...prev,
            current_limit_students: plan.max_students,
            current_limit_faculty: plan.max_faculty,
            current_limit_classes: plan.max_classes,
            current_limit_admins: plan.max_admin_users,
            current_feature_attendance: plan.feature_attendance,
            current_feature_reports: plan.feature_reports,
            current_feature_auto_attendance: !!plan.feature_auto_attendance,
            current_feature_fees: !!plan.feature_fees,
            current_feature_finance: !!plan.feature_finance,
            current_feature_salary: !!plan.feature_salary,
            current_feature_announcements: !!plan.feature_announcements,
            current_feature_export: !!plan.feature_export,
            current_feature_timetable: !!plan.feature_timetable,
            current_feature_whatsapp: !!plan.feature_whatsapp,
            current_feature_custom_branding: !!plan.feature_custom_branding,
            current_feature_multi_branch: !!plan.feature_multi_branch,
            current_feature_api_access: !!plan.feature_api_access,
            current_feature_public_page: !!plan.feature_public_page,
            current_feature_assignment: !!plan.feature_assignment,
            current_feature_performance_hub: !!plan.feature_performance_hub,
            current_feature_transport: !!plan.feature_transport,
            current_feature_chat: !!plan.feature_chat,
            current_limit_chat_messages: plan.max_chat_messages || 0,
        }));
        setMsg("ℹ️ Limits synced from base plan. Click Save to apply.");
    };

    const filtered = institutes.filter(i =>
        (i.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (i.email || "").toLowerCase().includes(search.toLowerCase())
    );

    /* ── RENDER ── */
    if (loading) return <div className="dashboard-container">Loading...</div>;

    const inst = details?.institute;
    const stats = details?.stats;
    const sub = details?.latestSubscription;

    return (
        <div className="dashboard-container">
            {/* Header */}
            <div className="dashboard-header">
                <div>
                    <h1>🔧 Institute Limits</h1>
                    <p>View institute details and customize per-institute features & limits</p>
                </div>
                <div className="dashboard-header-right">
                    <ThemeSelector />
                    <BackButton />
                </div>
            </div>

            {/* List Panel */}
            <div className="card" style={{ marginBottom: "1.5rem" }}>
                <div style={{ padding: "1rem 1.5rem", display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="🔍 Search by name or email..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ flex: 1, minWidth: "200px" }}
                    />
                    <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>{filtered.length} institutes</span>
                </div>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Plan</th>
                                <th>Status</th>
                                <th>Subscription End</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: "center", padding: "2rem" }}>No institutes found</td></tr>
                            ) : filtered.map(i => (
                                <tr key={i.id} style={{ background: selected?.id === i.id ? "rgba(99,102,241,0.06)" : "" }}>
                                    <td>{i.id}</td>
                                    <td style={{ fontWeight: 600 }}>{i.name}</td>
                                    <td>{i.email}</td>
                                    <td>{i.Plan?.name || "—"}</td>
                                    <td>
                                        <span className={`badge badge-${i.status === 'active' ? 'success' : i.status === 'suspended' ? 'warning' : 'danger'}`}>
                                            {i.status}
                                        </span>
                                    </td>
                                    <td>{fmtDate(i.subscription_end)}</td>
                                    <td>
                                        <button
                                            className="btn btn-sm btn-primary"
                                            onClick={() => handleView(i)}
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail Panel */}
            {selected && (
                <div className="card" style={{ animation: "fadeIn 0.3s ease" }}>
                    {/* Detail Header */}
                    <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: "1.4rem" }}>{selected.name}</h2>
                            <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "14px" }}>{selected.email}</p>
                        </div>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <span className={`badge badge-${selected.status === 'active' ? 'success' : selected.status === 'suspended' ? 'warning' : 'danger'}`} style={{ fontSize: "13px", padding: "6px 14px" }}>
                                {selected.status?.toUpperCase()}
                            </span>
                            <button className="btn btn-sm" style={{ background: "var(--border-color)", color: "var(--text-primary)" }} onClick={() => { setSelected(null); setSearchParams({}); }}>
                                ✕ Close
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div style={{ padding: "0 1.5rem", borderBottom: "1px solid var(--border-color)", display: "flex", gap: "0" }}>
                        {[
                            { id: "info", label: "📋 Institute Info" },
                            { id: "plan", label: "💳 Plan Details" },
                            { id: "limits", label: "🔧 Modify Limits" },
                            { id: "discounts", label: "🎁 Discounts" }
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setViewTab(t.id)}
                                style={{
                                    padding: "14px 20px",
                                    border: "none",
                                    borderBottom: viewTab === t.id ? "3px solid #6366f1" : "3px solid transparent",
                                    background: "transparent",
                                    color: viewTab === t.id ? "#6366f1" : "var(--text-secondary)",
                                    fontWeight: viewTab === t.id ? 700 : 500,
                                    cursor: "pointer",
                                    fontSize: "14px",
                                    transition: "all 0.2s"
                                }}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {detailLoading ? (
                        <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>Loading details...</div>
                    ) : details && (
                        <div style={{ padding: "1.5rem" }}>

                            {/* ── TAB: INFO ── */}
                            {viewTab === "info" && (
                                <div style={{ animation: "fadeIn 0.3s ease" }}>
                                    {/* Stat counters */}
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px,1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                                        {[
                                            { icon: "👨‍🎓", label: "Students", value: stats?.totalStudents || 0, color: "#3b82f6" },
                                            { icon: "👩‍🏫", label: "Faculty", value: stats?.totalFaculty || 0, color: "#8b5cf6" },
                                            { icon: "🧑‍💼", label: "Managers", value: stats?.totalManagers || 0, color: "#14b8a6" },
                                            { icon: "🏫", label: "Classes", value: stats?.totalClasses || 0, color: "#f97316" },
                                            { icon: "📚", label: "Subjects", value: stats?.totalSubjects || 0, color: "#ec4899" },
                                            { icon: "📝", label: "Assignments", value: stats?.totalAssignments || 0, color: "#10b981" },
                                            { icon: "☰", label: "Features Active", value: stats?.totalFeatures || 0, color: "#6366f1" },
                                            { icon: "👪", label: "Parents", value: stats?.totalParents || 0, color: "#f59e0b" },
                                        ].map(s => (
                                            <div key={s.label} style={{ background: "var(--card-bg, #f9fafb)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "1rem", textAlign: "center" }}>
                                                <div style={{ fontSize: "1.5rem" }}>{s.icon}</div>
                                                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: s.color }}>{s.value}</div>
                                                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{s.label}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Details grid */}
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", fontSize: "14px" }}>
                                        {[
                                            { label: "ID", value: inst?.id },
                                            { label: "Name", value: inst?.name },
                                            { label: "Email", value: inst?.email },
                                            { label: "Phone", value: inst?.phone || "Not provided" },
                                            { label: "City", value: inst?.city || "—" },
                                            { label: "State", value: inst?.state || "—" },
                                            { label: "Zip Code", value: inst?.zip_code || "—" },
                                            { label: "Status", value: inst?.status },
                                            { label: "Subscription Start", value: fmtDate(inst?.subscription_start) },
                                            { label: "Subscription End", value: fmtDate(inst?.subscription_end) },
                                        ].map(item => (
                                            <div key={item.label} style={{ padding: "12px 16px", background: "var(--card-bg, #f9fafb)", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
                                                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: "4px" }}>{item.label}</div>
                                                <div style={{ fontWeight: 600 }}>{fmt(item.value)}</div>
                                            </div>
                                        ))}
                                        <div style={{ gridColumn: "1/-1", padding: "12px 16px", background: "var(--card-bg, #f9fafb)", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
                                            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: "4px" }}>Address</div>
                                            <div style={{ fontWeight: 600 }}>{inst?.address || "Not provided"}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── TAB: PLAN ── */}
                            {viewTab === "plan" && (
                                <div style={{ animation: "fadeIn 0.3s ease" }}>
                                    {inst?.Plan ? (
                                        <>
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                                                <div style={{ gridColumn: "1/-1", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: "14px", padding: "1.5rem", color: "#fff" }}>
                                                    <div style={{ fontSize: "1.3rem", fontWeight: 800 }}>{inst.Plan.name}</div>
                                                    <div style={{ fontSize: "2rem", fontWeight: 900, margin: "8px 0" }}>₹{parseFloat(inst.Plan.price).toLocaleString()}<span style={{ fontSize: "14px", fontWeight: 400 }}>/month</span></div>
                                                    <div style={{ opacity: 0.85, fontSize: "13px" }}>{inst.Plan.description || "No description"}</div>
                                                </div>
                                                {[
                                                    { label: "Max Students", value: inst.Plan.max_students },
                                                    { label: "Max Faculty", value: inst.Plan.max_faculty },
                                                    { label: "Max Classes", value: inst.Plan.max_classes },
                                                    { label: "Max Admins", value: inst.Plan.max_admin_users },
                                                    { label: "Attendance", value: inst.Plan.feature_attendance?.toUpperCase() },
                                                    { label: "Reports", value: inst.Plan.feature_reports?.toUpperCase() },
                                                ].map(item => (
                                                    <div key={item.label} style={{ padding: "12px 16px", background: "var(--card-bg, #f9fafb)", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
                                                        <div style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", marginBottom: "4px" }}>{item.label}</div>
                                                        <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{item.value}</div>
                                                    </div>
                                                ))}
                                            </div>

                                            <h4 style={{ marginBottom: "12px" }}>Active Features & Add-ons</h4>
                                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px,1fr))", gap: "10px" }}>
                                                {(() => {
                                                    let expiries = {};
                                                    try { expiries = (typeof inst.add_on_expiries === 'string' ? JSON.parse(inst.add_on_expiries) : inst.add_on_expiries) || {}; } catch(e) {}
                                                    
                                                    return BOOL_FEATURES.map(f => {
                                                        const planKey = f.key.replace("current_", "");
                                                        const includedInPlan = !!inst.Plan[planKey];
                                                        const isManuallyEnabled = !!inst[f.key];
                                                        const addonData = expiries[f.key];
                                                        
                                                        let isActive = includedInPlan || isManuallyEnabled;
                                                        let isExpired = false;
                                                        let startStr = null, endStr = null;
                                                        
                                                        if (addonData && !includedInPlan) {
                                                            const endDate = typeof addonData === 'object' ? addonData.end : addonData;
                                                            const startDate = typeof addonData === 'object' ? addonData.start : null;
                                                            isExpired = new Date() > new Date(endDate);
                                                            if (isExpired) isActive = false;
                                                            
                                                            startStr = startDate ? fmtDate(startDate) : "N/A";
                                                            endStr = fmtDate(endDate);
                                                        }
                                                        
                                                        const isTemporalAddon = !includedInPlan && !!addonData && !isExpired;

                                                        return (
                                                            <div key={f.key} style={{ 
                                                                display: "flex", alignItems: "center", gap: "12px", 
                                                                padding: "12px 14px", borderRadius: "12px", 
                                                                border: `1px solid ${isActive ? (isTemporalAddon ? "rgba(245,158,11,0.4)" : "rgba(16,185,129,0.4)") : "var(--border-color)"}`, 
                                                                background: isActive ? (isTemporalAddon ? "rgba(245,158,11,0.08)" : "rgba(16,185,129,0.06)") : "var(--card-bg, #f9fafb)",
                                                                opacity: isExpired ? 0.6 : 1
                                                            }}>
                                                                <span style={{ fontSize: "20px" }}>
                                                                    {isActive ? (isTemporalAddon ? "⏳" : "✅") : (isExpired ? "⌛" : "❌")}
                                                                </span>
                                                                <div style={{ flex: 1 }}>
                                                                    <div style={{ fontSize: "13px", fontWeight: 700, color: isActive ? "var(--text-primary)" : "var(--text-secondary)" }}>
                                                                        {f.label} 
                                                                        {isExpired && <span style={{ fontSize: "10px", marginLeft: "6px", color: "#ef4444", background: "rgba(239,68,68,0.1)", padding: "2px 6px", borderRadius: "10px" }}>EXPIRED</span>}
                                                                        {!isExpired && isTemporalAddon && <span style={{ fontSize: "10px", marginLeft: "6px", color: "#d97706", background: "rgba(245,158,11,0.15)", padding: "2px 6px", borderRadius: "10px" }}>ADD-ON</span>}
                                                                    </div>
                                                                    {addonData && (
                                                                        <div style={{ fontSize: "11px", color: isExpired ? "#ef4444" : "var(--text-secondary)", marginTop: "4px", display: "flex", flexDirection: "column", gap: "2px" }}>
                                                                            {startStr && <div><span style={{fontWeight:600}}>Start:</span> {startStr}</div>}
                                                                            <div><span style={{fontWeight:600}}>End:</span> {endStr}</div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>

                                            {sub && (
                                                <div style={{ marginTop: "1.5rem", padding: "14px 18px", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "12px" }}>
                                                    <div style={{ fontWeight: 700, marginBottom: "8px", color: "#6366f1" }}>Latest Subscription</div>
                                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", fontSize: "13px" }}>
                                                        <div><span style={{ color: "var(--text-secondary)" }}>Start:</span> <strong>{fmtDate(sub.start_date)}</strong></div>
                                                        <div><span style={{ color: "var(--text-secondary)" }}>End:</span> <strong>{fmtDate(sub.end_date)}</strong></div>
                                                        <div><span style={{ color: "var(--text-secondary)" }}>Status:</span> <strong>{sub.payment_status}</strong></div>
                                                        <div><span style={{ color: "var(--text-secondary)" }}>Amount Paid:</span> <strong>₹{parseFloat(sub.amount_paid || 0).toLocaleString()}</strong></div>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>
                                            No plan assigned to this institute.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── TAB: MODIFY LIMITS ── */}
                            {viewTab === "limits" && (
                                <div style={{ animation: "fadeIn 0.3s ease" }}>
                                    <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "12px", padding: "14px 18px", marginBottom: "1.5rem", fontSize: "14px" }}>
                                        <strong>⚠️ Important:</strong> Changes here apply only to <strong>{selected.name}</strong> and do NOT affect other institutes on the same plan. This is a per-institute override.
                                    </div>

                                    {msg && (
                                        <div style={{ padding: "12px 16px", borderRadius: "10px", background: msg.startsWith("✅") ? "rgba(16,185,129,0.1)" : msg.startsWith("ℹ️") ? "rgba(99,102,241,0.1)" : "rgba(239,68,68,0.1)", marginBottom: "1.25rem", fontWeight: 600, fontSize: "14px" }}>
                                            {msg}
                                        </div>
                                    )}

                                    <div style={{ display: "flex", gap: "10px", marginBottom: "1.5rem", flexWrap: "wrap" }}>
                                        {!editMode ? (
                                            <button className="btn btn-primary" onClick={() => setEditMode(true)}>✏️ Edit Limits</button>
                                        ) : (
                                            <>
                                                <button className="btn btn-primary" onClick={handleSaveLimits} disabled={saving}>
                                                    {saving ? "Saving..." : "💾 Save Changes"}
                                                </button>
                                                <button className="btn btn-secondary" onClick={() => setEditMode(false)}>Cancel</button>
                                                <button className="btn" style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.3)" }} onClick={handleSync} title="Reset limits to base plan values">
                                                    🔄 Sync from Plan
                                                </button>
                                            </>
                                        )}
                                    </div>

                                    {/* Resource Limits */}
                                    <h4 style={{ margin: "0 0 12px" }}>Resource Limits</h4>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                                        {[
                                            { key: "current_limit_students", label: "Max Students", icon: "👨‍🎓" },
                                            { key: "current_limit_faculty", label: "Max Faculty", icon: "👩‍🏫" },
                                            { key: "current_limit_classes", label: "Max Classes", icon: "🏫" },
                                            { key: "current_limit_admins", label: "Max Admins", icon: "🛡️" },
                                        ].map(field => (
                                            <div key={field.key} style={{ padding: "14px", background: "var(--card-bg, #f9fafb)", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                                                    <span style={{ fontSize: "18px" }}>{field.icon}</span>
                                                    <label style={{ fontWeight: 600, fontSize: "13px" }}>{field.label}</label>
                                                </div>
                                                {editMode ? (
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        value={formData[field.key] || 0}
                                                        min={0}
                                                        onChange={e => setFormData(p => ({ ...p, [field.key]: e.target.value }))}
                                                    />
                                                ) : (
                                                    <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#6366f1" }}>{inst[field.key] ?? "—"}</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Enum Features */}
                                    <h4 style={{ margin: "0 0 12px" }}>Advanced Feature Settings</h4>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                                        <div style={{ padding: "14px", background: "var(--card-bg, #f9fafb)", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
                                            <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "8px" }}>Attendance System</label>
                                            {editMode ? (
                                                <select className="form-select" value={formData.current_feature_attendance} onChange={e => setFormData(p => ({ ...p, current_feature_attendance: e.target.value }))}>
                                                    <option value="none">None (Disabled)</option>
                                                    <option value="basic">Basic</option>
                                                    <option value="advanced">Advanced</option>
                                                </select>
                                            ) : (
                                                <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#6366f1", textTransform: "uppercase" }}>{inst.current_feature_attendance || "—"}</div>
                                            )}
                                        </div>
                                        <div style={{ padding: "14px", background: "var(--card-bg, #f9fafb)", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
                                            <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "8px" }}>Reporting Capabilities</label>
                                            {editMode ? (
                                                <select className="form-select" value={formData.current_feature_reports} onChange={e => setFormData(p => ({ ...p, current_feature_reports: e.target.value }))}>
                                                    <option value="none">None (Disabled)</option>
                                                    <option value="basic">Basic Stats</option>
                                                    <option value="advanced">Advanced Analytics</option>
                                                </select>
                                            ) : (
                                                <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#6366f1", textTransform: "uppercase" }}>{inst.current_feature_reports || "—"}</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── Feature Toggles ── */}
                                    <h4 style={{ margin: "0 0 16px", display: "flex", alignItems: "center", gap: "8px" }}>
                                        Feature Toggles
                                        <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", background: "var(--card-bg,#f3f4f6)", border: "1px solid var(--border-color)", borderRadius: "20px", padding: "2px 10px" }}>
                                            {BOOL_FEATURES.filter(f => (editMode ? formData[f.key] : !!inst[f.key])).length} / {BOOL_FEATURES.length} active
                                        </span>
                                    </h4>

                                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

                                        {/* ── Smart Attendance (parent) + QR sub-features ── */}
                                        {(() => {
                                            const f = BOOL_FEATURES[0]; // current_feature_auto_attendance
                                            const val = editMode ? !!formData[f.key] : !!inst[f.key];
                                            return (
                                                <div key={f.key}>
                                                    {/* Parent toggle card */}
                                                    <div
                                                        onClick={() => editMode && setFormData(p => ({ ...p, [f.key]: !p[f.key] }))}
                                                        style={{
                                                            display: "flex", alignItems: "center", gap: "12px",
                                                            padding: "14px 18px", borderRadius: "14px",
                                                            border: `2px solid ${val ? "rgba(16,185,129,0.5)" : "var(--border-color)"}`,
                                                            background: val ? "rgba(16,185,129,0.07)" : "var(--card-bg, #f9fafb)",
                                                            cursor: editMode ? "pointer" : "default",
                                                            userSelect: "none", transition: "all 0.25s",
                                                            boxShadow: val ? "0 0 0 3px rgba(16,185,129,0.1)" : "none"
                                                        }}
                                                    >
                                                        <span style={{ fontSize: "22px" }}>{f.icon}</span>
                                                        <ToggleSwitch val={val} />
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>{f.label}</div>
                                                            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>{f.desc}</div>
                                                        </div>
                                                        <span style={{
                                                            fontSize: "11px", padding: "3px 10px", borderRadius: "20px", fontWeight: 700,
                                                            background: val ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.1)",
                                                            color: val ? "#10b981" : "#ef4444"
                                                        }}>
                                                            {val ? "ENABLED" : "DISABLED"}
                                                        </span>
                                                    </div>

                                                    {/* QR Sub-features — indented, gated by parent */}
                                                    <div style={{
                                                        marginLeft: "32px", marginTop: "8px",
                                                        display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px"
                                                    }}>
                                                        {QR_SUB_FEATURES.map(sub => (
                                                            <div key={sub.label} style={{
                                                                display: "flex", alignItems: "center", gap: "10px",
                                                                padding: "11px 14px", borderRadius: "10px",
                                                                border: `1px solid ${val ? "rgba(99,102,241,0.35)" : "var(--border-color)"}`,
                                                                background: val ? "rgba(99,102,241,0.05)" : "rgba(0,0,0,0.02)",
                                                                opacity: val ? 1 : 0.55,
                                                                position: "relative", overflow: "hidden",
                                                                transition: "all 0.3s"
                                                            }}>
                                                                {/* Left accent bar */}
                                                                <div style={{
                                                                    position: "absolute", left: 0, top: 0, bottom: 0, width: "3px",
                                                                    background: val
                                                                        ? "linear-gradient(180deg, #6366f1, #8b5cf6)"
                                                                        : "var(--border-color)",
                                                                    borderRadius: "3px 0 0 3px"
                                                                }} />
                                                                <span style={{ fontSize: "18px" }}>{sub.icon}</span>
                                                                <div style={{ flex: 1 }}>
                                                                    <div style={{ fontWeight: 600, fontSize: "13px", display: "flex", alignItems: "center", gap: "5px" }}>
                                                                        {sub.label}
                                                                        {!val && <span style={{ fontSize: "11px" }}>🔒</span>}
                                                                    </div>
                                                                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "1px" }}>{sub.desc}</div>
                                                                </div>
                                                                <span style={{
                                                                    fontSize: "10px", padding: "2px 8px", borderRadius: "20px", fontWeight: 700,
                                                                    background: val ? "rgba(99,102,241,0.15)" : "rgba(107,114,128,0.1)",
                                                                    color: val ? "#6366f1" : "var(--text-secondary)"
                                                                }}>
                                                                    {val ? "UNLOCKED" : "LOCKED"}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* ── All other feature toggles ── */}
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: "10px", marginTop: "4px" }}>
                                            {BOOL_FEATURES.slice(1).filter(f => f.key !== "current_feature_chat").map(f => {
                                                const val = editMode ? !!formData[f.key] : !!inst[f.key];
                                                return (
                                                    <div
                                                        key={f.key}
                                                        onClick={() => editMode && setFormData(p => ({ ...p, [f.key]: !p[f.key] }))}
                                                        style={{
                                                            display: "flex", alignItems: "center", gap: "10px",
                                                            padding: "12px 16px", borderRadius: "12px",
                                                            border: `1px solid ${val ? "rgba(16,185,129,0.4)" : "var(--border-color)"}`,
                                                            background: val ? "rgba(16,185,129,0.06)" : "var(--card-bg, #f9fafb)",
                                                            cursor: editMode ? "pointer" : "default",
                                                            userSelect: "none", transition: "all 0.2s"
                                                        }}
                                                    >
                                                        <span style={{ fontSize: "18px" }}>{f.icon}</span>
                                                        <ToggleSwitch val={val} />
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 600, fontSize: "13px" }}>{f.label}</div>
                                                            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "1px" }}>{f.desc}</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* ── Academic Chats Feature ── */}
                                        {(() => {
                                            const chatFeat = BOOL_FEATURES.find(f => f.key === "current_feature_chat");
                                            if (!chatFeat) return null;
                                            const val = editMode ? !!formData[chatFeat.key] : !!inst[chatFeat.key];
                                            return (
                                                <div style={{ marginTop: "6px" }}>
                                                    <div
                                                        onClick={() => editMode && setFormData(p => ({ ...p, [chatFeat.key]: !p[chatFeat.key] }))}
                                                        style={{
                                                            display: "flex", alignItems: "center", gap: "12px",
                                                            padding: "14px 18px", borderRadius: val && editMode ? "14px 14px 0 0" : "14px",
                                                            border: `2px solid ${val ? "rgba(16,185,129,0.5)" : "var(--border-color)"}`,
                                                            borderBottom: val && editMode ? "none" : `2px solid ${val ? "rgba(16,185,129,0.5)" : "var(--border-color)"}`,
                                                            background: val ? "rgba(16,185,129,0.07)" : "var(--card-bg, #f9fafb)",
                                                            cursor: editMode ? "pointer" : "default",
                                                            userSelect: "none", transition: "all 0.25s",
                                                            boxShadow: val ? "0 0 0 3px rgba(16,185,129,0.1)" : "none"
                                                        }}
                                                    >
                                                        <span style={{ fontSize: "22px" }}>{chatFeat.icon}</span>
                                                        <ToggleSwitch val={val} />
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>{chatFeat.label}</div>
                                                            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>{chatFeat.desc}</div>
                                                        </div>
                                                    </div>
                                                    {val && editMode && (
                                                        <div style={{
                                                            padding: "16px 18px",
                                                            background: "var(--card-bg, #f9fafb)",
                                                            border: "2px solid rgba(16,185,129,0.5)",
                                                            borderTop: "1px dashed rgba(16,185,129,0.3)",
                                                            borderRadius: "0 0 14px 14px",
                                                            animation: "fadeInDown 0.3s ease"
                                                        }}>
                                                            <div style={{ maxWidth: "300px" }}>
                                                                <label className="form-label" style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                                                                    Max Chat/msg limit <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>-1 = unlimited, 0 = disabled</span>
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    className="form-input"
                                                                    min="-1"
                                                                    value={formData.current_limit_chat_messages !== undefined ? formData.current_limit_chat_messages : 0}
                                                                    onChange={e => setFormData(p => ({ ...p, current_limit_chat_messages: Number(e.target.value) }))}
                                                                />
                                                                <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "6px", marginBottom: 0 }}>Limit messages sent within chat rooms.</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}

                            {/* ── TAB: DISCOUNTS ── */}
                            {viewTab === "discounts" && (
                                <div style={{ animation: "fadeIn 0.3s ease" }}>
                                    <div style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: "12px", padding: "14px 18px", marginBottom: "1.5rem", fontSize: "14px" }}>
                                        <strong>🎁 Institute Discounts:</strong> Apply manual discounts to this institute. These can be used for special promotions or manual adjustments.
                                    </div>

                                    {msg && (
                                        <div style={{ padding: "12px 16px", borderRadius: "10px", background: msg.startsWith("✅") ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", marginBottom: "1.25rem", fontWeight: 600, fontSize: "14px" }}>
                                            {msg}
                                        </div>
                                    )}

                                    {/* Apply New Discount */}
                                    <div className="card" style={{ padding: "1.5rem", background: "var(--card-bg, #f9fafb)", border: "1px solid var(--border-color)", borderRadius: "14px", marginBottom: "2rem" }}>
                                        <h4 style={{ margin: "0 0 1rem" }}>Apply New Discount</h4>
                                        <form onSubmit={handleApplyDiscount} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "1rem", alignItems: "flex-end" }}>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label">Type</label>
                                                <select className="form-select" value={discountForm.discount_type} onChange={e => setDiscountForm({ ...discountForm, discount_type: e.target.value })}>
                                                    <option value="fixed">Fixed Amount (₹)</option>
                                                    <option value="percentage">Percentage (%)</option>
                                                </select>
                                            </div>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label">Value</label>
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    placeholder="e.g. 500 or 10"
                                                    value={discountForm.discount_value}
                                                    onChange={e => setDiscountForm({ ...discountForm, discount_value: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label">Reason</label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    placeholder="e.g. Anniversary Special"
                                                    value={discountForm.reason}
                                                    onChange={e => setDiscountForm({ ...discountForm, reason: e.target.value })}
                                                />
                                            </div>
                                            <button type="submit" className="btn btn-primary" style={{ padding: "10px 20px" }} disabled={applyingDiscount}>
                                                {applyingDiscount ? "Applying..." : "Apply Discount"}
                                            </button>
                                        </form>
                                    </div>

                                    {/* List Discounts */}
                                    <h4 style={{ margin: "0 0 1rem" }}>Active & Past Discounts</h4>
                                    <div className="table-container" style={{ border: "1px solid var(--border-color)", borderRadius: "12px" }}>
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Type</th>
                                                    <th>Value</th>
                                                    <th>Reason</th>
                                                    <th>Applied By</th>
                                                    <th>Status</th>
                                                    <th>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {details?.discounts?.length === 0 ? (
                                                    <tr><td colSpan={7} style={{ textAlign: "center", padding: "2rem" }}>No discounts found</td></tr>
                                                ) : details.discounts.map(d => (
                                                    <tr key={d.id}>
                                                        <td>{fmtDate(d.createdAt)}</td>
                                                        <td><span className="badge badge-info">{d.discount_type}</span></td>
                                                        <td style={{ fontWeight: 700, color: "#a855f7" }}>
                                                            {d.discount_type === 'fixed' ? `₹${parseFloat(d.discount_value).toLocaleString()}` : `${d.discount_value}%`}
                                                        </td>
                                                        <td>{d.reason || "—"}</td>
                                                        <td>{d.approver?.name || "Admin"}</td>
                                                        <td>
                                                            <span className={`badge badge-${d.status === 'active' ? 'success' : d.status === 'used' ? 'info' : 'secondary'}`}>
                                                                {d.status}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <button className="btn btn-sm btn-danger" onClick={() => handleDeleteDiscount(d.id)}>🗑️</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default InstituteLimits;
