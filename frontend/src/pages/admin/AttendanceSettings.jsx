import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import "./Dashboard.css"; // Reuse dashboard/settings styles
import "./Students.css";

function AttendanceSettings() {
    const [settings, setSettings] = useState({
        student_attendance_mode: "subject_based",
        qr_notify_main_gate_in: false,
        qr_notify_main_gate_out: false,
        qr_notify_subject_in: false,
        qr_notify_subject_out: false,
        qr_notify_parent_on_late: false,
        qr_notify_parent_on_absent: false
    });
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await api.get("/attendance/settings");
            if (res.data.success) {
                setSettings({
                    student_attendance_mode: res.data.data.student_attendance_mode || "subject_based",
                    qr_notify_main_gate_in: res.data.data.qr_notify_main_gate_in || false,
                    qr_notify_main_gate_out: res.data.data.qr_notify_main_gate_out || false,
                    qr_notify_subject_in: res.data.data.qr_notify_subject_in || false,
                    qr_notify_subject_out: res.data.data.qr_notify_subject_out || false,
                    qr_notify_parent_on_late: res.data.data.qr_notify_parent_on_late || false,
                    qr_notify_parent_on_absent: res.data.data.qr_notify_parent_on_absent || false
                });
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
        } finally {
            setInitialLoading(false);
        }
    };

    const update = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await api.put("/attendance/settings", settings);
            if (res.data.success) {
                alert("Attendance settings updated successfully!");
            }
        } catch (error) {
            console.error("Error updating settings:", error);
            alert("Failed to update settings. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (initialLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
                <div style={{ color: '#64748b', fontSize: '1.2rem' }}>Loading settings...</div>
            </div>
        );
    }

    return (
        <div className="students-container">
            {/* ── Header ── */}
            <div className="st-header">
                <div className="st-header-top-row">
                    <div className="st-header-left">
                        <h1>Attendance Settings</h1>
                        <p>Configure how Student QR Attendance operates</p>
                    </div>
                </div>
                <div className="st-header-bottom-row">
                    <div className="st-breadcrumbs">
                        <Link to="/admin/dashboard" style={{ textDecoration: 'none', color: 'inherit' }}>Dashboard</Link>
                        <span>›</span>
                        <span className="active">Attendance Settings</span>
                    </div>
                    <div className="st-header-actions">
                        <button 
                            className="st-btn st-btn-primary" 
                            onClick={handleSave}
                            disabled={loading}
                            style={{ gap: '8px' }}
                        >
                            <span>💾</span>
                            {loading ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)", gap: "1.5rem", marginBottom: "1.5rem", alignItems: "start", marginTop: "1rem" }}>
                {/* Left Column */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    {/* Attendance Mode Card */}
                    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "1.75rem", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "1.5rem" }}>
                            <div style={{ color: "#8b5cf6" }}>
                                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                            </div>
                            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#1e293b" }}>Attendance Mode</h3>
                        </div>
                        
                        <div style={{ marginBottom: "1.5rem" }}>
                            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#1e293b", marginBottom: "1rem" }}>Primary Tracking Mode for "Scan Student QR"</label>
                            <div style={{ display: "inline-flex", background: "#f1f5f9", borderRadius: "12px", padding: "4px", gap: "2px", width: "100%" }}>
                                {[
                                    { value: "class_based", icon: "🏫", label: "Class Based", sub: "Scanned at Main Gate" },
                                    { value: "subject_based", icon: "📚", label: "Subject Based", sub: "Scanned in Classrooms" }
                                ].map(opt => {
                                    const isActive = (settings.student_attendance_mode === opt.value) || (!settings.student_attendance_mode && opt.value === "class_based");
                                    return (
                                        <button key={opt.value} onClick={() => update("student_attendance_mode", opt.value)} style={{
                                            flex: 1, padding: "0.7rem 1rem", borderRadius: "10px", border: "none",
                                            background: isActive ? "#fff" : "transparent",
                                            boxShadow: isActive ? "0 2px 8px rgba(99,102,241,0.12)" : "none",
                                            cursor: "pointer", transition: "all 0.25s ease",
                                            display: "flex", flexDirection: "column", alignItems: "center", gap: "2px"
                                        }}>
                                            <span style={{ fontSize: "1.2rem" }}>{opt.icon}</span>
                                            <span style={{ fontSize: "0.85rem", fontWeight: isActive ? 700 : 500, color: isActive ? "#6366f1" : "#64748b", whiteSpace: "nowrap" }}>{opt.label}</span>
                                            <span style={{ fontSize: "0.7rem", color: isActive ? "#8b5cf6" : "#94a3b8" }}>{opt.sub}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", marginTop: "0.75rem", padding: "0.6rem 0.75rem", background: (settings.student_attendance_mode === "subject_based") ? "#f5f3ff" : "#f0fdf4", borderRadius: "8px", border: "1px solid " + ((settings.student_attendance_mode === "subject_based") ? "#e9d5ff" : "#bbf7d0") }}>
                                <span style={{ fontSize: "0.9rem" }}>{(settings.student_attendance_mode === "subject_based") ? "ℹ️" : "✅"}</span>
                                <span style={{ fontSize: "0.8rem", color: "#475569", lineHeight: 1.4 }}>
                                    {settings.student_attendance_mode === "subject_based"
                                        ? "Students scan at specific classrooms. The scanner must select a specific Class & Subject first."
                                        : "Students scan at the main gate. All subjects are auto-marked present based on their timetable."}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    {/* Notifications Card */}
                    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "1.75rem", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "1.5rem" }}>
                            <div style={{ color: "#8b5cf6" }}>
                                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                            </div>
                            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#1e293b" }}>Parent Notifications</h3>
                        </div>

                        {/* Main Gate Notifications Group */}
                        <div style={{ marginBottom: "1.5rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", paddingBottom: "0.5rem", borderBottom: "1px dashed #e2e8f0" }}>
                                <span style={{ fontSize: "1rem" }}>🚪</span>
                                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>Main Gate</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                {[
                                    { key: "qr_notify_main_gate_in", label: "Notify when student scans IN at Main Gate", emoji: "✅" },
                                    { key: "qr_notify_main_gate_out", label: "Notify when student scans OUT at Main Gate", emoji: "🚪" },
                                ].map(({ key, label, emoji }) => (
                                    <label key={key} style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", padding: "0.6rem 0.75rem", borderRadius: "8px", background: settings[key] ? "rgba(139,92,246,0.05)" : "transparent", border: "1px solid", borderColor: settings[key] ? "#e9d5ff" : "transparent", transition: "all 0.2s" }}>
                                        <input
                                            type="checkbox"
                                            checked={!!settings[key]}
                                            onChange={(e) => update(key, e.target.checked)}
                                            style={{ width: "17px", height: "17px", cursor: "pointer", accentColor: "#8b5cf6", flexShrink: 0 }}
                                        />
                                        <span style={{ fontSize: "0.88rem", color: "#1e293b", fontWeight: 500 }}>{emoji} {label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Subject Punch Notifications Group */}
                        {settings.student_attendance_mode === "subject_based" && (
                            <div style={{ marginBottom: "1.5rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", paddingBottom: "0.5rem", borderBottom: "1px dashed #e2e8f0" }}>
                                    <span style={{ fontSize: "1rem" }}>📚</span>
                                    <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>Subject / Classroom</span>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                    {[
                                        { key: "qr_notify_subject_in", label: "Notify when student scans IN for a Subject", emoji: "📚" },
                                        { key: "qr_notify_subject_out", label: "Notify when student scans OUT for a Subject", emoji: "📤" },
                                    ].map(({ key, label, emoji }) => (
                                        <label key={key} style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", padding: "0.6rem 0.75rem", borderRadius: "8px", background: settings[key] ? "rgba(139,92,246,0.05)" : "transparent", border: "1px solid", borderColor: settings[key] ? "#e9d5ff" : "transparent", transition: "all 0.2s" }}>
                                            <input
                                                type="checkbox"
                                                checked={!!settings[key]}
                                                onChange={(e) => update(key, e.target.checked)}
                                                style={{ width: "17px", height: "17px", cursor: "pointer", accentColor: "#8b5cf6", flexShrink: 0 }}
                                            />
                                            <span style={{ fontSize: "0.88rem", color: "#1e293b", fontWeight: 500 }}>{emoji} {label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Status Alerts Group */}
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", paddingBottom: "0.5rem", borderBottom: "1px dashed #e2e8f0" }}>
                                <span style={{ fontSize: "1rem" }}>⚡</span>
                                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status Alerts</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                {[
                                    { key: "qr_notify_parent_on_late", label: "Notify when student is marked Late", emoji: "⚠️" },
                                    { key: "qr_notify_parent_on_absent", label: "Notify when student is marked Absent", emoji: "❌" },
                                ].map(({ key, label, emoji }) => (
                                    <label key={key} style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", padding: "0.6rem 0.75rem", borderRadius: "8px", background: settings[key] ? "rgba(139,92,246,0.05)" : "transparent", border: "1px solid", borderColor: settings[key] ? "#e9d5ff" : "transparent", transition: "all 0.2s" }}>
                                        <input
                                            type="checkbox"
                                            checked={!!settings[key]}
                                            onChange={(e) => update(key, e.target.checked)}
                                            style={{ width: "17px", height: "17px", cursor: "pointer", accentColor: "#8b5cf6", flexShrink: 0 }}
                                        />
                                        <span style={{ fontSize: "0.88rem", color: "#1e293b", fontWeight: 500 }}>{emoji} {label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AttendanceSettings;
