/**
 * Fees Management Page — Phase 3
 * Manager view: shows Pending / Paid students, search, and cash collection modal
 * Admin view: additionally shows Fee Structures tab
 */

import { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import "./Dashboard.css";

const TODAY = new Date().toISOString().split('T')[0];

function Fees() {
    const { user } = useContext(AuthContext);
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

    // Helper to check granular permissions
    const hasPerm = (module, action) => {
        if (isAdmin) return true;
        if (user?.role === 'manager') {
            return user.permissions?.includes(`${module}.${action}`) || user.permissions?.includes(module);
        }
        return false;
    };

    // tabs: 'collect' | 'history' | 'structure'
    const [tab, setTab] = useState('collect');

    // Data
    const [studentFees, setStudentFees] = useState([]);
    const [payments, setPayments] = useState([]);
    const [discountLogs, setDiscountLogs] = useState([]);
    const [feeStructures, setFeeStructures] = useState([]);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);

    // UI
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterClass, setFilterClass] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); // 'pending' | 'paid' | 'all'
    const [success, setSuccess] = useState('');

    // Collect fee modal
    const [collectingStudent, setCollectingStudent] = useState(null);
    const [collecting, setCollecting] = useState(false);
    const [payForm, setPayForm] = useState({
        amount: '',
        payment_method: 'cash',
        transaction_id: '',
        payment_date: TODAY,
        remarks: '',
        reminder_date: ''
    });
    const [payError, setPayError] = useState('');

    // Add fee structure modal (admin)
    const [showStructureModal, setShowStructureModal] = useState(false);
    const [editingStructureId, setEditingStructureId] = useState(null);
    const [availableSubjects, setAvailableSubjects] = useState([]);
    const [structureForm, setStructureForm] = useState({
        class_id: '', subject_id: '', fee_type: 'Tuition Fee', custom_fee_type: '', amount: '', due_date: '', description: '',
        student_target: 'all', individual_student_id: ''
    });
    const [allStudentsForClass, setAllStudentsForClass] = useState([]);

    // Discount modal
    const [discountingFee, setDiscountingFee] = useState(null);
    const [discountForm, setDiscountForm] = useState({ percentage: '', amount: '', reason: '' });

    // Reminder edit
    const [editingReminderFee, setEditingReminderFee] = useState(null);
    const [reminderDateInput, setReminderDateInput] = useState('');
    const [updatingRem, setUpdatingRem] = useState(false);

    // Receipt Modal
    const [viewingReceipt, setViewingReceipt] = useState(null);

    useEffect(() => { init(); }, []);

    const init = async () => {
        try {
            setLoading(true);
            const [sfRes, cRes, pRes, dRes] = await Promise.all([
                api.get('/fees/student-fees'),
                api.get('/classes'),
                api.get('/fees/payments'),
                api.get('/fees/discount-logs')
            ]);
            setStudentFees(sfRes.data.data || []);
            setClasses(cRes.data.data || []);
            setPayments(pRes.data.data || []);
            setDiscountLogs(dRes.data.data || []);
            if (isAdmin || hasPerm('fees', 'read')) {
                const fRes = await api.get('/fees/structure');
                setFeeStructures(fRes.data.data || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const refreshPayments = async () => {
        const [sfRes, pRes] = await Promise.all([
            api.get('/fees/student-fees'),
            api.get('/fees/payments'),
        ]);
        setStudentFees(sfRes.data.data || []);
        setPayments(pRes.data.data || []);
    };

    const filteredFees = studentFees.filter(sf => {
        const name = sf.Student?.User?.name?.toLowerCase() || '';
        const roll = sf.Student?.roll_number?.toLowerCase() || '';
        const matchSearch = !search || name.includes(search.toLowerCase()) || roll.includes(search.toLowerCase());
        const matchClass = !filterClass || String(sf.class_id) === String(filterClass);
        const matchStatus = filterStatus === 'all' ? true : sf.status === filterStatus;
        return matchSearch && matchClass && matchStatus;
    });

    // Open collect modal pre-filled
    const openCollect = (stuFee) => {
        setCollectingStudent(stuFee);
        setPayForm({
            amount: stuFee.due_amount,
            payment_method: 'cash',
            transaction_id: '',
            payment_date: TODAY,
            remarks: '',
            reminder_date: stuFee.reminder_date || ''
        });
        setPayError('');
    };

    const openDiscount = (stuFee) => {
        if (String(stuFee.id).startsWith('dummy_')) {
            alert("No configured class fee exists for this student.");
            return;
        }
        setDiscountingFee(stuFee);
        setDiscountForm({ percentage: '', amount: '', reason: '' });
        setPayError('');
    };

    const handleCollect = async (e) => {
        e.preventDefault();
        const parsedAmount = parseFloat(payForm.amount);
        if (!payForm.amount || isNaN(parsedAmount) || parsedAmount <= 0) {
            setPayError('Please enter a valid amount greater than ₹0.');
            return;
        }
        // Warn if paying more than due (but allow — could be advance)
        if (collectingStudent.due_amount > 0 && parsedAmount > parseFloat(collectingStudent.due_amount)) {
            const ok = window.confirm(`You are paying ₹${parsedAmount.toLocaleString()} which is more than the due amount ₹${parseFloat(collectingStudent.due_amount).toLocaleString()}. Continue?`);
            if (!ok) return;
        }
        try {
            setCollecting(true);
            setPayError('');
            await api.post('/fees/pay', {
                student_id: collectingStudent.student_id,
                fee_structure_id: collectingStudent.fee_structure_id || null,
                amount: parsedAmount,   // send as number, not string
                payment_method: payForm.payment_method,
                transaction_id: payForm.transaction_id || null,
                payment_date: payForm.payment_date || undefined,
                remarks: payForm.remarks || null,
                reminder_date: payForm.reminder_date || null   // empty string → null
            });
            setCollectingStudent(null);
            setSuccess(`✅ Payment of ₹${parsedAmount.toLocaleString()} collected successfully`);
            setTimeout(() => setSuccess(''), 5000);
            await refreshPayments();
        } catch (err) {
            setPayError(err.response?.data?.message || 'Failed to record payment. Please try again.');
        } finally {
            setCollecting(false);
        }
    };

    const handleDiscount = async (e) => {
        e.preventDefault();
        const conf = window.confirm(`Are you sure you want to give a discount of ₹${discountForm.amount}?`);
        if (!conf) return;
        try {
            await api.post('/fees/discount', {
                student_fee_id: discountingFee.id,
                discount_amount: discountForm.amount,
                reason: discountForm.reason
            });
            setDiscountingFee(null);
            setSuccess(`🎉 Discount applied successfully`);
            setTimeout(() => setSuccess(''), 5000);
            const [sfRes, dRes] = await Promise.all([api.get('/fees/student-fees'), api.get('/fees/discount-logs')]);
            setStudentFees(sfRes.data.data || []);
            setDiscountLogs(dRes.data.data || []);
        } catch (err) {
            alert(err.response?.data?.message || 'Error applying discount');
        }
    };

    const handleUpdateReminder = async (e) => {
        e.preventDefault();
        try {
            setUpdatingRem(true);
            await api.patch(`/fees/student-fee/${editingReminderFee.id}/reminder`, {
                reminder_date: reminderDateInput
            });
            setEditingReminderFee(null);
            setSuccess(`📅 Reminder date updated successfully`);
            setTimeout(() => setSuccess(''), 5000);
            const sfRes = await api.get('/fees/student-fees');
            setStudentFees(sfRes.data.data || []);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update reminder date');
        } finally {
            setUpdatingRem(false);
        }
    };

    const fetchSubjectsForClass = async (classId) => {
        if (!classId) { setAvailableSubjects([]); setAllStudentsForClass([]); return; }
        try {
            const r = await api.get(`/subjects?class_id=${classId}`);
            setAvailableSubjects(r.data.data || []);
        } catch (err) {
            console.error('Failed to load subjects:', err);
            setAvailableSubjects([]);
        }
        try {
            // Fetch all students in this class for individual student selection
            const sRes = await api.get(`/students/lookup?class_id=${classId}&limit=200`);
            setAllStudentsForClass(sRes.data.data || []);
        } catch (err) {
            console.error('Failed to load students for class:', err);
            setAllStudentsForClass([]);
        }
    };

    const handleStructureSubmit = async (e) => {
        e.preventDefault();
        // Validate individual student is selected when target is individual
        if (structureForm.student_target === 'individual' && !structureForm.individual_student_id) {
            alert('Please select a student for Individual Student fee structure.');
            return;
        }
        const payload = {
            ...structureForm,
            fee_type: structureForm.fee_type === 'Other' ? structureForm.custom_fee_type : structureForm.fee_type,
            // Only send individual_student_id if individual target
            individual_student_id: structureForm.student_target === 'individual' ? structureForm.individual_student_id : null,
            // Force subject_id to null if targeting an individual
            subject_id: structureForm.student_target === 'individual' ? null : structureForm.subject_id
        };
        try {
            if (editingStructureId) {
                await api.put(`/fees/structure/${editingStructureId}`, payload);
                setSuccess("✅ Fee structure updated successfully.");
            } else {
                await api.post('/fees/structure', payload);
                setSuccess("✅ Fee structure created successfully.");
            }
            setTimeout(() => setSuccess(''), 5000);
            setShowStructureModal(false);
            const r = await api.get('/fees/structure');
            setFeeStructures(r.data.data || []);
            setStructureForm({ class_id: '', subject_id: '', fee_type: 'Tuition Fee', custom_fee_type: '', amount: '', due_date: '', description: '', student_target: 'all', individual_student_id: '' });
            setEditingStructureId(null);
        } catch (err) {
            alert(err.response?.data?.message || 'Error saving fee structure');
        }
    };

    const handleEditStructure = (fs) => {
        const isPredefined = ['Tuition Fee', 'Exam Fee', 'Transport Fee', 'Library Fee'].includes(fs.fee_type);
        setEditingStructureId(fs.id);
        setStructureForm({
            class_id: fs.class_id,
            subject_id: fs.subject_id || '',
            fee_type: isPredefined ? fs.fee_type : 'Other',
            custom_fee_type: isPredefined ? '' : fs.fee_type,
            amount: fs.amount,
            due_date: fs.due_date,
            description: fs.description || '',
            student_target: fs.individual_student_id ? 'individual' : 'all',
            individual_student_id: fs.individual_student_id || ''
        });
        fetchSubjectsForClass(fs.class_id);
        setShowStructureModal(true);
    };

    const handleDeleteStructure = async (id) => {
        if (!window.confirm("Are you sure you want to delete this fee structure?")) return;
        try {
            await api.delete(`/fees/structure/${id}`);
            setSuccess("✅ Fee structure deleted successfully.");
            setTimeout(() => setSuccess(''), 5000);
            const r = await api.get('/fees/structure');
            setFeeStructures(r.data.data || []);
        } catch (err) {
            alert(err.response?.data?.message || 'Error deleting fee structure');
        }
    };

    if (loading) return <div className="dashboard-container"><div className="dashboard-loading">Loading fees...</div></div>;

    const tabs = [
        ...(isAdmin || user.permissions?.includes('collect_fees') ? [{ id: 'collect', label: '💰 Collect Fees', icon: '💰' }] : []),
        ...(isAdmin || user.permissions?.includes('payment_history') || user.permissions?.includes('recent_payments') ? [{ id: 'history', label: '📋 Payment History', icon: '📋' }] : []),
        ...(isAdmin || hasPerm('fees', 'read') ? [{ id: 'structure', label: '📐 Fee Structures', icon: '📐' }] : []),
    ];
    // Default to first available tab
    const validTab = tabs.find(t => t.id === tab) ? tab : (tabs[0]?.id || 'collect');
    if (validTab !== tab) setTimeout(() => setTab(validTab), 0);

    const pendingCount = studentFees.filter(sf => sf.status === 'pending').length;
    const partialCount = studentFees.filter(sf => sf.status === 'partial').length;
    const paidCount = studentFees.filter(sf => sf.status === 'paid').length;
    const totalCollected = studentFees.reduce((sum, sf) => sum + parseFloat(sf.paid_amount || 0), 0);
    const totalDue = studentFees.reduce((sum, sf) => sum + parseFloat(sf.due_amount || 0), 0);
    const totalDiscount = studentFees.reduce((sum, sf) => sum + parseFloat(sf.discount_amount || 0), 0);

    // Phase 9: Detect overdue fees (due date has passed and still pending/partial)
    const todayDate = new Date().toISOString().split('T')[0];
    const isOverdue = (sf) => {
        if (sf.status === 'paid') return false;
        const dueDate = sf.FeesStructure?.due_date;
        return dueDate && dueDate < todayDate;
    };
    const overdueCount = studentFees.filter(isOverdue).length;

    // Helper: calculate days until reminder
    const getDaysUntilReminder = (reminderDate) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const rem = new Date(reminderDate);
        rem.setHours(0, 0, 0, 0);
        return Math.ceil((rem - today) / (1000 * 60 * 60 * 24));
    };

    // Helper to check if a fee is within the reminder window (phased)
    const isReminderActive = (sf) => {
        if (!sf.reminder_date || sf.status === 'paid') return false;
        const daysLeft = getDaysUntilReminder(sf.reminder_date);
        // Show at exactly 8 days, exactly 4 days, 2 days or less (continuous), and on/past date
        return daysLeft === 8 || daysLeft === 4 || daysLeft <= 2;
    };
    
    // Get urgency level: 'red' = overdue/today, 'orange' = approaching
    const getReminderUrgency = (reminderDate) => {
        const daysLeft = getDaysUntilReminder(reminderDate);
        if (daysLeft <= 0) return 'red';   // On or past reminder date
        return 'orange';                    // 8, 4, or ≤2 days before
    };

    return (
        <div className="dashboard-container">
            {/* Header */}
            <div className="dashboard-header">
                <div>
                    <h1>💰 Fee Management</h1>
                    <p>Collect fees, view payment history{isAdmin ? ', and manage fee structures' : ''}.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <Link to="/admin/dashboard" className="btn btn-secondary">← Back</Link>
                    {tab === 'structure' && hasPerm('fees', 'create') && (
                        <button className="btn btn-primary" onClick={() => {
                            setEditingStructureId(null);
                            setStructureForm({ class_id: '', subject_id: '', fee_type: 'Tuition Fee', custom_fee_type: '', amount: '', due_date: '', description: '', student_target: 'all', individual_student_id: '' });
                            setShowStructureModal(true);
                        }}
                            style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none' }}>
                            + Add Fee Structure
                        </button>
                    )}
                </div>
            </div>

            {/* Success toast */}
            {success && (
                <div style={{
                    background: 'linear-gradient(135deg,rgba(16,185,129,0.15),rgba(16,185,129,0.05))',
                    border: '1px solid rgba(16,185,129,0.4)', borderRadius: '10px',
                    padding: '0.85rem 1.25rem', marginBottom: '1.25rem',
                    color: '#10b981', fontWeight: '600', fontSize: '0.95rem',
                    display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}>
                    {success}
                </div>
            )}

            {/* Phase 9: Overdue fees alert banner */}
            {overdueCount > 0 && (
                <div style={{
                    background: 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(239,68,68,0.05))',
                    border: '1.5px solid rgba(239,68,68,0.5)', borderRadius: '12px',
                    padding: '1rem 1.25rem', marginBottom: '1rem',
                    display: 'flex', alignItems: 'center', gap: '1rem'
                }}>
                    <span style={{ fontSize: '1.75rem' }}>🔔</span>
                    <div>
                        <div style={{ fontWeight: '800', color: '#ef4444', fontSize: '1rem' }}>
                            {overdueCount} Overdue Fee{overdueCount !== 1 ? 's' : ''} Need Attention!
                        </div>
                        <div style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                            These students have outstanding dues past the due date.
                        </div>
                    </div>
                </div>
            )}

            {/* Phase: Reminder Alerts (New Feature) */}
            {(() => {
                const reminders = studentFees.filter(isReminderActive);
                if (reminders.length === 0) return null;
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                        {reminders.map(rem => {
                            const urgency = getReminderUrgency(rem.reminder_date);
                            const daysLeft = getDaysUntilReminder(rem.reminder_date);
                            const isRed = urgency === 'red';
                            const borderColor = isRed ? 'rgba(239,68,68,0.5)' : 'rgba(245,158,11,0.5)';
                            const bgGradient = isRed
                                ? 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(239,68,68,0.05))'
                                : 'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(245,158,11,0.05))';
                            const textColor = isRed ? '#dc2626' : '#d97706';
                            const icon = isRed ? '🚨' : '⚠️';
                            const daysText = daysLeft > 0 
                                ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining` 
                                : daysLeft === 0 
                                    ? 'Due today!' 
                                    : `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''}`;
                            return (
                                <div key={`rem-${rem.id}`} style={{
                                    background: bgGradient,
                                    border: `1.5px solid ${borderColor}`, borderRadius: '12px',
                                    padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem'
                                }}>
                                    <span style={{ fontSize: '1.25rem' }}>{icon}</span>
                                    <div style={{ color: textColor, fontWeight: '600', fontSize: '0.95rem' }}>
                                        {rem.Student?.User?.name} has pending fees. Please collect before the reminder date: {new Date(rem.reminder_date).toLocaleDateString()}. <span style={{ fontWeight: 700, fontSize: '0.85rem', opacity: 0.85 }}>({daysText})</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            })()}

            {/* Summary stats */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div className="stat-card">
                    <div className="stat-icon">⏳</div>
                    <div className="stat-content">
                        <h3 style={{ color: '#ef4444' }}>{pendingCount}</h3>
                        <p>Pending</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">⚠️</div>
                    <div className="stat-content">
                        <h3 style={{ color: '#f59e0b' }}>{partialCount}</h3>
                        <p>Partial</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">✅</div>
                    <div className="stat-content">
                        <h3 style={{ color: '#10b981' }}>{paidCount}</h3>
                        <p>Fully Paid</p>
                    </div>
                </div>
                {(isAdmin || user.permissions?.includes('payment_history') || user.permissions?.includes('recent_payments')) && (
                    <>
                        <div className="stat-card">
                            <div className="stat-icon">💵</div>
                            <div className="stat-content">
                                <h3 style={{ color: '#6366f1' }}>₹{totalCollected.toLocaleString()}</h3>
                                <p>Total Collected</p>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon">🔔</div>
                            <div className="stat-content">
                                <h3 style={{ color: '#ef4444' }}>₹{totalDue.toLocaleString()}</h3>
                                <p>Total Dues</p>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon">🎉</div>
                            <div className="stat-content">
                                <h3 style={{ color: '#a855f7' }}>₹{totalDiscount.toLocaleString()}</h3>
                                <p>Total Discount Given</p>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Tabs */}
            {tabs.length > 1 && (
                <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '2px solid var(--border-color)', marginBottom: '1.5rem' }}>
                    {tabs.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)} style={{
                            padding: '0.65rem 1.25rem', border: 'none', background: 'none', cursor: 'pointer',
                            fontWeight: validTab === t.id ? '700' : '500', fontSize: '0.9rem',
                            color: validTab === t.id ? '#6366f1' : 'var(--text-secondary)',
                            borderBottom: validTab === t.id ? '3px solid #6366f1' : '3px solid transparent',
                            marginBottom: '-2px', transition: 'all 0.15s'
                        }}>
                            {t.label}
                        </button>
                    ))}
                </div>
            )}

            {/* ═══ COLLECT FEES TAB ═══ */}
            {validTab === 'collect' && (isAdmin || user.permissions?.includes('collect_fees')) && (
                <>
                    {/* Filters */}
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        <input
                            type="text" className="form-input" placeholder="🔍 Search student name or roll no."
                            value={search} onChange={e => setSearch(e.target.value)}
                            style={{ flex: '1', minWidth: '200px', maxWidth: '360px' }}
                        />
                        <select className="form-select" value={filterClass} onChange={e => setFilterClass(e.target.value)}
                            style={{ minWidth: '160px' }}>
                            <option value="">All Classes</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
                        </select>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {[['pending', '⏳ Pending', '#ef4444'], ['partial', '⚠️ Partial', '#f59e0b'], ['paid', '✅ Paid', '#10b981'], ['all', '👥 All', '#6366f1']].map(([val, lbl, col]) => (
                                <button
                                    key={val}
                                    onClick={() => setFilterStatus(val)}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: filterStatus === val ? '700' : '500',
                                        fontSize: '0.85rem',
                                        background: filterStatus === val ? `${col}22` : 'var(--card-bg)',
                                        color: filterStatus === val ? col : 'var(--text-secondary)',
                                        border: `1.5px solid ${filterStatus === val ? col : 'var(--border-color)'}`
                                    }}
                                >
                                    {lbl}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                        Showing <strong>{filteredFees.length}</strong> fee record{filteredFees.length !== 1 ? 's' : ''}
                    </div>

                    {/* Student fee rows */}
                    {filteredFees.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
                                {filterStatus === 'pending' ? '🎉' : '📭'}
                            </div>
                            <div style={{ fontWeight: '600' }}>
                                {filterStatus === 'pending' ? 'All fees paid!' : 'No records match.'}
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {filteredFees.map(sf => {
                                const stColor = sf.status === 'paid' ? '#10b981' : sf.status === 'partial' ? '#f59e0b' : '#ef4444';
                                const stBg = sf.status === 'paid' ? 'rgba(16,185,129,0.08)' : sf.status === 'partial' ? 'rgba(245,158,11,0.06)' : 'rgba(239,68,68,0.06)';

                                return (
                                    <div key={sf.id} style={{
                                        display: 'flex', alignItems: 'center', gap: '1rem',
                                        padding: '0.85rem 1.1rem', borderRadius: '12px',
                                        border: `1px solid ${sf.status === 'paid' ? 'rgba(16,185,129,0.3)' : sf.status === 'partial' ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                        background: stBg, transition: 'box-shadow 0.2s',
                                        flexWrap: 'wrap'
                                    }}>
                                        {/* Avatar */}
                                        <div style={{
                                            width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                                            background: sf.status === 'paid' ? 'linear-gradient(135deg,#10b981,#059669)' : sf.status === 'partial' ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#ef4444,#b91c1c)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: '#fff', fontWeight: '700', fontSize: '1rem'
                                        }}>
                                            {(sf.Student?.User?.name || 'S')[0].toUpperCase()}
                                        </div>

                                        {/* Info */}
                                        <div style={{ flex: 1, minWidth: '160px' }}>
                                            <div style={{ fontWeight: '700', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {sf.Student?.User?.name} ({sf.Student?.roll_number})
                                                {/* Phase 9: Overdue badge */}
                                                {isOverdue(sf) && (
                                                    <span style={{
                                                        padding: '2px 8px', borderRadius: '20px',
                                                        background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                                                        fontSize: '0.7rem', fontWeight: '800'
                                                    }}>🔔 OVERDUE</span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                                                <span className="badge badge-secondary">{sf.Class?.name} {sf.Class?.section}</span>
                                                <span className="badge badge-info">
                                                    {sf.FeesStructure?.fee_type || 'Fee'}
                                                    {sf.FeesStructure?.Subject ? ` • ${sf.FeesStructure.Subject.name}` : ''}
                                                </span>
                                                {sf.FeesStructure?.due_date && (
                                                    <span style={{ color: isOverdue(sf) ? '#ef4444' : 'var(--text-muted)', fontWeight: isOverdue(sf) ? 700 : 400 }}>
                                                        Due: {new Date(sf.FeesStructure.due_date).toLocaleDateString()}
                                                    </span>
                                                )}
                                                {sf.reminder_date && sf.status !== 'paid' && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ color: isReminderActive(sf) && sf.reminder_date <= todayDate ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>
                                                            🔔 Reminder: {new Date(sf.reminder_date).toLocaleDateString()}
                                                        </span>
                                                        <button
                                                            onClick={() => {
                                                                setEditingReminderFee(sf);
                                                                setReminderDateInput(sf.reminder_date || '');
                                                            }}
                                                            style={{
                                                                padding: '2px 8px', borderRadius: '4px', border: '1px solid #f59e0b',
                                                                background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontSize: '0.7rem',
                                                                cursor: 'pointer', fontWeight: 'bold'
                                                            }}
                                                        >
                                                            📝 Edit
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Financials details breakdown */}
                                        <div style={{ minWidth: '220px', display: 'flex', gap: '15px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                            <div>
                                                <div>Original: ₹{parseFloat(sf.original_amount).toLocaleString()}</div>
                                                <div style={{ color: '#a855f7' }}>Disc: ₹{parseFloat(sf.discount_amount).toLocaleString()}</div>
                                                <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Final: ₹{parseFloat(sf.final_amount).toLocaleString()}</div>
                                            </div>
                                            <div>
                                                <div style={{ color: '#10b981' }}>Paid: ₹{parseFloat(sf.paid_amount).toLocaleString()}</div>
                                                <div style={{ color: '#ef4444', fontWeight: '700' }}>Due: ₹{parseFloat(sf.due_amount).toLocaleString()}</div>
                                            </div>
                                        </div>

                                        {/* Action buttons */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                            <span style={{
                                                fontSize: '0.74rem', padding: '3px 10px', borderRadius: '20px', fontWeight: '700',
                                                background: sf.status === 'paid' ? 'rgba(16,185,129,0.15)' : sf.status === 'partial' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                                                color: stColor
                                            }}>
                                                {sf.status.toUpperCase()}
                                            </span>

                                            {sf.status !== 'paid' && hasPerm('fees', 'create') && (
                                                <>
                                                    <button
                                                        onClick={() => openDiscount(sf)}
                                                        style={{
                                                            padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.4)',
                                                            background: 'rgba(168, 85, 247, 0.05)', color: '#a855f7', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer'
                                                        }}
                                                    >
                                                        🎉 Discount
                                                    </button>
                                                    <button
                                                        onClick={() => openCollect(sf)}
                                                        style={{
                                                            padding: '6px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                                            background: 'linear-gradient(135deg,#10b981,#059669)',
                                                            color: '#fff', fontWeight: '700', fontSize: '0.82rem',
                                                            boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
                                                        }}
                                                    >
                                                        💵 Collect
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* ═══ PAYMENT HISTORY TAB ═══ */}
            {validTab === 'history' && (isAdmin || user.permissions?.includes('payment_history') || user.permissions?.includes('recent_payments')) && (
                <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>
                    <div className="card">
                        <h3 style={{ marginBottom: '1rem' }}>💵 Payment Logs</h3>
                        <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                            <table className="table mobile-keep">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Student</th>
                                        <th>Amount</th>
                                        <th>Method</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.length === 0 ? (
                                        <tr><td colSpan="5" className="text-center">No payment records found</td></tr>
                                    ) : payments.map(p => (
                                        <tr key={p.id}>
                                            <td>{new Date(p.payment_date).toLocaleDateString()}</td>
                                            <td>{p.Student?.User?.name} <small>({p.Student?.roll_number})</small></td>
                                            <td style={{ color: '#10b981', fontWeight: '700' }}>+₹{parseFloat(p.amount_paid).toLocaleString()}</td>
                                            <td style={{ textTransform: 'capitalize' }}>{p.payment_method}</td>
                                            <td><span className={`badge badge-${p.status === 'success' ? 'success' : 'warning'}`}>{p.status}</span></td>
                                            <td>
                                                {p.status === 'success' && (
                                                    <button 
                                                        onClick={() => setViewingReceipt(p)}
                                                        className="btn btn-sm btn-secondary"
                                                        style={{ backgroundColor: "#4f46e5", color: "white", padding: "4px 8px", fontSize: "0.75rem", border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}
                                                    >
                                                        🧾 Receipt
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="card">
                        <h3 style={{ marginBottom: '1rem' }}>🎉 Discount Logs</h3>
                        <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                            <table className="table mobile-keep">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Student</th>
                                        <th>Discount</th>
                                        <th>Reason/Approver</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {discountLogs.length === 0 ? (
                                        <tr><td colSpan="4" className="text-center">No discounts issued</td></tr>
                                    ) : discountLogs.map(dl => (
                                        <tr key={dl.id}>
                                            <td>{new Date(dl.createdAt).toLocaleDateString()}</td>
                                            <td>{dl.StudentFee?.Student?.User?.name}</td>
                                            <td style={{ color: '#a855f7', fontWeight: '700' }}>-₹{parseFloat(dl.discount_amount).toLocaleString()}</td>
                                            <td>
                                                <small><b>{dl.reason}</b><br />by {dl.approver?.name}</small>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ FEE STRUCTURES TAB ═══ */}
            {validTab === 'structure' && hasPerm('fees', 'read') && (
                <div className="card">
                    <div className="table-container">
                        <table className="table mobile-keep">
                            <thead>
                                <tr>
                                    <th>Class & Subject</th>
                                    <th>Fee Type</th>
                                    <th>Amount</th>
                                    <th>Due Date</th>
                                    <th>Description</th>
                                    {(hasPerm('fees', 'update') || hasPerm('fees', 'delete')) && <th style={{ textAlign: 'right' }}>Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {feeStructures.length === 0 ? (
                                    <tr><td colSpan={(hasPerm('fees', 'update') || hasPerm('fees', 'delete')) ? 6 : 5} className="text-center">No fee structures defined</td></tr>
                                ) : feeStructures.map(fs => (
                                    <tr key={fs.id}>
                                        <td>
                                            {fs.Class?.name} {fs.Class?.section}<br />
                                            <small style={{ color: '#6b7280' }}>
                                                {fs.Subject ? fs.Subject.name : 'All Subjects (Full Class)'}
                                            </small>
                                        </td>
                                        <td><span className="badge badge-info">{fs.fee_type}</span></td>
                                        <td>₹{parseFloat(fs.amount).toLocaleString()}</td>
                                        <td>{new Date(fs.due_date).toLocaleDateString()}</td>
                                        <td>{fs.description || '—'}</td>
                                        {(hasPerm('fees', 'update') || hasPerm('fees', 'delete')) && (
                                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                {hasPerm('fees', 'update') && (
                                                    <button onClick={() => handleEditStructure(fs)} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem', marginRight: '6px' }}>
                                                        ✏️ Edit
                                                    </button>
                                                )}
                                                {hasPerm('fees', 'delete') && (
                                                    <button onClick={() => handleDeleteStructure(fs.id)} className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                                                        🗑️ Delete
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ═══ COLLECT MODAL ═══ */}
            {collectingStudent && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '460px', width: '95%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                            <div style={{
                                width: '52px', height: '52px', borderRadius: '50%',
                                background: 'linear-gradient(135deg,#10b981,#059669)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#fff', fontWeight: '800', fontSize: '1.2rem', flexShrink: 0
                            }}>
                                {(collectingStudent.Student?.User?.name || 'S')[0].toUpperCase()}
                            </div>
                            <div>
                                <h2 style={{ margin: 0 }}>Collect Fee</h2>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    {collectingStudent.Student?.User?.name} · Roll {collectingStudent.Student?.roll_number}
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleCollect}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Amount (₹) *</label>
                                    <input
                                        type="number" className="form-input" placeholder="e.g. 5000"
                                        value={payForm.amount} min="1" step="0.01" required
                                        onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                                        autoFocus
                                        style={{ fontWeight: '700', fontSize: '1.1rem' }}
                                    />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Payment Date *</label>
                                    <input
                                        type="date" className="form-input" value={payForm.payment_date} required
                                        onChange={e => setPayForm({ ...payForm, payment_date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Payment Method</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {[['cash', '💵 Cash'], ['online', '📱 Online (UPI)'], ['cheque', '🏦 Cheque']].map(([val, lbl]) => (
                                        <button key={val} type="button"
                                            onClick={() => setPayForm({ ...payForm, payment_method: val })}
                                            style={{
                                                flex: 1, padding: '8px 4px', borderRadius: '8px', cursor: 'pointer',
                                                fontSize: '0.8rem', fontWeight: '600',
                                                border: `1.5px solid ${payForm.payment_method === val ? '#6366f1' : 'var(--border-color)'}`,
                                                background: payForm.payment_method === val ? 'rgba(99,102,241,0.1)' : 'transparent',
                                                color: payForm.payment_method === val ? '#6366f1' : 'var(--text-secondary)'
                                            }}>
                                            {lbl}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {payForm.payment_method !== 'cash' && (
                                <div className="form-group">
                                    <label className="form-label">Transaction / Reference ID</label>
                                    <input type="text" className="form-input"
                                        value={payForm.transaction_id} placeholder="UTR / Cheque No."
                                        onChange={e => setPayForm({ ...payForm, transaction_id: e.target.value })} />
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Remarks (Optional)</label>
                                    <input type="text" className="form-input"
                                        value={payForm.remarks} placeholder="e.g. Q1 tuition fee"
                                        onChange={e => setPayForm({ ...payForm, remarks: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label" style={{ color: '#f59e0b' }}>🔔 Reminder Date</label>
                                    <input type="date" className="form-input"
                                        value={payForm.reminder_date}
                                        onChange={e => setPayForm({ ...payForm, reminder_date: e.target.value })}
                                        style={{ border: '1.5px solid rgba(245,158,11,0.3)' }} />
                                </div>
                            </div>

                            {payError && (
                                <div style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '0.6rem', borderRadius: '8px', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                                    ⚠️ {payError}
                                </div>
                            )}

                            {/* Amount preview */}
                            <div style={{
                                background: 'linear-gradient(135deg,rgba(16,185,129,0.1),rgba(16,185,129,0.05))',
                                border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px',
                                padding: '0.75rem 1rem', marginBottom: '1rem',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Paying {collectingStudent.Student?.User?.name} Due:</span>
                                <span style={{ fontWeight: '800', color: '#10b981', fontSize: '1.3rem' }}>
                                    ₹{parseFloat(collectingStudent.due_amount).toLocaleString()}
                                </span>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary"
                                    onClick={() => setCollectingStudent(null)} disabled={collecting}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={collecting} style={{
                                    padding: '0.65rem 1.5rem', borderRadius: '10px', border: 'none',
                                    background: 'linear-gradient(135deg,#10b981,#059669)',
                                    color: '#fff', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer'
                                }}>
                                    {collecting ? 'Processing…' : '✅ Confirm Collection'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══ DISCOUNT MODAL ═══ */}
            {discountingFee && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '460px', width: '95%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                            <div style={{
                                width: '52px', height: '52px', borderRadius: '50%',
                                background: 'linear-gradient(135deg,#a855f7,#7c3aed)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#fff', fontWeight: '800', fontSize: '1.2rem', flexShrink: 0
                            }}>
                                🎉
                            </div>
                            <div>
                                <h2 style={{ margin: 0 }}>Give Discount</h2>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    {discountingFee.Student?.User?.name} · Fee: ₹{parseFloat(discountingFee.original_amount).toLocaleString()}
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleDiscount}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Discount (%)</label>
                                    <div style={{ position: 'relative' }}>
                                        <input type="number" className="form-input" min="0" max="100" step="0.01"
                                            value={discountForm.percentage} placeholder="e.g. 10"
                                            style={{ paddingRight: '2rem', fontWeight: '700', fontSize: '1.1rem' }}
                                            onChange={e => {
                                                const pct = e.target.value;
                                                const orig = parseFloat(discountingFee.original_amount) || 0;
                                                const amt = pct ? ((orig * parseFloat(pct)) / 100).toFixed(2) : '';
                                                setDiscountForm({ ...discountForm, percentage: pct, amount: amt });
                                            }} autoFocus />
                                        <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontWeight: '600' }}>%</span>
                                    </div>
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Amount (₹) *</label>
                                    <input type="number" className="form-input" required min="1" max={discountingFee.due_amount} step="0.01"
                                        value={discountForm.amount} placeholder="e.g. 500"
                                        style={{ fontWeight: '700', fontSize: '1.1rem' }}
                                        onChange={e => {
                                            const amt = e.target.value;
                                            const orig = parseFloat(discountingFee.original_amount) || 0;
                                            const pct = (orig > 0 && amt) ? ((parseFloat(amt) / orig) * 100).toFixed(2) : '';
                                            setDiscountForm({ ...discountForm, amount: amt, percentage: pct });
                                        }} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Reason for Discount *</label>
                                <select className="form-select" required value={discountForm.reason} onChange={e => setDiscountForm({ ...discountForm, reason: e.target.value })}>
                                    <option value="">Select Reason...</option>
                                    <option>Scholarship</option>
                                    <option>Special Case</option>
                                    <option>Manual Adjustment</option>
                                    <option>Sibling Discount</option>
                                </select>
                            </div>

                            {/* Amount preview */}
                            <div style={{
                                background: 'linear-gradient(135deg,rgba(168,85,247,0.1),rgba(168,85,247,0.05))',
                                border: '1px solid rgba(168,85,247,0.3)', borderRadius: '10px',
                                padding: '0.75rem 1rem', marginBottom: '1rem',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>New Final Fee:</span>
                                <span style={{ fontWeight: '800', color: '#a855f7', fontSize: '1.3rem' }}>
                                    ₹{Math.max(0, parseFloat(discountingFee.original_amount) - (parseFloat(discountForm.amount) || 0)).toLocaleString()}
                                </span>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setDiscountingFee(null)}>
                                    Cancel
                                </button>
                                <button type="submit" style={{
                                    padding: '0.65rem 1.5rem', borderRadius: '10px', border: 'none',
                                    background: 'linear-gradient(135deg,#a855f7,#7c3aed)',
                                    color: '#fff', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer'
                                }}>
                                    🎉 Apply Discount
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══ STRUCTURE MODAL ═══ */}
            {showStructureModal && (hasPerm('fees', 'create') || hasPerm('fees', 'update')) && (
                <div className="modal-overlay" style={{ zIndex: 1050, overflowY: 'auto', padding: '2rem 1rem', display: 'flex', alignItems: 'flex-start' }}>
                    <div className="modal-content" style={{ maxWidth: '520px', width: '95%', margin: '0 auto' }}>
                        <h2 style={{ marginBottom: '1.25rem' }}>{editingStructureId ? '✏️ Edit Fee Structure' : '📐 Add Fee Structure'}</h2>
                        <form onSubmit={handleStructureSubmit}>
                            {/* Class */}
                            <div className="form-group">
                                <label className="form-label">Class *</label>
                                <select className="form-select" value={structureForm.class_id} required
                                    onChange={e => {
                                        setStructureForm({ ...structureForm, class_id: e.target.value, subject_id: '', individual_student_id: '' });
                                        fetchSubjectsForClass(e.target.value);
                                    }}>
                                    <option value="">Select Class</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? ` - ${c.section}` : ''}</option>)}
                                </select>
                            </div>

                            {/* Subject (only shown after class is selected) */}
                            <div className="form-group">
                                <label className="form-label">Subject (Optional)</label>
                                {structureForm.student_target === 'individual' ? (
                                    <input type="text" className="form-input" value="None (Not applicable for individual student)" disabled style={{ backgroundColor: 'var(--gray-200)', color: 'var(--gray-500)', opacity: 0.7 }} title="Subject is automatically removed when applying fees to an individual." />
                                ) : (
                                    <>
                                        <select
                                            className="form-select"
                                            value={structureForm.subject_id}
                                            disabled={!structureForm.class_id}
                                            onChange={e => setStructureForm({ ...structureForm, subject_id: e.target.value })}>
                                            <option value="">All Subjects (Full Class)</option>
                                            {availableSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                        {structureForm.class_id && availableSubjects.length === 0 && (
                                            <small style={{ color: '#f59e0b', marginTop: '4px', display: 'block' }}>No subjects found for this class.</small>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Student Target */}
                            <div className="form-group">
                                <label className="form-label">Apply To</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {[['all', '👥 All Students'], ['individual', '👤 Individual Student']].map(([val, lbl]) => (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => setStructureForm({ ...structureForm, student_target: val, individual_student_id: '' })}
                                            style={{
                                                flex: 1, padding: '8px 6px', borderRadius: '8px', cursor: 'pointer',
                                                fontSize: '0.82rem', fontWeight: '600',
                                                border: `1.5px solid ${structureForm.student_target === val ? '#6366f1' : 'var(--border-color)'}`,
                                                background: structureForm.student_target === val ? 'rgba(99,102,241,0.1)' : 'transparent',
                                                color: structureForm.student_target === val ? '#6366f1' : 'var(--text-secondary)'
                                            }}
                                        >{lbl}</button>
                                    ))}
                                </div>
                            </div>

                            {/* Individual Student dropdown (conditional) */}
                            {structureForm.student_target === 'individual' && (
                                <div className="form-group">
                                    <label className="form-label">Select Student *</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <input 
                                            type="text" 
                                            className="form-input" 
                                            placeholder="🔍 Search by name or roll number..." 
                                            onChange={e => {
                                                const val = e.target.value.toLowerCase();
                                                const selects = document.querySelectorAll('.student-option-item');
                                                selects.forEach(opt => {
                                                    const text = opt.innerText.toLowerCase();
                                                    if (text.includes(val)) opt.style.display = 'block';
                                                    else opt.style.display = 'none';
                                                });
                                            }}
                                        />
                                        <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--gray-300)', borderRadius: '8px', background: 'var(--card-bg, transparent)' }}>
                                            {allStudentsForClass.length === 0 ? (
                                                <div style={{ padding: '10px', color: '#f59e0b', fontSize: '0.9rem' }}>No students found in this class.</div>
                                            ) : (
                                                allStudentsForClass.map(s => (
                                                    <div 
                                                        key={s.id} 
                                                        className="student-option-item"
                                                        onClick={() => setStructureForm({ ...structureForm, individual_student_id: s.id })}
                                                        style={{
                                                            padding: '8px 12px',
                                                            cursor: 'pointer',
                                                            background: structureForm.individual_student_id === s.id ? 'rgba(99,102,241,0.1)' : 'transparent',
                                                            borderBottom: '1px solid var(--gray-200)',
                                                            fontWeight: structureForm.individual_student_id === s.id ? 'bold' : 'normal',
                                                            color: structureForm.individual_student_id === s.id ? '#6366f1' : 'inherit',
                                                            fontSize: '0.9rem'
                                                        }}
                                                    >
                                                        {structureForm.individual_student_id === s.id && <span style={{ marginRight: '8px' }}>✅</span>}
                                                        {s.User?.name || s.name} {s.roll_number ? `(Roll: ${s.roll_number})` : ''}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                    <select style={{ display: 'none' }} required value={structureForm.individual_student_id} onChange={() => {}}>
                                        <option value="">Required</option>
                                        <option value={structureForm.individual_student_id}>{structureForm.individual_student_id}</option>
                                    </select>
                                </div>
                            )}

                            {/* Fee Type */}
                            <div className="form-group">
                                <label className="form-label">Fee Type</label>
                                <select className="form-select" value={structureForm.fee_type}
                                    onChange={e => setStructureForm({ ...structureForm, fee_type: e.target.value })}>
                                    {['Tuition Fee', 'Exam Fee', 'Transport Fee', 'Library Fee', 'Other'].map(t => <option key={t}>{t}</option>)}
                                </select>
                            </div>
                            
                            {structureForm.fee_type === 'Other' && (
                                <div className="form-group">
                                    <label className="form-label">Custom Fee Type Name *</label>
                                    <input type="text" className="form-input" required value={structureForm.custom_fee_type}
                                        placeholder="e.g. Dance Fee, Sports Fee"
                                        onChange={e => setStructureForm({ ...structureForm, custom_fee_type: e.target.value })} />
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Amount (₹) *</label>
                                    <input type="number" className="form-input" required min="1" value={structureForm.amount}
                                        onChange={e => setStructureForm({ ...structureForm, amount: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Due Date *</label>
                                    <input type="date" className="form-input" required value={structureForm.due_date}
                                        onChange={e => setStructureForm({ ...structureForm, due_date: e.target.value })} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea className="form-input" rows="2" value={structureForm.description}
                                    onChange={e => setStructureForm({ ...structureForm, description: e.target.value })} />
                            </div>

                            {/* Info hint */}
                            <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '8px', padding: '0.65rem 1rem', marginBottom: '1rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                {structureForm.student_target === 'all'
                                    ? '👥 This fee structure will be automatically assigned to all students in the selected class.'
                                    : '👤 This fee structure will be assigned only to the selected student.'}
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => { setShowStructureModal(false); setStructureForm({ class_id: '', subject_id: '', fee_type: 'Tuition Fee', custom_fee_type: '', amount: '', due_date: '', description: '', student_target: 'all', individual_student_id: '' }); setEditingStructureId(null); }}>Cancel</button>
                                <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none' }}>
                                    {editingStructureId ? 'Save Changes' : 'Create Structure'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* ═══ EDIT REMINDER MODAL ═══ */}
            {editingReminderFee && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '400px', width: '95%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '50%',
                                background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#fff', fontSize: '1.2rem', flexShrink: 0
                            }}>
                                🔔
                            </div>
                            <div>
                                <h3 style={{ margin: 0 }}>Update Reminder Date</h3>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    {editingReminderFee.Student?.User?.name}
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleUpdateReminder}>
                            <div className="form-group">
                                <label className="form-label">New Reminder Date</label>
                                <input
                                    type="date" className="form-input" required
                                    value={reminderDateInput}
                                    onChange={e => setReminderDateInput(e.target.value)}
                                />
                                <small style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                                    This date will be used to alert the parent and admin.
                                </small>
                            </div>

                            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setEditingReminderFee(null)}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={updatingRem} className="btn btn-primary" style={{ background: '#f59e0b', border: 'none' }}>
                                    {updatingRem ? 'Updating...' : '💾 Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══ RECEIPT MODAL ═══ */}
            {(() => {
                if (!viewingReceipt) return null;

                let receiptLogoUrl = user?.Institute?.logo;
                if (receiptLogoUrl && receiptLogoUrl.startsWith('/')) {
                    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
                    const backendBase = apiUrl.replace(/\/api\/?$/, "");
                    receiptLogoUrl = `${backendBase}${receiptLogoUrl}`;
                }

                return (
                    <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', position: 'fixed', inset: 0 }}>
                        <div className="modal-content" style={{ maxWidth: '850px', width: '100%', padding: 0, overflow: 'hidden', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                            <h3 style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '1.25rem' }}>📄</span> Receipt Preview
                            </h3>
                            <button onClick={() => setViewingReceipt(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b', transition: 'color 0.2s' }} onMouseOver={e => e.target.style.color = '#ef4444'} onMouseOut={e => e.target.style.color = '#64748b'}>×</button>
                        </div>
                        
                        <div style={{ overflowY: 'auto', flex: 1, padding: '2rem', background: '#e2e8f0' }}>
                            {/* Printable Area Container */}
                            <div id="printable-receipt" style={{ padding: '3rem', background: '#ffffff', color: '#0f172a', fontFamily: "'Inter', sans-serif", borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
                                
                                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                                    {receiptLogoUrl ? (
                                        <img src={receiptLogoUrl} alt="Institute Logo" style={{ width: '90px', height: '90px', margin: '0 auto 1rem', borderRadius: '50%', objectFit: 'contain', display: 'block', border: '2px solid #e2e8f0', background: '#fff' }} />
                                    ) : (
                                        <div style={{ width: '90px', height: '90px', margin: '0 auto 1rem', background: '#f8fafc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #e2e8f0' }}>
                                            <span style={{ fontSize: '3rem' }}>🏫</span>
                                        </div>
                                    )}
                                    <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: '800', letterSpacing: '0.05em', color: '#0f172a', textTransform: 'uppercase' }}>
                                        {user?.Institute?.name || "Excel Public School"}
                                    </h1>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #cbd5e1', paddingBottom: '2rem', marginBottom: '2rem' }}>
                                    <div style={{ flex: 1, fontSize: '1rem', color: '#334155', lineHeight: '1.7' }}>
                                        <p style={{ margin: 0 }}><strong>Address:</strong> {user?.Institute?.address || "123 Education Lane"}{user?.Institute?.city ? `, ${user.Institute.city}` : ''}{user?.Institute?.zip_code ? ` - ${user.Institute.zip_code}` : ''}</p>
                                        <p style={{ margin: 0 }}><strong>Phone No:</strong> {user?.Institute?.phone || "+91 98765 43210"}</p>
                                        <p style={{ margin: 0 }}><strong>Email Id:</strong> {user?.Institute?.email || "info@excelpublicschool.edu"}</p>
                                    </div>
                                    <div style={{ flex: 1, textAlign: 'right', fontSize: '1.1rem', fontWeight: '600', color: '#0f172a', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-end' }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem' }}>
                                                <span style={{ paddingBottom: '2px' }}>Date:</span>
                                                <span style={{ display: 'inline-block', width: '180px', borderBottom: '1.5px solid #0f172a' }}></span>
                                            </div>
                                    </div>
                                </div>

                                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                                    <span style={{ display: 'inline-block', padding: '0.5rem 2rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '20px', fontSize: '1.4rem', fontWeight: '700', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                        Fee Receipt
                                    </span>
                                </div>

                                <div style={{ marginBottom: '2.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', background: '#f8fafc', padding: '2rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                    <div>
                                        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Transaction ID</p>
                                        <p style={{ margin: 0, fontWeight: '700', fontSize: '1.15rem', color: '#0f172a' }}>{viewingReceipt.transaction_id}</p>
                                    </div>
                                    <div>
                                        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Receipt Date</p>
                                        <p style={{ margin: 0, fontWeight: '700', fontSize: '1.15rem', color: '#0f172a' }}>{new Date(viewingReceipt.payment_date).toLocaleDateString('en-GB')}</p>
                                    </div>
                                    <div>
                                        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Student Name</p>
                                        <p style={{ margin: 0, fontWeight: '700', fontSize: '1.15rem', color: '#0f172a' }}>{viewingReceipt.Student?.User?.name}</p>
                                    </div>
                                    <div>
                                        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Roll Number</p>
                                        <p style={{ margin: 0, fontWeight: '700', fontSize: '1.15rem', color: '#0f172a' }}>{viewingReceipt.Student?.roll_number}</p>
                                    </div>
                                </div>

                                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '3rem' }}>
                                    <thead>
                                        <tr style={{ background: '#f1f5f9' }}>
                                            <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: '700', fontSize: '1.05rem' }}>Description</th>
                                            <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: '700', fontSize: '1.05rem' }}>Payment Mode</th>
                                            <th style={{ padding: '1rem', textAlign: 'right', borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: '700', fontSize: '1.05rem' }}>Amount Paid</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td style={{ padding: '1.25rem 1rem', borderBottom: '1px solid #e2e8f0', color: '#0f172a', fontWeight: '600', fontSize: '1.1rem' }}>Academic Fee Collection</td>
                                            <td style={{ padding: '1.25rem 1rem', borderBottom: '1px solid #e2e8f0', textAlign: 'center', color: '#334155', textTransform: 'capitalize', fontWeight: '500', fontSize: '1.1rem' }}>{viewingReceipt.payment_method}</td>
                                            <td style={{ padding: '1.25rem 1rem', borderBottom: '1px solid #e2e8f0', textAlign: 'right', color: '#10b981', fontWeight: '800', fontSize: '1.3rem' }}>₹{parseFloat(viewingReceipt.amount_paid).toLocaleString()}</td>
                                        </tr>
                                    </tbody>
                                </table>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '4rem', paddingTop: '2rem', borderTop: '2px dashed #e2e8f0' }}>
                                    <div style={{ fontStyle: 'italic', color: '#64748b', fontSize: '0.95rem' }}>
                                        <p style={{ margin: '0 0 0.25rem 0' }}>* This is a computer-generated receipt.</p>
                                        <p style={{ margin: 0 }}>* No physical signature is required.</p>
                                    </div>
                                    <div style={{ textAlign: 'center', paddingRight: '1rem' }}>
                                        <div style={{ borderBottom: '1.5px solid #0f172a', width: '220px', marginBottom: '0.75rem' }}></div>
                                        <span style={{ color: '#0f172a', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.9rem' }}>Authorized Signatory</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '1.25rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button onClick={() => setViewingReceipt(null)} className="btn btn-secondary" style={{ padding: '0.75rem 1.5rem', fontWeight: '600', background: '#fff', border: '1px solid #cbd5e1' }}>Close</button>
                            <button 
                                onClick={() => {
                                    const printWindow = window.open('', '_blank', 'width=900,height=900');
                                    const printContents = document.getElementById('printable-receipt').innerHTML;
                                    printWindow.document.write(`
                                        <html>
                                        <head>
                                            <title>Receipt_${viewingReceipt.transaction_id}</title>
                                            <style>
                                                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                                                body { font-family: 'Inter', sans-serif; margin: 0; padding: 40px; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff; }
                                                * { box-sizing: border-box; }
                                                @media print {
                                                    body { padding: 0; }
                                                    @page { margin: 1.5cm; }
                                                }
                                            </style>
                                        </head>
                                        <body onload="window.print(); setTimeout(() => window.close(), 500);">
                                            ${printContents}
                                        </body>
                                        </html>
                                    `);
                                    printWindow.document.close();
                                }} 
                                className="btn btn-primary" 
                                style={{ background: 'linear-gradient(135deg, #4f46e5, #3b82f6)', color: 'white', border: 'none', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)' }}
                                onMouseOver={e => e.target.style.boxShadow = '0 10px 15px -3px rgba(79, 70, 229, 0.3)'}
                                onMouseOut={e => e.target.style.boxShadow = '0 4px 6px -1px rgba(79, 70, 229, 0.2)'}
                            >
                                <span style={{ fontSize: '1.2rem' }}>🖨️</span> Print Receipt
                            </button>
                        </div>
                    </div>
                </div>
            );
        })()}
        </div>
    );
}

export default Fees;
