/**
 * Student Assignments — Phase 9 Professional Dashboard
 * 4-tab view: Pending / Submitted / Graded / All
 * With countdown, late detection, file upload, and resubmit
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import BackButton from '../../components/common/BackButton';
import { resolveFileUrl } from '../../utils/resolveUrl';
import { downloadRemoteFile } from '../../utils/capacitorPermissions';
import { toast } from 'react-hot-toast';
import '../faculty/Assignments.css';
import '../admin/Dashboard.css';

const SUB_STATUS_CONFIG = {
    pending: { label: 'Not Submitted', color: '#6b7280', bg: '#f3f4f6', icon: '⏳' },
    submitted: { label: 'Submitted', color: '#2563eb', bg: '#eff6ff', icon: '📩' },
    late: { label: 'Late Submitted', color: '#d97706', bg: '#fef3c7', icon: '⚠️' },
    graded: { label: 'Graded', color: '#16a34a', bg: '#f0fdf4', icon: '✅' },
    resubmit_requested: { label: 'Resubmit Required', color: '#7c3aed', bg: '#f5f3ff', icon: '🔄' },
};

function StatusBadge({ status }) {
    const cfg = SUB_STATUS_CONFIG[status];
    if (!cfg) return null;
    return <span className="fa-badge" style={{ background: cfg.bg, color: cfg.color }}>{cfg.icon} {cfg.label}</span>;
}

function CountdownBadge({ dueDate, overdue }) {
    if (overdue) return <span className="fa-countdown overdue">⛔ Overdue</span>;
    const due = new Date(dueDate);
    const now = new Date();
    const diff = due - now;
    if (diff <= 0) return <span className="fa-countdown overdue">⛔ Overdue</span>;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return <span className="fa-countdown ok">🕒 {days}d left</span>;
    if (hours > 0) return <span className="fa-countdown warning">⚠️ {hours}h left</span>;
    return <span className="fa-countdown danger">🔴 &lt;1h left</span>;
}

function GradeCircle({ marks, maxMarks }) {
    const pct = maxMarks > 0 ? Math.round((marks / maxMarks) * 100) : 0;
    const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#2563eb' : pct >= 40 ? '#d97706' : '#dc2626';
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0' }}>
            <div style={{ textAlign: 'center' }}>
                <div className="sa-grade-big" style={{ color }}>{marks}/{maxMarks}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Score</div>
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{pct}%</span>
                </div>
                <div className="sa-grade-bar-wrap">
                    <div className="sa-grade-bar" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
                </div>
            </div>
        </div>
    );
}

export default function StudentAssignments() {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('pending');
    const [detailAsg, setDetailAsg] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [file, setFile] = useState(null);
    const [msg, setMsg] = useState(null);

    const flash = (text, type = 'success') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 3500); };

    const fetchAssignments = useCallback(async () => {
        try {
            setLoading(true);
            
            // Clear unread assignments count so dashboard badge disappears
            api.post('/students/clear-unread-assignments').catch(() => {});
            
            const res = await api.get('/assignments/student/all');
            setAssignments(res.data.assignments || []);
        } catch (e) {
            flash('Failed to load assignments: ' + (e.response?.data?.message || e.message), 'error');
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

    const openDetail = async (asg) => {
        try {
            const res = await api.get(`/assignments/student/${asg.id}`);
            setDetailAsg(res.data.assignment);
            setFile(null);
        } catch (e) { flash('Failed to load details', 'error'); }
    };

    const handleSubmit = async () => {
        if (!file) return flash('Please select a file first', 'error');
        setUploading(true);
        const fd = new FormData();
        fd.append('submission_file', file);
        try {
            const isResubmit = detailAsg?.my_submission?.status === 'resubmit_requested';
            const url = isResubmit
                ? `/assignments/student/${detailAsg.id}/resubmit`
                : `/assignments/student/${detailAsg.id}/submit`;
            const method = isResubmit ? 'patch' : 'post';
            await api[method](url, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            flash(isResubmit ? 'Resubmitted successfully!' : 'Assignment submitted successfully!');
            setFile(null);
            await fetchAssignments();
            const updRes = await api.get(`/assignments/student/${detailAsg.id}`);
            setDetailAsg(updRes.data.assignment);
        } catch (e) {
            flash('Submission failed: ' + (e.response?.data?.message || e.message), 'error');
        } finally { setUploading(false); }
    };

    // Tab classification
    const pending   = assignments.filter(a => !a.my_submission || a.my_submission?.status === 'pending');
    const submitted = assignments.filter(a => a.my_submission && ['submitted', 'late'].includes(a.my_submission.status));
    const graded    = assignments.filter(a => a.my_submission?.status === 'graded');
    const resubmit  = assignments.filter(a => a.my_submission?.status === 'resubmit_requested');

    const TAB_LIST = [
        { key: 'pending',   label: 'Pending',    list: pending,   icon: '⏳', color: '#d97706' },
        { key: 'submitted', label: 'Submitted',   list: submitted, icon: '📩', color: '#2563eb' },
        { key: 'graded',    label: 'Graded',      list: graded,    icon: '✅', color: '#16a34a' },
        { key: 'resubmit',  label: 'Resubmit',    list: resubmit,  icon: '🔄', color: '#7c3aed' },
        { key: 'all',       label: 'All',          list: assignments, icon: '📚', color: '#6b7280' },
    ];

    const currentList = TAB_LIST.find(t => t.key === activeTab)?.list || [];

    // Border color by status
    const cardClass = (a) => {
        if (!a.my_submission || a.my_submission.status === 'pending') return a.is_overdue ? 'sa-overdue-header' : '';
        if (a.my_submission.status === 'graded') return 'sa-graded-header';
        if (a.my_submission.status === 'resubmit_requested') return 'sa-resubmit-header';
        return 'sa-submitted-header';
    };

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
            {msg && <div className={`fa-flash ${msg.type}`}>{msg.type === 'success' ? '✅' : '❌'} {msg.text}</div>}

            <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1>📝 My Assignments</h1>
                    <p>View, submit, and track your assignment submissions</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    {detailAsg && (
                        <button className="animated-btn secondary" onClick={() => setDetailAsg(null)}>
                            <span className="icon">←</span> Back to List
                        </button>
                    )}
                    <BackButton to="/student/dashboard" />
                </div>
            </div>

            {/* ── STATISTICS ROW ── */}
            {!detailAsg && (
                <div className="fa-stats-row">
                    <div className="fa-stat-card" style={{ borderTopColor: '#d97706' }}>
                        <div className="fa-stat-icon">⏳</div>
                        <div><div className="fa-stat-value" style={{ color: '#d97706' }}>{pending.length}</div><div className="fa-stat-label">Pending</div></div>
                    </div>
                    <div className="fa-stat-card" style={{ borderTopColor: '#7c3aed' }}>
                        <div className="fa-stat-icon">🔄</div>
                        <div><div className="fa-stat-value" style={{ color: '#7c3aed' }}>{resubmit.length}</div><div className="fa-stat-label">Resubmit Required</div></div>
                    </div>
                    <div className="fa-stat-card" style={{ borderTopColor: '#2563eb' }}>
                        <div className="fa-stat-icon">📩</div>
                        <div><div className="fa-stat-value" style={{ color: '#2563eb' }}>{submitted.length}</div><div className="fa-stat-label">Awaiting Grade</div></div>
                    </div>
                    <div className="fa-stat-card" style={{ borderTopColor: '#16a34a' }}>
                        <div className="fa-stat-icon">✅</div>
                        <div><div className="fa-stat-value" style={{ color: '#16a34a' }}>{graded.length}</div><div className="fa-stat-label">Graded</div></div>
                    </div>
                </div>
            )}

            {/* ── DETAIL VIEW ── */}
            {detailAsg && (
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                        <div>
                            <h2 style={{ margin: '0 0 6px' }}>{detailAsg.title}</h2>
                            <p className="fa-asg-meta">📚 {detailAsg.Class?.name} | 📖 {detailAsg.Subject?.name} | 👨‍🏫 {detailAsg.faculty?.name}</p>
                            <p className="fa-asg-meta">Due: {new Date(detailAsg.due_date).toLocaleString()} | 🎯 {detailAsg.max_marks} marks</p>
                        </div>
                        <StatusBadge status={detailAsg.my_submission?.status || 'pending'} />
                    </div>

                    {detailAsg.description && (
                        <div style={{ background: 'var(--bg-secondary, #f9fafb)', borderRadius: 8, padding: '16px 18px', marginBottom: 20 }}>
                            <strong style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>📋 Instructions</strong>
                            <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.6 }}>{detailAsg.description}</p>
                        </div>
                    )}

                    {detailAsg.reference_file_url && (
                        <div style={{ marginBottom: 20 }}>
                            <button
                                onClick={async () => {
                                    const fileUrl = resolveFileUrl(detailAsg.reference_file_url);
                                    const urlParts = detailAsg.reference_file_url?.split('/') || [];
                                    const rawFileName = urlParts[urlParts.length - 1] || `${detailAsg.title}.pdf`;
                                    const safeFileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
                                    
                                    toast.loading("Downloading...", { id: "dl-ref" });
                                    await downloadRemoteFile(fileUrl, safeFileName);
                                    toast.dismiss("dl-ref");
                                }}
                                className="btn btn-secondary"
                            >
                                📥 Download Reference File
                            </button>
                        </div>
                    )}

                    {/* GRADED VIEW */}
                    {detailAsg.my_submission?.status === 'graded' && (
                        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: '20px', marginBottom: 20 }}>
                            <strong style={{ color: '#15803d', display: 'block', marginBottom: 8 }}>🏆 Your Result</strong>
                            <GradeCircle marks={detailAsg.my_submission.marks_obtained} maxMarks={detailAsg.max_marks} />
                            <div style={{ fontSize: 32, fontWeight: 800, color: '#15803d', marginBottom: 4 }}>
                                Grade: {detailAsg.my_submission.grade}
                            </div>
                            {detailAsg.my_submission.feedback && (
                                <div style={{ marginTop: 12 }}>
                                    <strong style={{ fontSize: 13, color: '#374151' }}>Teacher Feedback:</strong>
                                    <p style={{ margin: '6px 0 0', color: '#374151', fontSize: 14, fontStyle: 'italic' }}>{detailAsg.my_submission.feedback}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* RESUBMIT REQUEST VIEW */}
                    {detailAsg.my_submission?.status === 'resubmit_requested' && (
                        <div style={{ background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
                            <strong style={{ color: '#7c3aed' }}>🔄 Resubmission Required</strong>
                            {detailAsg.my_submission.resubmit_reason && (
                                <p style={{ margin: '8px 0 0', fontSize: 14, color: '#374151' }}>
                                    <strong>Reason:</strong> {detailAsg.my_submission.resubmit_reason}
                                </p>
                            )}
                        </div>
                    )}

                    {/* SUBMITTED VIEW */}
                    {['submitted', 'late'].includes(detailAsg.my_submission?.status) && (
                        <div style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
                            <strong style={{ color: '#2563eb' }}>📩 Submitted — Awaiting Grade</strong>
                            {detailAsg.my_submission.is_late && (
                                <p style={{ margin: '4px 0 0', color: '#d97706', fontSize: 13 }}>
                                    ⚠️ Late by {Math.floor(detailAsg.my_submission.late_by_minutes / 60)}h {detailAsg.my_submission.late_by_minutes % 60}m
                                </p>
                            )}
                            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#374151' }}>
                                Submitted on: {new Date(detailAsg.my_submission.submitted_at).toLocaleString()}
                            </p>
                        </div>
                    )}

                    {/* UPLOAD SECTION (pending or resubmit) */}
                    {(!detailAsg.my_submission || detailAsg.my_submission.status === 'pending' || detailAsg.my_submission.status === 'resubmit_requested') && (
                        <div>
                            {detailAsg.is_overdue && !detailAsg.allow_late_submission ? (
                                <div className="fa-badge" style={{ background: '#fee2e2', color: '#991b1b', fontSize: 14, padding: '10px 16px' }}>
                                    ⛔ This assignment is closed. No more submissions accepted.
                                </div>
                            ) : (
                                <div>
                                    {detailAsg.is_overdue && (
                                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
                                            ⚠️ This assignment is overdue. Late submission may be penalized.
                                        </div>
                                    )}
                                    <div className="sa-upload-area" onClick={() => document.getElementById('file-inp').click()}>
                                        <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                                        <div style={{ fontSize: 15, fontWeight: 600, color: '#374151' }}>
                                            {file ? file.name : 'Click to select your submission file'}
                                        </div>
                                        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                                            PDF, DOCX, ZIP, Image accepted · Max {detailAsg.max_file_size_mb || 10} MB
                                        </div>
                                        <input
                                            id="file-inp" type="file" style={{ display: 'none' }}
                                            accept=".pdf,.docx,.doc,.zip,.jpg,.png"
                                            onChange={e => setFile(e.target.files[0])}
                                        />
                                    </div>
                                    {file && (
                                        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                                            <button className="btn btn-primary" onClick={handleSubmit} disabled={uploading}>
                                                {uploading ? 'Uploading...' : detailAsg.my_submission?.status === 'resubmit_requested' ? '🔄 Resubmit' : '📤 Submit Assignment'}
                                            </button>
                                            <button className="btn btn-secondary" onClick={() => setFile(null)}>Cancel</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Submission History */}
                    {detailAsg.my_submission?.history?.length > 0 && (
                        <div style={{ marginTop: 20 }}>
                            <strong style={{ fontSize: 14, color: '#374151', display: 'block', marginBottom: 8 }}>📁 Submission History (Attempt {detailAsg.my_submission.attempt_number - 1})</strong>
                            {detailAsg.my_submission.history.map((h, i) => (
                                <div key={i} style={{ fontSize: 13, color: '#6b7280', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                                    Attempt #{h.attempt_number} — {new Date(h.submitted_at).toLocaleString()}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── LIST VIEW ── */}
            {!detailAsg && (
                <div className="card">
                    <div className="fa-filter-tabs">
                        {TAB_LIST.map(t => (
                            <button
                                key={t.key}
                                className={`fa-tab ${activeTab === t.key ? 'active' : ''}`}
                                onClick={() => setActiveTab(t.key)}
                                style={activeTab === t.key ? { background: t.color, borderColor: t.color } : {}}
                            >
                                {t.icon} {t.label} ({t.list.length})
                            </button>
                        ))}
                    </div>

                    <div className="fa-assignment-list">
                        {currentList.length === 0 ? (
                            <div className="fa-empty">
                                <div style={{ fontSize: 48 }}>🎉</div>
                                <p>{activeTab === 'pending' ? 'No pending assignments!' : 'Nothing here.'}</p>
                            </div>
                        ) : (
                            currentList.map(asg => (
                                <div key={asg.id} className={`sa-assignment-card ${cardClass(asg)}`}>
                                    <div className="sa-header">
                                        <div>
                                            <StatusBadge status={asg.my_submission?.status || 'pending'} />
                                            <h3 className="sa-title">{asg.title}</h3>
                                            <p className="fa-asg-meta">📚 {asg.Class?.name} | 📖 {asg.Subject?.name} | 👨‍🏫 {asg.faculty?.name}</p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            {!asg.my_submission && <CountdownBadge dueDate={asg.due_date} overdue={asg.is_overdue} />}
                                            {asg.my_submission?.status === 'graded' && (
                                                <div style={{ fontWeight: 700, color: '#16a34a' }}>
                                                    {asg.my_submission.marks_obtained}/{asg.max_marks}
                                                    <span className="fa-grade-badge">{asg.my_submission.grade}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="fa-due-info">
                                        Due: {new Date(asg.due_date).toLocaleString()}
                                        {asg.my_submission?.is_late && <span className="fa-late-badge">LATE</span>}
                                    </div>
                                    <div style={{ marginTop: 10 }}>
                                        <button className="btn btn-sm btn-primary" onClick={() => openDetail(asg)}>
                                            {asg.my_submission?.status === 'pending' && !asg.is_overdue ? '📤 Submit' :
                                             asg.my_submission?.status === 'resubmit_requested' ? '🔄 Resubmit' :
                                             asg.my_submission?.status === 'graded' ? '📊 View Grade' : '📋 View Details'}
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
