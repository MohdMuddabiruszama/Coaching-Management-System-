import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import "../admin/Dashboard.css";
import "../admin/Students.css"; // Reuse st-header

const MONTHS = [
    { value: 1, label: "January" }, { value: 2, label: "February" },
    { value: 3, label: "March" }, { value: 4, label: "April" },
    { value: 5, label: "May" }, { value: 6, label: "June" },
    { value: 7, label: "July" }, { value: 8, label: "August" },
    { value: 9, label: "September" }, { value: 10, label: "October" },
    { value: 11, label: "November" }, { value: 12, label: "December" }
];

// Reusing same mock SVG trend lines as other dashboards for speed
const chartPurple = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 30'%3E%3Cpath d='M0,25 L20,15 L40,20 L60,5 L80,10 L100,2' fill='none' stroke='%236366f1' stroke-width='2'/%3E%3Ccircle cx='100' cy='2' r='3' fill='%236366f1'/%3E%3C/svg%3E";
const chartGreen = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 30'%3E%3Cpath d='M0,25 L25,18 L50,22 L75,10 L100,5' fill='none' stroke='%2310b981' stroke-width='2'/%3E%3Ccircle cx='100' cy='5' r='3' fill='%2310b981'/%3E%3C/svg%3E";
const chartOrange = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 30'%3E%3Cpath d='M0,25 L33,25 L66,15 L100,15' fill='none' stroke='%23f59e0b' stroke-width='2'/%3E%3Ccircle cx='100' cy='15' r='3' fill='%23f59e0b'/%3E%3C/svg%3E";
const chartRed = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 30'%3E%3Cpath d='M0,20 L25,25 L50,15 L75,10 L100,25' fill='none' stroke='%23ef4444' stroke-width='2'/%3E%3Ccircle cx='100' cy='25' r='3' fill='%23ef4444'/%3E%3C/svg%3E";

const STATUS_CYCLE = {
    "clear": "present",
    "present": "absent",
    "absent": "late",
    "late": "holiday",
    "holiday": "clear"
};

function AdminFacultyViewAttendance() {
    const today = new Date();
    
    // Active Filters (Applied)
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [year, setYear] = useState(today.getFullYear());
    const [departmentFilter, setDepartmentFilter] = useState("all");
    const [designationFilter, setDesignationFilter] = useState("all");

    // Local Filters (Dropdown selections)
    const [localMonth, setLocalMonth] = useState(today.getMonth() + 1);
    const [localYear, setLocalYear] = useState(today.getFullYear());
    const [localDepartment, setLocalDepartment] = useState("all");
    const [localDesignation, setLocalDesignation] = useState("all");
    
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [attendanceData, setAttendanceData] = useState([]);
    const [gridUpdates, setGridUpdates] = useState({}); // { "facultyId_date": "newStatus" }
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        fetchGridData();
        setGridUpdates({});
    }, [month, year]);

    const fetchGridData = async () => {
        try {
            setLoading(true);
            const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
            const endDate = new Date(year, month, 0).toISOString().split('T')[0]; 
            const response = await api.get(`/faculty-attendance/grid?start_date=${startDate}&end_date=${endDate}`);
            setAttendanceData(response.data.data || []);
        } catch (error) {
            console.error("Error fetching grid:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCellClick = (facultyId, dateStr, currentBackendStatus) => {
        const updateKey = `${facultyId}_${dateStr}`;
        const currentEffectiveStatus = gridUpdates[updateKey] !== undefined ? gridUpdates[updateKey] : (currentBackendStatus || "clear");
        
        const nextStatus = STATUS_CYCLE[currentEffectiveStatus];
        
        setGridUpdates(prev => ({
            ...prev,
            [updateKey]: nextStatus
        }));
    };

    const handleBulkSubmit = async () => {
        if (Object.keys(gridUpdates).length === 0) return;
        
        try {
            setSubmitting(true);
            
            const updatesArray = Object.entries(gridUpdates).map(([key, status]) => {
                const [faculty_id, date] = key.split('_');
                return { faculty_id: parseInt(faculty_id), date, status, remarks: "Bulk update" };
            });
            
            const res = await api.post("/faculty-attendance/grid-update", { updates: updatesArray });
            if (res.data.success) {
                // Refresh data
                setGridUpdates({});
                await fetchGridData();
            }
        } catch (error) {
            alert(error.response?.data?.message || "Failed to update attendance");
        } finally {
            setSubmitting(false);
        }
    };

    // Filter Logic
    const uniqueDepartments = useMemo(() => {
        const deps = new Set(attendanceData.map(f => f.department));
        return Array.from(deps).filter(d => d && d !== "Unassigned");
    }, [attendanceData]);

    const uniqueDesignations = useMemo(() => {
        const des = new Set(attendanceData.map(f => f.designation));
        return Array.from(des).filter(d => d && d !== "Unassigned");
    }, [attendanceData]);

    const filteredData = useMemo(() => {
        return attendanceData.filter(f => {
            const matchDept = departmentFilter === "all" || f.department === departmentFilter;
            const matchDesig = designationFilter === "all" || f.designation === designationFilter;
            return matchDept && matchDesig;
        });
    }, [attendanceData, departmentFilter, designationFilter]);

    // Calculate overall stats dynamically from effective data
    let totalPossibleDays = 0;
    let totalPresentDays = 0;
    let totalLateDays = 0;
    let totalAbsentDays = 0;

    filteredData.forEach(f => {
        // Base stats from backend
        let present = f.present_days;
        let absent = f.absent_days;
        let late = f.late_days;
        let holiday = f.holiday_days;
        
        // Adjust for local unsaved changes
        Object.entries(gridUpdates).forEach(([key, newStatus]) => {
            if (key.startsWith(`${f.faculty_id}_`)) {
                const date = key.split('_')[1];
                const oldStatus = f.daily[date] || "clear";
                
                // remove old
                if (oldStatus === "present") present--;
                if (oldStatus === "absent") absent--;
                if (oldStatus === "late") late--;
                if (oldStatus === "holiday") holiday--;
                
                // add new
                if (newStatus === "present") present++;
                if (newStatus === "absent") absent++;
                if (newStatus === "late") late++;
                if (newStatus === "holiday") holiday++;
            }
        });
        
        totalPresentDays += present;
        totalLateDays += late;
        totalAbsentDays += absent;
        totalPossibleDays += (present + absent + late); // Simplified working days (excluding clear/holidays)
    });

    const overallRate = totalPossibleDays > 0 ? ((totalPresentDays / totalPossibleDays) * 100).toFixed(2) : "0.00";
    const totalFacultyCount = filteredData.length;

    const daysInSelectedMonth = new Date(year, month, 0).getDate();
    const daysArray = Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1);

    const hasUnsavedChanges = Object.keys(gridUpdates).length > 0;

    return (
        <div className="students-container">
            {/* ── Header ── */}
            <div className="st-header">
                <div className="st-header-top-row">
                    <div className="st-header-left">
                        <h1>Faculty Attendance Tracker</h1>
                        <p>Daily presence monitoring • {MONTHS.find(m => m.value === month)?.label} {year}</p>
                    </div>
                </div>
                <div className="st-header-bottom-row">
                    <div className="st-breadcrumbs">
                        <span>Dashboard</span>
                        <span>›</span>
                        <span className="active">Faculty Tracker</span>
                    </div>
                    <div className="st-header-actions">
                        <Link to="/admin/faculty-attendance" className="st-btn st-btn-primary" style={{ backgroundColor: "#6366f1" }}>
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Quick Mark
                        </Link>
                    </div>
                </div>
            </div>

            {/* ── Filters ── */}
            <div style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "16px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)", marginBottom: "2rem", border: "1px solid #f1f5f9" }}>
                <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                    <svg width="16" height="16" fill="none" stroke="#6366f1" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                    Filters
                </h3>
                <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div style={{ flex: 1, minWidth: "150px" }}>
                        <label style={{ display: "block", fontSize: "0.8rem", color: "#64748b", marginBottom: "6px", fontWeight: "600" }}>Month</label>
                        <select className="st-select" value={localMonth} onChange={e => setLocalMonth(Number(e.target.value))} style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                            {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: 1, minWidth: "150px" }}>
                        <label style={{ display: "block", fontSize: "0.8rem", color: "#64748b", marginBottom: "6px", fontWeight: "600" }}>Year</label>
                        <select className="st-select" value={localYear} onChange={e => setLocalYear(Number(e.target.value))} style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                            {[today.getFullYear()-1, today.getFullYear(), today.getFullYear()+1].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: 1, minWidth: "150px" }}>
                        <label style={{ display: "block", fontSize: "0.8rem", color: "#64748b", marginBottom: "6px", fontWeight: "600" }}>Department</label>
                        <select className="st-select" value={localDepartment} onChange={e => setLocalDepartment(e.target.value)} style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                            <option value="all">All Departments</option>
                            {uniqueDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: 1, minWidth: "150px" }}>
                        <label style={{ display: "block", fontSize: "0.8rem", color: "#64748b", marginBottom: "6px", fontWeight: "600" }}>Designation</label>
                        <select className="st-select" value={localDesignation} onChange={e => setLocalDesignation(e.target.value)} style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                            <option value="all">All Designations</option>
                            {uniqueDesignations.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div style={{ display: "flex", gap: "10px" }}>
                        <button className="st-btn st-btn-primary" style={{ height: "42px" }} onClick={() => { 
                            setMonth(localMonth); 
                            setYear(localYear); 
                            setDepartmentFilter(localDepartment); 
                            setDesignationFilter(localDesignation); 
                            setCurrentPage(1); // Reset to page 1 on filter
                        }}>
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                            Apply Filters
                        </button>
                        <button className="st-btn st-btn-outline" style={{ height: "42px" }} onClick={() => { 
                            setLocalMonth(today.getMonth() + 1); 
                            setLocalYear(today.getFullYear()); 
                            setLocalDepartment("all"); 
                            setLocalDesignation("all"); 
                            setMonth(today.getMonth() + 1); 
                            setYear(today.getFullYear()); 
                            setDepartmentFilter("all"); 
                            setDesignationFilter("all"); 
                            setCurrentPage(1);
                        }}>
                            Reset
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Stat Cards ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
                <div style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "16px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)", border: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ width: "48px", height: "48px", backgroundColor: "#eef2ff", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", color: "#6366f1" }}>
                            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>Overall Attendance</p>
                            <h3 style={{ margin: "4px 0 0 0", fontSize: "1.6rem", color: "#0f172a", fontWeight: "700" }}>{overallRate}%</h3>
                        </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto" }}>
                        <small style={{ color: "#64748b", fontSize: "0.8rem" }}>{totalPresentDays} / {totalPossibleDays} present</small>
                        <img src={chartPurple} alt="trend" style={{ height: "20px" }} />
                    </div>
                </div>
                <div style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "16px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)", border: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ width: "48px", height: "48px", backgroundColor: "#ecfdf5", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981" }}>
                            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>Total Faculty</p>
                            <h3 style={{ margin: "4px 0 0 0", fontSize: "1.6rem", color: "#0f172a", fontWeight: "700" }}>{totalFacultyCount}</h3>
                        </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto" }}>
                        <small style={{ color: "#64748b", fontSize: "0.8rem" }}>Active faculty members</small>
                        <img src={chartGreen} alt="trend" style={{ height: "20px" }} />
                    </div>
                </div>
                <div style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "16px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)", border: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ width: "48px", height: "48px", backgroundColor: "#fffbeb", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b" }}>
                            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>Late Arrivals</p>
                            <h3 style={{ margin: "4px 0 0 0", fontSize: "1.6rem", color: "#0f172a", fontWeight: "700" }}>{totalLateDays}</h3>
                        </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto" }}>
                        <small style={{ color: "#64748b", fontSize: "0.8rem" }}>This month</small>
                        <img src={chartOrange} alt="trend" style={{ height: "20px" }} />
                    </div>
                </div>
                <div style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "16px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)", border: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ width: "48px", height: "48px", backgroundColor: "#fef2f2", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}>
                            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>Absences</p>
                            <h3 style={{ margin: "4px 0 0 0", fontSize: "1.6rem", color: "#0f172a", fontWeight: "700" }}>{totalAbsentDays}</h3>
                        </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto" }}>
                        <small style={{ color: "#64748b", fontSize: "0.8rem" }}>This month</small>
                        <img src={chartRed} alt="trend" style={{ height: "20px" }} />
                    </div>
                </div>
            </div>

            {/* ── Legend ── */}
            <div style={{ backgroundColor: "#f8fafc", padding: "1rem 1.5rem", borderRadius: "12px", marginBottom: "2rem", display: "flex", alignItems: "center", gap: "2rem", border: "1px solid #e2e8f0" }}>
                <span style={{ fontWeight: "600", color: "#6366f1", fontSize: "0.9rem" }}>Legend:</span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "#334155" }}>
                    <span style={{ width: "20px", height: "20px", backgroundColor: "#d1fae5", color: "#10b981", borderRadius: "4px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>✓</span> Present
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "#334155" }}>
                    <span style={{ width: "20px", height: "20px", backgroundColor: "#fee2e2", color: "#ef4444", borderRadius: "4px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>A</span> Absent
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "#334155" }}>
                    <span style={{ width: "20px", height: "20px", backgroundColor: "#fef3c7", color: "#f59e0b", borderRadius: "4px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>L</span> Late
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "#334155" }}>
                    <span style={{ width: "20px", height: "20px", backgroundColor: "#dbeafe", color: "#3b82f6", borderRadius: "4px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>H</span> Holiday
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "#334155" }}>
                    <span style={{ width: "20px", height: "20px", color: "#94a3b8", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>-</span> Not Marked
                </div>
            </div>

            {/* ── Grid ── */}
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)", border: "1px solid #f1f5f9", overflow: "hidden", marginBottom: "100px" }}>
                <div style={{ padding: "1.5rem", borderBottom: "1px solid #f1f5f9" }}>
                    <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#0f172a" }}>Monthly Attendance Grid</h3>
                </div>
                {loading ? (
                    <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>Loading attendance data...</div>
                ) : filteredData.length === 0 ? (
                    <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>No faculty records found.</div>
                ) : (
                    <div style={{ overflowX: "auto", padding: "0 1.5rem 1.5rem 1.5rem" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1200px" }}>
                            <thead>
                                <tr>
                                    <th style={{ padding: "1rem", textAlign: "left", fontSize: "0.75rem", color: "#64748b", fontWeight: "600", borderBottom: "1px solid #f1f5f9" }}>FACULTY</th>
                                    {daysArray.map(d => {
                                        const dateObj = new Date(year, month - 1, d);
                                        const dayOfWeek = dateObj.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
                                        const isWeekend = dayOfWeek === "SAT" || dayOfWeek === "SUN";
                                        return (
                                            <th key={d} style={{ padding: "1rem 0.2rem", textAlign: "center", borderBottom: "1px solid #f1f5f9" }}>
                                                <div style={{ fontSize: "0.65rem", fontWeight: "600", color: isWeekend ? "#ef4444" : "#94a3b8", marginBottom: "4px" }}>{dayOfWeek}</div>
                                                <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "#0f172a" }}>{d}</div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((faculty) => (
                                    <tr key={faculty.faculty_id} style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.2s" }}>
                                        <td style={{ padding: "1rem", whiteSpace: "nowrap" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "#eef2ff", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "0.9rem" }}>
                                                    {faculty.name?.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase() || "F"}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: "600", color: "#0f172a", fontSize: "0.9rem" }}>{faculty.name}</div>
                                                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{faculty.designation}</div>
                                                </div>
                                            </div>
                                        </td>
                                        {daysArray.map(d => {
                                            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                            const updateKey = `${faculty.faculty_id}_${dateStr}`;
                                            const backendStatus = faculty.daily[dateStr] || "clear";
                                            const effectiveStatus = gridUpdates[updateKey] !== undefined ? gridUpdates[updateKey] : backendStatus;

                                            let icon = "-";
                                            let color = "#94a3b8";
                                            let bgColor = "transparent";

                                            if (effectiveStatus === "present") {
                                                icon = "✓"; color = "#10b981"; bgColor = "#d1fae5";
                                            } else if (effectiveStatus === "absent") {
                                                icon = "A"; color = "#ef4444"; bgColor = "#fee2e2";
                                            } else if (effectiveStatus === "late") {
                                                icon = "L"; color = "#f59e0b"; bgColor = "#fef3c7";
                                            } else if (effectiveStatus === "holiday") {
                                                icon = "H"; color = "#3b82f6"; bgColor = "#dbeafe";
                                            }

                                            return (
                                                <td key={d} style={{ textAlign: "center", padding: "0.5rem 0.2rem" }}>
                                                    <button 
                                                        onClick={() => handleCellClick(faculty.faculty_id, dateStr, backendStatus)}
                                                        style={{
                                                            width: "28px", height: "28px", margin: "0 auto", borderRadius: "6px",
                                                            border: "none", cursor: "pointer",
                                                            display: "flex", alignItems: "center", justifyContent: "center",
                                                            color: color, backgroundColor: bgColor,
                                                            fontWeight: "700", fontSize: "0.8rem",
                                                            transition: "all 0.1s",
                                                            outline: gridUpdates[updateKey] !== undefined ? "2px solid #6366f1" : "none",
                                                            outlineOffset: "1px"
                                                        }}
                                                        title={`Click to change status for ${dateStr}`}
                                                    >
                                                        {icon}
                                                    </button>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                
                {/* Pagination Controls */}
                {!loading && filteredData.length > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.5rem", borderTop: "1px solid #f1f5f9", backgroundColor: "#f8fafc" }}>
                        <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} faculty
                        </div>
                        <div style={{ display: "flex", gap: "5px" }}>
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="st-btn st-btn-outline"
                                style={{ padding: "0.5rem 1rem", height: "auto", fontSize: "0.85rem" }}
                            >
                                Previous
                            </button>
                            {Array.from({ length: Math.ceil(filteredData.length / itemsPerPage) }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={currentPage === page ? "st-btn st-btn-primary" : "st-btn st-btn-outline"}
                                    style={{ 
                                        padding: "0.5rem 0.8rem", 
                                        height: "auto", 
                                        fontSize: "0.85rem",
                                        backgroundColor: currentPage === page ? "#6366f1" : "transparent"
                                    }}
                                >
                                    {page}
                                </button>
                            ))}
                            <button 
                                onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredData.length / itemsPerPage), p + 1))}
                                disabled={currentPage === Math.ceil(filteredData.length / itemsPerPage)}
                                className="st-btn st-btn-outline"
                                style={{ padding: "0.5rem 1rem", height: "auto", fontSize: "0.85rem" }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Fixed Submit Banner ── */}
            {hasUnsavedChanges && (
                <div style={{ position: "fixed", bottom: "0", right: "0", left: "280px", backgroundColor: "#fff", padding: "1rem 2rem", boxShadow: "0 -4px 10px rgba(0,0,0,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e2e8f0", zIndex: 50, transition: "all 0.3s" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#64748b" }}>
                        <svg width="20" height="20" fill="none" stroke="#6366f1" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span style={{ fontSize: "0.9rem" }}>You have {Object.keys(gridUpdates).length} unsaved changes. Click on any date cell to change attendance status.</span>
                    </div>
                    <button 
                        onClick={handleBulkSubmit} 
                        disabled={submitting}
                        className="st-btn st-btn-primary" 
                        style={{ padding: "0.8rem 2rem", fontSize: "1rem", borderRadius: "8px", boxShadow: "0 4px 6px rgba(99, 102, 241, 0.2)" }}
                    >
                        {submitting ? "Saving..." : "✓ Submit Attendance"}
                    </button>
                </div>
            )}
        </div>
    );
}

export default AdminFacultyViewAttendance;
