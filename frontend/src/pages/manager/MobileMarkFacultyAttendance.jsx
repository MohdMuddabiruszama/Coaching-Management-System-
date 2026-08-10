import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import "../faculty/MobileMarkAttendance.css";

function MobileMarkFacultyAttendance() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const getLocalDate = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [selectedDate, setSelectedDate] = useState(getLocalDate());
    const [facultyList, setFacultyList] = useState([]);
    const [attendanceData, setAttendanceData] = useState({});
    const [loading, setLoading] = useState(false);
    const [dashboardStats, setDashboardStats] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState("");
    const [submitting, setSubmitting] = useState(false);
    // Force cache invalidation to resolve React Error #310
    const facultyPerPage = 10;

    useEffect(() => {
        fetchDashboardStats();
    }, []);

    useEffect(() => {
        if (selectedDate) {
            setCurrentPage(1);
            fetchFacultyAttendance();
        } else {
            setFacultyList([]);
        }
    }, [selectedDate]);

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
            data.forEach(faculty => {
                if (faculty.attendance) {
                    initialData[faculty.faculty_id] = {
                        status: faculty.attendance.status,
                        remarks: faculty.attendance.remarks || "",
                        isExisting: true
                    };
                } else {
                    initialData[faculty.faculty_id] = {
                        status: "pending",
                        remarks: "",
                        isExisting: false
                    };
                }
            });
            setAttendanceData(initialData);
        } catch (error) {
            console.error("Error fetching attendance:", error);
            alert("Error loading faculty attendance data");
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = (facultyId, status) => {
        setAttendanceData(prev => ({
            ...prev,
            [facultyId]: {
                ...prev[facultyId],
                status,
                isExisting: prev[facultyId]?.isExisting
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

    const handleBulkStatusChange = (status) => {
        const newData = { ...attendanceData };
        facultyList.forEach(faculty => {
            if (!attendanceData[faculty.faculty_id]?.isExisting) {
                newData[faculty.faculty_id] = {
                    status: status,
                    remarks: attendanceData[faculty.faculty_id]?.remarks || "",
                    isExisting: attendanceData[faculty.faculty_id]?.isExisting
                };
            }
        });
        setAttendanceData(newData);
    };

    const handleSubmit = async () => {
        const attendance_payload = [];
        
        facultyList.forEach(faculty => {
            const fData = attendanceData[faculty.faculty_id];
            if (fData && !fData.isExisting && fData.status !== 'pending') {
                attendance_payload.push({
                    faculty_id: faculty.faculty_id,
                    status: fData.status,
                    remarks: fData.remarks || ""
                });
            }
        });

        if (attendance_payload.length === 0) {
            alert("No new attendance marked to submit.");
            return;
        }

        setSubmitting(true);
        try {
            await api.post("/faculty-attendance/manual", {
                date: selectedDate,
                attendance_data: attendance_payload
            });
            fetchDashboardStats();
            alert("Faculty Attendance marked successfully!");
            fetchFacultyAttendance();
        } catch (error) {
            const errorMessage = error.response?.data?.message || "Failed to submit attendance.";
            alert(errorMessage);
        } finally {
            setSubmitting(false);
        }
    };

    const markAllPresent = () => handleBulkStatusChange("present");
    const markAllAbsent = () => handleBulkStatusChange("absent");
    const markAllLate = () => handleBulkStatusChange("late");
    const markAllHoliday = () => handleBulkStatusChange("holiday");
    const clearSelect = () => handleBulkStatusChange("pending");

    const basePendingFacultyList = facultyList.filter(f => !attendanceData[f.faculty_id]?.isExisting);

    const filteredFaculty = basePendingFacultyList.filter(f => {
        const query = searchQuery.toLowerCase();
        return (
            (f.name && f.name.toLowerCase().includes(query)) ||
            (f.email && f.email.toLowerCase().includes(query))
        );
    });

    const indexOfLastFaculty = currentPage * facultyPerPage;
    const indexOfFirstFaculty = indexOfLastFaculty - facultyPerPage;
    const currentFaculty = filteredFaculty.slice(indexOfFirstFaculty, indexOfLastFaculty);
    const totalPages = Math.ceil(filteredFaculty.length / facultyPerPage);

    return (
        <div className="mma-container">
            {/* Hero Banner */}
            <div className="mma-hero-banner" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)' }}>
                <div className="mma-hero-left">
                    <div className="mma-hero-icon-wrapper" style={{ color: '#4338ca', background: 'rgba(255,255,255,0.2)' }}>
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                    </div>
                    <div className="mma-hero-text">
                        <h2>Mark Faculty</h2>
                        <p>Record and manage faculty attendance easily.</p>
                    </div>
                </div>
            </div>

            {/* Filter Section */}
            <div className="mma-filters-section">
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

            {loading ? (
                <div className="mma-loading">
                    <div className="mma-spinner"></div>
                    <p>Loading roster...</p>
                </div>
            ) : facultyList.length > 0 ? (
                <>
                    {/* Bulk Actions & Search aligned with student UI */}
                    <div className="mma-list-header">
                        <h3>⏳ Pending Faculty ({filteredFaculty.length})</h3>
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
                            {/* Added clear select since faculty might want to clear */}
                            <button style={{ backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={clearSelect}>
                                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M2 12A10 10 0 1 0 12 2v4a6 6 0 1 1-6 6H2Z"></path></svg> Clear
                            </button>
                        </div>
                    </div>

                    {facultyList.length > 0 && (
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
                                placeholder="Search by name or email..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                    </div>

                    <div className="mma-student-list">
                        {filteredFaculty.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "40px 20px", background: "white", borderRadius: "12px", border: "1px dashed #cbd5e1", margin: "20px 16px" }}>
                                <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🔍</div>
                                <h4 style={{ color: "#475569", fontSize: "1.1rem", margin: "0 0 8px 0" }}>No matching faculty found</h4>
                                <p style={{ color: "#94a3b8", fontSize: "0.9rem", margin: 0 }}>Try adjusting your search query.</p>
                            </div>
                        ) : (
                            currentFaculty.map((faculty) => {
                                const currentStatus = attendanceData[faculty.faculty_id]?.status || "pending";
                                const fRemarks = attendanceData[faculty.faculty_id]?.remarks || "";

                                // Simple initial generation for the avatar
                                const initials = faculty.name ? faculty.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'F';
                                // Simple color generation for the avatar
                                const colors = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399', '#2dd4bf', '#38bdf8', '#818cf8', '#a78bfa', '#e879f9', '#f43f5e'];
                                const colorIndex = faculty.name ? faculty.name.charCodeAt(0) % colors.length : 0;
                                const avatarColor = colors[colorIndex];
                                
                                return (
                                    <div key={faculty.faculty_id} className="mma-student-card">
                                        <div className="mma-sc-top">
                                            <div className="mma-sc-avatar" style={{ backgroundColor: avatarColor }}>
                                                {initials}
                                            </div>
                                            <div className="mma-sc-info">
                                                <div className="mma-sc-name">{faculty.name || "Faculty Member"}</div>
                                                <div className="mma-sc-roll">{faculty.phone || faculty.email}</div>
                                            </div>
                                            <div className="mma-sc-remarks">
                                                <input 
                                                    type="text" 
                                                    className="mma-remarks-input" 
                                                    placeholder="Remarks..." 
                                                    value={fRemarks}
                                                    onChange={(e) => handleRemarksChange(faculty.faculty_id, e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        
                                        <div className="mma-sc-bottom">
                                            <label className={`mma-radio-label ${currentStatus === 'present' ? 'active-present' : ''}`}>
                                                <input type="radio" name={`status-${faculty.faculty_id}`} checked={currentStatus === 'present'} onChange={() => handleStatusChange(faculty.faculty_id, 'present')} />
                                                <span className="mma-radio-custom present"></span> Present
                                            </label>
                                            <label className={`mma-radio-label ${currentStatus === 'absent' ? 'active-absent' : ''}`}>
                                                <input type="radio" name={`status-${faculty.faculty_id}`} checked={currentStatus === 'absent'} onChange={() => handleStatusChange(faculty.faculty_id, 'absent')} />
                                                <span className="mma-radio-custom absent"></span> Absent
                                            </label>
                                            <label className={`mma-radio-label ${currentStatus === 'late' ? 'active-late' : ''}`}>
                                                <input type="radio" name={`status-${faculty.faculty_id}`} checked={currentStatus === 'late'} onChange={() => handleStatusChange(faculty.faculty_id, 'late')} />
                                                <span className="mma-radio-custom late"></span> Late
                                            </label>
                                            <label className={`mma-radio-label ${currentStatus === 'holiday' ? 'active-holiday' : ''}`}>
                                                <input type="radio" name={`status-${faculty.faculty_id}`} checked={currentStatus === 'holiday'} onChange={() => handleStatusChange(faculty.faculty_id, 'holiday')} />
                                                <span className="mma-radio-custom holiday"></span> Holiday
                                            </label>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>


                    {filteredFaculty.length > facultyPerPage && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "white", borderRadius: "12px", marginTop: "12px", border: "1px solid #f1f5f9", boxShadow: "0 1px 4px rgba(0,0,0,0.02)", marginBottom: "80px" }}>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>
                                Showing {indexOfFirstFaculty + 1} to {Math.min(indexOfLastFaculty, filteredFaculty.length)} of {filteredFaculty.length}
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
            ) : (
                <div className="mma-empty-state">
                    <div className="mma-empty-icon" style={{ background: '#eef2ff', color: '#4f46e5' }}>📋</div>
                    <h3>No Faculty Found</h3>
                    <p>There are no faculty registered in the system.</p>
                </div>
            )}
            {/* Fixed Floating Button for Scanner */}
            <button 
                onClick={() => navigate('/manager/scan-faculty')}
                title="Scan QR Code"
                style={{ 
                    position: 'fixed',
                    bottom: '80px', // slightly above bottom navigation if any
                    right: '24px',
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                    color: 'white',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.4)',
                    cursor: 'pointer',
                    zIndex: 1000
                }}
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
                    <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
                    <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
                    <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
                    <rect x="7" y="7" width="10" height="10" rx="1"></rect>
                </svg>
            </button>
        </div>
    );
}

export default MobileMarkFacultyAttendance;
