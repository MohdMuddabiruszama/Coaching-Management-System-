import { useState, useEffect } from "react";
import api from "../../services/api";
import BackButton from "../../components/common/BackButton";
import ThemeSelector from "../../components/ThemeSelector";
import "../admin/Dashboard.css";

function Enquiries() {
    const [enquiries, setEnquiries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterSource, setFilterSource] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [showModal, setShowModal] = useState(false);
    const [selectedEnquiry, setSelectedEnquiry] = useState(null);

    useEffect(() => {
        fetchEnquiries();
        clearUnreadCount();
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

    const filteredEnquiries = enquiries.filter(e => {
        const matchSource = filterSource === "all" || e.source === filterSource;
        const matchStatus = filterStatus === "all" || e.status === filterStatus;
        return matchSource && matchStatus;
    });

    const getSourceLabel = (source) => {
        if (source === 'demo_request') return <span className="badge badge-primary" style={{background: '#6366f1', color: '#fff'}}>Free Demo</span>;
        return <span className="badge badge-secondary" style={{background: '#64748b', color: '#fff'}}>Contact Form</span>;
    };

    const getStatusLabel = (status) => {
        switch(status) {
            case 'new': return <span className="badge badge-danger">New</span>;
            case 'contacted': return <span className="badge badge-warning">Contacted</span>;
            case 'demo_scheduled': return <span className="badge badge-primary">Demo Scheduled</span>;
            case 'closed_won': return <span className="badge badge-success">Closed (Won)</span>;
            case 'closed_lost': return <span className="badge badge-secondary">Closed (Lost)</span>;
            default: return <span className="badge badge-secondary">{status}</span>;
        }
    };

    if (loading) return <div className="dashboard-container" style={{display: 'flex', justifyContent: 'center', padding: '50px'}}>Loading enquiries...</div>;

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <BackButton />
                    <h1>📬 Enquiries & Leads</h1>
                    <p>Manage contact submissions and free demo requests</p>
                </div>
                <div className="dashboard-header-right">
                    <ThemeSelector />
                </div>
            </div>

            <div className="card" style={{ marginBottom: "2rem" }}>
                <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                        <strong style={{ marginRight: '0.5rem', color: 'var(--text-secondary)' }}>Source:</strong>
                        <button className={`btn btn-sm ${filterSource === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilterSource('all')}>All Sources</button>
                        <button className={`btn btn-sm ${filterSource === 'demo_request' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilterSource('demo_request')}>Free Demo</button>
                        <button className={`btn btn-sm ${filterSource === 'contact_form' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilterSource('contact_form')}>Contact Form</button>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                        <strong style={{ marginRight: '0.5rem', color: 'var(--text-secondary)' }}>Status:</strong>
                        <button className={`btn btn-sm ${filterStatus === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilterStatus('all')}>All Statuses</button>
                        <button className={`btn btn-sm ${filterStatus === 'new' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilterStatus('new')}>New</button>
                        <button className={`btn btn-sm ${filterStatus === 'contacted' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilterStatus('contacted')}>Contacted</button>
                        <button className={`btn btn-sm ${filterStatus === 'demo_scheduled' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilterStatus('demo_scheduled')}>Demo Scheduled</button>
                        <button className={`btn btn-sm ${filterStatus === 'closed_won' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilterStatus('closed_won')}>Closed (Won)</button>
                        <button className={`btn btn-sm ${filterStatus === 'closed_lost' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilterStatus('closed_lost')}>Closed (Lost)</button>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Name</th>
                                <th>Email / Phone</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEnquiries.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: "center", padding: "2rem" }}>
                                        No enquiries found matching criteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredEnquiries.map((enq) => (
                                    <tr key={enq.id}>
                                        <td style={{ whiteSpace: 'nowrap' }}>{new Date(enq.date).toLocaleDateString()}</td>
                                        <td>{getSourceLabel(enq.source)}</td>
                                        <td style={{ fontWeight: 600 }}>{enq.name}</td>
                                        <td>
                                            <div style={{ fontSize: '0.9em', color: 'var(--text-secondary)' }}>
                                                📧 {enq.email}<br/>
                                                📞 {enq.mobile}
                                            </div>
                                        </td>
                                        <td>
                                            <select 
                                                className="form-select" 
                                                style={{ minWidth: '130px', padding: '0.3rem 2rem 0.3rem 0.75rem', height: 'auto', fontSize: '0.875rem' }}
                                                value={enq.status}
                                                onChange={(e) => handleUpdateStatus(enq.id, e.target.value)}
                                            >
                                                <option value="new">New</option>
                                                <option value="contacted">Contacted</option>
                                                <option value="demo_scheduled">Demo Scheduled</option>
                                                <option value="closed_won">Closed (Won)</option>
                                                <option value="closed_lost">Closed (Lost)</option>
                                            </select>
                                        </td>
                                        <td>
                                            <button className="btn btn-sm btn-primary" onClick={() => handleViewDetails(enq)}>
                                                View Details
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* MOBILE VIEW */}
                <div className="admin-mobile-cards card-stagger">
                    {filteredEnquiries.length === 0 ? (
                        <div className="empty-state-mobile">
                            <div className="empty-icon">📬</div>
                            <div className="empty-title">No Enquiries</div>
                            <div className="empty-desc">No records found.</div>
                        </div>
                    ) : (
                        filteredEnquiries.map((enq) => (
                            <div key={enq.id} className="admin-item-card">
                                <div className="aic-info">
                                    <div className="aic-name">
                                        {enq.name}
                                        <span className="aic-badge">{getSourceLabel(enq.source)}</span>
                                    </div>
                                    <div className="aic-sub">📧 {enq.email} | 📞 {enq.mobile}</div>
                                    <div className="aic-sub">{new Date(enq.date).toLocaleDateString()} · {getStatusLabel(enq.status)}</div>
                                </div>
                                <div className="aic-actions">
                                    <button className="btn btn-sm btn-primary" onClick={() => handleViewDetails(enq)}>View</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* View Details Modal */}
            {showModal && selectedEnquiry && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
                        <div className="modal-header">
                            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Enquiry Details</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div><strong>Name:</strong> {selectedEnquiry.name}</div>
                                <div><strong>Type:</strong> {getSourceLabel(selectedEnquiry.source)}</div>
                                <div><strong>Email:</strong> <a href={`mailto:${selectedEnquiry.email}`}>{selectedEnquiry.email}</a></div>
                                <div><strong>Phone:</strong> <a href={`tel:${selectedEnquiry.mobile}`}>{selectedEnquiry.mobile}</a></div>
                                <div><strong>Date:</strong> {new Date(selectedEnquiry.date).toLocaleString()}</div>
                                <div><strong>Status:</strong> {getStatusLabel(selectedEnquiry.status)}</div>
                            </div>
                            
                            <hr style={{ borderColor: 'var(--border-color)', margin: '0' }} />

                            <div>
                                <strong>Institute / Organization:</strong>
                                <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>{selectedEnquiry.institute || 'N/A'}</p>
                            </div>

                            {selectedEnquiry.source === 'demo_request' && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <strong>Expected Students:</strong>
                                        <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>{selectedEnquiry.students || 'Not specified'}</p>
                                    </div>
                                    <div>
                                        <strong>Plan Interest:</strong>
                                        <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>{selectedEnquiry.plan || 'Not specified'}</p>
                                    </div>
                                </div>
                            )}

                            <div>
                                <strong>Message:</strong>
                                <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', marginTop: '8px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                                    {selectedEnquiry.message || <i>No message provided</i>}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Enquiries;
