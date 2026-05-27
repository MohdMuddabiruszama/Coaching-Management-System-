/**
 * Admin / Manager Dashboard
 * Main dashboard for institute administrators
 */

import { useState, useEffect, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import { AnnouncementSidebarContext } from "../../context/AnnouncementSidebarContext";
import ThemeSelector from "../../components/ThemeSelector";
import BlockedScreen from "./BlockedScreen";
import InstituteLogo from "../../components/common/InstituteLogo";
import SetupGuideModal from "./SetupGuideModal";
import "./Dashboard.css";

function AdminDashboard() {
    const { user, logout } = useContext(AuthContext);
    const { toggleSidebar } = useContext(AnnouncementSidebarContext);
    const navigate = useNavigate();

    const basePath = '/admin';

    const [stats, setStats] = useState({
        totalStudents: 0,
        totalFaculty: 0,
        totalClasses: 0,
        activeStudents: 0,
        totalAdmins: 0,
        totalDiscount: 0,
        totalDue: 0,
    });

    const [planDetails, setPlanDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [blockedFeature, setBlockedFeature] = useState("");
    const [managerStats, setManagerStats] = useState(null);

    // Manager count and list for the admin "Manager System" banner
    const [managers, setManagers] = useState([]);

    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

    useEffect(() => {
        if (user?.role === 'manager' && user?.status === 'blocked') return;

        if (user?.role === 'manager') {
            fetchManagerStats();
        } else {
            fetchStats();
            fetchManagers();
        }
        fetchUsage();
    }, [user]);

    const fetchStats = async () => {
        try {
            const response = await api.get("/admin/stats");
            setStats(response.data.data);
        } catch (error) {
            console.error("Error fetching stats:", error);
        }
    };

    const fetchManagers = async () => {
        try {
            const res = await api.get("/admin/admins");
            if (res.data.success) {
                setManagers(res.data.data.filter(u => u.role === 'manager'));
            }
        } catch (e) {
            // silent — manager list is optional UI enhancement
        }
    };

    const fetchManagerStats = async () => {
        try {
            const response = await api.get("/manager/stats");
            if (response.data.success) setManagerStats(response.data.data);
            const adminRes = await api.get("/admin/stats");
            setStats(adminRes.data.data);
        } catch (error) {
            console.error("Error fetching manager stats:", error);
        }
    };

    const fetchUsage = async () => {
        try {
            const response = await api.get("/admin/usage");
            setPlanDetails(response.data.data);
        } catch (error) {
            console.error("Error fetching usage stats:", error);
        } finally {
            setLoading(false);
        }
    };

    // Phase 2: Blocked managers see the blocked screen immediately
    if (user?.role === 'manager' && user?.status === 'blocked') {
        return <BlockedScreen />;
    }

    const checkFeatureAccess = (featureKey) => {
        if (!planDetails) return { hasAccess: true, featureName: "" };
        const features = planDetails.features;
        let hasAccess = true;
        let featureName = "";

        switch (featureKey) {
            case 'finance':
                if (!features.finance) { hasAccess = false; featureName = "Finance Dashboard"; }
                break;
            case 'salary':
                if (!features.salary) { hasAccess = false; featureName = "Faculty Salary Management"; }
                break;
            case 'attendance':
                if (features.attendance === 'none') { hasAccess = false; featureName = "Attendance Management"; }
                break;
            case 'reports':
                if (features.reports === 'none') { hasAccess = false; featureName = "Reports & Analytics"; }
                break;
            case 'fees':
                if (!features.fees) { hasAccess = false; featureName = "Fee Management"; }
                break;
            case 'announcements':
                if (!features.announcements) { hasAccess = false; featureName = "Announcements"; }
                break;
            case 'auto_attendance':
                if (!features.auto_attendance) { hasAccess = false; featureName = "Smart Attendance (QR)"; }
                break;
            case 'timetable':
                if (!features.timetable) { hasAccess = false; featureName = "Master Timetable"; }
                break;
            case 'exams':
                if (!features.exams) { hasAccess = false; featureName = "Examinations"; }
                break;
            case 'performance_hub':
                if (!features.performance_hub) { hasAccess = false; featureName = "Performance Hub"; }
                break;
            case 'notes':
                if (!features.notes) { hasAccess = false; featureName = "Notes Management"; }
                break;
            case 'chat':
                if (!features.chat) { hasAccess = false; featureName = "Academic Chat"; }
                break;
            case 'assignments':
                if (!features.assignment) { hasAccess = false; featureName = "Assignments"; }
                break;
            case 'expenses':
                if (!features.transport) { hasAccess = false; featureName = "Finances & Transport"; }
                break;
            case 'biometric':
                if (!features.auto_attendance) { hasAccess = false; featureName = "Biometric (Smart Attendance)"; }
                break;
            case 'public_page':
                if (!features.public_page) { hasAccess = false; featureName = "Public Web Page"; }
                break;
            default:
                hasAccess = true;
        }
        return { hasAccess, featureName };
    };

    const handleNavigation = (path, featureKey) => {
        if (!planDetails) { navigate(path); return; }

        const isPlanExpiredLocally = user?.isPlanExpired || (planDetails.plan.is_free_trial && getTrialDaysLeft() <= 0);
        if (isPlanExpiredLocally) { 
            navigate(path); 
            return; 
        }

        const { hasAccess, featureName } = checkFeatureAccess(featureKey);

        if (hasAccess) { navigate(path); }
        else { setBlockedFeature(featureName); setShowUpgradeModal(true); }
    };

    const hasPermission = (featureKey) => {
        if (isAdmin) return true;
        if (user?.role === 'manager') {
            return user.permissions && user.permissions.some(p => p === featureKey || p.startsWith(featureKey + '.'));
        }
        return false;
    };

    const ActionCard = ({ icon, title, path, featureKey, highlight, badge, onClick }) => {
        const isTrialLocked = planDetails && planDetails.plan.is_free_trial && getTrialDaysLeft() <= 0;
        const isPlanExpiredLocally = user?.isPlanExpired || isTrialLocked;
        
        const featureAccess = checkFeatureAccess(featureKey);
        // Only lock if plan is active but feature is missing. Expired plans can view everything read-only.
        const isFeatureLocked = planDetails && !featureAccess.hasAccess && !isPlanExpiredLocally;
        
        const isLocked = isFeatureLocked;

        return (
            <div
                onClick={(e) => {
                    if (isLocked) return;
                    if (onClick) onClick(e);
                    else handleNavigation(path, featureKey);
                }}
                className={`action-card ${isLocked ? 'disabled-card' : ''}`}
                style={{
                    cursor: 'pointer',
                    position: 'relative',
                    ...(highlight ? { borderColor: '#6366f1', boxShadow: '0 0 0 2px rgba(99,102,241,0.3)' } : {}),
                    opacity: isLocked ? 0.6 : 1
                }}
            >
                <span className="action-icon">{icon}</span>
                <span className="action-title">{title}</span>
                {badge > 0 && !isLocked && (
                    <span style={{ position: 'absolute', top: 10, right: 10, background: 'var(--danger, #ef4444)', color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold', zIndex: 10 }}>
                        {badge > 99 ? '99+' : badge}
                    </span>
                )}
                {isLocked && (
                    <div style={{ position: 'absolute', top: 5, right: 5, fontSize: '10px', background: '#e5e7eb', padding: '2px 5px', borderRadius: '4px', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        🔒
                    </div>
                )}
            </div>
        );
    };

    const getTrialDaysLeft = () => {
        if (!planDetails?.institute?.subscription_end) return 0;
        const today = new Date();
        const end = new Date(planDetails.institute.subscription_end);
        end.setHours(23, 59, 59, 999);
        const diff = end - today;
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    };

    if (loading) {
        return (
            <div className="dashboard-container">
                <div className="dashboard-loading">Loading...</div>
            </div>
        );
    }

    // ─── Permission labels for display ───
    const PERM_LABELS = {
        students: '👨‍🎓 Students',
        faculty: '👩‍🏫 Faculty',
        classes: '📚 Classes',
        subjects: '📖 Subjects',
        attendance: '📋 Attendance',
        reports: '📊 Reports',
        fees: '💰 Fees',
        announcements: '📢 Announcements',
        exams: '📝 Exams',
        expenses: '💸 Expenses',
        transport: '🚌 Transport',
        assignments: '📄 Assignments',
        biometric: '🔐 Biometric',
        notes: '📓 Notes',
        chat: '💬 Chat Monitor',
        finance: '📊 Finance Dash',
        salary: '💼 Faculty Salary',
        recent_payments: '🧾 Recent Payments',
    };

    return (
        <div className="dashboard-container">

            {/* ── Header ── */}
            <div className="dashboard-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <InstituteLogo size="md" />
                    <div>
                        <h1>{user?.role === 'manager' ? '👨‍💼 Manager Dashboard' : '🏫 Admin Dashboard'}</h1>
                        <p>Welcome back, <strong>{user?.name}</strong>! {planDetails ? `Plan: ${planDetails.plan.name}` : "Here's what's happening today."}</p>
                    </div>
                </div>
                <div className="dashboard-header-right">
                    <button 
                        className="btn btn-primary" 
                        onClick={() => setShowHelpModal(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: 'none', background: 'var(--primary-color)' }}
                        title="Institute Setup Guide"
                    >
                        <span>❓</span> Guide
                    </button>
                    <ThemeSelector />
                    <button onClick={logout} className="btn btn-danger">Logout</button>
                </div>
            </div>

            {/* ══════════════ LIFETIME MEMBER BANNER ══════════════ */}
            {planDetails?.institute?.is_lifetime_member && (
                <div style={{
                    marginTop: '2rem',
                    padding: '1.25rem 1.75rem',
                    background: 'linear-gradient(135deg, #1a0533 0%, #3b0764 50%, #4c1d95 100%)',
                    border: '1px solid rgba(167,139,250,0.4)',
                    borderRadius: '14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    boxShadow: '0 4px 20px rgba(124,58,237,0.3)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '2rem' }}>💎</span>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem', fontWeight: 700 }}>Lifetime Member</h3>
                                {planDetails.institute.founding_member && (
                                    <span style={{ background: '#f59e0b', color: '#000', fontSize: '10px', fontWeight: 800, padding: '2px 10px', borderRadius: '20px' }}>🌟 FOUNDING</span>
                                )}
                            </div>
                            <p style={{ margin: 0, color: '#c4b5fd', fontSize: '0.88rem' }}>
                                No recurring billing — ever.
                                {planDetails.institute.lifetime_purchased_at && ` Member since ${new Date(planDetails.institute.lifetime_purchased_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}.`}
                            </p>
                        </div>
                    </div>
                    <span style={{ background: 'rgba(167,139,250,0.2)', color: '#e9d5ff', fontSize: '12px', fontWeight: 600, padding: '6px 16px', borderRadius: '20px', border: '1px solid rgba(167,139,250,0.35)' }}>
                        ✓ All Features Unlocked
                    </span>
                </div>
            )}

            {/* ══════════════ TRIAL BANNERS ══════════════ */}
            {planDetails && planDetails.plan.is_free_trial && !planDetails.institute?.is_lifetime_member && (
                <div style={{ marginTop: '2rem' }}>
                    {getTrialDaysLeft() <= 0 ? (
                        <div style={{
                            padding: '1.5rem', background: '#fef2f2', border: '1px solid #ef4444', 
                            borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <div>
                                <h3 style={{ color: '#b91c1c', margin: '0 0 0.5rem 0' }}>Trial Expired</h3>
                                <p style={{ color: '#7f1d1d', margin: 0 }}>Your free trial has ended. You can no longer access features. Please upgrade your plan.</p>
                            </div>
                            <button className="btn btn-primary" onClick={() => navigate("/pricing")} style={{ background: '#ef4444', border: 'none' }}>Upgrade Now</button>
                        </div>
                    ) : getTrialDaysLeft() <= Math.max(2, Math.ceil(planDetails.plan.trial_days * 0.1)) ? (
                        <div style={{
                            padding: '1.5rem', background: '#fffbeb', border: '1px solid #f59e0b', 
                            borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <div>
                                <h3 style={{ color: '#b45309', margin: '0 0 0.5rem 0' }}>Trial Expiring Soon</h3>
                                <p style={{ color: '#92400e', margin: 0 }}>You have reached {Math.floor(((planDetails.plan.trial_days - getTrialDaysLeft()) / planDetails.plan.trial_days) * 100)}% of your free trial. Only {getTrialDaysLeft()} days left.</p>
                            </div>
                            <button className="btn btn-primary" onClick={() => navigate("/pricing")} style={{ background: '#f59e0b', border: 'none' }}>Upgrade Now</button>
                        </div>
                    ) : null}
                </div>
            )}

            {/* ══════════════ STATS ══════════════ */}
            {user?.role === 'manager' && managerStats ? (
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon">💰</div>
                        <div className="stat-content">
                            <h3>₹{parseFloat(managerStats.todayCollection || 0).toLocaleString()}</h3>
                            <p>Today's Collection</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">🔥</div>
                        <div className="stat-content">
                            <h3>₹{parseFloat(managerStats.totalExpenses || 0).toLocaleString()}</h3>
                            <p>Monthly Expenses</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">👨‍🎓</div>
                        <div className="stat-content">
                            <h3>{stats.totalStudents || 0}</h3>
                            <p>Total Students</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">✅</div>
                        <div className="stat-content">
                            <h3>{managerStats.attendanceRate || 0}%</h3>
                            <p>Today's Attendance</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">🏫</div>
                        <div className="stat-content">
                            <h3>{managerStats.presentToday || 0} / {managerStats.attendanceToday || 0}</h3>
                            <p>Present / Marked</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                    <div className="stat-card">
                        <div className="stat-icon">👥</div>
                        <div className="stat-content">
                            <h3>{stats.totalAdmins || 0} / {planDetails?.plan?.max_admin_users || 1}</h3>
                            <p>Total Admins</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">👨‍🎓</div>
                        <div className="stat-content">
                            <h3>{stats.totalStudents} / {planDetails?.usage?.students?.limit || '∞'}</h3>
                            <p>Total Students</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">👩‍🏫</div>
                        <div className="stat-content">
                            <h3>{stats.totalFaculty} / {planDetails?.usage?.faculty?.limit || '∞'}</h3>
                            <p>Total Faculty</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">📚</div>
                        <div className="stat-content">
                            <h3>{stats.totalClasses} / {planDetails?.usage?.classes?.limit || '∞'}</h3>
                            <p>Total Classes</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">✅</div>
                        <div className="stat-content">
                            <h3>{stats.activeStudents}</h3>
                            <p>Active Students</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">🔔</div>
                        <div className="stat-content">
                            <h3>₹{(stats.totalDue || 0).toLocaleString()}</h3>
                            <p>Total Due Fees</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">🎉</div>
                        <div className="stat-content">
                            <h3>₹{(stats.totalDiscount || 0).toLocaleString()}</h3>
                            <p>Total Discount Given</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════ MANAGER SYSTEM BANNER (Admin only) ══════════════ */}
            {isAdmin && (
                <div style={{
                    marginTop: '2rem',
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(168,85,247,0.15) 100%)',
                    border: '1px solid rgba(99,102,241,0.35)',
                    padding: '1.5rem 2rem',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    {/* Decorative glow */}
                    <div style={{
                        position: 'absolute', top: '-40px', right: '-40px',
                        width: '140px', height: '140px', borderRadius: '50%',
                        background: 'rgba(99,102,241,0.2)', filter: 'blur(40px)'
                    }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '1.75rem' }}>👨‍💼</span>
                                <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                                    Manager System
                                </h2>
                                <span style={{
                                    background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                                    color: '#fff', fontSize: '0.72rem', fontWeight: '700',
                                    padding: '2px 10px', borderRadius: '20px', letterSpacing: '0.05em'
                                }}>
                                    PHASE 2 – 11
                                </span>
                            </div>
                            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '560px' }}>
                                Create operational-level managers with granular permission control. Managers can collect fees, record expenses, manage transport, and view attendance — without accessing sensitive financial analytics.
                            </p>
                        </div>
                        <button
                            className="btn btn-primary"
                            onClick={() => navigate('/admin/admins')}
                            style={{
                                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                border: 'none', padding: '0.65rem 1.4rem', borderRadius: '10px',
                                fontWeight: '600', whiteSpace: 'nowrap', fontSize: '0.9rem'
                            }}
                        >
                            👨‍💼 Manage Managers →
                        </button>
                    </div>

                    {/* Manager count + existing manager chips */}
                    <div style={{ marginTop: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{
                            background: 'rgba(99,102,241,0.15)', borderRadius: '10px',
                            padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
                        }}>
                            <span style={{ fontSize: '1.2rem' }}>👨‍💼</span>
                            <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>{managers.length}</span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Active Manager{managers.length !== 1 ? 's' : ''}</span>
                        </div>

                        {managers.length === 0 ? (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                                No managers created yet. Click "Manage Managers" to add one.
                            </span>
                        ) : (
                            managers.map(mgr => (
                                <div key={mgr.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    background: 'rgba(255,255,255,0.08)', borderRadius: '8px',
                                    padding: '0.4rem 0.85rem', border: '1px solid rgba(99,102,241,0.25)'
                                }}>
                                    <div style={{
                                        width: '28px', height: '28px', borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#fff', fontWeight: '700', fontSize: '0.8rem'
                                    }}>
                                        {(mgr.name || 'M')[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>{mgr.name}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                            {Array.isArray(mgr.permissions) && mgr.permissions.length > 0
                                                ? mgr.permissions.slice(0, 3).map(p => PERM_LABELS[p] || p).join(', ') + (mgr.permissions.length > 3 ? ` +${mgr.permissions.length - 3}` : '')
                                                : 'No permissions assigned'}
                                        </div>
                                    </div>
                                    <span style={{
                                        marginLeft: '4px', fontSize: '0.7rem', padding: '1px 7px',
                                        borderRadius: '20px', fontWeight: '600',
                                        background: mgr.status === 'active' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                                        color: mgr.status === 'active' ? '#10b981' : '#ef4444'
                                    }}>
                                        {mgr.status}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Permission key legend */}
                    <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(99,102,241,0.2)', paddingTop: '1rem' }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: '600', letterSpacing: '0.05em' }}>
                            AVAILABLE MANAGER PERMISSIONS:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {Object.entries(PERM_LABELS).map(([key, label]) => (
                                <span key={key} style={{
                                    fontSize: '0.75rem', padding: '2px 10px', borderRadius: '20px',
                                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(99,102,241,0.2)',
                                    color: 'var(--text-primary)'
                                }}>
                                    {label}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════ QUICK ACTIONS ══════════════ */}
            <div className="quick-actions" style={{ marginTop: '2rem' }}>
                <h2>Quick Actions</h2>
                <div className="action-grid">
                    {/* Admin-only: Manage Admins/Managers */}
                    {isAdmin && (
                        <ActionCard path={`${basePath}/admins`} icon="👨‍💼" title="Manage Managers" featureKey="admins" highlight />
                    )}

                    {hasPermission('students') && <ActionCard path={`${basePath}/students`} icon="👨‍🎓" title="Manage Students" featureKey="students" />}
                    {hasPermission('attendance') && <ActionCard path={`${basePath}/attendance`} icon="📋" title="Student Attendance" featureKey="attendance" />}
                    {hasPermission('attendance') && <ActionCard path={`${basePath}/view-attendance`} icon="📊" title="View Attendance" featureKey="attendance" />}
                    {hasPermission('attendance') && <ActionCard path={`${basePath}/smart-attendance`} icon="📸" title="Scan Student QR" featureKey="auto_attendance" />}

                    {hasPermission('classes') && <ActionCard path={`${basePath}/classes`} icon="📚" title="Manage Classes" featureKey="classes" />}

                    {hasPermission('students') && <ActionCard path={`${basePath}/parents`} icon="👨‍👩‍👧" title="Manage Parents" featureKey="students" />}

                    {hasPermission('faculty') && <ActionCard path={`${basePath}/faculty`} icon="👩‍🏫" title="Manage Faculty" featureKey="faculty" />}
                    {hasPermission('attendance') && <ActionCard path={`${basePath}/faculty-attendance`} icon="📋" title="Faculty Attendance" featureKey="attendance" />}
                    {hasPermission('attendance') && <ActionCard path={`${basePath}/view-faculty-attendance`} icon="📊" title="Faculty Tracker" featureKey="attendance" />}
                    {hasPermission('attendance') && <ActionCard path={`${basePath}/scan-faculty-qr`} icon="📸" title="Scan Faculty QR" featureKey="auto_attendance" />}

                    {hasPermission('subjects') && <ActionCard path={`${basePath}/subjects`} icon="📖" title="Manage Subjects" featureKey="subjects" />}

                    {hasPermission('fees') && <ActionCard path={`${basePath}/fees`} icon="💰" title="Collect Fees" featureKey="fees" />}
                    {hasPermission('expenses') && <ActionCard path={`${basePath}/expenses`} icon="💸" title="Finances & Transport" featureKey="expenses" />}
                    {(isAdmin || hasPermission('finance')) && <ActionCard path={`${basePath}/finance`} icon="📊" title="Finance Dashboard" featureKey="finance" highlight />}
                    {(isAdmin || hasPermission('salary')) && <ActionCard path={`${basePath}/salary`} icon="💼" title="Faculty Salary" featureKey="salary" />}

                    {hasPermission('reports') && <ActionCard path={`${basePath}/reports`} icon="📉" title="Reports & Analytics" featureKey="reports" />}
                    {hasPermission('performance_hub') && <ActionCard path={`${basePath}/performance`} icon="📊" title="Performance Hub" featureKey="performance_hub" highlight />}
                    {hasPermission('exams') && <ActionCard path={`${basePath}/exams`} icon="📝" title="Manage Exams" featureKey="exams" />}
                    {hasPermission('classes') && <ActionCard path={`${basePath}/timetable`} icon="📅" title="Master Timetable" featureKey="timetable" />}
                    {hasPermission('announcements') && <ActionCard path={`${basePath}/announcements`} icon="📢" title="Announcements" featureKey="announcements" badge={stats.unreadAnnouncementCount || 0} />}


                    {/* New Notes & Chat Features - Permission gated for managers */}
                    {(isAdmin || hasPermission('assignments')) && <ActionCard path={`${basePath}/assignments`} icon="📝" title="Assignments" featureKey="assignments" />}
                    {(isAdmin || hasPermission('biometric')) && <ActionCard path={`${basePath}/biometric`} icon="🔐" title="Biometric Attendance" featureKey="biometric" />}
                    {(isAdmin || hasPermission('notes')) && <ActionCard path={`${basePath}/notes`} icon="📓" title="All Notes" featureKey="notes" />}
                    {(isAdmin || hasPermission('chat')) && <ActionCard path={`${basePath}/chat-monitor`} icon="💬" title="Chat Monitor" featureKey="chat" badge={stats.unreadChatCount || 0} />}

                    {/* Public Web Page — always visible for admin */}
                    {isAdmin && (
                        <div
                            onClick={() => navigate(`${basePath}/public-page`)}
                            className="action-card"
                            style={{ cursor: 'pointer', position: 'relative', borderColor: '#10b981', boxShadow: '0 0 0 2px rgba(16,185,129,0.2)' }}
                        >
                            <span className="action-icon">🌐</span>
                            <span className="action-title">Public Web Page</span>
                            <span style={{ position: 'absolute', top: 5, right: 5, fontSize: '10px', background: 'rgba(16,185,129,.2)', color: '#10b981', padding: '2px 6px', borderRadius: '6px', fontWeight: 700 }}>NEW</span>
                        </div>
                    )}

                    {isAdmin && (
                        <div onClick={() => navigate(`${basePath}/settings`)} className="action-card" style={{ cursor: 'pointer' }}>
                            <span className="action-icon">⚙️</span>
                            <span className="action-title">Settings</span>
                        </div>
                    )}

                    {/* Lifetime Access — only for non-lifetime admins */}
                    {isAdmin && !planDetails?.institute?.is_lifetime_member && (
                        <div
                            onClick={() => navigate(`${basePath}/lifetime`)}
                            className="action-card"
                            style={{ cursor: 'pointer', background: 'linear-gradient(135deg, #1a0533, #4c1d95)', color: '#fff', border: '1px solid rgba(167,139,250,0.4)', position: 'relative' }}
                        >
                            <span className="action-icon">💎</span>
                            <span className="action-title" style={{ color: '#fff' }}>Lifetime Access</span>
                            <span style={{ position: 'absolute', top: 5, right: 5, fontSize: '10px', background: '#f59e0b', color: '#000', padding: '2px 6px', borderRadius: '6px', fontWeight: 700 }}>HOT</span>
                        </div>
                    )}
                    {isAdmin && planDetails?.institute?.is_lifetime_member && (
                        <div className="action-card" style={{ background: 'linear-gradient(135deg, #1a0533, #4c1d95)', color: '#fff', border: '1px solid rgba(167,139,250,0.4)', cursor: 'default' }}>
                            <span className="action-icon">💎</span>
                            <span className="action-title" style={{ color: '#e9d5ff', fontSize: '12px' }}>Lifetime Member ✓</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ══════════════ MANAGER: RECENT PAYMENTS ══════════════ */}
            {user?.role === 'manager' && (hasPermission('recent_payments') || hasPermission('payment_history')) && managerStats?.recentPayments?.length > 0 && (
                <div className="card" style={{ marginTop: '2rem', padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0 }}>💳 Recent Payments Collected</h3>
                        {hasPermission('fees') && (
                            <button className="btn btn-secondary" style={{ fontSize: '0.85rem' }}
                                onClick={() => navigate(`${basePath}/fees`)}>
                                View All →
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {managerStats.recentPayments.map((p, i) => (
                            <div key={p.id || i} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '0.75rem 1rem', borderRadius: '8px',
                                background: 'var(--card-bg, rgba(0,0,0,0.03))',
                                border: '1px solid var(--border-color)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #10b981, #059669)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#fff', fontWeight: '700', fontSize: '0.9rem'
                                    }}>
                                        {(p.Student?.User?.name || 'S')[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{p.Student?.User?.name || 'Student'}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            {p.payment_method} · {new Date(p.payment_date).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ fontWeight: '700', color: '#10b981', fontSize: '1.05rem' }}>
                                    +₹{parseFloat(p.amount_paid || 0).toLocaleString()}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Upgrade Modal ── */}
            {showUpgradeModal && (
                <div className="modal-overlay" style={{ backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }}>
                    <div className="modal-content" style={{
                        maxWidth: '400px', width: '90%', textAlign: 'center',
                        backgroundColor: 'white', padding: '2rem', borderRadius: '12px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⭐</div>
                        <h2 style={{ color: '#1f2937', marginBottom: '0.5rem' }}>Upgrade Required</h2>
                        <p style={{ margin: '1rem 0', color: '#4b5563', lineHeight: '1.5' }}>
                            {getTrialDaysLeft() <= 0 && planDetails?.plan?.is_free_trial 
                                ? "Your free trial has expired. You need a regular subscription to access features." 
                                : `The ${blockedFeature} feature is not available in your current plan (${planDetails?.plan?.name}).`}
                        </p>
                        <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                            Please upgrade your subscription to gain access.
                        </p>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                            <button className="btn btn-secondary" onClick={() => setShowUpgradeModal(false)}>Close</button>
                            <button className="btn btn-primary" onClick={() => navigate("/pricing")}>Upgrade Now</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Help Guide Modal ── */}
            {showHelpModal && (
                <SetupGuideModal onClose={() => setShowHelpModal(false)} />
            )}
        </div>
    );
}

export default AdminDashboard;
