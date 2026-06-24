import { useState, useEffect, useContext } from "react";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import { addToQueue } from "../../services/offlineQueue";
import "./MobileMarkAttendance.css";

const getLocalDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getInitials = (name) => {
    if (!name) return "";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
};

const getColorForInitials = (name) => {
    const colors = ["#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#14b8a6", "#f43f5e"];
    if (!name) return colors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

function MobileMarkAttendance() {
    const { user } = useContext(AuthContext);
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [subjects, setSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [selectedDate, setSelectedDate] = useState(getLocalDate());
    const [students, setStudents] = useState([]);
    const [attendanceData, setAttendanceData] = useState({});
    const [loading, setLoading] = useState(false);
    const [dashboardStats, setDashboardStats] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const studentsPerPage = 10;

    useEffect(() => {
        fetchClasses();
        fetchDashboardStats();
    }, []);

    useEffect(() => {
        if (selectedClass) {
            fetchSubjects();
        } else {
            setSubjects([]);
            setSelectedSubject("");
        }
    }, [selectedClass]);

    useEffect(() => {
        if (selectedClass && selectedSubject && selectedDate) {
            setCurrentPage(1);
            fetchClassAttendance();
        } else {
            setStudents([]);
        }
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
        } catch (error) {
            console.error("Error fetching subjects:", error);
        }
    };

    const fetchDashboardStats = async () => {
        try {
            const response = await api.get("/attendance/dashboard?date=" + getLocalDate());
            setDashboardStats(response.data.data);
        } catch (error) {
            console.error("Error fetching dashboard stats:", error);
        }
    };

    const fetchClassAttendance = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/attendance/class/${selectedClass}/subject/${selectedSubject}/date/${selectedDate}`);
            setStudents(response.data.data || []);

            const initialData = {};
            response.data.data.forEach(student => {
                if (student.attendance) {
                    initialData[student.student_id] = {
                        status: student.attendance.status,
                        remarks: student.attendance.remarks || "",
                        isExisting: true
                    };
                } else {
                    initialData[student.student_id] = {
                        status: "pending",
                        remarks: "",
                        isExisting: false
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

    const handleStatusChange = (studentId, status) => {
        setAttendanceData(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                status,
                isExisting: prev[studentId]?.isExisting
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

    const handleBulkStatusChange = (status) => {
        const newData = { ...attendanceData };
        students.forEach(student => {
            if (!attendanceData[student.student_id]?.isExisting) {
                newData[student.student_id] = {
                    status: status,
                    remarks: attendanceData[student.student_id]?.remarks || "",
                    isExisting: attendanceData[student.student_id]?.isExisting
                };
            }
        });
        setAttendanceData(newData);
    };

    const handleSubmit = async () => {
        const payloadData = [];
        
        students.forEach(student => {
            const stData = attendanceData[student.student_id];
            if (stData && !stData.isExisting && stData.status !== 'pending') {
                payloadData.push({
                    student_id: parseInt(student.student_id),
                    status: stData.status,
                    remarks: stData.remarks || ""
                });
            }
        });

        if (payloadData.length === 0) {
            alert("No attendance marked to submit.");
            return;
        }

        setSubmitting(true);
        try {
            await api.post("/attendance/bulk", {
                class_id: parseInt(selectedClass),
                subject_id: parseInt(selectedSubject),
                date: selectedDate,
                attendance_data: payloadData
            });
            fetchDashboardStats();
            alert("Attendance submitted successfully!");
            fetchClassAttendance();
        } catch (error) {
            if (!error.response || error.response.status >= 500) {
                await addToQueue({
                    method: 'POST',
                    url: '/attendance/bulk',
                    data: {
                        class_id: parseInt(selectedClass),
                        subject_id: parseInt(selectedSubject),
                        date: selectedDate,
                        attendance_data: payloadData
                    }
                });
                alert("You are offline. Attendance saved to queue and will sync automatically.");
            } else {
                alert(`Failed to submit attendance.`);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const markAllPresent = () => handleBulkStatusChange("present");
    const markAllAbsent = () => handleBulkStatusChange("absent");
    const markAllHoliday = () => handleBulkStatusChange("holiday");

    const basePendingStudentsList = students.filter(student => !attendanceData[student.student_id]?.isExisting);

    const filteredStudents = basePendingStudentsList.filter(student => {
        const query = searchQuery.toLowerCase();
        return (
            (student.name && student.name.toLowerCase().includes(query)) ||
            (student.roll_number && student.roll_number.toLowerCase().includes(query)) ||
            (student.email && student.email.toLowerCase().includes(query))
        );
    });

    const indexOfLastStudent = currentPage * studentsPerPage;
    const indexOfFirstStudent = indexOfLastStudent - studentsPerPage;
    const currentStudents = filteredStudents.slice(indexOfFirstStudent, indexOfLastStudent);
    const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);

    return (
        <div className="mma-container">
            {/* Hero Banner */}
            <div className="mma-hero-banner">
                <div className="mma-hero-left">
                    <div className="mma-hero-icon-wrapper">
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                    </div>
                    <div className="mma-hero-text">
                        <h2>Mark Attendance</h2>
                        <p>Record and manage student attendance efficiently.</p>
                    </div>
                </div>
                <div className="mma-hero-right">
                    <div className="mma-hero-graphic">
                        📋<span>⏱️</span>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            {dashboardStats && (
                <div className="mma-stats-grid">
                    <div className="mma-stat-card">
                        <div className="mma-stat-icon-wrap mma-icon-purple">
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                        </div>
                        <div className="mma-stat-number">{dashboardStats.today?.percentage || 0}%</div>
                        <div className="mma-stat-label">Today's Attendance</div>
                        <div className="mma-stat-sub">{dashboardStats.today?.present || 0}/{dashboardStats.today?.total || 0} present</div>
                    </div>

                    <div className="mma-stat-card">
                        <div className="mma-stat-icon-wrap mma-icon-green">
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="17" x2="12" y2="11"></line><line x1="8" y1="17" x2="8" y2="14"></line><line x1="16" y1="17" x2="16" y2="8"></line>
                            </svg>
                        </div>
                        <div className="mma-stat-number">{dashboardStats.this_month?.percentage || 0}%</div>
                        <div className="mma-stat-label">This Month Average</div>
                        <div className="mma-stat-sub">{dashboardStats.this_month?.present || 0}/{dashboardStats.this_month?.total || 0} present</div>
                    </div>

                    <div className="mma-stat-card">
                        <div className="mma-stat-icon-wrap mma-icon-orange">
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                        </div>
                        <div className="mma-stat-number">{dashboardStats.low_attendance_count || 0}</div>
                        <div className="mma-stat-label">Below 75%</div>
                        <div className="mma-stat-sub">Students at risk</div>
                    </div>

                    <div className="mma-stat-card">
                        <div className="mma-stat-icon-wrap mma-icon-blue">
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                        </div>
                        <div className="mma-stat-number">{dashboardStats.today?.total || 0}</div>
                        <div className="mma-stat-label">Total Students</div>
                        <div className="mma-stat-sub">Across all classes</div>
                    </div>
                </div>
            )}

            {/* Filter Section */}
            <div className="mma-filters-section">
                <div className="mma-filter-group">
                    <label>Select Class <span className="text-red">*</span></label>
                    <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                        <option value="">Choose a class</option>
                        {classes.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                                {cls.name} {cls.section && `- ${cls.section}`}
                            </option>
                        ))}
                    </select>
                </div>
                
                <div className="mma-filter-group">
                    <label>Select Subject <span className="text-red">*</span></label>
                    <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} disabled={!selectedClass}>
                        <option value="">Choose a subject</option>
                        {subjects.map((sub) => (
                            <option key={sub.id} value={sub.id}>
                                {sub.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="mma-filter-group">
                    <label>Select Date <span className="text-red">*</span></label>
                    <div className="mma-date-input-wrapper">
                        <input 
                            type="date" 
                            value={selectedDate} 
                            onChange={(e) => setSelectedDate(e.target.value)}
                            max={getLocalDate()}
                        />
                    </div>
                </div>
            </div>

            {/* Action Bar & Student List */}
            {selectedClass && selectedSubject && selectedDate && (
                <div className="mma-student-section">
                    {basePendingStudentsList.length === 0 && students.length > 0 ? (
                        <div style={{ textAlign: "center", padding: "40px 20px", background: "white", borderRadius: "16px", border: "1px solid #e5e7eb", margin: "16px", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
                            <div style={{ fontSize: "3.5rem", marginBottom: "16px" }}>✅</div>
                            <h3 style={{ color: "#10b981", fontSize: "1.4rem", fontWeight: "700", marginBottom: "8px", marginTop: 0 }}>All Caught Up!</h3>
                            <p style={{ color: "#6b7280", fontSize: "0.95rem", lineHeight: "1.5", margin: 0 }}>Attendance has already been successfully submitted for all students in this class today.</p>
                        </div>
                    ) : (
                        <>
                            <div className="mma-list-header">
                                <h3>⏳ Pending Students ({filteredStudents.length})</h3>
                                <div className="mma-action-buttons">
                                    <button className="btn-mark-present" onClick={markAllPresent}>
                                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> Mark All Present
                            </button>
                            <button className="btn-mark-absent" onClick={markAllAbsent}>
                                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Mark All Absent
                            </button>
                            <button className="btn-mark-holiday" onClick={markAllHoliday}>
                                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> Holiday
                            </button>
                        </div>
                    </div>

                    {students.length > 0 && (
                        <div style={{ padding: "0 16px", marginTop: "12px", marginBottom: "12px" }}>
                            <button 
                                onClick={handleSubmit}
                                disabled={submitting}
                                style={{
                                    width: "100%",
                                    background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                                    color: "white",
                                    padding: "16px",
                                    borderRadius: "12px",
                                    fontWeight: "700",
                                    fontSize: "15px",
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    gap: "8px",
                                    border: "none",
                                    boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
                                    cursor: submitting ? "not-allowed" : "pointer",
                                    opacity: submitting ? 0.7 : 1,
                                    transition: "opacity 0.2s"
                                }}
                            >
                                {submitting ? "Submitting..." : (
                                    <>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                                        Submit Attendance
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    <div className="mma-search-row">
                        <div className="mma-search-box">
                            <svg className="mma-search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            <input
                                type="text"
                                placeholder="Search by name, email, or roll num..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                    </div>

                    <div className="mma-student-list">
                        {loading ? (
                            <div className="mma-loading">Loading students...</div>
                        ) : students.length === 0 ? (
                            <div className="mma-empty">No students found</div>
                        ) : filteredStudents.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "40px 20px", background: "white", borderRadius: "12px", border: "1px dashed #cbd5e1", margin: "20px 16px" }}>
                                <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🔍</div>
                                <h4 style={{ color: "#475569", fontSize: "1.1rem", margin: "0 0 8px 0" }}>No matching students found</h4>
                                <p style={{ color: "#94a3b8", fontSize: "0.9rem", margin: 0 }}>Try adjusting your search query.</p>
                            </div>
                        ) : (
                            currentStudents.map(student => {
                                const stStatus = attendanceData[student.student_id]?.status || 'pending';
                                const stRemarks = attendanceData[student.student_id]?.remarks || '';

                                return (
                                    <div key={student.student_id} className="mma-student-card">
                                        <div className="mma-sc-top">
                                            <div className="mma-sc-avatar" style={{ backgroundColor: getColorForInitials(student.name) }}>
                                                {getInitials(student.name)}
                                            </div>
                                            <div className="mma-sc-info">
                                                <div className="mma-sc-name">{student.name}</div>
                                                <div className="mma-sc-roll">Roll No: {student.roll_number}</div>
                                            </div>
                                            <div className="mma-sc-remarks">
                                                <input 
                                                    type="text" 
                                                    className="mma-remarks-input" 
                                                    placeholder="Remarks..." 
                                                    value={stRemarks}
                                                    onChange={(e) => handleRemarksChange(student.student_id, e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        
                                        <div className="mma-sc-bottom">
                                            <label className={`mma-radio-label ${stStatus === 'present' ? 'active-present' : ''}`}>
                                                <input type="radio" name={`status-${student.student_id}`} checked={stStatus === 'present'} onChange={() => handleStatusChange(student.student_id, 'present')} />
                                                <span className="mma-radio-custom present"></span> Present
                                            </label>
                                            <label className={`mma-radio-label ${stStatus === 'absent' ? 'active-absent' : ''}`}>
                                                <input type="radio" name={`status-${student.student_id}`} checked={stStatus === 'absent'} onChange={() => handleStatusChange(student.student_id, 'absent')} />
                                                <span className="mma-radio-custom absent"></span> Absent
                                            </label>
                                            <label className={`mma-radio-label ${stStatus === 'late' ? 'active-late' : ''}`}>
                                                <input type="radio" name={`status-${student.student_id}`} checked={stStatus === 'late'} onChange={() => handleStatusChange(student.student_id, 'late')} />
                                                <span className="mma-radio-custom late"></span> Late
                                            </label>
                                            <label className={`mma-radio-label ${stStatus === 'holiday' ? 'active-holiday' : ''}`}>
                                                <input type="radio" name={`status-${student.student_id}`} checked={stStatus === 'holiday'} onChange={() => handleStatusChange(student.student_id, 'holiday')} />
                                                <span className="mma-radio-custom holiday"></span> Holiday
                                            </label>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {filteredStudents.length > studentsPerPage && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "white", borderRadius: "12px", marginTop: "12px", border: "1px solid #f1f5f9", boxShadow: "0 1px 4px rgba(0,0,0,0.02)" }}>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>
                                Showing {indexOfFirstStudent + 1} to {Math.min(indexOfLastStudent, filteredStudents.length)} of {filteredStudents.length}
                            </span>
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                <button 
                                    type="button"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => prev - 1)}
                                    style={{ padding: "6px 10px", border: "1px solid #e2e8f0", background: "white", borderRadius: "6px", cursor: currentPage === 1 ? "not-allowed" : "pointer", fontSize: "11px", color: "#334155", fontWeight: "600" }}
                                >
                                    Prev
                                </button>
                                <span style={{ fontSize: "11px", color: "#334155", fontWeight: "600" }}>
                                    {currentPage} / {totalPages}
                                </span>
                                <button 
                                    type="button"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(prev => prev + 1)}
                                    style={{ padding: "6px 10px", border: "1px solid #e2e8f0", background: "white", borderRadius: "6px", cursor: currentPage === totalPages ? "not-allowed" : "pointer", fontSize: "11px", color: "#334155", fontWeight: "600" }}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export default MobileMarkAttendance;
