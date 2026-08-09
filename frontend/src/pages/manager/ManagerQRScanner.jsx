/**
 * ManagerQRScanner.jsx
 * QR Code scanner for manager to mark student attendance.
 * Reuses Html5Qrcode (same library as MobileSmartAttendance.jsx — no new deps).
 * Flow: Select class → Select subject → Scan QR → Confirm → Mark attendance
 */
import { useState, useEffect, useRef, useContext, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import { requestCameraPermission } from "../../utils/capacitorPermissions";
import "./ManagerQRScanner.css";

const SCANNER_ID = "mqrs-reader";

function ManagerQRScanner() {
    const { user } = useContext(AuthContext);
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [subjects, setSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [step, setStep] = useState("setup"); // setup | scanning | result
    const [cameraError, setCameraError] = useState(null);
    const [scanResult, setScanResult] = useState(null); // { name, rollNo, className, feeStatus, studentId }
    const [confirming, setConfirming] = useState(false);
    const [recentScans, setRecentScans] = useState([]);
    const qrRef = useRef(null);
    const isScannerRunning = useRef(false);
    const isProcessing = useRef(false);
    const selectedClassRef = useRef(selectedClass);
    const selectedSubjectRef = useRef(selectedSubject);

    useEffect(() => { selectedClassRef.current = selectedClass; }, [selectedClass]);
    useEffect(() => { selectedSubjectRef.current = selectedSubject; }, [selectedSubject]);

    useEffect(() => {
        fetchClasses();
        return () => { stopScanner(); };
    }, []);

    useEffect(() => {
        if (selectedClass) fetchSubjects();
        else { setSubjects([]); setSelectedSubject(""); }
    }, [selectedClass]);

    const fetchClasses = async () => {
        try {
            const res = await api.get("/classes");
            setClasses(res.data.data || []);
        } catch (e) { console.error("fetchClasses:", e); }
    };

    const fetchSubjects = async () => {
        try {
            const res = await api.get(`/subjects?class_id=${selectedClass}`);
            setSubjects(res.data.data || []);
            setSelectedSubject("");
        } catch (e) { console.error("fetchSubjects:", e); }
    };

    const startScanner = useCallback(async () => {
        if (!selectedClass) return alert("Please select a class");
        if (!selectedSubject) return alert("Please select a subject");

        const hasPerm = await requestCameraPermission();
        if (!hasPerm) {
            setCameraError("Camera permission denied. Please allow camera access in device Settings.");
            return;
        }

        setStep("scanning");
        setScanResult(null);
        setCameraError(null);
        isProcessing.current = false;

        // Small delay to let DOM mount the reader div
        setTimeout(async () => {
            try {
                const qr = new Html5Qrcode(SCANNER_ID);
                qrRef.current = qr;
                await qr.start(
                    { facingMode: "environment" },
                    { fps: 10, qrbox: { width: 240, height: 240 } },
                    handleScan,
                    () => {}
                );
                isScannerRunning.current = true;
            } catch (e) {
                if (window.isSecureContext === false) {
                    setCameraError("Camera access requires a secure connection (HTTPS). Please access this site using HTTPS.");
                } else {
                    setCameraError("Could not access camera: " + (e?.message || "Unknown error"));
                }
                setStep("setup");
            }
        }, 300);
    }, [selectedClass, selectedSubject]);

    const stopScanner = useCallback(async () => {
        if (qrRef.current && isScannerRunning.current) {
            try { await qrRef.current.stop(); } catch (_) {}
            isScannerRunning.current = false;
            qrRef.current = null;
        }
    }, []);

    const handleScan = useCallback(async (rawText) => {
        if (isProcessing.current) return;
        isProcessing.current = true;
        await stopScanner();

        try {
            // Use existing endpoint: POST /api/attendance/smart/mark-student
            // It accepts { qr_code, class_id, subject_id } and returns student info + marks attendance
            const res = await api.post("/attendance/smart/mark-student", {
                qr_code: rawText,
                class_id: selectedClassRef.current,
                subject_id: selectedSubjectRef.current,
            });
            const data = res.data;
            setScanResult({
                name: data.student_name || data.name || "Student",
                rollNo: data.roll_number || "",
                className: data.class_name || "",
                feeStatus: data.fee_status || "unknown",
                alreadyMarked: data.already_marked || false,
                success: true,
            });
            setRecentScans(prev => [
                {
                    name: data.student_name || data.name || "Student",
                    time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
                    type: data.already_marked ? "already" : "present"
                },
                ...prev.slice(0, 9)
            ]);
        } catch (e) {
            setScanResult({ error: e.response?.data?.message || "Invalid QR code or student not found." });
        }
        setStep("result");
    }, [stopScanner]);

    const handleConfirm = async () => {
        // Attendance was already marked in handleScan via /smart/mark-student
        // Just reset the scanner for the next student
        resetScanner();
    };

    const resetScanner = useCallback(async () => {
        setScanResult(null);
        isProcessing.current = false;
        setStep("scanning");
        // Restart scanner
        setTimeout(async () => {
            try {
                const qr = new Html5Qrcode(SCANNER_ID);
                qrRef.current = qr;
                await qr.start(
                    { facingMode: "environment" },
                    { fps: 10, qrbox: { width: 240, height: 240 } },
                    handleScan,
                    () => {}
                );
                isScannerRunning.current = true;
            } catch (e) {
                setCameraError("Could not restart camera: " + (e?.message || ""));
                setStep("setup");
            }
        }, 400);
    }, [handleScan]);

    const handleStop = async () => {
        await stopScanner();
        setStep("setup");
        setScanResult(null);
    };

    return (
        <div className="mqrs-page">
            <div className="mqrs-header">
                <h2 className="mqrs-title">📷 QR Scanner</h2>
                <p className="mqrs-subtitle">Scan student QR to mark attendance</p>
            </div>

            {/* Step 1: Setup */}
            {step === "setup" && (
                <div className="mqrs-setup-card">
                    <div className="mqrs-field">
                        <label>Select Class</label>
                        <select
                            className="mqrs-select"
                            value={selectedClass}
                            onChange={e => setSelectedClass(e.target.value)}
                        >
                            <option value="">— Choose Class —</option>
                            {classes.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="mqrs-field">
                        <label>Select Subject</label>
                        <select
                            className="mqrs-select"
                            value={selectedSubject}
                            onChange={e => setSelectedSubject(e.target.value)}
                            disabled={!selectedClass}
                        >
                            <option value="">— Choose Subject —</option>
                            {subjects.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    {cameraError && (
                        <div className="mqrs-camera-error">{cameraError}</div>
                    )}
                    <button
                        className="mqrs-start-btn"
                        onClick={startScanner}
                        disabled={!selectedClass || !selectedSubject}
                    >
                        📷 Start Scanning
                    </button>
                </div>
            )}

            {/* Step 2: Camera Active */}
            {step === "scanning" && !scanResult && (
                <>
                    <div className="mqrs-scanner-container">
                        <div id={SCANNER_ID} />
                    </div>
                    <button className="mqrs-stop-btn" onClick={handleStop}>
                        ✕ Stop Scanner
                    </button>
                </>
            )}

            {/* Step 3: Scan Result */}
            {step === "result" && scanResult && (
                <>
                    {/* Scanner stays mounted but hidden during result */}
                    <div style={{ display: "none" }}>
                        <div id={SCANNER_ID} />
                    </div>

                    {scanResult.error ? (
                        <div className="mqrs-result-card error">
                            <div className="mqrs-result-status">❌</div>
                            <p className="mqrs-result-name">Scan Failed</p>
                            <p className="mqrs-result-meta">{scanResult.error}</p>
                            <div className="mqrs-result-actions">
                                <button className="mqrs-confirm-btn" onClick={resetScanner}>
                                    Try Again
                                </button>
                                <button className="mqrs-dismiss-btn" onClick={handleStop}>
                                    Stop
                                </button>
                            </div>
                        </div>
                    ) : scanResult.alreadyMarked ? (
                        <div className="mqrs-result-card warning">
                            <div className="mqrs-result-status">⚠️</div>
                            <p className="mqrs-result-name">{scanResult.name}</p>
                            <p className="mqrs-result-meta">{scanResult.rollNo} · {scanResult.className}</p>
                            <p className="mqrs-result-meta">Already marked present today</p>
                            <div className="mqrs-result-actions">
                                <button className="mqrs-confirm-btn" onClick={resetScanner}>
                                    Next Student
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="mqrs-result-card success">
                            <div className="mqrs-result-status">✅</div>
                            <p className="mqrs-result-name">{scanResult.name}</p>
                            <p className="mqrs-result-meta">{scanResult.rollNo} · {scanResult.className}</p>
                            <span className={`mqrs-fee-badge ${scanResult.feeStatus === "pending" ? "pending" : "clear"}`}>
                                {scanResult.feeStatus === "pending" ? "⚠️ Fee Pending" : "✅ Fees Clear"}
                            </span>
                            <div className="mqrs-result-actions">
                                <button
                                    className="mqrs-confirm-btn"
                                    onClick={handleConfirm}
                                    disabled={confirming}
                                >
                                    {confirming ? "Marking..." : "✓ Mark Present"}
                                </button>
                                <button className="mqrs-dismiss-btn" onClick={resetScanner}>
                                    Skip
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Recent Scans */}
            {recentScans.length > 0 && (
                <>
                    <p className="mqrs-recent-title">Recent Scans · {recentScans.length}</p>
                    <div className="mqrs-scan-list">
                        {recentScans.map((s, i) => (
                            <div key={i} className="mqrs-scan-item">
                                <div className={`mqrs-scan-dot ${s.type}`} />
                                <p className="mqrs-scan-item-name">{s.name}</p>
                                <span className="mqrs-scan-item-time">{s.time}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

export default ManagerQRScanner;
