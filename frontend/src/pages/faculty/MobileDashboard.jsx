/**
 * Phase 3B — Faculty Mobile Dashboard UI
 * ─────────────────────────────────────────────────────────────────────────────
 * Clean, modern, mobile-first dashboard powered by the bundled React Query hook.
 */

import { useFacultyDashboard } from "../../hooks/useMobileDashboard";
import { useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import "./MobileDashboard.css"; 

function formatTime(timeStr) {
    if (!timeStr) return '';
    const [hh, mm] = timeStr.split(':');
    const hour = parseInt(hh, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${mm} ${ampm}`;
}

export default function MobileDashboard() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const { data: response, isLoading, isError } = useFacultyDashboard();

    if (isLoading) {
        return (
            <div className="mfd-loading-container">
                <LoadingSpinner />
                <p>Loading your dashboard...</p>
            </div>
        );
    }

    if (isError || !response?.success) {
        return (
            <div className="mfd-error-container">
                <p>Failed to load dashboard. Please try again.</p>
                <button onClick={() => window.location.reload()}>Retry</button>
            </div>
        );
    }

    const data = response.data;
    const firstName = user?.name ? user.name.split(" ")[0] : "Faculty";
    const { todaySchedule, mySubjects, pendingMarks, announcements, stats } = data;

    return (
        <div className="mfd-container">
            {/* Header Area */}
            <div className="mfd-header">
                <div className="mfd-greeting">
                    <h2>Hello, {firstName}! 👋</h2>
                    <p>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                </div>
            </div>

            {/* Quick Stats Banner */}
            <div className="mfd-stats-banner">
                <div className="mfd-stat-box" onClick={() => navigate('/faculty/attendance')}>
                    <span className="mfd-stat-label">Students</span>
                    <div className="mfd-stat-value-group">
                        <span className="mfd-stat-val">{stats.totalStudents}</span>
                        <span className="mfd-stat-icon">👥</span>
                    </div>
                </div>
                
                {user?.features?.exams && stats.pendingMarksCount > 0 && (
                    <div className="mfd-stat-box mfd-stat-alert" onClick={() => navigate('/faculty/marks')}>
                        <span className="mfd-stat-label">Pending Marks</span>
                        <div className="mfd-stat-value-group">
                            <span className="mfd-stat-val">{stats.pendingMarksCount}</span>
                            <span className="mfd-stat-icon">⚠️</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Today's Schedule (Vertical List) */}
            {user?.features?.timetable && todaySchedule?.length > 0 && (
                <div className="mfd-section">
                    <div className="mfd-section-header">
                        <h3>Today's Classes</h3>
                        <span className="mfd-view-all" onClick={() => navigate('/faculty/timetable')}>View full</span>
                    </div>
                    <div className="mfd-schedule-list">
                        {todaySchedule.map((cls, idx) => (
                            <div key={idx} className={`mfd-schedule-item ${cls.isBreak ? 'mfd-break-item' : ''}`}>
                                <div className="mfd-schedule-time">
                                    <span className="mfd-time-start">{formatTime(cls.startTime)}</span>
                                    <span className="mfd-time-end">{formatTime(cls.endTime)}</span>
                                </div>
                                <div className="mfd-schedule-divider" />
                                <div className="mfd-schedule-content">
                                    <h4>{cls.isBreak ? 'Break' : cls.subject}</h4>
                                    {!cls.isBreak && <p>{cls.class}</p>}
                                </div>
                                {!cls.isBreak && user?.features?.attendance !== 'none' && (
                                    <button className="mfd-quick-action-btn" onClick={() => navigate('/faculty/attendance')}>
                                        Mark
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Quick Action Grid */}
            <div className="mfd-section">
                <h3 className="mfd-section-title">Quick Actions</h3>
                <div className="mfd-quick-grid">
                    {user?.features?.attendance !== 'none' && (
                        <button className="mfd-action-btn" onClick={() => navigate('/faculty/attendance')}>
                            <span className="mfd-action-icon">📋</span>
                            <span>Attendance</span>
                        </button>
                    )}
                    {user?.features?.exams && (
                        <button className="mfd-action-btn" onClick={() => navigate('/faculty/marks')}>
                            <span className="mfd-action-icon">📝</span>
                            <span>Marks</span>
                            {stats.pendingMarksCount > 0 && <span className="mfd-badge">{stats.pendingMarksCount}</span>}
                        </button>
                    )}
                    {user?.features?.assignments && (
                        <button className="mfd-action-btn" onClick={() => navigate('/faculty/assignments')}>
                            <span className="mfd-action-icon">📅</span>
                            <span>Homework</span>
                        </button>
                    )}
                    {user?.features?.chat && (
                        <button className="mfd-action-btn" onClick={() => navigate('/faculty/chat')}>
                            <span className="mfd-action-icon">💬</span>
                            <span>Chat</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Recent Announcements */}
            {user?.features?.announcements && announcements?.length > 0 && (
                <div className="mfd-section">
                    <div className="mfd-section-header">
                        <h3>Announcements</h3>
                        <span className="mfd-view-all" onClick={() => navigate('/faculty/announcements')}>View all</span>
                    </div>
                    <div className="mfd-list-container">
                        {announcements.map(ann => (
                            <div key={ann.id} className="mfd-list-item" onClick={() => navigate('/faculty/announcements')}>
                                <div className="mfd-list-icon">📢</div>
                                <div className="mfd-list-content">
                                    <h4>{ann.title}</h4>
                                    <p>{new Date(ann.date).toLocaleDateString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
