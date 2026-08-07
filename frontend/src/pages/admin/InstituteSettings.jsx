/**
 * Institute Settings Page
 * Complete institute profile after registration
 */

import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import "./Dashboard.css";

function InstituteSettings() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    const [instituteData, setInstituteData] = useState(null);

    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        address: "",
        logo: "",
        id_card_settings: {
            theme: { primary_color: '#1e3a8a', text_color: '#ffffff' },
            visible_fields: {
                photo: true,
                student_name: true,
                roll_no: true,
                parent_name: true,
                email: true,
                parent_phone: true,
                class: true,
                gender: true,
                address: true
            }
        }
    });

    const [invoices, setInvoices] = useState([]);

    useEffect(() => {
        fetchInstituteData();
        fetchInvoices();
    }, []);

    const fetchInvoices = async () => {
        try {
            const res = await api.get('/invoices');
            if (res.data.success) {
                setInvoices(res.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch invoices");
        }
    };

    const fetchInstituteData = async () => {
        try {
            const response = await api.get(`/institutes/${user.institute_id}`);
            const institute = response.data.data;
            setInstituteData(institute);
            setFormData({
                name: institute.name || "",
                phone: institute.phone || "",
                address: institute.address || "",
                logo: institute.logo || "",
                id_card_settings: institute.id_card_settings || {
                    theme: { primary_color: '#1e3a8a', text_color: '#ffffff' },
                    visible_fields: {
                        photo: true, student_name: true, roll_no: true,
                        parent_name: true, email: true, parent_phone: true,
                        class: true, gender: true, address: true
                    }
                }
            });
        } catch (error) {
            console.error("Error fetching institute:", error);
        }
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
        setError("");
    };

    const handleIdCardThemeChange = (field, value) => {
        setFormData({
            ...formData,
            id_card_settings: {
                ...formData.id_card_settings,
                theme: {
                    ...formData.id_card_settings.theme,
                    [field]: value
                }
            }
        });
        setError("");
    };

    const handleIdCardFieldChange = (field, checked) => {
        setFormData({
            ...formData,
            id_card_settings: {
                ...formData.id_card_settings,
                visible_fields: {
                    ...formData.id_card_settings.visible_fields,
                    [field]: checked
                }
            }
        });
        setError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            await api.put(`/institutes/${user.institute_id}`, formData);
            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                fetchInstituteData();
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to update institute");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <h1>Institute Settings</h1>
                    <p>Complete your institute profile</p>
                </div>
            </div>

            {success && (
                <div className="alert alert-success" style={{ marginBottom: "1rem" }}>
                    <span>✅</span>
                    <span>Institute details updated successfully!</span>
                </div>
            )}

            {error && (
                <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
                    <span>⚠️</span>
                    <span>{error}</span>
                </div>
            )}

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Institute Information</h3>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>
                    <div className="form-group">
                        <label className="form-label">Institute Name *</label>
                        <input
                            type="text"
                            name="name"
                            className="form-input"
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Phone Number *</label>
                        <input
                            type="tel"
                            name="phone"
                            className="form-input"
                            placeholder="9876543210"
                            value={formData.phone}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Address *</label>
                        <textarea
                            name="address"
                            className="form-textarea"
                            rows="3"
                            placeholder="Complete address with city and pincode"
                            value={formData.address}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Logo URL (Optional)</label>
                        <input
                            type="text"
                            name="logo"
                            className="form-input"
                            placeholder="https://example.com/logo.png"
                            value={formData.logo}
                            onChange={handleChange}
                        />
                    </div>

                    {instituteData && (
                        <div className="form-group">
                            <label className="form-label">Current Plan</label>
                            <div style={{
                                padding: "0.75rem",
                                background: "#f3f4f6",
                                borderRadius: "0.5rem",
                                marginTop: "0.5rem"
                            }}>
                                <p><strong>Plan:</strong> {instituteData.Plan?.name || "No Plan"}</p>
                                <p><strong>Status:</strong> {instituteData.status}</p>
                                {instituteData.subscription_end && (
                                    <p><strong>Expires:</strong> {new Date(instituteData.subscription_end).toLocaleDateString()}</p>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="card-header" style={{ marginTop: '2rem', paddingLeft: 0, paddingRight: 0 }}>
                        <h3 className="card-title">ID Card Configuration</h3>
                        <p style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Customize the appearance and visible fields of the Student and Faculty ID cards.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div className="form-group">
                            <label className="form-label">Primary Color</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="color"
                                    value={formData.id_card_settings.theme.primary_color}
                                    onChange={(e) => handleIdCardThemeChange('primary_color', e.target.value)}
                                    style={{ width: '50px', height: '40px', padding: 0, border: 'none', cursor: 'pointer' }}
                                />
                                <span>{formData.id_card_settings.theme.primary_color}</span>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Text Color (on Primary)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="color"
                                    value={formData.id_card_settings.theme.text_color}
                                    onChange={(e) => handleIdCardThemeChange('text_color', e.target.value)}
                                    style={{ width: '50px', height: '40px', padding: 0, border: 'none', cursor: 'pointer' }}
                                />
                                <span>{formData.id_card_settings.theme.text_color}</span>
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Visible Fields</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                            {Object.entries({
                                photo: "Show Photo",
                                student_name: "Show Name",
                                roll_no: "Show Roll No / ID",
                                parent_name: "Show Parent Name",
                                email: "Show Email",
                                parent_phone: "Show Parent Phone",
                                class: "Show Class/Department",
                                gender: "Show Gender",
                                address: "Show Address"
                            }).map(([key, label]) => (
                                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.id_card_settings.visible_fields[key]}
                                        onChange={(e) => handleIdCardFieldChange(key, e.target.checked)}
                                        style={{ width: '1.25rem', height: '1.25rem', accentColor: 'var(--primary-color)' }}
                                    />
                                    <span>{label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? "Saving..." : "Save Changes"}
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => navigate("/admin/dashboard")}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>

            {/* Subscription Section */}
            <div className="card" style={{ marginTop: "2rem" }}>
                <div className="card-header">
                    <h3 className="card-title">Billing & Subscription Management</h3>
                </div>
                <div style={{ padding: "1.5rem" }}>
                    <p style={{ marginBottom: "1rem" }}>Manage your current plan, upgrade options, and download past invoices.</p>
                    <button
                        className="btn btn-primary"
                        style={{ marginBottom: "2rem" }}
                        onClick={() => navigate("/pricing")}
                    >
                        View Plans & Upgrade
                    </button>

                    <h4 style={{ marginBottom: "1rem", borderBottom: "1px solid #eee", paddingBottom: "0.5rem" }}>Past Invoices</h4>
                    {invoices.length === 0 ? (
                        <p style={{ color: "#6b7280" }}>No invoices found.</p>
                    ) : (
                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Invoice No</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map(inv => (
                                        <tr key={inv.id}>
                                            <td>{new Date(inv.createdAt).toLocaleDateString()}</td>
                                            <td>{inv.invoice_number}</td>
                                            <td>₹{inv.amount}</td>
                                            <td>
                                                <span className={`badge badge-success`}>Paid</span>
                                            </td>
                                            <td>
                                                {inv.file_path ? (
                                                    <a 
                                                        href={`/api/invoices/download/${inv.file_path.split('/').pop().split('\\').pop()}`} 
                                                        target="_blank" 
                                                        rel="noreferrer"
                                                        className="btn btn-sm btn-secondary"
                                                        style={{ textDecoration: 'none', backgroundColor: "#4f46e5", color: "white" }}
                                                    >
                                                        ⬇ Download
                                                    </a>
                                                ) : (
                                                    <span style={{color: '#9ca3af', fontSize: '0.875rem'}}>No PDF</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default InstituteSettings;
