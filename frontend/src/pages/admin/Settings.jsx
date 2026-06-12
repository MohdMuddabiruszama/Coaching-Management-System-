/**
 * Settings Page
 * Manage institute details and user security
 */

import { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import ThemeSelector from "../../components/ThemeSelector";
import "./Dashboard.css";

function Settings() {
    const { user } = useContext(AuthContext);
    const [activeTab, setActiveTab] = useState("institute"); // 'institute' or 'security'
    const [activeSection, setActiveSection] = useState("basic");
    const [loading, setLoading] = useState(false);

    // Institute Details State
    const [institute, setInstitute] = useState({
        name: "",
        email: "",
        phone: "",
        address: "",
        logo: "",
        facebook: "",
        twitter: "",
        instagram: ""
    });

    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);

    // Password Change State
    const [passwords, setPasswords] = useState({
        oldPassword: "",
        newPassword: "",
        confirmPassword: ""
    });

    const [showPwd, setShowPwd] = useState({
        old: false,
        new: false,
        confirm: false
    });

    useEffect(() => {
        if (user && user.institute_id) {
            fetchInstituteDetails();
        }
    }, [user]);

    const fetchInstituteDetails = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/institutes/${user.institute_id}`);
            setInstitute(res.data.data);
            if (res.data.data.logo) {
                let logoPath = res.data.data.logo;
                if (logoPath.startsWith('/')) {
                    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
                    const backendBase = apiUrl.replace(/\/api\/?$/, ""); 
                    logoPath = `${backendBase}${logoPath}`;
                }
                setLogoPreview(logoPath);
            }
        } catch (error) {
            console.error("Error fetching institute details", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setLogoFile(file);
            const previewUrl = URL.createObjectURL(file);
            setLogoPreview(previewUrl);
        }
    };

    const handleInstituteUpdate = async (e) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            formData.append("name", institute.name);
            formData.append("email", institute.email);
            formData.append("phone", institute.phone || "");
            formData.append("address", institute.address || "");
            if (institute.facebook) formData.append("facebook", institute.facebook);
            if (institute.twitter) formData.append("twitter", institute.twitter);
            if (institute.instagram) formData.append("instagram", institute.instagram);
            if (logoFile) {
                formData.append("logo", logoFile);
            }

            await api.put(`/institutes/${user.institute_id}`, formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            alert("Institute details updated successfully");
            
            // Force reload to sync global AuthContext (e.g., Navbar Logo)
            window.location.reload();
        } catch (error) {
            alert(error.response?.data?.message || "Error updating settings");
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (passwords.newPassword !== passwords.confirmPassword) {
            alert("New passwords do not match");
            return;
        }
        try {
            await api.post("/auth/change-password", {
                oldPassword: passwords.oldPassword,
                newPassword: passwords.newPassword
            });
            alert("Password changed successfully");
            setPasswords({ oldPassword: "", newPassword: "", confirmPassword: "" });
        } catch (error) {
            alert(error.response?.data?.message || "Error changing password");
        }
    };

    return (
        <div style={{ padding: '24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f3e8ff', color: '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                        ⚙️
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#111827' }}>Settings</h1>
                        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>Manage your institute preferences and configuration</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '32px', borderBottom: '1px solid #e5e7eb', marginBottom: '32px' }}>
                <button
                    onClick={() => { setActiveTab("institute"); setActiveSection("basic"); }}
                    style={{
                        padding: '12px 0',
                        border: 'none',
                        background: 'none',
                        borderBottom: activeTab === "institute" ? '2px solid #7e22ce' : '2px solid transparent',
                        color: activeTab === "institute" ? '#7e22ce' : '#6b7280',
                        fontWeight: activeTab === "institute" ? 700 : 500,
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    Institute Details
                </button>
                <button
                    onClick={() => { setActiveTab("security"); setActiveSection("security"); }}
                    style={{
                        padding: '12px 0',
                        border: 'none',
                        background: 'none',
                        borderBottom: activeTab === "security" ? '2px solid #7e22ce' : '2px solid transparent',
                        color: activeTab === "security" ? '#7e22ce' : '#6b7280',
                        fontWeight: activeTab === "security" ? 700 : 500,
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    Security
                </button>
            </div>

            <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
                {/* Left Sidebar */}
                <div style={{ width: '250px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                        { id: 'basic', label: 'Basic Information', icon: '🏢' },
                        { id: 'contact', label: 'Contact Details', icon: '📞' },
                        { id: 'address', label: 'Address', icon: '🗺️' },
                        { id: 'social', label: 'Social Media', icon: '🔗' },
                        { id: 'appearance', label: 'Appearance', icon: '🎨' },
                        { id: 'divider', label: '', icon: '' },
                        { id: 'security', label: 'Security', icon: '🛡️' },
                    ].map(nav => nav.id === 'divider' ? (
                        <div key="divider" style={{ height: '1px', background: '#e5e7eb', margin: '8px 0' }}></div>
                    ) : (
                        <div key={nav.id} onClick={() => { setActiveSection(nav.id); setActiveTab(nav.id === 'security' ? 'security' : 'institute'); }} style={{ 
                            padding: '12px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                            background: nav.id === activeSection ? '#f3e8ff' : 'transparent',
                            color: nav.id === activeSection ? '#7e22ce' : '#4b5563',
                            fontWeight: nav.id === activeSection ? 700 : 500,
                            transition: 'all 0.2s'
                        }}>
                            <span style={{ fontSize: '1.2rem', opacity: nav.id === activeSection ? 1 : 0.5 }}>{nav.icon}</span>
                            <span style={{ fontSize: '0.9rem' }}>{nav.label}</span>
                        </div>
                    ))}
                </div>

                {/* Right Content */}
                <div style={{ flex: 1, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '32px', minHeight: '400px' }}>
                    {activeTab === "institute" ? (
                        <form onSubmit={handleInstituteUpdate}>
                            {activeSection === 'basic' && (
                                <>
                                    <h3 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 800, color: '#111827' }}>Basic Information</h3>
                                    <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: '0.9rem' }}>Update your institute's basic information and logo</p>
                            
                                    <div style={{ marginBottom: '24px' }}>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#374151' }}>Institute Logo</label>
                                        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                                            <div style={{ 
                                                width: '80px', height: '80px', borderRadius: '50%', 
                                                border: '1px solid #e5e7eb', display: 'flex', 
                                                alignItems: 'center', justifyContent: 'center',
                                                overflow: 'hidden', backgroundColor: '#f9fafb', flexShrink: 0
                                            }}>
                                                {logoPreview ? (
                                                    <img src={logoPreview} alt="Logo Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                ) : (
                                                    <span style={{ fontSize: '2rem', color: '#9ca3af' }}>🏢</span>
                                                )}
                                            </div>
                                            <div>
                                                <div style={{ position: 'relative', border: '2px dashed #d8b4fe', borderRadius: '12px', padding: '16px 24px', textAlign: 'center', background: '#faf5ff', cursor: 'pointer', transition: 'all 0.2s' }}>
                                                    <input 
                                                        type="file" 
                                                        accept="image/*" 
                                                        onChange={handleFileChange}
                                                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                                                    />
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#7e22ce', fontSize: '0.9rem', fontWeight: 600 }}>
                                                        <span style={{ fontSize: '1.2rem', background: '#f3e8ff', padding: '4px', borderRadius: '6px' }}>📤</span>
                                                        Click to upload or drag and drop
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px' }}>PNG, JPG up to 2MB</div>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '8px' }}>Recommended size: 200x200px</div>
                                            </div>
                                        </div>
                                    </div>
                            
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '24px' }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#374151' }}>Institute Name <span style={{ color: '#ef4444' }}>*</span></label>
                                            <input
                                                type="text"
                                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e5e7eb', outline: 'none', fontSize: '0.9rem', color: '#111827' }}
                                                value={institute.name}
                                                onChange={e => setInstitute({ ...institute, name: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {activeSection === 'contact' && (
                                <>
                                    <h3 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 800, color: '#111827' }}>Contact Details</h3>
                                    <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: '0.9rem' }}>Manage primary contact methods</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#374151' }}>Email Address <span style={{ color: '#ef4444' }}>*</span></label>
                                            <input
                                                type="email"
                                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e5e7eb', outline: 'none', fontSize: '0.9rem', color: '#4b5563', backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                                                value={institute.email}
                                                readOnly
                                                title="Contact Super Admin to change email"
                                            />
                                            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>Email cannot be changed directly.</div>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#374151' }}>Phone Number <span style={{ color: '#ef4444' }}>*</span></label>
                                            <input
                                                type="tel"
                                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e5e7eb', outline: 'none', fontSize: '0.9rem', color: '#111827' }}
                                                value={institute.phone || ""}
                                                onChange={e => setInstitute({ ...institute, phone: e.target.value })}
                                                placeholder="+91 9876543210"
                                                required
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {activeSection === 'address' && (
                                <>
                                    <h3 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 800, color: '#111827' }}>Address</h3>
                                    <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: '0.9rem' }}>Update the physical location of your institute</p>
                                    <div style={{ marginBottom: '24px' }}>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#374151' }}>Full Address <span style={{ color: '#ef4444' }}>*</span></label>
                                        <textarea
                                            rows="4"
                                            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e5e7eb', outline: 'none', fontSize: '0.9rem', color: '#111827', resize: 'vertical' }}
                                            value={institute.address || ""}
                                            onChange={e => setInstitute({ ...institute, address: e.target.value })}
                                            placeholder="Enter your complete address..."
                                            required
                                        ></textarea>
                                    </div>
                                </>
                            )}

                            {activeSection === 'social' && (
                                <>
                                    <h3 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 800, color: '#111827' }}>Social Media</h3>
                                    <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: '0.9rem' }}>Link your institute's social media profiles</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '24px', maxWidth: '500px' }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#374151' }}>Facebook URL</label>
                                            <input type="url" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e5e7eb', outline: 'none', fontSize: '0.9rem' }} value={institute.facebook || ""} onChange={e => setInstitute({ ...institute, facebook: e.target.value })} placeholder="https://facebook.com/..." />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#374151' }}>Twitter / X URL</label>
                                            <input type="url" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e5e7eb', outline: 'none', fontSize: '0.9rem' }} value={institute.twitter || ""} onChange={e => setInstitute({ ...institute, twitter: e.target.value })} placeholder="https://twitter.com/..." />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#374151' }}>Instagram URL</label>
                                            <input type="url" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e5e7eb', outline: 'none', fontSize: '0.9rem' }} value={institute.instagram || ""} onChange={e => setInstitute({ ...institute, instagram: e.target.value })} placeholder="https://instagram.com/..." />
                                        </div>
                                    </div>
                                </>
                            )}

                            {activeSection === 'appearance' && (
                                <>
                                    <h3 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 800, color: '#111827' }}>Appearance</h3>
                                    <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: '0.9rem' }}>Customize the look and feel of the platform</p>
                                    <div style={{ marginBottom: '32px' }}>
                                        <label style={{ display: 'block', marginBottom: '12px', fontSize: '0.85rem', fontWeight: 700, color: '#374151' }}>Global Theme</label>
                                        <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '12px', background: '#f9fafb', display: 'inline-block' }}>
                                            <ThemeSelector />
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '12px' }}>This will apply the selected theme across the entire dashboard instantly.</div>
                                    </div>
                                </>
                            )}

                            {(activeSection === 'basic' || activeSection === 'contact' || activeSection === 'address' || activeSection === 'social') && (
                                <button type="submit" style={{ background: '#7e22ce', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>💾</span> Save Changes
                                </button>
                            )}
                        </form>
                    ) : (
                        <form onSubmit={handlePasswordChange}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f3e8ff', color: '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                                    🛡️
                                </div>
                                <div>
                                    <h3 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 800, color: '#111827' }}>Change Password</h3>
                                    <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>Ensure your account is using a long, random password to stay secure.</p>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#374151' }}>Current Password</label>
                                    <div style={{ position: 'relative' }}>
                                        <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>🔒</span>
                                        <input
                                            type={showPwd.old ? "text" : "password"}
                                            style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: '8px', border: '1px solid #e5e7eb', outline: 'none', fontSize: '0.9rem', color: '#111827' }}
                                            value={passwords.oldPassword}
                                            onChange={e => setPasswords({ ...passwords, oldPassword: e.target.value })}
                                            required
                                        />
                                        <span onClick={() => setShowPwd(s => ({ ...s, old: !s.old }))} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', cursor: 'pointer', userSelect: 'none' }}>
                                            {showPwd.old ? '👁️' : '👁️‍🗨️'}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#374151' }}>New Password</label>
                                    <div style={{ position: 'relative' }}>
                                        <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>🔒</span>
                                        <input
                                            type={showPwd.new ? "text" : "password"}
                                            style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: '8px', border: '1px solid #e5e7eb', outline: 'none', fontSize: '0.9rem', color: '#111827' }}
                                            value={passwords.newPassword}
                                            onChange={e => setPasswords({ ...passwords, newPassword: e.target.value })}
                                            required
                                            minLength="6"
                                        />
                                        <span onClick={() => setShowPwd(s => ({ ...s, new: !s.new }))} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', cursor: 'pointer', userSelect: 'none' }}>
                                            {showPwd.new ? '👁️' : '👁️‍🗨️'}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#374151' }}>Confirm New Password</label>
                                    <div style={{ position: 'relative' }}>
                                        <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>🔒</span>
                                        <input
                                            type={showPwd.confirm ? "text" : "password"}
                                            style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: '8px', border: '1px solid #e5e7eb', outline: 'none', fontSize: '0.9rem', color: '#111827' }}
                                            value={passwords.confirmPassword}
                                            onChange={e => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                                            required
                                            minLength="6"
                                        />
                                        <span onClick={() => setShowPwd(s => ({ ...s, confirm: !s.confirm }))} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', cursor: 'pointer', userSelect: 'none' }}>
                                            {showPwd.confirm ? '👁️' : '👁️‍🗨️'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ background: '#f5f3ff', border: '1px solid #ede9fe', borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', color: '#6d28d9', fontSize: '0.85rem', marginBottom: '24px' }}>
                                <span style={{ fontSize: '1.2rem' }}>🛡️</span>
                                <span>Password must be at least 8 characters and include a mix of letters, numbers and symbols.</span>
                            </div>

                            <button type="submit" style={{ background: '#7e22ce', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>🔒</span> Update Password
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Settings;
