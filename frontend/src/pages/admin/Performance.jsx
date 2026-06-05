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
    const [term, setTerm] = useState('This Term');
    
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', margin: '0 0 24px' }}>
                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div style={{ width: 56, height: 56, borderRadius: '12px', background: '#f3e8ff', color: '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                            📈
                        </div>
                        <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', marginBottom: '2px' }}>Average Score</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827' }}>{avg_score}</div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280', margin: '2px 0 4px' }}>Across {student_count} students</div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                ↑ 5% from last term
                            </div>
                        </div>
                    </div>

                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div style={{ width: 56, height: 56, borderRadius: '12px', background: '#dcfce7', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                            ✅
                        </div>
                        <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', marginBottom: '2px' }}>Pass Rate</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827' }}>{pass_rate}%</div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280', margin: '2px 0 4px' }}>Score ≥ 50</div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                ↑ 3% from last term
                            </div>
                        </div>
                    </div>

                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div style={{ width: 56, height: 56, borderRadius: '12px', background: '#fef3c7', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                            🏆
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', marginBottom: '2px' }}>Top Class</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{top_class?.name || 'N/A'}</div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280', margin: '2px 0 4px' }}>Average Score: {top_class?.score || 0}%</div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                Best performing class
                            </div>
                        </div>
                    </div>

                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div style={{ width: 56, height: 56, borderRadius: '12px', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                            ⚠️
                        </div>
                        <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', marginBottom: '2px' }}>At-Risk Students</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444' }}>{at_risk_count}</div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280', margin: '2px 0 4px' }}>Need attention</div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                ↓ 2 from last term
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', gridColumn: 'span 1' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                            <span style={{ fontSize: '1.2rem' }}>📊</span>
                            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>Class Performance Comparison</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {class_breakdown.map(c => (
                                <div key={c.class_id} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 40px 40px', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', textAlign: 'right' }}>{c.class_name}</div>
                                    <div style={{ background: '#f3f4f6', borderRadius: '4px', height: '16px', overflow: 'hidden' }}>
                                        <div style={{ width: `${c.avg_score}%`, height: '100%', background: '#8b5cf6', borderRadius: '4px' }} />
                                    </div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6366f1' }}>{c.avg_score}%</div>
                                    <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>{c.student_count} std</div>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: '20px' }}>
                            <button onClick={() => setViewMode('class')} style={{ background: '#f3e8ff', color: '#7e22ce', border: 'none', padding: '6px 16px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>View Class Report</button>
                        </div>
                    </div>

                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', gridColumn: 'span 1' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1.2rem' }}>⭐</span>
                                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>Top 10 Students</h3>
                            </div>
                            <button style={{ background: '#f3e8ff', color: '#7e22ce', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>View All</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {topStudents.slice(0, 5).map((s, idx) => (
                                <div key={s.student_id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: 24, height: 24, borderRadius: '6px', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                                        {idx + 1}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.student_name}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>Roll: {s.roll_number}</div>
                                    </div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981' }}>{s.score}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', gridColumn: 'span 1' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1.2rem' }}>❗</span>
                                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>Bottom 10 Students (At Risk)</h3>
                            </div>
                            <button style={{ background: '#f3e8ff', color: '#7e22ce', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>View All</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {bottomStudents.slice(0, 5).map((s, idx) => (
                                <div key={s.student_id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: 24, height: 24, borderRadius: '6px', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                                        {idx + 1}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.student_name}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>Roll: {s.roll_number}</div>
                                    </div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ef4444' }}>{s.score}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', gridColumn: 'span 1' }}>
                        <h3 style={{ margin: '0 0 20px', fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>Score Distribution</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                            <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'conic-gradient(#10b981 0% 40%, #3b82f6 40% 75%, #f59e0b 75% 95%, #ef4444 95% 100%)', position: 'relative' }}>
                                <div style={{ position: 'absolute', top: 30, left: 30, right: 30, bottom: 30, background: '#fff', borderRadius: '50%' }}></div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: 10, height: 10, background: '#10b981' }}></div>
                                    <span style={{ fontSize: '0.8rem', color: '#4b5563', width: 60 }}>90 - 100</span>
                                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>40% (16 students)</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: 10, height: 10, background: '#3b82f6' }}></div>
                                    <span style={{ fontSize: '0.8rem', color: '#4b5563', width: 60 }}>75 - 89</span>
                                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>35% (14 students)</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: 10, height: 10, background: '#f59e0b' }}></div>
                                    <span style={{ fontSize: '0.8rem', color: '#4b5563', width: 60 }}>50 - 74</span>
                                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>20% (8 students)</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: 10, height: 10, background: '#ef4444' }}></div>
                                    <span style={{ fontSize: '0.8rem', color: '#4b5563', width: 60 }}>Below 50</span>
                                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>5% (2 students)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', gridColumn: 'span 1' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                            <span style={{ fontSize: '1.2rem' }}>💡</span>
                            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>Performance Insights</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ background: '#ecfdf5', border: '1px solid #d1fae5', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>✓</div>
                                <div style={{ fontSize: '0.85rem', color: '#065f46' }}>Class 12 is the top performing class with an average score of 92%.</div>
                            </div>
                            <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: 24, height: 24, color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>⚠️</div>
                                <div style={{ fontSize: '0.85rem', color: '#92400e' }}>7 students are at risk and need immediate attention.</div>
                            </div>
                            <div style={{ background: '#f3e8ff', border: '1px solid #e9d5ff', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: 24, height: 24, color: '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>📈</div>
                                <div style={{ fontSize: '0.85rem', color: '#581c87' }}>Overall performance has improved by 5% compared to last term.</div>
                            </div>
                        </div>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', margin: '0 0 24px' }}>
                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div style={{ width: 56, height: 56, borderRadius: '12px', background: '#f3e8ff', color: '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                            📈
                        </div>
                        <div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827' }}>{classData.stats.avg_score} <span style={{ fontSize: '1rem', color: '#6b7280', fontWeight: 600 }}>/ 100</span></div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Average Score</div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                ↑ 5% from last term
                            </div>
                        </div>
                    </div>

                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div style={{ width: 56, height: 56, borderRadius: '12px', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                            🛡️
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>{classData.stats.pass_rate}%</div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Pass Rate</div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                ↑ 3% from last term
                            </div>
                        </div>
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: `conic-gradient(#10b981 0% ${classData.stats.pass_rate}%, #e5e7eb ${classData.stats.pass_rate}% 100%)`, position: 'relative', flexShrink: 0 }}>
                            <div style={{ position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, background: '#fff', borderRadius: '50%' }}></div>
                        </div>
                    </div>

                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div style={{ width: 56, height: 56, borderRadius: '12px', background: '#fef3c7', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                            🏆
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b' }}>{classData.stats.highest} <span style={{ fontSize: '1rem', color: '#6b7280', fontWeight: 600 }}>/ 100</span></div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Highest Score</div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                Top Performer
                            </div>
                        </div>
                    </div>

                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div style={{ width: 56, height: 56, borderRadius: '12px', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                            ⚠️
                        </div>
                        <div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444' }}>{classData.stats.at_risk_count}</div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>At-Risk Students</div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                Needs attention
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '5fr 4fr', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px' }}>
                        <h3 style={{ margin: '0 0 24px', fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>Score Distribution</h3>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '160px', paddingBottom: '10px', borderBottom: '1px solid #e5e7eb' }}>
                            {['A+', 'A', 'B+', 'B', 'C', 'D', 'F'].map((grade, i) => {
                                const colors = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#f97316', '#ef4444', '#b91c1c'];
                                const count = classData.grade_distribution[grade] || 0;
                                const maxCount = Math.max(...Object.values(classData.grade_distribution), 1);
                                const heightPct = (count / maxCount) * 100;
                                return (
                                    <div key={grade} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', height: '100%' }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginTop: 'auto' }}>{count}</div>
                                        <div style={{ width: '60%', minHeight: '4px', height: `${heightPct}%`, background: colors[i], borderRadius: '4px 4px 0 0', transition: 'height 0.5s' }} />
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                            {['A+', 'A', 'B+', 'B', 'C', 'D', 'F'].map(grade => {
                                const labels = { 'A+': '90-100', 'A': '75-89', 'B+': '60-74', 'B': '50-59', 'C': '40-49', 'D': '30-39', 'F': 'Below 30' };
                                return (
                                    <div key={grade} style={{ flex: 1, textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4b5563' }}>{grade}</div>
                                        <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>({labels[grade]})</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px' }}>
                        <h3 style={{ margin: '0 0 24px', fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>Performance Insights</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ background: '#f9fafb', border: '1px solid #f3f4f6', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>✓</div>
                                <div style={{ fontSize: '0.85rem', color: '#374151' }}>Class average has improved by 5% compared to last term.</div>
                            </div>
                            <div style={{ background: '#f9fafb', border: '1px solid #f3f4f6', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: 24, height: 24, color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>⭐</div>
                                <div style={{ fontSize: '0.85rem', color: '#374151' }}>{(classData.grade_distribution['A+'] || 0) + (classData.grade_distribution['A'] || 0)} students scored above 75. Keep up the great work!</div>
                            </div>
                            <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: 24, height: 24, color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>⚠️</div>
                                <div style={{ fontSize: '0.85rem', color: '#92400e' }}>{classData.stats.at_risk_count} student(s) are at risk and need immediate attention.</div>
                            </div>
                            <div style={{ background: '#eff6ff', border: '1px solid #dbeafe', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontStyle: 'italic', fontWeight: 'serif' }}>i</div>
                                <div style={{ fontSize: '0.85rem', color: '#1e40af' }}>3 students improved by more than 10% since last term.</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#111827' }}>Class Rankings</h3>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={exportToExcel} style={{ padding: '6px 16px', background: '#fff', border: '1px solid #10b981', color: '#10b981', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}>
                                <span>📊</span> Export Excel
                            </button>
                            <button onClick={exportToPDF} style={{ padding: '6px 16px', background: '#fff', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}>
                                <span>📄</span> Download PDF
                            </button>
                        </div>
                    </div>
                    
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                                    <th style={{ padding: '12px 8px', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Rank</th>
                                    <th style={{ padding: '12px 8px', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Roll No.</th>
                                    <th style={{ padding: '12px 8px', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Student Name</th>
                                    <th style={{ padding: '12px 8px', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Score</th>
                                    <th style={{ padding: '12px 8px', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Grade</th>
                                    <th style={{ padding: '12px 8px', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Marks %</th>
                                    <th style={{ padding: '12px 8px', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Attendance %</th>
                                    <th style={{ padding: '12px 8px', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Assignments %</th>
                                    <th style={{ padding: '12px 8px', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {classData.students.map((s, idx) => {
                                    const rank = s.rank;
                                    const getRankDisplay = (r) => {
                                        if (r === 1) return <span style={{ color: '#f59e0b', fontSize: '1.2rem', fontWeight: 800 }}>🥇 #1</span>;
                                        if (r === 2) return <span style={{ color: '#9ca3af', fontSize: '1.2rem', fontWeight: 800 }}>🥈 #2</span>;
                                        if (r === 3) return <span style={{ color: '#b45309', fontSize: '1.2rem', fontWeight: 800 }}>🥉 #3</span>;
                                        return <span style={{ fontWeight: 700, color: '#111827' }}>#{r}</span>;
                                    };
                                    
                                    const gradeColors = { 'A+': '#7c3aed', 'A': '#3b82f6', 'B+': '#10b981', 'B': '#f59e0b', 'C': '#f97316', 'D': '#ef4444', 'F': '#b91c1c' };
                                    const statusColors = { 
                                        'excellent': { bg: '#dcfce7', text: '#166534' },
                                        'good': { bg: '#dbeafe', text: '#1e40af' },
                                        'average': { bg: '#fef3c7', text: '#92400e' },
                                        'at_risk': { bg: '#fee2e2', text: '#991b1b' }
                                    };
                                    const statC = statusColors[s.status] || statusColors['good'];

                                    return (
                                        <tr key={s.student_id} style={{ borderBottom: '1px solid #f3f4f6', background: s.status === 'at_risk' ? '#fef2f2' : 'transparent' }}>
                                            <td style={{ padding: '16px 8px' }}>{getRankDisplay(rank)}</td>
                                            <td style={{ padding: '16px 8px', fontSize: '0.85rem', color: '#4b5563', fontWeight: 600 }}>{s.roll_number}</td>
                                            <td style={{ padding: '16px 8px', fontSize: '0.9rem', color: '#111827', fontWeight: 600 }}>{s.student_name}</td>
                                            <td style={{ padding: '16px 8px', fontSize: '0.95rem', color: '#111827', fontWeight: 800 }}>{s.score} <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>/ 100</span></td>
                                            <td style={{ padding: '16px 8px' }}>
                                                <span style={{ background: gradeColors[s.grade] || '#6366f1', color: '#fff', padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                                                    {s.grade}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px 8px', fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>{s.marks_pct}%</td>
                                            <td style={{ padding: '16px 8px', fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>{s.att_pct}%</td>
                                            <td style={{ padding: '16px 8px', fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>{s.ass_pct}%</td>
                                            <td style={{ padding: '16px 8px' }}>
                                                <span style={{ background: statC.bg, color: statC.text, padding: '4px 12px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'capitalize' }}>
                                                    {s.status.replace('_', ' ')}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {classData.students.length === 0 && (
                                    <tr>
                                        <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>No students found for this selection.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
                        <button onClick={exportToPDF} style={{ background: '#f3e8ff', color: '#7e22ce', border: 'none', padding: '8px 24px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>📄</span> View Full Class Report
                        </button>
                    </div>
                </div>
            </>
        );
    };

    return (
        <div className="dashboard-container perf-page">
            <div className="dashboard-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: 40, height: 40, background: '#fce7f3', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                        🎯
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#111827' }}>Performance Hub</h1>
                        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem' }}>Track performance, analyze trends and take action</p>
                    </div>
                </div>
                <div style={{ marginRight: '180px' }}>
                    <button onClick={exportToPDF} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: '#374151', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                        📥 Export Report
                    </button>
                </div>
            </div>

            {/* ── Toggle Buttons & Filters ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button 
                        onClick={() => setViewMode('overall')}
                        style={{ padding: '8px 20px', fontSize: '0.85rem', borderRadius: '20px', border: viewMode === 'overall' ? 'none' : '1px solid #e5e7eb', background: viewMode === 'overall' ? '#6366f1' : '#fff', color: viewMode === 'overall' ? '#fff' : '#4b5563', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: viewMode === 'overall' ? '0 4px 12px rgba(99,102,241,0.3)' : 'none' }}
                    >
                        {viewMode === 'overall' && <span>🛡️</span>} Overview
                    </button>
                    <button 
                        onClick={() => setViewMode('class')}
                        style={{ padding: '8px 20px', fontSize: '0.85rem', borderRadius: '20px', border: viewMode === 'class' ? 'none' : '1px solid #e5e7eb', background: viewMode === 'class' ? '#6366f1' : '#fff', color: viewMode === 'class' ? '#fff' : '#4b5563', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: viewMode === 'class' ? '0 4px 12px rgba(99,102,241,0.3)' : 'none' }}
                    >
                        {viewMode === 'class' && <span>🛡️</span>} Class
                    </button>
                    <button 
                        onClick={() => setViewMode('subject')}
                        style={{ padding: '8px 20px', fontSize: '0.85rem', borderRadius: '20px', border: viewMode === 'subject' ? 'none' : '1px solid #e5e7eb', background: viewMode === 'subject' ? '#6366f1' : '#fff', color: viewMode === 'subject' ? '#fff' : '#4b5563', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: viewMode === 'subject' ? '0 4px 12px rgba(99,102,241,0.3)' : 'none' }}
                    >
                        {viewMode === 'subject' && <span>🛡️</span>} Subject
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '2px 12px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                        <span style={{ fontSize: '1rem', color: '#6b7280' }}>📅</span>
                        <select 
                            value={term}
                            onChange={(e) => setTerm(e.target.value)}
                            style={{ border: 'none', outline: 'none', background: 'transparent', padding: '8px 4px', fontSize: '0.85rem', fontWeight: 600, color: '#374151', cursor: 'pointer', minWidth: '110px' }}
                        >
                            <option value="This Term">This Term</option>
                            <option value="Last Term">Last Term</option>
                            <option value="Term 1 (2025-26)">Term 1 (2025-26)</option>
                        </select>
                    </div>
                    {(viewMode === 'class' || viewMode === 'subject') && (
                        <select
                            className="form-control"
                            value={selectedClassId}
                            onChange={(e) => setSelectedClassId(e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', fontWeight: '500' }}
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
                            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', fontWeight: '500' }}
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
