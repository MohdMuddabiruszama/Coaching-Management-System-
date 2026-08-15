/**
 * MobileAdminLayout
 * Bottom tab navigation for Admin native app.
 */

import { useState, useContext, useEffect, useCallback } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import api from "../../services/api";
import InstituteLogo from "../common/InstituteLogo";
import AnnouncementBell from "../AnnouncementBell";
import LogoutConfirmModal from "../common/LogoutConfirmModal";
import "./MobileAdminLayout.css";

const TABS = [
    { id: "dashboard",    label: "Home",       icon: "🏠", path: "/admin/dashboard"    },
    { id: "students",     label: "Students",   icon: "👥", path: "/admin/students"     },
    { id: "faculty",      label: "Faculty",    icon: "👨‍🏫", path: "/admin/faculty"      },
    { id: "announcements",label: "Alerts",     icon: "📢", path: "/admin/announcements"},
    { id: "chat",         label: "Chat",       icon: "💬", path: "/admin/chat-monitor" },
    { id: "profile",      label: "Profile",    icon: "👤", path: "/admin/profile"      },
];

const MobileAdminLayout = () => {
    const { user, logout } = useContext(AuthContext);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const [chatUnread, setChatUnread] = useState(0);

    useEffect(() => {
        if (user?.role === "admin" || user?.role === "manager") {
            api.get("/chat/unread-count")
                .then(r => { if (r.data.success) setChatUnread(r.data.count || 0); })
                .catch(() => {});
        }
    }, [user]);

    const activeTab = TABS.find(t =>
        location.pathname === t.path || location.pathname.startsWith(t.path + "/")
    )?.id ?? "dashboard";

    const handleTabPress = useCallback((tab) => { navigate(tab.path); }, [navigate]);

    return (
        <div className="mal-layout">
            {/* Global Header */}
            <header className="mal-header">
                <div className="mal-inst-brand">
                    <InstituteLogo size="sm" />
                    <div className="mal-inst-text">
                        <h1 className="mal-inst-name">{user?.institute_name || "Admin Panel"}</h1>
                        <p className="mal-inst-portal">Admin Portal</p>
                    </div>
                </div>
                <div className="mal-header-actions">
                    <div className="mal-bell-action">
                        <AnnouncementBell size="medium" />
                    </div>
                    <div className="mal-avatar-action" onClick={() => navigate('/admin/profile')} style={{ cursor: 'pointer' }}>
                        <div className="mal-avatar-circle">
                            {user?.name ? user.name.charAt(0).toUpperCase() : "A"}
                        </div>
                        <span className="mal-online-dot"></span>
                    </div>
                    <button className="mal-logout-action" onClick={() => setIsLogoutModalOpen(true)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    </button>
                </div>
            </header>

            <main className="mal-content">
                <Outlet />
            </main>

            <nav className="mal-bottom-nav" role="navigation" aria-label="Admin navigation">
                {TABS.map(tab => {
                    const isActive = activeTab === tab.id;
                    const hasUnread = tab.id === "chat" && chatUnread > 0;

                    return (
                        <button
                            key={tab.id}
                            id={`mal-tab-${tab.id}`}
                            className={`mal-nav-item${isActive ? " active" : ""}`}
                            onClick={() => handleTabPress(tab)}
                            aria-label={tab.label}
                            aria-current={isActive ? "page" : undefined}
                        >
                            <span className="mal-tab-icon">
                                {tab.icon}
                                {hasUnread && (
                                    <span className="mal-unread-dot">{chatUnread > 9 ? "9+" : chatUnread}</span>
                                )}
                            </span>
                            <span className="mal-tab-label">{tab.label}</span>
                            {isActive && <span className="mal-active-indicator" />}
                        </button>
                    );
                })}
            </nav>
            <LogoutConfirmModal 
                isOpen={isLogoutModalOpen} 
                onClose={() => setIsLogoutModalOpen(false)} 
                onConfirm={() => {
                    logout();
                    navigate('/login');
                }} 
            />
        </div>
    );
};

export default MobileAdminLayout;
