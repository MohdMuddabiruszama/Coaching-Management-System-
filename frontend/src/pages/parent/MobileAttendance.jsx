import React, { useState, useEffect, useContext, useMemo } from "react";
import { AuthContext } from "../../context/AuthContext";
import * as parentService from "../../services/parent.service";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import "../student/MobileAttendance.css"; // Reuse exact same styling
import "./MobileDashboard.css"; // For student selector styling

export default function MobileAttendance() {
    const { user } = useContext(AuthContext);
    
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    
    // Data
    const [fullRecords, setFullRecords] = useState([]);
    const [subjects, setSubjects] = useState([]);
    
    // Filters
    const [selectedSubject, setSelectedSubject] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const recordsPerPage = 7;

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
        setSelectedSubject("");
        setStartDate("");
        setEndDate("");
        
        try {
            // Get subjects for this student
            let stuSubjects = [];
            if (student.is_full_course && student.Classes?.length > 0) {
                // If they have Subjects populated from dashboard
                stuSubjects = student.Subjects || [];
            } else if (student.Subjects) {
                stuSubjects = student.Subjects;
            }
            setSubjects(stuSubjects);

            const attData = await parentService.getLinkedStudentAttendance(student.id);
            setFullRecords(attData?.data?.records || []);
        } catch (error) {
            console.error("Error fetching attendance details", error);
        } finally {
            setLoading(false);
            setDetailLoading(false);
            setCurrentPage(1);
        }
    };

    // Client-side filtering for fast performance and minimum API calls!
    const filteredRecords = useMemo(() => {
        let filtered = [...fullRecords];
        
        if (selectedSubject) {
            filtered = filtered.filter(r => r.subject_id === selectedSubject);
        }
        
        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0,0,0,0);
            filtered = filtered.filter(r => new Date(r.date) >= start);
        }
        
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23,59,59,999);
            filtered = filtered.filter(r => new Date(r.date) <= end);
        }
        
        // Sort descending by date
        return filtered.sort((a,b) => new Date(b.date) - new Date(a.date));
    }, [fullRecords, selectedSubject, startDate, endDate]);

    // Recalculate summary based on filtered records
    const summary = useMemo(() => {
        const presentCount = filteredRecords.filter(r => r.status === 'present').length;
        const absentCount = filteredRecords.filter(r => r.status === 'absent').length;
        const lateCount = filteredRecords.filter(r => r.status === 'late').length;
        const halfDayCount = filteredRecords.filter(r => r.status === 'half_day').length;
        const holidayCount = filteredRecords.filter(r => r.status === 'holiday').length;
        
        const working = presentCount + absentCount + lateCount + halfDayCount;
        const present = presentCount + lateCount + halfDayCount;

        const pct = working > 0 ? Number((((presentCount + lateCount + (halfDayCount * 0.5)) / working) * 100).toFixed(2)) : 0;
        
        return {
            working_days: working,
            present_days: present,
            absent_days: absentCount,
            holiday_days: holidayCount,
            percentage: pct
        };
    }, [filteredRecords]);

    const handleSubjectFilter = (subId) => {
        setSelectedSubject(subId);
        setCurrentPage(1);
    };

    const clearDateFilter = () => {
        setStartDate("");
        setEndDate("");
        setCurrentPage(1);
    };

    if (loading) {
        return (
            <div className="ma-container" style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
                <LoadingSpinner />
            </div>
        );
    }

    const { working_days, present_days, absent_days, holiday_days, percentage } = summary;
    const circleDasharray = `${percentage}, 100`;

    const totalPages = Math.max(1, Math.ceil(filteredRecords.length / recordsPerPage));
    const paginatedRecords = filteredRecords.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage);

    return (
        <div className="ma-container" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            
            {/* Header */}
            <div className="ma-header" style={{ paddingBottom: '0' }}>
                <div className="ma-title-area">
                    <div className="ma-title-icon">🗓️</div>
                    <div className="ma-title-text">
                        <h1>Attendance</h1>
                        <p>Track daily attendance</p>
                    </div>
                </div>
            </div>

            {/* Student Selector */}
            <div className="mpd-student-scroll" style={{ padding: '0 20px 16px', background: 'transparent' }}>
                {students.map((student, idx) => {
                    const isSelected = selectedStudent?.id === student.id;
                    const initials = student.User?.name?.substring(0,2).toUpperCase() || 'ST';
                    return (
                        <div 
                            key={student.id} 
                            className={`mpd-student-card ${isSelected ? 'active' : ''} ${idx % 2 !== 0 && !isSelected ? 'white-bg' : ''}`}
                            onClick={() => selectStudent(student)}
                            style={{ minWidth: '180px', padding: '12px' }}
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
                    {/* Subject Filters */}
                    <div className="ma-subject-scroll">
                        <button 
                            onClick={() => handleSubjectFilter("")}
                            className={`ma-pill ${selectedSubject === "" ? "active" : ""}`}
                        >
                            All Subjects
                        </button>
                        {subjects.map(sub => (
                            <button
                                key={sub.id}
                                onClick={() => handleSubjectFilter(sub.id)}
                                className={`ma-pill ${selectedSubject === sub.id ? "active" : ""}`}
                            >
                                {sub.name}
                            </button>
                        ))}
                    </div>

                    {/* Stats Grid 2x2 */}
                    <div className="ma-stats-grid">
                        <div className="ma-stat-card">
                            <div className="ma-stat-icon-wrapper light-blue">
                                <span>📅</span>
                            </div>
                            <div className="ma-stat-info">
                                <h3>{working_days}</h3>
                                <p>Working Days<br/><span>(excluding {holiday_days} holidays)</span></p>
                            </div>
                        </div>
                        <div className="ma-stat-card">
                            <div className="ma-stat-icon-wrapper light-green">
                                <span>✔️</span>
                            </div>
                            <div className="ma-stat-info">
                                <h3 className="text-green">{present_days}</h3>
                                <p>Days Present</p>
                            </div>
                        </div>
                        <div className="ma-stat-card">
                            <div className="ma-stat-icon-wrapper light-red">
                                <span>❌</span>
                            </div>
                            <div className="ma-stat-info">
                                <h3 className="text-red">{absent_days}</h3>
                                <p>Days Absent</p>
                            </div>
                        </div>
                        <div className="ma-stat-card">
                            <div className="ma-stat-icon-wrapper light-purple">
                                <span>📅</span>
                            </div>
                            <div className="ma-stat-info">
                                <h3>{holiday_days}</h3>
                                <p>Holidays</p>
                            </div>
                        </div>
                    </div>

                    {/* Circular Progress */}
                    <div className="ma-progress-card">
                        <div className="ma-progress-info">
                            <h2>{percentage}%</h2>
                            <p>Attendance Percentage</p>
                            <span className={`ma-badge ${percentage >= 75 ? 'good' : 'danger'}`}>
                                {percentage >= 75 ? "✔️ Excellent" : "⚠️ Needs Improvement"}
                            </span>
                        </div>
                        <div className="ma-progress-circle-wrap">
                            <svg viewBox="0 0 36 36" className="ma-circular-chart">
                                <path className="ma-circle-bg"
                                    d="M18 2.0845
                                    a 15.9155 15.9155 0 0 1 0 31.831
                                    a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                                <path className={`ma-circle ${percentage >= 75 ? 'good' : 'danger'}`}
                                    strokeDasharray={circleDasharray}
                                    d="M18 2.0845
                                    a 15.9155 15.9155 0 0 1 0 31.831
                                    a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                            </svg>
                        </div>
                    </div>

                    {/* Attendance Records */}
                    <div className="ma-records-panel">
                        <div className="ma-records-header">
                            <h3>📅 Attendance Records</h3>
                        </div>
                        
                        <div className="ma-date-filters">
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={e => { setStartDate(e.target.value); setCurrentPage(1); }} 
                            />
                            <span>-</span>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={e => { setEndDate(e.target.value); setCurrentPage(1); }} 
                            />
                            {(startDate || endDate) && (
                                <button className="ma-clear-btn" onClick={clearDateFilter}>
                                    Clear
                                </button>
                            )}
                        </div>

                        <div className="ma-records-list">
                            {paginatedRecords.length === 0 ? (
                                <div className="ma-empty-state">
                                    <span className="ma-empty-icon">📋</span>
                                    <h4>No Attendance Records</h4>
                                </div>
                            ) : (
                                paginatedRecords.map((record) => {
                                    const dateObj = new Date(record.date);
                                    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                                    const dayNum = dateObj.getDate();
                                    const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });
                                    
                                    return (
                                        <div className="ma-record-card" key={record.id}>
                                            <div className="ma-record-datebox">
                                                <span className="ma-date-num">{dayNum}</span>
                                                <span className="ma-date-month">{monthName}</span>
                                            </div>
                                            <div className="ma-record-details">
                                                <div className="ma-record-top">
                                                    <h4>{record.Subject?.name || record.Class?.name || "All Subjects"}</h4>
                                                    <span className={`ma-record-status ${record.status}`}>
                                                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                                                    </span>
                                                </div>
                                                <div className="ma-record-bottom">
                                                    <span className="ma-record-day">{dayName}</span>
                                                    <span className="ma-record-method">
                                                        —<br/>{record.marked_by_type === 'system' ? 'System' : 'Manual Entry'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {filteredRecords.length > 0 && (
                            <div className="ma-pagination">
                                <button onClick={() => setCurrentPage(c => c - 1)} disabled={currentPage === 1}>&lt;</button>
                                <span>{currentPage} / {totalPages}</span>
                                <button onClick={() => setCurrentPage(c => c + 1)} disabled={currentPage === totalPages}>&gt;</button>
                            </div>
                        )}
                    </div>
                </>
            )}
            <div style={{height: "80px"}}></div>
        </div>
    );
}
