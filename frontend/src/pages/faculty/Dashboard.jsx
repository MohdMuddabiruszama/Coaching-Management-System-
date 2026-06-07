import { useContext, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import api from "../../services/api";
import ThemeSelector from "../../components/ThemeSelector";
import AnnouncementBell from "../../components/AnnouncementBell";
import "./FacultyDashboard.css";

function FacultyDashboard() {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    
    const [chatUnreadCount, setChatUnreadCount] = useState(0);
    const [recentAnnouncements, setRecentAnnouncements] = useState([]);
    const [teachingSubjectsCount, setTeachingSubjectsCount] = useState(4); // Default static mock
    const [classesAssignedCount, setClassesAssignedCount] = useState(6);   // Default static mock
    const [totalStudentsCount, setTotalStudentsCount] = useState(128);     // Default static mock

    useEffect(() => {
        // Fetch chat unread count
        if (user?.features?.chat) {
            api.get('/chat/unread-count').then(res => {
                if (res.data.success) {
                    setChatUnreadCount(res.data.count);
                }
            }).catch(err => console.log(err));
        }

        // Fetch announcements
        if (user?.features?.announcements) {
            api.get('/announcements/global').then(res => {
                if (res.data.success && res.data.data) {
                    // Take top 3 for dashboard
                    setRecentAnnouncements(res.data.data.slice(0, 3));
                }
            }).catch(err => console.log(err));
        }

        // Fetch dashboard stats (real counts from DB)
        api.get('/faculty/dashboard-stats').then(res => {
            if (res.data.success && res.data.data) {
                setTeachingSubjectsCount(res.data.data.teachingSubjectsCount || 0);
                setClassesAssignedCount(res.data.data.classesAssignedCount || 0);
                setTotalStudentsCount(res.data.data.totalStudentsCount || 0);
            }
        }).catch(err => console.log(err));
        
    }, [user]);

    const ActionCard = ({ icon, colorClass, title, subtitle, path, badge }) => (
        <Link to={path} className="fd-action-card">
            <div className={`fd-action-icon ${colorClass}`}>
                {icon}
            </div>
            <div className="fd-action-info">
                <h4>{title}</h4>
                <p>{subtitle}</p>
            </div>
            <div className="fd-action-arrow">❯</div>
            {badge > 0 && <span className="fd-badge">{badge}</span>}
        </Link>
    );

    // Mocked Schedule Data
    const todaySchedule = [
        { id: 1, time: "09:00 AM", endTime: "10:00 AM", subject: "Mathematics", class: "Class 10-A", room: "Room 201", status: "Upcoming" },
        { id: 2, time: "11:00 AM", endTime: "12:00 PM", subject: "Science", class: "Class 10-B", room: "Room 203", status: "Upcoming" },
        { id: 3, time: "02:00 PM", endTime: "03:00 PM", subject: "Mathematics", class: "Class 10-C", room: "Room 201", status: "Upcoming" }
    ];

    return (
        <div className="fd-dashboard-container">
            {/* Header */}
            <div className="fd-header">
                <div className="fd-header-left">
                    <h1>Faculty Dashboard</h1>
                    <p>Welcome back, {user?.name || "Professor"}! Have a great day.</p>
                </div>
                <div className="fd-header-right">
                    {user?.features?.announcements && <AnnouncementBell size="large" />}
                    <ThemeSelector />
                    <button onClick={logout} className="fd-logout-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                        Logout
                    </button>
                </div>
            </div>

            {/* Quick Actions Grid */}
            <h2 className="fd-section-title">Quick Actions</h2>
            <div className="fd-quick-actions-grid">
                <ActionCard 
                    path="/faculty/students" 
                    icon="👨‍🎓" 
                    colorClass="fd-icon-blue" 
                    title="View Students" 
                    subtitle="View and manage students" 
                />
                
                {user?.features?.attendance !== 'none' && (
                    <>
                        <ActionCard 
                            path="/faculty/attendance" 
                            icon="📋" 
                            colorClass="fd-icon-orange" 
                            title="Mark Attendance" 
                            subtitle="Mark class attendance" 
                        />
                        <ActionCard 
                            path="/faculty/view-attendance" 
                            icon="📊" 
                            colorClass="fd-icon-blue" 
                            title="View Attendance" 
                            subtitle="View attendance records" 
                        />
                    </>
                )}

                {user?.features?.auto_attendance && (
                    <ActionCard 
                        path="/faculty/smart-attendance" 
                        icon="📸" 
                        colorClass="fd-icon-green" 
                        title="Scan Student QR" 
                        subtitle="Scan QR to mark attendance" 
                    />
                )}
                
                <ActionCard 
                    path="/faculty/scan-attendance" 
                    icon="🤳" 
                    colorClass="fd-icon-red" 
                    title="My QRCode" 
                    subtitle="View my QR code" 
                />

                {user?.features?.exams && (
                    <>
                        <ActionCard 
                            path="/faculty/marks" 
                            icon="✍️" 
                            colorClass="fd-icon-yellow" 
                            title="Enter Marks" 
                            subtitle="Add and manage marks" 
                        />
                        <ActionCard 
                            path="/faculty/class-performance" 
                            icon="🎯" 
                            colorClass="fd-icon-red" 
                            title="Class Performance" 
                            subtitle="Analyze class performance" 
                        />
                    </>
                )}

                {user?.features?.timetable && (
                    <ActionCard 
                        path="/faculty/timetable" 
                        icon="📅" 
                        colorClass="fd-icon-blue" 
                        title="My Schedule" 
                        subtitle="View teaching schedule" 
                    />
                )}

                {user?.features?.announcements && (
                    <ActionCard 
                        path="/faculty/announcements" 
                        icon="📢" 
                        colorClass="fd-icon-orange" 
                        title="Announcements" 
                        subtitle="Share announcements" 
                    />
                )}

                {user?.features?.notes && (
                    <>
                        <ActionCard 
                            path="/faculty/notes" 
                            icon="📓" 
                            colorClass="fd-icon-purple" 
                            title="Class Notes" 
                            subtitle="Manage class notes" 
                        />
                        <ActionCard 
                            path="/faculty/assignments" 
                            icon="📝" 
                            colorClass="fd-icon-purple" 
                            title="Assignments" 
                            subtitle="Create and review assignments" 
                        />
                    </>
                )}

                {user?.features?.chat && (
                    <ActionCard 
                        path="/faculty/chat" 
                        icon="💬" 
                        colorClass="fd-icon-purple" 
                        title="Academic Chat" 
                        subtitle="Chat with students" 
                        badge={chatUnreadCount}
                    />
                )}
            </div>

            {/* Top Stats */}
            <div className="fd-stats-row">
                <div className="fd-stat-card">
                    <div className="fd-stat-icon fd-icon-purple">👥</div>
                    <div className="fd-stat-info">
                        <h3>Total Students</h3>
                        <div className="fd-stat-value">{totalStudentsCount}</div>
                        <p>Across all classes</p>
                    </div>
                </div>
                <div className="fd-stat-card">
                    <div className="fd-stat-icon fd-icon-green">🎓</div>
                    <div className="fd-stat-info">
                        <h3>Classes Assigned</h3>
                        <div className="fd-stat-value">{classesAssignedCount}</div>
                        <p>Active classes</p>
                    </div>
                </div>
                <div className="fd-stat-card">
                    <div className="fd-stat-icon fd-icon-blue">📖</div>
                    <div className="fd-stat-info">
                        <h3>Subjects Teaching</h3>
                        <div className="fd-stat-value">{teachingSubjectsCount}</div>
                        <p>This semester</p>
                    </div>
                </div>
            </div>

            {/* Split View */}
            <div className="fd-split-view">
                {/* Today's Schedule */}
                <div className="fd-panel">
                    <div className="fd-panel-header">
                        <h3>📅 Today's Schedule</h3>
                        <Link to="/faculty/timetable" className="fd-view-all">View Full Schedule</Link>
                    </div>
                    <div className="fd-schedule-list">
                        {todaySchedule.map(schedule => (
                            <div key={schedule.id} className="fd-schedule-item">
                                <div className="fd-schedule-time">
                                    <span>{schedule.time}</span>
                                    <span>- {schedule.endTime}</span>
                                </div>
                                <div className="fd-schedule-details">
                                    <h4>{schedule.subject}</h4>
                                    <p>{schedule.class}</p>
                                </div>
                                <div className="fd-schedule-room">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                    {schedule.room}
                                </div>
                                <div className="fd-status-badge">{schedule.status}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Announcements */}
                {user?.features?.announcements && (
                    <div className="fd-panel">
                        <div className="fd-panel-header">
                            <h3>📢 Recent Announcements</h3>
                            <Link to="/faculty/announcements" className="fd-view-all">View All</Link>
                        </div>
                        <div className="fd-announcement-list">
                            {recentAnnouncements.length > 0 ? recentAnnouncements.map((ann, idx) => (
                                <div key={idx} className="fd-announcement-item">
                                    <div className="fd-announcement-icon fd-icon-blue">
                                        🔗
                                    </div>
                                    <div className="fd-announcement-content">
                                        <h4>{ann.title}</h4>
                                        <p>{ann.message}</p>
                                    </div>
                                    <div className="fd-announcement-date">
                                        {new Date(ann.created_at || new Date()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </div>
                                </div>
                            )) : (
                                <div className="fd-announcement-item">
                                    <div className="fd-announcement-icon fd-icon-green">✨</div>
                                    <div className="fd-announcement-content">
                                        <h4>No Recent Announcements</h4>
                                        <p>You're all caught up for today.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Banner */}
            {user?.features?.chat && (
                <div className="fd-banner">
                    <div className="fd-banner-left">
                        <div className="fd-banner-icon">💬</div>
                        <div className="fd-banner-text">
                            <h3>Stay Connected</h3>
                            <p>Use Academic Chat to connect with your students and share important updates.</p>
                        </div>
                    </div>
                    <Link to="/faculty/chat" className="fd-banner-btn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        Open Academic Chat
                    </Link>
                </div>
            )}
        </div>
    );
}

export default FacultyDashboard;
