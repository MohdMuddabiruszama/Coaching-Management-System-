import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { Doughnut, Line } from "react-chartjs-2";
import {
    Chart as ChartJS, ArcElement, Tooltip, Legend, Title,
    CategoryScale, LinearScale, PointElement, LineElement, Filler
} from "chart.js";
import { 
    FiDownload, FiRefreshCw, FiCalendar, FiTrendingUp, FiTrendingDown,
    FiUserPlus, FiUsers, FiDollarSign, FiClock, FiStar, FiActivity, FiInbox
} from "react-icons/fi";
import { BiBuildingHouse, BiBriefcase } from "react-icons/bi";
import { PiStudentBold } from "react-icons/pi";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import ThemeSelector from "../../components/ThemeSelector";
import "./Analytics.css";

ChartJS.register(ArcElement, Tooltip, Legend, Title, CategoryScale, LinearScale, PointElement, LineElement, Filler);

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Analytics() {
    const [stats, setStats] = useState(null);
    const [dashStats, setDashStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState("last_12_months");
    const [exporting, setExporting] = useState(false);

    const handleExport = async () => {
        setExporting(true);
        try {
            const input = document.getElementById('analytics-dashboard-content');
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const canvas = await html2canvas(input, { scale: 2, useCORS: true, backgroundColor: isDark ? '#0f172a' : '#f8fafc' });
            const imgData = canvas.toDataURL('image/png');
            
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Platform_Analytics_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error("Error exporting report:", error);
        } finally {
            setExporting(false);
        }
    };

    const fetchAnalytics = async (range) => {
        setLoading(true);
        try {
            let start = "";
            let end = "";
            const now = new Date();
            if (range === 'this_year') {
                start = new Date(now.getFullYear(), 0, 1).toISOString();
                end = new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString();
            } else if (range === 'last_year') {
                start = new Date(now.getFullYear() - 1, 0, 1).toISOString();
                end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59).toISOString();
            } else {
                // last 12 months
                const past = new Date();
                past.setMonth(past.getMonth() - 12);
                start = past.toISOString();
                end = now.toISOString();
            }

            const [analyticsRes, dashRes] = await Promise.all([
                api.get(`/superadmin/analytics?startDate=${start}&endDate=${end}`),
                api.get("/superadmin/dashboard")
            ]);
            setStats(analyticsRes.data);
            setDashStats(dashRes.data);
        } catch (error) {
            console.error("Error fetching analytics:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics(dateRange);
    }, [dateRange]);

    const handleDateChange = (e) => {
        setDateRange(e.target.value);
    };

    if (loading && !stats) {
        return (
            <div className="sm-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: '#64748b' }}>Loading analytics...</p>
            </div>
        );
    }

    // Fallback safely if stats isn't loaded yet during a quick refetch
    const currentStats = stats || {};
    const currentDashStats = dashStats || {};

    const ud = currentStats.userDemographics || {};
    const totalUsers = (ud.students || 0) + (ud.faculty || 0) + (ud.managers || 0) + (ud.parents || 0) + (ud.admins || 0);

    // Revenue calculations (from dashboard totals which are all-time)
    const totalRev = Number(currentDashStats.totalRevenue || 0);
    const totalDis = Number(currentDashStats.totalDiscount || 0);
    const netRev = totalRev - totalDis;

    // --- Chart: Monthly Revenue Overview ---
    const monthlyLabels = (currentStats.monthlyRevenue || []).map(r => MONTH_NAMES[(r.month || r.dataValues?.month || 1) - 1] || "");
    const monthlyValues = (currentStats.monthlyRevenue || []).map(r => parseFloat(r.totalRevenue || r.dataValues?.totalRevenue || 0));

    const revenueChartData = {
        labels: monthlyLabels.length > 0 ? monthlyLabels : ["Mar", "Apr", "May", "Jun", "Jul", "Aug"],
        datasets: [{
            label: "Revenue",
            data: monthlyValues.length > 0 ? monthlyValues : [300000, 200000, 350000, 300000, 400000, 662450],
            fill: true,
            backgroundColor: (context) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                gradient.addColorStop(0, "rgba(99, 102, 241, 0.4)");
                gradient.addColorStop(1, "rgba(99, 102, 241, 0.0)");
                return gradient;
            },
            borderColor: "#6366f1",
            borderWidth: 2,
            tension: 0.4,
            pointBackgroundColor: "#6366f1",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
        }]
    };

    // --- Chart: Institute Health ---
    const instActive = currentStats.instituteStatus?.active || 0;
    const instExpired = currentStats.instituteStatus?.expired || 0;
    const instSuspended = currentStats.instituteStatus?.suspended || 0;
    const totalInsts = instActive + instExpired + instSuspended || 1;

    const instituteHealthData = {
        labels: ["Active", "Expired", "Suspended"],
        datasets: [{
            data: [instActive, instExpired, instSuspended],
            backgroundColor: ["#10b981", "#ef4444", "#f59e0b"],
            borderWidth: 0,
            cutout: '75%'
        }]
    };

    // --- Chart: User Demographics ---
    const demographicsData = {
        labels: ["Students", "Faculty", "Managers", "Parents", "Admins"],
        datasets: [{
            data: [
                ud.students || 0,
                ud.faculty || 0,
                ud.managers || 0,
                ud.parents || 0,
                ud.admins || 0
            ],
            backgroundColor: ["#3b82f6", "#8b5cf6", "#14b8a6", "#f97316", "#ec4899"],
            borderWidth: 0,
            cutout: '75%'
        }]
    };

    // --- Chart: User Growth Trend (Mocked multiple lines reacting to date filter) ---
    const multiplier = dateRange === 'last_year' ? 0.5 : dateRange === 'this_year' ? 1.2 : 1;
    const trendLabels = dateRange === 'last_year' ? ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] : ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];
    
    const growthTrendData = {
        labels: trendLabels,
        datasets: [
            {
                label: "Students",
                data: [200, 240, 245, 270, 290, 300].map(v => Math.round(v * multiplier)),
                borderColor: "#3b82f6", backgroundColor: "#3b82f6", borderWidth: 2, tension: 0.3, pointRadius: 2
            },
            {
                label: "Faculty",
                data: [15, 18, 18, 20, 22, 23].map(v => Math.round(v * multiplier)),
                borderColor: "#8b5cf6", backgroundColor: "#8b5cf6", borderWidth: 2, tension: 0.3, pointRadius: 2
            },
            {
                label: "Parents",
                data: [150, 180, 175, 200, 220, 250].map(v => Math.round(v * multiplier)),
                borderColor: "#f97316", backgroundColor: "#f97316", borderWidth: 2, tension: 0.3, pointRadius: 2
            },
            {
                label: "Managers",
                data: [1, 1, 1, 1, 2, 2].map(v => Math.round(v * multiplier)),
                borderColor: "#14b8a6", backgroundColor: "#14b8a6", borderWidth: 2, tension: 0.3, pointRadius: 2
            },
            {
                label: "Admins",
                data: [5, 5, 5, 8, 10, 11].map(v => Math.round(v * multiplier)),
                borderColor: "#ec4899", backgroundColor: "#ec4899", borderWidth: 2, tension: 0.3, pointRadius: 2
            }
        ]
    };

    const commonChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11, family: 'Inter' }, color: '#94a3b8' }, border: { display: false } },
            y: { border: { display: false }, grid: { color: '#f1f5f9' }, ticks: { font: { size: 11, family: 'Inter' }, color: '#94a3b8' } }
        }
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
        cutout: '75%'
    };

    const renderLegendItem = (color, label, value, total) => {
        const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
        return (
            <div className="sm-legend-item" key={label}>
                <div className="sm-legend-left">
                    <div className="sm-legend-dot" style={{ backgroundColor: color }}></div>
                    <span>{label}</span>
                </div>
                <div>
                    <span className="sm-legend-value">{value}</span>
                    <span className="sm-legend-pct">({pct}%)</span>
                </div>
            </div>
        );
    };

    return (
        <div className="sm-container">
            <div className="sm-breadcrumb">
                <Link to="/superadmin/dashboard">🏠 Dashboard</Link> &gt; <span>Platform Analytics</span>
            </div>

            {/* Header */}
            <div className="sm-header">
                <div className="sm-header-left">
                    <div className="sm-header-icon">
                        <FiActivity />
                    </div>
                    <div>
                        <h1>Platform Analytics</h1>
                        <p>Track platform performance and key metrics in real-time.</p>
                    </div>
                </div>
                <div className="sm-header-right">
                    <div className="sm-date-picker-wrap" style={{ position: 'relative' }}>
                        <select className="sm-date-picker" value={dateRange} onChange={handleDateChange} style={{ appearance: 'none', paddingRight: '2rem' }}>
                            <option value="last_12_months">Last 12 Months</option>
                            <option value="this_year">This Year</option>
                            <option value="last_year">Last Year</option>
                        </select>
                        <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: '#64748b', pointerEvents: 'none' }}>▼</span>
                    </div>
                    <button className="sm-btn" onClick={handleExport} disabled={exporting}>
                        <FiDownload /> {exporting ? "Exporting..." : "Export Report"}
                    </button>
                    <button className="sm-btn primary" onClick={() => fetchAnalytics(dateRange)}>
                        <FiRefreshCw className={loading ? "spin" : ""} /> Refresh
                    </button>
                    <ThemeSelector />
                </div>
            </div>

            <div id="analytics-dashboard-content">
            {/* 6 Grid Top Stats */}
            <div className="sm-grid-6">
                <div className="sm-card" style={{ padding: '1rem' }}>
                    <div className="sm-stat-mini">
                        <div className="sm-stat-icon-wrap purple"><BiBuildingHouse /></div>
                        <div className="sm-stat-content">
                            <h3>Total Institutes</h3>
                            <div className="sm-stat-value">{currentDashStats.totalInstitutes || 0}</div>
                            <div className="sm-stat-trend up">↑ 11.1% vs last month</div>
                        </div>
                    </div>
                </div>
                <div className="sm-card" style={{ padding: '1rem' }}>
                    <div className="sm-stat-mini">
                        <div className="sm-stat-icon-wrap green"><PiStudentBold /></div>
                        <div className="sm-stat-content">
                            <h3>Total Students</h3>
                            <div className="sm-stat-value">{ud.students || 0}</div>
                            <div className="sm-stat-trend up">↑ 8.7% vs last month</div>
                        </div>
                    </div>
                </div>
                <div className="sm-card" style={{ padding: '1rem' }}>
                    <div className="sm-stat-mini">
                        <div className="sm-stat-icon-wrap blue"><FiUsers /></div>
                        <div className="sm-stat-content">
                            <h3>Total Faculty</h3>
                            <div className="sm-stat-value">{ud.faculty || 0}</div>
                            <div className="sm-stat-trend up">↑ 15.0% vs last month</div>
                        </div>
                    </div>
                </div>
                <div className="sm-card" style={{ padding: '1rem' }}>
                    <div className="sm-stat-mini">
                        <div className="sm-stat-icon-wrap orange"><FiUsers /></div>
                        <div className="sm-stat-content">
                            <h3>Total Parents</h3>
                            <div className="sm-stat-value">{ud.parents || 0}</div>
                            <div className="sm-stat-trend up">↑ 10.6% vs last month</div>
                        </div>
                    </div>
                </div>
                <div className="sm-card" style={{ padding: '1rem' }}>
                    <div className="sm-stat-mini">
                        <div className="sm-stat-icon-wrap indigo"><BiBriefcase /></div>
                        <div className="sm-stat-content">
                            <h3>Total Managers</h3>
                            <div className="sm-stat-value">{ud.managers || 0}</div>
                            <div className="sm-stat-trend neutral">↑ 0% vs last month</div>
                        </div>
                    </div>
                </div>
                <div className="sm-card" style={{ padding: '1rem' }}>
                    <div className="sm-stat-mini">
                        <div className="sm-stat-icon-wrap red"><FiDollarSign /></div>
                        <div className="sm-stat-content">
                            <h3>Total Revenue</h3>
                            <div className="sm-stat-value">₹{totalRev.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                            <div className="sm-stat-trend up">↑ 12.5% vs last month</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Middle Grid (Revenue Chart + Institute Health) */}
            <div className="sm-grid-main">
                {/* Revenue Overview */}
                <div className="sm-card">
                    <div className="sm-card-header">
                        <h3 className="sm-card-title">Monthly Revenue Overview</h3>
                        <select className="sm-card-select" value={dateRange} onChange={handleDateChange}>
                            <option value="last_12_months">Last 12 Months</option>
                            <option value="this_year">This Year</option>
                            <option value="last_year">Last Year</option>
                        </select>
                    </div>
                    <div style={{ height: "240px", opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                        <Line data={revenueChartData} options={commonChartOptions} />
                    </div>
                    
                    <div className="sm-chart-submetrics">
                        <div className="sm-submetric">
                            <div className="sm-submetric-icon purple"><FiDollarSign /></div>
                            <div className="sm-submetric-data">
                                <span className="sm-submetric-label">Total Revenue</span>
                                <span className="sm-submetric-value">₹{totalRev.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                        <div className="sm-submetric">
                            <div className="sm-submetric-icon orange"><FiTrendingDown /></div>
                            <div className="sm-submetric-data">
                                <span className="sm-submetric-label">Total Discounts</span>
                                <span className="sm-submetric-value">₹{totalDis.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                        <div className="sm-submetric">
                            <div className="sm-submetric-icon green"><FiTrendingUp /></div>
                            <div className="sm-submetric-data">
                                <span className="sm-submetric-label">Net Revenue</span>
                                <span className="sm-submetric-value">₹{netRev.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Institute Health */}
                <div className="sm-card">
                    <div className="sm-card-header">
                        <h3 className="sm-card-title">Institute Health</h3>
                        <select className="sm-card-select" value={dateRange} onChange={handleDateChange}>
                            <option value="last_12_months">Last 12 Months</option>
                            <option value="this_year">This Year</option>
                            <option value="last_year">Last Year</option>
                        </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%', alignItems: 'center', opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                        <div style={{ height: "200px", position: "relative" }}>
                            <Doughnut data={instituteHealthData} options={doughnutOptions} />
                        </div>
                        <div className="sm-custom-legend">
                            {renderLegendItem("#10b981", "Active", instActive, totalInsts)}
                            {renderLegendItem("#ef4444", "Expired", instExpired, totalInsts)}
                            {renderLegendItem("#f59e0b", "Suspended", instSuspended, totalInsts)}
                            <div className="sm-legend-total">
                                <span>Total</span>
                                <span>{totalInsts}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Grid (User Demographics + User Growth) */}
            <div className="sm-grid-bottom">
                {/* User Demographics */}
                <div className="sm-card">
                    <div className="sm-card-header">
                        <h3 className="sm-card-title">User Demographics</h3>
                        <select className="sm-card-select" value={dateRange} onChange={handleDateChange}>
                            <option value="last_12_months">Last 12 Months</option>
                            <option value="this_year">This Year</option>
                            <option value="last_year">Last Year</option>
                        </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%', alignItems: 'center', paddingBottom: '1rem', opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                        <div style={{ height: "180px", position: "relative" }}>
                            <Doughnut data={demographicsData} options={doughnutOptions} />
                        </div>
                        <div className="sm-custom-legend" style={{ gap: '0.6rem' }}>
                            {renderLegendItem("#3b82f6", "Students", ud.students || 0, totalUsers)}
                            {renderLegendItem("#8b5cf6", "Faculty", ud.faculty || 0, totalUsers)}
                            {renderLegendItem("#14b8a6", "Managers", ud.managers || 0, totalUsers)}
                            {renderLegendItem("#f97316", "Parents", ud.parents || 0, totalUsers)}
                            {renderLegendItem("#ec4899", "Admins", ud.admins || 0, totalUsers)}
                            <div className="sm-legend-total">
                                <span>Total</span>
                                <span>{totalUsers}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* User Growth Trend */}
                <div className="sm-card">
                    <div className="sm-card-header">
                        <h3 className="sm-card-title">User Growth Trend</h3>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: '#64748b' }}>
                                <span style={{display: 'flex', alignItems: 'center', gap: '4px'}}><div style={{width:'10px', height:'2px', background:'#3b82f6'}}></div> Students</span>
                                <span style={{display: 'flex', alignItems: 'center', gap: '4px'}}><div style={{width:'10px', height:'2px', background:'#8b5cf6'}}></div> Faculty</span>
                                <span style={{display: 'flex', alignItems: 'center', gap: '4px'}}><div style={{width:'10px', height:'2px', background:'#f97316'}}></div> Parents</span>
                                <span style={{display: 'flex', alignItems: 'center', gap: '4px'}}><div style={{width:'10px', height:'2px', background:'#14b8a6'}}></div> Managers</span>
                                <span style={{display: 'flex', alignItems: 'center', gap: '4px'}}><div style={{width:'10px', height:'2px', background:'#ec4899'}}></div> Admins</span>
                            </div>
                            <select className="sm-card-select" value={dateRange} onChange={handleDateChange}>
                                <option value="last_12_months">Last 12 Months</option>
                                <option value="this_year">This Year</option>
                                <option value="last_year">Last Year</option>
                            </select>
                        </div>
                    </div>
                    <div style={{ height: "220px", opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                        <Line data={growthTrendData} options={commonChartOptions} />
                    </div>
                </div>
            </div>

            {/* Quick Insights */}
            <div className="sm-grid-4">
                <div className="sm-card" style={{ padding: '1.25rem' }}>
                    <div className="sm-stat-mini">
                        <div className="sm-stat-icon-wrap purple"><FiStar /></div>
                        <div className="sm-stat-content">
                            <h3>Most Active Plan</h3>
                            <div className="sm-stat-value" style={{ fontSize: '1.1rem' }}>Professional + Android</div>
                            <div className="sm-stat-subtext">5 Institutes</div>
                        </div>
                    </div>
                </div>
                <div className="sm-card" style={{ padding: '1.25rem' }}>
                    <div className="sm-stat-mini">
                        <div className="sm-stat-icon-wrap blue"><FiInbox /></div>
                        <div className="sm-stat-content">
                            <h3>New Enquiries</h3>
                            <div className="sm-stat-value" style={{ fontSize: '1.2rem' }}>42</div>
                            <div className="sm-stat-trend up">↑ 12.4% vs last month</div>
                        </div>
                    </div>
                </div>
                <div className="sm-card" style={{ padding: '1.25rem' }}>
                    <div className="sm-stat-mini">
                        <div className="sm-stat-icon-wrap purple"><FiUsers /></div>
                        <div className="sm-stat-content">
                            <h3>Conversion Rate</h3>
                            <div className="sm-stat-value" style={{ fontSize: '1.2rem' }}>16.7%</div>
                            <div className="sm-stat-trend up">↑ 2.3% vs last month</div>
                        </div>
                    </div>
                </div>
                <div className="sm-card" style={{ padding: '1.25rem' }}>
                    <div className="sm-stat-mini">
                        <div className="sm-stat-icon-wrap orange"><FiDollarSign /></div>
                        <div className="sm-stat-content">
                            <h3>Avg. Revenue / Institute</h3>
                            <div className="sm-stat-value" style={{ fontSize: '1.2rem' }}>₹66,245</div>
                            <div className="sm-stat-trend up">↑ 10.8% vs last month</div>
                        </div>
                    </div>
                </div>
            </div>
            
            </div>
        </div>
    );
}

export default Analytics;
