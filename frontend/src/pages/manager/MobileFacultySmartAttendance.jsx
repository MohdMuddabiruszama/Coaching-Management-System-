import React, { useState, useEffect, useContext, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import { Html5Qrcode } from "html5-qrcode";
import { useScanSound } from "../../hooks/useScanSound";
import { requestCameraPermission } from "../../utils/capacitorPermissions";
import "../faculty/MobileSmartAttendance.css";

function MobileFacultySmartAttendance() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const [scanType, setScanType] = useState('in');

    // Step state: 1 = Setup, 2 = Scanning, 3 = History/Results
    const [step, setStep] = useState(1);
    
    // Session State
    const [recentScans, setRecentScans] = useState([]);
    const [sessionStats, setSessionStats] = useState({
        totalScanned: 0,
        present: 0
    });
    const scannedNamesInSession = useRef(new Set());

    const { unlockAudio, playSuccess, playWarning, playError } = useScanSound();

    // Scanner State
    const [message, setMessage] = useState(null);
    const [cameraError, setCameraError] = useState(null);
    const [countdown, setCountdown] = useState(null);
    const isProcessed = useRef(false);
    const qrCodeRef = useRef(null);
    const isScannerRunning = useRef(false);
    const autoResumeTimer = useRef(null);

    const scanTypeRef = useRef(scanType);

    useEffect(() => {
        scanTypeRef.current = scanType;
    }, [scanType]);

    useEffect(() => {
        return () => {
            stopScanner();
        };
    }, []);

    const startScanningProcess = async (type = 'in') => {
        setScanType(type);

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
        setSessionStats({ totalScanned: 0, present: 0 });
        scannedNamesInSession.current = new Set();
        
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
        
        setStep(3); // Move to Results Step
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

            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            const cameraConfig = isMobile 
                ? { facingMode: { exact: "environment" } }
                : { facingMode: "user" };

            await html5QrCode.start(
                cameraConfig,
                { fps: 10, qrbox: { width: 250, height: 250 } },
                handleScanSuccess,
                (errorMessage) => {
                    if (!errorMessage?.includes("NotFound")) {
                        console.log("QR Scan Warning:", errorMessage);
                    }
                }
            ).catch(async (err) => {
                console.warn("Exact environment camera failed, falling back...", err);
                await html5QrCode.start(
                    { facingMode: "environment" },
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    handleScanSuccess,
                    () => {}
                ).catch(e => {
                    setCameraError("Could not start back camera. " + e.message);
                });
            });

            isScannerRunning.current = true;
        } catch (error) {
            console.error("Scanner init error:", error);
            setCameraError(error.message || "Failed to initialize scanner.");
        }
    };

    const stopScanner = async () => {
        if (qrCodeRef.current && isScannerRunning.current) {
            try {
                await qrCodeRef.current.stop();
                qrCodeRef.current.clear();
                isScannerRunning.current = false;
            } catch (err) {
                console.error("Error stopping scanner:", err);
            }
        }
    };

    const handleScanSuccess = async (decodedQR) => {
        if (isProcessed.current) return;
        isProcessed.current = true;

        if (qrCodeRef.current && isScannerRunning.current) {
            await stopScanner();
        }

        try {
            const payload = {
                qr_code: decodedQR,
                scan_type: scanTypeRef.current
            };

            const response = await api.post("/faculty-attendance/mark-by-qr", payload);

            if (response.data.success) {
                playSuccess();
                setMessage({ type: 'success', text: response.data.message });
                
                const fName = response.data.data?.Faculty?.name || `Faculty ID: ${response.data.data?.faculty_id}`;
                
                if (!scannedNamesInSession.current.has(fName)) {
                    scannedNamesInSession.current.add(fName);
                    const scanTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    setRecentScans(prev => [{ name: fName, status: scanTypeRef.current.toUpperCase(), time: scanTime }, ...prev].slice(0, 10));
                    setSessionStats(prev => ({
                        totalScanned: prev.totalScanned + 1,
                        present: prev.present + 1
                    }));
                }
            } else {
                playWarning();
                setMessage({ type: 'warning', text: response.data.message || "Marked with remarks" });
            }
        } catch (error) {
            let errorMsg = error.response?.data?.message || "Failed to mark attendance";
            let type = 'error';

            if (errorMsg.includes("already marked") || errorMsg.includes("OUT time is already recorded") || errorMsg.includes("IN time is already recorded")) {
                playWarning();
                type = 'warning';
                
                const fName = `Faculty QR ${decodedQR.split("_")[2] || ''}`;
                
                if (!scannedNamesInSession.current.has(fName)) {
                    scannedNamesInSession.current.add(fName);
                    const scanTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    setRecentScans(prev => [{ name: fName, status: scanTypeRef.current.toUpperCase(), time: scanTime }, ...prev].slice(0, 10));
                    setSessionStats(prev => ({
                        totalScanned: prev.totalScanned + 1,
                        present: prev.present + 1
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

    const renderStepper = () => (
        <div className="msa-stepper">
            <div className={`msa-step ${step >= 1 ? 'active' : ''}`}>
                <div className="msa-step-circle">{step > 1 ? '✓' : '1'}</div>
                <span>Open Scanner</span>
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
            {/* Header */}
            <div style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                borderRadius: '12px',
                marginBottom: '1rem',
                padding: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
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
                        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: 'white' }}>Scan Faculty QR</h1>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.9)', maxWidth: '200px', lineHeight: '1.4' }}>
                            {step === 1 ? 'Click Open Camera to start scanning' : 
                             step === 2 ? 'Position faculty QR code within the frame' : 
                             'Scan completed successfully'}
                        </p>
                    </div>
                </div>
                
                <div style={{ fontSize: '3rem', zIndex: 1, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))' }}>
                    📸
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
                            <h2>Faculty Scanning</h2>
                        </div>

                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', marginBottom: '1.5rem' }}>
                            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>🏫</span>
                            <h3 style={{ color: '#0f172a', margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>Faculty Attendance</h3>
                            <p style={{ color: '#64748b', margin: 0, fontSize: '0.85rem', lineHeight: '1.5' }}>
                                Simply scan the faculty's QR code. This records their time In and time Out accurately.
                            </p>
                        </div>

                        <div className="msa-info-box">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                            <span>Make sure faculty have their QR codes ready before scanning.</span>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                            <button
                                style={{ flex: 1, padding: '0.875rem', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #4f46e5, #4338ca)', border: 'none', borderRadius: '12px', color: 'white', fontWeight: 600, cursor: 'pointer' }}
                                onClick={() => startScanningProcess('in')}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                                Open Camera
                            </button>
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
                    </div>

                    {/* Today's Summary */}
                    <div style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "16px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)", border: "1px solid #f1f5f9", marginTop: "1rem" }}>
                        <h3 style={{ margin: "0 0 1.2rem 0", fontSize: "1.1rem", color: "#0f172a" }}>Today's Summary</h3>
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.8rem", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#6366f1" }}>
                                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                    <span style={{ fontSize: "0.9rem", color: "#334155", fontWeight: "500" }}>Total Scanned</span>
                                </div>
                                <span style={{ fontWeight: "700", color: "#6366f1", backgroundColor: "#eef2ff", padding: "2px 8px", borderRadius: "12px", fontSize: "0.9rem" }}>{sessionStats.totalScanned}</span>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.8rem", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#10b981" }}>
                                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <span style={{ fontSize: "0.9rem", color: "#334155", fontWeight: "500" }}>Present</span>
                                </div>
                                <span style={{ fontWeight: "700", color: "#10b981", backgroundColor: "#d1fae5", padding: "2px 8px", borderRadius: "12px", fontSize: "0.9rem" }}>{sessionStats.present}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 3: RESULTS */}
            {step === 3 && (
                <div className="msa-content">
                    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#22c55e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', margin: '0 auto 1rem auto', boxShadow: '0 10px 25px rgba(34, 197, 94, 0.3)' }}>✓</div>
                        <h2 style={{ color: '#0f172a', margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>Scan Session Completed!</h2>
                        <p style={{ color: '#64748b', margin: 0, fontSize: '0.9rem' }}>All scanned faculty have been marked accordingly.</p>
                    </div>

                    <div className="msa-stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        <div className="msa-stat-card" style={{ textAlign: 'center' }}>
                            <span>Total QR Scans</span>
                            <strong>{sessionStats.totalScanned}</strong>
                        </div>
                        <div className="msa-stat-card text-green" style={{ textAlign: 'center' }}>
                            <span>Scans Logged</span>
                            <strong>{sessionStats.present}</strong>
                        </div>
                    </div>
                    
                    <button 
                        className="msa-btn-outline-full"
                        style={{ marginTop: '2rem' }}
                        onClick={() => navigate('/manager/mark-faculty-attendance')}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        Edit Attendance Manually
                    </button>
                </div>
            )}
        </div>
    );
}

export default MobileFacultySmartAttendance;
