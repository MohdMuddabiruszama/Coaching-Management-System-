import { useState, useEffect, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import api from "../../services/api";
import { FiArrowLeft, FiFilter } from "react-icons/fi";
import "./MobileAttendance.css";

function MobileAttendance() {
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

    if (loading) return (
        <div className="ma-container" style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
            <div className="spinner"></div>
        </div>
    );
    
    if (error) return <div className="ma-container" style={{ color: "red", padding: "20px" }}>{error}</div>;

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
        <div className="ma-container">
            {/* Header */}
            <div className="ma-header" style={{ justifyContent: 'center' }}>
                <div className="ma-title-area">
                    <div className="ma-title-icon">🗓️</div>
                    <div className="ma-title-text">
                        <h1>My Attendance</h1>
                        <p>Track your daily attendance</p>
                    </div>
                </div>
            </div>

            {/* Subject Filters (Wrapped Rows) */}
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
                        <h3>{workingDays}</h3>
                        <p>Working Days<br/><span>(excluding {holidayDays} holidays)</span></p>
                    </div>
                </div>
                <div className="ma-stat-card">
                    <div className="ma-stat-icon-wrapper light-green">
                        <span>✔️</span>
                    </div>
                    <div className="ma-stat-info">
                        <h3 className="text-green">{presentDays}</h3>
                        <p>Days Present</p>
                    </div>
                </div>
                <div className="ma-stat-card">
                    <div className="ma-stat-icon-wrapper light-red">
                        <span>❌</span>
                    </div>
                    <div className="ma-stat-info">
                        <h3 className="text-red">{absentDays}</h3>
                        <p>Days Absent</p>
                    </div>
                </div>
                <div className="ma-stat-card">
                    <div className="ma-stat-icon-wrapper light-purple">
                        <span>📅</span>
                    </div>
                    <div className="ma-stat-info">
                        <h3>{holidayDays}</h3>
                        <p>Holidays</p>
                    </div>
                </div>
            </div>

            {/* Circular Progress */}
            <div className="ma-progress-card">
                <div className="ma-progress-info">
                    <h2>{attendancePct}%</h2>
                    <p>Attendance Percentage</p>
                    <span className={`ma-badge ${attendancePct >= 75 ? 'good' : 'danger'}`}>
                        {attendancePct >= 75 ? "✔️ Excellent" : "⚠️ Needs Improvement"}
                    </span>
                </div>
                <div className="ma-progress-circle-wrap">
                    <svg viewBox="0 0 36 36" className="ma-circular-chart">
                        <path className="ma-circle-bg"
                            d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path className={`ma-circle ${attendancePct >= 75 ? 'good' : 'danger'}`}
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
                    <h3>📅 Attendance Records {filterLoading && <span className="loading-text">(Loading...)</span>}</h3>
                </div>
                
                <div className="ma-date-filters">
                    <input 
                        type="date" 
                        value={startDate} 
                        onChange={e => setStartDate(e.target.value)} 
                    />
                    <span>-</span>
                    <input 
                        type="date" 
                        value={endDate} 
                        onChange={e => setEndDate(e.target.value)} 
                    />
                    <button className="ma-filter-btn" onClick={handleDateFilter}>
                        Filter
                    </button>
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
                            
                            const isPresent = record.status === 'present';
                            
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

                {totalRecords > 0 && (
                    <div className="ma-pagination">
                        <button onClick={handlePrevPage} disabled={currentPage === 1}>&lt;</button>
                        <span>{currentPage} / {totalPages}</span>
                        <button onClick={handleNextPage} disabled={currentPage === totalPages}>&gt;</button>
                    </div>
                )}
            </div>
            
            <div style={{height: "80px"}}></div>
        </div>
    );
}

export default MobileAttendance;
