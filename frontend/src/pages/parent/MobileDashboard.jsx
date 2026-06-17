/**
 * Phase 3C — Parent Mobile Dashboard UI
 * ─────────────────────────────────────────────────────────────────────────────
 * Clean, modern, mobile-first dashboard powered by the bundled React Query hook.
 */

import { useParentDashboard } from "../../hooks/useMobileDashboard";
import { useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import "./MobileDashboard.css"; 

export default function MobileDashboard() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const { data: response, isLoading, isError } = useParentDashboard();

    if (isLoading) {
        return (
            <div className="mpd-loading-container">
                <LoadingSpinner />
                <p>Loading your dashboard...</p>
            </div>
        );
    }

    if (isError || !response?.success) {
        return (
            <div className="mpd-error-container">
                <p>Failed to load dashboard. Please try again.</p>
                <button onClick={() => window.location.reload()}>Retry</button>
            </div>
        );
    }

    const data = response.data;
    const firstName = user?.name ? user.name.split(" ")[0] : "Parent";
    const { children, announcements } = data;

    // Mobile parent view usually shows stats per child
    return (
        <div className="mpd-container">
            {/* Header Area */}
            <div className="mpd-header">
                <div className="mpd-greeting">
                    <h2>Hello, {firstName}! 👋</h2>
                    <p>Overview of your children's progress</p>
                </div>
            </div>

            {/* Children List */}
            <div className="mpd-section">
                <h3 className="mpd-section-title">My Children</h3>
                <div className="mpd-children-list">
                    {children.map((child, idx) => (
                        <div key={idx} className="mpd-child-card">
                            <div className="mpd-child-header">
                                <div className="mpd-child-avatar">
                                    {child.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="mpd-child-info">
                                    <h4>{child.name}</h4>
                                    <p>{child.className} | Roll: {child.rollNumber}</p>
                                </div>
                                {user?.features?.attendance !== 'none' && (
                                    <div className="mpd-child-att">
                                        <span className="mpd-att-val">{child.attendance?.percentage ?? 0}%</span>
                                        <span className="mpd-att-label">Attendance</span>
                                    </div>
                                )}
                            </div>
                            
                            <div className="mpd-child-stats">
                                {user?.features?.exams && (
                                    <div className="mpd-stat-chip">
                                        <span className="mpd-chip-icon">📄</span>
                                        <span className="mpd-chip-val">{child.performance?.average ?? 0}% Avg</span>
                                    </div>
                                )}
                                {user?.features?.fees && child.fees?.hasPendingFees && (
                                    <div className="mpd-stat-chip mpd-stat-alert">
                                        <span className="mpd-chip-icon">⚠️</span>
                                        <span className="mpd-chip-val">₹{child.fees.totalDue.toLocaleString('en-IN')} Due</span>
                                    </div>
                                )}
                                {user?.features?.assignments && child.pendingAssignments > 0 && (
                                    <div className="mpd-stat-chip mpd-stat-warn">
                                        <span className="mpd-chip-icon">📝</span>
                                        <span className="mpd-chip-val">{child.pendingAssignments} Tasks</span>
                                    </div>
                                )}
                            </div>
                            
                            {/* Action Row for the specific child (or general navigation) */}
                            <div className="mpd-child-actions">
                                {user?.features?.timetable && (
                                    <button onClick={() => navigate('/parent/timetable')}>Timetable</button>
                                )}
                                {user?.features?.exams && (
                                    <button onClick={() => navigate('/parent/dashboard')}>Results</button>
                                )}
                                {user?.features?.fees && (
                                    <button onClick={() => navigate('/parent/dashboard')}>Fees</button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Quick Action Grid */}
            <div className="mpd-section">
                <h3 className="mpd-section-title">Quick Actions</h3>
                <div className="mpd-quick-grid">
                    {user?.features?.chat && (
                        <button className="mpd-action-btn" onClick={() => navigate('/parent/chat')}>
                            <span className="mpd-action-icon">💬</span>
                            <span>Chat</span>
                        </button>
                    )}
                    {user?.features?.assignments && (
                        <button className="mpd-action-btn" onClick={() => navigate('/parent/assignments')}>
                            <span className="mpd-action-icon">📅</span>
                            <span>Tasks</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Recent Announcements */}
            {user?.features?.announcements && announcements?.length > 0 && (
                <div className="mpd-section">
                    <div className="mpd-section-header">
                        <h3>Announcements</h3>
                        <span className="mpd-view-all" onClick={() => navigate('/parent/dashboard')}>View all</span>
                    </div>
                    <div className="mpd-list-container">
                        {announcements.map(ann => (
                            <div key={ann.id} className="mpd-list-item">
                                <div className="mpd-list-icon">📢</div>
                                <div className="mpd-list-content">
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
