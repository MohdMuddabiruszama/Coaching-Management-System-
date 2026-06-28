/**
 * Super Admin - Settings
 * Manage profile, security, application settings, and OTP mode toggle
 */

import { useState, useEffect } from "react";
import api from "../../services/api";
import BackButton from "../../components/common/BackButton";
import "../admin/Dashboard.css";

function Settings() {
    const [activeTab, setActiveTab] = useState("account");
    const [profile, setProfile] = useState({ name: "", email: "" });
    const [passwordData, setPasswordData] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ type: "", text: "" });

    // ── OTP Mode state ──
    const [otpTestMode, setOtpTestMode]       = useState(false);
    const [otpModeLoading, setOtpModeLoading] = useState(false);
    const [otpModeFetched, setOtpModeFetched] = useState(false);

    useEffect(() => {
        fetchProfile();
        fetchOtpMode();
    }, []);

    const fetchProfile = async () => {
        try {
            const response = await api.get("/auth/profile");
            setProfile(response.data.user);
        } catch (error) {
            console.error("Error fetching profile:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchOtpMode = async () => {
        try {
            const res = await api.get("/auth/otp-mode");
            setOtpTestMode(res.data.testMode === true);
        } catch (e) {
            console.warn("Could not fetch OTP mode:", e.message);
        } finally {
            setOtpModeFetched(true);
        }
    };

    const handleOtpModeToggle = async (newTestMode) => {
        setOtpModeLoading(true);
        setMessage({ type: "", text: "" });
        try {
            const res = await api.put("/superadmin/otp-mode", { testMode: newTestMode });
            if (res.data.success) {
                setOtpTestMode(newTestMode);
                setMessage({
                    type: "success",
                    text: `✅ ${res.data.message}`
                });
            }
        } catch (err) {
            setMessage({
                type: "error",
                text: err.response?.data?.message || "Failed to update OTP mode"
            });
        } finally {
            setOtpModeLoading(false);
        }
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setMessage({ type: "", text: "" });
        try {
            await api.put("/auth/profile", profile);
            setMessage({ type: "success", text: "Profile updated successfully" });
        } catch (error) {
            setMessage({ type: "error", text: error.response?.data?.message || "Failed to update profile" });
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setMessage({ type: "", text: "" });

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setMessage({ type: "error", text: "New passwords do not match" });
            return;
        }

        try {
            await api.post("/auth/change-password", {
                oldPassword: passwordData.oldPassword,
                newPassword: passwordData.newPassword
            });
            setMessage({ type: "success", text: "Password changed successfully" });
            setPasswordData({ oldPassword: "", newPassword: "", confirmPassword: "" });
        } catch (error) {
            setMessage({ type: "error", text: error.response?.data?.message || "Failed to change password" });
        }
    };

    const tabStyle = (tab) => ({
        padding: "0.75rem 1.5rem",
        border: "none",
        background: "none",
        borderBottom: activeTab === tab ? "2px solid #6366f1" : "2px solid transparent",
        color: activeTab === tab ? "#6366f1" : "#6b7280",
        fontWeight: activeTab === tab ? "600" : "400",
        cursor: "pointer",
        fontSize: "1rem"
    });

    if (loading) return <div className="dashboard-container">Loading...</div>;

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <h1>⚙️ Settings</h1>
                    <p>Manage your account and preferences</p>
                </div>
                <BackButton />
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", borderBottom: "1px solid #e5e7eb", flexWrap: "wrap" }}>
                <button style={tabStyle("account")} onClick={() => { setActiveTab("account"); setMessage({ type: "", text: "" }); }}>
                    Account
                </button>
                <button style={tabStyle("security")} onClick={() => { setActiveTab("security"); setMessage({ type: "", text: "" }); }}>
                    Security
                </button>
                <button style={tabStyle("otpmode")} onClick={() => { setActiveTab("otpmode"); setMessage({ type: "", text: "" }); }}>
                    🧪 OTP Mode
                </button>
                <button style={tabStyle("system")} onClick={() => { setActiveTab("system"); setMessage({ type: "", text: "" }); }}>
                    System Info
                </button>
            </div>

            {/* Message Alert */}
            {message.text && (
                <div style={{
                    padding: "1rem",
                    borderRadius: "0.5rem",
                    marginBottom: "1.5rem",
                    backgroundColor: message.type === "success" ? "#dcfce7" : "#fee2e2",
                    color: message.type === "success" ? "#166534" : "#991b1b",
                    border: `1px solid ${message.type === "success" ? "#bbf7d0" : "#fecaca"}`
                }}>
                    {message.text}
                </div>
            )}

            {/* Account Settings */}
            {activeTab === "account" && (
                <div className="card" style={{ maxWidth: "600px", padding: "2rem" }}>
                    <h3 style={{ marginBottom: "1.5rem" }}>Profile Information</h3>
                    <form onSubmit={handleProfileUpdate}>
                        <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Name</label>
                            <input
                                type="text"
                                className="form-input"
                                value={profile.name}
                                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                                required
                                style={{ width: "100%", padding: "0.75rem", borderRadius: "0.375rem", border: "1px solid #d1d5db" }}
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Email</label>
                            <input
                                type="email"
                                className="form-input"
                                value={profile.email}
                                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                required
                                style={{ width: "100%", padding: "0.75rem", borderRadius: "0.375rem", border: "1px solid #d1d5db" }}
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ marginTop: "1rem" }}>
                            Save Changes
                        </button>
                    </form>
                </div>
            )}

            {/* Security Settings */}
            {activeTab === "security" && (
                <div className="card" style={{ maxWidth: "600px", padding: "2rem" }}>
                    <h3 style={{ marginBottom: "1.5rem" }}>Change Password</h3>
                    <form onSubmit={handlePasswordChange}>
                        <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Current Password</label>
                            <input
                                type="password"
                                className="form-input"
                                value={passwordData.oldPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                                required
                                style={{ width: "100%", padding: "0.75rem", borderRadius: "0.375rem", border: "1px solid #d1d5db" }}
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>New Password</label>
                            <input
                                type="password"
                                className="form-input"
                                value={passwordData.newPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                required
                                minLength="6"
                                style={{ width: "100%", padding: "0.75rem", borderRadius: "0.375rem", border: "1px solid #d1d5db" }}
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Confirm New Password</label>
                            <input
                                type="password"
                                className="form-input"
                                value={passwordData.confirmPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                required
                                minLength="6"
                                style={{ width: "100%", padding: "0.75rem", borderRadius: "0.375rem", border: "1px solid #d1d5db" }}
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ marginTop: "1rem" }}>
                            Update Password
                        </button>
                    </form>
                </div>
            )}

            {/* ─── OTP Mode Tab ─────────────────────────────────────────────────── */}
            {activeTab === "otpmode" && (
                <div className="card" style={{ maxWidth: "680px", padding: "2rem" }}>
                    <h3 style={{ marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "8px" }}>
                        🧪 OTP Mode Settings
                    </h3>
                    <p style={{ color: "#6b7280", marginBottom: "2rem", fontSize: "0.9rem" }}>
                        Control whether OTP emails are sent during registration and password reset.
                    </p>

                    {/* Current Status Card */}
                    {otpModeFetched && (
                        <div style={{
                            background: otpTestMode
                                ? "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)"
                                : "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)",
                            border: `1px solid ${otpTestMode ? "#6ee7b7" : "#c7d2fe"}`,
                            borderRadius: "12px",
                            padding: "1.5rem",
                            marginBottom: "2rem",
                            transition: "all 0.3s ease"
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "0.75rem" }}>
                                <span style={{ fontSize: "2rem" }}>{otpTestMode ? "🧪" : "📧"}</span>
                                <div>
                                    <strong style={{ fontSize: "1.1rem", color: otpTestMode ? "#065f46" : "#3730a3" }}>
                                        {otpTestMode ? "Test Mode is Active" : "Real Mode is Active"}
                                    </strong>
                                    <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: "2px" }}>
                                        {otpTestMode
                                            ? "OTP is auto-generated and returned in the API response. No email is sent."
                                            : "OTP is sent to the user's email via your configured SMTP server."
                                        }
                                    </div>
                                </div>
                                <div style={{
                                    marginLeft: "auto",
                                    padding: "4px 12px",
                                    borderRadius: "100px",
                                    fontSize: "0.72rem",
                                    fontWeight: "700",
                                    letterSpacing: "1.5px",
                                    background: otpTestMode ? "#059669" : "#4f46e5",
                                    color: "#fff"
                                }}>
                                    {otpTestMode ? "TEST" : "REAL"}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Toggle Switch */}
                    <div style={{
                        background: "#f9fafb",
                        border: "1px solid #e5e7eb",
                        borderRadius: "12px",
                        padding: "1.5rem",
                        marginBottom: "1.5rem"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                            <div>
                                <div style={{ fontWeight: "600", marginBottom: "4px", color: "#111827" }}>
                                    OTP Test Mode
                                </div>
                                <div style={{ fontSize: "0.82rem", color: "#6b7280" }}>
                                    {otpTestMode
                                        ? "Currently: OTP is instantly generated — no email sent"
                                        : "Currently: OTP is emailed to users via SMTP"
                                    }
                                </div>
                            </div>

                            {/* The premium slide toggle switch */}
                            <button
                                id="otp-mode-toggle"
                                onClick={() => handleOtpModeToggle(!otpTestMode)}
                                disabled={otpModeLoading || !otpModeFetched}
                                title={otpTestMode ? "Switch to Real Mode" : "Switch to Test Mode"}
                                style={{
                                    position: "relative",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    width: "64px",
                                    height: "34px",
                                    borderRadius: "34px",
                                    border: "none",
                                    cursor: otpModeLoading ? "not-allowed" : "pointer",
                                    background: otpTestMode
                                        ? "linear-gradient(135deg, #059669, #10b981)"
                                        : "#d1d5db",
                                    transition: "background 0.3s ease",
                                    padding: "0",
                                    outline: "none",
                                    boxShadow: otpTestMode
                                        ? "0 0 0 3px rgba(16,185,129,0.2), inset 0 1px 3px rgba(0,0,0,0.1)"
                                        : "inset 0 1px 3px rgba(0,0,0,0.1)",
                                    opacity: otpModeLoading ? 0.7 : 1,
                                    flexShrink: 0
                                }}
                            >
                                {/* Sliding circle */}
                                <span style={{
                                    position: "absolute",
                                    top: "3px",
                                    left: otpTestMode ? "calc(100% - 31px)" : "3px",
                                    width: "28px",
                                    height: "28px",
                                    borderRadius: "50%",
                                    background: "#ffffff",
                                    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                                    transition: "left 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "13px"
                                }}>
                                    {otpModeLoading ? "⏳" : otpTestMode ? "🧪" : "📧"}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Mode Cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                        {/* Test Mode Card */}
                        <div
                            onClick={() => !otpModeLoading && handleOtpModeToggle(true)}
                            style={{
                                background: otpTestMode ? "#ecfdf5" : "#fff",
                                border: `2px solid ${otpTestMode ? "#10b981" : "#e5e7eb"}`,
                                borderRadius: "12px",
                                padding: "1.25rem",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                opacity: otpModeLoading ? 0.6 : 1,
                                position: "relative",
                                overflow: "hidden"
                            }}
                        >
                            {otpTestMode && (
                                <div style={{
                                    position: "absolute", top: "10px", right: "10px",
                                    background: "#10b981", color: "#fff", fontSize: "0.65rem",
                                    fontWeight: "700", letterSpacing: "1px", padding: "2px 7px",
                                    borderRadius: "4px"
                                }}>ACTIVE</div>
                            )}
                            <div style={{ fontSize: "1.75rem", marginBottom: "8px" }}>🧪</div>
                            <div style={{ fontWeight: "700", color: "#065f46", marginBottom: "4px" }}>Test Mode</div>
                            <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: "0.78rem", color: "#6b7280", lineHeight: 1.6 }}>
                                <li>OTP generated instantly</li>
                                <li>Auto-filled on register page</li>
                                <li>No email SMTP needed</li>
                                <li>Perfect for demos &amp; dev</li>
                            </ul>
                        </div>

                        {/* Real Mode Card */}
                        <div
                            onClick={() => !otpModeLoading && handleOtpModeToggle(false)}
                            style={{
                                background: !otpTestMode ? "#eef2ff" : "#fff",
                                border: `2px solid ${!otpTestMode ? "#6366f1" : "#e5e7eb"}`,
                                borderRadius: "12px",
                                padding: "1.25rem",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                opacity: otpModeLoading ? 0.6 : 1,
                                position: "relative",
                                overflow: "hidden"
                            }}
                        >
                            {!otpTestMode && (
                                <div style={{
                                    position: "absolute", top: "10px", right: "10px",
                                    background: "#6366f1", color: "#fff", fontSize: "0.65rem",
                                    fontWeight: "700", letterSpacing: "1px", padding: "2px 7px",
                                    borderRadius: "4px"
                                }}>ACTIVE</div>
                            )}
                            <div style={{ fontSize: "1.75rem", marginBottom: "8px" }}>📧</div>
                            <div style={{ fontWeight: "700", color: "#3730a3", marginBottom: "4px" }}>Real Mode</div>
                            <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: "0.78rem", color: "#6b7280", lineHeight: 1.6 }}>
                                <li>OTP sent via email (SMTP)</li>
                                <li>Users verify real inbox</li>
                                <li>Production-grade security</li>
                                <li>Requires EMAIL_USER in .env</li>
                            </ul>
                        </div>
                    </div>

                    {/* Warning note */}
                    <div style={{
                        marginTop: "1.5rem",
                        padding: "12px 16px",
                        background: "#fffbeb",
                        border: "1px solid #fbbf24",
                        borderRadius: "8px",
                        fontSize: "0.8rem",
                        color: "#78350f",
                        display: "flex",
                        gap: "8px",
                        alignItems: "flex-start"
                    }}>
                        <span style={{ flexShrink: 0 }}>⚠️</span>
                        <span>
                            <strong>Note:</strong> This toggle changes OTP mode at runtime (until server restart).
                            To make the change permanent, update <code style={{ background: "#fef3c7", padding: "1px 4px", borderRadius: "3px" }}>OTP_TEST_MODE</code> in <code style={{ background: "#fef3c7", padding: "1px 4px", borderRadius: "3px" }}>backend/.env</code>.
                        </span>
                    </div>
                </div>
            )}

            {/* System Info */}
            {activeTab === "system" && (
                <div className="card" style={{ maxWidth: "600px", padding: "2rem" }}>
                    <h3 style={{ marginBottom: "1.5rem" }}>System Information</h3>
                    <div style={{ marginBottom: "1rem" }}>
                        <strong>Platform Version:</strong> 1.0.0
                    </div>
                    <div style={{ marginBottom: "1rem" }}>
                        <strong>Node Environment:</strong> {import.meta.env.MODE || "development"}
                    </div>
                    <div style={{ marginBottom: "1rem" }}>
                        <strong>Database:</strong> PostgreSQL + Sequelize
                    </div>
                    <div style={{ marginBottom: "1rem" }}>
                        <strong>OTP Mode:</strong>{" "}
                        <span style={{
                            padding: "2px 10px", borderRadius: "100px", fontSize: "0.75rem", fontWeight: "700",
                            background: otpTestMode ? "#dcfce7" : "#e0e7ff",
                            color: otpTestMode ? "#166534" : "#3730a3",
                            border: `1px solid ${otpTestMode ? "#86efac" : "#a5b4fc"}`
                        }}>
                            {otpModeFetched ? (otpTestMode ? "🧪 Test" : "📧 Real") : "Loading…"}
                        </span>
                    </div>
                    <div style={{ marginBottom: "1rem", color: "#6b7280", fontSize: "0.875rem" }}>
                        Simple Digital System © 2026. All rights reserved.
                    </div>
                </div>
            )}
        </div>
    );
}

export default Settings;
