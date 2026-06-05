import { useContext, useState, useEffect, useCallback } from "react";
import { AnnouncementSidebarContext } from "../../context/AnnouncementSidebarContext";
import ThemeSelector from "../../components/ThemeSelector";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import api from "../../services/api";
import AnnouncementBell from "../../components/AnnouncementBell";
import "./StudentDashboard.css";

// ── Pure helpers (outside component — no re-creation on render) ──────────────

function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
}

function formatDueDate(dateStr) {
    if (!dateStr) return { day: '--', month: '---' };
    const d = new Date(dateStr);
    return {
        day: String(d.getDate()).padStart(2, '0'),
        month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase()
    };
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    const [hh, mm] = timeStr.split(':');
    const hour = parseInt(hh, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${mm} ${ampm}`;
}

function getDayAbbr(day) {
    const map = {
        Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
        Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun'
    };
    return map[day] || (day ? day.substring(0, 3) : '---');
}

const ICON_POOL = ['📢', '📝', '🗓️', '📌', '📣'];
const COLOR_POOL = ['icon-purple', 'icon-green', 'icon-yellow', 'icon-blue', 'icon-purple'];
function getAnnouncementStyle(idx) {
    return { icon: ICON_POOL[idx % ICON_POOL.length], color: COLOR_POOL[idx % COLOR_POOL.length] };
}

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ── Component ────────────────────────────────────────────────────────────────

let overduePopupShown = false;

function StudentDashboard() {
    const { user } = useContext(AuthContext);
    const { toggleSidebar } = useContext(AnnouncementSidebarContext);
    const navigate = useNavigate();

    const [chatUnreadCount, setChatUnreadCount] = useState(0);
    const [unreadStats, setUnreadStats] = useState({ assignments: 0, notes: 0 });
    const [announcements, setAnnouncements] = useState([]);
    const [upcomingTasks, setUpcomingTasks] = useState([]);
    const [timetable, setTimetable] = useState([]);
    const [widgetsLoading, setWidgetsLoading] = useState(true);
    const [assignmentsStats, setAssignmentsStats] = useState({ total: 0, completed: 0 });
    const [outstandingFees, setOutstandingFees] = useState(0);
    const [heroStats, setHeroStats] = useState({
        attendancePct: 0,
        gpa: '0.0',
        courses: 0,
        presentDays: 0,
        workingDays: 0
    });
    const [feeReminders, setFeeReminders] = useState([]);
    const [dismissedReminders, setDismissedReminders] = useState([]);
    const [showOverdueModal, setShowOverdueModal] = useState(false);
    const [overdueFeesData, setOverdueFeesData] = useState({ count: 0, totalDue: 0, fees: [] });
    const [overdueModalClosing, setOverdueModalClosing] = useState(false);

    // ── Data fetching ─────────────────────────────────────────────────────────

    const fetchWidgetData = useCallback(async () => {
        setWidgetsLoading(true);
        try {
            const [announcementsRes, assignmentsRes, studentRes, feesRes, perfRes] = await Promise.allSettled([
                user?.features?.announcements ? api.get('/announcements/institute') : Promise.resolve(null),
                user?.features?.notes ? api.get('/assignments/student/all') : Promise.resolve(null),
                api.get('/students/me'),
                user?.features?.fees ? api.get('/fees/my-fees') : Promise.resolve(null),
                api.get('/performance/me').catch(() => null)
            ]);

            // Announcements
            if (announcementsRes.status === 'fulfilled' && announcementsRes.value) {
                const d = announcementsRes.value.data;
                const allAnns = d.data || d.announcements || [];
                setAnnouncements(
                    allAnns
                        .sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt))
                        .slice(0, 7)
                );
            }

            // Upcoming Tasks
            if (assignmentsRes.status === 'fulfilled' && assignmentsRes.value) {
                const d = assignmentsRes.value.data;
                const all = d.data || d.assignments || [];
                const completed = all.filter(a => a.my_submission && ['submitted', 'late', 'graded'].includes(a.my_submission.status)).length;
                setAssignmentsStats({ total: all.length, completed });

                const pending = all
                    .filter(a => !a.my_submission || a.my_submission?.status === 'pending')
                    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
                    .slice(0, 7);
                setUpcomingTasks(pending);
            }

            // Fees
            if (feesRes.status === 'fulfilled' && feesRes.value) {
                const assignedFees = Array.isArray(feesRes.value.data?.data)
                    ? feesRes.value.data.data
                    : Array.isArray(feesRes.value.data)
                        ? feesRes.value.data
                        : [];
                const balanceDue = assignedFees.reduce((sum, fee) => sum + parseFloat(fee.due_amount || 0), 0);
                setOutstandingFees(balanceDue);

                // --- Reminder Date Alert Logic ---
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const getDaysUntil = (dateStr) => {
                    const d = new Date(dateStr);
                    d.setHours(0, 0, 0, 0);
                    return Math.ceil((d - today) / (1000 * 60 * 60 * 24));
                };
                const activeReminders = assignedFees.filter(fee => {
                    if (!fee.reminder_date || fee.status === 'paid') return false;
                    const days = getDaysUntil(fee.reminder_date);
                    return days === 8 || days === 4 || days <= 2;
                }).map(fee => ({
                    id: fee.id,
                    feeType: fee.FeesStructure?.fee_type || 'Fee',
                    dueAmount: parseFloat(fee.due_amount || 0),
                    reminderDate: fee.reminder_date,
                    daysLeft: getDaysUntil(fee.reminder_date),
                }));
                setFeeReminders(activeReminders);

                // --- Overdue Popup Logic (show every login session) ---
                const overdueFees = assignedFees.filter(fee => {
                    if (fee.status === 'paid') return false;
                    
                    let isDue = false;
                    if (fee.FeesStructure?.due_date) {
                        const dueD = new Date(fee.FeesStructure.due_date);
                        dueD.setHours(0, 0, 0, 0);
                        if (dueD < today) isDue = true;
                    }
                    
                    let isReminderOverdue = false;
                    if (fee.reminder_date) {
                        const remD = new Date(fee.reminder_date);
                        remD.setHours(0, 0, 0, 0);
                        if (remD <= today) isReminderOverdue = true;
                    }
                    
                    return isDue || isReminderOverdue;
                });

                if (overdueFees.length > 0) {
                    if (!overduePopupShown) {
                        const totalOverdueDue = overdueFees.reduce((s, f) => s + parseFloat(f.due_amount || 0), 0);
                        setOverdueFeesData({
                            count: overdueFees.length,
                            totalDue: totalOverdueDue,
                            fees: overdueFees.slice(0, 3).map(f => ({
                                feeType: f.FeesStructure?.fee_type || 'Fee',
                                dueAmount: parseFloat(f.due_amount || 0),
                                dueDate: f.FeesStructure?.due_date,
                            }))
                        });
                        setShowOverdueModal(true);
                        overduePopupShown = true;
                    }
                }
            }

            // Performance Stats
            if (perfRes.status === 'fulfilled' && perfRes.value) {
                const perfData = perfRes.value.data?.data || perfRes.value.data;
                if (perfData) {
                    const score = perfData.score || {};
                    const subs = perfData.subjects || [];
                    setHeroStats({
                        attendancePct: score.att_pct || 0,
                        gpa: score.marks_pct ? (score.marks_pct / 10).toFixed(1) : 'N/A',
                        courses: subs.length || 0,
                        presentDays: score.present_days || 0,
                        workingDays: score.working_days || 0
                    });
                }
            }

            // Timetable
            if (studentRes.status === 'fulfilled' && studentRes.value) {
                const studentData = studentRes.value.data?.data || studentRes.value.data;

                // /students/me returns Classes[] (many-to-many array), not a single class_id
                const classId = studentData?.Classes?.[0]?.id
                    || studentData?.class_id
                    || studentData?.StudentClass?.class_id;

                const enrolledSubjectIds = new Set((studentData?.Subjects || []).map(s => s.id));

                // Always try to load timetable if student has a class (regardless of plan feature flag)
                if (classId) {
                    try {
                        const ttRes = await api.get(`/timetable/class/${classId}`);
                        const ttRaw = ttRes.data?.data || ttRes.data?.timetable || ttRes.data || [];
                        const sorted = [...ttRaw].sort((a, b) => {
                            const dayDiff = DAY_ORDER.indexOf(a.day_of_week) - DAY_ORDER.indexOf(b.day_of_week);
                            return dayDiff !== 0 ? dayDiff : (a.start_time || '').localeCompare(b.start_time || '');
                        });

                        const filtered = enrolledSubjectIds.size > 0 
                            ? sorted.filter(r => enrolledSubjectIds.has(r.subject_id)) 
                            : sorted;

                        const SUBJECT_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899'];
                        const subjectColorMap = {};
                        let colorIdx = 0;

                        const grouped = DAY_ORDER.reduce((acc, day) => {
                            const daySlots = filtered.filter(r => r.day_of_week === day);
                            if (daySlots.length > 0) {
                                const uniqueSubjects = [];
                                const seen = new Set();
                                daySlots.forEach(r => {
                                    const name = r.Subject?.name || r.subject_name || r.subject || 'N/A';
                                    if (!seen.has(name)) {
                                        seen.add(name);
                                        if (!subjectColorMap[name]) {
                                            subjectColorMap[name] = SUBJECT_COLORS[colorIdx % SUBJECT_COLORS.length];
                                            colorIdx++;
                                        }
                                        uniqueSubjects.push({
                                            name,
                                            color: subjectColorMap[name],
                                            time: (r.TimetableSlot?.start_time || r.start_time) 
                                                ? `${(r.TimetableSlot?.start_time || r.start_time).slice(0,5)} – ${(r.TimetableSlot?.end_time || r.end_time).slice(0,5)}`
                                                : null
                                        });
                                    }
                                });
                                acc.push({ id: day, day_of_week: day, subjects: uniqueSubjects });
                            }
                            return acc;
                        }, []);
                        setTimetable(grouped.slice(0, 5));
                    } catch {
                        setTimetable([]);
                    }
                }
            }
        } catch (err) {
            console.error('Dashboard widget error:', err);
        } finally {
            setWidgetsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user?.features?.chat) {
            api.get('/chat/unread-count')
                .then(res => { if (res.data.success) setChatUnreadCount(res.data.count); })
                .catch(() => {});
        }
        if (user?.features?.notes) {
            api.get('/students/dashboard-stats')
                .then(res => {
                    if (res.data.success) {
                        setUnreadStats({
                            assignments: res.data.unreadAssignmentCount || 0,
                            notes: res.data.unreadNotesCount || 0
                        });
                    }
                })
                .catch(() => {});
        }
        fetchWidgetData();
    }, [user, fetchWidgetData]);

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleActionClick = (type, path) => {
        if (type === 'chat' && chatUnreadCount > 0) {
            setChatUnreadCount(0);
            api.post('/students/clear-unread-chats').catch(() => {});
        } else if (type === 'assignments' && unreadStats.assignments > 0) {
            setUnreadStats(s => ({ ...s, assignments: 0 }));
            api.post('/students/clear-unread-assignments').catch(() => {});
        } else if (type === 'notes' && unreadStats.notes > 0) {
            setUnreadStats(s => ({ ...s, notes: 0 }));
            api.post('/students/clear-unread-notes').catch(() => {});
        }
        navigate(path);
    };

    // ── Sub-components ────────────────────────────────────────────────────────

    const ActionCard = ({ icon, title, path, badge, onClick }) => (
        <a
            onClick={e => { e.preventDefault(); onClick ? onClick() : navigate(path); }}
            className="sd-action-card"
            href={path || '#'}
        >
            <div className="sd-action-icon">{icon}</div>
            <span className="sd-action-title">{title}</span>
            {badge > 0 && <span className="sd-badge">{badge}</span>}
        </a>
    );

    const SkeletonList = () => (
        <div className="sd-widget-loading">
            <div className="sd-skeleton-item" />
            <div className="sd-skeleton-item" />
            <div className="sd-skeleton-item" />
        </div>
    );

    const firstName = user?.name ? user.name.split(' ')[0] : 'Student';

    // Helper to close the overdue modal with fade-out animation
    const closeOverdueModal = () => {
        setOverdueModalClosing(true);
        setTimeout(() => {
            setShowOverdueModal(false);
            setOverdueModalClosing(false);
        }, 350);
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="sd-container">

            {/* ══════════════════════════════════════════════════
                OVERDUE PAYMENT POPUP (shows every login session)
            ══════════════════════════════════════════════════ */}
            {showOverdueModal && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '1rem',
                        background: 'rgba(15, 23, 42, 0.75)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        animation: overdueModalClosing ? 'sd-modal-fade-out 0.35s ease forwards' : 'sd-modal-fade-in 0.35s ease',
                    }}
                    onClick={closeOverdueModal}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: '#ffffff',
                            borderRadius: '24px',
                            width: '100%',
                            maxWidth: '480px',
                            overflow: 'hidden',
                            boxShadow: '0 25px 60px -10px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.1)',
                            animation: overdueModalClosing ? 'sd-modal-slide-out 0.35s ease forwards' : 'sd-modal-slide-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        }}
                    >
                        {/* Red top accent bar */}
                        <div style={{ height: '6px', background: 'linear-gradient(90deg, #ef4444, #f97316, #ef4444)', backgroundSize: '200% 100%', animation: 'sd-gradient-shift 3s ease infinite' }} />

                        {/* Header */}
                        <div style={{ padding: '2rem 2rem 1.25rem', textAlign: 'center', background: 'linear-gradient(180deg, #fff5f5 0%, #ffffff 100%)' }}>
                            {/* Pulsing warning icon */}
                            <div style={{
                                width: '72px', height: '72px', borderRadius: '50%', margin: '0 auto 1rem',
                                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '2rem', boxShadow: '0 0 0 12px rgba(239,68,68,0.12), 0 0 0 24px rgba(239,68,68,0.06)',
                                animation: 'sd-pulse-ring 2s ease infinite',
                            }}>
                                🚨
                            </div>
                            <h2 style={{ margin: '0 0 0.4rem', fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>
                                Payment Overdue!
                            </h2>
                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', lineHeight: '1.5' }}>
                                Hi <strong style={{ color: '#0f172a' }}>{firstName}</strong>, you have{' '}
                                <strong style={{ color: '#ef4444' }}>{overdueFeesData.count} overdue fee{overdueFeesData.count > 1 ? 's' : ''}</strong>{' '}
                                that require your immediate attention.
                            </p>
                        </div>

                        {/* Fee list */}
                        <div style={{ padding: '0 1.5rem', margin: '0 0 1.25rem' }}>
                            {overdueFeesData.fees.map((fee, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '0.85rem 1rem', borderRadius: '12px', marginBottom: '0.5rem',
                                    background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{
                                            width: '36px', height: '36px', borderRadius: '50%',
                                            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1rem', flexShrink: 0,
                                        }}>💳</div>
                                        <div>
                                            <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#0f172a' }}>{fee.feeType}</div>
                                            {fee.dueDate && (
                                                <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: '600' }}>
                                                    Due: {new Date(fee.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ fontWeight: '800', fontSize: '1.05rem', color: '#ef4444' }}>
                                        ₹{fee.dueAmount.toLocaleString('en-IN')}
                                    </div>
                                </div>
                            ))}
                            {/* Total row */}
                            <div style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '0.75rem 1rem', borderRadius: '12px',
                                background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(249,115,22,0.08))',
                                border: '1.5px solid rgba(239,68,68,0.25)', marginTop: '0.25rem',
                            }}>
                                <span style={{ fontWeight: '700', color: '#374151', fontSize: '0.9rem' }}>Total Outstanding</span>
                                <span style={{ fontWeight: '900', color: '#dc2626', fontSize: '1.2rem' }}>
                                    ₹{overdueFeesData.totalDue.toLocaleString('en-IN')}
                                </span>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ padding: '0 1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                            {user?.features?.fees && (
                                <button
                                    onClick={() => { closeOverdueModal(); navigate('/student/fees'); }}
                                    style={{
                                        width: '100%', padding: '0.9rem', borderRadius: '12px', border: 'none',
                                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                        color: '#fff', fontWeight: '700', fontSize: '1rem',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', gap: '8px',
                                        boxShadow: '0 4px 15px rgba(239,68,68,0.4)',
                                        transition: 'transform 0.15s, box-shadow 0.15s',
                                    }}
                                    onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(239,68,68,0.45)'; }}
                                    onMouseOut={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 15px rgba(239,68,68,0.4)'; }}
                                >
                                    <span style={{ fontSize: '1.15rem' }}>💳</span> Pay Now
                                </button>
                            )}
                            <button
                                onClick={closeOverdueModal}
                                style={{
                                    width: '100%', padding: '0.75rem', borderRadius: '12px',
                                    border: '1.5px solid #e2e8f0', background: '#f8fafc',
                                    color: '#64748b', fontWeight: '600', fontSize: '0.9rem',
                                    cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
                                }}
                                onMouseOver={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#374151'; }}
                                onMouseOut={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#64748b'; }}
                            >
                                I'll pay later
                            </button>
                        </div>

                        {/* Footer note */}
                        <div style={{ padding: '0.75rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                                ⚠️ Late payment may result in academic hold. Contact admin if you need help.
                            </p>
                        </div>
                    </div>
                </div>
            )}
            {/* Header */}
            <div className="sd-header">
                <div className="sd-header-left">
                    <h1>Student Dashboard</h1>
                    <p>Welcome back, {user?.name || 'Student'}! 👋 Stay productive and keep learning.</p>
                </div>
                <div className="sd-header-right">
                    {user?.features?.announcements && <AnnouncementBell size="large" />}
                    <ThemeSelector />
                    <div className="sd-user-profile" onClick={() => navigate('/student/profile')}>
                        <div className="sd-avatar">{firstName.charAt(0).toUpperCase()}</div>
                        <div className="sd-user-info">
                            <span className="sd-user-name">{user?.name || 'Student User'}</span>
                            <span className="sd-user-role">{user?.course || 'Computer Science'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hero Banner */}
            <div className="sd-hero">
                <div className="sd-hero-left">
                    <div className="sd-hero-icon">🏆</div>
                    <div className="sd-hero-text">
                        <h2>Keep it up, {firstName}! 🎉</h2>
                        <p>You're doing great in your academics.</p>
                    </div>
                </div>
                <div className="sd-hero-stats">
                    <div className="sd-hero-stat-item">
                        <span className="sd-stat-label">Overall Attendance</span>
                        <div className="sd-stat-value">{heroStats.attendancePct}% <span className={`sd-stat-sub ${heroStats.attendancePct >= 75 ? 'good' : 'active'}`}>{heroStats.attendancePct >= 75 ? 'Good' : 'Avg'}</span></div>
                    </div>
                    <div className="sd-hero-stat-item">
                        <span className="sd-stat-label">Current GPA</span>
                        <div className="sd-stat-value">{heroStats.gpa} <span className="sd-stat-sub good"></span></div>
                    </div>
                    <div className="sd-hero-stat-item">
                        <span className="sd-stat-label">Courses Enrolled</span>
                        <div className="sd-stat-value">{heroStats.courses} <span className="sd-stat-sub active">Active</span></div>
                    </div>
                </div>
            </div>

            {/* Fee Reminder Alerts */}
            {feeReminders.filter(r => !dismissedReminders.includes(r.id)).map(reminder => {
                const { id, feeType, dueAmount, reminderDate, daysLeft } = reminder;
                const isOverdue = daysLeft <= 0;
                const isUrgent = daysLeft <= 2;
                const isApproaching = daysLeft <= 4;

                let urgencyConfig;
                if (isOverdue) {
                    urgencyConfig = {
                        gradient: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.05))',
                        border: '1.5px solid rgba(239,68,68,0.45)',
                        iconBg: 'linear-gradient(135deg, #ef4444, #dc2626)',
                        icon: '🚨',
                        titleColor: '#dc2626',
                        badgeBg: 'rgba(239,68,68,0.15)',
                        badgeColor: '#dc2626',
                        badgeText: `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''}`,
                        title: 'Payment Overdue!',
                        msg: `Your ${feeType} reminder date has passed. Please pay ₹${dueAmount.toLocaleString('en-IN')} immediately.`,
                    };
                } else if (isUrgent) {
                    urgencyConfig = {
                        gradient: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(245,158,11,0.06))',
                        border: '1.5px solid rgba(239,68,68,0.35)',
                        iconBg: 'linear-gradient(135deg, #f97316, #ef4444)',
                        icon: '⚠️',
                        titleColor: '#dc2626',
                        badgeBg: 'rgba(239,68,68,0.12)',
                        badgeColor: '#dc2626',
                        badgeText: daysLeft === 0 ? 'Due Today!' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`,
                        title: 'Payment Due Very Soon!',
                        msg: `Your ${feeType} of ₹${dueAmount.toLocaleString('en-IN')} is due on ${new Date(reminderDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}. Please pay now.`,
                    };
                } else if (isApproaching) {
                    urgencyConfig = {
                        gradient: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.05))',
                        border: '1.5px solid rgba(245,158,11,0.4)',
                        iconBg: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        icon: '🔔',
                        titleColor: '#b45309',
                        badgeBg: 'rgba(245,158,11,0.15)',
                        badgeColor: '#b45309',
                        badgeText: `${daysLeft} days left`,
                        title: 'Fee Payment Reminder',
                        msg: `Your ${feeType} of ₹${dueAmount.toLocaleString('en-IN')} is due on ${new Date(reminderDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}. Please arrange payment soon.`,
                    };
                } else {
                    urgencyConfig = {
                        gradient: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.05))',
                        border: '1.5px solid rgba(99,102,241,0.35)',
                        iconBg: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        icon: '📅',
                        titleColor: '#4338ca',
                        badgeBg: 'rgba(99,102,241,0.12)',
                        badgeColor: '#4338ca',
                        badgeText: `${daysLeft} days left`,
                        title: 'Upcoming Fee Reminder',
                        msg: `Your ${feeType} of ₹${dueAmount.toLocaleString('en-IN')} is due on ${new Date(reminderDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}.`,
                    };
                }

                return (
                    <div
                        key={id}
                        style={{
                            background: urgencyConfig.gradient,
                            border: urgencyConfig.border,
                            borderRadius: '14px',
                            padding: '1rem 1.25rem',
                            marginBottom: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            animation: 'sd-reminder-slide-in 0.4s ease',
                        }}
                    >
                        {/* Icon */}
                        <div style={{
                            width: '44px', height: '44px', borderRadius: '12px',
                            background: urgencyConfig.iconBg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.25rem', flexShrink: 0,
                            boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
                        }}>
                            {urgencyConfig.icon}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                                <span style={{ fontWeight: '700', fontSize: '0.92rem', color: urgencyConfig.titleColor }}>
                                    {urgencyConfig.title}
                                </span>
                                <span style={{
                                    fontSize: '0.72rem', fontWeight: '700', padding: '2px 8px',
                                    borderRadius: '20px', background: urgencyConfig.badgeBg,
                                    color: urgencyConfig.badgeColor, letterSpacing: '0.02em'
                                }}>
                                    {urgencyConfig.badgeText}
                                </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.83rem', color: '#475569', lineHeight: '1.4' }}>
                                {urgencyConfig.msg}
                            </p>
                        </div>

                        {/* Pay Now Button */}
                        {user?.features?.fees && (
                            <button
                                onClick={() => navigate('/student/fees')}
                                style={{
                                    flexShrink: 0, padding: '7px 16px', borderRadius: '8px',
                                    border: 'none', background: urgencyConfig.iconBg,
                                    color: '#fff', fontWeight: '600', fontSize: '0.8rem',
                                    cursor: 'pointer', whiteSpace: 'nowrap',
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                                    transition: 'transform 0.15s, box-shadow 0.15s'
                                }}
                                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'; }}
                                onMouseOut={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)'; }}
                            >
                                💳 Pay Now
                            </button>
                        )}

                        {/* Dismiss */}
                        <button
                            onClick={() => setDismissedReminders(prev => [...prev, id])}
                            style={{
                                flexShrink: 0, background: 'none', border: 'none',
                                cursor: 'pointer', color: '#94a3b8', fontSize: '1.1rem',
                                padding: '4px', borderRadius: '50%', lineHeight: 1,
                                transition: 'color 0.15s, background 0.15s'
                            }}
                            onMouseOver={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; }}
                            onMouseOut={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'none'; }}
                            title="Dismiss"
                            aria-label="Dismiss reminder"
                        >
                            ✕
                        </button>
                    </div>
                );
            })}

            {/* Quick Actions */}
            <div className="sd-section">
                <div className="sd-section-header">
                    <h3>Quick Actions</h3>
                </div>
                <div className="sd-quick-actions">
                    {user?.features?.attendance !== 'none' && (
                        <ActionCard path="/student/attendance" icon="📅" title="View Attendance" />
                    )}
                    {user?.features?.exams && (
                        <ActionCard path="/student/exams" icon="A+" title="View Marks" />
                    )}
                    {user?.features?.exams && (
                        <ActionCard path="/student/performance" icon="📊" title="My Performance" />
                    )}
                    {user?.features?.timetable && (
                        <ActionCard path="/student/timetable" icon="📆" title="My Timetable" />
                    )}
                    {user?.features?.notes && (
                        <ActionCard onClick={() => handleActionClick('assignments', '/student/assignments')} icon="📋" title="Assignments" badge={unreadStats.assignments} />
                    )}
                    {user?.features?.fees && (
                        <ActionCard path="/student/fees" icon="💳" title="Pay Fees" />
                    )}
                    {user?.features?.chat && (
                        <ActionCard onClick={() => handleActionClick('chat', '/student/chat')} icon="💬" title="Subject Chat" badge={chatUnreadCount} />
                    )}
                    {user?.features?.notes && (
                        <ActionCard onClick={() => handleActionClick('notes', '/student/notes')} icon="📓" title="My Notes" badge={unreadStats.notes} />
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="sd-secondary-stats">
                <div className="sd-stat-card">
                    <div className="sd-stat-card-header">
                        <div className="sd-stat-card-icon icon-purple">👥</div>
                        <span className="sd-stat-card-title">Classes Attended</span>
                    </div>
                    <div className="sd-stat-card-value-row">
                        <span className="sd-stat-card-value">{heroStats.presentDays}</span>
                        <span className="sd-stat-card-max">/ {heroStats.workingDays || '-'}</span>
                    </div>
                    <div className="sd-progress-bar">
                        <div className="sd-progress-fill" style={{ width: `${heroStats.attendancePct}%`, backgroundColor: '#8b5cf6' }} />
                    </div>
                    <div className="sd-stat-card-footer">
                        <span>Overall</span><span>{heroStats.attendancePct}%</span>
                    </div>
                </div>

                <div className="sd-stat-card">
                    <div className="sd-stat-card-header">
                        <div className="sd-stat-card-icon icon-green">📋</div>
                        <span className="sd-stat-card-title">Assignments</span>
                    </div>
                    <div className="sd-stat-card-value-row">
                        <span className="sd-stat-card-value">{assignmentsStats.completed}</span>
                        <span className="sd-stat-card-max">/ {assignmentsStats.total || 0}</span>
                    </div>
                    <div className="sd-progress-bar">
                        <div className="sd-progress-fill" style={{ width: `${assignmentsStats.total ? (assignmentsStats.completed / assignmentsStats.total) * 100 : 0}%`, backgroundColor: '#10b981' }} />
                    </div>
                    <div className="sd-stat-card-footer">
                        <span>Completed</span><span>{assignmentsStats.total ? Math.round((assignmentsStats.completed / assignmentsStats.total) * 100) : 0}%</span>
                    </div>
                </div>

                <div className="sd-stat-card">
                    <div className="sd-stat-card-header">
                        <div className="sd-stat-card-icon icon-yellow">⏱️</div>
                        <span className="sd-stat-card-title">Upcoming Exams</span>
                    </div>
                    <div className="sd-stat-card-value-row">
                        <span className="sd-stat-card-value">2</span>
                    </div>
                    <div style={{ height: '4px', marginBottom: '8px' }} />
                    <div className="sd-stat-card-footer">
                        <span>This Month</span>
                    </div>
                </div>

                <div className="sd-stat-card">
                    <div className="sd-stat-card-header">
                        <div className="sd-stat-card-icon icon-blue">💰</div>
                        <span className="sd-stat-card-title">Outstanding Fees</span>
                    </div>
                    <div className="sd-stat-card-value-row">
                        <span className="sd-stat-card-value">₹{outstandingFees.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ height: '4px', marginBottom: '8px' }} />
                    <div className="sd-stat-card-footer">
                        <span className={outstandingFees > 0 ? "sd-text-danger" : "sd-text-success"}>{outstandingFees > 0 ? "Action Required" : "All cleared"}</span>
                    </div>
                </div>
            </div>

            {/* Bottom Widgets */}
            <div className="sd-widgets">
                {/* Recent Announcements */}
                {user?.features?.announcements && (
                    <div className="sd-widget">
                        <div className="sd-widget-header">
                            <h3>Recent Announcements</h3>
                            <Link to="#" onClick={toggleSidebar} className="sd-view-all">View All</Link>
                        </div>
                        <div className="sd-list">
                            {widgetsLoading ? <SkeletonList /> : announcements.length > 0 ? (
                                announcements.map((ann, idx) => {
                                    const { icon, color } = getAnnouncementStyle(idx);
                                    const isNew = ann.isRead === false || ann.read_at === null;
                                    return (
                                        <div className="sd-list-item" key={ann.id || idx}>
                                            <div className={`sd-list-icon ${color}`}>{icon}</div>
                                            <div className="sd-list-content">
                                                <div className="sd-list-title">
                                                    {ann.title}
                                                    {isNew && <span className="sd-tag">New</span>}
                                                </div>
                                                <div className="sd-list-desc">{ann.message || ann.content}</div>
                                                <div className="sd-list-time">{formatTimeAgo(ann.createdAt)}</div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="sd-empty-state">
                                    <span>📭</span>
                                    <p>No announcements yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Upcoming Tasks */}
                <div className="sd-widget">
                    <div className="sd-widget-header">
                        <h3>Upcoming Tasks</h3>
                        <Link to="/student/assignments" className="sd-view-all">View All</Link>
                    </div>
                    <div className="sd-list">
                        {widgetsLoading ? <SkeletonList /> : upcomingTasks.length > 0 ? (
                            upcomingTasks.map((task, idx) => {
                                const { day, month } = formatDueDate(task.due_date);
                                return (
                                    <div className="sd-list-item" key={task.id || idx}>
                                        <div className="sd-date-box">
                                            <span className="sd-date-day">{day}</span>
                                            <span className="sd-date-month">{month}</span>
                                        </div>
                                        <div className="sd-list-content" style={{ justifyContent: 'center' }}>
                                            <div className="sd-list-title">{task.title}</div>
                                            <div className="sd-list-desc">
                                                {task.due_date
                                                    ? `Submit by ${new Date(task.due_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                                                    : task.subject || 'Assignment'}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="sd-empty-state">
                                <span>✅</span>
                                <p>No pending tasks! You're all caught up.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Weekly Timetable */}
                <div className="sd-widget">
                    <div className="sd-widget-header">
                        <h3>Weekly Timetable</h3>
                        <Link to="/student/timetable" className="sd-view-all">View Full Timetable</Link>
                    </div>
                    <div className="sd-list">
                        {widgetsLoading ? <SkeletonList /> : timetable.length > 0 ? (
                            timetable.map((row, idx) => (
                                <div className="sd-tt-row" key={row.id || idx}>
                                    <span className="sd-tt-day">{getDayAbbr(row.day_of_week)}</span>
                                    <div className="sd-tt-pills">
                                        {(Array.isArray(row.subjects) ? row.subjects : []).map((subj, si) => (
                                            <span key={si} className="sd-tt-pill" style={{ background: subj.color + '18', color: subj.color, borderColor: subj.color + '40' }}>
                                                {subj.name}
                                                {subj.time && <span className="sd-tt-pill-time">{subj.time}</span>}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="sd-empty-state">
                                <span>📅</span>
                                <p>No timetable available for your class.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default StudentDashboard;
