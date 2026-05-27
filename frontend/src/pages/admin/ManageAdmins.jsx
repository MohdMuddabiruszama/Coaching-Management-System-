import { useState, useEffect, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import ThemeSelector from "../../components/ThemeSelector";
import { MANAGER_TYPES, buildPermissionsFromPreset } from "../../config/managerPresets";
import "./Dashboard.css";
import "./ManageAdmins.css";

// ─── Modules that support granular CRUD ───
const CRUD_MODULES = [
    { val: 'students', label: 'Manage Students', icon: '👨‍🎓', desc: 'Student records management' },
    { val: 'faculty', label: 'Manage Faculty', icon: '👩‍🏫', desc: 'Faculty records management' },
    { val: 'classes', label: 'Manage Classes', icon: '📚', desc: 'Class records management' },
    { val: 'subjects', label: 'Manage Subjects', icon: '📖', desc: 'Subject records management' },
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
const TOGGLE_MODULES = [
    { val: 'notes', label: 'My Notes', icon: '📚', desc: 'Manage class notes' },
    { val: 'chat', label: 'Academic Chats', icon: '💬', desc: 'Participate in subject chats' },
    { val: 'attendance', label: 'Attendance', icon: '📋', desc: 'Mark & view attendance' },
    { val: 'reports', label: 'Reports & Analytics', icon: '📊', desc: 'Attendance & academic reports' },
    { val: 'announcements', label: 'Announcements', icon: '📢', desc: 'Post & manage announcements' },
    { val: 'exams', label: 'Exams', icon: '📝', desc: 'Exam schedules & results' },
    { val: 'collect_fees', label: 'Collect Fees', icon: '💰', desc: 'Collect & view student fees' },
    { val: 'recent_payments', label: 'Recent Payments', icon: '🧾', desc: 'View recent payments section' },
    { val: 'transport', label: 'Transport Fees', icon: '🚌', desc: 'Bus routes & transport fees' },
    { val: 'parents', label: 'Manage Parents', icon: '👨‍👩‍👧', desc: 'View & manage parent records' },
    { val: 'biometric', label: 'Bio-Metric', icon: '🔐', desc: 'Biometric device management' },
    { val: 'finance', label: 'Finance Dashboard', icon: '📊', desc: 'Financial reports and analytics' },
    { val: 'assignments', label: 'Assignments', icon: '📄', desc: 'View & manage assignments' },
    { val: 'performance_hub', label: 'Performance Hub', icon: '📈', desc: 'View advanced performance analytics' },
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
const activeCrudOps = (perms, mod) =>
    CRUD_OPS.filter(({ op }) => perms.includes(`${mod}.${op}`) || perms.includes(mod)).map(o => o.op);

// Build a display label for a permission array (compact)
const buildPermLabel = (perms) => {
    const labels = [];
    for (const m of CRUD_MODULES) {
        const ops = CRUD_OPS.filter(({ op }) => perms.includes(`${m.val}.${op}`)).map(o => o.label);
        if (perms.includes(m.val)) labels.push(`${m.icon} ${m.label} (All)`);
        else if (ops.length) labels.push(`${m.icon} ${m.label} (${ops.join(', ')})`);
    }
    for (const t of TOGGLE_MODULES) {
        if (perms.includes(t.val)) labels.push(`${t.icon} ${t.label}`);
    }
    return labels;
};

// ── CrudSelector component ───────────────────────────────
function CrudSelector({ mod, perms, onChange }) {
    const enabled = moduleEnabled(perms, mod.val);
    const active = activeCrudOps(perms, mod.val);

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
        } else {
            updated = [...updated, key];
        }
        // If all 4 ops are now active, collapse to base key (optional — keep granular)
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
                        {active.length} / 4 ops
                    </span>
                )}
            </label>

            {/* CRUD operation selectors */}
            {enabled && (
                <div style={{
                    display: 'flex', gap: '0.4rem', padding: '0.6rem 0.85rem',
                    flexWrap: 'wrap'
                }}>
                    {CRUD_OPS.map(({ op, label, icon, color }) => {
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

    const [managers, setManagers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Create modal
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', permissions: [] });
    const [formErrors, setFormErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    // Manager type preset state
    const [selectedType, setSelectedType] = useState('custom');
    const [typeConfirmPending, setTypeConfirmPending] = useState(null); // typeId waiting for confirm

    // Edit modal
    const [editingManager, setEditingManager] = useState(null);
    const [editPerms, setEditPerms] = useState([]);
    const [editStatus, setEditStatus] = useState('active');
    const [savingEdit, setSavingEdit] = useState(false);

    // Delete confirm
    const [deletingId, setDeletingId] = useState(null);

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
        setFormData(fd => ({
            ...fd,
            permissions: fd.permissions.includes(val)
                ? fd.permissions.filter(p => p !== val)
                : [...fd.permissions, val]
        }));
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
            await api.put(`/admin/admins/${editingManager.id}`, {
                name: editingManager.name,
                email: editingManager.email,
                phone: editingManager.phone,
                status: editStatus,
                permissions: editPerms,
            });
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

    const managers_only = managers.filter(m => m.role === 'manager');
    const admins_only = managers.filter(m => m.role === 'admin');

    // ── RENDER ──
    return (
        <div className="dashboard-container">
            {/* Header */}
            <header className="dashboard-header">
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontSize: '2rem' }}>👨‍💼</span> Manager System
                    </h1>
                    <p>Create operational managers with fine-grained CRUD permission control.</p>
                </div>
                <div className="dashboard-header-right">
                    <ThemeSelector />
                    <button className="btn btn-secondary" onClick={() => navigate('/admin/dashboard')}>← Back</button>
                    {user?.role === 'admin' && (
                        <button
                            className="btn btn-primary"
                            onClick={() => { setShowModal(true); setSelectedType('custom'); setTypeConfirmPending(null); }}
                            style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none' }}
                        >
                            + Create Manager
                        </button>
                    )}
                </div>
            </header>

            {error && <div className="error-message">{error}</div>}

            {/* How it works */}
            <div style={{
                background: 'linear-gradient(135deg,rgba(99,102,241,0.1),rgba(168,85,247,0.1))',
                border: '1px solid rgba(99,102,241,0.3)', borderRadius: '12px',
                padding: '1rem 1.5rem', marginBottom: '2rem',
                display: 'flex', gap: '2rem', flexWrap: 'wrap'
            }}>
                {[
                    { icon: '1️⃣', title: 'Pick Manager Type', desc: 'Fees, Data, Academic, Ops, HR or Custom' },
                    { icon: '2️⃣', title: 'Auto-Fill Permissions', desc: 'Preset fills all checkboxes instantly' },
                    { icon: '3️⃣', title: 'Fine-Tune & Create', desc: 'Override any toggle before creating' },
                    { icon: '4️⃣', title: 'Admin Controls', desc: 'Edit/block anytime' },
                ].map(s => (
                    <div key={s.icon} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>{s.icon}</span>
                        <div>
                            <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{s.title}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{s.desc}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Stats */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: '2rem' }}>
                <div className="stat-card">
                    <div className="stat-icon">👨‍💼</div>
                    <div className="stat-content"><h3>{managers_only.length}</h3><p>Total Managers</p></div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">✅</div>
                    <div className="stat-content"><h3>{managers_only.filter(m => m.status === 'active').length}</h3><p>Active</p></div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">🚫</div>
                    <div className="stat-content"><h3>{managers_only.filter(m => m.status !== 'active').length}</h3><p>Blocked</p></div>
                </div>
            </div>

            {/* Manager cards */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>Loading managers...</div>
            ) : managers_only.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '4rem 2rem', borderRadius: '16px',
                    border: '2px dashed rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.04)'
                }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>👨‍💼</div>
                    <h3 style={{ marginBottom: '0.5rem' }}>No Managers Yet</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                        Create your first manager to delegate operational tasks.
                    </p>
                    {user?.role === 'admin' && (
                        <button className="btn btn-primary"
                            onClick={() => { setShowModal(true); setSelectedType('custom'); setTypeConfirmPending(null); }}
                            style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none' }}>
                            + Create First Manager
                        </button>
                    )}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {managers_only.map(mgr => {
                        const permLabels = buildPermLabel(Array.isArray(mgr.permissions) ? mgr.permissions : []);
                        const isBlocked = mgr.status !== 'active';
                        return (
                            <div key={mgr.id} style={{
                                borderRadius: '14px', border: '1px solid var(--border-color)',
                                background: 'var(--card-bg,rgba(255,255,255,0.03))',
                                padding: '1.25rem 1.5rem', position: 'relative',
                                opacity: isBlocked ? 0.85 : 1
                            }}>
                                <div style={{
                                    position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
                                    borderRadius: '14px 0 0 14px',
                                    background: isBlocked
                                        ? 'linear-gradient(180deg,#ef4444,#9ca3af)'
                                        : 'linear-gradient(180deg,#6366f1,#a855f7)'
                                }} />

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                        <div style={{
                                            width: '52px', height: '52px', borderRadius: '12px',
                                            background: isBlocked
                                                ? 'linear-gradient(135deg,#9ca3af,#6b7280)'
                                                : 'linear-gradient(135deg,#6366f1,#a855f7)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: '#fff', fontWeight: '800', fontSize: '1.2rem', flexShrink: 0
                                        }}>
                                            {(mgr.name || 'M')[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px', flexWrap: 'wrap' }}>
                                                <strong style={{ fontSize: '1.05rem' }}>{mgr.name}</strong>
                                                <span style={{
                                                    fontSize: '0.72rem', padding: '1px 8px', borderRadius: '20px', fontWeight: '600',
                                                    background: isBlocked ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                                                    color: isBlocked ? '#ef4444' : '#10b981'
                                                }}>
                                                    {isBlocked ? '🚫 Blocked' : '● Active'}
                                                </span>
                                                {/* ── Manager Type Badge ── */}
                                                <TypeBadge managerType={mgr.manager_type || 'custom'} />
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>📧 {mgr.email}</div>
                                            {mgr.phone && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>📞 {mgr.phone}</div>}
                                        </div>
                                    </div>

                                    {user?.role === 'admin' && mgr.id !== user?.id && (
                                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                                            <button className="btn btn-secondary" style={{ fontSize: '0.85rem' }}
                                                onClick={() => openEditModal(mgr)}>✏️ Edit</button>
                                            <button className="btn btn-danger" style={{ fontSize: '0.85rem' }}
                                                onClick={() => setDeletingId(mgr.id)}>🗑️</button>
                                        </div>
                                    )}
                                </div>

                                {/* permissions display */}
                                <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>
                                        PERMISSIONS ({permLabels.length > 0 ? permLabels.length : 0} modules)
                                    </div>
                                    {permLabels.length === 0 ? (
                                        <span style={{ fontSize: '0.8rem', color: '#ef4444', fontStyle: 'italic' }}>No permissions assigned</span>
                                    ) : (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                            {permLabels.map((lbl, i) => (
                                                <span key={i} style={{
                                                    fontSize: '0.76rem', padding: '2px 10px', borderRadius: '20px',
                                                    background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
                                                    color: 'var(--text-primary)', fontWeight: '500'
                                                }}>{lbl}</span>
                                            ))}
                                        </div>
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

            {/* ── CREATE MANAGER MODAL ── */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '720px', width: '95%', maxHeight: '92vh', overflowY: 'auto' }}>
                        <h2 style={{ marginBottom: '0.25rem' }}>👨‍💼 Create New Manager</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
                            Choose a manager type to auto-fill permissions, or pick Custom to set manually.
                        </p>

                        {/* ── Type confirmation dialog (inline) ── */}
                        {typeConfirmPending && (
                            <div style={{
                                background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)',
                                borderRadius: '10px', padding: '0.85rem 1rem', marginBottom: '1rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap'
                            }}>
                                <div style={{ fontSize: '0.85rem', color: '#92400e' }}>
                                    ⚠️ Switching type will reset all current permissions. Continue?
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '4px 14px' }}
                                        onClick={cancelTypeSwitch}>Cancel</button>
                                    <button type="button" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '4px 14px', background: '#f59e0b', border: 'none' }}
                                        onClick={() => applyTypePreset(typeConfirmPending)}>Yes, Switch</button>
                                </div>
                            </div>
                        )}

                        {/* ── Manager Type Selector ── */}
                        <ManagerTypeSelector selectedType={selectedType} onSelect={handleTypeSelect} />

                        <form onSubmit={handleCreateManager}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Full Name *</label>
                                    <input type="text" name="name" className="form-input" value={formData.name} onChange={handleTextChange} placeholder="e.g. Ravi Kumar" />
                                    {formErrors.name && <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>{formErrors.name}</span>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email *</label>
                                    <input type="email" name="email" className="form-input" value={formData.email} onChange={handleTextChange} placeholder="ravi@institute.com" />
                                    {formErrors.email && <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>{formErrors.email}</span>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Phone</label>
                                    <input type="tel" name="phone" className="form-input" value={formData.phone} onChange={handleTextChange} placeholder="9876543210" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Password *</label>
                                    <input type="password" name="password" className="form-input" value={formData.password} onChange={handleTextChange} placeholder="Min 6 characters" />
                                    {formErrors.password && <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>{formErrors.password}</span>}
                                </div>
                            </div>

                            {/* CRUD modules */}
                            <div style={{ marginBottom: '1rem' }}>
                                <div style={{ fontWeight: '700', fontSize: '0.92rem', marginBottom: '0.25rem' }}>
                                    🔑 Module Permissions <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: '400' }}>(select module then choose allowed operations)</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    {CRUD_MODULES.map(mod => (
                                        <CrudSelector key={mod.val} mod={mod} perms={formData.permissions}
                                            onChange={perms => setFormData(fd => ({ ...fd, permissions: perms }))} />
                                    ))}
                                </div>
                            </div>

                            {/* Toggle modules */}
                            <div style={{ marginBottom: '1rem' }}>
                                <div style={{ fontWeight: '700', fontSize: '0.92rem', marginBottom: '0.5rem' }}>
                                    ⚡ Feature Access
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '0.4rem' }}>
                                    {TOGGLE_MODULES.map(t => (
                                        <label key={t.val} style={{
                                            display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                                            padding: '0.55rem 0.75rem', borderRadius: '8px', cursor: 'pointer',
                                            border: `1px solid ${formData.permissions.includes(t.val) ? 'rgba(99,102,241,0.4)' : 'var(--border-color)'}`,
                                            background: formData.permissions.includes(t.val) ? 'rgba(99,102,241,0.08)' : 'transparent'
                                        }}>
                                            <input type="checkbox" checked={formData.permissions.includes(t.val)}
                                                onChange={() => handleTogglePerm(t.val)} style={{ accentColor: '#6366f1', marginTop: '2px' }} />
                                            <div>
                                                <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{t.icon} {t.label}</div>
                                                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{t.desc}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {formErrors.general && (
                                <div style={{ color: '#ef4444', padding: '0.75rem', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', marginBottom: '1rem' }}>
                                    ⚠️ {formErrors.general}
                                </div>
                            )}

                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary"
                                    onClick={() => { setShowModal(false); setFormErrors({}); }}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}
                                    style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none' }}>
                                    {submitting ? 'Creating…' : '✅ Create Manager'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── EDIT PERMISSIONS MODAL ── */}
            {editingManager && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '680px', width: '95%', maxHeight: '92vh', overflowY: 'auto' }}>
                        <h2 style={{ marginBottom: '0.25rem' }}>✏️ Edit: {editingManager.name}</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
                            Update permissions and account status.
                        </p>

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
                                    <CrudSelector key={mod.val} mod={mod} perms={editPerms} onChange={setEditPerms} />
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
                                                onChange={() => setEditPerms(p => p.includes(t.val) ? p.filter(x => x !== t.val) : [...p, t.val])}
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
