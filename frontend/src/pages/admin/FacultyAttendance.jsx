import { useState, useEffect, useContext, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import { Html5Qrcode } from "html5-qrcode";
import "./Dashboard.css";
import { useScanSound } from "../../hooks/useScanSound";

function FacultyAttendance() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const { unlockAudio, playSuccess, playWarning, playError } = useScanSound();

    // High-performance State
    const [roster, setRoster] = useState([]); 
    const [summary, setSummary] = useState({ total: 0, present: 0, absent: 0, late: 0, holiday: 0 });
    const [recentScans, setRecentScans] = useState([]);

    // UI Wizard State
    const [step, setStep] = useState(1); // 1: Ready, 2: Scanning, 3: Result
    
    // Scanner State
    const [cameraError, setCameraError] = useState(null);
    const [scannedFaculty, setScannedFaculty] = useState(null);
    const [message, setMessage] = useState(null); // { type, text }

    const isProcessed = useRef(false);
    const qrCodeRef = useRef(null);
    const isScannerRunning = useRef(false);

    // Initial Data Load (Exactly ONE API Call)
    useEffect(() => {
        const fetchTodayRoster = async () => {
            try {
                // YYYY-MM-DD in local time
                const d = new Date();
                const todayStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                
                const response = await api.get(`/faculty-attendance/date/${todayStr}`);
                if (response.data.success) {
                    const faculties = response.data.data;
                    setRoster(faculties);
                    computeStats(faculties);
                }
            } catch (err) {
                console.error("Failed to load roster", err);
            }
        };
        fetchTodayRoster();

        return () => {
            stopScanner();
        };
    }, []);

    // Compute Summary & Recent Scans locally without API calls
    const computeStats = (facultyList) => {
        let pres = 0, abs = 0, lat = 0, hol = 0;
        const recent = [];

        facultyList.forEach(f => {
            if (f.attendance) {
                if (f.attendance.status === "present") pres++;
                if (f.attendance.status === "absent") abs++;
                if (f.attendance.status === "late") lat++;
                if (f.attendance.status === "holiday") hol++;
                
                // Add to recent if they have a marked_at timestamp
                if (f.attendance.marked_at) {
                    recent.push({
                        ...f,
                        time: new Date(f.attendance.marked_at).getTime()
                    });
                }
            }
        });

        setSummary({ total: pres + abs + lat + hol, present: pres, absent: abs, late: lat, holiday: hol });
        
        // Sort recent scans descending (newest first)
        recent.sort((a, b) => b.time - a.time);
        setRecentScans(recent);
    };

    // Fast local state update after successful scan
    const updateLocalRoster = (faculty_id, newAttendanceObj) => {
        setRoster(prevRoster => {
            const updated = prevRoster.map(f => {
                if (f.faculty_id === faculty_id) {
                    return { ...f, attendance: newAttendanceObj };
                }
                return f;
            });
            computeStats(updated);
            
            // Set for the Result Card
            const markedUser = updated.find(f => f.faculty_id === faculty_id);
            setScannedFaculty(markedUser);
            return updated;
        });
    };

    // Start Scanning (Transition to Step 2)
    const openScanner = async () => {
        unlockAudio();
        setStep(2);
        setMessage(null);
        setCameraError(null);
        isProcessed.current = false;

        setTimeout(() => {
            startScanner();
        }, 300);
    };

    const startScanner = async () => {
        try {
            if (qrCodeRef.current && isScannerRunning.current) {
                await stopScanner();
            }

            const html5QrCode = new Html5Qrcode("faculty-qr-reader");
            qrCodeRef.current = html5QrCode;

            const cameras = await Html5Qrcode.getCameras();
            if (!cameras || cameras.length === 0) {
                setCameraError("No camera found on this device.");
                return;
            }

            const cameraId = cameras.find(c => c.label.toLowerCase().includes("back"))?.id || cameras[0].id;

            await html5QrCode.start(
                cameraId,
                { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
                (decodedText) => {
                    if (isProcessed.current) return;
                    isProcessed.current = true;
                    stopScanner();
                    processScan(decodedText);
                },
                () => {}
            );
            isScannerRunning.current = true;
        } catch (err) {
            console.error("Camera Error:", err);
            setCameraError("Could not access camera. Please allow camera permissions and try again.");
        }
    };

    const stopScanner = async () => {
        try {
            if (qrCodeRef.current && isScannerRunning.current) {
                await qrCodeRef.current.stop();
                isScannerRunning.current = false;
            }
        } catch (e) {} finally {
            try { if (qrCodeRef.current) qrCodeRef.current.clear(); } catch (e) {}
            qrCodeRef.current = null;
            isScannerRunning.current = false;
        }
    };

    const processScan = async (decodedQR) => {
        setStep(3); // Move to result immediately
        setScannedFaculty(null); // Clear previous
        setMessage({ type: "loading", text: "Verifying Attendance..." });

        try {
            const response = await api.post("/faculty-attendance/mark-by-qr", {
                qr_code: decodedQR
            });

            if (response.data.success) {
                setMessage({ type: "success", text: "Scan Successful!" });
                playSuccess();
                
                // Construct fake local attendance object from response to avoid network call
                const newAtt = {
                    status: response.data.data.status,
                    remarks: response.data.data.remarks,
                    marked_at: response.data.data.createdAt || new Date().toISOString()
                };
                
                updateLocalRoster(response.data.data.faculty_id, newAtt);
            }
        } catch (error) {
            const errorMsg = error.response?.data?.message || "Failed to mark attendance";
            let type = "error";
            if (error.response?.status === 400 && errorMsg.includes("already marked")) {
                type = "warning";
                playWarning();
                
                // If it's already marked, we still want to show their profile. 
                // Let's try to parse the faculty ID from the QR code (FACULTY_QR_123)
                if (decodedQR.startsWith("FACULTY_QR_")) {
                    const f_id = parseInt(decodedQR.split("FACULTY_QR_")[1], 10);
                    const found = roster.find(f => f.faculty_id === f_id);
                    if (found) setScannedFaculty(found);
                }
            } else {
                playError();
            }
            setMessage({ type, text: errorMsg });
        }
    };

    // Change status from Step 3 dropdown (Optional Override)
    const handleStatusChange = async (newStatus) => {
        if (!scannedFaculty) return;
        
        try {
            // Because they're already marked, we need to call the manual endpoint (or grid endpoint)
            const response = await api.post("/faculty-attendance/manual", {
                faculty_id: scannedFaculty.faculty_id,
                date: new Date().toISOString().split('T')[0],
                status: newStatus,
                remarks: "Updated via Admin Result Card"
            });
            
            if (response.data.success) {
                // Update local state smoothly
                updateLocalRoster(scannedFaculty.faculty_id, {
                    ...scannedFaculty.attendance,
                    status: newStatus
                });
            }
        } catch (err) {
            console.error("Failed to update status", err);
        }
    };

    // Reset back to camera
    const handleScanAnother = () => {
        openScanner();
    };

    // Reset back to Ready
    const handleFinish = () => {
        setStep(1);
        setScannedFaculty(null);
        setMessage(null);
    };

    // Formatter functions
    const getInitials = (name) => {
        if (!name) return "F";
        const parts = name.split(" ");
        if (parts.length > 1) return parts[0][0] + parts[1][0];
        return parts[0][0];
    };

    const formatTime = (isoString) => {
        if (!isoString) return "-";
        return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    
    const formatDate = (isoString) => {
        if (!isoString) return "-";
        return new Date(isoString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    return (
        <div className="students-container">
            <div className="st-header" style={{ marginBottom: "2rem" }}>
                <div className="st-header-top-row">
                    <div className="st-header-left">
                        <h1>Scan Faculty QR</h1>
                        <p>Scan a faculty member's QR code to mark their daily attendance.</p>
                    </div>
                </div>
                <div className="st-header-bottom-row">
                    <div className="st-breadcrumbs">
                        <span>Dashboard</span>
                        <span>›</span>
                        <span className="active">Scan Faculty QR</span>
                    </div>
                    <div className="st-header-actions">
                        <Link to="/admin/view-faculty-attendance" className="st-btn" style={{ backgroundColor: "#eef2ff", color: "#4f46e5", border: "none", fontWeight: "600" }}>
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            View Tracker
                        </Link>
                    </div>
                </div>
            </div>

            {/* ── Wizard Steps Indicator ── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "2rem", flexWrap: "wrap" }}>
                {/* Step 1 */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", opacity: step >= 1 ? 1 : 0.5 }}>
                    <div style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: step === 1 ? "#6366f1" : (step > 1 ? "#10b981" : "#e2e8f0"), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", fontWeight: "bold" }}>
                        {step > 1 ? "✓" : "1"}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "0.85rem", fontWeight: "600", color: step === 1 ? "#6366f1" : (step > 1 ? "#10b981" : "#0f172a") }}>Open Scanner</span>
                        <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Start the camera</span>
                    </div>
                </div>
                
                <div style={{ height: "1px", width: "40px", backgroundColor: "#cbd5e1" }}></div>

                {/* Step 2 */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", opacity: step >= 2 ? 1 : 0.5 }}>
                    <div style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: step === 2 ? "#6366f1" : (step > 2 ? "#10b981" : "#e2e8f0"), color: step >= 2 ? "#fff" : "#64748b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", fontWeight: "bold" }}>
                        {step > 2 ? "✓" : "2"}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "0.85rem", fontWeight: "600", color: step === 2 ? "#6366f1" : (step > 2 ? "#10b981" : "#0f172a") }}>Scan QR Code</span>
                        <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Align within frame</span>
                    </div>
                </div>

                <div style={{ height: "1px", width: "40px", backgroundColor: "#cbd5e1" }}></div>

                {/* Step 3 */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", opacity: step === 3 ? 1 : 0.5 }}>
                    <div style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: step === 3 ? "#6366f1" : "#e2e8f0", color: step === 3 ? "#fff" : "#64748b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", fontWeight: "bold" }}>
                        3
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "0.85rem", fontWeight: "600", color: step === 3 ? "#6366f1" : "#0f172a" }}>Mark Attendance</span>
                        <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Confirm and save</span>
                    </div>
                </div>
            </div>

            {/* ── Main Content Area ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem", alignItems: "start" }}>
                
                {/* ── LEFT COLUMN ── */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    
                    {/* Getting Ready / Scanning Tips Card */}
                    {(step === 1 || step === 2) && (
                        <div style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "16px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)", border: "1px solid #f1f5f9" }}>
                            <h3 style={{ margin: "0 0 1.2rem 0", fontSize: "1.1rem", color: "#0f172a" }}>
                                {step === 1 ? "Getting Ready" : "Scanning..."}
                            </h3>
                            {step === 1 ? (
                                <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "1.5rem" }}>Ensure everything is ready before scanning.</p>
                            ) : (
                                <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "1.5rem" }}>Position the QR code within the frame to scan.</p>
                            )}

                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "12px", color: step === 2 ? "#10b981" : "#6366f1", backgroundColor: step === 2 ? "#f0fdf4" : "#eef2ff", padding: "0.8rem", borderRadius: "8px" }}>
                                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                    <span style={{ fontSize: "0.9rem", color: "#334155" }}>Ensure good lighting</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "12px", color: step === 2 ? "#10b981" : "#6366f1", backgroundColor: step === 2 ? "#f0fdf4" : "#eef2ff", padding: "0.8rem", borderRadius: "8px" }}>
                                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" /></svg>
                                    <span style={{ fontSize: "0.9rem", color: "#334155" }}>Hold camera steady</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "12px", color: step === 2 ? "#10b981" : "#6366f1", backgroundColor: step === 2 ? "#f0fdf4" : "#eef2ff", padding: "0.8rem", borderRadius: "8px" }}>
                                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                                    <span style={{ fontSize: "0.9rem", color: "#334155" }}>Keep QR within frame</span>
                                </div>
                                {step === 2 && (
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#6366f1", padding: "0.5rem" }}>
                                        <div className="spinner" style={{ width: "16px", height: "16px", border: "2px solid #c7d2fe", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
                                        <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "#6366f1" }}>Scanning...</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Scan Result Card (Step 3 Only) */}
                    {step === 3 && (
                        <div style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "16px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)", border: `2px solid ${message?.type === 'success' ? '#10b981' : (message?.type === 'warning' ? '#f59e0b' : '#ef4444')}`, textAlign: "center" }}>
                            
                            <div style={{ width: "64px", height: "64px", borderRadius: "50%", backgroundColor: message?.type === 'success' ? '#10b981' : (message?.type === 'warning' ? '#f59e0b' : '#ef4444'), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem auto" }}>
                                {message?.type === 'success' ? (
                                    <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                ) : (
                                    <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                )}
                            </div>
                            
                            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.2rem", color: "#0f172a" }}>{message?.text || "Scan Completed"}</h3>
                            <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "1.5rem" }}>
                                {message?.type === 'success' ? "Faculty attendance recorded successfully." : "Please verify the details below."}
                            </p>

                            {/* Scanned Faculty Profile */}
                            {scannedFaculty ? (
                                <div style={{ backgroundColor: "#f8fafc", padding: "1.2rem", borderRadius: "12px", border: "1px solid #e2e8f0", textAlign: "left", display: "flex", alignItems: "center", gap: "15px", marginBottom: "1.5rem" }}>
                                    <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: "#e0e7ff", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", fontWeight: "bold" }}>
                                        {getInitials(scannedFaculty.name)}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ margin: "0 0 2px 0", color: "#0f172a", fontSize: "1rem" }}>{scannedFaculty.name}</h4>
                                        <p style={{ margin: "0 0 2px 0", color: "#475569", fontSize: "0.8rem" }}>{scannedFaculty.designation} • {scannedFaculty.department}</p>
                                        <span style={{ fontSize: "0.75rem", padding: "2px 8px", backgroundColor: "#e2e8f0", color: "#475569", borderRadius: "4px", fontWeight: "600", display: "inline-block", marginTop: "4px" }}>
                                            ID: FAC-{scannedFaculty.faculty_id}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ backgroundColor: "#f8fafc", padding: "1rem", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "1.5rem", color: "#64748b", fontSize: "0.9rem" }}>
                                    Loading profile data...
                                </div>
                            )}

                            {/* Marked As Controls */}
                            {scannedFaculty && scannedFaculty.attendance && (
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "1rem", borderTop: "1px solid #e2e8f0" }}>
                                    <div style={{ textAlign: "left" }}>
                                        <label style={{ display: "block", fontSize: "0.75rem", color: "#64748b", marginBottom: "4px" }}>Marked As</label>
                                        <select 
                                            value={scannedFaculty.attendance.status}
                                            onChange={(e) => handleStatusChange(e.target.value)}
                                            style={{
                                                padding: "4px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem", fontWeight: "600",
                                                color: scannedFaculty.attendance.status === 'present' ? '#10b981' : (scannedFaculty.attendance.status === 'absent' ? '#ef4444' : '#f59e0b'),
                                                backgroundColor: scannedFaculty.attendance.status === 'present' ? '#d1fae5' : (scannedFaculty.attendance.status === 'absent' ? '#fee2e2' : '#fef3c7'),
                                            }}
                                        >
                                            <option value="present">Present ✓</option>
                                            <option value="absent">Absent ✗</option>
                                            <option value="late">Late ⏱</option>
                                        </select>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "2px" }}>Time & Date</div>
                                        <div style={{ fontSize: "0.9rem", color: "#0f172a", fontWeight: "600" }}>{formatTime(scannedFaculty.attendance.marked_at)}</div>
                                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{formatDate(scannedFaculty.attendance.marked_at)}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Today's Summary Card (Shown across all steps) */}
                    <div style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "16px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)", border: "1px solid #f1f5f9" }}>
                        <h3 style={{ margin: "0 0 1.2rem 0", fontSize: "1.1rem", color: "#0f172a" }}>Today's Summary</h3>
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.8rem", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#6366f1" }}>
                                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                    <span style={{ fontSize: "0.9rem", color: "#334155", fontWeight: "500" }}>Total Scanned</span>
                                </div>
                                <span style={{ fontWeight: "700", color: "#6366f1", backgroundColor: "#eef2ff", padding: "2px 8px", borderRadius: "12px", fontSize: "0.9rem" }}>{summary.total}</span>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.8rem", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#10b981" }}>
                                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <span style={{ fontSize: "0.9rem", color: "#334155", fontWeight: "500" }}>Present</span>
                                </div>
                                <span style={{ fontWeight: "700", color: "#10b981", backgroundColor: "#d1fae5", padding: "2px 8px", borderRadius: "12px", fontSize: "0.9rem" }}>{summary.present}</span>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.8rem", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#ef4444" }}>
                                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <span style={{ fontSize: "0.9rem", color: "#334155", fontWeight: "500" }}>Absent</span>
                                </div>
                                <span style={{ fontWeight: "700", color: "#ef4444", backgroundColor: "#fee2e2", padding: "2px 8px", borderRadius: "12px", fontSize: "0.9rem" }}>{summary.absent}</span>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.8rem", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#f59e0b" }}>
                                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <span style={{ fontSize: "0.9rem", color: "#334155", fontWeight: "500" }}>Late</span>
                                </div>
                                <span style={{ fontWeight: "700", color: "#f59e0b", backgroundColor: "#fef3c7", padding: "2px 8px", borderRadius: "12px", fontSize: "0.9rem" }}>{summary.late}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── RIGHT COLUMN ── */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    
                    {/* Step 1: Open Camera Action */}
                    {step === 1 && (
                        <div style={{ backgroundColor: "#fff", padding: "4rem 2rem", borderRadius: "16px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)", border: "1px solid #f1f5f9", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "450px" }}>
                            <div style={{ width: "90px", height: "90px", borderRadius: "50%", backgroundColor: "#eef2ff", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem auto" }}>
                                <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </div>
                            <h2 style={{ margin: "0 0 0.5rem 0", fontSize: "1.5rem", color: "#0f172a" }}>Open Camera Scanner</h2>
                            <p style={{ fontSize: "0.95rem", color: "#64748b", marginBottom: "2rem", maxWidth: "300px" }}>
                                Click the button below to open the camera and start scanning the faculty QR code.
                            </p>
                            <button 
                                onClick={openScanner}
                                className="btn btn-primary" 
                                style={{ backgroundColor: "#6366f1", padding: "1rem 3rem", fontSize: "1.1rem", borderRadius: "12px", display: "flex", alignItems: "center", gap: "10px", boxShadow: "0 4px 14px rgba(99, 102, 241, 0.3)", transition: "all 0.2s" }}
                            >
                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                Open Camera
                            </button>
                        </div>
                    )}

                    {/* Step 2: Live Scanner View */}
                    {step === 2 && (
                        <div style={{ backgroundColor: "#1e293b", padding: "2rem", borderRadius: "16px", boxShadow: "0 10px 25px rgba(0,0,0,0.1)", textAlign: "center", minHeight: "450px", display: "flex", flexDirection: "column", position: "relative" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#10b981" }}>
                                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#10b981", animation: "pulse 1.5s infinite" }}></div>
                                    <span style={{ fontSize: "0.85rem", fontWeight: "600" }}>Live Feed Active</span>
                                </div>
                                <button onClick={() => setStep(1)} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", fontSize: "0.85rem" }}>
                                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    Cancel
                                </button>
                            </div>
                            
                            {cameraError ? (
                                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", backgroundColor: "#451a1a", borderRadius: "12px", padding: "2rem", fontSize: "0.95rem" }}>
                                    {cameraError}
                                </div>
                            ) : (
                                <div style={{ flex: 1, backgroundColor: "#000", borderRadius: "12px", overflow: "hidden", position: "relative", border: "2px solid #334155" }}>
                                    <div id="faculty-qr-reader" style={{ width: "100%", height: "100%", minHeight: "350px" }}></div>
                                    
                                    {/* Scanner Overlay Graphics */}
                                    <div style={{ position: "absolute", top: "0", left: "0", right: "0", bottom: "0", pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <div style={{ width: "60%", aspectRatio: "1/1", border: "2px dashed rgba(255,255,255,0.4)", borderRadius: "16px", position: "relative" }}>
                                            <div style={{ position: "absolute", top: "-2px", left: "-2px", width: "30px", height: "30px", borderTop: "4px solid #6366f1", borderLeft: "4px solid #6366f1", borderTopLeftRadius: "16px" }}></div>
                                            <div style={{ position: "absolute", top: "-2px", right: "-2px", width: "30px", height: "30px", borderTop: "4px solid #6366f1", borderRight: "4px solid #6366f1", borderTopRightRadius: "16px" }}></div>
                                            <div style={{ position: "absolute", bottom: "-2px", left: "-2px", width: "30px", height: "30px", borderBottom: "4px solid #6366f1", borderLeft: "4px solid #6366f1", borderBottomLeftRadius: "16px" }}></div>
                                            <div style={{ position: "absolute", bottom: "-2px", right: "-2px", width: "30px", height: "30px", borderBottom: "4px solid #6366f1", borderRight: "4px solid #6366f1", borderBottomRightRadius: "16px" }}></div>
                                            
                                            {/* Scanning laser animation */}
                                            <div className="laser-line" style={{ position: "absolute", top: "10%", left: "5%", right: "5%", height: "2px", backgroundColor: "#10b981", boxShadow: "0 0 10px #10b981", borderRadius: "50%" }}></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Recent Scans & Actions */}
                    {step === 3 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                            
                            {/* Action Buttons */}
                            <div style={{ display: "flex", gap: "1rem" }}>
                                <button 
                                    onClick={handleScanAnother}
                                    className="btn btn-outline" 
                                    style={{ flex: 1, backgroundColor: "#fff", color: "#6366f1", border: "1px solid #6366f1", padding: "1rem", fontSize: "1.05rem", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}
                                >
                                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
                                    Scan Another
                                </button>
                                <button 
                                    onClick={handleFinish}
                                    className="btn btn-primary" 
                                    style={{ flex: 1, backgroundColor: "#6366f1", padding: "1rem", fontSize: "1.05rem", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", boxShadow: "0 4px 14px rgba(99, 102, 241, 0.3)" }}
                                >
                                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    Finish & Submit
                                </button>
                            </div>

                            {/* Recent Scans List */}
                            <div style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "16px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)", border: "1px solid #f1f5f9", flex: 1 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
                                    <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#0f172a" }}>Recent Scans</h3>
                                    <Link to="/admin/view-faculty-attendance" style={{ fontSize: "0.85rem", color: "#6366f1", textDecoration: "none", fontWeight: "500", backgroundColor: "#eef2ff", padding: "4px 10px", borderRadius: "6px" }}>View All</Link>
                                </div>
                                
                                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                    {recentScans.slice(0, 4).map((f) => (
                                        <div key={f.faculty_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "#e0e7ff", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", fontWeight: "bold" }}>
                                                    {getInitials(f.name)}
                                                </div>
                                                <div style={{ display: "flex", flexDirection: "column" }}>
                                                    <span style={{ fontSize: "0.9rem", color: "#0f172a", fontWeight: "600" }}>{f.name}</span>
                                                    <span style={{ fontSize: "0.75rem", padding: "1px 6px", borderRadius: "4px", display: "inline-block", width: "fit-content", marginTop: "2px",
                                                        backgroundColor: f.attendance?.status === 'present' ? '#d1fae5' : (f.attendance?.status === 'absent' ? '#fee2e2' : '#fef3c7'),
                                                        color: f.attendance?.status === 'present' ? '#10b981' : (f.attendance?.status === 'absent' ? '#ef4444' : '#f59e0b')
                                                    }}>
                                                        {f.attendance?.status === 'present' ? 'Present' : (f.attendance?.status === 'absent' ? 'Absent' : 'Late')}
                                                    </span>
                                                </div>
                                            </div>
                                            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>{formatTime(f.attendance?.marked_at)}</span>
                                        </div>
                                    ))}
                                    {recentScans.length === 0 && (
                                        <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.9rem", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
                                            No scans recorded yet today.
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Status Banner */}
            <div style={{ marginTop: "1.5rem", padding: "1rem", backgroundColor: step === 3 ? "#f0fdf4" : "#f8fafc", borderRadius: "12px", border: `1px solid ${step === 3 ? "#bbf7d0" : "#e2e8f0"}`, display: "flex", alignItems: "center", gap: "10px", color: step === 3 ? "#166534" : "#64748b" }}>
                {step === 1 && (
                    <>
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        <span style={{ fontSize: "0.85rem" }}>Once you scan successfully, attendance will be recorded automatically.</span>
                    </>
                )}
                {step === 2 && (
                    <>
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <span style={{ fontSize: "0.85rem" }}>Do not refresh or close the page while scanning.</span>
                    </>
                )}
                {step === 3 && (
                    <>
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span style={{ fontSize: "0.85rem", fontWeight: "500" }}>Attendance has been marked. Click 'Finish & Submit' to complete or 'Scan Another' to continue.</span>
                    </>
                )}
            </div>
            
            <style>{`
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.5); opacity: 0.5; }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .laser-line {
                    animation: scan 2s linear infinite;
                }
                @keyframes scan {
                    0% { top: 10%; }
                    50% { top: 90%; }
                    100% { top: 10%; }
                }
            `}</style>
        </div>
    );
}

export default FacultyAttendance;
