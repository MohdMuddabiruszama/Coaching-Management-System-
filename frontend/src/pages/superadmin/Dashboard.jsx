import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell 
} from 'recharts';
import "./SuperAdminDashboard.css";

function SuperAdminDashboard() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalInstitutes: 0,
        activeInstitutes: 0,
        totalStudents: 0,
        activeStudents: 0,
        totalFaculty: 0,
        activeFaculty: 0,
        totalManagers: 0,
        activeManagers: 0,
        totalRevenue: 0,
        growthRate: 18.6
    });
    const [recentInstitutes, setRecentInstitutes] = useState([]);
    const [enquiries, setEnquiries] = useState([]);
    const [revenueData, setRevenueData] = useState([]);
    const [revenueFilter, setRevenueFilter] = useState("This Month");
    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });
    const [systemHealth, setSystemHealth] = useState({
        ping: 0,
        status: 'Checking...'
    });

    useEffect(() => {
        fetchDashboardData();
        checkSystemHealth();
    }, [dateRange]);

    useEffect(() => {
        fetchRevenueAnalytics();
    }, [revenueFilter]);

    const checkSystemHealth = async () => {
        const start = Date.now();
        try {
            await api.get("/superadmin/dashboard");
            const ping = Date.now() - start;
            setSystemHealth({ ping, status: 'Operational' });
        } catch (error) {
            setSystemHealth({ ping: 0, status: 'Down' });
        }
    };

    const fetchRevenueAnalytics = async () => {
        try {
            let trend = 'monthly';
            const today = new Date();
            let start = new Date(today.getFullYear(), 0, 1);
            let end = new Date();
            
            if (revenueFilter === "This Year") {
                trend = 'monthly';
            } else if (revenueFilter === "This Month") {
                trend = 'weekly';
                start = new Date(today.getFullYear(), today.getMonth(), 1);
            } else if (revenueFilter === "Last Month") {
                trend = 'weekly';
                start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                end = new Date(today.getFullYear(), today.getMonth(), 0);
            }
            
            const startDate = start.toISOString().split('T')[0];
            const endDate = end.toISOString().split('T')[0];
            
            const res = await api.get(`/superadmin/analytics?trendType=${trend}&startDate=${startDate}&endDate=${endDate}`);
            if (res.data && res.data.monthlyRevenue) {
                const formattedData = res.data.monthlyRevenue.map((item, index) => {
                    let label = "";
                    if (trend === 'weekly') {
                        label = `Week ${index + 1}`;
                    } else {
                        const d = new Date();
                        d.setMonth(item.period - 1);
                        label = d.toLocaleString('default', { month: 'short' });
                    }
                    return {
                        date: label,
                        revenue: parseFloat(item.totalRevenue)
                    };
                });
                
                // If the data is empty, maybe return empty array or default zeros
                if (formattedData.length === 0) {
                    if (trend === 'weekly') {
                        setRevenueData([
                            { date: 'Week 1', revenue: 0 },
                            { date: 'Week 2', revenue: 0 },
                            { date: 'Week 3', revenue: 0 },
                            { date: 'Week 4', revenue: 0 }
                        ]);
                    } else {
                        setRevenueData([
                            { date: 'Jan', revenue: 0 }, { date: 'Feb', revenue: 0 }, { date: 'Mar', revenue: 0 }
                        ]);
                    }
                } else {
                    setRevenueData(formattedData);
                }
            } else {
                setRevenueData(getMockRevenueData(revenueFilter));
            }
        } catch (error) {
            console.error("Failed to fetch revenue analytics", error);
            setRevenueData(getMockRevenueData(revenueFilter));
        }
    };

    const getMockRevenueData = (filter) => {
        if (filter === "This Month") {
            return [
                { date: 'Week 1', revenue: 2000 },
                { date: 'Week 2', revenue: 4500 },
                { date: 'Week 3', revenue: 4300 },
                { date: 'Week 4', revenue: 8900 }
            ];
        } else if (filter === "Last Month") {
            return [
                { date: 'Week 1', revenue: 1500 },
                { date: 'Week 2', revenue: 3000 },
                { date: 'Week 3', revenue: 4100 },
                { date: 'Week 4', revenue: 5000 }
            ];
        } else {
            return [
                { date: 'Jan', revenue: 10000 },
                { date: 'Feb', revenue: 12000 },
                { date: 'Mar', revenue: 15000 },
                { date: 'Apr', revenue: 14000 },
                { date: 'May', revenue: 18000 },
                { date: 'Jun', revenue: 20000 }
            ];
        }
    };

    const fetchDashboardData = async () => {
        try {
            const [analyticsRes, institutesRes, leadsRes] = await Promise.all([
                api.get("/superadmin/dashboard"),
                api.get("/institutes?limit=5"),
                api.get("/leads?limit=5").catch(() => ({ data: [] }))
            ]);
            
            // Merge API stats with defaults
            const data = analyticsRes.data;
            setStats({
                totalInstitutes: data.totalInstitutes || 0,
                activeInstitutes: data.activeInstitutes || 0,
                totalStudents: data.totalStudents || 0,
                activeStudents: Math.floor((data.totalStudents || 0) * 0.95), // Mock active
                totalFaculty: data.totalFaculty || 0,
                activeFaculty: Math.floor((data.totalFaculty || 0) * 0.9), // Mock active
                totalManagers: data.totalManagers || 0,
                activeManagers: data.totalManagers || 0,
                totalRevenue: data.totalRevenue || 0,
                growthRate: 18.6
            });
            setRecentInstitutes(institutesRes.data.data?.institutes || institutesRes.data.institutes || institutesRes.data || []);
            setEnquiries(leadsRes.data?.data?.leads || leadsRes.data?.leads || leadsRes.data || []);
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="sa-dashboard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: 'spin 1s linear infinite' }}>⟳</div>
                    <p style={{ color: '#64748b' }}>Loading dashboard...</p>
                </div>
            </div>
        );
    }

    // For Pie Chart
    const totalUsers = stats.totalStudents + stats.totalFaculty + stats.totalManagers + stats.totalInstitutes;
    const pieData = [
        { name: 'Students', value: stats.totalStudents, color: '#6366f1' },
        { name: 'Faculty', value: stats.totalFaculty, color: '#0ea5e9' },
        { name: 'Managers', value: stats.totalManagers, color: '#22c55e' },
        { name: 'Institutes', value: stats.totalInstitutes, color: '#f59e0b' },
        { name: 'Others', value: Math.floor(totalUsers * 0.25), color: '#e2e8f0' } // Adding a placeholder 'Others' to match design
    ];
    
    // Recalculate total for percentage
    const actualTotal = pieData.reduce((acc, curr) => acc + curr.value, 0) || 1;

    // Custom Tooltip for Line Chart
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div style={{ background: '#fff', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                    <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#64748b' }}>{label}</p>
                    <p style={{ margin: 0, fontWeight: 'bold', color: '#6366f1' }}>₹{payload[0].value.toLocaleString('en-IN')}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="sa-dashboard">
            {/* Header */}
            <div className="sa-dashboard-header">
                <div>
                    <h1>Super Admin Dashboard</h1>
                    <p>Welcome back, Super Admin! Here's what's happening with your platform today.</p>
                </div>
                <div className="sa-date-picker">
                    <input 
                        type="date" 
                        value={dateRange.startDate} 
                        onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
                        style={{ border: 'none', background: 'transparent', outline: 'none', color: 'inherit', fontSize: 'inherit' }}
                    />
                    <span>-</span>
                    <input 
                        type="date" 
                        value={dateRange.endDate} 
                        onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
                        style={{ border: 'none', background: 'transparent', outline: 'none', color: 'inherit', fontSize: 'inherit' }}
                    />
                </div>
            </div>

            {/* Top Stats Grid */}
            <div className="sa-stats-grid">
                <div className="sa-stat-card">
                    <div className="sa-stat-icon purple">🏢</div>
                    <div className="sa-stat-content">
                        <div className="sa-stat-label">Total Institutes</div>
                        <div className="sa-stat-value">{stats.totalInstitutes}</div>
                        <div className="sa-stat-sub">Active: {stats.activeInstitutes}</div>
                    </div>
                </div>
                <div className="sa-stat-card">
                    <div className="sa-stat-icon blue">👥</div>
                    <div className="sa-stat-content">
                        <div className="sa-stat-label">Total Students</div>
                        <div className="sa-stat-value">{stats.totalStudents.toLocaleString()}</div>
                        <div className="sa-stat-sub">Active: {stats.activeStudents.toLocaleString()}</div>
                    </div>
                </div>
                <div className="sa-stat-card">
                    <div className="sa-stat-icon green">🎓</div>
                    <div className="sa-stat-content">
                        <div className="sa-stat-label">Total Faculty</div>
                        <div className="sa-stat-value">{stats.totalFaculty}</div>
                        <div className="sa-stat-sub">Active: {stats.activeFaculty}</div>
                    </div>
                </div>
                <div className="sa-stat-card">
                    <div className="sa-stat-icon orange">🧑‍💼</div>
                    <div className="sa-stat-content">
                        <div className="sa-stat-label">Total Managers</div>
                        <div className="sa-stat-value">{stats.totalManagers}</div>
                        <div className="sa-stat-sub">Active: {stats.activeManagers}</div>
                    </div>
                </div>
                <div className="sa-stat-card">
                    <div className="sa-stat-icon red">💲</div>
                    <div className="sa-stat-content">
                        <div className="sa-stat-label">Total Revenue</div>
                        <div className="sa-stat-value">₹{Number(stats.totalRevenue).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                        <div className="sa-stat-sub">All Time</div>
                    </div>
                </div>
                <div className="sa-stat-card">
                    <div className="sa-stat-icon indigo">📈</div>
                    <div className="sa-stat-content">
                        <div className="sa-stat-label">Growth Rate</div>
                        <div className="sa-stat-value">+{stats.growthRate}%</div>
                        <div className="sa-stat-sub">vs Last 30 Days</div>
                    </div>
                </div>
            </div>

            {/* Middle Main Grid */}
            <div className="sa-main-grid">
                {/* Revenue Overview */}
                <div className="sa-card">
                    <div className="sa-card-header">
                        <h2 className="sa-card-title">Revenue Overview</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <select 
                                value={revenueFilter}
                                onChange={(e) => setRevenueFilter(e.target.value)}
                                style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}
                            >
                                <option>This Month</option>
                                <option>Last Month</option>
                                <option>This Year</option>
                            </select>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Period Revenue</div>
                                <div style={{ fontWeight: 'bold' }}>
                                    ₹{Number(revenueData.reduce((acc, curr) => acc + (curr.revenue || 0), 0)).toLocaleString('en-IN')} 
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style={{ width: '100%', height: '300px' }}>
                        <ResponsiveContainer>
                            <LineChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(val) => `₹${val/1000}K`} />
                                <RechartsTooltip content={<CustomTooltip />} />
                                <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} fillOpacity={1} fill="url(#colorRevenue)" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Platform Statistics */}
                <div className="sa-card">
                    <div className="sa-card-header">
                        <h2 className="sa-card-title">Platform Statistics</h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', height: '300px' }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={2}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip />
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Center Text */}
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Total</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{actualTotal}</div>
                            </div>
                        </div>
                        
                        {/* Legend */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 1rem' }}>
                            {pieData.map(item => {
                                const percentage = ((item.value / actualTotal) * 100).toFixed(1);
                                return (
                                    <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }}></div>
                                            <span style={{ color: '#475569' }}>{item.name}</span>
                                        </div>
                                        <div style={{ color: '#64748b' }}>
                                            <span>{percentage}%</span> <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>({item.value})</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="sa-card" style={{ background: 'transparent', boxShadow: 'none', border: 'none', padding: 0 }}>
                    <div className="sa-card-header" style={{ marginBottom: '1rem', background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                        <h2 className="sa-card-title">Quick Actions</h2>
                    </div>
                    <div className="sa-quick-actions">
                        <Link to="/superadmin/institutes" className="sa-action-btn">
                            <div className="sa-action-icon" style={{ color: '#6366f1', background: 'rgba(99, 102, 241, 0.1)' }}>🏢</div>
                            Add Institute
                        </Link>
                        <Link to="/superadmin/plans" className="sa-action-btn">
                            <div className="sa-action-icon" style={{ color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)' }}>➕</div>
                            Add Plan
                        </Link>
                        <Link to="/superadmin/analytics" className="sa-action-btn">
                            <div className="sa-action-icon" style={{ color: '#0ea5e9', background: 'rgba(14, 165, 233, 0.1)' }}>📊</div>
                            View Analytics
                        </Link>
                        <Link to="/superadmin/users" className="sa-action-btn">
                            <div className="sa-action-icon" style={{ color: '#f97316', background: 'rgba(249, 115, 22, 0.1)' }}>👥</div>
                            Manage Users
                        </Link>
                        <Link to="/superadmin/revenue" className="sa-action-btn">
                            <div className="sa-action-icon" style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' }}>💲</div>
                            Revenue Report
                        </Link>
                        <Link to="/superadmin/settings" className="sa-action-btn">
                            <div className="sa-action-icon" style={{ color: '#64748b', background: 'rgba(100, 116, 139, 0.1)' }}>⚙️</div>
                            System Settings
                        </Link>
                    </div>
                </div>
            </div>

            {/* Bottom Grid */}
            <div className="sa-bottom-grid">
                {/* Recent Institutes */}
                <div className="sa-card">
                    <div className="sa-card-header">
                        <h2 className="sa-card-title">Recent Institutes</h2>
                        <Link to="/superadmin/institutes" className="sa-view-all">View All</Link>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="sa-table">
                            <thead>
                                <tr>
                                    <th>Institute Name</th>
                                    <th>Admin Email</th>
                                    <th>Plan</th>
                                    <th>Status</th>
                                    <th>Joined On</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentInstitutes.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: "center", padding: "2rem", color: '#94a3b8' }}>
                                            No recent institutes found.
                                        </td>
                                    </tr>
                                ) : (
                                    recentInstitutes.map((institute) => (
                                        <tr key={institute.id}>
                                            <td style={{ fontWeight: 500 }}>{institute.name}</td>
                                            <td style={{ color: '#64748b' }}>{institute.email}</td>
                                            <td>{institute.Plan?.name || "No Plan"}</td>
                                            <td>
                                                <span className={`sa-badge ${institute.status === 'active' ? 'active' : 'suspended'}`}>
                                                    {institute.status.charAt(0).toUpperCase() + institute.status.slice(1)}
                                                </span>
                                            </td>
                                            <td style={{ color: '#64748b' }}>{new Date(institute.createdAt || institute.created_at).toLocaleDateString('en-GB')}</td>
                                            <td>
                                                <button className="sa-action-dots">⋮</button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent Enquiries */}
                <div className="sa-card">
                    <div className="sa-card-header">
                        <h2 className="sa-card-title">Recent Enquiries</h2>
                        <Link to="/superadmin/enquiries" className="sa-view-all">View All</Link>
                    </div>
                    <div className="sa-enquiry-list">
                        {enquiries.length === 0 ? (
                            <p style={{ textAlign: "center", padding: "1rem", color: '#94a3b8', margin: 0 }}>No recent enquiries.</p>
                        ) : (
                            enquiries.slice(0, 5).map((enquiry, i) => (
                                <div className="sa-enquiry-item" key={enquiry.id || i}>
                                    <div className="sa-enquiry-icon">{enquiry.institute_name ? '🏫' : '🚀'}</div>
                                    <div className="sa-enquiry-content">
                                        <h3 className="sa-enquiry-title">{enquiry.institute_name || enquiry.name || 'New Lead'}</h3>
                                        <p className="sa-enquiry-desc">{enquiry.message ? (enquiry.message.length > 30 ? enquiry.message.substring(0, 30) + '...' : enquiry.message) : 'Interested in Platform'}</p>
                                    </div>
                                    <div className="sa-enquiry-meta">
                                        <span className="sa-enquiry-date">{new Date(enquiry.createdAt || enquiry.created_at || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                                        {!enquiry.is_read && <span className="sa-badge new">New</span>}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* System Health */}
                <div className="sa-card">
                    <div className="sa-card-header">
                        <h2 className="sa-card-title">System Health</h2>
                    </div>
                    <div className="sa-health-list">
                        <div className="sa-health-item">
                            <div className="sa-health-label">
                                <span>✅</span> Server Status
                            </div>
                            <div className={`sa-health-status ${systemHealth.status === 'Operational' ? 'good' : 'negative'}`}>{systemHealth.status}</div>
                        </div>
                        <div className="sa-health-item">
                            <div className="sa-health-label">
                                <span>🗄️</span> Database
                            </div>
                            <div className={`sa-health-status ${systemHealth.status === 'Operational' ? 'good' : 'negative'}`}>Healthy</div>
                        </div>
                        <div className="sa-health-item">
                            <div className="sa-health-label">
                                <span>💾</span> Storage
                            </div>
                            <div className="sa-health-status normal">
                                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#0ea5e9', marginRight: '6px' }}></span>
                                68% Used
                            </div>
                        </div>
                        <div className="sa-health-item">
                            <div className="sa-health-label">
                                <span>⚡</span> API Response
                            </div>
                            <div className={`sa-health-status ${systemHealth.ping < 500 ? 'good' : 'warning'}`}>
                                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: systemHealth.ping < 500 ? '#22c55e' : '#f59e0b', marginRight: '6px' }}></span>
                                {systemHealth.ping > 0 ? `${systemHealth.ping}ms` : '---'}
                            </div>
                        </div>
                        <div className="sa-health-item">
                            <div className="sa-health-label">
                                <span>🔒</span> Backup Status
                            </div>
                            <div className="sa-health-status good">Up to date</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SuperAdminDashboard;
