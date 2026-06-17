import { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import markService from '../../services/mark.service';
import './StudentMarks.css';
import '../admin/Students.css';

// ─── Chart.js setup ───────────────────────────────────────────
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

// ─── Constants ────────────────────────────────────────────────
const EXAM_TYPE_LABELS = {
    unit_test: 'Unit Test', midterm: 'Mid-Term', final: 'Final',
    mock: 'Mock', practical: 'Practical', other: 'Other',
};

const EXAM_TYPE_COLORS = {
    unit_test: { bg: '#e0e7ff', color: '#4f46e5' },
    midterm:   { bg: '#fae8ff', color: '#c026d3' },
    final:     { bg: '#ffe4e6', color: '#e11d48' },
    mock:      { bg: '#fef3c7', color: '#d97706' },
    practical: { bg: '#dcfce7', color: '#16a34a' },
    other:     { bg: '#f1f5f9', color: '#475569' },
};

const CHART_COLORS = ['#6366f1', '#22c55e', '#ef4444', '#a855f7', '#f97316', '#0ea5e9'];

// ─── Scorecard Modal ─────────────────────────────────────────
function ScorecardModal({ examName, onClose }) {
    const [sc, setSc] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        setLoading(true);
        markService.getScorecard(examName)
            .then(data => { setSc(data); setLoading(false); })
            .catch(err => {
                setError(err.response?.data?.message || 'Failed to load scorecard');
                setLoading(false);
            });
    }, [examName]);

    const handleDownloadPDF = async () => {
        setDownloading(true);
        try {
            await markService.downloadPDF(examName);
        } catch (err) {
            alert('Failed to download PDF. Please try again.');
        } finally {
            setDownloading(false);
        }
    };

    const overlayStyle = {
        position: 'fixed', inset: 0,
        background: 'rgba(15, 23, 42, 0.7)', zIndex: 1100,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '2rem 1rem', overflowY: 'auto', backdropFilter: 'blur(4px)'
    };

    const panelStyle = {
        background: '#fff',
        borderRadius: '16px',
        width: '100%', maxWidth: '750px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
    };

    const headerStyle = {
        background: '#fff',
        borderBottom: '1px solid #e2e8f0',
        padding: '20px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    };

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={panelStyle} onClick={e => e.stopPropagation()}>
                <div style={headerStyle}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>📋 Scorecard — {examName}</h3>
                        {sc && (
                            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                                {new Date(sc.exam_date).toLocaleDateString('en-GB')} ·{' '}
                                {EXAM_TYPE_LABELS[sc.exam_type] || sc.exam_type}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: '#f1f5f9', border: 'none', color: '#64748b', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px' }}
                    >
                        ✕
                    </button>
                </div>

                <div style={{ padding: '24px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>⏳ Loading scorecard...</div>
                    ) : error ? (
                        <div style={{ color: '#ef4444', textAlign: 'center', padding: '2rem' }}>{error}</div>
                    ) : !sc ? (
                        <div style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>No scorecard data available.</div>
                    ) : (
                        <>
                            <div className="desktop-only-table" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                    <thead>
                                        <tr style={{ background: '#f8fafc', color: '#64748b' }}>
                                            {['Subject', 'Marks', 'Total', 'Percentage', 'Grade', 'Status'].map(h => (
                                                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sc.subjects.map((s, i) => (
                                            <tr key={s.subject} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#334155' }}>{s.subject}</td>
                                                <td style={{ padding: '12px 16px', color: '#0f172a', fontWeight: 500 }}>{s.marks_obtained}</td>
                                                <td style={{ padding: '12px 16px', color: '#64748b' }}>{s.total_marks}</td>
                                                <td style={{ padding: '12px 16px', color: '#334155' }}>{s.percentage}%</td>
                                                <td style={{ padding: '12px 16px', fontWeight: 700, color: s.status === 'Pass' ? '#22c55e' : '#ef4444' }}>{s.grade}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <span style={{
                                                        background: s.status === 'Pass' ? '#dcfce7' : '#fee2e2',
                                                        color: s.status === 'Pass' ? '#16a34a' : '#e11d48',
                                                        borderRadius: '6px', padding: '4px 10px', fontWeight: 600, fontSize: '12px',
                                                    }}>
                                                        {s.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ background: '#f1f5f9', fontWeight: 700, color: '#0f172a' }}>
                                            <td style={{ padding: '14px 16px' }}>OVERALL TOTAL</td>
                                            <td style={{ padding: '14px 16px' }}>{sc.total_obtained}</td>
                                            <td style={{ padding: '14px 16px', color: '#64748b' }}>{sc.total_maximum}</td>
                                            <td style={{ padding: '14px 16px' }}>{sc.overall_percentage}%</td>
                                            <td style={{ padding: '14px 16px', color: sc.overall_status === 'Pass' ? '#22c55e' : '#ef4444' }}>{sc.overall_grade}</td>
                                            <td style={{ padding: '14px 16px' }}>
                                                <span style={{
                                                    background: sc.overall_status === 'Pass' ? '#dcfce7' : '#fee2e2',
                                                    color: sc.overall_status === 'Pass' ? '#16a34a' : '#e11d48',
                                                    borderRadius: '6px', padding: '4px 10px', fontWeight: 600, fontSize: '12px'
                                                }}>
                                                    {sc.overall_status}
                                                </span>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            <div className="mobile-only-cards" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {sc.subjects.map((s, i) => (
                                    <div key={s.subject} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                            <strong style={{ color: '#0f172a', fontSize: '15px' }}>{s.subject}</strong>
                                            <span style={{
                                                background: s.status === 'Pass' ? '#dcfce7' : '#fee2e2',
                                                color: s.status === 'Pass' ? '#16a34a' : '#e11d48',
                                                borderRadius: '8px', padding: '4px 10px', fontSize: '12px', fontWeight: 600
                                            }}>{s.status}</span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#fff', padding: '12px', borderRadius: '8px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Marks</span>
                                                <span style={{ fontSize: '14px', color: '#0f172a', fontWeight: 600 }}>{s.marks_obtained} <span style={{ color: '#94a3b8', fontSize: '12px' }}>/ {s.total_marks}</span></span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Percentage</span>
                                                <span style={{ fontSize: '14px', color: '#0f172a', fontWeight: 600 }}>{s.percentage}%</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Grade</span>
                                                <span style={{ fontSize: '14px', fontWeight: 700, color: s.status === 'Pass' ? '#22c55e' : '#ef4444' }}>{s.grade}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <div style={{ background: '#f1f5f9', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '16px', marginTop: '4px' }}>
                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>OVERALL RESULT</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                                        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Total Marks</span>
                                        <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{sc.total_obtained} <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>/ {sc.total_maximum}</span></span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                                        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Percentage</span>
                                        <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{sc.overall_percentage}%</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Grade</span>
                                            <strong style={{ color: sc.overall_status === 'Pass' ? '#22c55e' : '#ef4444', fontSize: '16px' }}>{sc.overall_grade}</strong>
                                        </div>
                                        <span style={{
                                            background: sc.overall_status === 'Pass' ? '#dcfce7' : '#fee2e2',
                                            color: sc.overall_status === 'Pass' ? '#16a34a' : '#e11d48',
                                            borderRadius: '8px', padding: '4px 12px', fontSize: '13px', fontWeight: 700
                                        }}>{sc.overall_status}</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleDownloadPDF}
                                disabled={downloading}
                                style={{
                                    marginTop: '20px',
                                    background: '#6366f1',
                                    color: '#fff', border: 'none',
                                    padding: '12px 24px', borderRadius: '8px',
                                    cursor: downloading ? 'not-allowed' : 'pointer',
                                    fontWeight: 600, fontSize: '14px',
                                    width: '100%',
                                    transition: 'background 0.2s'
                                }}
                            >
                                {downloading ? '⏳ Generating PDF...' : '📄 Download Result Card PDF'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Performance Trend Chart ─────────────────────────────────
function PerformanceTrendChart({ trend }) {
    if (!trend || trend.length === 0) return (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Not enough data for performance trend.</div>
    );

    const subjects = [...new Set(trend.map(t => t.subject_name))];
    const labels   = [...new Set(trend.map(t => t.exam_name))];

    const datasets = subjects.map((sub, i) => ({
        label: sub,
        data: labels.map(lbl => {
            const e = trend.find(t => t.subject_name === sub && t.exam_name === lbl);
            return e ? parseFloat(e.percentage) : null;
        }),
        borderColor: CHART_COLORS[i % CHART_COLORS.length],
        backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + '20',
        tension: 0.3,
        fill: false,
        spanGaps: true,
        pointRadius: 4,
        pointBackgroundColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
    }));

    return (
        <div style={{ padding: '0 0 16px 0', height: '260px' }}>
            <Line
                data={{ labels, datasets }}
                options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            grid: { display: false, drawBorder: false },
                            ticks: { color: '#94a3b8', font: { size: 12 } }
                        },
                        y: {
                            min: 0,
                            max: 100,
                            border: { display: false },
                            grid: { color: '#f1f5f9', drawBorder: false },
                            ticks: { callback: v => v + '%', color: '#94a3b8', font: { size: 12 }, stepSize: 25 },
                        },
                    },
                    plugins: {
                        legend: { 
                            position: 'top', 
                            labels: { usePointStyle: true, boxWidth: 8, padding: 20, color: '#64748b', font: { size: 12, weight: 600 } }
                        },
                        tooltip: {
                            backgroundColor: '#1e293b',
                            padding: 12,
                            titleFont: { size: 13, weight: 600 },
                            bodyFont: { size: 13 },
                            callbacks: {
                                label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}%`,
                            },
                        },
                    },
                }}
            />
        </div>
    );
}

// ─── Main ViewMarks Page ──────────────────────────────────────
function ViewMarks() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [marks, setMarks] = useState([]);
    const [trend, setTrend] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [scorecardExam, setScorecardExam] = useState(null);

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        setError('');
        try {
            const [marksData, trendData] = await Promise.all([
                markService.getAll(),
                markService.getTrend().catch(() => []),
            ]);
            setMarks(marksData || []);
            setTrend(trendData || []);
        } catch (err) {
            setError('Failed to load marks. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="marks-dashboard" style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
            <div className="spinner"></div>
        </div>
    );

    if (error) return (
        <div className="marks-dashboard" style={{ color: 'red' }}>{error}</div>
    );

    // Calculate Stats
    const totalRecords = marks.length;
    let passedCount = 0;
    let failedCount = 0;
    let totalPercentage = 0;
    let bestRank = Infinity;
    let totalInClass = 0;

    // To get unique exams for "Exams Taken"
    const uniqueExams = new Set();
    
    marks.forEach(m => {
        if (!m.is_absent) {
            uniqueExams.add(m.exam_name);
            if (m.status === 'Pass') passedCount++;
            else failedCount++;
            
            totalPercentage += parseFloat(m.percentage) || 0;
            
            if (m.rank_in_class && m.rank_in_class < bestRank) {
                bestRank = m.rank_in_class;
                totalInClass = m.total_in_class;
            }
        }
    });

    const examsTaken = uniqueExams.size;
    const recordsWithMarks = passedCount + failedCount;
    const avgPercentage = recordsWithMarks > 0 ? (totalPercentage / recordsWithMarks).toFixed(2) : 0;
    
    const passRate = recordsWithMarks > 0 ? ((passedCount / recordsWithMarks) * 100).toFixed(2) : 0;
    const failRate = recordsWithMarks > 0 ? ((failedCount / recordsWithMarks) * 100).toFixed(2) : 0;

    // Calculate Top Subjects
    const subjectMap = {};
    marks.forEach(m => {
        if (!m.is_absent && m.subject_name) {
            if (!subjectMap[m.subject_name]) {
                subjectMap[m.subject_name] = { totalPct: 0, count: 0 };
            }
            subjectMap[m.subject_name].totalPct += parseFloat(m.percentage) || 0;
            subjectMap[m.subject_name].count++;
        }
    });

    const topSubjects = Object.keys(subjectMap)
        .map(sub => ({
            name: sub,
            avg: (subjectMap[sub].totalPct / subjectMap[sub].count).toFixed(2)
        }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 3); // top 3

    return (
        <div className="marks-dashboard">
            {/* Mobile Header (Visible only on mobile) */}
            <div className="marks-mobile-header">
                <button className="marks-mobile-back-btn" onClick={() => navigate(-1)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                </button>
                <div className="marks-mobile-header-center">
                    <div className="marks-mobile-header-icon">📋</div>
                    <div className="marks-mobile-header-text">
                        <h2>My Exam Marks</h2>
                        <p>View your performance across all exams</p>
                    </div>
                </div>
                <button className="marks-mobile-filter-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                </button>
            </div>

            {/* Desktop Header */}
            <div className="st-header desktop-only-header">
                <div className="st-header-top-row">
                    <div className="st-header-left">
                        <h1>My Exam Marks</h1>
                        <p>View your performance across all exams. Click an exam name to see the full scorecard.</p>
                    </div>
                </div>
                <div className="st-header-bottom-row">
                    <div className="st-breadcrumbs">
                        <span>Dashboard</span>
                        <span>›</span>
                        <span className="active">My Exam Marks</span>
                    </div>
                    <div className="st-header-actions">
                    </div>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="marks-stats-row">
                <div className="marks-stat-card">
                    <div className="marks-stat-icon icon-purple">📋</div>
                    <div className="marks-stat-text">
                        <h3>{examsTaken}</h3>
                        <p>Exams Taken</p>
                    </div>
                </div>
                <div className="marks-stat-card">
                    <div className="marks-stat-icon icon-green">✅</div>
                    <div className="marks-stat-text">
                        <h3 className="text-green">{passedCount}</h3>
                        <p>Passed</p>
                        <span className="subtext text-green">{passRate}%</span>
                    </div>
                </div>
                <div className="marks-stat-card">
                    <div className="marks-stat-icon icon-red">❌</div>
                    <div className="marks-stat-text">
                        <h3 className="text-red">{failedCount}</h3>
                        <p>Failed</p>
                        <span className="subtext text-red">{failRate}%</span>
                    </div>
                </div>
                <div className="marks-stat-card">
                    <div className="marks-stat-icon icon-orange">⭐</div>
                    <div className="marks-stat-text">
                        <h3 style={{ color: '#f97316' }}>{avgPercentage}%</h3>
                        <p>Average Percentage</p>
                    </div>
                </div>
                <div className="marks-stat-card">
                    <div className="marks-stat-icon icon-blue">📊</div>
                    <div className="marks-stat-text">
                        <h3 style={{ color: '#0ea5e9' }}>{bestRank === Infinity ? '-' : `#${bestRank}`}</h3>
                        <p>Best Rank</p>
                        <span className="subtext" style={{ color: '#64748b' }}>{totalInClass ? `out of ${totalInClass}` : ''}</span>
                    </div>
                </div>
            </div>

            {/* 2-Column Grid */}
            <div className="marks-main-grid">
                {/* Left Column */}
                <div className="marks-grid-left">
                    {/* Exam Results Table */}
                    <div className="marks-panel">
                        <div className="marks-panel-header-flex">
                            <h2 className="marks-panel-title"><span className="marks-panel-title-icon">📋</span> Exam Results</h2>
                            <button className="marks-view-all-link">View All</button>
                        </div>
                        {/* Desktop Table View */}
                        <div className="marks-table-wrapper desktop-only-table">
                            <table className="marks-table">
                                <thead>
                                    <tr>
                                        <th>Exam Name</th>
                                        <th>Type</th>
                                        <th>Subject</th>
                                        <th>Date</th>
                                        <th>Marks</th>
                                        <th>%</th>
                                        <th>Grade</th>
                                        <th>Rank</th>
                                        <th>Status</th>
                                        <th className="desktop-only-cell">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {marks.length === 0 ? (
                                        <tr>
                                            <td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                                                No results available yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        marks.map((mark, i) => {
                                            const isAbsent = mark.is_absent;
                                            const isPassed = mark.status === 'Pass';
                                            const typeColor = EXAM_TYPE_COLORS[mark.exam_type] || EXAM_TYPE_COLORS.other;

                                            return (
                                                <tr key={`${mark.exam_id}-${i}`}>
                                                    <td>
                                                        <span 
                                                            className="marks-table-exam-name"
                                                            onClick={() => setScorecardExam(mark.exam_name)}
                                                        >
                                                            {mark.exam_name}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className="marks-table-type" style={{ background: typeColor.bg, color: typeColor.color }}>
                                                            {EXAM_TYPE_LABELS[mark.exam_type] || mark.exam_type}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontWeight: 500, color: '#1e293b' }}>{mark.subject_name || 'N/A'}</td>
                                                    <td>{new Date(mark.exam_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '\n')}</td>
                                                    <td>
                                                        {isAbsent ? (
                                                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Absent</span>
                                                        ) : (
                                                            <div className="marks-fraction">
                                                                <strong style={{ color: '#0f172a' }}>{mark.marks_obtained}</strong>
                                                                <span style={{ color: '#94a3b8' }}> / {mark.total_marks}</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ color: '#334155' }}>{mark.percentage != null ? `${mark.percentage}%` : '—'}</td>
                                                    <td className="marks-table-grade" style={{ color: isAbsent ? '#94a3b8' : isPassed ? '#22c55e' : '#ef4444' }}>
                                                        {mark.grade || '—'}
                                                    </td>
                                                    <td style={{ fontWeight: 600 }}>
                                                        {isAbsent ? '—' : (
                                                            <div className="marks-fraction">
                                                                #{mark.rank_in_class}
                                                                <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 500 }}> / {mark.total_in_class}</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <span className={`marks-status-badge ${isAbsent ? 'absent' : isPassed ? 'pass' : 'fail'}`}>
                                                            {isAbsent ? 'Absent' : isPassed ? 'Pass' : 'Fail'}
                                                        </span>
                                                    </td>
                                                    <td className="desktop-only-cell">
                                                        <button className="marks-table-action-btn" onClick={() => setScorecardExam(mark.exam_name)} title="View Scorecard">
                                                            👁️
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards View */}
                        <div className="mobile-only-cards">
                            {marks.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                                    No results available yet.
                                </div>
                            ) : (
                                marks.map((mark, i) => {
                                    const isAbsent = mark.is_absent;
                                    const isPassed = mark.status === 'Pass';
                                    const typeColor = EXAM_TYPE_COLORS[mark.exam_type] || EXAM_TYPE_COLORS.other;

                                    return (
                                        <div className="marks-result-card" key={`mobile-${mark.exam_id}-${i}`}>
                                            <div className="marks-result-card-header">
                                                <div>
                                                    <div className="marks-result-card-title" onClick={() => setScorecardExam(mark.exam_name)}>
                                                        {mark.exam_name}
                                                    </div>
                                                    <div className="marks-result-card-date">
                                                        {new Date(mark.exam_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </div>
                                                </div>
                                                <span className="marks-table-type" style={{ background: typeColor.bg, color: typeColor.color }}>
                                                    {EXAM_TYPE_LABELS[mark.exam_type] || mark.exam_type}
                                                </span>
                                            </div>
                                            <div className="marks-result-card-grid">
                                                <div className="marks-result-item">
                                                    <span className="marks-result-label">Subject</span>
                                                    <span className="marks-result-val">{mark.subject_name || 'N/A'}</span>
                                                </div>
                                                <div className="marks-result-item">
                                                    <span className="marks-result-label">Marks / %</span>
                                                    <span className="marks-result-val">
                                                        {isAbsent ? (
                                                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Absent</span>
                                                        ) : (
                                                            `${mark.marks_obtained} / ${mark.total_marks} (${mark.percentage}%)`
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="marks-result-item">
                                                    <span className="marks-result-label">Grade & Rank</span>
                                                    <span className="marks-result-val">
                                                        {isAbsent ? '—' : `${mark.grade || '—'} (Rank #${mark.rank_in_class})`}
                                                    </span>
                                                </div>
                                                <div className="marks-result-item">
                                                    <span className="marks-result-label">Status</span>
                                                    <span className={`marks-status-badge ${isAbsent ? 'absent' : isPassed ? 'pass' : 'fail'}`} style={{ alignSelf: 'flex-start' }}>
                                                        {isAbsent ? 'Absent' : isPassed ? 'Pass' : 'Fail'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="marks-result-card-footer">
                                                <button className="marks-result-view-btn" onClick={() => setScorecardExam(mark.exam_name)}>
                                                    View Scorecard
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Performance Summary (Mobile Only - Moved from Right Col) */}
                    <div className="marks-panel mobile-only-panel">
                        <h2 className="marks-panel-title"><span className="marks-panel-title-icon">📊</span> Performance Summary</h2>
                        <div className="marks-summary-flex">
                            <div className="marks-doughnut-container-small">
                                <Doughnut 
                                    data={{
                                        labels: ['Passed', 'Failed'],
                                        datasets: [{
                                            data: [passedCount, failedCount],
                                            backgroundColor: ['#22c55e', '#ef4444'],
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
                                <div className="marks-doughnut-inner-text-small">
                                    <h3>{passRate}%</h3>
                                    <p>Pass Rate</p>
                                </div>
                            </div>
                            <div className="marks-summary-stats">
                                <div className="marks-summary-stat-item">
                                    <span className="marks-legend-dot" style={{ background: '#22c55e' }}></span>
                                    <span>Passed</span>
                                    <span className="marks-summary-value">{passedCount} ({passRate}%)</span>
                                </div>
                                <div className="marks-summary-stat-item">
                                    <span className="marks-legend-dot" style={{ background: '#ef4444' }}></span>
                                    <span>Failed</span>
                                    <span className="marks-summary-value">{failedCount} ({failRate}%)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Performance Trend */}
                    <div className="marks-panel">
                        <h2 className="marks-panel-title"><span className="marks-panel-title-icon">📈</span> Performance Trend</h2>
                        <PerformanceTrendChart trend={trend} />
                    </div>
                    
                    {/* Top Subjects (Mobile Only - Moved from Right Col) */}
                    <div className="marks-panel mobile-only-panel">
                        <h2 className="marks-panel-title"><span className="marks-panel-title-icon">⭐</span> Top Subjects</h2>
                        <div className="marks-top-subjects-list">
                            {topSubjects.length === 0 ? (
                                <div style={{ color: '#888', fontSize: '14px', textAlign: 'center', padding: '10px' }}>No data available.</div>
                            ) : (
                                topSubjects.map((sub, idx) => (
                                    <div className="marks-subject-item" key={sub.name}>
                                        <div className="marks-subject-name">
                                            <span style={{ color: '#94a3b8', fontSize: '13px' }}>{idx + 1}.</span> {sub.name}
                                        </div>
                                        <div className="marks-subject-score">{sub.avg}%</div>
                                    </div>
                                ))
                            )}
                        </div>
                        <button className="marks-view-all-btn" style={{ marginTop: '20px' }} onClick={() => navigate('/student/performance')}>
                            📈 View Performance Analytics
                        </button>
                    </div>
                </div>

                {/* Right Column (Desktop Only) */}
                <div className="marks-grid-right desktop-only-col">
                    {/* Performance Summary (Doughnut) */}
                    <div className="marks-panel">
                        <h2 className="marks-panel-title">Performance Summary</h2>
                        <div className="marks-doughnut-container">
                            <Doughnut 
                                data={{
                                    labels: ['Passed', 'Failed'],
                                    datasets: [{
                                        data: [passedCount, failedCount],
                                        backgroundColor: ['#22c55e', '#ef4444'],
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
                            <div className="marks-doughnut-inner-text">
                                <h3>{passRate}%</h3>
                                <p>Pass Rate</p>
                            </div>
                        </div>
                        <div className="marks-legend">
                            <div className="marks-legend-item">
                                <span className="marks-legend-dot" style={{ background: '#22c55e' }}></span>
                                Passed
                            </div>
                            <div className="marks-legend-value">
                                {passedCount} ({passRate}%)
                            </div>
                        </div>
                        <div className="marks-legend" style={{ marginTop: '8px' }}>
                            <div className="marks-legend-item">
                                <span className="marks-legend-dot" style={{ background: '#ef4444' }}></span>
                                Failed
                            </div>
                            <div className="marks-legend-value">
                                {failedCount} ({failRate}%)
                            </div>
                        </div>
                    </div>

                    {/* Top Subjects */}
                    <div className="marks-panel">
                        <h2 className="marks-panel-title">Top Subjects</h2>
                        <div className="marks-top-subjects-list">
                            {topSubjects.length === 0 ? (
                                <div style={{ color: '#888', fontSize: '14px', textAlign: 'center', padding: '10px' }}>No data available.</div>
                            ) : (
                                topSubjects.map((sub, idx) => (
                                    <div className="marks-subject-item" key={sub.name}>
                                        <div className="marks-subject-name">
                                            <span style={{ color: '#94a3b8', fontSize: '13px' }}>{idx + 1}.</span> {sub.name}
                                        </div>
                                        <div className="marks-subject-score">{sub.avg}%</div>
                                    </div>
                                ))
                            )}
                        </div>
                        <button className="marks-view-all-btn" style={{ marginTop: '20px' }} onClick={() => navigate('/student/performance')}>
                            📈 View Performance Analytics
                        </button>
                    </div>
                </div>
            </div>

            {/* Scorecard Modal */}
            {scorecardExam && (
                <ScorecardModal
                    examName={scorecardExam}
                    onClose={() => setScorecardExam(null)}
                />
            )}
        </div>
    );
}

export default ViewMarks;

