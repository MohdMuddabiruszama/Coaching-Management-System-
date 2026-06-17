/**
 * Faculty Salary Management — Admin Page
 * Phase 9 — Faculty Salary.md
 *
 * Three tabs:
 *   1. Salary Records  — list, filter, pay, edit, delete, PDF slip, overdue badge
 *   2. Salary Settings — set base salary per faculty (used by auto-generate)
 *   3. Report          — aggregated stats: total payroll, paid, pending, overdue
 */

import { useState, useEffect, useContext, useCallback } from "react";
import { Link }        from "react-router-dom";
import api             from "../../services/api";
import salaryService   from "../../services/salary.service";
import { AuthContext } from "../../context/AuthContext";
import "./Dashboard.css";
import "./Students.css";

// ── Pure helpers ──────────────────────────────────────────────────────────────
const fmt = (n) =>
    `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

const currentMonthYear = () => new Date().toISOString().slice(0, 7);

const computeNet = ({ basic_salary = 0, allowances = 0, deductions = 0, advance_paid = 0, present_days, working_days = 26 }) => {
    const b = parseFloat(basic_salary) || 0;
    const a = parseFloat(allowances)   || 0;
    const d = parseFloat(deductions)   || 0;
    const v = parseFloat(advance_paid) || 0;
    const p = parseInt(present_days)   || 0;
    const w = parseInt(working_days)   || 26;
    if (!b) return null;
    const earned = b * (p / (w || 1));
    return Math.max(0, earned + a - d - v);
};

// ── Status + Overdue Badge ────────────────────────────────────────────────────
function StatusBadge({ salary }) {
    if (salary.status === "paid") {
        return (
            <span style={{ background:"#d1fae5", color:"#059669", padding:"0.3rem 0.7rem", borderRadius:20, fontSize:"0.75rem", fontWeight:700, whiteSpace:"nowrap" }}>
                ✅ Paid
            </span>
        );
    }
    if (salary.status === "on_hold") {
        return (
            <span style={{ background:"#f3f4f6", color:"#6b7280", padding:"0.3rem 0.7rem", borderRadius:20, fontSize:"0.75rem", fontWeight:700 }}>
                ⏸ On Hold
            </span>
        );
    }

    // Pending — check overdue
    const today   = new Date(); today.setHours(0,0,0,0);
    const dueDate = salary.payment_due_date ? new Date(salary.payment_due_date) : null;
    const isOverdue = dueDate && dueDate < today;
    const daysLeft  = dueDate ? Math.ceil((dueDate - today) / (1000*60*60*24)) : null;

    if (isOverdue) {
        return (
            <span style={{ background:"#fef2f2", color:"#B71C1C", padding:"0.3rem 0.7rem", borderRadius:20, fontSize:"0.75rem", fontWeight:800, border:"1px solid #fca5a5", whiteSpace:"nowrap" }}>
                ⚠ OVERDUE ({Math.abs(daysLeft)}d)
            </span>
        );
    }
    if (daysLeft !== null && daysLeft <= 2) {
        return (
            <span style={{ background:"#fff7ed", color:"#c2410c", padding:"0.3rem 0.7rem", borderRadius:20, fontSize:"0.75rem", fontWeight:700, whiteSpace:"nowrap" }}>
                ⏰ Due in {daysLeft}d
            </span>
        );
    }

    const duePart = dueDate ? ` (${dueDate.toLocaleDateString("en-IN")})` : "";
    return (
        <span style={{ background:"#fffbeb", color:"#d97706", padding:"0.3rem 0.7rem", borderRadius:20, fontSize:"0.75rem", fontWeight:700, whiteSpace:"nowrap" }}>
            ⏳ Pending{duePart}
        </span>
    );
}

// ── Loading spinner ───────────────────────────────────────────────────────────
const Spinner = () => (
    <div style={{ textAlign:"center", padding:"3rem", color:"#6b7280" }}>
        <div style={{ width:40, height:40, border:"4px solid #e5e7eb", borderTopColor:"#7e22ce", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 1rem" }} />
        Loading...
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
);

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function FacultySalaryPage() {
    const { user } = useContext(AuthContext);
    const isAdmin  = user?.role === "admin" || user?.role === "super_admin";
    const hasPerm  = (a) => isAdmin || (user?.role === "manager" && user?.permissions?.includes(`salary.${a}`));
    const canRead   = hasPerm("read");
    const canCreate = hasPerm("create");
    const canUpdate = hasPerm("update");
    const canDelete = hasPerm("delete");

    // ── Tabs ─────────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState("records"); // records | settings | report

    // ── Salary Records state ──────────────────────────────────────────────────
    const [salaries,     setSalaries]     = useState([]);
    const [faculty,      setFaculty]      = useState([]);
    const [loading,      setLoading]      = useState(true);
    const [monthFilter,  setMonthFilter]  = useState(currentMonthYear());
    const [statusFilter, setStatusFilter] = useState("");
    const [searchTerm,   setSearchTerm]   = useState("");

    // ── Settings tab state ────────────────────────────────────────────────────
    const [settings,     setSettings]     = useState([]);
    const [settingsLoad, setSettingsLoad] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [settingsForm, setSettingsForm] = useState({
        faculty_id: "", basic_salary: "", allowances: "", salary_due_day: 5, working_days_default: 26
    });

    // ── Report tab state ──────────────────────────────────────────────────────
    const [report,       setReport]       = useState(null);
    const [reportMonth,  setReportMonth]  = useState(currentMonthYear());
    const [reportLoad,   setReportLoad]   = useState(false);
    const [genLoading,   setGenLoading]   = useState(false);

    // ── Modals ────────────────────────────────────────────────────────────────
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showPayModal,    setShowPayModal]    = useState(false);
    const [payingRecord,    setPayingRecord]    = useState(null);
    const [editingRecord,   setEditingRecord]   = useState(null);
    const [toast,           setToast]           = useState("");
    const [formError,       setFormError]       = useState("");

    // ── Create/Edit form ──────────────────────────────────────────────────────
    const emptyForm = {
        faculty_id:"", month_year: currentMonthYear(),
        basic_salary:"", allowances:"", deductions:"",
        advance_paid:"", working_days:26, present_days:26,
        payment_due_date:"", remarks:""
    };
    const [form, setForm] = useState(emptyForm);
    const [facultySearch, setFacultySearch] = useState("");
    const [settingsFacultySearch, setSettingsFacultySearch] = useState("");

    // ── Pay form ──────────────────────────────────────────────────────────────
    const [payForm, setPayForm] = useState({
        payment_method:"bank_transfer", transaction_ref:"",
        payment_date: new Date().toISOString().split("T")[0], remarks:""
    });

    // ── Toast helper ──────────────────────────────────────────────────────────
    const showToast = useCallback((msg) => {
        setToast(msg);
        setTimeout(() => setToast(""), 5000);
    }, []);

    // ── Net salary preview ────────────────────────────────────────────────────
    const netPreview = computeNet(form);

    // ── Load salary records + faculty list ────────────────────────────────────
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params = { month_year: monthFilter };
            if (statusFilter) params.status = statusFilter;
            const [salRes, facRes] = await Promise.all([
                api.get("/salary", { params }),
                api.get("/faculty?limit=1000"),
            ]);
            setSalaries(salRes.data.data || []);
            setFaculty(facRes.data.data || []);
        } catch (err) {
            console.error("loadData error:", err);
        } finally {
            setLoading(false);
        }
    }, [monthFilter, statusFilter]);

    useEffect(() => { loadData(); }, [loadData]);

    // ── Auto-detect present days from attendance ───────────────────────────────
    useEffect(() => {
        if (!form.faculty_id || !form.month_year || editingRecord) return;
        const [year, month] = form.month_year.split("-").map(Number);
        const startDate = `${year}-${String(month).padStart(2,"0")}-01`;
        const lastDay   = new Date(year, month, 0).getDate();
        const endDate   = `${year}-${String(month).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;

        api.get(`/faculty-attendance/grid?start_date=${startDate}&end_date=${endDate}`)
            .then(res => {
                const stats = (res.data.data || []).find(f => String(f.faculty_id) === String(form.faculty_id));
                if (stats) {
                    setForm(prev => ({
                        ...prev,
                        present_days: stats.present_days,
                        working_days: stats.working_days > 0 ? stats.working_days : prev.working_days,
                    }));
                }
            })
            .catch(() => {}); // graceful fallback
    }, [form.faculty_id, form.month_year, editingRecord]);

    // ── Load settings ─────────────────────────────────────────────────────────
    const loadSettings = useCallback(async () => {
        setSettingsLoad(true);
        try {
            const res = await salaryService.getSettings();
            setSettings(res.data || []);
        } catch (err) { console.error("loadSettings:", err); }
        finally { setSettingsLoad(false); }
    }, []);

    useEffect(() => { if (activeTab === "settings") loadSettings(); }, [activeTab, loadSettings]);

    // ── Load report ───────────────────────────────────────────────────────────
    const loadReport = useCallback(async () => {
        setReportLoad(true);
        try {
            const res = await salaryService.getReport({ month_year: reportMonth });
            setReport(res.data || res);
        } catch (err) { console.error("loadReport:", err); }
        finally { setReportLoad(false); }
    }, [reportMonth]);

    useEffect(() => { if (activeTab === "report") loadReport(); }, [activeTab, loadReport]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleCreate = async (e) => {
        e.preventDefault();
        setFormError("");
        if (!form.faculty_id || !form.basic_salary) { setFormError("Faculty and Basic Salary are required."); return; }
        if (parseFloat(form.basic_salary) <= 0)      { setFormError("Basic salary must be > 0."); return; }
        if (parseInt(form.present_days) > parseInt(form.working_days)) { setFormError("Present days cannot exceed working days."); return; }
        try {
            const payload = {
                ...form,
                basic_salary:  parseFloat(form.basic_salary),
                allowances:    parseFloat(form.allowances   || 0),
                deductions:    parseFloat(form.deductions   || 0),
                advance_paid:  parseFloat(form.advance_paid || 0),
                working_days:  parseInt(form.working_days  || 26),
                present_days:  parseInt(form.present_days  || 0),
                payment_due_date: form.payment_due_date || undefined,
            };
            if (editingRecord) {
                await salaryService.update(editingRecord.id, payload);
                showToast("✅ Salary record updated!");
            } else {
                await salaryService.create(payload);
                showToast("✅ Salary record created!");
            }
            setShowCreateModal(false); setEditingRecord(null); setForm(emptyForm);
            loadData();
        } catch (err) { setFormError(err.response?.data?.message || "Failed to save."); }
    };

    const handlePay = async (e) => {
        e.preventDefault(); setFormError("");
        try {
            await salaryService.markPaid(payingRecord.id, payForm);
            setShowPayModal(false); setPayingRecord(null);
            showToast("✅ Salary marked as paid!");
            loadData();
        } catch (err) { setFormError(err.response?.data?.message || "Failed."); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this salary record? This cannot be undone.")) return;
        try {
            await salaryService.delete(id);
            showToast("🗑️ Salary record deleted.");
            loadData();
        } catch (err) { alert(err.response?.data?.message || "Cannot delete."); }
    };

    const handleUpsertSettings = async (e) => {
        e.preventDefault(); setFormError("");
        if (!settingsForm.faculty_id || !settingsForm.basic_salary) { setFormError("Faculty and Basic Salary required."); return; }
        try {
            const res = await salaryService.upsertSettings({
                faculty_id:           parseInt(settingsForm.faculty_id),
                basic_salary:         parseFloat(settingsForm.basic_salary),
                allowances:           parseFloat(settingsForm.allowances || 0),
                salary_due_day:       parseInt(settingsForm.salary_due_day || 5),
                working_days_default: parseInt(settingsForm.working_days_default || 26),
            });
            showToast("✅ Salary settings saved!");
            setShowSettingsModal(false);
            setSettingsForm({ faculty_id:"", basic_salary:"", allowances:"", salary_due_day:5, working_days_default:26 });
            
            // OPTIMIZATION: Update local state directly instead of an extra API call
            const newSetting = res.data?.data?.settings;
            const facName    = res.data?.data?.faculty_name;
            const facEmail   = res.data?.data?.faculty_email;
            
            if (newSetting) {
                setSettings(prev => {
                    const exists = prev.find(s => s.faculty_id === newSetting.faculty_id);
                    if (exists) {
                        return prev.map(s => s.faculty_id === newSetting.faculty_id ? { ...s, ...newSetting } : s);
                    } else {
                        return [...prev, { ...newSetting, faculty: { name: facName, email: facEmail } }];
                    }
                });
            } else {
                loadSettings();
            }
        } catch (err) { setFormError(err.response?.data?.message || "Failed to save settings."); }
    };

    const handleDeleteSettings = async (fid) => {
        if (!window.confirm("Remove salary settings for this faculty?")) return;
        try {
            await salaryService.deleteSettings(fid);
            showToast("🗑️ Settings removed.");
            loadSettings();
        } catch (err) { alert(err.response?.data?.message || "Cannot delete."); }
    };

    const handleGenerateMonth = async () => {
        if (!window.confirm(`Generate salary records for ${reportMonth}? This will create PENDING entries for all faculty with settings configured.`)) return;
        setGenLoading(true);
        try {
            const res = await salaryService.generateMonth(reportMonth);
            showToast(`✅ Generated: ${res.data?.data?.generated || 0} records, ${res.data?.data?.skipped || 0} skipped.`);
            loadReport();
        } catch (err) { alert(err.response?.data?.message || "Failed."); }
        finally { setGenLoading(false); }
    };

    const handleBulkGenerate = async () => {
        if (!window.confirm(`Auto-generate all pending salary records for ${monthFilter} based on faculty settings?`)) return;
        setLoading(true);
        try {
            const res = await salaryService.generateMonth(monthFilter);
            showToast(`🚀 Bulk generated: ${res.data?.data?.generated || 0} records created, ${res.data?.data?.skipped || 0} skipped.`);
            loadData();
        } catch (err) { alert(err.response?.data?.message || "Bulk generation failed."); }
        finally { setLoading(false); }
    };

    const handleDownloadSlip = async (salary) => {
        const facName = salary.Faculty?.User?.name || `faculty_${salary.faculty_id}`;
        await salaryService.downloadSlip(salary.id, `salary_slip_${facName.replace(/\s+/g,"_")}_${salary.month_year}.pdf`);
    };

    const handleCSVExport = () => {
        const rows = filteredSalaries.map(s => {
            const name = s.Faculty?.User?.name || "Unknown";
            return `${name},${s.month_year},${s.basic_salary},${s.allowances},${s.deductions},${s.advance_paid},${s.net_salary},${s.present_days},${s.working_days},${s.status},${s.payment_date || ""},${s.payment_method || ""}`;
        });
        const csv = "data:text/csv;charset=utf-8,Faculty,Month,Basic,Allowances,Deductions,AdvancePaid,Net,PresentDays,WorkingDays,Status,PaidOn,Method\n" + rows.join("\n");
        const a = document.createElement("a");
        a.href = encodeURI(csv);
        a.download = `salary_${monthFilter}.csv`;
        a.click();
    };

    // Guard
    if (!canRead) {
        return (
            <div className="students-container">
                <div style={{ textAlign:"center", padding:"4rem 2rem", background:"rgba(239,68,68,0.06)", border:"2px dashed rgba(239,68,68,0.4)", borderRadius:16, maxWidth:480, margin:"4rem auto" }}>
                    <div style={{ fontSize:"3rem", marginBottom:"1rem" }}>🔒</div>
                    <h2 style={{ color:"#ef4444" }}>Access Restricted</h2>
                    <p style={{ color:"var(--text-secondary)" }}>Salary management is only available to Admin users and authorized managers.</p>
                    <Link to="/admin/dashboard" className="btn btn-secondary" style={{ marginTop:"1.5rem" }}>← Back to Dashboard</Link>
                </div>
            </div>
        );
    }

    const filteredSalaries = salaries.filter(s => {
        const name = s.Faculty?.User?.name || "";
        return name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    // Summary stats from loaded data
    const totalNet    = salaries.reduce((s,r) => s + parseFloat(r.net_salary || 0), 0);
    const paidCount   = salaries.filter(r => r.status === "paid").length;
    const paidTotal   = salaries.filter(r => r.status === "paid").reduce((s,r) => s + parseFloat(r.net_salary || 0), 0);
    const pendCount   = salaries.filter(r => r.status === "pending").length;
    const today       = new Date(); today.setHours(0,0,0,0);
    const overdueCount = salaries.filter(r => r.status === "pending" && r.payment_due_date && new Date(r.payment_due_date) < today).length;

    const TAB_STYLE = (t) => ({
        padding:"0.65rem 1.5rem", border:"none", cursor:"pointer", fontSize:"0.9rem", fontWeight:600,
        borderBottom: activeTab === t ? "3px solid #7e22ce" : "3px solid transparent",
        color: activeTab === t ? "#7e22ce" : "#6b7280",
        background:"transparent", transition:"all 0.2s",
    });

    return (
        <div className="students-container">
            {/* ── Toast ── */}
            {toast && (
                <div style={{ position:"fixed", top:20, right:20, background:"#10b981", color:"#fff", padding:"0.85rem 1.5rem", borderRadius:12, fontWeight:700, zIndex:9999, boxShadow:"0 4px 20px rgba(0,0,0,0.15)", animation:"fadeIn 0.3s ease" }}>
                    {toast}
                    <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}`}</style>
                </div>
            )}

            {/* ── Page Header ── */}
            <div className="st-header" style={{ marginBottom:"1.5rem" }}>
                <div className="st-header-top-row">
                    <div className="st-header-left">
                        <h1>Faculty Salary Management</h1>
                        <p>Manage auto-pending salaries, pro-rata slips, and overdue tracking</p>
                    </div>
                </div>
                <div className="st-header-bottom-row">
                    <div className="st-breadcrumbs">
                        <span>Dashboard</span>
                        <span>›</span>
                        <span className="active">Faculty Salary</span>
                    </div>
                    <div className="st-header-actions">
                        <Link to="/admin/finance" className="st-btn st-btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}>
                            📊 Finance
                        </Link>
                        {canCreate && (
                            <button
                                onClick={handleBulkGenerate}
                                className="st-btn st-btn-primary"
                                style={{ background: "linear-gradient(135deg, #10b981, #059669)", border: "none", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
                            >
                                🚀 Bulk Generate
                            </button>
                        )}
                        {canCreate && (
                            <button
                                onClick={() => { setEditingRecord(null); setForm({ ...emptyForm, month_year: monthFilter }); setFormError(""); setFacultySearch(""); setShowCreateModal(true); }}
                                className="st-btn st-btn-primary"
                                style={{ background:"#7e22ce", border:"none" }}
                            >
                                + Add Salary Record
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── KPI Cards ── */}
            <div className="st-stats-grid">
                {[
                    { icon:"📄", label:"Total Records", desc:"All generated salaries", val: salaries.length, isNum:true, iconCls:"st-icon-purple" },
                    { icon:"✅", label:"Paid",          desc:"Salaries fully paid",    val: paidCount,       isNum:true, iconCls:"st-icon-green" },
                    { icon:"⏳", label:"Pending",       desc:"Awaiting payment",       val: pendCount,       isNum:true, iconCls:"st-icon-orange" },
                    { icon:"⚠",  label:"Overdue",       desc:"Passed due date",        val: overdueCount,    isNum:true, iconCls:"st-icon-orange" },
                    { icon:"💸", label:"Total Paid",    desc:"Amount disbursed",       val: paidTotal,       isNum:false, iconCls:"st-icon-blue" },
                    { icon:"📈", label:"Total Payroll", desc:"Total financial load",   val: totalNet,        isNum:false, iconCls:"st-icon-purple" },
                ].map((card, i) => (
                    <div className="st-stat-card" key={i}>
                        <div className="st-stat-top">
                            <div className={`st-stat-icon ${card.iconCls}`}>{card.icon}</div>
                            <div className="st-stat-info">
                                <h3 style={{ fontSize: card.isNum ? "1.5rem" : "1.1rem" }}>{card.isNum ? card.val : fmt(card.val)}</h3>
                                <p>{card.label}</p>
                            </div>
                        </div>
                        <div className="st-stat-bottom">{card.desc}</div>
                    </div>
                ))}
            </div>

            {/* ── Tab Navigation ── */}
            <div style={{ background:"#fff", borderRadius:"12px 12px 0 0", border:"1px solid #e5e7eb", borderBottom:"none", display:"flex", overflow:"hidden" }}>
                {[["records","📄 Salary Records"], ["settings","⚙️ Salary Settings"], ["report","📊 Report"]].map(([key, label]) => (
                    <button key={key} onClick={() => setActiveTab(key)} style={TAB_STYLE(key)}>{label}</button>
                ))}
            </div>

            <div style={{ background:"#fff", borderRadius:"0 0 12px 12px", border:"1px solid #e5e7eb", borderTop:"none", overflow:"hidden" }}>

                {/* ══════════════════ TAB 1: SALARY RECORDS ══════════════════ */}
                {activeTab === "records" && (
                    <>
                        {/* Filter bar */}
                        <div style={{ display:"flex", gap:"1rem", padding:"1.25rem", borderBottom:"1px solid #e5e7eb", flexWrap:"wrap", alignItems:"center", background:"#f8fafc" }}>
                            <div className="st-search" style={{ flex:"none", minWidth: 200 }}>
                                <span className="st-search-icon">📅</span>
                                <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} />
                            </div>
                            <select className="st-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                                <option value="">All Status</option>
                                <option value="pending">Pending</option>
                                <option value="paid">Paid</option>
                                <option value="on_hold">On Hold</option>
                            </select>
                            <div className="st-search" style={{ flex: 1, minWidth: 200 }}>
                                <span className="st-search-icon">🔍</span>
                                <input type="text" placeholder="Search faculty..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                            <button onClick={handleCSVExport} className="st-filter-btn">
                                📥 Export
                            </button>
                        </div>

                        {loading ? <Spinner /> : filteredSalaries.length === 0 ? (
                            <div style={{ textAlign:"center", padding:"4rem 2rem" }}>
                                <div style={{ fontSize:"3rem", marginBottom:"0.75rem" }}>💼</div>
                                <h3>No salary records for {new Date(monthFilter + "-01").toLocaleString("default", { month:"long", year:"numeric" })}</h3>
                                {canCreate && (
                                    <button onClick={() => { setEditingRecord(null); setForm({ ...emptyForm, month_year: monthFilter }); setFormError(""); setFacultySearch(""); setShowCreateModal(true); }}
                                        className="st-btn st-btn-primary"
                                        style={{ background:"#7e22ce", border:"none", marginTop:"1rem" }}>
                                        + Add Salary Record
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div style={{ overflowX:"auto" }}>
                                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                                    <thead style={{ background:"#f9fafb", color:"#6b7280", fontSize:"0.73rem", fontWeight:700, textTransform:"uppercase" }}>
                                        <tr>
                                            <th style={{ padding:"0.85rem 1.25rem", textAlign:"left" }}>Faculty</th>
                                            <th style={{ padding:"0.85rem 1.25rem", textAlign:"left" }}>Month</th>
                                            <th style={{ padding:"0.85rem 1.25rem", textAlign:"left" }}>Basic</th>
                                            <th style={{ padding:"0.85rem 1.25rem", textAlign:"left" }}>+Allow / -Deduct</th>
                                            <th style={{ padding:"0.85rem 1.25rem", textAlign:"left" }}>Net Salary</th>
                                            <th style={{ padding:"0.85rem 1.25rem", textAlign:"left" }}>Attendance</th>
                                            <th style={{ padding:"0.85rem 1.25rem", textAlign:"left" }}>Status</th>
                                            <th style={{ padding:"0.85rem 1.25rem", textAlign:"left" }}>Payment</th>
                                            <th style={{ padding:"0.85rem 1.25rem", textAlign:"right" }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSalaries.map(s => {
                                            const name     = s.Faculty?.User?.name || "Unknown";
                                            const initials = name.split(" ").map(n => n[0]).join("").substring(0,2).toUpperCase();
                                            const isPaid   = s.status === "paid";
                                            return (
                                                <tr key={s.id} style={{ borderBottom:"1px solid #f3f4f6" }}
                                                    onMouseOver={e => e.currentTarget.style.background="#fafafa"}
                                                    onMouseOut={e => e.currentTarget.style.background="transparent"}>
                                                    <td style={{ padding:"1rem 1.25rem" }}>
                                                        <div style={{ display:"flex", alignItems:"center", gap:"0.65rem" }}>
                                                            <div style={{ width:38, height:38, borderRadius:"50%", background:"#f3e8ff", color:"#7e22ce", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.9rem", fontWeight:700, flexShrink:0 }}>{initials}</div>
                                                            <div>
                                                                <div style={{ color:"#111827", fontWeight:600, fontSize:"0.9rem" }}>{name}</div>
                                                                <div style={{ color:"#9ca3af", fontSize:"0.75rem" }}>{s.Faculty?.User?.email}</div>
                                                                {s.auto_generated && <span style={{ fontSize:"0.7rem", color:"#6366f1", background:"#eef2ff", padding:"0.1rem 0.4rem", borderRadius:4 }}>🤖 Auto</span>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding:"1rem 1.25rem", color:"#374151", fontSize:"0.9rem", fontWeight:500 }}>
                                                        {new Date(s.month_year + "-01").toLocaleString("default", { month:"short", year:"numeric" })}
                                                    </td>
                                                    <td style={{ padding:"1rem 1.25rem", color:"#111827", fontWeight:600 }}>{fmt(s.basic_salary)}</td>
                                                    <td style={{ padding:"1rem 1.25rem" }}>
                                                        <div style={{ color:"#059669", fontSize:"0.85rem", fontWeight:600 }}>+{fmt(s.allowances)}</div>
                                                        <div style={{ color:"#ef4444", fontSize:"0.85rem", fontWeight:600 }}>-{fmt(parseFloat(s.deductions || 0) + parseFloat(s.advance_paid || 0))}</div>
                                                    </td>
                                                    <td style={{ padding:"1rem 1.25rem", color:"#7e22ce", fontWeight:800, fontSize:"1rem" }}>{fmt(s.net_salary)}</td>
                                                    <td style={{ padding:"1rem 1.25rem" }}>
                                                        <div style={{ background:"#eff6ff", color:"#3b82f6", padding:"0.25rem 0.6rem", borderRadius:20, fontSize:"0.75rem", fontWeight:600, display:"inline-block" }}>
                                                            {s.present_days}/{s.working_days}d
                                                        </div>
                                                        <div style={{ color:"#9ca3af", fontSize:"0.7rem", marginTop:2 }}>
                                                            {((s.present_days / (s.working_days || 1)) * 100).toFixed(0)}%
                                                        </div>
                                                    </td>
                                                    <td style={{ padding:"1rem 1.25rem" }}><StatusBadge salary={s} /></td>
                                                    <td style={{ padding:"1rem 1.25rem", fontSize:"0.82rem" }}>
                                                        {s.payment_date ? (
                                                            <>
                                                                <div style={{ fontWeight:600, color:"#111827" }}>{new Date(s.payment_date).toLocaleDateString("en-IN")}</div>
                                                                <div style={{ color:"#6b7280", textTransform:"capitalize" }}>{s.payment_method?.replace(/_/g," ")}</div>
                                                                {s.transaction_ref && <div style={{ color:"#9ca3af", fontSize:"0.72rem" }}>Ref: {s.transaction_ref}</div>}
                                                            </>
                                                        ) : s.payment_due_date ? (
                                                            <div style={{ color:"#9ca3af", fontSize:"0.8rem" }}>Due: {new Date(s.payment_due_date).toLocaleDateString("en-IN")}</div>
                                                        ) : <span style={{ color:"#9ca3af" }}>—</span>}
                                                    </td>
                                                    <td style={{ padding:"1rem 1.25rem", textAlign:"right", whiteSpace:"nowrap" }}>
                                                        <div style={{ display:"flex", gap:"0.4rem", justifyContent:"flex-end" }}>
                                                            {!isPaid && canUpdate && (
                                                                <button onClick={() => { setPayingRecord(s); setPayForm({ payment_method:"bank_transfer", transaction_ref:"", payment_date:new Date().toISOString().split("T")[0], remarks:"" }); setFormError(""); setShowPayModal(true); }}
                                                                    style={{ padding:"0.35rem 0.65rem", borderRadius:6, background:"#059669", color:"#fff", border:"none", cursor:"pointer", fontSize:"0.82rem", fontWeight:600 }}>
                                                                    💰 Pay
                                                                </button>
                                                            )}
                                                            {isPaid && (
                                                                <button onClick={() => handleDownloadSlip(s)}
                                                                    title="Download Salary Slip PDF"
                                                                    style={{ padding:"0.35rem 0.65rem", borderRadius:6, background:"#4f46e5", color:"#fff", border:"none", cursor:"pointer", fontSize:"0.82rem", fontWeight:600 }}>
                                                                    📄 Slip
                                                                </button>
                                                            )}
                                                            {!isPaid && canUpdate && (
                                                                <button onClick={() => { setForm({ faculty_id:s.faculty_id, month_year:s.month_year, basic_salary:s.basic_salary, allowances:s.allowances, deductions:s.deductions, advance_paid:s.advance_paid, working_days:s.working_days, present_days:s.present_days, payment_due_date:s.payment_due_date||"", remarks:s.remarks||"" }); setEditingRecord(s); setFormError(""); setFacultySearch(""); setShowCreateModal(true); }}
                                                                    style={{ padding:"0.35rem 0.65rem", borderRadius:6, border:"1px solid #e5e7eb", background:"#f9fafb", color:"#374151", cursor:"pointer", fontSize:"0.82rem" }}>
                                                                    ✏️
                                                                </button>
                                                            )}
                                                            {canDelete && (
                                                                <button onClick={() => handleDelete(s.id)}
                                                                    style={{ padding:"0.35rem 0.65rem", borderRadius:6, border:"1px solid #fee2e2", background:"#fef2f2", color:"#ef4444", cursor:"pointer", fontSize:"0.82rem" }}>
                                                                    🗑️
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}

                {/* ══════════════════ TAB 2: SALARY SETTINGS ══════════════════ */}
                {activeTab === "settings" && (
                    <div style={{ padding:"1.5rem" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
                            <div>
                                <h3 style={{ margin:0, color:"#111827" }}>⚙️ Salary Settings</h3>
                                <p style={{ margin:"0.25rem 0 0", color:"#6b7280", fontSize:"0.875rem" }}>Set base salary per faculty. The auto-generate cron uses these settings on the 1st of each month.</p>
                            </div>
                            {canCreate && (
                                <button onClick={() => { setSettingsForm({ faculty_id:"", basic_salary:"", allowances:"", salary_due_day:5, working_days_default:26 }); setFormError(""); setShowSettingsModal(true); }}
                                    className="st-btn st-btn-primary"
                                    style={{ background:"#7e22ce", border:"none" }}>
                                    + Set Faculty Salary
                                </button>
                            )}
                        </div>

                        {/* Info banner */}
                        <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:8, padding:"0.85rem 1.25rem", marginBottom:"1.25rem", display:"flex", gap:"0.75rem", alignItems:"flex-start" }}>
                            <span style={{ color:"#3b82f6", fontSize:"1.2rem", flexShrink:0 }}>ℹ️</span>
                            <div style={{ color:"#1e40af", fontSize:"0.875rem" }}>
                                <strong>How auto-generate works:</strong> On the 1st of every month at 00:01 AM (IST), the system reads these settings and creates <em>pending</em> salary records for all active faculty. Admin only needs to review attendance and click Pay.
                                You can also trigger this manually from the <strong>Report tab</strong>.
                            </div>
                        </div>

                        {settingsLoad ? <Spinner /> : settings.length === 0 ? (
                            <div style={{ textAlign:"center", padding:"3rem", border:"2px dashed #e5e7eb", borderRadius:12 }}>
                                <div style={{ fontSize:"2.5rem", marginBottom:"0.75rem" }}>⚙️</div>
                                <h3>No salary settings configured yet</h3>
                                <p style={{ color:"#6b7280" }}>Set base salary for each faculty to enable monthly auto-generation.</p>
                                {canCreate && (
                                    <button onClick={() => { setSettingsForm({ faculty_id:"", basic_salary:"", allowances:"", salary_due_day:5, working_days_default:26 }); setFormError(""); setShowSettingsModal(true); }}
                                        className="st-btn st-btn-primary"
                                        style={{ background:"#7e22ce", border:"none", marginTop:"1rem" }}>
                                        + Set Faculty Salary
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div style={{ overflowX:"auto" }}>
                                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                                    <thead style={{ background:"#f9fafb", fontSize:"0.73rem", fontWeight:700, textTransform:"uppercase", color:"#6b7280" }}>
                                        <tr>
                                            <th style={{ padding:"0.85rem 1.25rem", textAlign:"left" }}>Faculty</th>
                                            <th style={{ padding:"0.85rem 1.25rem", textAlign:"left" }}>Basic Salary</th>
                                            <th style={{ padding:"0.85rem 1.25rem", textAlign:"left" }}>Allowances</th>
                                            <th style={{ padding:"0.85rem 1.25rem", textAlign:"left" }}>Due Day</th>
                                            <th style={{ padding:"0.85rem 1.25rem", textAlign:"left" }}>Working Days</th>
                                            <th style={{ padding:"0.85rem 1.25rem", textAlign:"left" }}>Status</th>
                                            <th style={{ padding:"0.85rem 1.25rem", textAlign:"right" }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {settings.map(s => (
                                            <tr key={s.id} style={{ borderBottom:"1px solid #f3f4f6" }}>
                                                <td style={{ padding:"0.9rem 1.25rem" }}>
                                                    <div style={{ fontWeight:600, color:"#111827" }}>{s.faculty?.name || "—"}</div>
                                                    <div style={{ color:"#9ca3af", fontSize:"0.78rem" }}>{s.faculty?.email}</div>
                                                </td>
                                                <td style={{ padding:"0.9rem 1.25rem", color:"#7e22ce", fontWeight:700 }}>{fmt(s.basic_salary)}</td>
                                                <td style={{ padding:"0.9rem 1.25rem", color:"#059669", fontWeight:600 }}>{fmt(s.allowances)}</td>
                                                <td style={{ padding:"0.9rem 1.25rem" }}>
                                                    <span style={{ background:"#eff6ff", color:"#2563eb", padding:"0.25rem 0.65rem", borderRadius:20, fontSize:"0.8rem", fontWeight:600 }}>{s.salary_due_day}th</span>
                                                </td>
                                                <td style={{ padding:"0.9rem 1.25rem", color:"#374151" }}>{s.working_days_default} days</td>
                                                <td style={{ padding:"0.9rem 1.25rem" }}>
                                                    <span style={{ background: s.is_active ? "#d1fae5" : "#f3f4f6", color: s.is_active ? "#059669" : "#6b7280", padding:"0.25rem 0.65rem", borderRadius:20, fontSize:"0.8rem", fontWeight:600 }}>
                                                        {s.is_active ? "✅ Active" : "⏸ Inactive"}
                                                    </span>
                                                </td>
                                                <td style={{ padding:"0.9rem 1.25rem", textAlign:"right" }}>
                                                    <div style={{ display:"flex", gap:"0.4rem", justifyContent:"flex-end" }}>
                                                        {canUpdate && (
                                                            <button onClick={() => { setSettingsForm({ faculty_id: s.faculty_id, basic_salary: s.basic_salary, allowances: s.allowances, salary_due_day: s.salary_due_day, working_days_default: s.working_days_default }); setFormError(""); setShowSettingsModal(true); }}
                                                                style={{ padding:"0.35rem 0.65rem", borderRadius:6, border:"1px solid #e5e7eb", background:"#f9fafb", color:"#374151", cursor:"pointer", fontSize:"0.82rem" }}>
                                                                ✏️ Edit
                                                            </button>
                                                        )}
                                                        {canDelete && (
                                                            <button onClick={() => handleDeleteSettings(s.faculty_id)}
                                                                style={{ padding:"0.35rem 0.65rem", borderRadius:6, border:"1px solid #fee2e2", background:"#fef2f2", color:"#ef4444", cursor:"pointer", fontSize:"0.82rem" }}>
                                                                🗑️
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ══════════════════ TAB 3: REPORT ══════════════════ */}
                {activeTab === "report" && (
                    <div style={{ padding:"1.5rem" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem", flexWrap:"wrap", gap:"0.75rem" }}>
                            <div>
                                <h3 style={{ margin:0, color:"#111827" }}>📊 Salary Report</h3>
                                <p style={{ margin:"0.25rem 0 0", color:"#6b7280", fontSize:"0.875rem" }}>Single aggregated query — all stats computed server-side.</p>
                            </div>
                            <div style={{ display:"flex", gap:"0.75rem", alignItems:"center" }}>
                                <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)}
                                    style={{ padding:"0.5rem 0.75rem", borderRadius:8, border:"1px solid #e5e7eb", fontSize:"0.9rem" }} />
                                <button onClick={loadReport} className="st-btn st-btn-outline">🔄 Refresh</button>
                                {canCreate && (
                                    <button onClick={handleGenerateMonth} disabled={genLoading}
                                        className="st-btn st-btn-primary"
                                        style={{ background: genLoading ? "#e5e7eb" : "#7e22ce", color: genLoading ? "#9ca3af" : "#fff", border:"none" }}>
                                        {genLoading ? "⏳ Generating..." : "🚀 Generate Month"}
                                    </button>
                                )}
                            </div>
                        </div>

                        {reportLoad ? <Spinner /> : report ? (
                            <div className="st-stats-grid">
                                {[
                                    { icon:"📄", label:"Total Records",    val: report.total_records,       isNum:true, iconCls:"st-icon-purple" },
                                    { icon:"✅", label:"Paid Count",       val: report.paid_count,          isNum:true, iconCls:"st-icon-green" },
                                    { icon:"⏳", label:"Pending Count",    val: report.pending_count,       isNum:true, iconCls:"st-icon-orange" },
                                    { icon:"⚠",  label:"Overdue",          val: report.overdue_count,       isNum:true, iconCls:"st-icon-orange" },
                                    { icon:"⏸",  label:"On Hold",          val: report.on_hold_count,       isNum:true, iconCls:"st-icon-blue" },
                                    { icon:"🤖", label:"Auto-Generated",   val: report.auto_generated_count,isNum:true, iconCls:"st-icon-purple" },
                                    { icon:"💰", label:"Total Payroll",    val: report.total_payroll,       isNum:false, iconCls:"st-icon-blue" },
                                    { icon:"💸", label:"Total Paid",       val: report.total_paid,          isNum:false, iconCls:"st-icon-green" },
                                    { icon:"⏰", label:"Total Pending",    val: report.total_pending,       isNum:false, iconCls:"st-icon-orange" },
                                ].map((card, i) => (
                                    <div className="st-stat-card" key={i}>
                                        <div className="st-stat-top">
                                            <div className={`st-stat-icon ${card.iconCls}`}>{card.icon}</div>
                                            <div className="st-stat-info">
                                                <h3 style={{ fontSize: card.isNum ? "1.5rem" : "1.1rem" }}>{card.isNum ? (card.val || 0) : fmt(card.val || 0)}</h3>
                                                <p>{card.label}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ textAlign:"center", padding:"3rem", color:"#6b7280" }}>Click Refresh to load report</div>
                        )}
                    </div>
                )}
            </div>

            {/* ═══════════════════ CREATE / EDIT SALARY MODAL ═══════════════════ */}
            {showCreateModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth:580 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem" }}>
                            <h2 style={{ margin:0, fontSize:"1.2rem" }}>{editingRecord ? "✏️ Edit Salary Record" : "➕ Create Salary Record"}</h2>
                            <button onClick={() => { setShowCreateModal(false); setEditingRecord(null); }} style={{ background:"none", border:"none", fontSize:"1.5rem", cursor:"pointer", color:"var(--text-secondary)" }}>✕</button>
                        </div>

                        {formError && <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.4)", borderRadius:8, padding:"0.75rem 1rem", marginBottom:"1rem", color:"#ef4444", fontSize:14 }}>⚠️ {formError}</div>}

                        <form onSubmit={handleCreate} className="form-grid">
                            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Select Faculty *</span>
                                    {form.faculty_id && !editingRecord && (
                                        <span style={{ color: '#059669', fontSize: '0.85rem' }}>
                                            1 selected
                                        </span>
                                    )}
                                </label>
                                
                                {editingRecord ? (
                                    <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        {(() => {
                                            const selF = faculty.find(f => f.id.toString() === form.faculty_id?.toString());
                                            const name = selF?.User?.name || selF?.name || "Unknown";
                                            const initials = name.substring(0, 2).toUpperCase();
                                            return (
                                                <>
                                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f3e8ff', color: '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                                        {initials}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{name}</div>
                                                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{selF?.User?.email}</div>
                                                    </div>
                                                    <div style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '0.85rem' }}>Cannot change while editing</div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                ) : (
                                    <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", background: "#f8fafc" }}>
                                        <div style={{ display: "flex", alignItems: "center", padding: "0.5rem 1rem", borderBottom: "1px solid #e2e8f0", background: "#fff" }}>
                                            <span style={{ marginRight: "0.5rem" }}>🔍</span>
                                            <input 
                                                type="text" 
                                                placeholder="Search faculty by name or email..." 
                                                value={facultySearch}
                                                onChange={(e) => setFacultySearch(e.target.value)}
                                                style={{ border: "none", outline: "none", width: "100%", padding: "0.5rem 0", background: "transparent", fontSize: "0.95rem" }}
                                            />
                                        </div>
                                        <div style={{ maxHeight: "220px", overflowY: "auto", padding: "0.5rem" }}>
                                            {(() => {
                                                const searchTerms = facultySearch.toLowerCase().trim().split(/\s+/).filter(Boolean);
                                                const filteredFac = faculty.filter(f => {
                                                    const name = (f.User?.name || f.name || "").toLowerCase();
                                                    const email = (f.User?.email || "").toLowerCase();
                                                    const searchTarget = `${name} ${email}`;
                                                    // if no search terms, match all. otherwise must match all terms
                                                    return searchTerms.length === 0 || searchTerms.every(term => searchTarget.includes(term));
                                                });
                                                
                                                if (filteredFac.length === 0) {
                                                    return (
                                                        <div style={{ textAlign: "center", padding: "1.5rem 1rem", color: "#64748B" }}>
                                                            No faculty found matching your criteria.
                                                        </div>
                                                    );
                                                }
                                                
                                                return filteredFac.map(f => {
                                                    const isSelected = form.faculty_id?.toString() === f.id.toString();
                                                    const name = f.User?.name || f.name || "Unknown";
                                                    const initials = name.substring(0, 2).toUpperCase();
                                                    
                                                    return (
                                                        <div 
                                                            key={f.id}
                                                            onClick={() => setForm({ ...form, faculty_id: f.id.toString() })}
                                                            style={{ 
                                                                display: "flex", alignItems: "center", padding: "0.75rem", 
                                                                borderRadius: "6px", cursor: "pointer", marginBottom: "0.25rem",
                                                                background: isSelected ? "#f0fdf4" : "#fff",
                                                                border: isSelected ? "1px solid #86efac" : "1px solid transparent",
                                                                transition: "all 0.2s"
                                                            }}
                                                            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "#f1f5f9" }}
                                                            onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "#fff" }}
                                                        >
                                                            <div style={{ marginRight: "1rem" }}>
                                                                <input 
                                                                    type="radio" 
                                                                    checked={isSelected} 
                                                                    readOnly
                                                                    style={{ cursor: "pointer", width: "16px", height: "16px", accentColor: "#10b981" }}
                                                                />
                                                            </div>
                                                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: isSelected ? '#dcfce7' : '#f3e8ff', color: isSelected ? '#166534' : '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', marginRight: "1rem", flexShrink: 0 }}>
                                                                {initials}
                                                            </div>
                                                            <div>
                                                                <div style={{ fontWeight: 600, color: '#1e293b' }}>{name}</div>
                                                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                                    {f.User?.email}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="form-group">
                                <label className="form-label">Month *</label>
                                <input type="month" className="form-input" value={form.month_year} onChange={e => setForm({ ...form, month_year: e.target.value })} required disabled={!!editingRecord} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Basic Salary (₹) *</label>
                                <input type="number" className="form-input" value={form.basic_salary} onChange={e => setForm({ ...form, basic_salary: e.target.value })} placeholder="e.g. 25000" min="1" step="0.01" required />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Allowances (₹)</label>
                                <input type="number" className="form-input" value={form.allowances} onChange={e => setForm({ ...form, allowances: e.target.value })} placeholder="HRA, Travel, etc." min="0" step="0.01" />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Deductions (₹)</label>
                                <input type="number" className="form-input" value={form.deductions} onChange={e => setForm({ ...form, deductions: e.target.value })} placeholder="PF, Tax, etc." min="0" step="0.01" />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Advance Paid (₹)</label>
                                <input type="number" className="form-input" value={form.advance_paid} onChange={e => setForm({ ...form, advance_paid: e.target.value })} placeholder="Prior advance" min="0" step="0.01" />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Working Days</label>
                                <input type="number" className="form-input" value={form.working_days} onChange={e => setForm({ ...form, working_days: e.target.value })} min="1" max="31" />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Present Days <span style={{ color:"#9ca3af", fontWeight:400 }}>(auto-fetched)</span></label>
                                <input type="number" className="form-input" value={form.present_days} onChange={e => setForm({ ...form, present_days: e.target.value })} min="0" max={form.working_days || 31} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Payment Due Date <span style={{ color:"#9ca3af", fontWeight:400 }}>(optional)</span></label>
                                <input type="date" className="form-input" value={form.payment_due_date} onChange={e => setForm({ ...form, payment_due_date: e.target.value })} />
                            </div>

                            <div className="form-group" style={{ gridColumn:"1 / -1" }}>
                                <label className="form-label">Remarks (Optional)</label>
                                <textarea className="form-input" value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} rows={2} placeholder="Any notes..." />
                            </div>

                            {/* Net preview */}
                            {netPreview !== null && (
                                <div style={{ gridColumn:"1 / -1", background: netPreview >= 0 ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", border:`1px solid ${netPreview >= 0 ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius:10, padding:"0.75rem 1rem", display:"flex", alignItems:"center", gap:"0.75rem" }}>
                                    <span style={{ fontSize:"1.4rem" }}>🧮</span>
                                    <div>
                                        <div style={{ fontSize:12, color:"var(--text-secondary)", fontWeight:600 }}>Net Salary Preview</div>
                                        <div style={{ fontWeight:800, fontSize:22, color: netPreview >= 0 ? "#10b981" : "#ef4444" }}>{fmt(netPreview)}</div>
                                        <div style={{ fontSize:11, color:"var(--text-secondary)" }}>Basic × (Present/Working) + Allow − Deduct − Advance</div>
                                    </div>
                                </div>
                            )}

                            <div className="form-actions" style={{ gridColumn:"1 / -1", marginTop:"0.5rem", paddingTop:"1rem", borderTop:"1px solid var(--border-color)" }}>
                                <button type="button" className="btn btn-secondary" onClick={() => { setShowCreateModal(false); setEditingRecord(null); }}>Cancel</button>
                                <button type="submit" className="btn btn-primary" style={{ background:"linear-gradient(135deg,#6366f1,#a855f7)", border:"none" }}>
                                    {editingRecord ? "💾 Save Changes" : "💾 Create Salary"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══════════════════ PAY SALARY MODAL ═══════════════════ */}
            {showPayModal && payingRecord && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth:460 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem" }}>
                            <h2 style={{ margin:0, fontSize:"1.2rem" }}>💰 Mark Salary as Paid</h2>
                            <button onClick={() => setShowPayModal(false)} style={{ background:"none", border:"none", fontSize:"1.5rem", cursor:"pointer" }}>✕</button>
                        </div>

                        <div style={{ background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.3)", borderRadius:12, padding:"1rem 1.25rem", marginBottom:"1.5rem" }}>
                            <div style={{ fontSize:13, color:"var(--text-secondary)" }}>Confirming payment for:</div>
                            <div style={{ fontWeight:700, fontSize:"1rem" }}>{payingRecord.Faculty?.User?.name}</div>
                            <div style={{ fontSize:13, color:"var(--text-secondary)" }}>{payingRecord.month_year}</div>
                            <div style={{ fontWeight:800, fontSize:22, color:"#10b981", marginTop:6 }}>{fmt(payingRecord.net_salary)}</div>
                        </div>

                        {formError && <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.4)", borderRadius:8, padding:"0.75rem 1rem", marginBottom:"1rem", color:"#ef4444", fontSize:14 }}>⚠️ {formError}</div>}

                        <form onSubmit={handlePay}>
                            <div className="form-group" style={{ marginBottom:"1rem" }}>
                                <label className="form-label">Payment Method *</label>
                                <select className="form-select" value={payForm.payment_method} onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })}>
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="upi">UPI</option>
                                    <option value="cash">Cash</option>
                                    <option value="cheque">Cheque</option>
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom:"1rem" }}>
                                <label className="form-label">Payment Date *</label>
                                <input type="date" className="form-input" value={payForm.payment_date} onChange={e => setPayForm({ ...payForm, payment_date: e.target.value })} required />
                            </div>

                            {(payForm.payment_method === "upi" || payForm.payment_method === "bank_transfer" || payForm.payment_method === "cheque") && (
                                <div className="form-group" style={{ marginBottom:"1rem" }}>
                                    <label className="form-label">Transaction Reference</label>
                                    <input type="text" className="form-input" value={payForm.transaction_ref} onChange={e => setPayForm({ ...payForm, transaction_ref: e.target.value })} placeholder="UTR / Transaction ID / Cheque No." />
                                </div>
                            )}

                            <div className="form-group" style={{ marginBottom:"1rem" }}>
                                <label className="form-label">Remarks (Optional)</label>
                                <input type="text" className="form-input" value={payForm.remarks} onChange={e => setPayForm({ ...payForm, remarks: e.target.value })} placeholder="Any payment notes..." />
                            </div>

                            <div className="form-actions" style={{ marginTop:"1rem", paddingTop:"1rem", borderTop:"1px solid var(--border-color)" }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowPayModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" style={{ background:"linear-gradient(135deg,#10b981,#059669)", border:"none" }}>
                                    ✅ Confirm Payment
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══════════════════ SALARY SETTINGS MODAL ═══════════════════ */}
            {showSettingsModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth:500 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem" }}>
                            <h2 style={{ margin:0, fontSize:"1.2rem" }}>⚙️ Set Faculty Salary</h2>
                            <button onClick={() => setShowSettingsModal(false)} style={{ background:"none", border:"none", fontSize:"1.5rem", cursor:"pointer" }}>✕</button>
                        </div>

                        <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:8, padding:"0.75rem 1rem", marginBottom:"1.25rem", fontSize:"0.875rem", color:"#1e40af" }}>
                            💡 These settings are used by the <strong>monthly auto-generate cron</strong>. Set once and the system generates pending salary records automatically on the 1st of each month.
                        </div>

                        {formError && <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.4)", borderRadius:8, padding:"0.75rem 1rem", marginBottom:"1rem", color:"#ef4444", fontSize:14 }}>⚠️ {formError}</div>}

                        <form onSubmit={handleUpsertSettings} className="form-grid">
                            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                                <label className="form-label">Faculty *</label>
                                <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", background: "#f8fafc", overflow: "hidden" }}>
                                    <div style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0", background: "#fff", display: "flex", alignItems: "center" }}>
                                        <span style={{ marginRight: "0.5rem", color: "#64748b" }}>🔍</span>
                                        <input 
                                            type="text" 
                                            placeholder="Search faculty by name or email..." 
                                            value={settingsFacultySearch}
                                            onChange={(e) => setSettingsFacultySearch(e.target.value)}
                                            style={{ border: "none", outline: "none", width: "100%", fontSize: "0.95rem" }}
                                        />
                                    </div>
                                    <div style={{ maxHeight: "220px", overflowY: "auto", padding: "0.5rem" }}>
                                        {(() => {
                                            const searchTerms = settingsFacultySearch.toLowerCase().trim().split(/\s+/).filter(Boolean);
                                            const filteredFac = faculty.filter(f => {
                                                const name = (f.User?.name || f.name || "").toLowerCase();
                                                const email = (f.User?.email || "").toLowerCase();
                                                const searchTarget = `${name} ${email}`;
                                                return searchTerms.length === 0 || searchTerms.every(term => searchTarget.includes(term));
                                            });
                                            
                                            if (filteredFac.length === 0) {
                                                return (
                                                    <div style={{ textAlign: "center", padding: "1.5rem 1rem", color: "#64748B" }}>
                                                        No faculty found matching your criteria.
                                                    </div>
                                                );
                                            }
                                            
                                            return filteredFac.map(f => {
                                                const isSelected = settingsForm.faculty_id?.toString() === f.user_id?.toString();
                                                const name = f.User?.name || f.name || "Unknown";
                                                const initials = name.substring(0, 2).toUpperCase();
                                                
                                                return (
                                                    <div 
                                                        key={f.user_id}
                                                        onClick={() => setSettingsForm({ ...settingsForm, faculty_id: f.user_id?.toString() })}
                                                        style={{ 
                                                            display: "flex", alignItems: "center", padding: "0.75rem", 
                                                            borderRadius: "6px", cursor: "pointer", marginBottom: "0.25rem",
                                                            background: isSelected ? "#f0fdf4" : "#fff",
                                                            border: isSelected ? "1px solid #86efac" : "1px solid transparent",
                                                            transition: "all 0.2s"
                                                        }}
                                                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "#f1f5f9" }}
                                                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "#fff" }}
                                                    >
                                                        <div style={{ marginRight: "1rem" }}>
                                                            <input 
                                                                type="radio" 
                                                                checked={isSelected} 
                                                                readOnly
                                                                style={{ cursor: "pointer", width: "16px", height: "16px", accentColor: "#10b981" }}
                                                            />
                                                        </div>
                                                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: isSelected ? '#dcfce7' : '#f3e8ff', color: isSelected ? '#166534' : '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', marginRight: "1rem", flexShrink: 0 }}>
                                                            {initials}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{name}</div>
                                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                                {f.User?.email}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Basic Salary (₹) *</label>
                                <input type="number" className="form-input" value={settingsForm.basic_salary} onChange={e => setSettingsForm({ ...settingsForm, basic_salary: e.target.value })} placeholder="e.g. 25000" min="0.01" step="0.01" required />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Allowances (₹)</label>
                                <input type="number" className="form-input" value={settingsForm.allowances} onChange={e => setSettingsForm({ ...settingsForm, allowances: e.target.value })} placeholder="0" min="0" step="0.01" />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Salary Due Day <span style={{ color:"#9ca3af", fontWeight:400 }}>(1–28)</span></label>
                                <input type="number" className="form-input" value={settingsForm.salary_due_day} onChange={e => setSettingsForm({ ...settingsForm, salary_due_day: e.target.value })} min="1" max="28" placeholder="5" />
                                <small style={{ color:"#6b7280" }}>Day of month salary is due. E.g. 5 → paid on 5th.</small>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Default Working Days</label>
                                <input type="number" className="form-input" value={settingsForm.working_days_default} onChange={e => setSettingsForm({ ...settingsForm, working_days_default: e.target.value })} min="1" max="31" placeholder="26" />
                            </div>

                            <div className="form-actions" style={{ gridColumn:"1 / -1", marginTop:"0.5rem", paddingTop:"1rem", borderTop:"1px solid var(--border-color)" }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowSettingsModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" style={{ background:"linear-gradient(135deg,#6366f1,#a855f7)", border:"none" }}>
                                    💾 Save Settings
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
