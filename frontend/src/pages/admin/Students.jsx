/**
 * Students Management Page
 * Complete CRUD for student management with class assignment and statistics
 */

import { useState, useEffect, useContext, useRef } from "react";
import ThemeSelector from "../../components/ThemeSelector";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import QRCode from "qrcode";
import "./Students.css";
import { savePdfNative } from "../../utils/capacitorPermissions";
import BulkImportButton from "../../components/BulkImportButton";

import CredentialRow from "../../components/common/CredentialRow";


function Students() {
    const { user } = useContext(AuthContext);
    const [students, setStudents] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [search, setSearch] = useState("");
    const [classFilter, setClassFilter] = useState("all");
    const [sectionFilter, setSectionFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [availableSubjects, setAvailableSubjects] = useState([]); // Add specific subjects based on class

    // QR Modal state
    const [showQrModal, setShowQrModal] = useState(false);
    const [qrStudent, setQrStudent] = useState(null);
    const [qrDownloading, setQrDownloading] = useState(false);
    const [qrLoading, setQrLoading] = useState(false);
    const qrCanvasRef = useRef(null);

    // Bulk selection state
    const [selectedStudents, setSelectedStudents] = useState([]);
    const [bulkDownloading, setBulkDownloading] = useState(false);
    const [showCredentialsModal, setShowCredentialsModal] = useState(false);
    const [credentialsData, setCredentialsData] = useState([]);
    const [loadingCredentials, setLoadingCredentials] = useState(false);
    const [actionMenuOpen, setActionMenuOpen] = useState(null); // Track which row's menu is open

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Click outside to close action menu
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.st-menu-container')) {
                setActionMenuOpen(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedStudents(filteredStudents.map(s => s.id));
        } else {
            setSelectedStudents([]);
        }
    };

    const handleSelectRow = (id) => {
        setSelectedStudents(prev => 
            prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
        );
    };

    // Fast Bulk Image Loader
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
        } catch (e) {
            return null;
        }
    };

    const handleBulkDownloadCards = async () => {
        if (selectedStudents.length === 0) return;
        setBulkDownloading(true);
        try {
            const { jsPDF } = await import('jspdf');
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [85, 148] });

            const instName = user?.institute_name || 'Institute Name';
            const instPhone = user?.institute_phone || '';

            // Prefetch Logo natively once
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

            for (const studentId of selectedStudents) {
                // We strongly require nested relational data (Parents) which the global filtered list usually omits for performance.
                let student = filteredStudents.find(s => s.id === studentId);
                if (!student) continue;

                try {
                    // Try fetch the deep profile, falling back gracefully to the shallow list object on failure
                    const stRes = await api.get(`/students/${studentId}`);
                    if (stRes.data && stRes.data.data) {
                        student = stRes.data.data;
                    }
                } catch (e) {
                    console.warn(`Could not fetch deep details for ${studentId}, using list fallback.`);
                }
                
                // Add new page only after the first one
                if (!firstPage) {
                    doc.addPage([85, 148], 'portrait');
                }
                firstPage = false;

                const studentName = student.User?.name || '';
                const studentEmail = student.User?.email || '';
                const gender = student.gender || 'N/A';
                const rollNo = student.roll_number || '';
                const parentObj = student.Parents?.[0];
                const parentName = parentObj?.name || student.parent_name || 'N/A';
                const parentPhone = parentObj?.phone || parentObj?.User?.phone || '';
                const classText = student.Classes?.map(c => `${c.name}${c.section ? ` - ${c.section}` : ''}`).join(', ') || 'N/A';
                const address = student.address || 'N/A';

                // We generate the QR base64 incredibly efficiently in-memory instead of scraping DOM!
                const qrDataUrl = await QRCode.toDataURL(`STUDENT_QR_${student.id}`, { width: 300, margin: 1 });

                // ── Draw Card Layout ──
                doc.setFillColor(245, 247, 255);
                doc.rect(0, 0, 85, 155, 'F');

                doc.setFillColor(30, 58, 138); 
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
                        doc.setTextColor(219, 234, 254);
                        doc.text(`Ph: ${instPhone}`, 28, 20);
                    }
                } else {
                    doc.setFontSize(11);
                    const nameY = instPhone ? 12 : 16;
                    doc.text(doc.splitTextToSize(instName.toUpperCase(), 72), 42.5, nameY, { align: 'center' });
                    if (instPhone) {
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(7.5);
                        doc.setTextColor(219, 234, 254);
                        doc.text(`Ph: ${instPhone}`, 42.5, 18, { align: 'center' });
                    }
                }

                doc.setDrawColor(30, 58, 138);
                doc.setLineWidth(0.5);
                doc.line(6, 30, 79, 30);

                doc.setTextColor(100, 100, 120);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(6);
                doc.text('QR CODE', 21, 35, { align: 'center' });
                doc.text('PHOTO', 64, 35, { align: 'center' });

                if (qrDataUrl) {
                    doc.addImage(qrDataUrl, 'PNG', 5, 37, 33, 33);
                }
                
                doc.setFillColor(220, 224, 240);
                doc.rect(47, 37, 33, 33, 'F');
                doc.setDrawColor(180, 190, 220);
                doc.setLineWidth(0.3); doc.rect(47, 37, 33, 33);
                doc.setDrawColor(150, 160, 190);
                doc.setLineWidth(0.2); doc.circle(63.5, 47, 4, 'S');
                doc.line(55, 69, 55, 60); doc.line(55, 60, 72, 60); doc.line(72, 60, 72, 69);
                doc.setTextColor(140,150,185);
                doc.setFontSize(5);
                doc.text('PHOTO', 63.5, 72, { align: 'center' });

                doc.setDrawColor(200, 205, 225);
                doc.setLineWidth(0.3); doc.line(6, 74, 79, 74);

                const infoStartY = 80;
                doc.setFillColor(102, 126, 234);
                doc.rect(5, infoStartY - 4, 75, 8, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.text(studentName.toUpperCase(), 42.5, infoStartY, { align: 'center' });

                const rows = [
                    { label: 'Roll No', value: rollNo || 'N/A' },
                    { label: 'Parent', value: parentName },
                    { label: 'Email', value: studentEmail },
                    { label: 'Parent Ph', value: parentPhone || 'N/A' },
                    { label: 'Class', value: classText },
                    { label: 'Gender', value: gender },
                    { label: 'Address', value: address },
                ];

                let y = infoStartY + 7;
                rows.forEach((row, i) => {
                    doc.setFillColor(...(i % 2 === 0 ? [245, 247, 255] : [235, 238, 255]));
                    doc.rect(5, y - 3.5, 75, 6.5, 'F');
                    doc.setTextColor(102, 126, 234);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(6);
                    doc.text(`${row.label}:`, 8, y + 0.5);
                    doc.setTextColor(40, 40, 70);
                    doc.setFont('helvetica', 'normal');
                    doc.text(doc.splitTextToSize(String(row.value), 46)[0], 30, y + 0.5);
                    y += 7;
                });

                doc.setFillColor(102, 126, 234);
                doc.rect(0, 149, 85, 6, 'F');
                doc.setTextColor(255,255,255);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(5.5);
                doc.text('Official Student Identity Card', 42.5, 152.5, { align: 'center' });
            }

            await savePdfNative(doc, `Bulk_Student_ID_Cards_${selectedStudents.length}.pdf`);
        } catch (err) {
            console.error('Bulk PDF download error:', err);
            alert('Download failed: ' + err.message);
        } finally {
            setBulkDownloading(false);
            // Optionally clear selection after download: 
            // setSelectedStudents([]);
        }
    };

    const handleExport = async () => {
        try {
            const XLSX = await import('xlsx');
            const dataToExport = filteredStudents.map(s => ({
                Name: s.User?.name || 'N/A',
                Email: s.User?.email || 'N/A',
                Phone: s.User?.phone || 'N/A',
                Roll_Number: s.roll_number || 'N/A',
                Class: s.Classes?.map(c => `${c.name} - ${c.section}`).join(', ') || 'N/A',
                Gender: s.gender || 'N/A',
                Status: s.User?.status || 'N/A',
                Admission_Date: s.admission_date ? new Date(s.admission_date).toLocaleDateString() : 'N/A'
            }));
            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Students");
            XLSX.writeFile(wb, "Students_Export.xlsx");
        } catch (err) {
            console.error("Export error:", err);
            alert("Failed to export data");
        }
    };

    const handleViewCredentials = async () => {
        if (selectedStudents.length === 0) return;
        setLoadingCredentials(true);
        try {
            const res = await api.post('/students/credentials', { student_ids: selectedStudents });
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

    const handleViewSingleCredentials = async (studentId) => {
        setLoadingCredentials(true);
        try {
            const res = await api.post('/students/credentials', { student_ids: [studentId] });
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

    // Fetch full student details (including parents) then open QR modal
    const handleViewQr = async (student) => {
        setQrLoading(true);
        try {
            const res = await api.get(`/students/${student.id}`);
            setQrStudent(res.data.data || student);
        } catch (err) {
            console.error('Failed to fetch student details for QR:', err);
            // Fallback to list data
            setQrStudent(student);
        } finally {
            setQrLoading(false);
            setShowQrModal(true);
        }
    };

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        password: "",
        roll_number: "",
        class_ids: [],
        date_of_birth: "",
        gender: "male",
        address: "",
        admission_date: "",
        subject_ids: [],
        status: "active",
    });

    useEffect(() => {
        fetchClasses();
    }, []);

    useEffect(() => {
        const id = setTimeout(fetchStudents, 250);
        return () => clearTimeout(id);
    }, [search, classFilter]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [search, classFilter]);

    const hasPerm = (op) => {
        if (user?.role === 'admin' || user?.role === 'super_admin') return true;
        if (user?.role === 'manager' && user?.permissions) {
            return user.permissions.includes('students') || user.permissions.includes(`students.${op}`);
        }
        return false;
    };
    const canCreate = hasPerm('create');
    const canUpdate = hasPerm('update');
    const canDelete = hasPerm('delete');

    const fetchStudents = async () => {
        try {
            const params = new URLSearchParams({ limit: "100" });
            if (search.trim()) params.set("search", search.trim());
            if (classFilter !== "all") params.set("class_id", classFilter);
            const response = await api.get(`/students?${params.toString()}`);
            setStudents(response.data.data || []);
            setTotalCount(response.data.count || 0);
        } catch (error) {
            console.error("Error fetching students:", error);
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

    const fetchSubjects = async (classIds) => {
        if (!classIds || classIds.length === 0) {
            setAvailableSubjects([]);
            return;
        }
        try {
            // Fetch subjects for each class and combine them
            // Depending on the backend route implementation it might not accept multiple, so we do it iteratively
            let allSubjects = [];
            for (let id of classIds) {
                const response = await api.get(`/subjects?class_id=${id}`);
                allSubjects = [...allSubjects, ...(response.data.data || [])];
            }

            // Remove duplicates
            const uniqueSubjects = [];
            const seen = new Set();
            for (let subject of allSubjects) {
                if (!seen.has(subject.id)) {
                    seen.add(subject.id);
                    uniqueSubjects.push(subject);
                }
            }

            // Add Full Course option at the beginning
            uniqueSubjects.unshift({ id: "full_course", name: "All Subjects (Full Course)" });

            setAvailableSubjects(uniqueSubjects);
        } catch (error) {
            console.error("Error fetching subjects:", error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Frontend validation for mandatory date fields
        if (!formData.date_of_birth) {
            alert("Date of Birth is required. Please enter the student's date of birth.");
            return;
        }
        if (!formData.admission_date) {
            alert("Admission Date is required. Please enter the student's admission date.");
            return;
        }

        try {
            if (editMode) {
                await api.put(`/students/${formData.id}`, formData);
                alert("Student updated successfully");
            } else {
                const res = await api.post("/students", formData);
                if (res.data.showPasswordOnScreen) {
                    setCredentialsData([{
                        id: res.data.data.student.id,
                        roll_number: res.data.data.student.roll_number,
                        name: res.data.data.user.name,
                        email: res.data.data.user.email || 'N/A',
                        password: res.data.initial_password
                    }]);
                    setShowCredentialsModal(true);
                } else {
                    alert("Student added successfully. Credentials sent to student's email.");
                }
            }
            setShowModal(false);
            resetForm();
            fetchStudents();
        } catch (error) {
            // Display backend error message for all error types
            const errorMessage = error.response?.data?.message || "Something went wrong";
            alert(errorMessage);
            console.error("Error details:", error.response?.data);
        }
    };

    const handleEdit = (student) => {
        setFormData({
            id: student.id,
            name: student.User?.name || "",
            email: student.User?.email || "",
            phone: student.User?.phone || "",
            password: "",
            roll_number: student.roll_number || "",
            class_ids: student.Classes ? student.Classes.map(c => c.id.toString()) : [],
            admission_date: student.admission_date || "",
            date_of_birth: student.date_of_birth || "",
            gender: student.gender || "male",
            address: student.address || "",
            status: student.User?.status || "active",
            subject_ids: [
                ...(student.is_full_course ? ["full_course"] : []),
                ...(student.Subjects ? student.Subjects.map(sub => sub.id.toString()) : [])
            ]
        });

        const c_ids = student.Classes ? student.Classes.map(c => c.id.toString()) : [];
        if (c_ids.length > 0) {
            fetchSubjects(c_ids);
        } else {
            setAvailableSubjects([]);
        }
        setEditMode(true);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this student?")) return;

        try {
            await api.delete(`/students/${id}`);
            alert("Student deleted successfully");
            fetchStudents();
        } catch (error) {
            alert("Error deleting student: " + error.response?.data?.message);
        }
    };

    const resetForm = () => {
        setFormData({
            name: "",
            email: "",
            phone: "",
            password: "",
            roll_number: "",
            class_ids: [],
            date_of_birth: "",
            gender: "male",
            address: "",
            admission_date: "",
            subject_ids: [],
            status: "active",
        });
        setAvailableSubjects([]);
        setEditMode(false);
    };

    const handleBulkSuccess = (result) => {
        fetchStudents();
        alert(`✅ ${result.inserted} student(s) imported successfully!${result.failed > 0 ? ` (${result.failed} rows had errors — check the report)` : ''}`);
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleClassChange = (e) => {
        const options = e.target.options;
        const selectedClasses = [];
        for (let i = 0; i < options.length; i++) {
            if (options[i].selected) {
                selectedClasses.push(options[i].value);
            }
        }

        fetchSubjects(selectedClasses);

        setFormData({
            ...formData,
            class_ids: selectedClasses,
            subject_ids: [],
        });
    };

    const handleSubjectChange = (e) => {
        const options = e.target.options;
        const selectedSubjects = [];
        for (let i = 0; i < options.length; i++) {
            if (options[i].selected) {
                selectedSubjects.push(options[i].value);
            }
        }
        setFormData({
            ...formData,
            subject_ids: selectedSubjects,
        });
    };

    // Filter students
    const filteredStudents = students.filter((s) => {
        const matchesSearch =
            s.User?.name.toLowerCase().includes(search.toLowerCase()) ||
            s.User?.email.toLowerCase().includes(search.toLowerCase()) ||
            s.roll_number.toLowerCase().includes(search.toLowerCase());

        const matchesClass =
            classFilter === "all" || (s.Classes && s.Classes.some(c => c.id === parseInt(classFilter)));

        const matchesSection = 
            sectionFilter === "all" || (s.Classes && s.Classes.some(c => c.section === sectionFilter));

        const matchesStatus = 
            statusFilter === "all" || s.User?.status === statusFilter;

        return matchesSearch && matchesClass && matchesSection && matchesStatus;
    });

    // Pagination Logic
    const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
    const paginatedStudents = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    if (loading) {
        return <div className="students-container">Loading...</div>;
    }

    const activeStudentsCount = students.filter((s) => s.User?.status === "active").length;
    const enrollmentRate = students.length > 0
        ? Math.round((students.filter((s) => s.Classes && s.Classes.length > 0).length / students.length) * 100)
        : 0;

    return (
        <div className="students-container">
            {/* ── Header ── */}
            <div className="st-header">
                <div className="st-header-top-row">
                    <div className="st-header-left">
                        <h1>Student Management</h1>
                        <p>Manage students and enrollments</p>
                    </div>
                </div>
                <div className="st-header-bottom-row">
                    <div className="st-breadcrumbs">
                        <span>Dashboard</span>
                        <span>›</span>
                        <span className="active">Students</span>
                    </div>
                    <div className="st-header-actions">
                        {canCreate && (
                            <>
                                <BulkImportButton 
                                    type="students" 
                                    onSuccess={handleBulkSuccess} 
                                    customButton={
                                        <button className="st-btn st-btn-outline">
                                            📥 Import Students
                                        </button>
                                    }
                                />
                                <button onClick={() => { resetForm(); setShowModal(true); }} className="st-btn st-btn-primary">
                                    + Add Student
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Filters Bar ── */}
            <div className="st-filters-bar">
                <div className="st-search">
                    <span className="st-search-icon">🔍</span>
                    <input
                        type="text"
                        placeholder="Search by name, email, roll number or phone..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="st-select"
                    value={classFilter}
                    onChange={(e) => {
                        setClassFilter(e.target.value);
                        setSectionFilter("all"); // Reset section when class changes
                    }}
                >
                    <option value="all">All Classes</option>
                    {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>
                <select 
                    className="st-select" 
                    value={sectionFilter}
                    onChange={(e) => setSectionFilter(e.target.value)}
                >
                    <option value="all">All Sections</option>
                    {/* Extract unique sections from the selected class or all classes */}
                    {Array.from(new Set(
                        classes
                            .filter(c => classFilter === "all" || c.id === parseInt(classFilter))
                            .map(c => c.section)
                            .filter(Boolean)
                    )).map(section => (
                        <option key={section} value={section}>Section {section}</option>
                    ))}
                </select>
                <select 
                    className="st-select" 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="all">🟢 All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
                <button 
                    className="st-filter-btn"
                    onClick={() => {
                        setSearch("");
                        setClassFilter("all");
                        setSectionFilter("all");
                        setStatusFilter("all");
                    }}
                    style={{ color: (search || classFilter !== "all" || sectionFilter !== "all" || statusFilter !== "all") ? '#ef4444' : '' }}
                >
                    <span style={{ fontSize: '1.1rem' }}>⚲</span> 
                    {(search || classFilter !== "all" || sectionFilter !== "all" || statusFilter !== "all") ? 'Clear Filters' : 'Filters'}
                </button>
            </div>

            {/* ── Stat Cards ── */}
            <div className="st-stats-grid">
                <div className="st-stat-card">
                    <div className="st-stat-top">
                        <div className="st-stat-icon st-icon-purple">👥</div>
                        <div className="st-stat-info">
                            <h3>{totalCount}</h3>
                            <p>Total Students</p>
                        </div>
                    </div>
                    <div className="st-stat-bottom">All registered students</div>
                    <svg className="st-sparkline" viewBox="0 0 100 30" preserveAspectRatio="none">
                        <defs><linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25"/><stop offset="100%" stopColor="#8b5cf6" stopOpacity="0"/></linearGradient></defs>
                        <path d="M5 30 L 5 26 L 25 26 L 45 14 L 65 18 L 95 5 L 95 30 Z" fill="url(#purpleGrad)" />
                        <path d="M5 26 L 25 26 L 45 14 L 65 18 L 95 5" fill="none" stroke="#8b5cf6" strokeWidth="1.5" />
                        <circle cx="5" cy="26" r="1.5" fill="#fff" stroke="#8b5cf6" strokeWidth="1" />
                        <circle cx="25" cy="26" r="1.5" fill="#fff" stroke="#8b5cf6" strokeWidth="1" />
                        <circle cx="45" cy="14" r="1.5" fill="#fff" stroke="#8b5cf6" strokeWidth="1" />
                        <circle cx="65" cy="18" r="1.5" fill="#fff" stroke="#8b5cf6" strokeWidth="1" />
                        <circle cx="95" cy="5" r="1.5" fill="#fff" stroke="#8b5cf6" strokeWidth="1" />
                    </svg>
                </div>
                <div className="st-stat-card">
                    <div className="st-stat-top">
                        <div className="st-stat-icon st-icon-green">✅</div>
                        <div className="st-stat-info">
                            <h3>{activeStudentsCount}</h3>
                            <p>Active Students</p>
                        </div>
                    </div>
                    <div className="st-stat-bottom">Currently active students</div>
                    <svg className="st-sparkline" viewBox="0 0 100 30" preserveAspectRatio="none">
                        <defs><linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity="0.25"/><stop offset="100%" stopColor="#10b981" stopOpacity="0"/></linearGradient></defs>
                        <path d="M5 30 L 5 24 L 25 18 L 45 20 L 65 8 L 95 12 L 95 30 Z" fill="url(#greenGrad)" />
                        <path d="M5 24 L 25 18 L 45 20 L 65 8 L 95 12" fill="none" stroke="#10b981" strokeWidth="1.5" />
                        <circle cx="5" cy="24" r="1.5" fill="#fff" stroke="#10b981" strokeWidth="1" />
                        <circle cx="25" cy="18" r="1.5" fill="#fff" stroke="#10b981" strokeWidth="1" />
                        <circle cx="45" cy="20" r="1.5" fill="#fff" stroke="#10b981" strokeWidth="1" />
                        <circle cx="65" cy="8" r="1.5" fill="#fff" stroke="#10b981" strokeWidth="1" />
                        <circle cx="95" cy="12" r="1.5" fill="#fff" stroke="#10b981" strokeWidth="1" />
                    </svg>
                </div>
                <div className="st-stat-card">
                    <div className="st-stat-top">
                        <div className="st-stat-icon st-icon-blue">🏫</div>
                        <div className="st-stat-info">
                            <h3>{classes.length}</h3>
                            <p>Active Classes</p>
                        </div>
                    </div>
                    <div className="st-stat-bottom">Classes have students</div>
                    <svg className="st-sparkline" viewBox="0 0 100 30" preserveAspectRatio="none">
                        <defs><linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25"/><stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/></linearGradient></defs>
                        <path d="M5 30 L 5 26 L 25 26 L 45 16 L 65 12 L 95 4 L 95 30 Z" fill="url(#blueGrad)" />
                        <path d="M5 26 L 25 26 L 45 16 L 65 12 L 95 4" fill="none" stroke="#3b82f6" strokeWidth="1.5" />
                        <circle cx="5" cy="26" r="1.5" fill="#fff" stroke="#3b82f6" strokeWidth="1" />
                        <circle cx="25" cy="26" r="1.5" fill="#fff" stroke="#3b82f6" strokeWidth="1" />
                        <circle cx="45" cy="16" r="1.5" fill="#fff" stroke="#3b82f6" strokeWidth="1" />
                        <circle cx="65" cy="12" r="1.5" fill="#fff" stroke="#3b82f6" strokeWidth="1" />
                        <circle cx="95" cy="4" r="1.5" fill="#fff" stroke="#3b82f6" strokeWidth="1" />
                    </svg>
                </div>
                <div className="st-stat-card">
                    <div className="st-stat-top">
                        <div className="st-stat-icon st-icon-orange">📄</div>
                        <div className="st-stat-info">
                            <h3>{enrollmentRate}%</h3>
                            <p>Enrollment Rate</p>
                        </div>
                    </div>
                    <div className="st-stat-bottom">Based on active classes</div>
                    <svg className="st-sparkline" viewBox="0 0 100 30" preserveAspectRatio="none">
                        <defs><linearGradient id="orangeGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity="0.25"/><stop offset="100%" stopColor="#f97316" stopOpacity="0"/></linearGradient></defs>
                        <path d="M5 30 L 5 26 L 25 26 L 45 20 L 65 22 L 85 12 L 95 2 L 95 30 Z" fill="url(#orangeGrad)" />
                        <path d="M5 26 L 25 26 L 45 20 L 65 22 L 85 12 L 95 2" fill="none" stroke="#f97316" strokeWidth="1.5" />
                        <circle cx="5" cy="26" r="1.5" fill="#fff" stroke="#f97316" strokeWidth="1" />
                        <circle cx="25" cy="26" r="1.5" fill="#fff" stroke="#f97316" strokeWidth="1" />
                        <circle cx="45" cy="20" r="1.5" fill="#fff" stroke="#f97316" strokeWidth="1" />
                        <circle cx="65" cy="22" r="1.5" fill="#fff" stroke="#f97316" strokeWidth="1" />
                        <circle cx="85" cy="12" r="1.5" fill="#fff" stroke="#f97316" strokeWidth="1" />
                        <circle cx="95" cy="2" r="1.5" fill="#fff" stroke="#f97316" strokeWidth="1" />
                    </svg>
                </div>
            </div>

            {/* ── Students Table ── */}
            <div className="st-table-container">
                <div className="st-table-header">
                    <h2>All Students ({filteredStudents.length})</h2>
                    <div className="st-table-actions">
                        <button className="st-btn st-btn-outline" onClick={handleExport}>
                            <span style={{ fontSize: '1.1rem' }}>📥</span> Export
                        </button>
                        <button className="st-btn st-btn-outline" style={{ padding: '0.5rem' }} onClick={() => alert("Table settings coming soon!")}>
                            <span style={{ fontSize: '1.2rem' }}>⚙</span>
                        </button>
                    </div>
                </div>
                
                {selectedStudents.length > 0 && (
                    <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>{selectedStudents.length} selected</span>
                        <button className="st-btn st-btn-outline" onClick={handleViewCredentials} disabled={loadingCredentials}>
                            {loadingCredentials ? '⏳ Loading...' : '🔑 View Credentials'}
                        </button>
                        <button className="st-btn st-btn-primary" onClick={handleBulkDownloadCards} disabled={bulkDownloading}>
                            {bulkDownloading ? '⏳ Generating...' : '⬇ Download Cards'}
                        </button>
                    </div>
                )}

                <div style={{ overflowX: 'auto' }}>
                    <table className="st-table">
                        <thead>
                            <tr>
                                <th>
                                    <input 
                                        type="checkbox" 
                                        className="st-checkbox"
                                        checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0} 
                                        onChange={handleSelectAll} 
                                    />
                                </th>
                                <th>STUDENT</th>
                                <th>ROLL NO.</th>
                                <th>CLASS</th>
                                <th>CONTACT</th>
                                <th>ADMISSION DATE</th>
                                <th>STATUS</th>
                                <th>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedStudents.length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: "center", padding: "3rem 1rem", color: '#64748b' }}>
                                        No students found matching your criteria
                                    </td>
                                </tr>
                            ) : (
                                paginatedStudents.map((student) => (
                                    <tr key={student.id}>
                                        <td>
                                            <input 
                                                type="checkbox" 
                                                className="st-checkbox"
                                                checked={selectedStudents.includes(student.id)} 
                                                onChange={() => handleSelectRow(student.id)}
                                            />
                                        </td>
                                        <td>
                                            <div className="st-profile-col">
                                                <div className="st-avatar">
                                                    {student.User?.name?.charAt(0)?.toUpperCase() || 'S'}
                                                </div>
                                                <div className="st-profile-info">
                                                    <strong>{student.User?.name}</strong>
                                                    <span>{student.User?.email || 'No email provided'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="st-text-main">{student.roll_number}</span>
                                        </td>
                                        <td>
                                            <span className="st-text-main">
                                                {student.Classes && student.Classes.length > 0 
                                                    ? student.Classes.map(c => `${c.name}${c.section ? ` - Section ${c.section}` : ""}`).join(", ")
                                                    : "Unassigned"}
                                            </span>
                                            <span className="st-text-sub" style={{ display: 'block', marginTop: '0.25rem' }}>
                                                {student.is_full_course ? "All Subjects (Full Course)" : student.Subjects?.map(s => s.name).join(", ")}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="st-contact-col">
                                                <div className="st-contact-item">
                                                    📞 {student.User?.phone || 'N/A'}
                                                </div>
                                                <div className="st-contact-item">
                                                    ✉ {student.User?.email || 'N/A'}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="st-text-main">
                                                {student.admission_date 
                                                    ? new Date(student.admission_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                                    : "N/A"}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`st-status ${student.User?.status === "active" ? "" : "inactive"}`}>
                                                {student.User?.status === "active" ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="st-actions-col">
                                                <button className="st-action-chip" onClick={() => handleViewQr(student)}>
                                                    🪪 View Card
                                                </button>
                                                <button className="st-action-chip" onClick={() => handleViewSingleCredentials(student.id)}>
                                                    🔑 Credentials
                                                </button>
                                                {(canUpdate || canDelete) && (
                                                    <div className="st-menu-container">
                                                        <button 
                                                            className="st-menu-btn"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActionMenuOpen(actionMenuOpen === student.id ? null : student.id);
                                                            }}
                                                        >
                                                            ⋮
                                                        </button>
                                                        {actionMenuOpen === student.id && (
                                                            <div className="st-dropdown-menu">
                                                                {canUpdate && (
                                                                    <button className="st-dropdown-item" onClick={() => { setActionMenuOpen(null); handleEdit(student); }}>
                                                                        ✏️ Edit Student
                                                                    </button>
                                                                )}
                                                                {canDelete && (
                                                                    <button className="st-dropdown-item danger" onClick={() => { setActionMenuOpen(null); handleDelete(student.id); }}>
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
                
                {/* ── Pagination UI ── */}
                {filteredStudents.length > 0 && (
                    <div className="st-pagination-row">
                        <div className="st-pagination-info">
                            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredStudents.length)} of {filteredStudents.length} students
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
                                // Show first, last, and pages around current page
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
                            
                            <select 
                                className="st-page-select" 
                                value={itemsPerPage} 
                                onChange={(e) => {
                                    setItemsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                            >
                                <option value="10">10 / page</option>
                                <option value="25">25 / page</option>
                                <option value="50">50 / page</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* ── MOBILE CARD LIST (shown on mobile via responsive.css) ── */}
                <div className="admin-mobile-cards card-stagger">
                    {filteredStudents.length === 0 ? (
                        <div className="empty-state-mobile">
                            <div className="empty-icon">🎓</div>
                            <div className="empty-title">No Students Found</div>
                            <div className="empty-desc">No students match your search or filter.</div>
                        </div>
                    ) : (
                        filteredStudents.map((student) => (
                            <div key={student.id} className="admin-item-card">
                                <div className="aic-info">
                                    <div className="aic-name">
                                        {student.User?.name}
                                        <span className="aic-badge">
                                            <span className={`badge badge-${student.User?.status === 'active' ? 'success' : 'danger'}`}>
                                                {student.User?.status}
                                            </span>
                                        </span>
                                    </div>
                                    <div className="aic-sub">
                                        Roll: <strong>{student.roll_number}</strong> · {student.User?.email}
                                    </div>
                                    <div className="aic-sub">
                                        {student.Classes?.map(c => `${c.name}${c.section ? ` - ${c.section}` : ''}`).join(', ') || 'Unassigned'}
                                        {student.is_full_course && ' · Full Course'}
                                    </div>
                                </div>
                                <div className="aic-actions">
                                    <button
                                        className="btn btn-sm"
                                        style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.75rem' }}
                                        onClick={() => handleViewQr(student)}
                                    >View Card</button>
                                    {canUpdate && (
                                        <button className="btn btn-sm btn-primary" onClick={() => handleEdit(student)}>Edit</button>
                                    )}
                                    {canDelete && (
                                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(student.id)}>Del</button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

            {/* ── QR Code View Modal ── */}
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
                        {/* Loading state */}
                        {qrLoading && (
                            <div style={{ padding: '2rem', textAlign: 'center' }}>
                                <div className="loading-spinner" style={{ margin: '0 auto 1rem' }} />
                                <p style={{ color: 'var(--text-secondary, #6b7280)' }}>Loading QR Code...</p>
                            </div>
                        )}

                        {/* QR Content */}
                        {!qrLoading && qrStudent && (<>
                        {/* ID Card Preview Content */}
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
                                background: '#1e3a8a',
                                padding: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                color: '#fff'
                            }}>
                                {user?.institute_logo ? (
                                    <img src={user.institute_logo} alt="Logo" style={{ width: '60px', height: '60px', objectFit: 'contain', background: '#fff', borderRadius: '50%', padding: '4px' }} />
                                ) : (
                                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#fff', color: '#1e3a8a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>LOGO</div>
                                )}
                                <div style={{ textAlign: 'left', flex: 1 }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', lineHeight: '1.2' }}>
                                        {user?.institute_name?.toUpperCase() || 'INSTITUTE NAME'}
                                    </div>
                                    {user?.institute_phone && (
                                        <div style={{ fontSize: '0.8rem', color: '#dbeafe', marginTop: '4px' }}>
                                            Ph: {user.institute_phone}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div style={{ height: '3px', background: '#1e3a8a', borderTop: '2px solid #fff' }}></div>
                            
                            {/* QR & Photo area */}
                            <div style={{ padding: '15px 15px 5px 15px', display: 'flex', justifyContent: 'space-between', gap: '15px' }}>
                                <div style={{ flex: 1, textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' }}>QR CODE</div>
                                    <QRCodeCanvas
                                        value={`STUDENT_QR_${qrStudent.id}`}
                                        size={110}
                                        level="H"
                                        includeMargin={false}
                                        style={{ display: 'block', margin: '0 auto' }}
                                    />
                                </div>
                                <div style={{ flex: 1, textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' }}>PHOTO</div>
                                    <div style={{
                                        width: '110px', height: '110px', background: '#e2e8f0', margin: '0 auto',
                                        border: '1px solid #cbd5e1', position: 'relative', overflow: 'hidden'
                                    }}>
                                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', border: '2px solid #94a3b8', margin: '15px auto 0' }}></div>
                                        <div style={{ width: '70px', height: '40px', border: '2px solid #94a3b8', margin: '10px auto 0', borderBottom: 'none' }}></div>
                                        <div style={{ position: 'absolute', bottom: '4px', width: '100%', textAlign: 'center', fontSize: '0.6rem', color: '#94a3b8' }}>PHOTO</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div style={{ borderTop: '2px solid #e2e8f0', margin: '10px 15px' }}></div>
                            
                            {/* Student Details */}
                            <div style={{ padding: '0 15px 15px 15px' }}>
                                <div style={{ background: '#6366f1', color: '#fff', padding: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '1rem', marginBottom: '10px' }}>
                                    {qrStudent.User?.name?.toUpperCase() || 'STUDENT NAME'}
                                </div>
                                
                                <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <tbody>
                                        {[
                                            { label: 'Roll No', value: qrStudent.roll_number || 'N/A' },
                                            { label: 'Parent', value: qrStudent.Parents?.[0]?.name || qrStudent.parent_name || 'N/A' },
                                            { label: 'Email', value: qrStudent.User?.email || 'N/A' },
                                            { label: 'Parent Ph', value: qrStudent.Parents?.[0]?.phone || qrStudent.Parents?.[0]?.User?.phone || 'N/A' },
                                            { label: 'Class', value: qrStudent.Classes?.map(c => `${c.name}${c.section ? ` - ${c.section}` : ''}`).join(', ') || 'N/A' },
                                            { label: 'Gender', value: qrStudent.gender || 'N/A' },
                                            { label: 'Address', value: qrStudent.address || 'N/A' }
                                        ].map((row, i) => (
                                            <tr key={i} style={{ background: i % 2 === 0 ? '#f8fafc' : '#f1f5f9' }}>
                                                <td style={{ padding: '6px 8px', fontWeight: 'bold', color: '#6366f1', width: '70px' }}>{row.label}:</td>
                                                <td style={{ padding: '6px 8px', color: '#334155', wordBreak: 'break-word' }}>{row.value}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Action Buttons */}
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
                                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                    border: 'none', opacity: qrDownloading ? 0.7 : 1
                                }}
                                disabled={qrDownloading}
                                onClick={async () => {
                                    setQrDownloading(true);
                                    try {
                                        const qrDataUrl = await QRCode.toDataURL(`STUDENT_QR_${qrStudent.id}`, { width: 300, margin: 1 });

                                        const { jsPDF } = await import('jspdf');
                                        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [85, 148] });

                                        const instName = user?.institute_name || 'Institute Name';
                                        const instPhone = user?.institute_phone || '';
                                        const studentName = qrStudent.User?.name || '';
                                        const studentEmail = qrStudent.User?.email || '';
                                        const gender = qrStudent.gender || 'N/A';
                                        const rollNo = qrStudent.roll_number || '';
                                        const parentObj = qrStudent.Parents?.[0];
                                        const parentName = parentObj?.name || qrStudent.parent_name || 'N/A';
                                        const parentPhone = parentObj?.phone || parentObj?.User?.phone || '';
                                        const classText = qrStudent.Classes?.map(c => `${c.name}${c.section ? ` - ${c.section}` : ''}`).join(', ') || 'N/A';
                                        const address = qrStudent.address || 'N/A';

                                        // Fetch Institute Logo as Base64 for PDF format natively
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
                                            } catch (e) {
                                                return null;
                                            }
                                        };

                                        let logoBase64 = null;
                                        if (user?.institute_logo) {
                                            let logoUrl = user.institute_logo;
                                            if (logoUrl.startsWith('/')) {
                                                const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
                                                logoUrl = `${apiUrl.replace(/\/api\/?$/, "")}${logoUrl}`;
                                            }
                                            logoBase64 = await getBase64ImageFromUrl(logoUrl);
                                        }

                                        // Background
                                        doc.setFillColor(245, 247, 255);
                                        doc.rect(0, 0, 85, 155, 'F');

                                        // Top header bar - Professional Dark Solid
                                        doc.setFillColor(30, 58, 138); // Blue-900 (Professional dark blue)
                                        doc.rect(0, 0, 85, 28, 'F');
                                        
                                        doc.setTextColor(255, 255, 255);
                                        doc.setFont('helvetica', 'bold');

                                        if (logoBase64) {
                                            // Draw logo cleanly on left
                                            doc.addImage(logoBase64, 'PNG', 5, 4, 20, 20);
                                            
                                            // Draw Institute Details aligned to the right of the logo
                                            doc.setFontSize(10);
                                            const instLines = doc.splitTextToSize(instName.toUpperCase(), 50);
                                            doc.text(instLines, 28, 14);
                                            
                                            if (instPhone) {
                                                doc.setFont('helvetica', 'normal');
                                                doc.setFontSize(7.5);
                                                doc.setTextColor(219, 234, 254);
                                                doc.text(`Ph: ${instPhone}`, 28, 20);
                                            }
                                        } else {
                                            // Center fallback if logo fails
                                            doc.setFontSize(11);
                                            const instLines = doc.splitTextToSize(instName.toUpperCase(), 72);
                                            const nameY = instPhone ? 12 : 16;
                                            doc.text(instLines, 42.5, nameY, { align: 'center' });
                                            if (instPhone) {
                                                doc.setFont('helvetica', 'normal');
                                                doc.setFontSize(7.5);
                                                doc.setTextColor(219, 234, 254);
                                                doc.text(`Ph: ${instPhone}`, 42.5, 18, { align: 'center' });
                                            }
                                        }

                                        // Divider below header
                                        doc.setDrawColor(30, 58, 138);
                                        doc.setLineWidth(0.5);
                                        doc.line(6, 30, 79, 30);

                                        // Section labels
                                        doc.setTextColor(100, 100, 120);
                                        doc.setFont('helvetica', 'bold');
                                        doc.setFontSize(6);
                                        doc.text('QR CODE', 21, 35, { align: 'center' });
                                        doc.text('PHOTO', 64, 35, { align: 'center' });

                                        // QR Code image
                                        if (qrDataUrl) {
                                            doc.addImage(qrDataUrl, 'PNG', 5, 37, 33, 33);
                                        } else {
                                            doc.setFillColor(230, 230, 240);
                                            doc.rect(5, 37, 33, 33, 'F');
                                            doc.setTextColor(150,150,150);
                                            doc.setFontSize(6);
                                            doc.text('QR CODE', 21.5, 55, { align: 'center' });
                                        }

                                        // Photo placeholder box
                                        doc.setFillColor(220, 224, 240);
                                        doc.rect(47, 37, 33, 33, 'F');
                                        doc.setDrawColor(180, 190, 220);
                                        doc.setLineWidth(0.3);
                                        doc.rect(47, 37, 33, 33);
                                        doc.setDrawColor(150, 160, 190);
                                        doc.setLineWidth(0.2);
                                        doc.circle(63.5, 47, 4, 'S');
                                        doc.line(55, 69, 55, 60); doc.line(55, 60, 72, 60); doc.line(72, 60, 72, 69);
                                        doc.setTextColor(140,150,185);
                                        doc.setFontSize(5);
                                        doc.text('PHOTO', 63.5, 72, { align: 'center' });

                                        // Divider
                                        doc.setDrawColor(200, 205, 225);
                                        doc.setLineWidth(0.3);
                                        doc.line(6, 74, 79, 74);

                                        // Student info section
                                        const infoStartY = 80;
                                        const lineH = 7;

                                        // Student Name banner
                                        doc.setFillColor(102, 126, 234);
                                        doc.rect(5, infoStartY - 4, 75, 8, 'F');
                                        doc.setTextColor(255, 255, 255);
                                        doc.setFont('helvetica', 'bold');
                                        doc.setFontSize(9);
                                        doc.text(studentName.toUpperCase(), 42.5, infoStartY, { align: 'center' });

                                        // Info rows — Roll, Parent, Email, Parent Ph, Class, Gender, Address
                                        const rows = [
                                            { label: 'Roll No', value: rollNo || 'N/A' },
                                            { label: 'Parent', value: parentName },
                                            { label: 'Email', value: studentEmail },
                                            { label: 'Parent Ph', value: parentPhone || 'N/A' },
                                            { label: 'Class', value: classText },
                                            { label: 'Gender', value: gender },
                                            { label: 'Address', value: address },
                                        ];

                                        let y = infoStartY + lineH;
                                        rows.forEach((row, i) => {
                                            const bg = i % 2 === 0 ? [245, 247, 255] : [235, 238, 255];
                                            doc.setFillColor(...bg);
                                            doc.rect(5, y - 3.5, 75, 6.5, 'F');

                                            doc.setTextColor(102, 126, 234);
                                            doc.setFont('helvetica', 'bold');
                                            doc.setFontSize(6);
                                            doc.text(`${row.label}:`, 8, y + 0.5);

                                            doc.setTextColor(40, 40, 70);
                                            doc.setFont('helvetica', 'normal');
                                            const valLines = doc.splitTextToSize(String(row.value), 46);
                                            doc.text(valLines[0], 30, y + 0.5);

                                            y += lineH;
                                        });

                                        // Footer strip
                                        doc.setFillColor(102, 126, 234);
                                        doc.rect(0, 149, 85, 6, 'F');
                                        doc.setTextColor(255,255,255);
                                        doc.setFont('helvetica', 'normal');
                                        doc.setFontSize(5.5);
                                        doc.text('Official Student Identity Card', 42.5, 152.5, { align: 'center' });

                                        await savePdfNative(doc, `QR_${studentName.replace(/\s+/g, '_')}_${qrStudent.roll_number || qrStudent.id}.pdf`);
                                    } catch (err) {
                                        console.error('PDF download error:', err);
                                        alert('Download failed: ' + err.message);
                                    } finally {
                                        setQrDownloading(false);
                                    }
                                }}
                            >
                                {qrDownloading ? '⏳ Generating...' : '⬇ Download Card'}
                            </button>
                        </div>
                        </>)}
                    </div>
                </div>
            )}


            {/* Add/Edit Student Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "700px" }}>
                        <div className="modal-header">
                            <h3>{editMode ? "Edit Student" : "Add New Student"}</h3>
                            <button onClick={() => setShowModal(false)} className="btn btn-sm">
                                ×
                            </button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleSubmit}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }} className="responsive-form-grid">
                                    <div className="form-group">
                                        <label className="form-label">Full Name *</label>
                                        <input
                                            type="text"
                                            name="name"
                                            className="form-input"
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
                                            value={formData.email}
                                            onChange={handleChange}
                                            required
                                            disabled={editMode}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                                    <div className="form-group">
                                        <label className="form-label">Phone</label>
                                        <input
                                            type="tel"
                                            name="phone"
                                            className="form-input"
                                            value={formData.phone}
                                            onChange={handleChange}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Roll Number *</label>
                                        <input
                                            type="text"
                                            name="roll_number"
                                            className="form-input"
                                            value={formData.roll_number}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                </div>

                                {!editMode && (
                                    <div className="form-group">
                                        <label className="form-label">
                                            Password * <small>(Min 6 chars)</small>
                                        </label>
                                        <input
                                            type="password"
                                            name="password"
                                            className="form-input"
                                            value={formData.password}
                                            onChange={handleChange}
                                            required={!editMode}
                                            minLength={6}
                                        />
                                    </div>
                                )}

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                                    <div className="form-group" style={{ gridColumn: "1 / -1", marginTop: "1rem" }}>
                                        <label className="form-label">Classes (Multiple selection allowed)</label>
                                        <select
                                            name="class_ids"
                                            className="form-select"
                                            multiple
                                            value={formData.class_ids}
                                            onChange={handleClassChange}
                                            style={{ height: "100px" }}
                                        >
                                            {classes.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name} {c.section && `- ${c.section}`}
                                                </option>
                                            ))}
                                        </select>
                                        <small style={{ color: "#6b7280" }}>Hold Ctrl (Windows) or Cmd (Mac) to select multiple classes</small>
                                    </div>
                                </div>

                                {formData.class_ids && formData.class_ids.length > 0 && (
                                    <div className="form-group" style={{ marginTop: "1rem" }}>
                                        <label className="form-label">Subjects (Multiple selection allowed)</label>
                                        <select
                                            name="subject_ids"
                                            className="form-select"
                                            multiple
                                            value={formData.subject_ids}
                                            onChange={handleSubjectChange}
                                            style={{ height: "100px" }}
                                        >
                                            {availableSubjects.map((sub) => (
                                                <option key={sub.id} value={sub.id}>
                                                    {sub.name}
                                                </option>
                                            ))}
                                        </select>
                                        <small style={{ color: "#6b7280" }}>Hold Ctrl (Windows) or Cmd (Mac) to select multiple subjects</small>
                                    </div>
                                )}

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
                                    <div className="form-group">
                                        <label className="form-label">Gender</label>
                                        <select
                                            name="gender"
                                            className="form-select"
                                            value={formData.gender}
                                            onChange={handleChange}
                                        >
                                            <option value="male">Male</option>
                                            <option value="female">Female</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Date of Birth <span style={{ color: 'red' }}>*</span></label>
                                        <input
                                            type="date"
                                            name="date_of_birth"
                                            className="form-input"
                                            value={formData.date_of_birth}
                                            onChange={handleChange}
                                            required
                                            max={new Date().toISOString().split('T')[0]}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Admission Date <span style={{ color: 'red' }}>*</span></label>
                                        <input
                                            type="date"
                                            name="admission_date"
                                            className="form-input"
                                            value={formData.admission_date}
                                            onChange={handleChange}
                                            required
                                            max={new Date().toISOString().split('T')[0]}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Address</label>
                                    <textarea
                                        name="address"
                                        className="form-input"
                                        rows="2"
                                        value={formData.address}
                                        onChange={handleChange}
                                    ></textarea>
                                </div>

                                {editMode && (
                                    <div className="form-group" style={{ gridColumn: "1 / -1", marginTop: "1rem" }}>
                                        <label className="form-label" style={{ fontWeight: '700' }}>Account Status</label>
                                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: "0.5rem", flexWrap: "wrap" }}>
                                            {['active', 'blocked'].map(s => (
                                                <label key={s} style={{
                                                    display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
                                                    padding: '0.5rem 1.2rem', borderRadius: '8px',
                                                    border: `1.5px solid ${formData.status === s ? (s === 'active' ? '#10b981' : '#ef4444') : 'var(--border-color)'}`,
                                                    background: formData.status === s ? (s === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)') : 'transparent',
                                                    fontWeight: '600',
                                                    color: formData.status === s ? (s === 'active' ? '#10b981' : '#ef4444') : 'var(--text-secondary)'
                                                }}>
                                                    <input
                                                        type="radio"
                                                        name="status"
                                                        value={s}
                                                        checked={formData.status === s}
                                                        onChange={handleChange}
                                                        style={{ accentColor: s === 'active' ? '#10b981' : '#ef4444' }}
                                                    />
                                                    {s === 'active' ? '● Active' : '🚫 Blocked'}
                                                </label>
                                            ))}
                                        </div>
                                        {formData.status === 'blocked' && (
                                            <div style={{ marginTop: '0.6rem', padding: '0.6rem 0.9rem', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.83rem', color: '#ef4444' }}>
                                                ⚠️ Blocked student will not be able to access their account or any course materials.
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="modal-footer">
                                    <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary">
                                        {editMode ? "Update Student" : "Add Student"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            {/* Credentials Modal */}
            {showCredentialsModal && (
                <div className="modal-overlay" onClick={() => setShowCredentialsModal(false)}>
                    <div
                        className="modal-content"
                        onClick={e => e.stopPropagation()}
                        style={{ maxWidth: '860px', padding: '0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }}
                    >
                        {/* Header */}
                        <div style={{ padding: '1.5rem 2rem', background: 'linear-gradient(135deg, #4f46e5, #4338ca)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    🔑 Student Credentials
                                </h2>
                                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', opacity: 0.85 }}>
                                    {credentialsData.length} student{credentialsData.length !== 1 ? 's' : ''} · Passwords are shown only until students log in for the first time
                                </p>
                            </div>
                            <button
                                onClick={() => setShowCredentialsModal(false)}
                                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                            >×</button>
                        </div>

                        {/* Table */}
                        <div style={{ padding: '1.5rem 2rem', background: 'var(--card-bg, #fff)' }}>
                            <div style={{ maxHeight: '400px', overflowY: 'auto', borderRadius: '10px', border: '1px solid var(--border-color, #e5e7eb)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--sidebar-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                                            <th style={{ padding: '0.9rem 1rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary, #6b7280)', borderBottom: '1px solid var(--border-color, #e5e7eb)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Roll No</th>
                                            <th style={{ padding: '0.9rem 1rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary, #6b7280)', borderBottom: '1px solid var(--border-color, #e5e7eb)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
                                            <th style={{ padding: '0.9rem 1rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary, #6b7280)', borderBottom: '1px solid var(--border-color, #e5e7eb)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</th>
                                            <th style={{ padding: '0.9rem 1rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary, #6b7280)', borderBottom: '1px solid var(--border-color, #e5e7eb)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Initial Password</th>
                                            <th style={{ padding: '0.9rem 1rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary, #6b7280)', borderBottom: '1px solid var(--border-color, #e5e7eb)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
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
                                                    identifier={c.roll_number}
                                                    isEven={idx % 2 === 0}
                                                    onReset={async (studentId) => {
                                                        try {
                                                            const res = await api.post(`/students/${studentId}/resend-credentials`);
                                                            if (res.data.success && res.data.initial_password) {
                                                                setCredentialsData(prev => prev.map(x =>
                                                                    x.id === studentId
                                                                        ? { ...x, password: res.data.initial_password, status: 'generated' }
                                                                        : x
                                                                ));
                                                            } else {
                                                                alert('Password reset successfully! Credentials were sent via email.');
                                                            }
                                                        } catch (err) {
                                                            // Handle 429 cooldown gracefully
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

                            {/* Info Banner */}
                            <div style={{ marginTop: '1.25rem', padding: '1rem 1.25rem', background: 'linear-gradient(135deg, #fef9c3, #fef3c7)', borderRadius: '10px', border: '1px solid #fcd34d', color: '#92400e', fontSize: '0.84rem', lineHeight: '1.5', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                                <span style={{ fontSize: '1rem', flexShrink: 0 }}>💡</span>
                                <span>
                                    <strong>Security Note:</strong> Initial passwords are visible only until the student logs in and changes their password. After that, the password is wiped from the system.
                                    Use <strong>🔄 Reset</strong> to generate a new credential for a student who forgot their password.
                                </span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '1rem 2rem', borderTop: '1px solid var(--border-color, #e5e7eb)', background: 'var(--card-bg, #fff)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button onClick={() => setShowCredentialsModal(false)} className="btn btn-secondary">Close</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

export default Students;
