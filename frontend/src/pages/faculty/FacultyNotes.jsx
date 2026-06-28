import { useState, useEffect, useMemo } from "react";
import api from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { resolveFileUrl } from "../../utils/resolveUrl";
import { toast } from "react-hot-toast";

function FacultyNotes() {
    const [notes, setNotes] = useState([]);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);       // all subjects taught by this faculty
    const [filteredSubjects, setFilteredSubjects] = useState([]); // subjects for selected class
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // Filter & Pagination States
    const [searchQuery, setSearchQuery] = useState("");
    const [filterClass, setFilterClass] = useState("");
    const [filterSubject, setFilterSubject] = useState("");
    const [sortBy, setSortBy] = useState("newest");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [activeMenuId, setActiveMenuId] = useState(null);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        class_id: "",
        subject_id: "",
        file: null
    });

    useEffect(() => {
        loadAll();
    }, []);

    const loadAll = async () => {
        try {
            setLoading(true);
            const subRes = await api.get("/subjects");
            const mySubjects = subRes.data.success ? subRes.data.data : [];
            setSubjects(mySubjects);

            const classMap = new Map();
            mySubjects.forEach(s => {
                if (s.Class) classMap.set(s.Class.id, s.Class);
            });
            setClasses(Array.from(classMap.values()));

            let allNotes = [];
            for (const sub of mySubjects) {
                try {
                    const nRes = await api.get(`/notes/subject/${sub.id}`);
                    if (nRes.data.success && nRes.data.data) {
                        allNotes = [...allNotes, ...nRes.data.data.map(n => ({
                            ...n,
                            subjectName: sub.name,
                            className: sub.Class?.name,
                            classId: sub.Class?.id
                        }))];
                    }
                } catch (_) { }
            }
            const unique = Array.from(new Map(allNotes.map(n => [n.id, n])).values());
            setNotes(unique);
        } catch (err) {
            console.error("loadAll error:", err);
            toast.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, files } = e.target;
        if (name === "file") {
            setFormData(f => ({ ...f, file: files[0] }));
        } else if (name === "class_id") {
            const subForClass = subjects.filter(s => String(s.class_id) === String(value) || String(s.Class?.id) === String(value));
            setFilteredSubjects(subForClass);
            setFormData(f => ({ ...f, class_id: value, subject_id: "" }));
        } else {
            setFormData(f => ({ ...f, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.file && !editingId) { toast.error("Please select a file"); return; }
        setUploading(true);

        const data = new FormData();
        data.append("title", formData.title);
        data.append("description", formData.description);
        data.append("class_id", formData.class_id);
        data.append("subject_id", formData.subject_id);
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
                setFormData({ title: "", description: "", class_id: "", subject_id: "", file: null });
                loadAll();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to save note");
        } finally {
            setUploading(false);
        }
    };

    const handleEditClick = (note) => {
        setEditingId(note.id);
        const subForClass = subjects.filter(s => String(s.class_id) === String(note.class_id) || String(s.Class?.id) === String(note.class_id) || String(s.Class?.id) === String(note.classId));
        setFilteredSubjects(subForClass);
        setFormData({
            title: note.title,
            description: note.description || "",
            class_id: note.classId || note.class_id || note.Class?.id || "",
            subject_id: note.subject_id || "",
            file: null
        });
        setActiveMenuId(null);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this note?")) return;
        try {
            const res = await api.delete(`/notes/${id}`);
            if (res.data.success) {
                toast.success("Note deleted");
                setNotes(n => n.filter(x => x.id !== id));
            }
        } catch {
            toast.error("Failed to delete note");
        }
    };

    // Filtering & Pagination Logic
    const filteredNotes = useMemo(() => {
        return notes.filter(n => {
            const matchClass = filterClass ? String(n.className) === filterClass : true;
            const matchSub = filterSubject ? String(n.subjectName) === filterSubject : true;
            const matchSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                (n.description || "").toLowerCase().includes(searchQuery.toLowerCase());
            return matchClass && matchSub && matchSearch;
        }).sort((a, b) => {
            if (sortBy === "newest") return new Date(b.created_at) - new Date(a.created_at);
            if (sortBy === "oldest") return new Date(a.created_at) - new Date(b.created_at);
            return 0;
        });
    }, [notes, filterClass, filterSubject, searchQuery, sortBy]);

    const totalPages = Math.ceil(filteredNotes.length / itemsPerPage) || 1;
    const paginatedNotes = filteredNotes.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Helpers
    const getFileExt = (url) => {
        if (!url) return 'PDF';
        const parts = url.split('.');
        if (parts.length <= 1) return 'FILE';
        const ext = parts.pop().toUpperCase();
        // If the extracted extension has a slash or is too long, it's not a real file extension
        if (ext.includes('/') || ext.length > 5) return 'FILE';
        return ext;
    };
    const getFileColor = (ext) => {
        if (['PDF'].includes(ext)) return '#ef4444'; // red
        if (['DOC', 'DOCX'].includes(ext)) return '#3b82f6'; // blue
        if (['PPT', 'PPTX'].includes(ext)) return '#f97316'; // orange
        if (['JPG', 'JPEG', 'PNG'].includes(ext)) return '#10b981'; // green
        return '#8b5cf6'; // purple default
    };
    const formatBytes = (bytes, decimals = 1) => {
        if (!bytes) return '0 Bytes';
        const k = 1024, dm = decimals < 0 ? 0 : decimals, sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    if (loading) return <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><LoadingSpinner /></div>;

    return (
        <div onClick={() => activeMenuId && setActiveMenuId(null)} style={{ padding: '1.5rem', fontFamily: "'Inter', sans-serif", background: '#f8fafc', minHeight: '100vh' }}>
            {/* Header section matching img1 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ width: '56px', height: '56px', background: '#f3e8ff', color: '#6d28d9', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px -1px rgba(109, 40, 217, 0.1)' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.85rem', color: '#0f172a', fontWeight: '800' }}>Class Notes</h1>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem', marginTop: '0.3rem' }}>Upload and manage study materials for your students.</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={() => window.history.back()} style={{ background: 'white', border: '1px solid #e2e8f0', color: '#475569', padding: '0.6rem 1.25rem', borderRadius: '10px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', transition: 'all 0.2s' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                        Back
                    </button>
                    <button onClick={() => { setFilteredSubjects([]); setFormData({ title: "", description: "", class_id: "", subject_id: "", file: null }); setShowModal(true); }} style={{ background: '#6d28d9', border: 'none', color: 'white', padding: '0.6rem 1.25rem', borderRadius: '10px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(109, 40, 217, 0.2)', transition: 'all 0.2s' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Upload Note
                    </button>
                </div>
            </div>

            {/* Statistics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '20px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ width: '54px', height: '54px', background: '#f3e8ff', color: '#8b5cf6', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </div>
                    <div>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Notes</p>
                        <h2 style={{ margin: '0.2rem 0', color: '#6d28d9', fontSize: '1.85rem', fontWeight: '800' }}>{notes.length}</h2>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.75rem' }}>All uploaded notes</p>
                    </div>
                </div>
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '20px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ width: '54px', height: '54px', background: '#e0f2fe', color: '#3b82f6', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                    </div>
                    <div>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Classes</p>
                        <h2 style={{ margin: '0.2rem 0', color: '#3b82f6', fontSize: '1.85rem', fontWeight: '800' }}>{classes.length}</h2>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.75rem' }}>Classes with notes</p>
                    </div>
                </div>
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '20px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ width: '54px', height: '54px', background: '#dcfce7', color: '#22c55e', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </div>
                    <div>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Subjects</p>
                        <h2 style={{ margin: '0.2rem 0', color: '#22c55e', fontSize: '1.85rem', fontWeight: '800' }}>{subjects.length}</h2>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.75rem' }}>Subjects covered</p>
                    </div>
                </div>
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '20px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ width: '54px', height: '54px', background: '#fee2e2', color: '#ef4444', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    </div>
                    <div>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Files</p>
                        <h2 style={{ margin: '0.2rem 0', color: '#ef4444', fontSize: '1.85rem', fontWeight: '800' }}>{notes.length}</h2>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.75rem' }}>Uploaded files</p>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={{ padding: '0.7rem 1.2rem', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', background: 'white', color: '#475569', fontSize: '0.9rem', cursor: 'pointer', minWidth: '160px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                        <option value="">All Classes</option>
                        {classes.map(c => <option key={c.id} value={c.name}>{c.name} {c.section ? c.section : ''}</option>)}
                    </select>
                    <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} style={{ padding: '0.7rem 1.2rem', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', background: 'white', color: '#475569', fontSize: '0.9rem', cursor: 'pointer', minWidth: '160px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                        <option value="">All Subjects</option>
                        {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                    <div style={{ position: 'relative' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '12px', top: '11px' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '0.7rem 1.2rem 0.7rem 2.5rem', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', background: 'white', color: '#475569', fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                        </select>
                    </div>
                </div>
                <div style={{ position: 'relative', flex: '1', maxWidth: '350px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '14px', top: '11px' }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input type="text" placeholder="Search notes..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '0.7rem 1rem 0.7rem 2.8rem', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem', color: '#334155', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }} />
                </div>
            </div>

            {/* Notes Table */}
            <div style={{ background: 'white', borderRadius: '20px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                {paginatedNotes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '5rem', color: '#64748b' }}>
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1.5rem' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: '#475569' }}>No notes found</p>
                        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.95rem' }}>Upload study materials to see them here.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    <th style={{ padding: '1.25rem 1.5rem', fontWeight: '700' }}>Title</th>
                                    <th style={{ padding: '1.25rem 1rem', fontWeight: '700', textAlign: 'center' }}>Class</th>
                                    <th style={{ padding: '1.25rem 1rem', fontWeight: '700', textAlign: 'center' }}>Subject</th>
                                    <th style={{ padding: '1.25rem 1rem', fontWeight: '700' }}>File</th>
                                    <th style={{ padding: '1.25rem 1rem', fontWeight: '700' }}>Uploaded On</th>
                                    <th style={{ padding: '1.25rem 1.5rem', fontWeight: '700', textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedNotes.map((note, idx) => {
                                    const ext = getFileExt(note.file_url);
                                    const extColor = getFileColor(ext);
                                    const dateObj = new Date(note.created_at);
                                    
                                    return (
                                        <tr key={note.id} style={{ borderTop: '1px solid #f1f5f9', transition: 'background 0.2s', ':hover': { background: '#f8fafc' } }}>
                                            <td style={{ padding: '1.25rem 1.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                                    <div style={{ width: '42px', height: '42px', background: `${extColor}15`, color: extColor, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                                    </div>
                                                    <div>
                                                        <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#0f172a', fontWeight: '700', lineHeight: '1.4' }}>{note.title}</h4>
                                                        {note.description && <p style={{ margin: '0.2rem 0', color: '#64748b', fontSize: '0.85rem', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{note.description}</p>}
                                                        <span style={{ display: 'inline-block', marginTop: '0.4rem', padding: '3px 8px', background: `${extColor}15`, color: extColor, fontSize: '0.7rem', fontWeight: '800', borderRadius: '6px' }}>{ext}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
                                                <span style={{ padding: '0.4rem 0.8rem', background: '#f3e8ff', color: '#7e22ce', fontSize: '0.75rem', fontWeight: '700', borderRadius: '20px' }}>
                                                    {note.className || note.Class?.name || "—"}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
                                                <span style={{ padding: '0.4rem 0.8rem', background: '#e0f2fe', color: '#0369a1', fontSize: '0.75rem', fontWeight: '700', borderRadius: '20px' }}>
                                                    {note.subjectName || note.Subject?.name || note.subject_id}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1.25rem 1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={extColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                                    <div>
                                                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#334155', fontWeight: '600', maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {note.file_url ? note.file_url.split('/').pop() : 'Unknown'}
                                                        </p>
                                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', fontWeight: '500' }}>
                                                            {formatBytes(note.file_size || 2500000)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.25rem 1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#475569' }}>
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                                    <div>
                                                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '600', color: '#334155' }}>
                                                            {dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </p>
                                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', fontWeight: '500' }}>
                                                            {dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.25rem 1.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                                    <a href={resolveFileUrl(note.file_url)} target="_blank" rel="noopener noreferrer" style={{ padding: '0.5rem 0.8rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', color: '#475569', fontSize: '0.8rem', fontWeight: '700', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                                        View
                                                    </a>
                                                    <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                                                        <button onClick={() => setActiveMenuId(activeMenuId === note.id ? null : note.id)} style={{ padding: '0.5rem', border: '1px solid transparent', background: activeMenuId === note.id ? '#f1f5f9' : 'none', color: activeMenuId === note.id ? '#0f172a' : '#94a3b8', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} title="Actions">
                                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                                                        </button>
                                                        {activeMenuId === note.id && (
                                                            <div style={{ position: 'absolute', right: '0', top: '100%', marginTop: '0.2rem', background: 'white', borderRadius: '10px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)', border: '1px solid #f1f5f9', zIndex: 10, minWidth: '130px', overflow: 'hidden', padding: '0.3rem' }}>
                                                                <button onClick={() => handleEditClick(note)} style={{ width: '100%', padding: '0.6rem 0.8rem', background: 'none', border: 'none', color: '#475569', fontSize: '0.85rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', borderRadius: '6px', textAlign: 'left', transition: 'background 0.2s' }} onMouseEnter={e => e.target.style.background = '#f8fafc'} onMouseLeave={e => e.target.style.background = 'none'}>
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                                    Edit Note
                                                                </button>
                                                                <button onClick={() => { setActiveMenuId(null); handleDelete(note.id); }} style={{ width: '100%', padding: '0.6rem 0.8rem', background: 'none', border: 'none', color: '#ef4444', fontSize: '0.85rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', borderRadius: '6px', textAlign: 'left', transition: 'background 0.2s' }} onMouseEnter={e => e.target.style.background = '#fef2f2'} onMouseLeave={e => e.target.style.background = 'none'}>
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                                                    Delete Note
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                
                {/* Pagination Footer */}
                {filteredNotes.length > 0 && (
                    <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>
                            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredNotes.length)} of {filteredNotes.length} notes
                        </p>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '0.5rem 0.6rem', border: '1px solid #cbd5e1', background: 'white', color: currentPage === 1 ? '#cbd5e1' : '#475569', borderRadius: '8px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                            </button>
                            {Array.from({ length: totalPages }).map((_, i) => (
                                <button key={i} onClick={() => setCurrentPage(i + 1)} style={{ padding: '0.5rem 0.9rem', border: '1px solid', borderColor: currentPage === i + 1 ? '#8b5cf6' : '#cbd5e1', background: currentPage === i + 1 ? '#f3e8ff' : 'white', color: currentPage === i + 1 ? '#6d28d9' : '#475569', fontWeight: '700', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                                    {i + 1}
                                </button>
                            ))}
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: '0.5rem 0.6rem', border: '1px solid #cbd5e1', background: 'white', color: currentPage === totalPages ? '#cbd5e1' : '#475569', borderRadius: '8px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Upload Modal (kept functional) */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)} style={{ background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', inset: 0, zIndex: 1000, padding: '1rem' }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '600px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflowY: 'auto', maxHeight: '90vh' }}>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <div style={{ width: '48px', height: '48px', background: '#7e22ce', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 4px 6px -1px rgba(126, 34, 206, 0.3)' }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path><path d="M12 15v-9"></path><path d="m9 9 3-3 3 3"></path></svg>
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: '800' }}>{editingId ? "Edit Study Material" : "Upload Study Material"}</h2>
                                    <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.85rem' }}>Upload notes, slides, PDFs or any study material for your students.</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => setShowModal(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.target.style.background = '#e2e8f0'} onMouseLeave={e => e.target.style.background = '#f1f5f9'}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#0f172a' }}>Title <span style={{ color: '#ef4444' }}>*</span></label>
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{formData.title.length}/120</span>
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                    </span>
                                    <input type="text" name="title" placeholder="e.g. Chapter 3 - Photosynthesis" value={formData.title} onChange={handleChange} required maxLength="120" style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.2rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.9rem', color: '#334155', transition: 'border-color 0.2s' }} onFocus={e => e.target.style.borderColor = '#8b5cf6'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#0f172a' }}>Description (Optional)</label>
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{formData.description.length}/500</span>
                                </div>
                                <textarea name="description" placeholder="Brief description of this material..." value={formData.description} onChange={handleChange} maxLength="500" rows={3} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', resize: 'vertical', fontSize: '0.9rem', color: '#334155', fontFamily: 'inherit', transition: 'border-color 0.2s' }} onFocus={e => e.target.style.borderColor = '#8b5cf6'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                                <div className="form-group">
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#0f172a', marginBottom: '0.4rem' }}>Class <span style={{ color: '#ef4444' }}>*</span></label>
                                    <div style={{ position: 'relative' }}>
                                        <span style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: '#6d28d9', display: 'flex' }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>
                                        </span>
                                        <select name="class_id" value={formData.class_id} onChange={handleChange} required style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.2rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.9rem', background: 'white', color: formData.class_id ? '#334155' : '#94a3b8', appearance: 'none', cursor: 'pointer', transition: 'border-color 0.2s' }} onFocus={e => e.target.style.borderColor = '#8b5cf6'} onBlur={e => e.target.style.borderColor = '#e2e8f0'}>
                                            <option value="" disabled hidden>Select Class</option>
                                            {classes.map(c => <option key={c.id} value={c.id} style={{ color: '#334155' }}>{c.name} {c.section ? c.section : ''}</option>)}
                                        </select>
                                        <span style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                        </span>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#0f172a', marginBottom: '0.4rem' }}>Subject <span style={{ color: '#ef4444' }}>*</span></label>
                                    <div style={{ position: 'relative' }}>
                                        <span style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: '#0369a1', display: 'flex' }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>
                                        </span>
                                        <select name="subject_id" value={formData.subject_id} onChange={handleChange} required disabled={!formData.class_id} style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.2rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.9rem', background: !formData.class_id ? '#f8fafc' : 'white', color: formData.subject_id ? '#334155' : '#94a3b8', appearance: 'none', cursor: !formData.class_id ? 'not-allowed' : 'pointer', transition: 'border-color 0.2s' }} onFocus={e => e.target.style.borderColor = '#8b5cf6'} onBlur={e => e.target.style.borderColor = '#e2e8f0'}>
                                            <option value="" disabled hidden>Select Subject</option>
                                            {filteredSubjects.map(s => <option key={s.id} value={s.id} style={{ color: '#334155' }}>{s.name}</option>)}
                                        </select>
                                        <span style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#0f172a', marginBottom: '0.4rem' }}>{editingId ? "File (Leave empty to keep existing)" : "File (PDF, DOCX, PPT, Image)"} <span style={{ color: '#ef4444' }}>*</span></label>
                                <div style={{ position: 'relative', border: '2px dashed #c4b5fd', borderRadius: '12px', background: '#faf5ff', padding: '2rem 1.5rem', textAlign: 'center', transition: 'all 0.2s', cursor: 'pointer' }} onMouseEnter={e => {e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.background = '#f3e8ff'}} onMouseLeave={e => {e.currentTarget.style.borderColor = '#c4b5fd'; e.currentTarget.style.background = '#faf5ff'}}>
                                    <input type="file" name="file" onChange={handleChange} accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.zip" required={!editingId} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                                    
                                    {!formData.file ? (
                                        <div style={{ pointerEvents: 'none' }}>
                                            <div style={{ display: 'inline-flex', background: '#8b5cf6', color: 'white', borderRadius: '50%', padding: '0.6rem', marginBottom: '0.8rem', boxShadow: '0 4px 6px -1px rgba(139, 92, 246, 0.3)' }}>
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                            </div>
                                            <p style={{ margin: '0 0 0.4rem', fontSize: '0.95rem', color: '#334155', fontWeight: '600' }}>Drag & drop your file here, or <span style={{ color: '#6d28d9' }}>click to browse</span></p>
                                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Max file size: 50 MB | Supported: PDF, DOCX, PPT, JPG, PNG</p>
                                        </div>
                                    ) : (
                                        <div style={{ pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                                            <div style={{ display: 'inline-flex', background: '#10b981', color: 'white', borderRadius: '50%', padding: '0.6rem', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.3)' }}>
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                            </div>
                                            <div style={{ textAlign: 'left' }}>
                                                <p style={{ margin: '0 0 0.2rem', fontSize: '0.95rem', color: '#0f172a', fontWeight: '600' }}>{formData.file.name}</p>
                                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{(formData.file.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ background: '#f3e8ff', border: '1px solid #e9d5ff', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', color: '#6b21a8' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '500' }}>Uploaded materials will be available to selected class and subject.</p>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                                <button type="button" onClick={() => setShowModal(false)} disabled={uploading} style={{ flex: 1, padding: '0.8rem 1.4rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.9rem' }} onMouseEnter={e => e.target.style.background = '#f8fafc'} onMouseLeave={e => e.target.style.background = 'white'}>Cancel</button>
                                <button type="submit" disabled={uploading} style={{ flex: 1, padding: '0.8rem 1.4rem', borderRadius: '8px', border: 'none', background: '#7e22ce', color: 'white', fontWeight: '600', cursor: uploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s', fontSize: '0.9rem', boxShadow: '0 4px 6px -1px rgba(126, 34, 206, 0.2)' }} onMouseEnter={e => e.target.style.background = '#6b21a8'} onMouseLeave={e => e.target.style.background = '#7e22ce'}>
                                    {!uploading && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>}
                                    {uploading ? "Saving..." : (editingId ? "Save Changes" : "Upload Material")}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default FacultyNotes;
