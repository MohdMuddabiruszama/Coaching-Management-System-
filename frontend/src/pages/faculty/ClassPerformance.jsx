/**
 * Faculty Class Performance Page — Phase 5
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import performanceService from '../../services/performance.service';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import '../student/Performance.css';

function FacultyClassPerformance() {
    const navigate = useNavigate();
    const [classes, setClasses] = useState([]);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchClasses();
    }, []);

    const fetchClasses = async () => {
        try {
            const classData = await performanceService.getFacultyClasses();
            setClasses(classData.classes || []);
            if (classData.classes?.length > 0) {
                setSelectedClassId(classData.classes[0].id);
            }
        } catch (err) {
            console.error('Failed to fetch faculty classes:', err);
            setError('Could not load classes.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedClassId) {
            fetchPerformance(selectedClassId);
        }
    }, [selectedClassId]);

    const fetchPerformance = async (classId) => {
        setLoading(true);
        try {
            const perfData = await performanceService.getClassPerformance(classId);
            setData(perfData);
        } catch (err) {
            console.error('Failed to fetch class performance:', err);
            setError('Could not load class performance data.');
        } finally {
            setLoading(false);
        }
    };

    if (loading && !data) {
        return (
            <div className="dashboard-container">
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                    <p>Loading class performance...</p>
                </div>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="dashboard-container">
                <div style={{ textAlign: 'center', padding: '4rem', color: '#ef4444' }}>
                    <p>{error}</p>
                    <button className="btn btn-primary" onClick={() => navigate(-1)}>Go Back</button>
                </div>
            </div>
        );
    }

    // ── Export Handlers ──
    const exportToExcel = () => {
        if (!data || !data.students) return;
        const exportData = data.students.map(s => ({
            Rank: s.rank,
            'Roll No': s.roll_number,
            'Student Name': s.student_name,
            Score: s.score,
            Grade: s.grade,
            'Marks %': s.marks_pct + '%',
            'Attendance %': s.att_pct + '%',
            'Assignments %': s.ass_pct + '%',
            Status: s.status.replace('_', ' ').toUpperCase()
        }));
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Performance");
        const selectedClass = classes.find(c => c.id == selectedClassId);
        const className = selectedClass ? selectedClass.name.replace(/\s+/g, '_') : 'Class';
        XLSX.writeFile(workbook, `${className}_Performance.xlsx`);
    };

    const exportToPDF = () => {
        if (!data || !data.students) return;
        const doc = new jsPDF();
        
        const selectedClass = classes.find(c => c.id == selectedClassId);
        const className = selectedClass ? `${selectedClass.name}${selectedClass.section ? ` - ${selectedClass.section}` : ''}` : 'Class';
        
        doc.setFontSize(18);
        doc.text(`${className} Performance Report`, 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

        const tableColumn = ["Rank", "Roll No", "Student Name", "Score", "Grade", "Marks", "Att", "Assgn", "Status"];
        const tableRows = [];

        data.students.forEach(s => {
            const rowData = [
                s.rank,
                s.roll_number,
                s.student_name,
                s.score,
                s.grade,
                s.marks_pct + '%',
                s.att_pct + '%',
                s.ass_pct + '%',
                s.status.replace('_', ' ').toUpperCase()
            ];
            tableRows.push(rowData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229] },
            styles: { fontSize: 9 }
        });

        const safeClassName = selectedClass ? selectedClass.name.replace(/\s+/g, '_') : 'Class';
        doc.save(`${safeClassName}_Performance.pdf`);
    };

    return (
        <div className="dashboard-container perf-page">
            <div className="dashboard-header" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={() => navigate('/faculty/dashboard')} style={{ background: 'none', border: '1.5px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem 0.85rem', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 600 }}>← Back</button>
                    <div>
                        <h1 style={{ margin: 0 }}>📊 Class Performance</h1>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Monitor and identify at-risk students</p>
                    </div>
                </div>
                <div className="dashboard-header-right">
                    <select
                        className="form-control"
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', minWidth: '180px', fontWeight: '500', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', outline: 'none' }}
                    >
                        {classes.map(c => (
                            <option key={c.id} value={c.id}>{c.name}{c.section ? ` - ${c.section}` : ''}</option>
                        ))}
                    </select>
                </div>
            </div>

            {data && (
                <>
                    {/* ── Class Stats ── */}
                    <div className="perf-class-stats">
                        <div className="perf-class-stat" style={{ borderBottom: '4px solid #6366f1' }}>
                            <div className="perf-class-stat-val" style={{ color: '#6366f1' }}>{data.stats.avg_score}</div>
                            <div className="perf-class-stat-label">Class Average Score</div>
                        </div>
                        <div className="perf-class-stat" style={{ borderBottom: `4px solid ${data.stats.pass_rate >= 50 ? '#10b981' : '#ef4444'}` }}>
                            <div className="perf-class-stat-val" style={{ color: data.stats.pass_rate >= 50 ? '#10b981' : '#ef4444' }}>{data.stats.pass_rate}%</div>
                            <div className="perf-class-stat-label">Pass Rate</div>
                        </div>
                        <div className="perf-class-stat" style={{ borderBottom: '4px solid #f59e0b' }}>
                            <div className="perf-class-stat-val" style={{ color: '#f59e0b' }}>{data.stats.highest}</div>
                            <div className="perf-class-stat-label">Highest Score</div>
                        </div>
                        <div className="perf-class-stat" style={{ borderBottom: '4px solid #ef4444' }}>
                            <div className="perf-class-stat-val" style={{ color: '#ef4444' }}>{data.stats.at_risk_count}</div>
                            <div className="perf-class-stat-label">At-Risk Students</div>
                        </div>
                    </div>

                    {/* ── At-Risk Alert ── */}
                    {data.at_risk?.length > 0 && (
                        <div className="perf-at-risk-section">
                            <h3 className="perf-at-risk-title">⚠️ Needs Immediate Attention</h3>
                            <div className="perf-at-risk-chips">
                                {data.at_risk.map(s => (
                                    <div key={s.student_id} className="perf-at-risk-chip">
                                        {s.student_name}
                                        <small>Score: {s.score} | Att: {s.att_pct}%</small>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Grade Distribution ── */}
                    <div className="perf-card" style={{ marginTop: '1.5rem' }}>
                        <h3 className="perf-card-title">📊 Grade Distribution</h3>
                        <div className="perf-grade-dist">
                            {['A+', 'A', 'B+', 'B', 'C', 'D', 'F'].map(grade => {
                                const count = data.grade_distribution[grade] || 0;
                                const maxCount = Math.max(...Object.values(data.grade_distribution), 1);
                                const heightPct = (count / maxCount) * 100;
                                return (
                                    <div key={grade} className="perf-grade-col">
                                        <div className="perf-grade-bar-val">{count}</div>
                                        <div className="perf-grade-bar-wrap">
                                            <div
                                                className="perf-grade-bar"
                                                style={{
                                                    height: `${heightPct}%`,
                                                    background: ['F', 'D'].includes(grade) ? '#ef4444' : '#6366f1'
                                                }}
                                            />
                                        </div>
                                        <div className="perf-grade-label">{grade}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Ranked Student Table ── */}
                    <div className="perf-card" style={{ marginTop: '1.5rem', padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 className="perf-card-title" style={{ margin: 0 }}>🏆 Class Rankings</h3>
                            <div style={{ display: 'flex', gap: '0.8rem' }}>
                                <button onClick={exportToExcel} style={{ padding: '0.5rem 1rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 2px 4px rgba(16,185,129,0.3)' }}>
                                    📊 Excel
                                </button>
                                <button onClick={exportToPDF} style={{ padding: '0.5rem 1rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 2px 4px rgba(239,68,68,0.3)' }}>
                                    📄 PDF
                                </button>
                            </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="perf-ranked-table">
                                <thead>
                                    <tr>
                                        <th>Rank</th>
                                        <th>Roll #</th>
                                        <th>Student Name</th>
                                        <th>Score</th>
                                        <th>Grade</th>
                                        <th>Marks %</th>
                                        <th>Att %</th>
                                        <th>Ass %</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.students.map((s, idx) => (
                                        <tr key={s.student_id} className={s.status === 'at_risk' ? 'at-risk-row' : ''}>
                                            <td style={{ fontWeight: 700, color: idx < 3 ? '#f59e0b' : 'inherit' }}>#{s.rank}</td>
                                            <td>{s.roll_number}</td>
                                            <td style={{ fontWeight: 600 }}>{s.student_name}</td>
                                            <td style={{ fontWeight: 700 }}>{s.score}</td>
                                            <td>
                                                <span className="perf-grade-badge" style={{ padding: '2px 8px', fontSize: '0.75rem', background: s.grade === 'F' ? '#ef4444' : '#6366f1' }}>
                                                    {s.grade}
                                                </span>
                                            </td>
                                            <td>{s.marks_pct}%</td>
                                            <td>{s.att_pct}%</td>
                                            <td>{s.ass_pct}%</td>
                                            <td>
                                                <span className={`perf-status-badge ${s.status}`}>
                                                    {s.status.replace('_', ' ').toUpperCase()}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {data.students.length === 0 && (
                                        <tr>
                                            <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>No students found in this class.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default FacultyClassPerformance;
