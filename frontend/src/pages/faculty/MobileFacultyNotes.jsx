import { useState, useEffect, useMemo } from "react";
import api from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { resolveFileUrl } from "../../utils/resolveUrl";
import { toast } from "react-hot-toast";

function MobileFacultyNotes() {
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

    // View States: 'list', 'details', 'upload'
    const [viewMode, setViewMode] = useState("list");
    const [selectedNote, setSelectedNote] = useState(null);
    const [editingId, setEditingId] = useState(null);
    
    // Action Menu State
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
                setViewMode("list");
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
        setViewMode("upload");
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this note?")) return;
        try {
            const res = await api.delete(`/notes/${id}`);
            if (res.data.success) {
                toast.success("Note deleted");
                setNotes(n => n.filter(x => x.id !== id));
                if (viewMode === 'details' && selectedNote?.id === id) {
                    setViewMode('list');
                }
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

    const isImage = (ext) => ['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP'].includes(ext);

    // ----------------------------------------------------
    // RENDER: LIST VIEW
    // ----------------------------------------------------
    if (viewMode === "list") {
        if (loading) return <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><LoadingSpinner /></div>;

        return (
            <div onClick={() => activeMenuId && setActiveMenuId(null)} style={{ padding: '1.5rem', fontFamily: "'Inter', sans-serif", background: '#ffffff', minHeight: '100vh', paddingBottom: '100px' }}>
                {/* Hero Banner matching Mark Attendance */}
                <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', borderRadius: '12px', marginBottom: '1.5rem', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                        <div style={{ width: '44px', height: '44px', background: 'white', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#6366f1' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                        </div>
                        <div>
                            <h2 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '700' }}>Class Notes</h2>
                            <p style={{ margin: 0, fontSize: '11px', opacity: 0.9, lineHeight: 1.4, maxWidth: '180px' }}>Upload and manage study materials for your students.</p>
                        </div>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                        <div style={{ fontSize: '44px', lineHeight: 1, position: 'relative', right: '-10px', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))' }}>
                            📚<span style={{ position: 'absolute', bottom: '-5px', right: '-5px', fontSize: '24px' }}>✨</span>
                        </div>
                    </div>
                </div>

                {/* Statistics Cards (2x2 Grid) */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                    {/* Total Notes */}
                    <div style={{ width: 'calc(50% - 0.5rem)', boxSizing: 'border-box', background: '#fff', padding: '1.25rem', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ width: '40px', height: '40px', background: '#f3e8ff', color: '#8b5cf6', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        </div>
                        <p style={{ margin: 0, color: '#475569', fontSize: '0.75rem', fontWeight: '700' }}>Total Notes</p>
                        <h2 style={{ margin: 0, color: '#8b5cf6', fontSize: '1.5rem', fontWeight: '800' }}>{notes.length}</h2>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.7rem' }}>All uploaded notes</p>
                    </div>
                    {/* Total Classes */}
                    <div style={{ width: 'calc(50% - 0.5rem)', boxSizing: 'border-box', background: '#fff', padding: '1.25rem', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ width: '40px', height: '40px', background: '#e0f2fe', color: '#3b82f6', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                        </div>
                        <p style={{ margin: 0, color: '#475569', fontSize: '0.75rem', fontWeight: '700' }}>Total Classes</p>
                        <h2 style={{ margin: 0, color: '#3b82f6', fontSize: '1.5rem', fontWeight: '800' }}>{classes.length}</h2>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.7rem' }}>Classes with notes</p>
                    </div>
                    {/* Total Subjects */}
                    <div style={{ width: 'calc(50% - 0.5rem)', boxSizing: 'border-box', background: '#fff', padding: '1.25rem', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ width: '40px', height: '40px', background: '#dcfce7', color: '#22c55e', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        </div>
                        <p style={{ margin: 0, color: '#475569', fontSize: '0.75rem', fontWeight: '700' }}>Total Subjects</p>
                        <h2 style={{ margin: 0, color: '#22c55e', fontSize: '1.5rem', fontWeight: '800' }}>{subjects.length}</h2>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.7rem' }}>Subjects covered</p>
                    </div>
                    {/* Total Files */}
                    <div style={{ width: 'calc(50% - 0.5rem)', boxSizing: 'border-box', background: '#fff', padding: '1.25rem', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ width: '40px', height: '40px', background: '#fee2e2', color: '#ef4444', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        </div>
                        <p style={{ margin: 0, color: '#475569', fontSize: '0.75rem', fontWeight: '700' }}>Total Files</p>
                        <h2 style={{ margin: 0, color: '#ef4444', fontSize: '1.5rem', fontWeight: '800' }}>{notes.length}</h2>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.7rem' }}>Uploaded files</p>
                    </div>
                </div>

                {/* Filter Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <div style={{ position: 'relative' }}>
                        <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={{ width: '100%', padding: '0.9rem 1.2rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', background: '#fff', color: '#0f172a', fontSize: '0.95rem', fontWeight: '600', appearance: 'none' }}>
                            <option value="">All Classes</option>
                            {classes.map(c => <option key={c.id} value={c.name}>{c.name} {c.section ? c.section : ''}</option>)}
                        </select>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '1.2rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                    
                    <div style={{ position: 'relative' }}>
                        <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} style={{ width: '100%', padding: '0.9rem 1.2rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', background: '#fff', color: '#0f172a', fontSize: '0.95rem', fontWeight: '600', appearance: 'none' }}>
                            <option value="">All Subjects</option>
                            {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '1.2rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>

                    <div style={{ position: 'relative' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: '100%', padding: '0.9rem 1.2rem 0.9rem 2.8rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', background: '#fff', color: '#0f172a', fontSize: '0.95rem', fontWeight: '600', appearance: 'none' }}>
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                        </select>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '1.2rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <input type="text" placeholder="Search notes..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '0.9rem 1rem 0.9rem 2.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem', color: '#334155', boxSizing: 'border-box' }} />
                        </div>
                        <button style={{ width: '50px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                        </button>
                    </div>
                </div>

                {/* Notes List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {paginatedNotes.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
                            <p style={{ margin: 0, fontWeight: '600' }}>No notes found.</p>
                        </div>
                    ) : (
                        paginatedNotes.map(note => {
                            const ext = getFileExt(note.file_url);
                            const extColor = getFileColor(ext);
                            const dateObj = new Date(note.created_at);

                            return (
                                <div key={note.id} onClick={() => { setSelectedNote(note); setViewMode("details"); }} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', padding: '1.25rem', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', position: 'relative', cursor: 'pointer' }}>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                        {/* Icon Box */}
                                        <div style={{ width: '48px', height: '48px', background: `${extColor}15`, color: extColor, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                        </div>
                                        
                                        {/* Content Area */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.05rem', color: '#0f172a', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note.title}</h3>
                                            {note.description && (
                                                <p style={{ margin: '0 0 0.5rem 0', color: '#64748b', fontSize: '0.85rem', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{note.description}</p>
                                            )}
                                            
                                            {/* Pills */}
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                                                <span style={{ padding: '4px 10px', background: '#f3e8ff', color: '#7e22ce', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700' }}>{note.className || note.Class?.name || 'Unknown'}</span>
                                                <span style={{ padding: '4px 10px', background: '#e0f2fe', color: '#0369a1', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700' }}>{note.subjectName || note.Subject?.name || 'Unknown'}</span>
                                            </div>
                                            <div style={{ marginBottom: '1rem' }}>
                                                <span style={{ padding: '4px 10px', background: `${extColor}15`, color: extColor, borderRadius: '6px', fontSize: '0.7rem', fontWeight: '800' }}>{ext}</span>
                                            </div>
                                            
                                            {/* Bottom Details Row */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                                                <div style={{ display: 'flex', gap: '1rem', color: '#64748b' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={extColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#334155', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.file_url ? note.file_url.split('/').pop() : 'Unknown'}</span>
                                                            <span style={{ fontSize: '0.65rem' }}>{formatBytes(note.file_size || 2500000)}</span>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#334155' }}>{dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                            <span style={{ fontSize: '0.65rem' }}>{dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                                                    <button onClick={() => setActiveMenuId(activeMenuId === note.id ? null : note.id)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                                                    </button>
                                                    {activeMenuId === note.id && (
                                                        <div style={{ position: 'absolute', right: '0', bottom: '100%', marginBottom: '0.5rem', background: 'white', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', border: '1px solid #f1f5f9', zIndex: 20, minWidth: '140px', padding: '0.4rem' }}>
                                                            <button onClick={() => { setActiveMenuId(null); handleEditClick(note); }} style={{ width: '100%', padding: '0.75rem 1rem', background: 'none', border: 'none', color: '#334155', fontSize: '0.9rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', borderRadius: '8px', textAlign: 'left' }}>
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                                Edit
                                                            </button>
                                                            <button onClick={() => { setActiveMenuId(null); handleDelete(note.id); }} style={{ width: '100%', padding: '0.75rem 1rem', background: 'none', border: 'none', color: '#ef4444', fontSize: '0.9rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', borderRadius: '8px', textAlign: 'left' }}>
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                                                Delete
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Pagination (if notes exist) */}
                {filteredNotes.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>
                            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredNotes.length)} of {filteredNotes.length} notes
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: currentPage === 1 ? '#cbd5e1' : '#64748b', cursor: currentPage === 1 ? 'default' : 'pointer', fontSize: '1rem', fontWeight: '600' }}>
                                &lt;
                            </button>
                            <button style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid #c084fc', background: '#faf5ff', color: '#9333ea', fontWeight: '700', fontSize: '0.9rem' }}>
                                {currentPage}
                            </button>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: currentPage === totalPages ? '#cbd5e1' : '#64748b', cursor: currentPage === totalPages ? 'default' : 'pointer', fontSize: '1rem', fontWeight: '600' }}>
                                &gt;
                            </button>
                        </div>
                    </div>
                )}

                {/* FAB Upload Button */}
                <div 
                    onClick={() => { setFilteredSubjects([]); setFormData({ title: "", description: "", class_id: "", subject_id: "", file: null }); setEditingId(null); setViewMode("upload"); }}
                    style={{ position: 'fixed', bottom: '110px', right: '1.5rem', width: '68px', height: '68px', borderRadius: '50%', background: '#6d28d9', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(109, 40, 217, 0.4)', cursor: 'pointer', zIndex: 100 }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '2px' }}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    <span style={{ fontSize: '0.7rem', fontWeight: '700' }}>Upload</span>
                </div>
            </div>
        );
    }

    // ----------------------------------------------------
    // RENDER: DETAILS VIEW
    // ----------------------------------------------------
    if (viewMode === "details" && selectedNote) {
        const ext = getFileExt(selectedNote.file_url);
        const extColor = getFileColor(ext);
        const dateObj = new Date(selectedNote.created_at);

        return (
            <div style={{ background: '#fafafa', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid #f1f5f9', background: '#fff', position: 'sticky', top: 0, zIndex: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '40px', height: '40px', background: '#ede9fe', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6d28d9' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: '800', lineHeight: '1.2' }}>Class Note Details</h2>
                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem', marginTop: '0.2rem' }}>Review the information below</p>
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => { setActiveMenuId(null); handleEditClick(selectedNote); }} style={{ background: 'none', border: 'none', padding: '8px', color: '#6d28d9' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                            <button onClick={() => { setActiveMenuId(null); handleDelete(selectedNote.id); }} style={{ background: 'none', border: 'none', padding: '8px', color: '#ef4444' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
                        </div>
                        <button onClick={() => setViewMode('list')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', color: '#0f172a', border: '1px solid #e2e8f0', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', flexShrink: 0 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                            Back to List
                        </button>
                    </div>
                </div>

                <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
                    {/* Top Note Card inside Details */}
                    <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #f1f5f9', padding: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                            <div style={{ width: '56px', height: '56px', background: `${extColor}15`, color: extColor, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            </div>
                            <span style={{ padding: '4px 10px', background: `${extColor}15`, color: extColor, borderRadius: '6px', fontSize: '0.8rem', fontWeight: '800' }}>{ext}</span>
                        </div>
                        <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', color: '#0f172a', fontWeight: '800' }}>{selectedNote.title}</h1>
                        {selectedNote.description && (
                            <p style={{ margin: '0 0 1.25rem 0', color: '#475569', fontSize: '1rem', lineHeight: '1.5' }}>{selectedNote.description}</p>
                        )}
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                            <span style={{ padding: '6px 12px', background: '#f3e8ff', color: '#7e22ce', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '700' }}>{selectedNote.className || selectedNote.Class?.name || 'Unknown'}</span>
                            <span style={{ padding: '6px 12px', background: '#e0f2fe', color: '#0369a1', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '700' }}>{selectedNote.subjectName || selectedNote.Subject?.name || 'Unknown'}</span>
                        </div>

                        {/* List details */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                <div style={{ color: '#94a3b8', marginTop: '2px' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>Uploaded On</div>
                                    <div style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: '700' }}>{dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, {dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                <div style={{ color: '#94a3b8', marginTop: '2px' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg></div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>File Size</div>
                                    <div style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: '700' }}>{formatBytes(selectedNote.file_size || 2500000)}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                <div style={{ color: '#94a3b8', marginTop: '2px' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>Uploaded By</div>
                                    <div style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: '700' }}>IT Hub Admin</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                <div style={{ color: '#94a3b8', marginTop: '2px' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg></div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>Subject</div>
                                    <div style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: '700' }}>{selectedNote.subjectName || selectedNote.Subject?.name || 'Unknown'}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                <div style={{ color: '#94a3b8', marginTop: '2px' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg></div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>Class</div>
                                    <div style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: '700' }}>{selectedNote.className || selectedNote.Class?.name || 'Unknown'}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* File Preview */}
                    <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #f1f5f9', padding: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', marginBottom: '1.5rem' }}>
                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', color: '#0f172a', fontWeight: '800' }}>File Preview</h3>
                        <div style={{ background: '#f8fafc', borderRadius: '12px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                            {isImage(ext) ? (
                                <img src={resolveFileUrl(selectedNote.file_url)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                            ) : null}
                            <div style={{ display: isImage(ext) ? 'none' : 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: '#94a3b8' }}>
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Preview not available</span>
                            </div>
                        </div>
                    </div>

                    {/* File Actions */}
                    <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #f1f5f9', padding: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', color: '#0f172a', fontWeight: '800' }}>File Actions</h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                            <a href={resolveFileUrl(selectedNote.file_url)} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '12px', textDecoration: 'none', color: '#334155' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: '600', fontSize: '0.9rem' }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    View Full Screen
                                </div>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </a>
                            <a href={resolveFileUrl(selectedNote.file_url)} download target="_blank" rel="noopener noreferrer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '12px', textDecoration: 'none', color: '#334155' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: '600', fontSize: '0.9rem' }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                    Download File
                                </div>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </a>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#334155', cursor: 'pointer' }} onClick={() => { navigator.clipboard.writeText(resolveFileUrl(selectedNote.file_url)); toast.success("Link copied!"); }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: '600', fontSize: '0.9rem' }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                                    Share File
                                </div>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </div>
                        </div>

                        {/* Note Callout */}
                        <div style={{ background: '#faf5ff', border: '1px dashed #d8b4fe', borderRadius: '12px', padding: '1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                            <div>
                                <div style={{ fontSize: '0.85rem', color: '#7e22ce', fontWeight: '800', marginBottom: '0.2rem' }}>Note</div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: '1.5' }}>
                                    This note is visible to students enrolled in <span style={{ color: '#7e22ce', fontWeight: '700' }}>{selectedNote.className || selectedNote.Class?.name} - {selectedNote.subjectName || selectedNote.Subject?.name}</span>.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ----------------------------------------------------
    // RENDER: UPLOAD / EDIT VIEW (FULLSCREEN)
    // ----------------------------------------------------
    if (viewMode === "upload") {
        return (
            <div style={{ background: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', background: '#fff', position: 'sticky', top: 0, zIndex: 10 }}>
                    <button onClick={() => setViewMode('list')} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0f172a' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    </button>
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#0f172a' }}>{editingId ? "Edit Class Note" : "Upload Class Note"}</h2>
                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#64748b' }}>{editingId ? "Update existing material" : "Share new material"}</p>
                    </div>
                    <button onClick={() => setViewMode('list')} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0f172a' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '0 1.5rem 2rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Title */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <label style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1e293b' }}>Title <span style={{ color: '#ef4444' }}>*</span></label>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{formData.title.length}/120</span>
                        </div>
                        <input type="text" name="title" value={formData.title} onChange={handleChange} maxLength={120} placeholder="e.g. Chapter 1 - Introduction" required style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem', background: '#fff', color: '#334155', boxSizing: 'border-box' }} />
                    </div>

                    {/* Description */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <label style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1e293b' }}>Description <span style={{ color: '#94a3b8', fontWeight: '400' }}>(Optional)</span></label>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{formData.description.length}/500</span>
                        </div>
                        <textarea name="description" rows="4" value={formData.description} onChange={handleChange} maxLength={500} placeholder="Brief description of this material..." style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem', background: '#fff', color: '#334155', resize: 'vertical', boxSizing: 'border-box' }}></textarea>
                    </div>

                    {/* Class */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem' }}>Class <span style={{ color: '#ef4444' }}>*</span></label>
                        <div style={{ position: 'relative' }}>
                            <select name="class_id" value={formData.class_id} onChange={handleChange} required style={{ width: '100%', padding: '1rem 2.5rem 1rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', background: '#fff', fontSize: '0.95rem', color: formData.class_id ? '#0f172a' : '#94a3b8', appearance: 'none', boxSizing: 'border-box' }}>
                                <option value="" disabled hidden>Select Class</option>
                                {classes.map(c => <option key={c.id} value={c.id} style={{ color: '#334155' }}>{c.name} {c.section ? c.section : ''}</option>)}
                            </select>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </div>
                    </div>

                    {/* Subject */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem' }}>Subject <span style={{ color: '#ef4444' }}>*</span></label>
                        <div style={{ position: 'relative' }}>
                            <select name="subject_id" value={formData.subject_id} onChange={handleChange} required disabled={!formData.class_id} style={{ width: '100%', padding: '1rem 2.5rem 1rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', background: !formData.class_id ? '#f8fafc' : '#fff', fontSize: '0.95rem', color: formData.subject_id ? '#0f172a' : '#94a3b8', appearance: 'none', boxSizing: 'border-box', opacity: !formData.class_id ? 0.7 : 1 }}>
                                <option value="" disabled hidden>Select Subject</option>
                                {filteredSubjects.map(s => <option key={s.id} value={s.id} style={{ color: '#334155' }}>{s.name}</option>)}
                            </select>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </div>
                    </div>

                    {/* File Attachment */}
                    <div>
                        <label style={{ display: 'flex', alignItems: 'baseline', gap: '4px', fontSize: '0.9rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem' }}>Attachment {(!editingId && <span style={{ color: '#ef4444' }}>*</span>)}</label>
                        <div style={{ position: 'relative' }}>
                            <input type="file" name="file" id="note-file-upload" onChange={handleChange} required={!editingId} style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 10 }} />
                            <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={formData.file ? '#10b981' : '#64748b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: formData.file ? '#10b981' : '#334155', textAlign: 'center' }}>
                                    {formData.file ? formData.file.name : "Tap to upload file"}
                                </span>
                                {!formData.file && <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>PDF, DOC, DOCX, JPG, PNG (Max 10MB)</span>}
                            </div>
                        </div>
                        {editingId && !formData.file && (
                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>Leave empty to keep existing file.</p>
                        )}
                    </div>

                    {/* Buttons Bottom */}
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <button type="submit" disabled={uploading} style={{ width: '100%', padding: '1.1rem', borderRadius: '12px', background: '#6d28d9', color: '#fff', fontSize: '1rem', fontWeight: '700', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 14px rgba(109, 40, 217, 0.3)', cursor: 'pointer', opacity: uploading ? 0.7 : 1 }}>
                            {uploading ? (
                                <><LoadingSpinner /> Uploading...</>
                            ) : (
                                <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                                    {editingId ? "Save Changes" : "Upload Note"}
                                </>
                            )}
                        </button>
                        <button type="button" onClick={() => setViewMode('list')} disabled={uploading} style={{ width: '100%', padding: '1.1rem', borderRadius: '12px', background: '#fff', color: '#334155', fontSize: '1rem', fontWeight: '700', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    return null;
}

export default MobileFacultyNotes;
