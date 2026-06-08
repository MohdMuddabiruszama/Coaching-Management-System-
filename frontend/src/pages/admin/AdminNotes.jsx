import { useState, useEffect, useMemo } from "react";
import api from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { resolveFileUrl } from "../../utils/resolveUrl";
import { toast } from "react-hot-toast";

import './AdminNotes.css';
import './Students.css';

const BookOpenIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
);
const DownloadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
);
const UploadCloudIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"></path><polyline points="16 16 12 12 8 16"></polyline></svg>
);
const DocumentTextIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
);
const FacultyIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
);
const SchoolIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
);
const BookIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
);
const FilterIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
);
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
);
const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
);
const MoreVerticalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
);

// File Icons
const FilePdfIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M16 13H8"></path><path d="M16 17H8"></path><path d="M10 9H8"></path></svg>
);

// Helper: human-readable file size
function formatSize(bytes) {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Helper: get icon config based on mime-type
function getFileConfig(mime) {
    if (!mime) return { icon: <DocumentTextIcon />, colorClass: "default", typeName: "DOC" };
    if (mime.includes("pdf")) return { icon: <FilePdfIcon />, colorClass: "pdf", typeName: "PDF" };
    if (mime.includes("presentation") || mime.includes("ppt")) return { icon: <DocumentTextIcon />, colorClass: "ppt", typeName: "PPT" };
    if (mime.includes("image")) return { icon: <DocumentTextIcon />, colorClass: "img", typeName: "PNG" };
    if (mime.includes("word") || mime.includes("doc")) return { icon: <DocumentTextIcon />, colorClass: "doc", typeName: "DOC" };
    return { icon: <DocumentTextIcon />, colorClass: "default", typeName: "FILE" };
}

function AdminNotes() {
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [filterClass, setFilterClass] = useState("all");
    const [filterSubject, setFilterSubject] = useState("all");
    const [filterFaculty, setFilterFaculty] = useState("all");

    useEffect(() => {
        fetchNotes();
    }, []);

    const fetchNotes = async () => {
        setLoading(true);
        try {
            const res = await api.get("/notes");
            if (res.data.success) {
                setNotes(res.data.data || []);
            } else {
                toast.error("Failed to load notes");
            }
        } catch (error) {
            console.error("Error fetching notes:", error);
            toast.error("Error loading study materials");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("⚠️ Are you sure you want to permanently delete this study material? This action cannot be undone.")) return;
        setDeletingId(id);
        try {
            const res = await api.delete(`/notes/${id}`);
            if (res.data.success) {
                toast.success("Study material deleted successfully");
                setNotes(prev => prev.filter(n => n.id !== id));
            } else {
                toast.error(res.data.message || "Failed to delete");
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to delete note");
        } finally {
            setDeletingId(null);
        }
    };

    // Derived filter options from notes data
    const classes = useMemo(() => {
        const map = new Map();
        notes.forEach(n => {
            if (n.Class) map.set(n.Class.id, n.Class.name);
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [notes]);

    const subjects = useMemo(() => {
        const map = new Map();
        notes.forEach(n => {
            if (n.Subject) map.set(n.Subject.id, n.Subject.name);
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [notes]);

    const faculties = useMemo(() => {
        const map = new Map();
        notes.forEach(n => {
            const name = n.Faculty?.User?.name || n.Faculty?.User?.email || `Faculty #${n.faculty_id}`;
            const key = n.faculty_id;
            if (!map.has(key)) map.set(key, name);
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [notes]);

    // Apply filters
    const filteredNotes = useMemo(() => {
        return notes.filter(note => {
            const q = searchQuery.toLowerCase();
            const matchSearch = !q
                || note.title?.toLowerCase().includes(q)
                || note.description?.toLowerCase().includes(q)
                || (note.Faculty?.User?.name || "").toLowerCase().includes(q)
                || (note.Class?.name || "").toLowerCase().includes(q)
                || (note.Subject?.name || "").toLowerCase().includes(q);

            const matchClass = filterClass === "all" || String(note.class_id) === String(filterClass);
            const matchSubject = filterSubject === "all" || String(note.subject_id) === String(filterSubject);
            const matchFaculty = filterFaculty === "all" || String(note.faculty_id) === String(filterFaculty);

            return matchSearch && matchClass && matchSubject && matchFaculty;
        });
    }, [notes, searchQuery, filterClass, filterSubject, filterFaculty]);

    const stats = useMemo(() => ({
        total: notes.length,
        faculties: faculties.length,
        classes: classes.length,
        subjects: subjects.length,
    }), [notes, faculties, classes, subjects]);

    const handleExport = () => {
        try {
            const rows = [['#', 'Title', 'Class', 'Subject', 'Faculty', 'File Size', 'Uploaded On']];
            filteredNotes.forEach((note, idx) => {
                rows.push([
                    idx + 1,
                    note.title || '',
                    note.Class?.name || '',
                    note.Subject?.name || '',
                    note.Faculty?.User?.name || '',
                    formatSize(note.file_size),
                    new Date(note.created_at).toLocaleString()
                ]);
            });
            const csvContent = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Study_Materials.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success("Study materials exported successfully!");
        } catch (err) {
            toast.error("Failed to export materials");
        }
    };

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><LoadingSpinner /></div>;

    return (
        <div className="students-container an-wrapper">
            {/* ── Header ── */}
            <div className="st-header">
                <div className="st-header-top-row">
                    <div className="st-header-left">
                        <h1>Manage Study Materials</h1>
                        <p>Monitor and manage all study materials uploaded by faculty members across your institute.</p>
                    </div>
                </div>
                <div className="st-header-bottom-row">
                    <div className="st-breadcrumbs">
                        <span>Dashboard</span>
                        <span>›</span>
                        <span className="active">Manage Study Materials</span>
                    </div>
                    <div className="st-header-actions">
                        <button className="st-btn st-btn-outline" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <DownloadIcon /> Export CSV
                        </button>
                        <button className="st-btn st-btn-primary" onClick={() => window.location.href='/admin/notes/create'} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <UploadCloudIcon /> Upload Material
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Stats Row ── */}
            <div className="an-stats-grid">
                {[
                    { label: "Total Materials", sub: "All study materials uploaded", value: stats.total, icon: <DocumentTextIcon />, colorClass: "purple" },
                    { label: "Faculty Members", sub: "Active uploaders", value: stats.faculties, icon: <FacultyIcon />, colorClass: "green" },
                    { label: "Classes", sub: "Materials available", value: stats.classes, icon: <SchoolIcon />, colorClass: "orange" },
                    { label: "Subjects", sub: "Subjects covered", value: stats.subjects, icon: <BookIcon />, colorClass: "blue" },
                ].map(stat => (
                    <div key={stat.label} className="an-stat-card">
                        <div className={`an-icon-wrapper ${stat.colorClass}`}>{stat.icon}</div>
                        <div className="an-stat-info">
                            <span className="an-stat-value">{stat.value}</span>
                            <span className="an-stat-label">{stat.label}</span>
                            <span className="an-stat-sub">{stat.sub}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Filters ── */}
            <div className="an-filter-container">
                <div className="an-search-input">
                    <SearchIcon />
                    <input
                        type="text"
                        placeholder="Search by title, description, faculty, class, subject..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <select className="an-select-input" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
                    <option value="all">All Classes</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className="an-select-input" value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
                    <option value="all">All Subjects</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select className="an-select-input" value={filterFaculty} onChange={e => setFilterFaculty(e.target.value)}>
                    <option value="all">All Faculty</option>
                    {faculties.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                {(searchQuery || filterClass !== 'all' || filterSubject !== 'all' || filterFaculty !== 'all') && (
                    <button className="an-btn-filters" style={{ color: '#E53E3E', background: '#FFF5F5' }} onClick={() => { setSearchQuery(""); setFilterClass("all"); setFilterSubject("all"); setFilterFaculty("all"); }}>
                        ✕ Clear Filters
                    </button>
                )}
            </div>

            {/* ── Table ── */}
            <div className="an-table-card">
                <div className="an-table-header">
                    <h3 className="an-table-title">All Study Materials ({filteredNotes.length})</h3>
                    <div className="an-sort-select">
                        Sort by:
                        <select>
                            <option>Date (Newest)</option>
                            <option>Date (Oldest)</option>
                        </select>
                    </div>
                </div>
                <table className="an-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Material</th>
                            <th>Class / Subject</th>
                            <th>Uploaded By</th>
                            <th>File Info</th>
                            <th>Uploaded On</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredNotes.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#A0AEC0' }}>No materials found</td></tr>
                        ) : (
                            filteredNotes.map((note, idx) => {
                                const facultyName = note.Faculty?.User?.name || note.Faculty?.User?.email || `Faculty #${note.faculty_id}`;
                                const fileUrl = resolveFileUrl(note.file_url);
                                const initials = facultyName.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
                                const config = getFileConfig(note.file_type);

                                return (
                                <tr key={note.id}>
                                    <td style={{ fontWeight: 600, color: '#1A202C' }}>{idx + 1}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div className={`an-file-icon ${config.colorClass}`}>
                                                {config.icon}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, color: '#1A202C', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {note.title}
                                                    <span className="an-badge">{config.typeName}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 600, color: '#1A202C' }}>{note.Class?.name}</div>
                                        <div style={{ color: '#718096', fontSize: '0.85rem' }}>{note.Subject?.name}</div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div className="an-avatar">{initials}</div>
                                            <div>
                                                <div style={{ fontWeight: 600, color: '#1A202C' }}>{facultyName}</div>
                                                {note.Faculty?.User?.email && <div style={{ color: '#718096', fontSize: '0.8rem' }}>{note.Faculty.User.email}</div>}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ color: '#4A5568', fontWeight: 500 }}>
                                        {formatSize(note.file_size)}
                                    </td>
                                    <td>
                                        <div style={{ color: '#4A5568', fontWeight: 500 }}>
                                            {new Date(note.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                        </div>
                                        <div style={{ color: '#718096', fontSize: '0.8rem' }}>
                                            {new Date(note.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {fileUrl && (
                                                <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="an-action-btn" style={{ textDecoration: 'none' }}>
                                                    <EyeIcon /> View
                                                </a>
                                            )}
                                            <button className="an-action-btn" style={{ padding: '6px', border: '1px solid #E2E8F0', color: '#A0AEC0' }}>
                                                <MoreVerticalIcon />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
                <div className="an-table-footer">
                    <span>Showing 1 to {filteredNotes.length} of {filteredNotes.length} entries</span>
                    <div className="an-pagination">
                        <button className="an-page-btn">&lt;</button>
                        <button className="an-page-btn active">1</button>
                        <button className="an-page-btn">&gt;</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AdminNotes;
