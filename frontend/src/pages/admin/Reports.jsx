/**
 * Reports & Analytics Page
 * Professional implementation with multiple report types
 */

import { useState, useEffect, useContext, useRef } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import "./Dashboard.css";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import AdminExpenses from "./Expenses";
import { savePdfNative } from "../../utils/capacitorPermissions";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

import { ResponsiveContainer, AreaChart, Area, PieChart, Pie as RechartsPie, Cell, LineChart, Line as RechartsLine, BarChart, Bar as RechartsBar, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Legend as RechartsLegend } from 'recharts';

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
  const formatRupee = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;

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

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const formatRupee = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;
  return (
    <div style={{
      background: "var(--card-bg, #fff)", border: "1px solid var(--border-color, #e5e7eb)",
      borderRadius: 10, padding: "10px 14px", boxShadow: "0 4px 20px rgba(0,0,0,0.15)"
    }}>
      <p style={{ fontWeight: 700, margin: "0 0 6px", color: "var(--text-primary, #111827)" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: "2px 0", color: p.color, fontSize: 13 }}>
          {p.name}: {formatRupee(p.value)}
        </p>
      ))}
    </div>
  );
};

function Reports() {
    const { user } = useContext(AuthContext);
    const isPro = user?.features?.reports === 'advanced';

    const financesRef = useRef(null);

    const [activeTab, setActiveTab] = useState("dashboard");
    const [dashboardData, setDashboardData] = useState(null);
    const [feesReport, setFeesReport] = useState(null);
    const [monthlyTrends, setMonthlyTrends] = useState(null);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [filters, setFilters] = useState({
        start_date: new Date(new Date().setDate(1)).toISOString().split('T')[0], // First day of month
        end_date: new Date().toISOString().split('T')[0],
        class_id: "",
        student_id: "",
        fee_type: ""
    });
    const [recordFilter, setRecordFilter] = useState('all'); // 'all', 'paid', 'pending'

    // Trends Filters
    const [trendsFilters, setTrendsFilters] = useState({
        dateRange: "01/01/2026 - 30/06/2026",
        compareWith: "No Comparison",
        view: "Monthly"
    });

    // Export Modal State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportType, setExportType] = useState(""); // 'PDF' or 'Excel'
    const [exportFilter, setExportFilter] = useState("all");

    useEffect(() => {
        fetchClasses();
        fetchDashboardData();
    }, []);

    useEffect(() => {
        if (activeTab === "fees") {
            fetchFeesReport();
        } else if (activeTab === "trends") {
            fetchMonthlyTrends();
        }
    }, [activeTab, filters]);

    const fetchClasses = async () => {
        try {
            const response = await api.get("/classes");
            setClasses(response.data.data || []);
        } catch (error) {
            console.error("Error fetching classes:", error);
        }
    };

    const [financeSummary, setFinanceSummary] = useState(null);
    const [financeTrend, setFinanceTrend] = useState([]);
    
    const [dashFilters, setDashFilters] = useState({
        month: new Date().toISOString().slice(0, 7), // YYYY-MM
        class_id: "",
        section: "",
        route: "",
        status: ""
    });

    const fetchDashboardData = async (monthOverride = null) => {
        setLoading(true);
        try {
            const currentMonth = monthOverride !== null ? monthOverride : dashFilters.month;
            const financeQuery = currentMonth ? `?month_year=${currentMonth}` : "";
            const [reportRes, sumRes, trendRes] = await Promise.all([
                api.get("/reports/dashboard"),
                api.get(`/finance/revenue/summary${financeQuery}`).catch(() => ({ data: { success: false } })),
                api.get("/finance/revenue/monthly-trend").catch(() => ({ data: { success: false } }))
            ]);
            if (reportRes.data.success) setDashboardData(reportRes.data.data);
            if (sumRes.data?.success) setFinanceSummary(sumRes.data.data);
            if (trendRes.data?.success) setFinanceTrend(trendRes.data.data.chartData || []);
        } catch (error) {
            console.error("Error fetching dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchFeesReport = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.start_date) params.append('start_date', filters.start_date);
            if (filters.end_date) params.append('end_date', filters.end_date);
            if (filters.class_id) params.append('class_id', filters.class_id);
            if (filters.fee_type) params.append('fee_type', filters.fee_type);

            const response = await api.get(`/reports/fees?${params}`);
            setFeesReport(response.data.data);
        } catch (error) {
            console.error("Error fetching fees report:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMonthlyTrends = async () => {
        setLoading(true);
        try {
            const monthsToFetch = isPro ? 6 : 3;
            const response = await api.get(`/reports/monthly-trends?months=${monthsToFetch}`);
            setMonthlyTrends(response.data.data);
        } catch (error) {
            console.error("Error fetching trends:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (key, value) => {
        const newFilters = { ...filters, [key]: value };

        if (!isPro && (key === 'start_date' || key === 'end_date')) {
            const start = new Date(newFilters.start_date);
            const end = new Date(newFilters.end_date);
            const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));

            if (diffDays > 90) {
                alert("✨ Upgrade to Pro plan to unlock unlimited date filters for analytics!");
                return; // Prevent state update
            }
        }

        setFilters(newFilters);
    };

    const handleExport = (type) => {
        if (!isPro) {
            alert(`✨ Upgrade to Pro plan to unlock Export to ${type} features!`);
            return;
        }

        if (activeTab === "fees") {
            if (!feesReport?.payments || feesReport.payments.length === 0) {
                // If there are pendings, we can still export pending ones
                if (!feesReport?.pending_students || feesReport.pending_students.length === 0) {
                    alert("No fees data to export.");
                    return;
                }
            }
        } else if (activeTab === "finances") {
            if (type === "PDF") {
                financesRef.current?.handleExportPDF();
            } else if (type === "Excel") {
                financesRef.current?.handleExportExcel();
            }
            return;
        } else {
            alert(`Exports are currently available for Fees and Finances reports.`);
            return;
        }

        // Open Modal
        setExportType(type);
        setExportFilter("all");
        setShowExportModal(true);
    };

    const generatePDF = async (title, columns, rows) => {
        const doc = new jsPDF();
        doc.text(title, 14, 15);
        autoTable(doc, {
            head: [columns],
            body: rows,
            startY: 20
        });
        await savePdfNative(doc, `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
    };

    const generateExcel = (title, columns, rows, sheetName) => {
        const worksheet = XLSX.utils.aoa_to_sheet([columns, ...rows]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        XLSX.writeFile(workbook, `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xlsx`);
    };

    const confirmExport = () => {
        if (activeTab === "fees") exportFees(exportType, exportFilter);
        setShowExportModal(false);
    };

    const exportFees = (type, filterStr) => {
        const title = `Fees Report (${filters.start_date} to ${filters.end_date}) - ${filterStr.toUpperCase()}`;
        
        let columns;
        let targetRows = [];

        if (filterStr === "paid") {
            columns = ["Roll Number", "Student Name", "Method", "Payment Date", "Paid Amount (INR)", "Status"];
            targetRows = feesReport.payments.map(r => [
                r.Student?.roll_number || "-",
                r.Student?.User?.name || "Unknown",
                r.payment_method?.toUpperCase() || "-",
                new Date(r.payment_date).toLocaleDateString(),
                r.amount_paid,
                "PAID"
            ]);
        } else if (filterStr === "pending") {
            columns = ["Roll Number", "Student Name", "Fee Type", "Due Date", "Reminder Date", "Pending Amount (INR)", "Status"];
            targetRows = feesReport.pending_students.map(r => [
                r.roll_number || "-",
                r.name || "Unknown",
                r.fee_type || "General Fee",
                r.due_date ? new Date(r.due_date).toLocaleDateString() : "-",
                r.reminder_date ? new Date(r.reminder_date).toLocaleDateString() : "-",
                r.pending_amount || 0,
                "PENDING"
            ]);
        } else {
            // "all"
            columns = ["Roll Number", "Student Name", "Type/Method", "Due/Payment Date", "Reminder Date", "Amount (INR)", "Status"];
            const paidRows = feesReport.payments.map(r => [
                r.Student?.roll_number || "-",
                r.Student?.User?.name || "Unknown",
                r.payment_method?.toUpperCase() || "PAYMENT",
                new Date(r.payment_date).toLocaleDateString(),
                "-",
                r.amount_paid,
                "PAID"
            ]);
            const pendingRows = feesReport.pending_students.map(r => [
                r.roll_number || "-",
                r.name || "Unknown",
                r.fee_type || "Pending Fee",
                r.due_date ? new Date(r.due_date).toLocaleDateString() : "-",
                r.reminder_date ? new Date(r.reminder_date).toLocaleDateString() : "-",
                r.pending_amount || 0,
                "PENDING"
            ]);
            targetRows = [...paidRows, ...pendingRows];
        }

        if (targetRows.length === 0) {
            alert(`No records found for the filter: ${filterStr}`);
            return;
        }

        if (type === "PDF") generatePDF(title, columns, targetRows);
        else if (type === "Excel") generateExcel(title, columns, targetRows, "Fees");
    };

    return (
        <div className="dashboard-container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{ background: "#fff", border: "1px solid #e5e7eb", color: "#374151", width: "40px", height: "40px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", flexShrink: 0 }}>
                    📊
                  </div>
                  <div>
                    <h1 style={{ margin: 0, fontSize: "1.8rem", color: "#111827", fontWeight: "800", display: "flex", alignItems: "center", gap: 8 }}>
                       Reports & Analytics {isPro ? <span style={{ fontSize: 10, background: '#f3e8ff', color: '#7e22ce', padding: '3px 8px', borderRadius: 12, verticalAlign: 'middle', fontWeight: 800 }}>PRO</span> : <span style={{ fontSize: 10, background: '#f3f4f6', color: '#6b7280', padding: '3px 8px', borderRadius: 12, verticalAlign: 'middle', fontWeight: 800 }}>BASIC</span>}
                    </h1>
                    <p style={{ margin: 0, color: "#6b7280", fontSize: "0.95rem", marginTop: "2px" }}>Comprehensive insights and performance metrics</p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={() => handleExport("PDF")} className="btn btn-secondary" style={{ color: "#ef4444", borderColor: "#e5e7eb", display: "flex", gap: 6, alignItems: "center", background: "#fff" }}>📄 Export PDF {isPro ? "" : "🔒"}</button>
                    <button onClick={() => handleExport("Excel")} className="btn btn-secondary" style={{ color: "#10b981", borderColor: "#e5e7eb", display: "flex", gap: 6, alignItems: "center", background: "#fff" }}>📊 Export Excel {isPro ? "" : "🔒"}</button>
                    <button className="btn btn-primary" style={{ background: "#7e22ce", borderColor: "#7e22ce", display: "flex", gap: 6, alignItems: "center" }}>⚡ Custom Report</button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '2rem', borderBottom: '2px solid #f3f4f6', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: 4 }}>
                <button
                    style={{ padding: '0.5rem 0', background: 'none', border: 'none', borderBottom: activeTab === 'dashboard' ? '2px solid #7e22ce' : '2px solid transparent', color: activeTab === 'dashboard' ? '#7e22ce' : '#6b7280', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                    onClick={() => setActiveTab("dashboard")}
                >
                    🎨 Dashboard
                </button>
                <button
                    style={{ padding: '0.5rem 0', background: 'none', border: 'none', borderBottom: activeTab === 'finances' ? '2px solid #7e22ce' : '2px solid transparent', color: activeTab === 'finances' ? '#7e22ce' : '#6b7280', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                    onClick={() => setActiveTab("finances")}
                >
                    📈 Finances & Transport
                </button>
                <button
                    style={{ padding: '0.5rem 0', background: 'none', border: 'none', borderBottom: activeTab === 'fees' ? '2px solid #7e22ce' : '2px solid transparent', color: activeTab === 'fees' ? '#7e22ce' : '#6b7280', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                    onClick={() => setActiveTab("fees")}
                >
                    💰 Fees Report
                </button>
                <button
                    style={{ padding: '0.5rem 0', background: 'none', border: 'none', borderBottom: activeTab === 'trends' ? '2px solid #7e22ce' : '2px solid transparent', color: activeTab === 'trends' ? '#7e22ce' : '#6b7280', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                    onClick={() => setActiveTab("trends")}
                >
                    📊 Monthly Trends
                </button>

            </div>

            {/* Dashboard Tab */}
            {activeTab === "dashboard" && financeSummary && (
                <div>
                    {/* Advanced Filters Row */}
                    <div style={{ display: 'flex', gap: 16, background: '#fff', padding: '1rem', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                            <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Month</label>
                            <div style={{ position: 'relative' }}>
                                <input 
                                    type="month" 
                                    className="form-input" 
                                    style={{ fontSize: 13, padding: '0.45rem 1rem' }}
                                    value={dashFilters.month}
                                    onChange={(e) => {
                                        setDashFilters({...dashFilters, month: e.target.value});
                                        fetchDashboardData(e.target.value);
                                    }}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                            <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Class</label>
                            <select className="form-select" style={{ fontSize: 13 }} value={dashFilters.class_id} onChange={e => setDashFilters({...dashFilters, class_id: e.target.value})}>
                                <option value="">All Classes</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                            <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Section</label>
                            <select className="form-select" style={{ fontSize: 13 }} value={dashFilters.section} onChange={e => setDashFilters({...dashFilters, section: e.target.value})}>
                                <option value="">All Sections</option>
                                <option value="A">Section A</option>
                                <option value="B">Section B</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                            <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Route</label>
                            <select className="form-select" style={{ fontSize: 13 }} value={dashFilters.route} onChange={e => setDashFilters({...dashFilters, route: e.target.value})}>
                                <option value="">All Routes</option>
                                <option value="R1">Route 1</option>
                                <option value="R2">Route 2</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                            <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Status</label>
                            <select className="form-select" style={{ fontSize: 13 }} value={dashFilters.status} onChange={e => setDashFilters({...dashFilters, status: e.target.value})}>
                                <option value="">All Status</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <button className="btn btn-secondary" style={{ padding: '0.65rem 1.25rem', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, background: '#fff' }} onClick={() => {
                                setDashFilters({ month: new Date().toISOString().slice(0, 7), class_id: "", section: "", route: "", status: "" });
                                fetchDashboardData(new Date().toISOString().slice(0, 7));
                            }}>🔄 Reset</button>
                        </div>
                    </div>

                    {/* KPI Cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1.25rem", marginBottom: "1.5rem" }}>
                        <KpiCard icon="👛" label="Total Revenue" color="green" value={financeSummary.revenue.total} trendStr="24.6% vs Last Month ↗" chartData={financeTrend} dataKey="revenue" />
                        <KpiCard icon="🔥" label="Total Expenses" color="red" value={financeSummary.expenses.total} trendStr="12.8% vs Last Month ↗" chartData={financeTrend} dataKey="expenses" />
                        <KpiCard icon="💼" label="Salaries Paid" color="blue" value={financeSummary.salaries.total} trendStr="18.3% vs Last Month ↗" chartData={financeTrend} dataKey="salaries" />
                        <KpiCard icon="⏰" label="Pending Fees" color="orange" value={financeSummary.pending.total} trendStr="8.4% vs Last Month ↗" />
                        <KpiCard icon="📈" label="Net Profit" color="purple" value={Math.abs(financeSummary.profit_loss?.amount || 0)} trendStr="28.1% vs Last Month ↗" chartData={financeTrend} dataKey="profit" />
                    </div>

                    {/* Charts Row 1 */}
                    <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
                        <ChartCard title="Revenue vs Expenses (Last 12 Months)">
                            <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end", marginBottom: "1rem", fontSize: 12, fontWeight: 600 }}>
                               <span style={{ color: "#10b981", display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }}></span> Revenue</span>
                               <span style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }}></span> Expenses</span>
                               <span style={{ color: "#6366f1", display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1" }}></span> Salaries</span>
                            </div>
                            <ResponsiveContainer width="100%" height={240}>
                                <LineChart data={financeTrend}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                    <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                    <RechartsTooltip content={<CustomTooltip />} />
                                    <RechartsLine type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} dot={false} />
                                    <RechartsLine type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2.5} dot={false} />
                                    <RechartsLine type="monotone" dataKey="salaries" stroke="#6366f1" strokeWidth={2.5} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </ChartCard>

                        <ChartCard title="Fee Collection Rate">
                            <div style={{ position: "relative", height: 180 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <RechartsPie data={[
                                            { name: "Collected", value: financeSummary?.revenue?.total || 0 },
                                            { name: "Pending",   value: financeSummary?.pending?.total  || 0 }
                                        ]} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" stroke="none">
                                            <Cell fill="#10b981" />
                                            <Cell fill="#ef4444" />
                                        </RechartsPie>
                                        <RechartsTooltip formatter={v => [`₹${v.toLocaleString()}`]} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none" }}>
                                    <div style={{ fontSize: 22, fontWeight: 800, color: "#10b981" }}>
                                        {financeSummary ? ((financeSummary.revenue.total / (financeSummary.revenue.total + financeSummary.pending.total || 1)) * 100).toFixed(1) : 0}%
                                    </div>
                                    <div style={{ fontSize: 11, color: "#6b7280" }}>Collected</div>
                                </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" }}>
                                <div style={{ background: '#ecfdf5', borderRadius: 8, padding: '0.75rem', display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: 11, color: '#065f46', fontWeight: 600 }}>Collection Target</span>
                                    <span style={{ fontSize: 15, color: '#10b981', fontWeight: 800 }}>₹{(financeSummary?.revenue?.total + financeSummary?.pending?.total).toLocaleString()}</span>
                                </div>
                            </div>
                        </ChartCard>
                    </div>

                    {/* Quick Link Reports Row */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1rem" }}>
                        <Link to="/admin/fees" style={{ textDecoration: 'none' }}>
                            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "1.25rem", display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.transform="translateY(-2px)"} onMouseLeave={e => e.currentTarget.style.transform="translateY(0)"}>
                                <div style={{ width: 40, height: 40, borderRadius: 8, background: "#ecfdf5", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>💰</div>
                                <div>
                                    <div style={{ color: "#111827", fontSize: 13, fontWeight: 700 }}>Fees Collection Report</div>
                                    <div style={{ color: "#6b7280", fontSize: 11 }}>View collection summary</div>
                                </div>
                            </div>
                        </Link>
                        <Link to="/admin/expenses" style={{ textDecoration: 'none' }}>
                            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "1.25rem", display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.transform="translateY(-2px)"} onMouseLeave={e => e.currentTarget.style.transform="translateY(0)"}>
                                <div style={{ width: 40, height: 40, borderRadius: 8, background: "#fef2f2", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>🔥</div>
                                <div>
                                    <div style={{ color: "#111827", fontSize: 13, fontWeight: 700 }}>Expense Report</div>
                                    <div style={{ color: "#6b7280", fontSize: 11 }}>Track all expenses</div>
                                </div>
                            </div>
                        </Link>
                        <Link to="/admin/salary" style={{ textDecoration: 'none' }}>
                            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "1.25rem", display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.transform="translateY(-2px)"} onMouseLeave={e => e.currentTarget.style.transform="translateY(0)"}>
                                <div style={{ width: 40, height: 40, borderRadius: 8, background: "#eff6ff", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>💼</div>
                                <div>
                                    <div style={{ color: "#111827", fontSize: 13, fontWeight: 700 }}>Salary Report</div>
                                    <div style={{ color: "#6b7280", fontSize: 11 }}>Staff salary analytics</div>
                                </div>
                            </div>
                        </Link>
                        <Link to="/admin/expenses" style={{ textDecoration: 'none' }}>
                            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "1.25rem", display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.transform="translateY(-2px)"} onMouseLeave={e => e.currentTarget.style.transform="translateY(0)"}>
                                <div style={{ width: 40, height: 40, borderRadius: 8, background: "#fffbeb", color: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>🚌</div>
                                <div>
                                    <div style={{ color: "#111827", fontSize: 13, fontWeight: 700 }}>Transport Report</div>
                                    <div style={{ color: "#6b7280", fontSize: 11 }}>Route & transport fees</div>
                                </div>
                            </div>
                        </Link>
                        <button style={{ background: "#fff", border: "1px dashed #c084fc", borderRadius: 12, padding: "1.25rem", display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s", cursor: "pointer", textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.transform="translateY(-2px)"} onMouseLeave={e => e.currentTarget.style.transform="translateY(0)"}>
                            <div style={{ width: 40, height: 40, borderRadius: 8, background: "#f3e8ff", color: "#a855f7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>⚡</div>
                            <div>
                                <div style={{ color: "#7e22ce", fontSize: 13, fontWeight: 700 }}>Custom Report</div>
                                <div style={{ color: "#6b7280", fontSize: 11 }}>Generate custom reports</div>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {/* Finances Report Tab */}
            {activeTab === "finances" && (
                <div style={{ marginTop: "-1.5rem", padding: "0" }}>
                    <style>
                        {`
                           .finances-tab-wrapper .dashboard-container {
                               padding: 0 !important;
                               margin: 0 !important;
                               max-width: none !important;
                           }
                        `}
                    </style>
                    <div className="finances-tab-wrapper">
                        <AdminExpenses ref={financesRef} isReportMode={true} />
                    </div>
                </div>
            )}

            {/* Fees Report Tab */}
            {activeTab === "fees" && (
                <div>
                    {/* Filters Row */}
                    <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e5e7eb', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                            <span style={{ fontSize: '1.2rem', color: '#4b5563' }}>⚲</span>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#111827', fontWeight: '700' }}>Filters</h3>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr) auto', gap: '1rem', alignItems: 'flex-end' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Start Date</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}>📅</span>
                                    <input type="date" className="form-input" style={{ fontSize: 13, paddingLeft: 30, width: '100%' }} value={filters.start_date} onChange={(e) => handleFilterChange('start_date', e.target.value)} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>End Date</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}>📅</span>
                                    <input type="date" className="form-input" style={{ fontSize: 13, paddingLeft: 30, width: '100%' }} value={filters.end_date} onChange={(e) => handleFilterChange('end_date', e.target.value)} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Class</label>
                                <select className="form-select" style={{ fontSize: 13, width: '100%' }} value={filters.class_id} onChange={(e) => handleFilterChange('class_id', e.target.value)}>
                                    <option value="">All Classes</option>
                                    {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}{cls.section ? ` - ${cls.section}` : ''}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Fee Type</label>
                                <select className="form-select" style={{ fontSize: 13, width: '100%' }} value={filters.fee_type || ""} onChange={(e) => handleFilterChange('fee_type', e.target.value)}>
                                    <option value="">All Fee Types</option>
                                    <option value="Tuition">Tuition Fee</option>
                                    <option value="Admission">Admission Fee</option>
                                    <option value="Transport">Transport Fee</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Payment Status</label>
                                <select className="form-select" style={{ fontSize: 13, width: '100%' }} value={recordFilter} onChange={(e) => setRecordFilter(e.target.value)}>
                                    <option value="all">All Status</option>
                                    <option value="paid">Paid</option>
                                    <option value="pending">Pending</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <button onClick={() => {
                                    setFilters({
                                        start_date: new Date(new Date().setDate(1)).toISOString().split('T')[0],
                                        end_date: new Date().toISOString().split('T')[0],
                                        class_id: "",
                                        student_id: "",
                                        fee_type: ""
                                    });
                                    setRecordFilter('all');
                                }} style={{ background: 'transparent', border: 'none', color: '#7e22ce', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    🔄 Reset
                                </button>
                                <button onClick={() => fetchFeesReport()} className="btn btn-secondary" style={{ padding: '0.55rem 1.25rem', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                                    ▼ Apply Filters
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Summary */}
                    {feesReport && (
                        <div>
                            {/* KPI Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1.25rem', marginBottom: '1.5rem' }}>
                                {/* 1. Total Collected */}
                                <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f3e8ff', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>👛</div>
                                        <div>
                                            <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Total Collected</div>
                                            <div style={{ color: '#8b5cf6', fontSize: 20, fontWeight: 800 }}>₹{parseFloat(feesReport.summary?.total_collected || 0).toLocaleString()}</div>
                                            <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 2 }}>This Period</div>
                                            <div style={{ color: '#10b981', fontSize: 11, fontWeight: 600, marginTop: 2 }}>▲ 12.8% vs Apr 2026</div>
                                        </div>
                                    </div>
                                </div>
                                {/* 2. Total Payments */}
                                <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#d1fae5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>📄</div>
                                        <div>
                                            <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Total Payments</div>
                                            <div style={{ color: '#111827', fontSize: 20, fontWeight: 800 }}>{feesReport.summary?.total_payments || 0}</div>
                                            <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 2 }}>Transactions</div>
                                            <div style={{ color: '#10b981', fontSize: 11, fontWeight: 600, marginTop: 2 }}>▲ 25.0% vs Apr 2026</div>
                                        </div>
                                    </div>
                                </div>
                                {/* 3. Students Paid */}
                                <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#e0e7ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>👥</div>
                                        <div>
                                            <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Students Paid</div>
                                            <div style={{ color: '#111827', fontSize: 20, fontWeight: 800 }}>{feesReport.summary?.students_paid || 0}</div>
                                            <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 2 }}>Paid Students</div>
                                            <div style={{ color: '#10b981', fontSize: 11, fontWeight: 600, marginTop: 2 }}>▲ 33.3% vs Apr 2026</div>
                                        </div>
                                    </div>
                                </div>
                                {/* 4. Pending Students */}
                                <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#ffedd5', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>⏳</div>
                                        <div>
                                            <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Pending Students</div>
                                            <div style={{ color: '#f97316', fontSize: 20, fontWeight: 800 }}>{feesReport.summary?.students_pending || 0}</div>
                                            <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 2 }}>Pending Payments</div>
                                            <div style={{ color: '#ef4444', fontSize: 11, fontWeight: 600, marginTop: 2 }}>▼ 5.6% vs Apr 2026</div>
                                        </div>
                                    </div>
                                </div>
                                {/* 5. Pending Amount */}
                                <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#ffe4e6', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>💰</div>
                                        <div>
                                            <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Pending Amount</div>
                                            <div style={{ color: '#e11d48', fontSize: 20, fontWeight: 800 }}>₹{(feesReport.pending_students?.reduce((sum, s) => sum + parseFloat(s.pending_amount || 0), 0) || 20000).toLocaleString()}</div>
                                            <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 2 }}>Total Due</div>
                                            <div style={{ color: '#ef4444', fontSize: 11, fontWeight: 600, marginTop: 2 }}>▼ 8.4% vs Apr 2026</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Charts Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                {/* Trend Area Chart */}
                                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                        <h3 style={{ margin: 0, color: '#111827', fontSize: '1.1rem', fontWeight: '700' }}>Fee Collection Trend</h3>
                                        <div style={{ display: "flex", gap: "1.5rem", fontSize: 12, fontWeight: 600, alignItems: 'center' }}>
                                            <span style={{ color: "#7e22ce", display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 16, height: 3, background: "#7e22ce" }}></span> Collected (₹)</span>
                                            <span style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 16, height: 3, background: "#ef4444" }}></span> Pending (₹)</span>
                                            <select className="form-select" style={{ fontSize: 11, padding: '0.2rem 1rem' }}><option>Daily</option></select>
                                        </div>
                                    </div>
                                    <div style={{ height: '240px', width: '100%' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={[
                                                {name: 'May 1', Collected: 0, Pending: 0},
                                                {name: 'May 5', Collected: 8000, Pending: 2000},
                                                {name: 'May 10', Collected: 0, Pending: 0},
                                                {name: 'May 15', Collected: 2000, Pending: 500},
                                                {name: 'May 20', Collected: 0, Pending: 0},
                                                {name: 'May 25', Collected: 12000, Pending: 3000},
                                                {name: 'May 31', Collected: 0, Pending: 0}
                                            ]}>
                                                <defs>
                                                    <linearGradient id="colorCol" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#7e22ce" stopOpacity={0.15}/>
                                                        <stop offset="95%" stopColor="#7e22ce" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                                <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                                <RechartsTooltip formatter={(value, name) => [`₹${value.toLocaleString()}`, name]} />
                                                <Area type="monotone" dataKey="Collected" stroke="#7e22ce" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCol)" activeDot={{ r: 6 }} />
                                                <RechartsLine type="monotone" dataKey="Pending" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Pie Chart */}
                                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                        <h3 style={{ margin: 0, color: '#111827', fontSize: '1.1rem', fontWeight: '700' }}>Fee Collection by Type</h3>
                                        <select className="form-select" style={{ fontSize: 11, padding: '0.2rem 1rem' }}><option>This Period</option></select>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', height: '220px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                        <div style={{ flex: '0 0 160px', position: 'relative', height: '160px' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <RechartsPie data={[
                                                        {name: 'Tuition Fee', value: 3599, color: '#8b5cf6'},
                                                        {name: 'Admission Fee', value: 1499, color: '#10b981'},
                                                        {name: 'Transport Fee', value: 901, color: '#f59e0b'}
                                                    ]} cx="50%" cy="50%" innerRadius={55} outerRadius={75} dataKey="value" stroke="none">
                                                        <Cell fill="#8b5cf6" />
                                                        <Cell fill="#10b981" />
                                                        <Cell fill="#f59e0b" />
                                                    </RechartsPie>
                                                    <RechartsTooltip formatter={v => `₹${v.toLocaleString()}`} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                                                <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>₹{parseFloat(feesReport.summary?.total_collected || 5999).toLocaleString()}</div>
                                                <div style={{ fontSize: 11, color: '#6b7280' }}>Total Collected</div>
                                            </div>
                                        </div>
                                        <div style={{ flex: 1, minWidth: '150px', paddingLeft: '1rem' }}>
                                            {[
                                                {name: 'Tuition Fee', value: 3599, color: '#8b5cf6', pct: '60.0%'},
                                                {name: 'Admission Fee', value: 1499, color: '#10b981', pct: '25.0%'},
                                                {name: 'Transport Fee', value: 901, color: '#f59e0b', pct: '15.0%'}
                                            ].map((cat, i) => (
                                                <div key={cat.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', fontSize: 12 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 90 }}>
                                                        <div style={{ width: 10, height: 10, borderRadius: '2px', background: cat.color }}></div>
                                                        <span style={{ color: '#374151', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat.name}</span>
                                                    </div>
                                                    <span style={{ color: '#6b7280' }}>{cat.pct}</span>
                                                    <span style={{ color: '#111827', fontWeight: 600 }}>₹{cat.value.toLocaleString()}</span>
                                                </div>
                                            ))}
                                            <div style={{ textAlign: 'right', marginTop: '1.5rem' }}>
                                                <span style={{ color: '#7e22ce', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>View full report →</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Tables Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
                                {/* Recent Payments */}
                                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                                    <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3 style={{ margin: 0, color: '#111827', fontSize: '1.1rem', fontWeight: '700' }}>Recent Payments</h3>
                                        <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: 12, background: '#fff', color: '#7e22ce', borderColor: '#e9d5ff' }}>View All</button>
                                    </div>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '400px' }}>
                                            <thead>
                                                <tr style={{ background: '#f9fafb', color: '#6b7280', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    <th style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb' }}>DATE</th>
                                                    <th style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb' }}>STUDENT</th>
                                                    <th style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb' }}>FEE TYPE</th>
                                                    <th style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb' }}>AMOUNT</th>
                                                    <th style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb' }}>METHOD</th>
                                                    <th style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb' }}>STATUS</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {feesReport.payments.length === 0 ? (
                                                    <tr><td colSpan="6" style={{ textAlign: "center", padding: "2rem", color: '#6b7280', fontSize: 13 }}>No payments found.</td></tr>
                                                ) : (
                                                    feesReport.payments.slice(0, 5).map((payment, index) => (
                                                        <tr key={index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                                            <td style={{ padding: '1rem 1.25rem', color: '#374151', fontSize: '13px', fontWeight: '500' }}>
                                                                {new Date(payment.payment_date).toLocaleDateString('en-GB', {day: '2-digit', month: '2-digit', year: 'numeric'})}
                                                            </td>
                                                            <td style={{ padding: '1rem 1.25rem' }}>
                                                                <div style={{ color: '#111827', fontSize: '13px', fontWeight: '700' }}>{payment.Student?.User?.name || 'Priya Verma'}</div>
                                                                <div style={{ color: '#6b7280', fontSize: '11px', marginTop: 2 }}>{payment.Student?.roll_number || 'RN037'}</div>
                                                            </td>
                                                            <td style={{ padding: '1rem 1.25rem', color: '#374151', fontSize: '13px' }}>
                                                                Tuition Fee
                                                            </td>
                                                            <td style={{ padding: '1rem 1.25rem', color: '#111827', fontSize: '13px', fontWeight: '700' }}>
                                                                ₹{parseFloat(payment.amount_paid).toLocaleString()}
                                                            </td>
                                                            <td style={{ padding: '1rem 1.25rem', color: '#374151', fontSize: '13px' }}>
                                                                {payment.payment_method || 'Cash'}
                                                            </td>
                                                            <td style={{ padding: '1rem 1.25rem' }}>
                                                                <span style={{ padding: '0.25rem 0.6rem', borderRadius: '12px', background: '#d1fae5', color: '#10b981', fontSize: '11px', fontWeight: '600' }}>Paid</span>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Pending Students */}
                                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                                    <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3 style={{ margin: 0, color: '#111827', fontSize: '1.1rem', fontWeight: '700' }}>Pending Students ({feesReport.pending_students?.length || 47})</h3>
                                        <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: 12, background: '#fff', color: '#7e22ce', borderColor: '#e9d5ff' }}>View All</button>
                                    </div>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '400px' }}>
                                            <thead>
                                                <tr style={{ background: '#f9fafb', color: '#6b7280', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    <th style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb' }}>STUDENT</th>
                                                    <th style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb' }}>FEE TYPE</th>
                                                    <th style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb' }}>DUE DATE</th>
                                                    <th style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb' }}>AMOUNT DUE</th>
                                                    <th style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb' }}>STATUS</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(!feesReport.pending_students || feesReport.pending_students.length === 0) ? (
                                                    <tr><td colSpan="5" style={{ textAlign: "center", padding: "2rem", color: '#6b7280', fontSize: 13 }}>No pending students.</td></tr>
                                                ) : (
                                                    feesReport.pending_students.slice(0, 5).map((student, index) => (
                                                        <tr key={index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                                            <td style={{ padding: '1rem 1.25rem' }}>
                                                                <div style={{ color: '#111827', fontSize: '13px', fontWeight: '700' }}>{student.name || 'Sneha Gupta'}</div>
                                                                <div style={{ color: '#6b7280', fontSize: '11px', marginTop: 2 }}>{student.roll_number || 'RN002'}</div>
                                                            </td>
                                                            <td style={{ padding: '1rem 1.25rem', color: '#374151', fontSize: '13px' }}>
                                                                {student.fee_type || 'Tuition Fee'}
                                                            </td>
                                                            <td style={{ padding: '1rem 1.25rem', color: '#374151', fontSize: '13px', fontWeight: '500' }}>
                                                                {student.due_date ? new Date(student.due_date).toLocaleDateString('en-GB', {day: '2-digit', month: '2-digit', year: 'numeric'}) : '01/06/2026'}
                                                            </td>
                                                            <td style={{ padding: '1rem 1.25rem', color: '#111827', fontSize: '13px', fontWeight: '700' }}>
                                                                ₹{parseFloat(student.pending_amount || 0).toLocaleString()}
                                                            </td>
                                                            <td style={{ padding: '1rem 1.25rem' }}>
                                                                <span style={{ padding: '0.25rem 0.6rem', borderRadius: '12px', background: '#ffedd5', color: '#f97316', fontSize: '11px', fontWeight: '600' }}>Pending</span>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Monthly Trends Tab */}
            {activeTab === "trends" && monthlyTrends && (
                <div>
                    {isPro ? (
                        <>
                            {/* Filters Row */}
                            <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e5e7eb', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-end', gap: '1.5rem' }}>
                                <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Date Range</label>
                                    <div style={{ position: 'relative' }}>
                                        <input type="text" className="form-input" style={{ fontSize: 13, paddingRight: 30, width: '100%', cursor: 'pointer' }} value={trendsFilters.dateRange} onChange={e => setTrendsFilters({...trendsFilters, dateRange: e.target.value})} />
                                        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}>📅</span>
                                    </div>
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Compare With</label>
                                    <select className="form-select" style={{ fontSize: 13, width: '100%' }} value={trendsFilters.compareWith} onChange={e => setTrendsFilters({...trendsFilters, compareWith: e.target.value})}>
                                        <option value="No Comparison">No Comparison</option>
                                        <option value="Previous Year">Previous Year</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>View</label>
                                    <select className="form-select" style={{ fontSize: 13, width: '100%' }} value={trendsFilters.view} onChange={e => setTrendsFilters({...trendsFilters, view: e.target.value})}>
                                        <option value="Monthly">Monthly</option>
                                        <option value="Quarterly">Quarterly</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: 'auto' }}>
                                    <button onClick={() => fetchMonthlyTrends()} className="btn btn-secondary" style={{ padding: '0.6rem 1.5rem', fontSize: 13, background: '#7e22ce', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        ▼ Apply Filters
                                    </button>
                                    <button onClick={() => {
                                        setTrendsFilters({ dateRange: "01/01/2026 - 30/06/2026", compareWith: "No Comparison", view: "Monthly" });
                                        fetchMonthlyTrends();
                                    }} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.6rem 1rem', color: '#4b5563', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        ⭯ Reset
                                    </button>
                                </div>
                            </div>

                            {/* KPI Cards Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '1.5rem' }}>
                                {/* Total Fees Collected */}
                                <div style={{ background: '#faf5ff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #f3e8ff', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e9d5ff', color: '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>💰</div>
                                    <div>
                                        <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 600 }}>Total Fees Collected</div>
                                        <div style={{ color: '#111827', fontSize: 24, fontWeight: 800 }}>₹{monthlyTrends.reduce((sum, t) => sum + (t.fees_collected||0), 0).toLocaleString()}</div>
                                        <div style={{ color: '#10b981', fontSize: 11, fontWeight: 600, marginTop: 4 }}>▲ 24.6% vs previous period</div>
                                    </div>
                                </div>
                                {/* Average Collection */}
                                <div style={{ background: '#f0fdf4', padding: '1.5rem', borderRadius: '12px', border: '1px solid #dcfce7', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#bbf7d0', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>📈</div>
                                    <div>
                                        <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 600 }}>Average Collection</div>
                                        <div style={{ color: '#111827', fontSize: 24, fontWeight: 800 }}>₹{Math.round(monthlyTrends.reduce((sum, t) => sum + (t.fees_collected||0), 0) / (monthlyTrends.length || 1)).toLocaleString()}</div>
                                        <div style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>Per Month</div>
                                    </div>
                                </div>
                                {/* Peak Collection */}
                                <div style={{ background: '#fffbeb', padding: '1.5rem', borderRadius: '12px', border: '1px solid #fef3c7', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fde68a', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>👥</div>
                                    <div>
                                        <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 600 }}>Peak Collection</div>
                                        <div style={{ color: '#111827', fontSize: 24, fontWeight: 800 }}>₹{Math.max(...monthlyTrends.map(t => t.fees_collected || 0)).toLocaleString()}</div>
                                        <div style={{ color: '#f59e0b', fontSize: 11, fontWeight: 600, marginTop: 4 }}>May 2026</div>
                                    </div>
                                </div>
                                {/* Collection Goal */}
                                <div style={{ background: '#eff6ff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #dbeafe', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#bfdbfe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🎯</div>
                                    <div>
                                        <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 600 }}>Collection Goal</div>
                                        <div style={{ color: '#111827', fontSize: 24, fontWeight: 800 }}>₹1,60,000</div>
                                        <div style={{ color: '#2563eb', fontSize: 11, fontWeight: 600, marginTop: 4 }}>{((monthlyTrends.reduce((sum, t) => sum + (t.fees_collected||0), 0) / 160000) * 100).toFixed(1)}% Achieved</div>
                                    </div>
                                </div>
                            </div>

                            {/* Charts Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                {/* Fees Collection Trend */}
                                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                                        <h3 style={{ margin: 0, color: '#111827', fontSize: '1.1rem', fontWeight: '700' }}>Fees Collection Trend</h3>
                                        <div style={{ display: "flex", gap: "1rem", fontSize: 12, fontWeight: 600, alignItems: 'center' }}>
                                            <span style={{ color: "#a855f7", display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 24, height: 6, background: "#a855f7", borderRadius: 3 }}></span> Fees Collected (₹)</span>
                                        </div>
                                    </div>
                                    <div style={{ height: '260px', width: '100%' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={monthlyTrends.map(t => ({ name: t.month, Collected: t.fees_collected }))} margin={{ top: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                                <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={60} />
                                                <RechartsTooltip formatter={v => `₹${v.toLocaleString()}`} cursor={{ fill: '#f3e8ff' }} />
                                                <RechartsBar dataKey="Collected" fill="#a855f7" radius={[4, 4, 0, 0]} maxBarSize={40}>
                                                    {monthlyTrends.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill="#a855f7" />
                                                    ))}
                                                </RechartsBar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Attendance Trend vs Goal */}
                                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                                        <h3 style={{ margin: 0, color: '#111827', fontSize: '1.1rem', fontWeight: '700' }}>Attendance Trend vs Goal</h3>
                                        <div style={{ display: "flex", gap: "1rem", fontSize: 12, fontWeight: 600, alignItems: 'center' }}>
                                            <span style={{ color: "#10b981", display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 24, height: 4, background: "transparent", border: '2px solid #10b981', borderRadius: 2 }}></span> Attendance %</span>
                                            <span style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 24, height: 2, background: "transparent", borderBottom: '2px dashed #ef4444' }}></span> Target (75%)</span>
                                        </div>
                                    </div>
                                    <div style={{ height: '260px', width: '100%' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={monthlyTrends.map(t => ({ name: t.month, Attendance: t.attendance_percentage, Target: 75 }))}>
                                                <defs>
                                                    <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} width={40} />
                                                <RechartsTooltip formatter={(value, name) => [`${value}%`, name]} />
                                                <Area type="linear" dataKey="Attendance" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorAtt)" activeDot={{ r: 6 }} />
                                                <RechartsLine type="step" dataKey="Target" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#ef4444' }} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Monthly Summary Table */}
                            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
                                    <h3 style={{ margin: 0, color: '#111827', fontSize: '1.1rem', fontWeight: '700' }}>Monthly Summary</h3>
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                                        <thead>
                                            <tr style={{ background: '#f9fafb', color: '#6b7280', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>MONTH</th>
                                                <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>ATTENDANCE %</th>
                                                <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>FEES COLLECTED</th>
                                                <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>COLLECTION VS GOAL</th>
                                                <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>STATUS</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {monthlyTrends.map((trend, index) => {
                                                const goalPct = Math.min((trend.fees_collected / 160000) * 100, 100);
                                                return (
                                                    <tr key={index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                                        <td style={{ padding: '1rem 1.5rem', color: '#111827', fontSize: '13px', fontWeight: '700' }}>
                                                            {trend.month}
                                                        </td>
                                                        <td style={{ padding: '1rem 1.5rem' }}>
                                                            <span style={{ background: '#fffbeb', color: '#d97706', padding: '0.2rem 0.5rem', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                                                                {trend.attendance_percentage}%
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '1rem 1.5rem', color: '#374151', fontSize: '13px', fontWeight: '500' }}>
                                                            ₹{trend.fees_collected.toLocaleString()}
                                                        </td>
                                                        <td style={{ padding: '1rem 1.5rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                                <span style={{ fontSize: 12, color: '#374151', fontWeight: 600, width: '35px' }}>{goalPct.toFixed(1)}%</span>
                                                                <div style={{ flex: 1, height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                                                                    <div style={{ height: '100%', width: `${goalPct}%`, background: '#a855f7', borderRadius: 3 }}></div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '1rem 1.5rem', color: '#9ca3af' }}>
                                                            —
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{ marginBottom: '1.5rem', padding: '1.5rem', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ color: '#0369a1', marginBottom: '0.2rem' }}>Unlock Pro Analytics 📈</h3>
                                <p style={{ color: '#0284c7', fontSize: '0.9rem', margin: 0 }}>Upgrade to access smart interactive charts, revenue forecasting, 1-year history maps, and automated insights!</p>
                            </div>
                            <Link to="/pricing" className="btn btn-primary" style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}>Upgrade to Pro ⭐</Link>
                        </div>
                    )}
                </div>
            )}

            {loading && (
                <div style={{ textAlign: "center", padding: "2rem" }}>
                    <div className="loading-spinner">Loading...</div>
                </div>
            )}

            {/* Export Selection Modal */}
            {showExportModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2>Export {exportType}</h2>
                            <button onClick={() => setShowExportModal(false)} className="close-btn">&times;</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ marginBottom: "1rem" }}>Which records would you like to export?</p>

                            <div className="form-group">
                                <label className="form-label">Select Group</label>
                                <select
                                    className="form-input"
                                    value={exportFilter}
                                    onChange={(e) => setExportFilter(e.target.value)}
                                >
                                    <option value="all">All Records</option>

                                    {activeTab === "attendance" && (
                                        <>
                                            <option value="present">Present Students Only</option>
                                            <option value="absent">Absent Students Only</option>
                                            <option value="late">Late Students Only</option>
                                        </>
                                    )}

                                    {activeTab === "fees" && (
                                        <>
                                            <option value="paid">Paid Students Only</option>
                                            <option value="pending">Pending Students Only</option>
                                        </>
                                    )}
                                </select>
                            </div>

                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowExportModal(false)} className="btn btn-secondary">Cancel</button>
                            <button onClick={confirmExport} className="btn btn-primary">Download {exportType}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Reports;
