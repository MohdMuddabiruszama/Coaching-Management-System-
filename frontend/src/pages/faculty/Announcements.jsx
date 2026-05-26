/**
 * Faculty Announcements Page (Phase 8)
 * Two tabs: My Announcements (editable) & Institute Announcements (read-only)
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import announcementService from "../../services/announcement.service";
import api from "../../services/api";
import PriorityBadge from "../../components/PriorityBadge";
import ThemeSelector from "../../components/ThemeSelector";
import "../admin/Dashboard.css";

function FacultyAnnouncements() {
    const [activeTab, setActiveTab] = useState("institute"); // 'institute' or 'mine'
    const [announcements, setAnnouncements] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const initialForm = {
        title: "",
        content: "",
        target_audience: "students",
        priority: "normal",
        subject_id: "",
        is_pinned: false,
    };
    const [form, setForm] = useState(initialForm);

    useEffect(() => {
        fetchAnnouncements();
        fetchSubjects();
    }, [activeTab]);

    const fetchAnnouncements = async () => {
        setLoading(true);
        try {
            const list = await announcementService.getFacultyAnnouncements(activeTab);
            setAnnouncements(list);
            
            // Auto mark read if viewing institute tab
            if (activeTab === "institute") {
                const unread = list.filter(a => !a.is_read);
                if (unread.length > 0) {
                    await announcementService.markAllAsRead();
                }
            }
        } catch (error) {
            console.error("Error fetching announcements", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSubjects = async () => {
        try {
            const res = await api.get("/subjects");
            setSubjects(res.data.data || []);
        } catch (error) {
            console.error(error);
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
                subject_id: ann.subject_id || "",
                is_pinned: ann.is_pinned,
            });
        } else {
            setEditingId(null);
            setForm(initialForm);
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...form, subject_id: form.subject_id || null };
            if (editingId) {
                await announcementService.updateAnnouncement(editingId, payload);
                import("react-hot-toast").then(m => m.toast.success("Announcement updated"));
            } else {
                await announcementService.createAnnouncement(payload);
                import("react-hot-toast").then(m => m.toast.success("Announcement posted"));
            }
            setShowModal(false);
            fetchAnnouncements();
        } catch (error) {
            import("react-hot-toast").then(m => m.toast.error(error.response?.data?.message || "Error"));
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this announcement?")) return;
        try {
            await announcementService.deleteAnnouncement(id);
            import("react-hot-toast").then(m => m.toast.success("Deleted"));
            fetchAnnouncements();
        } catch (error) {
            import("react-hot-toast").then(m => m.toast.error("Error deleting"));
        }
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <h1>📢 Announcements</h1>
                    <p>Manage and view institute announcements</p>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <ThemeSelector />
                    <Link to="/faculty/dashboard" className="btn btn-secondary">
                        ← Back
                    </Link>
                    <button
                        className="btn btn-primary btn-animated"
                        onClick={() => handleOpenModal()}
                    >
                        + New Announcement
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", borderBottom: "2px solid var(--border-color)", paddingBottom: "0.5rem" }}>
                <button
                    onClick={() => setActiveTab("institute")}
                    style={{
                        background: "none", border: "none", fontSize: "1.1rem", fontWeight: "bold",
                        cursor: "pointer", color: activeTab === "institute" ? "var(--primary-color)" : "var(--text-muted)",
                        borderBottom: activeTab === "institute" ? "3px solid var(--primary-color)" : "none",
                        paddingBottom: "0.5rem", marginBottom: "-0.6rem"
                    }}
                >
                    Institute Announcements
                </button>
                <button
                    onClick={() => setActiveTab("mine")}
                    style={{
                        background: "none", border: "none", fontSize: "1.1rem", fontWeight: "bold",
                        cursor: "pointer", color: activeTab === "mine" ? "var(--primary-color)" : "var(--text-muted)",
                        borderBottom: activeTab === "mine" ? "3px solid var(--primary-color)" : "none",
                        paddingBottom: "0.5rem", marginBottom: "-0.6rem"
                    }}
                >
                    My Announcements
                </button>
            </div>

            {loading ? <p>Loading...</p> : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    {announcements.length === 0 ? (
                        <div className="card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "2rem" }}>
                            <p>No announcements found in this tab.</p>
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
                                            🎯 To: {ann.target_audience === "students" ? "Students" : ann.target_audience}
                                        </span>
                                    </div>
                                    {activeTab === "mine" && (
                                        <div style={{ display: "flex", gap: "0.5rem", zIndex: 10 }}>
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
                                        </div>
                                    )}
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
                                            {(ann.creator?.name || ann.posted_by || (activeTab === "mine" ? "Y" : "U")).charAt(0).toUpperCase()}
                                        </span>
                                        <span>
                                            Posted by <strong>{ann.creator?.name || ann.posted_by || (activeTab === "mine" ? "You" : "Unknown")}</strong> on {new Date(ann.created_at || ann.createdAt).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "500px" }}>
                        <div className="modal-header">
                            <h3>{editingId ? "Edit Announcement" : "Create Announcement"}</h3>
                            <button onClick={() => setShowModal(false)} className="btn btn-sm">×</button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label className="form-label">Title</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={form.title}
                                        onChange={e => setForm({ ...form, title: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Content</label>
                                    <textarea
                                        className="form-input"
                                        rows="4"
                                        value={form.content}
                                        onChange={e => setForm({ ...form, content: e.target.value })}
                                        required
                                    ></textarea>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Target Audience</label>
                                    <select
                                        className="form-select"
                                        value={form.target_audience}
                                        onChange={e => setForm({ ...form, target_audience: e.target.value })}
                                    >
                                        <option value="students">Students</option>
                                        <option value="parents">Parents</option>
                                        <option value="all">Everyone</option>
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
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>
                                <div className="modal-footer">
                                    <button type="submit" className="btn btn-primary">{editingId ? "Save" : "Post"}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default FacultyAnnouncements;
