import React, { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import ThemeSelector from "../../components/ThemeSelector";
import "../faculty/Dashboard"; // Reuse dashboard UI
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { savePdfNative } from "../../utils/capacitorPermissions";
import "../admin/Students.css"; // Reuse the modern styling from Students page

function ViewAttendance() {
    const { user } = useContext(AuthContext);
    const dashboardPath = user?.role === "admin" || user?.role === "superadmin" || user?.role === "super_admin" || user?.role === "manager"
        ? "/admin/dashboard"
        : "/faculty/dashboard";

    const [loading, setLoading] = useState(false);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);

    const [selectedClass, setSelectedClass] = useState("");
    const [selectedSubject, setSelectedSubject] = useState("");

    // Default to current month string: 'YYYY-MM'
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);

    const [gridData, setGridData] = useState([]);
    const [stats, setStats] = useState({
        overallRate: 0,
        totalStudents: 0,
        lateArrivals: 0,
        absencesToday: 0
    });

    // Export Modal State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportType, setExportType] = useState("");
    const [exportFilter, setExportFilter] = useState("all");

    // Calculate days configuration based on chosen month
    const [y, m] = selectedMonth.split('-');
    const daysInMonth = new Date(parseInt(y), parseInt(m), 0).getDate();
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const monthName = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

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

    // Clear grid when filters change so old data isn't shown incorrectly
    useEffect(() => {
        setGridData([]);
        setStats({
            overallRate: 0,
            totalStudents: 0,
            lateArrivals: 0,
            absencesToday: 0
        });
    }, [selectedClass, selectedSubject, selectedMonth]);

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
            // Auto-select first subject to save clicks
            if (response.data.data && response.data.data.length > 0) {
                setSelectedSubject(response.data.data[0].id);
            }
        } catch (error) {
            console.error("Error fetching subjects:", error);
        }
    };

    const fetchGridData = async () => {
        if (!selectedClass || !selectedSubject || !selectedMonth) {
            alert("Please select Class, Subject, and Month to view attendance.");
            return;
        }

        try {
            setLoading(true);
            const [year, month] = selectedMonth.split('-');
            const startDate = `${year}-${month}-01`;
            const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month

            const response = await api.get(`/attendance/class/${selectedClass}/subject/${selectedSubject}/grid?start_date=${startDate}&end_date=${endDate}`);

            if (response.data.success) {
                const data = response.data.data;
                setGridData(data);

                // Calculate quick stats logic
                const totalStudentsCount = data.length;
                let totalPresent = 0;
                let totalRecords = 0;
                let lateCount = 0;
                let absentCount = 0;

                const todayStr = new Date().toISOString().split('T')[0];
                let todayAbsences = 0;

                data.forEach(student => {
                    totalPresent += student.present_days;
                    totalRecords += student.total_days;
                    lateCount += student.late_days;
                    absentCount += student.absent_days;

                    if (student.daily[todayStr] === 'absent') {
                        todayAbsences++;
                    }
                });

                setStats({
                    overallRate: totalRecords > 0 ? ((totalPresent / totalRecords) * 100).toFixed(1) : 0,
                    totalStudents: totalStudentsCount,
                    lateArrivals: lateCount,
                    absencesToday: todayAbsences
                });
            }
        } catch (error) {
            console.error("Error fetching attendance grid:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = (type) => {
        if (gridData.length === 0) {
            alert("No attendance data to export.");
            return;
        }
        setExportType(type);
        setExportFilter("all");
        setShowExportModal(true);
    };

    const confirmExport = async () => {
        await exportGridData(exportType, exportFilter);
        setShowExportModal(false);
    };

    const exportGridData = async (type, filterStr) => {
        const className = classes.find(c => String(c.id) === String(selectedClass))?.name || "Unknown Class";
        const subjectName = subjects.find(s => String(s.id) === String(selectedSubject))?.name || "Unknown Subject";
        const title = `Attendance Grid - ${className} (${subjectName}) - ${monthName} - ${filterStr.toUpperCase()}`;

        const columns = ["ID", "Student Name", ...daysArray.map(d => String(d)), "P", "A", "L", "H", "W"];

        let targetRows = gridData;

        if (filterStr === "present") {
            targetRows = targetRows.filter(r => r.present_days > 0);
        } else if (filterStr === "absent") {
            targetRows = targetRows.filter(r => r.absent_days > 0);
        } else if (filterStr === "late") {
            targetRows = targetRows.filter(r => r.late_days > 0);
        } else if (filterStr === "holiday") {
            targetRows = targetRows.filter(r => r.holiday_days > 0);
        }

        if (targetRows.length === 0) {
            alert(`No records found for the filter: ${filterStr}`);
            return;
        }

        const rows = targetRows.map(student => {
            const dailyStatus = daysArray.map(day => {
                const dayString = String(day).padStart(2, '0');
                const fullDateStr = `${y}-${m}-${dayString}`;
                const status = student.daily[fullDateStr];
                if (status === 'present') return 'P';
                if (status === 'absent') return 'A';
                if (status === 'late') return 'L';
                if (status === 'holiday') return 'H';
                return '-';
            });

            return [
                student.student_id,
                student.name,
                ...dailyStatus,
                student.present_days,
                student.absent_days,
                student.late_days,
                student.holiday_days || 0,
                student.working_days
            ];
        });

        if (type === "PDF") {
            const doc = new jsPDF('landscape');
            doc.text(title, 14, 15);
            autoTable(doc, {
                head: [columns],
                body: rows,
                startY: 20,
                styles: { fontSize: 7, cellPadding: 1 },
                headStyles: { fillColor: [66, 66, 66] }
            });
            await savePdfNative(doc, `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
        } else if (type === "Excel") {
            const worksheet = XLSX.utils.aoa_to_sheet([columns, ...rows]);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Grid");
            XLSX.writeFile(workbook, `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xlsx`);
        }
    };

    const getStatusIcon = (status) => {
        if (!status) return <span style={{ color: '#9ca3af', backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>-</span>;
        if (status === 'present') return <span style={{ color: '#10b981', backgroundColor: '#d1fae5', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>✓</span>;
        if (status === 'absent') return <span style={{ color: '#ef4444', backgroundColor: '#fee2e2', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>A</span>;
        if (status === 'late') return <span style={{ color: '#f59e0b', backgroundColor: '#fef3c7', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>L</span>;
        if (status === 'holiday') return <span style={{ color: '#3b82f6', backgroundColor: '#dbeafe', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>H</span>;
        return <span style={{ color: '#9ca3af', backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>-</span>;
    };

    return (
        <div className="students-container">
            {/* ── Header ── */}
            <div className="st-header">
                <div className="st-header-top-row">
                    <div className="st-header-left">
                        <h1>Attendance Tracker</h1>
                        <p>Daily presence monitoring • {monthName}</p>
                    </div>
                </div>
                <div className="st-header-bottom-row">
                    <div className="st-breadcrumbs">
                        <Link to={dashboardPath} style={{color: '#64748b', textDecoration: 'none'}}>Dashboard</Link>
                        <span>›</span>
                        <span className="active">Attendance Tracker</span>
                    </div>
                    <div className="st-header-actions">
                        <button onClick={() => handleExport("PDF")} className="st-btn st-btn-outline" style={{ color: "#dc2626", borderColor: "#fca5a5", background: "#fef2f2" }}>
                            📄 Export PDF
                        </button>
                        <button onClick={() => handleExport("Excel")} className="st-btn st-btn-outline" style={{ color: "#16a34a", borderColor: "#86efac", background: "#f0fdf4" }}>
                            📊 Export Excel
                        </button>
                        <button onClick={fetchGridData} className="st-btn st-btn-primary" style={{ background: "#6366f1", borderColor: "#6366f1", color: "white" }}>
                            ↻ Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Filters Bar ── */}
            <div className="st-filters-bar">
                <div style={{flex: 1}}>
                    <label style={{display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.4rem', fontWeight: 600}}>Class</label>
                    <select
                        className="st-select"
                        style={{width: '100%'}}
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                    >
                        <option value="">-- Choose Class --</option>
                        {classes.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                                {cls.name} {cls.section ? `(${cls.section})` : ""}
                            </option>
                        ))}
                    </select>
                </div>
                <div style={{flex: 1}}>
                    <label style={{display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.4rem', fontWeight: 600}}>Subject</label>
                    <select
                        className="st-select"
                        style={{width: '100%'}}
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        disabled={!selectedClass}
                    >
                        <option value="">-- Choose Subject --</option>
                        {subjects.map((sub) => (
                            <option key={sub.id} value={sub.id}>
                                {sub.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div style={{flex: 1}}>
                    <label style={{display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.4rem', fontWeight: 600}}>Month</label>
                    <input
                        type="month"
                        className="st-select"
                        style={{width: '100%'}}
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                    />
                </div>
                <div style={{display: 'flex', alignItems: 'flex-end', paddingBottom: '2px'}}>
                    <button 
                        onClick={fetchGridData}
                        className="st-btn st-btn-outline" 
                        style={{ color: "#6366f1", borderColor: "#c7d2fe", background: "#eef2ff", height: '42px' }}
                    >
                        Y Apply Filters
                    </button>
                </div>
            </div>

            {/* ── Stat Cards ── */}
            <div className="st-stats-grid">
                <div className="st-stat-card">
                    <div className="st-stat-top">
                        <div className="st-stat-icon" style={{background: '#ede9fe', color: '#6366f1'}}>✓</div>
                        <div className="st-stat-info">
                            <p>Overall Attendance</p>
                            <h3>{stats.overallRate}%</h3>
                        </div>
                    </div>
                    <div className="st-stat-bottom">Percentage of days present</div>
                </div>
                <div className="st-stat-card">
                    <div className="st-stat-top">
                        <div className="st-stat-icon" style={{background: '#dcfce7', color: '#16a34a'}}>👥</div>
                        <div className="st-stat-info">
                            <p>Total Students</p>
                            <h3>{stats.totalStudents}</h3>
                        </div>
                    </div>
                    <div className="st-stat-bottom">Enrolled in this class</div>
                </div>
                <div className="st-stat-card">
                    <div className="st-stat-top">
                        <div className="st-stat-icon" style={{background: '#fef3c7', color: '#d97706'}}>🕒</div>
                        <div className="st-stat-info">
                            <p>Late Arrivals</p>
                            <h3>{stats.lateArrivals}</h3>
                        </div>
                    </div>
                    <div className="st-stat-bottom">This month</div>
                </div>
                <div className="st-stat-card">
                    <div className="st-stat-top">
                        <div className="st-stat-icon" style={{background: '#fee2e2', color: '#dc2626'}}>✕</div>
                        <div className="st-stat-info">
                            <p>Absences</p>
                            <h3>{stats.absencesToday}</h3>
                        </div>
                    </div>
                    <div className="st-stat-bottom">Total this month</div>
                </div>
            </div>

            {/* ── Legend ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: '#6366f1' }}>Legend:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#10b981', backgroundColor: '#d1fae5', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>✓</span> Present
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#ef4444', backgroundColor: '#fee2e2', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>A</span> Absent
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#f59e0b', backgroundColor: '#fef3c7', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>L</span> Late
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#3b82f6', backgroundColor: '#dbeafe', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>H</span> Holiday
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#9ca3af', backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>-</span> Not Marked
                    </div>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#10b981', backgroundColor: '#d1fae5', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
                    📅 Month: {monthName} • Total Days: {daysInMonth}
                </div>
            </div>

            {/* ── Grid Area ── */}
            <div className="st-table-container">
                <div className="st-table-header" style={{ marginBottom: "1rem" }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>Monthly Attendance Grid</h2>
                </div>
                <div style={{ overflowX: "auto" }}>
                    <table className="st-table" style={{ minWidth: "1200px" }}>
                        <thead>
                            <tr>
                                <th style={{ position: 'sticky', left: 0, backgroundColor: '#f8fafc', zIndex: 10, minWidth: '220px', borderRight: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', gap: '10px', paddingLeft: '10px' }}>
                                        <span style={{width: '60px', color: '#64748b'}}>Roll No.</span>
                                        <span style={{color: '#64748b'}}>Student Name</span>
                                    </div>
                                </th>
                                {daysArray.map(day => {
                                    const dateObj = new Date(parseInt(y), parseInt(m) - 1, day);
                                    const dayOfWeek = dateObj.toLocaleDateString("en-US", { weekday: "short" });
                                    const isWeekend = dateObj.getDay() === 0; // Sunday
                                    return (
                                        <th key={day} style={{
                                            textAlign: 'center',
                                            minWidth: '40px',
                                            color: isWeekend ? '#ef4444' : '#64748b',
                                        }}>
                                            <div style={{ fontSize: '0.65rem', fontWeight: 'normal', marginBottom: '2px', textTransform: 'uppercase' }}>{dayOfWeek}</div>
                                            <div style={{ fontSize: '0.85rem' }}>{day}</div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={daysInMonth + 1} style={{ textAlign: "center", padding: "3rem", color: '#94a3b8', fontWeight: 600 }}>
                                        Loading grid data...
                                    </td>
                                </tr>
                            ) : gridData.length === 0 ? (
                                <tr>
                                    <td colSpan={daysInMonth + 1} style={{ textAlign: "center", padding: "4rem", color: '#64748b' }}>
                                        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>👇</div>
                                        <h3 style={{ margin: "0 0 0.5rem 0", color: "#334155", fontSize: "1.1rem" }}>Ready to View Attendance</h3>
                                        <p style={{ margin: 0, fontSize: "0.9rem" }}>Please select Class, Subject, and Month, then click <strong>Y Apply Filters</strong>.</p>
                                    </td>
                                </tr>
                            ) : (
                                gridData.map(student => (
                                    <tr key={student.student_id}>
                                        <td style={{
                                            position: 'sticky',
                                            left: 0,
                                            backgroundColor: '#fff',
                                            zIndex: 9,
                                            borderRight: '1px solid #e2e8f0',
                                            padding: '0.75rem 1rem'
                                        }}>
                                            <div className="st-profile-col">
                                                <div className="st-avatar" style={{ backgroundColor: '#f3e8ff', color: '#9333ea', width: '32px', height: '32px', fontSize: '14px' }}>
                                                    {student.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="st-profile-info">
                                                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{student.roll_number || `RN${String(student.student_id).padStart(3, '0')}`}</span>
                                                    <strong style={{ fontSize: '0.9rem' }}>{student.name}</strong>
                                                </div>
                                            </div>
                                        </td>
                                        {daysArray.map(day => {
                                            const dayString = String(day).padStart(2, '0');
                                            const fullDateStr = `${y}-${m}-${dayString}`;
                                            return (
                                                <td key={fullDateStr} style={{ textAlign: 'center' }}>
                                                    {getStatusIcon(student.daily[fullDateStr])}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '0 1rem', paddingBottom: '1rem' }}>
                    <div style={{ color: '#64748b', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span>ℹ️</span> Note: Click on any status cell to edit attendance
                    </div>
                </div>
            </div>

            {/* Export Selection Modal */}
            {showExportModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2>Export {exportType}</h2>
                            <button onClick={() => setShowExportModal(false)} className="close-btn">&times;</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ marginBottom: "1rem" }}>Which records would you like to export?</p>

                            <div className="form-group">
                                <label className="form-label">Select Group</label>
                                <select
                                    className="form-input"
                                    value={exportFilter}
                                    onChange={(e) => setExportFilter(e.target.value)}
                                >
                                    <option value="all">All Students (In Selected Month)</option>
                                    <option value="present">Students Present (≥ 1 day)</option>
                                    <option value="absent">Students Absent (≥ 1 day)</option>
                                    <option value="late">Students Late (≥ 1 day)</option>
                                    <option value="holiday">Students On Holiday (≥ 1 day)</option>
                                </select>
                            </div>

                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowExportModal(false)} className="btn btn-secondary">Cancel</button>
                            <button onClick={confirmExport} className="btn btn-primary">Download {exportType}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ViewAttendance;
