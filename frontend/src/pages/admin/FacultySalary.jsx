/**
 * Faculty Salary Management — Phase 10 (Finance.md)
 * Admin only: Create salary records, mark as paid, view monthly salary report
 * Features:
 *   - List all faculty with current month's salary status
 *   - Create salary record with auto net_salary calculation
 *   - Mark salary as paid (payment method + reference)
 *   - Month filter
 *   - Status badges: Pending | Paid | On Hold | Not Created
 */

import { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import "./Dashboard.css";
import "./Students.css";

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatRupee = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

const currentMonthYear = () => new Date().toISOString().slice(0, 7);

// ── Status Badge ──────────────────────────────────────────────────────────────
function SalaryBadge({ status }) {
  const map = {
    paid:        { bg: "#ecfdf5",  color: "#059669", label: "✅ Paid"       },
    pending:     { bg: "#fffbeb",  color: "#d97706", label: "⏳ Pending"    },
    on_hold:     { bg: "#fef2f2",  color: "#dc2626", label: "⏸️ On Hold"    },
    not_created: { bg: "#f3f4f6", color: "#4b5563", label: "➕ Not Created" },
  };
  const s = map[status] || map.not_created;
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: "0.35rem 0.75rem", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "0.35rem"
    }}>
      {s.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function FacultySalaryPage() {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const hasPerm = (action) => isAdmin || (user?.role === "manager" && user?.permissions?.includes(`salary.${action}`));
  const canRead = hasPerm("read");
  const canCreate = hasPerm("create");
  const canUpdate = hasPerm("update");
  const canDelete = hasPerm("delete");

  // ── Data state ────────────────────────────────────────────────────────────
  const [salaries, setSalaries]     = useState([]);
  const [faculty, setFaculty]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [monthFilter, setMonthFilter] = useState(currentMonthYear());
  const [summaryStats, setSummaryStats] = useState(null);
  const [searchTerm, setSearchTerm]   = useState("");

  // ── Modals ────────────────────────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPayModal,    setShowPayModal]    = useState(false);
  const [payingRecord,    setPayingRecord]    = useState(null);
  const [editingRecord,   setEditingRecord]   = useState(null);
  const [success, setSuccess]                = useState("");
  const [formError, setFormError]            = useState("");

  // ── Create form ───────────────────────────────────────────────────────────
  const emptyForm = {
    faculty_id: "", month_year: currentMonthYear(),
    basic_salary: "", allowances: "", deductions: "",
    advance_paid: "", working_days: 26, present_days: 26, remarks: ""
  };
  const [form, setForm] = useState(emptyForm);

  // ── Pay form ──────────────────────────────────────────────────────────────
  const [payForm, setPayForm] = useState({ payment_method: "bank_transfer", transaction_ref: "" });

  // ── Computed net salary preview ───────────────────────────────────────────
  const netPreview = (() => {
    const b = parseFloat(form.basic_salary || 0);
    const a = parseFloat(form.allowances  || 0);
    const d = parseFloat(form.deductions  || 0);
    const v = parseFloat(form.advance_paid|| 0);
    const w = parseInt(form.working_days  || 26);
    const p = parseInt(form.present_days  || w);
    if (!b) return null;
    const earned = b * (p / (w || 1));
    return Math.max(0, earned + a - d - v);
  })();

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadData = async () => {
    try {
      setLoading(true);
      const [salRes, facRes] = await Promise.all([
        api.get(`/salary?month_year=${monthFilter}`),
        api.get("/faculty")
      ]);
      const sals = salRes.data.data || [];
      setSalaries(sals);
      setFaculty(facRes.data.data || []);

      // Compute summary
      const totalNet  = sals.reduce((s, r) => s + parseFloat(r.net_salary || 0), 0);
      const paidCount = sals.filter(r => r.status === "paid").length;
      const paidTotal = sals.filter(r => r.status === "paid").reduce((s, r) => s + parseFloat(r.net_salary || 0), 0);
      setSummaryStats({ total: totalNet, paidCount, paidTotal, pendingCount: sals.length - paidCount });
    } catch (err) {
      console.error("loadData error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [monthFilter]);

  // ── Auto-Detect Present Days ──────────────────────────────────────────────
  useEffect(() => {
    const fetchPresentDays = async () => {
      // Only inject aggressively on new "Create" procedures. Protect "Edit" modifications.
      if (!form.faculty_id || !form.month_year || editingRecord) return;
      
      const year = parseInt(form.month_year.split("-")[0], 10);
      const month = parseInt(form.month_year.split("-")[1], 10);
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDateObj = new Date(year, month, 0); 
      const endDate = `${year}-${String(month).padStart(2, "0")}-${String(endDateObj.getDate()).padStart(2, "0")}`;

      try {
        const res = await api.get(`/faculty-attendance/grid?start_date=${startDate}&end_date=${endDate}`);
        const gridData = res.data.data || [];
        const facStats = gridData.find(f => String(f.faculty_id) === String(form.faculty_id));
        if (facStats) {
           setForm(prev => ({
             ...prev,
             present_days: facStats.present_days,
             // Set working days based on actual month constraints natively recorded
             working_days: facStats.working_days > 0 ? facStats.working_days : prev.working_days 
           }));
        } else {
           setForm(prev => ({ ...prev, present_days: 0 }));
        }
      } catch (e) {
         console.warn("Tracker Bypass: Could not auto-fetch present days. Admin fallback allowed.", e);
      }
    };
    
    fetchPresentDays();
  }, [form.faculty_id, form.month_year, editingRecord]);

  const showSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 5000);
  };

  // ── Create salary ─────────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.faculty_id || !form.basic_salary) {
      setFormError("Faculty and Basic Salary are required.");
      return;
    }
    if (parseFloat(form.basic_salary) <= 0) {
      setFormError("Basic salary must be greater than 0.");
      return;
    }
    if (parseInt(form.present_days) > parseInt(form.working_days)) {
      setFormError("Present days cannot exceed working days.");
      return;
    }
    try {
      const payload = {
        ...form,
        basic_salary:  parseFloat(form.basic_salary),
        allowances:    parseFloat(form.allowances  || 0),
        deductions:    parseFloat(form.deductions  || 0),
        advance_paid:  parseFloat(form.advance_paid|| 0),
        working_days:  parseInt(form.working_days  || 26),
        present_days:  parseInt(form.present_days  || 26)
      };

      if (editingRecord) {
        await api.put(`/salary/${editingRecord.id}`, payload);
        showSuccess("✅ Salary record updated successfully!");
      } else {
        await api.post("/salary", payload);
        showSuccess("✅ Salary record created successfully!");
      }

      setShowCreateModal(false);
      setEditingRecord(null);
      setForm(emptyForm);
      await loadData();
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to save salary record.");
    }
  };

  // ── Mark as paid ──────────────────────────────────────────────────────────
  const handlePay = async (e) => {
    e.preventDefault();
    setFormError("");
    try {
      await api.put(`/salary/${payingRecord.id}/pay`, payForm);
      setShowPayModal(false);
      setPayingRecord(null);
      showSuccess("✅ Salary marked as paid!");
      await loadData();
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to mark salary as paid.");
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this salary record?")) return;
    try {
      await api.delete(`/salary/${id}`);
      showSuccess("🗑️ Salary record deleted.");
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || "Cannot delete this record.");
    }
  };

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!canRead) {
    return (
      <div className="students-container">
        <div style={{
          textAlign: "center", padding: "4rem 2rem",
          background: "rgba(239,68,68,0.06)", border: "2px dashed rgba(239,68,68,0.4)",
          borderRadius: 16, maxWidth: 480, margin: "4rem auto"
        }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>
          <h2 style={{ color: "#ef4444" }}>Access Restricted</h2>
          <p style={{ color: "var(--text-secondary)" }}>Salary management is only available to Admin users and authorized managers.</p>
          <Link to="/admin/dashboard" className="btn btn-secondary" style={{ marginTop: "1.5rem" }}>← Back</Link>
        </div>
      </div>
    );
  }

  const monthLabel = monthFilter
    ? new Date(monthFilter + "-01").toLocaleString("default", { month: "long", year: "numeric" })
    : "All Months";

  const filteredSalaries = salaries.filter(s => {
    const facName = s.Faculty?.User?.name || "Unknown";
    return facName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleDownload = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Faculty,Month,Basic,Allowances,Deductions,Net Salary,Status\n"
      + filteredSalaries.map(s => {
          const facName = s.Faculty?.User?.name || "Unknown";
          return `${facName},${s.month_year},${s.basic_salary},${s.allowances},${s.deductions},${s.net_salary},${s.status}`;
      }).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `salary_records_${monthFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="students-container">

      {/* ── Header ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ background: "#f3e8ff", color: "#7e22ce", width: "48px", height: "48px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", flexShrink: 0 }}>💼</div>
            <div>
              <h1 style={{ margin: 0, fontSize: "1.8rem", color: "#111827", fontWeight: "800" }}>Faculty Salary Management</h1>
              <p style={{ margin: 0, color: "#6b7280", fontSize: "0.95rem", marginTop: "2px" }}>Manage monthly salary records, attendance-based calculations, and payment tracking.</p>
            </div>
          </div>
        </div>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div className="st-breadcrumbs" style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span>Dashboard</span>
              <span>›</span>
              <span style={{ color: '#0f172a', fontWeight: '500' }}>Faculty Salary Management</span>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none" }}>📅</span>
              <input
                type="month"
                value={monthFilter}
                onChange={e => setMonthFilter(e.target.value)}
                style={{ padding: "0.6rem 2.5rem 0.6rem 1rem", fontSize: "0.95rem", borderRadius: "8px", border: "1px solid #e5e7eb", outline: "none", color: "#374151" }}
              />
            </div>
            {canCreate && (
              <button
                onClick={() => { setEditingRecord(null); setForm({ ...emptyForm, month_year: monthFilter }); setFormError(""); setShowCreateModal(true); }}
                style={{ padding: "0.6rem 1.25rem", borderRadius: "8px", border: "none", background: "#7e22ce", color: "#fff", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", boxShadow: "0 4px 6px rgba(126,34,206,0.2)" }}
              >
                + Add Salary Record
              </button>
            )}
            <Link to="/admin/finance" style={{ padding: "0.6rem 1.25rem", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#fff", color: "#374151", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", textDecoration: "none" }}>📊 Finance Dashboard</Link>
            <Link to="/admin/dashboard" style={{ padding: "0.6rem 1.25rem", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#fff", color: "#374151", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", textDecoration: "none" }}>← Back</Link>
          </div>
        </div>
      </div>

      {/* ── Success banner ── */}
      {success && (
        <div style={{
          background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.4)",
          borderRadius: 10, padding: "0.85rem 1.25rem", marginBottom: "1.25rem",
          color: "#10b981", fontWeight: 600
        }}>
          {success}
        </div>
      )}

      {/* ── KPI Summary ── */}
      {summaryStats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.25rem", marginBottom: "2rem" }}>
          {[
            { icon: "📄", label: "Total Records", value: salaries.length, isNum: true, bg: "#f3e8ff", color: "#7e22ce" },
            { icon: "✅", label: "Paid", value: summaryStats.paidCount, isNum: true, bg: "#d1fae5", color: "#10b981" },
            { icon: "⏳", label: "Pending", value: summaryStats.pendingCount, isNum: true, bg: "#fef3c7", color: "#f59e0b" },
            { icon: "👝", label: "Total Salary Paid", value: summaryStats.paidTotal, isNum: false, bg: "#e0e7ff", color: "#4f46e5" },
            { icon: "📈", label: "Total Payroll", value: summaryStats.total, isNum: false, bg: "#dbeafe", color: "#3b82f6" },
          ].map((s, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: "12px", padding: "1.25rem", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: "1rem", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: s.bg, color: s.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", flexShrink: 0 }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: s.isNum ? "1.5rem" : "1.1rem", fontWeight: "800", color: s.color }}>
                  {s.isNum ? s.value : formatRupee(s.value)}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#374151", fontWeight: "600", marginTop: "2px" }}>{s.label}</div>
                <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: "2px" }}>This Month</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Table of salary records ── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>
          Loading salary records for {monthLabel}...
        </div>
      ) : salaries.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "4rem 2rem",
          border: "2px dashed var(--border-color)", borderRadius: 16
        }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>💼</div>
          <h3>No salary records for {monthLabel}</h3>
          <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
            Create salary records for faculty members to get started.
          </p>
          {canCreate && (
            <button
              className="btn btn-primary"
              onClick={() => { setEditingRecord(null); setForm({ ...emptyForm, month_year: monthFilter }); setFormError(""); setShowCreateModal(true); }}
              style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)", border: "none" }}
            >
              + Add First Salary Record
            </button>
          )}
        </div>
      ) : (
        <>
        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", overflow: "hidden", marginBottom: "1.5rem" }}>
          {/* Table Header inside the card */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem", borderBottom: "1px solid #e5e7eb" }}>
             <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "#111827", fontWeight: "700", fontSize: "1.1rem" }}>
                 <span style={{ color: "#7e22ce" }}>📄</span> Salary Records
             </div>
             <div style={{ display: "flex", gap: "0.75rem" }}>
                 <div style={{ position: "relative", width: "240px" }}>
                     <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}>🔍</span>
                     <input type="text" placeholder="Search by faculty name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: "100%", padding: "0.5rem 1rem 0.5rem 2.5rem", borderRadius: "8px", border: "1px solid #e5e7eb", outline: "none", fontSize: "0.9rem" }} />
                 </div>
                 <button style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#fff", color: "#374151", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
                     <span>⚗️</span> Filter
                 </button>
                 <button onClick={handleDownload} style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#fff", color: "#374151", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                     📥
                 </button>
             </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontSize: "0.75rem", fontWeight: "700", textTransform: "uppercase" }}>
                <tr>
                  <th style={{ padding: "1rem 1.5rem" }}>FACULTY</th>
                  <th style={{ padding: "1rem 1.5rem" }}>MONTH</th>
                  <th style={{ padding: "1rem 1.5rem" }}>BASIC SALARY</th>
                  <th style={{ padding: "1rem 1.5rem" }}>ALLOWANCES</th>
                  <th style={{ padding: "1rem 1.5rem" }}>DEDUCTIONS</th>
                  <th style={{ padding: "1rem 1.5rem" }}>NET SALARY</th>
                  <th style={{ padding: "1rem 1.5rem" }}>ATTENDANCE</th>
                  <th style={{ padding: "1rem 1.5rem" }}>STATUS</th>
                  <th style={{ padding: "1rem 1.5rem" }}>PAYMENT</th>
                  <th style={{ padding: "1rem 1.5rem", textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredSalaries.map(s => {
                  const facName = s.Faculty?.User?.name || "Unknown";
                  const initials = facName.split(" ").map(n => n[0]).join("").substring(0,2).toUpperCase();
                  return (
                  <tr key={s.id} style={{ borderBottom: "1px solid #e5e7eb", transition: "background 0.2s" }} onMouseOver={e=>e.currentTarget.style.background="#f9fafb"} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{ padding: "1.25rem 1.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#f3e8ff", color: "#7e22ce", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", fontWeight: "700" }}>{initials}</div>
                          <div>
                              <div style={{ color: "#111827", fontWeight: "600", fontSize: "0.95rem" }}>{facName}</div>
                              <div style={{ color: "#6b7280", fontSize: "0.8rem" }}>{s.Faculty?.User?.email}</div>
                              <div style={{ color: "#9ca3af", fontSize: "0.75rem", marginTop: "2px" }}>Emp ID: {s.Faculty?.emp_id || "N/A"}</div>
                          </div>
                      </div>
                    </td>
                    <td style={{ padding: "1.25rem 1.5rem", color: "#374151", fontSize: "0.9rem", fontWeight: "500" }}>{new Date(s.month_year + "-01").toLocaleString("default", { month: "short", year: "numeric" })}</td>
                    <td style={{ padding: "1.25rem 1.5rem", color: "#111827", fontWeight: "600", fontSize: "0.95rem" }}>{formatRupee(s.basic_salary)}</td>
                    <td style={{ padding: "1.25rem 1.5rem" }}>
                        <div style={{ color: "#10b981", fontWeight: "600", fontSize: "0.9rem" }}>+{formatRupee(s.allowances)}</div>
                        <div style={{ color: "#6b7280", fontSize: "0.75rem", marginTop: "2px" }}>({s.allowances > 0 ? "1 or more" : "0"} Allowances)</div>
                    </td>
                    <td style={{ padding: "1.25rem 1.5rem" }}>
                        <div style={{ color: "#ef4444", fontWeight: "600", fontSize: "0.9rem" }}>-{formatRupee(s.deductions)}</div>
                        <div style={{ color: "#6b7280", fontSize: "0.75rem", marginTop: "2px" }}>({s.deductions > 0 ? "1 or more" : "0"} Deduction)</div>
                    </td>
                    <td style={{ padding: "1.25rem 1.5rem", color: "#7e22ce", fontWeight: "800", fontSize: "1rem" }}>{formatRupee(s.net_salary)}</td>
                    <td style={{ padding: "1.25rem 1.5rem" }}>
                      <div style={{ background: "#eff6ff", color: "#3b82f6", padding: "0.35rem 0.75rem", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "600", display: "inline-block", marginBottom: "4px" }}>
                        {s.present_days} / {s.working_days} days
                      </div>
                      <div style={{ color: "#6b7280", fontSize: "0.75rem", fontWeight: "600" }}>
                        {((s.present_days / (s.working_days || 1)) * 100).toFixed(2)}%
                      </div>
                    </td>
                    <td style={{ padding: "1.25rem 1.5rem" }}><SalaryBadge status={s.status} /></td>
                    <td style={{ padding: "1.25rem 1.5rem", fontSize: "0.85rem", color: "#4b5563" }}>
                      {s.payment_date ? (
                        <>
                          <div style={{ fontWeight: "600", color: "#111827" }}>{new Date(s.payment_date).toLocaleDateString("en-GB")}</div>
                          <div style={{ textTransform: "capitalize" }}>{s.payment_method?.replace("_", " ")}</div>
                          <div style={{ color: "#10b981", fontWeight: "600", fontSize: "0.75rem", marginTop: "2px" }}>Paid by {s.paidBy?.name || "IT Hub"}</div>
                        </>
                      ) : (
                          <div style={{ color: "#9ca3af" }}>—</div>
                      )}
                    </td>
                    <td style={{ padding: "1.25rem 1.5rem", textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                        {s.status !== "paid" && canUpdate && (
                          <button
                            style={{ padding: "0.4rem 0.75rem", borderRadius: "6px", background: "#10b981", color: "#fff", border: "none", cursor: "pointer", fontSize: "0.85rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.25rem", boxShadow: "0 2px 4px rgba(16,185,129,0.2)" }}
                            onClick={() => {
                              setPayingRecord(s);
                              setPayForm({ payment_method: "bank_transfer", transaction_ref: "" });
                              setFormError("");
                              setShowPayModal(true);
                            }}
                          >
                            💰 Pay
                          </button>
                        )}
                        {canUpdate && (
                          <button
                            style={{ padding: "0.4rem 0.75rem", borderRadius: "6px", border: "1px solid #e5e7eb", background: "#f9fafb", color: "#374151", cursor: "pointer", fontSize: "0.85rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.25rem" }}
                            onClick={() => {
                              setForm({
                                faculty_id: s.faculty_id, month_year: s.month_year, basic_salary: s.basic_salary, allowances: s.allowances, deductions: s.deductions, advance_paid: s.advance_paid, working_days: s.working_days, present_days: s.present_days, remarks: s.remarks || ""
                              });
                              setEditingRecord(s); setFormError(""); setShowCreateModal(true);
                            }}
                          >
                            ✏️
                          </button>
                        )}
                        {canDelete && (
                          <button
                            style={{ padding: "0.4rem 0.75rem", borderRadius: "6px", border: "1px solid #fee2e2", background: "#fef2f2", color: "#ef4444", cursor: "pointer", fontSize: "0.85rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.25rem" }}
                            onClick={() => handleDelete(s.id)}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
          {/* Pagination Footer */}
          <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff" }}>
              <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>
                  Showing 1 to {filteredSalaries.length} of {filteredSalaries.length} records
              </div>
              <div style={{ display: "flex", gap: "0.25rem" }}>
                  <button style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#fff", color: "#9ca3af", cursor: "pointer" }}>&lt;</button>
                  <button style={{ width: "32px", height: "32px", borderRadius: "8px", border: "none", background: "#f3e8ff", color: "#7e22ce", cursor: "pointer", fontWeight: "600" }}>1</button>
                  <button style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#fff", color: "#9ca3af", cursor: "pointer" }}>&gt;</button>
              </div>
          </div>
        </div>
        
        {/* Alert Box at the bottom */}
        <div style={{ background: "#eff6ff", borderRadius: "8px", padding: "1rem 1.5rem", display: "flex", gap: "0.75rem", alignItems: "center", border: "1px solid #bfdbfe" }}>
            <div style={{ background: "#3b82f6", color: "#fff", width: "24px", height: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", fontWeight: "bold", flexShrink: 0 }}>i</div>
            <div style={{ color: "#1e40af", fontSize: "0.9rem" }}>
                Salaries are calculated based on attendance and configured allowances & deductions.
            </div>
        </div>
        </>
      )}

      {/* ═════════════════════ CREATE SALARY MODAL ══════════════════════ */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 560 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.2rem" }}>
                {editingRecord ? "✏️ Edit Salary Record" : "➕ Create Salary Record"}
              </h2>
              <button onClick={() => setShowCreateModal(false)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "var(--text-secondary)" }}>✕</button>
            </div>

            {formError && (
              <div style={{
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)",
                borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem",
                color: "#ef4444", fontSize: 14
              }}>
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleCreate} className="form-grid">
              <div className="form-group">
                <label className="form-label">Faculty *</label>
                <select className="form-select" value={form.faculty_id} onChange={e => setForm({ ...form, faculty_id: e.target.value })} required>
                  <option value="">— Select Faculty —</option>
                  {faculty.map(f => (
                    <option key={f.id} value={f.id}>{f.User?.name || f.name} ({f.User?.email})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Month *</label>
                <input type="month" className="form-input" value={form.month_year}
                  onChange={e => setForm({ ...form, month_year: e.target.value })} required />
              </div>

              <div className="form-group">
                <label className="form-label">Basic Salary (₹) *</label>
                <input type="number" className="form-input" value={form.basic_salary}
                  onChange={e => setForm({ ...form, basic_salary: e.target.value })}
                  placeholder="e.g. 25000" min="1" step="0.01" required />
              </div>

              <div className="form-group">
                <label className="form-label">Allowances (₹)</label>
                <input type="number" className="form-input" value={form.allowances}
                  onChange={e => setForm({ ...form, allowances: e.target.value })}
                  placeholder="HRA, Travel, etc." min="0" step="0.01" />
              </div>

              <div className="form-group">
                <label className="form-label">Deductions (₹)</label>
                <input type="number" className="form-input" value={form.deductions}
                  onChange={e => setForm({ ...form, deductions: e.target.value })}
                  placeholder="PF, Tax, etc." min="0" step="0.01" />
              </div>

              <div className="form-group">
                <label className="form-label">Advance Paid (₹)</label>
                <input type="number" className="form-input" value={form.advance_paid}
                  onChange={e => setForm({ ...form, advance_paid: e.target.value })}
                  placeholder="Prior advance amount" min="0" step="0.01" />
              </div>

              <div className="form-group">
                <label className="form-label">Working Days</label>
                <input type="number" className="form-input" value={form.working_days}
                  onChange={e => setForm({ ...form, working_days: e.target.value })}
                  min="1" max="31" />
              </div>

              <div className="form-group">
                <label className="form-label">Present Days</label>
                <input type="number" className="form-input" value={form.present_days}
                  onChange={e => setForm({ ...form, present_days: e.target.value })}
                  min="0" max={form.working_days || 31} />
              </div>

              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Remarks (Optional)</label>
                <textarea className="form-input" value={form.remarks}
                  onChange={e => setForm({ ...form, remarks: e.target.value })}
                  rows={2} placeholder="Any notes about this salary..." />
              </div>

              {/* Net Salary Preview */}
              {netPreview !== null && (
                <div style={{
                  gridColumn: "1 / -1",
                  background: netPreview >= 0 ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                  border: `1px solid ${netPreview >= 0 ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                  borderRadius: 10, padding: "0.75rem 1rem",
                  display: "flex", alignItems: "center", gap: "0.75rem"
                }}>
                  <span style={{ fontSize: "1.4rem" }}>🧮</span>
                  <div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>Net Salary Preview</div>
                    <div style={{ fontWeight: 800, fontSize: 22, color: netPreview >= 0 ? "#10b981" : "#ef4444" }}>
                      {formatRupee(netPreview)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                      Basic × (Present/Working) + Allowances − Deductions − Advance
                    </div>
                  </div>
                </div>
              )}

              <div className="form-actions" style={{ gridColumn: "1 / -1", marginTop: "0.5rem", paddingTop: "1rem", borderTop: "1px solid var(--border-color)" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary"
                  style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)", border: "none" }}>
                  {editingRecord ? "💾 Save Changes" : "💾 Create Salary Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════ PAY SALARY MODAL ══════════════════════ */}
      {showPayModal && payingRecord && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.2rem" }}>💰 Mark Salary as Paid</h2>
              <button onClick={() => setShowPayModal(false)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "var(--text-secondary)" }}>✕</button>
            </div>

            {/* Summary */}
            <div style={{
              background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)",
              borderRadius: 12, padding: "1rem 1.25rem", marginBottom: "1.5rem"
            }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>Confirming payment for:</div>
              <div style={{ fontWeight: 700, fontSize: "1rem" }}>{payingRecord.Faculty?.User?.name}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{payingRecord.month_year}</div>
              <div style={{ fontWeight: 800, fontSize: 22, color: "#10b981", marginTop: 6 }}>
                {formatRupee(payingRecord.net_salary)}
              </div>
            </div>

            {formError && (
              <div style={{
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)",
                borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem",
                color: "#ef4444", fontSize: 14
              }}>
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handlePay}>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label className="form-label">Payment Method *</label>
                <select className="form-select" value={payForm.payment_method}
                  onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })}>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              {(payForm.payment_method === "upi" || payForm.payment_method === "bank_transfer") && (
                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label">Transaction Reference</label>
                  <input type="text" className="form-input" value={payForm.transaction_ref}
                    onChange={e => setPayForm({ ...payForm, transaction_ref: e.target.value })}
                    placeholder="UTR / Transaction ID / Cheque No." />
                </div>
              )}

              <div className="form-actions" style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border-color)" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPayModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary"
                  style={{ background: "linear-gradient(135deg,#10b981,#059669)", border: "none" }}>
                  ✅ Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default FacultySalaryPage;
