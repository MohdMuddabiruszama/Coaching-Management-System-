import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import ThemeSelector from "../../components/ThemeSelector";
import { 
    FiDownload, FiPlus, FiSearch, FiFilter, FiMail, FiPhone, 
    FiEye, FiMoreVertical, FiCalendar, FiCheckCircle, FiXCircle, FiInbox, FiUserPlus
} from "react-icons/fi";
import * as XLSX from "xlsx";
import "./Enquiries.css";

function Enquiries() {
    const [enquiries, setEnquiries] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [filterSource, setFilterSource] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [dateRangeFilter, setDateRangeFilter] = useState("all");

    // UI State
    const [showModal, setShowModal] = useState(false);
    const [selectedEnquiry, setSelectedEnquiry] = useState(null);
    const [openActionId, setOpenActionId] = useState(null);
    const actionMenuRef = useRef(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [recordsPerPage, setRecordsPerPage] = useState(10);

    useEffect(() => {
        fetchEnquiries();
        clearUnreadCount();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) {
                setOpenActionId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const clearUnreadCount = async () => {
        try {
            await api.post('/leads/clear-unread');
        } catch (error) {
            console.error("Error clearing unread count", error);
        }
    };

    const fetchEnquiries = async () => {
        try {
            const response = await api.get('/leads');
            if (response.data.success) {
                setEnquiries(response.data.leads || []);
            }
        } catch (error) {
            console.error("Error fetching enquiries:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        if (!filteredEnquiries || filteredEnquiries.length === 0) {
            alert("No data available to export.");
            return;
        }
        
        const exportData = filteredEnquiries.map(e => ({
            Name: e.name || "N/A",
            Email: e.email || "N/A",
            Mobile: e.mobile || "N/A",
            Source: e.source === 'demo_request' ? 'Free Demo' : 'Contact Form',
            Status: e.status || "N/A",
            Date: e.date ? new Date(e.date).toLocaleDateString() : "N/A",
            Message: e.message || "N/A"
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Enquiries");
        XLSX.writeFile(workbook, `Enquiries_Leads_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleUpdateStatus = async (id, newStatus) => {
        try {
            const response = await api.put(`/leads/${id}/status`, { status: newStatus });
            if (response.data.success) {
                setEnquiries(enquiries.map(e => e.id === id ? { ...e, status: newStatus } : e));
            }
        } catch (error) {
            console.error("Failed to update status", error);
            alert("Failed to update status");
        }
    };

    const handleViewDetails = (enquiry) => {
        setSelectedEnquiry(enquiry);
        setShowModal(true);
    };

    // Calculate metrics
    const totalEnquiries = enquiries.length;
    const newEnquiries = enquiries.filter(e => e.status === 'new').length;
    const demoScheduled = enquiries.filter(e => e.status === 'demo_scheduled').length;
    const convertedWon = enquiries.filter(e => e.status === 'closed_won').length;
    const closedLost = enquiries.filter(e => e.status === 'closed_lost').length;

    // Filter logic
    const filteredEnquiries = enquiries.filter(e => {
        // Search
        const searchLower = searchQuery.toLowerCase();
        const matchSearch = !searchQuery || 
            (e.name?.toLowerCase().includes(searchLower)) ||
            (e.email?.toLowerCase().includes(searchLower)) ||
            (e.mobile?.toLowerCase().includes(searchLower));

        // Source
        const matchSource = filterSource === "all" || e.source === filterSource;
        
        // Status
        const matchStatus = filterStatus === "all" || e.status === filterStatus;
        
        // Date (simple logic, assuming date string parsing works)
        let matchDate = true;
        if (dateRangeFilter === 'this_month') {
            const date = new Date(e.date);
            const now = new Date();
            matchDate = date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }

        return matchSearch && matchSource && matchStatus && matchDate;
    });

    // Pagination logic
    const totalRecords = filteredEnquiries.length;
    const totalPages = Math.ceil(totalRecords / recordsPerPage);
    const indexOfLastRecord = currentPage * recordsPerPage;
    const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
    const currentRecords = filteredEnquiries.slice(indexOfFirstRecord, indexOfLastRecord);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    const getSourcePill = (source) => {
        if (source === 'demo_request') return <span className="sm-source-pill green">Free Demo</span>;
        return <span className="sm-source-pill purple">Contact Form</span>;
    };

    const getStatusText = (status) => {
        switch(status) {
            case 'new': return <span className="sm-status-text blue">New</span>;
            case 'contacted': return <span className="sm-status-text blue">Contacted</span>;
            case 'demo_scheduled': return <span className="sm-status-text orange">Demo Scheduled</span>;
            case 'closed_won': return <span className="sm-status-text green">Closed (Won)</span>;
            case 'closed_lost': return <span className="sm-status-text red">Closed (Lost)</span>;
            default: return <span className="sm-status-text">{status}</span>;
        }
    };

    return (
        <div className="sm-container">
            <div className="sm-breadcrumb">
                <Link to="/superadmin/dashboard">🏠 Dashboard</Link> &gt; <span>Enquiries & Leads</span>
            </div>

            {/* Header */}
            <div className="sm-header">
                <div className="sm-header-left">
                    <div className="sm-header-icon">
                        <FiInbox />
                    </div>
                    <div>
                        <h1>Enquiries & Leads</h1>
                        <p>Manage contact submissions and free demo requests from your platform.</p>
                    </div>
                </div>
                <div className="sm-header-right">
                    <div className="action-menu-container" style={{ position: 'relative' }}>
                        <button className="sm-btn-export" onClick={handleExport}>
                            <FiDownload /> Export
                        </button>
                    </div>
                    <button className="sm-btn-primary">
                        <FiPlus /> Add Enquiry
                    </button>
                    <ThemeSelector />
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="sm-stats-grid-5">
                <div className="sm-stat-card">
                    <div className="sm-stat-icon-wrap purple"><FiInbox /></div>
                    <div className="sm-stat-content">
                        <h3>Total Enquiries</h3>
                        <p className="sm-stat-value">{totalEnquiries}</p>
                        <span className="sm-stat-trend up">↑ 18.6% vs last month</span>
                    </div>
                </div>
                <div className="sm-stat-card">
                    <div className="sm-stat-icon-wrap green"><FiUserPlus /></div>
                    <div className="sm-stat-content">
                        <h3>New Enquiries</h3>
                        <p className="sm-stat-value">{newEnquiries}</p>
                        <span className="sm-stat-trend up">↑ 12.4% vs last month</span>
                    </div>
                </div>
                <div className="sm-stat-card">
                    <div className="sm-stat-icon-wrap blue"><FiCalendar /></div>
                    <div className="sm-stat-content">
                        <h3>Demo Scheduled</h3>
                        <p className="sm-stat-value">{demoScheduled}</p>
                        <span className="sm-stat-trend up">↑ 8.3% vs last month</span>
                    </div>
                </div>
                <div className="sm-stat-card">
                    <div className="sm-stat-icon-wrap orange"><FiCheckCircle /></div>
                    <div className="sm-stat-content">
                        <h3>Converted (Won)</h3>
                        <p className="sm-stat-value">{convertedWon}</p>
                        <span className="sm-stat-trend up">↑ 14.7% vs last month</span>
                    </div>
                </div>
                <div className="sm-stat-card">
                    <div className="sm-stat-icon-wrap red"><FiXCircle /></div>
                    <div className="sm-stat-content">
                        <h3>Closed (Lost)</h3>
                        <p className="sm-stat-value">{closedLost}</p>
                        <span className="sm-stat-trend down">↓ 6.2% vs last month</span>
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
                        placeholder="Search by name, email or phone..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                
                <div className="sm-filter-group">
                    <span className="sm-filter-label">Source</span>
                    <div className="sm-filter-select-wrap">
                        <select className="sm-filter-select" value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
                            <option value="all">All Sources</option>
                            <option value="demo_request">Free Demo</option>
                            <option value="contact_form">Contact Form</option>
                        </select>
                        <span className="sm-select-arrow">▼</span>
                    </div>
                </div>

                <div className="sm-filter-group">
                    <span className="sm-filter-label">Status</span>
                    <div className="sm-filter-select-wrap">
                        <select className="sm-filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                            <option value="all">All Statuses</option>
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="demo_scheduled">Demo Scheduled</option>
                            <option value="closed_won">Closed (Won)</option>
                            <option value="closed_lost">Closed (Lost)</option>
                        </select>
                        <span className="sm-select-arrow">▼</span>
                    </div>
                </div>

                <div className="sm-filter-group">
                    <span className="sm-filter-label">Date Range</span>
                    <div className="sm-filter-select-wrap">
                        <select className="sm-filter-select" value={dateRangeFilter} onChange={(e) => setDateRangeFilter(e.target.value)}>
                            <option value="all">All Time</option>
                            <option value="this_month">This Month</option>
                        </select>
                        <span className="sm-select-arrow">▼</span>
                    </div>
                </div>

                <button className="sm-btn-more-filters">
                    <FiFilter /> Filters
                </button>
                <button className="sm-btn-reset-filters" onClick={() => { setSearchQuery(''); setFilterSource('all'); setFilterStatus('all'); setDateRangeFilter('all'); }}>
                    Reset Filters
                </button>
            </div>

            {/* Data Table */}
            <div className="sm-table-container">
                <div style={{ overflowX: 'auto', minHeight: '260px' }}>
                    <table className="sm-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Date</th>
                                <th>Source</th>
                                <th>Name</th>
                                <th>Email / Phone</th>
                                <th>Institute</th>
                                <th>Status</th>
                                <th>Next Action</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                                        Loading enquiries...
                                    </td>
                                </tr>
                            ) : currentRecords.length === 0 ? (
                                <tr>
                                    <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                                        No results found.
                                    </td>
                                </tr>
                            ) : (
                                currentRecords.map((enq) => {
                                    const dateObj = new Date(enq.date);
                                    
                                    return (
                                        <tr key={enq.id}>
                                            <td><span className="sm-id-text">#{enq.id}</span></td>
                                            <td>
                                                <div className="sm-date-text">{dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                                <div className="sm-time-text">{dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                                            </td>
                                            <td>
                                                {getSourcePill(enq.source)}
                                            </td>
                                            <td>
                                                <div className="sm-name-text">{enq.name}</div>
                                                <div className="sm-role-text">{enq.source === 'demo_request' ? 'Manager' : 'User'}</div>
                                            </td>
                                            <td>
                                                <div className="sm-contact-info">
                                                    <div><FiMail className="sm-contact-icon" /> {enq.email || '-'}</div>
                                                    <div><FiPhone className="sm-contact-icon" /> {enq.mobile || '-'}</div>
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{ color: '#64748b' }}>{enq.institute || '-'}</span>
                                            </td>
                                            <td>
                                                {getStatusText(enq.status)}
                                            </td>
                                            <td>
                                                <span style={{ color: '#94a3b8' }}>-</span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button className="sm-btn-actions" onClick={() => handleViewDetails(enq)} title="View Details" style={{ marginRight: '0.5rem' }}>
                                                    <FiEye />
                                                </button>
                                                <div className="action-menu-container" style={{ display: 'inline-block', position: 'relative' }} ref={openActionId === enq.id ? actionMenuRef : null}>
                                                    <button className="sm-btn-actions" onClick={() => setOpenActionId(openActionId === enq.id ? null : enq.id)}>
                                                        <FiMoreVertical />
                                                    </button>
                                                    {openActionId === enq.id && (
                                                        <div className="sm-action-menu">
                                                            <div className="sm-action-menu-item" onClick={() => { handleUpdateStatus(enq.id, 'new'); setOpenActionId(null); }}>Mark as New</div>
                                                            <div className="sm-action-menu-item" onClick={() => { handleUpdateStatus(enq.id, 'contacted'); setOpenActionId(null); }}>Mark as Contacted</div>
                                                            <div className="sm-action-menu-item" onClick={() => { handleUpdateStatus(enq.id, 'demo_scheduled'); setOpenActionId(null); }}>Mark as Demo Scheduled</div>
                                                            <div className="sm-action-menu-item" onClick={() => { handleUpdateStatus(enq.id, 'closed_won'); setOpenActionId(null); }}>Mark as Converted</div>
                                                            <div className="sm-action-menu-item danger" onClick={() => { handleUpdateStatus(enq.id, 'closed_lost'); setOpenActionId(null); }}>Mark as Closed (Lost)</div>
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
                {!loading && totalRecords > 0 && (
                    <div className="sm-pagination">
                        <div className="sm-pagination-text">
                            Showing {indexOfFirstRecord + 1} to {Math.min(indexOfLastRecord, totalRecords)} of {totalRecords} results
                        </div>
                        <div className="sm-pagination-controls">
                            <div className="sm-per-page">
                                <select value={recordsPerPage} onChange={(e) => { setRecordsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                                    <option value="10">10 / page</option>
                                    <option value="25">25 / page</option>
                                    <option value="50">50 / page</option>
                                </select>
                            </div>
                            <div className="sm-page-buttons">
                                <button className="sm-page-btn" disabled={currentPage === 1} onClick={() => paginate(currentPage - 1)}>&lt;</button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(number => {
                                    if (
                                        number === 1 || 
                                        number === totalPages || 
                                        (number >= currentPage - 1 && number <= currentPage + 1)
                                    ) {
                                        return (
                                            <button 
                                                key={number} 
                                                className={`sm-page-btn ${currentPage === number ? 'active' : ''}`}
                                                onClick={() => paginate(number)}
                                            >
                                                {number}
                                            </button>
                                        );
                                    } else if (
                                        number === currentPage - 2 || 
                                        number === currentPage + 2
                                    ) {
                                        return <span key={number} style={{ color: '#94a3b8', alignSelf: 'flex-end', padding: '0 4px' }}>...</span>;
                                    }
                                    return null;
                                })}
                                <button className="sm-page-btn" disabled={currentPage === totalPages} onClick={() => paginate(currentPage + 1)}>&gt;</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* View Details Modal (Preserved from old implementation but restyled slightly) */}
            {showModal && selectedEnquiry && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '600px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#0f172a' }}>Enquiry Details</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem', color: '#334155' }}>
                                <div><strong style={{ color: '#0f172a' }}>Name:</strong> {selectedEnquiry.name}</div>
                                <div><strong style={{ color: '#0f172a' }}>Type:</strong> {getSourcePill(selectedEnquiry.source)}</div>
                                <div><strong style={{ color: '#0f172a' }}>Email:</strong> <a href={`mailto:${selectedEnquiry.email}`} style={{ color: '#4f46e5' }}>{selectedEnquiry.email}</a></div>
                                <div><strong style={{ color: '#0f172a' }}>Phone:</strong> <a href={`tel:${selectedEnquiry.mobile}`} style={{ color: '#4f46e5' }}>{selectedEnquiry.mobile}</a></div>
                                <div><strong style={{ color: '#0f172a' }}>Date:</strong> {new Date(selectedEnquiry.date).toLocaleString()}</div>
                                <div><strong style={{ color: '#0f172a' }}>Status:</strong> {getStatusText(selectedEnquiry.status)}</div>
                            </div>
                            
                            <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '0.5rem 0' }} />

                            <div style={{ fontSize: '0.9rem' }}>
                                <strong style={{ color: '#0f172a' }}>Institute / Organization:</strong>
                                <p style={{ margin: '4px 0 0 0', color: '#64748b' }}>{selectedEnquiry.institute || 'N/A'}</p>
                            </div>

                            {selectedEnquiry.source === 'demo_request' && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem' }}>
                                    <div>
                                        <strong style={{ color: '#0f172a' }}>Expected Students:</strong>
                                        <p style={{ margin: '4px 0 0 0', color: '#64748b' }}>{selectedEnquiry.students || 'Not specified'}</p>
                                    </div>
                                    <div>
                                        <strong style={{ color: '#0f172a' }}>Plan Interest:</strong>
                                        <p style={{ margin: '4px 0 0 0', color: '#64748b' }}>{selectedEnquiry.plan || 'Not specified'}</p>
                                    </div>
                                </div>
                            )}

                            <div style={{ fontSize: '0.9rem' }}>
                                <strong style={{ color: '#0f172a' }}>Message:</strong>
                                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginTop: '8px', color: '#334155', whiteSpace: 'pre-wrap', border: '1px solid #e2e8f0' }}>
                                    {selectedEnquiry.message || <i style={{ color: '#94a3b8' }}>No message provided</i>}
                                </div>
                            </div>
                        </div>
                        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="sm-btn-export" onClick={() => setShowModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Enquiries;
