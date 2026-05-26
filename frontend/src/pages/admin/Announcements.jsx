/**
 * Announcements Management Page
 * Handles creating, editing, and listing announcements
 */

import { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import announcementService from "../../services/announcement.service";
import { AuthContext } from "../../context/AuthContext";
import ThemeSelector from "../../components/ThemeSelector";
import PriorityBadge from "../../components/PriorityBadge";
import "./Dashboard.css";

function Announcements() {
    const { user } = useContext(AuthContext);
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const initialFormState = {
        title: "",
        content: "",
        target_audience: "all",
        priority: "normal",
        is_pinned: false,
        expires_at: "",
    };
    const [form, setForm] = useState(initialFormState);

    useEffect(() => {
        fetchAnnouncements();
    }, [user?.role]);

    const fetchAnnouncements = async () => {
        try {
            const res = await announcementService.getAllAnnouncements();
            setAnnouncements(res.announcements || []);
        } catch (error) {
            console.error("Error fetching announcements", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (ann = null) => {
        if (ann) {
            setEditingId(ann.id);
            setForm({
                title: ann.title,
                content: ann.content,
                target_audience: ann.target_audience,
                priority: ann.priority,
                is_pinned: ann.is_pinned,
                // format date for datetime-local input
                expires_at: ann.expires_at ? new Date(ann.expires_at).toISOString().slice(0, 16) : "",
            });
        } else {
            setEditingId(null);
            setForm(initialFormState);
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...form, expires_at: form.expires_at || null };
            if (editingId) {
                await announcementService.updateAnnouncement(editingId, payload);
                import("react-hot-toast").then((m) => m.toast.success("Announcement updated successfully"));
            } else {
                await announcementService.createAnnouncement(payload);
                import("react-hot-toast").then((m) => m.toast.success("Announcement created successfully"));
            }
            setShowModal(false);
            fetchAnnouncements();
        } catch (error) {
            import("react-hot-toast").then((m) => m.toast.error(error.response?.data?.message || "Error saving announcement"));
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this announcement?")) return;
        try {
            await announcementService.deleteAnnouncement(id);
            import("react-hot-toast").then((m) => m.toast.success("Announcement deleted successfully"));
            fetchAnnouncements();
        } catch (error) {
            import("react-hot-toast").then((m) => m.toast.error(error.response?.data?.message || "Error deleting announcement"));
        }
    };

    if (loading) return <div className="dashboard-container">Loading...</div>;

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <h1>📢 Announcements</h1>
                    <p>Manage institute-wide announcements</p>
                </div>
                <div className="dashboard-header-right">
                    <ThemeSelector />
                    <Link to="/admin/dashboard" className="btn btn-secondary">
                        ← Back
                    </Link>
                    {['admin', 'faculty', 'manager'].includes(user?.role) && (
                        <button
                            className="btn btn-primary btn-animated"
                            onClick={() => handleOpenModal()}
                        >
                            + New Announcement
                        </button>
                    )}
                </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {announcements.length === 0 ? (
                    <div className="card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "2rem" }}>
                        <p>No announcements found.</p>
                    </div>
                ) : (
                    announcements.map(ann => (
                        <div key={ann.id} className="card announcement-card" style={{
                            ...(ann.is_pinned ? { borderLeft: "4px solid #F59E0B", background: "var(--primary-50, #f8fafc)" } : { borderLeft: "1px solid var(--gray-200, #e5e7eb)" }),
                            transition: "all 0.2s ease-in-out",
                            position: "relative",
                            overflow: "hidden"
                        }}>
                            {ann.is_pinned && (
                                <div style={{ position: "absolute", top: 0, right: 0, background: "#F59E0B", color: "white", padding: "2px 10px", fontSize: "0.7rem", fontWeight: "bold", borderBottomLeftRadius: "8px" }}>
                                    PINNED
                                </div>
                            )}
                            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem", borderBottom: "none", paddingBottom: 0 }}>
                                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", marginTop: ann.is_pinned ? "0.5rem" : "0" }}>
                                    <PriorityBadge priority={ann.priority} />
                                    <span className="badge badge-info" style={{ textTransform: "capitalize", backgroundColor: "var(--primary-100)", color: "var(--primary-800)" }}>
                                        🎯 To: {ann.target_audience}
                                    </span>
                                </div>
                                <div style={{ display: "flex", gap: "0.5rem", zIndex: 10 }}>
                                    {['admin', 'manager'].includes(user?.role) || (user?.role === 'faculty' && ann.created_by === user?.id) ? (
                                        <>
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => handleOpenModal(ann)}
                                                style={{ display: "flex", alignItems: "center", gap: "4px", padding: "0.3rem 0.6rem" }}
                                                title="Edit"
                                            >
                                                ✏️ <span style={{ fontSize: "0.8rem" }}>Edit</span>
                                            </button>
                                            <button
                                                className="btn btn-sm btn-danger"
                                                onClick={() => handleDelete(ann.id)}
                                                style={{ display: "flex", alignItems: "center", gap: "4px", padding: "0.3rem 0.6rem" }}
                                                title="Delete"
                                            >
                                                🗑️ <span style={{ fontSize: "0.8rem" }}>Delete</span>
                                            </button>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                            <h3 style={{ margin: "0.5rem 0", color: "var(--gray-900, #111827)", fontSize: "1.25rem", fontWeight: "600" }}>{ann.title}</h3>
                            <p style={{ whiteSpace: "pre-wrap", color: "var(--gray-600, #4b5563)", flexGrow: 1, fontSize: "0.95rem", lineHeight: "1.5" }}>{ann.content}</p>
                            
                            <div className="card-footer" style={{ 
                                marginTop: "1.25rem", 
                                fontSize: "0.8rem", 
                                color: "var(--gray-500, #6b7280)", 
                                borderTop: "1px solid var(--gray-200, #e5e7eb)", 
                                paddingTop: "0.75rem", 
                                display: "flex", 
                                justifyContent: "space-between", 
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: "0.5rem"
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px", background: "var(--gray-200)", borderRadius: "50%", color: "var(--gray-700)", fontWeight: "bold", fontSize: "0.7rem" }}>
                                        {(ann.creator?.name || ann.posted_by || "U").charAt(0).toUpperCase()}
                                    </span>
                                    <span>
                                        Posted by <strong>{ann.creator?.name || ann.posted_by || "Unknown"}</strong> on {new Date(ann.created_at || ann.createdAt).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                {ann.expires_at && (
                                    <span style={{ 
                                        color: new Date(ann.expires_at) < new Date() ? "#DC2626" : "var(--gray-500)",
                                        display: "flex", alignItems: "center", gap: "4px",
                                        background: new Date(ann.expires_at) < new Date() ? "#FEE2E2" : "var(--gray-100)",
                                        padding: "2px 8px", borderRadius: "12px", fontWeight: "500"
                                    }}>
                                        ⏳ {new Date(ann.expires_at) < new Date() ? "Expired" : `Expires: ${new Date(ann.expires_at).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create / Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "550px", width: "95%" }}>
                        <div className="modal-header">
                            <h3>{editingId ? "Edit Announcement" : "Create Announcement"}</h3>
                            <button onClick={() => setShowModal(false)} className="btn btn-sm">×</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: "75vh", overflowY: "auto" }}>
                            <form onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label className="form-label">Title *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={form.title}
                                        onChange={e => setForm({ ...form, title: e.target.value })}
                                        required
                                        placeholder="e.g. Exam Schedule Release"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Content *</label>
                                    <textarea
                                        className="form-input"
                                        rows="5"
                                        value={form.content}
                                        onChange={e => setForm({ ...form, content: e.target.value })}
                                        required
                                        placeholder="Enter full details..."
                                    ></textarea>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                                    <div className="form-group">
                                        <label className="form-label">Target Audience</label>
                                        <select
                                            className="form-select"
                                            value={form.target_audience}
                                            onChange={e => setForm({ ...form, target_audience: e.target.value })}
                                        >
                                            <option value="all">All (Everyone)</option>
                                            <option value="students">Students Only</option>
                                            <option value="faculty">Faculty Only</option>
                                            <option value="parents">Parents Only</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Priority</label>
                                        <select
                                            className="form-select"
                                            value={form.priority}
                                            onChange={e => setForm({ ...form, priority: e.target.value })}
                                        >
                                            <option value="normal">Normal</option>
                                            <option value="high">High</option>
                                            <option value="urgent">Urgent 🚨</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", alignItems: "center" }}>
                                    <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "1rem" }}>
                                        <input
                                            type="checkbox"
                                            id="is_pinned"
                                            checked={form.is_pinned}
                                            onChange={e => setForm({ ...form, is_pinned: e.target.checked })}
                                            style={{ width: "1.2rem", height: "1.2rem", cursor: "pointer" }}
                                        />
                                        <label htmlFor="is_pinned" className="form-label" style={{ marginBottom: 0, cursor: "pointer" }}>📌 Pin to Top</label>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Expires At (Optional)</label>
                                        <input
                                            type="datetime-local"
                                            className="form-input"
                                            value={form.expires_at}
                                            onChange={e => setForm({ ...form, expires_at: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="modal-footer" style={{ marginTop: "1.5rem" }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary">{editingId ? "Save Changes" : "Post Announcement"}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Announcements;
