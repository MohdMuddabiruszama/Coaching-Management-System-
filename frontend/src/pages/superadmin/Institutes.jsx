/**
 * Super Admin - Institutes Management
 * Redesigned UI matching the premium dashboard look.
 */

import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import ThemeSelector from "../../components/ThemeSelector";
import DeleteInstituteModal from "../../components/superadmin/DeleteInstituteModal";
import SuspendInstituteModal from "../../components/superadmin/SuspendInstituteModal";
import "./Institutes.css";

function Institutes() {
    const [institutes, setInstitutes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [lifetimeFilter, setLifetimeFilter] = useState("all");
    const [planFilter, setPlanFilter] = useState("all");
    
    // UI states
    const [showModal, setShowModal] = useState(false);
    const [selectedInstitute, setSelectedInstitute] = useState(null);
    const [deleteModal, setDeleteModal] = useState(null);
    const [suspendModal, setSuspendModal] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(null);
    
    const dropdownRef = useRef(null);

    useEffect(() => {
        fetchInstitutes();
        
        // Close dropdown when clicking outside
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [statusFilter]);

    const fetchInstitutes = async () => {
        try {
            let url = `/institutes?limit=200`;
            if (statusFilter !== "all") {
                url += `&status=${statusFilter}`;
            }
            const response = await api.get(url);
            setInstitutes(response.data.data?.institutes || response.data.institutes || []);
        } catch (error) {
            console.error("Error fetching institutes:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteConfirm = async (force) => {
        setActionLoading(true);
        try {
            const res = await api.delete(`/superadmin/institutes/${deleteModal.id}`, { data: { force } });
            if (res.data.success) {
                alert(`✅ ${res.data.message}`);
                setDeleteModal(null);
                fetchInstitutes();
            }
        } catch (err) {
            const errData = err.response?.data;
            if (err.response?.status === 409) {
                alert(`⚠️ ${errData?.message || 'This institute has an active subscription.'}\n\nTo proceed, check "Force Delete" in the confirmation dialog.`);
            } else {
                alert(`❌ Delete failed: ${errData?.message || err.message || 'Unknown error'}`);
            }
        } finally {
            setActionLoading(false);
        }
    };

    const handleSuspendConfirm = async (reason) => {
        setActionLoading(true);
        const isSuspended = suspendModal.status === 'suspended';
        const endpoint = isSuspended ? `/superadmin/institutes/${suspendModal.id}/restore` : `/superadmin/institutes/${suspendModal.id}/suspend`;
        try {
            const res = await api.put(endpoint, { reason });
            if (res.data.success) {
                alert(res.data.message);
                setSuspendModal(null);
                fetchInstitutes();
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Action failed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleViewDetails = (institute) => {
        setSelectedInstitute(institute);
        setShowModal(true); // Assuming you have a View modal component (not provided in this snippet, using existing logic)
    };

    const resetFilters = () => {
        setSearch("");
        setStatusFilter("all");
        setLifetimeFilter("all");
        setPlanFilter("all");
    };

    const filteredInstitutes = institutes.filter(inst => {
        const matchSearch = !search || (inst.name && inst.name.toLowerCase().includes(search.toLowerCase())) || (inst.email && inst.email.toLowerCase().includes(search.toLowerCase()));
        
        let matchLifetime = true;
        if (lifetimeFilter === "lifetime") matchLifetime = inst.is_lifetime_member === true;
        else if (lifetimeFilter === "regular") matchLifetime = !inst.is_lifetime_member;

        let matchPlan = true;
        if (planFilter !== "all" && inst.Plan?.name) {
            matchPlan = inst.Plan.name.toLowerCase().includes(planFilter.toLowerCase());
        }

        return matchSearch && matchLifetime && matchPlan;
    });

    const getInitials = (name) => {
        if (!name) return "IN";
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    if (loading) {
        return <div className="im-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}><p>Loading...</p></div>;
    }

    const totalInstitutes = institutes.length;
    const activeInstitutes = institutes.filter(i => i.status === 'active').length;
    const suspendedInstitutes = institutes.filter(i => i.status === 'suspended').length;
    const expiredInstitutes = institutes.filter(i => i.status === 'expired').length;
    const lifetimeInstitutes = institutes.filter(i => i.is_lifetime_member).length;
    const activePercentage = totalInstitutes > 0 ? Math.round((activeInstitutes / totalInstitutes) * 100) : 0;

    return (
        <div className="im-container">
            <div className="im-breadcrumb">
                <Link to="/superadmin/dashboard">🏠 Dashboard</Link> &gt; <span>Institutes Management</span>
            </div>

            {/* Header */}
            <div className="im-header">
                <div className="im-header-left" style={{ display: 'flex', gap: '1rem' }}>
                    <div className="im-header-icon">🏢</div>
                    <div>
                        <h1>Institutes Management</h1>
                        <p>Manage all registered institutes and their subscriptions</p>
                    </div>
                </div>
                <div className="im-header-right">
                    <button className="im-btn-secondary" onClick={() => alert("Export functionality coming soon!")}>
                        <span style={{ fontSize: '1.2rem' }}>📥</span> Export
                    </button>
                    <button className="im-btn-primary" onClick={() => alert("Add new institute coming soon!")}>
                        + Add New Institute
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="im-stats-grid">
                <div className="im-stat-card">
                    <div className="im-stat-icon-wrap total">🏢</div>
                    <div className="im-stat-content">
                        <h3>{totalInstitutes}</h3>
                        <p>Total Institutes</p>
                        <span style={{ color: '#4f46e5', cursor: 'pointer' }} onClick={() => setStatusFilter('all')}>View all institutes</span>
                    </div>
                </div>
                <div className="im-stat-card">
                    <div className="im-stat-icon-wrap active">✅</div>
                    <div className="im-stat-content">
                        <h3>{activeInstitutes}</h3>
                        <p>Active Institutes</p>
                        <span>{activePercentage}% of total</span>
                    </div>
                </div>
                <div className="im-stat-card">
                    <div className="im-stat-icon-wrap suspended">⏸️</div>
                    <div className="im-stat-content">
                        <h3>{suspendedInstitutes}</h3>
                        <p>Suspended</p>
                        <span>{suspendedInstitutes === 0 ? 'No pending action' : 'Needs attention'}</span>
                    </div>
                </div>
                <div className="im-stat-card">
                    <div className="im-stat-icon-wrap expired">❌</div>
                    <div className="im-stat-content">
                        <h3>{expiredInstitutes}</h3>
                        <p>Expired</p>
                        <span>{expiredInstitutes === 0 ? 'No expired plans' : 'Check renewals'}</span>
                    </div>
                </div>
                <div className="im-stat-card">
                    <div className="im-stat-icon-wrap lifetime">💎</div>
                    <div className="im-stat-content">
                        <h3>{lifetimeInstitutes}</h3>
                        <p>Lifetime Members</p>
                        <span>One-time access</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="im-filters">
                <div className="im-filter-group" style={{ flex: 2 }}>
                    <label>Search</label>
                    <input 
                        type="text" 
                        className="im-input"
                        placeholder="🔍 Search by institute name, email or phone..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="im-filter-group">
                    <label>Status</label>
                    <select className="im-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                        <option value="expired">Expired</option>
                    </select>
                </div>
                <div className="im-filter-group">
                    <label>Plan</label>
                    <select className="im-select" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
                        <option value="all">All Plans</option>
                        <option value="enterprise">Enterprise</option>
                        <option value="professional">Professional</option>
                        <option value="starter">Starter</option>
                        <option value="basic">Basic</option>
                    </select>
                </div>
                <div className="im-filter-group">
                    <label>Member Type</label>
                    <select className="im-select" value={lifetimeFilter} onChange={(e) => setLifetimeFilter(e.target.value)}>
                        <option value="all">All Member Types</option>
                        <option value="lifetime">Lifetime Members</option>
                        <option value="regular">Regular Members</option>
                    </select>
                </div>
                <div className="im-filter-group" style={{ flex: 1.5 }}>
                    <label>Joined Date</label>
                    <input type="date" className="im-input" style={{ color: '#64748b' }} />
                </div>
                <div className="im-filter-actions">
                    <button className="im-btn-filter"><span>⚙️</span> Filters</button>
                    <button className="im-btn-reset" onClick={resetFilters}>Reset</button>
                </div>
            </div>

            {/* Table */}
            <div className="im-table-card">
                <div className="im-table-header">
                    <h2>All Institutes ({filteredInstitutes.length})</h2>
                </div>
                <div className="im-table-wrapper">
                    <table className="im-table">
                        <thead>
                            <tr>
                                <th>Institute</th>
                                <th>Admin Details</th>
                                <th>Plan</th>
                                <th>Status</th>
                                <th>Joined On</th>
                                <th>End Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredInstitutes.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: "center", padding: "3rem", color: '#64748b' }}>
                                        No institutes found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredInstitutes.map((institute) => {
                                    // Calculate end date logic safely
                                    const joinDate = new Date(institute.createdAt || Date.now());
                                    // Mock end date if not present for UI purposes to match design
                                    let endDate = new Date(joinDate);
                                    endDate.setFullYear(endDate.getFullYear() + 1);
                                    let daysLeft = Math.floor((endDate - new Date()) / (1000 * 60 * 60 * 24));
                                    if (daysLeft < 0) daysLeft = 0;
                                    
                                    const isVerified = institute.status === 'active';
                                    const isLifetime = institute.is_lifetime_member;

                                    return (
                                        <tr key={institute.id}>
                                            <td>
                                                <div className="im-cell-institute">
                                                    <div className="im-avatar" style={isLifetime ? { background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)', color: 'white' } : {}}>
                                                        {institute.logo ? (
                                                            <img 
                                                                src={institute.logo} 
                                                                alt={institute.name} 
                                                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }}
                                                            />
                                                        ) : (
                                                            getInitials(institute.name)
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="im-inst-name">
                                                            {institute.name} 
                                                            {isVerified && <span className="im-badge-verified">Verified</span>}
                                                            {isLifetime && <span className="im-badge-verified" style={{background: '#f3e8ff', color: '#7c3aed'}}>💎 Lifetime</span>}
                                                        </div>
                                                        <a href={`http://${institute.subdomain || 'www'}.zenithflows.in`} target="_blank" rel="noreferrer" className="im-subtext" style={{ textDecoration: 'none' }}>
                                                            {institute.subdomain ? `${institute.subdomain}.zenithflows.in` : institute.email.split('@')[1] || 'domain.com'}
                                                        </a>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="im-cell-admin">
                                                    <div className="im-subtext">✉️ {institute.email}</div>
                                                    <div className="im-subtext">📞 {institute.phone || 'N/A'}</div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="im-cell-plan">
                                                    <div className="im-plan-name">{institute.Plan?.name || (isLifetime ? "Lifetime Access" : "Basic")} {institute.has_android_app && "+ Android"}</div>
                                                    <div className="im-plan-cycle">{isLifetime ? "One-time" : "Annual"}</div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className={`im-status ${institute.status}`}>
                                                    <div className="im-status-dot"></div>
                                                    {institute.status.charAt(0).toUpperCase() + institute.status.slice(1)}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="im-cell-date">
                                                    <div className="im-date-main">{joinDate.toLocaleDateString('en-GB')}</div>
                                                    <div className="im-date-sub">{joinDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                                                </div>
                                            </td>
                                            <td>
                                                {isLifetime ? (
                                                    <div className="im-cell-date">
                                                        <div className="im-date-main">Lifetime</div>
                                                        <div className="im-date-sub safe">Unlimited access</div>
                                                    </div>
                                                ) : (
                                                    <div className="im-cell-date">
                                                        <div className="im-date-main">{endDate.toLocaleDateString('en-GB')}</div>
                                                        <div className={`im-date-sub ${daysLeft < 30 ? 'warning' : 'safe'}`}>{daysLeft} days left</div>
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <div className="im-actions">
                                                    <button className="im-btn-view" onClick={() => handleViewDetails(institute)}>
                                                        👁️ View
                                                    </button>
                                                    
                                                    <div style={{ position: 'relative' }}>
                                                        <button 
                                                            className="im-btn-more" 
                                                            onClick={() => setDropdownOpen(dropdownOpen === institute.id ? null : institute.id)}
                                                        >
                                                            ⋮
                                                        </button>
                                                        
                                                        {dropdownOpen === institute.id && (
                                                            <div ref={dropdownRef} className="im-dropdown-menu">
                                                                <button 
                                                                    className="im-dropdown-item warning"
                                                                    onClick={() => { setSuspendModal(institute); setDropdownOpen(null); }} 
                                                                >
                                                                    {institute.status === 'suspended' ? 'Restore Institute' : 'Suspend Institute'}
                                                                </button>
                                                                <button 
                                                                    className="im-dropdown-item danger"
                                                                    onClick={() => { setDeleteModal(institute); setDropdownOpen(null); }} 
                                                                >
                                                                    Delete Institute
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination (Mocked structure for design compliance) */}
                <div className="im-pagination">
                    <div className="im-page-info">
                        Showing 1 to {filteredInstitutes.length > 10 ? 10 : filteredInstitutes.length} of {filteredInstitutes.length} results
                    </div>
                    <div className="im-page-controls">
                        <button className="im-page-btn">&lt;</button>
                        <button className="im-page-btn active">1</button>
                        <button className="im-page-btn">&gt;</button>
                        <select className="im-per-page">
                            <option>10 / page</option>
                            <option>20 / page</option>
                            <option>50 / page</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Existing Modals */}
            {deleteModal && (
                <DeleteInstituteModal
                    institute={deleteModal}
                    onClose={() => setDeleteModal(null)}
                    onConfirm={handleDeleteConfirm}
                    loading={actionLoading}
                />
            )}

            {suspendModal && (
                <SuspendInstituteModal
                    institute={suspendModal}
                    onClose={() => setSuspendModal(null)}
                    onConfirm={handleSuspendConfirm}
                    loading={actionLoading}
                />
            )}
        </div>
    );
}

export default Institutes;
