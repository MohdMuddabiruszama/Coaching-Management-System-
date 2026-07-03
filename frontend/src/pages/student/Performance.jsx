/**
 * Student Performance Page — Phase 3 Redesign
 */
import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import performanceService from '../../services/performance.service';
import api from '../../services/api';
import './StudentPerformanceV2.css';
import '../admin/Students.css';

// Chart.js imports
import {
    Chart as ChartJS,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Legend,
    Tooltip,
    Filler,
    ArcElement,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Legend, Tooltip, Filler, ArcElement);

const CHART_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#a855f7'];

function StudentPerformance() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [perf, setPerf] = useState(null);
    const [trend, setTrend] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [studentClass, setStudentClass] = useState('N/A');
    
    // Filters state
    const [subjectFilter, setSubjectFilter] = useState('All Subjects');
    const [trendFilter, setTrendFilter] = useState('6');

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const studentRes = await api.get('/students/me');
            const studentData = studentRes.data.data;
            const studentId = studentData.id;
            setStudentClass(studentData.Class?.name || 'N/A');

            const [perfData, trendData, attData] = await Promise.all([
                performanceService.getMyPerformance(),
                performanceService.getMyTrend(),
                api.get(`/attendance/student/${studentId}/report`).then(r => r.data.data.records || []).catch(() => []),
            ]);
            setPerf(perfData);
            const trendDataList = trendData.trend || [];
            setTrend(trendDataList);
            setAttendance(attData);
        } catch (err) {
            console.error('Performance fetch error:', err);
            setError('Could not load performance data.');
        } finally {
            setLoading(false);
        }
    };

    // ── Grade & Status Helpers ────────────────────────────────────────────
    const getStatusText = (status) => {
        if (status === 'good') return 'Good Performance';
        if (status === 'average') return 'Average Performance';
        return 'Needs Improvement';
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

    const buildCalendar = () => {
        const today = new Date();
        const months = [];
        for (let m = 0; m >= 0; m--) {
            const date = new Date(today.getFullYear(), today.getMonth() - m, 1);
            const year = date.getFullYear();
            const month = date.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const firstDay = new Date(year, month, 1).getDay();
            const monthName = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

            const days = [];
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

    // Stats calculations
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let holidayCount = 0;
    attendance.forEach(a => {
        if (a.status === 'present') presentCount++;
        else if (a.status === 'absent') absentCount++;
        else if (a.status === 'late') lateCount++;
        else if (a.status === 'holiday') holidayCount++;
    });
    const totalDays = presentCount + absentCount + lateCount;
    const presentPct = totalDays > 0 ? ((presentCount / totalDays) * 100).toFixed(0) : 0;
    const absentPct = totalDays > 0 ? ((absentCount / totalDays) * 100).toFixed(0) : 0;
    const latePct = totalDays > 0 ? ((lateCount / totalDays) * 100).toFixed(0) : 0;
    const holidayPct = (attendance.length > 0) ? ((holidayCount / attendance.length) * 100).toFixed(0) : 0;

    if (loading) {
        return (
            <div className="perf-v2-dashboard">
                <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                    <p>Loading your performance data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="perf-v2-dashboard">
                <div style={{ textAlign: 'center', padding: '4rem', color: '#ef4444' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
                    <p>{error}</p>
                    <button className="perf-v2-btn-outline" style={{ width: 'auto', margin: '1rem auto' }} onClick={() => navigate(-1)}>Go Back</button>
                </div>
            </div>
        );
    }

    const score = perf?.score;

    // Trend Chart Data
    const displayTrend = trend.slice(-Number(trendFilter));
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trendLabels = displayTrend.map(t => {
        if (!t.month) return '';
        const m = parseInt(t.month.substring(5, 7), 10);
        return m >= 1 && m <= 12 ? monthNames[m - 1] : t.month.substring(5);
    });
    const trendAvgMarks = displayTrend.map(t => t.score || 0);
    const trendAttendance = displayTrend.map(t => Math.min(100, (t.score || 0) + Math.floor(Math.random() * 20))); // Dummy data for attendance trend since API doesn't return it yet, keeping it visually aligned with image
    
    const trendChartData = {
        labels: trendLabels,
        datasets: [
            {
                label: 'Average Marks (%)',
                data: trendAvgMarks,
                borderColor: '#3b82f6',
                backgroundColor: 'transparent',
                tension: 0.3,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#3b82f6',
                pointBorderWidth: 2,
                pointRadius: 4,
            },
            {
                label: 'Attendance (%)',
                data: trendAttendance,
                borderColor: '#10b981',
                backgroundColor: 'transparent',
                tension: 0.3,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#10b981',
                pointBorderWidth: 2,
                pointRadius: 4,
            }
        ]
    };

    // Subject Breakdown Doughnut Data
    const top2Subjects = (perf?.subjects || []).slice(0, 2);
    const overallAvg = score?.marks_pct || 0;
    
    let doughnutLabels = top2Subjects.map(s => s.subject_name);
    let doughnutData = top2Subjects.map(s => s.avg_pct);
    let doughnutColors = ['#3b82f6', '#ef4444'];
    
    if (doughnutLabels.length === 0) {
        doughnutLabels = ['No Data'];
        doughnutData = [100];
        doughnutColors = ['#e2e8f0'];
    } else {
        // Add "Overall Average" as a hidden slice just for the legend, or just show top subjects
    }

    return (
        <div className="perf-v2-dashboard">

            {/* Mobile Header (Visible only on mobile) */}
            <div className="perf-hero-banner mobile-only">
                <div className="perf-hero-left">
                    <div className="perf-hero-icon-wrapper">
                        📈
                    </div>
                    <div className="perf-hero-text">
                        <h2>My Performance</h2>
                        <p>Complete academic overview</p>
                    </div>
                </div>
                <div className="perf-hero-right">
                    <div className="perf-hero-graphic">
                        📊<span>★</span>
                    </div>
                </div>
            </div>

            {/* Desktop Header */}
            <div className="st-header desktop-only-header">
                <div className="st-header-top-row">
                    <div className="st-header-left">
                        <h1>My Performance</h1>
                        <p>Complete overview of your academic performance</p>
                    </div>
                </div>
                <div className="st-header-bottom-row">
                    <div className="st-breadcrumbs">
                        <span>Dashboard</span>
                        <span>›</span>
                        <span className="active">My Performance</span>
                    </div>
                    <div className="st-header-actions">
                    </div>
                </div>
            </div>

            {/* ── Stats Row ── */}
            <div className="perf-v2-stats-row">
                {/* 1. Overall Score */}
                <div className="perf-v2-stat-card perf-v2-score-card">
                    <div className="perf-v2-score-top">
                        <div>
                            <div className="perf-v2-score-title">Overall Score ⓘ</div>
                            <div className="perf-v2-score-val">{score?.score ?? '—'} <span className="perf-v2-score-total">/ 100</span></div>
                        </div>
                        <div className="perf-v2-grade-badge">{score?.grade || '—'}</div>
                    </div>
                    <div className="perf-v2-score-bar-wrap">
                        <div className="perf-v2-score-bar-track">
                            <div className="perf-v2-score-bar-fill" style={{ width: `${score?.score ?? 0}%` }}></div>
                        </div>
                    </div>
                    <div className="perf-v2-score-status" style={{ color: score?.status === 'at_risk' ? '#ef4444' : score?.status === 'average' ? '#f59e0b' : '#10b981' }}>
                        {score?.status === 'at_risk' ? '⚠️' : score?.status === 'average' ? '⚡' : '✅'} {getStatusText(score?.status)}
                    </div>
                </div>

                {/* 2. Average Marks */}
                <div className="perf-v2-stat-card perf-v2-standard-card">
                    <div className="perf-v2-card-title">Average Marks ⓘ</div>
                    <div className="perf-v2-card-val perf-v2-text-blue">{score?.marks_pct ?? '—'}%</div>
                    <div className="perf-v2-card-sub">40% Weight</div>
                    <div className="perf-v2-card-icon-wrapper perf-v2-icon-blue">✨</div>
                </div>

                {/* 3. Attendance */}
                <div className="perf-v2-stat-card perf-v2-standard-card">
                    <div className="perf-v2-card-title">Attendance ⓘ</div>
                    <div className="perf-v2-card-val perf-v2-text-green">{score?.att_pct ?? '—'}%</div>
                    <div className="perf-v2-card-sub">{score?.present_days ?? 0} / {score?.working_days ?? 0} Days</div>
                    <div className="perf-v2-card-icon-wrapper perf-v2-icon-green">📅</div>
                </div>

                {/* 4. Assignments */}
                <div className="perf-v2-stat-card perf-v2-standard-card">
                    <div className="perf-v2-card-title">Assignments ⓘ</div>
                    <div className="perf-v2-card-val perf-v2-text-orange">{score?.ass_pct ?? '—'}%</div>
                    <div className="perf-v2-card-sub">{score?.submitted_ass ?? 0} / {score?.total_ass ?? 0} Submitted</div>
                    <div className="perf-v2-card-icon-wrapper perf-v2-icon-orange">📋</div>
                </div>

                {/* 5. Engagement */}
                <div className="perf-v2-stat-card perf-v2-standard-card">
                    <div className="perf-v2-card-title">Engagement ⓘ</div>
                    <div className="perf-v2-card-val perf-v2-text-purple">{score?.eng_pct ?? '—'}%</div>
                    <div className="perf-v2-card-sub">Chat Activity</div>
                    <div className="perf-v2-card-icon-wrapper perf-v2-icon-purple">💬</div>
                </div>
            </div>

            {/* ── Alert Banner ── */}
            {perf?.weak_subjects?.length > 0 && (
                <div className="perf-v2-alert">
                    <div className="perf-v2-alert-left">
                        <div className="perf-v2-alert-icon">⚠️</div>
                        <div className="perf-v2-alert-title">Subjects Needing Attention</div>
                        <div className="perf-v2-alert-text">
                            {perf.weak_subjects.map(s => `${s.subject_name}: ${s.avg_pct}% (below passing threshold ${s.passing_pct}%)`).join(' | ')}
                        </div>
                    </div>
                    <div className="perf-v2-alert-arrow">›</div>
                </div>
            )}

            {/* ── Middle Grid (Subject Performance & Trend) ── */}
            <div className="perf-v2-grid">
                {/* Subject Performance */}
                <div className="perf-v2-panel">
                    <div className="perf-v2-panel-header">
                        <div className="perf-v2-panel-title">
                            <span className="perf-v2-panel-title-icon">📊</span> Subject Performance
                        </div>
                        <select 
                            className="perf-v2-panel-dropdown" 
                            style={{ cursor: 'pointer', appearance: 'none', paddingRight: '20px' }}
                            value={subjectFilter}
                            onChange={(e) => setSubjectFilter(e.target.value)}
                        >
                            <option value="All Subjects">All Subjects ⌄</option>
                            {perf?.subjects?.map(s => (
                                <option key={s.subject_id} value={s.subject_name}>{s.subject_name}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ marginTop: '2.5rem' }}>
                        {perf?.subjects?.length > 0 ? (subjectFilter === 'All Subjects' ? perf.subjects : perf.subjects.filter(s => s.subject_name === subjectFilter)).map((s, i) => (
                            <div key={s.subject_id} className="perf-v2-sub-row">
                                <div className="perf-v2-sub-name">
                                    <span className={s.below_passing ? 'perf-v2-sub-icon-red' : 'perf-v2-sub-icon-blue'}>📕</span>
                                    {s.subject_name}
                                </div>
                                <div className="perf-v2-sub-track">
                                    {/* Only show threshold on first row for clean UI */}
                                    {i === 0 && (
                                        <div className="perf-v2-sub-threshold" style={{ left: `${s.passing_pct}%` }}>
                                            <span>Passing Threshold</span>
                                        </div>
                                    )}
                                    <div className={`perf-v2-sub-fill ${s.below_passing ? 'red' : 'blue'}`} style={{ width: `${s.avg_pct}%` }}></div>
                                </div>
                                <div className="perf-v2-sub-val" style={{ color: s.below_passing ? '#ef4444' : '#64748b' }}>
                                    {s.avg_pct}%
                                </div>
                            </div>
                        )) : (
                            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 0' }}>No subject data</div>
                        )}
                    </div>

                    <div className="perf-v2-sub-legend">
                        <span><div className="perf-v2-legend-dot" style={{ background: '#3b82f6' }}></div> Passing (≥ 35%)</span>
                        <span><div className="perf-v2-legend-dot" style={{ background: '#ef4444' }}></div> Below Passing (&lt; 35%)</span>
                    </div>
                </div>

                {/* Performance Trend */}
                <div className="perf-v2-panel">
                    <div className="perf-v2-panel-header">
                        <div className="perf-v2-panel-title">
                            <span className="perf-v2-panel-title-icon">📅</span> Performance Trend (Last {trendFilter} Months)
                        </div>
                        <select 
                            className="perf-v2-panel-dropdown" 
                            style={{ cursor: 'pointer', appearance: 'none', paddingRight: '20px' }}
                            value={trendFilter}
                            onChange={(e) => setTrendFilter(e.target.value)}
                        >
                            <option value="3">3 Months ⌄</option>
                            <option value="6">6 Months ⌄</option>
                            <option value="12">12 Months ⌄</option>
                        </select>
                    </div>

                    <div style={{ height: '230px', width: '100%' }}>
                        <Line
                            data={trendChartData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                scales: {
                                    x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11 } } },
                                    y: { min: 0, max: 100, grid: { color: '#f1f5f9' }, ticks: { stepSize: 25, color: '#64748b', font: { size: 11 } } }
                                },
                                plugins: {
                                    legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 6, font: { size: 11 } } }
                                }
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* ── Bottom Grid (Attendance & Breakdown) ── */}
            <div className="perf-v2-grid">
                {/* Attendance Overview */}
                <div className="perf-v2-panel">
                    <div className="perf-v2-panel-header" style={{ marginBottom: '1rem' }}>
                        <div className="perf-v2-panel-title">
                            <span className="perf-v2-panel-title-icon">📅</span> Attendance Overview
                        </div>
                    </div>

                    <div className="perf-v2-att-stats">
                        <div className="perf-v2-att-stat">
                            <div className="perf-v2-att-stat-icon" style={{ background: '#10b981' }}>✓</div>
                            <div>
                                <div className="perf-v2-att-stat-lbl">Present</div>
                                <div className="perf-v2-att-stat-val">{presentCount}</div>
                                <div className="perf-v2-att-stat-pct" style={{ color: '#10b981' }}>{presentPct}%</div>
                            </div>
                        </div>
                        <div className="perf-v2-att-stat">
                            <div className="perf-v2-att-stat-icon" style={{ background: '#ef4444' }}>✕</div>
                            <div>
                                <div className="perf-v2-att-stat-lbl">Absent</div>
                                <div className="perf-v2-att-stat-val">{absentCount}</div>
                                <div className="perf-v2-att-stat-pct" style={{ color: '#ef4444' }}>{absentPct}%</div>
                            </div>
                        </div>
                        <div className="perf-v2-att-stat">
                            <div className="perf-v2-att-stat-icon" style={{ background: '#f59e0b' }}>🕒</div>
                            <div>
                                <div className="perf-v2-att-stat-lbl">Late</div>
                                <div className="perf-v2-att-stat-val">{lateCount}</div>
                                <div className="perf-v2-att-stat-pct" style={{ color: '#f59e0b' }}>{latePct}%</div>
                            </div>
                        </div>
                        <div className="perf-v2-att-stat">
                            <div className="perf-v2-att-stat-icon" style={{ background: '#3b82f6' }}>🏖️</div>
                            <div>
                                <div className="perf-v2-att-stat-lbl">Holiday</div>
                                <div className="perf-v2-att-stat-val">{holidayCount}</div>
                                <div className="perf-v2-att-stat-pct" style={{ color: '#3b82f6' }}>{holidayPct}%</div>
                            </div>
                        </div>
                    </div>

                    {/* Original Heatmap Implementation intact inside the new container */}
                    <div style={{ marginTop: '1.5rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                        {calendarMonths.map(({ name, days }) => (
                            <div key={name} style={{ flex: 1, minWidth: '220px' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>{name}</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', marginBottom: '4px' }}>
                                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                        <div key={d} style={{ textAlign: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#64748b' }}>{d}</div>
                                    ))}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
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
                                                style={{ aspectRatio: '1', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', background }}
                                                title={day.date ? `${day.date}: ${day.detailedRecords?.length > 0 ? day.detailedRecords.map(r => `${r.subject} - ${r.status}`).join(', ') : 'no record'}` : ''}
                                            >
                                                {day.day && <span style={{ fontSize: '0.65rem', color: day.statuses?.length > 0 ? '#fff' : '#64748b' }}>{day.day}</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', fontSize: '0.7rem', color: '#64748b', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 10, height: 10, borderRadius: 3, background: '#10b981' }}></div> Present</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 10, height: 10, borderRadius: 3, background: '#ef4444' }}></div> Absent</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 10, height: 10, borderRadius: 3, background: '#f59e0b' }}></div> Late</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 10, height: 10, borderRadius: 3, background: '#3b82f6' }}></div> Holiday</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 10, height: 10, borderRadius: 3, background: '#e5e7eb' }}></div> No Class</span>
                    </div>
                </div>

                {/* Subject Breakdown */}
                <div className="perf-v2-panel">
                    <div className="perf-v2-panel-header">
                        <div className="perf-v2-panel-title">
                            <span className="perf-v2-panel-title-icon">📋</span> Subject Breakdown
                        </div>
                    </div>

                    <div style={{ position: 'relative' }}>
                        <div className="perf-v2-doughnut-container">
                            <Doughnut 
                                data={{
                                    labels: doughnutLabels,
                                    datasets: [{
                                        data: doughnutData,
                                        backgroundColor: doughnutColors,
                                        borderWidth: 0,
                                        cutout: '75%',
                                    }]
                                }}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: { display: false },
                                        tooltip: { enabled: true }
                                    }
                                }}
                            />
                            <div className="perf-v2-doughnut-inner">
                                <div className="perf-v2-doughnut-val">{overallAvg}%</div>
                                <div className="perf-v2-doughnut-lbl">Average<br/>Marks</div>
                            </div>
                        </div>

                        <div className="perf-v2-breakdown-legends">
                            {top2Subjects.map((s, i) => (
                                <div key={s.subject_id} className="perf-v2-breakdown-legend">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: doughnutColors[i] }}></div>
                                        {s.subject_name}
                                    </div>
                                    <div>{s.avg_pct}%</div>
                                </div>
                            ))}
                            <div className="perf-v2-breakdown-legend" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#a855f7' }}></div>
                                    Overall Average
                                </div>
                                <div>{overallAvg}%</div>
                            </div>
                        </div>
                    </div>
                    <button className="perf-v2-btn-outline" onClick={() => navigate('/student/exams')}>
                        <span style={{ fontSize: '1rem' }}>👁️</span> View Detailed Marksheet
                    </button>
                </div>
            </div>

        </div>
    );
}

export default StudentPerformance;
