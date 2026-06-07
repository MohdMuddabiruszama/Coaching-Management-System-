import { useState, useContext, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import InstituteLogo from "../../components/common/InstituteLogo";
import "./StudentLayout.css";
import api from "../../services/api";

const StudentLayout = () => {
    const { user } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [desktopCollapsed, setDesktopCollapsed] = useState(false);
    
    const [chatUnreadCount, setChatUnreadCount] = useState(0);

    useEffect(() => {
        // Fetch chat unread count for sidebar badge
        if (user?.features?.chat) {
            api.get('/chat/unread-count').then(res => {
                if (res.data.success) {
                    setChatUnreadCount(res.data.count);
                }
            }).catch(err => console.log(err));
        }
    }, [user]);

    const navLinkClass = (path) => {
        const isMatch = location.pathname === path || location.pathname.startsWith(path + '/');
        return isMatch ? "sl-nav-link active" : "sl-nav-link";
    };

    const handleNavClick = () => {
        setSidebarOpen(false);
    };

    return (
        <div className="sl-layout">
            {/* Mobile Overlay */}
            <div className={`sl-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)}></div>

            {/* Sidebar */}
            <aside className={`sl-sidebar ${sidebarOpen ? 'open' : ''} ${desktopCollapsed ? 'collapsed' : ''}`}>
                {/* Desktop Toggle Button */}
                <button 
                    className="sl-desktop-toggle"
                    onClick={() => setDesktopCollapsed(!desktopCollapsed)}
                    title={desktopCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {desktopCollapsed ? '❯' : '❮'}
                </button>

                <div className="sl-sidebar-header">
                    <InstituteLogo size="sm" />
                    <div className="sl-logo-text">
                        <h3>{user?.institute_name || "IT Hub"}</h3>
                        <p>Student Portal</p>
                    </div>
                </div>

                <div className="sl-sidebar-menu">
                    <Link to="/student/dashboard" className={navLinkClass('/student/dashboard')} onClick={handleNavClick}>
                        <span className="sl-nav-icon">🏠</span>
                        Dashboard
                    </Link>

                    <div className="sl-nav-section">ACADEMICS</div>
                    {user?.features?.attendance !== 'none' && (
                        <Link to="/student/attendance" className={navLinkClass('/student/attendance')} onClick={handleNavClick}>
                            <span className="sl-nav-icon">📅</span>
                            Attendance
                        </Link>
                    )}
                    {user?.features?.exams && (
                        <>
                            <Link to="/student/exams" className={navLinkClass('/student/exams')} onClick={handleNavClick}>
                                <span className="sl-nav-icon">📄</span>
                                Marks
                            </Link>
                            <Link to="/student/performance" className={navLinkClass('/student/performance')} onClick={handleNavClick}>
                                <span className="sl-nav-icon">📈</span>
                                Performance
                            </Link>
                        </>
                    )}
                    {user?.features?.timetable && (
                        <Link to="/student/timetable" className={navLinkClass('/student/timetable')} onClick={handleNavClick}>
                            <span className="sl-nav-icon">📆</span>
                            Timetable
                        </Link>
                    )}
                    {user?.features?.notes && (
                        <>
                            <Link to="/student/assignments" className={navLinkClass('/student/assignments')} onClick={handleNavClick}>
                                <span className="sl-nav-icon">📋</span>
                                Assignments
                            </Link>
                            <Link to="/student/notes" className={navLinkClass('/student/notes')} onClick={handleNavClick}>
                                <span className="sl-nav-icon">📓</span>
                                Notes
                            </Link>
                        </>
                    )}

                    <div className="sl-nav-section">COMMUNICATION</div>
                    {user?.features?.announcements && (
                        <Link to="/student/announcements" className={navLinkClass('/student/announcements')} onClick={handleNavClick}>
                            <span className="sl-nav-icon">📢</span>
                            Announcements
                        </Link>
                    )}
                    {user?.features?.chat && (
                        <Link to="/student/chat" className={navLinkClass('/student/chat')} onClick={handleNavClick}>
                            <span className="sl-nav-icon">💬</span>
                            Subject Chat
                            {chatUnreadCount > 0 && <span className="sl-nav-badge">{chatUnreadCount}</span>}
                        </Link>
                    )}

                    <div className="sl-nav-section">ACCOUNT</div>
                    {user?.features?.fees && (
                        <Link to="/student/fees" className={navLinkClass('/student/fees')} onClick={handleNavClick}>
                            <span className="sl-nav-icon">💳</span>
                            Fees & Payments
                        </Link>
                    )}
                    <Link to="/student/profile" className={navLinkClass('/student/profile')} onClick={handleNavClick}>
                        <span className="sl-nav-icon">👤</span>
                        My Profile
                    </Link>
                </div>

                <div className="sl-sidebar-footer">
                    <div className="sl-help-card">
                        <h4><span className="sl-nav-icon" style={{width: 'auto'}}>❓</span> Need Help?</h4>
                        <p>Have questions or need support?</p>
                        <button className="sl-help-btn" onClick={() => navigate('/student/profile')}>Contact Support</button>
                    </div>
                </div>
                <div className="sl-sidebar-bottom">
                    <span>© {new Date().getFullYear()} {user?.institute_name || "IT Hub"}. All rights reserved.</span>
                    <span>Version 1.0.0</span>
                </div>
            </aside>

            {/* Main Content */}
            <main className="sl-main">
                <div className="sl-mobile-header">
                    <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                        <InstituteLogo size="sm" />
                        <h3 style={{margin: 0, fontSize: '16px'}}>Student Portal</h3>
                    </div>
                    <button className="sl-mobile-toggle" onClick={() => setSidebarOpen(true)}>☰</button>
                </div>
                <Outlet />
            </main>
        </div>
    );
};

export default StudentLayout;
