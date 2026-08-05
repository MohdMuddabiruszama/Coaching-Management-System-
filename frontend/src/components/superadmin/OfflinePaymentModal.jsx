import { useState, useEffect } from "react";
import api from "../../services/api";

function OfflinePaymentModal({ institute, onClose, onSuccess }) {
    const [plans, setPlans] = useState([]);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const [formData, setFormData] = useState({
        plan_id: "",
        amount_paid: "",
        payment_mode: "Cash",
        reference_number: "",
        notes: ""
    });

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const res = await api.get("/plans?include_hidden=true");
            setPlans(res.data.data || []);
            // Pre-select current plan if available
            if (institute.plan_id) {
                const p = res.data.data.find(x => x.id === institute.plan_id);
                if (p) {
                    setFormData(prev => ({ ...prev, plan_id: p.id, amount_paid: p.yearly_price || p.price }));
                }
            }
        } catch (err) {
            console.error("Error fetching plans", err);
            setError("Failed to load plans.");
        } finally {
            setLoadingPlans(false);
        }
    };

    const handlePlanChange = (e) => {
        const pId = e.target.value;
        const p = plans.find(x => x.id.toString() === pId);
        setFormData({
            ...formData,
            plan_id: pId,
            amount_paid: p ? (p.yearly_price || p.price) : ""
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        if (!formData.plan_id || !formData.amount_paid) {
            return setError("Plan and Amount Paid are required.");
        }

        setSubmitting(true);
        try {
            const res = await api.post(`/superadmin/institutes/${institute.id}/offline-payment`, formData);
            if (res.data.success) {
                onSuccess();
            }
        } catch (err) {
            setError(err.response?.data?.message || "Payment recording failed.");
        } finally {
            setSubmitting(false);
        }
    };

    const inputStyle = {
        width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14,
        border: '1px solid #D1D5DB', outline: 'none', boxSizing: 'border-box',
        background: '#fff', color: '#1f2937', transition: 'border-color 0.2s',
        marginBottom: '14px'
    };
    const labelStyle = { display: 'block', marginBottom: 6, fontSize: 13, color: '#374151', fontWeight: 600 };

    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '1rem'
        }}>
            <div style={{
                background: '#fff', borderRadius: 16, padding: '2rem', maxWidth: 480,
                width: '100%', boxShadow: '0 25px 80px rgba(16, 185, 129, 0.2)',
                color: '#1f2937', animation: 'fadeIn 0.2s ease', maxHeight: '90vh', overflowY: 'auto'
            }}>
                
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #D1FAE5, #A7F3D0)',
                        borderRadius: '50%', width: 52, height: 52,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <span style={{ fontSize: 24 }}>💰</span>
                    </div>
                    <div>
                        <h3 style={{ margin: 0, color: '#065F46', fontSize: 20, fontWeight: 700 }}>
                            Record Offline Payment
                        </h3>
                        <p style={{ margin: '2px 0 0', color: '#6B7280', fontSize: 13 }}>
                            Activating subscription for <strong>{institute.name}</strong>
                        </p>
                    </div>
                </div>

                {error && (
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, fontWeight: 600 }}>
                        ⚠️ {error}
                    </div>
                )}

                {loadingPlans ? (
                    <div style={{ textAlign: 'center', padding: '2rem 0', color: '#6B7280', fontSize: 14 }}>
                        <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', marginRight: 8 }}>⏳</span>
                        Loading plans...
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        
                        <div>
                            <label style={labelStyle}>Select Plan</label>
                            <select style={inputStyle} value={formData.plan_id} onChange={handlePlanChange} required disabled={submitting}>
                                <option value="">-- Choose a Plan --</option>
                                {plans.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} {p.is_hidden ? "(Custom)" : ""} - ₹{p.price}/mo
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label style={labelStyle}>Amount Paid (₹)</label>
                            <input type="number" style={{...inputStyle, marginBottom: 4}} value={formData.amount_paid} onChange={e => setFormData({...formData, amount_paid: e.target.value})} required disabled={submitting} placeholder="e.g. 5000" />
                            <p style={{ margin: '0 0 14px 0', fontSize: 11, color: '#6B7280' }}>Enter the exact amount collected.</p>
                        </div>

                        <div>
                            <label style={labelStyle}>Payment Mode</label>
                            <select style={inputStyle} value={formData.payment_mode} onChange={e => setFormData({...formData, payment_mode: e.target.value})} disabled={submitting}>
                                <option value="Cash">Cash</option>
                                <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                                <option value="Cheque">Cheque</option>
                                <option value="UPI">UPI Direct</option>
                            </select>
                        </div>

                        <div>
                            <label style={labelStyle}>Reference / Receipt Number <span style={{fontWeight: 'normal', color: '#9CA3AF'}}>(Optional)</span></label>
                            <input type="text" style={inputStyle} placeholder="e.g. Receipt #1024 or Cheque #555" value={formData.reference_number} onChange={e => setFormData({...formData, reference_number: e.target.value})} disabled={submitting} />
                        </div>

                        <div>
                            <label style={labelStyle}>Internal Notes <span style={{fontWeight: 'normal', color: '#9CA3AF'}}>(Optional)</span></label>
                            <input type="text" style={inputStyle} placeholder="e.g. Cash collected by Sales Team" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} disabled={submitting} />
                        </div>

                        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                            <button type="button" onClick={onClose} disabled={submitting}
                                style={{
                                    flex: 1, padding: '11px', borderRadius: 8, border: '1px solid #D1D5DB', 
                                    background: '#fff', cursor: submitting ? 'not-allowed' : 'pointer',
                                    fontSize: 14, color: '#4b5563', fontWeight: 600, opacity: submitting ? 0.6 : 1
                                }}>
                                Cancel
                            </button>
                            <button type="submit" disabled={submitting}
                                style={{
                                    flex: 1, padding: '11px', borderRadius: 8, border: 'none',
                                    background: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff',
                                    cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700,
                                    boxShadow: submitting ? 'none' : '0 4px 15px rgba(16, 185, 129, 0.3)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                                }}>
                                {submitting ? (
                                    <>
                                        <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                                        Processing...
                                    </>
                                ) : (
                                    <>✅ Confirm & Activate</>
                                )}
                            </button>
                        </div>

                    </form>
                )}
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}

export default OfflinePaymentModal;
