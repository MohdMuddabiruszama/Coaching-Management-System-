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
import AdvancedStatCard from "../../components/common/AdvancedStatCard";
import WidgetErrorBoundary from "../../components/common/WidgetErrorBoundary";
import managerAvatarImg from "../../assets/manager_avatar.png";
import blueDiamondImg from "../../assets/blue_diamond.png";
import "./Dashboard.css";

/**
 * ManagerStatsGrid - renders only the stat cards that match the manager's permissions.
 * Separated into its own component to avoid JSX parse issues with IIFEs.
 */
function ManagerStatsGrid({ managerStats, userPerms }) {
    const hasPerm = (...keys) => keys.some(k =>
        userPerms.includes(k) || userPerms.some(p => p.startsWith(k + '.'))
    );
    const cards = [];

    // Phase 1: Fees & Expenses
    if (hasPerm('fees', 'collect_fees')) {
        cards.push({ icon: '💰', value: `₹${parseFloat(managerStats.todayCollection || 0).toLocaleString()}`, label: "Today's Collection", colorClass: 'asc-green', badgeText: "Today", badgeType: "success" });
        cards.push({ icon: '🎉', value: `₹${parseFloat(managerStats.totalDiscount || 0).toLocaleString()}`, label: "Total Discount Given", colorClass: 'asc-yellow' });
    }
    if (hasPerm('expenses')) {
        cards.push({ icon: '🔥', value: `₹${parseFloat(managerStats.totalExpenses || 0).toLocaleString()}`, label: "Monthly Expenses", colorClass: 'asc-red', badgeText: "Monthly", badgeType: "danger" });
    }

    // Phase 2: Data / Records
    if (hasPerm('students')) {
        cards.push({ icon: '👨‍🎓', value: managerStats.totalStudents ?? 0, label: "Total Students", colorClass: 'asc-blue' });
        cards.push({ icon: '✅', value: managerStats.activeStudents ?? 0, label: "Active Students", colorClass: 'asc-indigo', badgeText: "Active", badgeType: "success" });
        cards.push({ icon: '🚫', value: managerStats.blockedStudents ?? 0, label: "Blocked Students", colorClass: 'asc-red' });
    }
    if (hasPerm('faculty')) {
        cards.push({ icon: '👩‍🏫', value: managerStats.totalFaculty ?? 0, label: "Total Faculty", colorClass: 'asc-purple' });
    }
    if (hasPerm('classes')) {
        cards.push({ icon: '📚', value: managerStats.totalClasses ?? 0, label: "Total Classes", colorClass: 'asc-orange' });
    }
    if (hasPerm('subjects')) {
        cards.push({ icon: '📖', value: managerStats.totalSubjects ?? 0, label: "Total Subjects", colorClass: 'asc-cyan' });
    }
    if (hasPerm('parents')) {
        cards.push({ icon: '👨‍👩‍👧', value: managerStats.totalParents ?? 0, label: "Total Parents", colorClass: 'asc-pink' });
    }

    // Phase 3: Academic
    if (hasPerm('exams')) {
        cards.push({ icon: '✍️', value: managerStats.totalExams ?? 0, label: "Total Exams", colorClass: 'asc-indigo' });
    }
    if (hasPerm('notes')) {
        cards.push({ icon: '📓', value: managerStats.totalNotes ?? 0, label: "Total Notes", colorClass: 'asc-purple' });
    }
    if (hasPerm('attendance')) {
        cards.push({ icon: '📋', value: `${managerStats.presentToday ?? 0} / ${managerStats.attendanceToday ?? 0}`, label: "Today's Attendance", colorClass: 'asc-green' });
        cards.push({ icon: '📊', value: `${managerStats.attendanceRate ?? 0}%`, label: "Attendance Rate", colorClass: 'asc-blue' });
    }
    if (hasPerm('assignments')) {
        cards.push({ icon: '📝', value: managerStats.totalAssignments ?? 0, label: "Total Assignments", colorClass: 'asc-orange' });
    }

    if (cards.length === 0) return null;

    return (
        <div className="stats-grid advanced-stats-grid">
            {cards.map((c, i) => (
                <AdvancedStatCard
                    key={i}
                    icon={c.icon}
                    colorClass={c.colorClass}
                    label={c.label}
                    value={c.value}
                    badgeText={c.badgeText}
                    badgeType={c.badgeType}
                />
            ))}
        </div>
    );
}

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
            else setManagerStats({});
        } catch (error) {
            console.error("Error fetching manager stats:", error);
            setManagerStats({});
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

    const handleClearUnread = async (featureKey, path) => {
        try {
            if (featureKey === 'announcements' && stats.unreadAnnouncementCount > 0) {
                setStats(s => ({ ...s, unreadAnnouncementCount: 0 }));
                await api.post("/admin/clear-unread-announcements");
            } else if (featureKey === 'assignments' && stats.unreadAssignmentCount > 0) {
                setStats(s => ({ ...s, unreadAssignmentCount: 0 }));
                await api.post("/admin/clear-unread-assignments");
            } else if (featureKey === 'notes' && stats.unreadNotesCount > 0) {
                setStats(s => ({ ...s, unreadNotesCount: 0 }));
                await api.post("/admin/clear-unread-notes");
            } else if (featureKey === 'chat' && stats.unreadChatCount > 0) {
                setStats(s => ({ ...s, unreadChatCount: 0 }));
                await api.post("/admin/clear-unread-chats");
            } else if (featureKey === 'enquiries' && stats.unreadEnquiryCount > 0) {
                setStats(s => ({ ...s, unreadEnquiryCount: 0 }));
                await api.post("/admin/clear-unread-enquiries");
            }
        } catch (e) {
            console.error("Failed to clear unread counts", e);
        }
        handleNavigation(path, featureKey);
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

    const DACard = ({ icon, bg, title, desc, path, featureKey, subText, badge, onClick }) => {
        const isTrialLocked = planDetails && planDetails.plan.is_free_trial && getTrialDaysLeft() <= 0;
        const isPlanExpiredLocally = user?.isPlanExpired || isTrialLocked;
        
        const featureAccess = checkFeatureAccess(featureKey);
        // Only lock if plan is active but feature is missing. Expired plans can view everything read-only.
        const isFeatureLocked = planDetails && !featureAccess.hasAccess && !isPlanExpiredLocally;
        
        const isLocked = isFeatureLocked;

        return (
            <div
                onClick={(e) => {
                    if (isLocked) {
                        handleNavigation(path, featureKey);
                        return;
                    }
                    if (onClick) onClick(e);
                    else handleNavigation(path, featureKey);
                }}
                className={`da-card ${isLocked ? 'disabled-card' : ''}`}
            >
                <div className="da-card-top">
                    <div className="da-icon-box" style={{ background: bg || '#f3f4f6' }}>
                        {icon}
                    </div>
                    <div className="da-text">
                        <h4>{title}</h4>
                        <p>{desc}</p>
                    </div>
                    <div className="da-arrow">›</div>
                </div>
                {(subText || badge > 0 || isLocked) && (
                    <div className="da-card-bottom">
                        <span className="da-subtext">{subText}</span>
                        {badge > 0 && !isLocked && (
                            <span className="da-badge">
                                {badge > 99 ? '99+' : badge}
                            </span>
                        )}
                        {isLocked && (
                            <span className="da-locked-badge">🔒 Locked</span>
                        )}
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
            <div className="dashboard-header" style={{ marginBottom: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem 0' }}>Here's what's happening with your institute today.</h1>
                </div>
            </div>

            {/* Lifetime member banner moved below stats */}

            {/* ══════════════ TRIAL BANNERS ══════════════ */}
            {isAdmin && planDetails && planDetails.plan.is_free_trial && !planDetails.institute?.is_lifetime_member && (
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
            {user?.role === 'manager' ? (
                managerStats === null ? (
                    <div className="stats-grid advanced-stats-grid">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="advanced-stat-card" style={{ opacity: 0.4, minHeight: '120px', background: 'var(--card-bg)' }} />
                        ))}
                    </div>
                ) : (
                    <ManagerStatsGrid managerStats={managerStats} userPerms={user.permissions || []} />
                )
            ) : (
                <div className="stats-grid advanced-stats-grid">
                    {(() => {
                        const totalAdminsLimit = 1;
                        const usageAdminsLimit = planDetails?.usage?.admin_users?.limit;
                        const totalManagersLimit = usageAdminsLimit === '∞' ? '∞' : Math.max(0, (usageAdminsLimit || 1) - 1);
                        
                        const adminsProgress = Math.min(100, ((stats.totalAdmins || 0) / totalAdminsLimit) * 100).toFixed(1);
                        const managersProgress = totalManagersLimit === '∞' ? '0.0' : (totalManagersLimit > 0 
                            ? Math.min(100, ((stats.totalManagers || 0) / totalManagersLimit) * 100).toFixed(1)
                            : ((stats.totalManagers || 0) > 0 ? 100 : 0).toFixed(1));
                            
                        return (
                            <>
                                <AdvancedStatCard
                                    icon="👥"
                                    colorClass="asc-purple"
                                    label="Total Admins"
                                    value={`${stats.totalAdmins || 0} / ${totalAdminsLimit}`}
                                    subLabel="Active / Total"
                                    progress={adminsProgress}
                                />
                                <AdvancedStatCard
                                    icon="👔"
                                    colorClass="asc-indigo"
                                    label="Total Managers"
                                    value={`${stats.totalManagers || 0} / ${totalManagersLimit}`}
                                    subLabel="Active / Total"
                                    progress={managersProgress}
                                />
                            </>
                        );
                    })()}
                    <AdvancedStatCard
                        icon="👨‍🎓"
                        colorClass="asc-blue"
                        label="Total Students"
                        value={`${stats.totalStudents || 0} / ${planDetails?.usage?.students?.limit || '∞'}`}
                        subLabel="Active / Total"
                        progress={planDetails?.usage?.students?.limit && planDetails.usage.students.limit !== '∞' ? (((stats.totalStudents || 0) / planDetails.usage.students.limit) * 100).toFixed(1) : undefined}
                    />
                    <AdvancedStatCard
                        icon="👩‍🏫"
                        colorClass="asc-green"
                        label="Total Faculty"
                        value={`${stats.totalFaculty || 0} / ${planDetails?.usage?.faculty?.limit || '∞'}`}
                        subLabel="Active / Total"
                        progress={planDetails?.usage?.faculty?.limit && planDetails.usage.faculty.limit !== '∞' ? (((stats.totalFaculty || 0) / planDetails.usage.faculty.limit) * 100).toFixed(1) : undefined}
                    />
                    <AdvancedStatCard
                        icon="📚"
                        colorClass="asc-orange"
                        label="Total Classes"
                        value={`${stats.totalClasses || 0} / ${planDetails?.usage?.classes?.limit || '∞'}`}
                        subLabel="Active / Total"
                        progress={planDetails?.usage?.classes?.limit && planDetails.usage.classes.limit !== '∞' ? (((stats.totalClasses || 0) / planDetails.usage.classes.limit) * 100).toFixed(1) : undefined}
                    />
                    <AdvancedStatCard
                        icon="✅"
                        colorClass="asc-indigo"
                        label="Active Students"
                        value={stats.activeStudents || 0}
                        subLabel="Currently Active"
                        badgeText="Live"
                        badgeType="success"
                    />
                    <AdvancedStatCard
                        icon="🔔"
                        colorClass="asc-red"
                        label="Total Due Fees"
                        value={`₹${(stats.totalDue || 0).toLocaleString()}`}
                        subLabel="Pending Collection"
                        badgeText="Due"
                        badgeType="danger"
                    />
                    <AdvancedStatCard
                        icon="🎉"
                        colorClass="asc-yellow"
                        label="Total Discount Given"
                        value={`₹${(stats.totalDiscount || 0).toLocaleString()}`}
                        subLabel="This Lifetime"
                        badgeText="Discount"
                        badgeType="warning"
                    />
                </div>
            )}


            {/* ══════════════ LIFETIME MEMBER BANNER ══════════════ */}
            {isAdmin && planDetails?.institute?.is_lifetime_member && (
                <div className="premium-lifetime-banner">
                    <div className="plb-content-left">
                        <div className="plb-icon-box">
                            <img src={blueDiamondImg} alt="Diamond" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                        </div>
                        <div className="plb-text">
                            <div className="plb-title-row">
                                <h3 className="plb-title">Lifetime Member</h3>
                                {planDetails.institute.founding_member && (
                                    <span className="plb-badge">🌟 FOUNDING</span>
                                )}
                            </div>
                            <p className="plb-desc">
                                No recurring billing — ever.
                                {planDetails.institute.lifetime_purchased_at && ` Member since ${new Date(planDetails.institute.lifetime_purchased_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}.`}
                            </p>
                        </div>
                    </div>
                    <div className="plb-content-right">
                        <button className="plb-btn" onClick={() => window.open('/features', '_blank')}>
                            <img src={blueDiamondImg} alt="" style={{ width: '16px', height: '16px' }} /> View All Features
                        </button>
                        <img src={blueDiamondImg} className="plb-diamond-bg" alt="" />
                    </div>
                </div>
            )}


            {/* ══════════════ MANAGER SYSTEM BANNER (Admin only) ══════════════ */}
            {isAdmin && (
                <div className="premium-manager-banner">
                    <div className="pmb-main">
                        <div className="pmb-left">
                            <div className="pmb-illustration">
                                <img src={managerAvatarImg} alt="Manager" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', mixBlendMode: 'multiply' }} />
                            </div>
                            <div className="pmb-text">
                                <div className="pmb-title-row">
                                    <h2 className="pmb-title">Manager System</h2>
                                    <span className="pmb-badge">PHASE 2 – 11</span>
                                </div>
                                <p className="pmb-desc">
                                    Create operational-level managers with granular permission control. Managers can collect fees, record expenses, manage transport, and view attendance — without full admin access.
                                </p>
                            </div>
                        </div>

                        <div className="pmb-center-grid">
                            <div className="pmb-feature-card">
                                <div className="pmb-fc-icon" style={{color: '#ec4899', background: '#fce7f3'}}>🎯</div>
                                <div className="pmb-fc-text">
                                    <h4>Permission Control</h4>
                                    <p>Granular access management</p>
                                </div>
                            </div>
                            <div className="pmb-feature-card">
                                <div className="pmb-fc-icon" style={{color: '#f59e0b', background: '#fef3c7'}}>🏢</div>
                                <div className="pmb-fc-text">
                                    <h4>Financial Oversight</h4>
                                    <p>Fees, Expenses & Reports</p>
                                </div>
                            </div>
                            <div className="pmb-feature-card">
                                <div className="pmb-fc-icon" style={{color: '#10b981', background: '#dcfce7'}}>🚌</div>
                                <div className="pmb-fc-text">
                                    <h4>Transport Management</h4>
                                    <p>Manage vehicles & routes</p>
                                </div>
                            </div>
                            <div className="pmb-feature-card">
                                <div className="pmb-fc-icon" style={{color: '#3b82f6', background: '#dbeafe'}}>📅</div>
                                <div className="pmb-fc-text">
                                    <h4>Attendance Access</h4>
                                    <p>View & manage attendance</p>
                                </div>
                            </div>
                        </div>

                        <div className="pmb-right">
                            <button className="pmb-btn" onClick={() => navigate('/admin/admins')}>
                                Manage Managers →
                            </button>
                        </div>
                    </div>

                </div>
            )}

            {/* ══════════════ QUICK ACTIONS ══════════════ */}
            <div className="dashboard-actions-wrapper">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', color: 'var(--text-primary)' }}>Quick Actions</h2>
                        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Frequently used actions and shortcuts</p>
                    </div>
                </div>

                {/* STUDENT MANAGEMENT */}
                {(hasPermission('students') || hasPermission('attendance')) && (
                <WidgetErrorBoundary title="Student Management">
                <div className="da-section">
                    <div className="da-section-header">
                        <h3>Student Management</h3>
                        <p>Manage students, parents and their academic journey</p>
                    </div>
                    <div className="da-grid">
                        {hasPermission('students') && (
                            <DACard icon="👥" bg="#f3e8ff" title="Manage Students" desc="Add, edit and manage student records" path={`${basePath}/students`} featureKey="students" subText={`${stats.totalStudents || 0} Students`} />
                        )}
                        {hasPermission('attendance') && (
                            <DACard icon="📋" bg="#e0f2fe" title="Student Attendance" desc="Mark and view student attendance" path={`${basePath}/attendance`} featureKey="attendance" />
                        )}
                        {hasPermission('attendance') && (
                            <DACard icon="📊" bg="#ecfdf5" title="View Attendance" desc="View attendance summary and reports" path={`${basePath}/view-attendance`} featureKey="attendance" />
                        )}
                        {hasPermission('attendance') && (
                            <DACard icon="📸" bg="#fef3c7" title="Scan Student QR" desc="Scan QR and mark student attendance" path={`${basePath}/smart-attendance`} featureKey="auto_attendance" subText="Quick Attendance" />
                        )}
                        {hasPermission('students') && (
                            <DACard icon="👨‍👩‍👧" bg="#fce7f3" title="Manage Parents" desc="View and manage parent information" path={`${basePath}/parents`} featureKey="students" />
                        )}
                    </div>
                </div>
                </WidgetErrorBoundary>
                )}

                {/* FACULTY MANAGEMENT */}
                {(hasPermission('faculty') || hasPermission('attendance') || hasPermission('salary')) && (
                <WidgetErrorBoundary title="Faculty Management">
                <div className="da-section">
                    <div className="da-section-header">
                        <h3>Faculty Management</h3>
                        <p>Manage faculty, attendance and payroll</p>
                    </div>
                    <div className="da-grid">
                        {hasPermission('faculty') && (
                            <DACard icon="👩‍🏫" bg="#dcfce7" title="Manage Faculty" desc="Add, edit and manage faculty records" path={`${basePath}/faculty`} featureKey="faculty" subText={`${stats.totalFaculty || 0} Faculty`} />
                        )}
                        {hasPermission('attendance') && (
                            <DACard icon="📋" bg="#ffedd5" title="Faculty Attendance" desc="Mark and view faculty attendance" path={`${basePath}/faculty-attendance`} featureKey="attendance" />
                        )}
                        {hasPermission('attendance') && (
                            <DACard icon="📊" bg="#e0e7ff" title="Faculty Tracker" desc="View faculty performance and summary" path={`${basePath}/view-faculty-attendance`} featureKey="attendance" subText="Performance Hub" />
                        )}
                        {hasPermission('attendance') && (
                            <DACard icon="📸" bg="#fef3c7" title="Scan Faculty QR" desc="Scan QR and mark faculty attendance" path={`${basePath}/scan-faculty-qr`} featureKey="auto_attendance" subText="Quick Attendance" />
                        )}
                        {(isAdmin || hasPermission('salary')) && (
                            <DACard icon="💼" bg="#fae8ff" title="Faculty Salary" desc="Manage faculty salaries and payments" path={`${basePath}/salary`} featureKey="salary" />
                        )}
                    </div>
                </div>
                </WidgetErrorBoundary>
                )}

                {/* ACADEMIC MANAGEMENT */}
                {(hasPermission('classes') || hasPermission('subjects') || hasPermission('timetable') || hasPermission('exams') || hasPermission('assignments') || hasPermission('notes')) && (
                <WidgetErrorBoundary title="Academic Management">
                <div className="da-section">
                    <div className="da-section-header">
                        <h3>Academic Management</h3>
                        <p>Classes, subjects, exams and academic setup</p>
                    </div>
                    <div className="da-grid">
                        {hasPermission('classes') && (
                            <DACard icon="📚" bg="#e0f2fe" title="Manage Classes" desc="View and manage all classes" path={`${basePath}/classes`} featureKey="classes" subText={`${stats.totalClasses || 0} Classes`} />
                        )}
                        {hasPermission('subjects') && (
                            <DACard icon="📖" bg="#f3e8ff" title="Manage Subjects" desc="Subjects & topics" path={`${basePath}/subjects`} featureKey="subjects" />
                        )}
                        {hasPermission('timetable') && (
                            <DACard icon="📅" bg="#ffedd5" title="Master Timetable" desc="Create and manage timetable" path={`${basePath}/timetable`} featureKey="timetable" />
                        )}
                        {hasPermission('exams') && (
                            <DACard icon="✍️" bg="#fef3c7" title="Manage Exams" desc="Create and manage examinations" path={`${basePath}/exams`} featureKey="exams" />
                        )}
                        {(isAdmin || hasPermission('assignments')) && (
                            <DACard icon="📝" bg="#e0e7ff" title="Assignments" desc="Create and manage assignments" path={`${basePath}/assignments`} featureKey="assignments" badge={stats.unreadAssignmentCount || 0} onClick={() => handleClearUnread('assignments', `${basePath}/assignments`)} />
                        )}
                        {(isAdmin || hasPermission('notes')) && (
                            <DACard icon="📓" bg="#fce7f3" title="All Notes" desc="Store and manage notes" path={`${basePath}/notes`} featureKey="notes" badge={stats.unreadNotesCount || 0} onClick={() => handleClearUnread('notes', `${basePath}/notes`)} />
                        )}
                    </div>
                </div>
                </WidgetErrorBoundary>
                )}

                {/* FINANCE & ACCOUNTS */}
                {(hasPermission('fees') || hasPermission('collect_fees') || hasPermission('expenses') || hasPermission('finance') || hasPermission('reports') || hasPermission('performance_hub')) && (
                <WidgetErrorBoundary title="Financial Management">
                <div className="da-section">
                    <div className="da-section-header">
                        <h3>Finance & Accounts</h3>
                        <p>Handle fees, expenses, salary and financial reports</p>
                    </div>
                    <div className="da-grid">
                        {(hasPermission('fees') || hasPermission('collect_fees')) && (
                            <DACard icon="💰" bg="#dcfce7" title="Collect Fees" desc="Collect and manage student fees" path={`${basePath}/fees`} featureKey="fees" />
                        )}
                        {hasPermission('expenses') && (
                            <DACard icon="💸" bg="#e0f2fe" title="Finances & Transport" desc="Manage transport and finances" path={`${basePath}/expenses`} featureKey="expenses" />
                        )}
                        {(isAdmin || hasPermission('finance')) && (
                            <DACard icon="🏦" bg="#e0e7ff" title="Finance Dashboard" desc="Overview of financial summary" path={`${basePath}/finance`} featureKey="finance" />
                        )}
                        {hasPermission('reports') && (
                            <DACard icon="📉" bg="#fae8ff" title="Reports & Analytics" desc="Detailed reports and insights" path={`${basePath}/reports`} featureKey="reports" />
                        )}
                        {hasPermission('performance_hub') && (
                            <DACard icon="🎯" bg="#fce7f3" title="Performance Hub" desc="Track performance and KPIs" path={`${basePath}/performance`} featureKey="performance_hub" />
                        )}
                    </div>
                </div>
                </WidgetErrorBoundary>
                )}

                {/* SYSTEM & COMMUNICATION */}
                {(isAdmin || hasPermission('announcements') || hasPermission('chat') || hasPermission('biometric')) && (
                <WidgetErrorBoundary title="System & Communication">
                <div className="da-section">
                    <div className="da-section-header">
                        <h3>System & Communication</h3>
                        <p>Communication, system settings and public access</p>
                    </div>
                    <div className="da-grid">
                        {isAdmin && (
                            <DACard icon="👨‍💼" bg="#f3f4f6" title="Manage Managers" desc="Create and manage admins/managers" path={`${basePath}/admins`} featureKey="admins" />
                        )}
                        {hasPermission('announcements') && (
                            <DACard icon="📢" bg="#fee2e2" title="Announcements" desc="Send important announcements" path={`${basePath}/announcements`} featureKey="announcements" badge={stats.unreadAnnouncementCount || 0} onClick={() => handleClearUnread('announcements', `${basePath}/announcements`)} />
                        )}
                        {(isAdmin || hasPermission('chat')) && (
                            <DACard icon="💬" bg="#e0e7ff" title="Chat Monitor" desc="Monitor all chat activities" path={`${basePath}/chat-monitor`} featureKey="chat" badge={stats.unreadChatCount || 0} onClick={() => handleClearUnread('chat', `${basePath}/chat-monitor`)} />
                        )}
                        {(isAdmin || hasPermission('biometric')) && (
                            <DACard icon="🔐" bg="#dcfce7" title="Biometric Attendance" desc="Biometric based attendance" path={`${basePath}/biometric`} featureKey="biometric" />
                        )}
                        {isAdmin && (
                            <DACard icon="🌐" bg="#ecfeff" title="Public Web Page" desc="Manage public website" path={`${basePath}/public-page`} featureKey="public_page" badge={stats.unreadEnquiryCount || 0} subText="NEW" />
                        )}
                        {isAdmin && (
                            <DACard icon="⚙️" bg="#f3f4f6" title="Settings" desc="System settings and preferences" path={`${basePath}/settings`} featureKey="settings" />
                        )}
                        
                        {isAdmin && !planDetails?.institute?.is_lifetime_member && (
                            <div
                                onClick={() => handleNavigation(`${basePath}/lifetime`)}
                                className="da-card"
                                style={{ background: 'linear-gradient(135deg, #1a0533, #4c1d95)', color: '#fff', border: '1px solid rgba(167,139,250,0.4)' }}
                            >
                                <div className="da-card-top">
                                    <div className="da-icon-box" style={{ background: 'rgba(255,255,255,0.1)' }}>💎</div>
                                    <div className="da-text">
                                        <h4 style={{ color: '#fff' }}>Lifetime Access</h4>
                                        <p style={{ color: 'rgba(255,255,255,0.7)' }}>Upgrade to lifetime</p>
                                    </div>
                                    <div className="da-arrow" style={{ color: 'rgba(255,255,255,0.5)' }}>›</div>
                                </div>
                                <div className="da-card-bottom">
                                    <span className="da-badge" style={{ background: '#f59e0b', color: '#000' }}>HOT</span>
                                </div>
                            </div>
                        )}
                        {isAdmin && planDetails?.institute?.is_lifetime_member && (
                            <div className="da-card disabled-card" style={{ background: 'linear-gradient(135deg, #1a0533, #4c1d95)', color: '#fff', border: '1px solid rgba(167,139,250,0.4)', opacity: 1, filter: 'none' }}>
                                <div className="da-card-top">
                                    <div className="da-icon-box" style={{ background: 'rgba(255,255,255,0.1)' }}>💎</div>
                                    <div className="da-text">
                                        <h4 style={{ color: '#fff' }}>Lifetime Member</h4>
                                        <p style={{ color: '#e9d5ff' }}>You are a lifetime member<br/>Enjoy all premium features</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                </WidgetErrorBoundary>
                )}
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
        </div>
    );
}

export default AdminDashboard;
