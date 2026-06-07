import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { resolveFileUrl } from '../../utils/resolveUrl';
import { downloadRemoteFile } from '../../utils/capacitorPermissions';
import { toast } from 'react-hot-toast';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import '../admin/Dashboard.css';

const STATUS_CONFIG = {
    draft: { label: 'Draft', color: '#64748b', bg: '#f1f5f9' },
    published: { label: 'Published', color: '#16a34a', bg: '#dcfce7' },
    closed: { label: 'Closed', color: '#ef4444', bg: '#fee2e2' },
};

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status];
    if (!cfg) return null;
    return (
        <span style={{ background: cfg.bg, color: cfg.color, padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: '600' }}>
            {cfg.label}
        </span>
    );
}

export default function FacultyAssignments() {
    const navigate = useNavigate();
    const [view, setView] = useState('list'); // list | create | submissions | grade
    const [assignments, setAssignments] = useState([]);
    const [selected, setSelected] = useState(null);
    const [submissions, setSubmissions] = useState([]);
    const [gradingTarget, setGradingTarget] = useState(null);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [filterStatus, setFilterStatus] = useState('all');
    const [gradeForm, setGradeForm] = useState({ marks_obtained: '', feedback: '' });
    const [resubmitForm, setResubmitForm] = useState({ resubmit_reason: '' });
    const [showResubmitModal, setShowResubmitModal] = useState(null);
    const [msg, setMsg] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [submissionTab, setSubmissionTab] = useState('Overview');
    const [submissionsPage, setSubmissionsPage] = useState(1);
    const [openMenuId, setOpenMenuId] = useState(null);

    const [form, setForm] = useState({
        title: '', description: '', class_id: '', subject_id: '',
        due_date: '', max_marks: 100, max_file_size_mb: 10,
        allow_late_submission: true, status: 'draft'
    });
    const [referenceFile, setReferenceFile] = useState(null);

    const flash = (text, type = 'success') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 3500); };

    const handleDownloadFile = async (url, originalName, fallbackName) => {
        if (!url) return;
        const fileUrl = resolveFileUrl(url);
        const urlParts = url.split('/');
        const rawFileName = originalName || urlParts[urlParts.length - 1] || fallbackName;
        const safeFileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        
        toast.loading("Downloading...", { id: "dl-fac" });
        await downloadRemoteFile(fileUrl, safeFileName);
        toast.dismiss("dl-fac");
    };

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true);
            const [asgRes, classRes] = await Promise.all([
                api.get('/assignments'),
                api.get('/classes')
            ]);
            setAssignments(asgRes.data.assignments || []);
            setClasses(classRes.data.data || []);
        } catch (e) {
            flash('Failed to load data: ' + (e.response?.data?.message || e.message), 'error');
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const fetchSubjects = async (classId) => {
        if (!classId) return setSubjects([]);
        try {
            const r = await api.get(`/subjects?class_id=${classId}`);
            setSubjects(r.data.data || r.data.subjects || []);
        } catch (err) {
            console.error('Failed to load subjects:', err);
            setSubjects([]);
        }
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        const v = type === 'checkbox' ? checked : value;
        setForm(p => ({ ...p, [name]: v }));
        if (name === 'class_id') { fetchSubjects(value); setForm(p => ({ ...p, subject_id: '' })); }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const fd = new FormData();
            Object.entries(form).forEach(([k, v]) => fd.append(k, v));
            if (referenceFile) fd.append('reference_file', referenceFile);
            
            if (selected) {
                await api.put(`/assignments/${selected.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                flash('Assignment updated successfully!');
            } else {
                await api.post('/assignments', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                flash('Assignment created successfully!');
            }
            setView('list'); resetForm(); setSelected(null); fetchAll();
        } catch (e) {
            flash('Failed to save: ' + (e.response?.data?.message || e.message), 'error');
        } finally { setSubmitting(false); }
    };

    const handleEdit = (asg) => {
        setSelected(asg);
        fetchSubjects(asg.class_id);
        setForm({
            title: asg.title || '',
            description: asg.description || '',
            class_id: asg.class_id || '',
            subject_id: asg.subject_id || '',
            due_date: asg.due_date ? new Date(asg.due_date).toISOString().slice(0, 16) : '',
            max_marks: asg.max_marks || 100,
            max_file_size_mb: asg.max_file_size_mb || 10,
            allow_late_submission: asg.allow_late_submission,
            status: asg.status || 'draft'
        });
        setReferenceFile(null);
        setView('create');
        setOpenMenuId(null);
    };

    const resetForm = () => {
        setForm({ title: '', description: '', class_id: '', subject_id: '', due_date: '', max_marks: 100, max_file_size_mb: 10, allow_late_submission: true, status: 'draft' });
        setReferenceFile(null);
    };

    const handlePublish = async (id) => {
        try {
            await api.patch(`/assignments/${id}/publish`);
            flash('Assignment published!');
            fetchAll();
        } catch (e) { flash(e.response?.data?.message || 'Failed', 'error'); }
    };

    const handleClose = async (id) => {
        if (!window.confirm('Close this assignment? No more submissions will be accepted.')) return;
        try {
            await api.patch(`/assignments/${id}/close`);
            flash('Assignment closed.');
            if (view === 'submissions') { fetchSubmissions(id); }
            fetchAll();
        } catch (e) { flash(e.response?.data?.message || 'Failed', 'error'); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this draft assignment?')) return;
        try {
            await api.delete(`/assignments/${id}`);
            flash('Assignment deleted.');
            fetchAll();
        } catch (e) { flash(e.response?.data?.message || 'Failed', 'error'); }
    };

    const fetchSubmissions = async (asgId) => {
        try {
            const [asgRes, subRes] = await Promise.all([
                api.get(`/assignments/${asgId}`),
                api.get(`/assignments/${asgId}/submissions`)
            ]);
            setSelected(asgRes.data.assignment);
            setSubmissions(subRes.data.submissions || []);
        } catch (e) { flash('Failed to load submissions', 'error'); }
    };

    const openSubmissions = async (asg) => {
        setView('submissions');
        await fetchSubmissions(asg.id);
    };

    const handleGrade = async () => {
        if (!gradingTarget) return;
        const marks = parseFloat(gradeForm.marks_obtained);
        const max = parseFloat(selected?.max_marks || 100);
        if (isNaN(marks) || marks < 0 || marks > max) {
            return flash(`Marks must be 0–${max}`, 'error');
        }
        try {
            await api.patch(`/assignments/${selected.id}/submissions/${gradingTarget.id}/grade`, gradeForm);
            flash('Graded successfully!');
            setGradingTarget(null); setGradeForm({ marks_obtained: '', feedback: '' });
            await fetchSubmissions(selected.id);
        } catch (e) { flash(e.response?.data?.message || 'Grading failed', 'error'); }
    };

    const handleRequestResubmit = async () => {
        if (!showResubmitModal) return;
        try {
            await api.patch(`/assignments/${selected.id}/submissions/${showResubmitModal.id}/request-resubmit`, resubmitForm);
            flash('Resubmission requested!');
            setShowResubmitModal(null); setResubmitForm({ resubmit_reason: '' });
            await fetchSubmissions(selected.id);
        } catch (e) { flash(e.response?.data?.message || 'Failed', 'error'); }
    };

    const searchedAndFiltered = assignments.filter(a => {
        const matchesStatus = filterStatus === 'all' || a.status === filterStatus;
        const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    const totalPublished = assignments.filter(a => a.status === 'published').length;
    const totalPending = assignments.reduce((acc, a) => acc + (a.stats?.pending_grading || 0), 0);
    const totalGraded = assignments.reduce((acc, a) => acc + (a.stats?.graded || 0), 0);
    const totalDrafts = assignments.filter(a => a.status === 'draft').length;

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
                <div style={{ textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'pulse 2s infinite' }}>📝</div>
                    <p style={{ fontWeight: '500' }}>Loading assignments...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '1.5rem 2rem', background: '#f8fafc', minHeight: '100vh', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' }}>
            {msg && (
                <div style={{ position: 'fixed', top: 20, right: 20, background: msg.type === 'success' ? '#10b981' : '#ef4444', color: 'white', padding: '1rem 1.5rem', borderRadius: '8px', zIndex: 1000, boxShadow: '0 4px 6px rgba(0,0,0,0.1)', fontWeight: '600' }}>
                    {msg.text}
                </div>
            )}

            {/* Header Area */}
            {view === 'list' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ background: 'white', padding: '0.75rem', borderRadius: '12px', color: '#4f46e5', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#0f172a', fontWeight: '700' }}>Assignments</h1>
                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem', marginTop: '0.2rem' }}>Create, manage, and grade student assignments</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        {view === 'list' && (
                            <button onClick={() => setView('create')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', boxShadow: '0 2px 4px rgba(99,102,241,0.3)' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                Create Assignment
                            </button>
                        )}
                        {view === 'create' && (
                            <button onClick={() => { setView('list'); setSelected(null); fetchAll(); }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', background: 'white', color: '#4f46e5', border: '1px solid #e0e7ff', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                                Back to List
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* List View */}
            {view === 'list' && (
                <>
                    {/* Top Stats Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                        {/* Active Assignments */}
                        <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
                            <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: '#f5f3ff', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#8b5cf6', fontWeight: '700' }}>{totalPublished}</h2>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#0f172a', fontWeight: '600' }}>Active Assignments</p>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Currently running</p>
                            </div>
                        </div>

                        {/* Pending Grading */}
                        <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
                            <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: '#fffbeb', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 21L3 21"></path><path d="M21 3L3 3"></path><path d="M15 21L15 15C15 13.3431 13.6569 12 12 12C10.3431 12 9 13.3431 9 15L9 21"></path><path d="M15 3L15 9C15 10.6569 13.6569 12 12 12C10.3431 12 9 10.6569 9 9L9 3"></path></svg>
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#f59e0b', fontWeight: '700' }}>{totalPending}</h2>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#0f172a', fontWeight: '600' }}>Pending Grading</p>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Submissions to review</p>
                            </div>
                        </div>

                        {/* Graded */}
                        <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
                            <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#10b981', fontWeight: '700' }}>{totalGraded}</h2>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#0f172a', fontWeight: '600' }}>Graded</p>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Completed</p>
                            </div>
                        </div>

                        {/* Drafts */}
                        <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
                            <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#3b82f6', fontWeight: '700' }}>{totalDrafts}</h2>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#0f172a', fontWeight: '600' }}>Drafts</p>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Not published</p>
                            </div>
                        </div>
                    </div>

                    {/* Filter and Search Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', background: 'white', padding: '0.4rem', borderRadius: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
                            {['all', 'published', 'draft', 'closed'].map(s => {
                                const isActive = filterStatus === s;
                                const count = s === 'all' ? assignments.length : assignments.filter(a => a.status === s).length;
                                const label = s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1);
                                return (
                                    <button
                                        key={s}
                                        onClick={() => setFilterStatus(s)}
                                        style={{
                                            background: isActive ? '#6366f1' : 'transparent',
                                            color: isActive ? 'white' : '#64748b',
                                            border: 'none',
                                            padding: '0.5rem 1rem',
                                            borderRadius: '8px',
                                            fontWeight: '600',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {label} ({count})
                                    </button>
                                );
                            })}
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <div style={{ position: 'relative' }}>
                                <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                <input
                                    type="text"
                                    placeholder="Search assignments..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ padding: '0.6rem 1rem 0.6rem 2.2rem', borderRadius: '8px', border: '1px solid #e2e8f0', width: '250px', outline: 'none', fontSize: '0.9rem', color: '#1e293b' }}
                                />
                            </div>
                            <button style={{ background: 'white', border: '1px solid #e2e8f0', padding: '0.6rem', borderRadius: '8px', cursor: 'pointer', color: '#64748b' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                            </button>
                        </div>
                    </div>

                    {/* Assignments List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {searchedAndFiltered.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '4rem', background: 'white', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                                <p style={{ color: '#64748b', fontWeight: '500' }}>No assignments found.</p>
                            </div>
                        ) : (
                            searchedAndFiltered.map(asg => {
                                const isOverdue = new Date(asg.due_date) < new Date();
                                const statusText = isOverdue && asg.status !== 'closed' ? 'Overdue' : 'In Progress';
                                const statusColor = isOverdue && asg.status !== 'closed' ? '#ef4444' : '#10b981';

                                return (
                                    <div key={asg.id} style={{ background: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)', display: 'flex', flexDirection: 'column' }}>
                                        {/* Card Header & Content */}
                                        <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', gap: '2rem', borderBottom: '1px solid #f1f5f9' }}>
                                            <div style={{ flex: 1 }}>
                                                <StatusBadge status={asg.status} />
                                                <h3 style={{ margin: '0.75rem 0 0.5rem 0', fontSize: '1.25rem', color: '#0f172a' }}>{asg.title}</h3>
                                                
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#64748b', fontSize: '0.85rem', fontWeight: '500', marginBottom: '1rem' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>{asg.Class?.name} {asg.Class?.section && `- Section ${asg.Class.section}`}</span>
                                                    <span>|</span>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>{asg.Subject?.name}</span>
                                                    <span>|</span>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>{Number(asg.max_marks).toFixed(2)} Marks</span>
                                                </div>

                                                {asg.reference_file_url && (
                                                    <button onClick={() => handleDownloadFile(asg.reference_file_url, null, `${asg.title}_Reference`)} style={{ background: 'none', border: 'none', padding: 0, color: '#4f46e5', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                                        Download Reference File
                                                    </button>
                                                )}

                                                {/* Internal Stats Row */}
                                                {asg.status !== 'draft' && asg.stats && (
                                                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            <div style={{ background: '#f1f5f9', color: '#64748b', padding: '0.5rem', borderRadius: '8px' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg></div>
                                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>{asg.stats.total_students}</span>
                                                                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Students</span>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            <div style={{ background: '#eff6ff', color: '#3b82f6', padding: '0.5rem', borderRadius: '8px' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg></div>
                                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>{asg.stats.total_submissions}</span>
                                                                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Submitted</span>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            <div style={{ background: '#fffbeb', color: '#f59e0b', padding: '0.5rem', borderRadius: '8px' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 21L3 21"></path><path d="M21 3L3 3"></path><path d="M15 21L15 15C15 13.3431 13.6569 12 12 12C10.3431 12 9 13.3431 9 15L9 21"></path><path d="M15 3L15 9C15 10.6569 13.6569 12 12 12C10.3431 12 9 10.6569 9 9L9 3"></path></svg></div>
                                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>{asg.stats.pending_grading}</span>
                                                                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Pending</span>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            <div style={{ background: '#ecfdf5', color: '#10b981', padding: '0.5rem', borderRadius: '8px' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></div>
                                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>{asg.stats.graded}</span>
                                                                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Graded</span>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            <div style={{ background: '#fef2f2', color: '#ef4444', padding: '0.5rem', borderRadius: '8px' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div>
                                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>{asg.stats.late}</span>
                                                                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Late</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ minWidth: '220px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
                                                    {asg.status === 'published' && <span style={{ color: statusColor, fontWeight: '600', fontSize: '0.85rem', background: isOverdue ? '#fef2f2' : '#ecfdf5', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>{statusText}</span>}
                                                    <button onClick={() => setOpenMenuId(openMenuId === asg.id ? null : asg.id)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem', borderRadius: '4px' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg></button>
                                                    {openMenuId === asg.id && (
                                                        <div style={{ position: 'absolute', top: '100%', right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 10, padding: '0.5rem', minWidth: '120px' }}>
                                                            {(() => {
                                                                const canEdit = asg.status === 'draft' || (asg.status === 'published' && (!asg.stats || asg.stats.total_submissions === 0));
                                                                return canEdit ? (
                                                                    <button onClick={() => handleEdit(asg)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', padding: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: '#3b82f6', fontWeight: '600', borderRadius: '4px', textAlign: 'left' }}>
                                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                                        Edit
                                                                    </button>
                                                                ) : (
                                                                    <span style={{ display: 'block', padding: '0.5rem', fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>Cannot edit (already submitted)</span>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1rem', width: '100%' }}>
                                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: '2px' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>Due Date</span>
                                                            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: isOverdue ? '#ef4444' : '#1e293b' }}>{formatDate(asg.due_date)}</span>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: '2px' }}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>Published On</span>
                                                            <span style={{ fontSize: '0.85rem', fontWeight: '500', color: '#64748b' }}>{formatDate(asg.created_at || asg.createdAt)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card Actions Bottom */}
                                        <div style={{ padding: '1rem 1.5rem', display: 'flex', gap: '1rem' }}>
                                            {asg.status !== 'draft' && (
                                                <button onClick={() => openSubmissions(asg)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#6366f1', color: 'white', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(99,102,241,0.3)' }}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                                    View Submissions
                                                </button>
                                            )}
                                            {asg.status === 'draft' && (
                                                <>
                                                    <button onClick={() => handlePublish(asg.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#10b981', color: 'white', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(16,185,129,0.3)' }}>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                                        Publish
                                                    </button>
                                                    <button onClick={() => handleDelete(asg.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'white', color: '#ef4444', border: '1px solid #fecaca', padding: '0.6rem 1.2rem', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                        Delete
                                                    </button>
                                                </>
                                            )}
                                            {asg.status === 'published' && (
                                                <button onClick={() => handleClose(asg.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.6rem 1.2rem', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                                                    Close Assignment
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    
                    {/* Pagination */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', padding: '1rem 0', color: '#64748b', fontSize: '0.9rem' }}>
                        <div>Showing 1 to {searchedAndFiltered.length} of {searchedAndFiltered.length} assignments</div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', color: '#94a3b8' }}>&lt;</button>
                            <button style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#6366f1', border: 'none', borderRadius: '6px', cursor: 'pointer', color: 'white', fontWeight: '600' }}>1</button>
                            <button style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', color: '#94a3b8' }}>&gt;</button>
                        </div>
                    </div>
                </>
            )}

            {/* Submissions View and Create View can remain standard or be styled later, the focus is the main dashboard */}
            {view === 'create' && (
                <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Header bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '48px', height: '48px', background: '#f5f3ff', color: '#6d28d9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a', fontWeight: '700' }}>{selected ? 'Edit Assignment' : 'Create New Assignment'}</h2>
                                <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', marginTop: '0.2rem' }}>{selected ? 'Modify the details of your assignment' : 'Add a new assignment for your students'}</p>
                            </div>
                        </div>
                        <button onClick={() => { setView('list'); resetForm(); setSelected(null); fetchAll(); }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', color: '#0f172a', border: '1px solid #e2e8f0', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                            Back to List
                        </button>
                    </div>

                    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', borderTop: '4px solid #8b5cf6', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', padding: '2rem' }}>
                        <h3 style={{ margin: '0 0 1.5rem 0', color: '#6d28d9', fontSize: '1.1rem', fontWeight: '600', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>Assignment Details</h3>
                        <form onSubmit={handleCreate}>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '1.5rem' }}>
                                {/* Title (Left) */}
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>Title *</label>
                                    <div style={{ position: 'relative' }}>
                                        <input name="title" value={form.title} onChange={handleFormChange} required placeholder="Enter assignment title" style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem', boxSizing: 'border-box' }} />
                                    </div>
                                </div>
                                {/* Description (Right) */}
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>Description / Instructions *</label>
                                    <div style={{ position: 'relative' }}>
                                        <textarea name="description" value={form.description} onChange={handleFormChange} required rows={3} placeholder="Provide detailed instructions for students..." style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', resize: 'vertical', fontSize: '0.95rem', boxSizing: 'border-box' }} />
                                        <div style={{ position: 'absolute', bottom: '-20px', right: 0, fontSize: '0.75rem', color: '#94a3b8' }}>{form.description?.length || 0} / 1000</div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '1.5rem' }}>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>Class *</label>
                                    <select name="class_id" value={form.class_id} onChange={handleFormChange} required style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem', appearance: 'none', background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 1rem center/16px', boxSizing: 'border-box' }}>
                                        <option value="">Select Class</option>
                                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>Subject *</label>
                                    <select name="subject_id" value={form.subject_id} onChange={handleFormChange} required disabled={!form.class_id} style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem', appearance: 'none', background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 1rem center/16px', boxSizing: 'border-box' }}>
                                        <option value="">Select Subject</option>
                                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '1.5rem' }}>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>Due Date & Time *</label>
                                    <div style={{ position: 'relative' }}>
                                        <input type="datetime-local" name="due_date" value={form.due_date} onChange={handleFormChange} required min={new Date(Date.now() + 3600000).toISOString().slice(0, 16)} style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem', boxSizing: 'border-box' }} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>Max Marks *</label>
                                    <input type="number" name="max_marks" value={form.max_marks} onChange={handleFormChange} min={1} max={500} required placeholder="Enter maximum marks" style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem', boxSizing: 'border-box' }} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '1.5rem' }}>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>Max File Size (MB)</label>
                                    <input type="number" name="max_file_size_mb" value={form.max_file_size_mb} onChange={handleFormChange} min={1} max={50} placeholder="Enter max file size (e.g., 10)" style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem', boxSizing: 'border-box' }} />
                                    <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>Maximum file size students can upload</span>
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>Save As</label>
                                    <select name="status" value={form.status} onChange={handleFormChange} style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem', appearance: 'none', background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 1rem center/16px', boxSizing: 'border-box' }}>
                                        <option value="draft">Draft (save privately)</option>
                                        <option value="published">Publish (visible to students)</option>
                                    </select>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>Students won't see this until published</span>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                                    <input type="checkbox" name="allow_late_submission" checked={form.allow_late_submission} onChange={handleFormChange} style={{ width: '20px', height: '20px', accentColor: '#6366f1', marginTop: '2px' }} />
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: '600', color: '#334155', fontSize: '0.95rem' }}>Allow late submission</span>
                                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Students can submit after the due date</span>
                                    </div>
                                </label>
                            </div>

                            <div className="form-group" style={{ marginBottom: '2.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>Reference File (Optional)</label>
                                <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.5rem', display: 'flex', alignItems: 'center' }}>
                                    <input type="file" accept=".pdf,.docx,.doc,.zip,.jpg,.png" onChange={e => setReferenceFile(e.target.files[0])} style={{ width: '100%', outline: 'none' }} />
                                </div>
                                <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.4rem', display: 'block' }}>PDF, DOCX, ZIP, Image accepted (max 50 MB)</span>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                                <button type="submit" disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 2rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(99,102,241,0.3)' }}>
                                    {submitting ? 'Saving...' : selected ? 'Save Changes' : 'Create Assignment'}
                                </button>
                                <button type="button" onClick={() => { setView('list'); resetForm(); }} style={{ padding: '0.75rem 2rem', background: 'white', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer' }}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Submissions View */}
            {view === 'submissions' && selected && (
                <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Breadcrumbs & Header Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }} onClick={() => { setView('list'); setSelected(null); }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                                Assignments
                            </span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            <span style={{ color: '#2563eb', fontWeight: '600' }}>{selected.title}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <button onClick={() => { setView('list'); setSelected(null); }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', color: '#0f172a', border: '1px solid #e2e8f0', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                                Back to Assignments
                            </button>
                        </div>
                    </div>

                    {/* Main Info & Stats Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1.5fr) 2fr', gap: '1.5rem', alignItems: 'flex-start' }}>
                        {/* Info Card */}
                        <div style={{ background: '#ffffff', borderRadius: '20px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.04), 0 4px 6px -2px rgba(0, 0, 0, 0.02)', display: 'flex', gap: '1.5rem', alignItems: 'flex-start', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#6366f1' }}></div>
                            <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #e0e7ff', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5)' }}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                    <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.6rem', fontWeight: '800', letterSpacing: '-0.02em' }}>{selected.title}</h2>
                                    <StatusBadge status={selected.status} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#475569', fontSize: '0.9rem', fontWeight: '600', flexWrap: 'wrap' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#f8fafc', padding: '0.2rem 0.6rem', borderRadius: '6px', border: '1px solid #f1f5f9' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect></svg>{selected.Class?.name} {selected.Class?.section && `- ${selected.Class.section}`}</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#f8fafc', padding: '0.2rem 0.6rem', borderRadius: '6px', border: '1px solid #f1f5f9' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon></svg>{selected.Subject?.name}</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#f8fafc', padding: '0.2rem 0.6rem', borderRadius: '6px', border: '1px solid #f1f5f9' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle></svg>{Number(selected.max_marks).toFixed(2)} Marks</span>
                                </div>
                                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: '#64748b', fontWeight: '500', marginTop: '0.4rem' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                        Due: <strong style={{ color: '#334155' }}>{formatDate(selected.due_date)}</strong>
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                        Created: <strong style={{ color: '#334155' }}>{formatDate(selected.created_at || selected.createdAt)}</strong>
                                    </span>
                                </div>
                                {selected.reference_file_url && (
                                    <div style={{ marginTop: '0.8rem' }}>
                                        <button onClick={() => handleDownloadFile(selected.reference_file_url, null, `${selected.title}_Reference`)} style={{ background: 'linear-gradient(to right, #eff6ff, #e0e7ff)', border: '1px solid #bfdbfe', color: '#2563eb', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(37, 99, 235, 0.1)' }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                            Download Reference File
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Premium Stats Cards Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                            {/* Total Students */}
                            <div style={{ background: 'linear-gradient(145deg, #ffffff, #f8fafc)', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), inset 0 2px 4px rgba(255,255,255,1)', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: '-15px', right: '-15px', width: '60px', height: '60px', background: '#f5f3ff', borderRadius: '50%', opacity: 0.5 }}></div>
                                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Students</span>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                                    <span style={{ fontSize: '2.5rem', fontWeight: '800', color: '#0f172a', lineHeight: '1' }}>{submissions.length}</span>
                                    <div style={{ background: '#ede9fe', color: '#6366f1', padding: '0.5rem', borderRadius: '10px', boxShadow: '0 2px 4px rgba(99,102,241,0.2)' }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                                    </div>
                                </div>
                            </div>
                            {/* Submitted */}
                            <div style={{ background: 'linear-gradient(145deg, #ffffff, #f0fdf4)', border: '1px solid #bbf7d0', borderRadius: '20px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.05), inset 0 2px 4px rgba(255,255,255,1)', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: '-15px', right: '-15px', width: '60px', height: '60px', background: '#dcfce7', borderRadius: '50%', opacity: 0.5 }}></div>
                                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Submitted</span>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                                    <span style={{ fontSize: '2.5rem', fontWeight: '800', color: '#14532d', lineHeight: '1' }}>{submissions.filter(s => s.status !== 'pending').length}</span>
                                    <div style={{ background: '#10b981', color: 'white', padding: '0.5rem', borderRadius: '10px', boxShadow: '0 2px 4px rgba(16,185,129,0.3)' }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"></path><path d="M22 2L15 22 11 13 2 9 22 2z"></path></svg>
                                    </div>
                                </div>
                            </div>
                            {/* Pending */}
                            <div style={{ background: 'linear-gradient(145deg, #ffffff, #fff7ed)', border: '1px solid #fed7aa', borderRadius: '20px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.05), inset 0 2px 4px rgba(255,255,255,1)', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: '-15px', right: '-15px', width: '60px', height: '60px', background: '#ffedd5', borderRadius: '50%', opacity: 0.5 }}></div>
                                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending</span>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                                    <span style={{ fontSize: '2.5rem', fontWeight: '800', color: '#7c2d12', lineHeight: '1' }}>{submissions.filter(s => s.status === 'pending').length}</span>
                                    <div style={{ background: '#f59e0b', color: 'white', padding: '0.5rem', borderRadius: '10px', boxShadow: '0 2px 4px rgba(245,158,11,0.3)' }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 21L3 21"></path><path d="M21 3L3 3"></path><path d="M15 21L15 15C15 13.3431 13.6569 12 12 12C10.3431 12 9 13.3431 9 15L9 21"></path><path d="M15 3L15 9C15 10.6569 13.6569 12 12 12C10.3431 12 9 10.6569 9 9L9 3"></path></svg>
                                    </div>
                                </div>
                            </div>
                            {/* Graded */}
                            <div style={{ background: 'linear-gradient(145deg, #ffffff, #fdf4ff)', border: '1px solid #fbcfe8', borderRadius: '20px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', boxShadow: '0 4px 6px -1px rgba(217, 70, 239, 0.05), inset 0 2px 4px rgba(255,255,255,1)', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: '-15px', right: '-15px', width: '60px', height: '60px', background: '#fce7f3', borderRadius: '50%', opacity: 0.5 }}></div>
                                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#db2777', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Graded</span>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                                    <span style={{ fontSize: '2.5rem', fontWeight: '800', color: '#831843', lineHeight: '1' }}>{submissions.filter(s => s.status === 'graded').length}</span>
                                    <div style={{ background: '#ec4899', color: 'white', padding: '0.5rem', borderRadius: '10px', boxShadow: '0 2px 4px rgba(236,72,153,0.3)' }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0', marginTop: '1rem' }}>
                        {[
                            { id: 'Overview', label: 'Overview' },
                            { id: 'Submissions', label: `Submissions (${submissions.filter(s => s.status !== 'pending').length})` },
                            { id: 'Graded', label: `Graded (${submissions.filter(s => s.status === 'graded').length})` },
                            { id: 'Unsubmitted', label: `Unsubmitted (${submissions.filter(s => s.status === 'pending').length})` },
                            { id: 'Analytics', label: 'Analytics' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setSubmissionTab(tab.id)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: submissionTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
                                    color: submissionTab === tab.id ? '#2563eb' : '#64748b',
                                    padding: '0 0 1rem 0',
                                    fontSize: '0.9rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    {(submissionTab === 'Overview' || submissionTab === 'Analytics') && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
                            {/* Class Performance Card */}
                            <div style={{ background: 'linear-gradient(to bottom right, #ffffff, #f8fafc)', borderRadius: '20px', padding: '2rem', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                                    <div>
                                        <h3 style={{ margin: '0 0 0.25rem 0', color: '#0f172a', fontSize: '1.25rem', fontWeight: '800' }}>Class Performance</h3>
                                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: '500' }}>Overall submission analytics for this assignment</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '3.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <div style={{ width: '220px', height: '220px', position: 'relative', filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.05))' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={[
                                                        { name: 'Submitted', value: submissions.filter(s => ['submitted', 'late'].includes(s.status)).length, color: '#10b981' },
                                                        { name: 'Graded', value: submissions.filter(s => s.status === 'graded').length, color: '#f59e0b' },
                                                        { name: 'Pending', value: submissions.filter(s => s.status === 'resubmit_requested').length, color: '#fca5a5' },
                                                        { name: 'Not Submitted', value: submissions.filter(s => s.status === 'pending').length, color: '#ef4444' }
                                                    ].filter(d => d.value > 0)}
                                                    cx="50%" cy="50%" innerRadius={75} outerRadius={105} paddingAngle={4} dataKey="value"
                                                    stroke="none"
                                                    cornerRadius={8}
                                                >
                                                    {([
                                                        { name: 'Submitted', value: submissions.filter(s => ['submitted', 'late'].includes(s.status)).length, color: '#10b981' },
                                                        { name: 'Graded', value: submissions.filter(s => s.status === 'graded').length, color: '#f59e0b' },
                                                        { name: 'Pending', value: submissions.filter(s => s.status === 'resubmit_requested').length, color: '#fca5a5' },
                                                        { name: 'Not Submitted', value: submissions.filter(s => s.status === 'pending').length, color: '#ef4444' }
                                                    ].filter(d => d.value > 0)).map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(val) => [val, 'Students']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                                            <span style={{ fontSize: '2.5rem', fontWeight: '800', color: '#0f172a', lineHeight: '1' }}>{submissions.length}</span>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '0.2rem' }}>Students</span>
                                        </div>
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: '200px' }}>
                                        {[
                                            { label: 'Submitted', value: submissions.filter(s => ['submitted', 'late'].includes(s.status)).length, color: '#10b981', bg: '#ecfdf5' },
                                            { label: 'Graded', value: submissions.filter(s => s.status === 'graded').length, color: '#f59e0b', bg: '#fffbeb' },
                                            { label: 'Pending', value: submissions.filter(s => s.status === 'resubmit_requested').length, color: '#fca5a5', bg: '#fef2f2' },
                                            { label: 'Not Submitted', value: submissions.filter(s => s.status === 'pending').length, color: '#ef4444', bg: '#fef2f2' }
                                        ].map((stat, i) => {
                                            const pct = submissions.length > 0 ? Math.round((stat.value / submissions.length) * 100) : 0;
                                            return (
                                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.95rem', padding: '0.5rem 0', borderBottom: i < 3 ? '1px dashed #e2e8f0' : 'none' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: stat.color, boxShadow: `0 0 0 4px ${stat.bg}` }}></div>
                                                        <span style={{ fontWeight: '600', color: '#334155' }}>{stat.label}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '1.5rem', fontWeight: '700', alignItems: 'center' }}>
                                                        <span style={{ color: '#0f172a', fontSize: '1.1rem' }}>{stat.value}</span>
                                                        <span style={{ color: '#94a3b8', width: '45px', textAlign: 'right', fontSize: '0.85rem' }}>({pct}%)</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div style={{ paddingLeft: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.75rem', minWidth: '180px', borderLeft: '2px solid #f1f5f9' }}>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                            <div style={{ background: '#f8fafc', padding: '0.6rem', borderRadius: '10px', color: '#64748b', border: '1px solid #e2e8f0' }}>
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Due Date</span>
                                                <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#1e293b' }}>{formatDate(selected.due_date)}</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                            <div style={{ background: '#eff6ff', padding: '0.6rem', borderRadius: '10px', color: '#3b82f6', border: '1px solid #bfdbfe' }}>
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Time Remaining</span>
                                                <span style={{ fontSize: '0.95rem', fontWeight: '700', color: new Date(selected.due_date) < new Date() ? '#ef4444' : '#1e293b' }}>
                                                    {(() => {
                                                        const due = new Date(selected.due_date);
                                                        const now = new Date();
                                                        const diff = due - now;
                                                        if (diff < 0) return <span style={{ color: '#ef4444', background: '#fef2f2', padding: '2px 8px', borderRadius: '6px' }}>Overdue</span>;
                                                        const hours = Math.floor(diff / (1000 * 60 * 60));
                                                        const days = Math.floor(hours / 24);
                                                        if (days > 0) return <span>{days}d {hours % 24}h</span>;
                                                        return <span>{hours}h left</span>;
                                                    })()}
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                            <div style={{ background: '#f5f3ff', padding: '0.6rem', borderRadius: '10px', color: '#8b5cf6', border: '1px solid #ddd6fe' }}>
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Marks</span>
                                                <span style={{ fontSize: '1.05rem', fontWeight: '800', color: '#1e293b' }}>{Number(selected.max_marks).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>


                        </div>
                    )}

                    {/* Table Card (Filtered by Tab) */}
                    {(submissionTab !== 'Analytics') && (() => {
                        const filteredSubmissions = submissions.filter(sub => {
                            if (submissionTab === 'Submissions' && sub.status === 'pending') return false;
                            if (submissionTab === 'Graded' && sub.status !== 'graded') return false;
                            if (submissionTab === 'Unsubmitted' && sub.status !== 'pending') return false;
                            if (searchQuery && !sub.Student?.User?.name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                            return true;
                        });

                        const itemsPerPage = 10;
                        const totalPages = Math.ceil(filteredSubmissions.length / itemsPerPage) || 1;
                        const currentPage = submissionsPage > totalPages ? totalPages : submissionsPage;
                        const startIndex = (currentPage - 1) * itemsPerPage;
                        const paginatedSubmissions = filteredSubmissions.slice(startIndex, startIndex + itemsPerPage);

                        return (
                            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)', marginTop: '0.5rem' }}>
                            <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem', fontWeight: '700' }}>Student Submissions</h3>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <div style={{ position: 'relative' }}>
                                        <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                        <input
                                            type="text"
                                            placeholder="Search students..."
                                            value={searchQuery}
                                            onChange={(e) => { setSearchQuery(e.target.value); setSubmissionsPage(1); }}
                                            style={{ padding: '0.6rem 1rem 0.6rem 2.2rem', borderRadius: '8px', border: '1px solid #e2e8f0', width: '240px', outline: 'none', fontSize: '0.85rem' }}
                                        />
                                    </div>
                                    <button style={{ background: 'white', border: '1px solid #e2e8f0', padding: '0.6rem', borderRadius: '8px', cursor: 'pointer', color: '#64748b' }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
                                    </button>
                                </div>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', background: '#f8fafc' }}>
                                            <th style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>#</th>
                                            <th style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>Student Name</th>
                                            <th style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>Status</th>
                                            <th style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>Submitted At</th>
                                            <th style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>File</th>
                                            <th style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>Marks</th>
                                            <th style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>Grade</th>
                                            <th style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedSubmissions.map((sub, i) => {
                                            const idx = startIndex + i;
                                            const subStatusCfg = {
                                                pending: { label: 'Not Submitted', color: '#ef4444', bg: '#fef2f2' },
                                                submitted: { label: 'Submitted', color: '#10b981', bg: '#ecfdf5' },
                                                late: { label: 'Late', color: '#f59e0b', bg: '#fffbeb' },
                                                graded: { label: 'Graded', color: '#8b5cf6', bg: '#f5f3ff' },
                                                resubmit_requested: { label: 'Resubmit Req', color: '#fca5a5', bg: '#fef2f2' },
                                            }[sub.status] || { label: sub.status, color: '#000', bg: '#eee' };

                                            return (
                                                <tr key={sub.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>{idx + 1}</td>
                                                    <td style={{ padding: '1.25rem 1.5rem', fontWeight: '600', color: '#1e293b', fontSize: '0.85rem' }}>
                                                        {sub.Student?.User?.name}
                                                        {sub.is_late && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', background: '#fef2f2', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>LATE</span>}
                                                    </td>
                                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                                        <span style={{ background: subStatusCfg.bg, color: subStatusCfg.color, padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600' }}>
                                                            {subStatusCfg.label}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>
                                                        {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                                    </td>
                                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                                        {sub.submission_file_url ? (
                                                            <button onClick={() => handleDownloadFile(sub.submission_file_url, sub.submission_file_name, `${sub.Student?.User?.name}_Submission`)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontWeight: '500', fontSize: '0.85rem', textAlign: 'left', display: 'flex', flexDirection: 'column', padding: 0 }}>
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> {sub.submission_file_name || 'Download'}</span>
                                                                {sub.submission_file_size_kb && <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>({sub.submission_file_size_kb} KB)</span>}
                                                            </button>
                                                        ) : <span style={{ color: '#94a3b8', fontWeight: '500' }}>—</span>}
                                                    </td>
                                                    <td style={{ padding: '1.25rem 1.5rem', fontWeight: '600', color: '#0f172a', fontSize: '0.85rem' }}>
                                                        {sub.status === 'graded' ? `${sub.marks_obtained}` : '—'}
                                                    </td>
                                                    <td style={{ padding: '1.25rem 1.5rem', fontWeight: '600', color: '#0f172a', fontSize: '0.85rem' }}>
                                                        {sub.status === 'graded' ? `${sub.grade || '—'}` : '—'}
                                                    </td>
                                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                            {['submitted', 'late', 'resubmit_requested', 'graded'].includes(sub.status) ? (
                                                                <button onClick={() => { setGradingTarget(sub); setGradeForm({ marks_obtained: sub.marks_obtained || '', feedback: sub.feedback || '' }); }} style={{ background: '#f5f3ff', color: '#8b5cf6', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                                                    Review
                                                                </button>
                                                            ) : (
                                                                <button style={{ background: 'white', color: '#3b82f6', border: '1px solid #bfdbfe', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                                                    Reminder
                                                                </button>
                                                            )}
                                                            {['submitted', 'late', 'graded'].includes(sub.status) && (
                                                                <button onClick={() => setShowResubmitModal(sub)} style={{ background: 'white', color: '#f59e0b', border: '1px solid #fef3c7', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f1f5f9', color: '#64748b', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>Showing {filteredSubmissions.length > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + itemsPerPage, filteredSubmissions.length)} of {filteredSubmissions.length} students</div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => setSubmissionsPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: currentPage === 1 ? '#cbd5e1' : '#94a3b8' }}>&lt;</button>
                                    
                                    {Array.from({ length: totalPages }).map((_, i) => {
                                        const p = i + 1;
                                        if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
                                            return (
                                                <button key={p} onClick={() => setSubmissionsPage(p)} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: currentPage === p ? '#6366f1' : 'white', border: currentPage === p ? 'none' : '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', color: currentPage === p ? 'white' : '#94a3b8', fontWeight: '600' }}>{p}</button>
                                            );
                                        }
                                        if (p === currentPage - 2 || p === currentPage + 2) {
                                            return <span key={p} style={{ display: 'flex', alignItems: 'center', color: '#94a3b8' }}>...</span>;
                                        }
                                        return null;
                                    })}

                                    <button onClick={() => setSubmissionsPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', color: currentPage === totalPages ? '#cbd5e1' : '#94a3b8' }}>&gt;</button>
                                </div>
                            </div>
                        </div>
                        );
                    })()}
                </div>
            )}

            {/* Modals remain mostly same but slightly styled */}
            {gradingTarget && selected && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setGradingTarget(null)}>
                    <div style={{ background: 'white', padding: '2rem', borderRadius: '16px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 1rem 0', color: '#0f172a' }}>🎯 Grade Submission</h3>
                        <p style={{ margin: '0 0 0.5rem 0' }}><strong>Student:</strong> {gradingTarget.Student?.User?.name}</p>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>Marks Obtained (out of {selected.max_marks})</label>
                            <input type="number" min={0} max={selected.max_marks} value={gradeForm.marks_obtained} onChange={e => setGradeForm(p => ({ ...p, marks_obtained: e.target.value }))} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>Feedback</label>
                            <textarea rows={3} value={gradeForm.feedback} onChange={e => setGradeForm(p => ({ ...p, feedback: e.target.value }))} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', resize: 'vertical' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button onClick={() => setGradingTarget(null)} style={{ padding: '0.6rem 1.2rem', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={handleGrade} style={{ padding: '0.6rem 1.2rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Save Grade</button>
                        </div>
                    </div>
                </div>
            )}

            {showResubmitModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowResubmitModal(null)}>
                    <div style={{ background: 'white', padding: '2rem', borderRadius: '16px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 1rem 0', color: '#0f172a' }}>🔄 Request Resubmission</h3>
                        <p style={{ margin: '0 0 1.5rem 0', color: '#64748b' }}>Request {showResubmitModal.Student?.User?.name} to resubmit.</p>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>Reason</label>
                            <textarea rows={3} value={resubmitForm.resubmit_reason} onChange={e => setResubmitForm(p => ({ ...p, resubmit_reason: e.target.value }))} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', resize: 'vertical' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button onClick={() => setShowResubmitModal(null)} style={{ padding: '0.6rem 1.2rem', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={handleRequestResubmit} style={{ padding: '0.6rem 1.2rem', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Send Request</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
