import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import BackButton from '../../components/common/BackButton';
import './ParentAssignments.css';

// SVG Icons
const Icons = {
    DocCheck: () => <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 14l-4 4-2-2 1.41-1.41L12 17.17l2.59-2.58L16 16zm-3-9V3.5L18.5 9H13z"/></svg>,
    DocCross: () => <svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4" fill="currentColor"/><path d="M15 9l-6 6M9 9l6 6" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>,
    DocPending: () => <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-2 14v-4h2v4h-2zm0-6V7h2v3h-2zm1-7V3.5L18.5 9H13z"/></svg>,
    DocRefresh: () => <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM12 18c-2.21 0-4-1.79-4-4s1.79-4 4-4c1.1 0 2.1.45 2.82 1.18L13 13h5V8l-1.63 1.63C15.22 8.64 13.68 8 12 8c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.42 0 4.5-1.44 5.45-3.5h-2.14C14.47 17.39 13.33 18 12 18zM13 9V3.5L18.5 9H13z"/></svg>,
    Calendar: () => <svg viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/></svg>,
    ChatBubble: () => <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>,
    ChevronRight: () => <svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>,
};

const getSubjectIcon = (name) => {
    if (!name) return '📖';
    const n = name.toLowerCase();
    if (n.includes('math')) return '📗';
    if (n.includes('science')) return '👨‍🔬';
    return '📖';
};

export default function ParentAssignments() {
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingAsg, setLoadingAsg] = useState(false);
    const [filter, setFilter] = useState('all');
    const [msg, setMsg] = useState(null);

    const flash = (text, type = 'success') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 3000); };

    useEffect(() => {
        const fetchChildren = async () => {
            try {
                const res = await api.get('/parents/dashboard');
                const children = res.data.data?.students || [];
                setStudents(children);
                if (children.length > 0) {
                    setSelectedStudent(children[0]);
                }
            } catch (e) {
                flash('Failed to load children data', 'error');
            } finally { setLoading(false); }
        };
        fetchChildren();
    }, []);

    const fetchAssignments = useCallback(async (studentId) => {
        setLoadingAsg(true);
        try {
            const res = await api.get(`/assignments/parent/child/${studentId}`);
            setAssignments(res.data.assignments || []);
        } catch (e) {
            flash('Failed to load assignments', 'error');
        } finally { setLoadingAsg(false); }
    }, []);

    useEffect(() => {
        if (selectedStudent?.id) {
            setFilter('all'); // Reset filter when child changes
            fetchAssignments(selectedStudent.id);
        }
    }, [selectedStudent, fetchAssignments]);

    const pending  = assignments.filter(a => !a.my_submission || a.my_submission?.status === 'pending');
    const graded   = assignments.filter(a => a.my_submission?.status === 'graded');
    const submitted = assignments.filter(a => a.my_submission && ['submitted', 'late'].includes(a.my_submission.status));
    const resubmit = assignments.filter(a => a.my_submission?.status === 'resubmit_requested');

    const filteredAssignments = useMemo(() => {
        if (filter === 'pending') return pending;
        if (filter === 'graded') return graded;
        if (filter === 'awaiting') return submitted;
        if (filter === 'resubmit') return resubmit;
        return assignments;
    }, [assignments, filter, pending, graded, submitted, resubmit]);

    if (loading) {
        return (
            <div className="pa-container">
                <div style={{ textAlign: 'center', padding: '4rem' }}>
                    Loading...
                </div>
            </div>
        );
    }

    return (
        <div className="pa-container">
            {msg && <div style={{ padding: '12px', marginBottom: '16px', background: msg.type === 'success' ? '#dcfce7' : '#fee2e2', color: msg.type === 'success' ? '#16a34a' : '#dc2626', borderRadius: '8px' }}>{msg.text}</div>}

            {/* Student Selector Card */}
            {students.length > 0 && (
                <div className="pa-card">
                    <div className="pa-student-selector">
                        <div className="pa-student-selector-label">Select Child:</div>
                        {students.map(s => (
                            <button
                                key={s.id}
                                className={`pa-student-btn ${selectedStudent?.id === s.id ? 'active' : ''}`}
                                onClick={() => setSelectedStudent(s)}
                            >
                                <span style={{ marginRight: '6px' }}>👤</span> {s.User?.name || s.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {!selectedStudent && students.length === 0 && (
                <div className="pa-card">
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>👨‍👩‍👧</div>
                        <p style={{ color: '#64748b' }}>No children linked to your account. Contact the administrator.</p>
                    </div>
                </div>
            )}

            {selectedStudent && (
                <>
                    {/* Stats Grid */}
                    {!loadingAsg && (
                        <div className="pa-stats-grid">
                            <div className="pa-stat-card pa-stat-pending">
                                <div className="pa-stat-icon-wrapper" style={{ fontSize: '22px' }}>⏳</div>
                                <div className="pa-stat-content">
                                    <div className="pa-stat-value">{pending.length}</div>
                                    <div className="pa-stat-label">Pending</div>
                                    <div className="pa-stat-subtext">Not submitted yet</div>
                                </div>
                            </div>
                            <div className="pa-stat-card pa-stat-resubmit">
                                <div className="pa-stat-icon-wrapper" style={{ fontSize: '22px' }}>🔄</div>
                                <div className="pa-stat-content">
                                    <div className="pa-stat-value">{resubmit.length}</div>
                                    <div className="pa-stat-label">Needs Resubmit</div>
                                    <div className="pa-stat-subtext">Action required</div>
                                </div>
                            </div>
                            <div className="pa-stat-card pa-stat-awaiting">
                                <div className="pa-stat-icon-wrapper" style={{ fontSize: '22px' }}>📥</div>
                                <div className="pa-stat-content">
                                    <div className="pa-stat-value">{submitted.length}</div>
                                    <div className="pa-stat-label">Awaiting Grade</div>
                                    <div className="pa-stat-subtext">Under review</div>
                                </div>
                            </div>
                            <div className="pa-stat-card pa-stat-graded">
                                <div className="pa-stat-icon-wrapper" style={{ fontSize: '22px' }}>✅</div>
                                <div className="pa-stat-content">
                                    <div className="pa-stat-value">{graded.length}</div>
                                    <div className="pa-stat-label">Graded</div>
                                    <div className="pa-stat-subtext">Completed</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Assignments List */}
                    <div className="pa-assignments-card">
                        <div className="pa-assignments-header">
                            <div className="pa-assignments-title-group">
                                <div className="pa-assignments-icon" style={{ fontSize: '20px' }}>👤</div>
                                <h2>{selectedStudent.User?.name || selectedStudent.name}'s Assignments</h2>
                            </div>
                            <div className="pa-assignments-actions">
                                <select 
                                    className="pa-filter-dropdown" 
                                    value={filter} 
                                    onChange={(e) => setFilter(e.target.value)}
                                >
                                    <option value="all">All Assignments</option>
                                    <option value="pending">Pending</option>
                                    <option value="resubmit">Needs Resubmit</option>
                                    <option value="awaiting">Awaiting Grade</option>
                                    <option value="graded">Graded</option>
                                </select>
                                <span className="pa-total-count">{filteredAssignments.length} total</span>
                            </div>
                        </div>

                        {loadingAsg ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Loading assignments...</div>
                        ) : filteredAssignments.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No assignments found.</div>
                        ) : (
                            <div className="pa-assignment-list">
                                {filteredAssignments.map(asg => {
                                    const sub = asg.my_submission;
                                    const status = sub?.status || 'pending';
                                    
                                    let uiState = { icon: Icons.DocPending, cls: 'pending', badgeText: 'Not Submitted', badgeCls: 'pa-badge-pending' };
                                    if (status === 'graded') uiState = { icon: Icons.DocCheck, cls: 'graded', badgeText: 'Graded', badgeCls: 'pa-badge-graded' };
                                    else if (status === 'submitted' || status === 'late') uiState = { icon: Icons.DocCross, cls: 'awaiting', badgeText: 'Awaiting Grade', badgeCls: 'pa-badge-awaiting' }; // Using DocCross based on user's image 1 requirement
                                    else if (status === 'resubmit_requested') uiState = { icon: Icons.DocRefresh, cls: 'resubmit', badgeText: 'Resubmit', badgeCls: 'pa-badge-resubmit' };

                                    const pct = status === 'graded' ? Math.round((sub.marks_obtained / asg.max_marks) * 100) : 0;
                                    const scoreColor = pct >= 80 ? '#16a34a' : pct >= 60 ? '#2563eb' : pct >= 40 ? '#d97706' : '#dc2626';

                                    return (
                                        <div key={asg.id} className="pa-asg-item">
                                            <div className="pa-asg-main">
                                                <div className={`pa-asg-icon-large ${uiState.cls}`}>
                                                    <uiState.icon />
                                                </div>
                                                <div className="pa-asg-info">
                                                    <div className={`pa-asg-badge ${uiState.badgeCls}`}>{uiState.badgeText}</div>
                                                    <h3 className="pa-asg-title">{asg.title}</h3>
                                                    <div className="pa-asg-meta">
                                                        <div className="pa-asg-meta-item">📚 Class {asg.Class?.name}</div>
                                                        <span className="pa-asg-meta-divider">|</span>
                                                        <div className="pa-asg-meta-item" style={{ fontSize: '13px' }}>{getSubjectIcon(asg.Subject?.name)} {asg.Subject?.name}</div>
                                                        <span className="pa-asg-meta-divider">|</span>
                                                        <div className="pa-asg-meta-item">👤 {asg.faculty?.name || asg.faculty?.User?.name}</div>
                                                    </div>
                                                    <div className="pa-asg-dates">
                                                        <div className="due">📅 Due: {new Date(asg.due_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>
                                                        {sub?.submitted_at && <div className="due">📅 Submitted on: {new Date(sub.submitted_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pa-asg-metrics">
                                                {status === 'graded' ? (
                                                    <div className="pa-asg-metric-group">
                                                        <div className="pa-metric-label">Score</div>
                                                        <div><span className="pa-score-value" style={{ color: scoreColor }}>{sub.marks_obtained}</span> <span className="pa-score-total">/ {asg.max_marks}</span></div>
                                                        <div className="pa-progress-bar"><div className="pa-progress-fill" style={{ width: `${pct}%`, background: scoreColor }}></div></div>
                                                        <div className="pa-score-pct">{pct}%</div>
                                                    </div>
                                                ) : (
                                                    <div className="pa-asg-metric-group">
                                                        <div className="pa-metric-label">Status</div>
                                                        <div className="pa-status-badge">{status === 'pending' && asg.is_overdue ? 'Overdue' : status === 'pending' ? 'Not Started' : 'Under Review'}</div>
                                                        <div className="pa-status-text">{status === 'pending' && asg.is_overdue ? 'Past due date' : status === 'pending' ? 'Please submit soon' : 'Teacher is reviewing your submission'}</div>
                                                    </div>
                                                )}

                                                <div className="pa-asg-metric-group" style={{ minWidth: 80 }}>
                                                    <div className="pa-metric-label">Grade</div>
                                                    <div className={status === 'graded' ? 'pa-grade-value' : 'pa-score-total'} style={status === 'graded' ? { color: scoreColor } : {}}>
                                                        {status === 'graded' ? sub.grade || '-' : '-'}
                                                    </div>
                                                </div>

                                                <div className="pa-asg-metric-group" style={{ minWidth: 200 }}>
                                                    <div className="pa-metric-label">Teacher Feedback</div>
                                                    {status === 'graded' && sub.feedback ? (
                                                        <div className="pa-feedback-box"><Icons.ChatBubble /> {sub.feedback}</div>
                                                    ) : (
                                                        <div className="pa-feedback-empty">Not available yet</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Support Card */}
                    <div className="pa-support-card" style={{ marginTop: '24px' }}>
                        <div className="pa-support-info">
                            <div className="pa-support-icon">i</div>
                            <div className="pa-support-text">
                                <h4>Need help with assignments?</h4>
                                <p>If you have any questions or need support, please contact your child's teacher.</p>
                            </div>
                        </div>
                        <button className="pa-support-btn">
                            <Icons.ChatBubble /> Contact Teacher
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
