/**
 * Student Announcements Page (Phase 7)
 * Fixes date bug, adds read tracking, unread badges, and Mark All As Read.
 */
import { useContext, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import announcementService from "../../services/announcement.service";
import ThemeSelector from "../../components/ThemeSelector";
import PriorityBadge from "../../components/PriorityBadge";
import "../admin/Dashboard.css";

function ViewAnnouncements() {
    const { user } = useContext(AuthContext);
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const fetchAnnouncements = async () => {
        try {
            const list = await announcementService.getInstituteAnnouncements();
            setAnnouncements(list);
        } catch (error) {
            console.error("Error fetching announcements", error);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await announcementService.markAllAsRead();
            fetchAnnouncements();
            import("react-hot-toast").then((m) => m.toast.success("All caught up!"));
        } catch (error) {
            console.error(error);
        }
    };

    const handleMarkRead = async (id) => {
        try {
            await announcementService.markAsRead(id);
            // Update local state directly so UI responds instantly
            setAnnouncements((prev) =>
                prev.map((a) => (a.id === id ? { ...a, is_read: true } : a))
            );
        } catch (error) {
            console.error(error);
        }
    };

    if (loading) return <div className="dashboard-container">Loading...</div>;

    const unreadCount = announcements.filter(a => !a.is_read).length;

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <h1>📢 Institute Announcements</h1>
                    <p>Important updates from administration and faculty</p>
                </div>
                <div className="dashboard-header-right">
                    <ThemeSelector />
                    <Link to={`/${user?.role}/dashboard`} className="btn btn-secondary">
                        ← Back
                    </Link>
                </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ margin: 0 }}>
                    {unreadCount} Unread Announcement{unreadCount !== 1 ? 's' : ''}
                </h3>
                {unreadCount > 0 && (
                    <button className="btn btn-primary btn-sm" onClick={handleMarkAllRead}>
                        Mark All As Read ✓
                    </button>
                )}
            </div>

            <div className="card-grid">
                {announcements.length === 0 ? (
                    <div className="card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "2rem" }}>
                        <p>No announcements yet.</p>
                    </div>
                ) : (
                    announcements.map((ann) => (
                        <div
                            key={ann.id}
                            className={`card announcement-card ${!ann.is_read ? 'unread-card' : ''}`}
                            onClick={() => !ann.is_read && handleMarkRead(ann.id)}
                            style={{
                                cursor: !ann.is_read ? "pointer" : "default",
                                borderLeft: ann.is_pinned ? "4px solid #F59E0B" : !ann.is_read ? "4px solid #3B82F6" : "none",
                                background: !ann.is_read ? "var(--bg-card-alt, #f8fafc)" : "var(--bg-card)",
                                position: "relative"
                            }}
                        >
                            {!ann.is_read && (
                                <div style={{ position: "absolute", top: "-10px", right: "-10px", background: "#EF4444", color: "white", padding: "2px 8px", borderRadius: "12px", fontSize: "10px", fontWeight: "bold", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}>
                                    NEW
                                </div>
                            )}

                            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.5rem" }}>
                                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                                    {ann.is_pinned && <span title="Pinned">📌</span>}
                                    <PriorityBadge priority={ann.priority} />
                                </div>
                            </div>
                            
                            <h3 style={{ margin: "0.5rem 0", color: "var(--text-primary)" }}>
                                {ann.title}
                            </h3>
                            <p style={{ whiteSpace: "pre-wrap", color: "var(--text-secondary)", flexGrow: 1 }}>
                                {ann.content}
                            </p>
                            
                            <div className="card-footer" style={{ marginTop: "1rem", fontSize: "0.85rem", color: "var(--text-muted)", borderTop: "1px solid var(--border-color)", paddingTop: "0.5rem" }}>
                                Posted by {ann.creator?.name || ann.posted_by || "Institute"} on {new Date(ann.created_at || ann.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default ViewAnnouncements;
