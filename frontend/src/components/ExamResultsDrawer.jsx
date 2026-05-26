/**
 * ExamResultsDrawer — Phase 4
 * Full results analytics view for Admin/Faculty.
 * Shows: stats cards + ranked table + Excel export
 */
import { useState, useEffect } from 'react';
import examService from '../services/exam.service';

// ─── Exam type label map ──────────────────────────────────────
const EXAM_TYPE_LABELS = {
    unit_test:  'Unit Test',
    midterm:    'Mid-Term',
    final:      'Final Exam',
    mock:       'Mock Test',
    practical:  'Practical',
    other:      'Other',
};

// ─── Export results to CSV (no external dep needed) ──────────
function exportCSV(results, exam) {
    const header = ['Rank', 'Roll No', 'Name', 'Marks', 'Total', 'Percentage', 'Grade', 'Status'];
    const rows = results.map(r => [
        r.rank_in_class,
        r.roll_no,
        r.student_name,
        r.is_absent ? 'Absent' : r.marks_obtained,
        exam.total_marks,
        r.percentage ?? '',
        r.grade,
        r.status,
    ]);
    const csvContent = [header, ...rows]
        .map(row => row.map(v => `"${v}"`).join(','))
        .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `results_${exam.name?.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ExamResultsDrawer({ examId, onClose }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        setLoading(true);
        setError('');
        examService.getResults(examId)
            .then(d => { setData(d); setLoading(false); })
            .catch(err => {
                setError(err.response?.data?.message || 'Failed to load results');
                setLoading(false);
            });
    }, [examId]);

    // ── Overlay styles ────────────────────────────────────────
    const overlayStyle = {
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 1000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '2rem 1rem',
        overflowY: 'auto',
    };

    const panelStyle = {
        background: 'var(--card-bg, #ffffff)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '900px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        overflow: 'hidden',
    };

    const headerStyle = {
        background: 'linear-gradient(135deg, #0A1628, #1e3a6e)',
        color: '#fff',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    };

    if (loading) return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={panelStyle} onClick={e => e.stopPropagation()}>
                <div style={headerStyle}>
                    <h3 style={{ margin: 0 }}>📊 Exam Results</h3>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
                    Loading results...
                </div>
            </div>
        </div>
    );

    if (error) return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={panelStyle} onClick={e => e.stopPropagation()}>
                <div style={headerStyle}>
                    <h3 style={{ margin: 0 }}>📊 Exam Results</h3>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ padding: '2rem', color: '#C62828', textAlign: 'center' }}>{error}</div>
            </div>
        </div>
    );

    const { exam, results, stats } = data;
    const typeLabel = EXAM_TYPE_LABELS[exam.exam_type] || exam.exam_type || '';

    const statCards = [
        { label: 'Total Students', value: stats.total_students, color: '#1565C0' },
        { label: 'Appeared',       value: stats.appeared,        color: '#0D47A1' },
        { label: 'Pass %',         value: stats.pass_percentage + '%', color: '#2E7D32' },
        { label: 'Average',        value: stats.average_marks,   color: '#6A1B9A' },
        { label: 'Highest',        value: stats.highest_marks,   color: '#2E7D32' },
        { label: 'Lowest',         value: stats.lowest_marks,    color: '#C62828' },
    ];

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={panelStyle} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={headerStyle}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>📊 {exam.name}</h3>
                        <div style={{ fontSize: '13px', opacity: 0.8, marginTop: '2px' }}>
                            {typeLabel} · {exam.Subject?.name || ''} ·{' '}
                            {new Date(exam.exam_date).toLocaleDateString('en-IN')}
                            {exam.marks_locked && (
                                <span style={{ marginLeft: '8px', background: '#2E7D32', borderRadius: '4px', padding: '1px 6px', fontSize: '11px' }}>
                                    🔒 Locked
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontSize: '16px' }}
                    >
                        ✕
                    </button>
                </div>

                <div style={{ padding: '1.5rem' }}>
                    {/* Stats Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '1.5rem' }}>
                        {statCards.map(s => (
                            <div key={s.label} style={{ background: '#f8f9fa', borderRadius: '10px', padding: '0.85rem', textAlign: 'center', border: `2px solid ${s.color}22` }}>
                                <div style={{ fontSize: '22px', fontWeight: '800', color: s.color }}>{s.value}</div>
                                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px', fontWeight: 600 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Results Table */}
                    {results.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                            No marks entered yet for this exam.
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                <thead>
                                    <tr style={{ background: 'linear-gradient(135deg, #0A1628, #1e3a6e)', color: '#fff' }}>
                                        {['Rank', 'Roll No', 'Student Name', 'Marks', '%', 'Grade', 'Status', 'Remarks'].map(h => (
                                            <th key={h} style={{ padding: '10px 8px', textAlign: h === 'Rank' || h === '%' || h === 'Grade' ? 'center' : 'left', fontWeight: 600 }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((r, i) => {
                                        const isAbsent = r.is_absent;
                                        const isPassed = r.status === 'Pass';
                                        return (
                                            <tr
                                                key={r.student_id}
                                                style={{
                                                    background: isAbsent ? '#FFF8E1' : i % 2 === 0 ? '#fff' : '#F8F9FF',
                                                    borderBottom: '1px solid #eee',
                                                }}
                                            >
                                                <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700', color: r.rank_in_class <= 3 && !isAbsent ? '#D4AF37' : '#333' }}>
                                                    {isAbsent ? '—' : `#${r.rank_in_class}`}
                                                </td>
                                                <td style={{ padding: '8px' }}>
                                                    <span style={{ background: '#E3F2FD', color: '#1565C0', borderRadius: '4px', padding: '2px 6px', fontSize: '12px', fontWeight: 600 }}>
                                                        {r.roll_no}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '8px', fontWeight: 600 }}>{r.student_name}</td>
                                                <td style={{ padding: '8px' }}>
                                                    {isAbsent ? (
                                                        <span style={{ color: '#9E9E9E', fontStyle: 'italic' }}>Absent</span>
                                                    ) : (
                                                        <><strong>{r.marks_obtained}</strong><span style={{ color: '#888', fontSize: '12px' }}> / {exam.total_marks}</span></>
                                                    )}
                                                </td>
                                                <td style={{ padding: '8px', textAlign: 'center' }}>
                                                    {r.percentage != null ? `${r.percentage}%` : '—'}
                                                </td>
                                                <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700', color: isAbsent ? '#9E9E9E' : isPassed ? '#2E7D32' : '#C62828' }}>
                                                    {r.grade}
                                                </td>
                                                <td style={{ padding: '8px' }}>
                                                    <span style={{
                                                        background: isAbsent ? '#EEE' : isPassed ? '#E8F5E9' : '#FFEBEE',
                                                        color: isAbsent ? '#888' : isPassed ? '#2E7D32' : '#C62828',
                                                        borderRadius: '6px', padding: '3px 8px', fontWeight: 700, fontSize: '12px',
                                                    }}>
                                                        {r.status}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '8px', fontSize: '12px', color: '#666' }}>
                                                    {r.remarks || '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Export Button */}
                    {results.length > 0 && (
                        <button
                            onClick={() => exportCSV(results, exam)}
                            style={{
                                marginTop: '1rem',
                                background: 'linear-gradient(135deg, #1B5E20, #2E7D32)',
                                color: '#fff',
                                border: 'none',
                                padding: '10px 22px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: 700,
                                fontSize: '14px',
                                boxShadow: '0 4px 12px rgba(27,94,32,0.3)',
                            }}
                        >
                            📥 Export CSV
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
