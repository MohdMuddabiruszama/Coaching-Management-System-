/**
 * Classes Management Page
 * Complete CRUD for class management
 */

import React, { useState, useEffect, useContext, useMemo } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import * as XLSX from "xlsx";
import "./Dashboard.css";
import "./Students.css";

function Classes() {
    const { user } = useContext(AuthContext);
    const [classes, setClasses] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [faculty, setFaculty] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    
    // Filters and Pagination State
    const [search, setSearch] = useState("");
    const [sectionFilter, setSectionFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all"); // UI Only for now
    const [sortBy, setSortBy] = useState("name_asc");
    const [currentPage, setCurrentPage] = useState(1);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [viewMode, setViewMode] = useState("list"); // "list" or "grid"
    const itemsPerPage = viewMode === "grid" ? 12 : 10;

    const [formData, setFormData] = useState({
        name: "",
        section: "",
        academic_year: "2026 - 2027",
        teacher_id: "",
    });

    useEffect(() => {
        fetchClasses();
        fetchFaculty();
    }, []);

    const hasPerm = (op) => {
        if (user?.role === 'admin' || user?.role === 'super_admin') return true;
        if (user?.role === 'manager' && user?.permissions) {
            return user.permissions.includes('classes') || user.permissions.includes(`classes.${op}`);
        }
        return false;
    };
    const canCreate = hasPerm('create');
    const canUpdate = hasPerm('update');
    const canDelete = hasPerm('delete');

    const fetchClasses = async () => {
        try {
            const response = await api.get(`/classes?limit=100&t=${new Date().getTime()}`);
            setClasses(response.data.data || []);
            setTotalCount(response.data.count || 0);
        } catch (error) {
            console.error("Error fetching classes:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchFaculty = async () => {
        try {
            const response = await api.get("/faculty");
            setFaculty(response.data.data || []);
        } catch (error) {
            console.error("Error fetching faculty:", error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editMode) {
                await api.put(`/classes/${formData.id}`, formData);
                alert("Class updated successfully");
            } else {
                await api.post("/classes", {
                    ...formData,
                    institute_id: user.institute_id,
                });
                alert("Class created successfully");
            }
            setShowModal(false);
            resetForm();
            fetchClasses();
        } catch (error) {
            alert("Error: " + error.response?.data?.message);
        }
    };

    const handleEdit = (classItem) => {
        setFormData({
            id: classItem.id,
            name: classItem.name,
            section: classItem.section || "",
            academic_year: classItem.academic_year || "2026 - 2027",
            teacher_id: classItem.teacher_id || "",
        });
        setEditMode(true);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this class? This will affect all students in this class.")) return;

        try {
            await api.delete(`/classes/${id}`);
            alert("Class deleted successfully");
            fetchClasses();
        } catch (error) {
            alert("Error deleting class: " + error.response?.data?.message);
        }
    };

    const resetForm = () => {
        setFormData({
            name: "",
            section: "",
            academic_year: "2026 - 2027",
            teacher_id: "",
        });
        setEditMode(false);
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleExport = () => {
        try {
            const dataToExport = filteredAndSortedClasses.map(c => ({
                'Class Name': c.name || 'N/A',
                'Section': c.section ? (c.section.toLowerCase().startsWith('section') ? c.section : `Section ${c.section}`) : 'N/A',
                'Students': c.Students?.length || 0,
                'Subjects': c.Subjects?.length || 0,
                'Status': c.status || 'Active',
                'Created On': new Date(c.created_at).toLocaleDateString()
            }));
            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Classes");
            XLSX.writeFile(wb, "Classes_Export.xlsx");
        } catch (err) {
            console.error("Export error:", err);
            alert("Failed to export data. Check console for details.");
        }
    };

    // Derived Data & Filtering
    const uniqueSections = useMemo(() => {
        const sections = new Set(classes.map(c => c.section).filter(Boolean));
        return Array.from(sections).sort();
    }, [classes]);

    const filteredAndSortedClasses = useMemo(() => {
        let result = classes.filter((c) => {
            const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.section?.toLowerCase().includes(search.toLowerCase());
            const matchesSection = sectionFilter === "all" || c.section === sectionFilter;
            return matchesSearch && matchesSection;
        });

        if (sortBy === "name_asc") {
            result.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortBy === "name_desc") {
            result.sort((a, b) => b.name.localeCompare(a.name));
        } else if (sortBy === "newest") {
            result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        return result;
    }, [classes, search, sectionFilter, sortBy]);

    // Pagination
    const totalPages = Math.ceil(filteredAndSortedClasses.length / itemsPerPage);
    const paginatedClasses = filteredAndSortedClasses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Stats Calculations
    const totalStudents = classes.reduce((acc, curr) => acc + (curr.Students?.length || 0), 0);
    const totalSubjects = classes.reduce((acc, curr) => acc + (curr.Subjects?.length || 0), 0);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [search, sectionFilter, sortBy]);

    if (loading) {
        return (
            <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            </div>
        );
    }

    // Helper functions for UI
    const getInitials = (name) => {
        const match = name.match(/\d+/);
        if (match) return match[0];
        return name.charAt(0).toUpperCase();
    };
    
    const getColorForName = (name) => {
        const colors = [
            { bg: '#f3e8ff', text: '#9333ea' }, // Purple
            { bg: '#dbeafe', text: '#2563eb' }, // Blue
            { bg: '#dcfce7', text: '#16a34a' }, // Green
            { bg: '#ffedd5', text: '#ea580c' }, // Orange
            { bg: '#fee2e2', text: '#dc2626' }, // Red
            { bg: '#fef3c7', text: '#d97706' }, // Yellow
        ];
        // Simple hash to consistently pick a color
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    return (
        <div className="students-container">
            
            {/* ── Header ── */}
            <div className="st-header">
                <div className="st-header-top-row">
                    <div className="st-header-left">
                        <h1>Classes Management</h1>
                        <p>Manage all classes and their sections</p>
                    </div>
                </div>
                <div className="st-header-bottom-row">
                    <div className="st-breadcrumbs">
                        <span>Dashboard</span>
                        <span>›</span>
                        <span className="active">Classes Management</span>
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
                                Add Class
                            </button>
                        )}
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
                        placeholder="Search by class name or section..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ width: "100%", padding: "0.6rem 1rem 0.6rem 2.2rem", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none", fontSize: "0.9rem" }}
                    />
                </div>
                
                {showAdvancedFilters && (
                    <>
                        <select 
                            value={sectionFilter} 
                            onChange={(e) => setSectionFilter(e.target.value)}
                            style={{ padding: "0.6rem 2rem 0.6rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none", fontSize: "0.9rem", color: "#334155", minWidth: "150px" }}
                        >
                            <option value="all">All Sections</option>
                            {uniqueSections.map(s => <option key={s} value={s}>Section {s}</option>)}
                        </select>

                        <select 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{ padding: "0.6rem 2rem 0.6rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none", fontSize: "0.9rem", color: "#334155", minWidth: "150px" }}
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                        </select>
                    </>
                )}

                <button 
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    style={{ padding: "0.6rem 1rem", borderRadius: "8px", border: showAdvancedFilters ? "1px solid #6366f1" : "1px solid #eef2ff", backgroundColor: showAdvancedFilters ? "#eef2ff" : "#fff", color: "#6366f1", display: "flex", alignItems: "center", gap: "6px", fontSize: "0.9rem", fontWeight: "500", cursor: "pointer", transition: "all 0.2s" }}
                >
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                    Filters {showAdvancedFilters ? "(-)" : "(+)"}
                </button>
            </div>

            {/* ── Statistics Grid ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.5rem", marginBottom: "2rem" }}>
                
                {/* Stat Card 1 */}
                <div style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: "15px" }}>
                    <div style={{ width: "56px", height: "56px", borderRadius: "12px", backgroundColor: "#f3e8ff", color: "#9333ea", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="28" height="28" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/></svg>
                    </div>
                    <div>
                        <h3 style={{ margin: "0", fontSize: "1.5rem", color: "#0f172a", fontWeight: "700" }}>{totalCount}</h3>
                        <p style={{ margin: "0", fontSize: "0.85rem", color: "#0f172a", fontWeight: "600" }}>Total Classes</p>
                        <p style={{ margin: "0", fontSize: "0.75rem", color: "#94a3b8" }}>Across all sections</p>
                    </div>
                </div>

                {/* Stat Card 2 */}
                <div style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: "15px" }}>
                    <div style={{ width: "56px", height: "56px", borderRadius: "12px", backgroundColor: "#dcfce7", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="28" height="28" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                    </div>
                    <div>
                        <h3 style={{ margin: "0", fontSize: "1.5rem", color: "#0f172a", fontWeight: "700" }}>{totalStudents}</h3>
                        <p style={{ margin: "0", fontSize: "0.85rem", color: "#0f172a", fontWeight: "600" }}>Total Students</p>
                        <p style={{ margin: "0", fontSize: "0.75rem", color: "#94a3b8" }}>Enrolled across all classes</p>
                    </div>
                </div>

                {/* Stat Card 3 */}
                <div style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: "15px" }}>
                    <div style={{ width: "56px", height: "56px", borderRadius: "12px", backgroundColor: "#e0f2fe", color: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="28" height="28" fill="currentColor" viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12zM10 9h8v2h-8zm0 3h4v2h-4zm0-6h8v2h-8z"/></svg>
                    </div>
                    <div>
                        <h3 style={{ margin: "0", fontSize: "1.5rem", color: "#0f172a", fontWeight: "700" }}>{totalSubjects}</h3>
                        <p style={{ margin: "0", fontSize: "0.85rem", color: "#0f172a", fontWeight: "600" }}>Total Subjects</p>
                        <p style={{ margin: "0", fontSize: "0.75rem", color: "#94a3b8" }}>Assigned to classes</p>
                    </div>
                </div>

                {/* Stat Card 4 */}
                <div style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: "15px" }}>
                    <div style={{ width: "56px", height: "56px", borderRadius: "12px", backgroundColor: "#ffedd5", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="28" height="28" fill="currentColor" viewBox="0 0 24 24"><path d="M11 2v20c-5.07-.5-9-4.79-9-10s3.93-9.5 9-10zm2 0v8.99L21 11c0-4.64-3.52-8.47-8-8.99zM13 13v9.01c4.49-.49 8-4.32 8-8.98l-8-.03z"/></svg>
                    </div>
                    <div>
                        <h3 style={{ margin: "0", fontSize: "1.5rem", color: "#0f172a", fontWeight: "700" }}>100%</h3>
                        <p style={{ margin: "0", fontSize: "0.85rem", color: "#0f172a", fontWeight: "600" }}>Active Classes</p>
                        <p style={{ margin: "0", fontSize: "0.75rem", color: "#94a3b8" }}>Currently active</p>
                    </div>
                </div>
            </div>

            {/* ── Data Table Area ── */}
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #f1f5f9", overflow: "hidden" }}>
                
                {/* Table Header Row */}
                <div style={{ padding: "1.2rem 1.5rem", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: "1rem", color: "#0f172a" }}>All Classes ({filteredAndSortedClasses.length})</h3>
                    <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", color: "#64748b" }}>
                            <span>Sort by:</span>
                            <select 
                                value={sortBy} 
                                onChange={(e) => setSortBy(e.target.value)}
                                style={{ border: "1px solid #e2e8f0", padding: "4px 8px", borderRadius: "6px", outline: "none", color: "#334155" }}
                            >
                                <option value="name_asc">Class Name (A-Z)</option>
                                <option value="name_desc">Class Name (Z-A)</option>
                                <option value="newest">Newest First</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: '0.2rem', background: '#f1f5f9', padding: '0.2rem', borderRadius: '8px' }}>
                            <button 
                                className="st-btn" 
                                style={{ 
                                    background: viewMode === 'list' ? '#fff' : 'transparent', 
                                    color: viewMode === 'list' ? '#8b5cf6' : '#64748b', 
                                    padding: '0.4rem 0.6rem', 
                                    boxShadow: viewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                onClick={() => setViewMode('list')}
                            >
                                ≡
                            </button>
                            <button 
                                className="st-btn" 
                                style={{ 
                                    background: viewMode === 'grid' ? '#fff' : 'transparent', 
                                    color: viewMode === 'grid' ? '#8b5cf6' : '#64748b', 
                                    padding: '0.4rem 0.6rem', 
                                    boxShadow: viewMode === 'grid' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                onClick={() => setViewMode('grid')}
                            >
                                ⊞
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content Area (Table or Grid) */}
                {viewMode === "list" ? (
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                            <thead>
                                <tr style={{ backgroundColor: "#f8fafc", color: "#64748b", fontSize: "0.75rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                                <th style={{ padding: "1rem 1.5rem", fontWeight: "600", width: "25%" }}>Class Name</th>
                                <th style={{ padding: "1rem", fontWeight: "600", width: "15%" }}>Section</th>
                                <th style={{ padding: "1rem", fontWeight: "600", width: "15%" }}>Students</th>
                                <th style={{ padding: "1rem", fontWeight: "600", width: "15%" }}>Subjects</th>
                                <th style={{ padding: "1rem", fontWeight: "600", width: "10%" }}>Status</th>
                                <th style={{ padding: "1rem", fontWeight: "600", width: "15%" }}>Created On</th>
                                <th style={{ padding: "1rem 1.5rem", fontWeight: "600", width: "5%", textAlign: "center" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedClasses.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>
                                        No classes found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                paginatedClasses.map((cls) => {
                                    const cColors = getColorForName(cls.name);
                                    const createdDate = new Date(cls.created_at);
                                    const displaySection = cls.section ? (cls.section.toLowerCase().startsWith('section') ? cls.section : `Section ${cls.section}`) : '';
                                    
                                    return (
                                        <tr key={cls.id} style={{ borderTop: "1px solid #f1f5f9", transition: "background 0.2s" }} className="table-row-hover">
                                            <td style={{ padding: "1rem 1.5rem" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                    <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: cColors.bg, color: cColors.text, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "1rem" }}>
                                                        {getInitials(cls.name)}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: "600", color: "#0f172a", fontSize: "0.95rem" }}>{cls.name}</div>
                                                        <div style={{ color: "#64748b", fontSize: "0.8rem" }}>Grade {getInitials(cls.name)}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: "1rem" }}>
                                                {displaySection ? (
                                                    <span style={{ backgroundColor: "#f3e8ff", color: "#9333ea", padding: "4px 10px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "600" }}>
                                                        {displaySection}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>-</span>
                                                )}
                                            </td>
                                            <td style={{ padding: "1rem" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#0f172a", fontWeight: "500", fontSize: "0.9rem" }}>
                                                    <svg width="16" height="16" fill="none" stroke="#8b5cf6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                    {cls.Students?.length || 0}
                                                </div>
                                                <div style={{ fontSize: "0.75rem", color: "#64748b", marginLeft: "24px" }}>Students</div>
                                            </td>
                                            <td style={{ padding: "1rem" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#0f172a", fontWeight: "500", fontSize: "0.9rem" }}>
                                                    <svg width="16" height="16" fill="none" stroke="#64748b" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                                    {cls.Subjects?.length || 0}
                                                </div>
                                                <div style={{ fontSize: "0.75rem", color: "#64748b", marginLeft: "24px" }}>Subjects</div>
                                            </td>
                                            <td style={{ padding: "1rem" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#10b981", fontSize: "0.85rem", fontWeight: "500" }}>
                                                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10b981" }}></div>
                                                    Active
                                                </div>
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
                                                            onClick={() => handleEdit(cls)}
                                                            style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1px solid #e2e8f0", backgroundColor: "#fff", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s" }}
                                                            title="Edit"
                                                            className="hover-bg-gray"
                                                        >
                                                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                        </button>
                                                    )}
                                                    {canDelete && (
                                                        <button 
                                                            onClick={() => handleDelete(cls.id)}
                                                            style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1px solid #e2e8f0", backgroundColor: "#fff", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s" }}
                                                            title="Delete"
                                                            className="hover-bg-gray"
                                                        >
                                                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
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
                    <div style={{ padding: "1.5rem", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.5rem", backgroundColor: "#f8fafc" }}>
                        {paginatedClasses.length === 0 ? (
                            <div style={{ gridColumn: "1 / -1", padding: "3rem", textAlign: "center", color: "#94a3b8", backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
                                No classes found matching your criteria.
                            </div>
                        ) : (
                            paginatedClasses.map((cls) => {
                                const cColors = getColorForName(cls.name);
                                const createdDate = new Date(cls.created_at);
                                const displaySection = cls.section ? (cls.section.toLowerCase().startsWith('section') ? cls.section : `Section ${cls.section}`) : '';
                                return (
                                    <div key={cls.id} style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: cColors.bg, color: cColors.text, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "1rem" }}>
                                                    {getInitials(cls.name)}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: "600", color: "#0f172a", fontSize: "1.05rem" }}>{cls.name}</div>
                                                    {displaySection && (
                                                        <span style={{ display: "inline-block", backgroundColor: "#f3e8ff", color: "#9333ea", padding: "2px 8px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "600", marginTop: "4px" }}>
                                                            {displaySection}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ display: "flex", gap: "5px" }}>
                                                {canUpdate && (
                                                    <button onClick={() => handleEdit(cls)} style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", padding: "4px" }} className="hover-text-primary">
                                                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button onClick={() => handleDelete(cls.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: "4px" }}>
                                                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", borderTop: "1px solid #f1f5f9", paddingTop: "1rem" }}>
                                            <div>
                                                <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "4px" }}>Students</div>
                                                <div style={{ color: "#0f172a", fontWeight: "600", fontSize: "0.95rem" }}>{cls.Students?.length || 0}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "4px" }}>Subjects</div>
                                                <div style={{ color: "#0f172a", fontWeight: "600", fontSize: "0.95rem" }}>{cls.Subjects?.length || 0}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: "1rem", marginTop: "1rem" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#10b981", fontSize: "0.8rem", fontWeight: "500" }}>
                                                <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10b981" }}></div>
                                                Active
                                            </div>
                                            <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                                                {createdDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* Pagination Controls */}
                {filteredAndSortedClasses.length > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.5rem", borderTop: "1px solid #f1f5f9", backgroundColor: "#fff" }}>
                        <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedClasses.length)} of {filteredAndSortedClasses.length} entries
                        </div>
                        <div style={{ display: "flex", gap: "5px" }}>
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid #e2e8f0", backgroundColor: "#fff", color: currentPage === 1 ? "#cbd5e1" : "#64748b", cursor: currentPage === 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    style={{ 
                                        width: "34px", height: "34px", 
                                        borderRadius: "8px", 
                                        border: currentPage === page ? "none" : "1px solid #e2e8f0",
                                        backgroundColor: currentPage === page ? "#6366f1" : "#fff",
                                        color: currentPage === page ? "#fff" : "#64748b",
                                        fontSize: "0.85rem", fontWeight: "600",
                                        cursor: "pointer",
                                        display: "flex", alignItems: "center", justifyContent: "center"
                                    }}
                                >
                                    {page}
                                </button>
                            ))}
                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid #e2e8f0", backgroundColor: "#fff", color: currentPage === totalPages ? "#cbd5e1" : "#64748b", cursor: currentPage === totalPages ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Add/Edit Class Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)} style={{ zIndex: 9999, backgroundColor: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(4px)" }}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "550px", borderRadius: "16px", padding: "0", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}>
                        
                        <div style={{ padding: "2rem 2.5rem", borderBottom: "1px solid #f1f5f9", position: "relative" }}>
                            <button onClick={() => setShowModal(false)} style={{ position: "absolute", top: "1.5rem", right: "1.5rem", background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", transition: "color 0.2s" }} className="hover-text-gray-700">
                                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                                <div style={{ width: "56px", height: "56px", borderRadius: "50%", backgroundColor: "#f3e8ff", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <svg width="28" height="28" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/></svg>
                                </div>
                                <div>
                                    <h3 style={{ margin: "0 0 4px 0", color: "#0f172a", fontSize: "1.25rem", fontWeight: "600" }}>
                                        {editMode ? "Edit Class" : "Add New Class"}
                                    </h3>
                                    <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}>
                                        {editMode ? "Update class details and settings" : "Create a new class and section"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: "2rem 2.5rem" }}>
                            <form onSubmit={handleSubmit}>
                                <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                                    <label className="form-label" style={{ fontWeight: "600", color: "#0f172a", fontSize: "0.875rem", marginBottom: "8px", display: "block" }}>
                                        Class Name <span style={{ color: "#ef4444" }}>*</span>
                                    </label>
                                    <div style={{ position: "relative" }}>
                                        <input
                                            type="text"
                                            name="name"
                                            className="form-input"
                                            placeholder="e.g., Class 10, Grade 5, BSc 1st Year"
                                            value={formData.name}
                                            onChange={handleChange}
                                            required
                                            style={{ width: "100%", padding: "0.75rem 1rem", paddingRight: "2.5rem", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", fontSize: "0.9rem", color: "#334155", transition: "border-color 0.2s" }}
                                            onFocus={(e) => e.target.style.borderColor = "#6366f1"}
                                            onBlur={(e) => e.target.style.borderColor = "#cbd5e1"}
                                        />
                                        <svg width="20" height="20" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)" }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                        </svg>
                                    </div>
                                    <small style={{ color: "#64748b", fontSize: "0.75rem", display: "block", marginTop: "6px" }}>
                                        Enter the name of the class
                                    </small>
                                </div>

                                <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                                    <label className="form-label" style={{ fontWeight: "600", color: "#0f172a", fontSize: "0.875rem", marginBottom: "8px", display: "block" }}>
                                        Section (Optional)
                                    </label>
                                    <div style={{ position: "relative" }}>
                                        <input
                                            type="text"
                                            name="section"
                                            className="form-input"
                                            placeholder="e.g., A, B, Science, Commerce"
                                            value={formData.section}
                                            onChange={handleChange}
                                            style={{ width: "100%", padding: "0.75rem 1rem", paddingRight: "2.5rem", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", fontSize: "0.9rem", color: "#334155", transition: "border-color 0.2s" }}
                                            onFocus={(e) => e.target.style.borderColor = "#6366f1"}
                                            onBlur={(e) => e.target.style.borderColor = "#cbd5e1"}
                                        />
                                        <svg width="20" height="20" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)" }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                    </div>
                                    <small style={{ color: "#64748b", fontSize: "0.75rem", display: "block", marginTop: "6px" }}>
                                        Enter section name if applicable
                                    </small>
                                </div>

                                <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                                    <label className="form-label" style={{ fontWeight: "600", color: "#0f172a", fontSize: "0.875rem", marginBottom: "8px", display: "block" }}>
                                        Academic Year <span style={{ color: "#ef4444" }}>*</span>
                                    </label>
                                    <div style={{ position: "relative" }}>
                                        <select
                                            name="academic_year"
                                            className="form-input"
                                            value={formData.academic_year}
                                            onChange={handleChange}
                                            required
                                            style={{ width: "100%", padding: "0.75rem 1rem", paddingRight: "2.5rem", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", fontSize: "0.9rem", color: "#334155", appearance: "none", cursor: "pointer" }}
                                        >
                                            <option value="2024 - 2025">2024 - 2025</option>
                                            <option value="2025 - 2026">2025 - 2026</option>
                                            <option value="2026 - 2027">2026 - 2027</option>
                                            <option value="2027 - 2028">2027 - 2028</option>
                                        </select>
                                        <div style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", display: "flex", gap: "6px", pointerEvents: "none", color: "#94a3b8" }}>
                                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginTop: "2px" }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                    <small style={{ color: "#64748b", fontSize: "0.75rem", display: "block", marginTop: "6px" }}>
                                        Select the academic year for this class
                                    </small>
                                </div>

                                <div className="form-group" style={{ marginBottom: "2.5rem" }}>
                                    <label className="form-label" style={{ fontWeight: "600", color: "#0f172a", fontSize: "0.875rem", marginBottom: "8px", display: "block" }}>
                                        Class Teacher (Optional)
                                    </label>
                                    <div style={{ position: "relative" }}>
                                        <select
                                            name="teacher_id"
                                            className="form-input"
                                            value={formData.teacher_id}
                                            onChange={handleChange}
                                            style={{ width: "100%", padding: "0.75rem 1rem", paddingRight: "2.5rem", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", fontSize: "0.9rem", color: formData.teacher_id ? "#334155" : "#94a3b8", appearance: "none", cursor: "pointer" }}
                                        >
                                            <option value="" disabled hidden>Select class teacher</option>
                                            <option value="">None</option>
                                            {faculty.map((f) => (
                                                <option key={f.id} value={f.id}>{f.User?.name || 'Unknown'} {f.designation ? `(${f.designation})` : ''}</option>
                                            ))}
                                        </select>
                                        <div style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", display: "flex", gap: "6px", pointerEvents: "none", color: "#94a3b8" }}>
                                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginTop: "2px" }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                    <small style={{ color: "#64748b", fontSize: "0.75rem", display: "block", marginTop: "6px" }}>
                                        Assign a faculty member as class teacher
                                    </small>
                                </div>

                                <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "12px", paddingTop: "1rem", borderTop: "1px solid #f1f5f9" }}>
                                    <button type="button" onClick={() => setShowModal(false)} className="btn" style={{ padding: "0.6rem 1.5rem", borderRadius: "8px", border: "1px solid #cbd5e1", backgroundColor: "#fff", color: "#475569", fontWeight: "600", cursor: "pointer", transition: "background 0.2s" }} onMouseOver={(e) => e.target.style.backgroundColor = "#f8fafc"} onMouseOut={(e) => e.target.style.backgroundColor = "#fff"}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" style={{ padding: "0.6rem 1.5rem", borderRadius: "8px", backgroundColor: "#6366f1", border: "none", color: "#fff", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", transition: "background 0.2s" }} onMouseOver={(e) => e.target.style.backgroundColor = "#4f46e5"} onMouseOut={(e) => e.target.style.backgroundColor = "#6366f1"}>
                                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                        {editMode ? "Update Class" : "Create Class"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            
            <style>{`
                .hover-bg-gray:hover {
                    background-color: #f8fafc !important;
                }
                .table-row-hover:hover {
                    background-color: #f8fafc;
                }
            `}</style>
        </div>
    );
}

export default Classes;
