/**
 * Reports & Analytics Page
 * Professional implementation with multiple report types
 */

import { useState, useEffect, useContext, useRef } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import "./Dashboard.css";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import AdminExpenses from "./Expenses";
import { savePdfNative } from "../../utils/capacitorPermissions";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

function Reports() {
    const { user } = useContext(AuthContext);
    const isPro = user?.features?.reports === 'advanced';

    const financesRef = useRef(null);

    const [activeTab, setActiveTab] = useState("dashboard");
    const [dashboardData, setDashboardData] = useState(null);
    const [feesReport, setFeesReport] = useState(null);
    const [monthlyTrends, setMonthlyTrends] = useState(null);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [filters, setFilters] = useState({
        start_date: new Date(new Date().setDate(1)).toISOString().split('T')[0], // First day of month
        end_date: new Date().toISOString().split('T')[0],
        class_id: "",
        student_id: ""
    });
    const [recordFilter, setRecordFilter] = useState('all'); // 'all', 'paid', 'pending'

    // Export Modal State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportType, setExportType] = useState(""); // 'PDF' or 'Excel'
    const [exportFilter, setExportFilter] = useState("all");

    useEffect(() => {
        fetchClasses();
        fetchDashboardData();
    }, []);

    useEffect(() => {
        if (activeTab === "fees") {
            fetchFeesReport();
        } else if (activeTab === "trends") {
            fetchMonthlyTrends();
        }
    }, [activeTab, filters]);

    const fetchClasses = async () => {
        try {
            const response = await api.get("/classes");
            setClasses(response.data.data || []);
        } catch (error) {
            console.error("Error fetching classes:", error);
        }
    };

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const response = await api.get("/reports/dashboard");
            setDashboardData(response.data.data);
        } catch (error) {
            console.error("Error fetching dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchFeesReport = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.start_date) params.append('start_date', filters.start_date);
            if (filters.end_date) params.append('end_date', filters.end_date);
            if (filters.class_id) params.append('class_id', filters.class_id);

            const response = await api.get(`/reports/fees?${params}`);
            setFeesReport(response.data.data);
        } catch (error) {
            console.error("Error fetching fees report:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMonthlyTrends = async () => {
        setLoading(true);
        try {
            const monthsToFetch = isPro ? 6 : 3;
            const response = await api.get(`/reports/monthly-trends?months=${monthsToFetch}`);
            setMonthlyTrends(response.data.data);
        } catch (error) {
            console.error("Error fetching trends:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (key, value) => {
        const newFilters = { ...filters, [key]: value };

        if (!isPro && (key === 'start_date' || key === 'end_date')) {
            const start = new Date(newFilters.start_date);
            const end = new Date(newFilters.end_date);
            const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));

            if (diffDays > 90) {
                alert("✨ Upgrade to Pro plan to unlock unlimited date filters for analytics!");
                return; // Prevent state update
            }
        }

        setFilters(newFilters);
    };

    const handleExport = (type) => {
        if (!isPro) {
            alert(`✨ Upgrade to Pro plan to unlock Export to ${type} features!`);
            return;
        }

        if (activeTab === "fees") {
            if (!feesReport?.payments || feesReport.payments.length === 0) {
                // If there are pendings, we can still export pending ones
                if (!feesReport?.pending_students || feesReport.pending_students.length === 0) {
                    alert("No fees data to export.");
                    return;
                }
            }
        } else if (activeTab === "finances") {
            if (type === "PDF") {
                financesRef.current?.handleExportPDF();
            } else if (type === "Excel") {
                financesRef.current?.handleExportExcel();
            }
            return;
        } else {
            alert(`Exports are currently available for Fees and Finances reports.`);
            return;
        }

        // Open Modal
        setExportType(type);
        setExportFilter("all");
        setShowExportModal(true);
    };

    const generatePDF = async (title, columns, rows) => {
        const doc = new jsPDF();
        doc.text(title, 14, 15);
        autoTable(doc, {
            head: [columns],
            body: rows,
            startY: 20
        });
        await savePdfNative(doc, `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
    };

    const generateExcel = (title, columns, rows, sheetName) => {
        const worksheet = XLSX.utils.aoa_to_sheet([columns, ...rows]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        XLSX.writeFile(workbook, `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xlsx`);
    };

    const confirmExport = () => {
        if (activeTab === "fees") exportFees(exportType, exportFilter);
        setShowExportModal(false);
    };

    const exportFees = (type, filterStr) => {
        const title = `Fees Report (${filters.start_date} to ${filters.end_date}) - ${filterStr.toUpperCase()}`;
        
        let columns;
        let targetRows = [];

        if (filterStr === "paid") {
            columns = ["Roll Number", "Student Name", "Method", "Payment Date", "Paid Amount (INR)", "Status"];
            targetRows = feesReport.payments.map(r => [
                r.Student?.roll_number || "-",
                r.Student?.User?.name || "Unknown",
                r.payment_method?.toUpperCase() || "-",
                new Date(r.payment_date).toLocaleDateString(),
                r.amount_paid,
                "PAID"
            ]);
        } else if (filterStr === "pending") {
            columns = ["Roll Number", "Student Name", "Fee Type", "Due Date", "Reminder Date", "Pending Amount (INR)", "Status"];
            targetRows = feesReport.pending_students.map(r => [
                r.roll_number || "-",
                r.name || "Unknown",
                r.fee_type || "General Fee",
                r.due_date ? new Date(r.due_date).toLocaleDateString() : "-",
                r.reminder_date ? new Date(r.reminder_date).toLocaleDateString() : "-",
                r.pending_amount || 0,
                "PENDING"
            ]);
        } else {
            // "all"
            columns = ["Roll Number", "Student Name", "Type/Method", "Due/Payment Date", "Reminder Date", "Amount (INR)", "Status"];
            const paidRows = feesReport.payments.map(r => [
                r.Student?.roll_number || "-",
                r.Student?.User?.name || "Unknown",
                r.payment_method?.toUpperCase() || "PAYMENT",
                new Date(r.payment_date).toLocaleDateString(),
                "-",
                r.amount_paid,
                "PAID"
            ]);
            const pendingRows = feesReport.pending_students.map(r => [
                r.roll_number || "-",
                r.name || "Unknown",
                r.fee_type || "Pending Fee",
                r.due_date ? new Date(r.due_date).toLocaleDateString() : "-",
                r.reminder_date ? new Date(r.reminder_date).toLocaleDateString() : "-",
                r.pending_amount || 0,
                "PENDING"
            ]);
            targetRows = [...paidRows, ...pendingRows];
        }

        if (targetRows.length === 0) {
            alert(`No records found for the filter: ${filterStr}`);
            return;
        }

        if (type === "PDF") generatePDF(title, columns, targetRows);
        else if (type === "Excel") generateExcel(title, columns, targetRows, "Fees");
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <h1>📉 Reports & Analytics</h1>
                    <p>Comprehensive insights and performance metrics {isPro ? <span className="badge badge-success">PRO</span> : <span className="badge badge-secondary">BASIC</span>}</p>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={() => handleExport("PDF")} className="btn btn-primary" style={{ backgroundColor: isPro ? "#ef4444" : "#ccc", borderColor: isPro ? "#ef4444" : "#ccc" }}>📄 PDF {isPro ? "" : "🔒"}</button>
                    <button onClick={() => handleExport("Excel")} className="btn btn-primary" style={{ backgroundColor: isPro ? "#10b981" : "#ccc", borderColor: isPro ? "#10b981" : "#ccc" }}>📊 Excel {isPro ? "" : "🔒"}</button>
                    <Link to="/admin/dashboard" className="btn btn-secondary">
                        ← Back
                    </Link>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="tabs" style={{ marginBottom: "2rem" }}>
                <button
                    className={`tab ${activeTab === "dashboard" ? "active" : ""}`}
                    onClick={() => setActiveTab("dashboard")}
                >
                    📈 Dashboard
                </button>
                <button
                    className={`tab ${activeTab === "finances" ? "active" : ""}`}
                    onClick={() => setActiveTab("finances")}
                >
                    💸 Finances & Transport Reports
                </button>
                <button
                    className={`tab ${activeTab === "fees" ? "active" : ""}`}
                    onClick={() => setActiveTab("fees")}
                >
                    💰 Fees Report
                </button>
                <button
                    className={`tab ${activeTab === "trends" ? "active" : ""}`}
                    onClick={() => setActiveTab("trends")}
                >
                    📊 Monthly Trends
                </button>
            </div>

            {/* Dashboard Tab */}
            {activeTab === "dashboard" && dashboardData && (
                <div>
                    <h2 style={{ marginBottom: "1.5rem" }}>Overview</h2>
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-icon">👨‍🎓</div>
                            <div className="stat-content">
                                <h3>{dashboardData.overview.total_students}</h3>
                                <p>Total Students</p>
                                <small>{dashboardData.overview.new_admissions_this_month} new this month</small>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon">👩‍🏫</div>
                            <div className="stat-content">
                                <h3>{dashboardData.overview.total_faculty}</h3>
                                <p>Total Faculty</p>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon">📚</div>
                            <div className="stat-content">
                                <h3>{dashboardData.overview.total_classes}</h3>
                                <p>Total Classes</p>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon">📅</div>
                            <div className="stat-content">
                                <h3>{dashboardData.today_attendance.percentage}%</h3>
                                <p>Today's Attendance</p>
                                <small>{dashboardData.today_attendance.present}/{dashboardData.today_attendance.total} present</small>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon">💰</div>
                            <div className="stat-content">
                                <h3>₹{dashboardData.monthly_fees.collected.toLocaleString()}</h3>
                                <p>Fees Collected</p>
                                <small>{dashboardData.monthly_fees.month}</small>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Finances Report Tab */}
            {activeTab === "finances" && (
                <div style={{ marginTop: "-1.5rem", padding: "0" }}>
                    <style>
                        {`
                           .finances-tab-wrapper .dashboard-container {
                               padding: 0 !important;
                               margin: 0 !important;
                               max-width: none !important;
                           }
                        `}
                    </style>
                    <div className="finances-tab-wrapper">
                        <AdminExpenses ref={financesRef} isReportMode={true} />
                    </div>
                </div>
            )}

            {/* Fees Report Tab */}
            {activeTab === "fees" && (
                <div>
                    {/* Filters */}
                    <div className="card" style={{ marginBottom: "2rem" }}>
                        <div style={{ padding: "1.5rem" }}>
                            <h3 style={{ marginBottom: "1rem" }}>Filters</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                                <div className="form-group">
                                    <label className="form-label">Start Date</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={filters.start_date}
                                        onChange={(e) => handleFilterChange('start_date', e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">End Date</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={filters.end_date}
                                        onChange={(e) => handleFilterChange('end_date', e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Class</label>
                                    <select
                                        className="form-select"
                                        value={filters.class_id}
                                        onChange={(e) => handleFilterChange('class_id', e.target.value)}
                                    >
                                        <option value="">All Classes</option>
                                        {classes.map(cls => (
                                            <option key={cls.id} value={cls.id}>
                                                {cls.name}{cls.section ? ` - ${cls.section}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Record Type</label>
                                    <select
                                        className="form-select"
                                        value={recordFilter}
                                        onChange={(e) => setRecordFilter(e.target.value)}
                                    >
                                        <option value="all">All Records</option>
                                        <option value="paid">Paid Student Only</option>
                                        <option value="pending">Pending Student Only</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Summary */}
                    {feesReport && (
                        <div>
                            <div className="stats-grid" style={{ marginBottom: "2rem" }}>
                                <div className="stat-card">
                                    <div className="stat-icon">💰</div>
                                    <div className="stat-content">
                                        <h3>₹{parseFloat(feesReport.summary.total_collected).toLocaleString()}</h3>
                                        <p>Total Collected</p>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon">📝</div>
                                    <div className="stat-content">
                                        <h3>{feesReport.summary.total_payments}</h3>
                                        <p>Total Payments</p>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon">✅</div>
                                    <div className="stat-content">
                                        <h3>{feesReport.summary.students_paid}</h3>
                                        <p>Students Paid</p>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon">⏳</div>
                                    <div className="stat-content">
                                        <h3>{feesReport.summary.students_pending}</h3>
                                        <p>Pending Students</p>
                                    </div>
                                </div>
                            </div>

                            {/* Payments Table */}
                            {(recordFilter === 'all' || recordFilter === 'paid') && (
                                <div className="card" style={{ marginBottom: "2rem" }}>
                                    <div className="card-header">
                                        <h3 className="card-title">Payment Records</h3>
                                    </div>
                                <div className="table-container">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Student</th>
                                                <th>Amount</th>
                                                <th>Method</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {feesReport.payments.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" style={{ textAlign: "center", padding: "2rem" }}>
                                                        No payments found for selected filters
                                                    </td>
                                                </tr>
                                            ) : (
                                                feesReport.payments.slice(0, 50).map((payment, index) => (
                                                    <tr key={index}>
                                                        <td>{new Date(payment.payment_date).toLocaleDateString()}</td>
                                                        <td>
                                                            <strong>{payment.Student?.User?.name}</strong>
                                                            <br />
                                                            <small>Roll: {payment.Student?.roll_number}</small>
                                                        </td>
                                                        <td>₹{parseFloat(payment.amount_paid).toLocaleString()}</td>
                                                        <td>{payment.payment_method}</td>
                                                        <td>
                                                            <span className="badge badge-success">Paid</span>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            )}

                            {/* Pending Students Table */}
                            {(recordFilter === 'all' || recordFilter === 'pending') && feesReport.pending_students && feesReport.pending_students.length > 0 && (
                                <div className="card">
                                    <div className="card-header">
                                        <h3 className="card-title">Pending Students ({feesReport.pending_students.length})</h3>
                                    </div>
                                    <div className="table-container">
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th>Roll Number</th>
                                                    <th>Student Name</th>
                                                    <th>Fee Type</th>
                                                    <th>Pending Amount</th>
                                                    <th>Due Date</th>
                                                    <th>Reminder Date</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {feesReport.pending_students.map((student, index) => (
                                                    <tr key={index}>
                                                        <td>{student.roll_number}</td>
                                                        <td><strong>{student.name}</strong></td>
                                                        <td>{student.fee_type || 'Tuition Fee'}</td>
                                                        <td>₹{parseFloat(student.pending_amount || 0).toLocaleString()}</td>
                                                        <td>{student.due_date ? new Date(student.due_date).toLocaleDateString() : '—'}</td>
                                                        <td>{student.reminder_date ? new Date(student.reminder_date).toLocaleDateString() : '—'}</td>
                                                        <td>
                                                            <span className="badge badge-danger">Pending</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Monthly Trends Tab */}
            {activeTab === "trends" && monthlyTrends && (
                <div>
                    {isPro ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                            <div className="card" style={{ padding: '1rem' }}>
                                <h3>Revenue Growth</h3>
                                <div style={{ height: '300px' }}>
                                    <Bar
                                        data={{
                                            labels: monthlyTrends.map(t => t.month),
                                            datasets: [{
                                                label: 'Fees Collected (₹)',
                                                data: monthlyTrends.map(t => t.fees_collected),
                                                backgroundColor: 'rgba(54, 162, 235, 0.7)',
                                            }]
                                        }}
                                        options={{ maintainAspectRatio: false }}
                                    />
                                </div>
                            </div>
                            <div className="card" style={{ padding: '1rem' }}>
                                <h3>Attendance Trend vs Goal</h3>
                                <div style={{ height: '300px' }}>
                                    <Line
                                        data={{
                                            labels: monthlyTrends.map(t => t.month),
                                            datasets: [
                                                {
                                                    label: 'Attendance %',
                                                    data: monthlyTrends.map(t => t.attendance_percentage),
                                                    borderColor: 'rgba(16, 185, 129, 1)',
                                                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                                    fill: true,
                                                },
                                                {
                                                    label: 'Target (75%)',
                                                    data: monthlyTrends.map(() => 75),
                                                    borderColor: 'rgba(239, 68, 68, 0.5)',
                                                    borderDash: [5, 5],
                                                    fill: false,
                                                }
                                            ]
                                        }}
                                        options={{ maintainAspectRatio: false }}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ marginBottom: '1.5rem', padding: '1.5rem', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ color: '#0369a1', marginBottom: '0.2rem' }}>Unlock Pro Analytics 📈</h3>
                                <p style={{ color: '#0284c7', fontSize: '0.9rem', margin: 0 }}>Upgrade to access smart interactive charts, revenue forecasting, 1-year history maps, and automated insights!</p>
                            </div>
                            <Link to="/pricing" className="btn btn-primary" style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}>Upgrade to Pro ⭐</Link>
                        </div>
                    )}

                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">{isPro ? "6-Month Core Trends" : "3-Month Summary"}</h3>
                        </div>
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Month</th>
                                        <th>Attendance %</th>
                                        <th>Fees Collected</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {monthlyTrends.map((trend, index) => (
                                        <tr key={index}>
                                            <td><strong>{trend.month}</strong></td>
                                            <td>
                                                <span className={`badge ${trend.attendance_percentage >= 75 ? 'badge-success' : 'badge-warning'}`}>
                                                    {trend.attendance_percentage}%
                                                </span>
                                            </td>
                                            <td>₹{trend.fees_collected.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {loading && (
                <div style={{ textAlign: "center", padding: "2rem" }}>
                    <div className="loading-spinner">Loading...</div>
                </div>
            )}

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
                                    <option value="all">All Records</option>

                                    {activeTab === "attendance" && (
                                        <>
                                            <option value="present">Present Students Only</option>
                                            <option value="absent">Absent Students Only</option>
                                            <option value="late">Late Students Only</option>
                                        </>
                                    )}

                                    {activeTab === "fees" && (
                                        <>
                                            <option value="paid">Paid Students Only</option>
                                            <option value="pending">Pending Students Only</option>
                                        </>
                                    )}
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

export default Reports;
