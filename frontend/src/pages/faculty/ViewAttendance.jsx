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
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

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
        setCurrentPage(1);
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

    const totalPages = Math.ceil(gridData.length / itemsPerPage);
    const currentStudents = gridData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
                <div style={{display: 'flex', flexDirection: 'column'}}>
                    <label style={{display: 'block', fontSize: '0.8rem', color: 'transparent', marginBottom: '0.4rem', userSelect: 'none'}}>&nbsp;</label>
                    <button 
                        onClick={fetchGridData}
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
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                        </svg>
                        Apply Filters
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
                                        <p style={{ margin: 0, fontSize: "0.9rem" }}>Please select Class, Subject, and Month, then click <strong>Apply Filters</strong>.</p>
                                    </td>
                                </tr>
                            ) : (
                                currentStudents.map(student => (
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
                {gridData.length > itemsPerPage && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.5rem 1rem", borderBottom: "1px solid #e2e8f0" }}>
                        <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
                            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, gridData.length)} of {gridData.length} students
                        </span>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button 
                                className="st-page-btn" 
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => prev - 1)}
                            >
                                Prev
                            </button>
                            {[...Array(totalPages)].map((_, i) => {
                                const page = i + 1;
                                if (totalPages > 7 && page !== 1 && page !== totalPages && Math.abs(page - currentPage) > 1) {
                                    if (page === 2 || page === totalPages - 1) return <span key={page} style={{ color: "#94a3b8", padding: "0.4rem" }}>...</span>;
                                    return null;
                                }
                                return (
                                    <button 
                                        key={page}
                                        className={`st-page-btn ${currentPage === page ? 'active' : ''}`}
                                        onClick={() => setCurrentPage(page)}
                                    >
                                        {page}
                                    </button>
                                );
                            })}
                            <button 
                                className="st-page-btn"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(prev => prev + 1)}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '0 1rem', paddingBottom: '1rem' }}>
                    <div style={{ color: '#64748b', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span>ℹ️</span> Note: Click on any status cell to edit attendance
                    </div>
                </div>
            </div>

            {/* Export Selection Modal */}
            {showExportModal && (
                <div className="modal-overlay" style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(15, 23, 42, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', inset: 0, zIndex: 1000 }}>
                    <div className="modal-content" style={{ maxWidth: '550px', width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: '16px', overflow: 'hidden', padding: 0, border: 'none', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', backgroundColor: '#fff', animation: 'modalSlideIn 0.3s ease-out' }}>
                        <div className="modal-header" style={{ padding: '1.5rem 1.5rem 1rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ 
                                    backgroundColor: exportType === 'PDF' ? '#ede9fe' : '#dcfce7', 
                                    color: exportType === 'PDF' ? '#6366f1' : '#16a34a', 
                                    width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' 
                                }}>
                                    {exportType === 'PDF' ? (
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                    ) : (
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="17"></line><line x1="8" y1="17" x2="16" y2="13"></line></svg>
                                    )}
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 700 }}>Export {exportType}</h2>
                                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>Download attendance report as {exportType}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowExportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: '0.5rem', borderRadius: '8px', transition: 'all 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        
                        <div className="modal-body" style={{ padding: '1.5rem', backgroundColor: '#fff', overflowY: 'auto', flex: 1 }}>
                            <p style={{ margin: '0 0 1rem 0', fontWeight: 600, color: '#334155', fontSize: '0.9rem' }}>Which records would you like to export?</p>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: '#0f172a', marginBottom: '0.75rem', fontWeight: 600 }}>Select Group</label>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.25rem' }}>
                                {[
                                    { id: 'all', title: 'All Students (In Selected Month)', desc: 'Export attendance of all students for the selected month', color: '#6366f1', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> },
                                    { id: 'present', title: 'Students Present (≥ 1 day)', desc: 'Export students who were present at least 1 day', color: '#10b981', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline></svg> },
                                    { id: 'absent', title: 'Students Absent (≥ 1 day)', desc: 'Export students who were absent at least 1 day', color: '#ef4444', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="18" y1="8" x2="23" y2="13"></line><line x1="23" y1="8" x2="18" y2="13"></line></svg> },
                                    { id: 'late', title: 'Students Late (≥ 1 day)', desc: 'Export students who were late at least 1 day', color: '#f59e0b', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> },
                                    { id: 'holiday', title: 'Students On Holiday (≥ 1 day)', desc: 'Export students who were on holiday at least 1 day', color: '#3b82f6', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> }
                                ].map(opt => {
                                    const isSelected = exportFilter === opt.id;
                                    return (
                                        <div 
                                            key={opt.id}
                                            onClick={() => setExportFilter(opt.id)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                padding: '1rem',
                                                border: isSelected ? `2px solid ${opt.color}` : '1px solid #e2e8f0',
                                                borderRadius: '12px',
                                                cursor: 'pointer',
                                                backgroundColor: isSelected ? `${opt.color}10` : '#fff',
                                                transition: 'all 0.2s ease',
                                                gap: '1rem'
                                            }}
                                        >
                                            {/* Custom Radio */}
                                            <div style={{
                                                minWidth: '18px',
                                                height: '18px',
                                                borderRadius: '50%',
                                                border: isSelected ? `5px solid ${opt.color}` : '2px solid #cbd5e1',
                                                backgroundColor: '#fff',
                                                transition: 'all 0.2s ease'
                                            }}></div>

                                            {/* Icon */}
                                            <div style={{ color: opt.color, display: 'flex' }}>
                                                {opt.icon}
                                            </div>
                                            
                                            {/* Text */}
                                            <div style={{ flex: 1 }}>
                                                <h4 style={{ margin: 0, color: isSelected ? opt.color : '#334155', fontSize: '0.95rem', fontWeight: 600 }}>{opt.title}</h4>
                                                <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.8rem' }}>{opt.desc}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="modal-footer" style={{ padding: '1.25rem 1.5rem', backgroundColor: '#fff', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                            <button 
                                onClick={() => setShowExportModal(false)} 
                                style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer', flex: 1, transition: 'all 0.2s' }}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmExport} 
                                style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', backgroundColor: exportType === 'PDF' ? '#6366f1' : '#16a34a', color: '#fff', fontWeight: 600, cursor: 'pointer', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: `0 4px 6px -1px ${exportType === 'PDF' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(22, 163, 74, 0.3)'}`, transition: 'all 0.2s' }}
                            >
                                {exportType === 'PDF' ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                )}
                                Download {exportType}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ViewAttendance;
