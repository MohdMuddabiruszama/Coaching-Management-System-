/**
 * MobileParentLayout — Phase 1B
 * Bottom tab navigation for Parent native app.
 */

import { useRef, useCallback, useContext, useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { useParentDashboard } from "../../hooks/useMobileDashboard";
import InstituteLogo from "../common/InstituteLogo";
import AnnouncementBell from "../AnnouncementBell";
import "./MobileParentLayout.css";

const TABS = [
    { id: "dashboard",     label: "Home",          icon: "🏠", path: "/parent/dashboard"     },
    { id: "timetable",     label: "Timetable",     icon: "📆", path: "/parent/timetable"     },
    { id: "attendance",    label: "Attendance",    icon: "📋", path: "/parent/attendance"    },
    { id: "marks",         label: "Marks",         icon: "📈", path: "/parent/marks"         },
    { id: "performance",   label: "Performance",   icon: "📊", path: "/parent/performance"   },
    { id: "fees",          label: "Fees",          icon: "💳", path: "/parent/fees"          },
    { id: "assignments",   label: "Assignments",   icon: "📝", path: "/parent/assignments"   },
    { id: "announcements", label: "Announcements", icon: "📢", path: "/parent/announcements" },
    { id: "chat",          label: "Messages",      icon: "💬", path: "/parent/chat"          },
    { id: "profile",       label: "Profile",       icon: "👤", path: "/parent/profile"       },
];

const MobileParentLayout = ({ children }) => {
    const { user, logout } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();
    const touchStartX = useRef(null);
    const touchStartY = useRef(null);

    const activeTab = TABS.find(t =>
        location.pathname === t.path || location.pathname.startsWith(t.path + "/")
    )?.id ?? "dashboard";

    const [headerBgColor, setHeaderBgColor] = useState('normal');
    const [dismissedReminders, setDismissedReminders] = useState([]);
    const [selectedGlobalChildId, setSelectedGlobalChildId] = useState(sessionStorage.getItem("parentSelectedStudentId"));
    // NOTE: Fee Reminder popup is managed by MobileDashboard.jsx (once-per-session via sessionStorage)
    const { data: dashboardRes } = useParentDashboard();
    
    // ── Header background is now controlled purely by MobileDashboard via Context ────
    
    const getHeaderBackground = () => {
        if (headerBgColor === 'red') return 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)';
        if (headerBgColor === 'orange') return 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)';
        return '#ffffff';
    };


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
        <div className="mpl-layout">
            {/* Global Header */}
            <header className="mpl-header" style={{ background: getHeaderBackground(), transition: 'background 0.3s ease' }}>
                <div className="mpl-inst-brand">
                    <InstituteLogo size="sm" />
                    <div className="mpl-inst-text">
                        <h1 className="mpl-inst-name">{user?.institute_name || "IT Hub"}</h1>
                        <p className="mpl-inst-portal">Parent Portal</p>
                    </div>
                </div>
                <div className="mpl-header-actions">
                    <div className="mpl-bell-action">
                        {user?.features?.announcements !== false && <AnnouncementBell size="medium" />}
                    </div>
                    <div className="mpl-avatar-action" onClick={() => navigate('/parent/profile')} style={{ cursor: 'pointer' }}>
                        <div className="mpl-avatar-circle">
                            {user?.name ? user.name.charAt(0).toUpperCase() : "A"}
                        </div>
                        <span className="mpl-online-dot"></span>
                    </div>
                    <button className="mpl-logout-action" onClick={() => { logout(); navigate('/login'); }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    </button>
                </div>
            </header>

            <main className="mpl-content" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                {children || <Outlet context={{ dismissedReminders, setDismissedReminders, setSelectedGlobalChildId, setHeaderBgColor }} />}
            </main>

            <nav className="mpl-bottom-nav" role="navigation" aria-label="Parent navigation">
                {TABS.map(tab => {
                    let requiredFeature = tab.id;
                    if (tab.id === 'marks' || tab.id === 'performance') requiredFeature = 'exams';
                    if (tab.id === 'assignments') requiredFeature = 'notes';

                    if (tab.id !== "dashboard" && tab.id !== "profile") {
                        if (user?.features && user.features[requiredFeature] === false) {
                            return null;
                        }
                        if (user?.features && user.features[requiredFeature] === 'none') {
                            return null;
                        }
                    }

                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            id={`mpl-tab-${tab.id}`}
                            className={`mpl-nav-item${isActive ? " active" : ""}`}
                            onClick={() => handleTabPress(tab)}
                            aria-label={tab.label}
                            aria-current={isActive ? "page" : undefined}
                        >
                            <span className="mpl-tab-icon">{tab.icon}</span>
                            <span className="mpl-tab-label">{tab.label}</span>
                            {isActive && <span className="mpl-active-indicator" />}
                        </button>
                    );
                })}
            </nav>

            {/* Fee Reminder Modal is rendered inside MobileDashboard.jsx (once-per-session) */}
        </div>
    );
};

export default MobileParentLayout;
