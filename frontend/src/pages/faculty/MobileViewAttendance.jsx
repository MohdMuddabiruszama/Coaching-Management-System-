import React from "react";
import "./MobileViewAttendance.css";

const MobileViewAttendance = ({
    loading,
    classes,
    subjects,
    selectedClass,
    setSelectedClass,
    selectedSubject,
    setSelectedSubject,
    selectedMonth,
    setSelectedMonth,
    fetchGridData,
    stats,
    gridData,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    handleExport,
    daysArray,
    monthName,
    y,
    m,
    searchQuery,
    setSearchQuery
}) => {

    const totalPages = Math.ceil(gridData.length / itemsPerPage);
    const currentStudents = gridData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const getStatusIcon = (status) => {
        if (!status) return <span className="mva-legend-badge notmarked">-</span>;
        if (status === 'present') return <span className="mva-legend-badge present">✓</span>;
        if (status === 'absent') return <span className="mva-legend-badge absent">A</span>;
        if (status === 'late') return <span className="mva-legend-badge late">L</span>;
        if (status === 'holiday') return <span className="mva-legend-badge holiday">H</span>;
        return <span className="mva-legend-badge notmarked">-</span>;
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

    return (
        <div className="mva-container">
            {/* Header Banner */}
            <div className="mva-header-banner">
                <div className="mva-header-content">
                    <div className="mva-header-icon">
                        📅
                    </div>
                    <div className="mva-header-text">
                        <h1>Attendance Tracker</h1>
                        <p>Monitor daily attendance and get insights across all your classes.</p>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="mva-action-row">
                <button onClick={fetchGridData} className="mva-action-btn refresh">
                    <span style={{ fontSize: '16px' }}>↻</span> Refresh
                </button>
            </div>

            {/* Stat Cards */}
            <div className="mva-stats-grid">
                <div className="mva-stat-card purple">
                    <div className="mva-stat-icon">📅</div>
                    <div className="mva-stat-value">{stats.overallRate}%</div>
                    <div className="mva-stat-title">Today's Attendance</div>
                    <div className="mva-stat-subtitle">Average presense</div>
                </div>
                <div className="mva-stat-card green">
                    <div className="mva-stat-icon">📊</div>
                    <div className="mva-stat-value">{stats.overallRate}%</div>
                    <div className="mva-stat-title">This Month Average</div>
                    <div className="mva-stat-subtitle">Overall Attendance</div>
                </div>
                <div className="mva-stat-card orange">
                    <div className="mva-stat-icon">⚠️</div>
                    <div className="mva-stat-value">{stats.lateArrivals}</div>
                    <div className="mva-stat-title">Late Arrivals</div>
                    <div className="mva-stat-subtitle">Students late</div>
                </div>
                <div className="mva-stat-card blue">
                    <div className="mva-stat-icon">👥</div>
                    <div className="mva-stat-value">{stats.totalStudents}</div>
                    <div className="mva-stat-title">Total Students</div>
                    <div className="mva-stat-subtitle">Across this class</div>
                </div>
            </div>

            {/* Filters */}
            <div className="mva-filters-card">
                <div className="mva-filters-row">
                    <div className="mva-filter-group">
                        <label>Class</label>
                        <select
                            className="mva-select"
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                        >
                            <option value="">All Classes</option>
                            {classes.map((cls) => (
                                <option key={cls.id} value={cls.id}>
                                    {cls.name} {cls.section ? `(${cls.section})` : ""}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="mva-filter-group">
                        <label>Subject</label>
                        <select
                            className="mva-select"
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                            disabled={!selectedClass}
                        >
                            <option value="">All Subjects</option>
                            {subjects.map((sub) => (
                                <option key={sub.id} value={sub.id}>
                                    {sub.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="mva-filter-group" style={{ marginBottom: '12px' }}>
                    <label>Month</label>
                    <input
                        type="month"
                        className="mva-input"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                    />
                </div>
                <button onClick={fetchGridData} className="mva-apply-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                    </svg>
                    Apply Filters
                </button>
            </div>

            {/* Legend & Month Info */}
            <div className="mva-legend-card">
                <div className="mva-legend-title">Legend:</div>
                <div className="mva-legend-items">
                    <div className="mva-legend-item"><span className="mva-legend-badge present">✓</span> Present</div>
                    <div className="mva-legend-item"><span className="mva-legend-badge absent">A</span> Absent</div>
                    <div className="mva-legend-item"><span className="mva-legend-badge late">L</span> Late</div>
                    <div className="mva-legend-item"><span className="mva-legend-badge holiday">H</span> Holiday</div>
                    <div className="mva-legend-item"><span className="mva-legend-badge notmarked">-</span> Not Marked</div>
                </div>
                <div className="mva-month-badge">
                    📅 Month: {monthName} • Total Days: {daysArray.length}
                </div>
            </div>

            {/* Grid */}
            <div className="mva-grid-card">
                <div className="mva-grid-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span>Monthly Attendance Grid</span>
                </div>
                
                <div style={{ position: 'relative', marginBottom: '16px' }}>
                    <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '14px' }}>🔍</div>
                    <input 
                        type="text" 
                        placeholder="Search by name, roll no, or email..." 
                        value={searchQuery || ''}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ 
                            width: '100%', 
                            padding: '8px 12px 8px 32px', 
                            borderRadius: '10px', 
                            border: '1px solid #e2e8f0', 
                            fontSize: '12px', 
                            outline: 'none',
                            backgroundColor: '#f8fafc'
                        }}
                    />
                </div>

                {loading ? (
                    <div className="mva-empty-state">
                        Loading grid data...
                    </div>
                ) : gridData.length === 0 && !searchQuery ? (
                    <div className="mva-empty-state">
                        <div className="mva-empty-icon">👇</div>
                        <h3 style={{ margin: "0 0 4px 0", color: "#334155", fontSize: "14px" }}>Ready to View Attendance</h3>
                        <p style={{ margin: 0, fontSize: "11px" }}>Please apply filters to view.</p>
                    </div>
                ) : currentStudents.length === 0 ? (
                    <div className="mva-empty-state">
                        <div className="mva-empty-icon">🔍</div>
                        <h3 style={{ margin: "0 0 4px 0", color: "#334155", fontSize: "14px" }}>No matches found</h3>
                        <p style={{ margin: 0, fontSize: "11px" }}>No student matches "{searchQuery}".</p>
                    </div>
                ) : (
                    <div 
                        className="mva-table-wrapper"
                        onTouchStart={(e) => e.stopPropagation()}
                        onTouchMove={(e) => e.stopPropagation()}
                        onTouchEnd={(e) => e.stopPropagation()}
                    >
                        <table className="mva-table">
                            <thead>
                                <tr>
                                    <th className="sticky-col">
                                        <div style={{ color: '#64748b', fontSize: '9px', textTransform: 'uppercase', marginBottom: '2px' }}>Roll No.</div>
                                        <div style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase' }}>Student Name</div>
                                    </th>
                                    {daysArray.map(day => {
                                        const dateObj = new Date(parseInt(y), parseInt(m) - 1, day);
                                        const dayOfWeek = dateObj.toLocaleDateString("en-US", { weekday: "short" });
                                        const isWeekend = dateObj.getDay() === 0;
                                        return (
                                            <th key={day} style={{ color: isWeekend ? '#ef4444' : '#64748b' }}>
                                                <div style={{ fontSize: '9px', textTransform: 'uppercase', marginBottom: '2px' }}>{dayOfWeek}</div>
                                                <div>{day}</div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {currentStudents.map(student => (
                                    <tr key={student.student_id}>
                                        <td className="sticky-col">
                                            <div className="mva-student-info">
                                                <div className="mva-student-avatar" style={{ backgroundColor: getColorForInitials(student.name) + '20', color: getColorForInitials(student.name) }}>
                                                    {getInitials(student.name)}
                                                </div>
                                                <div className="mva-student-details">
                                                    <span>{student.roll_number || `Class${selectedClass}-${String(student.student_id).padStart(3, '0')}`}</span>
                                                    <strong>{student.name}</strong>
                                                </div>
                                            </div>
                                        </td>
                                        {daysArray.map(day => {
                                            const dayString = String(day).padStart(2, '0');
                                            const fullDateStr = `${y}-${m}-${dayString}`;
                                            return (
                                                <td key={fullDateStr}>
                                                    {getStatusIcon(student.daily[fullDateStr])}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {gridData.length > 0 && (
                    <div className="mva-pagination">
                        <div>Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, gridData.length)} of {gridData.length} students</div>
                        <div className="mva-pagination-controls">
                            <button 
                                className="mva-page-btn" 
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => prev - 1)}
                            >
                                Prev
                            </button>
                            {[...Array(totalPages)].map((_, i) => {
                                const page = i + 1;
                                if (totalPages > 5 && page !== 1 && page !== totalPages && Math.abs(page - currentPage) > 1) {
                                    if (page === 2 || page === totalPages - 1) return <span key={page} style={{ color: "#94a3b8", padding: "4px" }}>...</span>;
                                    return null;
                                }
                                return (
                                    <button 
                                        key={page}
                                        className={`mva-page-btn ${currentPage === page ? 'active' : ''}`}
                                        onClick={() => setCurrentPage(page)}
                                    >
                                        {page}
                                    </button>
                                );
                            })}
                            <button 
                                className="mva-page-btn"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(prev => prev + 1)}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
                
                <div style={{ color: '#64748b', fontSize: '10px', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>ℹ️</span> Note: Click on any status cell to edit attendance
                </div>
            </div>
        </div>
    );
};

export default MobileViewAttendance;
