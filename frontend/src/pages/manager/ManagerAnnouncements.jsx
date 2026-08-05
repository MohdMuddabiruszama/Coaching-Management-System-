/**
 * ManagerAnnouncements.jsx
 * View + post text-only announcements for manager mobile.
 * No file/image uploads on mobile (web-only).
 * 1 API call on load, 1 POST on submit.
 */
import { useState, useEffect, useContext, useCallback } from "react";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import "./ManagerAnnouncements.css";

const PRIORITY_OPTS = [
    { label: "🔵 Normal", value: "normal" },
    { label: "🟡 High",   value: "high"   },
    { label: "🔴 Urgent", value: "urgent" },
];

function timeAgo(dateStr) {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function ManagerAnnouncements() {
    const { user } = useContext(AuthContext);
    const canWrite = user?.permissions?.some(p => p === "announcements" || p.startsWith("announcements:") || p === "*") || user?.role === 'manager' || user?.role === 'admin';

    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ title: "", content: "", priority: "normal", target_audience: "students" });
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");

    const fetchAnnouncements = useCallback(async () => {
        setLoading(true);
        try {
            // GET /api/announcements — returns all announcements for manager
            const res = await api.get("/announcements");
            setAnnouncements(res.data.data?.announcements || res.data.announcements || res.data.data || []);
        } catch (e) {
            console.error("Fetch announcements error:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

    const handleFormChange = (key, val) => {
        setForm(prev => ({ ...prev, [key]: val }));
        setFormError("");
    };

    const handleSubmit = async () => {
        if (!form.title.trim()) { setFormError("Title is required."); return; }
        if (!form.content.trim()) { setFormError("Message is required."); return; }
        setSubmitting(true);
        try {
            await api.post("/announcements", {
                title: form.title.trim(),
                content: form.content.trim(),
                priority: form.priority,
                target_audience: form.target_audience,
            });
            setForm({ title: "", content: "", priority: "normal", target_audience: "students" });
            setShowForm(false);
            fetchAnnouncements();
        } catch (e) {
            setFormError(e.response?.data?.message || "Failed to post announcement.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="man-page">
            {/* Header Row */}
            <div className="man-header-row">
                <h2 className="man-title">📢 Announcements</h2>
            </div>
            
            {/* FAB Button for new announcement */}
            {canWrite && !showForm && (
                <button className="man-fab-btn" onClick={() => setShowForm(true)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
            )}

            {/* Post Form */}
            {showForm && (
                <div className="man-post-card">
                    <p className="man-post-title">New Announcement</p>
                    <input
                        className="man-input"
                        placeholder="Title *"
                        value={form.title}
                        onChange={e => handleFormChange("title", e.target.value)}
                        maxLength={200}
                    />
                    <textarea
                        className="man-input man-textarea"
                        placeholder="Message *"
                        value={form.content}
                        onChange={e => handleFormChange("content", e.target.value)}
                    />
                    <select
                        className="man-input"
                        value={form.target_audience}
                        onChange={e => handleFormChange("target_audience", e.target.value)}
                    >
                        <option value="students">For Students</option>
                        <option value="parents">For Parents</option>
                        <option value="faculty">For Faculty</option>
                        <option value="all">For Everyone</option>
                    </select>
                    <div className="man-priority-row">
                        {PRIORITY_OPTS.map(opt => (
                            <button
                                key={opt.value}
                                className={`man-priority-opt${form.priority === opt.value ? " active" : ""}`}
                                onClick={() => handleFormChange("priority", opt.value)}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    {formError && <p className="man-error-msg">{formError}</p>}
                    <div className="man-post-actions">
                        <button className="man-submit-btn" onClick={handleSubmit} disabled={submitting}>
                            {submitting ? "Posting..." : "Post Announcement"}
                        </button>
                        <button className="man-cancel-btn" onClick={() => { setShowForm(false); setFormError(""); }}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="man-loading">
                    <div className="man-spinner" />
                    Loading...
                </div>
            ) : announcements.length === 0 ? (
                <div className="man-empty">
                    <span className="man-empty-icon">📢</span>
                    No announcements yet.
                </div>
            ) : (
                <div className="man-list">
                    {announcements.map((ann, i) => (
                        <div key={ann.id || i} className={`man-ann-card priority-${ann.priority || "normal"}`}>
                            <div className="man-ann-header">
                                <p className="man-ann-title">{ann.title}</p>
                                <span className={`man-priority-badge ${ann.priority || "normal"}`}>
                                    {ann.priority || "normal"}
                                </span>
                            </div>
                            <p className="man-ann-content">{ann.content}</p>
                            <p className="man-ann-meta">
                                {ann.creator?.name || "Admin"} · {timeAgo(ann.created_at || ann.createdAt)}
                                {ann.target_audience ? ` · For ${ann.target_audience}` : ""}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default ManagerAnnouncements;
