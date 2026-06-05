import { useContext, useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import announcementService from "../../services/announcement.service";
import "./StudentAnnouncementsV2.css";

const getCategoryInfo = (ann) => {
    if (ann.priority === 'urgent' || ann.priority === 'high' || ann.is_pinned) {
        return { label: 'High Priority', class: 'high', icon: '📢' };
    }
    const text = ((ann.title || '') + ' ' + (ann.content || '')).toLowerCase();
    if (text.includes('fest') || text.includes('event') || text.includes('workshop') || text.includes('seminar') || text.includes('competition') || text.includes('holiday')) {
        return { label: 'Event', class: 'event', icon: '📅' };
    }
    if (text.includes('academic') || text.includes('semester') || text.includes('exam') || text.includes('assessment') || text.includes('class') || text.includes('schedule') || text.includes('timetable') || text.includes('registration')) {
        return { label: 'Academic', class: 'academic', icon: '🎓' };
    }
    return { label: 'General', class: 'general', icon: '📄' };
};

const formatDateTime = (dateStr) => {
    const d = new Date(dateStr);
    const datePart = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `${datePart}, ${timePart}`;
};

const getAuthorName = (ann) => {
    if (ann.creator?.role === 'admin' || ann.creator?.role === 'manager') {
        return "Administration";
    }
    return ann.creator?.name || ann.posted_by || "Administration";
};

function ViewAnnouncements() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // UI State
    const [activeTab, setActiveTab] = useState('All Announcements');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState('Latest First');
    
    // Modal State
    const [selectedAnn, setSelectedAnn] = useState(null);

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

    // Stats
    const unreadCount = announcements.filter(a => !a.is_read).length;
    const addedThisWeek = announcements.filter(n => (new Date() - new Date(n.created_at || n.createdAt)) < 7 * 24 * 60 * 60 * 1000).length;
    const importantCount = announcements.filter(a => a.priority === 'urgent' || a.priority === 'high' || a.is_pinned).length;

    // Filter and Sort Logic
    const filteredAndSorted = useMemo(() => {
        let result = announcements;

        if (activeTab === 'Unread') {
            result = result.filter(a => !a.is_read);
        } else if (activeTab === 'Important') {
            result = result.filter(a => getCategoryInfo(a).class === 'high');
        } else if (activeTab === 'General') {
            result = result.filter(a => getCategoryInfo(a).class === 'general');
        } else if (activeTab === 'Events') {
            result = result.filter(a => getCategoryInfo(a).class === 'event');
        } else if (activeTab === 'Academics') {
            result = result.filter(a => getCategoryInfo(a).class === 'academic');
        }

        if (searchQuery.trim()) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(a => 
                (a.title || '').toLowerCase().includes(lowerQuery) || 
                (a.content || '').toLowerCase().includes(lowerQuery)
            );
        }

        result.sort((a, b) => {
            const timeA = new Date(a.created_at || a.createdAt).getTime();
            const timeB = new Date(b.created_at || b.createdAt).getTime();
            return sortOrder === 'Latest First' ? timeB - timeA : timeA - timeB;
        });

        return result;
    }, [announcements, activeTab, searchQuery, sortOrder]);

    if (loading) return <div className="ann-v2-container" style={{ padding: 40, textAlign: 'center' }}>Loading...</div>;

    return (
        <div className="ann-v2-container">
            
            {/* Header */}
            <div className="ann-v2-header-wrapper">
                <div className="ann-v2-header-left">
                    <div className="ann-v2-header-icon">📢</div>
                    <div>
                        <h1 className="ann-v2-header-title">Institute Announcements</h1>
                        <p className="ann-v2-header-sub">Important updates and notifications from the institute and faculty.</p>
                    </div>
                </div>
                <button className="ann-v2-btn-outline" onClick={() => navigate(`/${user?.role}/dashboard`)}>
                    ← Back to Dashboard
                </button>
            </div>

            {/* Stats Row */}
            <div className="ann-v2-stats-grid">
                <div className="ann-v2-stat-card">
                    <div className="ann-v2-stat-icon-wrapper ann-v2-stat-icon-purple">
                        🔔
                    </div>
                    <div className="ann-v2-stat-content">
                        <span className="ann-v2-stat-value">{unreadCount}</span>
                        <span className="ann-v2-stat-label">Unread</span>
                        <span className="ann-v2-stat-sub">New announcements</span>
                    </div>
                </div>
                <div className="ann-v2-stat-card">
                    <div className="ann-v2-stat-icon-wrapper ann-v2-stat-icon-blue">
                        📢
                    </div>
                    <div className="ann-v2-stat-content">
                        <span className="ann-v2-stat-value">{announcements.length}</span>
                        <span className="ann-v2-stat-label">Total</span>
                        <span className="ann-v2-stat-sub">All announcements</span>
                    </div>
                </div>
                <div className="ann-v2-stat-card">
                    <div className="ann-v2-stat-icon-wrapper ann-v2-stat-icon-green">
                        📅
                    </div>
                    <div className="ann-v2-stat-content">
                        <span className="ann-v2-stat-value">{addedThisWeek}</span>
                        <span className="ann-v2-stat-label">This Week</span>
                        <span className="ann-v2-stat-sub">Recent updates</span>
                    </div>
                </div>
                <div className="ann-v2-stat-card">
                    <div className="ann-v2-stat-icon-wrapper ann-v2-stat-icon-orange">
                        🔖
                    </div>
                    <div className="ann-v2-stat-content">
                        <span className="ann-v2-stat-value">{importantCount}</span>
                        <span className="ann-v2-stat-label">Important</span>
                        <span className="ann-v2-stat-sub">High priority</span>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="ann-v2-main-card">
                
                {/* Filter & Search Row */}
                <div className="ann-v2-filter-row">
                    <div className="ann-v2-pills">
                        {['All Announcements', 'Unread', 'Important', 'General', 'Events', 'Academics'].map(pill => (
                            <button 
                                key={pill}
                                className={`ann-v2-pill ${activeTab === pill ? 'active' : ''}`}
                                onClick={() => setActiveTab(pill)}
                            >
                                {pill === 'Unread' ? `Unread (${unreadCount})` : pill}
                            </button>
                        ))}
                    </div>
                    <div className="ann-v2-search-sort">
                        <div className="ann-v2-search-input-wrapper">
                            <span className="ann-v2-search-icon">🔍</span>
                            <input 
                                type="text" 
                                className="ann-v2-search-input" 
                                placeholder="Search announcements..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <select 
                            className="ann-v2-select" 
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
                        >
                            <option>Latest First</option>
                            <option>Oldest First</option>
                        </select>
                    </div>
                </div>

                {/* Announcement List */}
                <div className="ann-v2-list">
                    {filteredAndSorted.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📭</div>
                            <h3 style={{ color: '#1e293b', marginBottom: '8px' }}>No Announcements Found</h3>
                            <p>Try adjusting your filters or search query.</p>
                        </div>
                    ) : (
                        filteredAndSorted.map(ann => {
                            const cat = getCategoryInfo(ann);
                            return (
                                <div 
                                    key={ann.id} 
                                    className={`ann-v2-card category-${cat.class}`}
                                    onClick={() => !ann.is_read && handleMarkRead(ann.id)}
                                >
                                    {!ann.is_read && <div className="ann-v2-unread-dot"></div>}
                                    
                                    <div className="ann-v2-card-icon-wrapper">
                                        {cat.icon}
                                    </div>
                                    
                                    <div className="ann-v2-card-content">
                                        <div className="ann-v2-card-pill">{cat.label}</div>
                                        <h3 className="ann-v2-card-title">{ann.title}</h3>
                                        <p className="ann-v2-card-desc" title={ann.content}>{ann.content}</p>
                                        
                                        <div className="ann-v2-card-meta">
                                            <div className="ann-v2-meta-item">
                                                <span>📅</span>
                                                <span>{formatDateTime(ann.created_at || ann.createdAt)}</span>
                                            </div>
                                            <div className="ann-v2-meta-item">
                                                <span>🏛️</span>
                                                <span>{getAuthorName(ann)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="ann-v2-card-actions">
                                        <button 
                                            className="ann-v2-view-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedAnn(ann);
                                                if (!ann.is_read) handleMarkRead(ann.id);
                                            }}
                                        >
                                            View Details
                                        </button>
                                        <button className="ann-v2-more-btn">⋮</button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

            </div>
            
            {/* Details Modal */}
            {selectedAnn && (
                <div className="ann-v2-modal-overlay" onClick={() => setSelectedAnn(null)}>
                    <div className="ann-v2-modal-content" onClick={e => e.stopPropagation()}>
                        <button className="ann-v2-modal-close" onClick={() => setSelectedAnn(null)}>×</button>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                            <div className={`ann-v2-card-icon-wrapper`} style={{ width: 48, height: 48, fontSize: 20, margin: 0, ...getModalIconStyle(getCategoryInfo(selectedAnn).class) }}>
                                {getCategoryInfo(selectedAnn).icon}
                            </div>
                            <div>
                                <div className={`ann-v2-card-pill`} style={{ marginBottom: 4, ...getModalPillStyle(getCategoryInfo(selectedAnn).class) }}>
                                    {getCategoryInfo(selectedAnn).label}
                                </div>
                            </div>
                        </div>
                        
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>
                            {selectedAnn.title}
                        </h2>
                        
                        <div className="ann-v2-card-meta" style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #f1f5f9' }}>
                            <div className="ann-v2-meta-item">
                                <span>📅</span>
                                <span>{formatDateTime(selectedAnn.created_at || selectedAnn.createdAt)}</span>
                            </div>
                            <div className="ann-v2-meta-item">
                                <span>🏛️</span>
                                <span>{getAuthorName(selectedAnn)}</span>
                            </div>
                        </div>
                        
                        <div style={{ fontSize: '1rem', lineHeight: 1.6, color: '#334155', whiteSpace: 'pre-wrap' }}>
                            {selectedAnn.content}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper functions for modal dynamic styles
const getModalIconStyle = (catClass) => {
    switch(catClass) {
        case 'high': return { background: '#fef2f2', color: '#ef4444' };
        case 'general': return { background: '#eff6ff', color: '#3b82f6' };
        case 'event': return { background: '#f0fdf4', color: '#10b981' };
        case 'academic': return { background: '#fffbeb', color: '#f59e0b' };
        default: return {};
    }
};

const getModalPillStyle = (catClass) => {
    switch(catClass) {
        case 'high': return { background: '#fef2f2', color: '#ef4444' };
        case 'general': return { background: '#eff6ff', color: '#3b82f6' };
        case 'event': return { background: '#f0fdf4', color: '#10b981' };
        case 'academic': return { background: '#fffbeb', color: '#f59e0b' };
        default: return {};
    }
};

export default ViewAnnouncements;
