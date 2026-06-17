/**
 * MobileParentLayout — Phase 1B
 * Bottom tab navigation for Parent native app.
 */

import { useRef, useCallback } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import "./MobileParentLayout.css";

const TABS = [
    { id: "dashboard",   label: "Home",       icon: "🏠", path: "/parent/dashboard"   },
    { id: "timetable",   label: "Schedule",   icon: "📆", path: "/parent/timetable"   },
    { id: "assignments", label: "Tasks",      icon: "📋", path: "/parent/assignments" },
    { id: "chat",        label: "Messages",   icon: "💬", path: "/parent/chat"        },
    { id: "profile",     label: "Profile",    icon: "👤", path: "/parent/profile"     },
];

const MobileParentLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const touchStartX = useRef(null);
    const touchStartY = useRef(null);

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
        <div className="mpl-layout">
            <main className="mpl-content" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                <Outlet />
            </main>

            <nav className="mpl-bottom-nav" role="navigation" aria-label="Parent navigation">
                {TABS.map(tab => {
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
        </div>
    );
};

export default MobileParentLayout;
