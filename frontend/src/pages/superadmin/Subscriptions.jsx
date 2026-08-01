/**
 * Super Admin - Subscriptions Management
 * Redesigned UI to match the professional mockup.
 */

import { useState, useEffect, useRef } from "react";
import api from "../../services/api";
import { io } from "socket.io-client";
import { Link } from "react-router-dom";
import { 
    FiDownload, FiArrowLeft, FiCreditCard, FiTag, 
    FiFileText, FiRefreshCw, FiSearch, FiCalendar, 
    FiFilter, FiMoreVertical 
} from "react-icons/fi";
import ThemeSelector from "../../components/ThemeSelector";

// Styles
import "../admin/Dashboard.css";
import "./Subscriptions.css"; 

function Subscriptions() {
    const [subscriptions, setSubscriptions] = useState([]);
    const [metrics, setMetrics] = useState({
        total_revenue: 0,
        total_discounts: 0,
        total_subscriptions: 0,
        paid_count: 0,
        pending_count: 0,
        test_count: 0
    });
    const [loading, setLoading] = useState(true);
    
    // Filters State
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [dateRangeFilter, setDateRangeFilter] = useState("this_month");
    const [planFilter, setPlanFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [exportFilter, setExportFilter] = useState("all");

    // Edit Period Modal State
    const [editPeriodModal, setEditPeriodModal] = useState({ show: false, subscription: null, start_date: '', end_date: '' });
    
    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const limit = 10; // 10 per page as in screenshot

    // Action Menu State
    const [openActionId, setOpenActionId] = useState(null);
    const actionMenuRef = useRef(null);

    // Close action menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) {
                setOpenActionId(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPage(1); 
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Derived Dates based on dropdown
    const getDateRange = (rangeType) => {
        const today = new Date();
        const start = new Date();
        if (rangeType === 'this_month') {
            start.setDate(1);
            return { startDate: start.toISOString().split('T')[0], endDate: today.toISOString().split('T')[0] };
        } else if (rangeType === 'last_month') {
            start.setMonth(start.getMonth() - 1);
            start.setDate(1);
            const end = new Date(today.getFullYear(), today.getMonth(), 0);
            return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
        }
        return { startDate: "", endDate: "" }; // All time
    };

    useEffect(() => {
        fetchSubscriptions();
    }, [statusFilter, debouncedSearch, dateRangeFilter, page, planFilter]);

    // Socket.io for Real-time Updates
    useEffect(() => {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        const socket = io(import.meta.env.VITE_API_URL || "http://localhost:5000", {
            auth: { token }
        });

        socket.on("connect", () => {
            socket.emit("join_superadmin");
        });

        socket.on("subscription_updated", () => {
            fetchSubscriptions();
        });

        return () => {
            socket.emit("leave_superadmin");
            socket.disconnect();
        };
    }, []);

    const fetchSubscriptions = async () => {
        setLoading(true);
        try {
            const { startDate, endDate } = getDateRange(dateRangeFilter);
            const params = new URLSearchParams({ page, limit });
            if (statusFilter) params.append("status", statusFilter);
            if (debouncedSearch) params.append("search", debouncedSearch);
            if (planFilter) params.append("plan", planFilter);
            if (startDate) params.append("startDate", startDate);
            if (endDate) params.append("endDate", endDate);

            const response = await api.get(`/subscriptions?${params.toString()}`);
            const { metrics: resMetrics, data } = response.data;
            
            setSubscriptions(data.subscriptions || []);
            setMetrics(resMetrics || { total_revenue: 0, total_discounts: 0, total_subscriptions: 0, paid_count: 0, pending_count: 0, test_count: 0 });
            
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
        if (!window.confirm(`Mark this subscription as ${newStatus}?`)) return;
        try {
            await api.patch(`/subscriptions/${subscriptionId}/status`, { payment_status: newStatus });
            setOpenActionId(null);
            fetchSubscriptions();
        } catch (error) {
            alert(error.response?.data?.message || "Failed to update subscription status");
        }
    };

    const handleToggleTest = async (instituteId, currentStatus) => {
        const newStatus = !currentStatus;
        if (!window.confirm(newStatus ? "Mark as TEST account?" : "Mark as LIVE account?")) return;
        try {
            await api.patch(`/subscriptions/institute/${instituteId}/toggle-test`, { is_test: newStatus });
            setOpenActionId(null);
            fetchSubscriptions();
        } catch (error) {
            alert(error.response?.data?.message || "Failed to toggle test mode");
        }
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

    const handleExport = async (format) => {
        if (subscriptions.length === 0) return alert("No subscription data to export.");
        try {
            const { startDate, endDate } = getDateRange(dateRangeFilter);
            const params = new URLSearchParams({ format });
            if (statusFilter) params.append("status", statusFilter);
            if (debouncedSearch) params.append("search", debouncedSearch);
            if (planFilter) params.append("plan", planFilter);
            if (startDate) params.append("startDate", startDate);
            if (endDate) params.append("endDate", endDate);

            const response = await api.get(`/subscriptions/export?${params.toString()}`, {
                responseType: 'blob'
            });

            const blob = new Blob([response.data]);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `subscriptions_${new Date().getTime()}.${format === 'excel' ? 'xlsx' : 'pdf'}`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (error) {
            alert("Failed to export data");
        }
    };

    return (
        <div className="dashboard-container" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            
            {/* Header */}
            <div className="subscriptions-header-modern">
                <div>
                    <h1>Subscriptions Management</h1>
                    <p>Track and manage institute subscriptions, billing and revenue.</p>
                </div>
                <div className="subscriptions-actions">
                    <ThemeSelector />
                    
                    <div className="action-menu-container">
                        <button className="btn-export" onClick={() => setOpenActionId(openActionId === 'export' ? null : 'export')}>
                            <FiDownload /> Export
                        </button>
                        {openActionId === 'export' && (
                            <div className="action-menu" style={{ right: 0, minWidth: '120px' }}>
                                <div className="action-menu-item" onClick={() => { handleExport('excel'); setOpenActionId(null); }}>Excel (.xlsx)</div>
                                <div className="action-menu-item" onClick={() => { handleExport('pdf'); setOpenActionId(null); }}>PDF Document</div>
                            </div>
                        )}
                    </div>

                    <Link to="/superadmin/dashboard" style={{ textDecoration: 'none' }}>
                        <button className="btn-back-dash">
                            <FiArrowLeft /> Back to Dashboard
                        </button>
                    </Link>
                </div>
            </div>

            {/* Metrics Cards */}
            <div className="modern-stats-grid">
                <div className="modern-stat-card">
                    <div className="modern-stat-icon purple"><FiCreditCard /></div>
                    <div className="modern-stat-content">
                        <h3>Total Revenue</h3>
                        <p className="stat-value">₹{metrics.total_revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        <span className="stat-trend trend-up">↑ 12.5% vs last month</span>
                    </div>
                </div>
                <div className="modern-stat-card">
                    <div className="modern-stat-icon green"><FiTag /></div>
                    <div className="modern-stat-content">
                        <h3>Discounts Given</h3>
                        <p className="stat-value">₹{metrics.total_discounts.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        <span className="stat-trend trend-up">↑ 8.3% vs last month</span>
                    </div>
                </div>
                <div className="modern-stat-card">
                    <div className="modern-stat-icon blue"><FiFileText /></div>
                    <div className="modern-stat-content">
                        <h3>Total Subscriptions</h3>
                        <p className="stat-value">{metrics.total_subscriptions}</p>
                        <span className="stat-trend trend-up">↑ 5.7% vs last month</span>
                    </div>
                </div>
                <div className="modern-stat-card">
                    <div className="modern-stat-icon yellow"><FiRefreshCw /></div>
                    <div className="modern-stat-content">
                        <h3>Active Subscriptions</h3>
                        <p className="stat-value">{metrics.paid_count}</p>
                        <span className="stat-trend trend-neutral">{metrics.total_subscriptions > 0 ? Math.round((metrics.paid_count / metrics.total_subscriptions)*100) : 0}% of total</span>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="modern-filters-bar">
                <div className="modern-filter-group search-group">
                    <FiSearch className="modern-filter-icon" />
                    <input 
                        type="text" 
                        placeholder="Search institute name or email..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                
                <div className="filter-wrapper">
                    <span className="modern-filter-label">Date Range</span>
                    <div className="modern-filter-group">
                        <FiCalendar className="modern-filter-icon" />
                        <select value={dateRangeFilter} onChange={(e) => { setDateRangeFilter(e.target.value); setPage(1); }}>
                            <option value="all_time">All Time</option>
                            <option value="this_month">This Month</option>
                            <option value="last_month">Last Month</option>
                        </select>
                    </div>
                </div>

                <div className="filter-wrapper">
                    <span className="modern-filter-label">Plan</span>
                    <div className="modern-filter-group">
                        <select value={planFilter} onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}>
                            <option value="">All Plans</option>
                            <option value="basic">Basic</option>
                            <option value="starter">Starter</option>
                            <option value="professional">Professional</option>
                            <option value="enterprise">Enterprise</option>
                        </select>
                    </div>
                </div>

                <div className="filter-wrapper">
                    <span className="modern-filter-label">Status</span>
                    <div className="modern-filter-group">
                        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                            <option value="">All Status</option>
                            <option value="paid">Paid</option>
                            <option value="pending">Pending</option>
                            <option value="failed">Failed</option>
                        </select>
                    </div>
                </div>

                <button className="btn-filter" onClick={() => { setSearchQuery(''); setDateRangeFilter('all_time'); setPlanFilter(''); setStatusFilter(''); }}>
                    <FiFilter /> Filters
                </button>
            </div>

            {/* Table */}
            <div className="modern-table-card">
                <div style={{ overflowX: 'auto' }}>
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th>ID & Institute</th>
                                <th>Plan Details</th>
                                <th>Original Amount</th>
                                <th>Discount</th>
                                <th>GST</th>
                                <th>Total Amount</th>
                                <th>Period</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                        Loading subscriptions...
                                    </td>
                                </tr>
                            ) : subscriptions.length === 0 ? (
                                <tr>
                                    <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                        No results found.
                                    </td>
                                </tr>
                            ) : (
                                subscriptions.map(sub => (
                                    <tr key={sub.id} style={{ backgroundColor: sub.is_test ? 'rgba(245, 158, 11, 0.03)' : 'transparent' }}>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                                <div className="id-circle">#{sub.id}</div>
                                                <div>
                                                    <span className="institute-name">
                                                        {sub.Institute?.name || 'Unknown'} {sub.is_test && ' 🧪'}
                                                    </span>
                                                    <span className="institute-email">{sub.Institute?.email || '-'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="plan-name">{sub.Plan?.name || 'Custom'} {sub.Plan?.platform_type && `+ ${sub.Plan.platform_type}`}</span>
                                            <span className="plan-billing">{sub.billing_cycle || 'monthly'} Billing</span>
                                        </td>
                                        <td>
                                            <span className="amount-text">₹{(parseFloat(sub.original_price || sub.amount_paid)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </td>
                                        <td>
                                            {sub.discount_applied ? (
                                                <div>
                                                    <span className="discount-text-percent">
                                                        {Math.round((parseFloat(sub.discount_amount) / parseFloat(sub.original_price)) * 100)}% Off
                                                    </span>
                                                    <span className="discount-text-amount">-₹{parseFloat(sub.discount_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)' }}>-</span>
                                            )}
                                        </td>
                                        <td>
                                            <span className="amount-text">₹{parseFloat(sub.tax_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </td>
                                        <td>
                                            <span className="amount-text" style={{ fontSize: '1.05rem' }}>₹{parseFloat(sub.amount_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            {sub.start_date && new Date(sub.start_date).getFullYear() > 1970 ? (
                                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                                        <div><span style={{ color: 'var(--text-muted)', width: '35px', display: 'inline-block' }}>From:</span> {new Date(sub.start_date).toLocaleDateString('en-GB')}</div>
                                                        <div><span style={{ color: 'var(--text-muted)', width: '35px', display: 'inline-block' }}>To:</span> {new Date(sub.end_date).toLocaleDateString('en-GB')}</div>
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
                                                <span className="period-text" style={{ color: 'var(--text-muted)' }}>Pending</span>
                                            )}
                                        </td>
                                        <td>
                                            <div className={`status-badge ${sub.payment_status}`}>
                                                <div className="status-dot"></div>
                                                {sub.payment_status === 'paid' ? 'Paid' : sub.payment_status === 'pending' ? 'Pending' : 'Failed'}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div className="action-menu-container" ref={openActionId === sub.id ? actionMenuRef : null} style={{ display: 'inline-block' }}>
                                                <button className="btn-actions" onClick={() => setOpenActionId(openActionId === sub.id ? null : sub.id)}>
                                                    <FiMoreVertical />
                                                </button>
                                                
                                                {openActionId === sub.id && (
                                                    <div className="action-menu">
                                                        {sub.payment_status !== 'paid' && (
                                                            <div className="action-menu-item" onClick={() => handleUpdateStatus(sub.id, 'paid')}>Mark Paid</div>
                                                        )}
                                                        {sub.payment_status !== 'failed' && (
                                                            <div className="action-menu-item" onClick={() => handleUpdateStatus(sub.id, 'failed')}>Mark Failed</div>
                                                        )}
                                                        <div className="action-menu-item" onClick={() => handleToggleTest(sub.institute_id, sub.is_test)}>
                                                            {sub.is_test ? 'Switch to Live Account' : 'Switch to Test Account'}
                                                        </div>
                                                        <div className="action-menu-item danger" onClick={() => handleUpdateStatus(sub.id, 'deleted')}>Delete Record</div>
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

                {/* Pagination */}
                {totalRecords > 0 && (
                    <div className="modern-pagination">
                        <div className="pagination-info">
                            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalRecords)} of {totalRecords} results
                        </div>
                        <div className="pagination-controls">
                            <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>&lt;</button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                // Simple sliding window for page numbers
                                let pageNum = i + 1;
                                if (totalPages > 5 && page > 3) pageNum = page - 2 + i;
                                if (pageNum > totalPages) return null;
                                return (
                                    <button 
                                        key={pageNum} 
                                        className={`page-btn ${page === pageNum ? 'active' : ''}`}
                                        onClick={() => setPage(pageNum)}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                            <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>&gt;</button>
                        </div>
                    </div>
                )}
            </div>
            
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
                        <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
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
