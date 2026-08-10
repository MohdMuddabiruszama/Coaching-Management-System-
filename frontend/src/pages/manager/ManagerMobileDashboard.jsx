/**
 * ManagerMobileDashboard.jsx
 * Fast, card-based home screen for manager mobile app.
 * 1 API call on load (GET /api/manager/stats) — no heavy operations.
 */
import { useState, useEffect, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import "./ManagerMobileDashboard.css";

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
}

function ManagerMobileDashboard() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = useCallback(async () => {
        try {
            const res = await api.get("/manager/stats");
            if (res.data.success) setStats(res.data.data);
        } catch (e) {
            console.error("Manager stats error:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchStats(); }, [fetchStats]);

    const today = new Date().toLocaleDateString("en-IN", {
        weekday: "long", day: "numeric", month: "short"
    });

    const hasPerm = (featureKey) => {
        const perms = user?.permissions || [];
        return perms.some(p => p === featureKey || p.startsWith(featureKey + '.') || p.startsWith(featureKey + ':') || p === '*');
    };

    const statCards = [
        {
            icon: "👨‍🎓", iconBg: "#dbeafe",
            value: stats?.totalStudents ?? "—",
            label: "Total Students",
            badge: "Active", badgeType: "blue",
            show: hasPerm("students"),
            nav: null,
        },
        {
            icon: "📋", iconBg: "#dcfce7",
            value: stats?.presentToday !== undefined
                ? `${stats.presentToday}/${stats.attendanceToday ?? 0}`
                : "—",
            label: "Today's Attendance",
            badge: stats?.attendanceRate !== undefined ? `${stats.attendanceRate}%` : "",
            badgeType: "green",
            show: hasPerm("attendance"),
            nav: "/manager/attendance",
        },
        {
            icon: "💰", iconBg: "#fef3c7",
            value: stats?.pendingFeesCount ?? "—",
            label: "Pending Fees",
            badge: stats?.pendingFeesCount > 0 ? "Due" : "Clear",
            badgeType: stats?.pendingFeesCount > 0 ? "red" : "green",
            show: hasPerm("fees"),
            nav: "/manager/fees",
        },
        {
            icon: "📊", iconBg: "#f3e8ff",
            value: stats?.totalClasses ?? "—",
            label: "Total Classes",
            badge: "",
            badgeType: "blue",
            show: hasPerm("classes"),
            nav: null,
        },
    ].filter(c => c.show);

    const quickActions = [
        { icon: "📷", label: "Scan Student", nav: "/manager/scanner",         show: hasPerm("attendance"), locked: user?.features?.auto_attendance === false },
        { icon: "📸", label: "Scan Faculty", nav: "/manager/scan-faculty",     show: hasPerm("attendance") },
        { icon: "💰", label: "Pending Fees", nav: "/manager/fees",             show: hasPerm("fees")       },
        { icon: "📊", label: "Tracker",      nav: "/manager/attendance",       show: hasPerm("attendance") },
        { icon: "📝", label: "Mark Student", nav: "/manager/mark-attendance",  show: hasPerm("attendance") },
        { icon: "👨‍🏫", label: "Mark Faculty", nav: "/manager/mark-faculty-attendance", show: hasPerm("attendance") },
        { icon: "📢", label: "Notices",      nav: "/manager/announcements",    show: hasPerm("announcements") },
        { icon: "👤", label: "Profile",      nav: "/manager/profile",          show: true                  },
    ].filter(a => a.show);

    return (
        <div className="mmd-page">
            {/* Greeting Banner */}
            <div className="mmd-greeting-card">
                <p className="mmd-greeting-sub">{getGreeting()} 👋 · {today}</p>
                <h2 className="mmd-greeting-name">{user?.name || "Manager"}</h2>
                <span className="mmd-greeting-role">Manager Dashboard</span>
            </div>

            {/* Stats Grid */}
            {loading ? (
                <div className="mmd-loading">
                    <div className="mmd-spinner" />
                    Loading stats...
                </div>
            ) : (
                statCards.length > 0 && (
                    <div className="mmd-stats-grid">
                        {statCards.map((c, i) => (
                            <div
                                key={i}
                                className="mmd-stat-card"
                                onClick={() => c.nav && navigate(c.nav)}
                                style={{ cursor: c.nav ? "pointer" : "default" }}
                            >
                                <div className="mmd-stat-icon-row">
                                    <div className="mmd-stat-icon" style={{ background: c.iconBg }}>
                                        {c.icon}
                                    </div>
                                    {c.badge && (
                                        <span className={`mmd-stat-badge ${c.badgeType}`}>{c.badge}</span>
                                    )}
                                </div>
                                <p className="mmd-stat-value">{c.value}</p>
                                <p className="mmd-stat-label">{c.label}</p>
                            </div>
                        ))}
                    </div>
                )
            )}

            {/* Quick Actions */}
            <p className="mmd-section-title">Quick Actions</p>
            <div className="mmd-actions-grid">
                {quickActions.map((a, i) => (
                    <button
                        key={i}
                        className={`mmd-action-btn ${a.locked ? 'locked' : ''}`}
                        onClick={() => {
                            if (a.locked) {
                                import("react-hot-toast").then((m) => m.toast.error("Upgrade Required: Smart Attendance is locked in your plan."));
                            } else {
                                navigate(a.nav);
                            }
                        }}
                    >
                        <span>{a.icon}</span>
                        <span>{a.label}</span>
                        {a.locked && <span className="mmd-action-locked">🔒</span>}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default ManagerMobileDashboard;
