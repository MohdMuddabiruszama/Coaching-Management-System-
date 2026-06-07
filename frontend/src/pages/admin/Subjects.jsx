/**
 * Subjects Management Page
 * Complete CRUD for subject management with faculty and class assignment
 */

import React, { useState, useEffect, useContext, useMemo } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import * as XLSX from "xlsx";
import ThemeSelector from "../../components/ThemeSelector";
import "./Dashboard.css";

function Subjects() {
    const { user } = useContext(AuthContext);
    const [subjects, setSubjects] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [classes, setClasses] = useState([]);
    const [faculty, setFaculty] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [search, setSearch] = useState("");
    const [classFilter, setClassFilter] = useState("all");
    const [facultyFilter, setFacultyFilter] = useState("all");
    const [sortBy, setSortBy] = useState("name_asc");
    const [viewMode, setViewMode] = useState("list");
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [formData, setFormData] = useState({
        name: "",
        class_id: "",
        faculty_id: "",
        code: "",
    });

    useEffect(() => {
        fetchSubjects();
        fetchClasses();
        fetchFaculty();
    }, []);

    const hasPerm = (op) => {
        if (user?.role === 'admin' || user?.role === 'super_admin') return true;
        if (user?.role === 'manager' && user?.permissions) {
            return user.permissions.includes('subjects') || user.permissions.includes(`subjects.${op}`);
        }
        return false;
    };
    const canCreate = hasPerm('create');
    const canUpdate = hasPerm('update');
    const canDelete = hasPerm('delete');

    const fetchSubjects = async () => {
        try {
            const response = await api.get(`/subjects?limit=100&t=${new Date().getTime()}`);
            setSubjects(response.data.data || []);
            setTotalCount(response.data.count || response.data.data?.length || 0);
        } catch (error) {
            console.error("Error fetching subjects:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchClasses = async () => {
        try {
            const response = await api.get("/classes?limit=100");
            setClasses(response.data.data || []);
        } catch (error) {
            console.error("Error fetching classes:", error);
        }
    };

    const fetchFaculty = async () => {
        try {
            const response = await api.get("/faculty?limit=100");
            setFaculty(response.data.data || []);
        } catch (error) {
            console.error("Error fetching faculty:", error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editMode) {
                await api.put(`/subjects/${formData.id}`, formData);
                alert("Subject updated successfully");
            } else {
                const subjectNames = formData.name.split(',').map(name => name.trim()).filter(Boolean);

                if (subjectNames.length === 0) {
                    return alert("Please enter at least one valid subject name");
                }

                // Create dynamically for multiple subjects
                await Promise.all(
                    subjectNames.map(async (name) => {
                        return api.post("/subjects", {
                            ...formData,
                            name: name,
                            institute_id: user.institute_id,
                        });
                    })
                );
                alert(`${subjectNames.length} Subject(s) created successfully`);
            }
            setShowModal(false);
            resetForm();
            fetchSubjects();
        } catch (error) {
            alert("Error: " + error.response?.data?.message);
        }
    };

    const handleEdit = (subject) => {
        setFormData({
            id: subject.id,
            name: subject.name,
            code: subject.code || "",
            class_id: subject.class_id || "",
            faculty_id: subject.faculty_id || "",
        });
        setEditMode(true);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this subject?")) return;

        try {
            await api.delete(`/subjects/${id}`);
            alert("Subject deleted successfully");
            fetchSubjects();
        } catch (error) {
            alert("Error deleting subject: " + error.response?.data?.message);
        }
    };

    const resetForm = () => {
        setFormData({
            name: "",
            class_id: "",
            faculty_id: "",
            code: "",
        });
        setEditMode(false);
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const filteredAndSortedSubjects = (() => {
        let result = subjects.filter((s) => {
            const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
            const matchesClass = classFilter === "all" || s.class_id === parseInt(classFilter);
            const matchesFaculty = facultyFilter === "all" || (s.faculty_id ? s.faculty_id === parseInt(facultyFilter) : facultyFilter === "unassigned" && !s.faculty_id);
            return matchesSearch && matchesClass && matchesFaculty;
        });

        if (sortBy === "name_asc") {
            result.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortBy === "name_desc") {
            result.sort((a, b) => b.name.localeCompare(a.name));
        } else if (sortBy === "newest") {
            result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        return result;
    })();

    // Reset pagination on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [search, classFilter, facultyFilter, sortBy]);

    const handleExport = () => {
        try {
            const dataToExport = filteredAndSortedSubjects.map(s => ({
                'Subject Name': s.name || 'N/A',
                'Subject Code': s.code || (s.name ? s.name.substring(0, 3).toUpperCase() + (s.id ? s.id.toString().padStart(3, '0') : '') : 'N/A'),
                'Class': s.Class ? `${s.Class.name} ${s.Class.section ? `(Section ${s.Class.section})` : ''}` : 'Not assigned',
                'Assigned Faculty': s.Faculty?.User?.name || 'Unassigned',
                'Created On': new Date(s.created_at).toLocaleDateString()
            }));
            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Subjects");
            XLSX.writeFile(wb, "Subjects_Export.xlsx");
        } catch (err) {
            console.error("Export error:", err);
            alert("Failed to export data.");
        }
    };

    const getInitials = (name) => {
        if (!name) return "?";
        const parts = name.split(" ");
        if (parts.length > 1) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const getColorForName = (name) => {
        const colors = [
            { bg: '#f3e8ff', text: '#9333ea' },
            { bg: '#dbeafe', text: '#2563eb' },
            { bg: '#dcfce7', text: '#16a34a' },
            { bg: '#ffedd5', text: '#ea580c' },
            { bg: '#fee2e2', text: '#dc2626' },
        ];
        if (!name) return colors[0];
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    if (loading) {
        return <div className="students-container">Loading...</div>;
    }

    return (
        <div className="students-container" style={{ backgroundColor: "#f8fafc", minHeight: "100vh" }}>
            
            {/* ── Header ── */}
            <div className="st-header">
                <div className="st-header-top-row">
                    <div className="st-header-left">
                        <h1>Subjects Management</h1>
                        <p>Manage subjects and assign faculty to classes</p>
                    </div>
                </div>
                <div className="st-header-bottom-row">
                    <div className="st-breadcrumbs">
                        <span>Dashboard</span>
                        <span>›</span>
                        <span className="active">Subjects Management</span>
                    </div>
                    <div className="st-header-actions">
                        <button className="st-btn st-btn-outline" style={{ display: "flex", alignItems: "center", gap: "8px" }} onClick={handleExport}>
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            Export
                        </button>
                        {canCreate && (
                            <button 
                                onClick={() => { resetForm(); setShowModal(true); }}
                                className="st-btn st-btn-primary" 
                                style={{ backgroundColor: "#6366f1", border: "none", display: "flex", alignItems: "center", gap: "8px" }}
                            >
                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Add Subject
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Statistics Grid ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
                {/* Stat 1: Total Subjects */}
                <div style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #f1f5f9", position: "relative", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "1rem" }}>
                        <div style={{ width: "48px", height: "48px", borderRadius: "12px", backgroundColor: "#f3e8ff", color: "#9333ea", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/></svg>
                        </div>
                        <div>
                            <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#0f172a", lineHeight: "1" }}>{totalCount}</div>
                            <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "4px" }}>Total Subjects</div>
                        </div>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>Across all classes</span>
                        <svg width="60" height="20" viewBox="0 0 60 20" fill="none" stroke="#9333ea" strokeWidth="1.5"><path d="M0 15 Q 10 5, 20 10 T 40 8 T 60 5" fill="none"/></svg>
                    </div>
                </div>

                {/* Stat 2: Assigned to Faculty */}
                <div style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #f1f5f9", position: "relative", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "1rem" }}>
                        <div style={{ width: "48px", height: "48px", borderRadius: "12px", backgroundColor: "#dcfce7", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                        </div>
                        <div>
                            <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#0f172a", lineHeight: "1" }}>{subjects.filter((s) => s.faculty_id).length}</div>
                            <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "4px" }}>Assigned to Faculty</div>
                        </div>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "space-between", fontWeight: "500" }}>
                        <span>{subjects.length > 0 ? Math.round((subjects.filter(s => s.faculty_id).length / subjects.length) * 100) : 0}% Assigned</span>
                        <svg width="60" height="20" viewBox="0 0 60 20" fill="none" stroke="#10b981" strokeWidth="1.5"><path d="M0 15 Q 15 15, 25 10 T 45 5 T 60 2" fill="none"/></svg>
                    </div>
                </div>

                {/* Stat 3: Total Classes */}
                <div style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #f1f5f9", position: "relative", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "1rem" }}>
                        <div style={{ width: "48px", height: "48px", borderRadius: "12px", backgroundColor: "#e0f2fe", color: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9z"/></svg>
                        </div>
                        <div>
                            <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#0f172a", lineHeight: "1" }}>{classes.length}</div>
                            <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "4px" }}>Total Classes</div>
                        </div>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>Classes using subjects</span>
                        <svg width="60" height="20" viewBox="0 0 60 20" fill="none" stroke="#0284c7" strokeWidth="1.5"><path d="M0 10 Q 15 15, 30 8 T 45 12 T 60 5" fill="none"/></svg>
                    </div>
                </div>

                {/* Stat 4: Total Faculty */}
                <div style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #f1f5f9", position: "relative", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "1rem" }}>
                        <div style={{ width: "48px", height: "48px", borderRadius: "12px", backgroundColor: "#ffedd5", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                        </div>
                        <div>
                            <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#0f172a", lineHeight: "1" }}>{faculty.length}</div>
                            <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "4px" }}>Total Faculty</div>
                        </div>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>Teaching subjects</span>
                        <svg width="60" height="20" viewBox="0 0 60 20" fill="none" stroke="#ea580c" strokeWidth="1.5"><path d="M0 8 Q 10 12, 20 5 T 40 10 T 60 3" fill="none"/></svg>
                    </div>
                </div>
            </div>

            {/* ── Filters Row ── */}
            <div style={{ backgroundColor: "#fff", padding: "1rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #f1f5f9", marginBottom: "1.5rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ flex: "1", minWidth: "250px", position: "relative" }}>
                    <svg width="16" height="16" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search by subject name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ width: "100%", padding: "0.6rem 1rem 0.6rem 2.2rem", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none", fontSize: "0.9rem" }}
                    />
                </div>
                
                <select 
                    value={classFilter} 
                    onChange={(e) => setClassFilter(e.target.value)}
                    style={{ padding: "0.6rem 2rem 0.6rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none", fontSize: "0.9rem", color: "#334155", minWidth: "180px", appearance: "none", backgroundImage: "url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')", backgroundRepeat: "no-repeat", backgroundPosition: "right 0.75rem center" }}
                >
                    <option value="all">All Classes</option>
                    {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name} {c.section && `- ${c.section}`}
                        </option>
                    ))}
                </select>

                <select 
                    value={facultyFilter} 
                    onChange={(e) => setFacultyFilter(e.target.value)}
                    style={{ padding: "0.6rem 2rem 0.6rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none", fontSize: "0.9rem", color: "#334155", minWidth: "180px", appearance: "none", backgroundImage: "url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')", backgroundRepeat: "no-repeat", backgroundPosition: "right 0.75rem center" }}
                >
                    <option value="all">All Faculty</option>
                    <option value="unassigned">Unassigned</option>
                    {faculty.map((f) => (
                        <option key={f.id} value={f.id}>
                            {f.User?.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* ── Table/Grid Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', color: '#0f172a', fontWeight: '600', margin: 0 }}>All Subjects ({filteredAndSortedSubjects.length})</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Sort by:</span>
                        <select 
                            value={sortBy} 
                            onChange={(e) => setSortBy(e.target.value)}
                            style={{ padding: '0.4rem 2rem 0.4rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.85rem', color: '#334155', backgroundColor: '#fff', appearance: 'none', backgroundImage: "url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center' }}
                        >
                            <option value="name_asc">Subject Name (A-Z)</option>
                            <option value="name_desc">Subject Name (Z-A)</option>
                            <option value="newest">Newest First</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: '0.2rem', background: '#f1f5f9', padding: '0.2rem', borderRadius: '8px' }}>
                        <button 
                            className="st-btn" 
                            style={{ background: viewMode === 'list' ? '#fff' : 'transparent', color: viewMode === 'list' ? '#8b5cf6' : '#64748b', padding: '0.4rem 0.6rem', boxShadow: viewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => setViewMode('list')}
                        >
                            ≡
                        </button>
                        <button 
                            className="st-btn" 
                            style={{ background: viewMode === 'grid' ? '#fff' : 'transparent', color: viewMode === 'grid' ? '#8b5cf6' : '#64748b', padding: '0.4rem 0.6rem', boxShadow: viewMode === 'grid' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => setViewMode('grid')}
                        >
                            ⊞
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Content Area (Table or Grid) ── */}
            {viewMode === "list" ? (
                <div style={{ overflowX: "auto", backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #f1f5f9", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                        <thead>
                            <tr style={{ backgroundColor: "#f8fafc", color: "#64748b", fontSize: "0.75rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                                <th style={{ padding: "1rem 1.5rem", fontWeight: "600", width: "5%" }}>#</th>
                                <th style={{ padding: "1rem", fontWeight: "600", width: "20%" }}>Subject Name</th>
                                <th style={{ padding: "1rem", fontWeight: "600", width: "15%" }}>Students</th>
                                <th style={{ padding: "1rem", fontWeight: "600", width: "15%" }}>Class</th>
                                <th style={{ padding: "1rem", fontWeight: "600", width: "20%" }}>Assigned Faculty</th>
                                <th style={{ padding: "1rem", fontWeight: "600", width: "15%" }}>Created On</th>
                                <th style={{ padding: "1rem 1.5rem", fontWeight: "600", width: "10%", textAlign: "center" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAndSortedSubjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>
                                        No subjects found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredAndSortedSubjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((subject, idx) => {
                                    const sColors = getColorForName(subject.name);
                                    const fColors = getColorForName(subject.Faculty?.User?.name);
                                    const createdDate = new Date(subject.created_at);
                                    
                                    return (
                                        <tr key={subject.id} style={{ borderTop: "1px solid #f1f5f9", transition: "background 0.2s" }} className="table-row-hover">
                                            <td style={{ padding: "1rem 1.5rem", color: "#0f172a", fontWeight: "600", fontSize: "0.9rem" }}>
                                                {(currentPage - 1) * itemsPerPage + idx + 1}
                                            </td>
                                            <td style={{ padding: "1rem" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                    <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: sColors.bg, color: sColors.text, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "0.9rem" }}>
                                                        <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/></svg>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: "600", color: "#0f172a", fontSize: "0.95rem" }}>{subject.name}</div>
                                                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px" }}>
                                                            {subject.code || subject.name.substring(0, 3).toUpperCase() + (subject.id ? subject.id.toString().padStart(3, '0') : '')}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: "1rem" }}>
                                                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "#f0fdf4", color: "#16a34a", padding: "4px 10px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: "600" }}>
                                                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                                    {subject.enrolled_students_count || 0}
                                                </div>
                                            </td>
                                            <td style={{ padding: "1rem" }}>
                                                {subject.Class ? (
                                                    <div>
                                                        <div style={{ color: "#0f172a", fontWeight: "600", fontSize: "0.9rem" }}>{subject.Class.name}</div>
                                                        {subject.Class.section && (
                                                            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                                                                {subject.Class.section.toLowerCase().includes('section') ? subject.Class.section : `Section ${subject.Class.section}`}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>-</span>
                                                )}
                                            </td>
                                            <td style={{ padding: "1rem" }}>
                                                {subject.Faculty?.User?.name ? (
                                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                        <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: fColors.bg, color: fColors.text, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "600", fontSize: "0.85rem" }}>
                                                            {getInitials(subject.Faculty.User.name)}
                                                        </div>
                                                        <div>
                                                            <div style={{ color: "#0f172a", fontWeight: "600", fontSize: "0.9rem" }}>{subject.Faculty.User.name}</div>
                                                            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{subject.name}</div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span style={{ color: "#f59e0b", backgroundColor: "#fef3c7", padding: "4px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "600" }}>Unassigned</span>
                                                )}
                                            </td>
                                            <td style={{ padding: "1rem" }}>
                                                <div style={{ fontSize: "0.85rem", color: "#0f172a", fontWeight: "500" }}>
                                                    {createdDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </div>
                                                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                                                    {createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </td>
                                            <td style={{ padding: "1rem 1.5rem", textAlign: "center" }}>
                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}>
                                                    {canUpdate && (
                                                        <button 
                                                            onClick={() => handleEdit(subject)}
                                                            style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1px solid #e2e8f0", backgroundColor: "#fff", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s" }}
                                                            title="Edit"
                                                            className="hover-bg-gray"
                                                        >
                                                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                        </button>
                                                    )}
                                                    {canDelete && (
                                                        <button 
                                                            onClick={() => handleDelete(subject.id)}
                                                            style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1px solid #e2e8f0", backgroundColor: "#fff", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s" }}
                                                            title="Delete"
                                                            className="hover-bg-red"
                                                        >
                                                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.5rem" }}>
                    {filteredAndSortedSubjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((subject) => {
                        const sColors = getColorForName(subject.name);
                        const fColors = getColorForName(subject.Faculty?.User?.name);
                        return (
                            <div key={subject.id} style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                        <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: sColors.bg, color: sColors.text, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "1rem" }}>
                                            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/></svg>
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: "600", color: "#0f172a", fontSize: "1.05rem" }}>{subject.name}</div>
                                            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                                                {subject.code || subject.name.substring(0, 3).toUpperCase() + (subject.id ? subject.id.toString().padStart(3, '0') : '')}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", gap: "5px" }}>
                                        {canUpdate && (
                                            <button onClick={() => handleEdit(subject)} style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", padding: "4px" }} className="hover-text-primary">
                                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                            </button>
                                        )}
                                        {canDelete && (
                                            <button onClick={() => handleDelete(subject.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: "4px" }}>
                                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                                
                                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "1rem", marginTop: "1rem" }}>
                                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "8px" }}>Enrolled Students</div>
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "#f0fdf4", color: "#16a34a", padding: "4px 10px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: "600" }}>
                                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                        {subject.enrolled_students_count || 0}
                                    </div>
                                </div>
                                
                                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "1rem", marginTop: "1rem" }}>
                                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "8px" }}>Assigned Class</div>
                                    {subject.Class ? (
                                        <div>
                                            <div style={{ color: "#0f172a", fontWeight: "600", fontSize: "0.9rem" }}>{subject.Class.name}</div>
                                            {subject.Class.section && (
                                                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                                                    {subject.Class.section.toLowerCase().includes('section') ? subject.Class.section : `Section ${subject.Class.section}`}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>-</span>
                                    )}
                                </div>

                                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "1rem", marginTop: "1rem" }}>
                                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "8px" }}>Assigned Faculty</div>
                                    {subject.Faculty?.User?.name ? (
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                            <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: fColors.bg, color: fColors.text, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "600", fontSize: "0.85rem" }}>
                                                {getInitials(subject.Faculty.User.name)}
                                            </div>
                                            <div style={{ color: "#0f172a", fontWeight: "600", fontSize: "0.9rem" }}>{subject.Faculty.User.name}</div>
                                        </div>
                                    ) : (
                                        <span style={{ color: "#f59e0b", backgroundColor: "#fef3c7", padding: "4px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "600", display: "inline-block" }}>Unassigned</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination Controls */}
            {filteredAndSortedSubjects.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 0", marginTop: "1rem" }}>
                    <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedSubjects.length)} of {filteredAndSortedSubjects.length} subjects
                    </div>
                    <div style={{ display: "flex", gap: "5px" }}>
                        <button 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid #e2e8f0", backgroundColor: "#fff", color: currentPage === 1 ? "#cbd5e1" : "#64748b", cursor: currentPage === 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        {Array.from({ length: Math.ceil(filteredAndSortedSubjects.length / itemsPerPage) }, (_, i) => i + 1).map(page => (
                            <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                style={{ width: "34px", height: "34px", borderRadius: "8px", border: currentPage === page ? "none" : "1px solid #e2e8f0", backgroundColor: currentPage === page ? "#6366f1" : "#fff", color: currentPage === page ? "#fff" : "#64748b", fontSize: "0.85rem", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                                {page}
                            </button>
                        ))}
                        <button 
                            onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredAndSortedSubjects.length / itemsPerPage), p + 1))}
                            disabled={currentPage === Math.ceil(filteredAndSortedSubjects.length / itemsPerPage)}
                            style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid #e2e8f0", backgroundColor: "#fff", color: currentPage === Math.ceil(filteredAndSortedSubjects.length / itemsPerPage) ? "#cbd5e1" : "#64748b", cursor: currentPage === Math.ceil(filteredAndSortedSubjects.length / itemsPerPage) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Add/Edit Subject Modal */}
            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setShowModal(false)}>
                    <div style={{ backgroundColor: '#fff', borderRadius: '16px', width: '100%', maxWidth: '550px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#f3e8ff', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /><path d="M8 7h6" /><path d="M8 11h8" /></svg>
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: '600' }}>
                                        {editMode ? "Edit Subject" : "Add New Subject"}
                                    </h3>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                                        Create a new subject and assign it to a class and faculty
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowModal(false)}
                                style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                className="hover-bg-gray"
                            >
                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        
                        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                
                                {/* Subject Name */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#334155', marginBottom: '0.5rem' }}>
                                        Subject Name <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            name="name"
                                            placeholder="e.g. Mathematics, Physics, English"
                                            value={formData.name}
                                            onChange={handleChange}
                                            required
                                            style={{ width: '100%', padding: '0.75rem 2.5rem 0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem', color: '#0f172a' }}
                                            className="focus-ring"
                                        />
                                        <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>
                                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>
                                        </div>
                                    </div>
                                    <small style={{ display: 'block', marginTop: '0.4rem', color: '#64748b', fontSize: '0.75rem' }}>Enter a unique name for the subject</small>
                                </div>

                                {/* Subject Code */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#334155', marginBottom: '0.5rem' }}>
                                        Subject Code
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            name="code"
                                            placeholder="e.g. MATH101 (Optional)"
                                            value={formData.code}
                                            onChange={handleChange}
                                            style={{ width: '100%', padding: '0.75rem 2.5rem 0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem', color: '#0f172a' }}
                                            className="focus-ring"
                                        />
                                        <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>
                                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                        </div>
                                    </div>
                                    <small style={{ display: 'block', marginTop: '0.4rem', color: '#64748b', fontSize: '0.75rem' }}>Optional shorthand code for the subject</small>
                                </div>

                                {/* Assign to Class */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#334155', marginBottom: '0.5rem' }}>
                                        Assign to Class <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <select
                                            name="class_id"
                                            value={formData.class_id}
                                            onChange={handleChange}
                                            required
                                            style={{ width: '100%', padding: '0.75rem 2.5rem 0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem', color: '#0f172a', appearance: 'none', backgroundColor: '#fff' }}
                                            className="focus-ring"
                                        >
                                            <option value="">Select Class</option>
                                            {classes.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name} {c.section && `- ${c.section}`}
                                                </option>
                                            ))}
                                        </select>
                                        <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>
                                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                    <small style={{ display: 'block', marginTop: '0.4rem', color: '#64748b', fontSize: '0.75rem' }}>Choose the class for this subject</small>
                                </div>

                                {/* Assign Faculty */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#334155', marginBottom: '0.5rem' }}>
                                        Assign Faculty (Optional)
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <select
                                            name="faculty_id"
                                            value={formData.faculty_id}
                                            onChange={handleChange}
                                            style={{ width: '100%', padding: '0.75rem 2.5rem 0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem', color: '#0f172a', appearance: 'none', backgroundColor: '#fff' }}
                                            className="focus-ring"
                                        >
                                            <option value="">Select Faculty</option>
                                            {faculty.map((f) => (
                                                <option key={f.id} value={f.id}>
                                                    {f.User?.name} {f.designation && `(${f.designation})`}
                                                </option>
                                            ))}
                                        </select>
                                        <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none', display: 'flex', gap: '4px' }}>
                                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                        </div>
                                    </div>
                                    <small style={{ display: 'block', marginTop: '0.4rem', color: '#64748b', fontSize: '0.75rem' }}>Assign a faculty member to teach this subject</small>
                                </div>

                                {/* Footer Buttons */}
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowModal(false)}
                                        className="st-btn"
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#fff', border: '1px solid #e2e8f0', color: '#0f172a', padding: '0.6rem 1.5rem' }}
                                    >
                                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="st-btn"
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: "#4f46e5", color: "#fff", border: "none", padding: '0.6rem 1.5rem' }}
                                    >
                                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                        {editMode ? "Update Subject" : "Create Subject"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Subjects;
