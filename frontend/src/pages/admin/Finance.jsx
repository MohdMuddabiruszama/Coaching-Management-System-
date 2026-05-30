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
function KpiCard({ label, value, color, icon, sub }) {
  const colorMap = {
    green:  { bg: "rgba(16,185,129,0.08)",  text: "#10b981", border: "rgba(16,185,129,0.3)"  },
    red:    { bg: "rgba(239,68,68,0.08)",   text: "#ef4444", border: "rgba(239,68,68,0.3)"   },
    blue:   { bg: "rgba(99,102,241,0.08)",  text: "#6366f1", border: "rgba(99,102,241,0.3)"  },
    orange: { bg: "rgba(245,158,11,0.08)",  text: "#f59e0b", border: "rgba(245,158,11,0.3)"  },
    purple: { bg: "rgba(168,85,247,0.08)",  text: "#a855f7", border: "rgba(168,85,247,0.3)"  },
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 16, padding: "1.25rem 1.5rem",
      display: "flex", flexDirection: "column", gap: 6,
      transition: "transform 0.2s, box-shadow 0.2s"
    }}
      onMouseEnter={e => e.currentTarget.style.transform = "translateY(-3px)"}
      onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0, fontWeight: 500 }}>{label}</p>
        <span style={{ fontSize: "1.4rem" }}>{icon}</span>
      </div>
      <h2 style={{ color: c.text, margin: 0, fontSize: 26, fontWeight: 800, lineHeight: 1.2 }}>
        {formatRupee(value)}
      </h2>
      {sub && <p style={{ color: "var(--text-secondary)", fontSize: 12, margin: 0 }}>{sub}</p>}
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
      background: "var(--card-bg)", border: "1px solid var(--border-color)",
      borderRadius: 16, padding: "1.25rem 1.5rem",
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)", ...style
    }}>
      <h3 style={{ margin: "0 0 1rem", color: "var(--text-primary)", fontSize: "1rem", fontWeight: 700 }}>
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

  // ── Guard: Manager cannot see this page unless permitted ───────────────
  if (!hasFinancePermission) {
    return (
      <div className="dashboard-container">
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
      <div className="dashboard-container">
        <div className="dashboard-loading" style={{ textAlign: "center", padding: "3rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📊</div>
          Loading Finance Dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
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
      <div className="dashboard-header">
        <div>
          <h1>🏦 Finance Dashboard</h1>
          <p>Revenue, Profit &amp; Loss, Salaries, and Expense Analytics</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>Filter Month:</label>
            <input
              type="month"
              className="form-input"
              value={monthFilter}
              onChange={e => setMonthFilter(e.target.value)}
              style={{ padding: "0.4rem 0.75rem", fontSize: 14, borderRadius: 8 }}
            />
            {monthFilter && (
              <button
                onClick={() => setMonthFilter("")}
                className="btn btn-secondary"
                style={{ padding: "0.4rem 0.75rem", fontSize: 13 }}
              >✕ Clear</button>
            )}
          </div>
          <Link to="/admin/salary" className="btn btn-secondary" style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)", color: "#fff", border: "none" }}>
            💼 Salary Management
          </Link>
          <Link to="/admin/dashboard" className="btn btn-secondary">← Back</Link>
        </div>
      </div>

      {/* ── Month indicator ── */}
      {monthFilter && (
        <div style={{
          background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.3)",
          borderRadius: 10, padding: "0.6rem 1rem", marginBottom: "1rem",
          color: "#6366f1", fontSize: 14, fontWeight: 600
        }}>
          📅 Showing data for: {new Date(monthFilter + "-01").toLocaleString("default", { month: "long", year: "numeric" })}
        </div>
      )}

      {/* ── KPI Cards — 5 cards ── */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
          <KpiCard
            icon="💰" label="Total Revenue" color="green"
            value={summary.revenue.total}
            sub={`${collectionRate}% collection rate`}
          />
          <KpiCard
            icon="🔥" label="Operational Expenses" color="red"
            value={summary.expenses.total}
          />
          <KpiCard
            icon="👩‍🏫" label="Salaries Paid" color="blue"
            value={summary.salaries.total}
          />
          <KpiCard
            icon="⏰" label="Pending Fees" color="orange"
            value={summary.pending.total}
          />
          <KpiCard
            icon={isProfit ? "📈" : "📉"}
            label={isProfit ? "Net Profit" : "Net Loss"}
            color={isProfit ? "green" : "red"}
            value={Math.abs(plAmount)}
            sub={`Total Costs: ${formatRupee(summary.total_costs.total)}`}
          />
        </div>
      )}

      {/* ── Charts Row 1: Bar + Donut ── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>

        {/* Chart 1: Revenue vs Expenses Bar Chart */}
        <ChartCard title="📊 Revenue vs Expenses (Last 12 Months)">
          {trend.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📭</div>
              No financial data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={trend} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #f1f5f9)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue"    fill="#10b981" radius={[4,4,0,0]} name="Revenue"  />
                <Bar dataKey="expenses"   fill="#ef4444" radius={[4,4,0,0]} name="Expenses" />
                <Bar dataKey="salaries"   fill="#6366f1" radius={[4,4,0,0]} name="Salaries" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Chart 2: Fee Collection Rate Donut */}
        <ChartCard title="🎯 Fee Collection Rate">
          <div style={{ position: "relative" }}>
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie
                  data={donutData} cx="50%" cy="50%"
                  innerRadius={60} outerRadius={90}
                  dataKey="value" paddingAngle={3}
                >
                  {donutData.map((_, i) => <Cell key={i} fill={donutColors[i]} />)}
                </Pie>
                <Tooltip formatter={v => [formatRupee(v)]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -60%)", textAlign: "center",
              pointerEvents: "none"
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#10b981" }}>{collectionRate}%</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Collected</div>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* ── Charts Row 2: Area (P&L) + Pie (Expenses) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>

        {/* Chart 3: Profit / Loss Area Chart */}
        <ChartCard title="📈 Monthly Profit / Loss Trend">
          {trend.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="lossGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #f1f5f9)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone" dataKey="profit"
                  stroke="#10b981" fill="url(#profitGrad)"
                  strokeWidth={2} name="Net Profit/Loss"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Chart 4: Expense Breakdown Pie Chart */}
        <ChartCard title="💸 Expense Breakdown by Category">
          {pieData.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📭</div>
              No expense data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData} cx="50%" cy="50%" outerRadius={90}
                  dataKey="value" nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={true}
                >
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => [formatRupee(v), "Amount"]} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Revenue Line Chart (12-month) ── */}
      <ChartCard title="📉 Revenue Trend Line (Last 12 Months)" style={{ marginBottom: "1.5rem" }}>
        {trend.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color,#f1f5f9)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="revenue"  stroke="#10b981" strokeWidth={2.5} dot={false} name="Revenue"  />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2.5} dot={false} name="Expenses" />
              <Line type="monotone" dataKey="salaries" stroke="#6366f1" strokeWidth={2.5} dot={false} name="Salaries" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* ── Chart 5: Faculty Salary Horizontal Bar (from Finance.md spec) ── */}
      <ChartCard title="👩‍🏫 Faculty Salary Overview — Current Month" style={{ marginBottom: "1.5rem" }}>
        {salaryData.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📭</div>
            No salary records created yet for this month.
            <br />
            <Link to="/admin/salary" style={{ color: "#6366f1", fontWeight: 600, marginTop: 8, display: "inline-block" }}>+ Add Salary Records →</Link>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, salaryData.length * 44)}>
            <BarChart data={salaryData} layout="vertical" margin={{ top: 5, right: 40, left: 60, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color,#f1f5f9)" />
              <XAxis type="number" tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} width={55} />
              <Tooltip
                formatter={(v, n, p) => [
                  formatRupee(v),
                  p.payload.status === "paid" ? "✅ Net Salary (Paid)" : "⏳ Net Salary (Pending)"
                ]}
              />
              <Bar dataKey="net_salary" radius={[0,6,6,0]} name="Net Salary">
                {salaryData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.status === "paid" ? "#10b981" : "#6366f1"}
                    fillOpacity={entry.status === "paid" ? 1 : 0.7}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        {salaryData.length > 0 && (
          <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: "#10b981", display: "inline-block" }} />
              Paid
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: "#6366f1", display: "inline-block" }} />
              Pending
            </span>
            <Link to="/admin/salary" style={{ marginLeft: "auto", color: "#6366f1", fontWeight: 600 }}>View All Salaries →</Link>
          </div>
        )}
      </ChartCard>

      {/* ── Quick Links ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        {[
          { path: "/admin/fees",    icon: "💰", title: "Collect Fees",         sub: "Student fee collection & history" },
          { path: "/admin/salary",  icon: "💼", title: "Faculty Salary",       sub: "Monthly salary & pay slips" },
          { path: "/admin/expenses",icon: "💸", title: "Expenses & Transport", sub: "Operational expense tracking" },
        ].map(link => (
          <Link key={link.path} to={link.path} style={{ textDecoration: "none" }}>
            <div style={{
              background: "var(--card-bg)", border: "1px solid var(--border-color)",
              borderRadius: 14, padding: "1.25rem", cursor: "pointer",
              transition: "all 0.2s", boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"; }}
            >
              <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>{link.icon}</div>
              <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.25rem" }}>{link.title}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{link.sub}</div>
            </div>
          </Link>
        ))}
      </div>

    </div>
  );
}

export default FinanceDashboard;
