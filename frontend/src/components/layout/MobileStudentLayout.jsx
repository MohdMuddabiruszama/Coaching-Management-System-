/**
 * MobileStudentLayout — Phase 1B
 * ─────────────────────────────────────────────────────────────────────────────
 * Native-only layout for the Student app variant.
 * Features:
 *  - Bottom tab navigation (5 tabs) with active indicator
 *  - Safe area insets for iOS notch / Android edge-to-edge
 *  - Swipe gesture detection for tab switching
 *  - Unread badges on Announcements tab
 *  - Zero desktop sidebar code (pure mobile-first)
 */

import { useState, useContext, useEffect, useRef, useCallback } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { BrandingContext } from "../../context/BrandingContext";
import { AnnouncementSidebarContext } from "../../context/AnnouncementSidebarContext";
import { FiBell } from "react-icons/fi";
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
    const { user } = useContext(AuthContext);
    const { logo, name } = useContext(BrandingContext);
    const { toggleSidebar } = useContext(AnnouncementSidebarContext);
    const location = useLocation();
    const navigate = useNavigate();

    const firstName = user?.name ? user.name.split(" ")[0] : "Student";

    const [unreadCount, setUnreadCount]   = useState(0);
    const touchStartX = useRef(null);
    const touchStartY = useRef(null);

    // Fetch unread announcements badge
    useEffect(() => {
        if (user?.features?.announcements) {
            api.get("/announcements/unread-count")
                .then(res => { if (res.data.success) setUnreadCount(res.data.count || 0); })
                .catch(() => {});
        }
    }, [user]);

    // Active tab detection
    const activeTab = TABS.find(t =>
        location.pathname === t.path || location.pathname.startsWith(t.path + "/")
    )?.id ?? "dashboard";

    // Navigate on tab press
    const handleTabPress = useCallback((tab) => {
        navigate(tab.path);
    }, [navigate]);

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
                navigate(TABS[currentIdx + 1].path);
            } else if (dx > 0 && currentIdx > 0) {
                navigate(TABS[currentIdx - 1].path);
            }
        }
        touchStartX.current = null;
        touchStartY.current = null;
    }, [activeTab, navigate]);

    return (
        <div className="msl-layout">
            {/* Global Header */}
            <header className="msl-header">
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
                    <button className="msl-bell-btn" onClick={toggleSidebar}>
                        <FiBell />
                        {unreadCount > 0 && <span className="msl-bell-dot"></span>}
                    </button>
                    <div className="msl-avatar" onClick={() => navigate('/student/profile')}>
                        {firstName.charAt(0).toUpperCase()}
                        <span className="msl-status-dot"></span>
                    </div>
                </div>
            </header>

            {/* Main scrollable content area */}
            <main
                className="msl-content"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <Outlet />
            </main>

            {/* Bottom Tab Bar */}
            <nav className="msl-bottom-nav" role="navigation" aria-label="Main navigation">
                {TABS.map(tab => {
                    // Hide feature-gated tabs
                    if (tab.id === "exams"         && !user?.features?.exams)         return null;
                    if (tab.id === "announcements"  && !user?.features?.announcements) return null;

                    const isActive = activeTab === tab.id;
                    const hasUnread = tab.id === "announcements" && unreadCount > 0;

                    return (
                        <button
                            key={tab.id}
                            id={`msl-tab-${tab.id}`}
                            className={`msl-nav-item${isActive ? " active" : ""}`}
                            onClick={() => handleTabPress(tab)}
                            aria-label={tab.label}
                            aria-current={isActive ? "page" : undefined}
                        >
                            <span className="msl-tab-icon">
                                {tab.icon}
                                {hasUnread && (
                                    <span className="msl-unread-dot" aria-label={`${unreadCount} unread`}>
                                        {unreadCount > 9 ? "9+" : unreadCount}
                                    </span>
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
