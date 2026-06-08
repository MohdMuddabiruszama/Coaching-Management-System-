import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import performanceService from '../../services/performance.service';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import '../student/Performance.css';
import './ViewStudents.css';

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
                s.rank, s.roll_number, s.student_name, s.score, s.grade,
                s.marks_pct + '%', s.att_pct + '%', s.ass_pct + '%',
                s.status.replace('_', ' ').toUpperCase()
            ];
            tableRows.push(rowData);
        });

        autoTable(doc, {
            head: [tableColumn], body: tableRows, startY: 40, theme: 'grid',
            headStyles: { fillColor: [79, 70, 229] }, styles: { fontSize: 9 }
        });

        const safeClassName = selectedClass ? selectedClass.name.replace(/\s+/g, '_') : 'Class';
        doc.save(`${safeClassName}_Performance.pdf`);
    };

    if (loading && !data) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
                <div style={{ textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'pulse 2s infinite' }}>📊</div>
                    <p style={{ fontWeight: '500' }}>Loading class performance...</p>
                </div>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
                <div style={{ textAlign: 'center', color: '#ef4444', background: '#fee2e2', padding: '2rem', borderRadius: '12px' }}>
                    <p style={{ fontWeight: '600', marginBottom: '1rem' }}>{error}</p>
                    <button onClick={() => navigate(-1)} style={{ padding: '0.5rem 1rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>Go Back</button>
                </div>
            </div>
        );
    }

    // --- Prepare Chart Data ---
    const chartColors = {
        'A+': '#3b82f6', 'A': '#2563eb', 'B+': '#10b981', 'B': '#f59e0b',
        'C': '#f97316', 'D': '#ef4444', 'F': '#9ca3af'
    };

    let totalStudents = 0;
    let validChartData = [];
    if (data && data.grade_distribution) {
        totalStudents = Object.values(data.grade_distribution).reduce((a, b) => a + b, 0);
        ['A+', 'A', 'B+', 'B', 'C', 'D', 'F'].forEach(grade => {
            const val = data.grade_distribution[grade] || 0;
            validChartData.push({ name: grade, value: val, color: chartColors[grade] });
        });
    }

    const passedCount = totalStudents > 0 ? Math.round((data.stats.pass_rate / 100) * totalStudents) : 0;
    const highestStudent = data?.students?.length > 0 ? data.students[0].student_name : 'N/A';

    return (
        <div className="fvs-container">
            {/* Header */}
            <div className="fvs-header">
                <div className="fvs-title-area">
                    <div className="fvs-title-icon">📊</div>
                    <div className="fvs-title-text">
                        <h1>Class Performance</h1>
                        <p>Monitor and identify at-risk students to take timely action.</p>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="fvs-filters-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: '600' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    Select Class:
                </div>
                <select
                    className="fvs-filter-select"
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                >
                    {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}{c.section ? ` - ${c.section}` : ''}</option>
                    ))}
                </select>
            </div>

            {data && (
                <>
                    {/* Top 4 Stats Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                        {/* Average Score */}
                        <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
                            <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: '#f3e8ff', color: '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><path d="M9 21V9"></path></svg>
                            </div>
                            <div>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>Class Average Score</p>
                                <h2 style={{ margin: '0.2rem 0', fontSize: '1.5rem', color: '#0f172a', fontWeight: '700' }}>{data.stats.avg_score}/100</h2>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#10b981', fontWeight: '500' }}>Good performance</p>
                            </div>
                        </div>

                        {/* Pass Rate */}
                        <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
                            <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            </div>
                            <div>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>Pass Rate</p>
                                <h2 style={{ margin: '0.2rem 0', fontSize: '1.5rem', color: '#0f172a', fontWeight: '700' }}>{data.stats.pass_rate}%</h2>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#16a34a', fontWeight: '500' }}>{passedCount} of {totalStudents} students passed</p>
                            </div>
                        </div>

                        {/* Highest Score */}
                        <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
                            <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                            </div>
                            <div>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>Highest Score</p>
                                <h2 style={{ margin: '0.2rem 0', fontSize: '1.5rem', color: '#0f172a', fontWeight: '700' }}>{data.stats.highest}/100</h2>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#d97706', fontWeight: '500' }}>{highestStudent}</p>
                            </div>
                        </div>

                        {/* At-Risk Students */}
                        <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
                            <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            </div>
                            <div>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>At-Risk Students</p>
                                <h2 style={{ margin: '0.2rem 0', fontSize: '1.5rem', color: '#0f172a', fontWeight: '700' }}>{data.stats.at_risk_count}</h2>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#dc2626', fontWeight: '500' }}>Needs attention</p>
                            </div>
                        </div>
                    </div>

                    {/* Needs Immediate Attention Banner */}
                    {data.at_risk?.length > 0 && (
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #fca5a5', paddingRight: '1.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b91c1c', fontWeight: '600', fontSize: '1.1rem' }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                        Needs Immediate Attention
                                    </div>
                                    <span style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '0.25rem' }}>{data.stats.at_risk_count} student{data.stats.at_risk_count !== 1 ? 's are' : ' is'} performing below 50%.</span>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                    {data.at_risk.map(s => (
                                        <div key={s.student_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#fee2e2', padding: '0.5rem 1rem', borderRadius: '8px' }}>
                                            <div style={{ background: '#dc2626', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                                {s.student_name.split(' ').map(n=>n[0]).join('').substring(0,2)}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '0.9rem' }}>{s.student_name}</span>
                                                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Score: {s.score}/100 • {s.att_pct}% attendance</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Main Grid: Chart & Table */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', alignItems: 'start' }}>
                        
                        {/* Left Col: Grade Distribution Donut */}
                        <div style={{ background: 'white', border: '1px solid #f1f5f9', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
                            <h3 style={{ margin: '0 0 1.5rem 0', color: '#0f172a', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15.46L13.73 21a2 2 0 0 1-2.46 0L4 15.46"></path><path d="M21 8.54L13.73 3a2 2 0 0 0-2.46 0L4 8.54"></path><path d="M12 22V12"></path><path d="M12 12V2"></path><path d="M20 16L12 12"></path><path d="M4 16L12 12"></path><path d="M20 8L12 12"></path><path d="M4 8L12 12"></path></svg>
                                Grade Distribution
                            </h3>
                            <div style={{ height: '220px', position: 'relative' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={validChartData} innerRadius={60} outerRadius={85} paddingAngle={2} dataKey="value" stroke="none">
                                            {validChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0f172a' }}>{totalStudents}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Students</div>
                                </div>
                            </div>
                            
                            <div style={{ marginTop: '2rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', fontSize: '0.8rem', color: '#64748b', fontWeight: '600', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                                    <div>Grade</div>
                                    <div style={{ textAlign: 'center' }}>Students</div>
                                    <div style={{ textAlign: 'right' }}>Percentage</div>
                                </div>
                                {validChartData.map(item => (
                                    <div key={item.name} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center', fontSize: '0.85rem', color: '#334155', fontWeight: '500', padding: '0.4rem 0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }}></div>
                                            {item.name}
                                        </div>
                                        <div style={{ textAlign: 'center' }}>{item.value}</div>
                                        <div style={{ textAlign: 'right' }}>{((item.value / totalStudents) * 100).toFixed(1)}%</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right Col: Class Rankings Table */}
                        <div style={{ background: 'white', border: '1px solid #f1f5f9', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)', display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                    Class Rankings
                                </h3>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button onClick={exportToExcel} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.8rem', background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0', borderRadius: '6px', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer' }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                                        Export Excel
                                    </button>
                                    <button onClick={exportToPDF} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.8rem', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '6px', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer' }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                        Export PDF
                                    </button>
                                </div>
                            </div>
                            
                            <div style={{ flex: 1, overflowX: 'auto', padding: '0 1.5rem' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', textAlign: 'left', minWidth: '600px' }}>
                                    <thead>
                                        <tr style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: '600', borderBottom: '1px solid #e2e8f0' }}>
                                            <th style={{ padding: '0.75rem 0.5rem' }}>Rank</th>
                                            <th style={{ padding: '0.75rem 0.5rem' }}>Roll No.</th>
                                            <th style={{ padding: '0.75rem 0.5rem' }}>Student Name</th>
                                            <th style={{ padding: '0.75rem 0.5rem' }}>Score</th>
                                            <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Grade</th>
                                            <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Marks %</th>
                                            <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Attendance</th>
                                            <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody style={{ fontSize: '0.9rem', color: '#1e293b' }}>
                                        {data.students.slice(0, 6).map((s, idx) => {
                                            const isTop3 = s.rank <= 3;
                                            let rankColor = '#1e293b';
                                            if (s.rank === 1) rankColor = '#d97706';
                                            if (s.rank === 2) rankColor = '#ea580c';
                                            if (s.rank === 3) rankColor = '#b45309';

                                            let statusBg = '#dcfce7', statusCol = '#16a34a';
                                            if (s.status === 'average') { statusBg = '#fef3c7'; statusCol = '#d97706'; }
                                            if (s.status === 'at_risk') { statusBg = '#fee2e2'; statusCol = '#dc2626'; }

                                            return (
                                                <tr key={s.student_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '1rem 0.5rem', fontWeight: isTop3 ? '700' : '600', color: rankColor }}>#{s.rank}</td>
                                                    <td style={{ padding: '1rem 0.5rem', color: '#64748b', fontSize: '0.85rem' }}>{s.roll_number}</td>
                                                    <td style={{ padding: '1rem 0.5rem', fontWeight: '600' }}>{s.student_name}</td>
                                                    <td style={{ padding: '1rem 0.5rem', fontWeight: '500' }}>{s.score}/100</td>
                                                    <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                                                        <div style={{ display: 'inline-flex', width: '26px', height: '26px', background: chartColors[s.grade] || '#9ca3af', color: 'white', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: '700' }}>
                                                            {s.grade}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '1rem 0.5rem', textAlign: 'center', color: '#475569' }}>{s.marks_pct}%</td>
                                                    <td style={{ padding: '1rem 0.5rem', textAlign: 'center', color: '#475569' }}>{s.att_pct}%</td>
                                                    <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                                                        <span style={{ background: statusBg, color: statusCol, padding: '0.25rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600' }}>
                                                            {s.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {data.students.length === 0 && (
                                            <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No data available</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Footer Tip */}
                    <div style={{ marginTop: '2rem', background: '#eff6ff', borderRadius: '12px', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid #bfdbfe' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold', flexShrink: 0 }}>i</div>
                        <p style={{ margin: 0, color: '#1e3a8a', fontSize: '0.9rem', fontWeight: '500' }}>
                            <span style={{ fontWeight: '600' }}>Tip:</span> Click on any student to view detailed performance analytics and individual subject breakdown.
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}

export default FacultyClassPerformance;
