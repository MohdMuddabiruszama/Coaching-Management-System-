import { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import { addToQueue } from "../../services/offlineQueue";
import MobileMarkAttendance from "./MobileMarkAttendance";
import "../admin/Dashboard.css";

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

function MarkAttendance() {
    const { user } = useContext(AuthContext);
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [subjects, setSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [selectedDate, setSelectedDate] = useState(getLocalDate());
    const [pendingRestoreSubject, setPendingRestoreSubject] = useState(null);
    const [students, setStudents] = useState([]);
    const [attendanceData, setAttendanceData] = useState({});
    const [loading, setLoading] = useState(false);
    const [dashboardStats, setDashboardStats] = useState(null);
    const [showReport, setShowReport] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [currentPagePending, setCurrentPagePending] = useState(1);
    const [searchQueryPending, setSearchQueryPending] = useState("");
    const [currentPageMarked, setCurrentPageMarked] = useState(1);
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
            setCurrentPagePending(1);
            setCurrentPageMarked(1);
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

            // Check if we need to restore subject from pending click
            setPendingRestoreSubject((prevPending) => {
                if (prevPending) {
                    setSelectedSubject(prevPending);
                    return null;
                }
                setSelectedSubject("");
                return null;
            });
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

    const handleStatusChange = async (studentId, status) => {
        const prevData = attendanceData[studentId];

        // 1. Optimistic UI update
        setAttendanceData(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                status,
                isExisting: true // optimistically mark as existing so it moves to "Marked" table if applicable
            }
        }));

        // 2. Background POST (Phase 4A)
        try {
            await api.post("/attendance/bulk", {
                class_id: parseInt(selectedClass),
                subject_id: parseInt(selectedSubject),
                date: selectedDate,
                attendance_data: [{
                    student_id: parseInt(studentId),
                    status: status,
                    remarks: prevData?.remarks || ""
                }]
            });
            // Update stats silently
            fetchDashboardStats();
        } catch (error) {
            // 3. Rollback on failure
            setAttendanceData(prev => ({
                ...prev,
                [studentId]: prevData // revert to original state
            }));
            
            // Queue for offline replay
            if (!error.response || error.response.status >= 500) {
                await addToQueue({
                    method: 'POST',
                    url: '/attendance/bulk',
                    data: {
                        class_id: parseInt(selectedClass),
                        subject_id: parseInt(selectedSubject),
                        date: selectedDate,
                        attendance_data: [{
                            student_id: parseInt(studentId),
                            status: status,
                            remarks: prevData?.remarks || ""
                        }]
                    }
                });
                console.log("Added to offline queue");
            } else {
                const msg = error.response?.data?.message || "Failed to save attendance.";
                alert(`Failed to mark ${status}: ${msg}`);
            }
        }
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
            const pendingStudents = Object.keys(attendanceData).filter(studentId => !attendanceData[studentId].isExisting);

            if (pendingStudents.length === 0) {
                alert("Attendance already submitted. No pending students to mark.");
                return;
            }

            const attendance_data = pendingStudents.map(studentId => ({
                student_id: parseInt(studentId),
                status: attendanceData[studentId].status,
                remarks: attendanceData[studentId].remarks
            }));

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

    const markAllPresent = () => {
        const newData = {};
        students.forEach(student => {
            newData[student.student_id] = {
                status: "present",
                remarks: attendanceData[student.student_id]?.remarks || "",
                isExisting: attendanceData[student.student_id]?.isExisting || false
            };
        });
        setAttendanceData(newData);
    };

    const markAllAbsent = () => {
        const newData = {};
        students.forEach(student => {
            newData[student.student_id] = {
                status: "absent",
                remarks: attendanceData[student.student_id]?.remarks || "",
                isExisting: attendanceData[student.student_id]?.isExisting || false
            };
        });
        setAttendanceData(newData);
    };

    const markAllHoliday = () => {
        const newData = {};
        students.forEach(student => {
            newData[student.student_id] = {
                status: "holiday",
                remarks: attendanceData[student.student_id]?.remarks || "",
                isExisting: attendanceData[student.student_id]?.isExisting || false
            };
        });
        setAttendanceData(newData);
    };

    const basePendingStudentsList = students.filter(s => !attendanceData[s.student_id]?.isExisting);
    const pendingStudentsList = basePendingStudentsList.filter(student => {
        const query = searchQueryPending.toLowerCase();
        return (
            (student.name && student.name.toLowerCase().includes(query)) ||
            (student.roll_number && student.roll_number.toLowerCase().includes(query)) ||
            (student.email && student.email.toLowerCase().includes(query))
        );
    });

    const indexOfLastPending = currentPagePending * studentsPerPage;
    const indexOfFirstPending = indexOfLastPending - studentsPerPage;
    const currentPendingStudents = pendingStudentsList.slice(indexOfFirstPending, indexOfLastPending);
    const totalPagesPending = Math.ceil(pendingStudentsList.length / studentsPerPage);

    const markedStudentsList = students.filter(s => attendanceData[s.student_id]?.isExisting);
    const indexOfLastMarked = currentPageMarked * studentsPerPage;
    const indexOfFirstMarked = indexOfLastMarked - studentsPerPage;
    const currentMarkedStudents = markedStudentsList.slice(indexOfFirstMarked, indexOfLastMarked);
    const totalPagesMarked = Math.ceil(markedStudentsList.length / studentsPerPage);

    if (Capacitor.isNativePlatform()) {
        return <MobileMarkAttendance />;
    }

    return (
        <div className="dashboard-container">
            <div className="dashboard-header" style={{ marginBottom: "2rem", borderBottom: "none", paddingBottom: "0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "white", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", color: "#6366f1", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", flexShrink: 0 }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                            <path d="M9 16l2 2 4-4"></path>
                        </svg>
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "700", color: "#111827" }}>Mark Attendance</h1>
                        <p style={{ margin: 0, color: "#6b7280", fontSize: "0.95rem" }}>Record and manage student attendance efficiently.</p>
                    </div>
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                    {selectedClass && (
                        <button onClick={handleViewReport} className="btn" style={{ background: "#4f46e5", color: "white", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px", padding: "0.5rem 1rem", borderRadius: "8px", border: "none", cursor: "pointer" }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                            View Report
                        </button>
                    )}
                </div>
            </div>

            {dashboardStats && (
                <div className="advanced-stats-grid" style={{ marginBottom: "2rem" }}>
                    <div className="advanced-stat-card asc-purple">
                        <div className="asc-top">
                            <div className="asc-icon-wrapper" style={{ background: "#f3e8ff", color: "#7e22ce" }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            </div>
                            <div className="asc-info" style={{ textAlign: "left", flex: 1, marginLeft: "15px" }}>
                                <p className="asc-label" style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "4px", margin: 0 }}>Today's Attendance</p>
                                <h3 className="asc-value" style={{ fontSize: "1.5rem", color: "#111827", margin: 0 }}>{dashboardStats.today.percentage}%</h3>
                            </div>
                        </div>
                        <div className="asc-bottom" style={{ marginTop: "12px" }}>
                            <span className="asc-sublabel" style={{ fontSize: "0.8rem", color: "#6b7280" }}>{dashboardStats.today.present}/{dashboardStats.today.total} present</span>
                        </div>
                    </div>
                    
                    <div className="advanced-stat-card asc-green">
                        <div className="asc-top">
                            <div className="asc-icon-wrapper" style={{ background: "#dcfce7", color: "#15803d" }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="17" x2="12" y2="11"></line><line x1="8" y1="17" x2="8" y2="14"></line><line x1="16" y1="17" x2="16" y2="8"></line></svg>
                            </div>
                            <div className="asc-info" style={{ textAlign: "left", flex: 1, marginLeft: "15px" }}>
                                <p className="asc-label" style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "4px", margin: 0 }}>This Month Average</p>
                                <h3 className="asc-value" style={{ fontSize: "1.5rem", color: "#111827", margin: 0 }}>{dashboardStats.this_month.percentage}%</h3>
                            </div>
                        </div>
                        <div className="asc-bottom" style={{ marginTop: "12px" }}>
                            <span className="asc-sublabel" style={{ fontSize: "0.8rem", color: "#6b7280" }}>{dashboardStats.this_month.present}/{dashboardStats.this_month.total} present</span>
                        </div>
                    </div>

                    <div className="advanced-stat-card asc-orange">
                        <div className="asc-top">
                            <div className="asc-icon-wrapper" style={{ background: "#fef3c7", color: "#d97706" }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                            </div>
                            <div className="asc-info" style={{ textAlign: "left", flex: 1, marginLeft: "15px" }}>
                                <p className="asc-label" style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "4px", margin: 0 }}>Below 75%</p>
                                <h3 className="asc-value" style={{ fontSize: "1.5rem", color: "#111827", margin: 0 }}>{dashboardStats.low_attendance_count}</h3>
                            </div>
                        </div>
                        <div className="asc-bottom" style={{ marginTop: "12px" }}>
                            <span className="asc-sublabel" style={{ fontSize: "0.8rem", color: "#6b7280" }}>Students at risk</span>
                        </div>
                    </div>

                    <div className="advanced-stat-card asc-blue">
                        <div className="asc-top">
                            <div className="asc-icon-wrapper" style={{ background: "#e0f2fe", color: "#0369a1" }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            </div>
                            <div className="asc-info" style={{ textAlign: "left", flex: 1, marginLeft: "15px" }}>
                                <p className="asc-label" style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "4px", margin: 0 }}>Total Students</p>
                                <h3 className="asc-value" style={{ fontSize: "1.5rem", color: "#111827", margin: 0 }}>{dashboardStats.today.total || 0}</h3>
                            </div>
                        </div>
                        <div className="asc-bottom" style={{ marginTop: "12px" }}>
                            <span className="asc-sublabel" style={{ fontSize: "0.8rem", color: "#6b7280" }}>Across all classes</span>
                        </div>
                    </div>
                </div>
            )}

            {dashboardStats?.pending_classes && dashboardStats.pending_classes.length > 0 && (
                <div className="card" style={{ marginBottom: "2rem", borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                    <div className="card-header" style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #f3f4f6", background: "white", borderRadius: "12px 12px 0 0" }}>
                        <h3 className="card-title" style={{ color: "#f59e0b", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                            <span>⏳</span> Pending Attendance for Today
                        </h3>
                    </div>
                    <div className="table-container" style={{ padding: "0 1.5rem" }}>
                        <table className="table mobile-keep" style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" }}>
                            <thead>
                                <tr style={{ color: "#6b7280", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", background: "transparent" }}>
                                    <th style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: "600" }}>Class</th>
                                    <th style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: "600" }}>Subject</th>
                                    <th style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: "600" }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dashboardStats.pending_classes.map((pc) => (
                                    <tr key={`${pc.class_id}-${pc.subject_id}`} style={{ background: "white", boxShadow: "0 1px 2px rgba(0,0,0,0.02)", borderRadius: "8px", border: "1px solid #f3f4f6" }}>
                                        <td style={{ padding: "16px", borderBottom: "1px solid #f3f4f6", borderTopLeftRadius: "8px", borderBottomLeftRadius: "8px", color: "#4b5563", fontWeight: "500" }}>{pc.class_name}</td>
                                        <td style={{ padding: "16px", borderBottom: "1px solid #f3f4f6", color: "#4b5563" }}>{pc.subject_name}</td>
                                        <td style={{ padding: "16px", borderBottom: "1px solid #f3f4f6", borderTopRightRadius: "8px", borderBottomRightRadius: "8px" }}>
                                            <button
                                                className="btn btn-sm"
                                                style={{ background: "#4f46e5", color: "white", borderRadius: "6px", border: "none", fontWeight: "500", padding: "0.5rem 1rem", cursor: "pointer" }}
                                                onClick={() => {
                                                    setPendingRestoreSubject(pc.subject_id.toString());
                                                    setSelectedClass(pc.class_id.toString());
                                                    setSelectedDate(getLocalDate());
                                                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                                                }}
                                            >
                                                Mark Manually
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div style={{ marginBottom: "2rem", background: "white", padding: "1.5rem", borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: "600", color: "#374151", fontSize: "0.9rem", marginBottom: "8px", display: "block" }}>Select Class <span style={{color: "#ef4444"}}>*</span></label>
                        <select
                            className="form-select"
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            style={{ padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid #d1d5db", width: "100%", outline: "none", transition: "border-color 0.2s" }}
                        >
                            <option value="">Choose a class</option>
                            {classes.map((cls) => (
                                <option key={cls.id} value={cls.id}>
                                    {cls.name} {cls.section && `- ${cls.section}`}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: "600", color: "#374151", fontSize: "0.9rem", marginBottom: "8px", display: "block" }}>Select Subject <span style={{color: "#ef4444"}}>*</span></label>
                        <select
                            className="form-select"
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                            disabled={!selectedClass}
                            style={{ padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid #d1d5db", width: "100%", outline: "none", transition: "border-color 0.2s", opacity: !selectedClass ? 0.6 : 1 }}
                        >
                            <option value="">Choose a subject</option>
                            {subjects.map((sub) => (
                                <option key={sub.id} value={sub.id}>
                                    {sub.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: "600", color: "#374151", fontSize: "0.9rem", marginBottom: "8px", display: "block" }}>Select Date <span style={{color: "#ef4444"}}>*</span></label>
                        <input
                            type="date"
                            className="form-input"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            max={getLocalDate()}
                            style={{ padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid #d1d5db", width: "100%", outline: "none", transition: "border-color 0.2s", boxSizing: "border-box" }}
                        />
                    </div>
                </div>
            </div>

            {selectedClass && selectedSubject && selectedDate && (
                <>
                    {/* Pending Students Table */}
                    <div className="card" style={{ marginBottom: "2rem", borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", background: "white" }}>
                        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem", borderBottom: "1px solid #f3f4f6", background: "white", borderRadius: "12px 12px 0 0" }}>
                            <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: "10px", margin: 0, fontSize: "1.1rem", color: "#111827" }}>
                                <span>⏳</span> Pending Students ({pendingStudentsList.length} students)
                            </h3>
                            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                                <div style={{ position: "relative", marginRight: "10px" }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }}>
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                    </svg>
                                    <input 
                                        type="text" 
                                        placeholder="Search by name or roll no..." 
                                        value={searchQueryPending}
                                        onChange={(e) => {
                                            setSearchQueryPending(e.target.value);
                                            setCurrentPagePending(1);
                                        }}
                                        style={{ padding: "0.5rem 1rem 0.5rem 2.2rem", borderRadius: "8px", border: "1px solid #d1d5db", outline: "none", fontSize: "0.85rem", width: "220px", transition: "border-color 0.2s" }}
                                    />
                                </div>
                                <button onClick={markAllPresent} className="btn btn-sm" type="button" style={{ background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer" }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    Mark All Present
                                </button>
                                <button onClick={markAllAbsent} className="btn btn-sm" type="button" style={{ background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer" }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    Mark All Absent
                                </button>
                                <button onClick={markAllHoliday} type="button" className="btn btn-sm" style={{ background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer" }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                    Holiday
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <div style={{ padding: "3rem", textAlign: "center", color: "#6b7280" }}>
                                <div className="loading-spinner"></div>
                                <p style={{ marginTop: "1rem" }}>Loading attendance data...</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit}>
                                <div className="table-container" style={{ padding: "1rem 1.5rem" }}>
                                    <table className="table mobile-keep" style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px", background: "white" }}>
                                        <thead>
                                            <tr style={{ color: "#6b7280", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", background: "transparent" }}>
                                                <th style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: "600", width: "100px", textAlign: "left" }}>Roll No.</th>
                                                <th style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: "600", textAlign: "left" }}>Student Name</th>
                                                <th style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: "600", textAlign: "left" }}>Status</th>
                                                <th style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: "600", textAlign: "left" }}>Remarks</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {basePendingStudentsList.length === 0 ? (
                                                <tr>
                                                    <td colSpan="4" style={{ textAlign: "center", padding: "3rem", color: "#10b981", fontWeight: "500", background: "white", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                                                        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✅</div>
                                                        Attendance already submitted for all students today.
                                                    </td>
                                                </tr>
                                            ) : pendingStudentsList.length === 0 ? (
                                                <tr>
                                                    <td colSpan="4" style={{ textAlign: "center", padding: "3rem", color: "#6b7280", fontWeight: "500", background: "white", borderRadius: "8px", border: "1px dashed #e5e7eb" }}>
                                                        <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🔍</div>
                                                        <div style={{ color: "#475569", fontSize: "1.1rem", fontWeight: "600", marginBottom: "4px" }}>No matching students found</div>
                                                        <div style={{ fontSize: "0.9rem" }}>Try adjusting your search query.</div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentPendingStudents.map((student) => (
                                                    <tr key={student.student_id} style={{ background: "white", boxShadow: "0 1px 2px rgba(0,0,0,0.03)", borderRadius: "8px", border: "1px solid #f3f4f6" }}>
                                                        <td style={{ padding: "16px", borderBottom: "1px solid #f3f4f6", borderTopLeftRadius: "8px", borderBottomLeftRadius: "8px", color: "#4b5563", fontWeight: "600", fontSize: "0.9rem", verticalAlign: "middle" }}>
                                                            {student.roll_number}
                                                        </td>
                                                        <td style={{ padding: "16px", borderBottom: "1px solid #f3f4f6", verticalAlign: "middle" }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                                <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: getColorForInitials(student.name), color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "600", fontSize: "0.9rem", flexShrink: 0 }}>
                                                                    {getInitials(student.name)}
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontWeight: "600", color: "#111827", fontSize: "0.95rem" }}>{student.name}</div>
                                                                    <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>{student.email}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: "16px", borderBottom: "1px solid #f3f4f6", verticalAlign: "middle" }}>
                                                            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                                                                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", color: attendanceData[student.student_id]?.status === 'present' ? '#10b981' : '#6b7280', fontSize: "0.9rem", fontWeight: attendanceData[student.student_id]?.status === 'present' ? "600" : "500", transition: "color 0.2s" }}>
                                                                    <input type="radio" name={`status-${student.student_id}`} value="present" checked={attendanceData[student.student_id]?.status === "present"} onChange={() => handleStatusChange(student.student_id, "present")} style={{ accentColor: '#10b981', width: "16px", height: "16px", cursor: "pointer" }} />
                                                                    Present
                                                                </label>
                                                                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", color: attendanceData[student.student_id]?.status === 'absent' ? '#ef4444' : '#6b7280', fontSize: "0.9rem", fontWeight: attendanceData[student.student_id]?.status === 'absent' ? "600" : "500", transition: "color 0.2s" }}>
                                                                    <input type="radio" name={`status-${student.student_id}`} value="absent" checked={attendanceData[student.student_id]?.status === "absent"} onChange={() => handleStatusChange(student.student_id, "absent")} style={{ accentColor: '#ef4444', width: "16px", height: "16px", cursor: "pointer" }} />
                                                                    Absent
                                                                </label>
                                                                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", color: attendanceData[student.student_id]?.status === 'late' ? '#f59e0b' : '#6b7280', fontSize: "0.9rem", fontWeight: attendanceData[student.student_id]?.status === 'late' ? "600" : "500", transition: "color 0.2s" }}>
                                                                    <input type="radio" name={`status-${student.student_id}`} value="late" checked={attendanceData[student.student_id]?.status === "late"} onChange={() => handleStatusChange(student.student_id, "late")} style={{ accentColor: '#f59e0b', width: "16px", height: "16px", cursor: "pointer" }} />
                                                                    Late
                                                                </label>
                                                                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", color: attendanceData[student.student_id]?.status === 'holiday' ? '#3b82f6' : '#6b7280', fontSize: "0.9rem", fontWeight: attendanceData[student.student_id]?.status === 'holiday' ? "600" : "500", transition: "color 0.2s" }}>
                                                                    <input type="radio" name={`status-${student.student_id}`} value="holiday" checked={attendanceData[student.student_id]?.status === "holiday"} onChange={() => handleStatusChange(student.student_id, "holiday")} style={{ accentColor: '#3b82f6', width: "16px", height: "16px", cursor: "pointer" }} />
                                                                    Holiday
                                                                </label>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: "16px", borderBottom: "1px solid #f3f4f6", borderTopRightRadius: "8px", borderBottomRightRadius: "8px", verticalAlign: "middle" }}>
                                                            <input type="text" className="form-input" placeholder="Optional remarks" value={attendanceData[student.student_id]?.remarks || ""} onChange={(e) => handleRemarksChange(student.student_id, e.target.value)} style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "10px 14px", width: "100%", fontSize: "0.9rem", background: "white", outline: "none", transition: "border-color 0.2s", boxSizing: "border-box" }} />
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {pendingStudentsList.length > studentsPerPage && (
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.5rem", borderTop: "1px solid #f3f4f6", background: "white" }}>
                                        <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                                            Showing {indexOfFirstPending + 1} to {Math.min(indexOfLastPending, pendingStudentsList.length)} of {pendingStudentsList.length} students
                                        </span>
                                        <div style={{ display: "flex", gap: "5px" }}>
                                            <button 
                                                type="button"
                                                disabled={currentPagePending === 1}
                                                onClick={() => setCurrentPagePending(prev => prev - 1)}
                                                style={{ padding: "6px 12px", border: "1px solid #e5e7eb", background: "white", borderRadius: "6px", cursor: currentPagePending === 1 ? "not-allowed" : "pointer", fontSize: "0.85rem", color: "#374151", fontWeight: "500" }}
                                            >
                                                Prev
                                            </button>
                                            <span style={{ padding: "6px 12px", fontSize: "0.85rem", color: "#374151", fontWeight: "500", display: "flex", alignItems: "center" }}>
                                                Page {currentPagePending} of {totalPagesPending}
                                            </span>
                                            <button 
                                                type="button"
                                                disabled={currentPagePending === totalPagesPending}
                                                onClick={() => setCurrentPagePending(prev => prev + 1)}
                                                style={{ padding: "6px 12px", border: "1px solid #e5e7eb", background: "white", borderRadius: "6px", cursor: currentPagePending === totalPagesPending ? "not-allowed" : "pointer", fontSize: "0.85rem", color: "#374151", fontWeight: "500" }}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {pendingStudentsList.length > 0 && (
                                    <div style={{ padding: "1.5rem", borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "flex-end", background: "white", borderRadius: "0 0 12px 12px" }}>
                                        <button type="submit" className="btn" style={{ background: "#4f46e5", color: "white", minWidth: "200px", padding: "0.75rem 2rem", borderRadius: "8px", fontWeight: "600", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", border: "none", cursor: "pointer", boxShadow: "0 2px 4px rgba(79, 70, 229, 0.2)" }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                                            Submit Attendance
                                        </button>
                                    </div>
                                )}
                            </form>
                        )}
                    </div>

                    {/* Marked Attendance Table */}
                    {markedStudentsList.length > 0 && (
                        <div className="card" style={{ marginBottom: "2rem", borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", background: "white" }}>
                            <div className="card-header" style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #f3f4f6", background: "white", borderRadius: "12px 12px 0 0" }}>
                                <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: "10px", margin: 0, fontSize: "1.1rem", color: "#111827" }}>
                                    <span>✅</span> Marked Attendance ({markedStudentsList.length} students)
                                </h3>
                            </div>
                            <div className="table-container" style={{ padding: "1rem 1.5rem" }}>
                                <table className="table mobile-keep" style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px", background: "white" }}>
                                    <thead>
                                        <tr style={{ color: "#6b7280", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", background: "transparent" }}>
                                            <th style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: "600", width: "100px", textAlign: "left" }}>Roll No.</th>
                                            <th style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: "600", textAlign: "left" }}>Student Name</th>
                                            <th style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: "600", textAlign: "left" }}>Marked Status</th>
                                            <th style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: "600", textAlign: "left" }}>Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentMarkedStudents.map((student) => (
                                            <tr key={student.student_id} style={{ background: "white", boxShadow: "0 1px 2px rgba(0,0,0,0.03)", borderRadius: "8px", border: "1px solid #f3f4f6" }}>
                                                <td style={{ padding: "16px", borderBottom: "1px solid #f3f4f6", borderTopLeftRadius: "8px", borderBottomLeftRadius: "8px", color: "#4b5563", fontWeight: "600", fontSize: "0.9rem", verticalAlign: "middle" }}>
                                                    {student.roll_number}
                                                </td>
                                                <td style={{ padding: "16px", borderBottom: "1px solid #f3f4f6", verticalAlign: "middle" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: getColorForInitials(student.name), color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "600", fontSize: "0.9rem", flexShrink: 0 }}>
                                                            {getInitials(student.name)}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: "600", color: "#111827", fontSize: "0.95rem" }}>{student.name}</div>
                                                            <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>{student.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: "16px", borderBottom: "1px solid #f3f4f6", verticalAlign: "middle" }}>
                                                    <span style={{ 
                                                        display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: "600", textTransform: "capitalize",
                                                        backgroundColor: attendanceData[student.student_id]?.status === 'present' ? '#dcfce7' : attendanceData[student.student_id]?.status === 'absent' ? '#fee2e2' : attendanceData[student.student_id]?.status === 'late' ? '#fef3c7' : attendanceData[student.student_id]?.status === 'holiday' ? '#e0f2fe' : '#f3f4f6',
                                                        color: attendanceData[student.student_id]?.status === 'present' ? '#16a34a' : attendanceData[student.student_id]?.status === 'absent' ? '#dc2626' : attendanceData[student.student_id]?.status === 'late' ? '#d97706' : attendanceData[student.student_id]?.status === 'holiday' ? '#0284c7' : '#4b5563'
                                                    }}>
                                                        {attendanceData[student.student_id]?.status}
                                                    </span>
                                                </td>
                                                <td style={{ padding: "16px", borderBottom: "1px solid #f3f4f6", borderTopRightRadius: "8px", borderBottomRightRadius: "8px", verticalAlign: "middle", color: "#6b7280", fontSize: "0.9rem" }}>
                                                    {attendanceData[student.student_id]?.remarks || "-"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {markedStudentsList.length > studentsPerPage && (
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.5rem", borderTop: "1px solid #f3f4f6", background: "white", borderRadius: "0 0 12px 12px" }}>
                                    <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                                        Showing {indexOfFirstMarked + 1} to {Math.min(indexOfLastMarked, markedStudentsList.length)} of {markedStudentsList.length} students
                                    </span>
                                    <div style={{ display: "flex", gap: "5px" }}>
                                        <button 
                                            type="button"
                                            disabled={currentPageMarked === 1}
                                            onClick={() => setCurrentPageMarked(prev => prev - 1)}
                                            style={{ padding: "6px 12px", border: "1px solid #e5e7eb", background: "white", borderRadius: "6px", cursor: currentPageMarked === 1 ? "not-allowed" : "pointer", fontSize: "0.85rem", color: "#374151", fontWeight: "500" }}
                                        >
                                            Prev
                                        </button>
                                        <span style={{ padding: "6px 12px", fontSize: "0.85rem", color: "#374151", fontWeight: "500", display: "flex", alignItems: "center" }}>
                                            Page {currentPageMarked} of {totalPagesMarked}
                                        </span>
                                        <button 
                                            type="button"
                                            disabled={currentPageMarked === totalPagesMarked}
                                            onClick={() => setCurrentPageMarked(prev => prev + 1)}
                                            style={{ padding: "6px 12px", border: "1px solid #e5e7eb", background: "white", borderRadius: "6px", cursor: currentPageMarked === totalPagesMarked ? "not-allowed" : "pointer", fontSize: "0.85rem", color: "#374151", fontWeight: "500" }}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {showReport && reportData && (
                <div className="modal-overlay" onClick={() => setShowReport(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "900px", borderRadius: "12px", overflow: "hidden" }}>
                        <div className="modal-header" style={{ padding: "1.5rem", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px", fontSize: "1.25rem" }}>📊 Attendance Report</h3>
                            <button onClick={() => setShowReport(false)} style={{ background: "transparent", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#6b7280" }}>×</button>
                        </div>
                        <div className="modal-body" style={{ padding: "1.5rem", maxHeight: "70vh", overflowY: "auto" }}>
                            {reportData.at_risk_students && reportData.at_risk_students.length > 0 && (
                                <div style={{ marginBottom: "1.5rem", padding: "1rem", backgroundColor: "#fef2f2", borderRadius: "8px", border: "1px solid #fecaca" }}>
                                    <h4 style={{ color: "#dc2626", marginBottom: "0.5rem", marginTop: 0 }}>⚠️ Students Below 75%</h4>
                                    <p style={{ fontSize: "0.875rem", color: "#991b1b", margin: 0 }}>
                                        {reportData.at_risk_students.length} student(s) need attention
                                    </p>
                                </div>
                            )}

                            <div className="table-container">
                                <table className="table mobile-keep" style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead>
                                        <tr style={{ color: "#6b7280", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e5e7eb" }}>
                                            <th style={{ padding: "12px 16px", textAlign: "left" }}>Roll No</th>
                                            <th style={{ padding: "12px 16px", textAlign: "left" }}>Name</th>
                                            <th style={{ padding: "12px 16px", textAlign: "center" }}>Total Days</th>
                                            <th style={{ padding: "12px 16px", textAlign: "center" }}>Working Days</th>
                                            <th style={{ padding: "12px 16px", textAlign: "center" }}>Present</th>
                                            <th style={{ padding: "12px 16px", textAlign: "center" }}>Absent</th>
                                            <th style={{ padding: "12px 16px", textAlign: "center" }}>Late</th>
                                            <th style={{ padding: "12px 16px", textAlign: "center" }}>Holidays</th>
                                            <th style={{ padding: "12px 16px", textAlign: "center" }}>Percentage</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.data.map((student) => (
                                            <tr key={student.student_id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                                                <td style={{ padding: "12px 16px", fontWeight: "500", color: "#4b5563" }}>{student.roll_number}</td>
                                                <td style={{ padding: "12px 16px", fontWeight: "600", color: "#111827" }}>{student.name}</td>
                                                <td style={{ padding: "12px 16px", textAlign: "center", color: "#6b7280" }}>{student.total_days}</td>
                                                <td style={{ padding: "12px 16px", textAlign: "center", color: "#6b7280" }}>{student.working_days}</td>
                                                <td style={{ padding: "12px 16px", textAlign: "center" }}><span style={{ color: "#16a34a", fontWeight: "600" }}>{student.present_days}</span></td>
                                                <td style={{ padding: "12px 16px", textAlign: "center" }}><span style={{ color: "#dc2626", fontWeight: "600" }}>{student.absent_days}</span></td>
                                                <td style={{ padding: "12px 16px", textAlign: "center" }}><span style={{ color: "#d97706", fontWeight: "600" }}>{student.late_days}</span></td>
                                                <td style={{ padding: "12px 16px", textAlign: "center" }}><span style={{ color: "#0284c7", fontWeight: "600" }}>{student.holiday_days}</span></td>
                                                <td style={{ padding: "12px 16px", textAlign: "center" }}>
                                                    <span style={{ 
                                                        display: "inline-block", padding: "4px 8px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "700",
                                                        backgroundColor: student.percentage >= 75 ? "#dcfce7" : "#fee2e2",
                                                        color: student.percentage >= 75 ? "#16a34a" : "#dc2626"
                                                    }}>
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
        </div>
    );
}

export default MarkAttendance;
