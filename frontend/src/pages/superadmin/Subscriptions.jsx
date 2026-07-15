/**
 * Super Admin - Subscriptions Management
 * Manage all institute subscriptions with accurate discount breakdown
 */

import { useState, useEffect } from "react";
import api from "../../services/api";
import BackButton from "../../components/common/BackButton";
import ThemeSelector from "../../components/ThemeSelector";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import "../admin/Dashboard.css"; // Reuse dashboard base styles
import "./Plans.css";

function Subscriptions() {
    const [subscriptions, setSubscriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Pagination & Filtering
    const [statusFilter, setStatusFilter] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const limit = 50;

    // Export Modal State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportType, setExportType] = useState("");
    const [exportFilter, setExportFilter] = useState("all");

    // Edit Period Modal State
    const [editPeriodModal, setEditPeriodModal] = useState({ show: false, subscription: null, start_date: '', end_date: '' });

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPage(1); // reset to page 1 on search
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        fetchSubscriptions();
    }, [statusFilter, debouncedSearch, page]);

    const fetchSubscriptions = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page,
                limit,
            });
            if (statusFilter) params.append("status", statusFilter);
            if (debouncedSearch) params.append("search", debouncedSearch);

            const response = await api.get(`/subscriptions?${params.toString()}`);
            const data = response.data.data;
            
            setSubscriptions(data.subscriptions || []);
            if (data.pagination) {
                setTotalPages(data.pagination.totalPages);
                setTotalRecords(data.pagination.total);
            }
        } catch (error) {
            console.error("Error fetching subscriptions:", error);
            setSubscriptions([]);
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
            alert("No subscription data to export on this page.");
            return;
        }
        setExportType(type);
        setExportFilter("all");
        setShowExportModal(true);
    };

    const handleOpenEditPeriod = (sub) => {
        setEditPeriodModal({
            show: true,
            subscription: sub,
            start_date: sub.start_date ? sub.start_date.split('T')[0] : '',
            end_date: sub.end_date ? sub.end_date.split('T')[0] : ''
        });
    };

    const handleUpdatePeriod = async () => {
        if (!editPeriodModal.start_date || !editPeriodModal.end_date) {
            alert("Please select both start and end dates.");
            return;
        }
        try {
            await api.patch(`/subscriptions/${editPeriodModal.subscription.id}/period`, {
                start_date: editPeriodModal.start_date,
                end_date: editPeriodModal.end_date
            });
            alert("Subscription period updated successfully");
            setEditPeriodModal({ show: false, subscription: null, start_date: '', end_date: '' });
            fetchSubscriptions();
        } catch (error) {
            console.error("Error updating subscription period:", error);
            alert("Failed to update subscription period");
        }
    };

    const confirmExport = () => {
        exportSubscriptions(exportType, exportFilter);
        setShowExportModal(false);
    };

    const exportSubscriptions = (type, filterStr) => {
        const title = `Subscriptions Report - ${filterStr.toUpperCase()}`;
        const columns = [
            "ID", "Institute Name", "Email", "Plan", "Billing", 
            "Original Price (INR)", "Discount (INR)", "Final Paid (INR)", 
            "Start Date", "End Date", "Status"
        ];

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
            sub.billing_cycle || "monthly",
            sub.original_price || 0,
            sub.discount_amount || 0,
            sub.amount_paid,
            sub.start_date ? new Date(sub.start_date).toLocaleDateString() : 'N/A',
            sub.end_date ? new Date(sub.end_date).toLocaleDateString() : 'N/A',
            sub.payment_status.toUpperCase()
        ]);

        if (type === "PDF") {
            const doc = new jsPDF("landscape");
            doc.text(title, 14, 15);
            autoTable(doc, {
                head: [columns],
                body: rows,
                startY: 20,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [79, 70, 229] }
            });
            doc.save(`${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
        } else if (type === "Excel") {
            const worksheet = XLSX.utils.aoa_to_sheet([columns, ...rows]);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Subscriptions");
            XLSX.writeFile(workbook, `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xlsx`);
        }
    };

    // Calculate dynamic stats for the current page/dataset
    const totalRevenue = subscriptions
        .filter(s => s.payment_status === 'paid')
        .reduce((sum, s) => sum + parseFloat(s.amount_paid || 0), 0);
        
    const totalDiscounts = subscriptions
        .filter(s => s.payment_status === 'paid')
        .reduce((sum, s) => sum + parseFloat(s.discount_amount || 0), 0);

    return (
        <div className="dashboard-container" style={{ paddingBottom: '3rem' }}>
            <div className="dashboard-header">
                <div>
                    <h1>💳 Subscriptions Management</h1>
                    <p>Track and manage institute subscriptions & revenue</p>
                </div>
                <div className="dashboard-header-right">
                    <ThemeSelector />
                    <button onClick={() => handleExport("PDF")} className="btn btn-primary" style={{ backgroundColor: "#ef4444", borderColor: "#ef4444" }}>📄 PDF</button>
                    <button onClick={() => handleExport("Excel")} className="btn btn-primary" style={{ backgroundColor: "#10b981", borderColor: "#10b981" }}>📊 Excel</button>
                    <BackButton />
                </div>
            </div>

            {/* Stats Summary Bar */}
            <div className="stats-grid" style={{ marginBottom: "2rem" }}>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: 'white' }}>
                        💰
                    </div>
                    <div className="stat-content">
                        <h3>₹{totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
                        <p>Total Revenue (Current View)</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", color: 'white' }}>
                        🏷️
                    </div>
                    <div className="stat-content">
                        <h3>₹{totalDiscounts.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
                        <p>Discounts Given</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)", color: 'white' }}>
                        📋
                    </div>
                    <div className="stat-content">
                        <h3>{totalRecords}</h3>
                        <p>Total Subscriptions</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="filters-section" style={{ 
                display: 'flex', gap: '1rem', marginBottom: "1.5rem", flexWrap: 'wrap',
                background: 'var(--card-bg)', padding: '1rem', borderRadius: '0.5rem', boxShadow: 'var(--shadow-sm)'
            }}>
                <div style={{ flex: 1, minWidth: '250px' }}>
                    <input 
                        type="text" 
                        placeholder="Search institute name or email..." 
                        className="form-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: '100%' }}
                    />
                </div>
                <div style={{ minWidth: '150px' }}>
                    <select
                        className="form-select"
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setPage(1);
                        }}
                        style={{ width: '100%' }}
                    >
                        <option value="">All Status</option>
                        <option value="paid">Paid</option>
                        <option value="pending">Pending</option>
                        <option value="failed">Failed</option>
                    </select>
                </div>
            </div>

            {/* Subscriptions Table */}
            <div className="card" style={{ overflow: 'hidden' }}>
                <div className="table-container">
                    <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--table-header-bg)', borderBottom: '2px solid var(--border-color)' }}>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>ID & Institute</th>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>Plan Details</th>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>Original Amount</th>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>Discount</th>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>GST</th>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>Total Amount</th>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>Period</th>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>Status</th>
                                <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="9" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                                        <div className="spinner"></div> Loading subscriptions...
                                    </td>
                                </tr>
                            ) : subscriptions.length === 0 ? (
                                <tr>
                                    <td colSpan="9" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                                        No subscription records found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                subscriptions.map((sub) => (
                                    <tr key={sub.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                                        
                                        {/* Institute Info */}
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{ 
                                                    background: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5', 
                                                    width: '36px', height: '36px', borderRadius: '50%', 
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontWeight: 'bold', fontSize: '0.8rem', flexShrink: 0
                                                }}>
                                                    #{sub.id}
                                                </div>
                                                <div>
                                                    <strong style={{ color: 'var(--text-primary)', display: 'block' }}>
                                                        {sub.Institute?.name || "Unknown"}
                                                    </strong>
                                                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                                        {sub.Institute?.email}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        
                                        {/* Plan Info */}
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
                                                {sub.Plan?.name || "Custom Plan"}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                                                {sub.billing_cycle || 'monthly'} Billing
                                            </div>
                                        </td>
                                        
                                        {/* Original Amount */}
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                                                ₹{parseFloat(sub.original_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </span>
                                        </td>

                                        {/* Discount */}
                                        <td style={{ padding: '1rem' }}>
                                            {sub.discount_applied ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                    <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 'bold' }}>
                                                        {sub.original_price > 0 ? Math.round((parseFloat(sub.discount_amount || 0) / parseFloat(sub.original_price)) * 100) : 0}% Off
                                                    </span>
                                                    <span style={{ 
                                                        background: 'rgba(22, 163, 74, 0.1)', color: '#16a34a', 
                                                        padding: '0.2rem 0.5rem', borderRadius: '4px', 
                                                        fontSize: '0.85rem', fontWeight: 'bold',
                                                        display: 'inline-block', width: 'fit-content'
                                                    }}>
                                                        ₹{parseFloat(sub.discount_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)' }}>-</span>
                                            )}
                                        </td>

                                        {/* GST */}
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                                                ₹{parseFloat(sub.tax_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </span>
                                        </td>

                                        {/* Total Amount */}
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                                                ₹{parseFloat(sub.amount_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </div>
                                        </td>
                                        
                                        {/* Period */}
                                        <td style={{ padding: '1rem' }}>
                                            {sub.start_date && new Date(sub.start_date).getFullYear() > 1970 ? (
                                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                                        <div><span style={{ color: 'var(--text-muted)', width: '35px', display: 'inline-block' }}>From:</span> {new Date(sub.start_date).toLocaleDateString()}</div>
                                                        <div><span style={{ color: 'var(--text-muted)', width: '35px', display: 'inline-block' }}>To:</span> {new Date(sub.end_date).toLocaleDateString()}</div>
                                                    </div>
                                                    <button 
                                                        className="btn btn-sm btn-secondary"
                                                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', marginLeft: '0.5rem', cursor: 'pointer' }}
                                                        onClick={() => handleOpenEditPeriod(sub)}
                                                        title="Edit Period"
                                                    >
                                                        ✎
                                                    </button>
                                                </div>
                                            ) : (
                                                <span style={{ 
                                                    background: 'var(--bg-secondary)', color: 'var(--text-muted)', 
                                                    padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem'
                                                }}>
                                                    Pending Activation
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* Status */}
                                        <td style={{ padding: '1rem' }}>
                                            <span className={`badge badge-${
                                                sub.payment_status === 'paid' ? 'success' :
                                                sub.payment_status === 'pending' ? 'warning' : 'danger'
                                            }`} style={{ padding: '0.4rem 0.8rem' }}>
                                                {sub.payment_status}
                                            </span>
                                        </td>
                                        
                                        {/* Actions */}
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                {sub.payment_status === "pending" && (
                                                    <button
                                                        className="btn btn-sm btn-success"
                                                        onClick={() => handleUpdateStatus(sub.id, "paid")}
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
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ 
                        padding: '1rem 1.5rem', 
                        borderTop: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--table-header-bg)'
                    }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Showing page <strong style={{ color: 'var(--text-primary)' }}>{page}</strong> of <strong style={{ color: 'var(--text-primary)' }}>{totalPages}</strong>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                                className="btn btn-secondary btn-sm"
                                disabled={page === 1}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                            >
                                Previous
                            </button>
                            <button 
                                className="btn btn-secondary btn-sm"
                                disabled={page === totalPages}
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
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
                            <p style={{ marginBottom: "1rem", color: 'var(--text-muted)' }}>Which records would you like to export?</p>
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
                        <div className="modal-footer" style={{ borderTop: 'none', paddingTop: 0 }}>
                            <button onClick={() => setShowExportModal(false)} className="btn btn-secondary">Cancel</button>
                            <button onClick={confirmExport} className="btn btn-primary">Download {exportType}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Period Modal */}
            {editPeriodModal.show && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2>Edit Subscription Period</h2>
                            <button onClick={() => setEditPeriodModal({ show: false, subscription: null, start_date: '', end_date: '' })} className="close-btn">&times;</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group" style={{ marginBottom: "1rem" }}>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Start Date</label>
                                <input 
                                    type="date" 
                                    className="form-control" 
                                    value={editPeriodModal.start_date}
                                    onChange={(e) => setEditPeriodModal({...editPeriodModal, start_date: e.target.value})}
                                    style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--border-color)" }}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>End Date</label>
                                <input 
                                    type="date" 
                                    className="form-control" 
                                    value={editPeriodModal.end_date}
                                    onChange={(e) => setEditPeriodModal({...editPeriodModal, end_date: e.target.value})}
                                    style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--border-color)" }}
                                />
                            </div>
                        </div>
                        <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
                            <button 
                                className="btn btn-secondary"
                                onClick={() => setEditPeriodModal({ show: false, subscription: null, start_date: '', end_date: '' })}
                            >
                                Cancel
                            </button>
                            <button 
                                className="btn btn-primary"
                                onClick={handleUpdatePeriod}
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Subscriptions;
