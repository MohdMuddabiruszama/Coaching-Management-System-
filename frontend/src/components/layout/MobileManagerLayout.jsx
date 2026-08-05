/**
 * MobileManagerLayout — Manager Mobile App
 * Bottom tab navigation layout for the Manager native app.
 * Pattern mirrors MobileFacultyLayout.jsx exactly.
 */

import { useState, useContext, useEffect, useCallback } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import api from "../../services/api";
import InstituteLogo from "../common/InstituteLogo";
import AnnouncementBell from "../AnnouncementBell";
import LogoutConfirmModal from "../common/LogoutConfirmModal";
import "./MobileManagerLayout.css";



const MobileManagerLayout = () => {
    const { user, logout } = useContext(AuthContext);
    
    const hasPerm = (featureKey) => {
        const perms = user?.permissions || [];
        return perms.some(p => p === featureKey || p.startsWith(featureKey + '.') || p.startsWith(featureKey + ':') || p === '*');
    };

    const TABS = [
        { id: "dashboard",    label: "Home",       icon: "🏠", path: "/manager/dashboard", show: true },
        { id: "scanner",      label: "Scanner",    icon: "📷", path: "/manager/scanner", show: hasPerm('attendance') && user?.features?.auto_attendance !== false },
        { id: "fees",         label: "Fees",       icon: "💰", path: "/manager/fees", show: hasPerm('fees') },
        { id: "attendance",   label: "Attendance", icon: "📊", path: "/manager/attendance", show: hasPerm('attendance') },
        { id: "announcements",label: "Announce",   icon: "📢", path: "/manager/announcements", show: hasPerm('announcements') },
        { id: "profile",      label: "Profile",    icon: "👤", path: "/manager/profile", show: true },
    ].filter(tab => tab.show);

    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const [announcementUnread, setAnnouncementUnread] = useState(0);

    useEffect(() => {
        // Fetch unread announcement count for badge on Announce tab
        api.get("/announcements/unread-count")
            .then(r => { if (r.data?.count) setAnnouncementUnread(r.data.count); })
            .catch(() => {});
    }, []);

    const activeTab = TABS.find(t =>
        location.pathname === t.path || location.pathname.startsWith(t.path + "/")
    )?.id ?? "dashboard";

    const handleTabPress = useCallback((tab) => { navigate(tab.path); }, [navigate]);

    return (
        <div className="mml-layout">
            {/* Global Header */}
            <header className="mml-header">
                <div className="mml-inst-brand">
                    <InstituteLogo size="sm" />
                    <div className="mml-inst-text">
                        <h1 className="mml-inst-name">{user?.institute_name || "Coaching Center"}</h1>
                        <p className="mml-inst-portal">Manager Portal</p>
                    </div>
                </div>
                <div className="mml-header-actions">
                    <div className="mml-bell-action">
                        {user?.features?.announcements !== false && <AnnouncementBell size="medium" />}
                    </div>
                    <div className="mml-avatar-action" onClick={() => navigate('/manager/profile')} style={{ cursor: 'pointer' }}>
                        <div className="mml-avatar-circle">
                            {user?.name ? user.name.charAt(0).toUpperCase() : "M"}
                        </div>
                        <span className="mml-online-dot"></span>
                    </div>
                    <button className="mml-logout-action" onClick={() => setIsLogoutModalOpen(true)} aria-label="Logout">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                    </button>
                </div>
            </header>

            <main className="mml-content">
                <Outlet />
            </main>

            <nav className="mml-bottom-nav" role="navigation" aria-label="Manager navigation">
                {TABS.map(tab => {
                    const isActive = activeTab === tab.id;
                    const hasUnread = tab.id === "announcements" && announcementUnread > 0;

                    return (
                        <button
                            key={tab.id}
                            id={`mml-tab-${tab.id}`}
                            className={`mml-nav-item${isActive ? " active" : ""}`}
                            onClick={() => handleTabPress(tab)}
                            aria-label={tab.label}
                            aria-current={isActive ? "page" : undefined}
                        >
                            <span className="mml-tab-icon">
                                {tab.icon}
                                {hasUnread && (
                                    <span className="mml-unread-dot">
                                        {announcementUnread > 9 ? "9+" : announcementUnread}
                                    </span>
                                )}
                            </span>
                            <span className="mml-tab-label">{tab.label}</span>
                            {isActive && <span className="mml-active-indicator" />}
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

export default MobileManagerLayout;
