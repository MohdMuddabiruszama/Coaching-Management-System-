/**
 * Student Performance Page — Phase 3
 * 4 sections: Score cards · Weak subject alerts · Subject trend chart · Attendance heatmap
 */
import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import performanceService from '../../services/performance.service';
import api from '../../services/api';
import '../admin/Dashboard.css';
import './Performance.css';

function StudentPerformance() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [perf, setPerf] = useState(null);
    const [trend, setTrend] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            // Fetch student info first to get the ID for the attendance report
            const studentRes = await api.get('/students/me');
            const studentId = studentRes.data.data.id;

            const [perfData, trendData, attData] = await Promise.all([
                performanceService.getMyPerformance(),
                performanceService.getMyTrend(),
                api.get(`/attendance/student/${studentId}/report`).then(r => r.data.data.records || []).catch(() => []),
            ]);
            setPerf(perfData);
            setTrend(trendData.trend || []);
            setAttendance(attData);
        } catch (err) {
            console.error('Performance fetch error:', err);
            setError('Could not load performance data.');
        } finally {
            setLoading(false);
        }
    };

    // ── Grade colors ──────────────────────────────────────────────────────
    const gradeColor = (grade) => {
        const map = { 'A+': '#10b981', 'A': '#22c55e', 'B+': '#84cc16', 'B': '#eab308', 'C': '#f97316', 'D': '#ef4444', 'F': '#dc2626' };
        return map[grade] || '#6b7280';
    };

    const statusColor = (status) => {
        if (status === 'good') return '#10b981';
        if (status === 'average') return '#f59e0b';
        return '#ef4444';
    };

    const statusLabel = (status) => {
        if (status === 'good') return '✅ Good';
        if (status === 'average') return '⚡ Average';
        return '⚠️ At Risk';
    };

    // ── Attendance heatmap data ───────────────────────────────────────────
    const getHeatmapColor = (status) => {
        if (!status) return 'var(--border-color, #e5e7eb)';
        if (status === 'present') return '#10b981';
        if (status === 'absent') return '#ef4444';
        if (status === 'late') return '#f59e0b';
        if (status === 'holiday') return '#3b82f6';
        return 'var(--border-color, #e5e7eb)';
    };

    // Build last 2 months calendar
    const buildCalendar = () => {
        const today = new Date();
        const months = [];
        for (let m = 1; m >= 0; m--) {
            const date = new Date(today.getFullYear(), today.getMonth() - m, 1);
            const year = date.getFullYear();
            const month = date.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const firstDay = new Date(year, month, 1).getDay();
            const monthName = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

            const days = [];
            // Empty slots for first week alignment
            for (let i = 0; i < firstDay; i++) days.push({ date: null, status: null });
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                
                const dayRecords = Array.isArray(attendance) ? attendance.filter(a => {
                    if (!a.date) return false;
                    const aDateStr = typeof a.date === 'string' ? a.date.split('T')[0] : new Date(a.date).toISOString().split('T')[0];
                    return aDateStr === dateStr;
                }) : [];
                
                let dayStatuses = [];
                let dayDetailedRecords = [];
                if (dayRecords.length > 0) {
                    dayStatuses = dayRecords.map(r => r.status);
                    dayDetailedRecords = dayRecords.map(r => ({
                        status: r.status,
                        subject: r.Subject?.name || r.Class?.name || 'General'
                    }));
                }

                days.push({ date: dateStr, day: d, statuses: dayStatuses, detailedRecords: dayDetailedRecords });
            }
            months.push({ name: monthName, days });
        }
        return months;
    };

    const calendarMonths = buildCalendar();

    // ── Trend chart (pure CSS bar chart) ─────────────────────────────────
    const maxScore = Math.max(...trend.map(t => t.score), 100);

    if (loading) {
        return (
            <div className="dashboard-container">
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                    <p>Loading your performance data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard-container">
                <div style={{ textAlign: 'center', padding: '4rem', color: '#ef4444' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
                    <p>{error}</p>
                    <button className="btn btn-primary" onClick={() => navigate(-1)}>Go Back</button>
                </div>
            </div>
        );
    }

    const score = perf?.score;

    return (
        <div className="dashboard-container perf-page">

            {/* ── Header ── */}
            <div className="dashboard-header" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                        onClick={() => navigate('/student/dashboard')}
                        style={{ background: 'none', border: '1.5px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem 0.85rem', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 600 }}
                    >
                        ← Back
                    </button>
                    <div>
                        <h1 style={{ margin: 0 }}>📊 My Performance</h1>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Overall report across marks, attendance &amp; assignments
                        </p>
                    </div>
                </div>
            </div>

            {/* ─────────────────────────────────────────────────────────── */}
            {/* SECTION 1 — Score Card Row                                 */}
            {/* ─────────────────────────────────────────────────────────── */}
            <div className="perf-score-row">
                {/* Main score circle */}
                <div className="perf-main-score-card">
                    <div className="perf-score-circle" style={{ borderColor: statusColor(score?.status) }}>
                        <span className="perf-score-number" style={{ color: statusColor(score?.status) }}>{score?.score ?? '—'}</span>
                        <span className="perf-score-label">/ 100</span>
                    </div>
                    <div className="perf-grade-badge" style={{ background: gradeColor(score?.grade) }}>
                        {score?.grade || '—'}
                    </div>
                    <div className="perf-status-label" style={{ color: statusColor(score?.status) }}>
                        {statusLabel(score?.status)}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                        Overall Performance Score
                    </div>
                </div>

                {/* Metric cards */}
                <div className="perf-metric-cards">
                    <div className="perf-metric-card" style={{ borderTop: '4px solid #6366f1' }}>
                        <div className="perf-metric-icon">📝</div>
                        <div className="perf-metric-value" style={{ color: '#6366f1' }}>{score?.marks_pct ?? '—'}%</div>
                        <div className="perf-metric-label">Avg Marks</div>
                        <div className="perf-metric-sub">40% weight</div>
                    </div>
                    <div className="perf-metric-card" style={{ borderTop: `4px solid ${(score?.att_pct ?? 100) >= 75 ? '#10b981' : '#ef4444'}` }}>
                        <div className="perf-metric-icon">📋</div>
                        <div className="perf-metric-value" style={{ color: (score?.att_pct ?? 100) >= 75 ? '#10b981' : '#ef4444' }}>{score?.att_pct ?? '—'}%</div>
                        <div className="perf-metric-label">Attendance</div>
                        <div className="perf-metric-sub">{score?.present_days ?? 0} / {score?.working_days ?? 0} days</div>
                    </div>
                    <div className="perf-metric-card" style={{ borderTop: '4px solid #f59e0b' }}>
                        <div className="perf-metric-icon">📌</div>
                        <div className="perf-metric-value" style={{ color: '#f59e0b' }}>{score?.ass_pct ?? '—'}%</div>
                        <div className="perf-metric-label">Assignments</div>
                        <div className="perf-metric-sub">{score?.submitted_ass ?? 0} / {score?.total_ass ?? 0} submitted</div>
                    </div>
                    <div className="perf-metric-card" style={{ borderTop: '4px solid #a855f7' }}>
                        <div className="perf-metric-icon">💬</div>
                        <div className="perf-metric-value" style={{ color: '#a855f7' }}>{score?.eng_pct ?? '—'}%</div>
                        <div className="perf-metric-label">Engagement</div>
                        <div className="perf-metric-sub">Chat activity</div>
                    </div>
                </div>
            </div>

            {/* ─────────────────────────────────────────────────────────── */}
            {/* SECTION 2 — Weak Subjects Alert                            */}
            {/* ─────────────────────────────────────────────────────────── */}
            {perf?.weak_subjects?.length > 0 && (
                <div className="perf-alert-banner">
                    <div className="perf-alert-icon">⚠️</div>
                    <div>
                        <div className="perf-alert-title">Subjects Needing Attention</div>
                        <div className="perf-alert-subjects">
                            {perf.weak_subjects.map(s => (
                                <span key={s.subject_id} className="perf-alert-chip">
                                    {s.subject_name}: {s.avg_pct}% <span style={{ opacity: 0.7 }}>(pass: {s.passing_pct}%)</span>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ─────────────────────────────────────────────────────────── */}
            {/* SECTION 3 — Subject Performance (Bar Chart)                */}
            {/* ─────────────────────────────────────────────────────────── */}
            {perf?.subjects?.length > 0 && (
                <div className="perf-card" style={{ marginTop: '1.5rem' }}>
                    <h3 className="perf-card-title">📈 Subject Performance</h3>
                    <div className="perf-subject-bars">
                        {perf.subjects.map(s => (
                            <div key={s.subject_id} className="perf-subject-bar-row">
                                <div className="perf-subject-bar-label">{s.subject_name}</div>
                                <div className="perf-subject-bar-track">
                                    {/* Passing threshold marker */}
                                    <div
                                        className="perf-passing-line"
                                        style={{ left: `${s.passing_pct}%` }}
                                        title={`Pass: ${s.passing_pct}%`}
                                    />
                                    <div
                                        className="perf-subject-bar-fill"
                                        style={{
                                            width: `${s.avg_pct}%`,
                                            background: s.below_passing
                                                ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                                                : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                                        }}
                                    />
                                </div>
                                <div className="perf-subject-bar-value" style={{ color: s.below_passing ? '#ef4444' : '#6366f1' }}>
                                    {s.avg_pct}%
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span>
                            <span style={{ display: 'inline-block', width: 12, height: 12, borderLeft: '2px dashed #94a3b8', marginRight: 4 }} />
                            Passing threshold
                        </span>
                        <span>
                            <span style={{ display: 'inline-block', width: 12, height: 8, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius: 4, marginRight: 4 }} />
                            Passing
                        </span>
                        <span>
                            <span style={{ display: 'inline-block', width: 12, height: 8, background: 'linear-gradient(90deg,#ef4444,#dc2626)', borderRadius: 4, marginRight: 4 }} />
                            Below passing
                        </span>
                    </div>
                </div>
            )}

            {/* ─────────────────────────────────────────────────────────── */}
            {/* SECTION 3B — 6-month Trend Chart (CSS bar chart)           */}
            {/* ─────────────────────────────────────────────────────────── */}
            {trend.length > 0 && (
                <div className="perf-card" style={{ marginTop: '1.5rem' }}>
                    <h3 className="perf-card-title">📅 Performance Trend (Last 6 months)</h3>
                    <div className="perf-trend-chart">
                        {trend.map(t => (
                            <div key={t.month} className="perf-trend-bar-col">
                                <div className="perf-trend-bar-val">{t.score}</div>
                                <div className="perf-trend-bar-wrap">
                                    <div
                                        className="perf-trend-bar"
                                        style={{
                                            height: `${(t.score / maxScore) * 100}%`,
                                            background: t.score >= 75
                                                ? 'linear-gradient(180deg, #10b981, #059669)'
                                                : t.score >= 50
                                                    ? 'linear-gradient(180deg, #f59e0b, #d97706)'
                                                    : 'linear-gradient(180deg, #ef4444, #dc2626)',
                                        }}
                                    />
                                </div>
                                <div className="perf-trend-bar-month">
                                    {t.month ? t.month.substring(5) : ''}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─────────────────────────────────────────────────────────── */}
            {/* SECTION 4 — Attendance Heatmap                             */}
            {/* ─────────────────────────────────────────────────────────── */}
            <div className="perf-card" style={{ marginTop: '1.5rem' }}>
                <h3 className="perf-card-title">📆 Attendance Heatmap</h3>
                <div className="perf-heatmap-legend">
                    {[
                        { color: '#10b981', label: 'Present' },
                        { color: '#ef4444', label: 'Absent' },
                        { color: '#f59e0b', label: 'Late' },
                        { color: '#3b82f6', label: 'Holiday' },
                        { color: 'var(--border-color, #e5e7eb)', label: 'No class' },
                    ].map(({ color, label }) => (
                        <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                            <span style={{ width: 12, height: 12, borderRadius: 3, background: color, display: 'inline-block' }} />
                            {label}
                        </span>
                    ))}
                </div>
                <div className="perf-heatmap-months">
                    {calendarMonths.map(({ name, days }) => (
                        <div key={name} className="perf-heatmap-month">
                            <div className="perf-heatmap-month-name">{name}</div>
                            <div className="perf-heatmap-weekdays">
                                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                    <div key={d} className="perf-heatmap-weekday">{d}</div>
                                ))}
                            </div>
                            <div className="perf-heatmap-grid">
                                {days.map((day, i) => {
                                    let background = 'transparent';
                                    if (day.date) {
                                        if (day.statuses && day.statuses.length === 1) {
                                            background = getHeatmapColor(day.statuses[0]);
                                        } else if (day.statuses && day.statuses.length > 1) {
                                            const step = 100 / day.statuses.length;
                                            const stops = day.statuses.map((s, idx) => {
                                                const color = getHeatmapColor(s);
                                                return `${color} ${idx * step}%, ${color} ${(idx + 1) * step}%`;
                                            });
                                            background = `linear-gradient(to bottom, ${stops.join(', ')})`;
                                        } else {
                                            background = getHeatmapColor(null);
                                        }
                                    }

                                    return (
                                        <div
                                            key={i}
                                            className="perf-heatmap-day"
                                            style={{ background }}
                                            title={day.date ? `${day.date}: ${day.detailedRecords?.length > 0 ? day.detailedRecords.map(r => `${r.subject} - ${r.status}`).join(', ') : 'no record'}` : ''}
                                        >
                                            {day.day && <span style={{ position: 'relative', zIndex: 1, fontSize: '0.65rem', color: day.statuses?.length > 0 ? '#fff' : 'var(--text-secondary)' }}>{day.day}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
}

export default StudentPerformance;
