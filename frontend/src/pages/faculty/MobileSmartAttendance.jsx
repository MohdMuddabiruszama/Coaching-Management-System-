import React, { useState, useEffect, useContext, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import { Html5Qrcode } from "html5-qrcode";
import { useScanSound } from "../../hooks/useScanSound";
import { requestCameraPermission } from "../../utils/capacitorPermissions";
import "./MobileSmartAttendance.css";

function MobileSmartAttendance() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
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

            const html5QrCode = new Html5Qrcode("mobile-faculty-qr-reader");
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
        const match = msg.match(/for\s+(.*?)(!|✅|$)/i);
        if (match && match[1]) {
            return match[1].trim();
        }
        return "Student";
    };

    const markStudentAttendance = async (decodedQR) => {
        try {
            setMessage({ type: "loading", text: "Marking attendance..." });

            const response = await api.post("/attendance/smart/mark-student", {
                qr_code: decodedQR,
                class_id: selectedClassRef.current,
                subject_id: selectedSubjectRef.current,
                date: getLocalDate()
            });

            if (response.data.success) {
                setMessage({ type: "success", text: response.data.message });
                playSuccess();
                
                const studentName = parseStudentNameFromMessage(response.data.message);
                const scanTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
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
                await fetchFinalResults();
            }
        } catch (error) {
            console.error("Error submitting bulk absent:", error);
            alert("Failed to mark remaining as absent.");
        } finally {
            setIsSubmittingBulk(false);
        }
    };

    const renderStepper = () => (
        <div className="msa-stepper">
            <div className={`msa-step ${step >= 1 ? 'active' : ''}`}>
                <div className="msa-step-circle">{step > 1 ? '✓' : '1'}</div>
                <span>Select</span>
            </div>
            <div className={`msa-step-line ${step >= 2 ? 'active' : ''}`}></div>
            <div className={`msa-step ${step >= 2 ? 'active' : ''}`}>
                <div className="msa-step-circle">{step > 2 ? '✓' : '2'}</div>
                <span>Scan</span>
            </div>
            <div className={`msa-step-line ${step >= 3 ? 'active' : ''}`}></div>
            <div className={`msa-step ${step >= 3 ? 'active' : ''}`}>
                <div className="msa-step-circle">3</div>
                <span>Results</span>
            </div>
        </div>
    );

    return (
        <div className="msa-container">
            {/* Header - Styled to match Mark Attendance */}
            <div style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                borderRadius: '12px',
                marginBottom: '1rem',
                padding: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', zIndex: 1 }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(10px)',
                        flexShrink: 0,
                        color: 'white'
                    }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v16H4z"></path><path d="M4 4l5 5"></path><path d="M20 4l-5 5"></path><path d="M4 20l5-5"></path><path d="M20 20l-5-5"></path></svg>
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: 'white' }}>Scan Student QR</h1>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.9)', maxWidth: '200px', lineHeight: '1.4' }}>
                            {step === 1 ? 'Select class and subject to start scanning' : 
                             step === 2 ? 'Position student QR code within the frame' : 
                             'Scan completed successfully'}
                        </p>
                    </div>
                </div>
                
                <div style={{ fontSize: '3rem', zIndex: 1, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))' }}>
                    📲✨
                </div>
                
                {/* Decorative background circle */}
                <div style={{
                    position: 'absolute',
                    right: '-20px',
                    top: '-20px',
                    width: '100px',
                    height: '100px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '50%',
                    zIndex: 0
                }} />
            </div>

            {/* Action buttons bar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>

                {step === 2 && (
                    <button className="msa-end-scan-btn" onClick={stopScanningProcess}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                        End Scan
                    </button>
                )}
                {step === 3 && (
                    <button className="msa-history-btn" onClick={handleScanAgain}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v6h6"></path></svg>
                        Scan Again
                    </button>
                )}
            </div>

            {renderStepper()}

            {/* STEP 1: SETUP */}
            {step === 1 && (
                <div className="msa-content">
                    <div className="msa-card">
                        <div className="msa-card-header">
                            <div className="msa-card-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v16H4z"></path><path d="M4 4l5 5"></path><path d="M20 4l-5 5"></path><path d="M4 20l5-5"></path><path d="M20 20l-5-5"></path></svg>
                            </div>
                            <h2>Start New Scan</h2>
                        </div>

                        <div className="msa-form-group">
                            <label>Class <span className="text-red">*</span></label>
                            <div className="msa-select-wrapper">
                                <span className="msa-select-icon">📚</span>
                                <select 
                                    className="msa-select"
                                    value={selectedClass}
                                    onChange={(e) => setSelectedClass(e.target.value)}
                                >
                                    <option value="">Select Class</option>
                                    {classes.map((cls) => (
                                        <option key={cls.id} value={cls.id}>
                                            {cls.name} {cls.section ? `- ${cls.section}` : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="msa-form-group">
                            <label>Subject <span className="text-red">*</span></label>
                            <div className="msa-select-wrapper">
                                <span className="msa-select-icon">📖</span>
                                <select 
                                    className="msa-select"
                                    value={selectedSubject}
                                    onChange={(e) => setSelectedSubject(e.target.value)}
                                    disabled={!selectedClass}
                                >
                                    <option value="">Select Subject</option>
                                    {subjects.map((sub) => (
                                        <option key={sub.id} value={sub.id}>
                                            {sub.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="msa-info-box">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                            <span>Make sure students have their QR codes ready before scanning.</span>
                        </div>

                        <button 
                            className="msa-btn-primary"
                            onClick={startScanningProcess}
                            disabled={!selectedClass || !selectedSubject}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                            Open Camera & Start Scanning
                        </button>
                    </div>

                    <div className="msa-card msa-tips-card">
                        <div className="msa-tips-header">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                            <h3>Scan Tips</h3>
                        </div>
                        <div className="msa-tips-grid">
                            <div className="msa-tip-item"><span className="text-purple">★</span> Ensure good lighting</div>
                            <div className="msa-tip-item"><span className="text-purple">★</span> Keep QR code within frame</div>
                            <div className="msa-tip-item"><span className="text-purple">★</span> Hold camera steady</div>
                            <div className="msa-tip-item"><span className="text-purple">★</span> One student at a time</div>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 2: SCANNING */}
            {step === 2 && (
                <div className="msa-content">
                    <div className="msa-scanner-container">
                        <div className="msa-scanner-header">
                            <span className="msa-pulse-dot"></span>
                            <span>Position QR code within the frame</span>
                        </div>
                        <div className="msa-scanner-box">
                            {cameraError ? (
                                <div className="msa-camera-error">
                                    <p>{cameraError}</p>
                                </div>
                            ) : (
                                <>
                                    <div id="mobile-faculty-qr-reader" className="msa-qr-reader"></div>
                                    <div className="msa-scanner-overlay">
                                        <div className="msa-scanner-frame"></div>
                                        <div className="msa-scan-line"></div>
                                    </div>
                                    {message && (
                                        <div className="msa-message-overlay">
                                            <div className={`msa-message-icon ${message.type}`}>
                                                {message.type === 'success' ? '✓' : message.type === 'warning' ? '!' : '✗'}
                                            </div>
                                            <h3>{message.text}</h3>
                                            {countdown !== null && <p>Resuming in {countdown}s...</p>}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="msa-scanner-footer">
                            <button className="msa-flash-btn" onClick={() => {/* Toggle flash if supported */}}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                Tap to turn on flash
                            </button>
                        </div>
                    </div>

                    <div className="msa-progress-card">
                        <h3>Scan Progress</h3>
                        <div className="msa-progress-grid">
                            <div className="msa-progress-item">
                                <span>Scanned</span>
                                <strong className="text-purple">{sessionStats.totalScanned}</strong>
                            </div>
                            <div className="msa-progress-item">
                                <span>Present</span>
                                <strong className="text-green">{sessionStats.present}</strong>
                            </div>
                            <div className="msa-progress-item">
                                <span>Absent</span>
                                <strong className="text-red">{sessionStats.absent}</strong>
                            </div>
                            <div className="msa-progress-item">
                                <span>Remaining</span>
                                <strong className="text-grey">{dbStats?.unmarked || 0}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 3: RESULTS */}
            {step === 3 && dbStats && (
                <div className="msa-content">
                    <div className="msa-stats-grid">
                        <div className="msa-stat-card">
                            <span>Total Students</span>
                            <strong>{dbStats.total}</strong>
                            <small>All students in class</small>
                        </div>
                        <div className="msa-stat-card text-green">
                            <span>Present</span>
                            <strong>{dbStats.present}</strong>
                            <small>{dbStats.total > 0 ? Math.round((dbStats.present / dbStats.total) * 100) : 0}%</small>
                        </div>
                        <div className="msa-stat-card text-red">
                            <span>Absent</span>
                            <strong>{dbStats.absent}</strong>
                            <small>{dbStats.total > 0 ? Math.round((dbStats.absent / dbStats.total) * 100) : 0}%</small>
                        </div>
                        <div className="msa-stat-card text-grey">
                            <span>Unmarked</span>
                            <strong>{dbStats.unmarked}</strong>
                            <small>{dbStats.total > 0 ? Math.round((dbStats.unmarked / dbStats.total) * 100) : 0}%</small>
                        </div>
                    </div>

                    <div className="msa-results-actions">
                        <div className="msa-results-warning">
                            <div className="msa-warning-content">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                <div>
                                    <p>There are <strong>{dbStats.unmarked}</strong> students not marked yet.</p>
                                    <p>Do you want to mark them as absent?</p>
                                </div>
                            </div>
                            <button 
                                className="msa-btn-warning"
                                onClick={submitRemainingAsAbsent}
                                disabled={isSubmittingBulk || dbStats.unmarked === 0}
                            >
                                {isSubmittingBulk ? "Submitting..." : "Mark All Unmarked as Absent"}
                            </button>
                        </div>

                        <div className="msa-chart-container">
                            <div className="msa-pie-chart" style={{
                                background: `conic-gradient(
                                    #22c55e 0% ${dbStats.total > 0 ? (dbStats.present / dbStats.total) * 100 : 100}%, 
                                    #ef4444 ${dbStats.total > 0 ? (dbStats.present / dbStats.total) * 100 : 100}% ${dbStats.total > 0 ? ((dbStats.present + dbStats.absent) / dbStats.total) * 100 : 100}%, 
                                    #f59e0b ${dbStats.total > 0 ? ((dbStats.present + dbStats.absent) / dbStats.total) * 100 : 100}% ${dbStats.total > 0 ? ((dbStats.present + dbStats.absent + dbStats.late) / dbStats.total) * 100 : 100}%,
                                    #e2e8f0 ${dbStats.total > 0 ? ((dbStats.present + dbStats.absent + dbStats.late) / dbStats.total) * 100 : 100}% 100%
                                )`
                            }}>
                                <div className="msa-pie-inner">
                                    <strong>{dbStats.total}</strong>
                                    <span>Total</span>
                                </div>
                            </div>
                            <div className="msa-chart-legend">
                                <div><span style={{background: '#22c55e'}}></span> Present ({dbStats.present})</div>
                                <div><span style={{background: '#ef4444'}}></span> Absent ({dbStats.absent})</div>
                                <div><span style={{background: '#f59e0b'}}></span> Late ({dbStats.late})</div>
                                <div><span style={{background: '#e2e8f0'}}></span> Unmarked ({dbStats.unmarked})</div>
                            </div>
                        </div>
                    </div>

                    <button 
                        className="msa-btn-outline-full"
                        onClick={() => navigate('/faculty/attendance')}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        Edit Attendance Manually
                    </button>
                </div>
            )}
        </div>
    );
}

export default MobileSmartAttendance;
