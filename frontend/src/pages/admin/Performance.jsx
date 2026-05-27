/**
 * Admin Institute Overview Performance Page — Phase 6
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import performanceService from '../../services/performance.service';
import api from '../../services/api';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import '../student/Performance.css';

function AdminPerformance() {
    const navigate = useNavigate();
    
    const [viewMode, setViewMode] = useState('overall'); // 'overall', 'class', 'subject'
    
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [classes, setClasses] = useState([]);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [subjects, setSubjects] = useState([]);
    const [selectedSubjectId, setSelectedSubjectId] = useState('');
    
    const [classData, setClassData] = useState(null);
    const [classLoading, setClassLoading] = useState(false);
    const [classError, setClassError] = useState('');

    // Fetch Overall Institute Data
    useEffect(() => {
        fetchOverviewData();
        fetchClasses();
    }, []);

    const fetchOverviewData = async () => {
        try {
            setLoading(true);
            const data = await performanceService.getInstituteOverview();
            setOverview(data);
        } catch (err) {
            console.error('Failed to fetch institute overview:', err);
            setError('Could not load performance data.');
        } finally {
            setLoading(false);
        }
    };

    const fetchClasses = async () => {
        try {
            const res = await api.get('/classes');
            const cls = res.data.data || [];
            setClasses(cls);
            if (cls.length > 0) {
                setSelectedClassId(cls[0].id);
            }
        } catch (err) {
            console.error('Failed to fetch classes:', err);
        }
    };

    useEffect(() => {
        if (selectedClassId) {
            fetchSubjects(selectedClassId);
            if (viewMode === 'class' || (viewMode === 'subject' && !selectedSubjectId)) {
                fetchClassPerformance(selectedClassId, null);
            }
        }
    }, [selectedClassId, viewMode]);

    const fetchSubjects = async (cId) => {
        try {
            const res = await api.get(`/subjects?class_id=${cId}`);
            const subs = res.data.data || [];
            setSubjects(subs);
            if (subs.length > 0) {
                setSelectedSubjectId(subs[0].id);
            } else {
                setSelectedSubjectId('');
            }
        } catch (err) {
            console.error('Failed to fetch subjects:', err);
        }
    };

    useEffect(() => {
        if (viewMode === 'subject' && selectedClassId && selectedSubjectId) {
            fetchClassPerformance(selectedClassId, selectedSubjectId);
        }
    }, [selectedSubjectId, viewMode]);

    const fetchClassPerformance = async (cId, sId) => {
        try {
            setClassLoading(true);
            setClassError('');
            const data = await performanceService.getClassPerformance(cId, sId);
            setClassData(data);
        } catch (err) {
            console.error('Failed to fetch class performance:', err);
            setClassError('Could not load performance data for the selected filters.');
        } finally {
            setClassLoading(false);
        }
    };

    // ── Export Handlers ──
    const exportToExcel = () => {
        if (!classData || !classData.students) return;
        const exportData = classData.students.map(s => ({
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
        const fileName = viewMode === 'class' ? `${className}_Performance` : `${className}_Subject_Performance`;
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
    };

    const exportToPDF = () => {
        if (!classData || !classData.students) return;
        const doc = new jsPDF();
        
        const selectedClass = classes.find(c => c.id == selectedClassId);
        const className = selectedClass ? `${selectedClass.name}${selectedClass.section ? ` - ${selectedClass.section}` : ''}` : 'Class';
        let title = viewMode === 'class' ? `${className} Performance Report` : `${className} Subject Report`;
        
        doc.setFontSize(18);
        doc.text(title, 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

        const tableColumn = ["Rank", "Roll No", "Student Name", "Score", "Grade", "Marks", "Att", "Assgn", "Status"];
        const tableRows = [];

        classData.students.forEach(s => {
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
        const fileName = viewMode === 'class' ? `${safeClassName}_Performance` : `${safeClassName}_Subject_Performance`;
        doc.save(`${fileName}.pdf`);
    };

    // ── Render Helpers ──
    const renderOverall = () => {
        if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading overview...</div>;
        if (error) return <div style={{ color: 'red', textAlign: 'center' }}>{error}</div>;
        if (!overview) return null;

        const { avg_score, pass_rate, at_risk_count, student_count, top_class, class_breakdown, all_students } = overview;
        const sortedStudents = [...(all_students || [])].sort((a, b) => b.score - a.score);
        const topStudents = sortedStudents.slice(0, 10);
        const bottomStudents = [...sortedStudents].reverse().slice(0, 10);

        return (
            <>
                <div className="perf-overview-grid">
                    <div className="perf-overview-card" style={{ borderTop: '4px solid #6366f1' }}>
                        <div className="perf-overview-icon">📈</div>
                        <div className="perf-overview-value" style={{ color: '#6366f1' }}>{avg_score}</div>
                        <div className="perf-overview-label">Avg Score</div>
                        <div className="perf-overview-sub">Across {student_count} students</div>
                    </div>
                    <div className="perf-overview-card" style={{ borderTop: `4px solid ${pass_rate >= 50 ? '#10b981' : '#ef4444'}` }}>
                        <div className="perf-overview-icon">✅</div>
                        <div className="perf-overview-value" style={{ color: pass_rate >= 50 ? '#10b981' : '#ef4444' }}>{pass_rate}%</div>
                        <div className="perf-overview-label">Pass Rate</div>
                        <div className="perf-overview-sub">Score ≥ 50</div>
                    </div>
                    <div className="perf-overview-card" style={{ borderTop: '4px solid #f59e0b' }}>
                        <div className="perf-overview-icon">🏆</div>
                        <div className="perf-overview-value" style={{ color: '#f59e0b', fontSize: top_class?.name?.length > 10 ? '1.5rem' : '2.2rem' }}>
                            {top_class?.name || 'N/A'}
                        </div>
                        <div className="perf-overview-label">Top Class</div>
                        <div className="perf-overview-sub">Avg score: {top_class?.score || 0}</div>
                    </div>
                    <div className="perf-overview-card" style={{ borderTop: '4px solid #ef4444' }}>
                        <div className="perf-overview-icon">⚠️</div>
                        <div className="perf-overview-value" style={{ color: '#ef4444' }}>{at_risk_count}</div>
                        <div className="perf-overview-label">At-Risk Students</div>
                        <div className="perf-overview-sub">Needs attention</div>
                    </div>
                </div>

                <div className="perf-card" style={{ marginBottom: '2rem' }}>
                    <h3 className="perf-card-title">📚 Class Performance Comparison</h3>
                    <div className="perf-class-bars">
                        {class_breakdown.map(c => (
                            <div key={c.class_id} className="perf-class-bar-row">
                                <div className="perf-class-bar-name">{c.class_name}</div>
                                <div className="perf-class-bar-track">
                                    <div className="perf-class-bar-fill" style={{ width: `${c.avg_score}%` }} />
                                </div>
                                <div className="perf-class-bar-val">{c.avg_score}</div>
                                <div className="perf-class-bar-extra">{c.student_count} std</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="perf-top-bottom-grid">
                    <div className="perf-card">
                        <h3 className="perf-card-title">🌟 Top 10 Students</h3>
                        <table className="perf-ranked-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topStudents.map(s => (
                                    <tr key={s.student_id}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{s.student_name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Roll: {s.roll_number}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 700, color: '#10b981' }}>{s.score}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.grade}</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="perf-card">
                        <h3 className="perf-card-title" style={{ color: '#dc2626' }}>⚠️ Bottom 10 Students (At Risk)</h3>
                        <table className="perf-ranked-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bottomStudents.map(s => (
                                    <tr key={s.student_id} className="at-risk-row">
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{s.student_name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Roll: {s.roll_number}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 700, color: '#dc2626' }}>{s.score}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.grade}</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </>
        );
    };

    const renderClassData = () => {
        if (classLoading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading performance data...</div>;
        if (classError) return <div style={{ color: 'red', textAlign: 'center' }}>{classError}</div>;
        if (!classData) return null;

        return (
            <>
                <div className="perf-class-stats">
                    <div className="perf-class-stat" style={{ borderBottom: '4px solid #6366f1' }}>
                        <div className="perf-class-stat-val" style={{ color: '#6366f1' }}>{classData.stats.avg_score}</div>
                        <div className="perf-class-stat-label">Average Score</div>
                    </div>
                    <div className="perf-class-stat" style={{ borderBottom: `4px solid ${classData.stats.pass_rate >= 50 ? '#10b981' : '#ef4444'}` }}>
                        <div className="perf-class-stat-val" style={{ color: classData.stats.pass_rate >= 50 ? '#10b981' : '#ef4444' }}>{classData.stats.pass_rate}%</div>
                        <div className="perf-class-stat-label">Pass Rate</div>
                    </div>
                    <div className="perf-class-stat" style={{ borderBottom: '4px solid #f59e0b' }}>
                        <div className="perf-class-stat-val" style={{ color: '#f59e0b' }}>{classData.stats.highest}</div>
                        <div className="perf-class-stat-label">Highest Score</div>
                    </div>
                    <div className="perf-class-stat" style={{ borderBottom: '4px solid #ef4444' }}>
                        <div className="perf-class-stat-val" style={{ color: '#ef4444' }}>{classData.stats.at_risk_count}</div>
                        <div className="perf-class-stat-label">At-Risk Students</div>
                    </div>
                </div>

                {classData.at_risk?.length > 0 && (
                    <div className="perf-at-risk-section">
                        <h3 className="perf-at-risk-title">⚠️ Needs Immediate Attention</h3>
                        <div className="perf-at-risk-chips">
                            {classData.at_risk.map(s => (
                                <div key={s.student_id} className="perf-at-risk-chip">
                                    {s.student_name}
                                    <small>Score: {s.score} | Att: {s.att_pct}%</small>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="perf-card" style={{ marginTop: '1.5rem' }}>
                    <h3 className="perf-card-title">📊 Grade Distribution</h3>
                    <div className="perf-grade-dist">
                        {['A+', 'A', 'B+', 'B', 'C', 'D', 'F'].map(grade => {
                            const count = classData.grade_distribution[grade] || 0;
                            const maxCount = Math.max(...Object.values(classData.grade_distribution), 1);
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
                                {classData.students.map((s, idx) => (
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
                                {classData.students.length === 0 && (
                                    <tr>
                                        <td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>No students found for this selection.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </>
        );
    };

    return (
        <div className="dashboard-container perf-page">
            <div className="dashboard-header" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={() => navigate('/admin/dashboard')} style={{ background: 'none', border: '1.5px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem 0.85rem', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 600 }}>← Back</button>
                    <div>
                        <h1 style={{ margin: 0 }}>📊 Performance Hub</h1>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Analytics & Reports</p>
                    </div>
                </div>
            </div>

            {/* ── Toggle Buttons & Filters ── */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2rem', alignItems: 'center', background: '#fff', padding: '1.2rem 1.5rem', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.4rem', borderRadius: '10px' }}>
                    <button 
                        onClick={() => setViewMode('overall')}
                        style={{ padding: '0.6rem 1.5rem', fontSize: '0.95rem', borderRadius: '8px', border: 'none', background: viewMode === 'overall' ? '#4f46e5' : 'transparent', color: viewMode === 'overall' ? '#fff' : 'var(--text-secondary)', fontWeight: viewMode === 'overall' ? '600' : '500', cursor: 'pointer', boxShadow: viewMode === 'overall' ? '0 2px 8px rgba(79, 70, 229, 0.4)' : 'none', transition: 'all 0.2s' }}
                    >
                        🌎 Overall
                    </button>
                    <button 
                        onClick={() => setViewMode('class')}
                        style={{ padding: '0.6rem 1.5rem', fontSize: '0.95rem', borderRadius: '8px', border: 'none', background: viewMode === 'class' ? '#4f46e5' : 'transparent', color: viewMode === 'class' ? '#fff' : 'var(--text-secondary)', fontWeight: viewMode === 'class' ? '600' : '500', cursor: 'pointer', boxShadow: viewMode === 'class' ? '0 2px 8px rgba(79, 70, 229, 0.4)' : 'none', transition: 'all 0.2s' }}
                    >
                        📚 Class
                    </button>
                    <button 
                        onClick={() => setViewMode('subject')}
                        style={{ padding: '0.6rem 1.5rem', fontSize: '0.95rem', borderRadius: '8px', border: 'none', background: viewMode === 'subject' ? '#4f46e5' : 'transparent', color: viewMode === 'subject' ? '#fff' : 'var(--text-secondary)', fontWeight: viewMode === 'subject' ? '600' : '500', cursor: 'pointer', boxShadow: viewMode === 'subject' ? '0 2px 8px rgba(79, 70, 229, 0.4)' : 'none', transition: 'all 0.2s' }}
                    >
                        📖 Subject
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '1rem', flex: 1, justifyContent: 'flex-end' }}>
                    {(viewMode === 'class' || viewMode === 'subject') && (
                        <select
                            className="form-control"
                            value={selectedClassId}
                            onChange={(e) => setSelectedClassId(e.target.value)}
                            style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', minWidth: '180px', fontWeight: '500' }}
                        >
                            {classes.map(c => (
                                <option key={c.id} value={c.id}>{c.name}{c.section ? ` - ${c.section}` : ''}</option>
                            ))}
                        </select>
                    )}
                    {viewMode === 'subject' && (
                        <select
                            className="form-control"
                            value={selectedSubjectId}
                            onChange={(e) => setSelectedSubjectId(e.target.value)}
                            style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', minWidth: '180px' }}
                        >
                            {subjects.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                            {subjects.length === 0 && <option value="">No Subjects</option>}
                        </select>
                    )}
                </div>
            </div>

            {/* ── Content View ── */}
            {viewMode === 'overall' && renderOverall()}
            {(viewMode === 'class' || viewMode === 'subject') && renderClassData()}
            
        </div>
    );
}

export default AdminPerformance;
