import { useState, useContext, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import InstituteLogo from "../../components/common/InstituteLogo";
import "./FacultyLayout.css";
import api from "../../services/api";

const FacultyLayout = () => {
    const { user } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [desktopCollapsed, setDesktopCollapsed] = useState(false);
    const [openMenus, setOpenMenus] = useState({});

    const toggleMenu = (key, e) => {
        if (e) e.preventDefault();
        setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
    };
    
    const [chatUnreadCount, setChatUnreadCount] = useState(0);
    const [announcementsUnreadCount, setAnnouncementsUnreadCount] = useState(0);

    useEffect(() => {
        // Fetch chat unread count for sidebar badge
        if (user?.features?.chat) {
            api.get('/chat/unread-count').then(res => {
                if (res.data.success) {
                    setChatUnreadCount(res.data.count);
                }
            }).catch(err => console.log(err));
        }
        // Fetch announcements unread count
        if (user?.features?.announcements) {
            api.get('/announcements/unread-count').then(res => {
                if (res.data.success) {
                    setAnnouncementsUnreadCount(res.data.count || 0);
                }
            }).catch(err => console.log(err));
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            // Update Document Title
            document.title = user.institute_name 
                ? `${user.institute_name} — Faculty Portal` 
                : "Faculty Portal";

            // Update Favicon with Border Radius (Circle)
            if (user.institute_logo) {
                let logoUrl = user.institute_logo;
                if (!logoUrl.startsWith("http") && !logoUrl.startsWith("data:")) {
                    const normalizedPath = logoUrl.replace(/\\/g, '/');
                    const pathWithSlash = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
                    
                    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
                    const backendBase = apiUrl.replace(/\/api\/?$/, ""); // strip /api
                    logoUrl = `${backendBase}${pathWithSlash}`;
                }
                
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const size = Math.max(img.width, img.height);
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');
                    
                    // Draw circular clipping path
                    ctx.beginPath();
                    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2, true);
                    ctx.closePath();
                    ctx.clip();
                    
                    // Draw image centered in the canvas
                    const dx = (size - img.width) / 2;
                    const dy = (size - img.height) / 2;
                    ctx.drawImage(img, dx, dy, img.width, img.height);
                    
                    let link = document.querySelector("link[rel~='icon']");
                    if (!link) {
                        link = document.createElement('link');
                        link.rel = 'icon';
                        document.getElementsByTagName('head')[0].appendChild(link);
                    }
                    link.href = canvas.toDataURL('image/png');
                };
                img.src = logoUrl;
            }
        }
    }, [user]);

    const navLinkClass = (path) => {
        const isMatch = location.pathname === path || location.pathname.startsWith(path + '/');
        return isMatch ? "fl-nav-link active" : "fl-nav-link";
    };

    const handleNavClick = () => {
        setSidebarOpen(false);
    };

    return (
        <div className="fl-layout">
            {/* Mobile Overlay */}
            <div className={`fl-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)}></div>

            {/* Sidebar */}
            <aside className={`fl-sidebar ${sidebarOpen ? 'open' : ''} ${desktopCollapsed ? 'collapsed' : ''}`}>
                {/* Desktop Toggle Button */}
                <button 
                    className="fl-desktop-toggle"
                    onClick={() => setDesktopCollapsed(!desktopCollapsed)}
                    title={desktopCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {desktopCollapsed ? '❯' : '❮'}
                </button>

                <div className="fl-sidebar-header">
                    <InstituteLogo size="sm" />
                    <div className="fl-logo-text">
                        <h3>{user?.institute_name || "IT Hub"}</h3>
                        <p>Faculty Portal</p>
                    </div>
                </div>

                <div className="fl-sidebar-menu">
                    <Link to="/faculty/dashboard" className={navLinkClass('/faculty/dashboard')} onClick={handleNavClick}>
                        <span className="fl-nav-icon">🏠</span>
                        Dashboard
                    </Link>

                    <Link to="/faculty/students" className={navLinkClass('/faculty/students')} onClick={handleNavClick}>
                        <span className="fl-nav-icon">👨‍🎓</span>
                        Students
                    </Link>

                    {user?.features?.attendance !== 'none' && (
                        <div className="fl-nav-dropdown">
                            <button className={`fl-nav-link ${openMenus['attendance'] ? 'dropdown-open' : ''}`} onClick={(e) => toggleMenu('attendance', e)} style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                <span className="fl-nav-icon">📋</span>
                                Attendance
                                <span style={{marginLeft: 'auto', fontSize: '10px', transform: openMenus['attendance'] ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s'}}>▼</span>
                            </button>
                            {openMenus['attendance'] && (
                                <div className="fl-nav-submenu" style={{ display: 'flex', flexDirection: 'column', paddingLeft: '32px', gap: '4px', marginTop: '4px' }}>
                                    <Link to="/faculty/attendance" className={navLinkClass('/faculty/attendance')} onClick={handleNavClick}>
                                        <span className="fl-nav-icon" style={{ fontSize: '14px' }}>📝</span> Mark Attendance
                                    </Link>
                                    <Link to="/faculty/view-attendance" className={navLinkClass('/faculty/view-attendance')} onClick={handleNavClick}>
                                        <span className="fl-nav-icon" style={{ fontSize: '14px' }}>👀</span> Attendance Tracker
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {user?.features?.exams && (
                        <div className="fl-nav-dropdown">
                            <button className={`fl-nav-link ${openMenus['marks'] ? 'dropdown-open' : ''}`} onClick={(e) => toggleMenu('marks', e)} style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                <span className="fl-nav-icon">📄</span>
                                Marks
                                <span style={{marginLeft: 'auto', fontSize: '10px', transform: openMenus['marks'] ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s'}}>▼</span>
                            </button>
                            {openMenus['marks'] && (
                                <div className="fl-nav-submenu" style={{ display: 'flex', flexDirection: 'column', paddingLeft: '32px', gap: '4px', marginTop: '4px' }}>
                                    <Link to="/faculty/marks" className={navLinkClass('/faculty/marks')} onClick={handleNavClick}>
                                        <span className="fl-nav-icon" style={{ fontSize: '14px' }}>✏️</span> Enter Marks
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}

                    {user?.features?.exams && (
                        <Link to="/faculty/class-performance" className={navLinkClass('/faculty/class-performance')} onClick={handleNavClick}>
                            <span className="fl-nav-icon">📈</span>
                            Performance
                        </Link>
                    )}

                    {user?.features?.notes && (
                        <Link to="/faculty/assignments" className={navLinkClass('/faculty/assignments')} onClick={handleNavClick}>
                            <span className="fl-nav-icon">📝</span>
                            Assignments
                        </Link>
                    )}

                    {user?.features?.timetable && (
                        <Link to="/faculty/timetable" className={navLinkClass('/faculty/timetable')} onClick={handleNavClick}>
                            <span className="fl-nav-icon">📆</span>
                            Timetable
                        </Link>
                    )}

                    {user?.features?.chat && (
                        <Link to="/faculty/chat" className={navLinkClass('/faculty/chat')} onClick={handleNavClick}>
                            <span className="fl-nav-icon">💬</span>
                            Academic Chat
                            {chatUnreadCount > 0 && <span className="fl-nav-badge" style={{background: '#e0e7ff', color: '#4f46e5'}}>{chatUnreadCount}</span>}
                        </Link>
                    )}

                    {user?.features?.announcements && (
                        <Link to="/faculty/announcements" className={navLinkClass('/faculty/announcements')} onClick={handleNavClick}>
                            <span className="fl-nav-icon">📢</span>
                            Announcements
                            {announcementsUnreadCount > 0 && <span className="fl-nav-badge" style={{background: '#fee2e2', color: '#ef4444'}}>{announcementsUnreadCount}</span>}
                        </Link>
                    )}

                    {user?.features?.notes && (
                        <Link to="/faculty/notes" className={navLinkClass('/faculty/notes')} onClick={handleNavClick}>
                            <span className="fl-nav-icon">📓</span>
                            Notes
                        </Link>
                    )}

                    <Link to="/faculty/profile" className={navLinkClass('/faculty/profile')} onClick={handleNavClick}>
                        <span className="fl-nav-icon">👤</span>
                        My Profile
                    </Link>
                </div>

                <div className="fl-sidebar-bottom" style={{flexDirection: 'column', gap: 4, alignItems: 'center', textAlign: 'center'}}>
                    <span>© {new Date().getFullYear()} {user?.institute_name || "IT Hub"}. All rights reserved.</span>
                    <span>Version 1.0.0</span>
                </div>
            </aside>

            {/* Main Content */}
            <main className="fl-main">
                <div className="fl-mobile-header">
                    <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                        <InstituteLogo size="sm" />
                        <h3 style={{margin: 0, fontSize: '16px'}}>Faculty Portal</h3>
                    </div>
                    <button className="fl-mobile-toggle" onClick={() => setSidebarOpen(true)}>☰</button>
                </div>
                <Outlet />
            </main>
        </div>
    );
};

export default FacultyLayout;
