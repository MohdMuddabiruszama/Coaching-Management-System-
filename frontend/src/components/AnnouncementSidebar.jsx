import { useContext, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { AnnouncementSidebarContext } from "../context/AnnouncementSidebarContext";
import announcementService from "../services/announcement.service";
import PriorityBadge from "./PriorityBadge";
import "../pages/admin/Dashboard.css";

export default function AnnouncementSidebar() {
    const { user } = useContext(AuthContext);
    const { isOpen, closeSidebar } = useContext(AnnouncementSidebarContext);
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && user) {
            fetchAnnouncements();
        }
    }, [isOpen, user]);

    const fetchAnnouncements = async () => {
        try {
            setLoading(true);
            const list = await announcementService.getInstituteAnnouncements();
            setAnnouncements(list);
            
            // Automatically mark all as read in the background if there are any unread
            const hasUnread = list?.some(a => !a.is_read);
            if (hasUnread) {
                announcementService.markAllAsRead().catch(console.error);
            }
        } catch (error) {
            console.error("Error fetching announcements", error);
        } finally {
            setLoading(false);
        }
    };

    // Removed handleMarkAllRead as it is now automatic

    const handleMarkRead = async (id) => {
        try {
            await announcementService.markAsRead(id);
            setAnnouncements((prev) =>
                prev.map((a) => (a.id === id ? { ...a, is_read: true } : a))
            );
        } catch (error) {
            console.error(error);
        }
    };

    if (!isOpen) return null;

    const unreadCount = announcements.filter(a => !a.is_read).length;

    return (
        <>
            {/* Backdrop */}
            <div 
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "100vw",
                    height: "100vh",
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    zIndex: 9998,
                    transition: "opacity 0.3s ease",
                }}
                onClick={closeSidebar}
            />

            {/* Sidebar Drawer */}
            <div
                style={{
                    position: "fixed",
                    top: 0,
                    right: 0,
                    width: "100%",
                    maxWidth: "400px",
                    height: "100vh",
                    backgroundColor: "var(--gray-50, #f9fafb)",
                    zIndex: 9999,
                    boxShadow: "-2px 0 10px rgba(0, 0, 0, 0.1)",
                    display: "flex",
                    flexDirection: "column",
                    animation: "slideInRight 0.3s forwards",
                    borderLeft: "1px solid var(--gray-200, #e5e7eb)",
                }}
            >
                {/* Header */}
                <div style={{
                    padding: "1.5rem",
                    borderBottom: "1px solid var(--gray-200, #e5e7eb)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: "1.2rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span>📢</span> Announcements
                        </h2>
                    </div>
                    <button 
                        onClick={closeSidebar}
                        style={{
                            background: "transparent",
                            border: "none",
                            fontSize: "1.5rem",
                            cursor: "pointer",
                            color: "var(--gray-600, #4b5563)",
                            padding: "0 0.5rem"
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* Content Area */}
                <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem", backgroundColor: "var(--gray-50, #f9fafb)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                        <h3 style={{ margin: 0, fontSize: "1rem" }}>
                            {unreadCount} Unread
                        </h3>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            {(user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'faculty') && (
                                <Link 
                                    to={`/${user.role === 'faculty' ? 'faculty' : 'admin'}/announcements`}
                                    className="btn btn-secondary btn-sm"
                                    onClick={closeSidebar}
                                >
                                    Manage
                                </Link>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: "center", padding: "2rem", color: "var(--gray-600, #4b5563)" }}>
                            Loading...
                        </div>
                    ) : announcements.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "2rem", color: "var(--gray-600, #4b5563)" }}>
                            No announcements yet.
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            {announcements.map((ann) => (
                                <div
                                    key={ann.id}
                                    className={`card announcement-card ${!ann.is_read ? 'unread-card' : ''}`}
                                    onClick={() => !ann.is_read && handleMarkRead(ann.id)}
                                    style={{
                                        cursor: !ann.is_read ? "pointer" : "default",
                                        borderLeft: ann.is_pinned ? "4px solid #F59E0B" : !ann.is_read ? "4px solid #3B82F6" : "1px solid var(--gray-200, #e5e7eb)",
                                        background: !ann.is_read ? "var(--primary-50, #eff6ff)" : undefined,
                                        position: "relative",
                                        padding: "1rem",
                                        boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
                                    }}
                                >
                                    {!ann.is_read && (
                                        <div style={{ position: "absolute", top: "-8px", right: "-8px", background: "#EF4444", color: "white", padding: "2px 6px", borderRadius: "10px", fontSize: "9px", fontWeight: "bold", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}>
                                            NEW
                                        </div>
                                    )}

                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.5rem" }}>
                                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                                            {ann.is_pinned && <span title="Pinned" style={{ fontSize: "0.9rem" }}>📌</span>}
                                            <PriorityBadge priority={ann.priority} />
                                        </div>
                                    </div>
                                    
                                    <h4 style={{ margin: "0.5rem 0", color: "var(--gray-900, #111827)", fontSize: "1.05rem" }}>
                                        {ann.title}
                                    </h4>
                                    <p style={{ whiteSpace: "pre-wrap", color: "var(--gray-600, #4b5563)", margin: 0, fontSize: "0.9rem" }}>
                                        {ann.content}
                                    </p>
                                    
                                    <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "var(--gray-500, #6b7280)", borderTop: "1px solid var(--gray-200, #e5e7eb)", paddingTop: "0.5rem" }}>
                                        Posted by {ann.creator?.name || ann.posted_by || "Institute"} on {new Date(ann.created_at || ann.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                {/* CSS Animation */}
                <style dangerouslySetInnerHTML={{__html: `
                    @keyframes slideInRight {
                        from { transform: translateX(100%); }
                        to { transform: translateX(0); }
                    }
                `}} />
            </div>
        </>
    );
}
