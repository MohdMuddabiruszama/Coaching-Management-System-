import React, { useState, useEffect, useContext, useRef } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import { Html5Qrcode } from "html5-qrcode";
import "./Students.css"; // Reuse the modern styling
import ThemeSelector from "../../components/ThemeSelector";
import { useScanSound } from "../../hooks/useScanSound";
import { requestCameraPermission } from "../../utils/capacitorPermissions";

function SmartAttendance() {
    const { user } = useContext(AuthContext);
    const dashboardPath = user?.role === "admin" || user?.role === "superadmin" || user?.role === "super_admin" || user?.role === "manager"
        ? "/admin/dashboard"
        : "/faculty/dashboard";
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [subjects, setSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState("");

    // Step state: 1 = Setup, 2 = Scanning, 3 = Results, 4 = History
    const [step, setStep] = useState(1);
    
    // Session State
    const [recentScans, setRecentScans] = useState([]);
    const [sessionStats, setSessionStats] = useState({
        totalScanned: 0,
        present: 0,
        absent: 0,
        late: 0
    });
    const scannedNamesInSession = useRef(new Set());

    // DB Stats for Step 3
    const [dbStats, setDbStats] = useState(null);
    const [unmarkedStudents, setUnmarkedStudents] = useState([]);
    const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

    const { unlockAudio, playSuccess, playWarning, playError } = useScanSound();

    // Scanner State
    const [message, setMessage] = useState(null);
    const [cameraError, setCameraError] = useState(null);
    const [countdown, setCountdown] = useState(null);
    const isProcessed = useRef(false);
    const qrCodeRef = useRef(null);
    const isScannerRunning = useRef(false);
    const autoResumeTimer = useRef(null);

    // Refs for callback access
    const selectedClassRef = useRef(selectedClass);
    const selectedSubjectRef = useRef(selectedSubject);

    useEffect(() => {
        selectedClassRef.current = selectedClass;
        selectedSubjectRef.current = selectedSubject;
    }, [selectedClass, selectedSubject]);

    useEffect(() => {
        fetchClasses();
        return () => {
            stopScanner();
        };
    }, []);

    useEffect(() => {
        if (selectedClass) {
            fetchSubjects();
        } else {
            setSubjects([]);
            setSelectedSubject("");
        }
    }, [selectedClass]);

    const fetchClasses = async () => {
        try {
            const response = await api.get("/classes");
            setClasses(response.data.data || []);
        } catch (error) {
            console.error("Error fetching classes:", error);
        }
    };

    const fetchSubjects = async () => {
        try {
            const response = await api.get(`/subjects?class_id=${selectedClass}`);
            setSubjects(response.data.data || []);
            setSelectedSubject("");
        } catch (error) {
            console.error("Error fetching subjects:", error);
        }
    };

    const startScanningProcess = async () => {
        if (!selectedClass) return alert("Please select a class");
        if (!selectedSubject) return alert("Please select a subject");

        const hasPermission = await requestCameraPermission();
        if (!hasPermission) {
            setCameraError("Camera permission denied. Please allow camera access in your device Settings.");
            return;
        }

        unlockAudio();
        setMessage(null);
        setCameraError(null);
        isProcessed.current = false;
        
        // Reset session tracking
        setRecentScans([]);
        setSessionStats({ totalScanned: 0, present: 0, absent: 0, late: 0 });
        scannedNamesInSession.current = new Set();
        setDbStats(null);
        setUnmarkedStudents([]);
        
        setStep(2); // Move to scanning step

        setTimeout(() => {
            startScanner();
        }, 300);
    };

    const stopScanningProcess = async () => {
        if (autoResumeTimer.current) {
            clearInterval(autoResumeTimer.current);
            autoResumeTimer.current = null;
        }
        setCountdown(null);
        setMessage(null);
        await stopScanner();
        
        await fetchFinalResults(); // Fetch from DB before showing Step 3
        setStep(3); // Move to Results Step
    };

    const fetchFinalResults = async () => {
        try {
            const date = getLocalDate();
            const response = await api.get(`/attendance/class/${selectedClassRef.current}/subject/${selectedSubjectRef.current}/date/${date}`);
            if (response.data.success) {
                const students = response.data.data;
                const summary = response.data.summary;
                
                const unmarked = students.filter(s => !s.attendance || s.attendance.status === 'pending');
                
                setDbStats({
                    total: summary.total,
                    present: summary.present,
                    absent: summary.absent,
                    late: summary.late,
                    unmarked: unmarked.length
                });
                
                setUnmarkedStudents(unmarked);
            }
        } catch (error) {
            console.error("Error fetching final results:", error);
        }
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
                    markStudentAttendance(decodedText);
                },
                () => { /* ignore frame errors */ }
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
        } catch (e) {
        } finally {
            try {
                if (qrCodeRef.current) qrCodeRef.current.clear();
            } catch (e) { }
            qrCodeRef.current = null;
            isScannerRunning.current = false;
        }
    };

    const getLocalDate = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const parseStudentNameFromMessage = (msg) => {
        // "Attendance marked successfully for Student Name! ✅"
        const match = msg.match(/for\s+(.*?)(!|✅|$)/i);
        if (match && match[1]) {
            return match[1].trim();
        }
        return "Student";
    };

    const markStudentAttendance = async (decodedQR) => {
        try {
            setMessage({ type: "loading", text: "Marking attendance..." });

            const response = await api.post("/attendance/mark-student-qr", {
                qr_code: decodedQR,
                class_id: selectedClassRef.current,
                subject_id: selectedSubjectRef.current,
                date: getLocalDate()
            });

            if (response.data.success) {
                setMessage({ type: "success", text: response.data.message });
                playSuccess();
                
                // Extract name
                const studentName = parseStudentNameFromMessage(response.data.message);
                const scanTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                // Update Local State for Session (prevent duplicates)
                if (!scannedNamesInSession.current.has(studentName)) {
                    scannedNamesInSession.current.add(studentName);
                    setRecentScans(prev => [{ name: studentName, status: 'Present', time: scanTime }, ...prev].slice(0, 10));
                    setSessionStats(prev => ({
                        ...prev,
                        totalScanned: prev.totalScanned + 1,
                        present: prev.present + 1
                    }));
                }
            }
        } catch (error) {
            const errorMsg = error.response?.data?.message || "Failed to mark attendance";
            let type = "error";
            if (error.response?.status === 400 && errorMsg.includes("already marked")) {
                type = "warning";
                playWarning();
                
                const studentName = parseStudentNameFromMessage(errorMsg);
                if (!scannedNamesInSession.current.has(studentName)) {
                    scannedNamesInSession.current.add(studentName);
                    const scanTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    setRecentScans(prev => [{ name: studentName, status: 'Present', time: scanTime }, ...prev].slice(0, 10));
                    setSessionStats(prev => ({
                        ...prev,
                        totalScanned: prev.totalScanned + 1
                    }));
                }
            } else {
                playError();
            }
            setMessage({ type: type, text: errorMsg });
        }

        // Auto-resume scanner
        let secs = 2;
        setCountdown(secs);
        if (autoResumeTimer.current) clearInterval(autoResumeTimer.current);
        autoResumeTimer.current = setInterval(() => {
            secs -= 1;
            if (secs <= 0) {
                clearInterval(autoResumeTimer.current);
                autoResumeTimer.current = null;
                setCountdown(null);
                setMessage(null);
                isProcessed.current = false;
                setTimeout(() => startScanner(), 300);
            } else {
                setCountdown(secs);
            }
        }, 1000);
    };

    const handleScanAgain = () => {
        setStep(1);
    };

    const submitRemainingAsAbsent = async () => {
        if (unmarkedStudents.length === 0) return;
        setIsSubmittingBulk(true);
        try {
            const attendance_data = unmarkedStudents.map(s => ({
                student_id: s.student_id,
                status: 'absent',
                remarks: 'Marked absent via Smart Scanner'
            }));
            
            const response = await api.post('/attendance/bulk', {
                class_id: selectedClassRef.current,
                subject_id: selectedSubjectRef.current,
                date: getLocalDate(),
                attendance_data
            });
            
            if (response.data.success) {
                alert(`Successfully marked ${unmarkedStudents.length} remaining students as absent.`);
                await fetchFinalResults(); // Refresh DB stats
            }
        } catch (error) {
            console.error("Error submitting bulk absent:", error);
            alert("Failed to mark remaining as absent.");
        } finally {
            setIsSubmittingBulk(false);
        }
    };

    // --- Helper to get Class/Subject name ---
    const getSelectedClassName = () => {
        const cls = classes.find(c => String(c.id) === String(selectedClass));
        return cls ? `${cls.name} ${cls.section ? '- ' + cls.section : ''}` : '';
    };
    const getSelectedSubjectName = () => {
        const sub = subjects.find(s => String(s.id) === String(selectedSubject));
        return sub ? sub.name : '';
    };

    // --- RENDERERS FOR EACH STEP ---
    
    // RENDER: STEPPER HEADER
    const renderStepper = () => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: step >= 1 ? '#6366f1' : '#94a3b8', fontWeight: step === 1 ? '700' : '500' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: step >= 1 ? '#6366f1' : '#e2e8f0', color: step >= 1 ? 'white' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                    {step > 1 ? '✓' : '1'}
                </div>
                <span>Select Class & Subject</span>
            </div>
            <div style={{ height: '2px', width: '40px', background: step >= 2 ? '#6366f1' : '#e2e8f0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: step >= 2 ? '#6366f1' : '#94a3b8', fontWeight: step === 2 ? '700' : '500' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: step >= 2 ? '#6366f1' : '#e2e8f0', color: step >= 2 ? 'white' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                    {step > 2 ? '✓' : '2'}
                </div>
                <span>Scan QR Code</span>
            </div>
            <div style={{ height: '2px', width: '40px', background: step >= 3 ? '#6366f1' : '#e2e8f0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: step >= 3 ? '#6366f1' : '#94a3b8', fontWeight: step === 3 ? '700' : '500' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: step >= 3 ? '#6366f1' : '#e2e8f0', color: step >= 3 ? 'white' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                    3
                </div>
                <span>View Results</span>
            </div>
        </div>
    );

    return (
        <div className="students-container">
            {/* Header */}
            <div className="st-header" style={{ marginBottom: "1rem" }}>
                <div className="st-header-top-row">
                    <div className="st-header-left">
                        <h1>Scan Student QR</h1>
                        <p>{step === 1 ? 'Select class and subject to start scanning student QR codes.' : step === 2 ? 'Position student QR code within the frame to scan.' : 'Scan completed successfully.'}</p>
                    </div>
                </div>
                <div className="st-header-bottom-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div className="st-breadcrumbs">
                        <Link to={dashboardPath} style={{color: '#64748b', textDecoration: 'none'}}>Dashboard</Link>
                        <span>›</span>
                        <span className="active">Scan Student QR</span>
                    </div>
                    {step === 1 && (
                        <div className="st-header-actions">
                            <button onClick={() => setStep(4)} className="st-btn st-btn-outline" style={{ color: "#6366f1", borderColor: "#c7d2fe", background: "#eef2ff" }}>
                                📊 Scan History
                            </button>
                        </div>
                    )}
                    {step === 2 && (
                        <div className="st-header-actions">
                            <button onClick={stopScanningProcess} className="st-btn st-btn-primary" style={{ background: "#ef4444", borderColor: "#ef4444", color: "white" }}>
                                🛑 End Scan
                            </button>
                        </div>
                    )}
                    {step === 3 && (
                        <div className="st-header-actions" style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={handleScanAgain} className="st-btn st-btn-outline" style={{ color: "#6366f1", borderColor: "#c7d2fe", background: "#eef2ff" }}>
                                🔄 Scan Again
                            </button>
                        </div>
                    )}
                    {step === 4 && (
                        <div className="st-header-actions">
                            <button onClick={() => setStep(1)} className="st-btn st-btn-outline" style={{ color: "#64748b", borderColor: "#cbd5e1", background: "#f8fafc" }}>
                                ← Back to Scanner
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {(step === 1 || step === 2 || step === 3) && renderStepper()}

            {/* --- STEP 1: START --- */}
            {step === 1 && (
                <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div className="st-card" style={{ flex: '1 1 500px', padding: '2.5rem' }}>
                        <h2 style={{ marginBottom: "2rem", color: "#0f172a", fontSize: '1.5rem', textAlign: 'center' }}>Start New Scan</h2>
                        
                        <div className="form-group" style={{ textAlign: "left", marginBottom: "1.5rem" }}>
                            <label className="form-label" style={{ fontWeight: '600', color: '#475569', marginBottom: '0.5rem' }}>Class <span style={{color: '#ef4444'}}>*</span></label>
                            <select
                                className="st-select"
                                style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                            >
                                <option value="">📚 Select Class</option>
                                {classes.map((cls) => (
                                    <option key={cls.id} value={cls.id}>
                                        {cls.name} {cls.section ? `(${cls.section})` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="form-group" style={{ textAlign: "left", marginBottom: "2rem" }}>
                            <label className="form-label" style={{ fontWeight: '600', color: '#475569', marginBottom: '0.5rem' }}>Subject <span style={{color: '#ef4444'}}>*</span></label>
                            <select
                                className="st-select"
                                style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
                                value={selectedSubject}
                                onChange={(e) => setSelectedSubject(e.target.value)}
                                disabled={!selectedClass}
                            >
                                <option value="">📖 Select Subject</option>
                                {subjects.map((sub) => (
                                    <option key={sub.id} value={sub.id}>
                                        {sub.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={{ background: '#eef2ff', color: '#4f46e5', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                            <span>ℹ️</span> Make sure students have their QR codes ready before scanning.
                        </div>

                        <button
                            className="st-btn st-btn-primary"
                            style={{ width: "100%", padding: "1rem", fontSize: "1.1rem", display: "flex", justifyContent: "center", gap: "10px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none" }}
                            onClick={startScanningProcess}
                            disabled={!selectedClass || !selectedSubject}
                        >
                            📸 Open Camera & Start Scanning
                        </button>
                    </div>

                    <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="st-card" style={{ padding: '1.5rem' }}>
                            <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.1rem' }}>Scan Tips</h3>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', color: '#64748b', fontSize: '0.95rem' }}>
                                <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><span style={{color: '#8b5cf6'}}>★</span> Ensure good lighting</li>
                                <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><span style={{color: '#8b5cf6'}}>★</span> Hold camera steady</li>
                                <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><span style={{color: '#8b5cf6'}}>★</span> Keep QR code within frame</li>
                                <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><span style={{color: '#8b5cf6'}}>★</span> One student at a time</li>
                            </ul>
                        </div>
                        <div className="st-card" style={{ padding: '1.5rem' }}>
                            <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.1rem' }}>Today's Summary</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}><span>📋</span> Total Scans</div>
                                    <strong style={{ color: '#0f172a' }}>0</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}><span>✅</span> Present</div>
                                    <strong style={{ color: '#0f172a' }}>0</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}><span>❌</span> Absent</div>
                                    <strong style={{ color: '#0f172a' }}>0</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}><span>🕒</span> Late</div>
                                    <strong style={{ color: '#0f172a' }}>0</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- STEP 2: SCANNING --- */}
            {step === 2 && (
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    {/* Left Column: Live Stats */}
                    <div style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="st-card" style={{ padding: '1.5rem', borderLeft: '4px solid #6366f1' }}>
                            <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="pulse-dot" style={{ width: '10px', height: '10px', background: '#22c55e', borderRadius: '50%', display: 'inline-block' }}></span> Scanning...
                            </h3>
                            <div style={{ marginBottom: '1rem' }}>
                                <span style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase' }}>Class</span>
                                <strong style={{ color: '#334155' }}>{getSelectedClassName()}</strong>
                            </div>
                            <div>
                                <span style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase' }}>Subject</span>
                                <strong style={{ color: '#334155' }}>{getSelectedSubjectName()}</strong>
                            </div>
                        </div>
                        
                        <div className="st-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b', fontWeight: 600 }}>Scanned</span>
                            <div style={{ background: '#f3f4f6', padding: '0.2rem 0.8rem', borderRadius: '20px', fontWeight: 'bold', color: '#0f172a' }}>{sessionStats.totalScanned}</div>
                        </div>
                        <div className="st-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ color: '#16a34a', fontWeight: 600 }}>Present</span>
                            <div style={{ background: '#dcfce7', padding: '0.2rem 0.8rem', borderRadius: '20px', fontWeight: 'bold', color: '#15803d' }}>{sessionStats.present}</div>
                        </div>
                        <div className="st-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: 0.7 }}>
                            <span style={{ color: '#dc2626', fontWeight: 600 }}>Absent</span>
                            <div style={{ background: '#fee2e2', padding: '0.2rem 0.8rem', borderRadius: '20px', fontWeight: 'bold', color: '#b91c1c' }}>{sessionStats.absent}</div>
                        </div>
                    </div>

                    {/* Middle Column: Camera */}
                    <div style={{ flex: '2 1 400px' }}>
                        <div className="st-card" style={{ padding: '2rem', textAlign: 'center', background: '#0f172a', color: 'white', position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
                                <span style={{ width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%' }}></span>
                                <span style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>Position QR code within the frame</span>
                            </div>
                            
                            {cameraError ? (
                                <div style={{ padding: "3rem 1rem", background: "#7f1d1d", color: "#fca5a5", borderRadius: "12px", border: "1px solid #ef4444" }}>
                                    <p style={{ fontSize: "1.1rem", fontWeight: "bold", margin: 0 }}>📵 {cameraError}</p>
                                </div>
                            ) : (
                                <div style={{ position: 'relative', maxWidth: "400px", margin: "0 auto", borderRadius: "16px", overflow: "hidden", border: "4px solid #334155", aspectRatio: "3/4", background: '#000' }}>
                                    <div id="faculty-qr-reader" style={{ width: "100%", height: "100%" }} />
                                    {/* Scan Overlay UI */}
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
                                        <div style={{ position: 'absolute', top: '15%', left: '15%', right: '15%', bottom: '15%', border: '2px solid rgba(34, 197, 94, 0.5)', borderRadius: '12px' }}></div>
                                        <div style={{ position: 'absolute', top: '50%', left: '10%', right: '10%', height: '2px', background: 'rgba(34, 197, 94, 0.8)', boxShadow: '0 0 10px #22c55e', animation: 'scanline 2s linear infinite' }}></div>
                                    </div>
                                    
                                    {/* Message Overlay */}
                                    {message && (
                                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: '1rem' }}>
                                            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: message.type === 'success' ? '#22c55e' : message.type === 'warning' ? '#f59e0b' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '1rem', color: 'white' }}>
                                                {message.type === 'success' ? '✓' : message.type === 'warning' ? '!' : '✗'}
                                            </div>
                                            <h3 style={{ color: 'white', margin: 0, fontSize: '1.2rem', textAlign: 'center' }}>{message.text}</h3>
                                            {countdown !== null && (
                                                <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>Resuming in {countdown}s...</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <style>{`
                            @keyframes scanline {
                                0% { top: 15%; }
                                50% { top: 85%; }
                                100% { top: 15%; }
                            }
                        `}</style>
                    </div>

                    {/* Right Column: Recent Scans */}
                    <div style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column' }}>
                        <div className="st-card" style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ margin: '0 0 1.5rem 0', color: '#1e293b', fontSize: '1.1rem' }}>Recent Scans</h3>
                            
                            {recentScans.length === 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#94a3b8', gap: '10px' }}>
                                    <div style={{ fontSize: '2rem' }}>📭</div>
                                    <p>No scans yet.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', maxHeight: '400px', paddingRight: '5px' }}>
                                    {recentScans.map((scan, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: i < recentScans.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: scan.status === 'Present' ? '#dcfce7' : scan.status === 'Late' ? '#fef3c7' : '#fee2e2', color: scan.status === 'Present' ? '#16a34a' : scan.status === 'Late' ? '#d97706' : '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>
                                                    {scan.status === 'Present' ? '✓' : scan.status === 'Late' ? 'L' : '✗'}
                                                </div>
                                                <div>
                                                    <strong style={{ display: 'block', color: '#1e293b', fontSize: '0.95rem' }}>{scan.name}</strong>
                                                    <span style={{ fontSize: '0.75rem', color: scan.status === 'Present' ? '#16a34a' : scan.status === 'Late' ? '#d97706' : '#dc2626' }}>{scan.status}</span>
                                                </div>
                                            </div>
                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{scan.time}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- STEP 3: RESULTS --- */}
            {step === 3 && dbStats && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#22c55e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', margin: '0 auto 1rem auto', boxShadow: '0 10px 25px rgba(34, 197, 94, 0.3)' }}>✓</div>
                        <h2 style={{ color: '#0f172a', margin: '0 0 0.5rem 0', fontSize: '2rem' }}>Scan Completed!</h2>
                        <p style={{ color: '#64748b', margin: 0 }}>Here is the final attendance database status for this session.</p>
                    </div>

                    <div className="st-stats-grid">
                        <div className="st-stat-card" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                            <p style={{ color: '#64748b', margin: '0 0 0.5rem 0', fontWeight: 600 }}>Total Students</p>
                            <h3 style={{ fontSize: '2.5rem', color: '#0f172a', margin: 0 }}>{dbStats.total}</h3>
                        </div>
                        <div className="st-stat-card" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                            <p style={{ color: '#16a34a', margin: '0 0 0.5rem 0', fontWeight: 600 }}>Present</p>
                            <h3 style={{ fontSize: '2.5rem', color: '#15803d', margin: 0 }}>{dbStats.present}</h3>
                            <div style={{ fontSize: '0.85rem', color: '#22c55e', marginTop: '5px' }}>{dbStats.total > 0 ? Math.round((dbStats.present / dbStats.total) * 100) : 0}%</div>
                        </div>
                        <div className="st-stat-card" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                            <p style={{ color: '#dc2626', margin: '0 0 0.5rem 0', fontWeight: 600 }}>Absent</p>
                            <h3 style={{ fontSize: '2.5rem', color: '#b91c1c', margin: 0 }}>{dbStats.absent}</h3>
                            <div style={{ fontSize: '0.85rem', color: '#ef4444', marginTop: '5px' }}>{dbStats.total > 0 ? Math.round((dbStats.absent / dbStats.total) * 100) : 0}%</div>
                        </div>
                        <div className="st-stat-card" style={{ textAlign: 'center', padding: '2rem 1rem', background: '#f8fafc', border: '1px dashed #cbd5e1' }}>
                            <p style={{ color: '#64748b', margin: '0 0 0.5rem 0', fontWeight: 600 }}>Unmarked</p>
                            <h3 style={{ fontSize: '2.5rem', color: '#475569', margin: 0 }}>{dbStats.unmarked}</h3>
                            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '5px' }}>Yet to scan</div>
                        </div>
                    </div>

                    <div className="st-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '3rem', padding: '3rem', alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: '300px' }}>
                            <h3 style={{ color: '#0f172a', marginBottom: '1.5rem', fontSize: '1.2rem' }}>Actions</h3>
                            
                            {dbStats.unmarked > 0 ? (
                                <div style={{ marginBottom: '2rem', padding: '1rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px' }}>
                                    <p style={{ margin: '0 0 1rem 0', color: '#b45309', fontSize: '0.95rem' }}>
                                        There are <strong>{dbStats.unmarked}</strong> students who were not scanned. Do you want to mark them as absent?
                                    </p>
                                    <button 
                                        onClick={submitRemainingAsAbsent} 
                                        disabled={isSubmittingBulk}
                                        className="st-btn st-btn-primary" 
                                        style={{ width: '100%', background: '#f59e0b', borderColor: '#f59e0b' }}
                                    >
                                        {isSubmittingBulk ? "Submitting..." : "Submit Attendance (Mark Rest Absent)"}
                                    </button>
                                </div>
                            ) : (
                                <div style={{ marginBottom: '2rem', padding: '1rem', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', color: '#065f46' }}>
                                    Attendance already submitted for all students today. ✅
                                </div>
                            )}

                            <Link 
                                to={user?.role === 'faculty' ? "/faculty/attendance" : "/admin/attendance"} 
                                className="st-btn st-btn-outline" 
                                style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
                            >
                                ✏️ Edit Attendance Manually
                            </Link>
                        </div>
                        
                        <div style={{ flex: 1, minWidth: '300px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '3rem' }}>
                            {/* CSS Pie Chart */}
                            <div style={{ 
                                width: '150px', height: '150px', borderRadius: '50%', 
                                background: `conic-gradient(
                                    #22c55e 0% ${dbStats.total > 0 ? (dbStats.present / dbStats.total) * 100 : 100}%, 
                                    #ef4444 ${dbStats.total > 0 ? (dbStats.present / dbStats.total) * 100 : 100}% ${dbStats.total > 0 ? ((dbStats.present + dbStats.absent) / dbStats.total) * 100 : 100}%, 
                                    #f59e0b ${dbStats.total > 0 ? ((dbStats.present + dbStats.absent) / dbStats.total) * 100 : 100}% ${dbStats.total > 0 ? ((dbStats.present + dbStats.absent + dbStats.late) / dbStats.total) * 100 : 100}%,
                                    #e2e8f0 ${dbStats.total > 0 ? ((dbStats.present + dbStats.absent + dbStats.late) / dbStats.total) * 100 : 100}% 100%
                                )`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                            }}>
                                <div style={{ width: '100px', height: '100px', background: 'white', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>{dbStats.total}</h3>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Total DB</span>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ width: '12px', height: '12px', background: '#22c55e', borderRadius: '3px' }}></span>
                                    <span style={{ color: '#475569', fontSize: '0.9rem' }}>Present ({dbStats.present})</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '3px' }}></span>
                                    <span style={{ color: '#475569', fontSize: '0.9rem' }}>Absent ({dbStats.absent})</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ width: '12px', height: '12px', background: '#f59e0b', borderRadius: '3px' }}></span>
                                    <span style={{ color: '#475569', fontSize: '0.9rem' }}>Late ({dbStats.late})</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ width: '12px', height: '12px', background: '#e2e8f0', border: '1px dashed #94a3b8', borderRadius: '3px' }}></span>
                                    <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Unmarked ({dbStats.unmarked})</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- STEP 4: HISTORY (Mock) --- */}
            {step === 4 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="st-card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b' }}>Scan History is coming soon!</h3>
                        <p style={{ color: '#64748b' }}>This view will show a historical log of all your QR scan sessions.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SmartAttendance;
