import { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import BackButton from '../../components/common/BackButton';
import { resolveFileUrl } from '../../utils/resolveUrl';
import { downloadRemoteFile } from '../../utils/capacitorPermissions';
import { toast } from 'react-hot-toast';
import { advanceStudentAssignmentsBadge } from '../../hooks/useStudentBadges';
import { AuthContext } from '../../context/AuthContext';
import './StudentAssignmentsV2.css';
import '../admin/Dashboard.css';
import '../admin/Students.css';

const SUB_STATUS_CONFIG = {
    pending: { label: 'Pending', icon: '⏳', badgeClass: 'badge-pending', cardClass: 'status-pending' },
    submitted: { label: 'Submitted', icon: '📩', badgeClass: 'badge-submitted', cardClass: 'status-submitted' },
    late: { label: 'Late Submitted', icon: '⚠️', badgeClass: 'badge-late', cardClass: 'status-late' },
    graded: { label: 'Graded', icon: '✓', badgeClass: 'badge-graded', cardClass: 'status-graded' },
    resubmit_requested: { label: 'Resubmit Required', icon: '🔄', badgeClass: 'badge-resubmit', cardClass: 'status-resubmit' },
};

function StatusBadgeV2({ status }) {
    const cfg = SUB_STATUS_CONFIG[status] || SUB_STATUS_CONFIG['pending'];
    return (
        <div className={`asg-v2-badge ${cfg.badgeClass}`}>
            {cfg.label}
        </div>
    );
}

function DaysLeftBadge({ dueDate, overdue }) {
    if (overdue) return <span className="asg-v3-deadline-pill">Overdue</span>;
    const due = new Date(dueDate);
    const now = new Date();
    const diff = due - now;
    if (diff <= 0) return <span className="asg-v3-deadline-pill">Overdue</span>;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return <span className="asg-v3-deadline-pill">In {days}d {hours % 24}h</span>;
    if (hours > 0) return <span className="asg-v3-deadline-pill">In {hours}h</span>;
    return <span className="asg-v3-deadline-pill">{'<'}1h left</span>;
}

function MiniCalendar({ assignments }) {
    const [currentDate, setCurrentDate] = useState(new Date());

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    // Determine due dates and their status colors for the current month
    const dueDates = useMemo(() => {
        const dates = new Map();
        assignments.forEach(a => {
            if (a.due_date) {
                const d = new Date(a.due_date);
                if (d.getFullYear() === year && d.getMonth() === month) {
                    const day = d.getDate();
                    const status = a.my_submission?.status || 'pending';
                    
                    let color = 'green';
                    if (status === 'pending' || status === 'resubmit_requested') color = 'red';
                    else if (status === 'submitted' || status === 'late') color = 'orange';

                    const existing = dates.get(day);
                    if (!existing || color === 'red' || (color === 'orange' && existing === 'green')) {
                        dates.set(day, color);
                    }
                }
            }
        });
        return dates;
    }, [assignments, year, month]);

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

    const blanks = Array.from({ length: firstDay }, (_, i) => <div key={`blank-${i}`} />);
    const days = Array.from({ length: daysInMonth }, (_, i) => {
        const dayNum = i + 1;
        const isToday = isCurrentMonth && today.getDate() === dayNum;
        const dueColor = dueDates.get(dayNum);
        
        let className = "asg-v3-cal-day";
        if (isToday) className += " active";
        if (dueColor && !isToday) className += ` has-due-${dueColor}`;

        return (
            <div key={dayNum} className={className}>
                {dayNum}
            </div>
        );
    });

    return (
        <div className="asg-v3-calendar">
            <div className="asg-v3-cal-header">
                📅 Calendar
            </div>
            <div className="asg-v3-cal-nav">
                <button onClick={prevMonth}>{'<'}</button>
                <span>{monthNames[month]} {year}</span>
                <button onClick={nextMonth}>{'>'}</button>
            </div>
            <div className="asg-v3-cal-grid">
                {dayNames.map(d => <div key={d} className="asg-v3-cal-day-name">{d}</div>)}
                {blanks}
                {days}
            </div>
        </div>
    );
}

function UpcomingDeadlines({ pendingAssignments }) {
    // Sort pending assignments by closest due date (show all pending even if past due)
    const sorted = [...pendingAssignments]
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
        .slice(0, 3); // Take top 3

    return (
        <div className="asg-v3-deadlines">
            <div className="asg-v3-deadlines-header">
                ⏳ Upcoming Deadlines
            </div>
            {sorted.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: '#64748b', textAlign: 'center', padding: '10px 0' }}>No upcoming deadlines!</div>
            ) : (
                sorted.map(a => (
                    <div key={a.id} className="asg-v3-deadline-item">
                        <div className="asg-v3-deadline-title">{a.title}</div>
                        <div className="asg-v3-deadline-meta">{a.Subject?.name} • Class {a.Class?.name?.replace('Class ', '')}</div>
                        <div className="asg-v3-deadline-time">
                            📅 {new Date(a.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            <DaysLeftBadge dueDate={a.due_date} />
                        </div>
                    </div>
                ))
            )}
            <a href="#" className="asg-v3-view-all">View All Assignments {'>'}</a>
        </div>
    );
}

function GradeCircle({ marks, maxMarks }) {
    const pct = maxMarks > 0 ? Math.round((marks / maxMarks) * 100) : 0;
    const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#2563eb' : pct >= 40 ? '#d97706' : '#dc2626';
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color }}>{marks}/{maxMarks}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Score</div>
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{pct}%</span>
                </div>
                <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}88)`, height: '100%' }} />
                </div>
            </div>
        </div>
    );
}

export default function StudentAssignments() {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    const [sortFilter, setSortFilter] = useState('newest');
    const [detailAsg, setDetailAsg] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [file, setFile] = useState(null);
    const [msg, setMsg] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const flash = (text, type = 'success') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 3500); };

    const fetchAssignments = useCallback(async () => {
        try {
            setLoading(true);
            api.post('/students/clear-unread-assignments').catch(() => {});
            const res = await api.get('/assignments/student/all');
            const asgList = res.data.assignments || [];
            setAssignments(asgList);
            
            if (user?.id) {
                const pendingCount = asgList.filter(a => !a.my_submission || a.my_submission?.status === 'pending').length;
                advanceStudentAssignmentsBadge(user.id, pendingCount);
            }
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
            window.scrollTo({ top: 0, behavior: 'smooth' });
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
        { key: 'all',       label: 'All',          list: assignments, icon: '▦' },
        { key: 'pending',   label: 'Pending',    list: pending,   icon: '⏳' },
        { key: 'submitted', label: 'Submitted',   list: submitted, icon: '📤' },
        { key: 'graded',    label: 'Graded',      list: graded,    icon: '✓' },
        { key: 'resubmit',  label: 'Resubmit',    list: resubmit,  icon: '🔄' },
    ];

    let currentList = TAB_LIST.find(t => t.key === activeTab)?.list || [];

    // Apply sorting
    currentList = [...currentList].sort((a, b) => {
        if (sortFilter === 'newest') {
            return new Date(b.created_at || b.due_date) - new Date(a.created_at || a.due_date);
        } else if (sortFilter === 'oldest') {
            return new Date(a.created_at || a.due_date) - new Date(b.created_at || b.due_date);
        } else if (sortFilter === 'due_date') {
            return new Date(a.due_date) - new Date(b.due_date);
        }
        return 0;
    });

    const formatDateTime = (dateString) => {
        const d = new Date(dateString);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    // Helper for time left string format
    const getTimeLeftStr = (dueDate) => {
        const diff = new Date(dueDate) - new Date();
        if (diff <= 0) return 'Overdue';
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        if (days > 0) return `${days}d ${hours % 24}h left`;
        return `${hours}h left`;
    };

    if (loading) {
        return (
            <div className="asg-v2-container" style={{ padding: '4rem', textAlign: 'center' }}>
                <p style={{ color: '#64748b' }}>Loading assignments...</p>
            </div>
        );
    }

    return (
        <div className="asg-v2-container">
            {msg && <div style={{ background: msg.type === 'success' ? '#dcfce7' : '#fee2e2', color: msg.type === 'success' ? '#16a34a' : '#dc2626', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
                {msg.type === 'success' ? '✅' : '❌'} {msg.text}
            </div>}

            {/* ── HEADER ── */}
            {!isMobile && (
                <div className="asg-v2-header">
                    <div className="asg-v2-header-left" style={{ justifyContent: 'flex-start' }}>
                        {/* Clipboard Icon */}
                        <div className="asg-v2-header-icon" style={{ margin: 0 }}>
                            📋
                        </div>
                        
                        {/* Titles */}
                        <div className="asg-v2-header-titles" style={{ textAlign: 'left' }}>
                            <h1>My Assignments</h1>
                            <p>View, submit, and track your assignment submissions</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Mobile Hero Banner ── */}
            {isMobile && (
                <div className="asg-v2-hero-banner">
                    <div className="asg-v2-hero-left">
                        <div className="asg-v2-hero-icon-wrapper">
                            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10 9 9 9 8 9"></polyline>
                            </svg>
                        </div>
                        <div className="asg-v2-hero-text">
                            <h2>My Assignments</h2>
                            <p>Track your assignment submissions</p>
                        </div>
                    </div>
                    <div className="asg-v2-hero-right">
                        <div className="asg-v2-hero-graphic">
                            📝<span>★</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ── DETAIL VIEW ── */}
            {detailAsg && (
                <div className="asg-v2-detail-card" style={{ marginBottom: 24 }}>
                    <div className="asg-v2-detail-header">
                        <div>
                            <div className="asg-v2-detail-title-row">
                                <h2 className="asg-v2-detail-title">{detailAsg.title}</h2>
                                <StatusBadgeV2 status={detailAsg.my_submission?.status || 'pending'} />
                            </div>
                            <div className="asg-v2-detail-meta">
                                <span style={{ color: '#22c55e' }}>📚 Class {detailAsg.Class?.name?.replace('Class ', '') || 'N/A'}</span>
                                <span className="asg-v2-divider">|</span>
                                <span style={{ color: '#3b82f6' }}>📖 {detailAsg.Subject?.name}</span>
                                <span className="asg-v2-divider">|</span>
                                <span>👤 {detailAsg.faculty?.name}</span>
                            </div>
                            <div className="asg-v2-detail-submeta">
                                <span>📅 Due: {formatDateTime(detailAsg.due_date)}</span>
                                <span style={{ color: '#e11d48' }}>🎯 {Number(detailAsg.max_marks)} marks</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            {(!detailAsg.my_submission || ['pending', 'late'].includes(detailAsg.my_submission.status)) && (
                                <div className="asg-v2-time-badge">
                                    <div className="asg-v2-time-val">
                                        ⏱ {getTimeLeftStr(detailAsg.due_date)}
                                    </div>
                                    <div className="asg-v2-time-label">Time Left</div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="asg-v2-two-col">
                        <div>
                            <div className="asg-v2-section-title">
                                <span style={{ color: '#7c3aed' }}>📑</span> Instructions
                            </div>
                            <div className="asg-v2-section-content">
                                {detailAsg.description ? detailAsg.description : "No instructions provided."}
                            </div>
                        </div>
                        <div>
                            <div className="asg-v2-section-title">
                                <span style={{ color: '#3b82f6' }}>📄</span> Reference File
                            </div>
                            <div className="asg-v2-section-content" style={{ marginBottom: '12px' }}>
                                Download the reference material before submitting.
                            </div>
                            {detailAsg.reference_file_url ? (
                                <button
                                    onClick={async () => {
                                        const fileUrl = resolveFileUrl(detailAsg.reference_file_url);
                                        const urlParts = detailAsg.reference_file_url?.split('/') || [];
                                        const safeFileName = (urlParts[urlParts.length - 1] || `${detailAsg.title}.pdf`).replace(/[^a-zA-Z0-9._-]/g, '_');
                                        toast.loading("Downloading...", { id: "dl-ref" });
                                        await downloadRemoteFile(fileUrl, safeFileName);
                                        toast.dismiss("dl-ref");
                                    }}
                                    className="asg-v2-btn-outline" style={{ padding: '8px 16px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                >
                                    📥 Download File
                                </button>
                            ) : (
                                <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>No reference file attached.</div>
                            )}
                        </div>
                    </div>

                    {/* UPLOAD SECTION */}
                    {(!detailAsg.my_submission || detailAsg.my_submission.status === 'pending' || detailAsg.my_submission.status === 'resubmit_requested') && (
                        <div>
                            {detailAsg.is_overdue && !detailAsg.allow_late_submission ? (
                                <div style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '0.9rem', padding: '12px 16px', borderRadius: '8px', textAlign: 'center' }}>
                                    ⛔ This assignment is closed. No more submissions accepted.
                                </div>
                            ) : (
                                <div className="asg-v2-upload-area" onClick={() => document.getElementById('file-inp').click()}>
                                    <div className="asg-v2-upload-left">
                                        <div className="asg-v2-upload-icon">☁️</div>
                                        <div className="asg-v2-upload-title">
                                            {detailAsg.my_submission?.status === 'resubmit_requested' ? 'Upload Your Resubmission' : 'Upload Your Submission'}
                                        </div>
                                        <div className="asg-v2-upload-sub">
                                            {file ? <span style={{ color: '#16a34a', fontWeight: 600 }}>{file.name}</span> : 'Drag & drop your file here or click to browse'}
                                        </div>
                                        <div className="asg-v2-upload-formats">
                                            PDF, DOCX, ZIP, Image accepted · Max {detailAsg.max_file_size_mb || 50} MB
                                        </div>
                                    </div>
                                    <input
                                        id="file-inp" type="file" style={{ display: 'none' }}
                                        accept=".pdf,.docx,.doc,.zip,.jpg,.png"
                                        onChange={e => setFile(e.target.files[0])}
                                    />
                                    <div className="asg-v2-upload-action" style={{ marginLeft: 'auto', paddingLeft: '24px' }}>
                                        {file ? (
                                            <button 
                                                style={{ 
                                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                                                    color: 'white', 
                                                    border: 'none', 
                                                    padding: '12px 24px', 
                                                    borderRadius: '12px', 
                                                    fontWeight: '600', 
                                                    cursor: uploading ? 'not-allowed' : 'pointer', 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    gap: '8px', 
                                                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                                                    transition: 'all 0.2s',
                                                    fontSize: '1rem'
                                                }} 
                                                onClick={(e) => { e.stopPropagation(); handleSubmit(); }} 
                                                disabled={uploading}
                                            >
                                                {uploading ? (
                                                    <>
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
                                                        Submitting...
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"></path><path d="M22 2L15 22 11 13 2 9 22 2z"></path></svg>
                                                        Submit Now
                                                    </>
                                                )}
                                            </button>
                                        ) : (
                                            <button 
                                                className="asg-v2-btn-purple" 
                                                onClick={(e) => { e.stopPropagation(); document.getElementById('file-inp').click(); }} 
                                                disabled={uploading}
                                                style={{ padding: '12px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: '600', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}
                                            >
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                                Choose File
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                            <div className="asg-v2-notice" style={{ marginTop: '16px', background: '#eff6ff', color: '#1d4ed8' }}>
                                ℹ Make sure your file is correct before submitting. You can only submit once.
                            </div>
                        </div>
                    )}

                    {/* GRADED SECTION */}
                    {detailAsg.my_submission?.status === 'graded' && (
                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '20px', marginTop: '24px' }}>
                            <strong style={{ color: '#16a34a', display: 'block', marginBottom: '8px' }}>🏆 Your Result</strong>
                            <GradeCircle marks={detailAsg.my_submission.marks_obtained} maxMarks={detailAsg.max_marks} />
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a', marginBottom: '4px' }}>
                                Grade: {detailAsg.my_submission.grade}
                            </div>
                            {detailAsg.my_submission.feedback && (
                                <div style={{ marginTop: '12px', background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #dcfce7' }}>
                                    <strong style={{ fontSize: '0.85rem', color: '#15803d' }}>Teacher Feedback:</strong>
                                    <p style={{ margin: '6px 0 0', color: '#166534', fontSize: '0.9rem', fontStyle: 'italic' }}>{detailAsg.my_submission.feedback}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── TWO COLUMN MAIN LAYOUT ── */}
            <div className="asg-v3-layout" style={{ display: detailAsg ? 'none' : 'grid' }}>
                
                {/* LEFT CONTENT */}
                <div className="asg-v3-left-col">
                    {/* ── STATISTICS ROW ── */}
                    <div className="asg-v2-stats-grid">
                        <div className="asg-v2-stat-card">
                            <div className="asg-v2-stat-top">
                                <div className="asg-v2-stat-icon asg-v2-bg-orange asg-v2-orange">⏳</div>
                                <div className="asg-v2-stat-value asg-v2-orange">{pending.length}</div>
                            </div>
                            <div className="asg-v2-stat-label">Pending</div>
                            <div className="asg-v2-stat-sub">Awaiting submission</div>
                        </div>
                        <div className="asg-v2-stat-card">
                            <div className="asg-v2-stat-top">
                                <div className="asg-v2-stat-icon asg-v2-bg-blue asg-v2-blue">🔄</div>
                                <div className="asg-v2-stat-value asg-v2-blue">{resubmit.length}</div>
                            </div>
                            <div className="asg-v2-stat-label">Resubmit Required</div>
                            <div className="asg-v2-stat-sub">Need resubmission</div>
                        </div>
                        <div className="asg-v2-stat-card">
                            <div className="asg-v2-stat-top">
                                <div className="asg-v2-stat-icon asg-v2-bg-purple asg-v2-purple">📥</div>
                                <div className="asg-v2-stat-value asg-v2-purple">{submitted.length}</div>
                            </div>
                            <div className="asg-v2-stat-label">Awaiting Grade</div>
                            <div className="asg-v2-stat-sub">Not yet graded</div>
                        </div>
                        <div className="asg-v2-stat-card">
                            <div className="asg-v2-stat-top">
                                <div className="asg-v2-stat-icon asg-v2-bg-green asg-v2-green">✓</div>
                                <div className="asg-v2-stat-value asg-v2-green">{graded.length}</div>
                            </div>
                            <div className="asg-v2-stat-label">Graded</div>
                            <div className="asg-v2-stat-sub">Completed</div>
                        </div>
                    </div>

                    {/* FILTER BAR */}
                    <div className="asg-v2-filter-bar">
                        {isMobile && <div style={{width: '100%', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px'}}>Filter</div>}
                        <div className="asg-v2-filter-tabs">
                            {TAB_LIST.map(t => (
                                <button
                                    key={t.key}
                                    className={`asg-v2-filter-btn ${activeTab === t.key ? 'active' : ''}`}
                                    onClick={() => setActiveTab(t.key)}
                                >
                                    {t.label} ({t.list.length})
                                </button>
                            ))}
                        </div>
                        <div className="asg-v2-sort-container">
                            {!isMobile && <span>Sort by: </span>}
                            <select className="asg-v2-sort-dropdown" value={sortFilter} onChange={(e) => setSortFilter(e.target.value)}>
                                <option value="newest">Latest Due Date</option>
                                <option value="oldest">Oldest First</option>
                            </select>
                        </div>
                    </div>

                    {/* NEW LIST VIEW (Phase 3 Cards) */}
                    <div className="asg-v3-list">
                        {currentList.length === 0 ? (
                            <div style={{ padding: '4rem', textAlign: 'center', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                                <p style={{ color: '#64748b', fontWeight: 500 }}>Nothing here!</p>
                            </div>
                        ) : (
                            currentList.map(asg => {
                                const status = asg.my_submission?.status || 'pending';
                                const isGraded = status === 'graded';
                                const isPending = status === 'pending';
                                
                                return (
                                    <div key={asg.id} className="asg-v3-card">
                                        {!isMobile && <div className="asg-v3-menu-dots">⋮</div>}
                                        
                                        {!isMobile && (
                                            <>
                                                {/* Left: Icon & Status Text */}
                                                <div className="asg-v3-card-left">
                                                    <div className="asg-v3-card-icon-box" style={{ background: isGraded ? '#dcfce7' : isPending ? '#ffedd5' : '#e0e7ff', color: isGraded ? '#16a34a' : isPending ? '#ea580c' : '#4f46e5' }}>
                                                        {isGraded ? '📄' : isPending ? '⏳' : '📥'}
                                                    </div>
                                                    <div style={{ marginTop: '8px', fontSize: '0.85rem', fontWeight: 600, color: '#475569', textAlign: 'center' }}>
                                                        {isGraded ? 'Graded' : isPending ? 'Pending' : 'Submitted'}
                                                    </div>
                                                </div>

                                                {/* Center: Content */}
                                                <div className="asg-v3-card-center" style={{ marginTop: '0px' }}>
                                                    <h3 className="asg-v3-title">{asg.title}</h3>
                                                    <div className="asg-v3-meta-row" style={{ flexWrap: 'wrap', marginBottom: '8px' }}>
                                                        <div className="asg-v3-meta-item">
                                                            <span style={{ color: '#3b82f6' }}>📚</span> Mathematics
                                                        </div>
                                                        <span className="asg-v3-meta-divider">|</span>
                                                        <div className="asg-v3-meta-item">
                                                            <span style={{ color: '#8b5cf6' }}>🎓</span> Class {asg.Class?.name?.replace('Class ', '') || '10'}
                                                        </div>
                                                        <span className="asg-v3-meta-divider">|</span>
                                                        <div className="asg-v3-meta-item">
                                                            👤 {asg.faculty?.name || 'Ritika Saha'}
                                                        </div>
                                                    </div>
                                                    <div className="asg-v3-meta-row" style={{ color: '#0f172a', flexWrap: 'wrap', margin: 0 }}>
                                                        <div className="asg-v3-meta-item">
                                                            📅 Due: {formatDateTime(asg.due_date)}
                                                        </div>
                                                        <div className="asg-v3-meta-item" style={{ marginLeft: '16px' }}>
                                                            <span style={{ color: '#e11d48' }}>🎯</span> {Number(asg.max_marks)} marks
                                                        </div>
                                                    </div>
                                                    <div className="asg-v3-desc">
                                                        {asg.description || 'Please prepare and submit before the due date.'}
                                                    </div>
                                                </div>

                                                {/* Right: Action Box */}
                                                <div className="asg-v3-card-right" style={{ background: isGraded ? '#f0fdf4' : isPending ? '#fff7ed' : '#f8fafc', border: `1px solid ${isGraded ? '#bbf7d0' : isPending ? '#ffedd5' : '#e2e8f0'}` }}>
                                                    {isGraded ? (
                                                        <div className="asg-v3-action-wrap" style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                                                            <div style={{ textAlign: 'center' }}>
                                                                <div className="asg-v3-action-label">Your Score</div>
                                                                <div className="asg-v3-action-value" style={{ color: '#16a34a' }}>
                                                                    {Number(asg.my_submission?.marks_obtained || 0)}/{Number(asg.max_marks)}
                                                                </div>
                                                            </div>
                                                            <button className="asg-v3-action-btn" style={{ color: '#16a34a', border: '1px solid #16a34a' }} onClick={() => openDetail(asg)}>
                                                                📈 View Result
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="asg-v3-action-wrap" style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                                                            <div style={{ textAlign: 'center' }}>
                                                                <div className="asg-v3-action-label">Time Left</div>
                                                                <div className="asg-v3-action-value" style={{ color: '#ea580c' }}>
                                                                    {getTimeLeftStr(asg.due_date)}
                                                                </div>
                                                            </div>
                                                            <button className="asg-v3-action-btn" style={{ color: '#4f46e5', border: '1px solid #e0e7ff', background: '#fff' }} onClick={() => openDetail(asg)}>
                                                                📤 Submit Now
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}

                                        {isMobile && (
                                            <>
                                                {/* Left: Icon & Badge & Title wrapper for mobile */}
                                                <div className="asg-v3-card-mobile-header" style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', width: '100%' }}>
                                                    <div className="asg-v3-card-icon-box" style={{ background: isGraded ? '#dcfce7' : isPending ? '#ffedd5' : '#e0e7ff', color: isGraded ? '#16a34a' : isPending ? '#ea580c' : '#4f46e5', flexShrink: 0 }}>
                                                        {isGraded ? '📄' : isPending ? '⏳' : '📥'}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                            <h3 className="asg-v3-title">{asg.title}</h3>
                                                            <StatusBadgeV2 status={status} />
                                                        </div>
                                                        <div className="asg-v3-meta-row" style={{ flexWrap: 'wrap', marginBottom: '8px' }}>
                                                            <div className="asg-v3-meta-item">
                                                                <span style={{ color: '#3b82f6' }}>📚</span> Mathematics
                                                            </div>
                                                            <span className="asg-v3-meta-divider">|</span>
                                                            <div className="asg-v3-meta-item">
                                                                <span style={{ color: '#8b5cf6' }}>🎓</span> Class {asg.Class?.name?.replace('Class ', '') || '10'}
                                                            </div>
                                                            <span className="asg-v3-meta-divider">|</span>
                                                            <div className="asg-v3-meta-item">
                                                                👤 {asg.faculty?.name || 'Ritika Saha'}
                                                            </div>
                                                        </div>
                                                        <div className="asg-v3-meta-row" style={{ color: '#0f172a', flexWrap: 'wrap', margin: 0 }}>
                                                            <div className="asg-v3-meta-item">
                                                                📅 Due: {formatDateTime(asg.due_date)}
                                                            </div>
                                                            <div className="asg-v3-meta-item">
                                                                <span style={{ color: '#e11d48' }}>🎯</span> {Number(asg.max_marks)} marks
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Center: Content (Description only for mobile) */}
                                                <div className="asg-v3-card-center" style={{ marginTop: '0px' }}>
                                                    <div className="asg-v3-desc">
                                                        {asg.description || 'Please prepare and submit before the due date.'}
                                                    </div>
                                                </div>

                                                {/* Right: Action Box */}
                                                <div className="asg-v3-card-right" style={{ background: isGraded ? '#f0fdf4' : isPending ? '#fff7ed' : '#f8fafc', border: `1px solid ${isGraded ? '#bbf7d0' : isPending ? '#ffedd5' : '#e2e8f0'}` }}>
                                                    {isGraded ? (
                                                        <div className="asg-v3-action-wrap">
                                                            <div>
                                                                <div className="asg-v3-action-label">Your Score</div>
                                                                <div className="asg-v3-action-value" style={{ color: '#16a34a' }}>
                                                                    {Number(asg.my_submission?.marks_obtained || 0)}/{Number(asg.max_marks)}
                                                                </div>
                                                            </div>
                                                            <button className="asg-v3-action-btn" style={{ color: '#16a34a', border: '1px solid #16a34a' }} onClick={() => openDetail(asg)}>
                                                                📈 View Result
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="asg-v3-action-wrap">
                                                            <div style={{ textAlign: 'left' }}>
                                                                <div className="asg-v3-action-label">Time Left</div>
                                                                <div className="asg-v3-action-value" style={{ color: '#ea580c' }}>
                                                                    {getTimeLeftStr(asg.due_date)}
                                                                </div>
                                                            </div>
                                                            <button className="asg-v3-action-btn" style={{ color: '#4f46e5', border: '1px solid #e0e7ff', background: '#fff' }} onClick={() => openDetail(asg)}>
                                                                📤 Submit Now
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* MOBILE CALENDAR & DEADLINES */}
                    {isMobile && (
                        <div className="asg-v3-sidebar-mobile">
                            <MiniCalendar assignments={assignments} />
                            <UpcomingDeadlines pendingAssignments={pending} />
                        </div>
                    )}

                    {/* Help Banner */}
                    <div className="asg-v3-help-banner">
                        <div className="asg-v3-help-left">
                            <div className="asg-v3-help-icon">ℹ</div>
                            <div>
                                <div className="asg-v3-help-title">Need Help with Assignments?</div>
                                <div className="asg-v3-help-sub">If you have any questions or face any issues, you can contact your teacher or use the subject chat.</div>
                            </div>
                        </div>
                        <button className="asg-v3-help-btn" onClick={() => navigate('/student/chat')}>
                            💬 Go to Subject Chat
                        </button>
                    </div>

                </div>

                {/* RIGHT SIDEBAR (Desktop) */}
                {!isMobile && (
                    <div className="asg-v3-sidebar">
                        <MiniCalendar assignments={assignments} />
                        <UpcomingDeadlines pendingAssignments={pending} />
                    </div>
                )}
            </div>
        </div>
    );
}
