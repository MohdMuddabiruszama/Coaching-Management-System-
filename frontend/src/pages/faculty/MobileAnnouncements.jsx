import { useState, useEffect, useMemo } from "react";
import announcementService from "../../services/announcement.service";
import api from "../../services/api";
import { toast } from "react-hot-toast";

function FacultyMobileAnnouncements() {
    const [activeTab, setActiveTab] = useState("institute"); // 'institute' or 'mine'
    const [announcements, setAnnouncements] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // UI states
    const [viewMode, setViewMode] = useState("list"); // 'list', 'details', 'create_edit'
    const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
    const [editingId, setEditingId] = useState(null);

    // Filters
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

    const getFilterButtons = () => {
        const buttons = [
            { id: 'all', label: 'All', count: counts.all, bg: '#6d28d9', textColor: 'white' },
            { id: 'urgent', label: 'Urgent', count: counts.urgent, icon: '🚨', iconColor: '#dc2626' },
            { id: 'normal', label: 'Normal', count: counts.normal, icon: 'ℹ️', iconColor: '#2563eb' }
        ];
        
        if (activeTab === 'institute') {
            buttons.push({ id: 'faculty', label: 'For Faculty', count: counts.faculty, icon: '🎓', iconColor: '#475569' });
        } else {
            buttons.push(
                { id: 'students', label: 'For Students', count: counts.students, icon: '🧑‍🎓', iconColor: '#16a34a' },
                { id: 'parents', label: 'For Parents', count: counts.parents, icon: '👪', iconColor: '#ea580c' }
            );
        }
        return buttons;
    };

    const handleOpenCreate = (ann = null) => {
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
        setViewMode('create_edit');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...form, subject_id: form.subject_id || null };
            if (editingId) {
                await announcementService.updateAnnouncement(editingId, payload);
                toast.success("Announcement updated");
            } else {
                await announcementService.createAnnouncement(payload);
                toast.success("Announcement posted");
            }
            setViewMode('list');
            fetchAnnouncements();
        } catch (error) {
            toast.error(error.response?.data?.message || "Error");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this announcement?")) return;
        try {
            await announcementService.deleteAnnouncement(id);
            toast.success("Deleted");
            if (viewMode === 'details') setViewMode('list');
            fetchAnnouncements();
        } catch (error) {
            toast.error("Error deleting");
        }
    };

    const openDetails = (ann) => {
        setSelectedAnnouncement(ann);
        setViewMode('details');
    };

    // --- RENDERERS ---

    const renderHeader = () => (
        <div style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            borderRadius: '12px',
            margin: '16px',
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: 'white',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)'
        }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                <div style={{
                    width: '44px',
                    height: '44px',
                    background: 'white',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: '#6366f1'
                }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                    </svg>
                </div>
                <div>
                    <h2 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '700' }}>Announcements</h2>
                    <p style={{ margin: 0, fontSize: '11px', opacity: 0.9, lineHeight: '1.4', maxWidth: '180px' }}>
                        Create, manage & publish announcements for students and faculty.
                    </p>
                </div>
            </div>
            <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: '44px', lineHeight: 1, position: 'relative', right: '-10px', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))' }}>
                    📢<span style={{ position: 'absolute', bottom: '-5px', right: '-5px', fontSize: '24px' }}>✨</span>
                </div>
            </div>
        </div>
    );

    const renderTabs = () => (
        <div style={{ display: 'flex', padding: '0 1.5rem', gap: '0.75rem', marginBottom: '1rem' }}>
            <button 
                onClick={() => { setActiveTab('institute'); setFilterType('all'); }}
                style={{
                    flex: 1, padding: '0.8rem', borderRadius: '12px', border: '1px solid #e2e8f0',
                    background: activeTab === 'institute' ? '#6d28d9' : '#fff',
                    color: activeTab === 'institute' ? '#fff' : '#64748b',
                    fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    transition: 'all 0.2s'
                }}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-8.5-8.5L2 6v2h19V6l-9.5-4.5z"/></svg>
                Institute Announcements
            </button>
            <button 
                onClick={() => { setActiveTab('mine'); setFilterType('all'); }}
                style={{
                    flex: 1, padding: '0.8rem', borderRadius: '12px', border: '1px solid #e2e8f0',
                    background: activeTab === 'mine' ? '#6d28d9' : '#fff',
                    color: activeTab === 'mine' ? '#fff' : '#64748b',
                    fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    transition: 'all 0.2s'
                }}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                My Announcements
            </button>
        </div>
    );

    const renderFilters = () => (
        <div style={{ display: 'flex', flexWrap: 'wrap', padding: '0 1.5rem', gap: '0.5rem', marginBottom: '1rem' }}>
            {getFilterButtons().map(f => (
                <button
                    key={f.id}
                    onClick={() => setFilterType(f.id)}
                    style={{
                        padding: '0.5rem 1rem', borderRadius: '24px', flexShrink: 0,
                        border: filterType === f.id ? 'none' : '1px solid #e2e8f0',
                        background: filterType === f.id ? (f.bg || '#f1f5f9') : 'white',
                        color: filterType === f.id ? (f.textColor || '#0f172a') : '#64748b',
                        fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s'
                    }}
                >
                    {f.icon && <span style={{ color: f.iconColor || 'inherit', fontSize: '0.9rem' }}>{f.icon}</span>}
                    {f.label} ({f.count})
                </button>
            ))}
        </div>
    );

    const renderSearchRow = () => (
        <div style={{ display: 'flex', padding: '0 1.5rem', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input 
                    type="text" 
                    placeholder="Search announcements..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                        width: '100%', padding: '0.8rem 1rem 0.8rem 2.6rem',
                        borderRadius: '12px', border: '1px solid #e2e8f0',
                        outline: 'none', fontSize: '0.95rem', color: '#334155', background: '#fff'
                    }}
                />
            </div>
            <button style={{ 
                width: '48px', height: '48px', borderRadius: '12px', border: '1px solid #e2e8f0', 
                background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0
            }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
            </button>
        </div>
    );

    const renderCard = (ann) => {
        const isUrgent = ann.priority === 'urgent';
        const dateObj = new Date(ann.created_at || ann.createdAt);
        const dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        return (
            <div key={ann.id} onClick={() => openDetails(ann)} style={{ 
                background: 'white', borderRadius: '16px', padding: '1.25rem', marginBottom: '1rem',
                border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                display: 'flex', gap: '1rem', cursor: 'pointer', position: 'relative'
            }}>
                {/* Left Icon (Urgent vs Normal) */}
                <div style={{ 
                    width: '64px', height: '64px', borderRadius: '14px', flexShrink: 0,
                    background: isUrgent ? '#fee2e2' : '#eff6ff', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    {isUrgent ? (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="#dc2626"><path d="M12 2L1 21h22L12 2zm1 16h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
                    ) : (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="#2563eb"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                    )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ann.title}
                        </h3>
                        {isUrgent && (
                            <span style={{ 
                                display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '6px', 
                                fontSize: '0.7rem', fontWeight: '700', background: '#fee2e2', color: '#dc2626'
                            }}>
                                🚨 Urgent
                            </span>
                        )}
                    </div>
                    
                    <p style={{ margin: '0 0 1rem 0', color: '#64748b', fontSize: '0.85rem', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {ann.content}
                    </p>
                    
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#64748b', fontSize: '0.75rem', fontWeight: '500' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                {dateStr}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                {timeStr}
                            </span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem' }}>
                        <span style={{ 
                            display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', 
                            fontSize: '0.75rem', fontWeight: '700', 
                            background: ann.target_audience === 'faculty' ? '#f3e8ff' : '#dcfce7', 
                            color: ann.target_audience === 'faculty' ? '#9333ea' : '#16a34a'
                        }}>
                            {ann.target_audience === 'faculty' ? '🎓' : '🧑‍🎓'} For {ann.target_audience === 'faculty' ? 'Faculty' : 'All'}
                        </span>
                        
                    </div>
                </div>
            </div>
        );
    };

    const renderDetails = () => {
        if (!selectedAnnouncement) return null;
        const ann = selectedAnnouncement;
        const isUrgent = ann.priority === 'urgent';
        const dateObj = new Date(ann.created_at || ann.createdAt);

        return (
            <div style={{ 
                position: 'fixed', inset: 0, background: '#fafafa', zIndex: 1000, 
                display: 'flex', flexDirection: 'column', overflowY: 'auto' 
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid #f1f5f9', background: '#fff', position: 'sticky', top: 0, zIndex: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '40px', height: '40px', background: '#ede9fe', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6d28d9' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: '800', lineHeight: '1.2' }}>Announcement Details</h2>
                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem', marginTop: '0.2rem' }}>Review the information below</p>
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {activeTab === 'mine' && (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => handleOpenCreate(ann)} style={{ background: 'none', border: 'none', padding: '8px', color: '#6d28d9' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                                <button onClick={() => handleDelete(ann.id)} style={{ background: 'none', border: 'none', padding: '8px', color: '#ef4444' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
                            </div>
                        )}
                        <button onClick={() => setViewMode('list')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', color: '#0f172a', border: '1px solid #e2e8f0', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', flexShrink: 0 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                            Back to List
                        </button>
                    </div>
                </div>

                <div style={{ padding: '1.5rem', flex: 1 }}>
                    <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
                        
                        {/* Top Icon and Urgent Pill */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                            <div style={{ 
                                width: '72px', height: '72px', borderRadius: '16px', 
                                background: isUrgent ? '#fee2e2' : '#eff6ff', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                {isUrgent ? (
                                    <svg width="36" height="36" viewBox="0 0 24 24" fill="#dc2626"><path d="M12 2L1 21h22L12 2zm1 16h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
                                ) : (
                                    <svg width="36" height="36" viewBox="0 0 24 24" fill="#2563eb"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                                )}
                            </div>
                            {isUrgent && (
                                <div style={{ 
                                    background: '#fee2e2', color: '#dc2626', padding: '6px 12px', 
                                    borderRadius: '8px', fontSize: '0.85rem', fontWeight: '700',
                                    display: 'flex', alignItems: 'center', gap: '6px'
                                }}>
                                    🚨 Urgent
                                </div>
                            )}
                        </div>

                        {/* Title and Short Content */}
                        <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.5rem 0' }}>{ann.title}</h1>
                        <p style={{ fontSize: '1rem', color: '#475569', margin: '0 0 2rem 0', lineHeight: '1.5' }}>{ann.content}</p>

                        {/* Details List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                <div style={{ color: '#94a3b8', marginTop: '2px' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>Published On</div>
                                    <div style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: '700' }}>
                                        {dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, {dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                <div style={{ color: '#94a3b8', marginTop: '2px' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>Published By</div>
                                    <div style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: '700' }}>{ann.Publisher?.name || "Admin"}</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                <div style={{ color: '#94a3b8', marginTop: '2px' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg></div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '6px' }}>Category</div>
                                    <div style={{ 
                                        background: isUrgent ? '#fee2e2' : '#e0f2fe', color: isUrgent ? '#dc2626' : '#2563eb', 
                                        padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', display: 'inline-block'
                                    }}>
                                        {ann.priority.charAt(0).toUpperCase() + ann.priority.slice(1)}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                <div style={{ color: '#94a3b8', marginTop: '2px' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg></div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '6px' }}>Audience</div>
                                    <div style={{ 
                                        background: ann.target_audience === 'faculty' ? '#f3e8ff' : '#dcfce7', color: ann.target_audience === 'faculty' ? '#9333ea' : '#16a34a', 
                                        padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', display: 'inline-block'
                                    }}>
                                        For {ann.target_audience === 'faculty' ? 'Faculty' : 'All'}
                                    </div>
                                </div>
                            </div>

                            <div style={{ height: '1px', background: '#e2e8f0', margin: '0.5rem 0' }}></div>

                            {/* Full Description */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                <div style={{ color: '#94a3b8', marginTop: '2px' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="14" y1="2" x2="14" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="10" y1="2" x2="10" y2="22"></line></svg></div>
                                <div style={{ width: '100%' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '8px' }}>Description</div>
                                    <div style={{ 
                                        border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', 
                                        fontSize: '0.9rem', color: '#334155', lineHeight: '1.6', background: '#fafafa',
                                        whiteSpace: 'pre-wrap'
                                    }}>
                                        {ann.content}
                                    </div>
                                </div>
                            </div>

                            {/* Attachments */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                <div style={{ color: '#94a3b8', marginTop: '2px' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg></div>
                                <div style={{ width: '100%' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '8px' }}>Attachments (0)</div>
                                    <div style={{ 
                                        border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', 
                                        fontSize: '0.9rem', color: '#64748b', textAlign: 'center', background: '#fafafa', fontWeight: '500'
                                    }}>
                                        No attachments
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
                
                {/* As per Image 1 request, full width button at bottom */}
                <div style={{ padding: '1.5rem', background: '#fafafa' }}>
                    <button onClick={() => handleOpenCreate()} style={{ 
                        width: '100%', padding: '1.1rem', borderRadius: '14px', background: '#6d28d9', color: '#fff', 
                        fontSize: '1rem', fontWeight: '700', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                        boxShadow: '0 4px 14px rgba(109, 40, 217, 0.4)', cursor: 'pointer'
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
                        Create New Announcement
                    </button>
                </div>
            </div>
        );
    };

    const renderCreateEditForm = () => (
        <div style={{ 
            position: 'fixed', inset: 0, background: '#fff', zIndex: 1000, 
            display: 'flex', flexDirection: 'column', overflowY: 'auto' 
        }}>
            {/* Header */}
            <div style={{ 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                padding: '1.25rem 1.5rem', background: '#fff',
                position: 'sticky', top: 0, zIndex: 10
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '48px', height: '48px', background: '#f5f3ff', color: '#6d28d9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: '800', lineHeight: '1.2' }}>{editingId ? "Edit Announcement" : "Create Announcement"}</h2>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem', marginTop: '0.2rem' }}>{editingId ? "Update existing announcement" : "Publish a new announcement"}</p>
                    </div>
                </div>
                <button onClick={() => setViewMode('list')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', color: '#0f172a', border: '1px solid #e2e8f0', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    Back to List
                </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '0 1.5rem 2rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* Title */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1e293b' }}>Title <span style={{ color: '#ef4444' }}>*</span></label>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{form.title.length}/120</span>
                    </div>
                    <input
                        type="text"
                        value={form.title}
                        onChange={e => setForm({ ...form, title: e.target.value })}
                        maxLength={120}
                        placeholder="Enter announcement title..."
                        required
                        style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem', background: '#fff', color: '#334155', boxSizing: 'border-box' }}
                    />
                </div>

                {/* Content */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1e293b' }}>Content <span style={{ color: '#ef4444' }}>*</span></label>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{form.content.length}/2000</span>
                    </div>
                    <textarea
                        rows="5"
                        value={form.content}
                        onChange={e => setForm({ ...form, content: e.target.value })}
                        maxLength={2000}
                        placeholder="Write your announcement here..."
                        required
                        style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem', background: '#fff', color: '#334155', resize: 'vertical', boxSizing: 'border-box' }}
                    ></textarea>
                </div>

                {/* Audience */}
                <div>
                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '700', color: '#1e293b', marginBottom: '2px' }}>Audience <span style={{ color: '#ef4444' }}>*</span></label>
                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 0.5rem 0' }}>Select who will see this announcement</p>
                    <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', background: '#f3e8ff', borderRadius: '6px', color: '#9333ea', pointerEvents: 'none' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        </div>
                        <select
                            value={form.target_audience}
                            onChange={e => setForm({ ...form, target_audience: e.target.value })}
                            style={{ width: '100%', padding: '1rem 2.5rem 1rem 3.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', background: '#fff', fontSize: '0.95rem', color: '#0f172a', appearance: 'none', boxSizing: 'border-box' }}
                        >
                            <option value="students">Students</option>
                            <option value="faculty">Faculty</option>
                            <option value="parents">Parents</option>
                        </select>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                </div>

                {/* Priority */}
                <div>
                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '700', color: '#1e293b', marginBottom: '2px' }}>Priority <span style={{ color: '#ef4444' }}>*</span></label>
                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 0.5rem 0' }}>Set the priority level</p>
                    <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', pointerEvents: 'none' }}>
                            <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: form.priority === 'urgent' ? '#ef4444' : form.priority === 'high' ? '#f59e0b' : '#3b82f6' }}></div>
                        </div>
                        <select
                            value={form.priority}
                            onChange={e => setForm({ ...form, priority: e.target.value })}
                            style={{ width: '100%', padding: '1rem 2.5rem 1rem 3.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', background: '#fff', fontSize: '0.95rem', color: '#0f172a', appearance: 'none', boxSizing: 'border-box' }}
                        >
                            <option value="normal">Normal</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                        </select>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                </div>

                {/* Info Box */}
                <div style={{ background: '#faf5ff', border: '1px dashed #c084fc', borderRadius: '12px', padding: '12px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#7e22ce', lineHeight: '1.4', fontWeight: '500' }}>This announcement will be visible to selected audience immediately after publishing.</p>
                </div>

                {/* Attachments */}
                <div>
                    <label style={{ display: 'flex', alignItems: 'baseline', gap: '4px', fontSize: '0.9rem', fontWeight: '700', color: '#1e293b', marginBottom: '2px' }}>Attachments <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '400' }}>(Optional)</span></label>
                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 0.5rem 0' }}>Add files if required</p>
                    <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#334155' }}>Tap to upload files</span>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>PDF, DOC, DOCX, JPG, PNG (Max 10MB)</span>
                    </div>
                </div>

                {/* Buttons Bottom */}
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <button type="submit" style={{ 
                        width: '100%', padding: '1.1rem', borderRadius: '12px', 
                        background: '#6d28d9', color: '#fff', fontSize: '1rem', fontWeight: '700', border: 'none', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                        boxShadow: '0 4px 14px rgba(109, 40, 217, 0.3)', cursor: 'pointer', boxSizing: 'border-box'
                    }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                        {editingId ? "Save Changes" : "Publish Announcement"}
                    </button>
                    <button type="button" onClick={() => setViewMode('list')} style={{ 
                        width: '100%', padding: '1.1rem', borderRadius: '12px', 
                        background: '#fff', color: '#334155', fontSize: '1rem', fontWeight: '700', border: '1px solid #e2e8f0', 
                        cursor: 'pointer', boxSizing: 'border-box'
                    }}>
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );

    return (
        <div style={{ background: '#fafafa', minHeight: '100vh', fontFamily: "'Inter', sans-serif", paddingBottom: '80px' }}>
            {viewMode === 'list' && (
                <>
                    {renderHeader()}
                    {renderTabs()}
                    {renderFilters()}
                    {renderSearchRow()}
                    
                    <div style={{ padding: '0 1.5rem' }}>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Loading...</div>
                        ) : filteredAnnouncements.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No announcements found.</div>
                        ) : (
                            filteredAnnouncements.map(renderCard)
                        )}
                    </div>

                    {/* FAB */}
                    <div 
                        onClick={() => handleOpenCreate()}
                        style={{
                            position: 'fixed', bottom: '90px', right: '20px', 
                            width: '64px', height: '64px', borderRadius: '50%', background: '#6d28d9',
                            color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 8px 24px rgba(109, 40, 217, 0.4)', cursor: 'pointer', zIndex: 100
                        }}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '2px' }}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        <span style={{ fontSize: '0.65rem', fontWeight: '700' }}>New</span>
                    </div>
                </>
            )}

            {viewMode === 'details' && renderDetails()}
            {viewMode === 'create_edit' && renderCreateEditForm()}

        </div>
    );
}

export default FacultyMobileAnnouncements;
