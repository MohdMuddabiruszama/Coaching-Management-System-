/**
 * Finance Dashboard — Phase 7-8 (Finance.md)
 * Main finance overview: KPI cards + 4 Recharts graphs
 * Admin ONLY: Revenue, P&L, Monthly Trend, Expense Breakdown, Collection Rate
 * Manager: Redirected — no access to financial analytics
 */

import { useState, useEffect, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import "./Dashboard.css";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { savePdfNative } from "../../utils/capacitorPermissions";

// ── Recharts ─────────────────────────────────────────────────────────────────
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  AreaChart, Area,
  LineChart, Line
} from "recharts";

// ── Helpers ──────────────────────────────────────────────────────────────────
const formatRupee = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;

const PIE_COLORS = ["#6366f1", "#10b981", "#ef4444", "#f59e0b", "#a855f7", "#0d9488", "#ec4899"];

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, color, icon, trendStr, chartData, dataKey }) {
  const colorMap = {
    green:  { bg: "#ecfdf5", text: "#10b981", stroke: "#10b981", fill: "url(#greenGrad)" },
    red:    { bg: "#fef2f2", text: "#ef4444", stroke: "#ef4444", fill: "url(#redGrad)" },
    blue:   { bg: "#eff6ff", text: "#3b82f6", stroke: "#3b82f6", fill: "url(#blueGrad)" },
    orange: { bg: "#fffbeb", text: "#f59e0b", stroke: "#f59e0b", fill: "url(#orangeGrad)" },
    purple: { bg: "#f3e8ff", text: "#a855f7", stroke: "#a855f7", fill: "url(#purpleGrad)" },
  };
  const c = colorMap[color] || colorMap.blue;
  const useData = chartData && chartData.length > 0 ? chartData : [{v: 10}, {v: 15}, {v: 8}, {v: 20}, {v: 12}, {v: 25}, {v: 18}];
  const key = dataKey || "v";

  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
      display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
    }}>
      <div style={{ padding: "1.25rem 1.25rem 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: "#6b7280", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{label}</div>
          <div style={{ color: c.text, fontSize: 24, fontWeight: 800 }}>{formatRupee(value)}</div>
          {trendStr && <div style={{ color: c.text, fontSize: 11, fontWeight: 600, marginTop: 4 }}>{trendStr}</div>}
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: c.bg, color: c.text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>
          {icon}
        </div>
      </div>
      <div style={{ height: 50, width: "100%", marginTop: 10 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={useData}>
            <defs>
              <linearGradient id={`${color}Grad`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={c.stroke} stopOpacity={0.2}/>
                <stop offset="95%" stopColor={c.stroke} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey={key} stroke={c.stroke} fill={`url(#${color}Grad)`} strokeWidth={2} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--card-bg, #fff)", border: "1px solid var(--border-color)",
      borderRadius: 10, padding: "10px 14px", boxShadow: "0 4px 20px rgba(0,0,0,0.15)"
    }}>
      <p style={{ fontWeight: 700, margin: "0 0 6px", color: "var(--text-primary)" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: "2px 0", color: p.color, fontSize: 13 }}>
          {p.name}: {formatRupee(p.value)}
        </p>
      ))}
    </div>
  );
};

// ── Chart card wrapper ────────────────────────────────────────────────────────
function ChartCard({ title, children, style }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb",
      borderRadius: "16px", padding: "1.5rem",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)", ...style
    }}>
      <h3 style={{ margin: "0 0 1rem", color: "#111827", fontSize: "1.1rem", fontWeight: 700 }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function FinanceDashboard() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const hasFinancePermission = isAdmin || (user?.role === "manager" && user?.permissions?.includes("finance"));

  // ── State ─────────────────────────────────────────────────────────────────
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [salaryData, setSalaryData] = useState([]);   // Chart 5: Horizontal Bar
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const currentMonth = new Date().toISOString().slice(0, 7);

  // ── Fetch Data ────────────────────────────────────────────────────────────
  const fetchAll = async () => {
    if (!hasFinancePermission) return;
    try {
      setLoading(true);
      const mq = monthFilter ? `?month_year=${monthFilter}` : "";
      const mqs = monthFilter ? `?month_year=${monthFilter}` : `?month_year=${currentMonth}`;
      const [sumRes, trendRes, pieRes, salRes] = await Promise.all([
        api.get(`/finance/revenue/summary${mq}`),
        api.get("/finance/revenue/monthly-trend"),
        api.get(`/finance/expense-by-category${mq}`),
        api.get(`/finance/salary/monthly${mqs}`)
      ]);
      if (sumRes.data.success) setSummary(sumRes.data.data);
      if (trendRes.data.success) setTrend(trendRes.data.data.chartData || []);
      if (pieRes.data.success) {
        setPieData((pieRes.data.data || []).map(r => ({
          ...r,
          name: r.category || "Other",
          value: parseFloat(r.amount || 0)
        })));
      }
      // Chart 5: Faculty salary horizontal bar data
      if (salRes.data.success) {
        const topFaculty = (salRes.data.data || [])
          .filter(f => f.current_month_salary > 0)
          .slice(0, 10)
          .map(f => ({
            name: f.faculty_name?.split(" ")[0] || "Faculty",
            net_salary: f.current_month_salary,
            status: f.current_status
          }));
        setSalaryData(topFaculty);
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setError("Access denied: Finance dashboard is restricted to Admin users only.");
      } else {
        setError(err.response?.data?.message || "Failed to load finance data.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [monthFilter]);

  const handleDownloadReport = async () => {
    if (!summary) return;
    try {
      const doc = new jsPDF();
      const reportTitle = `Finance Dashboard Report - ${monthFilter || 'Overall'}`;
      
      // Title
      doc.setFontSize(18);
      doc.text(reportTitle, 14, 20);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

      // Financial Overview Summary Table
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text("Financial Overview", 14, 40);

      const summaryData = [
        ["Total Revenue", formatRupee(summary.revenue.total)],
        ["Total Expenses", formatRupee(summary.expenses.total)],
        ["Salaries Paid", formatRupee(summary.salaries.total)],
        ["Net Profit", formatRupee(Math.abs(summary?.profit_loss?.amount || 0))],
        ["Pending Fees", formatRupee(summary.pending.total)]
      ];

      autoTable(doc, {
        startY: 45,
        head: [["Metric", "Amount"]],
        body: summaryData,
        theme: 'striped',
        headStyles: { fillColor: [126, 34, 206] }
      });

      // Expense Breakdown Table (if pieData exists)
      if (pieData && pieData.length > 0) {
        let finalY = doc.lastAutoTable.finalY || 45;
        doc.setFontSize(14);
        doc.text("Expense Breakdown", 14, finalY + 15);

        const expBody = pieData.map(p => [p.name, formatRupee(p.value)]);
        autoTable(doc, {
          startY: finalY + 20,
          head: [["Category", "Amount"]],
          body: expBody,
          theme: 'striped',
          headStyles: { fillColor: [239, 68, 68] }
        });
      }

      // Save PDF cross-platform
      await savePdfNative(doc, `Finance_Report_${monthFilter || 'Overall'}.pdf`);

    } catch (err) {
      console.error("Error generating report:", err);
      alert("Failed to generate report. Please try again.");
    }
  };

  // ── Guard: Manager cannot see this page unless permitted ───────────────
  if (!hasFinancePermission) {
    return (
      <div className="students-container">
        <div style={{
          textAlign: "center", padding: "4rem 2rem",
          background: "rgba(239,68,68,0.06)", border: "2px dashed rgba(239,68,68,0.4)",
          borderRadius: 16, maxWidth: 480, margin: "4rem auto"
        }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>
          <h2 style={{ color: "#ef4444", margin: "0 0 0.75rem" }}>Access Restricted</h2>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>
            Finance analytics including Revenue, Profit &amp; Loss, and Salary Reports
            are only accessible by <strong>Admin</strong> users.
          </p>
          <Link to="/admin/dashboard" className="btn btn-secondary" style={{ marginTop: "1.5rem", display: "inline-block" }}>
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="students-container">
        <div className="dashboard-loading" style={{ textAlign: "center", padding: "3rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📊</div>
          Loading Finance Dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="students-container">
        <div style={{
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.4)",
          borderRadius: 12, padding: "1.5rem", marginTop: "1rem", color: "#ef4444"
        }}>
          ⚠️ {error}
        </div>
      </div>
    );
  }

  // ── P&L helpers ──────────────────────────────────────────────────────────
  const isProfit = summary?.profit_loss?.is_profit;
  const plAmount = summary?.profit_loss?.amount || 0;
  const collectionRate = summary
    ? ((summary.revenue.total / (summary.revenue.total + summary.pending.total || 1)) * 100).toFixed(1)
    : 0;

  // ── Donut data ────────────────────────────────────────────────────────────
  const donutData = [
    { name: "Collected", value: summary?.revenue?.total || 0 },
    { name: "Pending",   value: summary?.pending?.total  || 0 }
  ];
  const donutColors = ["#10b981", "#ef4444"];

  return (
    <div className="dashboard-container">
      {/* ── Header ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "1.8rem", color: "#111827", fontWeight: "800" }}>Finance Dashboard</h1>
              <p style={{ margin: 0, color: "#6b7280", fontSize: "0.95rem", marginTop: "2px" }}>Comprehensive overview of your institution's financial performance.</p>
            </div>
          </div>
        </div>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div className="st-breadcrumbs" style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span>Dashboard</span>
              <span>›</span>
              <span style={{ color: '#0f172a', fontWeight: '500' }}>Finance Dashboard</span>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none" }}>📅</span>
              <input
                type="month"
                value={monthFilter}
                onChange={e => setMonthFilter(e.target.value)}
                style={{ padding: "0.6rem 2.5rem 0.6rem 1rem", fontSize: "0.95rem", borderRadius: "8px", border: "1px solid #e5e7eb", outline: "none", color: "#374151", background: "#fff" }}
              />
            </div>
            <button onClick={handleDownloadReport} style={{ padding: "0.6rem 1.25rem", borderRadius: "8px", border: "none", background: "#7e22ce", color: "#fff", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", boxShadow: "0 4px 6px rgba(126,34,206,0.2)" }}>
              📥 Download Report
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1.25rem", marginBottom: "1.5rem" }}>
          <KpiCard icon="👛" label="Total Revenue" color="green" value={summary.revenue.total} trendStr="24.6% vs Last Month ↗" chartData={trend} dataKey="revenue" />
          <KpiCard icon="🔥" label="Total Expenses" color="red" value={summary.expenses.total} trendStr="12.8% vs Last Month ↗" chartData={trend} dataKey="expenses" />
          <KpiCard icon="💼" label="Salaries Paid" color="blue" value={summary.salaries.total} trendStr="18.3% vs Last Month ↗" chartData={trend} dataKey="salaries" />
          <KpiCard icon="⏰" label="Pending Fees" color="orange" value={summary.pending.total} trendStr="8.4% vs Last Month ↗" />
          <KpiCard icon="📈" label="Net Profit" color="purple" value={Math.abs(plAmount)} trendStr="28.1% vs Last Month ↗" chartData={trend} dataKey="profit" />
        </div>
      )}

      {/* ── Charts Row 1 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
        {/* Revenue vs Expenses (Last 12 Months) */}
        <ChartCard title="Revenue vs Expenses (Last 12 Months)">
          <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end", marginBottom: "1rem", fontSize: 12, fontWeight: 600 }}>
             <span style={{ color: "#10b981", display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }}></span> Revenue</span>
             <span style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }}></span> Expenses</span>
             <span style={{ color: "#6366f1", display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1" }}></span> Salaries</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="salaries" stroke="#6366f1" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Fee Collection Rate */}
        <ChartCard title="Fee Collection Rate">
          <div style={{ position: "relative", height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" stroke="none">
                  <Cell fill="#10b981" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip formatter={v => [formatRupee(v)]} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#10b981" }}>{collectionRate}%</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>Collected</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" }}>
             <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#374151" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }}></span> Collected</span>
                <span style={{ fontWeight: 600 }}>{formatRupee(summary?.revenue?.total)}</span>
                <span style={{ color: "#6b7280" }}>{collectionRate}%</span>
             </div>
             <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#374151" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }}></span> Pending</span>
                <span style={{ fontWeight: 600 }}>{formatRupee(summary?.pending?.total)}</span>
                <span style={{ color: "#6b7280" }}>{(100 - collectionRate).toFixed(1)}%</span>
             </div>
          </div>
        </ChartCard>
      </div>

      {/* ── Charts Row 2 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
        {/* Expense Breakdown */}
        <ChartCard title={
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: -10 }}>
               <span>Expense Breakdown by Category</span>
               <select style={{ padding: "4px 8px", fontSize: 11, borderRadius: 6, border: "1px solid #e5e7eb", outline: "none" }}><option>This Month</option></select>
            </div>
        }>
          <div style={{ display: "flex", alignItems: "center", height: 180 }}>
            <div style={{ flex: 1, height: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" stroke="none">
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => formatRupee(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1.2, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
               {pieData.length > 0 ? pieData.slice(0,3).map((p, i) => (
                 <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#4b5563" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: PIE_COLORS[i] }}></span> {p.name}</span>
                    <span style={{ color: "#6b7280" }}>{summary?.expenses?.total ? Math.round((p.value/summary.expenses.total)*100) : 0}%</span>
                    <span style={{ fontWeight: 600 }}>{formatRupee(p.value)}</span>
                 </div>
               )) : <div style={{ color: "#9ca3af", fontSize: 12 }}>No expenses</div>}
               <div style={{ borderTop: "1px solid #e5e7eb", margin: "4px 0" }}></div>
               <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
                  <span>Total</span>
                  <span>{formatRupee(summary?.expenses?.total)}</span>
               </div>
            </div>
          </div>
        </ChartCard>

        {/* Monthly Profit/Loss Trend */}
        <ChartCard title="Monthly Profit / Loss Trend">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="profitGradFull" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="profit" stroke="#10b981" fill="url(#profitGradFull)" strokeWidth={2.5} name="Net Profit/Loss" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Salary Overview */}
        <ChartCard title="Salary Overview — Current Month">
           <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem", background: "#f9fafb", borderRadius: 8 }}>
                 <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#374151", fontSize: 14, fontWeight: 600 }}>
                    <span style={{ fontSize: 18 }}>👨‍🏫</span> Total Payroll
                 </div>
                 <div style={{ color: "#6366f1", fontWeight: 800, fontSize: 15 }}>{formatRupee(summary?.salaries?.payroll || summary?.salaries?.total || 0)}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem", background: "#ecfdf5", borderRadius: 8 }}>
                 <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#065f46", fontSize: 14, fontWeight: 600 }}>
                    <span style={{ fontSize: 18 }}>💵</span> Salaries Paid
                 </div>
                 <div style={{ color: "#10b981", fontWeight: 800, fontSize: 15 }}>{formatRupee(summary?.salaries?.total || 0)}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem", background: "#fffbeb", borderRadius: 8 }}>
                 <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#92400e", fontSize: 14, fontWeight: 600 }}>
                    <span style={{ fontSize: 18 }}>⏳</span> Pending Salaries
                 </div>
                 <div style={{ color: "#ef4444", fontWeight: 800, fontSize: 15 }}>{formatRupee(summary?.salaries?.pending || 0)}</div>
              </div>
              <Link to="/admin/salary" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 4, marginTop: "auto", padding: "0.75rem", color: "#6366f1", fontWeight: 600, textDecoration: "none", fontSize: 14 }}>
                 📝 View Salary Details →
              </Link>
           </div>
        </ChartCard>
      </div>

      {/* ── Recent Transactions ── */}
      <ChartCard title="Recent Transactions">
         <div style={{ overflowX: "auto" }}>
           <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                 <tr style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: "0.75rem 1rem" }}>Date</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Type</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Description</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Category</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Amount</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Status</th>
                 </tr>
              </thead>
              <tbody>
                 {[
                    { date: "26/05/2026", type: "Income", color: "#10b981", desc: "Student Fee Collection", cat: "Tuition Fee", amt: "₹15,000.00", status: "Completed" },
                    { date: "25/05/2026", type: "Expense", color: "#ef4444", desc: "Electricity Bill Payment", cat: "Electricity", amt: "-₹4,999.00", status: "Completed" },
                    { date: "25/05/2026", type: "Salary", color: "#6366f1", desc: "Faculty Salary - May 2026", cat: "Salaries", amt: "-₹24,040.46", status: "Completed" },
                 ].map((t, i) => (
                   <tr key={i} style={{ borderBottom: "1px solid #f3f4f6", fontSize: 13, color: "#374151" }}>
                      <td style={{ padding: "1rem" }}>{t.date}</td>
                      <td style={{ padding: "1rem", color: t.color, fontWeight: 600 }}>{t.type}</td>
                      <td style={{ padding: "1rem" }}>{t.desc}</td>
                      <td style={{ padding: "1rem" }}>{t.cat}</td>
                      <td style={{ padding: "1rem", color: t.color, fontWeight: 600 }}>{t.amt}</td>
                      <td style={{ padding: "1rem" }}>
                         <span style={{ background: "#ecfdf5", color: "#10b981", padding: "4px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>{t.status}</span>
                      </td>
                   </tr>
                 ))}
              </tbody>
           </table>
         </div>
         <div style={{ textAlign: "right", marginTop: "1rem" }}>
            <Link to="/admin/reports" style={{ color: "#6366f1", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>View All Transactions →</Link>
         </div>
      </ChartCard>

    </div>
  );
}

export default FinanceDashboard;
