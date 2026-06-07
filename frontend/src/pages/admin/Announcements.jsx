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

    // Filter States
    const [filterTab, setFilterTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState('newest');

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

    if (loading) return <div className="students-container">Loading...</div>;

    const filteredAnnouncements = announcements
        .filter(ann => ann.title.toLowerCase().includes(searchQuery.toLowerCase()) || ann.content.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            if (filterTab === 'priority') {
                const p = { urgent: 3, high: 2, normal: 1 };
                return (p[b.priority] || 0) - (p[a.priority] || 0);
            }
            if (filterTab === 'audience') {
                return a.target_audience.localeCompare(b.target_audience);
            }
            
            // Default time based sort
            const dateA = new Date(a.created_at || a.createdAt);
            const dateB = new Date(b.created_at || b.createdAt);
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });

    return (
        <div className="students-container" style={{ background: '#f9fafb', minHeight: '100vh', padding: '1.5rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: 48, height: 48, background: '#f3e8ff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: '#8b5cf6' }}>
                            📢
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#111827', fontWeight: 800 }}>Announcements</h1>
                            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem', marginTop: 4 }}>Communicate important updates to the right audience</p>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div className="st-breadcrumbs" style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span>Dashboard</span>
                        <span>›</span>
                        <span style={{ color: '#0f172a', fontWeight: '500' }}>Announcements</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <ThemeSelector />
                        <Link to="/admin/dashboard" className="btn btn-secondary" style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#374151', padding: '0.5rem 1rem', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                            ← Back
                        </Link>
                        {['admin', 'faculty', 'manager'].includes(user?.role) && (
                            <button onClick={() => handleOpenModal()} style={{ background: '#7e22ce', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                + New Announcement
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
                {/* Total */}
                <div style={{ background: '#fff', padding: '1.5rem', borderRadius: 12, border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: '#f3e8ff', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>📋</div>
                    <div>
                        <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 600 }}>Total Announcements</div>
                        <div style={{ color: '#111827', fontSize: 20, fontWeight: 800, marginTop: 2 }}>{announcements.length || 12}</div>
                        <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>All time</div>
                    </div>
                </div>
                {/* Published */}
                <div style={{ background: '#fff', padding: '1.5rem', borderRadius: 12, border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: '#dcfce7', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>📄</div>
                    <div>
                        <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 600 }}>Published</div>
                        <div style={{ color: '#111827', fontSize: 20, fontWeight: 800, marginTop: 2 }}>9</div>
                        <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>Active</div>
                    </div>
                </div>
                {/* Scheduled */}
                <div style={{ background: '#fff', padding: '1.5rem', borderRadius: 12, border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: '#fef3c7', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>📅</div>
                    <div>
                        <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 600 }}>Scheduled</div>
                        <div style={{ color: '#111827', fontSize: 20, fontWeight: 800, marginTop: 2 }}>2</div>
                        <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>Upcoming</div>
                    </div>
                </div>
                {/* Drafts */}
                <div style={{ background: '#fff', padding: '1.5rem', borderRadius: 12, border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>📝</div>
                    <div>
                        <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 600 }}>Drafts</div>
                        <div style={{ color: '#111827', fontSize: 20, fontWeight: 800, marginTop: 2 }}>1</div>
                        <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>Unpublished</div>
                    </div>
                </div>
            </div>

            {/* Filters Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '2rem' }}>
                    <div onClick={() => setFilterTab('all')} style={{ color: filterTab === 'all' ? '#7e22ce' : '#6b7280', fontWeight: 600, fontSize: 13, paddingBottom: '0.5rem', borderBottom: filterTab === 'all' ? '2px solid #7e22ce' : '2px solid transparent', cursor: 'pointer' }}>All Announcements</div>
                    <div onClick={() => setFilterTab('priority')} style={{ color: filterTab === 'priority' ? '#7e22ce' : '#6b7280', fontWeight: 600, fontSize: 13, paddingBottom: '0.5rem', borderBottom: filterTab === 'priority' ? '2px solid #7e22ce' : '2px solid transparent', cursor: 'pointer' }}>By Priority</div>
                    <div onClick={() => setFilterTab('audience')} style={{ color: filterTab === 'audience' ? '#7e22ce' : '#6b7280', fontWeight: 600, fontSize: 13, paddingBottom: '0.5rem', borderBottom: filterTab === 'audience' ? '2px solid #7e22ce' : '2px solid transparent', cursor: 'pointer' }}>By Audience</div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>🔍</span>
                        <input type="text" placeholder="Search announcements..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ padding: '0.5rem 1rem 0.5rem 2rem', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, width: 200 }} />
                    </div>
                    <button onClick={() => { setSearchQuery(''); setFilterTab('all'); setSortOrder('newest'); }} style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '0.5rem 1rem', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                        ⭯ Reset
                    </button>
                    <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '0.5rem 1rem', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                    </select>
                </div>
            </div>

            {/* Announcements List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: '2rem' }}>
                {filteredAnnouncements.length === 0 ? (
                    <div className="card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "2rem", color: '#6b7280' }}>
                        <p>No announcements found.</p>
                    </div>
                ) : (
                    filteredAnnouncements.map(ann => {
                        const getColors = (p) => {
                            if(p === 'urgent') return { bg: '#fffbeb', text: '#d97706', border: '#f59e0b', icon: '🔔' };
                            if(p === 'high') return { bg: '#fef2f2', text: '#ef4444', border: '#ef4444', icon: '⚠️' };
                            return { bg: '#fefce8', text: '#ca8a04', border: '#eab308', icon: 'ℹ️' }; // Normal
                        };
                        const c = getColors(ann.priority);

                        return (
                            <div key={ann.id} style={{
                                background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', 
                                borderLeft: `4px solid ${c.border}`, padding: '1.25rem',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                            }}>
                                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flex: 1 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', width: '80px' }}>
                                        <div style={{ background: c.bg, color: c.text, padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            ☆ {ann.priority.charAt(0).toUpperCase() + ann.priority.slice(1)}
                                        </div>
                                        <div style={{ width: 36, height: 36, background: c.bg, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: c.text }}>
                                            {c.icon}
                                        </div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ margin: '0 0 4px 0', color: '#111827', fontSize: '1.1rem', fontWeight: 700 }}>{ann.title}</h3>
                                        <p style={{ margin: '0 0 8px 0', color: '#6b7280', fontSize: 13, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ann.content}</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#9ca3af', fontSize: 11 }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>📅 {new Date(ann.created_at || ann.createdAt).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})}, {new Date(ann.created_at || ann.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>👤 {ann.creator?.name || ann.posted_by || "IT Hub"}</span>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start', minWidth: '110px' }}>
                                        <span style={{ background: '#eff6ff', color: '#3b82f6', padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            👥 To: {ann.target_audience.charAt(0).toUpperCase() + ann.target_audience.slice(1)}
                                        </span>
                                        <span style={{ background: '#dcfce7', color: '#10b981', padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            ✓ Published
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '1px solid #e5e7eb', paddingLeft: '1.5rem' }}>
                                        {(['admin', 'manager'].includes(user?.role) || (user?.role === 'faculty' && ann.created_by === user?.id)) && (
                                            <>
                                                <button onClick={() => handleOpenModal(ann)} style={{ background: '#fff', border: '1px solid #e5e7eb', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                                                    ✏️
                                                </button>
                                                <button onClick={() => handleDelete(ann.id)} style={{ background: '#fff', border: '1px solid #e5e7eb', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                                                    🗑️
                                                </button>
                                            </>
                                        )}
                                    </div>
                                    <div style={{ color: '#9ca3af', cursor: 'pointer', padding: '0 0.5rem' }}>⋮</div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Pagination Placeholder */}
            {filteredAnnouncements.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#6b7280', fontSize: 13 }}>
                    <div>Showing 1 to {Math.min(6, filteredAnnouncements.length)} of {filteredAnnouncements.length} announcements</div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '0.4rem 0.8rem', borderRadius: 6, cursor: 'pointer', color: '#374151', fontSize: 12 }}>&lt; Previous</button>
                        <button style={{ background: '#7e22ce', border: '1px solid #7e22ce', padding: '0.4rem 0.8rem', borderRadius: 6, cursor: 'pointer', color: '#fff', fontSize: 12 }}>1</button>
                        <button style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '0.4rem 0.8rem', borderRadius: 6, cursor: 'pointer', color: '#374151', fontSize: 12 }}>2</button>
                        <button style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '0.4rem 0.8rem', borderRadius: 6, cursor: 'pointer', color: '#374151', fontSize: 12 }}>Next &gt;</button>
                    </div>
                </div>
            )}

            {/* Create / Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)} style={{ background: 'rgba(17, 24, 39, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', maxWidth: '600px', width: '95%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', overflow: 'hidden' }}>
                        
                        {/* Modal Header */}
                        <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f3f4f6' }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#f3e8ff', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>📢</div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#111827', fontWeight: 800 }}>{editingId ? "Edit Announcement" : "Create Announcement"}</h3>
                                    <p style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem', marginTop: 4 }}>Fill in the details to publish a new announcement</p>
                                </div>
                            </div>
                            <button onClick={() => setShowModal(false)} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '1.5rem', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Title <span style={{color: '#ef4444'}}>*</span></label>
                                    <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Exam Schedule Release" style={{ width: '100%', padding: '0.6rem 1rem', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14 }} />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Content <span style={{color: '#ef4444'}}>*</span></label>
                                    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>

                                        <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} required placeholder="Enter full details..." rows="5" style={{ width: '100%', padding: '1rem', border: 'none', fontSize: 14, outline: 'none', resize: 'vertical' }}></textarea>
                                        <div style={{ padding: '0.2rem 1rem 0.5rem', textAlign: 'right', fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>{form.content.length} / 2000</div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '1.5rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Target Audience <span style={{color: '#ef4444'}}>*</span></label>
                                        <select value={form.target_audience} onChange={e => setForm({ ...form, target_audience: e.target.value })} style={{ width: '100%', padding: '0.6rem 1rem', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, marginBottom: 4 }}>
                                            <option value="all">All (Everyone)</option>
                                            <option value="students">Students Only</option>
                                            <option value="faculty">Faculty Only</option>
                                            <option value="parents">Parents Only</option>
                                        </select>
                                        <div style={{ fontSize: 11, color: '#6b7280' }}>Select who should see this announcement</div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Priority <span style={{color: '#ef4444'}}>*</span></label>
                                        <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={{ width: '100%', padding: '0.6rem 1rem', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, marginBottom: 4 }}>
                                            <option value="normal">🟢 Normal</option>
                                            <option value="high">🟠 High</option>
                                            <option value="urgent">🔴 Urgent</option>
                                        </select>
                                        <div style={{ fontSize: 11, color: '#6b7280' }}>Set the importance level</div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Expires At (Optional)</label>
                                        <input type="datetime-local" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} style={{ width: '100%', padding: '0.6rem 1rem', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, marginBottom: 4, color: form.expires_at ? '#111827' : '#9ca3af' }} />
                                        <div style={{ fontSize: 11, color: '#6b7280' }}>Leave empty for no expiry</div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Pin to Top</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 4, height: '38px' }}>
                                            <div onClick={() => setForm({ ...form, is_pinned: !form.is_pinned })} style={{ width: 44, height: 24, background: form.is_pinned ? '#7e22ce' : '#e5e7eb', borderRadius: 12, position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                                                <div style={{ width: 20, height: 20, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: form.is_pinned ? 22 : 2, transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}></div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 11, color: '#6b7280' }}>Pin this announcement to the top of the list</div>
                                    </div>
                                </div>

                                {/* Modal Footer */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px solid #f3f4f6' }}>
                                    <button type="button" onClick={() => setShowModal(false)} style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '0.6rem 1.5rem', borderRadius: 8, fontWeight: 600, color: '#374151', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                                    <button type="submit" style={{ background: '#7e22ce', border: 'none', padding: '0.6rem 1.5rem', borderRadius: 8, fontWeight: 600, color: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        🚀 {editingId ? "Save Changes" : "Post Announcement"}
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

export default Announcements;
