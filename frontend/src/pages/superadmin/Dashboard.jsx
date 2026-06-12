/**
 * Super Admin Dashboard
 * Phase 1: Fixed Revenue, Added new stats (Features, Private Schools, Free Trial Users, Managers)
 * Phase 4: ZF Solution Landing Page preview section
 */

import { useState, useEffect, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import ThemeSelector from "../../components/ThemeSelector";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";
import AdvancedStatCard from "../../components/common/AdvancedStatCard";
import "../admin/Dashboard.css";
import "../../components/common/Buttons.css";

function SuperAdminDashboard() {
    const navigate = useNavigate();
    const { logout } = useContext(AuthContext);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalInstitutes: 0,
        activeInstitutes: 0,
        expiredInstitutes: 0,
        totalRevenue: 0,
        monthlyRevenue: 0,
        totalStudents: 0,
        totalFaculty: 0,
        totalManagers: 0,
        totalParents: 0,
        totalPlans: 0,
        totalPrivateSchools: 0,
        totalFreeTrialUsers: 0,
        totalDiscount: 0,
        lifetime: null
    });

    const [recentInstitutes, setRecentInstitutes] = useState([]);
    const [lpPreviewOpen, setLpPreviewOpen] = useState(false);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const [analyticsRes, institutesRes] = await Promise.all([
                api.get("/superadmin/dashboard"),
                api.get("/institutes?limit=5")
            ]);
            setStats(analyticsRes.data);
            setRecentInstitutes(institutesRes.data.data?.institutes || []);
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to logout?")) {
            logout();
            navigate("/login");
        }
    };

    if (loading) {
        return (
            <div className="dashboard-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: 'spin 1s linear infinite' }}>⟳</div>
                    <p style={{ color: 'var(--text-secondary)' }}>Loading dashboard...</p>
                </div>
            </div>
        );
    }

    const safeRevenue = Number(stats.totalRevenue) || 0;
    const safeMonthly = Number(stats.monthlyRevenue) || 0;
    const safeDiscount = Number(stats.totalDiscount) || 0;

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <h1>👑 Super Admin Dashboard</h1>
                    <p>Platform-wide management and analytics</p>
                </div>
                <div className="dashboard-header-right">
                    <ThemeSelector />
                    <button className="animated-btn danger" onClick={handleLogout}>
                        <span className="icon icon-logout">🔒</span>
                        Logout
                    </button>
                </div>
            </div>

            {/* ── Statistics Grid ── */}
            <div className="stats-grid advanced-stats-grid">
                {[
                    { icon: '🏢', value: stats.totalInstitutes, label: 'Total Institutes', colorClass: 'asc-indigo' },
                    { icon: '✅', value: stats.activeInstitutes, label: 'Active Institutes', colorClass: 'asc-green' },
                    { icon: '👨‍🎓', value: stats.totalStudents, label: 'Total Students', colorClass: 'asc-purple' },
                    { icon: '👩‍🏫', value: stats.totalFaculty, label: 'Total Faculty', colorClass: 'asc-pink' },
                    { icon: '🧑‍💼', value: stats.totalManagers, label: 'Total Managers', colorClass: 'asc-cyan' },
                    { icon: '🏫', value: stats.totalPrivateSchools, label: 'Private Schools', colorClass: 'asc-orange' },
                    { icon: '🆓', value: stats.totalFreeTrialUsers, label: 'Free Trial Users', colorClass: 'asc-yellow' },
                    { icon: '🎉', value: `₹${Number(stats.totalDiscount||0).toLocaleString('en-IN')}`, label: 'Platform Discounts', colorClass: 'asc-blue' },
                    { icon: '📋', value: stats.totalPlans, label: 'Active Plans', colorClass: 'asc-indigo' },
                    { icon: '💎', value: stats.lifetime?.total_lifetime_institutes || 0, label: 'Lifetime Members', colorClass: 'asc-purple' },
                    { icon: '🌟', value: stats.lifetime?.founding_members || 0, label: 'Founding Members', colorClass: 'asc-yellow' },
                    { icon: '🔓', value: stats.lifetime?.slots_remaining || 0, label: 'Slots Remaining', colorClass: 'asc-red' },
                ].map(s => (
                    <AdvancedStatCard
                        key={s.label}
                        icon={s.icon}
                        colorClass={s.colorClass}
                        label={s.label}
                        value={s.value}
                    />
                ))}
            </div>

            {/* ── ZF Solution Landing Page Monitor ── */}
            <div className="card" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', color: '#fff', border: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '28px' }}>🎓</span>
                            <h2 style={{ margin: 0, fontSize: '20px', color: '#fff' }}>ZF Solution — Public Landing Page</h2>
                            <span style={{ background: '#22c55e', color: '#fff', fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px' }}>● LIVE</span>
                        </div>
                        <p style={{ margin: 0, color: '#a5b4fc', fontSize: '14px' }}>
                            The public-facing marketing page that onboards new institutes.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <Link to="/" className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', textDecoration: 'none' }}>
                            👁 View Live Page
                        </Link>
                        <button className="btn btn-sm" onClick={() => setLpPreviewOpen(p => !p)} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>
                            {lpPreviewOpen ? '▲ Hide Stats' : '▼ Show Stats'}
                        </button>
                    </div>
                </div>
                {lpPreviewOpen && (
                    <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: '12px' }}>
                        {[
                            { icon: '👁', label: 'Page Views', value: (stats.totalLandingPageViews||0).toLocaleString(), color: '#818cf8' },
                            { icon: '📝', label: 'Registrations', value: stats.totalInstitutes||0, color: '#34d399' },
                            { icon: '💳', label: 'Paid Conversions', value: stats.activeInstitutes||0, color: '#fbbf24' },
                            { icon: '🆓', label: 'Free Trial', value: stats.totalFreeTrialUsers||0, color: '#f87171' },
                        ].map(s => (
                            <div key={s.label} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.2)' }}>
                                <div style={{ fontSize: '22px', marginBottom: '4px' }}>{s.icon}</div>
                                <div style={{ fontSize: '24px', fontWeight: '800', color: s.color }}>{s.value}</div>
                                <div style={{ fontSize: '12px', color: '#c7d2fe' }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Lifetime Access Monitor ── */}
            {stats.lifetime && (
                <div className="card" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, #4c1d95 0%, #6d28d9 50%, #7c3aed 100%)', color: '#fff', border: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <span style={{ fontSize: '32px' }}>💎</span>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>Lifetime Access Program</h2>
                            <p style={{ margin: 0, color: '#c4b5fd', fontSize: '13px' }}>One-time payment — no recurring subscriptions</p>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))', gap: '12px' }}>
                        {[
                            { icon: '💎', label: 'Total Lifetime', value: stats.lifetime.total_lifetime_institutes, color: '#a78bfa' },
                            { icon: '🌟', label: 'Founding Members', value: stats.lifetime.founding_members, color: '#fcd34d' },
                            { icon: '🏦', label: 'Standard Lifetime', value: stats.lifetime.standard_lifetime, color: '#6ee7b7' },
                            { icon: '🔓', label: 'Slots Remaining', value: `${stats.lifetime.slots_remaining} / ${stats.lifetime.slots_total}`, color: stats.lifetime.slots_remaining < 10 ? '#f87171' : '#6ee7b7' },
                            { icon: '💰', label: 'Lifetime Revenue', value: `₹${(stats.lifetime.total_lifetime_revenue || 0).toLocaleString('en-IN')}`, color: '#fbbf24' },
                        ].map(s => (
                            <div key={s.label} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}>
                                <div style={{ fontSize: '20px', marginBottom: '4px' }}>{s.icon}</div>
                                <div style={{ fontSize: '22px', fontWeight: '800', color: s.color }}>{s.value}</div>
                                <div style={{ fontSize: '12px', color: '#ddd6fe' }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Quick Actions ── */}
            <div className="quick-actions">
                <h2>Quick Actions</h2>
                <div className="action-grid">
                    <Link to="/superadmin/institutes" className="action-card">
                        <div className="action-icon">🏢</div>
                        <h3>Manage Institutes</h3>
                        <p>View, suspend, or delete institutes</p>
                    </Link>
                    <Link to="/superadmin/plans" className="action-card">
                        <div className="action-icon">📋</div>
                        <h3>Manage Plans</h3>
                        <p>Create and update subscription plans</p>
                    </Link>
                    <Link to="/superadmin/analytics" className="action-card">
                        <div className="action-icon">📈</div>
                        <h3>Analytics</h3>
                        <p>View detailed platform analytics</p>
                    </Link>
                    <Link to="/superadmin/subscriptions" className="action-card">
                        <div className="action-icon">💳</div>
                        <h3>Subscriptions</h3>
                        <p>Manage all subscriptions</p>
                    </Link>
                    <Link to="/superadmin/revenue" className="action-card">
                        <div className="action-icon">💰</div>
                        <h3>Revenue</h3>
                        <p>View revenue reports</p>
                    </Link>
                    <Link to="/superadmin/expenses" className="action-card">
                        <div className="action-icon">💸</div>
                        <h3>Finances</h3>
                        <p>Track expenses and burn rate</p>
                    </Link>
                    <Link to="/superadmin/settings" className="action-card">
                        <div className="action-icon">⚙️</div>
                        <h3>Settings</h3>
                        <p>Platform settings</p>
                    </Link>
                    <Link to="/superadmin/landing-page" className="action-card" style={{ textDecoration: 'none' }}>
                        <div className="action-icon">🌐</div>
                        <h3>Landing Page</h3>
                        <p>Manage ZF Solution public site</p>
                    </Link>
                    <Link to="/superadmin/institute-limits" className="action-card" style={{ textDecoration: 'none' }}>
                        <div className="action-icon">🔧</div>
                        <h3>Institute Limits</h3>
                        <p>Customize per-institute features & limits</p>
                    </Link>
                    <Link to="/superadmin/enquiries" className="action-card" style={{ textDecoration: 'none', position: 'relative' }}>
                        {stats.unreadEnquiriesCount > 0 && (
                            <span style={{
                                position: 'absolute', top: '12px', right: '12px', background: '#ef4444', color: '#fff',
                                borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                            }}>
                                {stats.unreadEnquiriesCount}
                            </span>
                        )}
                        <div className="action-icon">📬</div>
                        <h3>Enquiries</h3>
                        <p>View contact & demo requests</p>
                    </Link>
                </div>
            </div>

            {/* ── Recent Institutes ── */}
            <div className="card" style={{ marginTop: "2rem" }}>
                <div className="card-header">
                    <h3 className="card-title">Recent Institutes</h3>
                    <Link to="/superadmin/institutes" className="btn btn-sm btn-primary">View All</Link>
                </div>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Status</th>
                                <th>Plan</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentInstitutes.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: "center", padding: "2rem" }}>
                                        No institutes found
                                    </td>
                                </tr>
                            ) : (
                                recentInstitutes.map((institute) => (
                                    <tr key={institute.id}>
                                        <td>{institute.name}</td>
                                        <td>{institute.email}</td>
                                        <td>
                                            <span className={`badge badge-${institute.status === 'active' ? 'success' : institute.status === 'suspended' ? 'warning' : 'danger'}`}>
                                                {institute.status}
                                            </span>
                                        </td>
                                        <td>{institute.Plan?.name || "No Plan"}</td>
                                        <td>{new Date(institute.createdAt || institute.created_at).toLocaleDateString()}</td>
                                        <td>
                                            <Link to={`/superadmin/institute-limits?id=${institute.id}`} className="btn btn-sm btn-primary">
                                                View
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── MOBILE CARD LIST ── */}
                <div className="admin-mobile-cards card-stagger">
                    {recentInstitutes.length === 0 ? (
                        <div className="empty-state-mobile">
                            <div className="empty-icon">🏢</div>
                            <div className="empty-title">No Institutes</div>
                            <div className="empty-desc">No institutes have been registered yet.</div>
                        </div>
                    ) : (
                        recentInstitutes.map((inst) => (
                            <div key={inst.id} className="admin-item-card">
                                <div className="aic-info">
                                    <div className="aic-name">
                                        {inst.name}
                                        <span className="aic-badge">
                                            <span className={`badge badge-${inst.status === 'active' ? 'success' : inst.status === 'suspended' ? 'warning' : 'danger'}`}>
                                                {inst.status}
                                            </span>
                                        </span>
                                    </div>
                                    <div className="aic-sub">{inst.email}</div>
                                    <div className="aic-sub">Plan: {inst.Plan?.name || 'No Plan'} · {new Date(inst.createdAt || inst.created_at).toLocaleDateString()}</div>
                                </div>
                                <div className="aic-actions">
                                    <Link to={`/superadmin/institute-limits?id=${inst.id}`} className="btn btn-sm btn-primary">
                                        View
                                    </Link>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default SuperAdminDashboard;
