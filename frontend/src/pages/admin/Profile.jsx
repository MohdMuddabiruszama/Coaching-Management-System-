import { useState, useEffect, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import api from "../../services/api";
import { useNavigate } from "react-router-dom";
import "./Profile.css";

const EyeIcon = ({ visible }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {visible ? (
            <>
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
            </>
        ) : (
            <>
                <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" />
                <circle cx="12" cy="12" r="3" />
            </>
        )}
    </svg>
);

function Profile() {
    const { user, setUser } = useContext(AuthContext);
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [activeTab, setActiveTab] = useState("personal");

    // Editable fields
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        address: "",
        designation: ""
    });

    const [passwordData, setPasswordData] = useState({
        oldPassword: "",
        newPassword: "",
        confirmPassword: ""
    });

    const [showPassword, setShowPassword] = useState({
        oldPassword: false,
        newPassword: false,
        confirmPassword: false
    });

    const [message, setMessage] = useState({ type: "", text: "" });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            let res;
            if (user?.role === "student") {
                res = await api.get("/students/me");
            } else if (user?.role === "faculty") {
                res = await api.get("/faculty/me");
            } else {
                res = await api.get("/auth/profile");
            }

            const data = res.data.data || res.data.user;
            setProfile(data);

            const userData = data.User || data; // Student/Faculty wrap user details inside User relation, auth/profile returns it directly

            setFormData({
                name: userData?.name || "",
                phone: userData?.phone || data.phone || "",
                address: data.address || "",
                designation: data.designation || ""
            });

        } catch (err) {
            console.error(err);
            setMessage({ type: "error", text: "Failed to load profile details." });
        } finally {
            setLoading(false);
        }
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setMessage({ type: "", text: "" });
        setUpdating(true);

        try {
            if (user?.role === "student") {
                await api.put(`/students/${profile.id}`, {
                    name: formData.name,
                    phone: formData.phone,
                    address: formData.address
                });
            } else if (user?.role === "faculty") {
                await api.put(`/faculty/${profile.id}`, {
                    name: formData.name,
                    phone: formData.phone,
                    designation: formData.designation
                });
            } else {
                await api.put("/auth/profile", {
                    name: formData.name,
                    email: profile.email || profile.User?.email
                });
            }

            // Update local user context if name changed
            const updatedUser = { ...user, name: formData.name };
            localStorage.setItem("user", JSON.stringify(updatedUser));
            setUser(updatedUser);

            setMessage({ type: "success", text: "Profile updated successfully." });
            fetchProfile();
            
            // clear success message after 3 seconds
            setTimeout(() => setMessage({ type: "", text: "" }), 3000);
        } catch (err) {
            setMessage({ type: "error", text: err.response?.data?.message || "Failed to update profile." });
        } finally {
            setUpdating(false);
        }
    };

    const handlePasswordChange = async (e) => {
        if (e) e.preventDefault();
        setMessage({ type: "", text: "" });

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            return setMessage({ type: "error", text: "New passwords do not match." });
        }
        if (passwordData.newPassword.length < 8) {
            return setMessage({ type: "error", text: "Password must be at least 8 characters long." });
        }

        try {
            await api.post("/auth/change-password", {
                oldPassword: passwordData.oldPassword,
                newPassword: passwordData.newPassword
            });
            setMessage({ type: "success", text: "Password changed successfully." });
            setPasswordData({ oldPassword: "", newPassword: "", confirmPassword: "" });
            
            // clear success message after 3 seconds
            setTimeout(() => setMessage({ type: "", text: "" }), 3000);
        } catch (err) {
            setMessage({ type: "error", text: err.response?.data?.message || "Failed to change password." });
        }
    };

    if (loading) return <div className="profile-container" style={{ textAlign: 'center', padding: '3rem' }}>Loading Profile...</div>;

    const handleBack = () => {
        if (user?.role === "student") navigate("/student/dashboard");
        else if (user?.role === "faculty") navigate("/faculty/dashboard");
        else navigate("/admin/dashboard");
    };

    const baseUser = profile?.User || profile;
    
    // Format initials
    const getInitials = (name) => {
        if (!name) return "U";
        const parts = name.split(" ");
        if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.substring(0, 2).toUpperCase();
    };

    return (
        <div className="profile-container">
            <div className="profile-header-area">
                <div className="profile-title-wrapper">
                    <div className="profile-title-icon">
                        👤
                    </div>
                    <div className="profile-title-text">
                        <h1>My Profile</h1>
                        <p>Manage your personal information and account settings</p>
                    </div>
                </div>
            </div>

            {message.text && (
                <div className={`alert alert-${message.type}`} style={{ padding: "15px", marginBottom: "20px", borderRadius: "8px", color: "#fff", backgroundColor: message.type === "success" ? "#10b981" : "#ef4444", fontWeight: "bold" }}>
                    {message.text}
                </div>
            )}

            <div className="profile-grid">
                {/* LEFT CARD */}
                <div className="profile-card-left">
                    <div className="profile-avatar-wrapper">
                        <div className="profile-avatar">
                            {getInitials(formData.name)}
                        </div>

                    </div>
                    
                    <h2 className="profile-name">{formData.name}</h2>
                    <div className="profile-role-badge">
                        {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User'}
                    </div>

                    <div className="profile-details-list">
                        {user?.role === "student" && (
                            <div className="profile-detail-item">
                                <span className="profile-detail-icon">📅</span>
                                <div className="profile-detail-content">
                                    <h5>Roll Number</h5>
                                    <p>{profile?.roll_number || 'N/A'}</p>
                                </div>
                            </div>
                        )}
                        {user?.role === "faculty" && (
                            <div className="profile-detail-item">
                                <span className="profile-detail-icon">🏢</span>
                                <div className="profile-detail-content">
                                    <h5>Emp No</h5>
                                    <p>{profile?.emp_no || (profile?.id ? `EMP-${String(profile.id).padStart(4, '0')}` : 'N/A')}</p>
                                </div>
                            </div>
                        )}
                        <div className="profile-detail-item">
                            <span className="profile-detail-icon">✉️</span>
                            <div className="profile-detail-content">
                                <h5>Email</h5>
                                <p>{baseUser?.email || 'N/A'}</p>
                            </div>
                        </div>
                        {(user?.role === "student" || user?.role === "faculty") && (
                            <div className="profile-detail-item">
                                <span className="profile-detail-icon">📞</span>
                                <div className="profile-detail-content">
                                    <h5>Phone</h5>
                                    <p>{formData.phone || 'N/A'}</p>
                                </div>
                            </div>
                        )}
                        {(user?.role === "student" || user?.role === "faculty") && (
                            <div className="profile-detail-item">
                                <span className="profile-detail-icon">🏠</span>
                                <div className="profile-detail-content">
                                    <h5>Address</h5>
                                    <p>{formData.address || 'N/A'}</p>
                                </div>
                            </div>
                        )}
                        <div className="profile-detail-item">
                            <span className="profile-detail-icon">📅</span>
                            <div className="profile-detail-content">
                                <h5>{user?.role === "student" ? "Admission Date" : "Member Since"}</h5>
                                <p>
                                    {user?.role === "student"
                                        ? profile?.admission_date
                                            ? new Date(profile.admission_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                                            : 'N/A'
                                        : user?.role === "faculty"
                                            ? (profile?.join_date || profile?.created_at || baseUser?.created_at)
                                                ? new Date(profile.join_date || profile.created_at || baseUser.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                                                : 'N/A'
                                            : (baseUser?.createdAt || baseUser?.created_at)
                                                ? new Date(baseUser.createdAt || baseUser.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                                                : 'N/A'
                                    }
                                </p>
                            </div>
                        </div>
                    </div>


                </div>

                {/* RIGHT CARD */}
                <div className="profile-card-right">
                    <div className="profile-tabs">
                        <div className="profile-tab active" style={{ cursor: 'default' }}>
                            🔒 Security
                        </div>
                    </div>

                    <div className="profile-form-area">
                        <form onSubmit={handlePasswordChange}>
                            <div className="profile-security-header">
                                <div>
                                    <h3>🔒 Change Password</h3>
                                    <p>Update your password regularly to keep your account secure.</p>
                                </div>
                            </div>

                            <div className="profile-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                                <div className="profile-form-group">
                                    <label>Current Password</label>
                                    <div className="profile-input-wrapper">
                                        <input
                                            type={showPassword.oldPassword ? "text" : "password"}
                                            className="profile-input"
                                            value={passwordData.oldPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                                            placeholder="Enter current password"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword({ ...showPassword, oldPassword: !showPassword.oldPassword })}
                                            style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                                        >
                                            <EyeIcon visible={showPassword.oldPassword} />
                                        </button>
                                    </div>
                                </div>

                                <div className="profile-form-grid" style={{ marginBottom: 0 }}>
                                    <div className="profile-form-group">
                                        <label>New Password</label>
                                        <div className="profile-input-wrapper">
                                            <input
                                                type={showPassword.newPassword ? "text" : "password"}
                                                className="profile-input"
                                                value={passwordData.newPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                                placeholder="Enter new password"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword({ ...showPassword, newPassword: !showPassword.newPassword })}
                                                style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                                            >
                                                <EyeIcon visible={showPassword.newPassword} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="profile-form-group">
                                        <label>Confirm New Password</label>
                                        <div className="profile-input-wrapper">
                                            <input
                                                type={showPassword.confirmPassword ? "text" : "password"}
                                                className="profile-input"
                                                value={passwordData.confirmPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                                placeholder="Confirm new password"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword({ ...showPassword, confirmPassword: !showPassword.confirmPassword })}
                                                style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                                            >
                                                <EyeIcon visible={showPassword.confirmPassword} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button type="submit" className="profile-save-btn" style={{ marginTop: '2rem' }}>
                                🔒 Update Password
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Profile;
