import { useState, useEffect, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import api from "../../services/api";
import { useNavigate } from "react-router-dom";
import "../admin/Dashboard.css";

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
        } catch (err) {
            setMessage({ type: "error", text: err.response?.data?.message || "Failed to update profile." });
        } finally {
            setUpdating(false);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
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
        } catch (err) {
            setMessage({ type: "error", text: err.response?.data?.message || "Failed to change password." });
        }
    };

    if (loading) return <div className="dashboard-container">Loading Profile...</div>;

    const handleBack = () => {
        if (user?.role === "student") navigate("/student/dashboard");
        else if (user?.role === "faculty") navigate("/faculty/dashboard");
        else navigate("/admin/dashboard");
    };

    const baseUser = profile?.User || profile;

    return (
        <div className="dashboard-container" style={{ padding: "20px" }}>
            <div className="dashboard-header" style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h1>👤 My Profile</h1>
                    <p>Manage your account settings and preferences.</p>
                </div>
                <button className="btn btn-secondary" onClick={handleBack}>
                    ← Back
                </button>
            </div>

            {message.text && (
                <div className={`alert alert-${message.type}`} style={{ padding: "15px", marginBottom: "20px", borderRadius: "8px", color: "#fff", backgroundColor: message.type === "success" ? "#10b981" : "#ef4444", fontWeight: "bold" }}>
                    {message.text}
                </div>
            )}

            <div className="content-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
                <div className="card">
                    <div className="card-header">
                        <h3 style={{ margin: 0, fontSize: "1.2rem", display: "flex", alignItems: "center", gap: "10px" }}>
                            ✍️ Personal Information
                        </h3>
                    </div>
                    <div className="card-body" style={{ padding: '1.5rem' }}>
                        <form onSubmit={handleProfileUpdate}>
                            <div className="form-group" style={{ marginBottom: '1.2rem' }}>
                                <label className="form-label" style={{ fontWeight: "600", color: "#374151", marginBottom: "5px", display: "block" }}>Full Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #d1d5db" }}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: '1.2rem' }}>
                                <label className="form-label" style={{ fontWeight: "600", color: "#374151", marginBottom: "5px", display: "block" }}>Email Address (Read-Only)</label>
                                <input
                                    type="email"
                                    className="form-input"
                                    value={baseUser?.email || ""}
                                    disabled
                                    style={{ width: "100%", padding: "10px", borderRadius: "6px", backgroundColor: '#f3f4f6', border: "1px solid #d1d5db", cursor: "not-allowed", color: "#6b7280" }}
                                />
                            </div>

                            {(user?.role === "student" || user?.role === "faculty") && (
                                <div className="form-group" style={{ marginBottom: '1.2rem' }}>
                                    <label className="form-label" style={{ fontWeight: "600", color: "#374151", marginBottom: "5px", display: "block" }}>Phone Number</label>
                                    <input
                                        type="tel"
                                        className="form-input"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #d1d5db" }}
                                    />
                                </div>
                            )}

                            {user?.role === "student" && (
                                <>
                                    <div className="form-group" style={{ marginBottom: '1.2rem' }}>
                                        <label className="form-label" style={{ fontWeight: "600", color: "#374151", marginBottom: "5px", display: "block" }}>Roll Number (Read-Only)</label>
                                        <input type="text" className="form-input" value={profile.roll_number || ""} disabled style={{ width: "100%", padding: "10px", borderRadius: "6px", backgroundColor: '#f3f4f6', border: "1px solid #d1d5db", cursor: "not-allowed", color: "#6b7280" }} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: '1.2rem' }}>
                                        <label className="form-label" style={{ fontWeight: "600", color: "#374151", marginBottom: "5px", display: "block" }}>Address</label>
                                        <textarea
                                            className="form-input"
                                            value={formData.address}
                                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                            rows="3"
                                            style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #d1d5db", resize: "vertical" }}
                                        />
                                    </div>
                                </>
                            )}

                            {user?.role === "faculty" && (
                                <div className="form-group" style={{ marginBottom: '1.2rem' }}>
                                    <label className="form-label" style={{ fontWeight: "600", color: "#374151", marginBottom: "5px", display: "block" }}>Designation</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.designation}
                                        onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                                        style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #d1d5db" }}
                                    />
                                </div>
                            )}

                            <button type="submit" className="btn btn-primary" disabled={updating} style={{ width: "100%", padding: "12px", borderRadius: "6px", fontWeight: "bold", backgroundColor: "#4f46e5", color: "white", border: "none", cursor: updating ? "not-allowed" : "pointer" }}>
                                {updating ? "Saving..." : "Save Profile Changes"}
                            </button>
                        </form>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 style={{ margin: 0, fontSize: "1.2rem", display: "flex", alignItems: "center", gap: "10px" }}>
                            🔒 Change Password
                        </h3>
                    </div>
                    <div className="card-body" style={{ padding: '1.5rem' }}>
                        <form onSubmit={handlePasswordChange}>
                            <div className="form-group" style={{ marginBottom: '1.2rem' }}>
                                <label className="form-label" style={{ fontWeight: "600", color: "#374151", marginBottom: "5px", display: "block" }}>Current Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPassword.oldPassword ? "text" : "password"}
                                        className="form-input"
                                        value={passwordData.oldPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                                        required
                                        style={{ width: "100%", padding: "10px", paddingRight: "40px", borderRadius: "6px", border: "1px solid #d1d5db" }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword({ ...showPassword, oldPassword: !showPassword.oldPassword })}
                                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                    >
                                        <EyeIcon visible={showPassword.oldPassword} />
                                    </button>
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: '1.2rem' }}>
                                <label className="form-label" style={{ fontWeight: "600", color: "#374151", marginBottom: "5px", display: "block" }}>New Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPassword.newPassword ? "text" : "password"}
                                        className="form-input"
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        required
                                        style={{ width: "100%", padding: "10px", paddingRight: "40px", borderRadius: "6px", border: "1px solid #d1d5db" }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword({ ...showPassword, newPassword: !showPassword.newPassword })}
                                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                    >
                                        <EyeIcon visible={showPassword.newPassword} />
                                    </button>
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label" style={{ fontWeight: "600", color: "#374151", marginBottom: "5px", display: "block" }}>Confirm New Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPassword.confirmPassword ? "text" : "password"}
                                        className="form-input"
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                        required
                                        style={{ width: "100%", padding: "10px", paddingRight: "40px", borderRadius: "6px", border: "1px solid #d1d5db" }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword({ ...showPassword, confirmPassword: !showPassword.confirmPassword })}
                                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                    >
                                        <EyeIcon visible={showPassword.confirmPassword} />
                                    </button>
                                </div>
                            </div>
                            <button type="submit" className="btn btn-warning" style={{ width: "100%", padding: "12px", borderRadius: "6px", fontWeight: "bold", backgroundColor: '#f59e0b', color: 'white', border: 'none', cursor: "pointer" }}>
                                Update Password
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Profile;
