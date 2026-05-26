/**
 * ViewMarks — Student Page — Phase 6 (Approach B)
 * Features:
 *   ✅ All missing columns: Type badge, Subject, Percentage, Grade, Rank
 *   ✅ Scorecard modal — click exam name to see multi-subject totals
 *   ✅ PDF download inside scorecard modal
 *   ✅ Performance trend chart (react-chartjs-2 line chart)
 *   ✅ Only locked exams shown (backend filter)
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import markService from '../../services/mark.service';
import BackButton from '../../components/common/BackButton';
import '../admin/Dashboard.css';

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
} from 'chart.js';
import { Line } from 'react-chartjs-2';
ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Legend, Tooltip, Filler);

// ─── Constants ────────────────────────────────────────────────
const EXAM_TYPE_LABELS = {
    unit_test: 'Unit Test', midterm: 'Mid-Term', final: 'Final',
    mock: 'Mock', practical: 'Practical', other: 'Other',
};

const EXAM_TYPE_COLORS = {
    unit_test: { bg: '#E3F2FD', color: '#1565C0' },
    midterm:   { bg: '#F3E5F5', color: '#6A1B9A' },
    final:     { bg: '#FCE4EC', color: '#C62828' },
    mock:      { bg: '#FFF8E1', color: '#E65100' },
    practical: { bg: '#E8F5E9', color: '#2E7D32' },
    other:     { bg: '#F5F5F5', color: '#555555' },
};

const CHART_COLORS = ['#1565C0', '#2E7D32', '#C62828', '#6A1B9A', '#E65100', '#00695C'];

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
        background: 'rgba(0,0,0,0.6)', zIndex: 1100,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '2rem 1rem', overflowY: 'auto',
    };

    const panelStyle = {
        background: 'var(--card-bg, #fff)',
        borderRadius: '16px',
        width: '100%', maxWidth: '700px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        overflow: 'hidden',
    };

    const headerStyle = {
        background: 'linear-gradient(135deg, #1A237E, #283593)',
        color: '#fff', padding: '1.25rem 1.5rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    };

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={panelStyle} onClick={e => e.stopPropagation()}>
                <div style={headerStyle}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.05rem' }}>📋 Scorecard — {examName}</h3>
                        {sc && (
                            <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '2px' }}>
                                {new Date(sc.exam_date).toLocaleDateString('en-IN')} ·{' '}
                                {EXAM_TYPE_LABELS[sc.exam_type] || sc.exam_type}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontSize: '16px' }}
                    >
                        ✕
                    </button>
                </div>

                <div style={{ padding: '1.5rem' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>⏳ Loading scorecard...</div>
                    ) : error ? (
                        <div style={{ color: '#C62828', textAlign: 'center', padding: '2rem' }}>{error}</div>
                    ) : !sc ? (
                        <div style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>No scorecard data available.</div>
                    ) : (
                        <>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                    <thead>
                                        <tr style={{ background: 'linear-gradient(135deg, #1A237E, #283593)', color: '#fff' }}>
                                            {['Subject', 'Marks', 'Total', 'Percentage', 'Grade', 'Status'].map(h => (
                                                <th key={h} style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sc.subjects.map((s, i) => (
                                            <tr key={s.subject} style={{ background: i % 2 === 0 ? '#fff' : '#F8F9FF', borderBottom: '1px solid #eee' }}>
                                                <td style={{ padding: '8px', fontWeight: 600 }}>{s.subject}</td>
                                                <td style={{ padding: '8px' }}>{s.marks_obtained}</td>
                                                <td style={{ padding: '8px', color: '#888' }}>{s.total_marks}</td>
                                                <td style={{ padding: '8px' }}>{s.percentage}%</td>
                                                <td style={{ padding: '8px', fontWeight: 700, color: s.status === 'Pass' ? '#2E7D32' : '#C62828' }}>{s.grade}</td>
                                                <td style={{ padding: '8px' }}>
                                                    <span style={{
                                                        background: s.status === 'Pass' ? '#E8F5E9' : '#FFEBEE',
                                                        color: s.status === 'Pass' ? '#2E7D32' : '#C62828',
                                                        borderRadius: '5px', padding: '2px 8px', fontWeight: 700, fontSize: '12px',
                                                    }}>
                                                        {s.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ background: 'linear-gradient(135deg, #E3F2FD, #EDE7F6)', fontWeight: 800 }}>
                                            <td style={{ padding: '10px 8px' }}>OVERALL TOTAL</td>
                                            <td style={{ padding: '10px 8px' }}>{sc.total_obtained}</td>
                                            <td style={{ padding: '10px 8px', color: '#888' }}>{sc.total_maximum}</td>
                                            <td style={{ padding: '10px 8px' }}>{sc.overall_percentage}%</td>
                                            <td style={{ padding: '10px 8px', color: sc.overall_status === 'Pass' ? '#2E7D32' : '#C62828' }}>{sc.overall_grade}</td>
                                            <td style={{ padding: '10px 8px' }}>
                                                <span style={{
                                                    background: sc.overall_status === 'Pass' ? '#E8F5E9' : '#FFEBEE',
                                                    color: sc.overall_status === 'Pass' ? '#2E7D32' : '#C62828',
                                                    borderRadius: '5px', padding: '3px 10px', fontWeight: 700,
                                                }}>
                                                    {sc.overall_status}
                                                </span>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            <button
                                onClick={handleDownloadPDF}
                                disabled={downloading}
                                style={{
                                    marginTop: '1rem',
                                    background: 'linear-gradient(135deg, #B71C1C, #C62828)',
                                    color: '#fff', border: 'none',
                                    padding: '10px 22px', borderRadius: '8px',
                                    cursor: downloading ? 'not-allowed' : 'pointer',
                                    fontWeight: 700, fontSize: '14px',
                                    boxShadow: '0 4px 12px rgba(198,40,40,0.3)',
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
    if (!trend || trend.length === 0) return null;

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
        pointRadius: 5,
        pointHoverRadius: 7,
    }));

    return (
        <div className="card" style={{ marginTop: '1.5rem' }}>
            <div className="card-header">
                <h3 className="card-title">📈 Performance Trend</h3>
            </div>
            <div style={{ padding: '1rem', height: '280px' }}>
                <Line
                    data={{ labels, datasets }}
                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                min: 0,
                                max: 100,
                                title: { display: true, text: 'Score %', color: '#666' },
                                ticks: { callback: v => v + '%' },
                            },
                        },
                        plugins: {
                            legend: { position: 'top' },
                            tooltip: {
                                callbacks: {
                                    label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}%`,
                                },
                            },
                        },
                    }}
                />
            </div>
        </div>
    );
}

// ─── Main ViewMarks Page ──────────────────────────────────────
function ViewMarks() {
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
        <div className="dashboard-container mobile-loading-page">
            <div className="spinner"></div>
            <p>Loading your marks…</p>
        </div>
    );

    if (error) return (
        <div className="dashboard-container" style={{ color: 'red' }}>{error}</div>
    );

    return (
        <div className="dashboard-container">
            <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1>📝 My Exam Marks</h1>
                    <p>View your performance across all exams — click an exam name to see the full scorecard</p>
                </div>
                <BackButton to="/student/dashboard" />
            </div>

            <div className="card mobile-slide-in">
                <div className="card-header">
                    <h3 className="card-title">Exam Results ({marks.length})</h3>
                </div>

                {/* ── Desktop Table ── */}
                <div className="table-container">
                    <table className="table">
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
                                <th>Passing</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {marks.length === 0 ? (
                                <tr>
                                    <td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                                        No results available yet. Results will appear here once your teacher publishes them.
                                    </td>
                                </tr>
                            ) : (
                                marks.map((mark, i) => {
                                    const isAbsent = mark.is_absent;
                                    const isPassed = mark.status === 'Pass';
                                    const typeColor = EXAM_TYPE_COLORS[mark.exam_type] || EXAM_TYPE_COLORS.other;

                                    return (
                                        <tr key={`${mark.exam_id}-${i}`} style={{ background: isAbsent ? '#FFF8E1' : undefined }}>
                                            <td>
                                                {/* Clickable exam name → scorecard */}
                                                <button
                                                    onClick={() => setScorecardExam(mark.exam_name)}
                                                    style={{
                                                        background: 'none', border: 'none', padding: 0,
                                                        color: '#1565C0', cursor: 'pointer', fontWeight: 700,
                                                        textDecoration: 'underline', textAlign: 'left',
                                                    }}
                                                    title="Click to view full scorecard"
                                                >
                                                    {mark.exam_name}
                                                </button>
                                            </td>
                                            <td>
                                                <span style={{
                                                    background: typeColor.bg, color: typeColor.color,
                                                    borderRadius: '5px', padding: '2px 6px',
                                                    fontSize: '11px', fontWeight: 700,
                                                }}>
                                                    {EXAM_TYPE_LABELS[mark.exam_type] || mark.exam_type}
                                                </span>
                                            </td>
                                            <td>{mark.subject_name || 'N/A'}</td>
                                            <td>{new Date(mark.exam_date).toLocaleDateString('en-IN')}</td>
                                            <td>
                                                {isAbsent ? (
                                                    <span style={{ color: '#9E9E9E', fontStyle: 'italic' }}>Absent</span>
                                                ) : (
                                                    <><strong>{mark.marks_obtained}</strong><span style={{ color: '#888', fontSize: '12px' }}> / {mark.total_marks}</span></>
                                                )}
                                            </td>
                                            <td>{mark.percentage != null ? `${mark.percentage}%` : '—'}</td>
                                            <td style={{ fontWeight: 700, color: isAbsent ? '#9E9E9E' : isPassed ? '#2E7D32' : '#C62828' }}>
                                                {mark.grade || '—'}
                                            </td>
                                            <td>
                                                {isAbsent ? '—' : (
                                                    <span style={{ fontWeight: 600 }}>
                                                        #{mark.rank_in_class}
                                                        <span style={{ color: '#888', fontSize: '11px' }}> / {mark.total_in_class}</span>
                                                    </span>
                                                )}
                                            </td>
                                            <td>{mark.passing_marks}</td>
                                            <td>
                                                <span className={`badge badge-${isAbsent ? 'warning' : isPassed ? 'success' : 'error'}`}>
                                                    {mark.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── Mobile Card List ── */}
                <div className="mobile-table-card card-stagger">
                    {marks.length === 0 ? (
                        <div className="empty-state-mobile">
                            <div className="empty-icon">📝</div>
                            <div className="empty-title">No Results Yet</div>
                            <div className="empty-desc">Results will appear once your teacher publishes them.</div>
                        </div>
                    ) : (
                        marks.map((mark, i) => {
                            const isAbsent = mark.is_absent;
                            const isPassed = mark.status === 'Pass';
                            const typeColor = EXAM_TYPE_COLORS[mark.exam_type] || EXAM_TYPE_COLORS.other;
                            return (
                                <div key={`m-${mark.exam_id}-${i}`} className="marks-mobile-card"
                                    style={{ background: isAbsent ? '#FFF8E1' : undefined }}>
                                    <div className="marks-info">
                                        <div
                                            className="marks-exam-name"
                                            onClick={() => setScorecardExam(mark.exam_name)}
                                            style={{ cursor: 'pointer', color: '#1565C0', textDecoration: 'underline' }}
                                        >
                                            {mark.exam_name}
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '3px' }}>
                                            <span style={{ background: typeColor.bg, color: typeColor.color, borderRadius: '4px', padding: '1px 5px', fontSize: '11px', fontWeight: 700 }}>
                                                {EXAM_TYPE_LABELS[mark.exam_type] || mark.exam_type}
                                            </span>
                                        </div>
                                        <div className="marks-subject">{mark.subject_name || 'N/A'}</div>
                                        {mark.exam_date && (
                                            <div className="marks-date">
                                                {new Date(mark.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                        )}
                                    </div>
                                    <div className="marks-score">
                                        {isAbsent ? (
                                            <div className="score" style={{ color: '#9E9E9E', fontSize: '1rem' }}>Absent</div>
                                        ) : (
                                            <>
                                                <div className="score" style={{ color: isPassed ? '#10b981' : '#ef4444' }}>
                                                    {mark.marks_obtained}
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#888' }}>/{mark.total_marks}</span>
                                                </div>
                                                <div style={{ fontSize: '0.85rem', color: '#888' }}>{mark.percentage}%</div>
                                                <div style={{ fontSize: '0.75rem', color: '#888' }}>Rank #{mark.rank_in_class}</div>
                                            </>
                                        )}
                                        <span className={`result ${isAbsent ? '' : isPassed ? 'pass' : 'fail'}`}>
                                            {mark.status}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Performance Trend Chart */}
            <PerformanceTrendChart trend={trend} />

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
