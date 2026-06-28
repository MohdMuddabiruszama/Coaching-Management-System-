/**
 * Admin Assignments — Phase 8 Professional Dashboard
 * Stats overview, filter by class/subject/faculty, export, overdue & pending-grading views
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { resolveFileUrl } from '../../utils/resolveUrl';
import '../faculty/Assignments.css';
import './AdminAssignments.css';
import './AdminAssignmentsDetail.css';
import './Dashboard.css';
import './Students.css';

const DocumentIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
);
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
);
const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
);
const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
);
const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
);
const FilterClearIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
);
const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
);
const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
);
const ClipboardCheckIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><polyline points="9 14 11 16 15 12"></polyline></svg>
);
const HourglassIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 22h14"></path><path d="M5 2h14"></path><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"></path><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"></path></svg>
);
const CheckSquareIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
);
const AlertTriangleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
);
const TrendingUpIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
);
const UsersIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
);
const UploadIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
);
const UserMinusIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="23" y1="11" x2="17" y2="11"></line></svg>
);
const AttachmentIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
);
const MoreVerticalIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
);

const STATUS_CONFIG = {
    draft: { label: 'Draft', color: '#6b7280', bg: '#f3f4f6', icon: '✏️' },
    published: { label: 'Published', color: '#2563eb', bg: '#eff6ff', icon: '📢' },
    closed: { label: 'Closed', color: '#dc2626', bg: '#fee2e2', icon: '🔒' },
};
const SUB_STATUS_CONFIG = {
    pending: { label: 'Not Submitted', color: '#6b7280', bg: '#f3f4f6' },
    submitted: { label: 'Submitted', color: '#2563eb', bg: '#eff6ff' },
    late: { label: 'Late', color: '#d97706', bg: '#fef3c7' },
    graded: { label: 'Graded', color: '#16a34a', bg: '#f0fdf4' },
    resubmit_requested: { label: 'Resubmit Req.', color: '#7c3aed', bg: '#f5f3ff' },
};

function Badge({ status, type = 'assignment' }) {
    const cfg = type === 'sub' ? SUB_STATUS_CONFIG[status] : STATUS_CONFIG[status];
    if (!cfg) return null;
    return <span className="fa-badge" style={{ background: cfg.bg, color: cfg.color }}>{cfg.icon || ''} {cfg.label}</span>;
}

function StatCard({ icon, label, value, colorClass, sub }) {
    return (
        <div className="aa-stat-card">
            <div className={`aa-stat-icon-wrapper aa-stat-${colorClass}`}>
                {icon}
            </div>
            <div className="aa-stat-content">
                <div className="aa-stat-value">{value}</div>
                <div className="aa-stat-label">{label}</div>
                {sub && <div className="aa-stat-sublabel">{sub}</div>}
            </div>
        </div>
    );
}

function SkeletonLoader() {
    return (
        <div className="students-container" style={{ animation: 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>
            <div className="dashboard-header" style={{ border: 'none', paddingBottom: 0 }}>
                <div>
                    <div style={{ height: '36px', width: '300px', backgroundColor: 'var(--border-color, #e5e7eb)', borderRadius: '8px', marginBottom: '10px' }}></div>
                    <div style={{ height: '16px', width: '400px', backgroundColor: 'var(--border-color, #e5e7eb)', borderRadius: '4px' }}></div>
                </div>
            </div>

            <div className="fa-stats-row" style={{ marginTop: '24px' }}>
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="fa-stat-card" style={{ height: '110px', backgroundColor: 'var(--card-bg, #ffffff)', borderColor: 'var(--border-color, #e5e7eb)', borderTopWidth: '4px', borderTopStyle: 'solid' }}>
                        <div style={{ height: '28px', width: '50%', backgroundColor: 'var(--border-color, #e5e7eb)', borderRadius: '6px', marginTop: '12px' }}></div>
                        <div style={{ height: '16px', width: '70%', backgroundColor: 'var(--border-color, #e5e7eb)', borderRadius: '4px', marginTop: '16px' }}></div>
                    </div>
                ))}
            </div>

            <div className="card" style={{ marginTop: '24px' }}>
                <div style={{ padding: '20px', display: 'flex', gap: '15px' }}>
                    <div style={{ height: '40px', flex: 2, backgroundColor: 'var(--border-color, #e5e7eb)', borderRadius: '8px' }}></div>
                    <div style={{ height: '40px', flex: 1, backgroundColor: 'var(--border-color, #e5e7eb)', borderRadius: '8px' }}></div>
                    <div style={{ height: '40px', flex: 1, backgroundColor: 'var(--border-color, #e5e7eb)', borderRadius: '8px' }}></div>
                </div>
                <div className="table-container">
                    <table className="table">
                        <tbody>
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <tr key={i}>
                                    <td style={{ padding: '16px' }}><div style={{ height: '20px', width: '80%', backgroundColor: 'var(--border-color, #e5e7eb)', borderRadius: '4px' }}></div></td>
                                    <td><div style={{ height: '20px', width: '60%', backgroundColor: 'var(--border-color, #e5e7eb)', borderRadius: '4px' }}></div></td>
                                    <td><div style={{ height: '20px', width: '50%', backgroundColor: 'var(--border-color, #e5e7eb)', borderRadius: '4px' }}></div></td>
                                    <td><div style={{ height: '20px', width: '70%', backgroundColor: 'var(--border-color, #e5e7eb)', borderRadius: '4px' }}></div></td>
                                    <td><div style={{ height: '30px', width: '90px', backgroundColor: 'var(--border-color, #e5e7eb)', borderRadius: '15px' }}></div></td>
                                    <td><div style={{ height: '32px', width: '120px', backgroundColor: 'var(--border-color, #e5e7eb)', borderRadius: '6px' }}></div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <style>{`
                @keyframes pulse-glow {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
            `}</style>
        </div>
    );
}

export default function AdminAssignments() {
    const [view, setView] = useState('list');   // list | detail | overdue | pending
    const [assignments, setAssignments] = useState([]);
    const [stats, setStats] = useState({});
    const [selected, setSelected] = useState(null);
    const [submissions, setSubmissions] = useState([]);
    const [pending, setPending] = useState([]);
    const [overdue, setOverdue] = useState([]);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [faculty, setFaculty] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [msg, setMsg] = useState(null);

    const [filters, setFilters] = useState({ status: 'all', class_id: '', subject_id: '', faculty_id: '', q: '' });
    const [detailTab, setDetailTab] = useState('all');

    const flash = (text, type = 'success') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 3000); };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (filters.status !== 'all') params.status = filters.status;
            if (filters.class_id) params.class_id = filters.class_id;
            if (filters.subject_id) params.subject_id = filters.subject_id;
            if (filters.faculty_id) params.faculty_id = filters.faculty_id;

            const [asgRes, statsRes, classRes, facRes] = await Promise.all([
                api.get('/assignments/admin/all', { params }),
                api.get('/assignments/admin/stats'),
                api.get('/classes'),
                api.get('/faculty'),
            ]);
            setAssignments(asgRes.data.assignments || []);
            setStats(statsRes.data.stats || {});
            setClasses(classRes.data.data || []);
            setFaculty(facRes.data.data || []);
        } catch (e) { flash('Failed to load data', 'error'); }
        finally { setLoading(false); }
    }, [filters]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const openDetail = async (asg) => {
        try {
            const [asgRes, subRes] = await Promise.all([
                api.get(`/assignments/${asg.id}`),
                api.get(`/assignments/${asg.id}/submissions`)
            ]);
            setSelected(asgRes.data.assignment);
            setSubmissions(subRes.data.submissions || []);
            setView('detail');
        } catch { flash('Failed to load', 'error'); }
    };

    const handleExport = async () => {
        if (view === 'detail' && selected) {
            try {
                // Client-side export for specific assignment submissions (0 API calls, O(N) complexity)
                const rows = [['Student Name', 'Status', 'Submitted At', 'Attempt', 'Marks', 'Grade']];
                submissions.forEach(sub => {
                    rows.push([
                        sub.Student?.User?.name || 'Unknown',
                        sub.status,
                        sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : 'Not Submitted',
                        sub.attempt_number || 0,
                        sub.marks_obtained !== null ? `${sub.marks_obtained} / ${selected.max_marks}` : '—',
                        sub.grade || '—'
                    ]);
                });
                
                const csvContent = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `${selected.title.replace(/\s+/g, '_')}_Submissions.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                flash('Submissions exported successfully!');
            } catch (err) {
                flash('Failed to export submissions', 'error');
            }
            return;
        }

        // Export all assignments via API when in list view
        setExporting(true);
        try {
            const res = await api.get('/assignments/admin/export', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'assignments-report.csv';
            a.click();
            window.URL.revokeObjectURL(url);
            flash('Exported successfully!');
        } catch { flash('Export failed', 'error'); }
        finally { setExporting(false); }
    };

    const handleCloseAssignment = async (id) => {
        if (!window.confirm('Close this assignment?')) return;
        try {
            await api.patch(`/assignments/${id}/close`);
            flash('Assignment closed.');
            const updRes = await api.get(`/assignments/${id}`);
            setSelected(updRes.data.assignment);
            fetchData();
        } catch (e) { flash(e.response?.data?.message || 'Failed', 'error'); }
    };

    const handleDeleteAssignment = async (id) => {
        if (!window.confirm('Delete this assignment permanently? This will remove all student submissions. This action cannot be undone.')) return;
        try {
            await api.delete(`/assignments/${id}`);
            flash('Assignment deleted successfully.');
            if (selected && selected.id === id) {
                setView('list');
                setSelected(null);
            }
            fetchData();
        } catch (e) { flash(e.response?.data?.message || 'Delete failed', 'error'); }
    };

    const filteredList = assignments.filter(a => {
        if (filters.status !== 'all' && a.status !== filters.status) return false;
        if (filters.class_id && a.class_id?.toString() !== filters.class_id && a.Class?.id?.toString() !== filters.class_id) return false;
        if (filters.faculty_id && a.faculty_id?.toString() !== filters.faculty_id && a.faculty?.id?.toString() !== filters.faculty_id) return false;
        if (!filters.q) return true;
        const q = filters.q.toLowerCase();
        return a.title?.toLowerCase().includes(q) || a.Class?.name?.toLowerCase().includes(q) || a.Subject?.name?.toLowerCase().includes(q) || a.faculty?.name?.toLowerCase().includes(q);
    });

    if (loading) {
        return <SkeletonLoader />;
    }

    return (
        <div className="students-container admin-assignments-wrapper">
            {msg && <div className={`fa-flash ${msg.type}`} style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: 'white', padding: '16px 24px', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>{msg.type === 'success' ? '✅' : '❌'} {msg.text}</div>}

            <div className="st-header">
                <div className="st-header-top-row">
                    <div className="st-header-left">
                        {view === 'list' ? (
                            <h1>Assignments Overview</h1>
                        ) : (
                            <h1>{selected?.title || 'Assignment Details'}</h1>
                        )}
                        <p>
                            {view === 'list' ? 'Monitor all assignments across the institute' : 'Detailed performance tracking and assignment review'}
                        </p>
                    </div>
                </div>
                
                <div className="st-header-bottom-row">
                    <div className="st-breadcrumbs">
                        <span>Dashboard</span>
                        <span>›</span>
                        <span className="active">{view === 'list' ? 'Assignments Overview' : 'Assignment Details'}</span>
                    </div>
                    {view === 'list' ? (
                        <div className="st-header-actions">
                            <button className="st-btn st-btn-outline" onClick={handleExport} disabled={exporting} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <DownloadIcon /> {exporting ? 'Exporting...' : 'Export CSV'}
                            </button>
                            <button className="st-btn st-btn-primary" onClick={() => window.location.href = '/admin/assignments/create'} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                + Add Assignment
                            </button>
                        </div>
                    ) : (
                        <div className="st-header-actions">
                            <button className="st-btn st-btn-outline" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <DownloadIcon /> Export CSV
                            </button>
                            <button className="st-btn st-btn-outline" onClick={() => setView('list')}>
                                ← Back to Overview
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Stats Row */}
            {view === 'list' && (
                <div className="aa-stats-grid">
                    <StatCard icon={<ClipboardCheckIcon />} label="Total Assignments" value={stats.total_assignments || 0} colorClass="purple" sub="All time" />
                    <StatCard icon={<HourglassIcon />} label="Pending Grading" value={stats.pending_grading || 0} colorClass="orange" sub="Awaiting teacher review" />
                    <StatCard icon={<CheckSquareIcon />} label="Graded" value={stats.graded_submissions || 0} colorClass="green" sub="Completed" />
                    <StatCard icon={<AlertTriangleIcon />} label="Late Submissions" value={stats.late_submissions || 0} colorClass="red" sub="Submitted late" />
                    <StatCard icon={<TrendingUpIcon />} label="Average Score" value={stats.avg_score ? `${stats.avg_score}%` : '—'} colorClass="blue" sub="Across all assignments" />
                </div>
            )}

            {/* ══════════════════════════════════════════════════ */}
            {/* LIST VIEW */}
            {view === 'list' && (
                <>
                    {/* Filter Bar */}
                    <div className="aa-filter-container">
                        <div className="aa-search-input">
                            <SearchIcon />
                            <input
                                placeholder="Search by title, class, subject, faculty..."
                                value={filters.q}
                                onChange={e => setFilters(p => ({ ...p, q: e.target.value }))}
                            />
                        </div>
                        <select className="aa-select-input" value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}>
                            <option value="all">All Status</option>
                            <option value="published">Published</option>
                            <option value="draft">Draft</option>
                            <option value="closed">Closed</option>
                        </select>
                        <select className="aa-select-input" value={filters.class_id} onChange={e => setFilters(p => ({ ...p, class_id: e.target.value }))}>
                            <option value="">All Classes</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section ? c.section : ''}</option>)}
                        </select>
                        <select className="aa-select-input" value={filters.faculty_id} onChange={e => setFilters(p => ({ ...p, faculty_id: e.target.value }))}>
                            <option value="">All Faculty</option>
                            {faculty.map(f => <option key={f.id} value={f.id}>{f.User?.name || f.name}</option>)}
                        </select>
                        <button className="aa-btn-clear" onClick={() => setFilters({ status: 'all', class_id: '', subject_id: '', faculty_id: '', q: '' })}>
                            <FilterClearIcon /> Clear
                        </button>
                    </div>

                    <div className="aa-table-card">
                        <div className="aa-table-header">
                            <h3 className="aa-table-title">All Assignments ({filteredList.length})</h3>
                            <div className="aa-table-controls">
                                <div className="aa-sort-select">
                                    Sort by:
                                    <select>
                                        <option>Due Date (Newest)</option>
                                        <option>Due Date (Oldest)</option>
                                    </select>
                                </div>
                                <div className="aa-view-toggles">
                                    <button className="aa-view-btn active"><ListIcon /></button>
                                    <button className="aa-view-btn"><GridIcon /></button>
                                </div>
                            </div>
                        </div>
                        <table className="aa-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Title</th>
                                    <th>Class / Subject</th>
                                    <th>Faculty</th>
                                    <th>Due Date</th>
                                    <th>Status</th>
                                    <th>Submissions</th>
                                    <th>Avg Score</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredList.length === 0 ? (
                                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: '#A0AEC0' }}>No assignments found</td></tr>
                                ) : (
                                    filteredList.map((asg, index) => {
                                        const initials = asg.faculty?.name?.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase() || 'F';
                                        return (
                                        <tr key={asg.id}>
                                            <td style={{ fontWeight: 600, color: '#1A202C' }}>{index + 1}</td>
                                            <td>
                                                <div className="aa-cell-title">
                                                    <div className="aa-icon-doc"><DocumentIcon /></div>
                                                    <span className="aa-title-text">{asg.title}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="aa-cell-class">
                                                    <span className="aa-class-text">{asg.Class?.name} /</span>
                                                    <span className="aa-subject-text">{asg.Subject?.name}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="aa-cell-faculty">
                                                    <div className="aa-avatar">{initials}</div>
                                                    <span className="aa-faculty-name">{asg.faculty?.name}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="aa-cell-date">
                                                    <span className="aa-date-text">{new Date(asg.due_date).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'})}</span>
                                                    {new Date() > new Date(asg.due_date) && asg.status === 'published' && (
                                                        <span className="aa-badge-overdue">OVERDUE</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <div className={`aa-status-dot ${asg.status}`}>
                                                    {asg.status.charAt(0).toUpperCase() + asg.status.slice(1)}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="aa-cell-submissions">
                                                    <span><span className="aa-sub-count">{asg.submissions_count || 0}</span> / {asg.total_students || 0}</span>
                                                    {(asg.graded_count > 0) && <span className="aa-graded-badge">☑ {asg.graded_count}</span>}
                                                </div>
                                            </td>
                                            <td className="aa-cell-score">{asg.avg_score ? `${asg.avg_score}%` : '—'}</td>
                                            <td>
                                                <div className="aa-cell-actions">
                                                    <button className="aa-action-btn view" onClick={() => openDetail(asg)}>
                                                        <EyeIcon /> View
                                                    </button>
                                                    {asg.status === 'published' && (
                                                        <button className="aa-action-btn close" onClick={() => handleCloseAssignment(asg.id)}>
                                                            <LockIcon /> Close
                                                        </button>
                                                    )}
                                                    <button className="aa-action-btn delete" onClick={() => handleDeleteAssignment(asg.id)}>
                                                        <TrashIcon />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )})
                                )}
                            </tbody>
                        </table>
                        <div className="aa-table-footer">
                            <span>Showing 1 to {filteredList.length} of {filteredList.length} entries</span>
                            <div className="aa-pagination">
                                <button className="aa-page-btn">&lt;</button>
                                <button className="aa-page-btn active">1</button>
                                <button className="aa-page-btn">&gt;</button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* ══════════════════════════════════════════════════ */}
            {/* DETAIL VIEW */}
            {view === 'detail' && selected && (
                <div>
                    {/* Header Banner */}
                    <div className="aa-detail-header">
                        <div>
                            <div className="aa-detail-title-wrapper">
                                <h2>{selected.title}</h2>
                                <span className="aa-status-pill graded" style={{ fontSize: '0.7rem' }}>
                                    {selected.status.charAt(0).toUpperCase() + selected.status.slice(1)}
                                </span>
                            </div>
                            <p className="aa-detail-meta">
                                📚 {selected.Class?.name} &nbsp;•&nbsp; 📖 {selected.Subject?.name} &nbsp;•&nbsp; 👨‍🏫 <strong>{selected.faculty?.name}</strong>
                            </p>
                            <p className="aa-detail-meta">
                                📅 Due: {new Date(selected.due_date).toLocaleString('en-GB', {day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'})} &nbsp;•&nbsp; 🎯 {selected.max_marks} Marks
                            </p>
                        </div>
                        <div className="aa-detail-actions">
                            {selected.reference_file_url && (
                                <a href={resolveFileUrl(selected.reference_file_url)} target="_blank" rel="noreferrer" className="aa-btn-outline">
                                    <AttachmentIcon /> View Reference File
                                </a>
                            )}
                            {selected.status === 'published' && (
                                <button className="aa-btn-primary" style={{ backgroundColor: '#DD6B20' }} onClick={() => handleCloseAssignment(selected.id)}>
                                    <LockIcon /> Close Assignment
                                </button>
                            )}
                            <button className="aa-btn-primary" style={{ backgroundColor: '#E53E3E' }} onClick={() => handleDeleteAssignment(selected.id)}>
                                <TrashIcon /> Delete
                            </button>
                        </div>
                    </div>

                    {/* Mini Stats */}
                    <div className="aa-mini-stats">
                        {[
                            { label: 'Total Students', value: submissions.length, colorClass: 'purple', icon: <UsersIcon /> },
                            { label: 'Submitted', value: submissions.filter(s => s.status !== 'pending').length, colorClass: 'black', icon: <UploadIcon /> },
                            { label: 'Pending Grading', value: submissions.filter(s => ['submitted', 'late', 'resubmit_requested'].includes(s.status)).length, colorClass: 'orange', icon: <HourglassIcon /> },
                            { label: 'Graded', value: submissions.filter(s => s.status === 'graded').length, colorClass: 'green', icon: <CheckSquareIcon /> },
                            { label: 'Not Submitted', value: submissions.filter(s => s.status === 'pending').length, colorClass: 'grey', icon: <UserMinusIcon /> },
                        ].map((s, idx) => (
                            <div className="aa-mini-stat-card" key={idx}>
                                <div className={`aa-mini-icon-wrapper ${s.colorClass}`}>{s.icon}</div>
                                <div className="aa-mini-stat-info">
                                    <span className="aa-mini-stat-value">{s.value}</span>
                                    <span className="aa-mini-stat-label">{s.label}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Tabs */}
                    <div className="aa-tabs-container">
                        <button className={`aa-tab ${detailTab === 'all' ? 'active' : ''}`} onClick={() => setDetailTab('all')}>
                            Submissions
                        </button>
                        <button className={`aa-tab ${detailTab === 'pending' ? 'active' : ''}`} onClick={() => setDetailTab('pending')}>
                            Pending Grading ({submissions.filter(s => ['submitted', 'late', 'resubmit_requested'].includes(s.status)).length})
                        </button>
                        <button className={`aa-tab ${detailTab === 'graded' ? 'active' : ''}`} onClick={() => setDetailTab('graded')}>
                            Graded ({submissions.filter(s => s.status === 'graded').length})
                        </button>
                        <button className={`aa-tab ${detailTab === 'not_submitted' ? 'active' : ''}`} onClick={() => setDetailTab('not_submitted')}>
                            Not Submitted ({submissions.filter(s => s.status === 'pending').length})
                        </button>
                    </div>

                    {/* Table */}
                    <div className="aa-table-card">
                        <table className="aa-table">
                            <thead>
                                <tr>
                                    <th>Student Name</th>
                                    <th>Status</th>
                                    <th>Submitted At</th>
                                    <th>Attempt</th>
                                    <th>Marks</th>
                                    <th>Grade</th>
                                    <th>File</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {submissions
                                    .filter(sub => {
                                        if (detailTab === 'pending') return ['submitted', 'late', 'resubmit_requested'].includes(sub.status);
                                        if (detailTab === 'graded') return sub.status === 'graded';
                                        if (detailTab === 'not_submitted') return sub.status === 'pending';
                                        return true; // 'all'
                                    })
                                    .map(sub => {
                                        const initials = sub.Student?.User?.name?.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase() || 'S';
                                        let badgeClass = 'not_submitted';
                                        let badgeText = 'Not Submitted';
                                        if (sub.status === 'graded') { badgeClass = 'graded'; badgeText = 'Graded'; }
                                        else if (['submitted', 'resubmit_requested'].includes(sub.status)) { badgeClass = 'pending'; badgeText = 'Pending'; }
                                        
                                        let gradeClass = 'aa-grade-default';
                                        if (sub.grade === 'A+' || sub.grade === 'A') gradeClass = 'aa-grade-A';
                                        else if (sub.grade === 'B') gradeClass = 'aa-grade-B';
                                        else if (sub.grade === 'C') gradeClass = 'aa-grade-C';
                                        else if (sub.grade === 'F') gradeClass = 'aa-grade-F';

                                        return (
                                        <tr key={sub.id}>
                                            <td>
                                                <div className="aa-cell-faculty" style={{ color: '#1A202C', fontWeight: 600 }}>
                                                    <div className="aa-avatar" style={{ background: '#EBF8FF', color: '#3182CE' }}>{initials}</div>
                                                    <span>{sub.Student?.User?.name}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <span className={`aa-status-pill ${badgeClass}`}>{badgeText}</span>
                                                    {sub.is_late && <span className="aa-status-pill late" style={{ padding: '2px 8px', fontSize: '0.65rem' }}>Late</span>}
                                                </div>
                                            </td>
                                            <td style={{ color: '#4A5568' }}>{sub.submitted_at ? new Date(sub.submitted_at).toLocaleString('en-GB', {day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '—'}</td>
                                            <td style={{ color: '#4A5568' }}>{sub.attempt_number > 0 ? `#${sub.attempt_number}` : '—'}</td>
                                            <td style={{ color: '#4A5568' }}>{sub.marks_obtained !== null ? `${sub.marks_obtained} / ${selected.max_marks}` : '—'}</td>
                                            <td className={gradeClass}>{sub.grade ?? '—'}</td>
                                            <td>
                                                {sub.submission_file_url ? (
                                                    <a href={resolveFileUrl(sub.submission_file_url)} target="_blank" rel="noreferrer" className="aa-file-download">
                                                        <AttachmentIcon /> Download
                                                    </a>
                                                ) : '—'}
                                            </td>
                                            <td>
                                                <button className="aa-btn-outline" style={{ padding: '6px', border: 'none', background: '#F7FAFC' }}>
                                                    <MoreVerticalIcon />
                                                </button>
                                            </td>
                                        </tr>
                                    )})}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════ */}
            {/* PENDING GRADING VIEW */}
            {view === 'pending' && (
                <div className="card">
                    <h2 style={{ marginBottom: 16 }}>⏳ Pending Grading — All Ungraded Submissions</h2>
                    {pending.length === 0 ? (
                        <div className="fa-empty"><div style={{ fontSize: 48 }}>🎉</div><p>No submissions pending grading!</p></div>
                    ) : (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr><th>Student</th><th>Assignment</th><th>Class</th><th>Subject</th><th>Status</th><th>Submitted At</th><th>File</th></tr>
                                </thead>
                                <tbody>
                                    {pending.map(sub => (
                                        <tr key={sub.id}>
                                            <td><strong>{sub.Student?.User?.name}</strong></td>
                                            <td>{sub.Assignment?.title}</td>
                                            <td>{sub.Assignment?.Class?.name}</td>
                                            <td>{sub.Assignment?.Subject?.name}</td>
                                            <td><Badge status={sub.status} type="sub" /></td>
                                            <td>{sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : '—'}</td>
                                            <td>
                                                {sub.submission_file_url ? (
                                                    <a href={resolveFileUrl(sub.submission_file_url)} target="_blank" rel="noreferrer" className="fa-file-link">📥 View</a>
                                                ) : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════ */}
            {/* OVERDUE VIEW */}
            {view === 'overdue' && (
                <div>
                    {overdue.length === 0 ? (
                        <div className="card fa-empty"><div style={{ fontSize: 48 }}>🎉</div><p>No overdue assignments!</p></div>
                    ) : (
                        overdue.map((item, idx) => (
                            <div className="card" key={idx} style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <div>
                                        <h3 style={{ margin: 0 }}>{item.assignment.title}</h3>
                                        <p className="fa-asg-meta">{item.assignment.class_name} | {item.assignment.subject_name} | Due {new Date(item.assignment.due_date).toLocaleDateString()}</p>
                                    </div>
                                    <span className="fa-badge" style={{ background: '#fee2e2', color: '#991b1b', fontSize: 14 }}>
                                        ⛔ {item.count} Not Submitted
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {item.overdue_students.map(s => (
                                        <span key={s.id} style={{ background: '#f3f4f6', padding: '4px 10px', borderRadius: 20, fontSize: 12 }}>
                                            {s.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
