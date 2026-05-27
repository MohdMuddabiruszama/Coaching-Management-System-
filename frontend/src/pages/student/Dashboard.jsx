import { useContext, useState, useEffect } from "react";
import { AnnouncementSidebarContext } from "../../context/AnnouncementSidebarContext";
import ThemeSelector from "../../components/ThemeSelector";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import api from "../../services/api";
import InstituteLogo from "../../components/common/InstituteLogo";
import AnnouncementBell from "../../components/AnnouncementBell";
import "../admin/Dashboard.css";

function StudentDashboard() {
    const { user, logout } = useContext(AuthContext);
    const { toggleSidebar } = useContext(AnnouncementSidebarContext);
    const navigate = useNavigate();
    const [unreadCount, setUnreadCount] = useState(0);
    const [chatUnreadCount, setChatUnreadCount] = useState(0);

    useEffect(() => {
        // Fetch chat unread count
        if (user?.features?.chat) {
            api.get('/chat/unread-count').then(res => {
                if (res.data.success) {
                    setChatUnreadCount(res.data.count);
                }
            }).catch(err => console.log(err));
        }

    }, [user]);

    const ActionCard = ({ icon, title, path, badge, onClick }) => (
        <div onClick={onClick || (() => navigate(path))} className="action-card" style={{ cursor: 'pointer', position: 'relative' }}>
            <span className="action-icon">{icon}</span>
            <span className="action-title">{title}</span>
            {badge > 0 && (
                <span style={{
                    position: 'absolute', top: 10, right: 10, background: 'red', color: 'white',
                    borderRadius: '50%', padding: '2px 8px', fontSize: '12px', fontWeight: 'bold'
                }}>
                    {badge}
                </span>
            )}
        </div>
    );

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <InstituteLogo size="md" />
                    <div>
                        <h1>Student Dashboard</h1>
                        <p>Welcome back, {user?.name || "Student"}! Stay productive.</p>
                    </div>
                </div>
                <div className="dashboard-header-right" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    {user?.features?.announcements && <AnnouncementBell size="large" />}
                    <ThemeSelector />
                    <button onClick={logout} className="btn btn-danger">
                        Logout
                    </button>
                </div>
            </div>

            <div className="quick-actions">
                <h2>Quick Actions</h2>
                <div className="action-grid">
                    {user?.features?.attendance !== 'none' && (
                        <ActionCard path="/student/attendance" icon="📋" title="View Attendance" />
                    )}
                    {user?.features?.auto_attendance && (
                        <ActionCard path="/student/scan-attendance" icon="🤳" title="My QR Code" />
                    )}
                    {user?.features?.exams && (
                        <>
                            <ActionCard path="/student/exams" icon="📝" title="View Marks" />
                            <ActionCard path="/student/performance" icon="📊" title="My Performance" />
                        </>
                    )}
                    {user?.features?.fees && (
                        <ActionCard path="/student/fees" icon="💳" title="Pay Fees" />
                    )}
                    {user?.features?.timetable && (
                        <ActionCard path="/student/timetable" icon="📅" title="My Timetable" />
                    )}
                    {user?.features?.announcements && (
                        <ActionCard onClick={toggleSidebar} icon={<AnnouncementBell />} title="Announcements" />
                    )}

                    {user?.features?.notes && (
                        <>
                            <ActionCard path="/student/notes" icon="📚" title="My Notes" />
                            <ActionCard path="/student/assignments" icon="📝" title="Assignments" />
                        </>
                    )}
                    {user?.features?.chat && (
                        <ActionCard path="/student/chat" icon="💬" title="Subject Chat" badge={chatUnreadCount} />
                    )}

                    <ActionCard path="/student/profile" icon="👤" title="My Profile" />
                </div>
            </div>

            {user?.features?.announcements && (
                <div className="card" style={{ marginTop: '20px' }}>
                    <div className="card-header">
                        <h3>Recent Announcements</h3>
                    </div>
                    <div style={{ padding: '20px' }}>
                        <p>Keep track of important updates from your institute.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default StudentDashboard;
