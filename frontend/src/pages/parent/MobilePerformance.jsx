import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import * as parentService from "../../services/parent.service";
import performanceService from "../../services/performance.service";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { useNavigate } from "react-router-dom";
import "./MobilePerformance.css";
import "./MobileDashboard.css"; // For student selector styling

export default function MobilePerformance() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    
    const [perf, setPerf] = useState(null);

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
            const perfData = await performanceService.getChildPerformance(student.id);
            setPerf(perfData);
        } catch (error) {
            console.error("Error fetching performance details", error);
        } finally {
            setLoading(false);
            setDetailLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="mperf-container" style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
                <LoadingSpinner />
            </div>
        );
    }

    const score = perf?.score || {};
    const overallScore = score.score || 0;
    const grade = score.grade || "N/A";
    const marksPct = score.marks_pct || 0;
    const attPct = score.att_pct || 0;
    const assPct = score.ass_pct || 0;
    const engPct = score.eng_pct || 0;
    const subjects = perf?.subjects || [];

    const circleDasharray = `${overallScore}, 100`;

    return (
        <div className="mperf-container" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            {/* Header */}
            <div className="mperf-hero-banner">
                <div className="mperf-hero-left">
                    <div className="mperf-hero-icon-wrapper">
                        📊
                    </div>
                    <div className="mperf-hero-text">
                        <h2>Performance</h2>
                        <p>Academic performance overview</p>
                    </div>
                </div>
                <div className="mperf-hero-right">
                    <div className="mperf-hero-graphic">
                        🎯<span>★</span>
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
                <div className="mperf-content">
                    {/* Top 3 Grid */}
                    <div className="mperf-top-grid">
                        <div className="mperf-card score-card">
                            <div className="mperf-ring-wrapper">
                                <svg viewBox="0 0 36 36" className="mperf-circular-chart">
                                    <path className="mperf-circle-bg"
                                        d="M18 2.0845
                                        a 15.9155 15.9155 0 0 1 0 31.831
                                        a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                    <path className="mperf-circle"
                                        strokeDasharray={circleDasharray}
                                        d="M18 2.0845
                                        a 15.9155 15.9155 0 0 1 0 31.831
                                        a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                </svg>
                                <div className="mperf-ring-val">{overallScore}</div>
                            </div>
                            <div className="mperf-score-lbl">Overall Score</div>
                            <div className="mperf-grade-pill">{grade}</div>
                        </div>
                        
                        <div className="mperf-card">
                            <div>
                                <div className="mperf-kpi-icon blue">📝</div>
                                <div className="mperf-kpi-val blue">{marksPct}%</div>
                                <div className="mperf-kpi-lbl">Marks</div>
                            </div>
                            <div className="mperf-progress-bg">
                                <div className="mperf-progress-fill blue" style={{ width: `${marksPct}%` }}></div>
                            </div>
                        </div>

                        <div className="mperf-card">
                            <div>
                                <div className="mperf-kpi-icon green">📋</div>
                                <div className="mperf-kpi-val green">{attPct}%</div>
                                <div className="mperf-kpi-lbl">Attendance</div>
                            </div>
                            <div className="mperf-progress-bg">
                                <div className="mperf-progress-fill green" style={{ width: `${attPct}%` }}></div>
                            </div>
                        </div>
                    </div>

                    {/* Mid 2 Grid */}
                    <div className="mperf-mid-grid">
                        <div className="mperf-card horizontal">
                            <div className="mperf-horiz-top">
                                <div className="mperf-horiz-icon orange" style={{background: '#fff7ed', color: '#ea580c'}}>📌</div>
                                <div className="mperf-horiz-info">
                                    <h3 style={{color: '#ea580c'}}>{assPct}%</h3>
                                    <p>Assignments</p>
                                </div>
                            </div>
                            <div className="mperf-progress-bg">
                                <div className="mperf-progress-fill orange" style={{ width: `${assPct}%` }}></div>
                            </div>
                        </div>

                        <div className="mperf-card horizontal">
                            <div className="mperf-horiz-top">
                                <div className="mperf-horiz-icon purple" style={{background: '#faf5ff', color: '#a855f7'}}>💬</div>
                                <div className="mperf-horiz-info">
                                    <h3 style={{color: '#a855f7'}}>{engPct}%</h3>
                                    <p>Engagement</p>
                                </div>
                            </div>
                            <div className="mperf-progress-bg">
                                <div className="mperf-progress-fill purple" style={{ width: `${engPct}%` }}></div>
                            </div>
                        </div>
                    </div>

                    {/* Subject Breakdown */}
                    <div className="mperf-breakdown-card">
                        <div className="mperf-breakdown-header">
                            <h2>Subject Breakdown</h2>
                            <span onClick={() => navigate('/parent/marks')} style={{ cursor: 'pointer' }}>View All</span>
                        </div>
                        
                        {subjects.length > 0 ? subjects.map((sub) => (
                            <div key={sub.subject_id} className="mperf-subject-row">
                                <div className="mperf-subject-info">
                                    <span className="mperf-subject-name">{sub.subject_name}</span>
                                    <span className={`mperf-subject-pct ${sub.below_passing ? 'red' : 'blue'}`}>
                                        {sub.avg_pct}%
                                    </span>
                                </div>
                                <div className="mperf-subject-bar-bg">
                                    <div className={`mperf-subject-bar-fill ${sub.below_passing ? 'red' : 'blue'}`} style={{ width: `${sub.avg_pct}%` }}></div>
                                </div>
                            </div>
                        )) : (
                            <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                                No subject performance data available.
                            </div>
                        )}
                    </div>
                </div>
            )}
            <div style={{ height: "80px" }}></div>
        </div>
    );
}
