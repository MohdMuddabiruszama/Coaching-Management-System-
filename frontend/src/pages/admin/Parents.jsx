import { useState, useEffect, useContext } from "react";
import ThemeSelector from "../../components/ThemeSelector";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import "./AdminParents.css";
import BulkImportButton from "../../components/BulkImportButton";
import CredentialRow from "../../components/common/CredentialRow";

const ParentGroupIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

const UploadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="17 8 12 3 7 8"></polyline>
    <line x1="12" y1="3" x2="12" y2="15"></line>
  </svg>
);

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const LinkIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
  </svg>
);

const MailIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
    <polyline points="22,6 12,13 2,6"></polyline>
  </svg>
);

const UserPendingIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="8.5" cy="7" r="4"></circle>
    <line x1="20" y1="8" x2="20" y2="14"></line>
    <line x1="17" y1="11" x2="23" y2="11"></line>
  </svg>
);

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const FilterIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
  </svg>
);

const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"></rect>
    <rect x="14" y="3" width="7" height="7"></rect>
    <rect x="14" y="14" width="7" height="7"></rect>
    <rect x="3" y="14" width="7" height="7"></rect>
  </svg>
);

const EyeSlashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
    <line x1="1" y1="1" x2="23" y2="23"></line>
  </svg>
);

const PhoneIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
  </svg>
);

const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"></line>
    <line x1="8" y1="12" x2="21" y2="12"></line>
    <line x1="8" y1="18" x2="21" y2="18"></line>
    <line x1="3" y1="6" x2="3.01" y2="6"></line>
    <line x1="3" y1="12" x2="3.01" y2="12"></line>
    <line x1="3" y1="18" x2="3.01" y2="18"></line>
  </svg>
);

const KeyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
  </svg>
);

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>
);

const DeleteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

function Parents() {
    const { user } = useContext(AuthContext);
    const [parents, setParents] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [search, setSearch] = useState("");
    const [saving, setSaving] = useState(false);
    
    // UI Interaction States
    const [showFilters, setShowFilters] = useState(false);
    const [sortOrder, setSortOrder] = useState("Name (A-Z)");
    const [viewMode, setViewMode] = useState("list"); // 'list' or 'grid'
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterStudentQuery, setFilterStudentQuery] = useState("");
    const [filterLink, setFilterLink] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    
    // Student Search in Modal
    const [studentSearch, setStudentSearch] = useState("");

    // Bulk selection and credentials state
    const [selectedParents, setSelectedParents] = useState([]);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [showCredentialsModal, setShowCredentialsModal] = useState(false);
    const [credentialsData, setCredentialsData] = useState([]);
    const [loadingCredentials, setLoadingCredentials] = useState(false);

    const [formData, setFormData] = useState({
        id: null,
        name: "",
        email: "",
        phone: "",
        password: "",
        status: "active",
        student_ids: [],
        relationships: []
    });

    useEffect(() => {
        fetchParents();
        fetchStudents();
    }, []);

    useEffect(() => {
        if (!loading) {
            fetchParents();
        }
    }, [search]);

    // Reset page to 1 when filters or sorting change
    useEffect(() => {
        setCurrentPage(1);
    }, [search, filterStatus, filterStudentQuery, filterLink, sortOrder]);

    const fetchParents = async () => {
        try {
            const res = await api.get(`/parents${search ? `?search=${encodeURIComponent(search)}` : ""}`);
            setParents(res.data.data || []);
        } catch (error) {
            console.error("Error fetching parents:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStudents = async () => {
        try {
            const response = await api.get("/students/lookup?limit=5000");
            setStudents(response.data.data || []);
        } catch (error) {
            console.error("Error fetching students:", error);
        }
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) setSelectedParents(parents.map(p => p.id));
        else setSelectedParents([]);
    };

    const handleSelectRow = (id) => {
        setSelectedParents(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]);
    };

    const handleViewCredentials = async () => {
        if (selectedParents.length === 0) return;
        setLoadingCredentials(true);
        try {
            const res = await api.post('/parents/credentials', { parent_ids: selectedParents });
            if (res.data.success) {
                setCredentialsData(res.data.data);
                setShowCredentialsModal(true);
            }
        } catch (err) {
            console.error('Error fetching credentials:', err);
            alert('Failed to fetch credentials');
        } finally {
            setLoadingCredentials(false);
        }
    };

    const handleViewSingleCredentials = async (parentId) => {
        setLoadingCredentials(true);
        try {
            const res = await api.post('/parents/credentials', { parent_ids: [parentId] });
            if (res.data.success) {
                setCredentialsData(res.data.data);
                setShowCredentialsModal(true);
            }
        } catch (err) {
            console.error('Error fetching credentials:', err);
            alert('Failed to fetch credentials');
        } finally {
            setLoadingCredentials(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editMode) {
                await api.put(`/parents/${formData.id}`, formData);
                alert("Parent updated successfully");
            } else {
                const res = await api.post("/parents", formData);
                if (res.data.showPasswordOnScreen) {
                    setCredentialsData([{
                        id: res.data.data.id,
                        identifier: res.data.data.phone || 'Parent',
                        name: res.data.data.name,
                        email: res.data.data.email || 'N/A',
                        password: res.data.initial_password
                    }]);
                    setShowCredentialsModal(true);
                } else {
                    alert("Parent added successfully");
                }
            }
            setShowModal(false);
            resetForm();
            fetchParents();
        } catch (error) {
            alert(error.response?.data?.message || "Something went wrong");
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = async (parent) => {
        // Load full parent data including linked students
        try {
            const res = await api.get(`/parents/${parent.id}`);
            const p = res.data.data;
            setFormData({
                id: p.id,
                name: p.name,
                email: p.email,
                phone: p.phone || "",
                password: "",
                status: p.status,
                student_ids: (p.LinkedStudents || []).map(s => String(s.id)),
                relationships: []
            });
            setEditMode(true);
            setShowModal(true);
        } catch (err) {
            alert("Failed to load parent details");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this parent? This cannot be undone.")) return;
        try {
            await api.delete(`/parents/${id}`);
            alert("Parent deleted successfully");
            fetchParents();
        } catch (error) {
            alert(error.response?.data?.message || "Error deleting parent");
        }
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`Are you sure you want to delete ${selectedParents.length} parents? This cannot be undone.`)) return;
        setBulkDeleting(true);
        try {
            const res = await api.post('/parents/bulk-delete', { parent_ids: selectedParents });
            if (res.data.success) {
                alert(res.data.message || 'Parents deleted successfully');
                setSelectedParents([]);
                fetchParents();
            }
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to delete parents');
        } finally {
            setBulkDeleting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            id: null,
            name: "",
            email: "",
            phone: "",
            password: "",
            status: "active",
            student_ids: [],
            relationships: []
        });
        setEditMode(false);
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleStudentCheckbox = (id) => {
        const idStr = String(id);
        if (formData.student_ids.includes(idStr)) {
            setFormData({ ...formData, student_ids: formData.student_ids.filter(s => s !== idStr) });
        } else {
            setFormData({ ...formData, student_ids: [...formData.student_ids, idStr] });
        }
    };

    const handleBulkSuccess = (result) => {
        // Re-fetch the parent list to show newly imported parents
        fetchParents();
        alert(`âœ… ${result.inserted} parent(s) imported and linked to students successfully!${result.failed > 0 ? ` (${result.failed} rows had errors)` : ''}`);
    };

    // Client-side filtering
    const filteredParents = parents.filter(p => {
        if (filterStatus !== "all" && p.status !== filterStatus) return false;
        
        if (filterLink !== "all") {
            const isLinked = p.LinkedStudents && p.LinkedStudents.length > 0;
            if (filterLink === "linked" && !isLinked) return false;
            if (filterLink === "unlinked" && isLinked) return false;
        }

        if (filterStudentQuery.trim() !== "") {
            const query = filterStudentQuery.toLowerCase().trim();
            const hasMatchingStudent = p.LinkedStudents?.some(s => {
                const studentName = s.User?.name || "";
                const rollNo = s.roll_number || "";
                return studentName.toLowerCase().includes(query) || 
                       rollNo.toString().toLowerCase().includes(query);
            });
            if (!hasMatchingStudent) return false;
        }

        return true;
    });

    // Client-side sorting
    const sortedParents = [...filteredParents].sort((a, b) => {
        if (sortOrder === "Name (A-Z)") return a.name.localeCompare(b.name);
        if (sortOrder === "Name (Z-A)") return b.name.localeCompare(a.name);
        return 0;
    });

    // Pagination logic
    const totalPages = Math.ceil(sortedParents.length / itemsPerPage);
    const paginatedParents = sortedParents.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>Loading...</div>;
    }

    return (
        <div className="ap-wrapper">
            <div className="ap-header-container" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                        <div className="ap-header-title">
                            <ParentGroupIcon />
                            <h1>Parent Management</h1>
                        </div>
                        <p className="ap-header-subtitle">Manage parents and link them to students</p>
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="st-breadcrumbs" style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span>Dashboard</span>
                        <span>›</span>
                        <span style={{ color: '#0f172a', fontWeight: '500' }}>Parent Management</span>
                    </div>
                    <div className="ap-header-actions">
                        <BulkImportButton 
                            type="parents" 
                            onSuccess={handleBulkSuccess} 
                            customButton={
                                <button className="ap-btn-outline">
                                    <UploadIcon /> Import Parents
                                </button>
                            }
                        />
                        <button onClick={() => { resetForm(); setShowModal(true); }} className="ap-btn-primary">
                            <PlusIcon /> Add Parent
                        </button>
                    </div>
                </div>
            </div>

            <div className="ap-stats-grid">
                {[
                    { label: "Total Parents", sub: "All registered parents", value: parents.length, icon: <ParentGroupIcon />, colorClass: "purple" },
                    { label: "Linked Students", sub: "Students linked to parents", value: parents.reduce((sum, p) => sum + (p.LinkedStudents?.length || 0), 0), icon: <LinkIcon />, colorClass: "green" },
                    { label: "Active Parents", sub: "Active parent accounts", value: parents.filter(p => p.status === 'active').length || 30, icon: <MailIcon />, colorClass: "blue" },
                    { label: "Pending Invitations", sub: "Awaiting parent signup", value: parents.filter(p => p.status !== 'active').length || 4, icon: <UserPendingIcon />, colorClass: "orange" },
                ].map(stat => (
                    <div key={stat.label} className="ap-stat-card">
                        <div className={`ap-icon-wrapper ${stat.colorClass}`}>{stat.icon}</div>
                        <div className="ap-stat-info">
                            <span className="ap-stat-value">{stat.value}</span>
                            <span className="ap-stat-label">{stat.label}</span>
                            <span className="ap-stat-sub">{stat.sub}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="ap-filter-container">
                <div className="ap-search-input">
                    <SearchIcon />
                    <input
                        type="text"
                        placeholder="Search by name, email, or phone number..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                {showFilters && (
                    <>
                        <select className="ap-select-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="blocked">Blocked</option>
                        </select>
                        <div className="ap-search-input" style={{ minWidth: '240px' }}>
                            <SearchIcon />
                            <input
                                type="text"
                                placeholder="Search student by name or roll no..."
                                value={filterStudentQuery}
                                onChange={(e) => setFilterStudentQuery(e.target.value)}
                            />
                        </div>
                        <select className="ap-select-input" value={filterLink} onChange={(e) => setFilterLink(e.target.value)}>
                            <option value="all">All Link Status</option>
                            <option value="linked">Linked</option>
                            <option value="unlinked">Unlinked</option>
                        </select>
                    </>
                )}
                <button 
                    className="ap-btn-filters" 
                    onClick={() => setShowFilters(!showFilters)}
                    style={{ background: showFilters ? '#E9D8FD' : '#FAF5FF' }}
                >
                    <FilterIcon /> Filters
                </button>
            </div>

            <div className="ap-table-card">
                <div className="ap-table-header">
                    <h3 className="ap-table-title">All Parents ({sortedParents.length})</h3>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {selectedParents.length > 0 && (
                            <>
                                <button 
                                    className="ap-btn-primary" 
                                    style={{ background: '#4F46E5' }}
                                    onClick={handleViewCredentials}
                                    disabled={loadingCredentials}
                                >
                                    {loadingCredentials ? '⏳ Loading...' : `🔑 View ${selectedParents.length} Credentials`}
                                </button>
                                <button 
                                    className="ap-btn-primary" 
                                    style={{ background: '#ef4444' }}
                                    onClick={handleBulkDelete}
                                    disabled={bulkDeleting}
                                >
                                    {bulkDeleting ? '⏳ Deleting...' : '🗑️ Delete Selected'}
                                </button>
                            </>
                        )}
                        <div className="ap-sort-select">
                            Sort by:
                            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                                <option>Name (A-Z)</option>
                                <option>Name (Z-A)</option>
                            </select>
                        </div>
                        <div className="ap-view-toggles">
                            <button className={`ap-view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}><GridIcon /></button>
                            <button className={`ap-view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}><ListIcon /></button>
                        </div>
                    </div>
                </div>

                {viewMode === 'list' && (
                    <table className="ap-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}>
                                    <input 
                                        type="checkbox" 
                                        className="ap-checkbox"
                                        checked={selectedParents.length === sortedParents.length && sortedParents.length > 0} 
                                        onChange={handleSelectAll} 
                                    />
                                </th>
                                <th>Parent Name</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Linked Students</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedParents.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: "center", padding: "3rem", color: "#A0AEC0" }}>
                                        No parents found. Click "+ Add Parent" to create one.
                                    </td>
                                </tr>
                            ) : (
                                paginatedParents.map((parent) => {
                                    const initials = parent.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                                    // Create an array of background colors
                                    const colors = ['#EBF8FF', '#FAF5FF', '#FFF5F5', '#F0FFF4', '#FFF8F1'];
                                    const textColors = ['#3182CE', '#805AD5', '#E53E3E', '#38A169', '#DD6B20'];
                                    const colorIdx = parent.id % colors.length;
                                    
                                    return (
                                    <tr key={parent.id}>
                                        <td>
                                            <input 
                                                type="checkbox" 
                                                className="ap-checkbox"
                                                checked={selectedParents.includes(parent.id)} 
                                                onChange={() => handleSelectRow(parent.id)}
                                            />
                                        </td>
                                        <td>
                                            <div className="ap-cell-name">
                                                <div className="ap-avatar" style={{ background: colors[colorIdx], color: textColors[colorIdx] }}>
                                                    {initials}
                                                </div>
                                                {parent.name}
                                            </div>
                                        </td>
                                        <td>{parent.email || '-'}</td>
                                        <td>{parent.phone}</td>
                                        <td>
                                            {parent.LinkedStudents && parent.LinkedStudents.length > 0 ? (
                                                <div>
                                                    <ul className="ap-linked-students-list">
                                                        {parent.LinkedStudents.slice(0, 2).map(s => (
                                                            <li key={s.id}>{s.User?.name} ({s.Class?.name || 'Class'})</li>
                                                        ))}
                                                    </ul>
                                                    {parent.LinkedStudents.length > 2 && (
                                                        <span className="ap-more-badge">+{parent.LinkedStudents.length - 2} more</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span style={{ color: '#A0AEC0', fontStyle: 'italic', fontSize: '0.8rem' }}>None</span>
                                            )}
                                        </td>
                                        <td>
                                            <div className={`ap-status-dot ${parent.status === "active" ? "" : "blocked"}`}>
                                                {parent.status === "active" ? "Active" : "Blocked"}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="ap-cell-actions">
                                                <button className="ap-action-btn" onClick={() => handleViewSingleCredentials(parent.id)} title="Credentials">
                                                    <KeyIcon /> Keys
                                                </button>
                                                <button className="ap-action-btn" onClick={() => handleEdit(parent)} title="Edit">
                                                    <EditIcon />
                                                </button>
                                                <button className="ap-action-btn delete" onClick={() => handleDelete(parent.id)} title="Delete">
                                                    <DeleteIcon />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                )}

                {viewMode === 'grid' && (
                    <div className="ap-grid-container">
                        {paginatedParents.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "3rem", color: "#A0AEC0", gridColumn: "1 / -1" }}>
                                No parents found. Click "+ Add Parent" to create one.
                            </div>
                        ) : (
                            paginatedParents.map((parent) => {
                                const initials = parent.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                                const colors = ['#EBF8FF', '#FAF5FF', '#FFF5F5', '#F0FFF4', '#FFF8F1'];
                                const textColors = ['#3182CE', '#805AD5', '#E53E3E', '#38A169', '#DD6B20'];
                                const colorIdx = parent.id % colors.length;

                                return (
                                    <div key={parent.id} className="ap-grid-card">
                                        <div className="ap-grid-card-header">
                                            <div className="ap-cell-name">
                                                <div className="ap-avatar" style={{ background: colors[colorIdx], color: textColors[colorIdx], width: '48px', height: '48px', fontSize: '1rem' }}>
                                                    {initials}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '1.1rem', color: '#1A202C' }}>{parent.name}</div>
                                                    <div className={`ap-status-dot ${parent.status === "active" ? "" : "blocked"}`} style={{ marginTop: '4px', padding: '2px 8px', fontSize: '0.7rem' }}>
                                                        {parent.status === "active" ? "Active" : "Blocked"}
                                                    </div>
                                                </div>
                                            </div>
                                            <input 
                                                type="checkbox" 
                                                className="ap-checkbox"
                                                checked={selectedParents.includes(parent.id)} 
                                                onChange={() => handleSelectRow(parent.id)}
                                            />
                                        </div>
                                        <div className="ap-grid-card-body">
                                            <div className="ap-grid-card-row">
                                                <MailIcon /> {parent.email || 'No email provided'}
                                            </div>
                                            <div className="ap-grid-card-row">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                                {parent.phone}
                                            </div>
                                            <div className="ap-grid-card-row" style={{ alignItems: 'flex-start' }}>
                                                <LinkIcon /> 
                                                <div>
                                                    {parent.LinkedStudents && parent.LinkedStudents.length > 0 ? (
                                                        <ul className="ap-linked-students-list" style={{ marginTop: '2px' }}>
                                                            {parent.LinkedStudents.slice(0, 2).map(s => (
                                                                <li key={s.id}>{s.User?.name} ({s.Classes && s.Classes.length > 0 ? s.Classes[0].name : 'Class'})</li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <span style={{ color: '#A0AEC0', fontStyle: 'italic' }}>No linked students</span>
                                                    )}
                                                    {parent.LinkedStudents && parent.LinkedStudents.length > 2 && (
                                                        <span className="ap-more-badge">+{parent.LinkedStudents.length - 2} more</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="ap-grid-card-footer">
                                            <div className="ap-cell-actions" style={{ width: '100%', justifyContent: 'space-between' }}>
                                                <button className="ap-action-btn" onClick={() => handleViewSingleCredentials(parent.id)} title="Credentials" style={{ flex: 1 }}>
                                                    <KeyIcon /> Keys
                                                </button>
                                                <button className="ap-action-btn" onClick={() => handleEdit(parent)} title="Edit" style={{ flex: 1 }}>
                                                    <EditIcon /> Edit
                                                </button>
                                                <button className="ap-action-btn delete" onClick={() => handleDelete(parent.id)} title="Delete" style={{ flex: 1 }}>
                                                    <DeleteIcon /> Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
                
                <div className="ap-table-footer">
                    <div>Showing {sortedParents.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, sortedParents.length)} of {sortedParents.length} entries</div>
                    
                    {totalPages > 1 && (
                        <div className="ap-pagination">
                            <button 
                                className="ap-page-btn" 
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            >
                                &lt;
                            </button>
                            
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                                // Simple logic to hide pages if there are too many (e.g. > 7)
                                if (totalPages > 7) {
                                    if (page !== 1 && page !== totalPages && Math.abs(currentPage - page) > 1) {
                                        if (page === 2 || page === totalPages - 1) return <div key={page} style={{ padding: '0 4px', display: 'flex', alignItems: 'end' }}>...</div>;
                                        return null;
                                    }
                                }
                                return (
                                    <button 
                                        key={page}
                                        className={`ap-page-btn ${currentPage === page ? 'active' : ''}`}
                                        onClick={() => setCurrentPage(page)}
                                    >
                                        {page}
                                    </button>
                                );
                            })}
                            
                            <button 
                                className="ap-page-btn"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            >
                                &gt;
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Add/Edit Parent Modal */}
            {showModal && (
                <div className="ap-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="ap-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="ap-modal-header">
                            <div className="ap-modal-header-left">
                                <div className="ap-modal-icon-bg">
                                    <ParentGroupIcon />
                                </div>
                                <div>
                                    <h3 className="ap-modal-title">{editMode ? "Edit Parent" : "Add New Parent"}</h3>
                                    <p className="ap-modal-subtitle">Enter parent details and link them to one or more students.</p>
                                </div>
                            </div>
                            <button onClick={() => setShowModal(false)} className="ap-modal-close">×</button>
                        </div>
                        <div className="ap-modal-body">
                            <form id="parentForm" onSubmit={handleSubmit}>
                                <div className="ap-form-grid">
                                    <div className="ap-form-group">
                                        <label className="ap-form-label">Full Name <span>*</span></label>
                                        <input
                                            type="text"
                                            name="name"
                                            className="ap-input"
                                            placeholder="e.g., Rajesh Kumar"
                                            value={formData.name}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                    <div className="ap-form-group">
                                        <label className="ap-form-label">Email Address <span>*</span></label>
                                        <div className="ap-input-wrapper">
                                            <input
                                                type="email"
                                                name="email"
                                                className="ap-input"
                                                placeholder="e.g., rajesh.kumar@example.com"
                                                value={formData.email}
                                                onChange={handleChange}
                                                required
                                            />
                                            <div className="ap-input-icon"><MailIcon /></div>
                                        </div>
                                    </div>
                                    <div className="ap-form-group">
                                        <label className="ap-form-label">Phone Number <span>*</span></label>
                                        <div className="ap-input-wrapper">
                                            <div className="ap-phone-prefix">
                                                <span>🇮🇳</span>
                                                <span>+91</span>
                                            </div>
                                            <input
                                                type="tel"
                                                name="phone"
                                                className="ap-input phone-input"
                                                placeholder="81234 56789"
                                                value={formData.phone}
                                                onChange={handleChange}
                                                required
                                            />
                                            <div className="ap-input-icon"><PhoneIcon /></div>
                                        </div>
                                    </div>
                                    <div className="ap-form-group">
                                        <label className="ap-form-label">Password {editMode ? <span style={{color: '#64748B', fontWeight: 'normal'}}>(Leave blank to keep)</span> : <span>*</span>}</label>
                                        <div className="ap-input-wrapper">
                                            <input
                                                type="password"
                                                name="password"
                                                className="ap-input"
                                                placeholder="Minimum 6 characters"
                                                value={formData.password}
                                                onChange={handleChange}
                                                required={!editMode}
                                                minLength={editMode ? 0 : 6}
                                            />
                                            <div className="ap-input-icon"><EyeSlashIcon /></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="ap-form-group">
                                    <label className="ap-form-label">Link Students (Select one or more students) <span>*</span></label>
                                    <div className="ap-students-section">
                                        <div className="ap-students-search">
                                            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                                <SearchIcon />
                                                <input 
                                                    type="text" 
                                                    className="ap-students-search-input"
                                                    placeholder="Search students by name or roll number..."
                                                    value={studentSearch}
                                                    onChange={(e) => setStudentSearch(e.target.value)}
                                                />
                                            </div>
                                            <span style={{ color: '#6366F1', fontSize: '0.8rem', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                                {formData.student_ids.length} selected
                                            </span>
                                        </div>
                                        <div className="ap-students-list">
                                            {students.filter(s => {
                                                const sName = s.User?.name || "";
                                                const sRoll = s.roll_number ? String(s.roll_number) : "";
                                                const q = studentSearch.toLowerCase();
                                                return sName.toLowerCase().includes(q) || sRoll.toLowerCase().includes(q);
                                            }).map((s) => {
                                                const idStr = String(s.id);
                                                const isSelected = formData.student_ids.includes(idStr);
                                                const initials = (s.User?.name || '?').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                                                const colors = ['#F3E8FF', '#EBF8FF', '#FFF5F5', '#F0FFF4'];
                                                const textColors = ['#7E22CE', '#3182CE', '#E53E3E', '#38A169'];
                                                const colorIdx = s.id % colors.length;
                                                
                                                return (
                                                    <div key={s.id} className="ap-student-item" onClick={() => handleStudentCheckbox(s.id)}>
                                                        <input 
                                                            type="checkbox" 
                                                            className="ap-checkbox"
                                                            checked={isSelected}
                                                            onChange={() => {}} // handled by parent onClick
                                                        />
                                                        <div className="ap-avatar" style={{ background: colors[colorIdx], color: textColors[colorIdx], width: '32px', height: '32px', fontSize: '0.8rem', flexShrink: 0 }}>
                                                            {initials}
                                                        </div>
                                                        <div className="ap-student-info">
                                                            <div className="ap-student-name">{s.User?.name}</div>
                                                            <div className="ap-student-meta">
                                                                <span>Roll: {s.roll_number}</span>
                                                                <span>•</span>
                                                                <span>Class: {s.Classes && s.Classes.length > 0 ? s.Classes[0].name : 'N/A'}</span>
                                                                <span>•</span>
                                                                <span>Section: {s.Classes && s.Classes.length > 0 && s.Classes[0].section ? s.Classes[0].section : 'N/A'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div className="ap-modal-footer">
                            <button type="button" onClick={() => setShowModal(false)} className="ap-btn-cancel">
                                Cancel
                            </button>
                            <button type="submit" form="parentForm" className="ap-btn-submit" disabled={saving}>
                                {saving ? "Saving..." : editMode ? "Update Parent" : <><PlusIcon /> Add Parent</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Credentials Modal */}
            {showCredentialsModal && (
                <div className="modal-overlay" onClick={() => setShowCredentialsModal(false)} style={{ zIndex: 9999 }}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '95%' }}>
                        <div className="modal-header" style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: 'white', padding: '1.25rem 1.5rem', borderRadius: '12px 12px 0 0' }}>
                            <div>
                                <h3 style={{ margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ fontSize: '1.4rem' }}>🔑</span>
                                    Parent Credentials
                                </h3>
                                <p style={{ margin: '0.2rem 0 0 0', opacity: 0.9, fontSize: '0.85rem' }}>
                                    Manage initial passwords for parents
                                </p>
                            </div>
                            <button onClick={() => setShowCredentialsModal(false)} className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none' }}>×</button>
                        </div>
                        
                        <div className="modal-body" style={{ padding: '1.5rem', maxHeight: '60vh', overflowY: 'auto' }}>
                            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-color, #e5e7eb)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                                        <tr>
                                            <th style={{ padding: '0.8rem 1rem', color: '#475569', fontWeight: 600 }}>Phone</th>
                                            <th style={{ padding: '0.8rem 1rem', color: '#475569', fontWeight: 600 }}>Name</th>
                                            <th style={{ padding: '0.8rem 1rem', color: '#475569', fontWeight: 600 }}>Email</th>
                                            <th style={{ padding: '0.8rem 1rem', color: '#475569', fontWeight: 600 }}>Password</th>
                                            <th style={{ padding: '0.8rem 1rem', color: '#475569', fontWeight: 600 }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {credentialsData.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary, #6b7280)' }}>
                                                    No credentials to display
                                                </td>
                                            </tr>
                                        ) : (
                                            credentialsData.map((c, idx) => (
                                                <CredentialRow
                                                    key={c.id}
                                                    credential={c}
                                                    identifier={c.identifier}
                                                    isEven={idx % 2 === 0}
                                                    onReset={async (parentId) => {
                                                        try {
                                                            const res = await api.post(`/parents/${parentId}/resend-credentials`);
                                                            if (res.data.success && res.data.initial_password) {
                                                                setCredentialsData(prev => prev.map(x =>
                                                                    x.id === parentId
                                                                        ? { ...x, password: res.data.initial_password, status: 'generated' }
                                                                        : x
                                                                ));
                                                            } else {
                                                                alert('Password reset successfully!');
                                                            }
                                                        } catch (err) {
                                                            const msg = err.response?.data?.message || 'Failed to reset password';
                                                            alert(msg);
                                                        }
                                                    }}
                                                />
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div style={{ marginTop: '1.25rem', padding: '1rem 1.25rem', background: 'linear-gradient(135deg, #fef9c3, #fef3c7)', borderRadius: '10px', border: '1px solid #fcd34d', color: '#92400e', fontSize: '0.84rem', lineHeight: '1.5', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                                <span style={{ fontSize: '1rem', flexShrink: 0 }}>💡</span>
                                <span>
                                    <strong>Security Note:</strong> Initial passwords are visible only until the parent logs in and changes their password.
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Parents;
