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
import "./Students.css";

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
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [success, setSuccess] = useState('');
    const [showMoreFilters, setShowMoreFilters] = useState(false);
    const [filterFeeType, setFilterFeeType] = useState('');
    const [filterAssigned, setFilterAssigned] = useState('all');
    const [historySearch, setHistorySearch] = useState('');
    const [historyClass, setHistoryClass] = useState('');
    const [historyMethod, setHistoryMethod] = useState('');
    const [historyStartDate, setHistoryStartDate] = useState('');
    const [historyEndDate, setHistoryEndDate] = useState('');
    const [historySort, setHistorySort] = useState('latest');
    const [historyDense, setHistoryDense] = useState(false);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyItemsPerPage, setHistoryItemsPerPage] = useState(10);
    const [structureSearch, setStructureSearch] = useState('');
    const [structureClass, setStructureClass] = useState('');
    const [structureFeeType, setStructureFeeType] = useState('');
    const [structureStatus, setStructureStatus] = useState('');
    const [structurePage, setStructurePage] = useState(1);
    const [structureItemsPerPage, setStructureItemsPerPage] = useState(10);

    const exportToCSV = () => {
        if (filteredFees.length === 0) {
            alert('No data to export');
            return;
        }

        const headers = ['Student Name', 'Roll No', 'Class', 'Fee Type', 'Due Date', 'Final Amount', 'Paid Amount', 'Due Amount', 'Status'];
        const csvRows = [headers.join(',')];

        filteredFees.forEach(sf => {
            const row = [
                `"${sf.Student?.User?.name || ''}"`,
                `"${sf.Student?.roll_number || ''}"`,
                `"${sf.Class?.name || ''} ${sf.Class?.section || ''}"`,
                `"${sf.FeesStructure?.fee_type || 'Fee'}"`,
                `"${sf.FeesStructure?.due_date ? new Date(sf.FeesStructure.due_date).toLocaleDateString() : ''}"`,
                sf.final_amount,
                sf.paid_amount,
                sf.due_amount,
                sf.status
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Fee_Report_${TODAY}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

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
        student_target: 'all', individual_student_ids: []
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
                api.get('/fees/payments?limit=1000'),
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
            api.get('/fees/payments?limit=1000'),
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
        const isAssigned = !String(sf.id).startsWith('dummy_');
        const matchAssigned = filterAssigned === 'all' ? true : (filterAssigned === 'assigned' ? isAssigned : !isAssigned);
        const matchFeeType = !filterFeeType || sf.FeesStructure?.fee_type === filterFeeType;
        return matchSearch && matchClass && matchStatus && matchAssigned && matchFeeType;
    });

    const totalPages = Math.ceil(filteredFees.length / itemsPerPage) || 1;
    const paginatedFees = filteredFees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const filteredPayments = payments.filter(p => {
        const name = p.Student?.User?.name?.toLowerCase() || '';
        const roll = p.Student?.roll_number?.toLowerCase() || '';
        const matchSearch = !historySearch || name.includes(historySearch.toLowerCase()) || roll.includes(historySearch.toLowerCase());
        const matchClass = !historyClass || String(p.Student?.class_id) === String(historyClass);
        const matchMethod = !historyMethod || p.payment_method === historyMethod;

        let matchDate = true;
        const pDate = new Date(p.payment_date);
        pDate.setHours(0, 0, 0, 0); // Normalize to start of day for comparison
        if (historyStartDate) {
            const sDate = new Date(historyStartDate);
            sDate.setHours(0, 0, 0, 0);
            if (pDate < sDate) matchDate = false;
        }
        if (historyEndDate) {
            const eDate = new Date(historyEndDate);
            eDate.setHours(0, 0, 0, 0);
            if (pDate > eDate) matchDate = false;
        }

        return matchSearch && matchClass && matchMethod && matchDate;
    }).sort((a, b) => {
        if (historySort === 'latest') return new Date(b.payment_date) - new Date(a.payment_date);
        if (historySort === 'oldest') return new Date(a.payment_date) - new Date(b.payment_date);
        if (historySort === 'highest') return parseFloat(b.amount_paid) - parseFloat(a.amount_paid);
        return 0;
    });

    const historyTotalPages = Math.ceil(filteredPayments.length / historyItemsPerPage) || 1;
    const paginatedPayments = filteredPayments.slice((historyPage - 1) * historyItemsPerPage, historyPage * historyItemsPerPage);

    const filteredStructures = feeStructures.filter(fs => {
        const name = (fs.Subject?.name || '').toLowerCase();
        const className = (fs.Class?.name || '').toLowerCase();
        const section = (fs.Class?.section || '').toLowerCase();
        const searchTerms = `${className} ${section} ${name}`.trim();
        const matchSearch = !structureSearch || searchTerms.includes(structureSearch.toLowerCase());
        const matchClass = !structureClass || String(fs.class_id) === String(structureClass);
        const matchFeeType = !structureFeeType || fs.fee_type === structureFeeType;
        const matchStatus = !structureStatus || (structureStatus === 'active' ? true : false);
        return matchSearch && matchClass && matchFeeType && matchStatus;
    });

    const structureTotalPages = Math.ceil(filteredStructures.length / structureItemsPerPage) || 1;
    const paginatedStructures = filteredStructures.slice((structurePage - 1) * structureItemsPerPage, structurePage * structureItemsPerPage);
    const uniqueFeeTypes = [...new Set(feeStructures.map(fs => fs.fee_type))];

    useEffect(() => {
        setCurrentPage(1);
    }, [search, filterClass, filterStatus, filterAssigned, filterFeeType]);

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
            setStructureForm({ class_id: '', subject_id: '', fee_type: 'Tuition Fee', custom_fee_type: '', amount: '', due_date: '', description: '', student_target: 'all', individual_student_ids: [] });
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
            individual_student_ids: fs.individual_student_id ? [fs.individual_student_id] : []
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

    if (loading) return <div className="students-container"><div className="dashboard-loading">Loading fees...</div></div>;

    const tabs = [
        ...(isAdmin || user.permissions?.includes('collect_fees') || hasPerm('fees', 'create') || hasPerm('fees', 'read') ? [{ id: 'collect', label: '💰 Collect Fees', icon: '💰' }] : []),
        ...(isAdmin || user.permissions?.includes('payment_history') || user.permissions?.includes('recent_payments') ? [{ id: 'history', label: '📋 Payment History', icon: '📋' }] : []),
        ...((isAdmin || hasPerm('fees', 'read') || user.permissions?.includes('collect_fees')) && (isAdmin || !user.permissions?.includes('fees.hide')) ? [{ id: 'structure', label: '📐 Fee Structures', icon: '📐' }] : []),
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
        <div className="students-container">
            {/* Header */}
            <div className="st-header">
                <div className="st-header-top-row">
                    <div className="st-header-left">
                        <h1>Fee Management</h1>
                        <p>Collect fees, view payment history{isAdmin ? ', and manage fee structures' : ''}.</p>
                    </div>
                </div>

                <div className="st-header-bottom-row">
                    <div className="st-breadcrumbs">
                        <span>Dashboard</span>
                        <span>›</span>
                        <span className="active">Fee Management</span>
                    </div>
                    <div className="st-header-actions">
                        {(isAdmin || hasPerm('fees', 'read')) && (
                            <button className="st-btn st-btn-outline" onClick={() => setTab('structure')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                📐 Fee Structures
                            </button>
                        )}
                        <button className="st-btn st-btn-primary" onClick={exportToCSV} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            📥 Export Report
                        </button>
                    </div>
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
            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div className="stat-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ background: '#f3e8ff', color: '#7e22ce', borderRadius: '12px', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>⏳</div>
                        <div>
                            <h3 style={{ color: '#111827', margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>{pendingCount}</h3>
                            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem', fontWeight: '500' }}>Pending</p>
                        </div>
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '1.5rem' }}>›</div>
                </div>
                <div className="stat-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ background: '#fef3c7', color: '#d97706', borderRadius: '12px', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>⚠️</div>
                        <div>
                            <h3 style={{ color: '#111827', margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>{partialCount}</h3>
                            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem', fontWeight: '500' }}>Partial</p>
                        </div>
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '1.5rem' }}>›</div>
                </div>
                <div className="stat-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ background: '#d1fae5', color: '#059669', borderRadius: '12px', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>✅</div>
                        <div>
                            <h3 style={{ color: '#111827', margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>{paidCount}</h3>
                            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem', fontWeight: '500' }}>Fully Paid</p>
                        </div>
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '1.5rem' }}>›</div>
                </div>
                {isAdmin && (
                    <>
                        <div className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <div style={{ background: '#e0e7ff', color: '#3b82f6', borderRadius: '12px', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>₹</div>
                            <div>
                                <h3 style={{ color: '#3b82f6', margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>₹{totalCollected.toLocaleString()}</h3>
                                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem', fontWeight: '500' }}>Total Collected</p>
                            </div>
                        </div>
                        <div className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <div style={{ background: '#fee2e2', color: '#ef4444', borderRadius: '12px', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>📄</div>
                            <div>
                                <h3 style={{ color: '#ef4444', margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>₹{totalDue.toLocaleString()}</h3>
                                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem', fontWeight: '500' }}>Total Dues</p>
                            </div>
                        </div>
                        <div className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <div style={{ background: '#f3e8ff', color: '#a855f7', borderRadius: '12px', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🎁</div>
                            <div>
                                <h3 style={{ color: '#a855f7', margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>₹{totalDiscount.toLocaleString()}</h3>
                                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem', fontWeight: '500' }}>Discount Given</p>
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
                            fontWeight: validTab === t.id ? '700' : '600', fontSize: '0.9rem',
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
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '300px' }}>
                            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>🔍</span>
                            <input
                                type="text" className="form-input" placeholder="Search student by name or roll no."
                                value={search} onChange={e => setSearch(e.target.value)}
                                style={{ width: '100%', paddingLeft: '32px', margin: 0, height: '40px' }}
                            />
                        </div>
                        <select className="form-select" value={filterClass} onChange={e => setFilterClass(e.target.value)}
                            style={{ minWidth: '160px', flex: 1, maxWidth: '200px', margin: 0, height: '40px' }}>
                            <option value="">🎓 All Classes</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
                        </select>
                        <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                            style={{ minWidth: '160px', flex: 1, maxWidth: '200px', margin: 0, height: '40px' }}>
                            <option value="all">📊 All Status</option>
                            <option value="pending">⏳ Pending</option>
                            <option value="partial">⚠️ Partial</option>
                            <option value="paid">✅ Paid</option>
                        </select>
                        <select className="form-select" value={filterAssigned} onChange={e => setFilterAssigned(e.target.value)}
                            style={{ minWidth: '160px', flex: 1, maxWidth: '200px', margin: 0, height: '40px' }}>
                            <option value="all">📋 All Assigned </option>
                            <option value="assigned">✅ Assigned Fees</option>
                            <option value="unassigned">❌ Not Assigned</option>
                        </select>
                        <button className="btn" onClick={() => setShowMoreFilters(!showMoreFilters)} style={{ background: showMoreFilters ? '#e9d5ff' : '#f3e8ff', color: '#7e22ce', border: 'none', fontWeight: '600', padding: '0 1.2rem', height: '40px', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px', cursor: 'pointer', transition: '0.2s' }}>
                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                            More Filters
                        </button>
                        {showMoreFilters && (
                            <div style={{ width: '100%', display: 'flex', gap: '0.75rem', marginTop: '0.5rem', padding: '0.75rem', background: '#f9fafb', borderRadius: '8px', border: '1px dashed #e5e7eb' }}>
                                <select className="form-select" value={filterFeeType} onChange={e => setFilterFeeType(e.target.value)} style={{ minWidth: '160px', height: '40px' }}>
                                    <option value="">📁 All Fee Types</option>
                                    <option value="Tuition Fee">Tuition Fee</option>
                                    <option value="Exam Fee">Exam Fee</option>
                                    <option value="Transport Fee">Transport Fee</option>
                                    <option value="Library Fee">Library Fee</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
                        {[['pending', '⏳ Pending', '#8b5cf6', '#f3e8ff'], ['partial', '⚠️ Partial', '#f59e0b', '#fef3c7'], ['paid', '✅ Paid', '#10b981', '#d1fae5'], ['all', '👥 All', '#6366f1', '#e0e7ff']].map(([val, lbl, col, bgCol]) => (
                            <button
                                key={val}
                                onClick={() => setFilterStatus(val)}
                                style={{
                                    padding: '6px 16px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                    fontSize: '0.85rem',
                                    background: filterStatus === val ? bgCol : '#fff',
                                    color: filterStatus === val ? col : '#6b7280',
                                    border: `1px solid ${filterStatus === val ? bgCol : '#e5e7eb'}`,
                                    transition: 'all 0.2s',
                                    display: 'flex', alignItems: 'center', gap: '6px'
                                }}
                            >
                                {lbl}
                            </button>
                        ))}
                    </div>

                    {/* Student fee rows */}
                    {paginatedFees.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
                                {filterStatus === 'pending' ? '🎉' : '📭'}
                            </div>
                            <div style={{ fontWeight: '600' }}>
                                {filterStatus === 'pending' ? 'All fees paid!' : 'No records match.'}
                            </div>
                        </div>
                    ) : (
                        <div className="table-container" style={{ overflowX: 'auto', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        <th style={{ padding: '1rem 1.25rem' }}>STUDENT</th>
                                        <th style={{ padding: '1rem 1.25rem' }}>CLASS / FEE TYPE</th>
                                        <th style={{ padding: '1rem 1.25rem' }}>DUE DATE</th>
                                        <th style={{ padding: '1rem 1.25rem' }}>REMINDER DATE</th>
                                        <th style={{ padding: '1rem 1.25rem' }}>AMOUNT</th>
                                        <th style={{ padding: '1rem 1.25rem' }}>PAID</th>
                                        <th style={{ padding: '1rem 1.25rem' }}>DUE</th>
                                        <th style={{ padding: '1rem 1.25rem' }}>STATUS</th>
                                        <th style={{ padding: '1rem 1.25rem' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedFees.map(sf => {
                                        const stColor = sf.status === 'paid' ? '#10b981' : sf.status === 'partial' ? '#f59e0b' : '#ef4444';
                                        const stBg = sf.status === 'paid' ? 'rgba(16,185,129,0.1)' : sf.status === 'partial' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)';

                                        return (
                                            <tr key={sf.id} style={{ borderBottom: '1px solid #e5e7eb', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f9fafb'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                                <td style={{ padding: '1rem 1.25rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <div style={{
                                                            width: '36px', height: '36px', borderRadius: '50%',
                                                            background: sf.status === 'paid' ? 'rgba(16,185,129,0.15)' : sf.status === 'partial' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                                                            color: stColor, fontWeight: '700', fontSize: '0.9rem',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                        }}>
                                                            {(sf.Student?.User?.name || 'S')[0].toUpperCase()}{(sf.Student?.User?.name?.split(' ')[1]?.[0] || '').toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: '600', color: '#111827', fontSize: '0.9rem' }}>{sf.Student?.User?.name}</div>
                                                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{sf.Student?.roll_number}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem 1.25rem' }}>
                                                    <div style={{ fontWeight: '500', color: '#374151', fontSize: '0.85rem' }}>{sf.Class?.name} {sf.Class?.section && `- ${sf.Class.section.replace('Section ', '')}`}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: '500', display: 'inline-block', padding: '2px 6px', background: 'rgba(59,130,246,0.1)', borderRadius: '4px', marginTop: '4px' }}>
                                                        {sf.FeesStructure?.fee_type || 'Fee'} {sf.FeesStructure?.Subject ? `• ${sf.FeesStructure.Subject.name}` : ''}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem 1.25rem' }}>
                                                    <div style={{ fontSize: '0.85rem', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        📅 {sf.FeesStructure?.due_date ? new Date(sf.FeesStructure.due_date).toLocaleDateString('en-GB') : '—'}
                                                    </div>
                                                    {sf.FeesStructure?.due_date && sf.status !== 'paid' && (
                                                        <div style={{ fontSize: '0.75rem', color: isOverdue(sf) ? '#ef4444' : '#f59e0b', fontWeight: '600', marginTop: '2px' }}>
                                                            {isOverdue(sf) ? 'Overdue' : `${Math.max(0, Math.ceil((new Date(sf.FeesStructure.due_date) - new Date()) / (1000 * 60 * 60 * 24)))} days left`}
                                                        </div>
                                                    )}
                                                    {sf.status === 'paid' && <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '600', marginTop: '2px' }}>Paid</div>}
                                                </td>
                                                <td style={{ padding: '1rem 1.25rem' }}>
                                                    <div style={{ fontSize: '0.85rem', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        ⏰ {sf.reminder_date ? new Date(sf.reminder_date).toLocaleDateString('en-GB') : '—'}
                                                        {sf.status !== 'paid' && hasPerm('fees', 'create') && (
                                                            <button
                                                                onClick={() => {
                                                                    setEditingReminderFee(sf);
                                                                    setReminderDateInput(sf.reminder_date ? sf.reminder_date.substring(0, 10) : '');
                                                                }}
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '2px 4px', borderRadius: '4px', marginLeft: '4px' }}
                                                                title="Set Reminder"
                                                                onMouseOver={e => e.currentTarget.style.background = '#e5e7eb'}
                                                                onMouseOut={e => e.currentTarget.style.background = 'none'}
                                                            >
                                                                ✏️
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem 1.25rem', fontWeight: '600', color: '#111827', fontSize: '0.9rem' }}>
                                                    ₹{parseFloat(sf.final_amount).toLocaleString()}
                                                </td>
                                                <td style={{ padding: '1rem 1.25rem', fontWeight: '600', color: '#10b981', fontSize: '0.9rem' }}>
                                                    ₹{parseFloat(sf.paid_amount).toLocaleString()}
                                                </td>
                                                <td style={{ padding: '1rem 1.25rem' }}>
                                                    <span style={{ fontWeight: '600', color: sf.due_amount > 0 ? '#ef4444' : '#111827', fontSize: '0.9rem' }}>
                                                        ₹{parseFloat(sf.due_amount).toLocaleString()}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem 1.25rem' }}>
                                                    <span style={{
                                                        padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700',
                                                        background: stBg, color: stColor
                                                    }}>
                                                        {sf.status.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem 1.25rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {sf.status !== 'paid' && hasPerm('fees', 'create') && (
                                                            <button onClick={() => openDiscount(sf)} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#f3e8ff', color: '#7e22ce', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                🎁 Discount
                                                            </button>
                                                        )}
                                                        {sf.status !== 'paid' && (hasPerm('fees', 'create') || user.permissions?.includes('collect_fees')) && (
                                                            <button onClick={() => openCollect(sf)} style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: '#10b981', color: '#fff', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 4px rgba(16,185,129,0.2)' }}>
                                                                💵 Collect
                                                            </button>
                                                        )}
                                                        <button style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '32px', width: '32px' }}>
                                                            ⋮
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                            <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                                Showing <strong>{Math.min((currentPage - 1) * itemsPerPage + 1, filteredFees.length)}</strong> to <strong>{Math.min(currentPage * itemsPerPage, filteredFees.length)}</strong> of <strong>{filteredFees.length}</strong> records
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                                >
                                    &lt;
                                </button>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum;
                                    if (totalPages <= 5) {
                                        pageNum = i + 1;
                                    } else if (currentPage <= 3) {
                                        pageNum = i + 1;
                                    } else if (currentPage >= totalPages - 2) {
                                        pageNum = totalPages - 4 + i;
                                    } else {
                                        pageNum = currentPage - 2 + i;
                                    }

                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setCurrentPage(pageNum)}
                                            style={{
                                                padding: '6px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: 'pointer',
                                                background: currentPage === pageNum ? '#4f46e5' : '#fff',
                                                color: currentPage === pageNum ? '#fff' : '#374151',
                                                fontWeight: currentPage === pageNum ? '600' : '400'
                                            }}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                                {totalPages > 5 && currentPage < totalPages - 2 && (
                                    <>
                                        <span style={{ padding: '6px 8px', color: '#6b7280' }}>...</span>
                                        <button
                                            onClick={() => setCurrentPage(totalPages)}
                                            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer' }}
                                        >
                                            {totalPages}
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                                >
                                    &gt;
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ═══ PAYMENT HISTORY TAB ═══ */}
            {validTab === 'history' && (isAdmin || user.permissions?.includes('payment_history') || user.permissions?.includes('recent_payments')) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Filters Section */}
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>🔍</span>
                            <input
                                type="text" className="form-input" placeholder="Search by student name or roll no."
                                value={historySearch} onChange={e => { setHistorySearch(e.target.value); setHistoryPage(1); }}
                                style={{ width: '100%', paddingLeft: '36px', margin: 0, height: '42px', borderRadius: '8px' }}
                            />
                        </div>
                        <select className="form-select" value={historyClass} onChange={e => { setHistoryClass(e.target.value); setHistoryPage(1); }}
                            style={{ minWidth: '160px', flex: '1', margin: 0, height: '42px', borderRadius: '8px' }}>
                            <option value="">🎓 All Classes</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section && `- ${c.section.replace('Section ', '')}`}</option>)}
                        </select>
                        <select className="form-select" value={historyMethod} onChange={e => { setHistoryMethod(e.target.value); setHistoryPage(1); }}
                            style={{ minWidth: '180px', flex: '1', margin: 0, height: '42px', borderRadius: '8px' }}>
                            <option value="">💳 All Payment Methods</option>
                            <option value="cash">Cash</option>
                            <option value="online">Online (UPI)</option>
                            <option value="cheque">Cheque</option>
                        </select>
                        <div style={{ display: 'flex', flex: '1', minWidth: '280px', gap: '8px', alignItems: 'center' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <input type="date" className="form-input" value={historyStartDate} onChange={e => { setHistoryStartDate(e.target.value); setHistoryPage(1); }} style={{ width: '100%', margin: 0, height: '42px', borderRadius: '8px', fontSize: '0.85rem' }} />
                            </div>
                            <span style={{ color: '#9ca3af' }}>-</span>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <input type="date" className="form-input" value={historyEndDate} onChange={e => { setHistoryEndDate(e.target.value); setHistoryPage(1); }} style={{ width: '100%', margin: 0, height: '42px', borderRadius: '8px', fontSize: '0.85rem' }} />
                            </div>
                        </div>
                        <button className="btn" onClick={() => { setHistoryPage(1); alert("Filters applied successfully!"); }} style={{ background: '#f3e8ff', color: '#7e22ce', border: 'none', fontWeight: '600', padding: '0 1.25rem', height: '42px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px', cursor: 'pointer' }}>
                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                            Filters
                        </button>
                    </div>

                    {/* Table Section */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', borderBottom: '1px solid #e5e7eb' }}>
                            <div>
                                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#111827', fontSize: '1.1rem' }}>
                                    <span style={{ color: '#6b7280' }}>📋</span> Payment History
                                </h3>
                                <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
                                    Showing {Math.min((historyPage - 1) * historyItemsPerPage + 1, filteredPayments.length)} to {Math.min(historyPage * historyItemsPerPage, filteredPayments.length)} of {filteredPayments.length} records
                                </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#374151' }}>
                                    Sort by:
                                    <select value={historySort} onChange={e => { setHistorySort(e.target.value); setHistoryPage(1); }} style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 8px', outline: 'none', background: '#fff', cursor: 'pointer' }}>
                                        <option value="latest">Latest First</option>
                                        <option value="oldest">Oldest First</option>
                                        <option value="highest">Highest Amount</option>
                                    </select>
                                </div>
                                <button onClick={() => setHistoryDense(!historyDense)} title="Toggle Dense Mode" style={{ background: historyDense ? '#7e22ce' : '#f3e8ff', color: historyDense ? '#fff' : '#7e22ce', border: 'none', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
                                    ⚙️
                                </button>
                            </div>
                        </div>

                        <div className="table-container" style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1000px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        <th style={{ padding: historyDense ? '0.5rem 1.25rem' : '1rem 1.25rem' }}>DATE</th>
                                        <th style={{ padding: historyDense ? '0.5rem 1.25rem' : '1rem 1.25rem' }}>STUDENT</th>
                                        <th style={{ padding: historyDense ? '0.5rem 1.25rem' : '1rem 1.25rem' }}>CLASS / SECTION</th>
                                        <th style={{ padding: historyDense ? '0.5rem 1.25rem' : '1rem 1.25rem' }}>FEE TYPE</th>
                                        <th style={{ padding: historyDense ? '0.5rem 1.25rem' : '1rem 1.25rem' }}>AMOUNT</th>
                                        <th style={{ padding: historyDense ? '0.5rem 1.25rem' : '1rem 1.25rem' }}>METHOD</th>
                                        <th style={{ padding: historyDense ? '0.5rem 1.25rem' : '1rem 1.25rem' }}>STATUS</th>
                                        <th style={{ padding: historyDense ? '0.5rem 1.25rem' : '1rem 1.25rem' }}>RECEIPT</th>
                                        <th style={{ padding: historyDense ? '0.5rem 1.25rem' : '1rem 1.25rem' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedPayments.length === 0 ? (
                                        <tr><td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>No payment records found</td></tr>
                                    ) : paginatedPayments.map(p => {
                                        // Randomize colors slightly for initials as per image (pink, orange, green, blue)
                                        const colors = ['#fce7f3', '#ffedd5', '#d1fae5', '#e0e7ff'];
                                        const textColors = ['#db2777', '#c2410c', '#059669', '#4338ca'];
                                        const charCode = (p.Student?.User?.name || 'A').charCodeAt(0);
                                        const colorIdx = charCode % 4;

                                        const pDate = new Date(p.payment_date);

                                        return (
                                            <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f9fafb'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                                <td style={{ padding: historyDense ? '0.5rem 1.25rem' : '1rem 1.25rem' }}>
                                                    <div style={{ fontWeight: '600', color: '#374151', fontSize: '0.85rem' }}>{pDate.toLocaleDateString('en-GB')}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px' }}>{pDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                </td>
                                                <td style={{ padding: historyDense ? '0.5rem 1.25rem' : '1rem 1.25rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <div style={{
                                                            width: '36px', height: '36px', borderRadius: '50%',
                                                            background: colors[colorIdx], color: textColors[colorIdx],
                                                            fontWeight: '700', fontSize: '0.9rem',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                        }}>
                                                            {(p.Student?.User?.name || 'S')[0].toUpperCase()}{(p.Student?.User?.name?.split(' ')[1]?.[0] || '').toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: '600', color: '#111827', fontSize: '0.9rem' }}>{p.Student?.User?.name}</div>
                                                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{p.Student?.roll_number}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: historyDense ? '0.5rem 1.25rem' : '1rem 1.25rem' }}>
                                                    <div style={{ fontWeight: '500', color: '#374151', fontSize: '0.85rem' }}>
                                                        {p.Student?.Class?.name || 'Class'} {p.Student?.Class?.section && `- ${p.Student.Class.section.replace('Section ', '')}`}
                                                    </div>
                                                </td>
                                                <td style={{ padding: historyDense ? '0.5rem 1.25rem' : '1rem 1.25rem' }}>
                                                    <span style={{ color: '#3b82f6', fontWeight: '500', fontSize: '0.8rem' }}>
                                                        {p.StudentFee?.FeesStructure?.fee_type || 'Tuition Fee'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: historyDense ? '0.5rem 1.25rem' : '1rem 1.25rem' }}>
                                                    <span style={{ fontWeight: '700', color: '#10b981', fontSize: '0.9rem' }}>
                                                        ₹{parseFloat(p.amount_paid).toLocaleString()}
                                                    </span>
                                                </td>
                                                <td style={{ padding: historyDense ? '0.5rem 1.25rem' : '1rem 1.25rem' }}>
                                                    <span style={{ fontWeight: '500', color: '#374151', fontSize: '0.85rem', textTransform: 'capitalize' }}>
                                                        {p.payment_method}
                                                    </span>
                                                </td>
                                                <td style={{ padding: historyDense ? '0.5rem 1.25rem' : '1rem 1.25rem' }}>
                                                    <span style={{
                                                        padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600',
                                                        background: p.status === 'success' ? '#d1fae5' : '#ffedd5',
                                                        color: p.status === 'success' ? '#059669' : '#c2410c',
                                                        display: 'inline-flex', alignItems: 'center', gap: '4px'
                                                    }}>
                                                        {p.status === 'success' ? '✓ Success' : 'Pending'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: historyDense ? '0.5rem 1.25rem' : '1rem 1.25rem' }}>
                                                    <button onClick={() => setViewingReceipt(p)} style={{ background: 'none', border: 'none', color: '#8b5cf6', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}>
                                                        {p.transaction_id || `#RCP-000${p.id}`}
                                                    </button>
                                                </td>
                                                <td style={{ padding: historyDense ? '0.5rem 1.25rem' : '1rem 1.25rem' }}>
                                                    <button style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '32px', width: '32px' }}>
                                                        ⋮
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination footer */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', borderTop: '1px solid #e5e7eb' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#4b5563' }}>
                                Rows per page:
                                <select value={historyItemsPerPage} onChange={e => { setHistoryItemsPerPage(Number(e.target.value)); setHistoryPage(1); }} style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 8px', outline: 'none', background: '#fff', cursor: 'pointer' }}>
                                    <option value="10">10</option>
                                    <option value="20">20</option>
                                    <option value="50">50</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                    onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                    disabled={historyPage === 1}
                                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: historyPage === 1 ? 'not-allowed' : 'pointer' }}
                                >
                                    &lt;
                                </button>
                                {Array.from({ length: Math.min(5, historyTotalPages) }, (_, i) => {
                                    const pageNum = i + 1;
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setHistoryPage(pageNum)}
                                            style={{
                                                padding: '6px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: 'pointer',
                                                background: historyPage === pageNum ? '#4f46e5' : '#fff',
                                                color: historyPage === pageNum ? '#fff' : '#374151',
                                                fontWeight: historyPage === pageNum ? '600' : '400'
                                            }}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                                <button
                                    onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))}
                                    disabled={historyPage === historyTotalPages}
                                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: historyPage === historyTotalPages ? 'not-allowed' : 'pointer' }}
                                >
                                    &gt;
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ FEE STRUCTURES TAB ═══ */}
            {validTab === 'structure' && (hasPerm('fees', 'read') || user.permissions?.includes('collect_fees')) && (isAdmin || !user.permissions?.includes('fees.hide')) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Filters Section */}
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: '1', minWidth: '250px' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>🔍</span>
                            <input
                                type="text" className="form-input" placeholder="Search fee structure by class, subject or name..."
                                value={structureSearch} onChange={e => { setStructureSearch(e.target.value); setStructurePage(1); }}
                                style={{ width: '100%', paddingLeft: '36px', margin: 0, height: '42px', borderRadius: '8px', fontSize: '0.9rem' }}
                            />
                        </div>
                        <select className="form-select" value={structureClass} onChange={e => { setStructureClass(e.target.value); setStructurePage(1); }}
                            style={{ minWidth: '160px', flex: '1', margin: 0, height: '42px', borderRadius: '8px', fontSize: '0.9rem' }}>
                            <option value="">🎓 All Classes</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section && `- ${c.section.replace('Section ', '')}`}</option>)}
                        </select>
                        <select className="form-select" value={structureFeeType} onChange={e => { setStructureFeeType(e.target.value); setStructurePage(1); }}
                            style={{ minWidth: '160px', flex: '1', margin: 0, height: '42px', borderRadius: '8px', fontSize: '0.9rem' }}>
                            <option value="">📋 All Fee Types</option>
                            {uniqueFeeTypes.map(ft => <option key={ft} value={ft}>{ft}</option>)}
                        </select>
                        <select className="form-select" value={structureStatus} onChange={e => { setStructureStatus(e.target.value); setStructurePage(1); }}
                            style={{ minWidth: '160px', flex: '1', margin: 0, height: '42px', borderRadius: '8px', fontSize: '0.9rem' }}>
                            <option value="">🟢 Status: All</option>
                            <option value="active">🟢 Status: Active</option>
                        </select>

                        {(hasPerm('fees', 'create')) && (
                            <button onClick={() => {
                                setStructureForm({ class_id: '', subject_id: '', fee_type: 'Tuition Fee', custom_fee_type: '', amount: '', due_date: '', description: '', student_target: 'all', individual_student_ids: [] });
                                setEditingStructureId(null);
                                setShowStructureModal(true);
                            }} style={{ background: '#7e22ce', color: '#fff', border: 'none', fontWeight: '600', padding: '0 1.25rem', height: '42px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                + Add Fee Structure
                            </button>
                        )}
                    </div>

                    {/* Table Section */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div className="table-container" style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1000px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        <th style={{ padding: '1.25rem' }}>CLASS / SUBJECT</th>
                                        <th style={{ padding: '1.25rem' }}>FEE TYPE</th>
                                        <th style={{ padding: '1.25rem' }}>AMOUNT</th>
                                        <th style={{ padding: '1.25rem' }}>DUE DATE</th>
                                        <th style={{ padding: '1.25rem' }}>DESCRIPTION</th>
                                        <th style={{ padding: '1.25rem' }}>STATUS</th>
                                        {(hasPerm('fees', 'update') || hasPerm('fees', 'delete')) && <th style={{ padding: '1.25rem', textAlign: 'right' }}>ACTIONS</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedStructures.length === 0 ? (
                                        <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>No fee structures found</td></tr>
                                    ) : paginatedStructures.map(fs => (
                                        <tr key={fs.id} style={{ borderBottom: '1px solid #e5e7eb', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f9fafb'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                            <td style={{ padding: '1.25rem' }}>
                                                <div style={{ fontWeight: '600', color: '#374151', fontSize: '0.9rem' }}>
                                                    {fs.Class?.name} {fs.Class?.section}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
                                                    {fs.Subject ? fs.Subject.name : 'All Subjects (Full Class)'}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.25rem' }}>
                                                <span style={{ color: '#3b82f6', fontWeight: '500', fontSize: '0.85rem' }}>
                                                    {fs.fee_type}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1.25rem' }}>
                                                <span style={{ fontWeight: '700', color: '#374151', fontSize: '0.9rem' }}>
                                                    ₹{parseFloat(fs.amount).toLocaleString()}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1.25rem', color: '#4b5563', fontSize: '0.85rem' }}>
                                                {new Date(fs.due_date).toLocaleDateString('en-GB')}
                                            </td>
                                            <td style={{ padding: '1.25rem', color: '#6b7280', fontSize: '0.85rem' }}>
                                                {fs.description || '—'}
                                            </td>
                                            <td style={{ padding: '1.25rem' }}>
                                                <span style={{
                                                    padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600',
                                                    color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '6px'
                                                }}>
                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                                                    Active
                                                </span>
                                            </td>
                                            {(hasPerm('fees', 'update') || hasPerm('fees', 'delete')) && (
                                                <td style={{ padding: '1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                        {hasPerm('fees', 'update') && (
                                                            <button onClick={() => handleEditStructure(fs)} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#4b5563', transition: 'all 0.2s' }} onMouseOver={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.background = '#f3f4f6'; }} onMouseOut={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#fff'; }} title="Edit">
                                                                ✏️
                                                            </button>
                                                        )}
                                                        {hasPerm('fees', 'delete') && (
                                                            <button onClick={() => handleDeleteStructure(fs.id)} style={{ background: '#fff', border: '1px solid #fee2e2', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444', transition: 'all 0.2s' }} onMouseOver={e => { e.currentTarget.style.borderColor = '#fca5a5'; e.currentTarget.style.background = '#fef2f2'; }} onMouseOut={e => { e.currentTarget.style.borderColor = '#fee2e2'; e.currentTarget.style.background = '#fff'; }} title="Delete">
                                                                🗑️
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination footer */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', borderTop: '1px solid #e5e7eb' }}>
                            <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                                Showing {Math.min((structurePage - 1) * structureItemsPerPage + 1, filteredStructures.length) || 0} to {Math.min(structurePage * structureItemsPerPage, filteredStructures.length)} of {filteredStructures.length} entries
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                    onClick={() => setStructurePage(p => Math.max(1, p - 1))}
                                    disabled={structurePage === 1}
                                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: structurePage === 1 ? 'not-allowed' : 'pointer' }}
                                >
                                    &lt;
                                </button>
                                {Array.from({ length: Math.min(5, structureTotalPages) }, (_, i) => {
                                    const pageNum = i + 1;
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setStructurePage(pageNum)}
                                            style={{
                                                padding: '6px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: 'pointer',
                                                background: structurePage === pageNum ? '#7e22ce' : '#fff',
                                                color: structurePage === pageNum ? '#fff' : '#374151',
                                                fontWeight: structurePage === pageNum ? '600' : '400'
                                            }}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                                <button
                                    onClick={() => setStructurePage(p => Math.min(structureTotalPages, p + 1))}
                                    disabled={structurePage === structureTotalPages}
                                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: structurePage === structureTotalPages ? 'not-allowed' : 'pointer' }}
                                >
                                    &gt;
                                </button>
                            </div>
                        </div>
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
                <div className="modal-overlay" style={{ zIndex: 1050, overflowY: 'auto', padding: '2rem 1rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                    <div className="modal-content" style={{ maxWidth: '600px', width: '100%', margin: '0 auto', borderRadius: '16px', padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                        {/* Header */}
                        <div style={{ padding: '1.5rem 1.5rem 1rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f3e8ff', color: '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                                    {editingStructureId ? '✏️' : '📝'}
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#111827' }}>{editingStructureId ? 'Edit Fee Structure' : 'Add Fee Structure'}</h2>
                                    <div style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '4px' }}>
                                        {editingStructureId ? 'Update details of an existing fee structure.' : 'Create a new fee structure for a class or subject.'}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => { setShowStructureModal(false); setStructureForm({ class_id: '', subject_id: '', fee_type: 'Tuition Fee', custom_fee_type: '', amount: '', due_date: '', description: '', student_target: 'all', individual_student_ids: [] }); setEditingStructureId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1.25rem' }}>
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleStructureSubmit} style={{ padding: '0 1.5rem 1.5rem', overflowY: 'auto', flex: 1 }}>
                            {/* Class */}
                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <label className="form-label" style={{ fontWeight: '600', color: '#374151', fontSize: '0.9rem' }}>Class <span style={{ color: '#ef4444' }}>*</span></label>
                                <select className="form-select" value={structureForm.class_id} required
                                    onChange={e => {
                                        setStructureForm({ ...structureForm, class_id: e.target.value, subject_id: '', individual_student_ids: [] });
                                        fetchSubjectsForClass(e.target.value);
                                    }} style={{ height: '46px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                                    <option value="">Select Class</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? ` - ${c.section}` : ''}</option>)}
                                </select>
                            </div>

                            {/* Subject */}
                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <label className="form-label" style={{ fontWeight: '600', color: '#374151', fontSize: '0.9rem' }}>Subject (Optional)</label>
                                {structureForm.student_target === 'individual' ? (
                                    <input type="text" className="form-input" value="None (Not applicable for individual student)" disabled style={{ backgroundColor: '#f9fafb', color: '#9ca3af', height: '46px', borderRadius: '8px', border: '1px solid #e5e7eb' }} title="Subject is automatically removed when applying fees to an individual." />
                                ) : (
                                    <>
                                        <select
                                            className="form-select"
                                            value={structureForm.subject_id}
                                            disabled={!structureForm.class_id}
                                            onChange={e => setStructureForm({ ...structureForm, subject_id: e.target.value })}
                                            style={{ height: '46px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: !structureForm.class_id ? '#f9fafb' : '#fff' }}>
                                            <option value="">All Subjects (Full Class)</option>
                                            {availableSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </>
                                )}
                            </div>

                            {/* Apply To */}
                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <label className="form-label" style={{ fontWeight: '600', color: '#374151', fontSize: '0.9rem' }}>Apply To</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div
                                        onClick={() => setStructureForm({ ...structureForm, student_target: 'all', individual_student_ids: [] })}
                                        style={{
                                            padding: '1rem', borderRadius: '12px', cursor: 'pointer', position: 'relative',
                                            border: `2px solid ${structureForm.student_target === 'all' ? '#7e22ce' : '#e5e7eb'}`,
                                            background: structureForm.student_target === 'all' ? '#faf5ff' : '#fff',
                                        }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                                            <span style={{ color: structureForm.student_target === 'all' ? '#7e22ce' : '#6b7280' }}>👥</span>
                                            <span style={{ fontWeight: '600', color: structureForm.student_target === 'all' ? '#7e22ce' : '#374151' }}>All Students</span>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#6b7280', textAlign: 'center' }}>
                                            Apply this fee structure to all students in the selected class.
                                        </div>
                                        {structureForm.student_target === 'all' && (
                                            <div style={{ position: 'absolute', top: '8px', right: '8px', width: '20px', height: '20px', background: '#7e22ce', borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>✓</div>
                                        )}
                                    </div>
                                    <div
                                        onClick={() => setStructureForm({ ...structureForm, student_target: 'individual', individual_student_ids: [] })}
                                        style={{
                                            padding: '1rem', borderRadius: '12px', cursor: 'pointer', position: 'relative',
                                            border: `2px solid ${structureForm.student_target === 'individual' ? '#7e22ce' : '#e5e7eb'}`,
                                            background: structureForm.student_target === 'individual' ? '#faf5ff' : '#fff',
                                        }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                                            <span style={{ color: structureForm.student_target === 'individual' ? '#7e22ce' : '#6b7280' }}>👤</span>
                                            <span style={{ fontWeight: '600', color: structureForm.student_target === 'individual' ? '#7e22ce' : '#374151' }}>Individual Student</span>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#6b7280', textAlign: 'center' }}>
                                            Apply this fee structure to a specific student only.
                                        </div>
                                        {structureForm.student_target === 'individual' && (
                                            <div style={{ position: 'absolute', top: '8px', right: '8px', width: '20px', height: '20px', background: '#7e22ce', borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>✓</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Individual Student Dropdown */}
                            {structureForm.student_target === 'individual' && (
                                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                    <label className="form-label" style={{ fontWeight: '600', color: '#374151', fontSize: '0.9rem' }}>Select Student(s) <span style={{ color: '#ef4444' }}>*</span></label>
                                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', background: '#fff', overflow: 'hidden' }}>
                                        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <span style={{ color: '#9ca3af' }}>🔍</span>
                                            <input
                                                type="text"
                                                placeholder="Search students by name or roll number..."
                                                onChange={e => {
                                                    const val = e.target.value.toLowerCase();
                                                    const items = document.querySelectorAll('.student-option-item');
                                                    items.forEach(item => {
                                                        const text = item.innerText.toLowerCase();
                                                        item.style.display = text.includes(val) ? 'flex' : 'none';
                                                    });
                                                }}
                                                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.9rem', color: '#374151' }}
                                            />
                                            <span style={{ fontSize: '0.8rem', color: '#6366f1', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                                {structureForm.individual_student_ids.length} selected
                                            </span>
                                        </div>
                                        <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                                            {allStudentsForClass.length === 0 ? (
                                                <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' }}>No students found in this class.</div>
                                            ) : (
                                                allStudentsForClass.map(s => {
                                                    const isSelected = structureForm.individual_student_ids.includes(s.id);
                                                    const initials = (s.User?.name || s.name || '?').substring(0, 2).toUpperCase();
                                                    return (
                                                        <div
                                                            key={s.id}
                                                            className="student-option-item"
                                                            onClick={() => {
                                                                const ids = [...structureForm.individual_student_ids];
                                                                if (isSelected) {
                                                                    setStructureForm({ ...structureForm, individual_student_ids: ids.filter(id => id !== s.id) });
                                                                } else {
                                                                    setStructureForm({ ...structureForm, individual_student_ids: [...ids, s.id] });
                                                                }
                                                            }}
                                                            style={{
                                                                padding: '1rem',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '1rem',
                                                                cursor: 'pointer',
                                                                borderBottom: '1px solid #f3f4f6',
                                                                background: isSelected ? '#faf5ff' : '#fff',
                                                                transition: 'background 0.2s'
                                                            }}
                                                            onMouseOver={e => { if (!isSelected) e.currentTarget.style.background = '#f9fafb'; }}
                                                            onMouseOut={e => { if (!isSelected) e.currentTarget.style.background = '#fff'; }}
                                                        >
                                                            <div style={{
                                                                width: '18px', height: '18px', borderRadius: '4px',
                                                                border: `2px solid ${isSelected ? '#7e22ce' : '#d1d5db'}`,
                                                                background: isSelected ? '#7e22ce' : '#fff',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                flexShrink: 0
                                                            }}>
                                                                {isSelected && <span style={{ color: '#fff', fontSize: '10px' }}>✓</span>}
                                                            </div>
                                                            <div style={{
                                                                width: '36px', height: '36px', borderRadius: '50%',
                                                                background: '#fee2e2', color: '#ef4444',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontSize: '0.85rem', fontWeight: 'bold', flexShrink: 0
                                                            }}>
                                                                {initials}
                                                            </div>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ fontWeight: '600', color: '#111827', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {s.User?.name || s.name}
                                                                </div>
                                                                <div style={{ fontSize: '0.75rem', color: '#6b7280', display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                                                                    <span>Roll: {s.roll_number || 'N/A'}</span>
                                                                    <span>•</span>
                                                                    <span>Class: {classes.find(c => c.id == structureForm.class_id)?.name || 'N/A'}</span>
                                                                    {classes.find(c => c.id == structureForm.class_id)?.section && (
                                                                        <>
                                                                            <span>•</span>
                                                                            <span>Section: {classes.find(c => c.id == structureForm.class_id)?.section.replace('Section ', '') || 'N/A'}</span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                                {/* Fee Type */}
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label" style={{ fontWeight: '600', color: '#374151', fontSize: '0.9rem' }}>Fee Type <span style={{ color: '#ef4444' }}>*</span></label>
                                    <select className="form-select" value={structureForm.fee_type}
                                        onChange={e => setStructureForm({ ...structureForm, fee_type: e.target.value })} style={{ height: '46px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                                        {['Tuition Fee', 'Exam Fee', 'Transport Fee', 'Library Fee', 'Other'].map(t => <option key={t}>{t}</option>)}
                                    </select>
                                </div>
                                {/* Amount */}
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label" style={{ fontWeight: '600', color: '#374151', fontSize: '0.9rem' }}>Amount (₹) <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input type="number" className="form-input" required min="1" value={structureForm.amount} placeholder="Enter amount"
                                        onChange={e => setStructureForm({ ...structureForm, amount: e.target.value })} style={{ height: '46px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                                </div>
                            </div>

                            {structureForm.fee_type === 'Other' && (
                                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                    <label className="form-label" style={{ fontWeight: '600', color: '#374151', fontSize: '0.9rem' }}>Custom Fee Type Name <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input type="text" className="form-input" required value={structureForm.custom_fee_type}
                                        placeholder="e.g. Dance Fee, Sports Fee"
                                        onChange={e => setStructureForm({ ...structureForm, custom_fee_type: e.target.value })} style={{ height: '46px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                                {/* Due Date */}
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label" style={{ fontWeight: '600', color: '#374151', fontSize: '0.9rem' }}>Due Date <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input type="date" className="form-input" required value={structureForm.due_date}
                                        onChange={e => setStructureForm({ ...structureForm, due_date: e.target.value })} style={{ height: '46px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                                </div>
                                {/* Description */}
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label" style={{ fontWeight: '600', color: '#374151', fontSize: '0.9rem' }}>Description (Optional)</label>
                                    <input type="text" className="form-input" value={structureForm.description} placeholder="Enter description"
                                        onChange={e => setStructureForm({ ...structureForm, description: e.target.value })} style={{ height: '46px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                                </div>
                            </div>

                            {/* Info hint */}
                            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                <div style={{ background: '#3b82f6', color: '#fff', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0 }}>i</div>
                                <div style={{ fontSize: '0.85rem', color: '#1e3a8a', lineHeight: '1.4' }}>
                                    {structureForm.student_target === 'all'
                                        ? 'This fee structure will be automatically assigned to all students in the selected class.'
                                        : 'This fee structure will be assigned only to the selected student.'}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button type="button" onClick={() => { setShowStructureModal(false); setStructureForm({ class_id: '', subject_id: '', fee_type: 'Tuition Fee', custom_fee_type: '', amount: '', due_date: '', description: '', student_target: 'all', individual_student_ids: [] }); setEditingStructureId(null); }} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" style={{ flex: 2, padding: '0.75rem', borderRadius: '8px', border: 'none', background: '#6366f1', color: '#fff', fontWeight: '600', cursor: 'pointer' }}>
                                    {editingStructureId ? 'Save Changes' : 'Create Fee Structure'}
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
