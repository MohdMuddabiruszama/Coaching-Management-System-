import React, { useState, useEffect, useContext, Fragment } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import { MANAGER_TYPES, buildPermissionsFromPreset } from "../../config/managerPresets";
import "./Dashboard.css";
import "./ManageAdmins.css";
import "./Students.css";

// ─── Modules that support granular CRUD ───
const ALL_CRUD_MODULES = [
    { val: 'students', label: 'Manage Students', icon: '👨‍🎓', desc: 'Student records management' },
    { val: 'faculty', label: 'Manage Faculty', icon: '👩‍🏫', desc: 'Faculty records management' },
    { val: 'classes', label: 'Manage Classes', icon: '📚', desc: 'Class records management' },
    { val: 'subjects', label: 'Manage Subjects', icon: '📖', desc: 'Subject records management' },
    { val: 'timetable', label: 'Batches & Timetable', icon: '📅', desc: 'Create & manage timetables' },
    { val: 'fees', label: 'Fee Structure', icon: '💰', desc: 'Fee structures & collections' },
    { val: 'expenses', label: 'Record Expenses', icon: '💸', desc: 'Add & delete expenses' },
    { val: 'salary', label: 'Faculty Salary Management', icon: '💼', desc: 'Manage faculty salaries' },
];

const CRUD_OPS = [
    { op: 'create', label: 'Create', icon: '➕', color: '#10b981' },
    { op: 'read', label: 'Read', icon: '👁️', color: '#6366f1' },
    { op: 'update', label: 'Update', icon: '✏️', color: '#f59e0b' },
    { op: 'delete', label: 'Delete', icon: '🗑️', color: '#ef4444' },
];

// ─── Toggle-style (simple on/off) modules ───
const ALL_TOGGLE_MODULES = [
    { val: 'notes', label: 'All Notes', icon: '📓', desc: 'Manage class notes' },
    { val: 'chat', label: 'Chat Monitor', icon: '💬', desc: 'Participate in subject chats' },
    { val: 'attendance', label: 'Attendance', icon: '📋', desc: 'Mark & view attendance' },
    { val: 'reports', label: 'Reports & Analytics', icon: '📉', desc: 'Attendance & academic reports' },
    { val: 'announcements', label: 'Announcements', icon: '📢', desc: 'Post & manage announcements' },
    { val: 'exams', label: 'Manage Exams', icon: '✍️', desc: 'Exam schedules & results' },
    { val: 'collect_fees', label: 'Collect Fees', icon: '💰', desc: 'Collect & view student fees' },
    { val: 'recent_payments', label: 'Recent Payments', icon: '🧾', desc: 'View recent payments section' },
    { val: 'transport', label: 'Transport Fees', icon: '🚌', desc: 'Bus routes & transport fees' },
    { val: 'parents', label: 'Manage Parents', icon: '👨‍👩‍👧', desc: 'View & manage parent records' },
    { val: 'biometric', label: 'Bio-Metric', icon: '🔐', desc: 'Biometric device management' },
    { val: 'finance', label: 'Finance Dashboard', icon: '🏦', desc: 'Financial reports and analytics' },
    { val: 'assignments', label: 'Assignments', icon: '📝', desc: 'View & manage assignments' },
    { val: 'performance_hub', label: 'Performance Hub', icon: '🎯', desc: 'View advanced performance analytics' },
];

// ── TypeBadge component ──────────────────────────────────
function TypeBadge({ managerType }) {
    const type = MANAGER_TYPES.find(t => t.id === managerType) || MANAGER_TYPES[5]; // fallback to custom
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            background: type.bg,
            color: type.color,
            border: `1px solid ${type.border}`,
            padding: '2px 10px',
            borderRadius: '20px',
            fontSize: '0.72rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
        }}>
            {type.emoji} {type.label}
        </span>
    );
}

// ── ManagerTypeSelector component ────────────────────────
function ManagerTypeSelector({ selectedType, onSelect }) {
    return (
        <div style={{ marginBottom: '1.5rem' }}>
            <div style={{
                fontWeight: 700, fontSize: '0.92rem',
                marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem'
            }}>
                🏷️ Select Manager Type
                <span style={{ fontWeight: 400, fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    (auto-fills permissions — you can still adjust individually)
                </span>
            </div>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.5rem'
            }}>
                {MANAGER_TYPES.map(type => {
                    const isSelected = selectedType === type.id;
                    return (
                        <button
                            key={type.id}
                            type="button"
                            onClick={() => onSelect(type.id)}
                            style={{
                                padding: '0.7rem 0.5rem',
                                border: `2px solid ${isSelected ? type.color : 'var(--border-color)'}`,
                                borderRadius: '10px',
                                background: isSelected ? type.bg : 'transparent',
                                cursor: 'pointer',
                                textAlign: 'center',
                                transition: 'all 0.15s',
                                outline: 'none',
                                transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                                boxShadow: isSelected ? `0 2px 8px ${type.border}` : 'none',
                            }}
                        >
                            <div style={{ fontSize: '1.4rem', marginBottom: '2px' }}>{type.emoji}</div>
                            <div style={{
                                fontWeight: 700, fontSize: '0.78rem',
                                color: isSelected ? type.color : 'var(--text-primary)',
                                marginBottom: '2px'
                            }}>
                                {type.label}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                                {type.description}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ── Helpers ─────────────────────────────────────────────
// Given a permissions array, check if a CRUD module is enabled (any op or base key)
const moduleEnabled = (perms, mod) =>
    perms.some(p => p === mod || p.startsWith(mod + '.'));

// Get which CRUD ops are active for a module
const activeCrudOps = (perms, mod) => {
    const ops = mod === 'fees' ? [...CRUD_OPS, { op: 'hide' }] : CRUD_OPS;
    return ops.filter(({ op }) => perms.includes(`${mod}.${op}`) || perms.includes(mod)).map(o => o.op);
};

// Build a display label for a permission array (compact)
const buildPermLabel = (perms) => {
    const labels = [];
    for (const m of ALL_CRUD_MODULES) {
        const ops = CRUD_OPS.filter(({ op }) => perms.includes(`${m.val}.${op}`)).map(o => o.label);
        if (perms.includes(m.val)) labels.push(`${m.icon} ${m.label} (All)`);
        else if (ops.length) labels.push(`${m.icon} ${m.label} (${ops.join(', ')})`);
    }
    for (const t of ALL_TOGGLE_MODULES) {
        if (perms.includes(t.val)) labels.push(`${t.icon} ${t.label}`);
    }
    return labels;
};

// ── CrudSelector component ───────────────────────────────
function CrudSelector({ mod, perms, onChange }) {
    const enabled = moduleEnabled(perms, mod.val);
    const active = activeCrudOps(perms, mod.val);
    const opsList = mod.val === 'fees' 
        ? [...CRUD_OPS, { op: 'hide', label: 'Hide', icon: '🙈', color: '#6b7280' }] 
        : CRUD_OPS;

    const toggleModule = () => {
        let updated;
        if (enabled) {
            // Remove all perms for this module
            updated = perms.filter(p => p !== mod.val && !p.startsWith(mod.val + '.'));
        } else {
            // Enable read by default
            updated = [...perms.filter(p => !p.startsWith(mod.val + '.')), `${mod.val}.read`];
        }
        onChange(updated);
    };

    const toggleOp = (op) => {
        const key = `${mod.val}.${op}`;
        // Remove base module perm if any; toggle specific op
        let updated = perms.filter(p => p !== mod.val);
        if (updated.includes(key)) {
            updated = updated.filter(p => p !== key);
            // If "read" is removed, also remove "hide"
            if (key === 'fees.read') {
                updated = updated.filter(p => p !== 'fees.hide');
            }
        } else {
            updated = [...updated, key];
            // If "hide" is selected, automatically select "read"
            if (key === 'fees.hide') {
                if (!updated.includes('fees.read') && !updated.includes('fees')) {
                    updated = [...updated, 'fees.read'];
                }
            }
        }
        onChange(updated);
    };

    return (
        <div style={{
            borderRadius: '10px',
            border: `1px solid ${enabled ? 'rgba(99,102,241,0.4)' : 'var(--border-color)'}`,
            background: enabled ? 'rgba(99,102,241,0.06)' : 'transparent',
            overflow: 'hidden',
            transition: 'all 0.2s'
        }}>
            {/* Module header row */}
            <label style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.65rem 0.85rem', cursor: 'pointer',
                borderBottom: enabled ? '1px solid rgba(99,102,241,0.15)' : 'none'
            }}>
                <input
                    type="checkbox"
                    checked={enabled}
                    onChange={toggleModule}
                    style={{ accentColor: '#6366f1', width: '16px', height: '16px' }}
                />
                <span style={{ fontSize: '1.1rem' }}>{mod.icon}</span>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '0.88rem' }}>{mod.label}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{mod.desc}</div>
                </div>
                {enabled && (
                    <span style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: '600' }}>
                        {active.length} / {opsList.length} ops
                    </span>
                )}
            </label>

            {/* CRUD operation selectors */}
            {enabled && (
                <div style={{
                    display: 'flex', gap: '0.4rem', padding: '0.6rem 0.85rem',
                    flexWrap: 'wrap'
                }}>
                    {opsList.map(({ op, label, icon, color }) => {
                        const isActive = active.includes(op);
                        return (
                            <button
                                key={op}
                                type="button"
                                onClick={() => toggleOp(op)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                    padding: '4px 12px', borderRadius: '20px', cursor: 'pointer',
                                    fontSize: '0.78rem', fontWeight: '600',
                                    border: `1.5px solid ${isActive ? color : 'var(--border-color)'}`,
                                    background: isActive ? `${color}22` : 'transparent',
                                    color: isActive ? color : 'var(--text-secondary)',
                                    transition: 'all 0.15s'
                                }}
                            >
                                <span>{icon}</span> {label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── Main Component ───────────────────────────────────────
function ManageAdmins() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const features = user?.features || {};
    const isLifetime = user?.is_lifetime_member || false;

    // Filter CRUD modules
    const CRUD_MODULES = ALL_CRUD_MODULES.filter(mod => {
        if (isLifetime) return true;
        switch (mod.val) {
            case 'timetable': return features.timetable;
            case 'fees': return features.fees;
            case 'expenses': return features.expenses;
            case 'salary': return features.salary;
            default: return true;
        }
    });

    // Filter Toggle modules
    const TOGGLE_MODULES = ALL_TOGGLE_MODULES.filter(mod => {
        if (isLifetime) return true;
        switch (mod.val) {
            case 'notes': return features.notes;
            case 'chat': return features.chat;
            case 'attendance': return features.attendance !== 'none';
            case 'reports': return features.reports !== 'none';
            case 'announcements': return features.announcements;
            case 'exams': return features.exams;
            case 'collect_fees': return features.fees;
            case 'recent_payments': return features.fees;
            case 'transport': return features.transport;
            case 'biometric': return features.biometric;
            case 'finance': return features.finance;
            case 'assignments': return features.assignment;
            case 'performance_hub': return features.performance_hub;
            case 'parents': return true;
            default: return true;
        }
    });


    const [managers, setManagers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [sortOption, setSortOption] = useState('newest');

    // Create modal & wizard
    const [showModal, setShowModal] = useState(false);
    const [wizardStep, setWizardStep] = useState(1);
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', permissions: [] });
    const [formErrors, setFormErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Manager type preset state
    const [selectedType, setSelectedType] = useState('custom');
    const [typeConfirmPending, setTypeConfirmPending] = useState(null); // typeId waiting for confirm

    // Edit modal
    const [editingManager, setEditingManager] = useState(null);
    const [editPerms, setEditPerms] = useState([]);
    const [editStatus, setEditStatus] = useState('active');
    const [savingEdit, setSavingEdit] = useState(false);

    // Delete confirm & action menu
    const [deletingId, setDeletingId] = useState(null);
    const [actionMenuOpen, setActionMenuOpen] = useState(null);

    useEffect(() => { fetchManagers(); }, []);

    const fetchManagers = async () => {
        try {
            setLoading(true);
            const res = await api.get('/admin/admins');
            setManagers(res.data.data || []);
            setError(null);
        } catch {
            setError('Failed to load managers.');
        } finally {
            setLoading(false);
        }
    };

    const validateForm = () => {
        const errors = {};
        if (!formData.name.trim()) errors.name = 'Full name is required';
        if (!formData.email.trim()) errors.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'Invalid email format';
        if (!formData.password) errors.password = 'Password is required';
        else if (formData.password.length < 6) errors.password = 'Minimum 6 characters';
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const nextStep = () => {
        if (wizardStep === 1) {
            if (!validateForm()) return;
        }
        setWizardStep(prev => prev + 1);
    };

    const prevStep = () => {
        setWizardStep(prev => prev - 1);
    };

    const handleTextChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setFormErrors({ ...formErrors, [e.target.name]: '' });
    };

    // ── Manager Type selection ──────────────────────────────
    const handleTypeSelect = (typeId) => {
        // If any permissions are already manually set and user is switching types,
        // ask for confirmation before overwriting (edge case: custom -> custom is a reset)
        const hasManualPerms = formData.permissions.length > 0;
        const isSwitching = selectedType !== typeId && hasManualPerms;

        if (isSwitching && typeId !== selectedType) {
            // Store pending type and show confirm dialog (inline in modal)
            setTypeConfirmPending(typeId);
            return;
        }
        applyTypePreset(typeId);
    };

    const applyTypePreset = (typeId) => {
        setSelectedType(typeId);
        setTypeConfirmPending(null);
        const presetPerms = buildPermissionsFromPreset(typeId);
        setFormData(fd => ({ ...fd, permissions: presetPerms }));
    };

    const cancelTypeSwitch = () => setTypeConfirmPending(null);
    // ── End type selection ─────────────────────────────────

    const handleTogglePerm = (val) => {
        setFormData(fd => {
            let newPerms = [...fd.permissions];
            if (newPerms.includes(val)) {
                newPerms = newPerms.filter(p => p !== val);
                // If Collect Fees is removed, remove all Fee Structure permissions
                if (val === 'collect_fees') {
                    newPerms = newPerms.filter(p => p !== 'fees' && !p.startsWith('fees.'));
                }
            } else {
                newPerms.push(val);
                // Auto-select Fee Structure (Read) if Collect Fees is selected
                if (val === 'collect_fees' && !newPerms.includes('fees.read') && !newPerms.includes('fees')) {
                    newPerms.push('fees.read');
                }
            }
            return { ...fd, permissions: newPerms };
        });
    };

    const handleCreateManager = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        try {
            setSubmitting(true);
            const res = await api.post('/admin/admins', {
                ...formData,
                manager_type: selectedType,  // send selected type to backend
            });
            if (res.data.success) {
                setShowModal(false);
                setFormData({ name: '', email: '', phone: '', password: '', permissions: [] });
                setSelectedType('custom');
                setWizardStep(1);
                fetchManagers();
            }
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to create manager.';
            setFormErrors({ ...formErrors, general: msg });
        } finally {
            setSubmitting(false);
        }
    };

    const openEditModal = (mgr) => {
        setEditingManager(mgr);
        setEditPerms(Array.isArray(mgr.permissions) ? [...mgr.permissions] : []);
        setEditStatus(mgr.status || 'active');
    };

    const handleSaveEdit = async () => {
        try {
            setSavingEdit(true);
            const payload = {
                name: editingManager.name,
                email: editingManager.email,
                phone: editingManager.phone,
                status: editStatus,
                permissions: editPerms,
            };
            if (editingManager.password) {
                payload.password = editingManager.password;
            }
            await api.put(`/admin/admins/${editingManager.id}`, payload);
            setEditingManager(null);
            fetchManagers();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update manager.');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleDeleteManager = async () => {
        try {
            await api.delete(`/admin/admins/${deletingId}`);
            setDeletingId(null);
            fetchManagers();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete manager.');
        }
    };

    const handleStatusChange = async (id, newStatus) => {
        try {
            const mgr = managers.find(m => m.id === id);
            if (!mgr) return;
            await api.put(`/admin/admins/${id}`, {
                name: mgr.name,
                email: mgr.email,
                phone: mgr.phone,
                status: newStatus,
                permissions: mgr.permissions,
            });
            fetchManagers();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update status.');
        }
    };

    const managers_only = managers.filter(m => m.role === 'manager');
    const admins_only = managers.filter(m => m.role === 'admin');

    let filtered_managers = managers_only.filter(m => {
        const lowerSearch = searchTerm.toLowerCase();
        const matchesSearch = (m.name && m.name.toLowerCase().includes(lowerSearch)) ||
                              (m.email && m.email.toLowerCase().includes(lowerSearch)) ||
                              (m.phone && m.phone.toLowerCase().includes(lowerSearch));
        
        const typeMatch = (m.manager_type || 'custom');
        const matchesType = filterType === 'all' || typeMatch === filterType;
        const matchesStatus = filterStatus === 'all' || (filterStatus === 'active' ? m.status === 'active' : m.status !== 'active');
        
        return matchesSearch && matchesType && matchesStatus;
    });

    if (sortOption === 'newest') {
        filtered_managers.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (sortOption === 'oldest') {
        filtered_managers.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    } else if (sortOption === 'name') {
        filtered_managers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    // ── RENDER ──
    return (
        <div className="dashboard-container manage-admins-container">
            {/* Header */}
            <header className="st-header" style={{ marginBottom: '1.5rem' }}>
                <div className="st-header-top-row">
                    <div className="st-header-left" style={{ flexDirection: 'row', alignItems: 'center', gap: '1rem' }}>
                        <div>
                            <h1>Manager System</h1>
                            <p>Create operational managers with fine-grained CRUD permission control.</p>
                        </div>
                    </div>
                </div>
                
                <div className="st-header-bottom-row">
                    <div className="st-breadcrumbs">
                        <span>Dashboard</span>
                        <span>›</span>
                        <span className="active">Managers</span>
                    </div>
                    <div className="st-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {user?.role === 'admin' && (
                            <button
                                className="st-btn st-btn-primary"
                                onClick={() => { setShowModal(true); setWizardStep(1); setSelectedType('custom'); setTypeConfirmPending(null); setFormErrors({}); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                                + Create Manager
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {error && <div className="error-message">{error}</div>}

            {/* How it works (Steps Grid) */}
            <div className="ma-steps-grid">
                {[
                    { num: '1', title: 'Pick Manager Type', desc: 'Fees, Data, Academic, Ops, HR or Custom' },
                    { num: '2', title: 'Auto-Fill Permissions', desc: 'Preset fills all checkboxes instantly' },
                    { num: '3', title: 'Fine-Tune & Create', desc: 'Override any toggle before creating' },
                    { num: '4', title: 'Admin Controls', desc: 'Edit / block / delete anytime' },
                ].map(s => (
                    <div key={s.num} className="ma-step-card">
                        <div className="ma-step-icon">{s.num}</div>
                        <div className="ma-step-content">
                            <div className="ma-step-title">{s.title}</div>
                            <div className="ma-step-desc">{s.desc}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Stats Grid */}
            <div className="ma-stats-grid">
                <div className="ma-stat-card">
                    <div className="ma-stat-icon-wrapper" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
                        👥
                    </div>
                    <div className="ma-stat-info">
                        <h3>{managers_only.length}</h3>
                        <p>Total Managers</p>
                        <div className="ma-stat-subtitle">All registered managers</div>
                    </div>
                    <div className="ma-stat-dots" />
                </div>
                <div className="ma-stat-card">
                    <div className="ma-stat-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                        ✅
                    </div>
                    <div className="ma-stat-info">
                        <h3>{managers_only.filter(m => m.status === 'active').length}</h3>
                        <p>Active</p>
                        <div className="ma-stat-subtitle">Currently active managers</div>
                    </div>
                    <div className="ma-stat-dots" />
                </div>
                <div className="ma-stat-card">
                    <div className="ma-stat-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                        🚫
                    </div>
                    <div className="ma-stat-info">
                        <h3>{managers_only.filter(m => m.status !== 'active').length}</h3>
                        <p>Blocked</p>
                        <div className="ma-stat-subtitle">Temporarily blocked</div>
                    </div>
                    <div className="ma-stat-dots" />
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="ma-filter-bar">
                <input 
                    type="text" 
                    className="ma-search-input" 
                    placeholder="Search managers by name, email or phone..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select className="ma-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                    <option value="all">All Types</option>
                    {MANAGER_TYPES.map(t => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                </select>
                <select className="ma-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="blocked">Blocked</option>
                </select>
                <select className="ma-select" value={sortOption} onChange={(e) => setSortOption(e.target.value)}>
                    <option value="newest">Sort: Newest</option>
                    <option value="oldest">Sort: Oldest</option>
                    <option value="name">Sort: Name (A-Z)</option>
                </select>
            </div>

            {/* Manager cards */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>Loading managers...</div>
            ) : filtered_managers.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '4rem 2rem', borderRadius: '16px',
                    border: '2px dashed rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.04)'
                }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>👨‍💼</div>
                    <h3 style={{ marginBottom: '0.5rem' }}>No Managers Found</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                        {searchTerm ? "No managers match your search criteria." : "Create your first manager to delegate operational tasks."}
                    </p>
                    {user?.role === 'admin' && !searchTerm && (
                        <button className="btn btn-primary"
                            onClick={() => { setShowModal(true); setSelectedType('custom'); setTypeConfirmPending(null); }}
                            style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none' }}>
                            + Create First Manager
                        </button>
                    )}
                </div>
            ) : (
                <div className="ma-list-container">
                    <div className="ma-list-header">
                        <div>Manager Info</div>
                        <div>Permissions</div>
                        <div>Type</div>
                        <div>Last Login</div>
                        <div style={{ textAlign: 'right' }}>Actions</div>
                    </div>
                    {filtered_managers.map(mgr => {
                        const permLabels = buildPermLabel(Array.isArray(mgr.permissions) ? mgr.permissions : []);
                        const isBlocked = mgr.status !== 'active';
                        
                        // Extract a custom color based on manager type for the side border
                        let borderColor = '#6366f1';
                        let bgColorClass = 'linear-gradient(135deg,#6366f1,#8b5cf6)';
                        if (mgr.manager_type === 'finance') { borderColor = '#8b5cf6'; bgColorClass = 'linear-gradient(135deg,#8b5cf6,#a855f7)'; }
                        if (mgr.manager_type === 'data') { borderColor = '#3b82f6'; bgColorClass = 'linear-gradient(135deg,#3b82f6,#60a5fa)'; }
                        if (mgr.manager_type === 'academic') { borderColor = '#10b981'; bgColorClass = 'linear-gradient(135deg,#10b981,#34d399)'; }
                        if (isBlocked) { borderColor = '#ef4444'; bgColorClass = 'linear-gradient(135deg,#ef4444,#f87171)'; }

                        return (
                            <div key={mgr.id} className="ma-row-card" style={{ opacity: isBlocked ? 0.75 : 1, zIndex: actionMenuOpen === mgr.id ? 10 : 1 }}>
                                <div className="ma-row-card-indicator" style={{ background: borderColor }} />
                                
                                <div className="ma-col-profile">
                                    <div className="ma-profile-avatar" style={{ background: bgColorClass }}>
                                        {(mgr.name || 'M')[0].toUpperCase()}
                                    </div>
                                    <div className="ma-profile-details">
                                        <div className="ma-profile-name">
                                            {mgr.name} 
                                            <span className="ma-profile-status" style={{ 
                                                background: isBlocked ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', 
                                                color: isBlocked ? '#ef4444' : '#10b981' 
                                            }}>
                                                {isBlocked ? 'Blocked' : 'Active'}
                                            </span>
                                        </div>
                                        <div className="ma-profile-meta">
                                            ✉️ {mgr.email}
                                        </div>
                                        <div className="ma-profile-meta">
                                            📞 {mgr.phone || 'N/A'}
                                        </div>
                                        <div className="ma-profile-meta" style={{ marginTop: '2px' }}>
                                            📅 Joined: {mgr.created_at ? new Date(mgr.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Unknown'}
                                        </div>
                                    </div>
                                </div>

                                <div className="ma-col-perms">
                                    <div className="ma-perms-header">Permissions ({permLabels.length} modules)</div>
                                    <div className="ma-perms-chips">
                                        {permLabels.length === 0 ? (
                                            <span style={{ fontSize: '0.8rem', color: '#ef4444', fontStyle: 'italic' }}>No permissions assigned</span>
                                        ) : (
                                            <>
                                                {permLabels.slice(0, 3).map((lbl, i) => (
                                                    <span key={i} className="ma-perm-chip">{lbl}</span>
                                                ))}
                                                {permLabels.length > 3 && (
                                                    <span className="ma-perm-chip" style={{ background: 'transparent', border: 'none', fontWeight: 600 }}>
                                                        +{permLabels.length - 3} more
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="ma-col-type">
                                    <TypeBadge managerType={mgr.manager_type || 'custom'} />
                                </div>

                                <div className="ma-col-login">
                                    <div className="ma-login-header">Last Login</div>
                                    <div className="ma-login-val">
                                        <div className="ma-login-dot" style={{ background: isBlocked ? '#ef4444' : '#10b981' }} />
                                        {mgr.last_login ? new Date(mgr.last_login).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, month: 'short', day: 'numeric' }) : 'Never'}
                                    </div>
                                </div>

                                <div className="ma-col-actions" style={{ position: 'relative', zIndex: actionMenuOpen === mgr.id ? 20 : 1 }}>
                                    {user?.role === 'admin' && mgr.id !== user?.id && (
                                        <>
                                            <button className="ma-btn-outline" onClick={() => openEditModal(mgr)}>
                                                ✏️ Edit
                                            </button>
                                            <button className="ma-btn-icon" onClick={() => setActionMenuOpen(actionMenuOpen === mgr.id ? null : mgr.id)} title="Actions">
                                                ⋮
                                            </button>
                                            
                                            {actionMenuOpen === mgr.id && (
                                                <>
                                                    <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setActionMenuOpen(null)} />
                                                    <div style={{
                                                        position: 'absolute', right: '0', top: '100%', marginTop: '0.25rem',
                                                        background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px',
                                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '140px',
                                                        overflow: 'hidden'
                                                    }}>
                                                        {isBlocked ? (
                                                            <button onClick={() => { handleStatusChange(mgr.id, 'active'); setActionMenuOpen(null); }} style={{ width: '100%', padding: '0.6rem 1rem', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', color: '#10b981', fontWeight: 600, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}><span>✓</span> Mark Active</button>
                                                        ) : (
                                                            <button onClick={() => { handleStatusChange(mgr.id, 'blocked'); setActionMenuOpen(null); }} style={{ width: '100%', padding: '0.6rem 1rem', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', color: '#f59e0b', fontWeight: 600, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}><span>🚫</span> Block Access</button>
                                                        )}
                                                        <button onClick={() => { setDeletingId(mgr.id); setActionMenuOpen(null); }} style={{ width: '100%', padding: '0.6rem 1rem', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', fontWeight: 600, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}><span>🗑️</span> Delete</button>
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Primary admin list */}
            {admins_only.length > 0 && (
                <div style={{ marginTop: '2.5rem' }}>
                    <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', fontWeight: '600', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
                        PRIMARY ADMINS
                    </h3>
                    {admins_only.map(adm => (
                        <div key={adm.id} style={{
                            display: 'flex', alignItems: 'center', gap: '1rem',
                            padding: '0.75rem 1rem', borderRadius: '10px',
                            border: '1px solid var(--border-color)', marginBottom: '0.5rem',
                            background: 'var(--card-bg)'
                        }}>
                            <div style={{
                                width: '36px', height: '36px', borderRadius: '8px',
                                background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#fff', fontWeight: '700', fontSize: '0.9rem'
                            }}>
                                {(adm.name || 'A')[0].toUpperCase()}
                            </div>
                            <div style={{ flex: 1 }}>
                                <strong>{adm.name}</strong>
                                {adm.id === user?.id && <span style={{ marginLeft: '6px', fontSize: '0.75rem', color: '#6366f1' }}>(You)</span>}
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{adm.email}</div>
                            </div>
                            <span style={{
                                fontSize: '0.75rem', padding: '2px 10px', borderRadius: '20px',
                                background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: '600'
                            }}>🔑 Full Access</span>
                        </div>
                    ))}
                </div>
            )}

            {/* ── CREATE MANAGER MODAL (WIZARD) ── */}
            {showModal && (
                <div className="modal-overlay" style={{ backdropFilter: 'blur(4px)' }}>
                    <div className="ma-wizard-modal">
                        {/* Header & Close Button */}
                        <div className="ma-wizard-header-top">
                            <div>
                                <span className="ma-wizard-phase-badge">PHASE {wizardStep}</span>
                                <h2 className="ma-wizard-title">Create New Manager</h2>
                                <p className="ma-wizard-subtitle">Add a new operational manager and set permissions.</p>
                            </div>
                            <button className="ma-wizard-close" onClick={() => { setShowModal(false); setFormErrors({}); setWizardStep(1); }}>✕</button>
                        </div>

                        {/* Progress Stepper */}
                        <div className="ma-wizard-stepper">
                            {[1, 2, 3, 4].map(step => (
                                <Fragment key={step}>
                                    <div className={`ma-wizard-step ${wizardStep >= step ? 'active' : ''} ${wizardStep > step ? 'completed' : ''}`}>
                                        <div className="ma-step-circle">{wizardStep > step ? '✓' : step}</div>
                                        <div className="ma-step-labels">
                                            <div className="ma-step-title">
                                                {step === 1 ? 'Basic Information' : step === 2 ? 'Manager Type' : step === 3 ? 'Permissions' : 'Review'}
                                            </div>
                                            <div className="ma-step-desc">
                                                {step === 1 ? 'Add manager details' : step === 2 ? 'Select manager type' : step === 3 ? 'Choose access rights' : 'Confirm and create'}
                                            </div>
                                        </div>
                                    </div>
                                    {step < 4 && <div className={`ma-wizard-connector ${wizardStep > step ? 'completed' : ''}`} />}
                                </Fragment>
                            ))}
                        </div>

                        {/* Content Area */}
                        <div className="ma-wizard-content-area">
                            {wizardStep === 1 && (
                                <div className="ma-wizard-view">
                                    <h3 className="ma-wizard-section-title"><span></span> Basic Information</h3>
                                    <div className="ma-form-grid">
                                        <div className="form-group">
                                            <label className="form-label">Full Name <span style={{color: '#ef4444'}}>*</span></label>
                                            <div className="ma-input-with-icon">
                                                <span className="ma-input-icon">👤</span>
                                                <input type="text" name="name" className="form-input" style={{ paddingLeft: '2.5rem' }} value={formData.name} onChange={handleTextChange} placeholder="e.g. Ravi Kumar" />
                                            </div>
                                            {formErrors.name && <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>{formErrors.name}</span>}
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Email Address <span style={{color: '#ef4444'}}>*</span></label>
                                            <div className="ma-input-with-icon">
                                                <span className="ma-input-icon">✉️</span>
                                                <input type="email" name="email" className="form-input" style={{ paddingLeft: '2.5rem' }} value={formData.email} onChange={handleTextChange} placeholder="e.g. ravi@ithub.com" />
                                            </div>
                                            {formErrors.email && <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>{formErrors.email}</span>}
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Phone Number <span style={{color: '#ef4444'}}>*</span></label>
                                            <div className="ma-input-with-icon">
                                                <div className="ma-country-code">🇮🇳 +91 <span style={{fontSize: '0.6rem', color: '#9ca3af', marginLeft: '4px'}}>▼</span></div>
                                                <input type="tel" name="phone" className="form-input" style={{ paddingLeft: '5.5rem' }} value={formData.phone} onChange={handleTextChange} placeholder="9876543210" />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Password <span style={{color: '#ef4444'}}>*</span></label>
                                            <div className="ma-input-with-icon">
                                                <span className="ma-input-icon">🔒</span>
                                                <input type={showPassword ? "text" : "password"} name="password" className="form-input" style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }} value={formData.password} onChange={handleTextChange} placeholder="Min. 6 characters" />
                                                <span className="ma-input-action-icon" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '1rem', cursor: 'pointer' }}>
                                                    {showPassword ? '👁️‍🗨️' : '👁️'}
                                                </span>
                                            </div>
                                            {formErrors.password && <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>{formErrors.password}</span>}
                                        </div>
                                    </div>
                                    <div className="ma-wizard-info-banner">
                                        ℹ️ Please enter valid details. These will be used for login and identification.
                                    </div>
                                </div>
                            )}

                            {wizardStep === 2 && (
                                <div className="ma-wizard-view">
                                    <h3 className="ma-wizard-section-title"><span></span> Select Manager Type</h3>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', marginTop: '-0.5rem' }}>
                                        Choose a predefined manager type or create a custom one.
                                    </p>
                                    
                                    {typeConfirmPending && (
                                        <div className="ma-type-confirm">
                                            <div style={{ fontSize: '0.85rem', color: '#92400e' }}>⚠️ Switching type will reset all current permissions. Continue?</div>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '4px 14px' }} onClick={cancelTypeSwitch}>Cancel</button>
                                                <button type="button" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '4px 14px', background: '#f59e0b', border: 'none' }} onClick={() => applyTypePreset(typeConfirmPending)}>Yes, Switch</button>
                                            </div>
                                        </div>
                                    )}

                                    <ManagerTypeSelector selectedType={selectedType} onSelect={handleTypeSelect} />
                                </div>
                            )}

                            {wizardStep === 3 && (
                                <div className="ma-wizard-view">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <div>
                                            <h3 className="ma-wizard-section-title"><span></span> Module Permissions</h3>
                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '-0.5rem' }}>
                                                Select modules and choose allowed operations.
                                            </p>
                                        </div>
                                        <div className="ma-selected-modules-badge">
                                            {formData.permissions.length} modules selected
                                        </div>
                                    </div>

                                    <div className="ma-wizard-perms-grid">
                                        {CRUD_MODULES.map(mod => (
                                            <CrudSelector key={mod.val} mod={mod} perms={formData.permissions} onChange={perms => {
                                                let newPerms = [...perms];
                                                if (mod.val === 'fees') {
                                                    const hasFees = newPerms.includes('fees') || newPerms.some(p => p.startsWith('fees.'));
                                                    if (hasFees && !newPerms.includes('collect_fees')) { newPerms.push('collect_fees'); }
                                                    else if (!hasFees && newPerms.includes('collect_fees')) { newPerms = newPerms.filter(p => p !== 'collect_fees'); }
                                                }
                                                setFormData(fd => ({ ...fd, permissions: newPerms }));
                                            }} />
                                        ))}
                                    </div>
                                    <h4 style={{ fontSize: '1rem', fontWeight: '700', marginTop: '2rem', marginBottom: '1.25rem' }}>Feature Access</h4>
                                    <div className="ma-wizard-perms-grid">
                                        {TOGGLE_MODULES.map(mod => (
                                            <label key={mod.val} style={{
                                                display: 'flex', alignItems: 'center', gap: '1rem',
                                                padding: '1.25rem', borderRadius: '12px',
                                                border: `1px solid ${formData.permissions.includes(mod.val) ? '#6366f1' : 'var(--border-color)'}`,
                                                background: formData.permissions.includes(mod.val) ? 'rgba(99,102,241,0.02)' : '#fff',
                                                cursor: 'pointer', transition: 'all 0.2s',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                                            }}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.permissions.includes(mod.val)}
                                                    onChange={(e) => {
                                                        const checked = e.target.checked;
                                                        setFormData(fd => ({
                                                            ...fd,
                                                            permissions: checked ? [...fd.permissions, mod.val] : fd.permissions.filter(p => p !== mod.val)
                                                        }));
                                                    }}
                                                    style={{ width: '20px', height: '20px', accentColor: '#6366f1' }}
                                                />
                                                <span style={{ fontSize: '1.5rem' }}>{mod.icon}</span>
                                                <div>
                                                    <div style={{ fontWeight: '700', fontSize: '0.95rem', color: formData.permissions.includes(mod.val) ? '#4f46e5' : 'var(--text-primary)' }}>{mod.label}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{mod.desc}</div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {wizardStep === 4 && (
                                <div className="ma-wizard-view">
                                    <h3 className="ma-wizard-section-title"><span></span> Review & Confirm</h3>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', marginTop: '-0.5rem' }}>
                                        Review manager details, type and permissions before creating.
                                    </p>

                                    <div className="ma-wizard-review-grid">
                                        <div className="ma-review-card">
                                            <div className="ma-review-card-header"><span className="icon" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>👤</span> Manager Information</div>
                                            <div className="ma-review-row"><span>Full Name</span><strong>{formData.name}</strong></div>
                                            <div className="ma-review-row"><span>Email</span><strong>{formData.email}</strong></div>
                                            <div className="ma-review-row"><span>Phone</span><strong>{formData.phone || 'N/A'}</strong></div>
                                            <div className="ma-review-row"><span>Password</span><strong>********</strong></div>
                                        </div>
                                        
                                        <div className="ma-review-card">
                                            <div className="ma-review-card-header"><span className="icon" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>💼</span> Manager Type</div>
                                            <div className="ma-review-type-display">
                                                <div className="icon">
                                                    {selectedType === 'fees' ? '💰' : selectedType === 'data' ? '🗄️' : selectedType === 'academic' ? '🎓' : selectedType === 'ops' ? '⚙️' : selectedType === 'hr' ? '👥' : '🎛️'}
                                                </div>
                                                <div>
                                                    <div className="title">{MANAGER_TYPES.find(t => t.id === selectedType)?.label || 'Custom Manager'}</div>
                                                    <div className="desc">{MANAGER_TYPES.find(t => t.id === selectedType)?.desc || 'Custom module access'}</div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {(() => {
                                            const uniqueModules = Array.from(new Set(formData.permissions.map(p => p.split('.')[0])));
                                            return (
                                                <div className="ma-review-card">
                                                    <div className="ma-review-card-header"><span className="icon" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>⚙️</span> Permissions Summary</div>
                                                    <div className="ma-review-row"><span>Modules Selected</span><strong>{uniqueModules.length}</strong></div>
                                                    <div className="ma-review-row"><span>Total Operations</span><strong>{formData.permissions.length}</strong></div>
                                                    <div className="ma-review-row"><span>Access Level</span><strong>{selectedType === 'custom' ? 'Custom' : 'Preset'}</strong></div>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {(() => {
                                        const uniqueModules = Array.from(new Set(formData.permissions.map(p => p.split('.')[0])));
                                        return (
                                            <div className="ma-review-selected-modules">
                                                <h4>Selected Modules ({uniqueModules.length})</h4>
                                                <div className="chips-container">
                                                    {uniqueModules.slice(0, 10).map(p => {
                                                        const label = CRUD_MODULES.find(m => m.val === p)?.label || TOGGLE_MODULES.find(m => m.val === p)?.label || p;
                                                        const icon = CRUD_MODULES.find(m => m.val === p)?.icon || TOGGLE_MODULES.find(m => m.val === p)?.icon || '🔹';
                                                        return <span key={p} className="chip">{icon} {label}</span>;
                                                    })}
                                                    {uniqueModules.length > 10 && (
                                                        <span className="chip more">+{uniqueModules.length - 10} more</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    
                                    {formErrors.general && (
                                        <div style={{ color: '#ef4444', padding: '0.75rem', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', marginTop: '1rem' }}>
                                            ⚠️ {formErrors.general}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer Navigation */}
                        <div className="ma-wizard-footer">
                            <div>
                                {wizardStep > 1 && (
                                    <button type="button" className="ma-btn-back" onClick={prevStep}>
                                        ← Back
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                {wizardStep === 1 && (
                                    <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setFormErrors({}); setWizardStep(1); }}>
                                        Cancel
                                    </button>
                                )}
                                {wizardStep < 4 ? (
                                    <button type="button" className="ma-btn-next" onClick={nextStep}>
                                        Next →
                                    </button>
                                ) : (
                                    <button type="button" className="ma-btn-create" onClick={handleCreateManager} disabled={submitting}>
                                        {submitting ? 'Creating...' : '✓ Create Manager'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── EDIT PERMISSIONS MODAL ── */}
            {editingManager && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '680px', width: '95%', maxHeight: '92vh', overflowY: 'auto' }}>
                        <h2 style={{ marginBottom: '0.25rem' }}>✏️ Edit: {editingManager.name}</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
                            Update manager details, permissions and account status.
                        </p>

                        <div style={{ fontWeight: '700', fontSize: '0.92rem', marginBottom: '0.75rem' }}>Basic Information</div>
                        <div className="ma-form-grid">
                            <div className="form-group" style={{ marginBottom: '0' }}>
                                <label className="form-label">Full Name</label>
                                <div className="ma-input-with-icon">
                                    <span className="ma-input-icon">👤</span>
                                    <input type="text" className="form-input" style={{ paddingLeft: '2.5rem' }} value={editingManager.name || ''} onChange={e => setEditingManager({...editingManager, name: e.target.value})} />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: '0' }}>
                                <label className="form-label">Email Address</label>
                                <div className="ma-input-with-icon">
                                    <span className="ma-input-icon">✉️</span>
                                    <input type="email" className="form-input" style={{ paddingLeft: '2.5rem' }} value={editingManager.email || ''} onChange={e => setEditingManager({...editingManager, email: e.target.value})} />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: '0' }}>
                                <label className="form-label">Phone Number</label>
                                <div className="ma-input-with-icon">
                                    <div className="ma-country-code">🇮🇳 +91 <span style={{fontSize: '0.6rem', color: '#9ca3af', marginLeft: '4px'}}>▼</span></div>
                                    <input type="tel" className="form-input" style={{ paddingLeft: '5.5rem' }} value={editingManager.phone || ''} onChange={e => setEditingManager({...editingManager, phone: e.target.value})} />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: '0' }}>
                                <label className="form-label">New Password (Optional)</label>
                                <div className="ma-input-with-icon">
                                    <span className="ma-input-icon">🔒</span>
                                    <input type={showPassword ? "text" : "password"} className="form-input" style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }} value={editingManager.password || ''} onChange={e => setEditingManager({...editingManager, password: e.target.value})} placeholder="Leave blank to keep current" />
                                    <span className="ma-input-action-icon" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '1rem', cursor: 'pointer' }}>
                                        {showPassword ? '👁️‍🗨️' : '👁️'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Status */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <div style={{ fontWeight: '700', fontSize: '0.92rem', marginBottom: '0.5rem' }}>Account Status</div>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                {['active', 'blocked'].map(s => (
                                    <label key={s} style={{
                                        display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
                                        padding: '0.5rem 1.2rem', borderRadius: '8px',
                                        border: `1.5px solid ${editStatus === s ? (s === 'active' ? '#10b981' : '#ef4444') : 'var(--border-color)'}`,
                                        background: editStatus === s ? (s === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)') : 'transparent',
                                        fontWeight: '600',
                                        color: editStatus === s ? (s === 'active' ? '#10b981' : '#ef4444') : 'var(--text-secondary)'
                                    }}>
                                        <input type="radio" value={s} checked={editStatus === s} onChange={() => setEditStatus(s)} style={{ accentColor: s === 'active' ? '#10b981' : '#ef4444' }} />
                                        {s === 'active' ? '● Active' : '🚫 Blocked'}
                                    </label>
                                ))}
                            </div>
                            {editStatus === 'blocked' && (
                                <div style={{ marginTop: '0.6rem', padding: '0.6rem 0.9rem', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.83rem', color: '#ef4444' }}>
                                    ⚠️ Blocked manager can still log in but will see a blocking message and cannot perform any operations.
                                </div>
                            )}
                        </div>

                        {/* CRUD Permissions */}
                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{ fontWeight: '700', fontSize: '0.92rem', marginBottom: '0.25rem' }}>
                                🔑 Module Permissions
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                                {CRUD_MODULES.map(mod => (
                                    <CrudSelector key={mod.val} mod={mod} perms={editPerms} onChange={perms => {
                                        let newPerms = [...perms];
                                        if (mod.val === 'fees') {
                                            const hasFees = newPerms.includes('fees') || newPerms.some(p => p.startsWith('fees.'));
                                            if (hasFees && !newPerms.includes('collect_fees')) {
                                                newPerms.push('collect_fees');
                                            } else if (!hasFees && newPerms.includes('collect_fees')) {
                                                newPerms = newPerms.filter(p => p !== 'collect_fees');
                                            }
                                        }
                                        setEditPerms(newPerms);
                                    }} />
                                ))}
                            </div>
                        </div>

                        {/* Toggle Permissions */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <div style={{ fontWeight: '700', fontSize: '0.92rem', marginBottom: '0.5rem' }}>⚡ Feature Access</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '0.4rem' }}>
                                {TOGGLE_MODULES.map(t => {
                                    const has = editPerms.includes(t.val);
                                    return (
                                        <label key={t.val} style={{
                                            display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                                            padding: '0.55rem 0.75rem', borderRadius: '8px', cursor: 'pointer',
                                            border: `1px solid ${has ? 'rgba(99,102,241,0.4)' : 'var(--border-color)'}`,
                                            background: has ? 'rgba(99,102,241,0.08)' : 'transparent'
                                        }}>
                                            <input type="checkbox" checked={has}
                                                onChange={() => setEditPerms(p => {
                                                    let newPerms = [...p];
                                                    if (newPerms.includes(t.val)) {
                                                        newPerms = newPerms.filter(x => x !== t.val);
                                                        // If Collect Fees is removed, remove all Fee Structure permissions
                                                        if (t.val === 'collect_fees') {
                                                            newPerms = newPerms.filter(x => x !== 'fees' && !x.startsWith('fees.'));
                                                        }
                                                    } else {
                                                        newPerms.push(t.val);
                                                        if (t.val === 'collect_fees' && !newPerms.includes('fees.read') && !newPerms.includes('fees')) {
                                                            newPerms.push('fees.read');
                                                        }
                                                    }
                                                    return newPerms;
                                                })}
                                                style={{ accentColor: '#6366f1', marginTop: '2px' }} />
                                            <div>
                                                <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{t.icon} {t.label}</div>
                                                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{t.desc}</div>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setEditingManager(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSaveEdit} disabled={savingEdit}
                                style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none' }}>
                                {savingEdit ? 'Saving…' : '✅ Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── DELETE CONFIRM ── */}
            {deletingId && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
                        <h2>Remove Manager?</h2>
                        <p style={{ color: 'var(--text-secondary)', margin: '0.75rem 0 1.5rem' }}>
                            This will permanently remove this manager's access.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                            <button className="btn btn-secondary" onClick={() => setDeletingId(null)}>Cancel</button>
                            <button className="btn btn-danger" onClick={handleDeleteManager}>Yes, Remove</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ManageAdmins;
