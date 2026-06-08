import { useContext, useState, useEffect, useRef } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import ThemeSelector from "../ThemeSelector";
import InstituteLogo from "../../components/common/InstituteLogo";
import api from "../../services/api";
import "./AdminLayout.css";

const AdminLayout = () => {
    const { user, logout } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [openMenus, setOpenMenus] = useState({});

    const toggleMenu = (key) => {
        setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

    const hasPermission = (featureKey) => {
        if (isAdmin) return true;
        if (user?.role === 'manager') {
            return user.permissions && user.permissions.some(p => p === featureKey || p.startsWith(featureKey + '.'));
        }
        return false;
    };

    const [sidebarStats, setSidebarStats] = useState({
        unreadAssignmentCount: 0,
        unreadNotesCount: 0,
        unreadAnnouncementCount: 0,
        unreadChatCount: 0,
        unreadEnquiryCount: 0
    });

    useEffect(() => {
        const fetchSidebarStats = async () => {
            try {
                const response = await api.get("/admin/stats");
                if (response.data && response.data.data) {
                    setSidebarStats({
                        unreadAssignmentCount: response.data.data.unreadAssignmentCount || 0,
                        unreadNotesCount: response.data.data.unreadNotesCount || 0,
                        unreadAnnouncementCount: response.data.data.unreadAnnouncementCount || 0,
                        unreadChatCount: response.data.data.unreadChatCount || 0,
                        unreadEnquiryCount: response.data.data.unreadEnquiryCount || 0
                    });
                }
            } catch (error) {
                console.error("Error fetching sidebar stats:", error);
            }
        };

        if (user) {
            fetchSidebarStats();
        }
    }, [user, isAdmin]);

    const handleMenuClick = async (type) => {
        setSidebarOpen(false);
        try {
            if (type === 'assignments' && sidebarStats.unreadAssignmentCount > 0) {
                setSidebarStats(s => ({ ...s, unreadAssignmentCount: 0 }));
                await api.post("/admin/clear-unread-assignments");
            } else if (type === 'notes' && sidebarStats.unreadNotesCount > 0) {
                setSidebarStats(s => ({ ...s, unreadNotesCount: 0 }));
                await api.post("/admin/clear-unread-notes");
            } else if (type === 'announcements' && sidebarStats.unreadAnnouncementCount > 0) {
                setSidebarStats(s => ({ ...s, unreadAnnouncementCount: 0 }));
                await api.post("/admin/clear-unread-announcements");
            } else if (type === 'chat' && sidebarStats.unreadChatCount > 0) {
                setSidebarStats(s => ({ ...s, unreadChatCount: 0 }));
                await api.post("/admin/clear-unread-chats");
            } else if (type === 'public_page' && sidebarStats.unreadEnquiryCount > 0) {
                setSidebarStats(s => ({ ...s, unreadEnquiryCount: 0 }));
                await api.post("/admin/clear-unread-enquiries");
            }
        } catch (error) {
            console.error("Error clearing unread counts", error);
        }
    };

    // --- Search functionality ---
    const [searchQuery, setSearchQuery] = useState("");
    const [showSearch, setShowSearch] = useState(false);
    const searchRef = useRef(null);
    const [profileOpen, setProfileOpen] = useState(false);
    const profileRef = useRef(null);

    // Click outside to close search and profile dropdown
    useEffect(() => {
        function handleClickOutside(event) {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowSearch(false);
            }
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setProfileOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Define searchable routes based on permissions
    const getSearchableRoutes = () => {
        const routes = [
            { name: "Dashboard", path: "/admin/dashboard", icon: "🏠" },
            { name: "My Profile", path: "/admin/profile", icon: "👤" },
            { name: "Lifetime Access", path: "/admin/lifetime", icon: "💎" }
        ];
        if (hasPermission('students')) {
            routes.push({ name: "Students", path: "/admin/students", icon: "👥" });
            routes.push({ name: "Parents", path: "/admin/parents", icon: "👨‍👩‍👧" });
        }
        if (hasPermission('faculty')) {
            routes.push({ name: "Faculty", path: "/admin/faculty", icon: "👩‍🏫" });
            routes.push({ name: "Manage Faculty Attendance", path: "/admin/faculty-attendance", icon: "📋" });
            routes.push({ name: "View Faculty Attendance", path: "/admin/view-faculty-attendance", icon: "👀" });
            routes.push({ name: "Scan Faculty QR", path: "/admin/scan-faculty-qr", icon: "📷" });
        }
        if (hasPermission('classes')) routes.push({ name: "Classes", path: "/admin/classes", icon: "📚" });
        if (hasPermission('subjects')) routes.push({ name: "Subjects", path: "/admin/subjects", icon: "📖" });
        if (hasPermission('attendance')) {
            routes.push({ name: "Student Attendance", path: "/admin/attendance", icon: "📋" });
            routes.push({ name: "Smart Attendance (QR)", path: "/admin/smart-attendance", icon: "📱" });
        }
        if (hasPermission('fees') || hasPermission('collect_fees')) routes.push({ name: "Fees & Payments", path: "/admin/fees", icon: "💰" });
        if (hasPermission('expenses')) routes.push({ name: "Expenses", path: "/admin/expenses", icon: "💸" });
        if (isAdmin || hasPermission('finance')) routes.push({ name: "Discounts & Finance Dashboard", path: "/admin/finance", icon: "📊" });
        if (hasPermission('salary')) routes.push({ name: "Faculty Salary", path: "/admin/salary", icon: "💼" });
        if (hasPermission('reports')) routes.push({ name: "Reports & Analytics", path: "/admin/reports", icon: "📉" });
        if (hasPermission('announcements')) routes.push({ name: "Announcements", path: "/admin/announcements", icon: "📢" });
        if (hasPermission('exams')) routes.push({ name: "Exams", path: "/admin/exams", icon: "📝" });
        if (hasPermission('performance')) routes.push({ name: "Performance Hub", path: "/admin/performance", icon: "📈" });
        if (hasPermission('assignments')) routes.push({ name: "Assignments", path: "/admin/assignments", icon: "📄" });
        if (hasPermission('notes')) routes.push({ name: "Notes", path: "/admin/notes", icon: "📓" });
        if (hasPermission('chat')) routes.push({ name: "Chat Monitor", path: "/admin/chat-monitor", icon: "💬" });
        if (hasPermission('biometric')) routes.push({ name: "Biometric Integration", path: "/admin/biometric", icon: "🔐" });
        
        routes.push({ name: "Batches & Timetable", path: "/admin/timetable", icon: "📅" });
        
        if (isAdmin) {
            routes.push({ name: "Manage Managers (Admins)", path: "/admin/admins", icon: "👨‍💼" });
            routes.push({ name: "Public Page Website", path: "/admin/public-page", icon: "🌐" });
            routes.push({ name: "Settings", path: "/admin/settings", icon: "⚙️" });
        }

        return routes;
    };

    const filteredRoutes = getSearchableRoutes().filter(route => 
        route.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSearchNavigate = (path) => {
        navigate(path);
        setShowSearch(false);
        setSearchQuery("");
    };
    // -----------------------------

    const navLinkClass = (path) => {
        const isMatch = location.pathname === path || location.pathname.startsWith(path + '/');
        return isMatch ? "al-nav-link active" : "al-nav-link";
    };

    return (
        <div className={`admin-layout ${sidebarOpen ? 'sidebar-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            {/* Sidebar Overlay for Mobile */}
            {sidebarOpen && (
                <div className="al-sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>
            )}

            {/* Left Sidebar */}
            <aside className="al-sidebar">
                <div className="al-sidebar-header">
                    <div className="al-logo" onClick={() => window.location.reload()} style={{ cursor: 'pointer' }} title="Reload Page">
                        <InstituteLogo size="sm" />
                        <div className="al-logo-text">
                            <h3>{user?.institute_name || "Institute"}</h3>
                            <p>Admin Portal</p>
                        </div>
                    </div>
                    <button className="al-sidebar-close" onClick={() => setSidebarOpen(false)}>✕</button>
                </div>

                <div className="al-sidebar-menu">
                    <Link to="/admin/dashboard" className={navLinkClass('/admin/dashboard')} onClick={() => setSidebarOpen(false)}>
                        <span className="al-nav-icon">🏠</span>
                        <span className="al-nav-text">Dashboard</span>
                    </Link>

                    <div className="al-nav-section">MANAGEMENT</div>
                    {hasPermission('students') && (
                        <div className="al-nav-dropdown">
                            <button className={`al-nav-link ${openMenus['students'] ? 'dropdown-open' : ''}`} onClick={() => toggleMenu('students')}>
                                <span className="al-nav-icon">👥</span>
                                <span className="al-nav-text">Students</span>
                                <span className="al-nav-arrow">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="9 18 15 12 9 6"></polyline>
                                    </svg>
                                </span>
                            </button>
                            {openMenus['students'] && (
                                <div className="al-nav-submenu">
                                    <Link to="/admin/students" className={navLinkClass('/admin/students')} onClick={() => setSidebarOpen(false)}>
                                        <span className="al-nav-icon">👤</span> Manage Students
                                    </Link>
                                    <Link to="/admin/attendance" className={navLinkClass('/admin/attendance')} onClick={() => setSidebarOpen(false)}>
                                        <span className="al-nav-icon">📋</span> Student Attendance
                                    </Link>
                                    <Link to="/admin/view-attendance" className={navLinkClass('/admin/view-attendance')} onClick={() => setSidebarOpen(false)}>
                                        <span className="al-nav-icon">👀</span> View Attendance
                                    </Link>
                                    <Link to="/admin/smart-attendance" className={navLinkClass('/admin/smart-attendance')} onClick={() => setSidebarOpen(false)}>
                                        <span className="al-nav-icon">📷</span> Scan Student QR
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}
                    {hasPermission('faculty') && (
                        <div className="al-nav-dropdown">
                            <button className={`al-nav-link ${openMenus['faculty'] ? 'dropdown-open' : ''}`} onClick={() => toggleMenu('faculty')}>
                                <span className="al-nav-icon">👩‍🏫</span>
                                <span className="al-nav-text">Faculty</span>
                                <span className="al-nav-arrow">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="9 18 15 12 9 6"></polyline>
                                    </svg>
                                </span>
                            </button>
                            {openMenus['faculty'] && (
                                <div className="al-nav-submenu">
                                    <Link to="/admin/faculty" className={navLinkClass('/admin/faculty')} onClick={() => setSidebarOpen(false)}>
                                        <span className="al-nav-icon">🧑‍🏫</span> Manage Faculty
                                    </Link>
                                    <Link to="/admin/faculty-attendance" className={navLinkClass('/admin/faculty-attendance')} onClick={() => setSidebarOpen(false)}>
                                        <span className="al-nav-icon">📋</span> Manage Attendance
                                    </Link>
                                    <Link to="/admin/view-faculty-attendance" className={navLinkClass('/admin/view-faculty-attendance')} onClick={() => setSidebarOpen(false)}>
                                        <span className="al-nav-icon">👀</span> View Attendance
                                    </Link>
                                    <Link to="/admin/scan-faculty-qr" className={navLinkClass('/admin/scan-faculty-qr')} onClick={() => setSidebarOpen(false)}>
                                        <span className="al-nav-icon">📷</span> Scan Faculty QR
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}
                    {(hasPermission('classes') || hasPermission('subjects') || hasPermission('exams') || hasPermission('assignments') || hasPermission('notes')) && (
                        <div className="al-nav-dropdown">
                            <button className={`al-nav-link ${openMenus['academics'] ? 'dropdown-open' : ''}`} onClick={() => toggleMenu('academics')}>
                                <span className="al-nav-icon">📚</span>
                                <span className="al-nav-text">Academics</span>
                                <span className="al-nav-arrow">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="9 18 15 12 9 6"></polyline>
                                    </svg>
                                </span>
                            </button>
                            {openMenus['academics'] && (
                                <div className="al-nav-submenu">
                                    {hasPermission('classes') && (
                                        <Link to="/admin/classes" className={navLinkClass('/admin/classes')} onClick={() => setSidebarOpen(false)}>
                                            <span className="al-nav-icon">🏫</span> Classes
                                        </Link>
                                    )}
                                    {hasPermission('subjects') && (
                                        <Link to="/admin/subjects" className={navLinkClass('/admin/subjects')} onClick={() => setSidebarOpen(false)}>
                                            <span className="al-nav-icon">📖</span> Subjects
                                        </Link>
                                    )}
                                    {hasPermission('exams') && (
                                        <Link to="/admin/exams" className={navLinkClass('/admin/exams')} onClick={() => setSidebarOpen(false)}>
                                            <span className="al-nav-icon">📝</span> Exams
                                        </Link>
                                    )}
                                    {hasPermission('assignments') && (
                                        <Link to="/admin/assignments" className={navLinkClass('/admin/assignments')} onClick={() => handleMenuClick('assignments')}>
                                            <span className="al-nav-icon">📄</span> Assignments
                                            {sidebarStats.unreadAssignmentCount > 0 && (
                                                <span className="al-sidebar-badge" style={{background: '#ef4444', color: '#fff', borderRadius: '12px', padding: '2px 8px', fontSize: '0.75rem', marginLeft: 'auto', fontWeight: '600'}}>
                                                    {sidebarStats.unreadAssignmentCount > 99 ? '99+' : sidebarStats.unreadAssignmentCount}
                                                </span>
                                            )}
                                        </Link>
                                    )}
                                    {hasPermission('notes') && (
                                        <Link to="/admin/notes" className={navLinkClass('/admin/notes')} onClick={() => handleMenuClick('notes')}>
                                            <span className="al-nav-icon">📓</span> Notes
                                            {sidebarStats.unreadNotesCount > 0 && (
                                                <span className="al-sidebar-badge" style={{background: '#ef4444', color: '#fff', borderRadius: '12px', padding: '2px 8px', fontSize: '0.75rem', marginLeft: 'auto', fontWeight: '600'}}>
                                                    {sidebarStats.unreadNotesCount > 99 ? '99+' : sidebarStats.unreadNotesCount}
                                                </span>
                                            )}
                                        </Link>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    {hasPermission('students') && (
                        <Link to="/admin/parents" className={navLinkClass('/admin/parents')} onClick={() => setSidebarOpen(false)}>
                            <span className="al-nav-icon">👨‍👩‍👧</span>
                            <span className="al-nav-text">Parents</span>
                        </Link>
                    )}
                    <Link to="/admin/timetable" className={navLinkClass('/admin/timetable')} onClick={() => setSidebarOpen(false)}>
                        <span className="al-nav-icon">📅</span>
                        <span className="al-nav-text">Batches & Timetable</span>
                    </Link>

                    <div className="al-nav-section">FINANCE</div>
                    {(hasPermission('fees') || hasPermission('collect_fees')) && (
                        <Link to="/admin/fees" className={navLinkClass('/admin/fees')} onClick={() => setSidebarOpen(false)}>
                            <span className="al-nav-icon">💰</span>
                            <span className="al-nav-text">Fees & Payments</span>
                        </Link>
                    )}
                    {hasPermission('expenses') && (
                        <Link to="/admin/expenses" className={navLinkClass('/admin/expenses')} onClick={() => setSidebarOpen(false)}>
                            <span className="al-nav-icon">💸</span>
                            <span className="al-nav-text">Expenses</span>
                        </Link>
                    )}
                    {hasPermission('salary') && (
                        <Link to="/admin/salary" className={navLinkClass('/admin/salary')} onClick={() => setSidebarOpen(false)}>
                            <span className="al-nav-icon">💼</span>
                            <span className="al-nav-text">Faculty Salary</span>
                        </Link>
                    )}
                    {(isAdmin || hasPermission('finance')) && (
                        <Link to="/admin/finance" className={navLinkClass('/admin/finance')} onClick={() => setSidebarOpen(false)}>
                            <span className="al-nav-icon">📊</span>
                            <span className="al-nav-text">Finance Dashboard</span>
                        </Link>
                    )}
                    {hasPermission('reports') && (
                        <Link to="/admin/reports" className={navLinkClass('/admin/reports')} onClick={() => setSidebarOpen(false)}>
                            <span className="al-nav-icon">📉</span>
                            <span className="al-nav-text">Reports</span>
                        </Link>
                    )}

                    <div className="al-nav-section">SYSTEM</div>
                    {isAdmin && (
                        <Link to="/admin/admins" className={navLinkClass('/admin/admins')} onClick={() => setSidebarOpen(false)}>
                            <span className="al-nav-icon">👨‍💼</span>
                            <span className="al-nav-text">Managers</span>
                        </Link>
                    )}
                    {hasPermission('announcements') && (
                        <Link to="/admin/announcements" className={navLinkClass('/admin/announcements')} onClick={() => handleMenuClick('announcements')}>
                            <span className="al-nav-icon">📢</span>
                            <span className="al-nav-text">Announcements</span>
                            {sidebarStats.unreadAnnouncementCount > 0 && (
                                <span className="al-sidebar-badge" style={{background: '#ef4444', color: '#fff', borderRadius: '12px', padding: '2px 8px', fontSize: '0.75rem', marginLeft: 'auto', fontWeight: '600'}}>
                                    {sidebarStats.unreadAnnouncementCount > 99 ? '99+' : sidebarStats.unreadAnnouncementCount}
                                </span>
                            )}
                        </Link>
                    )}
                    {hasPermission('chat') && (
                        <Link to="/admin/chat-monitor" className={navLinkClass('/admin/chat-monitor')} onClick={() => handleMenuClick('chat')}>
                            <span className="al-nav-icon">💬</span>
                            <span className="al-nav-text">Chat Monitor</span>
                            {sidebarStats.unreadChatCount > 0 && (
                                <span className="al-sidebar-badge" style={{background: '#ef4444', color: '#fff', borderRadius: '12px', padding: '2px 8px', fontSize: '0.75rem', marginLeft: 'auto', fontWeight: '600'}}>
                                    {sidebarStats.unreadChatCount > 99 ? '99+' : sidebarStats.unreadChatCount}
                                </span>
                            )}
                        </Link>
                    )}
                    {hasPermission('performance') && (
                        <Link to="/admin/performance" className={navLinkClass('/admin/performance')} onClick={() => setSidebarOpen(false)}>
                            <span className="al-nav-icon">📈</span>
                            <span className="al-nav-text">Performance Hub</span>
                        </Link>
                    )}
                    {(isAdmin || hasPermission('biometric')) && (
                        <Link to="/admin/biometric" className={navLinkClass('/admin/biometric')} onClick={() => setSidebarOpen(false)}>
                            <span className="al-nav-icon">🔐</span>
                            <span className="al-nav-text">Biometric Attendance</span>
                        </Link>
                    )}
                    {isAdmin && (
                        <Link to="/admin/public-page" className={navLinkClass('/admin/public-page')} onClick={() => handleMenuClick('public_page')}>
                            <span className="al-nav-icon">🌐</span>
                            <span className="al-nav-text">Public Website</span>
                            {sidebarStats.unreadEnquiryCount > 0 && (
                                <span className="al-sidebar-badge" style={{background: '#ef4444', color: '#fff', borderRadius: '12px', padding: '2px 8px', fontSize: '0.75rem', marginLeft: 'auto', fontWeight: '600'}}>
                                    {sidebarStats.unreadEnquiryCount > 99 ? '99+' : sidebarStats.unreadEnquiryCount}
                                </span>
                            )}
                        </Link>
                    )}
                    {isAdmin && (
                        <Link to="/admin/settings" className={navLinkClass('/admin/settings')} onClick={() => setSidebarOpen(false)}>
                            <span className="al-nav-icon">⚙️</span>
                            <span className="al-nav-text">Settings</span>
                        </Link>
                    )}
                </div>

                <div className="al-sidebar-footer">
                    <div className="al-lifetime-card" style={{marginBottom: '1rem'}}>
                        <div className="al-lifetime-icon">💎</div>
                        <div className="al-lifetime-content">
                            <h4>Lifetime Member</h4>
                            <p>No recurring billing — ever.</p>
                            <Link to="/admin/lifetime" className="al-lifetime-btn">View Details</Link>
                        </div>
                    </div>
                    <button onClick={logout} className="al-nav-link" style={{width: '100%', color: '#ef4444', justifyContent: 'center', background: '#fef2f2'}}>
                        <span className="al-nav-icon">🚪</span>
                        <span className="al-nav-text" style={{flex: 'none'}}>Logout</span>
                    </button>
                </div>
            </aside>

            {/* Right Content Area */}
            <div className="al-main">
                {/* Top Navbar */}
                <header className="al-topbar">
                    <div className="al-topbar-left">
                        <button className="al-desktop-toggle" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="8" y1="6" x2="21" y2="6"></line>
                                <line x1="8" y1="12" x2="21" y2="12"></line>
                                <line x1="8" y1="18" x2="21" y2="18"></line>
                                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                                <line x1="3" y1="18" x2="3.01" y2="18"></line>
                            </svg>
                        </button>
                        <button className="al-mobile-toggle" onClick={() => setSidebarOpen(true)}>☰</button>
                    </div>
                    <div className="al-topbar-right">
                        <ThemeSelector />
                        <button className="al-icon-btn">
                            🔔
                            <span className="al-badge">5</span>
                        </button>
                        <div className="al-profile-container" ref={profileRef} style={{ position: 'relative' }}>
                            <div className="al-profile" onClick={() => setProfileOpen(!profileOpen)}>
                                <div className="al-avatar">
                                    {user?.name?.charAt(0)?.toUpperCase() || 'M'}
                                </div>
                                <div className="al-profile-info">
                                    <strong>{user?.name || 'School'}</strong>
                                    <span>{user?.role === 'manager' ? 'Manager' : 'Administrator'}</span>
                                </div>
                                <span className="al-profile-arrow" style={{ transform: profileOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
                            </div>

                            {profileOpen && (
                                <div className="al-profile-dropdown" style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 0.5rem)',
                                    right: 0,
                                    background: '#ffffff',
                                    borderRadius: '12px',
                                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                                    border: '1px solid #e2e8f0',
                                    overflow: 'hidden',
                                    zIndex: 1000,
                                    width: '220px'
                                }}>
                                    <div style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9' }}>
                                        <div style={{ fontWeight: 700, color: '#1e293b' }}>{user?.name || 'School'}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>{user?.email || (user?.role === 'manager' ? 'Manager Account' : 'Administrator Account')}</div>
                                    </div>
                                    <div style={{ padding: '0.5rem' }}>
                                        {isAdmin && (
                                            <div 
                                                onClick={() => { setProfileOpen(false); navigate('/admin/settings'); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', cursor: 'pointer', borderRadius: '8px', color: '#334155', fontSize: '0.9rem', transition: 'background 0.2s' }}
                                                onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <span style={{ fontSize: '1.1rem' }}>⚙️</span> Settings
                                            </div>
                                        )}
                                        <div 
                                            onClick={() => { setProfileOpen(false); logout(); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', cursor: 'pointer', borderRadius: '8px', color: '#ef4444', fontSize: '0.9rem', transition: 'background 0.2s', marginTop: '0.25rem' }}
                                            onMouseOver={(e) => e.currentTarget.style.background = '#fee2e2'}
                                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <span style={{ fontSize: '1.1rem' }}>🚪</span> Logout
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Edge Toggle Button between Sidebar and Main */}
                <button 
                    className="al-edge-toggle" 
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        {sidebarCollapsed ? (
                            <polyline points="9 18 15 12 9 6"></polyline>
                        ) : (
                            <polyline points="15 18 9 12 15 6"></polyline>
                        )}
                    </svg>
                </button>

                {/* Page Content */}
                <main className="al-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
