/**
 * MobileAnnouncements.jsx — Admin Mobile Announcements Management
 *
 * Mobile-optimized redesign of the Announcements page for Admin.
 * Matches the design from img1 adapted to mobile screens.
 */

import { useState, useEffect, useContext, useCallback } from "react";
import { AuthContext } from "../../context/AuthContext";
import announcementService from "../../services/announcement.service";
import "./MobileAnnouncements.css";

// ── Decorative Sparkline ──────────────────────────────────────────────────────
const Sparkline = ({ color = "#7C3AED", points = "0,15 10,8 20,12 30,5 40,8 50,2" }) => (
    <svg width="50" height="16" viewBox="0 0 50 16" fill="none" style={{ flexShrink: 0 }}>
        <polyline
            points={points}
            stroke={color}
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

// ── Stat Card Component ───────────────────────────────────────────────────────
const StatCard = ({ icon, iconBg, label, value, sub, sparkColor, sparkPoints }) => (
    <div className="mann-stat-card">
        <div className="mann-stat-top">
            <div className="mann-stat-icon" style={{ background: iconBg }}>{icon}</div>
            <div className="mann-stat-info">
                <span className="mann-stat-label">{label}</span>
                <span className="mann-stat-value">{value}</span>
                <span className="mann-stat-sub">{sub}</span>
            </div>
        </div>
        <div className="mann-stat-spark">
            <Sparkline color={sparkColor} points={sparkPoints} />
        </div>
    </div>
);

// ── Announcement Card Component ───────────────────────────────────────────────
const AnnouncementCard = ({ announcement, onMenuClick, onEdit }) => {
    const p = announcement.priority || "normal";
    
    const getColors = (priority) => {
        if (priority === 'urgent') return { bg: '#fffbeb', text: '#d97706', border: '#f59e0b', icon: '🔔' };
        if (priority === 'high') return { bg: '#f3e8ff', text: '#7c3aed', border: '#7c3aed', icon: '🔔' }; // Used purple for 'Important/High' as per img1
        return { bg: '#fefce8', text: '#ca8a04', border: '#eab308', icon: '🔔' }; // Normal
    };
    const c = getColors(p);

    const dateStr = announcement.created_at || announcement.createdAt;
    const formattedDate = new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const formattedTime = new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const author = announcement.creator?.name || announcement.posted_by || "IT Hub";

    return (
        <div className="mann-card" style={{ borderLeftColor: c.border }} onClick={() => onEdit(announcement)}>
            <div className="mann-card-left">
                <div className="mann-priority-pill" style={{ background: c.bg, color: c.text }}>
                    ☆ {p.charAt(0).toUpperCase() + p.slice(1)}
                </div>
                <div className="mann-icon-box" style={{ background: c.bg, color: c.text }}>
                    {c.icon}
                </div>
            </div>
            
            <div className="mann-card-content">
                <div className="mann-card-header">
                    <h3 className="mann-card-title">{announcement.title}</h3>
                    <div className="mann-card-actions">
                        <div className="mann-audience-pill">
                            👥 To: {announcement.target_audience === 'all' ? 'All' : announcement.target_audience.charAt(0).toUpperCase() + announcement.target_audience.slice(1)}
                        </div>
                        <button className="mann-menu-btn" onClick={(e) => { e.stopPropagation(); onMenuClick(announcement); }}>⋮</button>
                    </div>
                </div>
                
                <p className="mann-card-desc">{announcement.content}</p>
                
                <div className="mann-card-footer">
                    <div className="mann-meta">
                        <span>🗓 {formattedDate}, {formattedTime}</span>
                        <span>👤 {author}</span>
                    </div>
                    <div className="mann-status-pill">
                        ✓ Published
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function MobileAnnouncements() {
    const { user } = useContext(AuthContext);
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form Modal States
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

    // Filter & Search
    const [filterTab, setFilterTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState('newest');

    const fetchAnnouncements = useCallback(async () => {
        setLoading(true);
        try {
            const res = await announcementService.getAllAnnouncements();
            setAnnouncements(res.announcements || []);
        } catch (error) {
            console.error("Error fetching announcements", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAnnouncements();
    }, [fetchAnnouncements, user?.role]);

    // Modal Handlers
    const handleOpenModal = (ann = null) => {
        if (ann) {
            setEditingId(ann.id);
            setForm({
                title: ann.title,
                content: ann.content,
                target_audience: ann.target_audience,
                priority: ann.priority,
                is_pinned: ann.is_pinned,
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
                alert("Announcement updated successfully");
            } else {
                await announcementService.createAnnouncement(payload);
                alert("Announcement created successfully");
            }
            setShowModal(false);
            fetchAnnouncements();
        } catch (error) {
            alert(error.response?.data?.message || "Error saving announcement");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this announcement?")) return;
        try {
            await announcementService.deleteAnnouncement(id);
            alert("Announcement deleted successfully");
            setShowModal(false);
            fetchAnnouncements();
        } catch (error) {
            alert(error.response?.data?.message || "Error deleting announcement");
        }
    };

    // Apply Filters & Search
    const filteredAnnouncements = announcements
        .filter(ann => {
            const q = searchQuery.toLowerCase();
            return ann.title?.toLowerCase().includes(q) || ann.content?.toLowerCase().includes(q);
        })
        .sort((a, b) => {
            const dateA = new Date(a.created_at || a.createdAt);
            const dateB = new Date(b.created_at || b.createdAt);
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });

    return (
        <div className="mann-page">
            {/* ── Page Header ── */}
            <div className="mann-page-header">
                <div className="mann-ph-left">
                    <div className="mann-ph-icon">📢</div>
                    <div>
                        <h1 className="mann-page-title">Announcements</h1>
                        <p className="mann-page-sub">Communicate important updates to the right audience</p>
                    </div>
                </div>
                <button className="mann-new-btn" onClick={() => handleOpenModal()}>
                    + New Announcement
                </button>
            </div>

            {/* ── Stats Grid ── */}
            <div className="mann-stats-grid">
                <StatCard
                    icon="📋" iconBg="#f3e8ff"
                    label="Total Announcements" value={loading ? "—" : announcements.length}
                    sub="All time"
                    sparkColor="#8b5cf6"
                    sparkPoints="0,15 10,12 20,14 30,8 40,10 50,4"
                />
                <StatCard
                    icon="📄" iconBg="#dcfce7"
                    label="Published" value={loading ? "—" : announcements.length}
                    sub="Active"
                    sparkColor="#10b981"
                    sparkPoints="0,12 10,14 20,10 30,6 40,8 50,3"
                />
                <StatCard
                    icon="📅" iconBg="#fef3c7"
                    label="Scheduled" value={loading ? "—" : 0}
                    sub="Upcoming"
                    sparkColor="#f59e0b"
                    sparkPoints="0,14 10,8 20,10 30,5 40,7 50,2"
                />
                <StatCard
                    icon="📝" iconBg="#fee2e2"
                    label="Drafts" value={loading ? "—" : 0}
                    sub="Unpublished"
                    sparkColor="#ef4444"
                    sparkPoints="0,12 10,14 20,8 30,10 40,5 50,4"
                />
            </div>

            {/* ── Tabs ── */}
            <div className="mann-tabs">
                <div className={`mann-tab ${filterTab === 'all' ? 'active' : ''}`} onClick={() => setFilterTab('all')}>All Announcements</div>
                <div className={`mann-tab ${filterTab === 'priority' ? 'active' : ''}`} onClick={() => setFilterTab('priority')}>By Priority</div>
                <div className={`mann-tab ${filterTab === 'audience' ? 'active' : ''}`} onClick={() => setFilterTab('audience')}>By Audience</div>
            </div>

            {/* ── Search & Filters Row ── */}
            <div className="mann-search-row">
                <div className="mann-search-wrap">
                    <span className="mann-search-icon">🔍</span>
                    <input
                        className="mann-search-input"
                        placeholder="Search announcements..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <button className="mann-filter-btn">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M1 3h14v2H1V3zm3 4h8v2H4V7zm2 4h4v2H6v-2z" />
                    </svg>
                    Filter
                </button>
            </div>

            {/* ── Reset & Sort Row ── */}
            <div className="mann-sort-row">
                <button className="mann-reset-btn" onClick={() => { setSearchQuery(''); setSortOrder('newest'); }}>
                    ↺ Reset
                </button>
                <div className="mann-sort-wrap">
                    <select className="mann-sort-select" value={sortOrder} onChange={e => setSortOrder(e.target.value)}>
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                    </select>
                </div>
            </div>

            {/* ── Announcements List ── */}
            <div className="mann-list">
                {loading ? (
                    <div className="mann-loading">Loading...</div>
                ) : filteredAnnouncements.length === 0 ? (
                    <div className="mann-empty">No announcements found</div>
                ) : (
                    filteredAnnouncements.map(ann => (
                        <AnnouncementCard 
                            key={ann.id} 
                            announcement={ann}
                            onMenuClick={() => handleOpenModal(ann)}
                            onEdit={() => handleOpenModal(ann)}
                        />
                    ))
                )}
            </div>
            
            {/* ── Create / Edit Modal ── */}
            {showModal && (
                <div className="mann-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="mann-modal" onClick={e => e.stopPropagation()}>
                        <div className="mann-modal-header">
                            <div>
                                <h3>{editingId ? "Edit Announcement" : "Create Announcement"}</h3>
                                <p>Fill in the details to publish</p>
                            </div>
                            <button className="mann-modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="mann-modal-body">
                            <form onSubmit={handleSubmit}>
                                <div className="mann-form-group">
                                    <label>Title <span>*</span></label>
                                    <input 
                                        type="text" 
                                        required 
                                        placeholder="e.g. Exam Schedule Release" 
                                        value={form.title}
                                        onChange={e => setForm({ ...form, title: e.target.value })}
                                    />
                                </div>
                                <div className="mann-form-group">
                                    <label>Content <span>*</span></label>
                                    <textarea 
                                        required 
                                        placeholder="Enter full details..."
                                        rows="4"
                                        value={form.content}
                                        onChange={e => setForm({ ...form, content: e.target.value })}
                                    ></textarea>
                                </div>
                                <div className="mann-form-row">
                                    <div className="mann-form-group">
                                        <label>Target Audience <span>*</span></label>
                                        <select 
                                            value={form.target_audience}
                                            onChange={e => setForm({ ...form, target_audience: e.target.value })}
                                        >
                                            <option value="all">All (Everyone)</option>
                                            <option value="students">Students Only</option>
                                            <option value="faculty">Faculty Only</option>
                                            <option value="parents">Parents Only</option>
                                        </select>
                                    </div>
                                    <div className="mann-form-group">
                                        <label>Priority <span>*</span></label>
                                        <select
                                            value={form.priority}
                                            onChange={e => setForm({ ...form, priority: e.target.value })}
                                        >
                                            <option value="normal">🟢 Normal</option>
                                            <option value="high">🟠 High</option>
                                            <option value="urgent">🔴 Urgent</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="mann-form-group">
                                    <label>Expires At (Optional)</label>
                                    <input 
                                        type="datetime-local" 
                                        value={form.expires_at}
                                        onChange={e => setForm({ ...form, expires_at: e.target.value })}
                                    />
                                </div>
                                <div className="mann-form-group mann-checkbox-group">
                                    <label>
                                        <input 
                                            type="checkbox"
                                            checked={form.is_pinned}
                                            onChange={e => setForm({ ...form, is_pinned: e.target.checked })}
                                        />
                                        Pin this announcement to the top
                                    </label>
                                </div>
                                
                                <div className="mann-modal-footer">
                                    {editingId && (
                                        <button type="button" className="mann-btn-delete" onClick={() => handleDelete(editingId)}>
                                            Delete
                                        </button>
                                    )}
                                    <button type="submit" className="mann-btn-save">
                                        {editingId ? "Save Changes" : "Post Announcement"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
