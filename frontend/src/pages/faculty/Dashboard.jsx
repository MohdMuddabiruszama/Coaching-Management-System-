import { useContext, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import api from "../../services/api";
import ThemeSelector from "../../components/ThemeSelector";
import AnnouncementBell from "../../components/AnnouncementBell";
import "./FacultyDashboard.css";

import { Capacitor } from "@capacitor/core";
import MobileDashboard from "./MobileDashboard";

function FacultyDashboard() {
    if (Capacitor.isNativePlatform()) {
        return <MobileDashboard />;
    }

    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    
    const [chatUnreadCount, setChatUnreadCount] = useState(0);
    const [recentAnnouncements, setRecentAnnouncements] = useState([]);
    const [teachingSubjectsCount, setTeachingSubjectsCount] = useState(4); // Default static mock
    const [classesAssignedCount, setClassesAssignedCount] = useState(6);   // Default static mock
    const [todaySchedule, setTodaySchedule] = useState([]);
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
            api.get('/announcements/institute').then(res => {
                if (res.data.success && res.data.data) {
                    // Filter out expired announcements and take top 3
                    const now = new Date();
                    const validAnnouncements = res.data.data.filter(a => !a.expires_at || new Date(a.expires_at) >= now);
                    setRecentAnnouncements(validAnnouncements.slice(0, 3));
                }
            }).catch(err => console.log(err));
        }

        // Fetch Timetable (Real-time Today's Schedule)
        if (user?.features?.timetable) {
            api.get('/timetable/faculty/me').then(res => {
                if (res.data.success && res.data.data) {
                    const rawTimetable = res.data.data;
                    const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                    const todayName = DAYS[new Date().getDay()];
                    
                    const filtered = rawTimetable;
                    const todaySlots = filtered
                        .filter(r => r.day_of_week === todayName)
                        .sort((a, b) => (a.TimetableSlot?.start_time || '').localeCompare(b.TimetableSlot?.start_time || ''));

                    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
                    const toMins = (t) => {
                        if (!t) return 0;
                        const [hh, mm] = t.slice(0,5).split(':').map(Number);
                        return hh * 60 + mm;
                    };

                    const SUBJECT_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899'];
                    const subjectColorMap = {};
                    let colorIdx = 0;

                    const scheduleWithStatus = todaySlots.map(r => {
                        const startStr = r.TimetableSlot?.start_time || '';
                        const endStr   = r.TimetableSlot?.end_time   || '';
                        const startM = toMins(startStr);
                        const endM   = toMins(endStr);
                        let status = 'Upcoming';
                        if (nowMinutes >= endM)   status = 'Completed';
                        if (nowMinutes >= startM && nowMinutes < endM) status = 'Ongoing';
                        
                        const name = r.Subject?.name || 'N/A';
                        if (!subjectColorMap[name]) {
                            subjectColorMap[name] = SUBJECT_COLORS[colorIdx % SUBJECT_COLORS.length];
                            colorIdx++;
                        }
                        return {
                            id: r.id,
                            subject: name,
                            className: r.Class?.name || 'Class',
                            color: subjectColorMap[name],
                            startTime: startStr.slice(0,5),
                            endTime: endStr.slice(0,5),
                            room: r.room_number || '',
                            status,
                        };
                    });

                    // Filter out completed and limit to 3
                    const remaining = scheduleWithStatus.filter(s => s.status !== 'Completed').slice(0, 3);

                    let tomorrowFirstClass = null;
                    if (remaining.length === 0) {
                        const todayIdx = DAYS.indexOf(todayName);
                        for (let offset = 1; offset <= 6; offset++) {
                            const nextDay = DAYS[(todayIdx + offset) % 7];
                            const nextDaySlots = filtered
                                .filter(r => r.day_of_week === nextDay)
                                .sort((a, b) => (a.TimetableSlot?.start_time || '').localeCompare(b.TimetableSlot?.start_time || ''));
                            if (nextDaySlots.length > 0) {
                                const r = nextDaySlots[0];
                                const startStr = r.TimetableSlot?.start_time || '';
                                const endStr   = r.TimetableSlot?.end_time   || '';
                                const name = r.Subject?.name || 'N/A';
                                if (!subjectColorMap[name]) {
                                    subjectColorMap[name] = SUBJECT_COLORS[colorIdx % SUBJECT_COLORS.length];
                                    colorIdx++;
                                }
                                tomorrowFirstClass = {
                                    id: r.id,
                                    subject: name,
                                    className: r.Class?.name || 'Class',
                                    color: subjectColorMap[name],
                                    startTime: startStr.slice(0, 5),
                                    endTime: endStr.slice(0, 5),
                                    room: r.room_number || '',
                                    status: 'Upcoming',
                                    dayLabel: offset === 1 ? 'Tomorrow' : nextDay,
                                };
                                break;
                            }
                        }
                    }

                    setTodaySchedule(remaining.length > 0 ? remaining : tomorrowFirstClass ? [tomorrowFirstClass] : []);
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

    const getRelativeTime = (dateStr) => {
        if (!dateStr) return '';
        const now = new Date();
        const date = new Date(dateStr);
        const diffInMs = now - date;
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
        const diffInMins = Math.floor(diffInMs / (1000 * 60));
        
        if (diffInMins < 60) return `${diffInMins} mins ago`;
        if (diffInHours < 24) return `${diffInHours} hours ago`;
        if (diffInDays === 1) return `1 day ago`;
        if (diffInDays < 30) return `${diffInDays} days ago`;
        
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const getIconData = (idx) => {
        const variations = [
            { bg: '#f3e8ff', color: '#9333ea', icon: '📢' },
            { bg: '#dcfce7', color: '#16a34a', icon: '📝' },
            { bg: '#fef08a', color: '#ca8a04', icon: '🗓️' },
        ];
        return variations[idx % variations.length];
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return '';
        const [hh, mm] = timeStr.split(':');
        const hour = parseInt(hh, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour % 12 || 12;
        return `${h12}:${mm} ${ampm}`;
    };

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
                        {todaySchedule.length > 0 ? todaySchedule.map((cls, idx) => (
                            <div key={cls.id || idx} className="fd-schedule-item-clean">
                                <div className="fd-schedule-time-col">
                                    <span className="fd-schedule-start">{formatTime(cls.startTime)}</span>
                                    <span className="fd-schedule-end">{formatTime(cls.endTime)}</span>
                                </div>
                                <div className="fd-schedule-bar" style={{backgroundColor: cls.color + '20', borderLeft: `3px solid ${cls.color}`}}>
                                    <div className="fd-schedule-subject" style={{color: cls.color}}>{cls.subject}</div>
                                    <div className="fd-schedule-room">{cls.className}{cls.room ? ` • ${cls.room}` : ''}</div>
                                    {cls.dayLabel && <div className="fd-schedule-daylabel">{cls.dayLabel}</div>}
                                </div>
                                <span className={`fd-schedule-badge fd-badge-${cls.status.toLowerCase()}`}>{cls.status}</span>
                            </div>
                        )) : (
                            <div className="fd-schedule-item" style={{ justifyContent: 'center', padding: '2rem 0', color: 'var(--text-secondary)', border: 'none' }}>
                                <p style={{margin:0, fontSize:'13px'}}>No classes scheduled. Enjoy your time!</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Announcements */}
                {user?.features?.announcements && (
                    <div className="fd-panel fd-panel-announcements">
                        <div className="fd-panel-header fd-panel-header-clean">
                            <h3>Recent Announcements</h3>
                            <Link to="/faculty/announcements" className="fd-view-all-clean">View All</Link>
                        </div>
                        <div className="fd-announcement-list fd-announcement-list-clean">
                            {recentAnnouncements.length > 0 ? recentAnnouncements.map((ann, idx) => {
                                const iconData = getIconData(idx);
                                return (
                                <div key={idx} className="fd-announcement-item fd-announcement-item-clean">
                                    <div className="fd-announcement-icon-clean" style={{ backgroundColor: iconData.bg, color: iconData.color }}>
                                        {iconData.icon}
                                    </div>
                                    <div className="fd-announcement-content-clean">
                                        <h4>
                                            {ann.title}
                                            {!ann.is_read && <span className="fd-new-badge-clean">New</span>}
                                        </h4>
                                        <p className="fd-announcement-text">{ann.content || ann.message}</p>
                                        <div className="fd-announcement-time-clean">
                                            {getRelativeTime(ann.created_at || new Date())}
                                        </div>
                                    </div>
                                </div>
                            )}) : (
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
