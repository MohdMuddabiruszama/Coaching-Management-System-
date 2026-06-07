/**
 * Faculty Announcements Page (Phase 8)
 * Two tabs: My Announcements (editable) & Institute Announcements (read-only)
 */
import { useState, useEffect, useMemo } from "react";
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

    // New filtering and search state
    const [filterType, setFilterType] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

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

    // Client-side filtering logic
    const filteredAnnouncements = useMemo(() => {
        let result = announcements;

        if (filterType === 'urgent') result = result.filter(a => a.priority === 'urgent');
        else if (filterType === 'normal') result = result.filter(a => a.priority === 'normal');
        else if (filterType === 'faculty') result = result.filter(a => a.target_audience === 'faculty');
        else if (filterType === 'students') result = result.filter(a => a.target_audience === 'students');
        else if (filterType === 'parents') result = result.filter(a => a.target_audience === 'parents');

        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase();
            result = result.filter(a => 
                a.title.toLowerCase().includes(query) || 
                a.content.toLowerCase().includes(query)
            );
        }

        return result;
    }, [announcements, filterType, searchQuery]);

    // Counters for the filter pills
    const counts = useMemo(() => {
        return {
            all: announcements.length,
            urgent: announcements.filter(a => a.priority === 'urgent').length,
            normal: announcements.filter(a => a.priority === 'normal').length,
            faculty: announcements.filter(a => a.target_audience === 'faculty').length,
            students: announcements.filter(a => a.target_audience === 'students').length,
            parents: announcements.filter(a => a.target_audience === 'parents').length,
        };
    }, [announcements]);

    const getAnnouncementIcon = (ann) => {
        const lowerTitle = ann.title.toLowerCase();
        if (lowerTitle.includes('sports') || lowerTitle.includes('event')) {
            return { 
                bg: '#dcfce7', 
                color: '#16a34a', 
                icon: <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M21 11c0 5.55-3.84 10.74-9 12-5.16-1.26-9-6.45-9-12V5l9-4 9 4v6z"/></svg> 
            }; 
        }
        if (ann.priority === 'urgent') {
            return { 
                bg: '#fee2e2', 
                color: '#dc2626', 
                icon: <svg viewBox="0 0 24 24" fill="currentColor" width="36" height="36"><path d="M12 2L1 21h22L12 2zm1 16h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg> 
            }; 
        }
        if (ann.target_audience === 'faculty' || lowerTitle.includes('meeting')) {
            return { 
                bg: '#f3e8ff', 
                color: '#9333ea', 
                icon: <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg> 
            }; 
        }
        return { 
            bg: '#eff6ff', 
            color: '#2563eb', 
            icon: <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg> 
        }; 
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

    const getFilterButtons = () => {
        const buttons = [
            { id: 'all', label: 'All', count: counts.all, color: '#6d28d9', bg: '#6d28d9', textColor: 'white' },
            { id: 'urgent', label: 'Urgent', count: counts.urgent, color: '#dc2626', icon: '🚨' },
            { id: 'normal', label: 'Normal', count: counts.normal, color: '#2563eb', icon: 'ℹ️' }
        ];
        
        if (activeTab === 'institute') {
            buttons.push({ id: 'faculty', label: 'For Faculty', count: counts.faculty, color: '#9333ea', icon: '🎓' });
        } else {
            buttons.push(
                { id: 'students', label: 'For Students', count: counts.students, color: '#16a34a', icon: '🧑‍🎓' },
                { id: 'parents', label: 'For Parents', count: counts.parents, color: '#ea580c', icon: '👪' }
            );
        }
        return buttons;
    };

    return (
        <div style={{ padding: '1.5rem 2rem', background: '#f8fafc', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '48px', height: '48px', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.75rem', color: '#0f172a', fontWeight: '700' }}>Announcements</h2>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', marginTop: '0.2rem' }}>Create, manage, and publish announcements for students and faculty.</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <Link to="/faculty/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', color: '#0f172a', border: '1px solid #e2e8f0', padding: '0.6rem 1.2rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', textDecoration: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                        Back
                    </Link>
                    <button onClick={() => handleOpenModal()} style={{ background: '#6d28d9', color: 'white', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 6px -1px rgba(109, 40, 217, 0.3)' }}>
                        + New Announcement
                    </button>
                </div>
            </div>

            {/* Main Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
                <button
                    onClick={() => { setActiveTab("institute"); setFilterType('all'); }}
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        background: activeTab === 'institute' ? '#6d28d9' : 'white',
                        color: activeTab === 'institute' ? 'white' : '#64748b',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-8.5-8.5L2 6v2h19V6l-9.5-4.5z"/></svg>
                    Institute Announcements
                </button>
                <button
                    onClick={() => { setActiveTab("mine"); setFilterType('all'); }}
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        background: activeTab === 'mine' ? '#6d28d9' : 'white',
                        color: activeTab === 'mine' ? 'white' : '#64748b',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    My Announcements
                </button>
            </div>

            {/* Filters and Search */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {getFilterButtons().map(f => (
                        <button
                            key={f.id}
                            onClick={() => setFilterType(f.id)}
                            style={{
                                padding: '0.4rem 0.8rem',
                                borderRadius: '20px',
                                border: filterType === f.id ? 'none' : '1px solid #e2e8f0',
                                background: filterType === f.id ? (f.bg || '#f1f5f9') : 'white',
                                color: filterType === f.id ? (f.textColor || f.color) : '#64748b',
                                fontSize: '0.8rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                transition: 'all 0.2s'
                            }}
                        >
                            {f.icon && <span>{f.icon}</span>}
                            {f.label} ({f.count})
                        </button>
                    ))}
                </div>

                <div style={{ position: 'relative', width: '280px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '12px', top: '10px' }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input 
                        type="text" 
                        placeholder="Search announcements..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%', padding: '0.5rem 1rem 0.5rem 2.2rem',
                            borderRadius: '8px', border: '1px solid #cbd5e1',
                            outline: 'none', fontSize: '0.85rem', color: '#334155'
                        }}
                    />
                </div>
            </div>

            {/* Announcements List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading announcements...</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {filteredAnnouncements.length === 0 ? (
                        <div style={{ background: 'white', borderRadius: '12px', padding: '3rem', textAlign: 'center', color: '#64748b', border: '1px solid #f1f5f9' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                            No announcements match your filters.
                        </div>
                    ) : (
                        filteredAnnouncements.map(ann => {
                            const iconData = getAnnouncementIcon(ann);
                            
                            return (
                                <div key={ann.id} style={{ 
                                    background: 'white', borderRadius: '12px', padding: '1.5rem', 
                                    border: '1px solid #f1f5f9', display: 'flex', gap: '1.5rem',
                                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', position: 'relative'
                                }}>
                                    
                                    {/* Left Icon Block */}
                                    <div style={{ 
                                        width: '80px', height: '80px', borderRadius: '12px', flexShrink: 0,
                                        background: iconData.bg, color: iconData.color,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        {iconData.icon}
                                    </div>

                                    {/* Middle Content Block */}
                                    <div style={{ flexGrow: 1 }}>
                                        <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.1rem', color: '#0f172a', fontWeight: '700' }}>
                                            {ann.title}
                                        </h3>
                                        <p style={{ margin: '0 0 1rem 0', color: '#64748b', fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {ann.content}
                                        </p>
                                        
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <span style={{ 
                                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600',
                                                background: ann.priority === 'urgent' ? '#fee2e2' : '#e0f2fe',
                                                color: ann.priority === 'urgent' ? '#dc2626' : '#2563eb',
                                                border: `1px solid ${ann.priority === 'urgent' ? '#fecaca' : '#bfdbfe'}`
                                            }}>
                                                {ann.priority === 'urgent' ? '🚨' : 'ℹ️'} {ann.priority.charAt(0).toUpperCase() + ann.priority.slice(1)}
                                            </span>
                                            
                                            <span style={{ 
                                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600',
                                                background: ann.target_audience === 'faculty' ? '#f3e8ff' : '#dcfce7',
                                                color: ann.target_audience === 'faculty' ? '#9333ea' : '#16a34a',
                                                border: `1px solid ${ann.target_audience === 'faculty' ? '#e9d5ff' : '#bbf7d0'}`
                                            }}>
                                                {ann.target_audience === 'faculty' ? '🎓' : '🧑‍🎓'} For {ann.target_audience.charAt(0).toUpperCase() + ann.target_audience.slice(1)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Right Date Block & Actions */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', flexShrink: 0, minWidth: '120px' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', color: '#64748b' }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: '2px' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                            <div style={{ fontSize: '0.8rem', fontWeight: '500', textAlign: 'right' }}>
                                                {new Date(ann.created_at || ann.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}<br/>
                                                {new Date(ann.created_at || ann.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>

                                        {activeTab === 'mine' && (
                                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                                                <button onClick={() => handleOpenModal(ann)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }} title="Edit">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                </button>
                                                <button onClick={() => handleDelete(ann.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="Delete">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                                </button>
                                            </div>
                                        )}
                                        {activeTab === 'institute' && (
                                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)} style={{ background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', inset: 0, zIndex: 1000 }}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '600px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', fontFamily: "'Inter', sans-serif" }}>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <div style={{ width: '40px', height: '40px', background: '#f3e8ff', color: '#6d28d9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: '700' }}>{editingId ? "Edit Announcement" : "Create Announcement"}</h3>
                                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', marginTop: '0.2rem' }}>Fill in the details below to create a new announcement.</p>
                                </div>
                            </div>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>
                                    <span>Title <span style={{ color: '#ef4444' }}>*</span></span>
                                    <span style={{ color: '#94a3b8', fontWeight: '400', fontSize: '0.75rem' }}>{form.title.length}/120</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={e => setForm({ ...form, title: e.target.value })}
                                    maxLength={120}
                                    placeholder="Enter announcement title..."
                                    required
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem' }}
                                />
                            </div>

                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>
                                    <span>Content <span style={{ color: '#ef4444' }}>*</span></span>
                                    <span style={{ color: '#94a3b8', fontWeight: '400', fontSize: '0.75rem' }}>{form.content.length}/2000</span>
                                </label>
                                <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
                                    <textarea
                                        rows="5"
                                        value={form.content}
                                        onChange={e => setForm({ ...form, content: e.target.value })}
                                        maxLength={2000}
                                        placeholder="Write your announcement here..."
                                        required
                                        style={{ width: '100%', padding: '0.75rem', border: 'none', outline: 'none', resize: 'vertical', fontSize: '0.9rem', minHeight: '100px' }}
                                    ></textarea>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>Audience <span style={{ color: '#ef4444' }}>*</span></label>
                                    <select
                                        value={form.target_audience}
                                        onChange={e => setForm({ ...form, target_audience: e.target.value })}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #6d28d9', outline: 'none', appearance: 'none', background: 'white', fontSize: '0.9rem' }}
                                    >
                                        <option value="students">Students</option>
                                        <option value="parents">Parents</option>
                                    </select>
                                    <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>Select who will see this announcement</p>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>Priority <span style={{ color: '#ef4444' }}>*</span></label>
                                    <select
                                        value={form.priority}
                                        onChange={e => setForm({ ...form, priority: e.target.value })}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', appearance: 'none', background: 'white', fontSize: '0.9rem' }}
                                    >
                                        <option value="normal">🔵 Normal</option>
                                        <option value="high">🟠 High</option>
                                        <option value="urgent">🔴 Urgent</option>
                                    </select>
                                    <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>Set the priority level</p>
                                </div>
                            </div>

                            <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '1.5rem', border: '1px solid #bfdbfe' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#1e3a8a', lineHeight: '1.4' }}>This announcement will be visible to selected audience immediately after publishing.</p>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', color: '#475569', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem' }}>Cancel</button>
                                <button type="submit" style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', background: '#6d28d9', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                                    {editingId ? "Save Changes" : "Publish Announcement"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default FacultyAnnouncements;
