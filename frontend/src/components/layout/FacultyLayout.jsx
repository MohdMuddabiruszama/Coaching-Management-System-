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
    
    const [chatUnreadCount, setChatUnreadCount] = useState(0);
    const [announcementsUnread, setAnnouncementsUnread] = useState(false);

    useEffect(() => {
        // Fetch chat unread count for sidebar badge
        if (user?.features?.chat) {
            api.get('/chat/unread-count').then(res => {
                if (res.data.success) {
                    setChatUnreadCount(res.data.count);
                }
            }).catch(err => console.log(err));
        }
        // Fetch announcements info if needed or just use a boolean for demonstration
        setAnnouncementsUnread(true); // From the image, there is a red dot.
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
                            <Link to="/faculty/attendance" className={navLinkClass('/faculty/attendance')} onClick={handleNavClick}>
                                <span className="fl-nav-icon">📋</span>
                                Attendance
                                <span style={{marginLeft: 'auto', fontSize: '10px'}}>▼</span>
                            </Link>
                        </div>
                    )}
                    
                    {user?.features?.exams && (
                        <div className="fl-nav-dropdown">
                            <Link to="/faculty/marks" className={navLinkClass('/faculty/marks')} onClick={handleNavClick}>
                                <span className="fl-nav-icon">📄</span>
                                Marks
                                <span style={{marginLeft: 'auto', fontSize: '10px'}}>▼</span>
                            </Link>
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
                            {announcementsUnread && <span style={{width: 6, height: 6, borderRadius: '50%', background: '#ef4444', marginLeft: 'auto', marginRight: '8px'}}></span>}
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
