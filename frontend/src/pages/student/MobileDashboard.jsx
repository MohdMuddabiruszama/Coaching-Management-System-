/**
 * Phase 3A — Student Mobile Dashboard UI (Premium Overhaul)
 * ─────────────────────────────────────────────────────────────────────────────
 * Clean, modern, mobile-first dashboard powered by the bundled React Query hook.
 */

import { useStudentDashboard } from "../../hooks/useMobileDashboard";
import { useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import { BrandingContext } from "../../context/BrandingContext";
import { AnnouncementSidebarContext } from "../../context/AnnouncementSidebarContext";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { FiMenu, FiBell, FiEdit2 } from "react-icons/fi";
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
    const { logo, name } = useContext(BrandingContext);
    const { toggleSidebar } = useContext(AnnouncementSidebarContext);
    const navigate = useNavigate();
    const { data: response, isLoading, isError } = useStudentDashboard();

    if (isLoading) {
        return (
            <div className="msd-loading-container">
                <LoadingSpinner />
                <p>Loading your dashboard...</p>
            </div>
        );
    }

    if (isError || !response?.success) {
        return (
            <div className="msd-error-container">
                <p>Failed to load dashboard. Please try again.</p>
                <button onClick={() => window.location.reload()}>Retry</button>
            </div>
        );
    }

    const data = response.data;
    const firstName = user?.name ? user.name.split(" ")[0] : "Student";
    const { attendance, recentMarks, upcomingExams, announcements, fees, todaySchedule } = data;

    // Formatting date (e.g., Wednesday, June 17)
    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    // Map data returned from the API
    const totalClassesAttended = data.score?.present_days || attendance?.present || 0;
    const totalClasses = data.score?.working_days || attendance?.total || 0;
    const attPct = data.score?.att_pct || attendance?.percentage || 0;
    const gpa = data.score?.marks_pct ? (data.score.marks_pct / 10).toFixed(1) : 'N/A';
    const coursesEnrolled = data.totalSubjects || 0;
    const assignmentsCompleted = (data.totalAssignments || 0) - (data.pendingAssignments || 0);
    const assignmentsTotal = data.totalAssignments || 0;
    const assignmentsPct = assignmentsTotal > 0 ? Math.round((assignmentsCompleted / assignmentsTotal) * 100) : 0;
    const examsThisMonth = data.upcomingExams?.length || 0;
    
    // Check if any fee is overdue or due very soon
    const needsFeeAttention = fees?.hasPendingFees && fees.totalDue > 0;

    // Safe date formatter
    const safeFormatDate = (dateVal) => {
        if (!dateVal) return '';
        const d = new Date(dateVal);
        return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
    };

    return (
        <div className="msd-container">


            {/* Greeting */}
            <div className="msd-greeting-section">
                <h2>Hello, {firstName}! 👋</h2>
                <p>{formattedDate}</p>
            </div>

            {/* Hero Banner (Keep it up) */}
            <div className="msd-hero-card">
                <div className="msd-hero-top">
                    <div className="msd-hero-icon">🏆</div>
                    <div className="msd-hero-text">
                        <h3>Keep it up, {firstName}! 🎉</h3>
                        <p>You're doing great in your academics.</p>
                    </div>
                </div>
                <div className="msd-hero-divider" />
                <div className="msd-hero-stats">
                    <div className="msd-hero-stat-item">
                        <span className="msd-hero-stat-label">Attendance</span>
                        <span className="msd-hero-stat-value">
                            {attPct}% <span className="msd-hero-stat-sub good">Good</span>
                        </span>
                    </div>
                    <div className="msd-stat-divider" />
                    <div className="msd-hero-stat-item">
                        <span className="msd-hero-stat-label">Current GPA</span>
                        <span className="msd-hero-stat-value">{gpa}</span>
                    </div>
                    <div className="msd-stat-divider" />
                    <div className="msd-hero-stat-item">
                        <span className="msd-hero-stat-label">Courses Enrolled</span>
                        <span className="msd-hero-stat-value">
                            {coursesEnrolled} {coursesEnrolled > 0 && <span className="msd-hero-stat-sub active">Active</span>}
                        </span>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="msd-section">
                <div className="msd-section-header">
                    <h3>Quick Actions</h3>
                </div>
                <div className="msd-quick-actions">
                    <button className="msd-action-btn" onClick={() => navigate('/student/attendance')}>
                        <div className="msd-action-icon">
                            <span>🗓️</span>
                        </div>
                        <span>Attendance</span>
                    </button>
                    <button className="msd-action-btn" onClick={() => navigate('/student/exams')}>
                        <div className="msd-action-icon">
                            <span style={{ color: '#2563eb', fontWeight: 800, fontSize: '20px' }}>A+</span>
                        </div>
                        <span>Marks</span>
                    </button>
                    <button className="msd-action-btn" onClick={() => navigate('/student/performance')}>
                        <div className="msd-action-icon">
                            <span>📊</span>
                        </div>
                        <span>Performance</span>
                    </button>
                    <button className="msd-action-btn" onClick={() => navigate('/student/timetable')}>
                        <div className="msd-action-icon">
                            <span>📆</span>
                        </div>
                        <span>Timetable</span>
                    </button>
                    
                    <button className="msd-action-btn" onClick={() => navigate('/student/assignments')}>
                        <div className="msd-action-icon">
                            <span>📋</span>
                        </div>
                        <span>Assignments</span>
                        {data.pendingAssignments > 0 && <span className="msd-badge">{data.pendingAssignments}</span>}
                    </button>
                    <button className="msd-action-btn" onClick={() => navigate('/student/fees')}>
                        <div className="msd-action-icon">
                            <span>💳</span>
                        </div>
                        <span>Pay Fees</span>
                        {needsFeeAttention && <span className="msd-badge">!</span>}
                    </button>
                    <button className="msd-action-btn" onClick={() => navigate('/student/notes')}>
                        <div className="msd-action-icon">
                            <span>📓</span>
                        </div>
                        <span>Notes</span>
                    </button>
                    <button className="msd-action-btn" onClick={() => navigate('/student/chat')}>
                        <div className="msd-action-icon">
                            <span>💬</span>
                        </div>
                        <span>Chat</span>
                        {data.unreadChatCount > 0 && <span className="msd-badge">{data.unreadChatCount}</span>}
                    </button>
                </div>
            </div>

            {/* Summary Grid */}
            <div className="msd-summary-grid">
                <div className="msd-summary-card">
                    <div className="msd-summary-header">
                        <div className="msd-summary-icon icon-purple">👥</div>
                        <span className="msd-summary-title">Classes Attended</span>
                    </div>
                    <div className="msd-summary-body">
                        <div className="msd-summary-value">{totalClassesAttended} <span className="msd-summary-sub">/ {totalClasses || '-'}</span></div>
                        <div className="msd-summary-footer">
                            <span>Overall</span>
                            <span>{attPct}%</span>
                        </div>
                    </div>
                </div>
                <div className="msd-summary-card">
                    <div className="msd-summary-header">
                        <div className="msd-summary-icon icon-green">📋</div>
                        <span className="msd-summary-title">Assignments</span>
                    </div>
                    <div className="msd-summary-body">
                        <div className="msd-summary-value">{assignmentsCompleted} <span className="msd-summary-sub">/ {assignmentsTotal || '-'}</span></div>
                        <div className="msd-summary-footer">
                            <span>Completed</span>
                            <span>{assignmentsPct}%</span>
                        </div>
                    </div>
                </div>
                <div className="msd-summary-card">
                    <div className="msd-summary-header">
                        <div className="msd-summary-icon icon-yellow">⏱️</div>
                        <span className="msd-summary-title">Exams</span>
                    </div>
                    <div className="msd-summary-body">
                        <div className="msd-summary-value">{examsThisMonth}</div>
                        <div className="msd-summary-footer">
                            <span>This Month</span>
                        </div>
                    </div>
                </div>
                <div className="msd-summary-card">
                    <div className="msd-summary-header">
                        <div className="msd-summary-icon icon-blue">💰</div>
                        <span className="msd-summary-title">Fees</span>
                    </div>
                    <div className="msd-summary-body">
                        <div className="msd-summary-value">₹{fees?.totalDue?.toLocaleString('en-IN') || 0}</div>
                        <div className="msd-summary-footer">
                            <span className={fees?.totalDue > 0 ? "msd-text-danger" : "msd-text-success"}>
                                {fees?.totalDue > 0 ? "Pending" : "All cleared"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Today's Schedule */}
            <div className="msd-section">
                <div className="msd-section-header">
                    <h3>Today's Schedule</h3>
                    <button className="msd-view-all" onClick={() => navigate('/student/timetable')}>
                        View Timetable
                    </button>
                </div>
                {todaySchedule && todaySchedule.length > 0 ? (
                    todaySchedule.map((cls, idx) => (
                        <div key={idx} className="msd-schedule-card">
                            <div className="msd-schedule-time">
                                <span className="msd-time-start">{formatTime(cls.startTime)}</span>
                                <span className="msd-time-end">{formatTime(cls.endTime)}</span>
                            </div>
                            <div className="msd-schedule-divider" />
                            <div className="msd-schedule-info">
                                <span className="msd-schedule-subject">{cls.isBreak ? cls.breakLabel || 'Break' : cls.subject}</span>
                                <span className="msd-schedule-room">
                                    {cls.room ? (cls.room.toLowerCase().includes('room') ? cls.room : `Room ${cls.room}`) : 'Classroom'}
                                </span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="msd-empty-card">
                        <div className="msd-empty-icon" style={{ color: '#c7d2fe' }}>📅</div>
                        <div className="msd-empty-text">
                            <h4>No classes scheduled.</h4>
                            <p>Enjoy your time!</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Recent Announcements */}
            <div className="msd-section">
                <div className="msd-section-header">
                    <h3>Recent Announcements</h3>
                    <button className="msd-view-all" onClick={() => navigate('/student/announcements')}>
                        View All
                    </button>
                </div>
                {announcements && announcements.length > 0 ? (
                    announcements.slice(0, 2).map((ann, idx) => (
                        <div key={ann.id || idx} className="msd-notice-card" onClick={() => navigate('/student/announcements')}>
                            <div className="msd-notice-icon">
                                📣
                            </div>
                            <div className="msd-notice-content">
                                <h4 className="msd-notice-title">{ann.title}</h4>
                                <p className="msd-notice-date">{safeFormatDate(ann.date || ann.createdAt)}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="msd-empty-card">
                        <div className="msd-empty-icon" style={{ color: '#c7d2fe' }}>📢</div>
                        <div className="msd-empty-text">
                            <h4 style={{ color: '#64748b', fontWeight: 500 }}>No announcements yet.</h4>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
