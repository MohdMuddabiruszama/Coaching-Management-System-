import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import api from "../../services/api";
import MobileViewStudents from "./MobileViewStudents";
import "./ViewStudents.css";

function ViewStudents() {
    if (Capacitor.isNativePlatform()) {
        return <MobileViewStudents />;
    }

    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [classFilter, setClassFilter] = useState("");
    const [subjectFilter, setSubjectFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const recordsPerPage = 10;

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        try {
            const response = await api.get("/students?limit=1000");
            setStudents(response.data.data || []);
            setLoading(false);
        } catch (error) {
            console.error("Error fetching students:", error);
            setLoading(false);
        }
    };

    // Calculate unique classes & subjects
    const uniqueClasses = Array.from(new Set(
        students.flatMap(s => s.Classes?.map(c => `${c.name}${c.section ? ` - ${c.section}` : ""}`) || [])
    )).sort();
    
    const uniqueSubjects = Array.from(new Set(
        students.flatMap(s => s.Subjects?.map(sub => sub.name) || [])
    )).sort();

    // Filter Logic
    const filteredStudents = students.filter((s) => {
        const searchStr = search.toLowerCase();
        const matchesSearch =
            (s.User?.name || "").toLowerCase().includes(searchStr) ||
            (s.User?.email || "").toLowerCase().includes(searchStr) ||
            (s.roll_number || "").toLowerCase().includes(searchStr);
            
        const classStrings = s.Classes?.map(c => `${c.name}${c.section ? ` - ${c.section}` : ""}`) || [];
        const matchesClass = classFilter === "" || classStrings.includes(classFilter);
        
        const subjectStrings = s.Subjects?.map(sub => sub.name) || [];
        const matchesSubject = subjectFilter === "" || subjectStrings.includes(subjectFilter);
        
        const matchesStatus = statusFilter === "" || s.User?.status === statusFilter;

        return matchesSearch && matchesClass && matchesSubject && matchesStatus;
    });

    const handleExport = () => {
        if (filteredStudents.length === 0) {
            alert("No data to export");
            return;
        }
        
        const headers = ["Roll No", "Name", "Email", "Phone", "Class", "Status"];
        const csvRows = [headers.join(",")];
        
        filteredStudents.forEach(s => {
            const row = [
                s.roll_number,
                `"${s.User?.name || ""}"`,
                `"${s.User?.email || ""}"`,
                `"${s.User?.phone || ""}"`,
                `"${s.Classes?.map(c => `${c.name}${c.section ? ` - ${c.section}` : ""}`).join(", ") || ""}"`,
                `"${s.Subjects?.map(sub => sub.name).join(", ") || ""}"`,
                s.User?.status || ""
            ];
            csvRows.push(row.join(","));
        });
        
        const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "students_export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Pagination Logic
    const totalPages = Math.ceil(filteredStudents.length / recordsPerPage);
    const currentStudents = filteredStudents.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage);

    // Reset page to 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [search, classFilter, subjectFilter, statusFilter]);

    // Compute Stats dynamically for O(1) API Calls
    const totalStudents = students.length;
    const activeStudents = students.filter(s => s.User?.status === 'active').length;
    const verifiedEmails = students.filter(s => s.User?.email).length;
    const subjectsCount = uniqueSubjects.length;

    // Helper for Avatar Initials
    const getInitials = (name) => {
        if (!name) return "S";
        const parts = name.split(" ");
        if (parts.length > 1) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    // Helper for Avatar Colors
    const getAvatarColor = (name) => {
        const colors = ['#6366f1', '#ec4899', '#0ea5e9', '#22c55e', '#f97316', '#a855f7'];
        if (!name) return colors[0];
        const charCode = name.charCodeAt(0);
        return colors[charCode % colors.length];
    };

    if (loading) return <div className="fvs-container" style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>Loading students...</div>;

    return (
        <div className="fvs-container">
            {/* Header */}
            <div className="fvs-header">
                <div className="fvs-title-area">
                    <div className="fvs-title-icon">👨‍🎓</div>
                    <div className="fvs-title-text">
                        <h1>View Students</h1>
                        <p>Browse and manage student information across all classes.</p>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="fvs-filters-card">
                <div className="fvs-search-box">
                    <span className="fvs-search-icon">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    </span>
                    <input
                        type="text"
                        className="fvs-search-input"
                        placeholder="Search by name, email, or roll number..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                
                <select
                    className="fvs-filter-select"
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                >
                    <option value="">All Classes</option>
                    {uniqueClasses.map((cls, idx) => (
                        <option key={idx} value={cls}>{cls}</option>
                    ))}
                </select>

                <select
                    className="fvs-filter-select"
                    value={subjectFilter}
                    onChange={(e) => setSubjectFilter(e.target.value)}
                >
                    <option value="">All Subjects</option>
                    {uniqueSubjects.map((sub, idx) => (
                        <option key={idx} value={sub}>{sub}</option>
                    ))}
                </select>

                <select
                    className="fvs-filter-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>

                <button className="fvs-search-btn">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    Search
                </button>
            </div>

            {/* Statistics Row */}
            <div className="fvs-stats-row">
                <div className="fvs-stat-card">
                    <div className="fvs-stat-icon fvs-icon-purple">
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                    </div>
                    <div className="fvs-stat-info">
                        <div className="fvs-stat-value">{totalStudents}</div>
                        <div className="fvs-stat-title">Total Students</div>
                        <div className="fvs-stat-desc">Across all classes</div>
                    </div>
                </div>
                <div className="fvs-stat-card">
                    <div className="fvs-stat-icon fvs-icon-green">
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </div>
                    <div className="fvs-stat-info">
                        <div className="fvs-stat-value">{activeStudents}</div>
                        <div className="fvs-stat-title">Active Students</div>
                        <div className="fvs-stat-desc">Currently enrolled</div>
                    </div>
                </div>
                <div className="fvs-stat-card">
                    <div className="fvs-stat-icon fvs-icon-orange">
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                    </div>
                    <div className="fvs-stat-info">
                        <div className="fvs-stat-value">{subjectsCount}</div>
                        <div className="fvs-stat-title">Subjects</div>
                        <div className="fvs-stat-desc">Taught by you</div>
                    </div>
                </div>
                <div className="fvs-stat-card">
                    <div className="fvs-stat-icon fvs-icon-blue">
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                    </div>
                    <div className="fvs-stat-info">
                        <div className="fvs-stat-value">{verifiedEmails}</div>
                        <div className="fvs-stat-title">Verified Emails</div>
                        <div className="fvs-stat-desc">Students with email</div>
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div className="fvs-table-card">
                <div className="fvs-table-header">
                    <h2>All Students ({filteredStudents.length})</h2>
                    <button className="fvs-export-btn" onClick={handleExport}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                        Export
                    </button>
                </div>
                
                <div className="fvs-table-container">
                    <table className="fvs-table">
                        <thead>
                            <tr>
                                <th>Student Details</th>
                                <th>Roll No.</th>
                                <th>Class & Subjects</th>
                                <th>Email</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentStudents.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                                        No students found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                currentStudents.map((student) => (
                                    <tr key={student.id}>
                                        <td>
                                            <div className="fvs-user-cell">
                                                <div 
                                                    className="fvs-avatar" 
                                                    style={{ backgroundColor: getAvatarColor(student.User?.name) }}
                                                >
                                                    {getInitials(student.User?.name)}
                                                </div>
                                                <div className="fvs-user-details">
                                                    <span className="fvs-user-name">{student.User?.name}</span>
                                                    <span className="fvs-user-phone">{student.User?.phone || "No Phone"}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <strong style={{color: '#475569'}}>{student.roll_number}</strong>
                                        </td>
                                        <td>
                                            <span style={{color: '#6366f1', fontWeight: 500}}>
                                                {student.Classes && student.Classes.length > 0 ? 
                                                    student.Classes.map(c => `${c.name}${c.section ? ` - ${c.section}` : ""}`).join(", ") 
                                                    : "Unassigned"}
                                            </span>
                                            {student.Subjects && student.Subjects.length > 0 && (
                                                <div style={{fontSize: '12px', color: '#64748b', marginTop: '4px'}}>
                                                    {student.Subjects.map(sub => sub.name).join(", ")}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            {student.User?.email}
                                        </td>
                                        <td>
                                            <span className={`fvs-status-badge ${student.User?.status === "active" ? "active" : "inactive"}`}>
                                                {student.User?.status || "Unknown"}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination Footer */}
                {filteredStudents.length > 0 && (
                    <div className="fvs-pagination-container">
                        <div className="fvs-pagination-info">
                            Showing {(currentPage - 1) * recordsPerPage + 1} to {Math.min(currentPage * recordsPerPage, filteredStudents.length)} of {filteredStudents.length} students
                        </div>
                        <div className="fvs-pagination-controls">
                            <button 
                                className="fvs-page-btn" 
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            >
                                &lt;
                            </button>
                            
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button 
                                    key={page}
                                    className={`fvs-page-btn ${currentPage === page ? 'active' : ''}`}
                                    onClick={() => setCurrentPage(page)}
                                >
                                    {page}
                                </button>
                            ))}

                            <button 
                                className="fvs-page-btn" 
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            >
                                &gt;
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ViewStudents;
