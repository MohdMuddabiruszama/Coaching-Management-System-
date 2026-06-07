/**
 * Attendance Management Page
 * Professional implementation with bulk marking and reports
 */

import { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import "../admin/Students.css"; // Reuse the modern styling from Students page

function Attendance() {
    const { user } = useContext(AuthContext);
    const [classes, setClasses] = useState([]);
    const [selectedClassName, setSelectedClassName] = useState("");
    const [selectedSection, setSelectedSection] = useState("");
    const [selectedClass, setSelectedClass] = useState("");
    const [subjects, setSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [students, setStudents] = useState([]);
    const [attendanceData, setAttendanceData] = useState({});
    const [loading, setLoading] = useState(false);
    const [dashboardStats, setDashboardStats] = useState(null);
    const [showReport, setShowReport] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [hasLoadedStudents, setHasLoadedStudents] = useState(false);
    const itemsPerPage = 10;
    // Phase 3: Sunday detection
    const [sundayPopup, setSundayPopup] = useState(false);
    const [sundayMarkingHoliday, setSundayMarkingHoliday] = useState(false);

    useEffect(() => {
        fetchClasses();
    }, []);



    useEffect(() => {
        if (selectedClass) {
            fetchSubjects();
        } else {
            setSubjects([]);
            setSelectedSubject("");
        }
    }, [selectedClass]);

    // Derive selectedClass ID from Class Name + Section
    useEffect(() => {
        if (selectedClassName && selectedSection) {
            const cls = classes.find(c => c.name === selectedClassName && c.section === selectedSection);
            setSelectedClass(cls ? cls.id : "");
        } else {
            setSelectedClass("");
        }
    }, [selectedClassName, selectedSection, classes]);

    // Clear table when filters change so old data isn't shown
    useEffect(() => {
        setStudents([]);
        setAttendanceData({});
        setCurrentPage(1);
        setSelectedStudentIds([]);
        setHasLoadedStudents(false);
    }, [selectedClass, selectedSubject, selectedDate]);

    const fetchClasses = async () => {
        try {
            const response = await api.get("/classes");
            setClasses(response.data.data || []);
        } catch (error) {
            console.error("Error fetching classes:", error);
        }
    };

    const fetchSubjects = async () => {
        try {
            const response = await api.get(`/subjects?class_id=${selectedClass}`);
            setSubjects(response.data.data || []);
            setSelectedSubject("");
        } catch (error) {
            console.error("Error fetching subjects:", error);
        }
    };

    const fetchDashboardStats = () => {
        // Obsolete - stats are computed locally in real-time
    };

    const fetchClassAttendance = async (checkSunday = false) => {
        setLoading(true);
        try {
            const response = await api.get(`/attendance/class/${selectedClass}/subject/${selectedSubject}/date/${selectedDate}`);
            const fetchedStudents = response.data.data || [];
            setStudents(fetchedStudents);
            setHasLoadedStudents(true);

            // If it's a Sunday and there are pending students, show the popup
            if (checkSunday) {
                const pendingCount = fetchedStudents.filter(s => !s.attendance).length;
                if (pendingCount > 0) {
                    const d = new Date(selectedDate + 'T00:00:00');
                    if (d.getDay() === 0) {
                        setSundayPopup(true);
                    }
                }
            }

            // Initialize attendance data
            const initialData = {};
            fetchedStudents.forEach(student => {
                if (student.attendance) {
                    initialData[student.student_id] = {
                        status: student.attendance.status,
                        remarks: student.attendance.remarks || ""
                    };
                } else {
                    initialData[student.student_id] = {
                        status: "present",
                        remarks: ""
                    };
                }
            });
            setAttendanceData(initialData);
        } catch (error) {
            console.error("Error fetching attendance:", error);
            alert("Error loading attendance data");
        } finally {
            setLoading(false);
        }
    };

    const handleLoadStudents = () => {
        if (!selectedClass || !selectedSubject || !selectedDate) {
            alert("Please select Class, Section, Subject, and Date to load students.");
            return;
        }
        if (isFutureDate) {
            alert("Future date attendance not allowed.");
            return;
        }

        fetchClassAttendance(true);
    };

    const handleStatusChange = (studentId, status) => {
        setAttendanceData(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                status
            }
        }));
    };

    const handleRemarksChange = (studentId, remarks) => {
        setAttendanceData(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                remarks
            }
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!selectedClass || !selectedSubject || !selectedDate) {
            alert("Please select class, subject and date");
            return;
        }

        try {
            const pendingStudents = students.filter(s => !s.attendance);

            const attendance_data = pendingStudents.map(student => ({
                student_id: student.student_id,
                status: attendanceData[student.student_id].status,
                remarks: attendanceData[student.student_id].remarks
            }));

            if (attendance_data.length === 0) {
                alert("No pending students to submit.");
                return;
            }

            await api.post("/attendance/bulk", {
                class_id: parseInt(selectedClass),
                subject_id: parseInt(selectedSubject),
                date: selectedDate,
                attendance_data
            });

            alert("Attendance marked successfully!");
            fetchDashboardStats();
            fetchClassAttendance();
        } catch (error) {
            const errorMessage = error.response?.data?.message || "Error marking attendance";
            alert(errorMessage);
        }
    };

    const handleViewReport = async () => {
        if (!selectedClass) {
            alert("Please select a class");
            return;
        }

        try {
            const response = await api.get(`/attendance/class/${selectedClass}/summary`);
            setReportData(response.data);
            setShowReport(true);
        } catch (error) {
            alert("Error loading report");
        }
    };

    const applyBulkStatus = (status) => {
        const newData = { ...attendanceData };
        const targetStudents = selectedStudentIds.length > 0 
            ? pendingStudents.filter(s => selectedStudentIds.includes(s.student_id))
            : pendingStudents;

        targetStudents.forEach(student => {
            newData[student.student_id] = {
                status: status,
                remarks: attendanceData[student.student_id]?.remarks || ""
            };
        });
        setAttendanceData(newData);
        setSelectedStudentIds([]); // Clear selection after applying
    };

    const markAllPresent = () => applyBulkStatus("present");
    const markAllAbsent = () => applyBulkStatus("absent");
    const markAllLate = () => applyBulkStatus("late");
    const markAllHoliday = () => applyBulkStatus("holiday");

    // Phase 3: Mark entire class/subject as holiday for a Sunday
    const markSundayAsHoliday = async () => {
        if (!selectedClass || !selectedSubject) {
            setSundayPopup(false);
            alert("Please select a class and subject first, then choose Holiday.");
            return;
        }
        setSundayMarkingHoliday(true);
        try {
            // fetch current list of students for this class/subject/date
            const resp = await api.get(`/attendance/class/${selectedClass}/subject/${selectedSubject}/date/${selectedDate}`);
            const allStudents = resp.data.data || [];
            if (allStudents.length === 0) {
                setSundayPopup(false);
                setSundayMarkingHoliday(false);
                alert("No students found for selected class/subject. Select class & subject from the filters first.");
                return;
            }
            const attendance_data = allStudents.map(s => ({
                student_id: s.student_id,
                status: 'holiday',
                remarks: 'Sunday Holiday'
            }));
            await api.post('/attendance/bulk', {
                class_id: parseInt(selectedClass),
                subject_id: parseInt(selectedSubject),
                date: selectedDate,
                attendance_data
            });
            setSundayPopup(false);
            alert(`✅ All ${allStudents.length} students marked as Holiday for Sunday ${selectedDate}`);
            fetchClassAttendance();
            fetchDashboardStats();
        } catch (err) {
            alert(err.response?.data?.message || 'Error marking holiday');
        } finally {
            setSundayMarkingHoliday(false);
        }
    };

    const pendingStudents = students.filter(s => !s.attendance);
    const markedStudents = students.filter(s => s.attendance);

    // Pagination calculations
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentPendingStudents = pendingStudents.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(pendingStudents.length / itemsPerPage);

    // Checkbox handlers
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedStudentIds(currentPendingStudents.map(s => s.student_id));
        } else {
            setSelectedStudentIds([]);
        }
    };

    const handleSelectStudent = (studentId) => {
        setSelectedStudentIds(prev => 
            prev.includes(studentId) 
                ? prev.filter(id => id !== studentId)
                : [...prev, studentId]
        );
    };

    // Calculate future date logic
    const todayDateObj = new Date();
    const localToday = `${todayDateObj.getFullYear()}-${String(todayDateObj.getMonth() + 1).padStart(2, '0')}-${String(todayDateObj.getDate()).padStart(2, '0')}`;
    const isFutureDate = selectedDate > localToday;

    // Client-side stats calculation to eliminate the need for extra API calls
    const presentCount = students.reduce((acc, s) => acc + (attendanceData[s.student_id]?.status === 'present' ? 1 : 0), 0);
    const absentCount = students.reduce((acc, s) => acc + (attendanceData[s.student_id]?.status === 'absent' ? 1 : 0), 0);
    const holidayCount = students.reduce((acc, s) => acc + (attendanceData[s.student_id]?.status === 'holiday' ? 1 : 0), 0);
    const lateCount = students.reduce((acc, s) => acc + (attendanceData[s.student_id]?.status === 'late' ? 1 : 0), 0);
    const totalSelectedStudents = students.length;
    const getPercentage = (count) => totalSelectedStudents > 0 ? ((count / totalSelectedStudents) * 100).toFixed(2) : 0;

    const uniqueClassNames = [...new Set(classes.map(c => c.name))];
    const availableSections = classes.filter(c => c.name === selectedClassName).map(c => c.section).filter(Boolean);

    return (
        <div className="students-container">
            {/* ── Header ── */}
            <div className="st-header">
                <div className="st-header-top-row">
                    <div className="st-header-left">
                        <h1>Student Attendance</h1>
                        <p>Mark and track student attendance</p>
                    </div>
                </div>
                <div className="st-header-bottom-row">
                    <div className="st-breadcrumbs">
                        <span>Dashboard</span>
                        <span>›</span>
                        <span className="active">Student Attendance</span>
                    </div>
                    <div className="st-header-actions">
                        {selectedClass && (
                            <button onClick={handleViewReport} className="st-btn st-btn-outline" style={{ color: "#4f46e5", borderColor: "#c7d2fe", background: "#eef2ff" }}>
                                📊 Reports
                            </button>
                        )}
                        {selectedClass && selectedSubject && pendingStudents.length > 0 && (
                            <button onClick={handleSubmit} className="st-btn st-btn-primary">
                                ✓ Submit Attendance
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Filters Bar ── */}
            <div className="st-filters-bar">
                <div style={{flex: 1}}>
                    <label style={{display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.4rem', fontWeight: 600}}>Class *</label>
                    <select
                        className="st-select"
                        style={{width: '100%'}}
                        value={selectedClassName}
                        onChange={(e) => {
                            setSelectedClassName(e.target.value);
                            setSelectedSection("");
                        }}
                    >
                        <option value="">Choose a class</option>
                        {uniqueClassNames.map((name) => (
                            <option key={name} value={name}>
                                {name}
                            </option>
                        ))}
                    </select>
                </div>
                <div style={{flex: 1}}>
                    <label style={{display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.4rem', fontWeight: 600}}>Section *</label>
                    <select 
                        className="st-select" 
                        style={{width: '100%'}}
                        value={selectedSection}
                        onChange={(e) => setSelectedSection(e.target.value)}
                        disabled={!selectedClassName}
                    >
                        <option value="">Choose a section</option>
                        {availableSections.map((sec) => (
                            <option key={sec} value={sec}>
                                {sec}
                            </option>
                        ))}
                    </select>
                </div>
                <div style={{flex: 1}}>
                    <label style={{display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.4rem', fontWeight: 600}}>Subject *</label>
                    <select
                        className="st-select"
                        style={{width: '100%'}}
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        disabled={!selectedClass}
                    >
                        <option value="">Choose a subject</option>
                        {subjects.map((sub) => (
                            <option key={sub.id} value={sub.id}>
                                {sub.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div style={{flex: 1}}>
                    <label style={{display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.4rem', fontWeight: 600}}>Date *</label>
                    <input
                        type="date"
                        className="st-select"
                        style={{width: '100%'}}
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                    />
                </div>
                <div style={{display: 'flex', flexDirection: 'column'}}>
                    <label style={{display: 'block', fontSize: '0.8rem', color: 'transparent', marginBottom: '0.4rem', userSelect: 'none'}}>&nbsp;</label>
                    <button 
                        onClick={handleLoadStudents}
                        className="st-btn st-btn-primary" 
                        style={{ 
                            height: '42px', 
                            padding: '0 1.5rem', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2), 0 2px 4px -1px rgba(79, 70, 229, 0.1)',
                            transition: 'all 0.2s ease',
                            fontWeight: '600'
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                            <path d="M21 3v5h-5" />
                        </svg>
                        Load Students
                    </button>
                </div>
            </div>

            {/* Future Date Message */}
            {selectedClass && selectedSubject && selectedDate && isFutureDate && (
                <div style={{ marginTop: "2rem", padding: "4rem 2rem", textAlign: "center", backgroundColor: "#fff", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
                    <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>⏳</div>
                    <h2 style={{ color: "#334155", margin: "0 0 0.5rem 0" }}>Future Attendance Not Allowed</h2>
                    <p style={{ color: "#64748b", margin: 0 }}>You cannot mark or view attendance for a future date. Please select today or a past date.</p>
                </div>
            )}

            {/* ── Stat Cards (Dynamically computed client-side) ── */}
            {selectedClass && selectedSubject && selectedDate && !isFutureDate && students.length > 0 && (
                <div className="st-stats-grid">
                    <div className="st-stat-card">
                        <div className="st-stat-top">
                            <div className="st-stat-icon st-icon-green" style={{background: '#dcfce7', color: '#16a34a'}}>👥</div>
                            <div className="st-stat-info">
                                <p>Total Students</p>
                                <h3>{totalSelectedStudents}</h3>
                            </div>
                        </div>
                        <div className="st-stat-bottom">All enrolled students</div>
                    </div>
                    <div className="st-stat-card">
                        <div className="st-stat-top">
                            <div className="st-stat-icon st-icon-green">✓</div>
                            <div className="st-stat-info">
                                <p>Present</p>
                                <h3>{presentCount}</h3>
                            </div>
                        </div>
                        <div className="st-stat-bottom">{getPercentage(presentCount)}% of total</div>
                    </div>
                    <div className="st-stat-card">
                        <div className="st-stat-top">
                            <div className="st-stat-icon st-icon-orange">⏱</div>
                            <div className="st-stat-info">
                                <p>Absent / Late</p>
                                <h3>{absentCount + lateCount}</h3>
                            </div>
                        </div>
                        <div className="st-stat-bottom">{getPercentage(absentCount + lateCount)}% of total</div>
                    </div>
                    <div className="st-stat-card">
                        <div className="st-stat-top">
                            <div className="st-stat-icon st-icon-blue">🏖️</div>
                            <div className="st-stat-info">
                                <p>Holiday</p>
                                <h3>{holidayCount}</h3>
                            </div>
                        </div>
                        <div className="st-stat-bottom">{getPercentage(holidayCount)}% of total</div>
                    </div>
                </div>
            )}

            {/* Attendance Marking - Pending */}
            {selectedClass && selectedSubject && selectedDate && !isFutureDate && (
                <div className="st-table-container" style={{ marginBottom: "2rem" }}>
                    <div className="st-table-header" style={{ marginBottom: "1rem" }}>
                        <div>
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>📄 Mark Attendance</h2>
                            <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>Select status for each student</p>
                        </div>
                        {pendingStudents.length > 0 && (
                            <div className="st-table-actions">
                                <button onClick={markAllPresent} type="button" className="st-btn" style={{background: '#10b981', color: 'white'}}>✓ All Present</button>
                                <button onClick={markAllAbsent} type="button" className="st-btn" style={{background: '#ef4444', color: 'white'}}>× All Absent</button>
                                <button onClick={markAllLate} type="button" className="st-btn" style={{background: '#f59e0b', color: 'white'}}>⏱ All Late</button>
                                <button onClick={markAllHoliday} type="button" className="st-btn" style={{background: '#3b82f6', color: 'white'}}>🏖️ Mark Holiday</button>
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>Loading...</div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <div style={{ overflowX: "auto" }}>
                                <table className="st-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: "40px" }}>
                                                <input 
                                                    type="checkbox" 
                                                    className="st-checkbox"
                                                    onChange={handleSelectAll}
                                                    checked={currentPendingStudents.length > 0 && selectedStudentIds.length === currentPendingStudents.length}
                                                />
                                            </th>
                                            <th>ROLL NO</th>
                                            <th>STUDENT NAME</th>
                                            <th>STATUS</th>
                                            <th>REMARKS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {!hasLoadedStudents ? (
                                            <tr>
                                                <td colSpan="5" style={{ textAlign: "center", padding: "4rem 2rem", color: "#64748b" }}>
                                                    <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>👇</div>
                                                    <h3 style={{ margin: "0 0 0.5rem 0", color: "#334155", fontSize: "1.1rem" }}>Ready to Mark Attendance</h3>
                                                    <p style={{ margin: 0, fontSize: "0.9rem" }}>Please click the <strong>↻ Load Students</strong> button above to fetch the list.</p>
                                                </td>
                                            </tr>
                                        ) : currentPendingStudents.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" style={{ textAlign: "center", padding: "3rem", color: "#10b981", fontWeight: "bold" }}>
                                                    Attendance already submitted for all students today. ✅
                                                </td>
                                            </tr>
                                        ) : (
                                            currentPendingStudents.map((student) => (
                                                <tr key={student.student_id}>
                                                    <td>
                                                        <input 
                                                            type="checkbox" 
                                                            className="st-checkbox" 
                                                            checked={selectedStudentIds.includes(student.student_id)}
                                                            onChange={() => handleSelectStudent(student.student_id)}
                                                        />
                                                    </td>
                                                    <td style={{ fontWeight: "600", fontSize: "0.85rem", color: "#64748b" }}>
                                                        {student.roll_number}
                                                    </td>
                                                    <td>
                                                        <div className="st-profile-col">
                                                            <div className="st-avatar">{student.name.charAt(0).toUpperCase()}</div>
                                                            <div className="st-profile-info">
                                                                <strong>{student.name}</strong>
                                                                <span>{student.email}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: "flex", gap: "15px" }}>
                                                            <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "0.85rem" }}>
                                                                <input
                                                                    type="radio"
                                                                    name={`status-${student.student_id}`}
                                                                    value="present"
                                                                    checked={attendanceData[student.student_id]?.status === "present"}
                                                                    onChange={() => handleStatusChange(student.student_id, "present")}
                                                                    style={{accentColor: '#10b981'}}
                                                                />
                                                                <span style={{ color: "#10b981", fontWeight: "600" }}>Present</span>
                                                            </label>
                                                            <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "0.85rem" }}>
                                                                <input
                                                                    type="radio"
                                                                    name={`status-${student.student_id}`}
                                                                    value="absent"
                                                                    checked={attendanceData[student.student_id]?.status === "absent"}
                                                                    onChange={() => handleStatusChange(student.student_id, "absent")}
                                                                    style={{accentColor: '#ef4444'}}
                                                                />
                                                                <span style={{ color: "#ef4444", fontWeight: "600" }}>Absent</span>
                                                            </label>
                                                            <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "0.85rem" }}>
                                                                <input
                                                                    type="radio"
                                                                    name={`status-${student.student_id}`}
                                                                    value="late"
                                                                    checked={attendanceData[student.student_id]?.status === "late"}
                                                                    onChange={() => handleStatusChange(student.student_id, "late")}
                                                                    style={{accentColor: '#f59e0b'}}
                                                                />
                                                                <span style={{ color: "#f59e0b", fontWeight: "600" }}>Late</span>
                                                            </label>
                                                            <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "0.85rem" }}>
                                                                <input
                                                                    type="radio"
                                                                    name={`status-${student.student_id}`}
                                                                    value="holiday"
                                                                    checked={attendanceData[student.student_id]?.status === "holiday"}
                                                                    onChange={() => handleStatusChange(student.student_id, "holiday")}
                                                                    style={{accentColor: '#3b82f6'}}
                                                                />
                                                                <span style={{ color: "#3b82f6", fontWeight: "600" }}>Holiday</span>
                                                            </label>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            placeholder="Optional remarks"
                                                            value={attendanceData[student.student_id]?.remarks || ""}
                                                            onChange={(e) => handleRemarksChange(student.student_id, e.target.value)}
                                                            style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", outline: "none", fontSize: "0.85rem" }}
                                                        />
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {pendingStudents.length > itemsPerPage && (
                                <div className="st-pagination-row">
                                    <div className="st-pagination-info">
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, pendingStudents.length)} of {pendingStudents.length} entries
                                    </div>
                                    <div className="st-pagination-controls">
                                        <button 
                                            type="button"
                                            className="st-page-btn" 
                                            disabled={currentPage === 1}
                                            onClick={() => setCurrentPage(prev => prev - 1)}
                                        >
                                            Prev
                                        </button>
                                        {[...Array(totalPages)].map((_, i) => (
                                            <button 
                                                type="button"
                                                key={i + 1}
                                                className={`st-page-btn ${currentPage === i + 1 ? 'active' : ''}`}
                                                onClick={() => setCurrentPage(i + 1)}
                                            >
                                                {i + 1}
                                            </button>
                                        ))}
                                        <button 
                                            type="button"
                                            className="st-page-btn"
                                            disabled={currentPage === totalPages}
                                            onClick={() => setCurrentPage(prev => prev + 1)}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}

                        </form>
                    )}
                </div>
            )}

            {/* Attendance Marking - Marked */}
            {selectedClass && selectedSubject && selectedDate && !isFutureDate && markedStudents.length > 0 && (
                <div className="st-table-container">
                    <div className="st-table-header" style={{ marginBottom: "1rem" }}>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981' }}>
                            ✅ Marked Attendance ({markedStudents.length} students)
                        </h2>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                        <table className="st-table">
                            <thead>
                                <tr>
                                    <th>ROLL NO</th>
                                    <th>STUDENT NAME</th>
                                    <th>STATUS</th>
                                    <th>TIME MARKED</th>
                                    <th>MARKED BY</th>
                                    <th>REMARKS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {markedStudents.map((student) => (
                                    <tr key={student.student_id} style={{ backgroundColor: "rgba(16, 185, 129, 0.02)" }}>
                                        <td style={{ fontWeight: "600", fontSize: "0.85rem", color: "#64748b" }}>
                                            {student.roll_number}
                                        </td>
                                        <td>
                                            <div className="st-profile-col">
                                                <div className="st-avatar">{student.name.charAt(0).toUpperCase()}</div>
                                                <div className="st-profile-info">
                                                    <strong>{student.name}</strong>
                                                    <span>{student.email}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{ 
                                                padding: '4px 10px', 
                                                borderRadius: '20px', 
                                                fontSize: '0.75rem', 
                                                fontWeight: '600',
                                                background: student.attendance.status === 'present' ? '#dcfce7' : student.attendance.status === 'absent' ? '#fee2e2' : student.attendance.status === 'holiday' ? '#e0f2fe' : '#fef3c7',
                                                color: student.attendance.status === 'present' ? '#16a34a' : student.attendance.status === 'absent' ? '#dc2626' : student.attendance.status === 'holiday' ? '#0284c7' : '#d97706'
                                            }}>
                                                {student.attendance.status.charAt(0).toUpperCase() + student.attendance.status.slice(1)}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                            {selectedDate}, 10:30 AM
                                        </td>
                                        <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                            IT Hub (Administrator)
                                        </td>
                                        <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                            {student.attendance.remarks || "Smart Attendance (Web)"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Report Modal */}
            {showReport && reportData && (
                <div className="modal-overlay" onClick={() => setShowReport(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "900px" }}>
                        <div className="modal-header">
                            <h3>📊 Attendance Report</h3>
                            <button onClick={() => setShowReport(false)} className="btn btn-sm">×</button>
                        </div>
                        <div className="modal-body">
                            {reportData.at_risk_students && reportData.at_risk_students.length > 0 && (
                                <div style={{ marginBottom: "1.5rem", padding: "1rem", backgroundColor: "#fef2f2", borderRadius: "8px", border: "1px solid #fecaca" }}>
                                    <h4 style={{ color: "#dc2626", marginBottom: "0.5rem" }}>⚠️ Students Below 75%</h4>
                                    <p style={{ fontSize: "0.875rem", color: "#991b1b" }}>
                                        {reportData.at_risk_students.length} student(s) need attention
                                    </p>
                                </div>
                            )}

                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Roll No</th>
                                            <th>Name</th>
                                            <th>Total Days</th>
                                            <th>Working Days</th>
                                            <th>Present</th>
                                            <th>Absent</th>
                                            <th>Late</th>
                                            <th>Holidays</th>
                                            <th>Percentage</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.data.map((student) => (
                                            <tr key={student.student_id}>
                                                <td>{student.roll_number}</td>
                                                <td>{student.name}</td>
                                                <td>{student.total_days}</td>
                                                <td>{student.working_days}</td>
                                                <td><span style={{ color: "#10b981" }}>{student.present_days}</span></td>
                                                <td><span style={{ color: "#ef4444" }}>{student.absent_days}</span></td>
                                                <td><span style={{ color: "#f59e0b" }}>{student.late_days}</span></td>
                                                <td><span style={{ color: "#3b82f6" }}>{student.holiday_days}</span></td>
                                                <td>
                                                    <span className={`badge ${student.percentage >= 75 ? 'badge-success' : 'badge-danger'}`}>
                                                        {student.percentage}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ Phase 3: SUNDAY DETECTION POPUP ═══ */}
            {sundayPopup && (
                <div className="modal-overlay" style={{ zIndex: 2000 }}>
                    <div className="modal" style={{ maxWidth: "480px", textAlign: "center" }}>
                        <div style={{ padding: "2rem" }}>
                            <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>📅</div>
                            <h2 style={{ marginBottom: "0.5rem", color: "var(--text-primary)" }}>Sunday Detected!</h2>
                            <p style={{ color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                                <strong>{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                            </p>
                            <p style={{ color: "var(--text-secondary)", marginBottom: "2rem", fontSize: "0.9rem" }}>
                                Is this a holiday or a working day?
                            </p>
                            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
                                <button
                                    onClick={markSundayAsHoliday}
                                    disabled={sundayMarkingHoliday}
                                    style={{
                                        padding: "0.75rem 1.75rem", borderRadius: "10px", border: "none",
                                        background: "linear-gradient(135deg,#3b82f6,#1d4ed8)",
                                        color: "#fff", fontWeight: "700", fontSize: "1rem", cursor: "pointer",
                                        boxShadow: "0 4px 12px rgba(59,130,246,0.4)"
                                    }}
                                >
                                    {sundayMarkingHoliday ? "Marking..." : "🏖️ Holiday"}
                                </button>
                                <button
                                    onClick={() => setSundayPopup(false)}
                                    style={{
                                        padding: "0.75rem 1.75rem", borderRadius: "10px", border: "2px solid var(--border-color)",
                                        background: "var(--card-bg)", color: "var(--text-primary)",
                                        fontWeight: "700", fontSize: "1rem", cursor: "pointer"
                                    }}
                                >
                                    🏫 Working Day
                                </button>
                            </div>
                            <p style={{ marginTop: "1.25rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                Choosing "Holiday" will auto-mark all students in the selected class/subject as Holiday.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Attendance;
