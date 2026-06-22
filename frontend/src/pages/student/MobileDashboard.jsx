/**
 * Phase 3A — Student Mobile Dashboard UI (Premium Overhaul)
 * ─────────────────────────────────────────────────────────────────────────────
 * Clean, modern, mobile-first dashboard powered by the bundled React Query hook.
 */

import { useStudentDashboard } from "../../hooks/useMobileDashboard";
import { useStudentBadges } from "../../hooks/useStudentBadges";
import { useContext, useState, useEffect } from "react";

let overduePopupShown = false;
import { AuthContext } from "../../context/AuthContext";
import { BrandingContext } from "../../context/BrandingContext";
import { AnnouncementSidebarContext } from "../../context/AnnouncementSidebarContext";
import { useNavigate, useOutletContext } from "react-router-dom";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { FiMenu, FiBell, FiEdit2 } from "react-icons/fi";
import "./MobileDashboard.css";

function formatTime(timeStr) {
    if (!timeStr) return '';
    const [hh, mm] = timeStr.split(':');
    const hour = parseInt(hh, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${mm} ${ampm}`;
}

/**
 * QuickActionBtn — Premium action card with animated section badges.
 *
 * Props:
 *   icon        — emoji string or JSX element
 *   label       — button label text
 *   badge       — { count, type } | null   (from useStudentBadges)
 *   badgeVariant — 'count-purple' | 'count-green' | 'dot-blue' | 'dot-amber'
 *   onClick     — handler (should call clearBadge then navigate)
 */
function QuickActionBtn({ icon, label, badge, badgeVariant = 'count-purple', onClick }) {
    const hasCount  = badge && (badge.type === 'number') && badge.count > 0;
    const hasDot    = badge && (badge.type === 'dot');
    const hasAny    = hasCount || hasDot;

    // Color maps for each variant
    const variantStyles = {
        'count-purple': { bg: '#6366f1', shadow: 'rgba(99,102,241,0.45)', glow: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.3)' },
        'count-green':  { bg: '#10b981', shadow: 'rgba(16,185,129,0.45)', glow: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
        'dot-blue':     { bg: '#3b82f6', shadow: 'rgba(59,130,246,0.5)',  glow: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.25)' },
        'dot-amber':    { bg: '#f59e0b', shadow: 'rgba(245,158,11,0.5)',  glow: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.3)'  },
    };
    const vs = variantStyles[badgeVariant] || variantStyles['count-purple'];

    return (
        <button
            className={`msd-action-btn${hasAny ? ' msd-action-btn--has-badge' : ''}`}
            onClick={onClick}
            style={hasAny ? { '--qa-glow': vs.glow, '--qa-border': vs.border } : {}}
        >
            {/* Icon card */}
            <div className="msd-action-icon" style={hasAny ? {
                borderColor: vs.border,
                boxShadow: `0 0 0 2px ${vs.glow}, 0 4px 14px rgba(0,0,0,0.06)`,
            } : {}}>
                {typeof icon === 'string' ? <span>{icon}</span> : icon}

                {/* Numeric badge */}
                {hasCount && (
                    <span className="msd-qa-badge msd-qa-badge--count" style={{
                        background: vs.bg,
                        boxShadow: `0 2px 8px ${vs.shadow}`,
                    }}>
                        {badge.count > 99 ? '99+' : badge.count}
                    </span>
                )}

                {/* Dot badge with ripple */}
                {hasDot && (
                    <span className="msd-qa-badge msd-qa-badge--dot" style={{
                        background: vs.bg,
                        boxShadow: `0 0 0 0 ${vs.shadow}`,
                        '--ripple-color': vs.shadow,
                    }} />
                )}
            </div>

            {/* Label */}
            <span className="msd-action-label">{label}</span>
        </button>
    );
}


export default function MobileDashboard() {
    const { user } = useContext(AuthContext);
    const { logo, name } = useContext(BrandingContext);
    const { toggleSidebar } = useContext(AnnouncementSidebarContext);
    const navigate = useNavigate();
    const { dismissedReminders, setDismissedReminders, advanceAttendanceCount: layoutAdvance } = useOutletContext() || { dismissedReminders: [], setDismissedReminders: () => {}, advanceAttendanceCount: null };
    const { data: response, isLoading, isError } = useStudentDashboard();

    // ── Section badges — zero extra API calls, derived from cached dashboard data ──
    const { badges, clearBadge, advanceAttendanceCount } = useStudentBadges(response?.data, user?.id);

    // Use either version of advanceAttendanceCount (hook or layout context)
    const doAdvanceAttendance = layoutAdvance || advanceAttendanceCount;

    const [showOverdueModal, setShowOverdueModal] = useState(false);
    const [overdueModalClosing, setOverdueModalClosing] = useState(false);
    const [overdueFeesData, setOverdueFeesData] = useState({ count: 0, totalDue: 0, fees: [] });

    // Helper to close the overdue modal with fade-out animation
    const closeOverdueModal = () => {
        setOverdueModalClosing(true);
        setTimeout(() => {
            setShowOverdueModal(false);
            setOverdueModalClosing(false);
        }, 350);
    };

    const feesData = response?.data?.fees;

    const getDaysUntil = (dateString) => {
        if (!dateString) return 999;
        const today = new Date();
        today.setHours(0,0,0,0);
        const target = new Date(dateString);
        target.setHours(0,0,0,0);
        const diffTime = target - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const feeReminders = (feesData?.pendingList || []).filter(fee => {
        if (!fee.reminderDate) return false;
        const diffDays = getDaysUntil(fee.reminderDate);
        return diffDays === 8 || diffDays === 4 || diffDays <= 2;
    }).map(fee => ({
        ...fee,
        daysLeft: getDaysUntil(fee.reminderDate)
    }));



    useEffect(() => {
        if (feesData?.pendingList && !overduePopupShown) {
            const pendingFees = feesData.pendingList;
            const overdueFees = pendingFees.filter(fee => {
                let isDue = false;
                let isReminderOverdue = false;
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                if (fee.dueDate) {
                    const dueD = new Date(fee.dueDate);
                    dueD.setHours(0, 0, 0, 0);
                    if (dueD <= today) isDue = true;
                }
                if (fee.reminderDate) {
                    const remD = new Date(fee.reminderDate);
                    remD.setHours(0, 0, 0, 0);
                    if (remD <= today) isReminderOverdue = true;
                }
                return isDue || isReminderOverdue;
            });

            if (overdueFees.length > 0) {
                const totalOverdueDue = overdueFees.reduce((s, f) => s + parseFloat(f.dueAmount || 0), 0);
                setOverdueFeesData({
                    count: overdueFees.length,
                    totalDue: totalOverdueDue,
                    fees: overdueFees.slice(0, 3)
                });
                setShowOverdueModal(true);
                overduePopupShown = true;
            }
        }
    }, [feesData]);

    if (isLoading) {
        return (
            <div className="msd-loading-container">
                <LoadingSpinner />
                <p>Loading your dashboard...</p>
            </div>
        );
    }

    if (isError || !response?.success) {
        return (
            <div className="msd-error-container">
                <p>Failed to load dashboard. Please try again.</p>
                <button onClick={() => window.location.reload()}>Retry</button>
            </div>
        );
    }

    const data = response.data;
    const firstName = user?.name ? user.name.split(" ")[0] : "Student";
    const { attendance, recentMarks, upcomingExams, announcements, fees, todaySchedule } = data;

    // Formatting date (e.g., Wednesday, June 17)
    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    // Map data returned from the API
    const totalClassesAttended = data.score?.present_days || attendance?.present || 0;
    const totalClasses = data.score?.working_days || attendance?.total || 0;
    const attPct = data.score?.att_pct || attendance?.percentage || 0;
    const gpa = data.score?.marks_pct ? (data.score.marks_pct / 10).toFixed(1) : 'N/A';
    const coursesEnrolled = data.totalSubjects || 0;
    const assignmentsCompleted = (data.totalAssignments || 0) - (data.pendingAssignments || 0);
    const assignmentsTotal = data.totalAssignments || 0;
    const assignmentsPct = assignmentsTotal > 0 ? Math.round((assignmentsCompleted / assignmentsTotal) * 100) : 0;
    const examsThisMonth = data.upcomingExams?.length || 0;
    
    // Check if any fee is overdue or due very soon
    const needsFeeAttention = fees?.hasPendingFees && fees.totalDue > 0;



    // Safe date formatter
    const safeFormatDate = (dateVal) => {
        if (!dateVal) return '';
        const d = new Date(dateVal);
        return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
    };

    return (
        <div className="msd-container">

            {/* OVERDUE PAYMENT POPUP */}
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

            {/* Greeting */}
            <div className="msd-greeting-section">
                <h2>Hello, {firstName}! 👋</h2>
                <p>{formattedDate}</p>
            </div>

            {/* Hero Banner (Keep it up) */}
            <div className="msd-hero-card">
                <div className="msd-hero-top">
                    <div className="msd-hero-icon">🏆</div>
                    <div className="msd-hero-text">
                        <h3>Keep it up, {firstName}! 🎉</h3>
                        <p>You're doing great in your academics.</p>
                    </div>
                </div>
                <div className="msd-hero-divider" />
                <div className="msd-hero-stats">
                    <div className="msd-hero-stat-item">
                        <span className="msd-hero-stat-label">Attendance</span>
                        <span className="msd-hero-stat-value">
                            {attPct}% <span className="msd-hero-stat-sub good">Good</span>
                        </span>
                    </div>
                    <div className="msd-stat-divider" />
                    <div className="msd-hero-stat-item">
                        <span className="msd-hero-stat-label">Current GPA</span>
                        <span className="msd-hero-stat-value">{gpa}</span>
                    </div>
                    <div className="msd-stat-divider" />
                    <div className="msd-hero-stat-item">
                        <span className="msd-hero-stat-label">Courses Enrolled</span>
                        <span className="msd-hero-stat-value">
                            {coursesEnrolled} {coursesEnrolled > 0 && <span className="msd-hero-stat-sub active">Active</span>}
                        </span>
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
                            padding: '1rem',
                            margin: '0 1.25rem 1rem 1.25rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '14px',
                            animation: 'sd-reminder-slide-in 0.4s ease',
                        }}
                    >
                        {/* Top Row: Icon, Content, Dismiss */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            {/* Icon */}
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '12px',
                                background: urgencyConfig.iconBg,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.25rem', flexShrink: 0,
                                boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
                            }}>
                                {urgencyConfig.icon}
                            </div>

                            {/* Content */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
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

                            {/* Dismiss */}
                            <button
                                onClick={() => setDismissedReminders(prev => [...prev, id])}
                                style={{
                                    flexShrink: 0, background: 'rgba(0,0,0,0.04)', border: 'none',
                                    cursor: 'pointer', color: '#64748b', fontSize: '1rem',
                                    width: '28px', height: '28px', borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'background 0.15s, color 0.15s'
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Pay Now Button */}
                        {user?.features?.fees && (
                            <button
                                onClick={() => navigate('/student/fees')}
                                style={{
                                    width: '100%', padding: '10px', borderRadius: '8px',
                                    border: 'none', background: urgencyConfig.iconBg,
                                    color: '#fff', fontWeight: '600', fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                                    transition: 'transform 0.15s, box-shadow 0.15s'
                                }}
                            >
                                💳 Pay Now
                            </button>
                        )}
                    </div>
                );
            })}

            {/* Quick Actions */}
            <div className="msd-section">
                <div className="msd-section-header">
                    <h3>Quick Actions</h3>
                </div>
                <div className="msd-quick-actions">

                    {/* Attendance */}
                    <QuickActionBtn
                        icon="🗓️"
                        label="Attendance"
                        badge={badges.attendance}
                        badgeVariant="dot-blue"
                        onClick={() => {
                            clearBadge('attendance');
                            // Also advance the snapshot with current month total
                            // so badge only returns when faculty adds MORE records.
                            if (doAdvanceAttendance && data?.attendance?.total !== undefined) {
                                doAdvanceAttendance(data.attendance.total);
                            }
                            navigate('/student/attendance');
                        }}
                    />

                    {/* Marks */}
                    <QuickActionBtn
                        icon={<span style={{ color: '#2563eb', fontWeight: 800, fontSize: '20px' }}>A+</span>}
                        label="Marks"
                        badge={badges.exams}
                        badgeVariant="count-purple"
                        onClick={() => { clearBadge('exams'); navigate('/student/exams'); }}
                    />

                    {/* Performance */}
                    <QuickActionBtn
                        icon="📊"
                        label="Performance"
                        badge={badges.performance}
                        badgeVariant="dot-blue"
                        onClick={() => { clearBadge('performance'); navigate('/student/performance'); }}
                    />

                    {/* Timetable */}
                    <QuickActionBtn
                        icon="📆"
                        label="Timetable"
                        onClick={() => navigate('/student/timetable')}
                    />

                    {/* Assignments */}
                    <QuickActionBtn
                        icon="📋"
                        label="Assignments"
                        badge={badges.assignments}
                        badgeVariant="count-purple"
                        onClick={() => { clearBadge('assignments'); navigate('/student/assignments'); }}
                    />

                    {/* Pay Fees — always visible with amber badge if pending */}
                    <QuickActionBtn
                        icon="💳"
                        label="Pay Fees"
                        badge={badges.fees || (needsFeeAttention ? { count: '!', type: 'dot' } : null)}
                        badgeVariant="dot-amber"
                        onClick={() => { clearBadge('fees'); navigate('/student/fees'); }}
                    />

                    {/* Notes */}
                    <QuickActionBtn
                        icon="📓"
                        label="Notes"
                        onClick={() => navigate('/student/notes')}
                    />

                    {/* Chat */}
                    <QuickActionBtn
                        icon="💬"
                        label="Chat"
                        badge={badges.chat || (data.unreadChatCount > 0 ? { count: data.unreadChatCount, type: 'number' } : null)}
                        badgeVariant="count-green"
                        onClick={() => { clearBadge('chat'); navigate('/student/chat'); }}
                    />

                </div>
            </div>

            {/* Summary Grid */}
            <div className="msd-summary-grid">
                <div className="msd-summary-card">
                    <div className="msd-summary-header">
                        <div className="msd-summary-icon icon-purple">👥</div>
                        <span className="msd-summary-title">Classes Attended</span>
                    </div>
                    <div className="msd-summary-body">
                        <div className="msd-summary-value">{totalClassesAttended} <span className="msd-summary-sub">/ {totalClasses || '-'}</span></div>
                        <div className="msd-summary-footer">
                            <span>Overall</span>
                            <span>{attPct}%</span>
                        </div>
                    </div>
                </div>
                <div className="msd-summary-card">
                    <div className="msd-summary-header">
                        <div className="msd-summary-icon icon-green">📋</div>
                        <span className="msd-summary-title">Assignments</span>
                    </div>
                    <div className="msd-summary-body">
                        <div className="msd-summary-value">{assignmentsCompleted} <span className="msd-summary-sub">/ {assignmentsTotal || '-'}</span></div>
                        <div className="msd-summary-footer">
                            <span>Completed</span>
                            <span>{assignmentsPct}%</span>
                        </div>
                    </div>
                </div>
                <div className="msd-summary-card">
                    <div className="msd-summary-header">
                        <div className="msd-summary-icon icon-yellow">⏱️</div>
                        <span className="msd-summary-title">Exams</span>
                    </div>
                    <div className="msd-summary-body">
                        <div className="msd-summary-value">{examsThisMonth}</div>
                        <div className="msd-summary-footer">
                            <span>This Month</span>
                        </div>
                    </div>
                </div>
                <div className="msd-summary-card">
                    <div className="msd-summary-header">
                        <div className="msd-summary-icon icon-blue">💰</div>
                        <span className="msd-summary-title">Fees</span>
                    </div>
                    <div className="msd-summary-body">
                        <div className="msd-summary-value">₹{fees?.totalDue?.toLocaleString('en-IN') || 0}</div>
                        <div className="msd-summary-footer">
                            <span className={fees?.totalDue > 0 ? "msd-text-danger" : "msd-text-success"}>
                                {fees?.totalDue > 0 ? "Pending" : "All cleared"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Today's Schedule */}
            <div className="msd-section">
                <div className="msd-section-header">
                    <h3>Today's Schedule</h3>
                    <button className="msd-view-all" onClick={() => navigate('/student/timetable')}>
                        View Timetable
                    </button>
                </div>
                {todaySchedule && todaySchedule.length > 0 ? (
                    todaySchedule.map((cls, idx) => (
                        <div key={idx} className="msd-schedule-card">
                            <div className="msd-schedule-time">
                                <span className="msd-time-start">{formatTime(cls.startTime)}</span>
                                <span className="msd-time-end">{formatTime(cls.endTime)}</span>
                            </div>
                            <div className="msd-schedule-divider" />
                            <div className="msd-schedule-info">
                                <span className="msd-schedule-subject">{cls.isBreak ? cls.breakLabel || 'Break' : cls.subject}</span>
                                <span className="msd-schedule-room">
                                    {cls.room ? (cls.room.toLowerCase().includes('room') ? cls.room : `Room ${cls.room}`) : 'Classroom'}
                                </span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="msd-empty-card">
                        <div className="msd-empty-icon" style={{ color: '#c7d2fe' }}>📅</div>
                        <div className="msd-empty-text">
                            <h4>No classes scheduled.</h4>
                            <p>Enjoy your time!</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Recent Announcements */}
            <div className="msd-section">
                <div className="msd-section-header">
                    <h3>Recent Announcements</h3>
                    <button className="msd-view-all" onClick={() => navigate('/student/announcements')}>
                        View All
                    </button>
                </div>
                {announcements && announcements.length > 0 ? (
                    announcements.slice(0, 2).map((ann, idx) => (
                        <div key={ann.id || idx} className="msd-notice-card" onClick={() => navigate('/student/announcements')}>
                            <div className="msd-notice-icon">
                                📣
                            </div>
                            <div className="msd-notice-content">
                                <h4 className="msd-notice-title">{ann.title}</h4>
                                <p className="msd-notice-date">{safeFormatDate(ann.date || ann.createdAt)}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="msd-empty-card">
                        <div className="msd-empty-icon" style={{ color: '#c7d2fe' }}>📢</div>
                        <div className="msd-empty-text">
                            <h4 style={{ color: '#64748b', fontWeight: 500 }}>No announcements yet.</h4>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
