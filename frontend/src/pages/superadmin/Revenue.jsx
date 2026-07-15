/**
 * Super Admin - Revenue Analytics
 * Visualizes revenue and subscription data
 */

import { useState, useEffect } from "react";
import api from "../../services/api";
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
import BackButton from "../../components/common/BackButton";
import "../admin/Dashboard.css"; // Reuse dashboard styles

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

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            // Fetch analytics summary
            const analyticsRes = await api.get("/superadmin/analytics"); // Returns monthlyRevenue, planDistribution, etc.
            setAnalyticsData(analyticsRes.data);

            // Fetch recent paid subscriptions
            const paymentsRes = await api.get("/subscriptions?status=paid&limit=5");
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
    };

    if (loading || !analyticsData) {
        return <div className="dashboard-container">Loading...</div>;
    }

    // Prepare Chart Data
    const monthlyRevenueData = {
        labels: analyticsData.monthlyRevenue.map((item) => {
            const date = new Date();
            date.setMonth(item.month - 1); // SQL month is 1-indexed
            return date.toLocaleString('default', { month: 'short' });
        }),
        datasets: [
            {
                label: "Revenue (₹)",
                data: analyticsData.monthlyRevenue.map((item) => item.totalRevenue),
                borderColor: "#6366f1",
                backgroundColor: "rgba(99, 102, 241, 0.2)",
                tension: 0.4,
                fill: true,
            },
        ],
    };

    const planDistributionData = {
        labels: analyticsData.planDistribution.map((item) => plans[item.plan_id] || `Plan ID: ${item.plan_id}`),
        datasets: [
            {
                data: analyticsData.planDistribution.map((item) => item.count),
                backgroundColor: ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"],
                borderWidth: 0,
            },
        ],
    };

    // Calculate Total Revenue
    const totalRevenue = analyticsData.monthlyRevenue.reduce((acc, curr) => acc + parseFloat(curr.totalRevenue), 0);

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <h1>💰 Revenue Analytics</h1>
                    <p>Financial overview and subscription metrics</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
                    <BackButton />
                    <div style={{ textAlign: "right" }}>
                        <h2 style={{ fontSize: "2rem", color: "#10b981", margin: 0 }}>
                            ₹{totalRevenue.toLocaleString()}
                        </h2>
                        <p style={{ margin: 0, color: "#6b7280" }}>Total Revenue</p>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="stats-grid" style={{ gridTemplateColumns: "2fr 1fr", marginBottom: "2rem" }}>
                <div className="card" style={{ padding: "1.5rem" }}>
                    <h3 className="card-title">Monthly Revenue Trend</h3>
                    <div style={{ height: "300px" }}>
                        <Line
                            data={monthlyRevenueData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { display: false },
                                },
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                        ticks: {
                                            callback: (value) => "₹" + value,
                                        },
                                    },
                                },
                            }}
                        />
                    </div>
                </div>

                <div className="card" style={{ padding: "1.5rem" }}>
                    <h3 className="card-title">Plan Distribution</h3>
                    <div style={{ height: "300px", display: "flex", justifyContent: "center" }}>
                        <Doughnut
                            data={planDistributionData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { position: "bottom" },
                                },
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Recent Transactions Table */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Recent Transactions</h3>
                </div>
                <div className="table-container">
                    <table className="table">
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
                            </tr>
                        </thead>
                        <tbody>
                            {recentPayments.length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: "center", padding: "2rem" }}>
                                        No recent transactions
                                    </td>
                                </tr>
                            ) : (
                                recentPayments.map((sub) => (
                                    <tr key={sub.id}>
                                        <td>{sub.Institute?.name || "Unknown"}</td>
                                        <td>{sub.Plan?.name || "Custom"}</td>
                                        <td>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                                                ₹{parseFloat(sub.original_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                        <td>
                                            {sub.discount_applied ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                    <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 'bold' }}>
                                                        {sub.original_price > 0 ? Math.round((parseFloat(sub.discount_amount || 0) / parseFloat(sub.original_price)) * 100) : 0}% Off
                                                    </span>
                                                    <span style={{ 
                                                        background: 'rgba(22, 163, 74, 0.1)', color: '#16a34a', 
                                                        padding: '0.2rem 0.5rem', borderRadius: '4px', 
                                                        fontSize: '0.85rem', fontWeight: 'bold',
                                                        display: 'inline-block', width: 'fit-content'
                                                    }}>
                                                        ₹{parseFloat(sub.discount_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)' }}>-</span>
                                            )}
                                        </td>
                                        <td>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                                                ₹{parseFloat(sub.tax_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                                                ₹{parseFloat(sub.amount_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </div>
                                        </td>
                                        <td>{new Date(sub.updatedAt).toLocaleDateString()}</td>
                                        <td>
                                            <span className="badge badge-success">Paid</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default Revenue;
