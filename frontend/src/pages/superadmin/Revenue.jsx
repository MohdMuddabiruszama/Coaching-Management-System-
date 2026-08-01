/**
 * Super Admin - Revenue Analytics
 * Visualizes revenue and subscription data
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import api from "../../services/api";
import { Link } from "react-router-dom";
import { Line, Doughnut } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
} from "chart.js";
import { 
    FiArrowLeft, FiDownload, FiCreditCard, FiTag, 
    FiFileText, FiUsers, FiTrendingUp, FiTrendingDown, FiTrash2 
} from "react-icons/fi";

import "./Revenue.css";

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

function Revenue() {
    const [analyticsData, setAnalyticsData] = useState(null);
    const [recentPayments, setRecentPayments] = useState([]);
    const [plans, setPlans] = useState({});
    const [loading, setLoading] = useState(true);
    
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 12);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });
    const [revenueChartType, setRevenueChartType] = useState("Monthly");
    const [planDistType, setPlanDistType] = useState("By Revenue");

    const socketRef = useRef(null);
    const debounceRef = useRef(null);

    const fetchData = useCallback(async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            
            const params = new URLSearchParams();
            if (startDate) params.append("startDate", startDate);
            if (endDate) params.append("endDate", endDate);
            params.append("trendType", revenueChartType.toLowerCase());
            
            // Fetch analytics summary
            const analyticsRes = await api.get(`/superadmin/analytics?${params.toString()}`);
            setAnalyticsData(analyticsRes.data);

            // Fetch recent paid subscriptions with dates applied (all records for the period)
            const paymentsRes = await api.get(`/subscriptions?status=paid&limit=10000&${params.toString()}`);
            setRecentPayments(paymentsRes.data.data?.subscriptions || []);

            // Fetch plans for mapping names
            const plansRes = await api.get("/plans");
            const plansMap = {};
            if (plansRes.data.data) {
                plansRes.data.data.forEach(p => {
                    plansMap[p.id] = p.name;
                });
            }
            setPlans(plansMap);

        } catch (error) {
            console.error("Error fetching revenue data:", error);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, revenueChartType]);

    useEffect(() => {
        fetchData();
        const socketUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
        const socket = io(socketUrl, { withCredentials: true });
        socketRef.current = socket;
        
        socket.emit('join_superadmin');
        socket.on('subscription_updated', () => {
            clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                fetchData(true);
            }, 400);
        });

        return () => {
            clearTimeout(debounceRef.current);
            socket.disconnect();
        };
    }, [fetchData]);

    const handleRemove = async (id) => {
        if (!window.confirm("Are you sure you want to remove this transaction from Revenue Analytics?")) return;
        
        try {
            await api.patch(`/subscriptions/${id}/exclude`);
            fetchData();
        } catch (error) {
            console.error("Error removing transaction:", error);
            alert("Failed to remove transaction");
        }
    };

    if (loading || !analyticsData) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
    }

    const { currentPeriod, previousPeriod, monthlyRevenue, planDistribution } = analyticsData;
    
    // Safety Fallbacks
    const cp = currentPeriod || {};
    const pp = previousPeriod || {};
    const totalRev = parseFloat(cp.totalRevenue || 0);
    const prevRev = parseFloat(pp.totalRevenue || 0);
    const totalDisc = parseFloat(cp.totalDiscounts || 0);
    const prevDisc = parseFloat(pp.totalDiscounts || 0);
    const totalSubs = parseInt(cp.totalSubscriptions || 0);
    const prevSubs = parseInt(pp.totalSubscriptions || 0);
    const activeSubs = parseInt(cp.activeSubscriptions || 0);

    const calcTrend = (current, previous) => {
        if (!previous) return { val: 100, dir: 'up' };
        const diff = current - previous;
        const pct = (diff / previous) * 100;
        return {
            val: Math.abs(pct).toFixed(1),
            dir: pct >= 0 ? 'up' : 'down'
        };
    };

    const revTrend = calcTrend(totalRev, prevRev);
    const discTrend = calcTrend(totalDisc, prevDisc);
    const subsTrend = calcTrend(totalSubs, prevSubs);

    const renderTrendBadge = (trend) => {
        if (!trend) return null;
        if (trend.dir === 'up') {
            return <div className="trend-up"><FiTrendingUp /> {trend.val}% vs last period</div>;
        }
        return <div className="trend-down"><FiTrendingDown /> {trend.val}% vs last period</div>;
    };

    // Prepare Chart Data
    const monthlyRevenueData = {
        labels: monthlyRevenue.map((item) => {
            if (revenueChartType === 'Weekly') {
                return `Week ${item.period}, ${item.year}`;
            } else {
                const date = new Date();
                date.setMonth(item.period - 1); 
                return date.toLocaleString('default', { month: 'short' }) + " " + item.year;
            }
        }),
        datasets: [
            {
                label: "Revenue (₹)",
                data: monthlyRevenue.map((item) => item.totalRevenue),
                borderColor: "#6366f1",
                backgroundColor: "rgba(99, 102, 241, 0.15)",
                tension: 0.4,
                fill: true,
            },
        ],
    };

    const lineChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        elements: {
            line: { tension: 0.4 },
            point: { radius: 3, hoverRadius: 6 },
        },
        plugins: {
            tooltip: {
                backgroundColor: 'rgba(17, 17, 17, 0.9)',
                padding: 12,
                cornerRadius: 8,
                titleFont: { weight: '600' },
                displayColors: false,
                callbacks: {
                    label: (ctx) => `₹${Number(ctx.raw).toLocaleString('en-IN')}`,
                },
            },
            legend: { display: false },
        },
        scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
            x: { grid: { display: false } },
        },
    };

    // Plan Distribution processing
    const planColors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
    
    const planDistributionData = {
        labels: planDistribution.map((item) => plans[item.plan_id] || `Plan ${item.plan_id}`),
        datasets: [{
            data: planDistribution.map((item) => planDistType === "By Revenue" ? (item.revenue || 0) : (item.count || 0)),
            backgroundColor: planColors,
            borderWidth: 0,
        }],
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (ctx) => `₹${Number(ctx.raw).toLocaleString('en-IN')}`,
                }
            }
        },
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', background: '#f9fafb', minHeight: '100vh' }}>
            
            <div className="revenue-header">
                <div className="revenue-header-left">
                    <div className="revenue-header-icon">
                        <FiTrendingUp />
                    </div>
                    <div className="revenue-header-title">
                        <h1>Revenue Analytics</h1>
                        <p>Track financial performance and subscription metrics</p>
                    </div>
                </div>
                
                <div className="revenue-header-actions">
                    <div className="date-picker-wrapper">
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={(e) => setStartDate(e.target.value)} 
                        />
                        <span style={{ color: '#9ca3af' }}>-</span>
                        <input 
                            type="date" 
                            value={endDate} 
                            onChange={(e) => setEndDate(e.target.value)} 
                        />
                    </div>
                    <button className="btn-export">
                        <FiDownload /> Export
                    </button>
                    <Link to="/superadmin/dashboard" className="btn-dashboard">
                        <FiArrowLeft /> Back to Dashboard
                    </Link>
                </div>
            </div>

            <div className="revenue-summary-grid">
                <div className="summary-card">
                    <div className="summary-icon purple"><FiCreditCard /></div>
                    <div className="summary-content">
                        <p className="summary-label">Total Revenue</p>
                        <h2 className="summary-value">₹{totalRev.toLocaleString('en-IN')}</h2>
                        <div className="summary-trend">{renderTrendBadge(revTrend)}</div>
                    </div>
                </div>
                <div className="summary-card">
                    <div className="summary-icon green"><FiTag /></div>
                    <div className="summary-content">
                        <p className="summary-label">Discounts Given</p>
                        <h2 className="summary-value">₹{totalDisc.toLocaleString('en-IN')}</h2>
                        <div className="summary-trend">{renderTrendBadge(discTrend)}</div>
                    </div>
                </div>
                <div className="summary-card">
                    <div className="summary-icon blue"><FiFileText /></div>
                    <div className="summary-content">
                        <p className="summary-label">Total Subscriptions</p>
                        <h2 className="summary-value">{totalSubs}</h2>
                        <div className="summary-trend">{renderTrendBadge(subsTrend)}</div>
                    </div>
                </div>
                <div className="summary-card">
                    <div className="summary-icon yellow"><FiUsers /></div>
                    <div className="summary-content">
                        <p className="summary-label">Active Subscriptions</p>
                        <h2 className="summary-value">{activeSubs}</h2>
                        <div className="summary-trend">
                            <span className="trend-neutral">
                                {totalSubs > 0 ? ((activeSubs / totalSubs) * 100).toFixed(1) : 0}% of total
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="charts-grid">
                <div className="chart-card">
                    <div className="chart-header">
                        <h3 className="chart-title">Revenue Trend</h3>
                        <select className="chart-select" value={revenueChartType} onChange={e => setRevenueChartType(e.target.value)}>
                            <option value="Monthly">Monthly</option>
                            <option value="Weekly">Weekly</option>
                        </select>
                    </div>
                    <div style={{ position: 'relative', height: '320px', width: '100%' }}>
                        <Line data={monthlyRevenueData} options={lineChartOptions} />
                    </div>
                </div>

                <div className="chart-card">
                    <div className="chart-header">
                        <h3 className="chart-title">Plan Distribution</h3>
                        <select className="chart-select" value={planDistType} onChange={e => setPlanDistType(e.target.value)}>
                            <option value="By Revenue">By Revenue</option>
                            <option value="By Count">By Count</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                        <div className="doughnut-container" style={{ flex: 1, height: '250px' }}>
                            <Doughnut data={planDistributionData} options={doughnutOptions} />
                            <div className="doughnut-center-text">
                                <div className="doughnut-center-value">
                                    {planDistType === "By Revenue" ? `₹${totalRev.toLocaleString('en-IN')}` : totalSubs}
                                </div>
                                <div className="doughnut-center-label">
                                    {planDistType === "By Revenue" ? "Total Revenue" : "Total Count"}
                                </div>
                            </div>
                        </div>
                        <div className="plan-legend" style={{ flex: 1 }}>
                            {planDistribution.map((item, index) => (
                                <div key={item.plan_id} className="legend-item">
                                    <div className="legend-label">
                                        <div className="legend-dot" style={{ backgroundColor: planColors[index % planColors.length] }}></div>
                                        {plans[item.plan_id] || `Plan ${item.plan_id}`}
                                    </div>
                                    <div className="legend-value">
                                        {planDistType === "By Revenue" 
                                            ? `₹${parseFloat(item.revenue || 0).toLocaleString('en-IN')}`
                                            : item.count || 0
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="transactions-card">
                <div className="transactions-header">
                    <h3 className="chart-title" style={{ fontSize: '18px' }}>Transactions for Period</h3>
                    <Link to="/superadmin/subscriptions" className="btn-view-all" style={{ textDecoration: 'none' }}>View Detailed Report</Link>
                </div>
                <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
                    <table className="transactions-table">
                        <thead>
                            <tr>
                                <th>Institute</th>
                                <th>Plan</th>
                                <th>Original Amount</th>
                                <th>Discount</th>
                                <th>GST</th>
                                <th>Total Amount</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentPayments.length === 0 ? (
                                <tr>
                                    <td colSpan="9" style={{ textAlign: "center", padding: "2rem" }}>No recent transactions</td>
                                </tr>
                            ) : (
                                recentPayments.map((sub) => {
                                    const instName = sub.Institute?.name || "Unknown";
                                    const instInitials = instName.substring(0, 2).toUpperCase();
                                    const origPrice = parseFloat(sub.amount_paid) + parseFloat(sub.discount_amount) - parseFloat(sub.tax_amount);
                                    
                                    return (
                                        <tr key={sub.id}>
                                            <td>
                                                <div className="institute-cell">
                                                    <div className="institute-avatar" style={{ backgroundColor: '#f3f0ff', color: '#6366f1' }}>
                                                        {instInitials}
                                                    </div>
                                                    <div className="institute-info">
                                                        <span className="institute-name">{instName}</span>
                                                        <span className="institute-email">{sub.Institute?.email || "N/A"}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="plan-info">
                                                    <span className="plan-name">{sub.Plan?.name || "Custom"}</span>
                                                    <span className="billing-cycle">{sub.billing_cycle || "Monthly"} Billing</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="amount-text">₹{origPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </td>
                                            <td>
                                                {parseFloat(sub.discount_amount) > 0 ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: '700' }}>
                                                            {Math.round((parseFloat(sub.discount_amount) / origPrice) * 100)}% Off
                                                        </span>
                                                        <span style={{ fontSize: '12px', color: '#16a34a' }}>
                                                            -₹{parseFloat(sub.discount_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span style={{ color: '#6b7280' }}>-</span>
                                                )}
                                            </td>
                                            <td>
                                                <span className="amount-text">₹{parseFloat(sub.tax_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </td>
                                            <td>
                                                <span className="amount-text" style={{ fontSize: '14px', fontWeight: '700' }}>
                                                    ₹{parseFloat(sub.amount_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{ color: '#6b7280', fontSize: '13px' }}>
                                                    {new Date(sub.createdAt || sub.created_at || sub.start_date).toLocaleDateString('en-GB', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                        year: 'numeric'
                                                    })}
                                                </span>
                                            </td>
                                            <td>
                                                <div className={sub.payment_status === 'paid' ? 'status-badge status-paid' : 'status-badge status-pending'}>
                                                    {sub.payment_status === 'paid' ? 'Paid' : 'Pending'}
                                                </div>
                                            </td>
                                            <td>
                                                <button className="action-btn" onClick={() => handleRemove(sub.id)} title="Remove from analytics">
                                                    <FiTrash2 />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default Revenue;
