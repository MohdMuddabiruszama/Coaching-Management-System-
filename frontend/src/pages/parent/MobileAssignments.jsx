import { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import * as parentService from "../../services/parent.service";
import { markParentAssignmentsSeen } from "../../hooks/useParentBadges";
import { AuthContext } from "../../context/AuthContext";
import "./MobileAssignments.css";
import "./MobileDashboard.css";

export default function MobileAssignments() {
    const { user } = useContext(AuthContext);
    const [students, setStudents] = useState([]);
    const [selectedStudentId, setSelectedStudentId] = useState("");
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");

    useEffect(() => {
        fetchStudents();
    }, []);

    useEffect(() => {
        if (selectedStudentId) {
            fetchAssignments(selectedStudentId);
        }
    }, [selectedStudentId]);

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const res = await parentService.getParentDashboard();
            const loadedStudents = res.data?.students || [];
            if (loadedStudents.length > 0) {
                setStudents(loadedStudents);
                const storedId = sessionStorage.getItem("parentSelectedStudentId");
                const studentToSelect = loadedStudents.find(s => s.id.toString() === storedId) || loadedStudents[0];
                setSelectedStudentId(studentToSelect.id.toString());
            } else {
                setLoading(false);
            }
        } catch (error) {
            console.error("Error fetching students", error);
            setLoading(false);
        }
    };

    const fetchAssignments = async (studentId) => {
        setLoading(true);
        try {
            const res = await parentService.getLinkedStudentAssignments(studentId);
            setAssignments(res.assignments || []);
            
            // Mark assignments as seen so the dashboard badge clears
            if (user?.id && studentId) {
                markParentAssignmentsSeen(user.id, studentId);
            }
        } catch (error) {
            console.error("Error fetching assignments", error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusInfo = (status) => {
        switch (status) {
            case 'pending': return { label: 'Pending', badgeClass: 'not-submitted', text: 'NOT SUBMITTED', subText: 'Not submitted yet', icon: '⏳', iconBg: '#fef3c7', iconColor: '#d97706', statusPillBg: '#fee2e2', statusPillColor: '#dc2626' };
            case 'submitted': return { label: 'Submitted', badgeClass: 'submitted', text: 'SUBMITTED', subText: 'Under review', icon: '📥', iconBg: '#e0e7ff', iconColor: '#4f46e5', statusPillBg: '#eff6ff', statusPillColor: '#3b82f6' };
            case 'late': return { label: 'Late', badgeClass: 'submitted', text: 'LATE SUBMITTED', subText: 'Under review', icon: '⚠️', iconBg: '#ffedd5', iconColor: '#ea580c', statusPillBg: '#eff6ff', statusPillColor: '#3b82f6' };
            case 'graded': return { label: 'Graded', badgeClass: 'graded', text: 'GRADED', subText: 'Completed', icon: '📄', iconBg: '#dcfce7', iconColor: '#16a34a', statusPillBg: '#dcfce7', statusPillColor: '#16a34a' };
            case 'resubmit_requested': return { label: 'Resubmit', badgeClass: 'resubmit', text: 'NEEDS RESUBMIT', subText: 'Action required', icon: '🔄', iconBg: '#f3e8ff', iconColor: '#9333ea', statusPillBg: '#f3e8ff', statusPillColor: '#9333ea' };
            default: return { label: 'Pending', badgeClass: 'not-submitted', text: 'NOT SUBMITTED', subText: 'Not submitted yet', icon: '⏳', iconBg: '#fef3c7', iconColor: '#d97706', statusPillBg: '#eff6ff', statusPillColor: '#3b82f6' };
        }
    };

    const pending = assignments.filter(a => !a.my_submission || a.my_submission?.status === 'pending');
    const resubmit = assignments.filter(a => a.my_submission?.status === 'resubmit_requested');
    const submitted = assignments.filter(a => a.my_submission && ['submitted', 'late'].includes(a.my_submission.status));
    const graded = assignments.filter(a => a.my_submission?.status === 'graded');

    const formatDateTime = (dateString) => {
        const d = new Date(dateString);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const selectedStudent = students.find(s => s.id.toString() === selectedStudentId);
    const initials = selectedStudent?.User?.name?.substring(0, 2).toUpperCase() || 'ST';
    const firstName = selectedStudent?.User?.name?.split(" ")[0] || 'Student';

    if (loading && students.length === 0) {
        return <div className="mpa-container" style={{ padding: '3rem', textAlign: 'center' }}>Loading Assignments...</div>;
    }

    return (
        <div className="mpa-container">
            {/* ── Page Header ── */}
            <div className="mpa-header-left" style={{ justifyContent: 'flex-start', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', background: '#fff' }}>
                <div className="mpa-header-icon" style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '12px', padding: '10px', fontSize: '1.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    📋
                </div>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>Assignments</h1>
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#64748b' }}>View and track assignment submissions</p>
                </div>
            </div>

            {/* ── Student Selector (Matching specific layout) ── */}
            <div className="mpd-student-scroll" style={{ padding: '0 16px', marginBottom: '16px' }}>
                {students.map((student, idx) => {
                    const isSelected = selectedStudentId === student.id.toString();
                    const initials = student.User?.name?.substring(0,2).toUpperCase() || 'ST';
                    return (
                        <div 
                            key={student.id} 
                            className={`mpd-student-card ${isSelected ? 'active' : ''} ${idx % 2 !== 0 && !isSelected ? 'white-bg' : ''}`}
                            onClick={() => {
                                sessionStorage.setItem("parentSelectedStudentId", student.id.toString());
                                setSelectedStudentId(student.id.toString());
                            }}
                        >
                            <div className="mpd-student-avatar-circle" style={{ width: '36px', height: '36px', fontSize: '14px' }}>
                                {initials}
                            </div>
                            <div className="mpd-student-details">
                                <h3 style={{ fontSize: '14px' }}>{student.User?.name?.split(" ")[0]}</h3>
                                <p style={{ fontSize: '10px' }}>{student.Classes?.[0]?.name || 'Class'}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Stats Grid */}
            <div className="mpa-stats-grid">
                <div className="mpa-stat-card">
                    <div className="mpa-stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>⏳</div>
                    <div className="mpa-stat-val" style={{ color: '#d97706' }}>{pending.length}</div>
                    <div className="mpa-stat-label">Pending</div>
                    <div className="mpa-stat-sub">Not submitted yet</div>
                </div>
                <div className="mpa-stat-card">
                    <div className="mpa-stat-icon" style={{ background: '#f3e8ff', color: '#9333ea' }}>🔄</div>
                    <div className="mpa-stat-val" style={{ color: '#9333ea' }}>{resubmit.length}</div>
                    <div className="mpa-stat-label">Needs Resubmit</div>
                    <div className="mpa-stat-sub">Action required</div>
                </div>
                <div className="mpa-stat-card">
                    <div className="mpa-stat-icon" style={{ background: '#eff6ff', color: '#3b82f6' }}>📥</div>
                    <div className="mpa-stat-val" style={{ color: '#3b82f6' }}>{submitted.length}</div>
                    <div className="mpa-stat-label">Awaiting Grade</div>
                    <div className="mpa-stat-sub">Under review</div>
                </div>
                <div className="mpa-stat-card">
                    <div className="mpa-stat-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>✅</div>
                    <div className="mpa-stat-val" style={{ color: '#16a34a' }}>{graded.length}</div>
                    <div className="mpa-stat-label">Graded</div>
                    <div className="mpa-stat-sub">Completed</div>
                </div>
            </div>

            {/* Header Banner */}
            <div className="mpa-header-banner">
                <div className="mpa-header-left">
                    <div className="mpa-header-avatar">👤</div>
                    <div className="mpa-header-title">{firstName}'s Assignments</div>
                </div>
                <div className="mpa-header-right" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 12px', gap: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>⚗️ Filter:</span>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#3b82f6' }}>
                            {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                        </span>
                        <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '2px' }}>⌄</span>
                        <select 
                            value={filter} 
                            onChange={e => setFilter(e.target.value)}
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, appearance: 'none', border: 'none', padding: 0, margin: 0 }}
                        >
                            <option value="all">All Assignments</option>
                            <option value="pending">Pending</option>
                            <option value="submitted">Submitted</option>
                            <option value="graded">Graded</option>
                        </select>
                    </div>
                    <span style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#0f172a', padding: '8px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '700', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                        {assignments.length} Total
                    </span>
                </div>
            </div>

            {/* Assignments List */}
            <div className="mpa-list">
                {assignments.length === 0 ? (
                    <div style={{ textAlign: "center", color: "#94a3b8", padding: "2rem" }}>
                        No assignments found for this student.
                    </div>
                ) : (
                    assignments.filter(a => filter === 'all' || a.my_submission?.status === filter || (!a.my_submission && filter === 'pending')).map(asg => {
                        const statusKey = asg.my_submission?.status || 'pending';
                        const info = getStatusInfo(statusKey);
                        const isOverdue = !asg.my_submission && new Date(asg.due_date) < new Date();
                        
                        let statusText = info.label;
                        let statusSubText = info.subText;
                        let statusPillBg = info.statusPillBg;
                        let statusPillColor = info.statusPillColor;

                        if (isOverdue && statusKey === 'pending') {
                            statusText = "Overdue";
                            statusSubText = "Past due date";
                            statusPillBg = "#eff6ff";
                            statusPillColor = "#3b82f6";
                        }

                        return (
                            <div key={asg.id} className="mpa-card">
                                <div className="mpa-card-top">
                                    <div className="mpa-card-icon" style={{ background: info.iconBg, color: info.iconColor }}>
                                        {statusKey === 'graded' ? '📄' : '📄'}
                                    </div>
                                    <div className="mpa-card-content">
                                        <div className={`mpa-badge ${info.badgeClass}`}>
                                            {info.text}
                                        </div>
                                        <h3 className="mpa-card-title">{asg.title}</h3>
                                        <div className="mpa-card-meta">
                                            <span>📚 Class {asg.Class?.name?.replace('Class ', '') || '10'}</span>
                                            <span className="mpa-meta-divider">|</span>
                                            <span>📖 {asg.Subject?.name || 'Subject'}</span>
                                            <span className="mpa-meta-divider">|</span>
                                            <span>👤 {asg.faculty?.name || 'Faculty'}</span>
                                        </div>
                                        <div className="mpa-card-meta" style={{ color: '#0f172a' }}>
                                            <span>📅 Due: {formatDateTime(asg.due_date)}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="mpa-card-divider"></div>
                                
                                <div className="mpa-status-row">
                                    <div className="mpa-row-label">Status</div>
                                    <div className="mpa-status-right">
                                        <div className="mpa-status-pill" style={{ background: statusPillBg, color: statusPillColor }}>
                                            {statusText}
                                        </div>
                                        <div className="mpa-status-sub">{statusSubText}</div>
                                    </div>
                                </div>

                                <div className="mpa-grade-row">
                                    <div className="mpa-row-label">Grade</div>
                                    <div className="mpa-grade-val">
                                        {statusKey === 'graded' && asg.my_submission 
                                            ? `${asg.my_submission.marks_obtained}/${asg.max_marks}` 
                                            : '-'}
                                    </div>
                                </div>

                                <div className="mpa-feedback-row">
                                    <div className="mpa-row-label">Teacher Feedback</div>
                                    <div className="mpa-feedback-val">
                                        {statusKey === 'graded' && asg.my_submission?.feedback 
                                            ? asg.my_submission.feedback 
                                            : 'Not reviewed yet'}
                                    </div>
                                </div>

                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
