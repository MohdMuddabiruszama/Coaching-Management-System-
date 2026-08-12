/**
 * Biometric Attendance Management â€” Admin Page
 * Phases 2, 3, 5, 7, 8, 10: Devices, Enrollment, Live Attendance,
 * OTP/QR Attendance, Reports, Settings
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import api from "../../services/api";
import toast from "react-hot-toast";
import { format12Hour } from "../../utils/timeFormat";

// â”€â”€â”€ Tab IDs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TABS = [
    { id: "live", label: "Live Attendance", icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 16 0M8 12a4 4 0 0 1 8 0M12 12v.01"></path></svg> },
    { id: "devices", label: "Devices", icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><path d="M8 21h8M12 17v4"></path></svg> },
    { id: "enrollment", label: "Enrollment", icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M16 11h6"></path></svg> },
    { id: "otp", label: "OTP/QR", icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><path d="M7 7h.01M17 7h.01M7 17h.01M17 17h.01"></path></svg> },
    { id: "reports", label: "Reports", icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 20V10M12 20V4M6 20v-6"></path></svg> },
    { id: "settings", label: "Settings", icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> },
];

export default function BiometricPage() {
    const [activeTab, setActiveTab] = useState("live");
    const [isTestMode, setIsTestMode] = useState(() => {
        try { return localStorage.getItem("biometric_test_mode") === "true"; } catch { return false; }
    });

    const toggleMode = () => {
        const next = !isTestMode;
        setIsTestMode(next);
        try { localStorage.setItem("biometric_test_mode", String(next)); } catch {}
        toast(next ? "ðŸ§ª Switched to Test Mode" : "âœ… Switched to Real Mode", {
            icon: next ? "âš—ï¸" : "ðŸ”Œ",
            style: { background: next ? "#fef3c7" : "#ecfdf5", color: next ? "#92400e" : "#065f46", fontWeight: 600 }
        });
    };

    return (
        <div style={{ padding: "1.5rem", width: "100%", maxWidth: "1300px", margin: "0 auto", boxSizing: "border-box", color: "#1e293b", fontFamily: "system-ui, -apple-system, sans-serif" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: isTestMode ? "rgba(245,158,11,0.1)" : "rgba(99, 102, 241, 0.1)", color: isTestMode ? "#f59e0b" : "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.3s" }}>
                        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 16 0M8 12a4 4 0 0 1 8 0M12 12v.01"></path><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect></svg>
                    </div>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>Biometric Attendance</h1>
                            {isTestMode && (
                                <span style={{ background: "#fef3c7", color: "#92400e", fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "20px", border: "1px solid #fbbf24", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                                    TEST MODE
                                </span>
                            )}
                        </div>
                        <p style={{ color: "#64748b", margin: "0.25rem 0 0", fontSize: "0.95rem" }}>
                            {isTestMode ? "Simulator active â€” no physical devices required" : "Manage devices, enrollments, and view live attendance data"}
                        </p>
                    </div>
                </div>


            </div>

            {/* Test Mode Banner */}
            {isTestMode && (
                <div style={{ background: "linear-gradient(135deg, #fef3c7, #fde68a)", border: "1px solid #fbbf24", borderRadius: "10px", padding: "0.75rem 1.25rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.75rem", animation: "fadeIn 0.3s ease" }}>
                    <div style={{ background: "#f59e0b", color: "#fff", width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1rem" }}>âš—ï¸</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: "#92400e", fontSize: "0.9rem" }}>TEST MODE ACTIVE</div>
                        <div style={{ color: "#a16207", fontSize: "0.8rem" }}>Punches are simulated from the browser. Attendance records are real and stored in the database. Use the Simulator panel in Live Attendance to send test punches.</div>
                    </div>
                    <button onClick={toggleMode} style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: "8px", padding: "0.4rem 0.9rem", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer" }}>
                        Switch to Real Mode
                    </button>
                </div>
            )}

            {/* Tab Content Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
                {/* Tabs */}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                display: "flex", alignItems: "center", gap: "0.5rem",
                                padding: "0.6rem 1.25rem",
                                borderRadius: "8px",
                                border: "none",
                                cursor: "pointer",
                                fontWeight: activeTab === tab.id ? 600 : 500,
                                background: activeTab === tab.id ? "#6366f1" : "transparent",
                                color: activeTab === tab.id ? "#fff" : "#475569",
                                transition: "all 0.2s",
                                fontSize: "0.9rem",
                            }}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>
                
                {/* Global Refresh & Date */}
                {activeTab === "live" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#fff", padding: "0.6rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", color: "#475569", fontWeight: 500, fontSize: "0.9rem" }}>
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                        <button
                            id="global-refresh-btn"
                            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.25rem", borderRadius: "8px", background: "#6366f1", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer", fontSize: "0.9rem", transition: "all 0.2s", boxShadow: "0 4px 6px rgba(99,102,241,0.2)" }}
                        >
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.92-10.26l3.08 3.69"></path></svg>
                            Refresh
                        </button>
                    </div>
                )}
            </div>

            {/* Tab Content */}
            {activeTab === "live" && <LiveAttendanceTab isTestMode={isTestMode} setActiveTab={setActiveTab} />}
            {activeTab === "devices" && <DevicesTab />}
            {activeTab === "enrollment" && <EnrollmentTab />}
            {activeTab === "otp" && <OtpQrTab />}
            {activeTab === "reports" && <ReportsTab />}
            {activeTab === "settings" && <SettingsTab />}
        </div>
    );
}


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TEST MODE SIMULATOR (renders only when isTestMode is true)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function TestModeSimulator({ onPunchSent }) {
    const [devices, setDevices] = useState([]);
    const [enrollments, setEnrollments] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState("");
    const [selectedEnrollment, setSelectedEnrollment] = useState("");
    const [punchType, setPunchType] = useState("in");
    const [customTime, setCustomTime] = useState("");
    const [useCustomTime, setUseCustomTime] = useState(false);
    const [log, setLog] = useState([]);
    const [loadingSetup, setLoadingSetup] = useState(false);
    const [loadingPunch, setLoadingPunch] = useState(false);
    const [autoHeartbeat, setAutoHeartbeat] = useState(false);
    const heartbeatRef = useRef(null);

    const addLog = (type, message, detail = "") => {
        const entry = { id: Date.now(), type, message, detail, time: new Date().toLocaleTimeString() };
        setLog(prev => [entry, ...prev].slice(0, 20));
    };

    // Load devices and enrollments on mount
    useEffect(() => {
        api.get("/biometric/devices").then(r => {
            if (r.data.success) setDevices(r.data.data || []);
        }).catch(() => {});
        api.get("/biometric/enrollments").then(r => {
            if (r.data.success) setEnrollments(r.data.data || []);
        }).catch(() => {});
    }, []);

    // Auto heartbeat
    useEffect(() => {
        if (autoHeartbeat && selectedDevice) {
            heartbeatRef.current = setInterval(async () => {
                try {
                    await api.post("/biometric/test/heartbeat", { device_id: parseInt(selectedDevice) });
                    addLog("info", "Auto heartbeat sent", "Device marked online");
                } catch {}
            }, 30000);
            addLog("info", "Auto heartbeat started", "Sending every 30s");
        } else {
            clearInterval(heartbeatRef.current);
        }
        return () => clearInterval(heartbeatRef.current);
    }, [autoHeartbeat, selectedDevice]);

    const handleSetupMockDevice = async () => {
        setLoadingSetup(true);
        try {
            const res = await api.post("/biometric/test/setup-mock-device");
            if (res.data.success) {
                toast.success("Mock device ready!");
                addLog("success", res.data.message, `Serial: ${res.data.data.device_serial} | ID: ${res.data.data.id}`);
                // Refresh devices list
                const r2 = await api.get("/biometric/devices");
                if (r2.data.success) setDevices(r2.data.data || []);
                setSelectedDevice(String(res.data.data.id));
            }
        } catch (e) {
            toast.error("Setup failed");
            addLog("error", "Mock device setup failed", e?.response?.data?.message || e.message);
        } finally { setLoadingSetup(false); }
    };

    const handleSendHeartbeat = async () => {
        if (!selectedDevice) return toast.error("Select a device first");
        try {
            await api.post("/biometric/test/heartbeat", { device_id: parseInt(selectedDevice) });
            toast.success("Heartbeat sent â€” device is online");
            addLog("success", "Heartbeat sent", "Device marked online");
        } catch (e) {
            addLog("error", "Heartbeat failed", e?.response?.data?.message || e.message);
        }
    };

    const handlePunch = async (type) => {
        if (!selectedDevice) return toast.error("Select a device first");
        if (!selectedEnrollment) return toast.error("Select an enrolled person first");

        setLoadingPunch(true);
        const pType = type || punchType;
        try {
            const payload = {
                device_id: parseInt(selectedDevice),
                device_user_id: selectedEnrollment,
                punch_type: pType,
            };
            if (useCustomTime && customTime) {
                payload.timestamp = new Date(customTime).toISOString();
            }

            const res = await api.post("/biometric/test/punch", payload);
            if (res.data.success) {
                const { result_ok, result_reason, attendance, punch_id } = res.data.data;
                const logType = result_ok ? "success" : "info";
                const logMsg = result_ok
                    ? `Punch ${pType.toUpperCase()} â†’ ${result_reason}`
                    : `Punch ${pType.toUpperCase()} sent (no attendance created)`;
                const logDetail = result_ok
                    ? `Punch ID: ${punch_id}${attendance ? ` | Status: ${attendance.status?.toUpperCase()}${attendance.is_late ? ` | ${attendance.late_by_minutes}m late` : ""}` : ""}`
                    : `Reason: ${result_reason} | Punch ID: ${punch_id}`;

                if (result_ok) {
                    toast.success(`${pType.toUpperCase()} punch recorded! â†’ ${attendance?.status || "processed"}`);
                } else {
                    toast(`${pType.toUpperCase()} punch sent â€” ${result_reason}`, { icon: "â„¹ï¸" });
                }
                addLog(logType, logMsg, logDetail);
                if (onPunchSent) onPunchSent();
            }
        } catch (e) {
            const msg = e?.response?.data?.message || e.message;
            toast.error(msg);
            addLog("error", `Punch ${pType.toUpperCase()} failed`, msg);
        } finally { setLoadingPunch(false); }
    };


    const filteredEnrollments = enrollments.filter(e => !selectedDevice || String(e.device_id) === selectedDevice);

    return (
        <div style={{ marginBottom: "2rem", border: "2px solid #fbbf24", borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 24px rgba(245,158,11,0.12)" }}>
            {/* Simulator Header */}
            <div style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ background: "rgba(255,255,255,0.2)", width: "36px", height: "36px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="20" height="20" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"></path></svg>
                </div>
                <div>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: "1rem" }}>Biometric Device Simulator</div>
                    <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.8rem" }}>Simulate punches without physical hardware</div>
                </div>
            </div>

            <div style={{ background: "#fffbeb", padding: "1.5rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                {/* LEFT: Setup + Device Select */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {/* Quick Setup */}
                    <div style={{ background: "#fff", border: "1px solid #fde68a", borderRadius: "12px", padding: "1.25rem" }}>
                        <div style={{ fontWeight: 700, color: "#92400e", fontSize: "0.9rem", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"></path></svg>
                            Quick Setup
                        </div>
                        <button
                            onClick={handleSetupMockDevice}
                            disabled={loadingSetup}
                            style={{ width: "100%", padding: "0.65rem 1rem", background: loadingSetup ? "#e5e7eb" : "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "0.85rem", cursor: loadingSetup ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginBottom: "0.5rem" }}
                        >
                            {loadingSetup ? "Setting up..." : <>
                                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                                Register Mock Device (CDK9191960001)
                            </>}
                        </button>
                        <div style={{ fontSize: "0.75rem", color: "#a16207" }}>Creates "Test-Gate-1 Fingerprint" if it doesn't exist. Then enroll a person via the Enrollment tab.</div>
                    </div>

                    {/* Device Selector */}
                    <div style={{ background: "#fff", border: "1px solid #fde68a", borderRadius: "12px", padding: "1.25rem" }}>
                        <div style={{ fontWeight: 700, color: "#92400e", fontSize: "0.9rem", marginBottom: "0.75rem" }}>Select Device</div>
                        <select
                            value={selectedDevice}
                            onChange={e => { setSelectedDevice(e.target.value); setSelectedEnrollment(""); }}
                            style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: "8px", border: "1px solid #fde68a", fontSize: "0.9rem", background: "#fff", color: "#1e293b", outline: "none", marginBottom: "0.75rem" }}
                        >
                            <option value="">â€” Select a device â€”</option>
                            {devices.map(d => (
                                <option key={d.id} value={String(d.id)}>{d.device_name} ({d.device_serial})</option>
                            ))}
                        </select>

                        <div style={{ fontWeight: 700, color: "#92400e", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Select Enrolled Person</div>
                        <select
                            value={selectedEnrollment}
                            onChange={e => setSelectedEnrollment(e.target.value)}
                            style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: "8px", border: "1px solid #fde68a", fontSize: "0.9rem", background: "#fff", color: "#1e293b", outline: "none" }}
                        >
                            <option value="">â€” Select an enrolled person â€”</option>
                            {filteredEnrollments.map(e => (
                                <option key={e.id} value={e.device_user_id}>
                                    {e.User?.name || `User #${e.user_id}`} | ID: {e.device_user_id} | {e.user_role}
                                </option>
                            ))}
                        </select>
                        {filteredEnrollments.length === 0 && selectedDevice && (
                            <div style={{ fontSize: "0.75rem", color: "#f59e0b", marginTop: "0.4rem" }}>No enrollments for this device. Go to Enrollment tab to add one.</div>
                        )}
                    </div>

                    {/* Heartbeat */}
                    <div style={{ background: "#fff", border: "1px solid #fde68a", borderRadius: "12px", padding: "1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                        <div>
                            <div style={{ fontWeight: 700, color: "#92400e", fontSize: "0.9rem" }}>Device Heartbeat</div>
                            <div style={{ fontSize: "0.75rem", color: "#a16207", marginTop: "0.2rem" }}>Mark device as "Online" in the dashboard</div>
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button
                                onClick={handleSendHeartbeat}
                                style={{ padding: "0.5rem 0.9rem", background: "#fff", border: "1px solid #fbbf24", borderRadius: "8px", fontWeight: 600, fontSize: "0.8rem", color: "#92400e", cursor: "pointer" }}
                            >
                                â¤ï¸ Ping
                            </button>
                            <button
                                onClick={() => setAutoHeartbeat(a => !a)}
                                style={{ padding: "0.5rem 0.9rem", background: autoHeartbeat ? "#f59e0b" : "#fff", border: "1px solid #fbbf24", borderRadius: "8px", fontWeight: 600, fontSize: "0.8rem", color: autoHeartbeat ? "#fff" : "#92400e", cursor: "pointer", transition: "all 0.2s" }}
                            >
                                {autoHeartbeat ? "â¹ Stop Auto" : "â–¶ Auto (30s)"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Punch Simulator + Log */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {/* Punch Simulator */}
                    <div style={{ background: "#fff", border: "1px solid #fde68a", borderRadius: "12px", padding: "1.25rem" }}>
                        <div style={{ fontWeight: 700, color: "#92400e", fontSize: "0.9rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"></path></svg>
                            Punch Simulator
                        </div>

                        {/* Custom timestamp toggle */}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                            <input type="checkbox" id="useCustomTime" checked={useCustomTime} onChange={e => setUseCustomTime(e.target.checked)} style={{ accentColor: "#f59e0b", width: "16px", height: "16px" }} />
                            <label htmlFor="useCustomTime" style={{ fontSize: "0.85rem", color: "#92400e", cursor: "pointer", fontWeight: 500 }}>Override timestamp</label>
                        </div>
                        {useCustomTime && (
                            <input
                                type="datetime-local"
                                value={customTime}
                                onChange={e => setCustomTime(e.target.value)}
                                style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: "8px", border: "1px solid #fde68a", fontSize: "0.85rem", marginBottom: "0.75rem", boxSizing: "border-box", outline: "none" }}
                            />
                        )}

                        {/* Big Punch Buttons */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                            <button
                                onClick={() => handlePunch("in")}
                                disabled={loadingPunch || !selectedDevice || !selectedEnrollment}
                                style={{
                                    padding: "1rem", borderRadius: "12px", border: "none",
                                    background: (!selectedDevice || !selectedEnrollment) ? "#e5e7eb" : "linear-gradient(135deg, #10b981, #059669)",
                                    color: (!selectedDevice || !selectedEnrollment) ? "#9ca3af" : "#fff",
                                    fontWeight: 700, fontSize: "1rem", cursor: (!selectedDevice || !selectedEnrollment) ? "not-allowed" : "pointer",
                                    display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem",
                                    boxShadow: (!selectedDevice || !selectedEnrollment) ? "none" : "0 4px 12px rgba(16,185,129,0.3)",
                                    transition: "all 0.2s"
                                }}
                            >
                                <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"></path></svg>
                                ðŸ‘† PUNCH IN
                            </button>
                            <button
                                onClick={() => handlePunch("out")}
                                disabled={loadingPunch || !selectedDevice || !selectedEnrollment}
                                style={{
                                    padding: "1rem", borderRadius: "12px", border: "none",
                                    background: (!selectedDevice || !selectedEnrollment) ? "#e5e7eb" : "linear-gradient(135deg, #ef4444, #dc2626)",
                                    color: (!selectedDevice || !selectedEnrollment) ? "#9ca3af" : "#fff",
                                    fontWeight: 700, fontSize: "1rem", cursor: (!selectedDevice || !selectedEnrollment) ? "not-allowed" : "pointer",
                                    display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem",
                                    boxShadow: (!selectedDevice || !selectedEnrollment) ? "none" : "0 4px 12px rgba(239,68,68,0.3)",
                                    transition: "all 0.2s"
                                }}
                            >
                                <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                                ðŸšª PUNCH OUT
                            </button>
                        </div>
                        {(!selectedDevice || !selectedEnrollment) && (
                            <div style={{ marginTop: "0.75rem", fontSize: "0.78rem", color: "#a16207", textAlign: "center" }}>
                                â†‘ Select a device and enrolled person above to enable punching
                            </div>
                        )}
                    </div>

                    {/* Activity Log */}
                    <div style={{ background: "#fff", border: "1px solid #fde68a", borderRadius: "12px", padding: "1.25rem", flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                            <div style={{ fontWeight: 700, color: "#92400e", fontSize: "0.9rem" }}>ðŸ“‹ Activity Log</div>
                            {log.length > 0 && (
                                <button onClick={() => setLog([])} style={{ background: "none", border: "none", color: "#a16207", fontSize: "0.75rem", cursor: "pointer", fontWeight: 600 }}>Clear</button>
                            )}
                        </div>
                        <div style={{ maxHeight: "180px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            {log.length === 0 ? (
                                <div style={{ color: "#a16207", fontSize: "0.8rem", textAlign: "center", padding: "1rem 0" }}>No activity yet. Send a punch to see results here.</div>
                            ) : log.map(entry => (
                                <div key={entry.id} style={{
                                    display: "flex", alignItems: "flex-start", gap: "0.5rem", padding: "0.5rem 0.75rem",
                                    borderRadius: "8px", fontSize: "0.8rem",
                                    background: entry.type === "success" ? "#f0fdf4" : entry.type === "error" ? "#fef2f2" : "#eff6ff",
                                    borderLeft: "3px solid " + (entry.type === "success" ? "#10b981" : entry.type === "error" ? "#ef4444" : "#6366f1"),
                                }}>
                                    <span style={{ color: entry.type === "success" ? "#10b981" : entry.type === "error" ? "#ef4444" : "#6366f1", flexShrink: 0, marginTop: "1px" }}>
                                        {entry.type === "success" ? "âœ“" : entry.type === "error" ? "âœ—" : "â„¹"}
                                    </span>
                                    <div>
                                        <div style={{ fontWeight: 600, color: "#1e293b" }}>{entry.message}</div>
                                        {entry.detail && <div style={{ color: "#64748b", marginTop: "1px" }}>{entry.detail}</div>}
                                        <div style={{ color: "#94a3b8", marginTop: "1px" }}>{entry.time}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// LIVE ATTENDANCE TAB  (Phase 7 + 8)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function LiveAttendanceTab({ isTestMode = false, setActiveTab }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterRole, setFilterRole] = useState("all");
    const [filterClass, setFilterClass] = useState("all");
    const [filterDesignation, setFilterDesignation] = useState("all");
    const [page, setPage] = useState(1);
    const limit = 10;
    const intervalRef = useRef(null);


    const fetchLive = useCallback(async () => {
        try {
            const res = await api.get("/biometric/live");
            if (res.data.success) setData(res.data.data);
        } catch {
            /* silent */
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLive();
        intervalRef.current = setInterval(fetchLive, 15000); // Poll every 15s
        
        // Attach to global refresh button if it exists
        const btn = document.getElementById("global-refresh-btn");
        if(btn) btn.addEventListener("click", fetchLive);

        return () => {
            clearInterval(intervalRef.current);
            if(btn) btn.removeEventListener("click", fetchLive);
        };
    }, [fetchLive]);

    const records = data?.records || [];

    // Fast local filtering & pagination
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            const matchSearch = (r.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
                                (r.id || "").toString().toLowerCase().includes(searchTerm.toLowerCase());
            const matchStatus = filterStatus === "all" || r.status === filterStatus || (filterStatus === "late" && r.is_late);
            const matchRole = filterRole === "all" || r.role === filterRole;
            const matchClass = filterRole === "student" && filterClass !== "all" ? r.class === filterClass : true;
            const matchDesignation = filterRole === "faculty" && filterDesignation !== "all" ? r.class === filterDesignation : true;
            return matchSearch && matchStatus && matchRole && matchClass && matchDesignation;
        });
    }, [records, searchTerm, filterStatus, filterRole, filterClass, filterDesignation]);

    const paginatedRecords = useMemo(() => {
        const start = (page - 1) * limit;
        return filteredRecords.slice(start, start + limit);
    }, [filteredRecords, page, limit]);

    const totalPages = Math.ceil(filteredRecords.length / limit);

    if (loading) return <div style={{ textAlign: "center", padding: "3rem" }}>Loading live data...</div>;

    const presentPct = data?.total_marked ? ((data.present / data.total_marked) * 100).toFixed(2) : "0.00";
    const absentPct = data?.total_marked ? ((data.absent / data.total_marked) * 100).toFixed(2) : "0.00";
    const latePct = data?.total_marked ? ((data.late / data.total_marked) * 100).toFixed(2) : "0.00";

    return (
        <div style={{ animation: "fadeIn 0.3s ease-in-out" }}>
            {/* Test Mode Simulator Panel */}
            {isTestMode && <TestModeSimulator onPunchSent={fetchLive} />}

            {/* Stats Cards */}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
                <NewStatBox 
                    icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>} 
                    title="Today's Date" 
                    value={new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} 
                    subtext={new Date().toLocaleDateString('en-GB', { weekday: 'long' })}
                    color="#6366f1" bg="rgba(99,102,241,0.1)"
                />
                <NewStatBox 
                    icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 11l-3 3-1.5-1.5"></path></svg>} 
                    title="Present" 
                    value={data?.present || 0} 
                    subtext={`${presentPct}%`}
                    color="#10b981" bg="rgba(16,185,129,0.1)"
                />
                <NewStatBox 
                    icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 11l-3 3-1.5-1.5"></path></svg>} 
                    title="Absent" 
                    value={data?.absent || 0} 
                    subtext={`${absentPct}%`}
                    color="#ef4444" bg="rgba(239,68,68,0.1)"
                    isAbsent={true}
                />
                <NewStatBox 
                    icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>} 
                    title="Late Arrivals" 
                    value={data?.late || 0} 
                    subtext={`${latePct}%`}
                    color="#f59e0b" bg="rgba(245,158,11,0.1)"
                />
                <NewStatBox 
                    icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.92-10.26l3.08 3.69"></path></svg>} 
                    title="Auto Refresh" 
                    value="15s" 
                    subtext="Next refresh in"
                    color="#8b5cf6" bg="rgba(139,92,246,0.1)"
                />
            </div>

            {/* Main Table Card */}
            <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)", padding: "1.5rem" }}>
                {/* Table Header */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <svg width="20" height="20" fill="none" stroke="#6366f1" strokeWidth="2" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#1e293b" }}>Today's Biometric Punches</h3>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", width: "100%" }}>
                        <div style={{ position: "relative" }}>
                            <svg style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <input 
                                type="text" 
                                placeholder="Search by name or ID..." 
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                                style={{ padding: "0.5rem 1rem 0.5rem 2.2rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.9rem", width: "240px", outline: "none" }}
                            />
                        </div>
                        <select 
                            value={filterRole}
                            onChange={(e) => { 
                                setFilterRole(e.target.value); 
                                setFilterClass("all");
                                setFilterDesignation("all");
                                setPage(1); 
                            }}
                            style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.9rem", color: "#475569", outline: "none", backgroundColor: "#fff", cursor: "pointer" }}
                        >
                            <option value="all">All Roles</option>
                            <option value="faculty">Faculty</option>
                            <option value="student">Student</option>
                        </select>
                        {filterRole === "student" && (
                            <select
                                value={filterClass}
                                onChange={(e) => { setFilterClass(e.target.value); setPage(1); }}
                                style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.9rem", color: "#475569", outline: "none", backgroundColor: "#fff", cursor: "pointer" }}
                            >
                                <option value="all">All Classes</option>
                                {[...new Set(records.filter(r => r.role === "student").map(r => r.class).filter(c => c && c !== "â€”"))].sort().map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        )}
                        {filterRole === "faculty" && (
                            <select
                                value={filterDesignation}
                                onChange={(e) => { setFilterDesignation(e.target.value); setPage(1); }}
                                style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.9rem", color: "#475569", outline: "none", backgroundColor: "#fff", cursor: "pointer" }}
                            >
                                <option value="all">All Designations</option>
                                {[...new Set(records.filter(r => r.role === "faculty").map(r => r.class).filter(c => c && c !== "â€”"))].sort().map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                        )}
                        <select 
                            value={filterStatus}
                            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                            style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.9rem", color: "#475569", outline: "none", backgroundColor: "#fff", cursor: "pointer" }}
                        >
                            <option value="all">All Status</option>
                            <option value="present">Present</option>
                            <option value="late">Late</option>
                            <option value="absent">Absent</option>
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                                {(filterRole === "student" 
                                    ? ["#", "Student", "Roll Number", "Class", "Punch Time", "Status", "Device", "Action"]
                                    : filterRole === "faculty"
                                        ? ["#", "Faculty", "Faculty ID", "Designation", "Punch Time", "Status", "Device", "Action"]
                                        : ["#", "Person", "ID", "Dept / Class", "Punch Time", "Status", "Device", "Action"]
                                ).map((h) => (
                                    <th key={h} style={{ padding: "1rem 0.75rem", color: "#64748b", fontWeight: 600 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedRecords.length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>No punches found matching criteria</td>
                                </tr>
                            ) : (
                                paginatedRecords.map((r, i) => {
                                    const initial = r.name ? r.name.substring(0, 2).toUpperCase() : "NA";
                                    return (
                                        <tr key={i} style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "#f8fafc"} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                                            <td style={{ padding: "1rem 0.75rem", color: "#475569" }}>{(page - 1) * limit + i + 1}</td>
                                            <td style={{ padding: "1rem 0.75rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                                <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#6366f1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.8rem" }}>
                                                    {initial}
                                                </div>
                                                <span style={{ fontWeight: 600, color: "#1e293b" }}>{r.name || "â€”"}</span>
                                            </td>
                                            <td style={{ padding: "1rem 0.75rem", color: "#475569" }}>
                                                {r.role === 'student' ? (r.roll_number || "â€”") : (r.id ? `EMP${r.id.toString().padStart(4, '0')}` : "â€”")}
                                            </td>
                                            <td style={{ padding: "1rem 0.75rem", color: "#475569" }}>{r.class || "â€”"}</td>
                                            <td style={{ padding: "1rem 0.75rem", color: "#475569" }}>
                                                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                                                        <span style={{ color: "#10b981", fontWeight: 700, fontSize: "0.7rem", background: "#d1fae5", padding: "0.15rem 0.4rem", borderRadius: "4px", minWidth: "28px", textAlign: "center" }}>IN</span> 
                                                        <span style={{ fontWeight: 500, color: "#334155" }}>{r.time_in ? format12Hour(r.time_in) : "â€”"}</span>
                                                    </div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                                                        <span style={{ color: "#ef4444", fontWeight: 700, fontSize: "0.7rem", background: "#fee2e2", padding: "0.15rem 0.4rem", borderRadius: "4px", minWidth: "28px", textAlign: "center" }}>OUT</span> 
                                                        <span style={{ fontWeight: 500, color: "#334155" }}>{r.time_out ? format12Hour(r.time_out) : "â€”"}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: "1rem 0.75rem" }}>
                                                <NewStatusBadge status={r.status} isLate={r.is_late} />
                                            </td>
                                            <td style={{ padding: "1rem 0.75rem", color: "#475569" }}>{r.device_name || "â€”"}</td>
                                            <td style={{ padding: "1rem 0.75rem" }}>
                                                <button onClick={() => setActiveTab("reports")} style={{ display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.4rem 0.75rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", color: "#6366f1", fontSize: "0.8rem", cursor: "pointer", fontWeight: 600 }}>
                                                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
                    <div style={{ color: "#64748b", fontSize: "0.9rem" }}>
                        Showing {filteredRecords.length > 0 ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, filteredRecords.length)} of {filteredRecords.length} entries
                    </div>
                    <div style={{ display: "flex", gap: "0.25rem" }}>
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: "0.4rem 0.8rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", color: page === 1 ? "#cbd5e1" : "#475569", cursor: page === 1 ? "not-allowed" : "pointer" }}>&lt;</button>
                        {Array.from({ length: totalPages }, (_, i) => (
                            <button key={i} onClick={() => setPage(i + 1)} style={{ padding: "0.4rem 0.8rem", borderRadius: "6px", border: "none", background: page === i + 1 ? "#6366f1" : "transparent", color: page === i + 1 ? "#fff" : "#475569", cursor: "pointer", fontWeight: page === i + 1 ? 600 : 400 }}>{i + 1}</button>
                        ))}
                        <button disabled={page === totalPages || totalPages === 0} onClick={() => setPage(p => p + 1)} style={{ padding: "0.4rem 0.8rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", color: page === totalPages || totalPages === 0 ? "#cbd5e1" : "#475569", cursor: page === totalPages || totalPages === 0 ? "not-allowed" : "pointer" }}>&gt;</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function NewStatBox({ icon, title, value, subtext, color, bg, isAbsent }) {
    // Specifically adjust icon if it's absent
    const renderIcon = () => {
        if (isAbsent) {
            return <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 11l-6 6M17 11l6 6"></path></svg>;
        }
        return icon;
    };

    return (
        <div style={{ background: "#fff", borderRadius: "12px", padding: "1.1rem", border: "1px solid #f1f5f9", boxShadow: "0 2px 4px rgba(0,0,0,0.02)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                <div style={{ overflow: "hidden" }}>
                    <h4 style={{ margin: "0 0 0.4rem", color: "#64748b", fontWeight: 600, fontSize: "0.85rem", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{title}</h4>
                    <div style={{ fontSize: "1.45rem", fontWeight: 700, color: color, marginBottom: "0.25rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
                    <div style={{ fontSize: "0.8rem", color: "#94a3b8", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{subtext}</div>
                </div>
                <div style={{ width: "38px", height: "38px", flexShrink: 0, borderRadius: "10px", background: bg, color: color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {renderIcon()}
                </div>
            </div>
        </div>
    );
}

function NewStatusBadge({ status, isLate }) {
    let bg = "#e2e8f0";
    let color = "#64748b";
    let dotColor = "#94a3b8";
    let text = status;

    if (status === "present" && !isLate) {
        bg = "#fff";
        color = "#10b981";
        dotColor = "#10b981";
        text = "Present";
    } else if (status === "late" || isLate) {
        bg = "#fff";
        color = "#f59e0b";
        dotColor = "#f59e0b";
        text = "Late";
    } else if (status === "absent") {
        bg = "#fff";
        color = "#ef4444";
        dotColor = "#ef4444";
        text = "Absent";
    }

    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.2rem 0", color: color, fontWeight: 600, fontSize: "0.85rem" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: dotColor }}></div>
            {text ? text.charAt(0).toUpperCase() + text.slice(1) : ""}
        </span>
    );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DEVICES TAB  (Phase 2)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// BRAND PICKER WIZARD â€” Sub-components
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const BRAND_COLORS = {
    zkteco:    "#6366f1",
    essl:      "#059669",
    biomax:    "#d97706",
    suprema:   "#0891b2",
    realtime:  "#475569",
    simulator: "#f59e0b",
};

const BRAND_INITIALS = {
    zkteco: "ZK", essl: "ES", biomax: "BX",
    suprema: "SU", realtime: "RT", simulator: "âˆ¿",
};

const STATUS_PILL_STYLES = {
    connected: { bg: "rgba(16,185,129,0.12)", color: "#059669", dot: "#10b981", label: "Connected" },
    idle:      { bg: "rgba(59,130,246,0.1)",  color: "#3b82f6", dot: "#3b82f6", label: "Idle" },
    stale:     { bg: "rgba(245,158,11,0.12)", color: "#d97706", dot: "#f59e0b", label: "Not seen 24h" },
    offline:   { bg: "rgba(239,68,68,0.1)",   color: "#ef4444", dot: "#ef4444", label: "Offline" },
    pending:   { bg: "rgba(148,163,184,0.12)","color": "#64748b", dot: "#94a3b8", label: "Pending Setup" },
    inactive:  { bg: "rgba(148,163,184,0.12)","color": "#94a3b8", dot: "#cbd5e1", label: "Inactive" },
    online:    { bg: "rgba(16,185,129,0.12)", color: "#059669", dot: "#10b981", label: "Online" },
};

function computeLiveStatus(device) {
    if (device.status === "pending") return "pending";
    if (device.status === "inactive") return "inactive";
    const ts = device.last_punch_at || device.last_sync;
    if (!ts) return "offline";
    const diffMins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (diffMins < 15) return "connected";
    if (diffMins < 60 * 24) return "idle";
    if (diffMins < 60 * 48) return "stale";
    return "offline";
}

function StatusPill({ device }) {
    const status = computeLiveStatus(device);
    const s = STATUS_PILL_STYLES[status] || STATUS_PILL_STYLES.offline;
    return (
        <span style={{ display:"inline-flex", alignItems:"center", gap:"0.3rem", padding:"0.2rem 0.65rem",
            borderRadius:"99px", background:s.bg, color:s.color, fontWeight:600, fontSize:"0.78rem",
            letterSpacing:"0.01em", whiteSpace:"nowrap" }}>
            <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:s.dot,
                boxShadow:`0 0 0 2px ${s.bg}` }}/>
            {s.label}
        </span>
    );
}

function BrandBadge({ brand, size = 32 }) {
    const color = BRAND_COLORS[brand] || "#64748b";
    const initials = BRAND_INITIALS[brand] || "?";
    return (
        <div style={{ width:`${size}px`, height:`${size}px`, borderRadius:`${size*0.28}px`,
            background:`linear-gradient(135deg, ${color}22, ${color}44)`,
            border:`1.5px solid ${color}55`, color, display:"flex", alignItems:"center",
            justifyContent:"center", fontWeight:800, fontSize:`${size*0.37}px`, letterSpacing:"-0.5px",
            flexShrink:0 }}>
            {initials}
        </div>
    );
}

// â”€â”€â”€ Step 1 â†’ Brand Picker Cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function BrandPickerGrid({ catalog, onPick }) {
    const [hovered, setHovered] = useState(null);
    return (
        <div>
            <p style={{ margin:"0 0 1.25rem", color:"#64748b", fontSize:"0.9rem" }}>
                Select your device brand and model. All brands go through the same quick setup â€” no complicated configuration.
            </p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(210px,1fr))", gap:"0.85rem" }}>
                {catalog.map(entry => {
                    const color = BRAND_COLORS[entry.brand] || "#64748b";
                    const isHov = hovered === entry.id;
                    return (
                        <button key={entry.id} onClick={() => onPick(entry)}
                            onMouseEnter={() => setHovered(entry.id)}
                            onMouseLeave={() => setHovered(null)}
                            style={{ textAlign:"left", background: isHov ? "#f8fafc" : "#fff",
                                border:`1.5px solid ${isHov ? color : "#e2e8f0"}`,
                                borderRadius:"12px", padding:"1rem", cursor:"pointer",
                                transition:"all 0.18s", boxShadow: isHov ? `0 4px 16px ${color}22` : "none",
                                position:"relative", display:"flex", flexDirection:"column", gap:"0.65rem" }}>

                            {/* Badge */}
                            {entry.badge && (
                                <span style={{ position:"absolute", top:"8px", right:"8px",
                                    background:entry.badge_color || color, color:"#fff",
                                    fontSize:"0.65rem", fontWeight:700, padding:"0.15rem 0.45rem",
                                    borderRadius:"99px", letterSpacing:"0.02em" }}>
                                    {entry.badge}
                                </span>
                            )}

                            {/* Brand icon + name */}
                            <div style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
                                <BrandBadge brand={entry.brand} size={38} />
                                <div>
                                    <div style={{ fontWeight:700, color:"#1e293b", fontSize:"0.95rem" }}>
                                        {entry.brand_label}
                                    </div>
                                    <div style={{ fontSize:"0.78rem", color:"#64748b" }}>{entry.model}</div>
                                </div>
                            </div>

                            {/* Description */}
                            <div style={{ fontSize:"0.8rem", color:"#475569", lineHeight:1.45 }}>
                                {entry.description}
                            </div>

                            {/* Type pills */}
                            <div style={{ display:"flex", gap:"0.35rem", flexWrap:"wrap" }}>
                                <span style={{ background:`${color}15`, color, fontSize:"0.7rem",
                                    fontWeight:600, padding:"0.15rem 0.5rem", borderRadius:"99px" }}>
                                    {entry.connection_type === "lan_push" ? "LAN Push" : "Cloud Gateway"}
                                </span>
                                {entry.device_types?.map(t => (
                                    <span key={t} style={{ background:"#f1f5f9", color:"#475569",
                                        fontSize:"0.7rem", fontWeight:600, padding:"0.15rem 0.5rem",
                                        borderRadius:"99px" }}>
                                        {t.charAt(0).toUpperCase()+t.slice(1)}
                                    </span>
                                ))}
                            </div>

                            {/* Warranty warning */}
                            {entry.warranty_warning && (
                                <div style={{ display:"flex", alignItems:"flex-start", gap:"0.4rem",
                                    background:"#fffbeb", border:"1px solid #fde68a",
                                    borderRadius:"6px", padding:"0.4rem 0.6rem", marginTop:"0.1rem" }}>
                                    <span style={{ fontSize:"0.85rem", flexShrink:0 }}>âš </span>
                                    <span style={{ fontSize:"0.72rem", color:"#92400e", lineHeight:1.4 }}>
                                        Buy from an authorized dealer for warranty support
                                    </span>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// â”€â”€â”€ Step 2 â†’ Details Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function DeviceDetailsForm({ entry, form, setForm }) {
    const color = BRAND_COLORS[entry.brand] || "#6366f1";
    const hints = entry.setup_instructions?.field_hints || {};
    return (
        <div style={{ display:"flex", flexDirection:"column", gap:"1.1rem" }}>
            {/* Selected device summary */}
            <div style={{ display:"flex", alignItems:"center", gap:"0.85rem",
                background:`${color}0d`, border:`1px solid ${color}33`,
                borderRadius:"10px", padding:"0.85rem 1rem" }}>
                <BrandBadge brand={entry.brand} size={36} />
                <div>
                    <div style={{ fontWeight:700, color:"#1e293b", fontSize:"0.95rem" }}>
                        {entry.brand_label} {entry.model}
                    </div>
                    <div style={{ fontSize:"0.78rem", color:"#64748b" }}>
                        {entry.connection_type === "lan_push" ? "LAN Push (ADMS)" : "Cloud Gateway"}
                    </div>
                </div>
            </div>

            {/* Device Name */}
            <div>
                <label style={{ fontSize:"0.83rem", fontWeight:700, color:"#1e293b", marginBottom:"0.4rem", display:"block" }}>
                    Device Name <span style={{ color:"#ef4444" }}>*</span>
                </label>
                <input type="text" value={form.device_name}
                    onChange={e => setForm(f => ({ ...f, device_name: e.target.value }))}
                    placeholder="e.g. Main Gate â€” ZKTeco"
                    style={{ width:"100%", padding:"0.65rem 1rem", borderRadius:"8px",
                        border:"1px solid #e2e8f0", fontSize:"0.9rem", outline:"none", boxSizing:"border-box" }} />
            </div>

            {/* Serial Number */}
            <div>
                <label style={{ fontSize:"0.83rem", fontWeight:700, color:"#1e293b", marginBottom:"0.4rem", display:"block" }}>
                    Serial Number <span style={{ color:"#ef4444" }}>*</span>
                    {hints.device_serial && (
                        <span style={{ fontWeight:400, color:"#94a3b8", marginLeft:"0.5rem", fontSize:"0.75rem" }}>
                            ({hints.device_serial})
                        </span>
                    )}
                </label>
                <input type="text" value={form.device_serial}
                    onChange={e => setForm(f => ({ ...f, device_serial: e.target.value }))}
                    placeholder="e.g. CDK9191960001"
                    style={{ width:"100%", padding:"0.65rem 1rem", borderRadius:"8px",
                        border:"1px solid #e2e8f0", fontSize:"0.9rem", outline:"none", boxSizing:"border-box",
                        fontFamily:"monospace" }} />
            </div>

            {/* IP Address (only for lan_push) */}
            {entry.connection_type === "lan_push" && (
                <div>
                    <label style={{ fontSize:"0.83rem", fontWeight:700, color:"#1e293b", marginBottom:"0.4rem", display:"block" }}>
                        Device IP Address
                        {hints.ip_address && (
                            <span style={{ fontWeight:400, color:"#94a3b8", marginLeft:"0.5rem", fontSize:"0.75rem" }}>
                                ({hints.ip_address})
                            </span>
                        )}
                    </label>
                    <input type="text" value={form.ip_address}
                        onChange={e => setForm(f => ({ ...f, ip_address: e.target.value }))}
                        placeholder="e.g. 192.168.1.100"
                        style={{ width:"100%", padding:"0.65rem 1rem", borderRadius:"8px",
                            border:"1px solid #e2e8f0", fontSize:"0.9rem", outline:"none", boxSizing:"border-box",
                            fontFamily:"monospace" }} />
                </div>
            )}

            {/* Location */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" }}>
                <div>
                    <label style={{ fontSize:"0.83rem", fontWeight:700, color:"#1e293b", marginBottom:"0.4rem", display:"block" }}>
                        Location
                    </label>
                    <input type="text" value={form.location}
                        onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                        placeholder="e.g. Main Gate"
                        style={{ width:"100%", padding:"0.65rem 1rem", borderRadius:"8px",
                            border:"1px solid #e2e8f0", fontSize:"0.9rem", outline:"none", boxSizing:"border-box" }} />
                </div>
                <div>
                    <label style={{ fontSize:"0.83rem", fontWeight:700, color:"#1e293b", marginBottom:"0.4rem", display:"block" }}>
                        Placement
                    </label>
                    <select value={form.placement_type}
                        onChange={e => setForm(f => ({ ...f, placement_type: e.target.value }))}
                        style={{ width:"100%", padding:"0.65rem 1rem", borderRadius:"8px",
                            border:"1px solid #e2e8f0", fontSize:"0.9rem", outline:"none",
                            boxSizing:"border-box", background:"#fff" }}>
                        <option value="gate">Main Gate</option>
                        <option value="classroom">Classroom</option>
                    </select>
                </div>
            </div>
        </div>
    );
}

// â”€â”€â”€ Step 3 â†’ Instructions + Webhook URL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SetupInstructions({ registeredDevice }) {
    const [copied, setCopied] = useState(false);
    const { instructions, catalog } = registeredDevice;
    const color = BRAND_COLORS[registeredDevice.brand] || "#6366f1";
    const copy = () => {
        navigator.clipboard.writeText(instructions.webhook_url);
        setCopied(true); setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div style={{ display:"flex", flexDirection:"column", gap:"1.25rem" }}>
            {/* Summary callout */}
            <div style={{ background:`${color}0d`, border:`1px solid ${color}33`,
                borderRadius:"10px", padding:"1rem" }}>
                <div style={{ fontWeight:700, color, marginBottom:"0.4rem" }}>
                    {catalog?.setup_instructions?.summary || "Follow the steps below to connect your device."}
                </div>
            </div>

            {/* Webhook URL */}
            <div>
                <label style={{ fontSize:"0.83rem", fontWeight:700, color:"#1e293b", marginBottom:"0.4rem", display:"block" }}>
                    Your Device Webhook URL
                </label>
                <div style={{ display:"flex", gap:"0.5rem" }}>
                    <div style={{ flex:1, background:"#f8fafc", border:"1px solid #e2e8f0",
                        borderRadius:"8px", padding:"0.6rem 0.85rem", fontSize:"0.78rem",
                        color:"#475569", fontFamily:"monospace", wordBreak:"break-all",
                        lineHeight:1.5 }}>
                        {instructions.webhook_url}
                    </div>
                    <button onClick={copy} style={{ padding:"0.6rem 1rem", borderRadius:"8px",
                        background: copied ? "#10b981" : color, color:"#fff", border:"none",
                        fontWeight:600, fontSize:"0.82rem", cursor:"pointer", whiteSpace:"nowrap",
                        transition:"background 0.2s", flexShrink:0 }}>
                        {copied ? "âœ“ Copied" : "Copy"}
                    </button>
                </div>
                <div style={{ fontSize:"0.75rem", color:"#94a3b8", marginTop:"0.35rem" }}>
                    Enter this URL in your device's server/cloud settings
                </div>
            </div>

            {/* Steps */}
            <div>
                <div style={{ fontWeight:700, color:"#1e293b", fontSize:"0.88rem", marginBottom:"0.75rem" }}>
                    Setup Steps
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:"0.6rem" }}>
                    {instructions.steps?.map((step, i) => (
                        <div key={i} style={{ display:"flex", gap:"0.85rem", alignItems:"flex-start" }}>
                            <div style={{ width:"22px", height:"22px", borderRadius:"50%",
                                background:`${color}22`, color, fontWeight:800, fontSize:"0.75rem",
                                display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                                marginTop:"1px" }}>
                                {i+1}
                            </div>
                            <div style={{ fontSize:"0.88rem", color:"#334155", lineHeight:1.5, paddingTop:"2px" }}>
                                {step}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// â”€â”€â”€ Step 4 â†’ Test Connection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function TestConnectionStep({ registeredDevice, onSuccess, socket }) {
    const [received, setReceived] = useState(false);
    const [punchData, setPunchData] = useState(null);

    useEffect(() => {
        if (!socket) return;
        const handler = (data) => {
            if (data.device_token === registeredDevice.device_token || data.device_id === registeredDevice.id) {
                setReceived(true);
                setPunchData(data);
            }
        };
        socket.on("biometric:punch", handler);
        return () => socket.off("biometric:punch", handler);
    }, [socket, registeredDevice]);

    if (received) return (
        <div style={{ textAlign:"center", padding:"2rem 1rem" }}>
            <div style={{ fontSize:"3rem", marginBottom:"0.75rem" }}>ðŸŽ‰</div>
            <div style={{ fontWeight:800, fontSize:"1.2rem", color:"#059669", marginBottom:"0.5rem" }}>
                Connection Confirmed!
            </div>
            <div style={{ color:"#64748b", fontSize:"0.9rem", marginBottom:"1.5rem" }}>
                {punchData ? (
                    <>Received punch from user ID <strong>{punchData.device_user_id}</strong> at {new Date(punchData.punch_time).toLocaleTimeString()}</>
                ) : "First punch received successfully."}
            </div>
            <button onClick={onSuccess} style={{ padding:"0.75rem 2rem", borderRadius:"10px",
                background:"#059669", color:"#fff", border:"none", fontWeight:700,
                fontSize:"0.95rem", cursor:"pointer" }}>
                Done â€” View My Devices
            </button>
        </div>
    );

    return (
        <div style={{ textAlign:"center", padding:"1.5rem 1rem" }}>
            {/* Animated pulse */}
            <div style={{ position:"relative", width:"80px", height:"80px", margin:"0 auto 1.25rem" }}>
                <div style={{ position:"absolute", inset:0, borderRadius:"50%",
                    background:"rgba(99,102,241,0.12)",
                    animation:"bioPulse 2s ease-in-out infinite" }}/>
                <div style={{ position:"absolute", inset:"12px", borderRadius:"50%",
                    background:"rgba(99,102,241,0.2)",
                    animation:"bioPulse 2s ease-in-out infinite 0.3s" }}/>
                <div style={{ position:"absolute", inset:"24px", borderRadius:"50%",
                    background:"#6366f1", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                </div>
            </div>
            <style>{`@keyframes bioPulse { 0%,100%{transform:scale(1);opacity:0.6} 50%{transform:scale(1.18);opacity:1} }`}</style>

            <div style={{ fontWeight:700, color:"#1e293b", fontSize:"1rem", marginBottom:"0.5rem" }}>
                Waiting for a test punchâ€¦
            </div>
            <div style={{ color:"#64748b", fontSize:"0.87rem", maxWidth:"340px", margin:"0 auto" }}>
                On your device, scan any fingerprint or tap an RFID card. We'll detect it here automatically.
            </div>

            {/* No socket = manual skip */}
            <button onClick={onSuccess} style={{ marginTop:"1.75rem", padding:"0.55rem 1.25rem",
                borderRadius:"8px", background:"transparent", color:"#94a3b8",
                border:"1px solid #e2e8f0", fontSize:"0.82rem", cursor:"pointer" }}>
                Skip â€” I'll test later
            </button>
        </div>
    );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MAIN DEVICES TAB
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function DevicesTab() {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editDevice, setEditDevice] = useState(null);
    const [form, setForm] = useState({
        device_name: "", device_serial: "", device_type: "fingerprint",
        placement_type: "gate", room_identifier: "",
        location: "", ip_address: "",
    });

    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState("all");
    const [filterLocation, setFilterLocation] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [page, setPage] = useState(1);
    const limit = 5;

    // â”€â”€ Wizard State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [showWizard, setShowWizard] = useState(false);
    const [wizardStep, setWizardStep] = useState(1); // 1=pick, 2=details, 3=instructions, 4=test
    const [catalog, setCatalog] = useState([]);
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [wizardForm, setWizardForm] = useState({ device_name:"", device_serial:"", ip_address:"", location:"", placement_type:"gate" });
    const [registeredDevice, setRegisteredDevice] = useState(null);
    const [wizardLoading, setWizardLoading] = useState(false);
    const [socket, setSocket] = useState(null);

    // Fetch catalog once
    useEffect(() => {
        if (catalog.length === 0) {
            api.get("/biometric/catalog").then(r => {
                if (r.data.success) setCatalog(r.data.data);
            }).catch(() => {});
        }
    }, [catalog.length]);

    // Socket.io for real-time punch detection in wizard Step 4
    useEffect(() => {
        if (wizardStep === 4 && !socket) {
            try {
                const { io } = window;
                if (io) {
                    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
                    const s = io({ auth: { token }, transports: ["websocket"] });
                    setSocket(s);
                    return () => { s.disconnect(); setSocket(null); };
                }
            } catch {}
        }
    }, [wizardStep, socket]);

    const openWizard = () => {
        setWizardStep(1); setSelectedEntry(null); setRegisteredDevice(null);
        setWizardForm({ device_name:"", device_serial:"", ip_address:"", location:"", placement_type:"gate" });
        setShowWizard(true);
    };

    const closeWizard = () => {
        setShowWizard(false); setWizardStep(1);
        socket?.disconnect(); setSocket(null);
        fetchDevices();
    };

    const handlePickBrand = (entry) => {
        setSelectedEntry(entry);
        setWizardStep(2);
    };

    const handleRegisterDevice = async () => {
        if (!wizardForm.device_name || !wizardForm.device_serial) {
            toast.error("Device name and serial are required");
            return;
        }
        setWizardLoading(true);
        try {
            const res = await api.post("/biometric/devices/register", {
                catalog_id: selectedEntry.id,
                device_name: wizardForm.device_name,
                device_serial: wizardForm.device_serial,
                ip_address: wizardForm.ip_address,
                location: wizardForm.location,
                placement_type: wizardForm.placement_type,
            });
            if (res.data.success) {
                setRegisteredDevice(res.data.data);
                setWizardStep(3);
                toast.success("Device registered! Follow the setup steps.");
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Registration failed");
        } finally { setWizardLoading(false); }
    };

    const fetchDevices = useCallback(async () => {
        try {
            const res = await api.get("/biometric/devices");
            if (res.data.success) setDevices(res.data.data);
        } catch { } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchDevices(); }, [fetchDevices]);

    const openAdd = () => {
        setEditDevice(null);
        setForm({ device_name: "", device_serial: "", device_type: "fingerprint", placement_type: "gate", room_identifier: "", location: "", ip_address: "" });
        setShowForm(true);
    };

    const openEdit = (d) => {
        setEditDevice(d);
        setForm({ device_name: d.device_name, device_serial: d.device_serial, device_type: d.device_type, placement_type: d.placement_type || "gate", room_identifier: d.room_identifier || "", location: d.location || "", ip_address: d.ip_address || "" });
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!form.device_name || !form.device_serial) {
            toast.error("Device name and serial are required");
            return;
        }
        try {
            if (editDevice) {
                await api.put(`/biometric/devices/${editDevice.id}`, form);
                toast.success("Device updated");
            } else {
                const res = await api.post("/biometric/devices", form);
                toast.success("Device registered! Secret key: " + res.data.data.secret_key);
            }
            setShowForm(false);
            fetchDevices();
        } catch (err) {
            toast.error(err.response?.data?.message || "Error saving device");
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Remove this device? All enrollments on it will stop working.")) return;
        try {
            await api.delete(`/biometric/devices/${id}`);
            toast.success("Device removed");
            fetchDevices();
        } catch { toast.error("Error"); }
    };

    const handleSync = async (id) => {
        try {
            await api.post(`/biometric/devices/${id}/sync`);
            toast.success("Sync triggered");
            fetchDevices();
        } catch { toast.error("Sync failed"); }
    };

    const clearFilters = () => {
        setSearchTerm(""); setFilterType("all"); setFilterLocation("all"); setFilterStatus("all"); setPage(1);
    };

    // Stats
    const totalDevices = devices.length;
    let onlineDevices = 0;
    const locationsSet = new Set();
    const typesSet = new Set();
    devices.forEach(d => {
        const st = computeLiveStatus(d);
        if (st === "connected" || st === "online") onlineDevices++;
        if (d.location) locationsSet.add(d.location);
        if (d.device_type) typesSet.add(d.device_type);
    });
    const offlineDevices = totalDevices - onlineDevices;
    const totalLocations = locationsSet.size;

    // Filtering
    const filteredDevices = useMemo(() => {
        return devices.filter(d => {
            const st = computeLiveStatus(d);
            const matchSearch = (d.device_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (d.device_serial || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (d.brand || "").toLowerCase().includes(searchTerm.toLowerCase());
            const matchType = filterType === "all" || d.device_type === filterType;
            const matchLocation = filterLocation === "all" || d.location === filterLocation;
            const matchStatus = filterStatus === "all" ||
                                (filterStatus === "online" && (st === "connected" || st === "idle")) ||
                                (filterStatus === "offline" && (st === "offline" || st === "stale")) ||
                                filterStatus === st;
            return matchSearch && matchType && matchLocation && matchStatus;
        });
    }, [devices, searchTerm, filterType, filterLocation, filterStatus]);

    const paginatedDevices = useMemo(() => {
        const start = (page - 1) * limit;
        return filteredDevices.slice(start, start + limit);
    }, [filteredDevices, page]);

    const totalPages = Math.ceil(filteredDevices.length / limit) || 1;

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.device-menu-container')) {
                document.querySelectorAll('.device-menu-popup').forEach(p => p.style.display = 'none');
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    if (loading) return <div style={{ textAlign: "center", padding: "3rem" }}>Loading devices...</div>;

    // â”€â”€ Wizard step labels â”€â”€
    const WIZARD_STEPS = ["Pick Brand", "Details", "Instructions", "Test Connection"];

    return (
        <div style={{ animation: "fadeIn 0.3s ease-in-out" }}>
            {/* Top Action Row */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap:"0.75rem", marginBottom: "1.5rem", flexWrap:"wrap" }}>
                <button onClick={openAdd}
                    style={{ display:"flex", alignItems:"center", gap:"0.4rem", padding:"0.55rem 1.1rem",
                        borderRadius:"8px", background:"#f1f5f9", color:"#475569", border:"1px solid #e2e8f0",
                        fontWeight:600, cursor:"pointer", fontSize:"0.88rem", transition:"all 0.2s" }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Manual Add
                </button>
                <button onClick={openWizard}
                    style={{ display:"flex", alignItems:"center", gap:"0.5rem", padding:"0.6rem 1.25rem",
                        borderRadius:"8px", background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"#fff",
                        border:"none", fontWeight:700, cursor:"pointer", fontSize:"0.9rem",
                        transition:"all 0.2s", boxShadow:"0 4px 12px rgba(99,102,241,0.3)" }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        <polyline points="9 12 11 14 15 10"/>
                    </svg>
                    Connect Device
                </button>
            </div>

            {/* Stats Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                <NewStatBox icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>} title="Total Devices" value={totalDevices} subtext="All registered devices" color="#8b5cf6" bg="rgba(139,92,246,0.1)" />
                <NewStatBox icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>} title="Online Devices" value={onlineDevices} subtext="Currently active" color="#10b981" bg="rgba(16,185,129,0.1)" />
                <NewStatBox icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M17.31 17.31A10.43 10.43 0 0 1 12 19c-7 0-10-7-10-7a13.16 13.16 0 0 1 1.67-2.68"/><line x1="1" y1="1" x2="23" y2="23"/></svg>} title="Offline Devices" value={offlineDevices} subtext="Not responding" color="#f59e0b" bg="rgba(245,158,11,0.1)" />
                <NewStatBox icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} title="Total Locations" value={totalLocations} subtext="Device locations" color="#3b82f6" bg="rgba(59,130,246,0.1)" />
            </div>

            {/* Filter Bar */}
            <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.02)", padding: "1.25rem", marginBottom: "1.5rem", display: "flex", flexWrap: "wrap", gap: "1rem", border: "1px solid #f1f5f9" }}>
                <div style={{ flex: "1 1 250px" }}>
                    <label style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, marginBottom: "0.4rem", display: "block" }}>Search Devices</label>
                    <div style={{ position: "relative" }}>
                        <svg style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" placeholder="Name, serial, brand..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }} style={{ width: "100%", padding: "0.6rem 1rem 0.6rem 2.2rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }} />
                    </div>
                </div>
                <div style={{ flex: "1 1 150px" }}>
                    <label style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, marginBottom: "0.4rem", display: "block" }}>Device Type</label>
                    <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }} style={{ width: "100%", padding: "0.6rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.9rem", color: "#475569", outline: "none", backgroundColor: "#fff", cursor: "pointer", boxSizing: "border-box" }}>
                        <option value="all">All Types</option>
                        {Array.from(typesSet).map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select>
                </div>
                <div style={{ flex: "1 1 150px" }}>
                    <label style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, marginBottom: "0.4rem", display: "block" }}>Location</label>
                    <select value={filterLocation} onChange={(e) => { setFilterLocation(e.target.value); setPage(1); }} style={{ width: "100%", padding: "0.6rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.9rem", color: "#475569", outline: "none", backgroundColor: "#fff", cursor: "pointer", boxSizing: "border-box" }}>
                        <option value="all">All Locations</option>
                        {Array.from(locationsSet).map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                </div>
                <div style={{ flex: "1 1 150px" }}>
                    <label style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, marginBottom: "0.4rem", display: "block" }}>Status</label>
                    <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} style={{ width: "100%", padding: "0.6rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.9rem", color: "#475569", outline: "none", backgroundColor: "#fff", cursor: "pointer", boxSizing: "border-box" }}>
                        <option value="all">All Status</option>
                        <option value="online">Online</option>
                        <option value="pending">Pending Setup</option>
                        <option value="offline">Offline</option>
                    </select>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", flex: "1 1 120px" }}>
                    <button onClick={clearFilters} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", padding: "0.6rem 1rem", borderRadius: "8px", background: "#fff", color: "#475569", border: "1px solid #e2e8f0", fontWeight: 600, fontSize: "0.9rem", cursor: "pointer", transition: "all 0.2s", boxSizing: "border-box" }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M2 12A10 10 0 0 0 15 21"/><path d="M21.9 12A10 10 0 0 0 9 3"/><path d="M15 21v-4"/><path d="M15 17h4"/><path d="M9 3v4"/><path d="M9 7H5"/></svg>
                        Clear Filters
                    </button>
                </div>
            </div>

            {/* Main Table Card */}
            <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)", padding: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
                    <svg width="20" height="20" fill="none" stroke="#6366f1" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                    <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#1e293b" }}>Registered Devices</h3>
                </div>

                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                                {["#", "Device", "Serial / Brand", "Type", "Location", "IP", "Connection Status", "Last Seen", "Actions"].map((h) => (
                                    <th key={h} style={{ padding: "1rem 0.75rem", color: "#64748b", fontWeight: 600 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedDevices.length === 0 ? (
                                <tr>
                                    <td colSpan="9" style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>No devices found</td>
                                </tr>
                            ) : (
                                paginatedDevices.map((d, i) => {
                                    const lastSeen = d.last_punch_at || d.last_sync;
                                    const lastSeenDate = lastSeen ? new Date(lastSeen) : null;
                                    const diffMins = lastSeenDate ? Math.floor((Date.now() - lastSeenDate.getTime()) / 60000) : null;
                                    return (
                                        <tr key={d.id} style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.2s" }}
                                            onMouseOver={e => e.currentTarget.style.background = "#f8fafc"}
                                            onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                                            <td style={{ padding: "1rem 0.75rem", color: "#475569" }}>{(page - 1) * limit + i + 1}</td>
                                            <td style={{ padding: "1rem 0.75rem" }}>
                                                <div style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
                                                    {d.brand ? (
                                                        <BrandBadge brand={d.brand} size={32} />
                                                    ) : (
                                                        <div style={{ width:"32px", height:"32px", borderRadius:"8px", background:"#1e293b", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
                                                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div style={{ fontWeight: 600, color: "#1e293b" }}>{d.device_name}</div>
                                                        {d.brand && <div style={{ fontSize: "0.72rem", color: BRAND_COLORS[d.brand] || "#8b5cf6", fontWeight:600 }}>{d.brand.toUpperCase()}</div>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: "1rem 0.75rem", color: "#475569", fontFamily:"monospace", fontSize:"0.83rem" }}>
                                                <div>{d.device_serial}</div>
                                                {d.connection_type && (
                                                    <div style={{ fontSize:"0.72rem", color:"#64748b", fontFamily:"sans-serif", marginTop:"2px" }}>
                                                        {d.connection_type === "lan_push" ? "ðŸ”— LAN Push" : "â˜ï¸ Cloud Gateway"}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: "1rem 0.75rem", color: "#6366f1" }}>{d.device_type ? d.device_type.charAt(0).toUpperCase() + d.device_type.slice(1) : "â€”"}</td>
                                            <td style={{ padding: "1rem 0.75rem", color: "#475569" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                                    {d.location || "â€”"}
                                                </div>
                                            </td>
                                            <td style={{ padding: "1rem 0.75rem", color: "#475569", fontFamily:"monospace", fontSize:"0.83rem" }}>{d.ip_address || "â€”"}</td>
                                            <td style={{ padding: "1rem 0.75rem" }}>
                                                <StatusPill device={d} />
                                            </td>
                                            <td style={{ padding: "1rem 0.75rem", color: "#475569", fontSize: "0.85rem" }}>
                                                {lastSeenDate ? (
                                                    <>
                                                        <div style={{ color: "#1e293b" }}>
                                                            {lastSeenDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) === new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) ? "Today" : lastSeenDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}, {lastSeenDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                        <div style={{ color: "#94a3b8" }}>
                                                            {diffMins < 60 ? `${diffMins}m ago` : `${Math.floor(diffMins/60)}h ago`}
                                                        </div>
                                                    </>
                                                ) : <span style={{ color:"#cbd5e1" }}>Never</span>}
                                            </td>
                                            <td style={{ padding: "1rem 0.75rem", textAlign: "center" }}>
                                                <div className="device-menu-container" style={{ position: "relative", display: "inline-block" }}>
                                                    <button onClick={(e) => {
                                                        const el = document.getElementById(`menu-${d.id}`);
                                                        if (el.style.display === "none") {
                                                            document.querySelectorAll('.device-menu-popup').forEach(p => p.style.display = 'none');
                                                            el.style.display = "flex";
                                                        } else { el.style.display = "none"; }
                                                    }} style={{ background: "transparent", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "0.3rem", cursor: "pointer", color: "#64748b" }}>
                                                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                                                    </button>
                                                    <div id={`menu-${d.id}`} className="device-menu-popup" style={{ display: "none", position: "absolute", right: "0", top: "100%", zIndex: 10, background: "#fff", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", border: "1px solid #f1f5f9", flexDirection: "column", minWidth: "130px", overflow: "hidden" }}>
                                                        <button onClick={() => { openEdit(d); document.getElementById(`menu-${d.id}`).style.display = "none"; }} style={{ padding: "0.6rem 1rem", textAlign: "left", background: "transparent", border: "none", borderBottom: "1px solid #f1f5f9", cursor: "pointer", color: "#475569", fontSize: "0.85rem", width: "100%" }}>âœï¸ Edit</button>
                                                        <button onClick={() => { handleSync(d.id); document.getElementById(`menu-${d.id}`).style.display = "none"; }} style={{ padding: "0.6rem 1rem", textAlign: "left", background: "transparent", border: "none", borderBottom: "1px solid #f1f5f9", cursor: "pointer", color: "#10b981", fontSize: "0.85rem", width: "100%" }}>ðŸ”„ Sync</button>
                                                        <button onClick={() => { handleDelete(d.id); document.getElementById(`menu-${d.id}`).style.display = "none"; }} style={{ padding: "0.6rem 1rem", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", fontSize: "0.85rem", width: "100%" }}>ðŸ—‘ Remove</button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
                    <div style={{ color: "#64748b", fontSize: "0.9rem" }}>
                        Showing {filteredDevices.length > 0 ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, filteredDevices.length)} of {filteredDevices.length} devices
                    </div>
                    <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: "0.4rem 0.8rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", color: page === 1 ? "#cbd5e1" : "#475569", cursor: page === 1 ? "not-allowed" : "pointer" }}>&lt;</button>
                        {Array.from({ length: totalPages }, (_, i) => (
                            <button key={i} onClick={() => setPage(i + 1)} style={{ padding: "0.4rem 0.8rem", borderRadius: "6px", border: "none", background: page === i + 1 ? "#6366f1" : "transparent", color: page === i + 1 ? "#fff" : "#475569", cursor: "pointer", fontWeight: page === i + 1 ? 600 : 400 }}>{i + 1}</button>
                        ))}
                        <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: "0.4rem 0.8rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", color: page === totalPages ? "#cbd5e1" : "#475569", cursor: page === totalPages ? "not-allowed" : "pointer" }}>&gt;</button>
                    </div>
                </div>
            </div>

            {/* â”€â”€ BRAND PICKER WIZARD MODAL â”€â”€ */}
            {showWizard && (
                <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.55)",
                    backdropFilter:"blur(4px)", zIndex:1000, display:"flex",
                    alignItems:"center", justifyContent:"center", padding:"1rem",
                    animation:"fadeIn 0.2s ease-out" }}>
                    <div style={{ background:"#fff", borderRadius:"20px", width:"100%",
                        maxWidth: wizardStep === 1 ? "780px" : "580px",
                        maxHeight:"92vh", display:"flex", flexDirection:"column",
                        boxShadow:"0 25px 50px -12px rgba(0,0,0,0.25)",
                        transition:"max-width 0.3s ease" }}>

                        {/* Wizard Header */}
                        <div style={{ padding:"1.5rem 1.75rem 1rem", borderBottom:"1px solid #f1f5f9",
                            display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
                            <div>
                                <h2 style={{ margin:"0 0 0.25rem", fontSize:"1.2rem", fontWeight:800, color:"#1e293b" }}>
                                    {wizardStep === 1 && "Connect a Device"}
                                    {wizardStep === 2 && `${selectedEntry?.brand_label} ${selectedEntry?.model}`}
                                    {wizardStep === 3 && "Setup Instructions"}
                                    {wizardStep === 4 && "Test Connection"}
                                </h2>
                                {/* Step breadcrumb */}
                                <div style={{ display:"flex", gap:"0.35rem", alignItems:"center" }}>
                                    {WIZARD_STEPS.map((label, idx) => {
                                        const stepNum = idx + 1;
                                        const active = wizardStep === stepNum;
                                        const done = wizardStep > stepNum;
                                        return (
                                            <div key={label} style={{ display:"flex", alignItems:"center", gap:"0.35rem" }}>
                                                <span style={{ fontSize:"0.72rem", fontWeight: active ? 700 : 500,
                                                    color: done ? "#10b981" : active ? "#6366f1" : "#cbd5e1",
                                                    transition:"color 0.2s" }}>
                                                    {done ? "âœ“" : stepNum}. {label}
                                                </span>
                                                {idx < WIZARD_STEPS.length - 1 && (
                                                    <span style={{ color:"#e2e8f0", fontSize:"0.7rem" }}>â€º</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <button onClick={closeWizard} style={{ background:"none", border:"none",
                                cursor:"pointer", color:"#94a3b8", padding:"0.3rem", borderRadius:"50%",
                                display:"flex", alignItems:"center" }}
                                onMouseOver={e => e.currentTarget.style.background="#f1f5f9"}
                                onMouseOut={e => e.currentTarget.style.background="transparent"}>
                                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                            </button>
                        </div>

                        {/* Wizard Body */}
                        <div style={{ padding:"1.5rem 1.75rem", overflowY:"auto", flex:1 }}>
                            {wizardStep === 1 && (
                                <BrandPickerGrid catalog={catalog} onPick={handlePickBrand} />
                            )}
                            {wizardStep === 2 && selectedEntry && (
                                <DeviceDetailsForm entry={selectedEntry} form={wizardForm} setForm={setWizardForm} />
                            )}
                            {wizardStep === 3 && registeredDevice && (
                                <SetupInstructions registeredDevice={registeredDevice} />
                            )}
                            {wizardStep === 4 && registeredDevice && (
                                <TestConnectionStep
                                    registeredDevice={registeredDevice}
                                    socket={socket}
                                    onSuccess={closeWizard} />
                            )}
                        </div>

                        {/* Wizard Footer */}
                        {wizardStep !== 4 && (
                            <div style={{ padding:"1.25rem 1.75rem", borderTop:"1px solid #f1f5f9",
                                display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
                                <button
                                    onClick={() => wizardStep === 1 ? closeWizard() : setWizardStep(s => s - 1)}
                                    style={{ padding:"0.6rem 1.25rem", borderRadius:"8px", background:"#fff",
                                        color:"#475569", border:"1px solid #e2e8f0", fontWeight:600,
                                        fontSize:"0.88rem", cursor:"pointer" }}>
                                    {wizardStep === 1 ? "Cancel" : "â† Back"}
                                </button>
                                <div>
                                    {wizardStep === 2 && (
                                        <button onClick={handleRegisterDevice} disabled={wizardLoading}
                                            style={{ padding:"0.65rem 1.5rem", borderRadius:"8px",
                                                background: wizardLoading ? "#e2e8f0" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                                                color:"#fff", border:"none", fontWeight:700, fontSize:"0.9rem",
                                                cursor: wizardLoading ? "not-allowed" : "pointer",
                                                boxShadow:"0 4px 12px rgba(99,102,241,0.3)" }}>
                                            {wizardLoading ? "Registering..." : "Register & Continue â†’"}
                                        </button>
                                    )}
                                    {wizardStep === 3 && (
                                        <button onClick={() => setWizardStep(4)}
                                            style={{ padding:"0.65rem 1.5rem", borderRadius:"8px",
                                                background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
                                                color:"#fff", border:"none", fontWeight:700, fontSize:"0.9rem",
                                                cursor:"pointer", boxShadow:"0 4px 12px rgba(99,102,241,0.3)" }}>
                                            Test Connection â†’
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Legacy Manual Add Modal */}
            {showForm && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", animation: "fadeIn 0.2s ease-out" }}>
                    <div style={{ background: "#fff", borderRadius: "16px", padding: "2rem", width: "100%", maxWidth: "550px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
                            <div style={{ display: "flex", gap: "1rem" }}>
                                <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#6366f1", flexShrink: 0 }}>
                                    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><circle cx="12" cy="14" r="1"/><line x1="12" y1="6" x2="12.01" y2="6"/></svg>
                                </div>
                                <div>
                                    <h3 style={{ margin: "0 0 0.25rem", fontWeight: 700, fontSize: "1.25rem", color: "#1e293b" }}>{editDevice ? "Edit Device" : "Manual Device Registration"}</h3>
                                    <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>{editDevice ? "Update device details." : "Register a device manually (advanced). Use 'Connect Device' for guided setup."}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", padding: "0.25rem", borderRadius: "50%", transition: "background 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "#f1f5f9"} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                            <div>
                                <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.5rem", display: "block" }}>Device Name <span style={{ color: "#ef4444" }}>*</span></label>
                                <input type="text" value={form.device_name} onChange={(e) => setForm({ ...form, device_name: e.target.value })} placeholder="e.g. Gate-1 Fingerprint" style={{ width: "100%", padding: "0.7rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.95rem", color: "#1e293b", outline: "none", boxSizing: "border-box" }} />
                            </div>
                            <div>
                                <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.5rem", display: "block" }}>Device Serial <span style={{ color: "#ef4444" }}>*</span></label>
                                <input type="text" value={form.device_serial} onChange={(e) => setForm({ ...form, device_serial: e.target.value })} disabled={!!editDevice} placeholder="e.g. CDK9191960001" style={{ width: "100%", padding: "0.7rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.95rem", color: "#1e293b", outline: "none", boxSizing: "border-box", background: editDevice ? "#f8fafc" : "#fff", opacity: editDevice ? 0.7 : 1, fontFamily:"monospace" }} />
                            </div>
                            <div>
                                <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.5rem", display: "block" }}>Device Type <span style={{ color: "#ef4444" }}>*</span></label>
                                <select value={form.device_type} onChange={(e) => setForm({ ...form, device_type: e.target.value })} style={{ width: "100%", padding: "0.7rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.95rem", color: "#1e293b", outline: "none", boxSizing: "border-box", backgroundColor: "#fff", cursor: "pointer" }}>
                                    <option value="fingerprint">Fingerprint</option>
                                    <option value="face">Face Recognition</option>
                                    <option value="rfid">RFID Card</option>
                                    <option value="mobile">Mobile OTP</option>
                                </select>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: form.placement_type === "classroom" ? "1fr 1fr" : "1fr", gap: "1rem" }}>
                                <div>
                                    <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.5rem", display: "block" }}>Placement Type</label>
                                    <select value={form.placement_type} onChange={(e) => setForm({ ...form, placement_type: e.target.value })} style={{ width: "100%", padding: "0.7rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.95rem", color: "#1e293b", outline: "none", boxSizing: "border-box", backgroundColor: "#fff", cursor: "pointer" }}>
                                        <option value="gate">Main Gate</option>
                                        <option value="classroom">Classroom</option>
                                    </select>
                                </div>
                                {form.placement_type === "classroom" && (
                                    <div>
                                        <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.5rem", display: "block" }}>Room Name/Number</label>
                                        <input type="text" value={form.room_identifier} onChange={(e) => setForm({ ...form, room_identifier: e.target.value })} placeholder="e.g. Room 101" style={{ width: "100%", padding: "0.7rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.95rem", color: "#1e293b", outline: "none", boxSizing: "border-box" }} />
                                    </div>
                                )}
                            </div>
                            <div>
                                <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.5rem", display: "block" }}>Location</label>
                                <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Main Gate" style={{ width: "100%", padding: "0.7rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.95rem", color: "#1e293b", outline: "none", boxSizing: "border-box" }} />
                            </div>
                            <div>
                                <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.5rem", display: "block" }}>IP Address</label>
                                <input type="text" value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} placeholder="e.g. 192.168.1.100" style={{ width: "100%", padding: "0.7rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.95rem", color: "#1e293b", outline: "none", boxSizing: "border-box", fontFamily:"monospace" }} />
                            </div>
                            <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                                <button onClick={() => setShowForm(false)} style={{ padding: "0.7rem 1.5rem", borderRadius: "8px", background: "#fff", color: "#475569", border: "1px solid #e2e8f0", fontWeight: 600, fontSize: "0.9rem", cursor: "pointer" }}>Cancel</button>
                                <button onClick={handleSave} style={{ padding: "0.7rem 1.5rem", borderRadius: "8px", background: "#6366f1", color: "#fff", border: "none", fontWeight: 600, fontSize: "0.9rem", cursor: "pointer", boxShadow: "0 4px 6px rgba(99,102,241,0.2)" }}>
                                    {editDevice ? "Update Device" : "Register Device"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ENROLLMENT TAB  (Phase 3)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function EnrollmentTab() {
    const [enrollments, setEnrollments] = useState([]);
    const [devices, setDevices] = useState([]);
    const [users, setUsers] = useState([]);
    const [classes, setClasses] = useState([]);
    const [selectedClassId, setSelectedClassId] = useState("");
    const [modalLoading, setModalLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [viewEnrollment, setViewEnrollment] = useState(null);
    const [editEnrollmentId, setEditEnrollmentId] = useState(null);
    const [form, setForm] = useState({ device_id: "", device_user_id: "", user_id: "", user_role: "student" });
    const [personSearch, setPersonSearch] = useState("");
    
    // Filtering State
    const [searchTerm, setSearchTerm] = useState("");
    const [filterRole, setFilterRole] = useState("all");
    const [filterSubGroup, setFilterSubGroup] = useState("all");
    const [filterDevice, setFilterDevice] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [page, setPage] = useState(1);
    const limit = 10;

    const fetchAll = async () => {
        try {
            const [e, d, c] = await Promise.all([
                api.get("/biometric/enrollments"),
                api.get("/biometric/devices"),
                api.get("/classes")
            ]);
            if (e.data.success) setEnrollments(e.data.data);
            if (d.data.success) setDevices(d.data.data);
            if (c.data.success) setClasses(c.data.data);
        } catch { } finally { setLoading(false); }
    };

    useEffect(() => { fetchAll(); }, []);

    useEffect(() => {
        const fetchUsersForModal = async () => {
            setUsers([]);
            setPersonSearch("");
            
            if (form.user_role === "faculty") {
                setModalLoading(true);
                try {
                    const res = await api.get("/faculty?limit=10000");
                    const facultyUsers = (res.data.data || []).map((fac) => ({
                        id: fac.user_id, name: fac.User?.name, role: "faculty", subject: fac.subject, department: fac.department || "General"
                    }));
                    setUsers(facultyUsers);
                } catch {} finally { setModalLoading(false); }
            } else if (form.user_role === "student" && selectedClassId) {
                setModalLoading(true);
                try {
                    const res = await api.get(`/students?class_id=${selectedClassId}&limit=10000`);
                    const studentUsers = (res.data.data || []).map((st) => ({
                        id: st.user_id, name: st.User?.name, role: "student", rollNo: st.roll_number, department: st.course || "General"
                    }));
                    setUsers(studentUsers);
                } catch {} finally { setModalLoading(false); }
            }
        };

        if (showForm) {
            fetchUsersForModal();
        }
    }, [form.user_role, selectedClassId, showForm]);

    const handleEnroll = async () => {
        if (!form.device_id || !form.device_user_id || !form.user_id) {
            toast.error("All fields are required");
            return;
        }
        try {
            if (editEnrollmentId) {
                await api.put(`/biometric/enrollments/${editEnrollmentId}`, form);
                toast.success("Enrollment updated successfully");
            } else {
                await api.post("/biometric/enroll", form);
                toast.success("Enrolled successfully");
            }
            setShowForm(false);
            setEditEnrollmentId(null);
            fetchAll();
        } catch (err) {
            toast.error(err.response?.data?.message || "Enrollment failed");
        }
    };

    const handleEdit = (enrollment) => {
        setEditEnrollmentId(enrollment.id);
        setForm({
            device_id: enrollment.device_id || "",
            device_user_id: enrollment.device_user_id || "",
            user_id: String(enrollment.user_id),
            user_role: enrollment.User?.role || "student"
        });
        setSelectedClassId(""); // Reset so they can choose again if they want to switch
        setPersonSearch("");
        setShowForm(true);
    };

    const handleRemove = async (id) => {
        if (!confirm("Deactivate this enrollment?")) return;
        try {
            await api.delete(`/biometric/enrollments/${id}`);
            toast.success("Enrollment deactivated");
            fetchAll();
        } catch { toast.error("Error"); }
    };

    const handleActivate = async (id) => {
        try {
            await api.put(`/biometric/enrollments/${id}`, { status: "active" });
            toast.success("Enrollment activated");
            fetchAll();
        } catch { toast.error("Error"); }
    };
    
    const clearFilters = () => {
        setSearchTerm("");
        setFilterRole("all");
        setFilterSubGroup("all");
        setFilterDevice("all");
        setFilterStatus("all");
        setPage(1);
    };

    // Calculate Stats
    const totalEnrollments = enrollments.length;
    let todaysEnrollments = 0;
    let thisWeekEnrollments = 0;
    
    const now = new Date();
    const todayStr = now.toLocaleDateString();
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(now.getDate() - 7);
    
    enrollments.forEach(e => {
        const d = new Date(e.enrolled_at || e.created_at);
        if (d.toLocaleDateString() === todayStr) todaysEnrollments++;
        if (d >= oneWeekAgo) thisWeekEnrollments++;
    });
    
    const activeDevicesSet = new Set();
    enrollments.forEach(e => {
        if (e.device_id) activeDevicesSet.add(e.device_id);
    });
    const devicesActive = activeDevicesSet.size;

    // Gather unique subGroups based on role
    const subGroupsSet = new Set();
    enrollments.forEach(e => {
        if (filterRole === "student" && e.user_role === "student" && e.User?.Student?.class_id) {
            subGroupsSet.add(e.User.Student.class_id);
        } else if (filterRole === "faculty" && e.user_role === "faculty" && e.User?.Faculty?.designation) {
            subGroupsSet.add(e.User.Faculty.designation);
        }
    });

    // Rich Filtering
    const filteredEnrollments = useMemo(() => {
        return enrollments.filter(e => {
            const name = e.User?.name?.toLowerCase() || "";
            const deviceName = e.BiometricDevice?.device_name?.toLowerCase() || "";
            const deviceIdStr = String(e.device_user_id || "").toLowerCase();
            
            const matchSearch = name.includes(searchTerm.toLowerCase()) || 
                                deviceName.includes(searchTerm.toLowerCase()) || 
                                deviceIdStr.includes(searchTerm.toLowerCase());
                                
            const matchRole = filterRole === "all" || e.user_role === filterRole;
            
            let matchSubGroup = true;
            if (filterSubGroup !== "all") {
                if (filterRole === "student" && e.user_role === "student") {
                    matchSubGroup = String(e.User?.Student?.class_id) === String(filterSubGroup);
                } else if (filterRole === "faculty" && e.user_role === "faculty") {
                    matchSubGroup = e.User?.Faculty?.designation === filterSubGroup;
                } else {
                    // If filterRole is all, but subGroup has a value? Shouldn't happen since we clear it when changing role, but just in case:
                    matchSubGroup = false; 
                }
            }

            const matchDevice = filterDevice === "all" || String(e.device_id) === filterDevice;
            const matchStatus = filterStatus === "all" || e.status === filterStatus;
            
            return matchSearch && matchRole && matchSubGroup && matchDevice && matchStatus;
        });
    }, [enrollments, searchTerm, filterRole, filterSubGroup, filterDevice, filterStatus]);

    const paginated = useMemo(() => {
        const start = (page - 1) * limit;
        return filteredEnrollments.slice(start, start + limit);
    }, [filteredEnrollments, page]);

    const totalPages = Math.ceil(filteredEnrollments.length / limit) || 1;
    
    const getInitials = (name) => {
        if (!name) return "U";
        return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
    };
    
    const getAvatarColor = (name) => {
        const colors = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6"];
        if (!name) return colors[0];
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    if (loading) return <div style={{ textAlign: "center", padding: "3rem" }}>Loading enrollments...</div>;

    const filteredUsers = users;

    return (
        <div style={{ animation: "fadeIn 0.3s ease-in-out" }}>
            {/* Header & Search */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <svg width="24" height="24" fill="none" stroke="#64748b" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#1e293b" }}>Biometric Enrollments</h2>
                </div>
                <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                    <button onClick={() => setShowForm(true)} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.25rem", borderRadius: "8px", background: "#6366f1", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer", fontSize: "0.9rem", transition: "all 0.2s", boxShadow: "0 4px 6px rgba(99,102,241,0.2)" }}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Enroll Person
                    </button>
                </div>
            </div>

            {/* Info Banner */}
            <div style={{ background: "#f5f3ff", border: "1px solid #ede9fe", borderRadius: "10px", padding: "1rem", marginBottom: "1.5rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <div style={{ color: "#7c3aed", display: "flex" }}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                </div>
                <div style={{ fontSize: "0.85rem", color: "#4c1d95" }}>
                    <strong>How enrollment works:</strong> Admin assigns fingerprint on device <span style={{ opacity: 0.5 }}>â†’</span> notes the Device User ID shown <span style={{ opacity: 0.5 }}>â†’</span> enters it here to link it to a student/faculty account.
                </div>
            </div>

            {/* Stats Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                <NewStatBox 
                    icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><path d="M12 14v.01"></path><path d="M9 9a3 3 0 0 1 6 0"></path></svg>} 
                    title="Total Enrollments" value={totalEnrollments} subtext="All time" color="#8b5cf6" bg="rgba(139,92,246,0.1)"
                />
                <NewStatBox 
                    icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><path d="M9 16l2 2 4-4"></path></svg>} 
                    title="Today's Enrollments" value={todaysEnrollments} subtext="Today" color="#10b981" bg="rgba(16,185,129,0.1)"
                />
                <NewStatBox 
                    icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><circle cx="19" cy="11" r="2"></circle><path d="M19 8v6"></path><path d="M16 11h6"></path></svg>} 
                    title="This Week" value={thisWeekEnrollments} subtext="This week" color="#f59e0b" bg="rgba(245,158,11,0.1)"
                />
                <NewStatBox 
                    icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line><path d="M10 2h4"></path></svg>} 
                    title="Devices Active" value={devicesActive} subtext="Online devices" color="#3b82f6" bg="rgba(59,130,246,0.1)"
                />
            </div>

            {/* Filter Bar */}
            <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.02)", padding: "1.25rem", marginBottom: "1.5rem", display: "flex", flexWrap: "wrap", gap: "1rem", border: "1px solid #f1f5f9" }}>
                <div style={{ flex: "1 1 150px" }}>
                    <label style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, marginBottom: "0.4rem", display: "block" }}>Select Role</label>
                    <select value={filterRole} onChange={(e) => { setFilterRole(e.target.value); setFilterSubGroup("all"); setPage(1); }} style={{ width: "100%", padding: "0.6rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.9rem", color: "#475569", outline: "none", backgroundColor: "#fff", cursor: "pointer", boxSizing: "border-box" }}>
                        <option value="all">All Roles</option>
                        <option value="student">Student</option>
                        <option value="faculty">Faculty</option>
                    </select>
                </div>
                {filterRole !== "all" && (
                    <div style={{ flex: "1 1 150px", animation: "fadeIn 0.3s ease-in-out" }}>
                        <label style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, marginBottom: "0.4rem", display: "block" }}>
                            {filterRole === "student" ? "Select Class" : "Select Designation"}
                        </label>
                        <select value={filterSubGroup} onChange={(e) => { setFilterSubGroup(e.target.value); setPage(1); }} style={{ width: "100%", padding: "0.6rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.9rem", color: "#475569", outline: "none", backgroundColor: "#fff", cursor: "pointer", boxSizing: "border-box" }}>
                            <option value="all">All {filterRole === "student" ? "Classes" : "Designations"}</option>
                            {Array.from(subGroupsSet).map(val => {
                                let label = val;
                                if (filterRole === "student") {
                                    const cls = classes.find(c => String(c.id) === String(val));
                                    if (cls) label = `${cls.name} ${cls.section || ''}`;
                                }
                                return <option key={val} value={val}>{label}</option>
                            })}
                        </select>
                    </div>
                )}
                <div style={{ flex: "1 1 150px" }}>
                    <label style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, marginBottom: "0.4rem", display: "block" }}>Select Device</label>
                    <select value={filterDevice} onChange={(e) => { setFilterDevice(e.target.value); setPage(1); }} style={{ width: "100%", padding: "0.6rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.9rem", color: "#475569", outline: "none", backgroundColor: "#fff", cursor: "pointer", boxSizing: "border-box" }}>
                        <option value="all">All Devices</option>
                        {devices.map(d => <option key={d.id} value={d.id}>{d.device_name}</option>)}
                    </select>
                </div>
                <div style={{ flex: "1 1 150px" }}>
                    <label style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, marginBottom: "0.4rem", display: "block" }}>Status</label>
                    <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} style={{ width: "100%", padding: "0.6rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.9rem", color: "#475569", outline: "none", backgroundColor: "#fff", cursor: "pointer", boxSizing: "border-box" }}>
                        <option value="all">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", flex: "1 1 120px" }}>
                    <button onClick={clearFilters} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", padding: "0.6rem 1rem", borderRadius: "8px", background: "#fff", color: "#475569", border: "1px solid #e2e8f0", fontWeight: 600, fontSize: "0.9rem", cursor: "pointer", transition: "all 0.2s", boxSizing: "border-box" }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M2 12A10 10 0 0 0 15 21"></path><path d="M21.9 12A10 10 0 0 0 9 3"></path><path d="M15 21v-4"></path><path d="M15 17h4"></path><path d="M9 3v4"></path><path d="M9 7H5"></path></svg>
                        Clear Filters
                    </button>
                </div>
                
                {/* Search Bar on Next Line */}
                <div style={{ flex: "1 1 100%", position: "relative", marginTop: "0.5rem" }}>
                    <svg style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input 
                        value={searchTerm} 
                        onChange={(e) => {setSearchTerm(e.target.value); setPage(1);}} 
                        placeholder="Search gracefully by name, device, or ID..." 
                        style={{ width: "100%", padding: "0.75rem 1rem 0.75rem 2.75rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.95rem", color: "#1e293b", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s", backgroundColor: "#f8fafc" }} 
                        onFocus={e => e.currentTarget.style.borderColor = "#6366f1"} 
                        onBlur={e => e.currentTarget.style.borderColor = "#e2e8f0"}
                    />
                </div>
            </div>

            {/* Table Card */}
            <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)", padding: "1.5rem" }}>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                                {["#", "Person", "Role", filterRole === "student" ? "Class" : filterRole === "faculty" ? "Designation" : "Class / Designation", "Device", "Device User ID", "Enrolled On", "Enrolled By", "Status", "Actions"].map((h) => (
                                    <th key={h} style={{ padding: "1rem 0.75rem", color: "#64748b", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.length === 0 ? (
                                <tr>
                                    <td colSpan="10" style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                                            <div style={{ fontSize: "2rem", color: "#cbd5e1" }}>ðŸ”</div>
                                            <div>No enrollments found matching criteria</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginated.map((e, i) => {
                                    const name = e.User?.name || "Unknown";
                                    const roleStr = e.user_role === "student" ? "Student" : "Faculty";
                                    
                                    const studentRoll = e.User?.Student?.roll_number;
                                    const rollOrEmp = roleStr === "Student" ? (studentRoll || "N/A") : `EMP${String(e.user_id).padStart(4,'0')}`;
                                    
                                    const initials = getInitials(name);
                                    const avatarColor = getAvatarColor(name);
                                    const isActive = e.status === "active";
                                    
                                    let classOrDesig = "Unassigned";
                                    if (roleStr === "Student") {
                                        const c = classes.find(cls => String(cls.id) === String(e.User?.Student?.class_id));
                                        if (c) classOrDesig = `${c.name} ${c.section || ''}`;
                                    } else {
                                        classOrDesig = e.User?.Faculty?.designation || "Unassigned";
                                    }
                                    
                                    return (
                                        <tr key={e.id} style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.2s" }} onMouseOver={ev => ev.currentTarget.style.background = "#f8fafc"} onMouseOut={ev => ev.currentTarget.style.background = "transparent"}>
                                            <td style={{ padding: "1rem 0.75rem", color: "#475569" }}>{(page - 1) * limit + i + 1}</td>
                                            <td style={{ padding: "1rem 0.75rem", display: "flex", alignItems: "center", gap: "0.75rem", whiteSpace: "nowrap" }}>
                                                <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: avatarColor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: "0.8rem", flexShrink: 0 }}>
                                                    {initials}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, color: "#1e293b" }}>{name}</div>
                                                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{rollOrEmp}</div>
                                                </div>
                                            </td>
                                            <td style={{ padding: "1rem 0.75rem" }}>
                                                <span style={{ display: "inline-block", padding: "0.2rem 0.6rem", borderRadius: "12px", background: roleStr === "Student" ? "#e0f2fe" : "#f3e8ff", color: roleStr === "Student" ? "#0284c7" : "#7c3aed", fontSize: "0.75rem", fontWeight: 600 }}>
                                                    {roleStr}
                                                </span>
                                            </td>
                                            <td style={{ padding: "1rem 0.75rem", color: "#475569" }}>{classOrDesig}</td>
                                            <td style={{ padding: "1rem 0.75rem", display: "flex", alignItems: "center", gap: "0.75rem", whiteSpace: "nowrap" }}>
                                                <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: "#1e293b", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect></svg>
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, color: "#1e293b", fontSize: "0.85rem" }}>{e.BiometricDevice?.device_name || "Unknown"}</div>
                                                    <div style={{ fontSize: "0.7rem", color: "#6366f1" }}>{e.BiometricDevice?.device_serial?.substring(0,6) || "â€”"}</div>
                                                </div>
                                            </td>
                                            <td style={{ padding: "1rem 0.75rem", color: "#475569", fontFamily: "monospace", fontSize: "0.95rem" }}>{e.device_user_id}</td>
                                            <td style={{ padding: "1rem 0.75rem", color: "#475569", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                                                <div style={{ color: "#1e293b" }}>{new Date(e.enrolled_at || e.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                                <div style={{ color: "#94a3b8" }}>{new Date(e.enrolled_at || e.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                                            </td>
                                            <td style={{ padding: "1rem 0.75rem", color: "#475569", fontSize: "0.85rem" }}>IT Hub Admin</td>
                                            <td style={{ padding: "1rem 0.75rem" }}>
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.2rem 0.6rem", borderRadius: "12px", background: isActive ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: isActive ? "#10b981" : "#ef4444", fontWeight: 600, fontSize: "0.8rem" }}>
                                                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: isActive ? "#10b981" : "#ef4444" }}></div>
                                                    {isActive ? "Active" : "Inactive"}
                                                </span>
                                            </td>
                                            <td style={{ padding: "1rem 0.75rem", textAlign: "center" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                    <div className="device-menu-container" style={{ position: "relative" }}>
                                                        <button onClick={(ev) => {
                                                            const el = document.getElementById(`enroll-menu-${e.id}`);
                                                            if (el.style.display === "none") {
                                                                document.querySelectorAll('.device-menu-popup').forEach(p => p.style.display = 'none');
                                                                el.style.display = "flex";
                                                            } else el.style.display = "none";
                                                        }} style={{ background: "transparent", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "0.3rem", cursor: "pointer", color: "#64748b" }}>
                                                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                                                        </button>
                                                        <div id={`enroll-menu-${e.id}`} className="device-menu-popup" style={{ display: "none", position: "absolute", right: "0", top: "100%", zIndex: 10, background: "#fff", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", border: "1px solid #f1f5f9", flexDirection: "column", minWidth: "120px", overflow: "hidden" }}>
                                                            <button onClick={() => { handleEdit(e); document.getElementById(`enroll-menu-${e.id}`).style.display = "none"; }} style={{ padding: "0.6rem 1rem", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", color: "#6366f1", fontSize: "0.85rem", width: "100%", borderBottom: "1px solid #f1f5f9" }}>Edit</button>
                                                            {isActive ? (
                                                                <button onClick={() => { handleRemove(e.id); document.getElementById(`enroll-menu-${e.id}`).style.display = "none"; }} style={{ padding: "0.6rem 1rem", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", fontSize: "0.85rem", width: "100%" }}>Deactivate</button>
                                                            ) : (
                                                                <button onClick={() => { handleActivate(e.id); document.getElementById(`enroll-menu-${e.id}`).style.display = "none"; }} style={{ padding: "0.6rem 1rem", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", color: "#10b981", fontSize: "0.85rem", width: "100%" }}>Activate</button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
                    <div style={{ color: "#64748b", fontSize: "0.9rem" }}>
                        Showing {filteredEnrollments.length > 0 ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, filteredEnrollments.length)} of {filteredEnrollments.length} enrollments
                    </div>
                    <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: "0.4rem 0.8rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", color: page === 1 ? "#cbd5e1" : "#475569", cursor: page === 1 ? "not-allowed" : "pointer" }}>&lt;</button>
                        {Array.from({ length: totalPages }, (_, i) => {
                            if (totalPages > 7) {
                                if (i !== 0 && i !== totalPages - 1 && Math.abs(page - 1 - i) > 1) {
                                    if (i === 1 || i === totalPages - 2) return <span key={i} style={{ padding: "0 0.2rem", color: "#94a3b8" }}>...</span>;
                                    return null;
                                }
                            }
                            return (
                                <button key={i} onClick={() => setPage(i + 1)} style={{ padding: "0.4rem 0.8rem", borderRadius: "6px", border: "none", background: page === i + 1 ? "#6366f1" : "transparent", color: page === i + 1 ? "#fff" : "#475569", cursor: "pointer", fontWeight: page === i + 1 ? 600 : 400 }}>{i + 1}</button>
                            );
                        })}
                        <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: "0.4rem 0.8rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", color: page === totalPages ? "#cbd5e1" : "#475569", cursor: page === totalPages ? "not-allowed" : "pointer" }}>&gt;</button>
                        <select value={limit} disabled style={{ padding: "0.4rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontSize: "0.85rem", marginLeft: "0.5rem" }}>
                            <option value={limit}>{limit} / page</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", animation: "fadeIn 0.2s ease-out" }}>
                    <div style={{ background: "#fff", borderRadius: "16px", padding: "2rem", width: "100%", maxWidth: "550px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
                            <div style={{ display: "flex", gap: "1rem" }}>
                                <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(99, 102, 241, 0.1)", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: "1.25rem", color: "#1e293b" }}>Enroll Person on Device</h3>
                                    <p style={{ margin: "0.25rem 0 0", fontSize: "0.9rem", color: "#64748b" }}>Link a person to a biometric device for attendance tracking.</p>
                                </div>
                            </div>
                            <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", padding: "0.5rem", borderRadius: "50%", transition: "background 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "#f1f5f9"} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                            {/* Device Field */}
                            <div>
                                <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.4rem", display: "block" }}>Device <span style={{ color: "#ef4444" }}>*</span></label>
                                <div style={{ position: "relative" }}>
                                    <svg style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                                    <select value={form.device_id} onChange={(e) => setForm({ ...form, device_id: e.target.value })} style={{ width: "100%", padding: "0.8rem 1rem 0.8rem 2.75rem", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.95rem", color: "#1e293b", outline: "none", boxSizing: "border-box", backgroundColor: "#fff", cursor: "pointer", appearance: "none", transition: "border-color 0.2s" }} onFocus={e => e.currentTarget.style.borderColor = "#6366f1"} onBlur={e => e.currentTarget.style.borderColor = "#e2e8f0"}>
                                        <option value="">Select device...</option>
                                        {devices.map((d) => <option key={d.id} value={d.id}>{d.device_name} (Loc: {d.location})</option>)}
                                    </select>
                                    <svg style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </div>
                            </div>

                            {/* Device User ID Field */}
                            <div>
                                <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.4rem", display: "block" }}>Device User ID <span style={{ color: "#ef4444" }}>*</span></label>
                                <div style={{ position: "relative" }}>
                                    <svg style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                    <input type="text" value={form.device_user_id} onChange={(e) => setForm({ ...form, device_user_id: e.target.value })} placeholder="1024" style={{ width: "100%", padding: "0.8rem 1rem 0.8rem 2.75rem", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.95rem", color: "#1e293b", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }} onFocus={e => e.currentTarget.style.borderColor = "#6366f1"} onBlur={e => e.currentTarget.style.borderColor = "#e2e8f0"} />
                                </div>
                                <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.4rem" }}>User ID displayed on device after fingerprint enrollment.</div>
                            </div>

                            {/* Role Field */}
                            <div>
                                <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.4rem", display: "block" }}>Role <span style={{ color: "#ef4444" }}>*</span></label>
                                <div style={{ position: "relative" }}>
                                    <svg style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    <select value={form.user_role} onChange={(e) => setForm({ ...form, user_role: e.target.value, user_id: "" })} style={{ width: "100%", padding: "0.8rem 1rem 0.8rem 2.75rem", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.95rem", color: "#1e293b", outline: "none", boxSizing: "border-box", backgroundColor: "#fff", cursor: "pointer", appearance: "none", transition: "border-color 0.2s" }} onFocus={e => e.currentTarget.style.borderColor = "#6366f1"} onBlur={e => e.currentTarget.style.borderColor = "#e2e8f0"}>
                                        <option value="student">Student</option>
                                        <option value="faculty">Faculty</option>
                                    </select>
                                    <svg style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </div>
                                <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.4rem" }}>Select the role of the person.</div>
                            </div>

                            {/* Class Field (Only for Students) */}
                            {form.user_role === "student" && (
                                <div>
                                    <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.4rem", display: "block" }}>Class <span style={{ color: "#ef4444" }}>*</span></label>
                                    <div style={{ position: "relative" }}>
                                        <svg style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                                        <select value={selectedClassId} onChange={(e) => { setSelectedClassId(e.target.value); setForm({ ...form, user_id: "" }); }} style={{ width: "100%", padding: "0.8rem 1rem 0.8rem 2.75rem", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.95rem", color: "#1e293b", outline: "none", boxSizing: "border-box", backgroundColor: "#fff", cursor: "pointer", appearance: "none", transition: "border-color 0.2s" }} onFocus={e => e.currentTarget.style.borderColor = "#6366f1"} onBlur={e => e.currentTarget.style.borderColor = "#e2e8f0"}>
                                            <option value="">Select a class...</option>
                                            {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
                                        </select>
                                        <svg style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                    </div>
                                    <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.4rem" }}>Select the class to load students.</div>
                                </div>
                            )}

                            {/* Person Field */}
                            <div>
                                <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.4rem", display: "block" }}>Person <span style={{ color: "#ef4444" }}>*</span></label>
                                <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden", backgroundColor: "#fff" }}>
                                    <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "0.5rem", background: "#f8fafc" }}>
                                        <svg width="18" height="18" fill="none" stroke="#64748b" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                        <input 
                                            type="text" 
                                            placeholder="Search person by name or roll number..." 
                                            value={personSearch}
                                            onChange={(e) => setPersonSearch(e.target.value)}
                                            style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: "0.9rem", color: "#1e293b" }}
                                        />
                                        <span style={{ fontSize: "0.8rem", color: form.user_id ? "#6366f1" : "#64748b", fontWeight: 600 }}>
                                            {form.user_id ? "1 selected" : "0 selected"}
                                        </span>
                                    </div>
                                    <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                                        {filteredUsers.filter(u => !personSearch || u.name?.toLowerCase().includes(personSearch.toLowerCase()) || u.rollNo?.toLowerCase().includes(personSearch.toLowerCase())).map((u) => {
                                            const isSelected = form.user_id === String(u.id);
                                            const initials = u.name ? u.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() : "?";
                                            return (
                                                <div 
                                                    key={u.id} 
                                                    onClick={() => setForm({ ...form, user_id: String(u.id) })}
                                                    style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: "1rem", cursor: "pointer", background: isSelected ? "rgba(99, 102, 241, 0.05)" : "transparent", transition: "background 0.2s" }}
                                                    onMouseOver={e => { if(!isSelected) e.currentTarget.style.background = "#f8fafc"; }}
                                                    onMouseOut={e => { if(!isSelected) e.currentTarget.style.background = "transparent"; }}
                                                >
                                                    <div style={{ width: "20px", height: "20px", borderRadius: "4px", border: "2px solid " + (isSelected ? "#6366f1" : "#cbd5e1"), display: "flex", alignItems: "center", justifyContent: "center", background: isSelected ? "#6366f1" : "#fff", flexShrink: 0 }}>
                                                        {isSelected && <svg width="12" height="12" fill="none" stroke="#fff" strokeWidth="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                                    </div>
                                                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#f1f5f9", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: "0.85rem", flexShrink: 0 }}>
                                                        {initials}
                                                    </div>
                                                    <div style={{ flex: 1, overflow: "hidden" }}>
                                                        <div style={{ fontWeight: 600, color: "#1e293b", fontSize: "0.95rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</div>
                                                        <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.1rem" }}>
                                                            {u.role === "student" ? `Roll: ${u.rollNo || "N/A"}` : "Faculty"} â€¢ Dept: {u.department || "N/A"}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {filteredUsers.filter(u => !personSearch || u.name?.toLowerCase().includes(personSearch.toLowerCase()) || u.rollNo?.toLowerCase().includes(personSearch.toLowerCase())).length === 0 && (
                                            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.9rem" }}>
                                                {modalLoading ? "Loading records..." : (form.user_role === "student" && !selectedClassId ? "Please select a class first." : "No persons found.")}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.4rem" }}>Select the person to enroll on this device.</div>
                            </div>
                        </div>

                        {/* Info Alert */}
                        <div style={{ background: "rgba(139, 92, 246, 0.08)", border: "1px solid rgba(139, 92, 246, 0.2)", borderRadius: "10px", padding: "1rem", marginTop: "1.5rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
                            <div style={{ color: "#7c3aed", display: "flex", flexShrink: 0 }}>
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                            </div>
                            <div style={{ fontSize: "0.85rem", color: "#6d28d9", fontWeight: 500 }}>
                                Make sure the person's fingerprint is captured on the device.
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end", marginTop: "1.5rem" }}>
                            <button onClick={() => setShowForm(false)} style={{ padding: "0.7rem 1.5rem", borderRadius: "10px", background: "#fff", color: "#475569", border: "1px solid #e2e8f0", fontWeight: 600, fontSize: "0.95rem", cursor: "pointer", transition: "background 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "#f8fafc"} onMouseOut={e => e.currentTarget.style.background = "#fff"}>
                                Cancel
                            </button>
                            <button onClick={handleEnroll} style={{ padding: "0.7rem 1.5rem", borderRadius: "10px", background: "#6366f1", color: "#fff", border: "none", fontWeight: 600, fontSize: "0.95rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", boxShadow: "0 4px 6px rgba(99,102,241,0.2)", transition: "background 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "#4f46e5"} onMouseOut={e => e.currentTarget.style.background = "#6366f1"}>
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                Enroll Person
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// OTP / QR TAB  (Smart QR Attendance â€” Faculty scans student QR)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function OtpQrTab() {
    const navigate = useNavigate();
    return (
        <div style={{ animation: "fadeIn 0.3s ease-out" }}>
            {/* Hero Banner */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "2rem", marginBottom: "1.5rem", display: "flex", gap: "2rem", alignItems: "center", justifyContent: "space-between", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", gap: "1.5rem", maxWidth: "800px" }}>
                    <div style={{ width: "64px", height: "64px", borderRadius: "16px", background: "rgba(99, 102, 241, 0.1)", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="5" height="5" rx="1"/>
                            <rect x="16" y="3" width="5" height="5" rx="1"/>
                            <rect x="3" y="16" width="5" height="5" rx="1"/>
                            <path d="M21 16h-3a2 2 0 0 0-2 2v3"/>
                            <path d="M21 21v.01"/>
                            <path d="M12 7v3a2 2 0 0 1-2 2H7"/>
                            <path d="M3 12h.01"/>
                            <path d="M12 3h.01"/>
                            <path d="M12 16v.01"/>
                            <path d="M16 12h1"/>
                            <path d="M21 12v.01"/>
                            <path d="M12 21v-1"/>
                        </svg>
                    </div>
                    <div>
                        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.5rem", fontWeight: 700, color: "#1e293b" }}>Smart QR Attendance System</h2>
                        <p style={{ color: "#475569", margin: 0, fontSize: "1rem", lineHeight: 1.6 }}>
                            Each student receives a <strong>unique permanent QR code</strong> upon subject enrollment. Faculty scans the student's QR code to instantly mark attendance â€” <strong>no OTP, no student action required.</strong>
                        </p>
                    </div>
                </div>
                {/* Illustration area (right side) */}
                <div style={{ flexShrink: 0, position: "relative", marginRight: "1rem" }}>
                    <div style={{ width: "96px", height: "140px", position: "relative" }}>
                        {/* Elegant Smartphone with QR */}
                        <svg width="100%" height="100%" viewBox="0 0 24 34" fill="none" stroke="#64748b" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.05))" }}>
                            {/* Phone body */}
                            <rect x="1" y="1" width="22" height="32" rx="3" fill="#f8fafc" stroke="#94a3b8"></rect>
                            {/* Speaker */}
                            <line x1="9" y1="4" x2="15" y2="4" stroke="#cbd5e1" strokeWidth="1.5"></line>
                            
                            {/* QR Outer Frame */}
                            <rect x="6" y="9" width="12" height="12" rx="1.5" stroke="#475569"></rect>
                            
                            {/* QR Inner Elements */}
                            <rect x="8" y="11" width="2.5" height="2.5" rx="0.5" fill="#475569" stroke="none"></rect>
                            <rect x="13.5" y="11" width="2.5" height="2.5" rx="0.5" fill="#475569" stroke="none"></rect>
                            <rect x="8" y="16.5" width="2.5" height="2.5" rx="0.5" fill="#475569" stroke="none"></rect>
                            <rect x="14" y="17" width="2" height="2" rx="0.5" fill="#475569" stroke="none"></rect>
                            <rect x="12" y="15" width="2" height="2" rx="0.5" fill="#475569" stroke="none"></rect>
                        </svg>

                        {/* Floating blue checkmark */}
                        <div style={{ position: "absolute", bottom: "5px", right: "-12px", width: "42px", height: "42px", borderRadius: "50%", background: "#dbeafe", color: "#0ea5e9", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", border: "4px solid #fff" }}>
                            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Feature Cards Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
                {/* Card 1 */}
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 2px 4px rgba(0,0,0,0.02)", display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
                        <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(168, 85, 247, 0.1)", color: "#a855f7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="5" height="5" rx="1"/>
                                <rect x="16" y="3" width="5" height="5" rx="1"/>
                                <rect x="3" y="16" width="5" height="5" rx="1"/>
                                <path d="M21 16h-3a2 2 0 0 0-2 2v3"/>
                                <path d="M21 21v.01"/>
                                <path d="M12 7v3a2 2 0 0 1-2 2H7"/>
                                <path d="M3 12h.01"/>
                                <path d="M12 3h.01"/>
                                <path d="M12 16v.01"/>
                                <path d="M16 12h1"/>
                                <path d="M21 12v.01"/>
                                <path d="M12 21v-1"/>
                            </svg>
                        </div>
                        <div>
                            <h4 style={{ margin: "0 0 0.25rem", color: "#1e293b", fontWeight: 700, fontSize: "1.05rem" }}>Student Gets QR Code</h4>
                            <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem", lineHeight: 1.6 }}>When a student enrolls in a subject, a unique permanent QR code is auto generated and linked to their profile.</p>
                        </div>
                    </div>
                    <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: "1rem", marginTop: "auto", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#22c55e", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                        <span style={{ fontSize: "0.8rem", color: "#475569", fontWeight: 500 }}>QR code never changes or expires</span>
                    </div>
                </div>

                {/* Card 2 */}
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 2px 4px rgba(0,0,0,0.02)", display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
                        <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(56, 189, 248, 0.1)", color: "#38bdf8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                        </div>
                        <div>
                            <h4 style={{ margin: "0 0 0.25rem", color: "#1e293b", fontWeight: 700, fontSize: "1.05rem" }}>Faculty Scans QR</h4>
                            <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem", lineHeight: 1.6 }}>Faculty opens Mark Attendance, points the camera scanner at the student's QR code, and attendance is marked present instantly.</p>
                        </div>
                    </div>
                    <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: "1rem", marginTop: "auto", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#22c55e", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                        <span style={{ fontSize: "0.8rem", color: "#475569", fontWeight: 500 }}>No manual entry or student action needed</span>
                    </div>
                </div>

                {/* Card 3 */}
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 2px 4px rgba(0,0,0,0.02)", display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
                        <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(74, 222, 128, 0.1)", color: "#4ade80", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        </div>
                        <div>
                            <h4 style={{ margin: "0 0 0.25rem", color: "#1e293b", fontWeight: 700, fontSize: "1.05rem" }}>Permanent & Unique</h4>
                            <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem", lineHeight: 1.6 }}>Each student's QR code never regenerates. It is tied to their enrollment and cannot be duplicated or reused by another student.</p>
                        </div>
                    </div>
                    <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: "1rem", marginTop: "auto", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#22c55e", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                        <span style={{ fontSize: "0.8rem", color: "#475569", fontWeight: 500 }}>One student, one permanent QR code</span>
                    </div>
                </div>
            </div>

            {/* Quick Links Header */}
            <h4 style={{ margin: "0 0 1rem", fontWeight: 700, fontSize: "1.1rem", color: "#1e293b" }}>Quick Links</h4>

            {/* Quick Links Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                {/* Link 1 */}
                <div onClick={() => navigate("/admin/smart-attendance")} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: "all 0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }} onMouseOver={e => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.transform = "translateY(-2px)"; }} onMouseOut={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.transform = "none"; }}>
                    <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                        <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(168, 85, 247, 0.1)", color: "#a855f7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, color: "#1e293b", fontSize: "0.95rem" }}>Faculty Scanner</div>
                            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Open scanner to mark attendance</div>
                        </div>
                    </div>
                    <div style={{ color: "#94a3b8" }}><svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></div>
                </div>

                {/* Link 2 - Student Scanner */}
                <div onClick={() => navigate("/student/smart-attendance")} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: "all 0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }} onMouseOver={e => { e.currentTarget.style.borderColor = "#38bdf8"; e.currentTarget.style.transform = "translateY(-2px)"; }} onMouseOut={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.transform = "none"; }}>
                    <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                        <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(56, 189, 248, 0.1)", color: "#38bdf8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2"></path></svg>
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, color: "#1e293b", fontSize: "0.95rem" }}>Student Scanner</div>
                            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Self-service attendance scanner</div>
                        </div>
                    </div>
                    <div style={{ color: "#94a3b8" }}><svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></div>
                </div>
            </div>

            {/* Note Alert */}
            <div style={{ background: "rgba(99, 102, 241, 0.08)", border: "1px solid rgba(99, 102, 241, 0.2)", borderRadius: "12px", padding: "1rem 1.5rem", display: "flex", gap: "0.75rem", alignItems: "center", color: "#4f46e5", fontSize: "0.9rem", fontWeight: 500 }}>
                <div style={{ flexShrink: 0, display: "flex" }}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                </div>
                <div>Note: This system ensures secure, fast, and accurate attendance tracking with zero student effort.</div>
            </div>

        </div>
    );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// REPORTS TAB  (Phase 8 + 12)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ReportsTab() {
    const [reportType, setReportType] = useState("late");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [loading, setLoading] = useState(false);

    // Initialize with empty array for real-world application behavior
    const [data, setData] = useState([]);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const endpoint = reportType === "late" 
                ? `/biometric/late-report?start_date=${startDate}&end_date=${endDate}&role=${roleFilter}`
                : reportType === "absent"
                    ? `/biometric/absent-report?start_date=${startDate}&end_date=${endDate}&role=${roleFilter}`
                    : `/biometric/present-report?start_date=${startDate}&end_date=${endDate}&role=${roleFilter}`;
            const res = await api.get(endpoint);
            if (res.data.success && res.data.data.length > 0) {
                const mapped = res.data.data.map((r, i) => {
                    const names = (r.name || "Unknown User").split(" ");
                    const initials = names.map(n => n[0]).join("").substring(0, 2).toUpperCase();
                    return {
                        id: i + 1,
                        name: r.name || "Unknown",
                        empId: r.roll_no || r.user_id || `ID-${1000+i}`,
                        initials,
                        role: r.role === "student" ? "Student" : "Faculty",
                        department: r.department || "N/A",
                        deviceName: "Device " + (r.device_id || "1"),
                        deviceId: r.device_id || "DEV",
                        date: r.date,
                        day: new Date(r.date).toLocaleDateString('en-US', {weekday: 'short'}),
                        checkIn: r.time_in ? format12Hour(r.time_in) : "â€”",
                        checkOut: r.time_out ? format12Hour(r.time_out) : "â€”",
                        expected: "09:00 AM",
                        delay: r.late_by_minutes ? `${r.late_by_minutes}m` : "â€”",
                        status: reportType === "late" ? "Late" : reportType === "absent" ? "Absent" : "Present",
                        bg: ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"][i % 5]
                    };
                });
                setData(mapped);
            } else {
                toast.error("No records found for this period");
                setData([]);
            }
        } catch { toast.error("Failed to load report"); }
        finally { setLoading(false); }
    };

    const exportExcel = () => {
        if (!data || data.length === 0) {
            toast.error("No data available to export.");
            return;
        }
        
        // Prepare data for Excel
        const excelData = data.map(row => ({
            "#": row.id,
            "Name": row.name,
            "ID": row.empId,
            "Role": row.role,
            "Department": row.department,
            "Device": row.deviceName,
            "Date": row.date,
            "Day": row.day,
            "Check In": row.checkIn,
            "Check Out": row.checkOut,
            "Expected Time": row.expected,
            "Delay": row.delay,
            "Status": row.status
        }));
        
        // Generate Workbook
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
        
        // Download
        const reportName = reportType.charAt(0).toUpperCase() + reportType.slice(1);
        XLSX.writeFile(workbook, `Attendance_Report_${reportName}_${new Date().toISOString().split('T')[0]}.xlsx`);
        
        toast.success("Excel exported successfully!");
    };

    const inputStyle = { width: "100%", padding: "0.75rem 1rem", border: "1px solid #e2e8f0", borderRadius: "10px", outline: "none", fontSize: "0.95rem", color: "#1e293b", background: "#fff", transition: "all 0.2s" };

    return (
        <div style={{ animation: "fadeIn 0.3s ease-out" }}>
            {/* Header Form Card */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "1.5rem", marginBottom: "1.5rem", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1.5rem" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(99, 102, 241, 0.1)", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </div>
                    <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#1e293b" }}>Generate Attendance Report</h3>
                </div>

                <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: "200px" }}>
                        <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.5rem" }}>Report Type</label>
                        <select value={reportType} onChange={(e) => setReportType(e.target.value)} style={inputStyle}>
                            <option value="late">Late Arrivals</option>
                            <option value="absent">Absent Students</option>
                            <option value="present">Present Students</option>
                        </select>
                    </div>
                    <div style={{ flex: 1, minWidth: "150px" }}>
                        <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.5rem" }}>Role</label>
                        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={inputStyle}>
                            <option value="all">All Roles</option>
                            <option value="student">Student</option>
                            <option value="faculty">Faculty</option>
                        </select>
                    </div>
                    <div style={{ flex: 1, minWidth: "160px" }}>
                        <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.5rem" }}>Start Date</label>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
                    </div>
                    <div style={{ flex: 1, minWidth: "180px" }}>
                        <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.5rem" }}>End Date</label>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
                    </div>
                    <div style={{ display: "flex", gap: "1rem" }}>
                        <button onClick={fetchReport} disabled={loading} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: "10px", padding: "0 1.5rem", height: "46px", display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600, fontSize: "0.95rem", cursor: "pointer", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "#4f46e5"} onMouseOut={e => e.currentTarget.style.background = "#6366f1"}>
                            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                            {loading ? "Generating..." : "Generate Report"}
                        </button>
                        <button onClick={exportExcel} style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: "10px", padding: "0 1.5rem", height: "46px", display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600, fontSize: "0.95rem", cursor: "pointer", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "#059669"} onMouseOut={e => e.currentTarget.style.background = "#10b981"}>
                            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line><line x1="12" y1="11" x2="12" y2="19"></line></svg>
                            Export Excel
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "1.5rem", display: "flex", alignItems: "center", gap: "1rem", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                    <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(99, 102, 241, 0.1)", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </div>
                    <div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#6366f1" }}>{data.length > 0 ? 24 : 0}</div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>Total Records</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>In selected period</div>
                    </div>
                </div>
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "1.5rem", display: "flex", alignItems: "center", gap: "1rem", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                    <div style={{ width: "48px", height: "48px", borderRadius: "50%", border: "2px solid rgba(34, 197, 94, 0.2)", color: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#22c55e" }}>{data.length > 0 ? 18 : 0}</div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>On Time</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>75.0%</div>
                    </div>
                </div>
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "1.5rem", display: "flex", alignItems: "center", gap: "1rem", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                    <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </div>
                    <div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f59e0b" }}>{data.length > 0 ? 6 : 0}</div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>Late Arrivals</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>25.0%</div>
                    </div>
                </div>
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "1.5rem", display: "flex", alignItems: "center", gap: "1rem", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                    <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(56, 189, 248, 0.1)", color: "#38bdf8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    </div>
                    <div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#38bdf8" }}>{data.length > 0 ? 12 : 0}</div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>Unique People</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Marked late</div>
                    </div>
                </div>
            </div>

            {/* Results Table */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "#1e293b" }}>Report Results</h3>
                    <button onClick={() => setData([])} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0.5rem 1rem", fontSize: "0.85rem", fontWeight: 600, color: "#64748b", display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.borderColor = "#cbd5e1"} onMouseOut={e => e.currentTarget.style.borderColor = "#e2e8f0"}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        Clear Filters
                    </button>
                </div>

                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                                {["#", "Person", "Role", "Department", "Device", "Date", "Check In/Out", "Expected Time", "Delay", "Status"].map((h) => (
                                    <th key={h} style={{ padding: "1rem 0.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.length === 0 ? (
                                <tr>
                                    <td colSpan="10" style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
                                            <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                            No records found for this period
                                        </div>
                                    </td>
                                </tr>
                            ) : data.map((r, i) => (
                                <tr key={r.id} style={{ borderBottom: i === data.length - 1 ? "none" : "1px solid #f1f5f9", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "#f8fafc"} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                                    <td style={{ padding: "1rem 0.5rem", fontSize: "0.85rem", color: "#1e293b", fontWeight: 600 }}>{r.id}</td>
                                    <td style={{ padding: "1rem 0.5rem" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: r.bg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: "0.9rem" }}>{r.initials}</div>
                                            <div>
                                                <div style={{ fontWeight: 600, color: "#1e293b", fontSize: "0.9rem" }}>{r.name}</div>
                                                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{r.empId}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: "1rem 0.5rem" }}>
                                        <span style={{ display: "inline-block", padding: "0.25rem 0.75rem", borderRadius: "20px", background: r.role === "Faculty" ? "rgba(168, 85, 247, 0.1)" : "rgba(56, 189, 248, 0.1)", color: r.role === "Faculty" ? "#a855f7" : "#38bdf8", fontSize: "0.75rem", fontWeight: 600 }}>{r.role}</span>
                                    </td>
                                    <td style={{ padding: "1rem 0.5rem", fontSize: "0.85rem", color: "#475569" }}>{r.department}</td>
                                    <td style={{ padding: "1rem 0.5rem" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <svg width="14" height="14" fill="none" stroke="#1e293b" strokeWidth="2" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                                            <div>
                                                <div style={{ fontSize: "0.85rem", color: "#1e293b", fontWeight: 500 }}>{r.deviceName}</div>
                                                <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{r.deviceId}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: "1rem 0.5rem" }}>
                                        <div style={{ fontSize: "0.85rem", color: "#1e293b" }}>{r.date}</div>
                                        <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{r.day}</div>
                                    </td>
                                    <td style={{ padding: "1rem 0.5rem" }}>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                                                <span style={{ color: "#10b981", fontWeight: 700, fontSize: "0.7rem", background: "#d1fae5", padding: "0.15rem 0.4rem", borderRadius: "4px", minWidth: "28px", textAlign: "center" }}>IN</span> 
                                                <span style={{ fontWeight: 500, color: "#334155" }}>{r.checkIn}</span>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                                                <span style={{ color: "#ef4444", fontWeight: 700, fontSize: "0.7rem", background: "#fee2e2", padding: "0.15rem 0.4rem", borderRadius: "4px", minWidth: "28px", textAlign: "center" }}>OUT</span> 
                                                <span style={{ fontWeight: 500, color: "#334155" }}>{r.checkOut}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: "1rem 0.5rem", fontSize: "0.85rem", color: "#64748b" }}>{r.expected}</td>
                                    <td style={{ padding: "1rem 0.5rem", fontSize: "0.85rem", color: "#ef4444", fontWeight: 600 }}>{r.delay}</td>
                                    <td style={{ padding: "1rem 0.5rem" }}>
                                        <span style={{ display: "inline-block", padding: "0.25rem 0.75rem", borderRadius: "6px", background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", fontSize: "0.75rem", fontWeight: 600 }}>{r.status}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {data.length > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.5rem", borderTop: "1px solid #e2e8f0", paddingTop: "1.5rem" }}>
                        <div style={{ fontSize: "0.85rem", color: "#64748b" }}>Showing 1 to {data.length} of {data.length > 0 ? 24 : 0} records</div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e8f0", background: "#fff", borderRadius: "8px", cursor: "pointer" }}><svg width="14" height="14" fill="none" stroke="#64748b" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
                            <button style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "#6366f1", color: "#fff", borderRadius: "8px", fontWeight: 600, fontSize: "0.85rem" }}>1</button>
                            <button style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e8f0", background: "#fff", borderRadius: "8px", fontWeight: 600, fontSize: "0.85rem", color: "#475569", cursor: "pointer" }}>2</button>
                            <button style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e8f0", background: "#fff", borderRadius: "8px", fontWeight: 600, fontSize: "0.85rem", color: "#475569", cursor: "pointer" }}>3</button>
                            <div style={{ display: "flex", alignItems: "center", color: "#94a3b8", padding: "0 4px" }}>...</div>
                            <button style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e8f0", background: "#fff", borderRadius: "8px", fontWeight: 600, fontSize: "0.85rem", color: "#475569", cursor: "pointer" }}>5</button>
                            <button style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e8f0", background: "#fff", borderRadius: "8px", cursor: "pointer" }}><svg width="14" height="14" fill="none" stroke="#64748b" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg></button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SETTINGS TAB  (Phase 5)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SettingsTab() {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get("/biometric/settings").then((res) => {
            if (res.data.success) setSettings(res.data.data);
        }).catch(() => { }).finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put("/biometric/settings", settings);
            toast.success("Settings saved successfully");
        } catch { toast.error("Failed to save settings"); }
        finally { setSaving(false); }
    };

    const update = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

    if (loading) return <LoadingCard />;
    if (!settings) return <Empty msg="No settings found" />;

    const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const workingDays = settings.working_days || ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const toggleDay = (day) => {
        const updated = workingDays.includes(day)
            ? workingDays.filter((d) => d !== day)
            : [...workingDays, day];
        update("working_days", updated);
    };

    const inputBaseStyle = { width: "100%", padding: "0.75rem 1rem", border: "1px solid #e2e8f0", borderRadius: "8px", outline: "none", fontSize: "0.95rem", color: "#1e293b", background: "#fff", transition: "all 0.2s" };
    const labelBaseStyle = { display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#1e293b", marginBottom: "0.5rem" };
    const subtextStyle = { display: "block", fontSize: "0.75rem", color: "#64748b", marginTop: "0.4rem" };

    return (
        <div style={{ animation: "fadeIn 0.3s ease-out" }}>
            {/* Header Section */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
                <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                    <div style={{ color: "#64748b" }}>
                        <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1e293b" }}>Biometric Attendance Settings</h2>
                        <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.25rem" }}>Configure attendance rules and notifications</div>
                    </div>
                </div>
                <button onClick={handleSave} disabled={saving} style={{ background: "#8b5cf6", color: "#fff", border: "none", borderRadius: "10px", padding: "0.6rem 1.25rem", display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600, fontSize: "0.95rem", cursor: "pointer", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "#7c3aed"} onMouseOut={e => e.currentTarget.style.background = "#8b5cf6"}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    {saving ? "Saving..." : "Save Settings"}
                </button>
            </div>

            {/* Main Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)", gap: "1.5rem", marginBottom: "1.5rem", alignItems: "start" }}>
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
                        
                        {/* Attendance Mode Pill Toggle */}
                        <div style={{ marginBottom: "1.5rem" }}>
                            <label style={{ ...labelBaseStyle, marginBottom: "1rem" }}>Primary Tracking Mode</label>
                            <div style={{ display: "inline-flex", background: "#f1f5f9", borderRadius: "12px", padding: "4px", gap: "2px", width: "100%" }}>
                                {[
                                    { value: "class_based", icon: "ðŸ«", label: "Class Based", sub: "Main Gate" },
                                    { value: "subject_based", icon: "ðŸ“š", label: "Subject Based", sub: "Classrooms" }
                                ].map(opt => {
                                    const isActive = (settings.attendance_mode === opt.value) || (!settings.attendance_mode && opt.value === "class_based");
                                    return (
                                        <button key={opt.value} onClick={() => update("attendance_mode", opt.value)} style={{
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
                            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", marginTop: "0.75rem", padding: "0.6rem 0.75rem", background: (settings.attendance_mode === "subject_based") ? "#f5f3ff" : "#f0fdf4", borderRadius: "8px", border: "1px solid " + ((settings.attendance_mode === "subject_based") ? "#e9d5ff" : "#bbf7d0") }}>
                                <span style={{ fontSize: "0.9rem" }}>{(settings.attendance_mode === "subject_based") ? "â„¹ï¸" : "âœ…"}</span>
                                <span style={{ fontSize: "0.8rem", color: "#475569", lineHeight: 1.4 }}>
                                    {settings.attendance_mode === "subject_based"
                                        ? "Students punch at specific classrooms. Each device must be assigned to a room with a timetable."
                                        : "Students punch at the main gate only. All subjects are auto-marked present based on timetable when they punch out."}
                                </span>
                            </div>
                        </div>

                        {settings.attendance_mode === "subject_based" && (
                            <div style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: "12px", padding: "1.25rem" }}>
                                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem" }}>
                                    <span style={{ fontSize: "1rem" }}>âš¡</span>
                                    <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#7c3aed" }}>Subject Punch Behavior</span>
                                </div>
                                {/* Subject Mode Pill Toggle */}
                                <div style={{ display: "inline-flex", background: "#ede9fe", borderRadius: "10px", padding: "4px", gap: "2px", width: "100%", marginBottom: "0.75rem" }}>
                                    {[
                                        { value: "automatic", icon: "ðŸ¤–", label: "Automatic", sub: "Carry-forward" },
                                        { value: "manual", icon: "ðŸ‘†", label: "Manual", sub: "Punch per subject" }
                                    ].map(opt => {
                                        const isActive = (settings.subject_mode === opt.value) || (!settings.subject_mode && opt.value === "automatic");
                                        return (
                                            <button key={opt.value} onClick={() => update("subject_mode", opt.value)} style={{
                                                flex: 1, padding: "0.6rem 0.75rem", borderRadius: "8px", border: "none",
                                                background: isActive ? "#7c3aed" : "transparent",
                                                cursor: "pointer", transition: "all 0.25s ease",
                                                display: "flex", flexDirection: "column", alignItems: "center", gap: "2px"
                                            }}>
                                                <span style={{ fontSize: "1.1rem" }}>{opt.icon}</span>
                                                <span style={{ fontSize: "0.8rem", fontWeight: isActive ? 700 : 500, color: isActive ? "#fff" : "#7c3aed", whiteSpace: "nowrap" }}>{opt.label}</span>
                                                <span style={{ fontSize: "0.65rem", color: isActive ? "#e9d5ff" : "#a78bfa" }}>{opt.sub}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div style={{ fontSize: "0.8rem", color: "#5b21b6", lineHeight: 1.4, padding: "0.5rem 0.25rem" }}>
                                    {(settings.subject_mode === "manual")
                                        ? "ðŸ‘† Students must physically scan their finger for every subject period."
                                        : "ðŸ¤– Once present in a room, attendance automatically carries forward to next consecutive subject periods in the same room."}
                                </div>

                                {/* Strict Subject Enrollment Toggle */}
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px dashed #e9d5ff" }}>
                                    <div>
                                        <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#1e293b", marginBottom: "0.25rem" }}>Strict Subject Enrollment</div>
                                        <div style={{ fontSize: "0.8rem", color: "#64748b", maxWidth: "250px", lineHeight: 1.4 }}>Only allow punches for subjects the student is explicitly enrolled in.</div>
                                    </div>
                                    <button
                                        onClick={() => update("enforce_subject_enrollment", !(settings.enforce_subject_enrollment !== false))}
                                        style={{
                                            width: "44px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer",
                                            background: (settings.enforce_subject_enrollment !== false) ? "#8b5cf6" : "#cbd5e1",
                                            position: "relative", transition: "all 0.2s"
                                        }}
                                    >
                                        <div style={{
                                            width: "20px", height: "20px", borderRadius: "50%", background: "#fff", position: "absolute", top: "2px",
                                            left: (settings.enforce_subject_enrollment !== false) ? "22px" : "2px", transition: "all 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
                                        }} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* General Settings Card */}
                    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "1.75rem", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "1.75rem" }}>
                        <div style={{ color: "#8b5cf6" }}>
                            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        </div>
                        <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#1e293b" }}>General Settings</h3>
                    </div>

                    <div style={{ marginBottom: "1.5rem" }}>
                        <label style={labelBaseStyle}>Class Start Time</label>
                        <div style={{ position: "relative" }}>
                            <input type="time" value={settings.class_start_time || "09:00"} onChange={(e) => update("class_start_time", e.target.value)} style={{ ...inputBaseStyle, paddingRight: "2.5rem" }} />
                            <div style={{ position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }}>
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: "1.5rem" }}>
                        <label style={labelBaseStyle}>Late Threshold (minutes after class start)</label>
                        <input type="number" min="0" max="60" value={settings.late_threshold_minutes || 15} onChange={(e) => update("late_threshold_minutes", parseInt(e.target.value))} style={inputBaseStyle} />
                        <span style={subtextStyle}>Students will be marked late after this time.</span>
                    </div>

                    <div style={{ marginBottom: "1.5rem" }}>
                        <label style={labelBaseStyle}>Half Day Threshold (minutes after class start)</label>
                        <input type="number" min="30" max="300" value={settings.half_day_threshold_minutes || 120} onChange={(e) => update("half_day_threshold_minutes", parseInt(e.target.value))} style={inputBaseStyle} />
                        <span style={subtextStyle}>Students will be marked half-day after this time.</span>
                    </div>

                    <div>
                        <label style={labelBaseStyle}>Duplicate Punch Window (seconds)</label>
                        <input type="number" min="60" max="1800" value={settings.duplicate_punch_window_secs || 300} onChange={(e) => update("duplicate_punch_window_secs", parseInt(e.target.value))} style={inputBaseStyle} />
                        <span style={subtextStyle}>Punched within this time will be considered as duplicate.</span>
                    </div>
                    </div>
                </div>

            {/* Right Column */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    
                    {/* Working Days Card */}
                    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "1.75rem", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "1.5rem" }}>
                            <div style={{ color: "#8b5cf6" }}>
                                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            </div>
                            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#1e293b" }}>Working Days</h3>
                        </div>

                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                            {DAYS.map((day) => {
                                const isActive = workingDays.includes(day);
                                return (
                                    <button
                                        key={day}
                                        onClick={() => toggleDay(day)}
                                        style={{
                                            padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid",
                                            borderColor: isActive ? "#8b5cf6" : "#e2e8f0",
                                            background: isActive ? "rgba(139, 92, 246, 0.05)" : "#fff",
                                            color: isActive ? "#8b5cf6" : "#64748b",
                                            cursor: "pointer", fontWeight: 600, fontSize: "0.85rem",
                                            flex: "1 1 auto", textAlign: "center", transition: "all 0.2s"
                                        }}
                                    >
                                        {day}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

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
                                <span style={{ fontSize: "1rem" }}>ðŸšª</span>
                                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>Main Gate</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                {[
                                    { key: "notify_main_gate_in", label: "Notify when student punches IN at Main Gate", emoji: "âœ…" },
                                    { key: "notify_main_gate_out", label: "Notify when student punches OUT at Main Gate", emoji: "ðŸšª" },
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
                        {settings.attendance_mode === "subject_based" && (
                            <div style={{ marginBottom: "1.5rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", paddingBottom: "0.5rem", borderBottom: "1px dashed #e2e8f0" }}>
                                    <span style={{ fontSize: "1rem" }}>ðŸ“š</span>
                                    <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>Subject / Classroom</span>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                    {[
                                        { key: "notify_subject_in", label: "Notify when student punches IN for a Subject", emoji: "ðŸ“š" },
                                        { key: "notify_subject_out", label: "Notify when student punches OUT for a Subject", emoji: "ðŸ“¤" },
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

                        {/* Status-based Notifications Group */}
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", paddingBottom: "0.5rem", borderBottom: "1px dashed #e2e8f0" }}>
                                <span style={{ fontSize: "1rem" }}>âš¡</span>
                                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status Alerts</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                {[
                                    { key: "notify_parent_on_late", label: "Notify when student arrives late", emoji: "âš ï¸" },
                                    { key: "notify_parent_on_absent", label: "Notify when student is absent", emoji: "âŒ" },
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

            {/* Footer Alert */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "1.5rem", display: "flex", gap: "1rem", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#8b5cf6", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 700, fontSize: "0.9rem" }}>
                    i
                </div>
                <div>
                    <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.95rem", marginBottom: "0.25rem" }}>About Settings</div>
                    <div style={{ color: "#64748b", fontSize: "0.85rem", lineHeight: 1.5 }}>These settings will be applied to all biometric devices and students. Changes may take a few minutes to reflect across the system.</div>
                </div>
            </div>

        </div>
    );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SHARED UI HELPERS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StatBox({ icon, label, value, color }) {
    return (
        <div className="card" style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ fontSize: "2rem", width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center", background: color + "1a", borderRadius: "12px" }}>
                {icon}
            </div>
            <div>
                <div style={{ fontWeight: 800, fontSize: "1.4rem", color }}>{value}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{label}</div>
            </div>
        </div>
    );
}

function StatusBadge({ status }) {
    const cfg = {
        present: { bg: "rgba(16,185,129,0.15)", color: "#10b981", label: "Present" },
        absent: { bg: "rgba(239,68,68,0.15)", color: "#ef4444", label: "Absent" },
        late: { bg: "rgba(245,158,11,0.15)", color: "#f59e0b", label: "Late" },
        half_day: { bg: "rgba(99,102,241,0.15)", color: "#6366f1", label: "Half Day" },
    };
    const c = cfg[status] || { bg: "rgba(107,114,128,0.15)", color: "#6b7280", label: status };
    return (
        <span style={{ padding: "2px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: 700, background: c.bg, color: c.color }}>
            {c.label}
        </span>
    );
}

function InfoCard({ icon, title, desc }) {
    return (
        <div className="card" style={{ padding: "1.25rem" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{icon}</div>
            <h4 style={{ margin: "0 0 0.5rem", fontWeight: 700 }}>{title}</h4>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.88rem", lineHeight: 1.5 }}>{desc}</p>
        </div>
    );
}

function Modal({ title, children, onClose }) {
    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
            <div style={{ background: "var(--card-bg, #fff)", borderRadius: "16px", padding: "2rem", width: "100%", maxWidth: "480px", maxHeight: "90vh", overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                    <h3 style={{ margin: 0, fontWeight: 700 }}>{title}</h3>
                    <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.5rem", color: "var(--text-secondary)" }}>âœ•</button>
                </div>
                {children}
            </div>
        </div>
    );
}

function FormField({ label, value, onChange, placeholder, disabled, type = "text" }) {
    return (
        <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem", display: "block" }}>{label}</label>
            <input
                type={type} value={value} onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder} disabled={disabled}
                style={{ ...inputStyle, opacity: disabled ? 0.6 : 1 }}
            />
        </div>
    );
}

function LoadingCard() {
    return (
        <div className="card" style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>â³</div>
            <div>Loading...</div>
        </div>
    );
}

function Empty({ msg }) {
    return (
        <div className="card" style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>ðŸ”</div>
            <div>{msg}</div>
        </div>
    );
}

// Styles
const inputStyle = { width: "100%", padding: "0.6rem 0.85rem", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--input-bg, #fff)", color: "var(--text-primary)", fontSize: "0.9rem", boxSizing: "border-box" };
const labelStyle = { fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem", display: "block" };
const btnStyle = (bg) => ({ padding: "0.6rem 1.25rem", borderRadius: "8px", border: "none", background: bg, color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.88rem", whiteSpace: "nowrap" });
const btnSmall = (bg) => ({ ...btnStyle(bg), padding: "0.35rem 0.8rem", fontSize: "0.8rem" });
