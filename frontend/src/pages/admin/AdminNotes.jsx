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
    const [allClasses, setAllClasses] = useState([]);
    const [allSubjects, setAllSubjects] = useState([]);
    const [allFaculties, setAllFaculties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    // Modal States
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [activeMenuId, setActiveMenuId] = useState(null);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        class_id: "",
        subject_id: "",
        faculty_id: "",
        file: null
    });


    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [filterClass, setFilterClass] = useState("all");
    const [filterSubject, setFilterSubject] = useState("all");
    const [filterFaculty, setFilterFaculty] = useState("all");


    const fetchAll = async () => {
        setLoading(true);
        try {
            const [notesRes, clsRes, subRes, facRes] = await Promise.all([
                api.get("/notes"),
                api.get("/classes"),
                api.get("/subjects"),
                api.get("/faculty")
            ]);
            
            if (notesRes.data.success) setNotes(notesRes.data.data || []);
            if (clsRes.data.success) setAllClasses(clsRes.data.data || []);
            if (subRes.data.success) setAllSubjects(subRes.data.data || []);
            if (facRes.data.success) setAllFaculties(facRes.data.data || []);
            
        } catch (error) {
            console.error("Error fetching data:", error);
            toast.error("Error loading study materials data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
    }, []);

    const handleChange = (e) => {
        const { name, value, files } = e.target;
        if (name === "file") {
            setFormData(f => ({ ...f, file: files[0] }));
        } else {
            setFormData(f => ({ ...f, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.file && !editingId) { toast.error("Please select a file"); return; }
        if (!formData.faculty_id) { toast.error("Please select a faculty member"); return; }
        
        setUploading(true);
        const data = new FormData();
        data.append("title", formData.title);
        data.append("description", formData.description);
        data.append("class_id", formData.class_id);
        data.append("subject_id", formData.subject_id);
        data.append("faculty_id", formData.faculty_id);
        if (formData.file) data.append("file", formData.file);

        try {
            let res;
            if (editingId) {
                res = await api.put(`/notes/${editingId}`, data, { headers: { "Content-Type": "multipart/form-data" } });
            } else {
                res = await api.post("/notes/upload", data, { headers: { "Content-Type": "multipart/form-data" } });
            }
            if (res.data.success) {
                toast.success(editingId ? "Note updated successfully!" : "Note uploaded successfully!");
                setShowModal(false);
                setEditingId(null);
                setFormData({ title: "", description: "", class_id: "", subject_id: "", faculty_id: "", file: null });
                fetchAll();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to save note");
        } finally {
            setUploading(false);
        }
    };

    const handleEditClick = (note) => {
        setEditingId(note.id);
        setFormData({
            title: note.title,
            description: note.description || "",
            class_id: note.class_id || note.Class?.id || "",
            subject_id: note.subject_id || "",
            faculty_id: note.faculty_id || "",
            file: null
        });
        setActiveMenuId(null);
        setShowModal(true);
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
                        <button className="st-btn st-btn-primary" onClick={() => { setEditingId(null); setFormData({ title: "", description: "", class_id: "", subject_id: "", faculty_id: "", file: null }); setShowModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section ? c.section : ''}</option>)}
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
                                            <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                                                <button onClick={() => setActiveMenuId(activeMenuId === note.id ? null : note.id)} className="an-action-btn" style={{ padding: '6px', border: '1px solid #E2E8F0', color: activeMenuId === note.id ? '#0f172a' : '#A0AEC0' }}>
                                                    <MoreVerticalIcon />
                                                </button>
                                                {activeMenuId === note.id && (
                                                    <div style={{ position: 'absolute', right: '0', top: '100%', marginTop: '0.2rem', background: 'white', borderRadius: '10px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)', border: '1px solid #f1f5f9', zIndex: 10, minWidth: '130px', overflow: 'hidden', padding: '0.3rem' }}>
                                                        <button onClick={() => handleEditClick(note)} style={{ width: '100%', padding: '0.6rem 0.8rem', background: 'none', border: 'none', color: '#475569', fontSize: '0.85rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', borderRadius: '6px', textAlign: 'left', transition: 'background 0.2s' }} onMouseEnter={e => e.target.style.background = '#f8fafc'} onMouseLeave={e => e.target.style.background = 'none'}>
                                                            Edit Note
                                                        </button>
                                                        <button onClick={() => { setActiveMenuId(null); handleDelete(note.id); }} style={{ width: '100%', padding: '0.6rem 0.8rem', background: 'none', border: 'none', color: '#ef4444', fontSize: '0.85rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', borderRadius: '6px', textAlign: 'left', transition: 'background 0.2s' }} onMouseEnter={e => e.target.style.background = '#fef2f2'} onMouseLeave={e => e.target.style.background = 'none'}>
                                                            Delete Note
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
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

            {/* Upload Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)} style={{ background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', inset: 0, zIndex: 1000, padding: '1rem' }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '600px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflowY: 'auto', maxHeight: '90vh' }}>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <div style={{ width: '48px', height: '48px', background: '#3b82f6', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.3)' }}>
                                    <UploadCloudIcon />
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: '800' }}>{editingId ? "Edit Study Material" : "Upload Study Material"}</h2>
                                    <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.85rem' }}>Upload notes, slides, PDFs or any study material.</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => setShowModal(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer', transition: 'background 0.2s' }}>
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#0f172a', display: 'block', marginBottom: '0.4rem' }}>Title <span style={{ color: '#ef4444' }}>*</span></label>
                                <input type="text" name="title" placeholder="e.g. Chapter 3 - Photosynthesis" value={formData.title} onChange={handleChange} required maxLength="120" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.9rem', color: '#334155', boxSizing: 'border-box' }} />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#0f172a', display: 'block', marginBottom: '0.4rem' }}>Description (Optional)</label>
                                <textarea name="description" placeholder="Brief description of this material..." value={formData.description} onChange={handleChange} maxLength="500" rows={3} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', resize: 'vertical', fontSize: '0.9rem', color: '#334155', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#0f172a', marginBottom: '0.4rem' }}>Faculty Owner <span style={{ color: '#ef4444' }}>*</span></label>
                                <select name="faculty_id" value={formData.faculty_id} onChange={handleChange} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.9rem', background: 'white', color: formData.faculty_id ? '#334155' : '#94a3b8', boxSizing: 'border-box' }}>
                                    <option value="" disabled hidden>Select Faculty</option>
                                    {allFaculties.map(f => (
                                        <option key={f.id} value={f.id} style={{ color: '#334155' }}>
                                            {f.User?.name || f.User?.email}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                                <div className="form-group">
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#0f172a', marginBottom: '0.4rem' }}>Class <span style={{ color: '#ef4444' }}>*</span></label>
                                    <select name="class_id" value={formData.class_id} onChange={handleChange} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.9rem', background: 'white', color: formData.class_id ? '#334155' : '#94a3b8', boxSizing: 'border-box' }}>
                                        <option value="" disabled hidden>Select Class</option>
                                        {allClasses.map(c => (
                                            <option key={c.id} value={c.id} style={{ color: '#334155' }}>
                                                {c.name} {c.section ? c.section : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#0f172a', marginBottom: '0.4rem' }}>Subject <span style={{ color: '#ef4444' }}>*</span></label>
                                    <select name="subject_id" value={formData.subject_id} onChange={handleChange} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.9rem', background: 'white', color: formData.subject_id ? '#334155' : '#94a3b8', boxSizing: 'border-box' }}>
                                        <option value="" disabled hidden>Select Subject</option>
                                        {allSubjects
                                            .filter(s => formData.class_id ? (String(s.class_id) === String(formData.class_id) || String(s.Class?.id) === String(formData.class_id)) : true)
                                            .map(s => (
                                                <option key={s.id} value={s.id} style={{ color: '#334155' }}>{s.name}</option>
                                            ))
                                        }
                                    </select>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#0f172a', marginBottom: '0.4rem' }}>{editingId ? "File (Leave empty to keep existing)" : "File (PDF, DOCX, PPT, Image)"} <span style={{ color: '#ef4444' }}>*</span></label>
                                <div style={{ position: 'relative', border: '2px dashed #bfdbfe', borderRadius: '12px', background: '#eff6ff', padding: '2rem 1.5rem', textAlign: 'center', cursor: 'pointer' }}>
                                    <input type="file" name="file" onChange={handleChange} accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.zip" required={!editingId} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                                    
                                    {!formData.file ? (
                                        <>
                                            <div style={{ width: '40px', height: '40px', background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.5rem', color: '#3b82f6', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                                <UploadCloudIcon />
                                            </div>
                                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', fontWeight: '600' }}>Drag & drop your file here, or <span style={{ color: 'transparent' }}>click to browse</span></p>
                                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>Max file size: 50 MB | Supported: PDF, DOCX, PPT, JPG, PNG</p>
                                        </>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#0369a1' }}>
                                            <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{formData.file.name}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" onClick={() => setShowModal(false)} disabled={uploading} style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: '0.95rem', fontWeight: '600', cursor: uploading ? 'not-allowed' : 'pointer' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={uploading} style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: 'none', background: uploading ? '#93c5fd' : '#3b82f6', color: 'white', fontSize: '0.95rem', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: uploading ? 'not-allowed' : 'pointer' }}>
                                    {uploading ? (
                                        <>
                                            <div style={{ width: '16px', height: '16px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                            {editingId ? "Updating..." : "Uploading..."}
                                        </>
                                    ) : (
                                        <>
                                            <UploadCloudIcon />
                                            {editingId ? "Update Material" : "Upload Material"}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminNotes;
