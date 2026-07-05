import { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import "./Dashboard.css";
import "./Students.css";

function AdminManageFacultyAttendance() {
    const { user } = useContext(AuthContext);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [facultyList, setFacultyList] = useState([]);
    const [attendanceData, setAttendanceData] = useState({});
    const [loading, setLoading] = useState(false);
    const [dashboardStats, setDashboardStats] = useState(null);

    // Pagination for Pending Faculty
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    // Pagination for Marked Faculty
    const [markedCurrentPage, setMarkedCurrentPage] = useState(1);
    const [markedItemsPerPage] = useState(10);

    // Phase 3: Sunday detection
    const [sundayPopup, setSundayPopup] = useState(false);
    const [sundayMarkingHoliday, setSundayMarkingHoliday] = useState(false);
    const [futureDatePopup, setFutureDatePopup] = useState(false);

    useEffect(() => {
        fetchDashboardStats();
        fetchFacultyAttendance();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchDashboardStats = async () => {
        try {
            const response = await api.get("/faculty-attendance/dashboard");
            setDashboardStats(response.data.data);
        } catch (error) {
            console.error("Error fetching dashboard stats:", error);
        }
    };

    const fetchFacultyAttendance = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/faculty-attendance/date/${selectedDate}`);
            const data = response.data.data || [];
            setFacultyList(data);

            const initialData = {};
            let pendingCount = 0;
            let markedCount = 0;
            data.forEach(faculty => {
                if (faculty.attendance) {
                    markedCount++;
                    initialData[faculty.faculty_id] = {
                        status: faculty.attendance.status,
                        remarks: faculty.attendance.remarks || ""
                    };
                } else {
                    pendingCount++;
                }
            });
            setAttendanceData(initialData);
            setCurrentPage(1); // Reset pagination on load
            setMarkedCurrentPage(1);

            // Phase 3: Sunday detection - Only show if it's Sunday, we have faculty, and NO attendance is marked yet
            if (selectedDate) {
                const d = new Date(selectedDate + 'T00:00:00');
                if (d.getDay() === 0 && data.length > 0 && markedCount === 0) {
                    setSundayPopup(true);
                } else {
                    setSundayPopup(false);
                }
            }

        } catch (error) {
            console.error("Error fetching attendance:", error);
            alert("Error loading attendance data");
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = (facultyId, status) => {
        setAttendanceData(prev => ({
            ...prev,
            [facultyId]: {
                ...prev[facultyId],
                status
            }
        }));
    };

    const handleRemarksChange = (facultyId, remarks) => {
        setAttendanceData(prev => ({
            ...prev,
            [facultyId]: {
                ...prev[facultyId],
                remarks
            }
        }));
    };

    const handleSubmit = async () => {
        if (!selectedDate) {
            alert("Please select a date");
            return;
        }

        try {
            // Find faculty who have a status in attendanceData but are NOT yet marked in the backend
            const pendingFaculty = facultyList.filter(f => !f.attendance);
            
            const attendance_payload = pendingFaculty
                .filter(faculty => attendanceData[faculty.faculty_id]?.status) // Only those with selected status
                .map(faculty => ({
                    faculty_id: faculty.faculty_id,
                    status: attendanceData[faculty.faculty_id].status,
                    remarks: attendanceData[faculty.faculty_id].remarks || ""
                }));

            if (attendance_payload.length === 0) {
                alert("Please mark status for at least one pending faculty before submitting.");
                return;
            }

            await api.post("/faculty-attendance/manual", {
                date: selectedDate,
                attendance_data: attendance_payload
            });

            alert("Faculty Attendance marked successfully!");
            fetchDashboardStats();
            fetchFacultyAttendance();
        } catch (error) {
            const errorMessage = error.response?.data?.message || "Error marking attendance";
            alert(errorMessage);
        }
    };

    const markAllPresent = () => {
        const newData = { ...attendanceData };
        facultyList.filter(f => !f.attendance).forEach(faculty => {
            newData[faculty.faculty_id] = {
                status: "present",
                remarks: attendanceData[faculty.faculty_id]?.remarks || ""
            };
        });
        setAttendanceData(newData);
    };

    const markAllAbsent = () => {
        const newData = { ...attendanceData };
        facultyList.filter(f => !f.attendance).forEach(faculty => {
            newData[faculty.faculty_id] = {
                status: "absent",
                remarks: attendanceData[faculty.faculty_id]?.remarks || ""
            };
        });
        setAttendanceData(newData);
    };

    const markAllHoliday = () => {
        const newData = { ...attendanceData };
        facultyList.filter(f => !f.attendance).forEach(faculty => {
            newData[faculty.faculty_id] = {
                status: "holiday",
                remarks: attendanceData[faculty.faculty_id]?.remarks || ""
            };
        });
        setAttendanceData(newData);
    };
    
    const markAllLate = () => {
        const newData = { ...attendanceData };
        facultyList.filter(f => !f.attendance).forEach(faculty => {
            newData[faculty.faculty_id] = {
                status: "late",
                remarks: attendanceData[faculty.faculty_id]?.remarks || ""
            };
        });
        setAttendanceData(newData);
    };

    const clearAllPending = () => {
        // Clear all attendanceData that belongs to pending faculty
        const newData = { ...attendanceData };
        facultyList.filter(f => !f.attendance).forEach(faculty => {
             newData[faculty.faculty_id] = {
                 status: "",
                 remarks: newData[faculty.faculty_id]?.remarks || ""
             };
        });
        setAttendanceData(newData);
    };

    const markSundayAsHoliday = async () => {
        if (!selectedDate) {
            setSundayPopup(false);
            return;
        }
        setSundayMarkingHoliday(true);
        try {
            const resp = await api.get(`/faculty-attendance/date/${selectedDate}`);
            const allFaculty = resp.data.data || [];
            
            if (allFaculty.length === 0) {
                setSundayPopup(false);
                setSundayMarkingHoliday(false);
                alert("No faculty found for the selected date.");
                return;
            }

            const attendance_payload = allFaculty.map(f => ({
                faculty_id: f.faculty_id,
                status: 'holiday',
                remarks: 'Sunday Holiday'
            }));

            await api.post('/faculty-attendance/manual', {
                date: selectedDate,
                attendance_data: attendance_payload
            });
            
            setSundayPopup(false);
            alert(`✅ All ${allFaculty.length} faculty marked as Holiday for Sunday ${selectedDate}`);
            fetchFacultyAttendance();
            fetchDashboardStats();
        } catch (err) {
            alert(err.response?.data?.message || 'Error marking holiday');
        } finally {
            setSundayMarkingHoliday(false);
        }
    };

    // Derived states
    const pendingFaculty = facultyList.filter(f => !f.attendance);
    
    // In marked display, we want to show both officially marked (f.attendance) 
    // AND currently newly selected in the left panel (but not yet submitted)
    // Actually, following the standard UI, "Marked" typically shows what is saved in DB.
    // Let's stick to showing only saved ones in the right column, and selected ones stay in left column until "Submit" is clicked.
    // The empty state says "No attendance marked yet. Select faculty status and mark attendance to see the results here."
    // This implies that until they hit Submit, it stays on the left.
    
    const markedFaculty = facultyList.filter(f => f.attendance);
    const presentCount = markedFaculty.filter(f => f.attendance.status === 'present').length;

    // Pagination Logic for Pending
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentPendingFaculty = pendingFaculty.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(pendingFaculty.length / itemsPerPage);
    
    // Pagination Logic for Marked
    const indexOfLastMarkedItem = markedCurrentPage * markedItemsPerPage;
    const indexOfFirstMarkedItem = indexOfLastMarkedItem - markedItemsPerPage;
    const currentMarkedFaculty = markedFaculty.slice(indexOfFirstMarkedItem, indexOfLastMarkedItem);
    const totalMarkedPages = Math.ceil(markedFaculty.length / markedItemsPerPage);

    // Dummy small charts for stat cards (SVG data URIs for sleek look)
    const chartPurple = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 30'%3E%3Cpath d='M0,25 L20,15 L40,20 L60,5 L80,10 L100,2' fill='none' stroke='%236366f1' stroke-width='2'/%3E%3Ccircle cx='100' cy='2' r='3' fill='%236366f1'/%3E%3Ccircle cx='80' cy='10' r='2' fill='%236366f1'/%3E%3Ccircle cx='60' cy='5' r='2' fill='%236366f1'/%3E%3Ccircle cx='40' cy='20' r='2' fill='%236366f1'/%3E%3Ccircle cx='20' cy='15' r='2' fill='%236366f1'/%3E%3C/svg%3E";
    const chartGreen = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 30'%3E%3Cpath d='M0,25 L25,18 L50,22 L75,10 L100,5' fill='none' stroke='%2310b981' stroke-width='2'/%3E%3Ccircle cx='100' cy='5' r='3' fill='%2310b981'/%3E%3Ccircle cx='75' cy='10' r='2' fill='%2310b981'/%3E%3Ccircle cx='50' cy='22' r='2' fill='%2310b981'/%3E%3Ccircle cx='25' cy='18' r='2' fill='%2310b981'/%3E%3C/svg%3E";
    const chartOrange = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 30'%3E%3Cpath d='M0,25 L33,25 L66,15 L100,15' fill='none' stroke='%23f59e0b' stroke-width='2'/%3E%3Ccircle cx='100' cy='15' r='3' fill='%23f59e0b'/%3E%3Ccircle cx='66' cy='15' r='2' fill='%23f59e0b'/%3E%3Ccircle cx='33' cy='25' r='2' fill='%23f59e0b'/%3E%3C/svg%3E";

    // Helper for Avatar
    const getAvatarInitials = (name) => {
        return name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'F';
    };

    return (
        <div className="students-container">
            
            {/* ── Header ── */}
            <div className="st-header">
                <div className="st-header-top-row">
                    <div className="st-header-left">
                        <h1>Faculty Attendance Management</h1>
                        <p>Mark and track daily faculty attendance manually</p>
                    </div>
                </div>
                <div className="st-header-bottom-row">
                    <div className="st-breadcrumbs">
                        <span>Dashboard</span>
                        <span>›</span>
                        <span className="active">Faculty Attendance</span>
                    </div>
                    <div className="st-header-actions">
                        <Link to="/admin/view-faculty-attendance" className="st-btn st-btn-outline">
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            View Report
                        </Link>
                        <Link to="/admin/scan-faculty-qr" className="st-btn st-btn-primary" style={{textDecoration: "none"}}>
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                            Scan Attendance
                        </Link>
                    </div>
                </div>
            </div>

            <div>
                {/* dashboard stats (4 cards style) */}
            {dashboardStats && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
                    {/* Card 1 */}
                    <div style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "16px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)", border: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div style={{ width: "48px", height: "48px", backgroundColor: "#eef2ff", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", color: "#6366f1" }}>
                                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>Today Attendance</p>
                                <h3 style={{ margin: "4px 0 0 0", fontSize: "1.6rem", color: "#0f172a", fontWeight: "700" }}>{dashboardStats.today.present}</h3>
                            </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto" }}>
                            <small style={{ color: "#64748b", fontSize: "0.8rem" }}>{dashboardStats.today.present} Present Today</small>
                            <img src={chartPurple} alt="trend" style={{ height: "20px" }} />
                        </div>
                    </div>

                    {/* Card 2 */}
                    <div style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "16px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)", border: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div style={{ width: "48px", height: "48px", backgroundColor: "#ecfdf5", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981" }}>
                                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>This Month Average</p>
                                <h3 style={{ margin: "4px 0 0 0", fontSize: "1.6rem", color: "#0f172a", fontWeight: "700" }}>{dashboardStats.this_month.percentage}%</h3>
                            </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto" }}>
                            <small style={{ color: "#64748b", fontSize: "0.8rem" }}>{dashboardStats.this_month.present} / {dashboardStats.this_month.total} Present</small>
                            <img src={chartGreen} alt="trend" style={{ height: "20px" }} />
                        </div>
                    </div>

                    {/* Card 3 */}
                    <div style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "16px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)", border: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div style={{ width: "48px", height: "48px", backgroundColor: "#fffbeb", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b" }}>
                                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>Below Parity</p>
                                <h3 style={{ margin: "4px 0 0 0", fontSize: "1.6rem", color: "#0f172a", fontWeight: "700" }}>{dashboardStats.low_attendance_count}</h3>
                            </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto" }}>
                            <small style={{ color: "#64748b", fontSize: "0.8rem" }}>Faculty below 75%</small>
                            <img src={chartOrange} alt="trend" style={{ height: "20px" }} />
                        </div>
                    </div>

                    {/* Card 4 */}
                    <div style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "16px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)", border: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div style={{ width: "48px", height: "48px", backgroundColor: "#eff6ff", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6" }}>
                                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>Total Faculty</p>
                                <h3 style={{ margin: "4px 0 0 0", fontSize: "1.6rem", color: "#0f172a", fontWeight: "700" }}>{facultyList.length || 0}</h3>
                            </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto" }}>
                            <small style={{ color: "#64748b", fontSize: "0.8rem" }}>Active faculty members</small>
                            <div style={{ height: "20px" }}></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Date Selector Row */}
            <div style={{ backgroundColor: "#fff", padding: "1.2rem 1.5rem", borderRadius: "16px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)", border: "1px solid #f1f5f9", marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "#64748b", fontWeight: "600", marginBottom: "0.5rem" }}>Select Date <span style={{ color: "red" }}>*</span></label>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => {
                                const newDate = e.target.value;
                                if (!newDate) return;
                                const selected = new Date(newDate + 'T00:00:00');
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                if (selected > today) {
                                    setFutureDatePopup(true);
                                    // Revert to today
                                    setSelectedDate(today.toISOString().split('T')[0]);
                                } else {
                                    setSelectedDate(newDate);
                                }
                            }}
                            max={new Date().toISOString().split('T')[0]}
                            style={{ padding: "0.6rem 1rem", border: "1px solid #e2e8f0", borderRadius: "8px", outline: "none", color: "#334155", fontFamily: "inherit", width: "220px" }}
                        />
                    </div>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    {pendingFaculty.length > 0 && (
                        <button onClick={handleSubmit} className="st-btn st-btn-primary" style={{ padding: "0.6rem 1.2rem", fontSize: "0.9rem" }}>
                            ✓ Submit Attendance
                        </button>
                    )}
                    <button onClick={() => { 
                        const selected = new Date(selectedDate + 'T00:00:00');
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        
                        if (selected > today) {
                            setFutureDatePopup(true);
                        } else {
                            fetchFacultyAttendance(); 
                            fetchDashboardStats(); 
                        }
                    }} style={{ padding: "0.6rem 1.2rem", backgroundColor: "#f8fafc", color: "#6366f1", border: "1px solid #e2e8f0", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "8px" }}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Load Faculty
                    </button>
                </div>
            </div>

            {/* Pending Attendance Section */}
            <div className="st-table-container" style={{ marginBottom: "2rem" }}>
                <div className="st-table-header" style={{ marginBottom: "1rem" }}>
                    <div>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>📄 Mark Attendance</h2>
                        <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>Select status for each faculty</p>
                    </div>
                    {pendingFaculty.length > 0 && (
                        <div className="st-table-actions">
                            <button onClick={markAllPresent} type="button" className="st-btn" style={{background: '#10b981', color: 'white'}}>✓ All Present</button>
                            <button onClick={markAllAbsent} type="button" className="st-btn" style={{background: '#ef4444', color: 'white'}}>× All Absent</button>
                            <button onClick={markAllLate} type="button" className="st-btn" style={{background: '#f59e0b', color: 'white'}}>⏱ All Late</button>
                            <button onClick={markAllHoliday} type="button" className="st-btn" style={{background: '#3b82f6', color: 'white'}}>🏖️ Mark Holiday</button>
                            <button onClick={clearAllPending} type="button" className="st-btn" style={{background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0'}}>↺ Clear Select</button>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>Loading...</div>
                ) : (
                    <div>
                        <div style={{ overflowX: "auto" }}>
                            <table className="st-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>FACULTY NAME</th>
                                        <th>STATUS</th>
                                        <th>REMARKS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentPendingFaculty.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" style={{ textAlign: "center", padding: "3rem", color: "#10b981", fontWeight: "bold" }}>
                                                Attendance already submitted for all faculty today. ✅
                                            </td>
                                        </tr>
                                    ) : (
                                        currentPendingFaculty.map((faculty) => (
                                            <tr key={faculty.faculty_id}>
                                                <td style={{ fontWeight: "600", fontSize: "0.85rem", color: "#64748b" }}>
                                                    FAC-{faculty.faculty_id}
                                                </td>
                                                <td>
                                                    <div className="st-profile-col">
                                                        <div className="st-avatar">{getAvatarInitials(faculty.name)}</div>
                                                        <div className="st-profile-info">
                                                            <strong>{faculty.name}</strong>
                                                            <span>{faculty.email}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: "flex", gap: "15px" }}>
                                                        <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "0.85rem" }}>
                                                            <input
                                                                type="radio"
                                                                name={`status-${faculty.faculty_id}`}
                                                                value="present"
                                                                checked={attendanceData[faculty.faculty_id]?.status === "present"}
                                                                onChange={() => handleStatusChange(faculty.faculty_id, "present")}
                                                                style={{accentColor: '#10b981'}}
                                                            />
                                                            <span style={{ color: "#10b981", fontWeight: "600" }}>Present</span>
                                                        </label>
                                                        <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "0.85rem" }}>
                                                            <input
                                                                type="radio"
                                                                name={`status-${faculty.faculty_id}`}
                                                                value="absent"
                                                                checked={attendanceData[faculty.faculty_id]?.status === "absent"}
                                                                onChange={() => handleStatusChange(faculty.faculty_id, "absent")}
                                                                style={{accentColor: '#ef4444'}}
                                                            />
                                                            <span style={{ color: "#ef4444", fontWeight: "600" }}>Absent</span>
                                                        </label>
                                                        <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "0.85rem" }}>
                                                            <input
                                                                type="radio"
                                                                name={`status-${faculty.faculty_id}`}
                                                                value="late"
                                                                checked={attendanceData[faculty.faculty_id]?.status === "late"}
                                                                onChange={() => handleStatusChange(faculty.faculty_id, "late")}
                                                                style={{accentColor: '#f59e0b'}}
                                                            />
                                                            <span style={{ color: "#f59e0b", fontWeight: "600" }}>Late</span>
                                                        </label>
                                                        <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "0.85rem" }}>
                                                            <input
                                                                type="radio"
                                                                name={`status-${faculty.faculty_id}`}
                                                                value="holiday"
                                                                checked={attendanceData[faculty.faculty_id]?.status === "holiday"}
                                                                onChange={() => handleStatusChange(faculty.faculty_id, "holiday")}
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
                                                        value={attendanceData[faculty.faculty_id]?.remarks || ""}
                                                        onChange={(e) => handleRemarksChange(faculty.faculty_id, e.target.value)}
                                                        style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", outline: "none", fontSize: "0.85rem" }}
                                                    />
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {pendingFaculty.length > itemsPerPage && (
                            <div className="st-pagination-row">
                                <div className="st-pagination-info">
                                    Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, pendingFaculty.length)} of {pendingFaculty.length} entries
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
                        

                    </div>
                )}
            </div>

            {/* Marked Attendance Section */}
            {markedFaculty.length > 0 && (
                <div className="st-table-container">
                    <div className="st-table-header" style={{ marginBottom: "1rem" }}>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981' }}>
                            ✅ Marked Attendance ({markedFaculty.length} faculty)
                        </h2>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                        <table className="st-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>FACULTY NAME</th>
                                    <th>STATUS</th>
                                    <th>TIME MARKED</th>
                                    <th>MARKED BY</th>
                                    <th>REMARKS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentMarkedFaculty.map((faculty) => (
                                    <tr key={faculty.faculty_id} style={{ backgroundColor: "rgba(16, 185, 129, 0.02)" }}>
                                        <td style={{ fontWeight: "600", fontSize: "0.85rem", color: "#64748b" }}>
                                            FAC-{faculty.faculty_id}
                                        </td>
                                        <td>
                                            <div className="st-profile-col">
                                                <div className="st-avatar">{getAvatarInitials(faculty.name)}</div>
                                                <div className="st-profile-info">
                                                    <strong>{faculty.name}</strong>
                                                    <span>{faculty.email}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{ 
                                                padding: '4px 10px', 
                                                borderRadius: '20px', 
                                                fontSize: '0.75rem', 
                                                fontWeight: '600',
                                                background: faculty.attendance.status === 'present' ? '#dcfce7' : faculty.attendance.status === 'absent' ? '#fee2e2' : faculty.attendance.status === 'holiday' ? '#e0f2fe' : '#fef3c7',
                                                color: faculty.attendance.status === 'present' ? '#16a34a' : faculty.attendance.status === 'absent' ? '#dc2626' : faculty.attendance.status === 'holiday' ? '#0284c7' : '#d97706'
                                            }}>
                                                {faculty.attendance.status.charAt(0).toUpperCase() + faculty.attendance.status.slice(1)}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                            {selectedDate}, 10:30 AM
                                        </td>
                                        <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                            {faculty.attendance?.marker?.role === 'admin' 
                                                ? 'IT Hub (Administrator)' 
                                                : (faculty.attendance?.marker?.name || 'System')}
                                        </td>
                                        <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                            {faculty.attendance.remarks || "Smart Attendance (Web)"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {markedFaculty.length > markedItemsPerPage && (
                        <div className="st-pagination-row">
                            <div className="st-pagination-info">
                                Showing {indexOfFirstMarkedItem + 1} to {Math.min(indexOfLastMarkedItem, markedFaculty.length)} of {markedFaculty.length} entries
                            </div>
                            <div className="st-pagination-controls">
                                <button 
                                    type="button"
                                    className="st-page-btn" 
                                    disabled={markedCurrentPage === 1}
                                    onClick={() => setMarkedCurrentPage(prev => prev - 1)}
                                >
                                    Prev
                                </button>
                                {[...Array(totalMarkedPages)].map((_, i) => (
                                    <button 
                                        type="button"
                                        key={i + 1}
                                        className={`st-page-btn ${markedCurrentPage === i + 1 ? 'active' : ''}`}
                                        onClick={() => setMarkedCurrentPage(i + 1)}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                                <button 
                                    type="button"
                                    className="st-page-btn"
                                    disabled={markedCurrentPage === totalMarkedPages}
                                    onClick={() => setMarkedCurrentPage(prev => prev + 1)}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ Phase 3: SUNDAY DETECTION POPUP ═══ */}
            {sundayPopup && (
                <div className="modal-overlay" style={{ zIndex: 2000 }}>
                    <div className="modal" style={{ maxWidth: "480px", textAlign: "center", padding: "2.5rem 2rem", borderRadius: "20px" }}>
                        <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>📅</div>
                        <h2 style={{ marginBottom: "0.5rem", color: "#0f172a", fontSize: "1.8rem" }}>Sunday Detected!</h2>
                        <p style={{ color: "#64748b", marginBottom: "0.25rem", fontSize: "1.1rem" }}>
                            <strong>{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                        </p>
                        <p style={{ color: "#64748b", marginBottom: "2rem", fontSize: "0.95rem" }}>
                            Is this a holiday or a working day?
                        </p>
                        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
                            <button onClick={markSundayAsHoliday} disabled={sundayMarkingHoliday} style={{ padding: "0.8rem 1.8rem", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#3b82f6,#1d4ed8)", color: "#fff", fontWeight: "700", fontSize: "1rem", cursor: "pointer", boxShadow: "0 4px 12px rgba(59,130,246,0.3)" }}>
                                {sundayMarkingHoliday ? "Marking..." : "🏖️ Holiday"}
                            </button>
                            <button onClick={() => setSundayPopup(false)} style={{ padding: "0.8rem 1.8rem", borderRadius: "12px", border: "1px solid #cbd5e1", background: "#fff", color: "#334155", fontWeight: "700", fontSize: "1rem", cursor: "pointer" }}>
                                🏫 Working Day
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ FUTURE DATE DETECTION POPUP ═══ */}
            {futureDatePopup && (
                <div className="modal-overlay" style={{ zIndex: 2000 }}>
                    <div className="modal" style={{ maxWidth: "480px", textAlign: "center", padding: "2.5rem 2rem", borderRadius: "20px" }}>
                        <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>⏳</div>
                        <h2 style={{ marginBottom: "0.5rem", color: "#0f172a", fontSize: "1.8rem" }}>Future Date Not Possible!</h2>
                        <p style={{ color: "#64748b", marginBottom: "0.25rem", fontSize: "1.1rem" }}>
                            <strong>{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                        </p>
                        <p style={{ color: "#64748b", marginBottom: "2rem", fontSize: "0.95rem" }}>
                            You cannot mark or load attendance for a future date. Please select today or a past date.
                        </p>
                        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
                            <button onClick={() => setFutureDatePopup(false)} style={{ padding: "0.8rem 1.8rem", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "#fff", fontWeight: "700", fontSize: "1rem", cursor: "pointer", boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}>
                                Got It
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
}

export default AdminManageFacultyAttendance;
