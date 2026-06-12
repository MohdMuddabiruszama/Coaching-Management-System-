/**
 * Super Admin - Subscriptions Management
 * Manage all institute subscriptions
 */

import { useState, useEffect } from "react";
import api from "../../services/api";
import BackButton from "../../components/common/BackButton";
import ThemeSelector from "../../components/ThemeSelector";
import "../admin/Dashboard.css";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

function Subscriptions() {
    const [subscriptions, setSubscriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState("all");

    // Export Modal State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportType, setExportType] = useState("");
    const [exportFilter, setExportFilter] = useState("all");

    useEffect(() => {
        fetchSubscriptions();
    }, [statusFilter]);

    const fetchSubscriptions = async () => {
        setLoading(true);
        try {
            const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
            const response = await api.get(`/subscriptions${params}`);
            // API returns: { success: true, data: { subscriptions: [...], pagination: {...} } }
            setSubscriptions(response.data.data?.subscriptions || []);
        } catch (error) {
            console.error("Error fetching subscriptions:", error);
            setSubscriptions([]); // Set empty array on error
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (subscriptionId, newStatus) => {
        if (!window.confirm(`Are you sure you want to mark this subscription as ${newStatus}?`)) {
            return;
        }

        try {
            await api.patch(`/subscriptions/${subscriptionId}/status`, {
                payment_status: newStatus
            });
            alert(`Subscription status updated to ${newStatus}`);
            fetchSubscriptions();
        } catch (error) {
            console.error("Error updating subscription:", error);
            alert("Failed to update subscription status");
        }
    };

    const handleExport = (type) => {
        if (subscriptions.length === 0) {
            alert("No subscription data to export.");
            return;
        }
        setExportType(type);
        setExportFilter("all");
        setShowExportModal(true);
    };

    const confirmExport = () => {
        exportSubscriptions(exportType, exportFilter);
        setShowExportModal(false);
    };

    const exportSubscriptions = (type, filterStr) => {
        const title = `Subscriptions Report - ${filterStr.toUpperCase()}`;
        const columns = ["ID", "Institute Name", "Email", "Plan", "Amount (INR)", "Start Date", "End Date", "Status"];

        let targetRows = subscriptions;

        if (filterStr !== "all") {
            targetRows = targetRows.filter(s => s.payment_status === filterStr);
        }

        if (targetRows.length === 0) {
            alert(`No records found for the filter: ${filterStr}`);
            return;
        }

        const rows = targetRows.map(sub => [
            `#${sub.id}`,
            sub.Institute?.name || "Unknown",
            sub.Institute?.email || "Unknown",
            sub.Plan?.name || "Custom Plan",
            sub.amount_paid,
            new Date(sub.start_date).toLocaleDateString(),
            new Date(sub.end_date).toLocaleDateString(),
            sub.payment_status.toUpperCase()
        ]);

        if (type === "PDF") {
            const doc = new jsPDF("landscape");
            doc.text(title, 14, 15);
            autoTable(doc, {
                head: [columns],
                body: rows,
                startY: 20,
            });
            doc.save(`${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
        } else if (type === "Excel") {
            const worksheet = XLSX.utils.aoa_to_sheet([columns, ...rows]);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Subscriptions");
            XLSX.writeFile(workbook, `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xlsx`);
        }
    };

    if (loading) {
        return <div className="dashboard-container">Loading...</div>;
    }

    // Filter out duplicate dummy pending/failed subscriptions if the institute already has a paid subscription
    const paidInstituteIds = new Set(
        subscriptions.filter(s => s.payment_status === 'paid').map(s => s.institute_id)
    );

    const displaySubscriptions = subscriptions.filter(s => {
        const isDummy = !s.start_date || new Date(s.start_date).getFullYear() <= 1970;
        if ((s.payment_status === 'pending' || s.payment_status === 'failed') && isDummy && paidInstituteIds.has(s.institute_id)) {
            return false;
        }
        return true;
    });

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <h1>💳 Subscriptions Management</h1>
                    <p>Track and manage institute subscriptions</p>
                </div>
                <div className="dashboard-header-right">
                    <ThemeSelector />
                    <button onClick={() => handleExport("PDF")} className="btn btn-primary" style={{ backgroundColor: "#ef4444", borderColor: "#ef4444" }}>📄 PDF</button>
                    <button onClick={() => handleExport("Excel")} className="btn btn-primary" style={{ backgroundColor: "#10b981", borderColor: "#10b981" }}>📊 Excel</button>
                    <BackButton />
                </div>
            </div>

            {/* Filters */}
            <div className="filters-section" style={{ marginBottom: "1.5rem" }}>
                <select
                    className="form-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{ padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #d1d5db" }}
                >
                    <option value="all">All Status</option>
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                </select>
            </div>

            {/* Subscriptions Table */}
            <div className="card">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Institute</th>
                                <th>Plan</th>
                                <th>Amount</th>
                                <th>Period</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displaySubscriptions.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: "center", padding: "2rem" }}>
                                        No subscription records found
                                    </td>
                                </tr>
                            ) : (
                                displaySubscriptions.map((sub) => (
                                    <tr key={sub.id}>
                                        <td>#{sub.id}</td>
                                        <td>
                                            <div>
                                                <strong>{sub.Institute?.name || "Unknown"}</strong>
                                                <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                                                    {sub.Institute?.email}
                                                </div>
                                            </div>
                                        </td>
                                        <td>{sub.Plan?.name || "Custom Plan"}</td>
                                        <td>₹{sub.amount_paid}</td>
                                        <td>
                                            {sub.start_date && new Date(sub.start_date).getFullYear() > 1970 ? (
                                                <>
                                                    {new Date(sub.start_date).toLocaleDateString()} -{" "}
                                                    {new Date(sub.end_date).toLocaleDateString()}
                                                </>
                                            ) : (
                                                <span style={{ color: "#6b7280", fontStyle: "italic" }}>Pending Activation</span>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`badge badge-${sub.payment_status === 'paid' ? 'success' :
                                                sub.payment_status === 'pending' ? 'warning' : 'danger'
                                                }`}>
                                                {sub.payment_status}
                                            </span>
                                        </td>
                                        <td>
                                            {sub.payment_status === "pending" && (
                                                <button
                                                    className="btn btn-sm btn-success"
                                                    onClick={() => handleUpdateStatus(sub.id, "paid")}
                                                    style={{ marginRight: "0.5rem" }}
                                                >
                                                    Mark Paid
                                                </button>
                                            )}
                                            {sub.payment_status !== "failed" && sub.payment_status !== "paid" && (
                                                <button
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() => handleUpdateStatus(sub.id, "failed")}
                                                >
                                                    Mark Failed
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

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
                                    <option value="paid">Paid Only</option>
                                    <option value="pending">Pending Only</option>
                                    <option value="failed">Failed Only</option>
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

export default Subscriptions;
