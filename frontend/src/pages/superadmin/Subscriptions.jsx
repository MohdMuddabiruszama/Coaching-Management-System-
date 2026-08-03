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
        <div className="sm-container">
            <div className="sm-breadcrumb">
                <Link to="/superadmin/dashboard">🏠 Dashboard</Link> &gt; <span>Subscriptions Management</span>
            </div>

            {/* Header */}
            <div className="sm-header">
                <div className="sm-header-left">
                    <div className="sm-header-icon">
                        <FiCreditCard />
                    </div>
                    <div>
                        <h1>Subscriptions Management</h1>
                        <p>Track and manage institute subscriptions, billing and revenue.</p>
                    </div>
                </div>
                <div className="sm-header-right">
                    <div className="action-menu-container" style={{ position: 'relative' }}>
                        <button className="sm-btn-export" onClick={() => setOpenActionId(openActionId === 'export' ? null : 'export')}>
                            <FiDownload /> Export
                        </button>
                        {openActionId === 'export' && (
                            <div className="sm-action-menu">
                                <div className="sm-action-menu-item" onClick={() => { handleExport('excel'); setOpenActionId(null); }}>Excel (.xlsx)</div>
                                <div className="sm-action-menu-item" onClick={() => { handleExport('pdf'); setOpenActionId(null); }}>PDF Document</div>
                            </div>
                        )}
                    </div>
                    <button className="sm-btn-primary" onClick={() => alert("Add Subscription coming soon!")}>
                        + Add Subscription
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="sm-stats-grid">
                <div className="sm-stat-card">
                    <div className="sm-stat-icon-wrap purple"><FiCreditCard /></div>
                    <div className="sm-stat-content">
                        <h3>Total Revenue</h3>
                        <p className="sm-stat-value">₹{metrics.total_revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        <span className="sm-stat-trend up">↑ 12.5% vs last month</span>
                    </div>
                </div>
                <div className="sm-stat-card">
                    <div className="sm-stat-icon-wrap green"><FiTag /></div>
                    <div className="sm-stat-content">
                        <h3>Discounts Given</h3>
                        <p className="sm-stat-value">₹{metrics.total_discounts.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        <span className="sm-stat-trend up">↑ 8.3% vs last month</span>
                    </div>
                </div>
                <div className="sm-stat-card">
                    <div className="sm-stat-icon-wrap blue"><FiFileText /></div>
                    <div className="sm-stat-content">
                        <h3>Total Subscriptions</h3>
                        <p className="sm-stat-value">{metrics.total_subscriptions}</p>
                        <span className="sm-stat-trend up">↑ 5.7% vs last month</span>
                    </div>
                </div>
                <div className="sm-stat-card">
                    <div className="sm-stat-icon-wrap yellow"><FiRefreshCw /></div>
                    <div className="sm-stat-content">
                        <h3>Active Subscriptions</h3>
                        <p className="sm-stat-value">{metrics.paid_count}</p>
                        <span className="sm-stat-trend neutral">{metrics.total_subscriptions > 0 ? Math.round((metrics.paid_count / metrics.total_subscriptions)*100) : 0}% of total</span>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="sm-filter-bar">
                <div className="sm-search-wrap">
                    <FiSearch className="sm-search-icon" />
                    <input 
                        type="text" 
                        className="sm-search-input"
                        placeholder="Search by institute name, email or plan..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                
                <div className="sm-filter-group">
                    <span className="sm-filter-label">Date Range</span>
                    <div className="sm-filter-select-wrap">
                        <FiCalendar className="sm-filter-icon" />
                        <select className="sm-filter-select" value={dateRangeFilter} onChange={(e) => { setDateRangeFilter(e.target.value); setPage(1); }}>
                            <option value="all_time">All Time</option>
                            <option value="this_month">This Month</option>
                            <option value="last_month">Last Month</option>
                        </select>
                        <span className="sm-select-arrow">▼</span>
                    </div>
                </div>

                <div className="sm-filter-group">
                    <span className="sm-filter-label">Plan</span>
                    <div className="sm-filter-select-wrap">
                        <select className="sm-filter-select" value={planFilter} onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}>
                            <option value="">All Plans</option>
                            <option value="basic">Basic</option>
                            <option value="starter">Starter</option>
                            <option value="professional">Professional</option>
                            <option value="enterprise">Enterprise</option>
                        </select>
                        <span className="sm-select-arrow">▼</span>
                    </div>
                </div>

                <div className="sm-filter-group">
                    <span className="sm-filter-label">Status</span>
                    <div className="sm-filter-select-wrap">
                        <select className="sm-filter-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                            <option value="">All Status</option>
                            <option value="paid">Paid</option>
                            <option value="pending">Pending</option>
                            <option value="failed">Failed</option>
                        </select>
                        <span className="sm-select-arrow">▼</span>
                    </div>
                </div>
                
                <div className="sm-filter-group">
                    <span className="sm-filter-label" style={{ visibility: 'hidden' }}>Payment Status</span>
                    <div className="sm-filter-select-wrap">
                        <select className="sm-filter-select" disabled>
                            <option value="">All Payments</option>
                        </select>
                        <span className="sm-select-arrow">▼</span>
                    </div>
                </div>

                <button className="sm-btn-more-filters">
                    <FiFilter /> More Filters
                </button>
                <button className="sm-btn-reset-filters" onClick={() => { setSearchQuery(''); setDateRangeFilter('this_month'); setPlanFilter(''); setStatusFilter(''); }}>
                    Reset Filters
                </button>
            </div>

            {/* Table */}
            <div className="sm-table-container">
                <h3 className="sm-table-title">Subscriptions ({totalRecords})</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table className="sm-table">
                        <thead>
                            <tr>
                                <th>Institute</th>
                                <th>Plan & Billing</th>
                                <th>Amount</th>
                                <th>Discount</th>
                                <th>GST</th>
                                <th>Total</th>
                                <th>Period</th>
                                <th>Status</th>
                                <th>Payment</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="10" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                                        Loading subscriptions...
                                    </td>
                                </tr>
                            ) : subscriptions.length === 0 ? (
                                <tr>
                                    <td colSpan="10" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                                        No results found.
                                    </td>
                                </tr>
                            ) : (
                                subscriptions.map(sub => {
                                    // Calculate days left
                                    let daysLeft = null;
                                    if (sub.end_date && new Date(sub.end_date).getFullYear() > 1970) {
                                        const end = new Date(sub.end_date);
                                        const now = new Date();
                                        const diffTime = end - now;
                                        daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                    }
                                    const instName = sub.Institute?.name || 'Unknown';
                                    const nameParts = instName.split(' ').filter(p => p.length > 0);
                                    const initial = nameParts.length > 1 
                                        ? (nameParts[0][0] + nameParts[1][0]).toUpperCase() 
                                        : instName.substring(0, 2).toUpperCase();
                                    
                                    // Generate a stable color based on name
                                    const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
                                    const colorIdx = instName.charCodeAt(0) % colors.length;
                                    const avatarBg = colors[colorIdx] + '20'; // 20% opacity
                                    const avatarColor = colors[colorIdx];

                                    return (
                                    <tr key={sub.id}>
                                        <td>
                                            <div className="sm-inst-cell">
                                                <div className="sm-avatar" style={{ backgroundColor: avatarBg, color: avatarColor }}>
                                                    {initial}
                                                </div>
                                                <div>
                                                    <div className="sm-inst-name">
                                                        {instName}
                                                        {!sub.is_test && <span className="sm-verified-badge">Verified</span>}
                                                    </div>
                                                    <div className="sm-inst-email">{sub.Institute?.email || '-'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="sm-plan-details">{sub.Plan?.name || 'Custom'} {sub.Plan?.platform_type && `+ ${sub.Plan.platform_type}`}</div>
                                            <div className="sm-billing-cycle">{sub.billing_cycle === 'yearly' ? 'Yearly Billing' : 'Monthly Billing'}</div>
                                        </td>
                                        <td>
                                            <div className="sm-amount-text">₹{(parseFloat(sub.original_price || sub.amount_paid)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                        </td>
                                        <td>
                                            {sub.discount_applied ? (
                                                <div>
                                                    <div className="sm-discount-percent">
                                                        {Math.round((parseFloat(sub.discount_amount) / parseFloat(sub.original_price)) * 100)}% Off
                                                    </div>
                                                    <div className="sm-discount-amount">-₹{parseFloat(sub.discount_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                                </div>
                                            ) : (
                                                <span style={{ color: '#94a3b8' }}>-</span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="sm-amount-text">₹{parseFloat(sub.tax_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                        </td>
                                        <td>
                                            <div className="sm-amount-text">₹{parseFloat(sub.amount_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                        </td>
                                        <td>
                                            {sub.start_date && new Date(sub.start_date).getFullYear() > 1970 ? (
                                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                                    <div>
                                                        <div className="sm-period-date">{new Date(sub.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                                        <div className="sm-period-to">to</div>
                                                        <div className="sm-period-date">{new Date(sub.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                                        {daysLeft !== null && (
                                                            <div className={`sm-period-days ${daysLeft < 30 ? 'sm-days-danger' : 'sm-days-success'}`}>
                                                                ({daysLeft} days left)
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button 
                                                        style={{ padding: '0.2rem', marginLeft: '0.5rem', cursor: 'pointer', background: 'transparent', border: 'none', color: '#64748b', fontSize: '1rem' }}
                                                        onClick={() => handleOpenEditPeriod(sub)}
                                                        title="Edit Period"
                                                    >
                                                        ✎
                                                    </button>
                                                </div>
                                            ) : (
                                                <span style={{ color: '#94a3b8' }}>Pending</span>
                                            )}
                                        </td>
                                        <td>
                                            <div className={`sm-badge ${sub.payment_status === 'paid' ? 'active' : sub.payment_status}`}>
                                                <div className="sm-badge-dot"></div>
                                                Active
                                            </div>
                                        </td>
                                        <td>
                                            <div className={`sm-badge ${sub.payment_status}`}>
                                                <div className="sm-badge-dot"></div>
                                                {sub.payment_status === 'paid' ? 'Paid' : sub.payment_status === 'pending' ? 'Pending' : 'Failed'}
                                            </div>
                                            {sub.payment_date && (
                                                <span className="sm-payment-date">{new Date(sub.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div className="action-menu-container" ref={openActionId === sub.id ? actionMenuRef : null} style={{ display: 'inline-block', position: 'relative' }}>
                                                <button className="sm-btn-actions" onClick={() => setOpenActionId(openActionId === sub.id ? null : sub.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0.25rem' }}>
                                                    <FiMoreVertical />
                                                </button>
                                                
                                                {openActionId === sub.id && (
                                                    <div className="sm-action-menu">
                                                        <div className="sm-action-menu-item" onClick={() => { setOpenActionId(null); handleOpenEditPeriod(sub); }}>Edit Period</div>
                                                        {sub.payment_status !== 'paid' && (
                                                            <div className="sm-action-menu-item" onClick={() => handleUpdateStatus(sub.id, 'paid')}>Mark Paid</div>
                                                        )}
                                                        {sub.payment_status !== 'failed' && (
                                                            <div className="sm-action-menu-item" onClick={() => handleUpdateStatus(sub.id, 'failed')}>Mark Failed</div>
                                                        )}
                                                        <div className="sm-action-menu-item" onClick={() => handleToggleTest(sub.institute_id, sub.is_test)}>
                                                            {sub.is_test ? 'Switch to Live Account' : 'Switch to Test Account'}
                                                        </div>
                                                        <div className="sm-action-menu-item danger" onClick={() => handleUpdateStatus(sub.id, 'deleted')}>Delete Record</div>
                                                    </div>
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

                {/* Pagination */}
                {totalRecords > 0 && (
                    <div className="sm-pagination">
                        <div className="sm-pagination-text">
                            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalRecords)} of {totalRecords} results
                        </div>
                        <div className="sm-pagination-controls">
                            <div className="sm-per-page">
                                Rows per page:
                                <select defaultValue="10" disabled>
                                    <option value="10">10</option>
                                </select>
                            </div>
                            <div className="sm-page-buttons">
                                <button className="sm-page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>&lt;</button>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum = i + 1;
                                    if (totalPages > 5 && page > 3) pageNum = page - 2 + i;
                                    if (pageNum > totalPages) return null;
                                    return (
                                        <button 
                                            key={pageNum} 
                                            className={`sm-page-btn ${page === pageNum ? 'active' : ''}`}
                                            onClick={() => setPage(pageNum)}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                                <button className="sm-page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>&gt;</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Edit Period Modal */}
            {editPeriodModal.show && (
                <div className="sm-modal-overlay">
                    <div className="sm-modal-content">
                        <div className="sm-modal-header">
                            <h2>Edit Subscription Period</h2>
                            <button onClick={() => setEditPeriodModal({ show: false, subscription: null, start_date: '', end_date: '' })} className="sm-close-btn">&times;</button>
                        </div>
                        <div className="sm-modal-body">
                            <div style={{ marginBottom: "1rem" }}>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: '#475569' }}>Start Date</label>
                                <input 
                                    type="date" 
                                    value={editPeriodModal.start_date}
                                    onChange={(e) => setEditPeriodModal({...editPeriodModal, start_date: e.target.value})}
                                    style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none" }}
                                />
                            </div>
                            <div style={{ marginBottom: "1.5rem" }}>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: '#475569' }}>End Date</label>
                                <input 
                                    type="date" 
                                    value={editPeriodModal.end_date}
                                    onChange={(e) => setEditPeriodModal({...editPeriodModal, end_date: e.target.value})}
                                    style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none" }}
                                />
                            </div>
                        </div>
                        <div className="sm-modal-footer">
                            <button 
                                onClick={() => setEditPeriodModal({ show: false, subscription: null, start_date: '', end_date: '' })}
                                style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'transparent', cursor: 'pointer', fontWeight: '600', color: '#475569' }}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleUpdatePeriod}
                                style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', background: '#4f46e5', color: 'white', cursor: 'pointer', fontWeight: '600' }}
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
