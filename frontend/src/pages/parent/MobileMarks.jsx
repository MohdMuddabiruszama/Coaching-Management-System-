import React, { useState, useEffect, useContext, useMemo } from "react";
import { AuthContext } from "../../context/AuthContext";
import * as parentService from "../../services/parent.service";
import markService from "../../services/mark.service";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import "./MobileMarks.css";
import "./MobileDashboard.css"; // For student selector styling

export default function MobileMarks() {
    const { user } = useContext(AuthContext);
    
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    
    // Data
    const [fullResults, setFullResults] = useState([]);
    
    // Filters
    const [selectedYear, setSelectedYear] = useState("2025 - 2026");
    const [selectedTerm, setSelectedTerm] = useState("All Terms");

    useEffect(() => {
        fetchDashboard();
    }, []);

    const fetchDashboard = async () => {
        try {
            const data = await parentService.getParentDashboard();
            const loadedStudents = data?.data?.students || [];
            setStudents(loadedStudents);
            
            if (loadedStudents.length > 0) {
                const storedId = sessionStorage.getItem("parentSelectedStudentId");
                const studentToSelect = loadedStudents.find(s => s.id.toString() === storedId) || loadedStudents[0];
                await selectStudent(studentToSelect);
            } else {
                setLoading(false);
            }
        } catch (error) {
            console.error("Error fetching students:", error);
            setLoading(false);
        }
    };

    const selectStudent = async (student) => {
        if (!student) return;
        sessionStorage.setItem("parentSelectedStudentId", student.id.toString());
        setSelectedStudent(student);
        setDetailLoading(true);
        
        try {
            const results = await markService.getParentChild(student.id);
            setFullResults(results || []);
        } catch (error) {
            console.error("Error fetching performance details", error);
        } finally {
            setLoading(false);
            setDetailLoading(false);
        }
    };

    // Derived statistics and filtered data
    const { filteredResults, stats } = useMemo(() => {
        // In a real app we'd filter by selectedYear and selectedTerm here.
        // For now, we apply client-side filtering on all records since the backend returns all.
        let filtered = [...fullResults];
        
        // Filter by term/type
        if (selectedTerm !== "All Terms") {
            filtered = filtered.filter(r => r.exam_type?.toLowerCase() === selectedTerm.toLowerCase() || r.exam_title?.toLowerCase().includes(selectedTerm.toLowerCase()));
        }

        let passed = 0;
        let failed = 0;
        let totalPct = 0;
        
        filtered.forEach(mark => {
            if (mark.status === 'Pass') passed++;
            else failed++;
            totalPct += parseFloat(mark.percentage) || 0;
        });

        const totalExams = filtered.length;
        const avgPercentage = totalExams > 0 ? (totalPct / totalExams).toFixed(2) : "0.00";
        const passRate = totalExams > 0 ? Math.round((passed / totalExams) * 100) : 0;
        const failRate = totalExams > 0 ? Math.round((failed / totalExams) * 100) : 0;

        return {
            filteredResults: filtered,
            stats: {
                totalExams,
                avgPercentage,
                passed,
                failed,
                passRate,
                failRate
            }
        };
    }, [fullResults, selectedYear, selectedTerm]);

    if (loading) {
        return (
            <div className="mm-container" style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div className="mm-container" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            {/* Header */}
            <div className="mm-header" style={{ paddingBottom: '0' }}>
                <div className="mm-title-area">
                    <div className="mm-title-icon">📊</div>
                    <div className="mm-title-text">
                        <h1>Marks</h1>
                        <p>Academic performance overview</p>
                    </div>
                </div>
            </div>

            {/* Student Selector */}
            <div className="mpd-student-scroll" style={{ padding: '0 16px', marginBottom: '16px' }}>
                {students.map((student, idx) => {
                    const isSelected = selectedStudent?.id === student.id;
                    const initials = student.User?.name?.substring(0,2).toUpperCase() || 'ST';
                    return (
                        <div 
                            key={student.id} 
                            className={`mpd-student-card ${isSelected ? 'active' : ''} ${idx % 2 !== 0 && !isSelected ? 'white-bg' : ''}`}
                            onClick={() => selectStudent(student)}
                        >
                            <div className="mpd-student-avatar-circle" style={{ width: '36px', height: '36px', fontSize: '14px' }}>
                                {initials}
                            </div>
                            <div className="mpd-student-details">
                                <h3 style={{ fontSize: '14px' }}>{student.User?.name?.split(" ")[0]}</h3>
                                <p style={{ fontSize: '10px' }}>{student.Classes?.[0]?.name || 'Class'}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {detailLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><LoadingSpinner /></div>
            ) : (
                <>
                    {/* Filters Row */}
                    <div className="mm-filters-row">
                        <div className="mm-filter-box">
                            <div className="mm-filter-icon purple-bg">
                                <span style={{fontSize: '18px'}}>📅</span>
                            </div>
                            <div className="mm-filter-content">
                                <div className="mm-filter-label">Academic Year</div>
                                <div className="mm-filter-value">
                                    2025 - 2026
                                </div>
                            </div>
                        </div>
                        <div className="mm-filter-box" style={{ position: 'relative' }}>
                            <div className="mm-filter-icon gray-bg">
                                <span style={{fontSize: '16px'}}>⚗️</span>
                            </div>
                            <div className="mm-filter-content">
                                <div className="mm-filter-label">Filter</div>
                                <div className="mm-filter-value">
                                    {selectedTerm}
                                    <span style={{fontSize:'10px', color:'#64748b'}}>⌄</span>
                                </div>
                            </div>
                            <select 
                                value={selectedTerm} 
                                onChange={(e) => setSelectedTerm(e.target.value)}
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, appearance: 'none', border: 'none' }}
                            >
                                <option value="All Terms">All Terms</option>
                                <option value="First Term">First Term</option>
                                <option value="Second Term">Second Term</option>
                                <option value="Third Term">Third Term</option>
                                <option value="Final Term">Final Term</option>
                            </select>
                        </div>
                    </div>

                    {/* Stats Grid 2x2 */}
                    <div className="mm-stats-grid">
                        <div className="mm-stat-card avg-card">
                            <div className="mm-stat-header">
                                <div className="mm-stat-icon-wrap light-purple">📄</div>
                                <div className="mm-stat-title">Average Percentage</div>
                            </div>
                            <div className="mm-stat-value">{stats.avgPercentage}%</div>
                            <div className="mm-stat-subtitle">Overall Performance</div>
                            <div className="mm-stat-progress-bar">
                                <div className="mm-stat-progress-fill" style={{ width: `${Math.min(100, Math.max(0, stats.avgPercentage))}%` }}></div>
                            </div>
                        </div>
                        <div className="mm-stat-card total-card">
                            <div className="mm-stat-header">
                                <div className="mm-stat-icon-wrap light-green">✓</div>
                                <div className="mm-stat-title">Total Exams</div>
                            </div>
                            <div className="mm-stat-value">{stats.totalExams}</div>
                            <div className="mm-stat-subtitle">All Subjects</div>
                        </div>
                        <div className="mm-stat-card pass-card">
                            <div className="mm-stat-header">
                                <div className="mm-stat-icon-wrap light-blue" style={{background:'#e0f2fe'}}>🏆</div>
                                <div className="mm-stat-title">Passed Exams</div>
                            </div>
                            <div className="mm-stat-value">{stats.passed}</div>
                            <div className="mm-stat-subtitle green">{stats.passRate}% of total</div>
                        </div>
                        <div className="mm-stat-card fail-card">
                            <div className="mm-stat-header">
                                <div className="mm-stat-icon-wrap light-red">✕</div>
                                <div className="mm-stat-title">Failed Exams</div>
                            </div>
                            <div className="mm-stat-value">{stats.failed}</div>
                            <div className="mm-stat-subtitle red">{stats.failRate}% of total</div>
                        </div>
                    </div>

                    {/* Results List */}
                    <div className="mm-results-list">
                        {filteredResults.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                No results found.
                            </div>
                        ) : (
                            filteredResults.map((mark, idx) => {
                                const subjectName = mark.subject_name || 'N/A';
                                const initials = subjectName.substring(0, 2).toUpperCase();
                                const isPassed = mark.status === 'Pass';
                                const dateStr = new Date(mark.exam_date || new Date()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

                                return (
                                    <div className="mm-result-card" key={idx}>
                                        <div className="mm-card-header-row">
                                            <div className="mm-card-header-col">SUBJECT</div>
                                            <div className="mm-card-header-col" style={{textAlign:'center'}}>TEST/EXAM</div>
                                            <div className="mm-card-header-col" style={{textAlign:'center'}}>DATE</div>
                                            <div className="mm-card-header-col" style={{textAlign:'right'}}>MARKS</div>
                                        </div>
                                        <div className="mm-card-content-row">
                                            <div className="mm-subject-cell">
                                                <div className="mm-subject-icon">{initials}</div>
                                                <div>
                                                    <div className="mm-subject-name">{subjectName}</div>
                                                    <div className="mm-subject-type">{mark.exam_type === 'practical' ? 'Practical' : 'Theory'}</div>
                                                </div>
                                            </div>
                                            <div className="mm-exam-name" style={{textAlign:'center'}}>{mark.exam_name || 'Exam'}</div>
                                            <div className="mm-exam-date" style={{textAlign:'center'}}>{dateStr}</div>
                                            <div className="mm-exam-marks" style={{textAlign:'right'}}>
                                                {mark.marks_obtained} / {mark.total_marks}
                                            </div>
                                        </div>
                                        <div className="mm-card-footer-headers">
                                            <div className="mm-card-header-col" style={{textAlign:'center'}}>PERCENTAGE</div>
                                            <div className="mm-card-header-col" style={{textAlign:'center'}}>GRADE</div>
                                            <div className="mm-card-header-col" style={{textAlign:'center'}}>STATUS</div>
                                        </div>
                                        <div className="mm-card-footer-values">
                                            <div className="mm-percentage-val" style={{textAlign:'center', color: isPassed ? '#10b981' : '#ef4444'}}>{mark.percentage}%</div>
                                            <div className="mm-grade-val" style={{textAlign:'center', color: isPassed ? '#10b981' : '#ef4444'}}>{mark.grade || '—'}</div>
                                            <div style={{textAlign:'center'}}>
                                                <span className={`mm-status-badge ${isPassed ? '' : 'fail'}`}>
                                                    {isPassed ? 'Pass' : 'Fail'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Note Card */}
                    <div className="mm-note-card">
                        <div className="mm-note-icon">ℹ</div>
                        <div className="mm-note-content">
                            <h4>Note</h4>
                            <p>Results are updated after evaluation. Please check back later for more updates.</p>
                        </div>
                    </div>
                </>
            )}
            
            <div style={{height: "80px"}}></div>
        </div>
    );
}
