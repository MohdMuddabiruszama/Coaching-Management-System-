/**
 * Faculty Management Page
 * Complete CRUD for faculty management
 */

import { useState, useEffect, useContext } from "react";
import ThemeSelector from "../../components/ThemeSelector";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import QRCode from "qrcode";
import "./Dashboard.css";
import "./Students.css"; // Reuse student styles for consistency
import { savePdfNative } from "../../utils/capacitorPermissions";
import BulkImportButton from "../../components/BulkImportButton";
import CredentialRow from "../../components/common/CredentialRow";

function Faculty() {
    const { user } = useContext(AuthContext);
    const [faculty, setFaculty] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [search, setSearch] = useState("");
    
    // Filters and Pagination
    const [departmentFilter, setDepartmentFilter] = useState("all");
    const [designationFilter, setDesignationFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [actionMenuOpen, setActionMenuOpen] = useState(null);
    
    // Sort and View Mode
    const [sortBy, setSortBy] = useState("name");
    const [viewMode, setViewMode] = useState("list"); // "list" | "grid"

    // Bulk selection and QR State
    const [selectedFaculty, setSelectedFaculty] = useState([]);
    const [bulkDownloading, setBulkDownloading] = useState(false);
    const [showQrModal, setShowQrModal] = useState(false);
    const [qrFaculty, setQrFaculty] = useState(null);
    const [qrDownloading, setQrDownloading] = useState(false);
    const [qrLoading, setQrLoading] = useState(false);
    
    // Credentials state
    const [showCredentialsModal, setShowCredentialsModal] = useState(false);
    const [credentialsData, setCredentialsData] = useState([]);
    const [loadingCredentials, setLoadingCredentials] = useState(false);

    const handleSelectAll = (e) => {
        if (e.target.checked) setSelectedFaculty(filteredFaculty.map(f => f.id));
        else setSelectedFaculty([]);
    };

    const handleSelectRow = (id) => {
        setSelectedFaculty(prev => prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]);
    };

    const handleViewQr = async (fm) => {
        setQrLoading(true);
        try {
            const res = await api.get(`/faculty/${fm.id}`);
            setQrFaculty(res.data.data || fm);
        } catch (err) {
            setQrFaculty(fm);
        } finally {
            setQrLoading(false);
            setShowQrModal(true);
        }
    };

    const handleViewCredentials = async () => {
        if (selectedFaculty.length === 0) return;
        setLoadingCredentials(true);
        try {
            const res = await api.post('/faculty/credentials', { faculty_ids: selectedFaculty });
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

    const handleViewSingleCredentials = async (facultyId) => {
        setLoadingCredentials(true);
        try {
            const res = await api.post('/faculty/credentials', { faculty_ids: [facultyId] });
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

    const getBase64ImageFromUrl = async (imageUrl) => {
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(blob);
            });
        } catch (e) { return null; }
    };

    const generateIdCard = async (doc, fm, logoBase64, instName, instPhone, qrDataUrl) => {
        const designation = fm.designation || 'Faculty';
        const fName = fm.User?.name || '';
        const fEmail = fm.User?.email || '';
        const fPhone = fm.User?.phone || 'N/A';
        const joinDate = fm.join_date ? new Date(fm.join_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
        
        let teachingText = 'N/A';
        if (fm.Subjects && fm.Subjects.length > 0) {
            teachingText = fm.Subjects.map(s => s.name).join(', ');
        }

        // ── Faculty Distinct "Emerald Green" Theme ──
        doc.setFillColor(240, 253, 244); // Green-50 background (instead of blue)
        doc.rect(0, 0, 85, 155, 'F');
        doc.setFillColor(6, 78, 59); // Green-900 dark primary
        doc.rect(0, 0, 85, 28, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');

        if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', 5, 4, 20, 20);
            doc.setFontSize(10);
            doc.text(doc.splitTextToSize(instName.toUpperCase(), 50), 28, 14);
            if (instPhone) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.5);
                doc.setTextColor(209, 250, 229); // Green-100 highlight text
                doc.text(`Ph: ${instPhone}`, 28, 20);
            }
        } else {
             doc.setFontSize(11);
             const nameY = instPhone ? 12 : 16;
             doc.text(doc.splitTextToSize(instName.toUpperCase(), 72), 42.5, nameY, { align: 'center' });
             if (instPhone) {
                 doc.setFont('helvetica', 'normal');
                 doc.setFontSize(7.5);
                 doc.setTextColor(209, 250, 229);
                 doc.text(`Ph: ${instPhone}`, 42.5, 18, { align: 'center' });
             }
        }

        doc.setDrawColor(6, 78, 59); doc.setLineWidth(0.5); doc.line(6, 30, 79, 30);
        doc.setTextColor(100, 100, 120); doc.setFontSize(6);
        doc.text('QR CODE', 21, 35, { align: 'center' });
        doc.text('PHOTO', 64, 35, { align: 'center' });

        if (qrDataUrl) doc.addImage(qrDataUrl, 'PNG', 5, 37, 33, 33);
        
        doc.setFillColor(209, 250, 229); doc.rect(47, 37, 33, 33, 'F'); // Green-100
        doc.setDrawColor(167, 243, 208); doc.setLineWidth(0.3); doc.rect(47, 37, 33, 33); // Green-200
        doc.setDrawColor(16, 185, 129); doc.setLineWidth(0.2); doc.circle(63.5, 47, 4, 'S'); // Green-500
        doc.line(55, 69, 55, 60); doc.line(55, 60, 72, 60); doc.line(72, 60, 72, 69);
        doc.setTextColor(52, 211, 153); doc.setFontSize(5); doc.text('PHOTO', 63.5, 72, { align: 'center' }); // Green-400

        doc.setDrawColor(167, 243, 208); doc.setLineWidth(0.3); doc.line(6, 74, 79, 74); // Green-200

        const infoStartY = 80;
        doc.setFillColor(5, 150, 105); doc.rect(5, infoStartY - 4, 75, 8, 'F'); // Green-600 Name Banner
        doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.text(fName.toUpperCase(), 42.5, infoStartY, { align: 'center' });

        const rows = [
            { label: 'Role', value: designation },
            { label: 'Emp ID', value: `EMP-${fm.id}` },
            { label: 'Email', value: fEmail },
            { label: 'Phone', value: fPhone },
            { label: 'Teaching', value: teachingText },
            { label: 'Join Date', value: joinDate },
        ];

        let y = infoStartY + 7;
        rows.forEach((row, i) => {
            doc.setFillColor(...(i % 2 === 0 ? [240, 253, 244] : [209, 250, 229])); // Green-50 / Green-100
            doc.rect(5, y - 3.5, 75, 6.5, 'F');
            doc.setTextColor(5, 150, 105); doc.setFont('helvetica', 'bold'); doc.setFontSize(6); // Green-600 text
            doc.text(`${row.label}:`, 8, y + 0.5);
            doc.setTextColor(2, 44, 34); doc.setFont('helvetica', 'normal'); // Green-950 text
            doc.text(doc.splitTextToSize(String(row.value), 46)[0], 30, y + 0.5);
            y += 7;
        });

        doc.setFillColor(6, 78, 59); doc.rect(0, 149, 85, 6, 'F'); // Green-900 bottom footer
        doc.setTextColor(255,255,255); doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5);
        doc.text('Official Educational Staff Identity Card', 42.5, 152.5, { align: 'center' });
    };

    const handleDownloadSingleCard = async () => {
        if (!qrFaculty) return;
        setQrDownloading(true);
        try {
            const { jsPDF } = await import('jspdf');
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [85, 148] });

            let logoBase64 = null;
            if (user?.institute_logo) {
                let logoUrl = user.institute_logo;
                if (logoUrl.startsWith('/')) {
                    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
                    logoUrl = `${apiUrl.replace(/\/api\/?$/, "")}${logoUrl}`;
                }
                logoBase64 = await getBase64ImageFromUrl(logoUrl);
            }

            const qrDataUrl = await QRCode.toDataURL(`FACULTY_QR_${qrFaculty.id}`, { width: 300, margin: 1 });
            await generateIdCard(doc, qrFaculty, logoBase64, user?.institute_name || '', user?.institute_phone || '', qrDataUrl);
            await savePdfNative(doc, `${qrFaculty.User?.name || 'Faculty'}_ID_Card.pdf`);
        } catch (e) {
            alert('Failed to generate PDF: ' + e.message);
        } finally {
            setQrDownloading(false);
        }
    };

    const handleBulkDownloadCards = async () => {
        if (selectedFaculty.length === 0) return;
        setBulkDownloading(true);
        try {
            const { jsPDF } = await import('jspdf');
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [85, 148] });

            let logoBase64 = null;
            if (user?.institute_logo) {
                let logoUrl = user.institute_logo;
                if (logoUrl.startsWith('/')) {
                    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
                    logoUrl = `${apiUrl.replace(/\/api\/?$/, "")}${logoUrl}`;
                }
                logoBase64 = await getBase64ImageFromUrl(logoUrl);
            }

            let firstPage = true;
            for (const fId of selectedFaculty) {
                let fm = filteredFaculty.find(f => f.id === fId);
                if (!fm) continue;
                try {
                    const stRes = await api.get(`/faculty/${fId}`);
                    if (stRes.data && stRes.data.data) fm = stRes.data.data;
                } catch (e) {}

                if (!firstPage) doc.addPage([85, 148], 'portrait');
                firstPage = false;
                
                const qrDataUrl = await QRCode.toDataURL(`FACULTY_QR_${fm.id}`, { width: 300, margin: 1 });
                await generateIdCard(doc, fm, logoBase64, user?.institute_name || '', user?.institute_phone || '', qrDataUrl);
            }
            await savePdfNative(doc, `Bulk_Faculty_ID_Cards_${selectedFaculty.length}.pdf`);
        } catch (e) {
            alert('Download failed: ' + e.message);
        } finally {
            setBulkDownloading(false);
        }
    };

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        password: "",
        designation: "",
        salary: "",
        join_date: "",
    });

    useEffect(() => {
        fetchFaculty();
        fetchClasses();
        fetchSubjects();
    }, []);

    const hasPerm = (op) => {
        if (user?.role === 'admin' || user?.role === 'super_admin') return true;
        if (user?.role === 'manager' && user?.permissions) {
            return user.permissions.includes('faculty') || user.permissions.includes(`faculty.${op}`);
        }
        return false;
    };
    const canCreate = hasPerm('create');
    const canUpdate = hasPerm('update');
    const canDelete = hasPerm('delete');

    const fetchFaculty = async () => {
        try {
            const response = await api.get("/faculty?limit=100");
            setFaculty(response.data.data || []);
            setTotalCount(response.data.count || 0);
        } catch (error) {
            console.error("Error fetching faculty:", error);
        } finally {
            setLoading(false);
        }
    };

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
            const response = await api.get("/subjects");
            setSubjects(response.data.data || []);
        } catch (error) {
            console.error("Error fetching subjects:", error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editMode) {
                await api.put(`/faculty/${formData.id}`, formData);
                alert("Faculty updated successfully");
            } else {
                const res = await api.post("/faculty", {
                    ...formData,
                    institute_id: user.institute_id,
                });
                
                if (res.data.showPasswordOnScreen) {
                    setCredentialsData([{
                        id: res.data.data.faculty.id,
                        identifier: res.data.data.faculty.designation || 'Faculty',
                        name: res.data.data.user.name,
                        email: res.data.data.user.email || 'N/A',
                        password: res.data.initial_password
                    }]);
                    setShowCredentialsModal(true);
                } else {
                    alert("Faculty added successfully");
                }
            }
            setShowModal(false);
            resetForm();
            fetchFaculty();
        } catch (error) {
            alert("Error: " + error.response?.data?.message);
        }
    };

    const handleEdit = (facultyMember) => {
        setFormData({
            id: facultyMember.id,
            name: facultyMember.User?.name || "",
            email: facultyMember.User?.email || "",
            phone: facultyMember.User?.phone || "",
            password: "",
            designation: facultyMember.designation || "",
            salary: facultyMember.salary || "",
            join_date: facultyMember.join_date || "",
        });
        setEditMode(true);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this faculty member?")) return;

        try {
            await api.delete(`/faculty/${id}`);
            alert("Faculty deleted successfully");
            fetchFaculty();
        } catch (error) {
            alert("Error deleting faculty: " + error.response?.data?.message);
        }
    };

    const resetForm = () => {
        setFormData({
            name: "",
            email: "",
            phone: "",
            password: "",
            designation: "",
            salary: "",
            join_date: "",
        });
        setEditMode(false);
    };

    // Close action menu when clicking outside
    useEffect(() => {
        const closeMenu = () => setActionMenuOpen(null);
        window.addEventListener('click', closeMenu);
        return () => window.removeEventListener('click', closeMenu);
    }, []);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleBulkSuccess = (result) => {
        fetchFaculty();
        alert(`✅ ${result.inserted} faculty member(s) imported successfully!${result.failed > 0 ? ` (${result.failed} rows had errors)` : ''}`);
    };

    const uniqueDepartments = Array.from(new Set(subjects.map(s => s.name)));
    const uniqueDesignations = Array.from(new Set(faculty.map(f => f.designation).filter(Boolean)));

    let filteredFaculty = faculty.filter(
        (f) => {
            const safeName = f.User?.name || "";
            const safeEmail = f.User?.email || "";
            const safeDesignation = f.designation || "";
            const searchTerm = search.toLowerCase();

            const matchesSearch = 
                safeName.toLowerCase().includes(searchTerm) ||
                safeEmail.toLowerCase().includes(searchTerm) ||
                safeDesignation.toLowerCase().includes(searchTerm);

            const matchesDepartment = departmentFilter === "all" || (f.Subjects && f.Subjects.some(s => s.name === departmentFilter));
            const matchesDesignation = designationFilter === "all" || f.designation === designationFilter;
            const matchesStatus = statusFilter === "all" || f.User?.status === statusFilter;

            return matchesSearch && matchesDepartment && matchesDesignation && matchesStatus;
        }
    );

    // Apply Sorting
    filteredFaculty.sort((a, b) => {
        if (sortBy === "name") {
            const nameA = a.User?.name || "";
            const nameB = b.User?.name || "";
            return nameA.localeCompare(nameB);
        } else if (sortBy === "join_date") {
            const dateA = new Date(a.join_date || 0);
            const dateB = new Date(b.join_date || 0);
            return dateB - dateA; // Newest first
        } else if (sortBy === "salary") {
            const salA = parseFloat(a.salary) || 0;
            const salB = parseFloat(b.salary) || 0;
            return salB - salA; // Highest first
        }
        return 0;
    });

    const totalPages = Math.ceil(filteredFaculty.length / itemsPerPage);
    const paginatedFaculty = filteredFaculty.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    if (loading) {
        return <div className="students-container">Loading...</div>;
    }

    const activeFacultyCount = faculty.filter((f) => f.User?.status === "active").length;

    return (
        <div className="students-container">
            {/* ── Header ── */}
            <div className="st-header">
                <div className="st-header-top-row">
                    <div className="st-header-left">
                        <h1>Faculty Management</h1>
                        <p>Manage faculty members and their information</p>
                    </div>
                </div>
                <div className="st-header-bottom-row">
                    <div className="st-breadcrumbs">
                        <span>Dashboard</span>
                        <span>›</span>
                        <span className="active">Faculty Management</span>
                    </div>
                    <div className="st-header-actions">
                        {canCreate && (
                            <>
                                <BulkImportButton 
                                    type="faculty" 
                                    onSuccess={handleBulkSuccess} 
                                    customButton={
                                        <button className="st-btn st-btn-outline">
                                            📥 Bulk Import
                                        </button>
                                    }
                                />
                                <button onClick={() => { resetForm(); setShowModal(true); }} className="st-btn st-btn-primary">
                                    + Add Faculty
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Filters Bar ── */}
            <div className="st-filters-bar">
                <div className="st-search" style={{ flex: '1 1 100%' }}>
                    <span className="st-search-icon">🔍</span>
                    <input
                        type="text"
                        placeholder="Search by name, email, or designation..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', width: '100%' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '4px', display: 'block' }}>Department</label>
                        <select
                            className="st-select"
                            style={{ width: '100%' }}
                            value={departmentFilter}
                            onChange={(e) => {
                                setDepartmentFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                        >
                            <option value="all">All Departments</option>
                            {uniqueDepartments.map(dep => (
                                <option key={dep} value={dep}>{dep}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '4px', display: 'block' }}>Designation</label>
                        <select
                            className="st-select"
                            style={{ width: '100%' }}
                            value={designationFilter}
                            onChange={(e) => {
                                setDesignationFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                        >
                            <option value="all">All Designations</option>
                            {uniqueDesignations.map(des => (
                                <option key={des} value={des}>{des}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '4px', display: 'block' }}>Status</label>
                        <select 
                            className="st-select" 
                            style={{ width: '100%' }}
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button 
                            className="st-filter-btn"
                            style={{ height: '42px', color: (search || departmentFilter !== "all" || designationFilter !== "all" || statusFilter !== "all") ? '#ef4444' : '' }}
                            onClick={() => {
                                setSearch("");
                                setDepartmentFilter("all");
                                setDesignationFilter("all");
                                setStatusFilter("all");
                                setCurrentPage(1);
                            }}
                        >
                            <span style={{ fontSize: '1.1rem' }}>⚲</span> 
                            Clear Filters
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Stat Cards ── */}
            <div className="st-stats-grid">
                <div className="st-stat-card">
                    <div className="st-stat-top">
                        <div className="st-stat-icon st-icon-purple">👥</div>
                        <div className="st-stat-info">
                            <h3>{totalCount}</h3>
                            <p>Total Faculty</p>
                        </div>
                    </div>
                    <div className="st-stat-bottom">All faculty members</div>
                </div>
                <div className="st-stat-card">
                    <div className="st-stat-top">
                        <div className="st-stat-icon st-icon-green">✅</div>
                        <div className="st-stat-info">
                            <h3>{activeFacultyCount}</h3>
                            <p>Active</p>
                        </div>
                    </div>
                    <div className="st-stat-bottom">Currently active faculty</div>
                </div>
                <div className="st-stat-card">
                    <div className="st-stat-top">
                        <div className="st-stat-icon st-icon-blue">📚</div>
                        <div className="st-stat-info">
                            <h3>{subjects.length}</h3>
                            <p>Total Subjects</p>
                        </div>
                    </div>
                    <div className="st-stat-bottom">Across all departments</div>
                </div>
                <div className="st-stat-card">
                    <div className="st-stat-top">
                        <div className="st-stat-icon st-icon-orange">🏫</div>
                        <div className="st-stat-info">
                            <h3>{classes.length}</h3>
                            <p>Total Classes</p>
                        </div>
                    </div>
                    <div className="st-stat-bottom">Academic classes</div>
                </div>
            </div>

            {/* ── Faculty Table / Grid ── */}
            <div className="st-table-container">
                <div className="st-table-header">
                    <h2>All Faculty ({filteredFaculty.length})</h2>
                    <div className="st-table-actions">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Sort by:</span>
                            <select 
                                className="st-select" 
                                style={{ minWidth: '150px' }}
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                            >
                                <option value="name">Name (A-Z)</option>
                                <option value="join_date">Join Date</option>
                                <option value="salary">Salary</option>
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
                                    cursor: 'pointer'
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
                                    cursor: 'pointer'
                                }}
                                onClick={() => setViewMode('grid')}
                            >
                                ⊞
                            </button>
                        </div>
                    </div>
                </div>
                
                {selectedFaculty.length > 0 && (
                    <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>{selectedFaculty.length} selected</span>
                        <button className="st-btn st-btn-outline" onClick={handleViewCredentials} disabled={loadingCredentials}>
                            {loadingCredentials ? '⏳ Loading...' : '🔑 View Credentials'}
                        </button>
                        <button className="st-btn st-btn-primary" onClick={handleBulkDownloadCards} disabled={bulkDownloading}>
                            {bulkDownloading ? '⏳ Generating...' : '⬇ Download Cards'}
                        </button>
                    </div>
                )}

                {viewMode === 'list' ? (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="st-table">
                        <thead>
                            <tr>
                                <th>
                                    <input 
                                        type="checkbox" 
                                        className="st-checkbox"
                                        checked={selectedFaculty.length === filteredFaculty.length && filteredFaculty.length > 0} 
                                        onChange={handleSelectAll} 
                                    />
                                </th>
                                <th>ID</th>
                                <th>EMAIL</th>
                                <th>PHONE</th>
                                <th>DEPARTMENT</th>
                                <th>DESIGNATION</th>
                                <th>SALARY</th>
                                <th>JOIN DATE</th>
                                <th>STATUS</th>
                                <th>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedFaculty.length === 0 ? (
                                <tr>
                                    <td colSpan="10" style={{ textAlign: "center", padding: "3rem 1rem", color: '#64748b' }}>
                                        No faculty found matching your criteria
                                    </td>
                                </tr>
                            ) : (
                                paginatedFaculty.map((facultyMember) => (
                                    <tr key={facultyMember.id}>
                                        <td>
                                            <input 
                                                type="checkbox" 
                                                className="st-checkbox"
                                                checked={selectedFaculty.includes(facultyMember.id)} 
                                                onChange={() => handleSelectRow(facultyMember.id)}
                                            />
                                        </td>
                                        <td><span className="st-text-sub">F{facultyMember.id.toString().padStart(3, '0')}</span></td>
                                        <td>
                                            <div className="st-profile-col">
                                                <div className="st-avatar" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
                                                    {facultyMember.User?.name?.charAt(0)?.toUpperCase() || 'F'}
                                                </div>
                                                <div className="st-profile-info">
                                                    <strong>{facultyMember.User?.name}</strong>
                                                    <span>{facultyMember.User?.email || 'No email provided'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="st-text-main">{facultyMember.User?.phone || "N/A"}</span>
                                        </td>
                                        <td>
                                            <span className="st-text-main">
                                                {facultyMember.Subjects && facultyMember.Subjects.length > 0 
                                                    ? facultyMember.Subjects.map(s => s.name).join(", ")
                                                    : "Unassigned"}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="st-text-main">{facultyMember.designation || "N/A"}</span>
                                        </td>
                                        <td>
                                            <span className="st-text-main">₹{facultyMember.salary ? parseFloat(facultyMember.salary).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : "N/A"}</span>
                                        </td>
                                        <td>
                                            <span className="st-text-main">
                                                {facultyMember.join_date 
                                                    ? new Date(facultyMember.join_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                                    : "N/A"}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`st-status ${facultyMember.User?.status === "active" ? "" : "inactive"}`}>
                                                {facultyMember.User?.status === "active" ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="st-actions-col">
                                                <button className="st-action-chip" style={{ color: '#8b5cf6', background: '#f5f3ff', border: 'none' }} onClick={() => handleViewQr(facultyMember)}>
                                                    👁 View
                                                </button>
                                                {(canUpdate || canDelete) && (
                                                    <div className="st-menu-container">
                                                        {canUpdate && (
                                                            <button className="st-action-chip" style={{ padding: '0.4rem 0.6rem', border: '1px solid #e2e8f0', background: '#fff' }} onClick={() => handleEdit(facultyMember)}>
                                                                ✏️
                                                            </button>
                                                        )}
                                                        <button 
                                                            className="st-action-chip"
                                                            style={{ padding: '0.4rem 0.6rem', border: '1px solid #e2e8f0', background: '#fff' }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActionMenuOpen(actionMenuOpen === facultyMember.id ? null : facultyMember.id);
                                                            }}
                                                        >
                                                            ⋮
                                                        </button>
                                                        {actionMenuOpen === facultyMember.id && (
                                                            <div className="st-dropdown-menu">
                                                                <button className="st-dropdown-item" onClick={() => { setActionMenuOpen(null); handleViewSingleCredentials(facultyMember.id); }}>
                                                                    🔑 Credentials
                                                                </button>
                                                                {canDelete && (
                                                                    <button className="st-dropdown-item danger" onClick={() => { setActionMenuOpen(null); handleDelete(facultyMember.id); }}>
                                                                        🗑️ Delete
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', padding: '1rem 0' }}>
                        {paginatedFaculty.length === 0 ? (
                            <div style={{ gridColumn: '1 / -1', textAlign: "center", padding: "3rem 1rem", color: '#64748b' }}>
                                No faculty found matching your criteria
                            </div>
                        ) : (
                            paginatedFaculty.map((facultyMember) => (
                                <div key={facultyMember.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', position: 'relative' }}>
                                    <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
                                        <input 
                                            type="checkbox" 
                                            className="st-checkbox"
                                            checked={selectedFaculty.includes(facultyMember.id)} 
                                            onChange={() => handleSelectRow(facultyMember.id)}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                        <div className="st-avatar" style={{ background: '#f3e8ff', color: '#7e22ce', width: '50px', height: '50px', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                                            {facultyMember.User?.name?.charAt(0)?.toUpperCase() || 'F'}
                                        </div>
                                        <div>
                                            <strong style={{ display: 'block', fontSize: '1.1rem', color: '#1e293b' }}>{facultyMember.User?.name}</strong>
                                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{facultyMember.designation || 'Faculty'}</span>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <span style={{ width: '20px' }}>✉</span> <span style={{ wordBreak: 'break-all' }}>{facultyMember.User?.email || 'N/A'}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <span style={{ width: '20px' }}>📞</span> <span>{facultyMember.User?.phone || 'N/A'}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <span style={{ width: '20px' }}>📚</span> 
                                            <span>
                                                {facultyMember.Subjects && facultyMember.Subjects.length > 0 
                                                    ? facultyMember.Subjects.map(s => s.name).join(", ")
                                                    : "Unassigned"}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                                        <span className={`st-status ${facultyMember.User?.status === "active" ? "" : "inactive"}`}>
                                            {facultyMember.User?.status === "active" ? "Active" : "Inactive"}
                                        </span>
                                        <div className="st-actions-col">
                                            <button className="st-action-chip" style={{ color: '#8b5cf6', background: '#f5f3ff', border: 'none' }} onClick={() => handleViewQr(facultyMember)}>👁</button>
                                            {canUpdate && (
                                                <button className="st-action-chip" style={{ border: '1px solid #e2e8f0', background: '#fff' }} onClick={() => handleEdit(facultyMember)}>✏️</button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* ── Pagination UI ── */}
                {filteredFaculty.length > 0 && (
                    <div className="st-pagination-row">
                        <div className="st-pagination-info">
                            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredFaculty.length)} of {filteredFaculty.length} entries
                        </div>
                        <div className="st-pagination-controls">
                            <button 
                                className="st-page-btn" 
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            >
                                ‹
                            </button>
                            
                            {[...Array(totalPages)].map((_, i) => {
                                const page = i + 1;
                                if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                                    return (
                                        <button 
                                            key={page}
                                            className={`st-page-btn ${currentPage === page ? 'active' : ''}`}
                                            onClick={() => setCurrentPage(page)}
                                        >
                                            {page}
                                        </button>
                                    );
                                } else if (page === currentPage - 2 || page === currentPage + 2) {
                                    return <span key={page} className="st-page-ellipsis">...</span>;
                                }
                                return null;
                            })}

                            <button 
                                className="st-page-btn" 
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            >
                                ›
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Add/Edit Faculty Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
                        <div className="modal-header">
                            <h3>{editMode ? "Edit Faculty" : "Add New Faculty"}</h3>
                            <button onClick={() => setShowModal(false)} className="btn btn-sm">
                                ×
                            </button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label className="form-label">Full Name *</label>
                                    <input
                                        type="text"
                                        name="name"
                                        className="form-input"
                                        placeholder="John Doe"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Email *</label>
                                    <input
                                        type="email"
                                        name="email"
                                        className="form-input"
                                        placeholder="john@example.com"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                        disabled={editMode}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Phone</label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        className="form-input"
                                        placeholder="9876543210"
                                        value={formData.phone}
                                        onChange={handleChange}
                                    />
                                </div>

                                {!editMode && (
                                    <div className="form-group">
                                        <label className="form-label">Password *</label>
                                        <input
                                            type="password"
                                            name="password"
                                            className="form-input"
                                            placeholder="Minimum 6 characters"
                                            value={formData.password}
                                            onChange={handleChange}
                                            required={!editMode}
                                            minLength={6}
                                        />
                                    </div>
                                )}

                                <div className="form-group">
                                    <label className="form-label">Designation</label>
                                    <input
                                        type="text"
                                        name="designation"
                                        className="form-input"
                                        placeholder="e.g., Senior Teacher, HOD"
                                        value={formData.designation}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Salary (₹)</label>
                                    <input
                                        type="number"
                                        name="salary"
                                        className="form-input"
                                        placeholder="30000"
                                        value={formData.salary}
                                        onChange={handleChange}
                                        min="0"
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Join Date</label>
                                    <input
                                        type="date"
                                        name="join_date"
                                        className="form-input"
                                        value={formData.join_date}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div className="modal-footer">
                                    <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary">
                                        {editMode ? "Update Faculty" : "Add Faculty"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* ── ID Card View Modal ── */}
            {(showQrModal || qrLoading) && (
                <div
                    className="modal-overlay"
                    onClick={() => setShowQrModal(false)}
                    style={{ zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: 'var(--card-bg, #fff)',
                            borderRadius: '20px',
                            padding: '2.5rem 2rem',
                            maxWidth: '480px',
                            width: '95%',
                            boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
                            textAlign: 'center',
                            position: 'relative',
                        }}
                    >
                        {qrLoading && (
                            <div style={{ padding: '2rem', textAlign: 'center' }}>
                                <div className="loading-spinner" style={{ margin: '0 auto 1rem' }} />
                                <p style={{ color: 'var(--text-secondary, #6b7280)' }}>Loading profile data...</p>
                            </div>
                        )}

                        {!qrLoading && qrFaculty && (
                            <>
                                <div style={{
                                    width: '100%',
                                    maxWidth: '350px',
                                    margin: '0 auto 1.5rem auto',
                                    background: '#fff',
                                    border: '1px solid #e5e7eb',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                    fontFamily: 'Helvetica, Arial, sans-serif'
                                }}>
                                    {/* Header */}
                                    <div style={{
                                        background: '#064e3b',
                                        padding: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        color: '#fff'
                                    }}>
                                        {user?.institute_logo ? (
                                            <img src={user.institute_logo} alt="Logo" style={{ width: '60px', height: '60px', objectFit: 'contain', background: '#fff', borderRadius: '50%', padding: '4px' }} />
                                        ) : (
                                            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#fff', color: '#064e3b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>LOGO</div>
                                        )}
                                        <div style={{ textAlign: 'left', flex: 1 }}>
                                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', lineHeight: '1.2' }}>
                                                {user?.institute_name?.toUpperCase() || 'INSTITUTE NAME'}
                                            </div>
                                            {user?.institute_phone && (
                                                <div style={{ fontSize: '0.8rem', color: '#d1fae5', marginTop: '4px' }}>
                                                    Ph: {user.institute_phone}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ height: '3px', background: '#064e3b', borderTop: '2px solid #fff' }}></div>
                                    
                                    {/* QR & Photo area */}
                                    <div style={{ padding: '15px 15px 5px 15px', display: 'flex', justifyContent: 'space-between', gap: '15px' }}>
                                        <div style={{ flex: 1, textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' }}>QR CODE</div>
                                            <QRCodeSVG
                                                value={`FACULTY_QR_${qrFaculty.id}`}
                                                size={110}
                                                level="H"
                                                includeMargin={false}
                                                style={{ display: 'block', margin: '0 auto' }}
                                            />
                                        </div>
                                        <div style={{ flex: 1, textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' }}>PHOTO</div>
                                            <div style={{
                                                width: '110px', height: '110px', background: '#d1fae5', margin: '0 auto',
                                                border: '1px solid #a7f3d0', position: 'relative', overflow: 'hidden'
                                            }}>
                                                <div style={{ width: '30px', height: '30px', borderRadius: '50%', border: '2px solid #34d399', margin: '15px auto 0' }}></div>
                                                <div style={{ width: '70px', height: '40px', border: '2px solid #34d399', margin: '10px auto 0', borderBottom: 'none' }}></div>
                                                <div style={{ position: 'absolute', bottom: '4px', width: '100%', textAlign: 'center', fontSize: '0.6rem', color: '#10b981' }}>PHOTO</div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div style={{ borderTop: '2px solid #a7f3d0', margin: '10px 15px' }}></div>
                                    
                                    {/* Faculty Details */}
                                    <div style={{ padding: '0 15px 15px 15px' }}>
                                        <div style={{ background: '#059669', color: '#fff', padding: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '1rem', marginBottom: '10px' }}>
                                            {qrFaculty.User?.name?.toUpperCase() || 'FACULTY NAME'}
                                        </div>
                                        
                                        <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                                            <tbody>
                                                {[
                                                    { label: 'Role', value: qrFaculty.designation || 'Faculty' },
                                                    { label: 'Emp ID', value: `EMP-${qrFaculty.id}` },
                                                    { label: 'Email', value: qrFaculty.User?.email || 'N/A' },
                                                    { label: 'Phone', value: qrFaculty.User?.phone || 'N/A' },
                                                    { label: 'Teaching', value: (qrFaculty.Subjects && qrFaculty.Subjects.length > 0) ? qrFaculty.Subjects.map(s => s.name).join(', ') : 'N/A' },
                                                    { label: 'Join Date', value: qrFaculty.join_date ? new Date(qrFaculty.join_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A' }
                                                ].map((row, i) => (
                                                    <tr key={i} style={{ background: i % 2 === 0 ? '#f0fdf4' : '#d1fae5' }}>
                                                        <td style={{ padding: '6px 8px', fontWeight: 'bold', color: '#059669', width: '70px' }}>{row.label}:</td>
                                                        <td style={{ padding: '6px 8px', color: '#022c22', wordBreak: 'break-word' }}>{row.value}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => setShowQrModal(false)}
                                        style={{ flex: '1', minWidth: 120, borderRadius: '10px', fontWeight: 600 }}
                                    >
                                        ← Back
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        style={{
                                            flex: '1', minWidth: 120, borderRadius: '10px', fontWeight: 600,
                                            background: 'linear-gradient(135deg, #059669, #047857)',
                                            border: 'none', opacity: qrDownloading ? 0.7 : 1
                                        }}
                                        onClick={handleDownloadSingleCard}
                                        disabled={qrDownloading}
                                    >
                                        {qrDownloading ? '⏳ Generating...' : '⬇ Download Card'}
                                    </button>
                                </div>
                            </>
                        )}
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
                                    Faculty Credentials
                                </h3>
                                <p style={{ margin: '0.2rem 0 0 0', opacity: 0.9, fontSize: '0.85rem' }}>
                                    Manage initial passwords for faculty members
                                </p>
                            </div>
                            <button onClick={() => setShowCredentialsModal(false)} className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none' }}>×</button>
                        </div>
                        
                        <div className="modal-body" style={{ padding: '1.5rem', maxHeight: '60vh', overflowY: 'auto' }}>
                            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-color, #e5e7eb)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                                        <tr>
                                            <th style={{ padding: '0.8rem 1rem', color: '#475569', fontWeight: 600 }}>Role</th>
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
                                                    onReset={async (facultyId) => {
                                                        try {
                                                            const res = await api.post(`/faculty/${facultyId}/resend-credentials`);
                                                            if (res.data.success && res.data.initial_password) {
                                                                setCredentialsData(prev => prev.map(x =>
                                                                    x.id === facultyId
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
                                    <strong>Security Note:</strong> Initial passwords are visible only until the faculty member logs in and changes their password.
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Faculty;

