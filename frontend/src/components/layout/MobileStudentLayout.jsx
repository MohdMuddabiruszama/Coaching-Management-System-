/**
 * MobileStudentLayout — Phase 1B (Enhanced with Section Badges)
 * ─────────────────────────────────────────────────────────────────────────────
 * Native-only layout for the Student app variant.
 * Features:
 *  - Bottom tab navigation with active indicator
 *  - Safe area insets for iOS notch / Android edge-to-edge
 *  - Swipe gesture detection for tab switching
 *  - Section-level update badges (attendance, marks, chat, fees, assignments, etc.)
 *    derived from the CACHED dashboard data — ZERO extra API calls.
 *  - Badges auto-clear when user navigates to that section
 */

import { useState, useContext, useEffect, useRef, useCallback } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { BrandingContext } from "../../context/BrandingContext";
import { AnnouncementSidebarContext } from "../../context/AnnouncementSidebarContext";
import { FiLogOut } from "react-icons/fi";
import { useStudentDashboard } from "../../hooks/useMobileDashboard";
import { useStudentBadges } from "../../hooks/useStudentBadges";

import api from "../../services/api";
import "./MobileStudentLayout.css";

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
    { id: "dashboard",    label: "Home",       icon: "🏠", path: "/student/dashboard"    },
    { id: "attendance",   label: "Attendance", icon: "📅", path: "/student/attendance"   },
    { id: "exams",        label: "Marks",      icon: "📄", path: "/student/exams"        },
    { id: "timetable",    label: "Timetable",  icon: "🗓️", path: "/student/timetable"  },
    { id: "assignments",  label: "Assignments",icon: "📋", path: "/student/assignments"},
    { id: "chat",         label: "Chat",       icon: "💬", path: "/student/chat"         },
    { id: "fees",         label: "Pay Fees",   icon: "💳", path: "/student/fees"         },
    { id: "notes",        label: "Notes",      icon: "📓", path: "/student/notes"        },
    { id: "performance",  label: "Performance",icon: "📊", path: "/student/performance"  },
    { id: "announcements",label: "Notices",    icon: "📢", path: "/student/announcements"},
    { id: "profile",      label: "Profile",    icon: "👤", path: "/student/profile"      },
];

const MobileStudentLayout = () => {
    const { user, logout } = useContext(AuthContext);
    const { logo, name } = useContext(BrandingContext);
    const { toggleSidebar } = useContext(AnnouncementSidebarContext);
    const location = useLocation();
    const navigate = useNavigate();

    const firstName = user?.name ? user.name.split(" ")[0] : "Student";

    const [announcementData, setAnnouncementData]   = useState({ count: 0, highest_priority: null });
    const touchStartX = useRef(null);
    const touchStartY = useRef(null);

    const [headerBgColor, setHeaderBgColor] = useState('normal');
    const [dismissedReminders, setDismissedReminders] = useState([]);

    const { data: dashboardRes } = useStudentDashboard();
    const feesData = dashboardRes?.data?.fees;

    // ── Section badges (zero extra API calls) ─────────────────────────────────────────────
    const { badges, clearBadge, advanceAttendanceCount } = useStudentBadges(dashboardRes?.data, user?.id);

    useEffect(() => {
        if (!feesData?.pendingList) {
            setHeaderBgColor('normal');
            return;
        }

        const getDaysUntil = (dateString) => {
            if (!dateString) return 999;
            const today = new Date();
            today.setHours(0,0,0,0);
            const target = new Date(dateString);
            target.setHours(0,0,0,0);
            const diffTime = target - today;
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        };

        const activeFees = feesData.pendingList.filter(f => !dismissedReminders.includes(f.id));
        
        let isRed = false;
        let isOrange = false;
        
        activeFees.forEach(fee => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let dueOverdue = false;
            if (fee.dueDate) {
                const dueD = new Date(fee.dueDate);
                dueD.setHours(0, 0, 0, 0);
                if (dueD < today) dueOverdue = true;
            }

            let remOverdue = false;
            if (fee.reminderDate) {
                const remD = new Date(fee.reminderDate);
                remD.setHours(0, 0, 0, 0);
                if (remD <= today) remOverdue = true;
            }

            if (dueOverdue || remOverdue) {
                isRed = true;
            } else if (fee.reminderDate) {
                const diffDays = getDaysUntil(fee.reminderDate);
                if (diffDays === 8 || diffDays === 4 || diffDays <= 2) {
                    isOrange = true;
                }
            }
        });

        if (isRed) setHeaderBgColor('red');
        else if (isOrange) setHeaderBgColor('orange');
        else setHeaderBgColor('normal');
    }, [feesData, dismissedReminders]);

    const getHeaderBackground = () => {
        if (headerBgColor === 'red') return 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)';
        if (headerBgColor === 'orange') return 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)';
        return '#ffffff';
    };

    // Fetch unread announcements badge
    useEffect(() => {
        if (user?.features?.announcements) {
            const fetchCount = () => {
                api.get("/announcements/unread-count")
                    .then(res => { if (res.data.success) setAnnouncementData({ count: res.data.count || 0, highest_priority: res.data.highest_priority }); })
                    .catch(() => {});
            };
            fetchCount();
            const interval = setInterval(fetchCount, 60_000); // poll every 60s
            return () => clearInterval(interval);
        }
    }, [user]);

    const unreadCount = announcementData.count;
    const isUrgent = announcementData.highest_priority === "urgent";
    const isHigh = announcementData.highest_priority === "high";

    const BELL_COLORS = {
        urgent: { bg: "#B71C1C", color: "#fff" },
        high:   { bg: "#E65100", color: "#fff" },
        normal: { bg: "#1565C0", color: "#fff" },
        null:   { bg: "transparent", color: "#9E9E9E" },
    };
    const badgeStyle = BELL_COLORS[announcementData.highest_priority] || BELL_COLORS.null;

    // Active tab detection
    const activeTab = TABS.find(t =>
        location.pathname === t.path || location.pathname.startsWith(t.path + "/")
    )?.id ?? "dashboard";

    // Navigate on tab press + clear badge for that section
    const handleTabPress = useCallback((tab) => {
        clearBadge(tab.id);
        navigate(tab.path);
    }, [navigate, clearBadge]);

    // ── Swipe gesture — left/right to change tabs ─────────────────────────────
    const handleTouchStart = useCallback((e) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
    }, []);

    const handleTouchEnd = useCallback((e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        const dy = e.changedTouches[0].clientY - touchStartY.current;

        // Only horizontal swipe (dx > dy and > 60px threshold)
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            const currentIdx = TABS.findIndex(t => t.id === activeTab);
            if (dx < 0 && currentIdx < TABS.length - 1) {
                const nextTab = TABS[currentIdx + 1];
                clearBadge(nextTab.id);
                navigate(nextTab.path);
            } else if (dx > 0 && currentIdx > 0) {
                const prevTab = TABS[currentIdx - 1];
                clearBadge(prevTab.id);
                navigate(prevTab.path);
            }
        }
        touchStartX.current = null;
        touchStartY.current = null;
    }, [activeTab, navigate, clearBadge]);

    return (
        <div className="msl-layout">
            {/* Global Header */}
            <header className="msl-header" style={{ background: getHeaderBackground(), transition: 'background 0.3s ease' }}>
                <div className="msl-header-left">
                    <div className="msl-brand">
                        <div className="msl-brand-logo">
                            <img src={logo} alt="Institute Logo" />
                        </div>
                        <div className="msl-brand-text">
                            <h1>{name || "Institute"}</h1>
                            <p>Student Portal</p>
                        </div>
                    </div>
                </div>
                <div className="msl-header-right">
                    <button className="msl-bell-btn" onClick={toggleSidebar} style={{ position: "relative", padding: "4px" }}>
                        <span style={{
                            fontSize: "22px",
                            filter: unreadCount > 0 ? "none" : "grayscale(1) opacity(0.35)",
                            display: "inline-block",
                            animation: isUrgent ? "bellRing 0.8s infinite" : (isHigh ? "bellRing 0.8s 1" : "none"),
                            transformOrigin: "top center",
                        }}>
                            🔔
                        </span>
                        {unreadCount > 0 && (
                            <span style={{
                                position: "absolute",
                                top: "0px",
                                right: "-2px",
                                background: badgeStyle.bg,
                                color: badgeStyle.color,
                                fontSize: "10px",
                                fontWeight: "bold",
                                borderRadius: "50%",
                                minWidth: "17px",
                                height: "17px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "0 3px",
                                border: "2px solid #fff",
                                boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                                animation: isUrgent ? "pulse 1.5s infinite" : "none",
                                lineHeight: 1,
                            }}>
                                {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                        )}
                    </button>
                    <div className="msl-avatar" onClick={() => navigate('/student/profile')}>
                        {firstName.charAt(0).toUpperCase()}
                        <span className="msl-status-dot"></span>
                    </div>
                    <button 
                        className="msl-logout-btn" 
                        onClick={() => {
                            logout();
                            navigate('/login');
                        }}
                        style={{
                            background: "transparent",
                            border: "none",
                            padding: "6px",
                            marginLeft: "4px",
                            fontSize: "20px",
                            color: "#ef4444",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: "50%",
                            transition: "background 0.2s"
                        }}
                        aria-label="Logout"
                    >
                        <FiLogOut />
                    </button>
                </div>
            </header>

            {/* Main scrollable content area */}
            <main
                className="msl-content"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <Outlet context={{ dismissedReminders, setDismissedReminders, advanceAttendanceCount }} />
            </main>

            {/* Bottom Tab Bar */}
            <nav className="msl-bottom-nav" role="navigation" aria-label="Main navigation">
                {TABS.map(tab => {
                    // Hide feature-gated tabs
                    if (tab.id === "exams"         && !user?.features?.exams)         return null;
                    if (tab.id === "announcements"  && !user?.features?.announcements) return null;

                    const isActive = activeTab === tab.id;

                    // Resolve badge for this tab.
                    // For announcements tab, prefer the live-polled count.
                    let tabBadge = badges[tab.id] || null;
                    if (tab.id === "announcements" && unreadCount > 0) {
                        tabBadge = { count: unreadCount, type: 'number' };
                    }

                    const hasNumberBadge = tabBadge?.type === 'number' && tabBadge.count > 0;
                    const hasDotBadge    = tabBadge?.type === 'dot';
                    const isChatTab      = tab.id === 'chat';
                    const isUrgentBadge  = tab.id === 'announcements' && isUrgent;

                    return (
                        <button
                            key={tab.id}
                            id={`msl-tab-${tab.id}`}
                            className={`msl-nav-item${isActive ? " active" : ""}${tabBadge ? " has-badge" : ""}`}
                            onClick={() => handleTabPress(tab)}
                            aria-label={tab.label}
                            aria-current={isActive ? "page" : undefined}
                        >
                            <span className="msl-tab-icon">
                                {tab.icon}

                                {/* Numeric badge (chat count, marks count, assignments, announcements) */}
                                {hasNumberBadge && (
                                    <span
                                        className={`msl-unread-dot msl-badge-number${isUrgentBadge ? " msl-badge-urgent" : ""}${isChatTab ? " msl-badge-chat" : ""}`}
                                        style={
                                            tab.id === "announcements"
                                                ? { background: badgeStyle.bg, color: badgeStyle.color }
                                                : undefined
                                        }
                                    >
                                        {tabBadge.count > 99 ? "99+" : tabBadge.count}
                                    </span>
                                )}

                                {/* Dot badge (attendance updated today, fees due) */}
                                {hasDotBadge && (
                                    <span className={`msl-update-dot${tab.id === 'fees' ? " msl-update-dot-fees" : ""}`} />
                                )}
                            </span>
                            <span className="msl-tab-label">{tab.label}</span>
                            {isActive && <span className="msl-active-indicator" />}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
};

export default MobileStudentLayout;
