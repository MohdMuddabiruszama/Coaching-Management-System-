import { useContext, useState, useEffect, useRef } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import ThemeSelector from "../ThemeSelector";
import logoImg from "../../assets/zf-logo.png";
import "./SuperAdminLayout.css";

const SuperAdminLayout = () => {
    const { user, logout } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    
    // --- Search & Profile functionality ---
    const [searchQuery, setSearchQuery] = useState("");
    const [profileOpen, setProfileOpen] = useState(false);
    const profileRef = useRef(null);

    // Click outside to close profile dropdown
    useEffect(() => {
        function handleClickOutside(event) {
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setProfileOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const navLinkClass = (path) => {
        const isMatch = location.pathname === path || location.pathname.startsWith(path + '/');
        return isMatch ? "sal-nav-link active" : "sal-nav-link";
    };

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to logout?")) {
            logout();
            navigate("/login");
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/superadmin/institutes?search=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    return (
        <div className={`superadmin-layout ${sidebarOpen ? 'sidebar-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            {/* Sidebar Overlay for Mobile */}
            {sidebarOpen && (
                <div className="sal-sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>
            )}

            {/* Left Sidebar */}
            <aside className="sal-sidebar">
                <div className="sal-sidebar-header">
                    <div className="sal-logo" onClick={() => navigate('/superadmin/dashboard')} style={{ cursor: 'pointer' }}>
                        <div className="sal-logo-icon" style={{ 
                            width: '36px', 
                            height: '36px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                        }}>
                            <img src={logoImg} alt="ZF Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px' }} />
                        </div>
                        <div className="sal-logo-text">ZenithFlows</div>
                    </div>
                    <button className="sal-sidebar-close" onClick={() => setSidebarOpen(false)}>✕</button>
                </div>

                <div className="sal-sidebar-menu">
                    <Link to="/superadmin/dashboard" className={navLinkClass('/superadmin/dashboard')} onClick={() => setSidebarOpen(false)}>
                        <span className="sal-nav-icon">🏠</span>
                        <span className="sal-nav-text">Dashboard</span>
                    </Link>

                    <div className="sal-nav-section">MANAGEMENT</div>
                    <Link to="/superadmin/institutes" className={navLinkClass('/superadmin/institutes')} onClick={() => setSidebarOpen(false)}>
                        <span className="sal-nav-icon">🏢</span>
                        <span className="sal-nav-text">Institutes</span>
                    </Link>
                    <Link to="/superadmin/institute-limits" className={navLinkClass('/superadmin/institute-limits')} onClick={() => setSidebarOpen(false)}>
                        <span className="sal-nav-icon">📊</span>
                        <span className="sal-nav-text">Institute Limits</span>
                    </Link>
                    <Link to="/superadmin/plans" className={navLinkClass('/superadmin/plans')} onClick={() => setSidebarOpen(false)}>
                        <span className="sal-nav-icon">📋</span>
                        <span className="sal-nav-text">Plans & Pricing</span>
                    </Link>
                    <Link to="/superadmin/subscriptions" className={navLinkClass('/superadmin/subscriptions')} onClick={() => setSidebarOpen(false)}>
                        <span className="sal-nav-icon">💳</span>
                        <span className="sal-nav-text">Subscriptions</span>
                    </Link>
                    <Link to="/superadmin/users" className={navLinkClass('/superadmin/users')} onClick={() => setSidebarOpen(false)}>
                        <span className="sal-nav-icon">👥</span>
                        <span className="sal-nav-text">Users</span>
                    </Link>
                    <Link to="/superadmin/enquiries" className={navLinkClass('/superadmin/enquiries')} onClick={() => setSidebarOpen(false)}>
                        <span className="sal-nav-icon">📬</span>
                        <span className="sal-nav-text">Enquiries</span>
                    </Link>

                    <div className="sal-nav-section">ANALYTICS</div>
                    <Link to="/superadmin/analytics" className={navLinkClass('/superadmin/analytics')} onClick={() => setSidebarOpen(false)}>
                        <span className="sal-nav-icon">📈</span>
                        <span className="sal-nav-text">Analytics</span>
                    </Link>
                    <Link to="/superadmin/revenue" className={navLinkClass('/superadmin/revenue')} onClick={() => setSidebarOpen(false)}>
                        <span className="sal-nav-icon">💰</span>
                        <span className="sal-nav-text">Revenue</span>
                    </Link>
                    <Link to="/superadmin/expenses" className={navLinkClass('/superadmin/expenses')} onClick={() => setSidebarOpen(false)}>
                        <span className="sal-nav-icon">💸</span>
                        <span className="sal-nav-text">Expenses</span>
                    </Link>
                    <Link to="/superadmin/reports" className={navLinkClass('/superadmin/reports')} onClick={() => setSidebarOpen(false)}>
                        <span className="sal-nav-icon">📄</span>
                        <span className="sal-nav-text">Reports</span>
                    </Link>

                    <div className="sal-nav-section">PLATFORM</div>
                    <Link to="/superadmin/landing-page" className={navLinkClass('/superadmin/landing-page')} onClick={() => setSidebarOpen(false)}>
                        <span className="sal-nav-icon">🌐</span>
                        <span className="sal-nav-text">Landing Page</span>
                    </Link>
                    <Link to="/superadmin/settings" className={navLinkClass('/superadmin/settings')} onClick={() => setSidebarOpen(false)}>
                        <span className="sal-nav-icon">⚙️</span>
                        <span className="sal-nav-text">Settings</span>
                    </Link>
                    <Link to="/superadmin/system-logs" className={navLinkClass('/superadmin/system-logs')} onClick={() => setSidebarOpen(false)}>
                        <span className="sal-nav-icon">📋</span>
                        <span className="sal-nav-text">System Logs</span>
                    </Link>
                </div>

                <div className="sal-sidebar-footer">
                    <div className="sal-support-card">
                        <div className="sal-support-icon">🎧</div>
                        <div className="sal-support-content">
                            <h4>Need Help?</h4>
                            <p>Contact Support</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Right Content Area */}
            <div className="sal-main">
                {/* Top Navbar */}
                <header className="sal-topbar">
                    <div className="sal-topbar-left">
                        <button className="sal-desktop-toggle" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="4" y1="12" x2="20" y2="12"></line>
                                <line x1="4" y1="6" x2="20" y2="6"></line>
                                <line x1="4" y1="18" x2="20" y2="18"></line>
                            </svg>
                        </button>
                        <button className="sal-mobile-toggle" onClick={() => setSidebarOpen(true)}>☰</button>
                    </div>

                    <div className="sal-topbar-search">
                        <form className="sal-search-container" onSubmit={handleSearch}>
                            <span className="sal-search-icon">🔍</span>
                            <input 
                                type="text" 
                                placeholder="Search anything..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </form>
                    </div>

                    <div className="sal-topbar-right">
                        <ThemeSelector />
                        
                        <button className="sal-notification-btn" title="Notifications">
                            <span className="sal-icon">🔔</span>
                            <span className="sal-notification-badge">8</span>
                        </button>

                        <div className="sal-profile-container" ref={profileRef} style={{ position: 'relative' }}>
                            <div className="sal-profile" onClick={() => setProfileOpen(!profileOpen)}>
                                <div className="sal-profile-info">
                                    <strong>Super Admin</strong>
                                    <span>{user?.email || 'superadmin@zenithflows.com'}</span>
                                </div>
                                <div className="sal-avatar">
                                    SA
                                </div>
                            </div>

                            {profileOpen && (
                                <div className="sal-profile-dropdown">
                                    <div className="sal-profile-header">
                                        <div className="sal-profile-name">Super Admin</div>
                                        <div className="sal-profile-email">{user?.email || 'superadmin@zenithflows.com'}</div>
                                    </div>
                                    <div className="sal-profile-actions">
                                        <div onClick={() => { setProfileOpen(false); navigate('/superadmin/settings'); }} className="sal-profile-item">
                                            <span>⚙️</span> Settings
                                        </div>
                                        <div onClick={handleLogout} className="sal-profile-item sal-logout">
                                            <span>🚪</span> Logout
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="sal-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default SuperAdminLayout;
