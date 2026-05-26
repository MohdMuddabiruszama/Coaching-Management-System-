import { useContext, useState, useEffect } from "react";
import { AnnouncementSidebarContext } from "../../context/AnnouncementSidebarContext";
import ThemeSelector from "../../components/ThemeSelector";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import api from "../../services/api";
import InstituteLogo from "../../components/common/InstituteLogo";
import AnnouncementBell from "../../components/AnnouncementBell";
import "../admin/Dashboard.css";

function FacultyDashboard() {
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
                        <h1>Faculty Dashboard</h1>
                        <p>Welcome back, {user?.name || "Professor"}! Have a great day.</p>
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
                    <ActionCard path="/faculty/students" icon="👨‍🎓" title="View Students" />
                    {user?.features?.attendance !== 'none' && (
                        <ActionCard path="/faculty/attendance" icon="📋" title="Mark Attendance" />
                    )}
                    {user?.features?.attendance !== 'none' && (
                        <ActionCard path="/faculty/view-attendance" icon="📊" title="View Attendance" />
                    )}
                    {user?.features?.auto_attendance && (
                        <ActionCard path="/faculty/smart-attendance" icon="📸" title="Scan Student QR" />
                    )}
                    <ActionCard path="/faculty/scan-attendance" icon="🤳" title="My QRCode" />
                    {user?.features?.exams && (
                        <ActionCard path="/faculty/marks" icon="📝" title="Enter Marks" />
                    )}
                    {user?.features?.timetable && (
                        <ActionCard path="/faculty/timetable" icon="📅" title="My Schedule" />
                    )}
                    {user?.features?.announcements && (
                        <ActionCard path="/faculty/announcements" icon={<AnnouncementBell size="medium" />} title="Announcements" />
                    )}

                    {user?.features?.notes && (
                        <>
                            <ActionCard path="/faculty/notes" icon="📚" title="Class Notes" />
                            <ActionCard path="/faculty/assignments" icon="📝" title="Assignments" />
                        </>
                    )}
                    {user?.features?.chat && (
                        <ActionCard path="/faculty/chat" icon="💬" title="Academic Chat" badge={chatUnreadCount} />
                    )}

                    <ActionCard path="/faculty/profile" icon="👤" title="My Profile" />
                </div>
            </div>

            {user?.features?.announcements && (
                <div className="card" style={{ marginTop: '20px' }}>
                    <div className="card-header">
                        <h3>Recent Announcements</h3>
                    </div>
                    <div style={{ padding: '20px' }}>
                        <p>Check the global announcements from your Institute Admin.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default FacultyDashboard;
