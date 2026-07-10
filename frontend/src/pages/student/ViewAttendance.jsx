import { useState, useEffect, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import api from "../../services/api";
import { format12Hour } from "../../utils/timeFormat";
import "./StudentAttendance.css";
import "../admin/Students.css";

function ViewAttendance() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [studentData, setStudentData] = useState(null);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [subjects, setSubjects] = useState([]);
    const [filterLoading, setFilterLoading] = useState(false);
    
    // Date filter state
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const recordsPerPage = 7;

    useEffect(() => {
        fetchStudentIdAndAttendance();
    }, []);

    const fetchStudentIdAndAttendance = async () => {
        try {
            const studentRes = await api.get(`/students/me`);
            const stu = studentRes.data.data;
            setStudentData(stu);

            if (stu.is_full_course && stu.Classes && stu.Classes.length > 0) {
                const classId = stu.Classes[0]?.id;
                if (classId) {
                    const subRes = await api.get(`/subjects?class_id=${classId}`);
                    setSubjects(subRes.data.data || []);
                }
            } else if (stu.Subjects && stu.Subjects.length > 0) {
                setSubjects(stu.Subjects);
            }

            const attRes = await api.get(`/attendance/student/${stu.id}/report`);
            setReport(attRes.data.data);
            setLoading(false);
        } catch (err) {
            console.error("Error fetching attendance:", err);
            setError(err.response?.data?.message || "Failed to load attendance report.");
            setLoading(false);
        }
    };

    const fetchReport = async (subId = selectedSubject, start = startDate, end = endDate) => {
        if (!studentData) return;
        setFilterLoading(true);
        try {
            let url = `/attendance/student/${studentData.id}/report`;
            const params = [];
            if (subId) params.push(`subject_id=${subId}`);
            if (start) params.push(`start_date=${start}`);
            if (end) params.push(`end_date=${end}`);
            if (params.length > 0) url += `?${params.join("&")}`;
            
            const attRes = await api.get(url);
            setReport(attRes.data.data);
            setCurrentPage(1);
        } catch (err) {
            console.error("Error fetching report:", err);
        } finally {
            setFilterLoading(false);
        }
    };

    const handleSubjectFilter = (subjectId) => {
        setSelectedSubject(subjectId);
        fetchReport(subjectId, startDate, endDate);
    };

    const handleDateFilter = () => {
        fetchReport(selectedSubject, startDate, endDate);
    };

    const clearDateFilter = () => {
        setStartDate("");
        setEndDate("");
        fetchReport(selectedSubject, "", "");
    };

    const statusLabel = (s) => {
        if (!s) return "";
        return s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ");
    };
    
    const markedByLabel = (t) => {
        if (t === "biometric")  return "Biometric";
        if (t === "mobile_otp") return "Mobile OTP";
        if (t === "qr_code")    return "Smart Attendance (QR)";
        return "Manual Entry";
    };

    if (loading) return (
        <div className="att-container" style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
            <div className="spinner"></div>
        </div>
    );
    
    if (error) return <div className="att-container" style={{ color: "red" }}>{error}</div>;

    const workingDays = report?.summary?.working_days || 0;
    const presentDays = report?.summary?.present_days || 0;
    const holidayDays = report?.summary?.holiday_days || 0;
    const absentDays  = report?.summary?.absent_days || 0;
    const attendancePct = report?.summary?.attendance_percentage || 0;
    
    // Circle calculation
    const circleDasharray = `${attendancePct}, 100`;
    
    // Pagination logic
    const records = report?.records || [];
    const totalRecords = records.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / recordsPerPage));
    const paginatedRecords = records.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage);
    
    const handlePrevPage = () => { if (currentPage > 1) setCurrentPage(c => c - 1); };
    const handleNextPage = () => { if (currentPage < totalPages) setCurrentPage(c => c + 1); };

    return (
        <div className="att-container">
            {/* Header */}
            <div className="st-header">
                <div className="st-header-top-row">
                    <div className="st-header-left">
                        <h1>📅 My Attendance</h1>
                        <p>Track your daily attendance. Working days exclude holidays.</p>
                    </div>
                </div>
                <div className="st-header-bottom-row">
                    <div className="st-breadcrumbs">
                        <span>Dashboard</span>
                        <span>›</span>
                        <span className="active">My Attendance</span>
                    </div>
                    <div className="st-header-actions">
                    </div>
                </div>
            </div>

            {/* Filters Row */}
            <div className="att-filters-row">
                <div className="att-filter-pills">
                    <button 
                        onClick={() => handleSubjectFilter("")}
                        className={`att-pill ${selectedSubject === "" ? "active" : ""}`}
                    >
                        All Subjects
                    </button>
                    {subjects.map(sub => (
                        <button
                            key={sub.id}
                            onClick={() => handleSubjectFilter(sub.id)}
                            className={`att-pill ${selectedSubject === sub.id ? "active" : ""}`}
                        >
                            {sub.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="att-stats-grid">
                <div className="att-stat-card">
                    <div className="att-stat-content">
                        <div className="att-stat-icon icon-blue">📅</div>
                        <div className="att-stat-text">
                            <h3>{workingDays}</h3>
                            <p>Working Days<br/>(excluding {holidayDays} holiday{holidayDays !== 1 ? 's' : ''})</p>
                        </div>
                    </div>
                </div>
                <div className="att-stat-card">
                    <div className="att-stat-content">
                        <div className="att-stat-icon icon-green">✔️</div>
                        <div className="att-stat-text">
                            <h3 className="green">{presentDays}</h3>
                            <p>Days Present</p>
                        </div>
                    </div>
                </div>
                <div className="att-stat-card">
                    <div className="att-stat-content">
                        <div className="att-stat-icon icon-red">❌</div>
                        <div className="att-stat-text">
                            <h3 className="red">{absentDays}</h3>
                            <p>Days Absent</p>
                        </div>
                    </div>
                </div>
                <div className="att-stat-card">
                    <div className="att-stat-content">
                        <div className="att-stat-icon icon-purple">📅</div>
                        <div className="att-stat-text">
                            <h3>{holidayDays}</h3>
                            <p>Holidays</p>
                        </div>
                    </div>
                </div>
                
                {/* Circular Progress */}
                <div className="att-progress-card">
                    <svg viewBox="0 0 36 36" className="circular-chart">
                        <path className="circle-bg"
                            d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path className={`circle ${attendancePct >= 75 ? 'good' : 'danger'}`}
                            strokeDasharray={circleDasharray}
                            d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <text x="18" y="20.5" className="percentage">{Number(attendancePct).toFixed(1)}%</text>
                    </svg>
                    <div className="att-progress-text">
                        <h4>Attendance Percentage</h4>
                        <span className={`att-badge-sm ${attendancePct >= 75 ? 'good' : 'danger'}`}>
                            {attendancePct >= 75 ? "✔️ Excellent" : "⚠️ Needs Improvement"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="att-table-panel">
                <div className="att-table-header" style={{flexWrap: 'wrap', gap: '16px'}}>
                    <h3>📅 Attendance Records {filterLoading && <span style={{fontSize:'12px', color:'#888'}}>(Loading...)</span>}</h3>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input 
                            type="date" 
                            className="att-date-picker" 
                            value={startDate} 
                            onChange={e => setStartDate(e.target.value)} 
                        />
                        <span style={{color: '#888'}}>-</span>
                        <input 
                            type="date" 
                            className="att-date-picker" 
                            value={endDate} 
                            onChange={e => setEndDate(e.target.value)} 
                        />
                        <button className="att-pill active" style={{padding: '6px 12px', margin: 0}} onClick={handleDateFilter}>
                            Filter
                        </button>
                        {(startDate || endDate) && (
                            <button className="att-pill" style={{padding: '6px 12px', margin: 0, border: 'none', background: '#f1f5f9'}} onClick={clearDateFilter}>
                                Clear
                            </button>
                        )}
                    </div>
                </div>
                <table className="att-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Day</th>
                            <th>Subject / Class</th>
                            <th>Status</th>
                            <th>Time In</th>
                            <th>Marked By</th>
                            <th>Method</th>
                            <th>Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedRecords.length === 0 ? (
                            <tr>
                                <td colSpan="8" style={{ textAlign: "center", padding: "40px 20px", background: "#f8fafc" }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ fontSize: '48px', opacity: 0.5 }}>📋</span>
                                        <h4 style={{ color: '#475569', margin: 0, fontSize: '16px' }}>No Attendance Records Found</h4>
                                        <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px', maxWidth: '300px' }}>
                                            We couldn't find any attendance records matching your selected date range or subject.
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            paginatedRecords.map((record) => {
                                const dateObj = new Date(record.date);
                                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                                
                                let timeFormatted = format12Hour(record.time_in);
                                
                                return (
                                    <tr key={record.id}>
                                        <td>{dateObj.toLocaleDateString('en-GB')}</td>
                                        <td>{dayName}</td>
                                        <td>{record.Subject?.name || record.Class?.name || "All Subjects"}</td>
                                        <td>
                                            <span className={`att-status ${record.status}`}>
                                                {statusLabel(record.status)}
                                            </span>
                                        </td>
                                        <td>{timeFormatted}</td>
                                        <td>{record.marked_by_type === 'system' ? 'System' : 'Manual'}</td>
                                        <td>{markedByLabel(record.marked_by_type)}</td>
                                        <td>{record.remarks || markedByLabel(record.marked_by_type)}</td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
                <div className="att-pagination">
                    <div>Showing {(currentPage - 1) * recordsPerPage + (totalRecords > 0 ? 1 : 0)} to {Math.min(currentPage * recordsPerPage, totalRecords)} of {totalRecords} records</div>
                    <div className="att-page-controls">
                        <button className="att-page-btn" onClick={handlePrevPage} disabled={currentPage === 1}>&lt;</button>
                        <button className="att-page-btn active">{currentPage}</button>
                        <button className="att-page-btn" onClick={handleNextPage} disabled={currentPage === totalPages}>&gt;</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ViewAttendance;
