import { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import BackButton from "../../components/common/BackButton";
import "./PayFees.css";
import { useRazorpayPayment } from "../../hooks/useRazorpayPayment";

function PayFees() {
    const { user } = useContext(AuthContext);
    const [feeStructures, setFeeStructures] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedFee, setSelectedFee] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState("");
    const [error, setError] = useState("");
    const [studentId, setStudentId] = useState(null);
    const [studentProfile, setStudentProfile] = useState(null);
    const [totalPaid, setTotalPaid] = useState(0);
    const [isTestMode, setIsTestMode] = useState(true);
    const [viewingReceipt, setViewingReceipt] = useState(null);

    const { initializePayment, isPaymentLoading, paymentError, setPaymentError } = useRazorpayPayment();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);

            // First get the student profile
            const meRes = await api.get('/students/me');
            const myStudentId = meRes.data.data.id;
            setStudentId(myStudentId);
            setStudentProfile(meRes.data.data);

            // Fetch Synced Student Fees applicable to the student
            const feesRes = await api.get('/fees/my-fees');
            const assignedFees = feesRes.data.data;
            setFeeStructures(assignedFees);

            // Fetch Student's own payments
            const paymentRes = await api.get(`/fees/payment/${myStudentId}`);
            setPayments(paymentRes.data.data.payments);
            setTotalPaid(paymentRes.data.data.total_paid);

        } catch (err) {
            console.error(err);
            setError("Failed to load fee information.");
        } finally {
            setLoading(false);
        }
    };

    const handlePayClick = (fee) => {
        const balance = parseFloat(fee.due_amount) || 0;
        setSelectedFee(fee);
        setPaymentAmount(balance.toFixed(2)); // Default to balance amount
        setShowModal(true);
        setPaymentError?.(null);
    };

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        try {
            // 1. Create Order on Backend
            const orderRes = await api.post("/payment/fees/create-order", {
                student_fee_id: selectedFee.id,
                amount: parseFloat(paymentAmount),
                testMode: isTestMode
            });

            const { order, key } = orderRes.data;

            if (key === "rzp_test_mock") {
                // Mock verification flow
                const confirmMock = window.confirm(`Mock Payment Gateway\n\nPay ₹${order.amount / 100}?\n\nClick OK to succeed, Cancel to fail.`);
                if (confirmMock) {
                    try {
                        await api.post("/payment/fees/verify", {
                            razorpay_order_id: order.id,
                            razorpay_payment_id: `pay_mock_${Date.now()}`,
                            razorpay_signature: "mock_signature",
                            student_fee_id: selectedFee.id,
                            amount: parseFloat(paymentAmount)
                        });

                        alert("Payment Successful!");
                        setShowModal(false);
                        setPaymentAmount("");
                        setSelectedFee(null);
                        fetchData();
                    } catch (verifyErr) {
                        alert(verifyErr.response?.data?.message || "Payment Verification Failed.");
                    }
                }
                return;
            }

            // 2. Initialize Razorpay Checkout
            initializePayment({
                orderConfig: {
                    key: key,
                    amount: order.amount,
                    currency: order.currency,
                    order_id: order.id,
                },
                userConfig: {
                    name: user.name,
                    email: user.email,
                    contact: user.phone || ""
                },
                onSuccess: async (paymentData) => {
                    try {
                        // 3. Verify Payment
                        await api.post("/payment/fees/verify", {
                            razorpay_order_id: paymentData.razorpay_order_id,
                            razorpay_payment_id: paymentData.razorpay_payment_id,
                            razorpay_signature: paymentData.razorpay_signature,
                            student_fee_id: selectedFee.id,
                            amount: parseFloat(paymentAmount)
                        });

                        alert("Payment Successful!");
                        setShowModal(false);
                        setPaymentAmount("");
                        setSelectedFee(null);
                        fetchData();
                    } catch (verifyErr) {
                        alert(verifyErr.response?.data?.message || "Payment Verification Failed.");
                    }
                },
                onFailure: (errDesc) => {
                    alert(`Payment Failed: ${errDesc}`);
                }
            });

        } catch (err) {
            alert(err.response?.data?.message || "Could not initiate payment.");
        }
    };

    const getParticulars = (payment) => {
        if (payment.fee_structure_id) {
            const feeRecord = feeStructures.find(f => f.fee_structure_id === payment.fee_structure_id);
            if (feeRecord && feeRecord.FeesStructure) {
                let p = feeRecord.FeesStructure.fee_type;
                if (feeRecord.FeesStructure.Subject) p += ` (${feeRecord.FeesStructure.Subject.name})`;
                return p;
            }
        }
        return "Academic Fee Collection";
    };

    if (loading) return <div className="dashboard-container">Loading...</div>;

    const safeTotalPaid = feeStructures.reduce((sum, fee) => sum + parseFloat(fee.paid_amount || 0), 0);
    const totalRequired = feeStructures.reduce((sum, fee) => sum + parseFloat(fee.final_amount || 0), 0);
    const balanceDue = feeStructures.reduce((sum, fee) => sum + parseFloat(fee.due_amount || 0), 0);

    return (
        <div className="payfees-container">
            <div className="payfees-header">
                <div className="payfees-header-left">
                    <div className="payfees-header-icon">💳</div>
                    <div className="payfees-header-text">
                        <h1>Pay Fees</h1>
                        <p>View your fee structures and make secure online payments.</p>
                    </div>
                </div>
                <Link to="/student/dashboard" className="payfees-back-btn">← Back to Dashboard</Link>
            </div>

            {error && <div style={{ color: "red", padding: "10px", marginBottom: "1rem", backgroundColor: "#ffebeb", borderRadius: "5px" }}>{error}</div>}

            <div className="payfees-stats-grid">
                <div className="payfees-stat-card">
                    <div className="pf-stat-icon total">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
                    </div>
                    <div className="pf-stat-content">
                        <p>Total Fees Assigned</p>
                        <h3>${totalRequired.toFixed(2)}</h3>
                    </div>
                </div>
                <div className="payfees-stat-card">
                    <div className="pf-stat-icon paid">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    </div>
                    <div className="pf-stat-content">
                        <p>Total Paid</p>
                        <h3 style={{ color: '#10b981' }}>${safeTotalPaid.toFixed(2)}</h3>
                    </div>
                </div>
                <div className="payfees-stat-card">
                    <div className={`pf-stat-icon due ${balanceDue <= 0 ? 'zero' : ''}`}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                    </div>
                    <div className="pf-stat-content">
                        <p>Balance Due</p>
                        <h3 style={{ color: balanceDue > 0 ? '#f59e0b' : '#10b981' }}>
                            ${Math.max(0, balanceDue).toFixed(2)}
                        </h3>
                    </div>
                </div>
            </div>

            <div className="payfees-section">
                <div className="payfees-section-header">
                    <h3 className="payfees-section-title">
                        <span style={{ color: '#6366f1', fontSize: '1.2rem' }}>📄</span> Pending Fee Structures
                    </h3>
                </div>
                <div className="payfees-table-container">
                    <table className="payfees-table">
                        <thead>
                            <tr>
                                <th>Fee Type</th>
                                <th>Description</th>
                                <th>Due Date</th>
                                <th>Amount</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {feeStructures.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
                                        No fees assigned to your account yet.
                                    </td>
                                </tr>
                            ) : (
                                feeStructures.map((fee) => {
                                    const finalAmount = parseFloat(fee.final_amount) || 0;
                                    const paidAmount = parseFloat(fee.paid_amount) || 0;
                                    const balance = parseFloat(fee.due_amount) || 0;
                                    const isPaidOff = fee.status === 'paid' || balance <= 0;

                                    return (
                                        <tr key={fee.id}>
                                            <td>
                                                <strong style={{ color: '#111827', fontSize: '1.05rem' }}>{fee.FeesStructure?.fee_type || 'General Fee'}</strong>
                                                <br />
                                                <small style={{ color: "#6b7280" }}>
                                                    {fee.FeesStructure?.Subject ? `Subject: ${fee.FeesStructure.Subject.name}` : "Full Course / General"}
                                                </small>
                                            </td>
                                            <td style={{ color: '#4b5563' }}>{fee.FeesStructure?.description || "-"}</td>
                                            <td>
                                                <div style={{ fontWeight: 600, color: '#374151' }}>
                                                    {fee.FeesStructure?.due_date ? new Date(fee.FeesStructure.due_date).toLocaleDateString('en-GB') : '-'}
                                                </div>
                                                {balance > 0 && fee.FeesStructure?.due_date && (
                                                    <small style={{ color: '#ef4444' }}>
                                                        {Math.ceil((new Date(fee.FeesStructure.due_date) - new Date()) / (1000 * 60 * 60 * 24)) > 0 
                                                            ? `(Due in ${Math.ceil((new Date(fee.FeesStructure.due_date) - new Date()) / (1000 * 60 * 60 * 24))} days)` 
                                                            : '(Overdue)'}
                                                    </small>
                                                )}
                                            </td>
                                            <td>
                                                Total: <strong style={{ color: '#111827' }}>${finalAmount.toFixed(2)}</strong><br />
                                                Paid: <span style={{ color: '#6b7280' }}>${paidAmount.toFixed(2)}</span><br />
                                                Due: <strong style={{ color: balance > 0 ? '#ef4444' : '#10b981' }}>${balance.toFixed(2)}</strong>
                                            </td>
                                            <td>
                                                <span className={`pf-badge ${isPaidOff ? 'paid' : paidAmount > 0 ? 'partial' : 'pending'}`}>
                                                    {isPaidOff ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Pending'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="payfees-section">
                <div className="payfees-section-header">
                    <h3 className="payfees-section-title">
                        <span style={{ color: '#6366f1', fontSize: '1.2rem' }}>🕒</span> Payment History
                    </h3>
                </div>
                <div className="payfees-table-container">
                    <table className="payfees-table">
                        <thead>
                            <tr>
                                <th>Transaction ID</th>
                                <th>Date</th>
                                <th>Method</th>
                                <th>Amount Paid</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
                                        No payment history found.
                                    </td>
                                </tr>
                            ) : (
                                payments.map((payment) => (
                                    <tr key={payment.id}>
                                        <td>
                                            <strong style={{ color: '#4f46e5', fontSize: '0.9rem' }}>
                                                {payment.payment_method?.toLowerCase() === 'cash' ? 'N/A' : payment.transaction_id}
                                            </strong>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600, color: '#374151' }}>{new Date(payment.payment_date).toLocaleDateString('en-GB')}</div>
                                            <small style={{ color: '#6b7280' }}>{new Date(payment.payment_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>
                                        </td>
                                        <td>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#4b5563', fontWeight: 500 }}>
                                                <span style={{ color: '#10b981' }}>💵</span> {payment.payment_method}
                                            </span>
                                        </td>
                                        <td><strong style={{ color: '#111827', fontSize: '1.1rem' }}>${parseFloat(payment.amount_paid).toFixed(2)}</strong></td>
                                        <td>
                                            <span className={`pf-badge ${payment.status === 'success' ? 'success' : 'danger'}`}>
                                                {payment.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="payfees-support">
                <div className="payfees-support-left">
                    <div className="payfees-support-icon">i</div>
                    <div className="payfees-support-text">
                        <h4>Need help with your payments?</h4>
                        <p>If you face any issue while making a payment, please contact the administration.</p>
                    </div>
                </div>
            </div>

            {/* Payment Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "400px" }}>
                        <div className="modal-header">
                            <h3>💳 Secure Checkout</h3>
                            <button onClick={() => setShowModal(false)} className="btn btn-sm">×</button>
                        </div>
                        <div className="modal-body">
                            {paymentError && (
                                <div style={{ color: "red", padding: "10px", marginBottom: "1rem", backgroundColor: "#ffebeb", borderRadius: "5px" }}>
                                    {paymentError}
                                </div>
                            )}
                            <form onSubmit={handlePaymentSubmit}>
                                <div className="form-group">
                                    <label className="form-label">Fee Details</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={selectedFee?.fee_type || ""}
                                        disabled
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Amount (INR) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="form-input"
                                        value={paymentAmount}
                                        onChange={e => setPaymentAmount(e.target.value)}
                                        required
                                        min="1"
                                    />
                                </div>
                                <div className="payment-mode-toggle" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '15px', marginBottom: '15px' }}>
                                    <span style={{ fontWeight: isTestMode ? '600' : '400', color: isTestMode ? 'var(--primary-color, #3f51b5)' : '#666' }}>Test Mode</span>
                                    <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={!isTestMode} 
                                            onChange={(e) => setIsTestMode(!e.target.checked)} 
                                            style={{ opacity: 0, width: 0, height: 0, margin: 0, padding: 0 }}
                                        />
                                        <span style={{
                                            position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                                            backgroundColor: isTestMode ? '#ccc' : 'var(--primary-color, #3f51b5)', transition: '.3s', borderRadius: '34px'
                                        }}>
                                            <span style={{
                                                position: 'absolute', height: '20px', width: '20px', left: '3px', bottom: '3px',
                                                backgroundColor: 'white', transition: '.3s', borderRadius: '50%',
                                                transform: isTestMode ? 'translateX(0)' : 'translateX(24px)',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                            }}></span>
                                        </span>
                                    </label>
                                    <span style={{ fontWeight: !isTestMode ? '600' : '400', color: !isTestMode ? 'var(--primary-color, #3f51b5)' : '#666' }}>Real Mode</span>
                                </div>
                                
                                <div className="modal-footer" style={{ marginTop: "20px" }}>
                                    <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary" disabled={isPaymentLoading}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" style={{ backgroundColor: "#10b981", borderColor: "#10b981" }} disabled={isPaymentLoading}>
                                        {isPaymentLoading ? "Processing..." : `Pay ₹${paymentAmount || 0}`}
                                    </button>
                                </div>
                                <div className="secure-badge" style={{ marginTop: '16px', textAlign: 'center', fontSize: '12px', color: '#666', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                    Secured by Razorpay ({isTestMode ? 'Test Mode' : 'Live Mode'})
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ PROFESSIONAL RECEIPT MODAL ═══ */}
            {viewingReceipt && (() => {
                let receiptLogoUrl = user?.Institute?.logo;
                if (receiptLogoUrl && receiptLogoUrl.startsWith('/')) {
                    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
                    const backendBase = apiUrl.replace(/\/api\/?$/, "");
                    receiptLogoUrl = `${backendBase}${receiptLogoUrl}`;
                }
                const studentName = studentProfile?.User?.name || user?.name || "Student";
                const rollNo = studentProfile?.roll_number || "-";
                const particulars = getParticulars(viewingReceipt);

                return (
                    <div className="modal-overlay" style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', position: 'fixed', inset: 0 }}>
                        <div className="modal-content" style={{ maxWidth: '850px', width: '100%', padding: 0, overflow: 'hidden', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                            {/* Modal Header */}
                            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                                <h3 style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '1.25rem' }}>📄</span> Receipt Preview
                                </h3>
                                <button onClick={() => setViewingReceipt(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>×</button>
                            </div>

                            {/* Scrollable receipt area */}
                            <div style={{ overflowY: 'auto', flex: 1, padding: '2rem', background: '#e2e8f0' }}>
                                <div id="student-printable-receipt" style={{ padding: '3rem', background: '#ffffff', color: '#0f172a', fontFamily: "'Inter', sans-serif", borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>

                                    {/* Institute Header */}
                                    <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                                        {receiptLogoUrl ? (
                                            <img src={receiptLogoUrl} alt="Institute Logo" style={{ width: '90px', height: '90px', margin: '0 auto 1rem', borderRadius: '50%', objectFit: 'contain', display: 'block', border: '2px solid #e2e8f0', background: '#fff' }} />
                                        ) : (
                                            <div style={{ width: '90px', height: '90px', margin: '0 auto 1rem', background: '#f8fafc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #e2e8f0' }}>
                                                <span style={{ fontSize: '3rem' }}>🏫</span>
                                            </div>
                                        )}
                                        <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: '800', letterSpacing: '0.05em', color: '#0f172a', textTransform: 'uppercase' }}>
                                            {user?.Institute?.name || user?.institute_name || "Institute"}
                                        </h1>
                                    </div>

                                    {/* Institute Info + Date */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #cbd5e1', paddingBottom: '2rem', marginBottom: '2rem' }}>
                                        <div style={{ flex: 1, fontSize: '1rem', color: '#334155', lineHeight: '1.7' }}>
                                            <p style={{ margin: 0 }}><strong>Address:</strong> {user?.Institute?.address || "-"}{user?.Institute?.city ? `, ${user.Institute.city}` : ''}{user?.Institute?.zip_code ? ` - ${user.Institute.zip_code}` : ''}</p>
                                            <p style={{ margin: 0 }}><strong>Phone No:</strong> {user?.Institute?.phone || "-"}</p>
                                            <p style={{ margin: 0 }}><strong>Email Id:</strong> {user?.Institute?.email || "-"}</p>
                                        </div>
                                        <div style={{ flex: 1, textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-end' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', fontWeight: '600', fontSize: '1.1rem', color: '#0f172a' }}>
                                                <span style={{ paddingBottom: '2px' }}>Date:</span>
                                                <span style={{ display: 'inline-block', width: '180px', borderBottom: '1.5px solid #0f172a' }}></span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* FEE RECEIPT Badge */}
                                    <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                                        <span style={{ display: 'inline-block', padding: '0.5rem 2rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '20px', fontSize: '1.4rem', fontWeight: '700', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                            Fee Receipt
                                        </span>
                                    </div>

                                    {/* Transaction Details Card */}
                                    <div style={{ marginBottom: '2.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', background: '#f8fafc', padding: '2rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                        <div>
                                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Transaction ID</p>
                                            <p style={{ margin: 0, fontWeight: '700', fontSize: '1.1rem', color: '#0f172a' }}>{viewingReceipt.transaction_id}</p>
                                        </div>
                                        <div>
                                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Receipt Date</p>
                                            <p style={{ margin: 0, fontWeight: '700', fontSize: '1.1rem', color: '#0f172a' }}>{new Date(viewingReceipt.payment_date).toLocaleDateString('en-GB')}</p>
                                        </div>
                                        <div>
                                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Student Name</p>
                                            <p style={{ margin: 0, fontWeight: '700', fontSize: '1.1rem', color: '#0f172a' }}>{studentName}</p>
                                        </div>
                                        <div>
                                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Roll Number</p>
                                            <p style={{ margin: 0, fontWeight: '700', fontSize: '1.1rem', color: '#0f172a' }}>{rollNo}</p>
                                        </div>
                                    </div>

                                    {/* Fee Table */}
                                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '3rem' }}>
                                        <thead>
                                            <tr style={{ background: '#f1f5f9' }}>
                                                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: '700' }}>Description</th>
                                                <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: '700' }}>Payment Mode</th>
                                                <th style={{ padding: '1rem', textAlign: 'right', borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: '700' }}>Amount Paid</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td style={{ padding: '1.25rem 1rem', borderBottom: '1px solid #e2e8f0', color: '#0f172a', fontWeight: '600', fontSize: '1.05rem' }}>{particulars}</td>
                                                <td style={{ padding: '1.25rem 1rem', borderBottom: '1px solid #e2e8f0', textAlign: 'center', color: '#334155', textTransform: 'capitalize', fontWeight: '500' }}>{viewingReceipt.payment_method}</td>
                                                <td style={{ padding: '1.25rem 1rem', borderBottom: '1px solid #e2e8f0', textAlign: 'right', color: '#10b981', fontWeight: '800', fontSize: '1.25rem' }}>₹{parseFloat(viewingReceipt.amount_paid).toLocaleString()}</td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    {/* Footer */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '4rem', paddingTop: '2rem', borderTop: '2px dashed #e2e8f0' }}>
                                        <div style={{ fontStyle: 'italic', color: '#64748b', fontSize: '0.9rem' }}>
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

                            {/* Modal Footer Actions */}
                            <div style={{ padding: '1.25rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button onClick={() => setViewingReceipt(null)} className="btn btn-secondary" style={{ padding: '0.75rem 1.5rem', fontWeight: '600', background: '#fff', border: '1px solid #cbd5e1' }}>Close</button>
                                <button
                                    onClick={() => {
                                        const printWindow = window.open('', '_blank', 'width=900,height=900');
                                        const printContents = document.getElementById('student-printable-receipt').innerHTML;
                                        printWindow.document.write(`<html><head><title>Receipt_${viewingReceipt.transaction_id}</title><style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');body{font-family:'Inter',sans-serif;margin:0;padding:40px;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#fff}*{box-sizing:border-box}@media print{body{padding:0}@page{margin:1.5cm}}</style></head><body onload="window.print();setTimeout(()=>window.close(),500)">${printContents}</body></html>`);
                                        printWindow.document.close();
                                    }}
                                    className="btn btn-primary"
                                    style={{ background: 'linear-gradient(135deg,#4f46e5,#3b82f6)', color: 'white', border: 'none', padding: '0.75rem 1.5rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                >
                                    <span style={{ fontSize: '1.1rem' }}>🖨️</span> Print Receipt
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

export default PayFees;
