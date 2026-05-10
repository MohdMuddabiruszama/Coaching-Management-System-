/**
 * Faculty Assignments — Phase 10 Professional Dashboard
 * Priority inbox, analytics, grading, resubmit management
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { resolveFileUrl } from '../../utils/resolveUrl';
import '../admin/Dashboard.css';
import './Assignments.css';

const STATUS_CONFIG = {
    draft: { label: 'Draft', color: '#6b7280', bg: '#f3f4f6', icon: '✏️' },
    published: { label: 'Published', color: '#2563eb', bg: '#eff6ff', icon: '📢' },
    closed: { label: 'Closed', color: '#dc2626', bg: '#fee2e2', icon: '🔒' },
};

const SUB_STATUS_CONFIG = {
    pending: { label: 'Not Submitted', color: '#6b7280', bg: '#f3f4f6', icon: '⏳' },
    submitted: { label: 'Submitted', color: '#2563eb', bg: '#eff6ff', icon: '📩' },
    late: { label: 'Late', color: '#d97706', bg: '#fef3c7', icon: '⚠️' },
    graded: { label: 'Graded', color: '#16a34a', bg: '#f0fdf4', icon: '✅' },
    resubmit_requested: { label: 'Resubmit Req.', color: '#7c3aed', bg: '#f5f3ff', icon: '🔄' },
};

function StatusBadge({ status, type = 'assignment' }) {
    const cfg = type === 'submission' ? SUB_STATUS_CONFIG[status] : STATUS_CONFIG[status];
    if (!cfg) return null;
    return (
        <span className="fa-badge" style={{ background: cfg.bg, color: cfg.color }}>
            {cfg.icon} {cfg.label}
        </span>
    );
}

function StatCard({ icon, label, value, color }) {
    return (
        <div className="fa-stat-card" style={{ borderTopColor: color }}>
            <div className="fa-stat-icon" style={{ color }}>{icon}</div>
            <div>
                <div className="fa-stat-value" style={{ color }}>{value}</div>
                <div className="fa-stat-label">{label}</div>
            </div>
        </div>
    );
}

function CountdownBadge({ dueDate }) {
    const due = new Date(dueDate);
    const now = new Date();
    const diff = due - now;
    if (diff < 0) return <span className="fa-countdown overdue">⛔ Overdue</span>;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return <span className="fa-countdown ok">🕒 {days}d {hours % 24}h left</span>;
    if (hours > 0) return <span className="fa-countdown warning">⚠️ {hours}h left</span>;
    return <span className="fa-countdown danger">🔴 &lt;1h left</span>;
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

    const [form, setForm] = useState({
        title: '', description: '', class_id: '', subject_id: '',
        due_date: '', max_marks: 100, max_file_size_mb: 10,
        allow_late_submission: true, status: 'draft'
    });
    const [referenceFile, setReferenceFile] = useState(null);

    const flash = (text, type = 'success') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 3500); };

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
            // Use the correct endpoint that accepts class_id as a query param
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
            await api.post('/assignments', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            flash('Assignment created successfully!');
            setView('list'); resetForm(); fetchAll();
        } catch (e) {
            flash('Failed to create: ' + (e.response?.data?.message || e.message), 'error');
        } finally { setSubmitting(false); }
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

    const filtered = filterStatus === 'all' ? assignments : assignments.filter(a => a.status === filterStatus);

    // Stats
    const totalPublished = assignments.filter(a => a.status === 'published').length;
    const totalPending = assignments.reduce((acc, a) => acc + (a.stats?.pending_grading || 0), 0);
    const totalGraded = assignments.reduce((acc, a) => acc + (a.stats?.graded || 0), 0);
    const totalDrafts = assignments.filter(a => a.status === 'draft').length;

    if (loading) {
        return (
            <div className="dashboard-container">
                <div style={{ textAlign: 'center', padding: '4rem' }}>
                    <div className="fa-spinner" /><p style={{ marginTop: 12, color: '#6b7280' }}>Loading assignments...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-container">
            {/* Flash Message */}
            {msg && (
                <div className={`fa-flash ${msg.type}`}>
                    {msg.type === 'success' ? '✅' : '❌'} {msg.text}
                </div>
            )}

            {/* Header */}
            <div className="dashboard-header">
                <div>
                    <h1>📝 Assignments</h1>
                    <p>Create, manage, and grade student assignments</p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    {view !== 'list' && (
                        <button className="animated-btn secondary btn btn-secondary" onClick={() => { setView('list'); setSelected(null); fetchAll(); }}>
                            <span className="icon icon-back">←</span> <b> Back to List </b>
                        </button>
                    )}
                    {view === 'list' && (
                        <button className="btn btn-primary" onClick={() => setView('create')}>
                            + Create Assignment
                        </button>
                    )}
                    <button className="animated-btn secondary btn btn-secondary" onClick={() => navigate('/faculty/dashboard')}>
                        <span className="icon icon-back">←</span> <b> Back to Dashboard </b>
                    </button>
                </div>
            </div>

            {/* ── STATS ROW ── */}
            {view === 'list' && (
                <div className="fa-stats-row">
                    <StatCard icon="📢" label="Active Assignments" value={totalPublished} color="#2563eb" />
                    <StatCard icon="⏳" label="Pending Grading" value={totalPending} color="#d97706" />
                    <StatCard icon="✅" label="Graded" value={totalGraded} color="#16a34a" />
                    <StatCard icon="✏️" label="Drafts" value={totalDrafts} color="#6b7280" />
                </div>
            )}

            {/* ══════════════════════════════════════════════════ */}
            {/* LIST VIEW */}
            {/* ══════════════════════════════════════════════════ */}
            {view === 'list' && (
                <div className="card">
                    {/* Filter Tabs */}
                    <div className="fa-filter-tabs">
                        {['all', 'published', 'draft', 'closed'].map(s => (
                            <button
                                key={s}
                                className={`fa-tab ${filterStatus === s ? 'active' : ''}`}
                                onClick={() => setFilterStatus(s)}
                            >
                                {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label}
                                {s === 'all' ? ` (${assignments.length})` : ` (${assignments.filter(a => a.status === s).length})`}
                            </button>
                        ))}
                    </div>

                    <div className="fa-assignment-list">
                        {filtered.length === 0 ? (
                            <div className="fa-empty">
                                <div style={{ fontSize: 48 }}>📭</div>
                                <p>No assignments found.</p>
                                <button className="btn btn-primary" onClick={() => setView('create')}>Create Your First Assignment</button>
                            </div>
                        ) : (
                            filtered.map(asg => (
                                <div key={asg.id} className="fa-assignment-card">
                                    <div className="fa-asg-header">
                                        <div>
                                            <StatusBadge status={asg.status} />
                                            <h3 className="fa-asg-title">{asg.title}</h3>
                                            <p className="fa-asg-meta">
                                                📚 {asg.Class?.name} &nbsp;|&nbsp; 📖 {asg.Subject?.name}
                                                &nbsp;|&nbsp; 🎯 {asg.max_marks} marks
                                            </p>
                                            {asg.reference_file_url && (
                                                <div style={{ marginTop: 8 }}>
                                                    <a href={resolveFileUrl(asg.reference_file_url)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, background: '#eff6ff', border: '1px solid #bfdbfe', padding: '4px 8px', borderRadius: 6, fontWeight: 600 }}>
                                                        📎 View Reference File
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                        <CountdownBadge dueDate={asg.due_date} />
                                    </div>

                                    {/* Stats Row */}
                                    {asg.stats && asg.status !== 'draft' && (
                                        <div className="fa-asg-stats">
                                            <div className="fa-mini-stat">
                                                <span className="fa-mini-val">{asg.stats.total_students}</span>
                                                <span className="fa-mini-lbl">Students</span>
                                            </div>
                                            <div className="fa-mini-stat">
                                                <span className="fa-mini-val">{asg.stats.total_submissions}</span>
                                                <span className="fa-mini-lbl">Submitted</span>
                                            </div>
                                            <div className="fa-mini-stat orange">
                                                <span className="fa-mini-val">{asg.stats.pending_grading}</span>
                                                <span className="fa-mini-lbl">Ungraded</span>
                                            </div>
                                            <div className="fa-mini-stat green">
                                                <span className="fa-mini-val">{asg.stats.graded}</span>
                                                <span className="fa-mini-lbl">Graded</span>
                                            </div>
                                            <div className="fa-mini-stat red">
                                                <span className="fa-mini-val">{asg.stats.late}</span>
                                                <span className="fa-mini-lbl">Late</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="fa-due-info">
                                        Due: {new Date(asg.due_date).toLocaleString()}
                                    </div>

                                    <div className="fa-asg-actions">
                                        {asg.status !== 'draft' && (
                                            <button className="btn btn-sm btn-primary" onClick={() => openSubmissions(asg)}>
                                                📋 View Submissions
                                            </button>
                                        )}
                                        {asg.status === 'draft' && (
                                            <button className="btn btn-sm btn-success" onClick={() => handlePublish(asg.id)}>
                                                📢 Publish
                                            </button>
                                        )}
                                        {asg.status === 'published' && (
                                            <button className="btn btn-sm btn-warning" onClick={() => handleClose(asg.id)}>
                                                🔒 Close
                                            </button>
                                        )}
                                        {asg.status === 'draft' && (
                                            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(asg.id)}>
                                                🗑 Delete
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════ */}
            {/* CREATE FORM */}
            {/* ══════════════════════════════════════════════════ */}
            {view === 'create' && (
                <div className="card" style={{ maxWidth: 760, margin: '0 auto' }}>
                    <h2 style={{ marginBottom: 24, fontSize: 20 }}>📝 Create New Assignment</h2>
                    <form onSubmit={handleCreate}>
                        <div className="form-group">
                            <label className="form-label">Title *</label>
                            <input className="form-input" name="title" value={form.title} onChange={handleFormChange} required placeholder="Assignment title..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description / Instructions</label>
                            <textarea className="form-textarea" name="description" value={form.description} onChange={handleFormChange} rows={4} placeholder="Detailed instructions for students..." />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div className="form-group">
                                <label className="form-label">Class *</label>
                                <select className="form-select" name="class_id" value={form.class_id} onChange={handleFormChange} required>
                                    <option value="">Select Class</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Subject *</label>
                                <select className="form-select" name="subject_id" value={form.subject_id} onChange={handleFormChange} required disabled={!form.class_id}>
                                    <option value="">Select Subject</option>
                                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div className="form-group">
                                <label className="form-label">Due Date & Time *</label>
                                <input className="form-input" type="datetime-local" name="due_date" value={form.due_date} onChange={handleFormChange} required min={new Date(Date.now() + 3600000).toISOString().slice(0, 16)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Max Marks *</label>
                                <input className="form-input" type="number" name="max_marks" value={form.max_marks} onChange={handleFormChange} min={1} max={500} required />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div className="form-group">
                                <label className="form-label">Max File Size (MB)</label>
                                <input className="form-input" type="number" name="max_file_size_mb" value={form.max_file_size_mb} onChange={handleFormChange} min={1} max={50} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Save As</label>
                                <select className="form-select" name="status" value={form.status} onChange={handleFormChange}>
                                    <option value="draft">Draft (save privately)</option>
                                    <option value="published">Publish (visible to students)</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="fa-checkbox-label">
                                <input type="checkbox" name="allow_late_submission" checked={form.allow_late_submission} onChange={handleFormChange} />
                                Allow late submission
                            </label>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Reference File (Optional)</label>
                            <input type="file" className="form-input" accept=".pdf,.docx,.doc,.zip,.jpg,.png" onChange={e => setReferenceFile(e.target.files[0])} />
                            <span style={{ fontSize: 12, color: '#6b7280' }}>PDF, DOCX, ZIP, Image accepted (max 50 MB)</span>
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                            <button type="submit" className="btn btn-primary" disabled={submitting}>
                                {submitting ? 'Creating...' : '✅ Create Assignment'}
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={() => { setView('list'); resetForm(); }}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ══════════════════════════════════════════════════ */}
            {/* SUBMISSIONS VIEW */}
            {/* ══════════════════════════════════════════════════ */}
            {view === 'submissions' && selected && (
                <div>
                    {/* Assignment Info Header */}
                    <div className="card fa-submission-header">
                        <div>
                            <h2>{selected.title}</h2>
                            <p className="fa-asg-meta">📚 {selected.Class?.name} | 📖 {selected.Subject?.name} | 🎯 {selected.max_marks} marks</p>
                            <p className="fa-asg-meta">Due: {new Date(selected.due_date).toLocaleString()}</p>
                            {selected.reference_file_url && (
                                <a href={resolveFileUrl(selected.reference_file_url)} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, background: '#eff6ff', border: '1px solid #bfdbfe', padding: '4px 10px', borderRadius: 6, fontWeight: 600, marginTop: 8 }}>
                                    📎 View Reference File
                                </a>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <StatusBadge status={selected.status} />
                            {selected.status === 'published' && (
                                <button className="btn btn-sm btn-warning" onClick={() => handleClose(selected.id)}>
                                    🔒 Close Assignment
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Submissions Stats Mini */}
                    <div className="fa-stats-row" style={{ marginBottom: 0 }}>
                        {[
                            { label: 'Total Students', value: submissions.length, color: '#6b7280' },
                            { label: 'Submitted', value: submissions.filter(s => s.status !== 'pending').length, color: '#2563eb' },
                            { label: 'Pending Grading', value: submissions.filter(s => ['submitted', 'late', 'resubmit_requested'].includes(s.status)).length, color: '#d97706' },
                            { label: 'Graded', value: submissions.filter(s => s.status === 'graded').length, color: '#16a34a' },
                            { label: 'Not Submitted', value: submissions.filter(s => s.status === 'pending').length, color: '#dc2626' },
                        ].map(s => <StatCard key={s.label} icon="•" label={s.label} value={s.value} color={s.color} />)}
                    </div>

                    {/* Submissions Table */}
                    <div className="card">
                        <div className="table-container">
                            <table className="table mobile-keep">
                                <thead>
                                    <tr>
                                        <th>Student</th>
                                        <th>Status</th>
                                        <th>Submitted At</th>
                                        <th>File</th>
                                        <th>Marks / Grade</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {submissions.map(sub => (
                                        <tr key={sub.id} className={sub.is_late ? 'fa-late-row' : ''}>
                                            <td>
                                                <strong>{sub.Student?.User?.name}</strong>
                                                {sub.is_late && <span className="fa-late-badge">LATE +{sub.late_by_minutes}m</span>}
                                            </td>
                                            <td><StatusBadge status={sub.status} type="submission" /></td>
                                            <td>{sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : '—'}</td>
                                            <td>
                                                {sub.submission_file_url ? (
                                                    <a href={resolveFileUrl(sub.submission_file_url)} target="_blank" rel="noreferrer" className="fa-file-link">
                                                        📥 {sub.submission_file_name || 'Download'} {sub.submission_file_size_kb ? `(${sub.submission_file_size_kb} KB)` : ''}
                                                    </a>
                                                ) : '—'}
                                            </td>
                                            <td>
                                                {sub.status === 'graded' ? (
                                                    <span style={{ fontWeight: 600 }}>
                                                        {sub.marks_obtained}/{selected.max_marks}
                                                        <span className="fa-grade-badge">{sub.grade}</span>
                                                    </span>
                                                ) : '—'}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                    {['submitted', 'late', 'resubmit_requested', 'graded'].includes(sub.status) && (
                                                        <button
                                                            className="btn btn-sm btn-primary"
                                                            onClick={() => { setGradingTarget(sub); setGradeForm({ marks_obtained: sub.marks_obtained || '', feedback: sub.feedback || '' }); }}
                                                        >
                                                            {sub.status === 'graded' ? '✏️ Edit Grade' : '🎯 Grade'}
                                                        </button>
                                                    )}
                                                    {['submitted', 'late', 'graded'].includes(sub.status) && (
                                                        <button className="btn btn-sm btn-warning" onClick={() => setShowResubmitModal(sub)}>
                                                            🔄 Request Resubmit
                                                        </button>
                                                    )}
                                                </div>
                                                {sub.resubmit_reason && (
                                                    <div className="fa-resubmit-reason">💬 {sub.resubmit_reason}</div>
                                                )}
                                                {sub.status === 'graded' && sub.feedback && (
                                                    <div className="fa-feedback-preview">📝 {sub.feedback}</div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ── GRADE MODAL ── */}
            {gradingTarget && selected && (
                <div className="fa-modal-overlay" onClick={() => setGradingTarget(null)}>
                    <div className="fa-modal" onClick={e => e.stopPropagation()}>
                        <div className="fa-modal-header">
                            <h3>🎯 Grade Submission</h3>
                            <button className="fa-modal-close" onClick={() => setGradingTarget(null)}>✕</button>
                        </div>
                        <div className="fa-modal-body">
                            <p><strong>Student:</strong> {gradingTarget.Student?.User?.name}</p>
                            <p><strong>Assignment:</strong> {selected.title} ({selected.max_marks} marks)</p>
                            {gradingTarget.submission_file_url && (
                                <a href={resolveFileUrl(gradingTarget.submission_file_url)} target="_blank" rel="noreferrer" className="fa-file-link" style={{ display: 'inline-block', marginBottom: 16 }}>
                                    📥 View Submission
                                </a>
                            )}
                            <div className="form-group">
                                <label className="form-label">Marks Obtained (out of {selected.max_marks}) *</label>
                                <input className="form-input" type="number" min={0} max={selected.max_marks} step="0.5"
                                    value={gradeForm.marks_obtained} onChange={e => setGradeForm(p => ({ ...p, marks_obtained: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Feedback (optional)</label>
                                <textarea className="form-textarea" rows={3} value={gradeForm.feedback}
                                    onChange={e => setGradeForm(p => ({ ...p, feedback: e.target.value }))}
                                    placeholder="Write feedback for the student..." />
                            </div>
                        </div>
                        <div className="fa-modal-footer">
                            <button className="btn btn-secondary" onClick={() => setGradingTarget(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleGrade}>✅ Save Grade</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── RESUBMIT MODAL ── */}
            {showResubmitModal && (
                <div className="fa-modal-overlay" onClick={() => setShowResubmitModal(null)}>
                    <div className="fa-modal" onClick={e => e.stopPropagation()}>
                        <div className="fa-modal-header">
                            <h3>🔄 Request Resubmission</h3>
                            <button className="fa-modal-close" onClick={() => setShowResubmitModal(null)}>✕</button>
                        </div>
                        <div className="fa-modal-body">
                            <p>Request <strong>{showResubmitModal.Student?.User?.name}</strong> to resubmit their assignment.</p>
                            <div className="form-group">
                                <label className="form-label">Reason for Resubmission</label>
                                <textarea className="form-textarea" rows={3} value={resubmitForm.resubmit_reason}
                                    onChange={e => setResubmitForm(p => ({ ...p, resubmit_reason: e.target.value }))}
                                    placeholder="Explain what needs to be improved..." />
                            </div>
                        </div>
                        <div className="fa-modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowResubmitModal(null)}>Cancel</button>
                            <button className="btn btn-warning" onClick={handleRequestResubmit}>Send Request</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
