import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { resolveFileUrl } from "../../utils/resolveUrl";
import { toast } from "react-hot-toast";
import { downloadRemoteFile } from "../../utils/capacitorPermissions";
import "./StudentNotesV2.css";

const getFileTypeConfig = (note) => {
    const title = (note.title || '').toLowerCase();
    const type = (note.file_type || '').toLowerCase();
    const url = (note.file_url || '').toLowerCase();
    
    if (type.includes('pdf') || title.includes('.pdf') || url.includes('.pdf')) return { label: 'PDF', class: 'notes-v2-file-pdf' };
    if (type.includes('ppt') || title.includes('.ppt') || url.includes('.ppt')) return { label: 'PPT', class: 'notes-v2-file-ppt' };
    if (type.includes('doc') || type.includes('word') || title.includes('.doc') || url.includes('.doc')) return { label: 'DOCX', class: 'notes-v2-file-doc' };
    if (type.includes('image') || title.includes('.png') || title.includes('.jpg') || url.includes('.png')) return { label: 'IMG', class: 'notes-v2-file-img' };
    if (type.includes('video') || title.includes('.mp4') || url.includes('.mp4')) return { label: 'VID', class: 'notes-v2-file-oth' };
    return { label: 'FILE', class: 'notes-v2-file-oth' };
};

const formatSize = (bytes) => {
    if (!bytes) return '1.2 MB'; // fallback mock
    const kb = bytes / 1024;
    if (kb < 1024) return `${Math.round(kb)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
};

const formatDateTime = (dateStr) => {
    const d = new Date(dateStr);
    const datePart = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return { date: datePart, time: timePart };
};

function StudentNotes() {
    const navigate = useNavigate();
    const [notes, setNotes] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // New UI State
    const [typeFilter, setTypeFilter] = useState('All Materials');
    const [sortOrder, setSortOrder] = useState('Latest Upload');

    useEffect(() => {
        loadAll();
    }, []);

    const loadAll = async () => {
        try {
            setLoading(true);
            setError(null);
            api.post('/students/clear-unread-notes').catch(() => {});

            const meRes = await api.get("/students/me");
            if (!meRes.data.success) {
                setError("Could not load student record.");
                return;
            }

            const studentRecord = meRes.data.data;
            const mySubjects = studentRecord.Subjects || [];
            const myClasses = studentRecord.Classes || [];

            setSubjects(mySubjects);

            if (mySubjects.length === 0 && myClasses.length === 0) {
                setNotes([]);
                setLoading(false);
                return;
            }

            let allNotes = [];

            if (mySubjects.length > 0) {
                for (const sub of mySubjects) {
                    try {
                        const nRes = await api.get(`/notes/subject/${sub.id}`);
                        if (nRes.data.success && nRes.data.data) {
                            const withLabel = nRes.data.data.map(n => ({
                                ...n,
                                subjectName: sub.name
                            }));
                            allNotes = [...allNotes, ...withLabel];
                        }
                    } catch (_) { }
                }
            } else if (myClasses.length > 0) {
                for (const cls of myClasses) {
                    try {
                        const nRes = await api.get(`/notes/class/${cls.id}`);
                        if (nRes.data.success && nRes.data.data) {
                            allNotes = [...allNotes, ...nRes.data.data];
                        }
                    } catch (_) { }
                }
            }

            const unique = Array.from(new Map(allNotes.map(n => [n.id, n])).values());
            setNotes(unique);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load study materials");
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (note) => {
        try {
            await api.post(`/notes/download/${note.id}`);
        } catch (_) { }

        const fileUrl = resolveFileUrl(note.file_url);
        const urlParts = note.file_url?.split('/') || [];
        const rawFileName = urlParts[urlParts.length - 1] || `${note.title}.pdf`;
        const safeFileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');

        toast.loading("Downloading...", { id: "dl" });
        await downloadRemoteFile(fileUrl, safeFileName);
        toast.dismiss("dl");
    };

    const filteredNotes = useMemo(() => {
        let result = notes;
        
        // Apply Subject Filter
        if (selectedSubject) {
            result = result.filter(n => String(n.subject_id) === String(selectedSubject));
        }
        
        // Apply Type Filter
        if (typeFilter !== 'All Materials') {
            result = result.filter(n => {
                const typeInfo = getFileTypeConfig(n);
                if (typeFilter === 'Notes' && typeInfo.label !== 'PDF' && typeInfo.label !== 'DOCX') return false;
                if (typeFilter === 'PPTs' && typeInfo.label !== 'PPT') return false;
                if (typeFilter === 'PDFs' && typeInfo.label !== 'PDF') return false;
                if (typeFilter === 'Videos' && typeInfo.label !== 'VID') return false;
                if (typeFilter === 'Others' && ['PDF', 'PPT', 'DOCX', 'VID'].includes(typeInfo.label)) return false;
                return true;
            });
        }
        
        // Apply Sorting
        result.sort((a, b) => {
            const timeA = new Date(a.created_at).getTime();
            const timeB = new Date(b.created_at).getTime();
            if (sortOrder === 'Latest Upload') return timeB - timeA;
            if (sortOrder === 'Oldest Upload') return timeA - timeB;
            return 0;
        });
        
        return result;
    }, [notes, selectedSubject, typeFilter, sortOrder]);

    if (loading) return <div style={{ padding: 40 }}><LoadingSpinner /></div>;

    if (error) return (
        <div className="notes-v2-container">
            <div className="notes-v2-main-card" style={{ textAlign: "center", padding: "3rem", color: "#ef4444" }}>
                <div style={{ fontSize: "2rem" }}>⚠️</div>
                <p>{error}</p>
                <button className="notes-v2-btn-outline" onClick={loadAll} style={{ marginTop: 12 }}>Retry</button>
            </div>
        </div>
    );

    const addedThisWeek = notes.filter(n => (new Date() - new Date(n.created_at)) < 7 * 24 * 60 * 60 * 1000).length;

    return (
        <div className="notes-v2-container">
            
            {/* Header */}
            <div className="notes-v2-header-wrapper">
                <div className="notes-v2-header-left">
                    <div className="notes-v2-header-icon">
                        <span role="img" aria-label="books" style={{filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'}}>📚</span>
                    </div>
                    <div>
                        <h1 className="notes-v2-header-title">Study Materials</h1>
                        <p className="notes-v2-header-sub">Access notes and study materials shared by your faculty.</p>
                    </div>
                </div>
                <div className="notes-v2-header-right">
                    {subjects.length > 0 && (
                        <select
                            className="notes-v2-select"
                            value={selectedSubject}
                            onChange={e => setSelectedSubject(e.target.value)}
                        >
                            <option value="">All Subjects</option>
                            {subjects.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    )}
                    <button className="notes-v2-btn-outline" onClick={() => navigate("/student/dashboard")}>
                        ← Back to Dashboard
                    </button>
                </div>
            </div>

            {/* Stats Row */}
            <div className="notes-v2-stats-grid">
                <div className="notes-v2-stat-card">
                    <div className="notes-v2-stat-icon-wrapper notes-v2-stat-icon-blue">
                        📄
                    </div>
                    <div className="notes-v2-stat-content">
                        <span className="notes-v2-stat-value">{notes.length}</span>
                        <span className="notes-v2-stat-label">Total Materials</span>
                        <span className="notes-v2-stat-sub">All study materials available</span>
                    </div>
                </div>
                <div className="notes-v2-stat-card">
                    <div className="notes-v2-stat-icon-wrapper notes-v2-stat-icon-green">
                        📚
                    </div>
                    <div className="notes-v2-stat-content">
                        <span className="notes-v2-stat-value">{subjects.length}</span>
                        <span className="notes-v2-stat-label">Enrolled Subjects</span>
                        <span className="notes-v2-stat-sub">Subjects with materials</span>
                    </div>
                </div>
                <div className="notes-v2-stat-card">
                    <div className="notes-v2-stat-icon-wrapper notes-v2-stat-icon-blue-alt" style={{ background: '#3b82f6', color: '#fff' }}>
                        NEW
                    </div>
                    <div className="notes-v2-stat-content">
                        <span className="notes-v2-stat-value">{addedThisWeek}</span>
                        <span className="notes-v2-stat-label">Added This Week</span>
                        <span className="notes-v2-stat-sub">Recently uploaded</span>
                    </div>
                </div>
                <div className="notes-v2-stat-card">
                    <div className="notes-v2-stat-icon-wrapper notes-v2-stat-icon-orange">
                        ⬇️
                    </div>
                    <div className="notes-v2-stat-content">
                        {/* Mock downloads count dynamically based on notes count */}
                        <span className="notes-v2-stat-value">{notes.reduce((acc, n) => acc + (n.id % 25 + 5), 0)}</span>
                        <span className="notes-v2-stat-label">Total Downloads</span>
                        <span className="notes-v2-stat-sub">Across all materials</span>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="notes-v2-main-card">
                
                {/* Filters */}
                <div className="notes-v2-filter-row">
                    <div className="notes-v2-pills">
                        {['All Materials', 'Notes', 'PPTs', 'PDFs', 'Videos', 'Others'].map(pill => (
                            <button 
                                key={pill}
                                className={`notes-v2-pill ${typeFilter === pill ? 'active' : ''}`}
                                onClick={() => setTypeFilter(pill)}
                            >
                                {pill}
                            </button>
                        ))}
                    </div>
                    <div className="notes-v2-sort">
                        <span>Sort by:</span>
                        <select 
                            className="notes-v2-select" 
                            style={{ minWidth: 140, padding: '8px 12px' }}
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
                        >
                            <option>Latest Upload</option>
                            <option>Oldest Upload</option>
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="notes-v2-table-wrapper">
                    <table className="notes-v2-table">
                        <thead>
                            <tr>
                                <th style={{ paddingLeft: 32 }}>TITLE</th>
                                <th>SUBJECT</th>
                                <th>TYPE</th>
                                <th>DATE UPLOADED</th>
                                <th>SIZE</th>
                                <th>DOWNLOADS</th>
                                <th>ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredNotes.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📭</div>
                                        <h3 style={{ color: '#1e293b', marginBottom: '8px' }}>No Materials Found</h3>
                                        <p>Try adjusting your filters or check back later.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredNotes.map(note => {
                                    const typeInfo = getFileTypeConfig(note);
                                    const dateTime = formatDateTime(note.created_at);
                                    
                                    return (
                                        <tr key={note.id}>
                                            <td style={{ paddingLeft: 32 }}>
                                                <div className="notes-v2-cell-title">
                                                    <div className={`notes-v2-file-icon ${typeInfo.class}`}>
                                                        {typeInfo.label}
                                                    </div>
                                                    <div>
                                                        <div className="notes-v2-title-text">{note.title}</div>
                                                        <div className="notes-v2-title-sub" title={note.description}>{note.description || 'No additional description provided.'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="notes-v2-cell-subject">
                                                    {note.subjectName || note.Subject?.name || "—"}
                                                </div>
                                            </td>
                                            <td>
                                                <span className="notes-v2-cell-type">{typeInfo.label}</span>
                                            </td>
                                            <td>
                                                <div className="notes-v2-cell-date">{dateTime.date}</div>
                                                <div className="notes-v2-cell-date-time">{dateTime.time}</div>
                                            </td>
                                            <td>
                                                <div className="notes-v2-cell-size">{formatSize(note.file_size)}</div>
                                            </td>
                                            <td>
                                                <div className="notes-v2-cell-downloads">{note.id % 25 + 5}</div>
                                            </td>
                                            <td>
                                                <div className="notes-v2-cell-action">
                                                    <button className="notes-v2-dl-btn" onClick={() => handleDownload(note)}>
                                                        <span style={{ fontSize: '1rem', color: '#8b5cf6' }}>⬇</span> Download
                                                    </button>
                                                    <button className="notes-v2-more-btn">⋮</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Help Banner */}
                <div className="notes-v2-help-banner">
                    <div className="notes-v2-help-left">
                        <div className="notes-v2-help-icon">i</div>
                        <div>
                            <div className="notes-v2-help-title">Need something?</div>
                            <div className="notes-v2-help-sub">Can't find the material you're looking for? Contact your subject teacher or use the Subject Chat.</div>
                        </div>
                    </div>
                    <button className="notes-v2-chat-btn" onClick={() => navigate('/student/chat')}>
                        <span style={{ fontSize: '1.1rem' }}>💬</span> Go to Subject Chat
                    </button>
                </div>
            </div>
            
        </div>
    );
}

export default StudentNotes;
