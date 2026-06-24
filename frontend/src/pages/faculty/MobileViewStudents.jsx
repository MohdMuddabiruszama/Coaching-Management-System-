import { useState, useEffect } from "react";
import api from "../../services/api";
import "./MobileViewStudents.css";

function MobileViewStudents() {
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

    if (loading) return <div className="mvs-container" style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>Loading students...</div>;

    return (
        <div className="mvs-container">
            {/* Hero Banner */}
            <div className="mvs-hero-banner">
                <div className="mvs-hero-left">
                    <div className="mvs-hero-icon-wrapper">
                        <span className="mvs-hero-icon">👨‍🎓</span>
                    </div>
                    <div className="mvs-hero-text">
                        <h2>View Students</h2>
                        <p>Browse and manage student information across all classes.</p>
                    </div>
                </div>
                <div className="mvs-hero-right">
                    <div className="mvs-hero-graphic">
                        <span>📚</span>
                        <span>🍎</span>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="mvs-stats-grid">
                <div className="mvs-stat-card">
                    <div className="mvs-stat-icon-wrap mvs-icon-purple">
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                    </div>
                    <div className="mvs-stat-number">{totalStudents}</div>
                    <div className="mvs-stat-label">Total Students</div>
                    <div className="mvs-stat-sub">Across all classes</div>
                </div>
                <div className="mvs-stat-card">
                    <div className="mvs-stat-icon-wrap mvs-icon-green">
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </div>
                    <div className="mvs-stat-number">{activeStudents}</div>
                    <div className="mvs-stat-label">Active Students</div>
                    <div className="mvs-stat-sub">Currently enrolled</div>
                </div>
                <div className="mvs-stat-card">
                    <div className="mvs-stat-icon-wrap mvs-icon-orange">
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                    </div>
                    <div className="mvs-stat-number">{subjectsCount}</div>
                    <div className="mvs-stat-label">Subjects</div>
                    <div className="mvs-stat-sub">Taught by you</div>
                </div>
                <div className="mvs-stat-card">
                    <div className="mvs-stat-icon-wrap mvs-icon-blue">
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                    </div>
                    <div className="mvs-stat-number">{verifiedEmails}</div>
                    <div className="mvs-stat-label">Verified Emails</div>
                    <div className="mvs-stat-sub">Students with email</div>
                </div>
            </div>

            {/* Filter Section */}
            <div className="mvs-filters-section">
                <div className="mvs-search-row">
                    <div className="mvs-search-box">
                        <svg className="mvs-search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        <input
                            type="text"
                            placeholder="Search by name, email, or roll number..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <button className="mvs-filter-btn" onClick={() => {/* Optional extra filters */}}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
                        </svg>
                    </button>
                </div>
                <div className="mvs-dropdowns-row">
                    <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                        <option value="">All Classes</option>
                        {uniqueClasses.map((cls, idx) => (
                            <option key={idx} value={cls}>{cls}</option>
                        ))}
                    </select>
                    <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
                        <option value="">All Subjects</option>
                        {uniqueSubjects.map((sub, idx) => (
                            <option key={idx} value={sub}>{sub}</option>
                        ))}
                    </select>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>
            </div>

            {/* List Header */}
            <div className="mvs-list-header">
                <h3>All Students ({filteredStudents.length})</h3>
            </div>

            {/* Student List */}
            <div className="mvs-student-list">
                {currentStudents.length === 0 ? (
                    <div className="mvs-empty-state">No students found matching your criteria.</div>
                ) : (
                    currentStudents.map(student => {
                        const classStr = student.Classes && student.Classes.length > 0 
                            ? `${student.Classes[0].name}${student.Classes[0].section ? ` - Section ${student.Classes[0].section}` : ""}`
                            : "Unassigned";
                        const classCode = student.Classes && student.Classes.length > 0 
                            ? `Class${student.Classes[0].name.replace(/\s+/g,'')}-${student.roll_number || 'N/A'}`
                            : `Roll: ${student.roll_number || 'N/A'}`;
                        const subjectStr = student.Subjects && student.Subjects.length > 0 
                            ? student.Subjects.map(sub => sub.name).join(", ")
                            : "No Subjects";
                        
                        return (
                            <div key={student.id} className="mvs-student-card">
                                <div className="mvs-sc-avatar" style={{ backgroundColor: getAvatarColor(student.User?.name) }}>
                                    {getInitials(student.User?.name)}
                                </div>
                                <div className="mvs-sc-info-grid">
                                    <div className="mvs-sc-col-1">
                                        <div className="mvs-sc-name">{student.User?.name}</div>
                                        <div className="mvs-sc-phone">{student.User?.phone || "No Phone"}</div>
                                    </div>
                                    <div className="mvs-sc-col-2">
                                        <div className="mvs-sc-classcode">{classCode}</div>
                                        <div className="mvs-sc-classstr">{classStr}</div>
                                        <div className="mvs-sc-subject">{subjectStr}</div>
                                    </div>
                                    <div className="mvs-sc-col-3">
                                        <div className="mvs-sc-email">{student.User?.email || "No Email"}</div>
                                        <div className={`mvs-sc-badge ${student.User?.status === 'active' ? 'active' : 'inactive'}`}>
                                            {student.User?.status === 'active' ? 'Active' : 'Inactive'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Pagination Controls */}
            {filteredStudents.length > 0 && (
                <div className="mvs-pagination">
                    <div className="mvs-pagination-text">
                        Showing {(currentPage - 1) * recordsPerPage + 1} to {Math.min(currentPage * recordsPerPage, filteredStudents.length)} of {filteredStudents.length} students
                    </div>
                    <div className="mvs-pagination-buttons">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}>&lt;</button>
                        {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                            // Simple logic: show first 3 pages, then ... then last if possible. For simplicity, just show up to 3 or active logic
                            let p = i + 1;
                            if (currentPage > 2 && totalPages > 3) {
                                p = currentPage - 1 + i;
                            }
                            if (p > totalPages) return null;
                            return (
                                <button key={p} className={currentPage === p ? 'active' : ''} onClick={() => setCurrentPage(p)}>{p}</button>
                            );
                        })}
                        {totalPages > 3 && currentPage < totalPages - 1 && <span className="mvs-dots">...</span>}
                        {totalPages > 3 && currentPage < totalPages - 1 && <button onClick={() => setCurrentPage(totalPages)}>{totalPages}</button>}
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}>&gt;</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MobileViewStudents;
