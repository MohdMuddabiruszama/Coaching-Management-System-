/**
 * MobileFacultyLayout — Phase 1B
 * Bottom tab navigation for Faculty native app.
 */

import { useState, useContext, useEffect, useRef, useCallback } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import api from "../../services/api";
import InstituteLogo from "../common/InstituteLogo";
import AnnouncementBell from "../AnnouncementBell";
import "./MobileFacultyLayout.css";

const TABS = [
    { id: "dashboard",    label: "Home",       icon: "🏠", path: "/faculty/dashboard"    },
    { id: "students",     label: "Students",   icon: "👥", path: "/faculty/students"     },
    { id: "attendance",   label: "Attendance", icon: "📋", path: "/faculty/attendance"   },
    { id: "view-attendance", label: "View Att.", icon: "📊", path: "/faculty/view-attendance" },
    { id: "smart-attendance", label: "Scan QR",   icon: "🔳", path: "/faculty/smart-attendance" },
    { id: "marks",        label: "Marks",      icon: "📝", path: "/faculty/marks"        },
    { id: "class-performance", label: "Perform.", icon: "🎯", path: "/faculty/class-performance" },
    { id: "timetable",    label: "Schedule",   icon: "📆", path: "/faculty/timetable"    },
    { id: "announcements",label: "Announce",   icon: "📢", path: "/faculty/announcements"},
    { id: "notes",        label: "Notes",      icon: "📓", path: "/faculty/notes"        },
    { id: "assignments",  label: "Assignments",icon: "📄", path: "/faculty/assignments"  },
    { id: "chat",         label: "Chat",       icon: "💬", path: "/faculty/chat"         },
    { id: "profile",      label: "Profile",    icon: "👤", path: "/faculty/profile"      },
];

const MobileFacultyLayout = () => {
    const { user, logout } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();
    const [chatUnread, setChatUnread] = useState(0);
    const touchStartX = useRef(null);
    const touchStartY = useRef(null);

    useEffect(() => {
        if (user?.features?.chat) {
            api.get("/chat/unread-count")
                .then(r => { if (r.data.success) setChatUnread(r.data.count || 0); })
                .catch(() => {});
        }
    }, [user]);

    const activeTab = TABS.find(t =>
        location.pathname === t.path || location.pathname.startsWith(t.path + "/")
    )?.id ?? "dashboard";

    const handleTabPress = useCallback((tab) => { navigate(tab.path); }, [navigate]);

    const handleTouchStart = useCallback((e) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
    }, []);

    const handleTouchEnd = useCallback((e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        const dy = e.changedTouches[0].clientY - touchStartY.current;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            const currentIdx = TABS.findIndex(t => t.id === activeTab);
            if (dx < 0 && currentIdx < TABS.length - 1) navigate(TABS[currentIdx + 1].path);
            else if (dx > 0 && currentIdx > 0) navigate(TABS[currentIdx - 1].path);
        }
        touchStartX.current = null;
        touchStartY.current = null;
    }, [activeTab, navigate]);

    return (
        <div className="mfl-layout">
            {/* Global Header */}
            <header className="mfl-header">
                <div className="mfl-inst-brand">
                    <InstituteLogo size="sm" />
                    <div className="mfl-inst-text">
                        <h1 className="mfl-inst-name">{user?.institute_name || "IT Hub"}</h1>
                        <p className="mfl-inst-portal">Faculty Portal</p>
                    </div>
                </div>
                <div className="mfl-header-actions">
                    <div className="mfl-bell-action">
                        {user?.features?.announcements !== false && <AnnouncementBell size="medium" />}
                    </div>
                    <div className="mfl-avatar-action" onClick={() => navigate('/faculty/profile')} style={{ cursor: 'pointer' }}>
                        <div className="mfl-avatar-circle">
                            {user?.name ? user.name.charAt(0).toUpperCase() : "F"}
                        </div>
                        <span className="mfl-online-dot"></span>
                    </div>
                    <button className="mfl-logout-action" onClick={() => { logout(); navigate('/login'); }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    </button>
                </div>
            </header>

            <main className="mfl-content" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                <Outlet />
            </main>

            <nav className="mfl-bottom-nav" role="navigation" aria-label="Faculty navigation">
                {TABS.map(tab => {
                    if (tab.id === "marks"     && !user?.features?.exams)    return null;
                    if (tab.id === "timetable" && !user?.features?.timetable) return null;

                    const isActive = activeTab === tab.id;
                    const hasUnread = tab.id === "dashboard" && chatUnread > 0;

                    return (
                        <button
                            key={tab.id}
                            id={`mfl-tab-${tab.id}`}
                            className={`mfl-nav-item${isActive ? " active" : ""}`}
                            onClick={() => handleTabPress(tab)}
                            aria-label={tab.label}
                            aria-current={isActive ? "page" : undefined}
                        >
                            <span className="mfl-tab-icon">
                                {tab.icon}
                                {hasUnread && (
                                    <span className="mfl-unread-dot">{chatUnread > 9 ? "9+" : chatUnread}</span>
                                )}
                            </span>
                            <span className="mfl-tab-label">{tab.label}</span>
                            {isActive && <span className="mfl-active-indicator" />}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
};

export default MobileFacultyLayout;

