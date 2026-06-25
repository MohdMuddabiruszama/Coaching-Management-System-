/**
 * Register Page — Premium Design
 * OTP System: DB-backed via /register-init + /verify-registration
 * Features: 6-box OTP input, 10-min countdown, resend limit (3x)
 * Test Mode: When OTP_TEST_MODE=true on server, OTP is auto-filled & no email sent
 */

import { useState, useEffect, useRef, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import { ThemeContext } from "../../context/ThemeContext";
import ThemeSelector from "../../components/ThemeSelector";
import "../auth/Auth.css";
import "./Register.css";
import zfLogo from "../../assets/zf-logo.png";

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

function RegisterPage() {
    const navigate = useNavigate();
    const { setUser } = useContext(AuthContext);
    const { setTheme, isDark } = useContext(ThemeContext);

    const [loading, setLoading]             = useState(false);
    const [plans, setPlans]                 = useState([]);
    const [errors, setErrors]               = useState({});
    const [showOtpScreen, setShowOtpScreen] = useState(false);
    const [showPassword, setShowPassword]   = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // ── Test Mode state ───────────────────────────────────────────────────
    // Declared further below

    // OTP state
    const [otpDigits, setOtpDigits]         = useState(["", "", "", "", "", ""]);
    const [otpLoading, setOtpLoading]       = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [timer, setTimer]                 = useState(600); // 10 min
    const [timerActive, setTimerActive]     = useState(false);
    const [resendCount, setResendCount]     = useState(0);
    const [resendMax]                       = useState(3);
    const [otpError, setOtpError]           = useState("");
    const [testOtp, setTestOtp]             = useState("");      // only in test mode
    const otpRefs = useRef([]);

    const [formData, setFormData] = useState({
        instituteName: "", email: "", password: "", confirmPassword: "",
        phone: "", address: "", city: "", state: "", pincode: "", planId: "",
        agreedToTerms: false, logo: null
    });

    useEffect(() => {
        fetchPlans();
        fetchOtpMode();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (plans.length > 0) {
            const queryParams = new URLSearchParams(window.location.search);
            const planParam = queryParams.get("plan");
            const savedPlan = localStorage.getItem("selectedPlan");
            
            let selectedPlanId = "";
            
            if (planParam && planParam !== "free_trial") {
                selectedPlanId = planParam;
            } else if (planParam === "free_trial") {
                 const freePlan = plans.find(p => p.is_free_trial || parseFloat(p.price) === 0);
                 if (freePlan) selectedPlanId = freePlan.id;
            } else if (savedPlan) {
                selectedPlanId = savedPlan;
            }
            
            // Default to Free Trial if nothing else is specified
            if (!selectedPlanId) {
                const freePlan = plans.find(p => p.is_free_trial || parseFloat(p.price) === 0);
                if (freePlan) selectedPlanId = freePlan.id.toString();
            }

            if (selectedPlanId) {
                setFormData(prev => ({ ...prev, planId: selectedPlanId.toString() }));
            }
        }
    }, [plans]);

    // Countdown timer
    useEffect(() => {
        if (!timerActive) return;
        if (timer <= 0) { setTimerActive(false); return; }
        const id = setInterval(() => setTimer(t => t - 1), 1000);
        return () => clearInterval(id);
    }, [timerActive, timer]);

    const startTimer = () => { setTimer(600); setTimerActive(true); };

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60).toString().padStart(2, "0");
        const s = (secs % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
    };

    const fetchPlans = async () => {
        try {
            const res = await api.get("/plans");
            setPlans(res.data.data.filter(p => p.status === "active"));
        } catch (e) { console.error("Plans fetch error:", e); }
    };

    const [otpTestMode, setOtpTestMode]     = useState(true); // Default to true based on user preference or backend
    const [modeChecked, setModeChecked]     = useState(false);

    // Fetch OTP mode from server (initial state)
    const fetchOtpMode = async () => {
        try {
            const res = await api.get("/auth/otp-mode");
            setOtpTestMode(res.data.testMode === true);
        } catch (e) {
            console.warn("Could not fetch OTP mode:", e.message);
        } finally {
            setModeChecked(true);
        }
    };

    const toggleMode = () => {
        setOtpTestMode(prev => !prev);
    };

    const validateForm = () => {
        const errs = {};
        const emailRx   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRx   = /^[6-9]\d{9}$/;
        const pincodeRx = /^\d{6}$/;

        if (!formData.instituteName.trim() || formData.instituteName.trim().length < 3)
            errs.instituteName = "Institute name must be at least 3 characters";
        if (!formData.email.trim() || !emailRx.test(formData.email))
            errs.email = "Please enter a valid email address";
        if (!formData.password || formData.password.length < 8)
            errs.password = "Password must be at least 8 characters";
        else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password))
            errs.password = "Password must contain uppercase, lowercase, and number";
        if (formData.password !== formData.confirmPassword)
            errs.confirmPassword = "Passwords do not match";
        if (!formData.phone.trim() || !phoneRx.test(formData.phone.replace(/\s/g, "")))
            errs.phone = "Please enter a valid 10-digit phone number";
        if (!formData.address.trim()) errs.address = "Address is required";
        if (!formData.city.trim())    errs.city    = "City is required";
        if (!formData.state.trim())   errs.state   = "State is required";
        if (!formData.pincode.trim() || !pincodeRx.test(formData.pincode))
            errs.pincode = "Please enter a valid 6-digit pincode";
        if (!formData.planId)         errs.planId       = "Please select a plan";
        if (!formData.agreedToTerms)  errs.agreedToTerms = "You must agree to the Terms of Service";

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleChange = (e) => {
        const { name, value, type, checked, files } = e.target;
        if (type === "file") {
            if (files && files[0]) {
                setFormData(prev => ({ ...prev, [name]: files[0] }));
                if (errors[name]) setErrors(prev => ({ ...prev, [name]: "" }));
            }
        } else {
            setFormData(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
            if (errors[name]) setErrors(prev => ({ ...prev, [name]: "" }));
        }
    };

    // ── Step 1: Submit form → POST /register-init ──────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();

        const scrollToError = () => {
            setTimeout(() => {
                const firstErrorElement = document.querySelector(".auth-input--error");
                if (firstErrorElement) {
                    firstErrorElement.scrollIntoView({ behavior: "smooth", block: "center" });
                    firstErrorElement.focus({ preventScroll: true });
                }
            }, 100);
        };

        if (!validateForm()) {
            scrollToError();
            return;
        }

        setLoading(true);
        try {
            const res = await api.post("/auth/register-init", {
                name:     formData.instituteName.trim(),
                email:    formData.email.trim().toLowerCase(),
                phone:    formData.phone.replace(/\s/g, ""),
                password: formData.password,
                plan_id:  formData.planId,
                testMode: otpTestMode  // Pass the selected mode to backend
            });
            if (res.data.success) {
                // Keep the mode we explicitly sent unless server overrides it
                const serverTestMode = res.data.testMode !== undefined ? res.data.testMode : otpTestMode;
                setOtpTestMode(serverTestMode);

                setShowOtpScreen(true);
                setResendCount(0);
                setOtpDigits(["", "", "", "", "", ""]);
                setOtpError("");
                startTimer();

                if (serverTestMode && res.data.testOtp) {
                    // Auto-fill OTP in test mode
                    setTestOtp(res.data.testOtp);
                    setOtpDigits(res.data.testOtp.split(""));
                } else {
                    setTestOtp("");
                }
                setTimeout(() => otpRefs.current[0]?.focus(), 100);
            }
        } catch (err) {
            const msg = err.response?.data?.message || "";
            if (msg.toLowerCase().includes("already registered")) {
                setErrors({ email: "This email is already registered. Please login." });
                scrollToError();
            } else if (err.response?.status === 429) {
                alert("Too many OTP requests. Please wait 15 minutes before trying again.");
            } else {
                alert(msg || "Failed to send OTP. Please check your details and try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    // ── OTP digit handlers ────────────────────────────────────────────────
    const handleOtpDigit = (idx, val) => {
        const digit = val.replace(/\D/g, "").slice(-1);
        const next  = [...otpDigits];
        next[idx] = digit;
        setOtpDigits(next);
        setOtpError("");
        if (digit && idx < 5) otpRefs.current[idx + 1]?.focus();
    };

    const handleOtpKeyDown = (idx, e) => {
        if (e.key === "Backspace" && !otpDigits[idx] && idx > 0)
            otpRefs.current[idx - 1]?.focus();
        if (e.key === "ArrowLeft"  && idx > 0) otpRefs.current[idx - 1]?.focus();
        if (e.key === "ArrowRight" && idx < 5) otpRefs.current[idx + 1]?.focus();
    };

    const handleOtpPaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        if (pasted.length === 6) {
            setOtpDigits(pasted.split(""));
            otpRefs.current[5]?.focus();
        }
    };

    // ── Step 2: Verify OTP → POST /verify-registration ────────────────────
    const handleOtpSubmit = async (e) => {
        e?.preventDefault();
        const otp = otpDigits.join("");
        if (otp.length !== 6) { setOtpError("Please enter all 6 digits."); return; }
        setOtpLoading(true);
        setOtpError("");
        try {
            const submitData = new FormData();
            submitData.append("name", formData.instituteName.trim());
            submitData.append("email", formData.email.trim().toLowerCase());
            submitData.append("otp", otp);
            submitData.append("password", formData.password);
            submitData.append("phone", formData.phone.replace(/\s/g, ""));
            submitData.append("address", formData.address.trim());
            submitData.append("city", formData.city.trim());
            submitData.append("state", formData.state.trim());
            submitData.append("pincode", formData.pincode.trim());
            submitData.append("plan_id", formData.planId);
            
            if (formData.logo) {
                submitData.append("logo", formData.logo);
            }

            const res = await api.post("/auth/verify-registration", submitData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            if (res.data.success) {
                setTimerActive(false);
                const selectedPlan = plans.find(p => p.id === parseInt(formData.planId));
                if (res.data.token) {
                    sessionStorage.setItem("token", res.data.token);
                    sessionStorage.setItem("user", JSON.stringify(res.data.user));
                    localStorage.removeItem("token");
                    localStorage.removeItem("user");
                    setUser(res.data.user);
                }
                if (selectedPlan && selectedPlan.price > 0 && !selectedPlan.is_free_trial) {
                    alert("Registration successful! Redirecting to payment...");
                    navigate("/checkout");
                } else {
                    sessionStorage.removeItem("token");
                    sessionStorage.removeItem("user");
                    const msg = selectedPlan?.is_free_trial
                        ? "Registration successful! Your free trial is active. Please login."
                        : "Registration successful! Please login to continue.";
                    alert(msg);
                    navigate("/login");
                }
            }
        } catch (err) {
            setOtpError(err.response?.data?.message || "Invalid OTP. Please try again.");
        } finally {
            setOtpLoading(false);
        }
    };

    // ── Resend OTP ────────────────────────────────────────────────────────
    const handleResend = async () => {
        if (resendCount >= resendMax) return;
        setResendLoading(true);
        setOtpError("");
        try {
            const res = await api.post("/auth/resend-otp", {
                email: formData.email.trim().toLowerCase(),
                type:  "registration",
                testMode: otpTestMode
            });
            if (res.data.success) {
                setResendCount(res.data.resendCount ?? resendCount + 1);
                startTimer();
                setOtpDigits(["", "", "", "", "", ""]);

                if (res.data.testMode && res.data.testOtp) {
                    // Test mode: auto-fill new OTP
                    setTestOtp(res.data.testOtp);
                    setOtpDigits(res.data.testOtp.split(""));
                    // No alert needed — OTP is visible right there in the boxes
                } else {
                    setTestOtp("");
                    alert("A new OTP has been sent to your email.");
                }
                setTimeout(() => otpRefs.current[0]?.focus(), 100);
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to resend OTP.";
            setOtpError(msg);
            if (err.response?.status === 429) setResendCount(resendMax);
        } finally {
            setResendLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────
    return (
        <div className="auth-page">
            <div className="auth-orb auth-orb--1" />
            <div className="auth-orb auth-orb--2" />
            <div className="auth-orb auth-orb--3" />
            <div className="auth-theme-controls"><ThemeSelector loginMode /></div>

            {/* ── Live Test Mode Banner (top of page, visible always when test mode active) ── */}
            {otpTestMode && modeChecked && (
                <div className="otp-test-banner">
                    <div className="otp-test-banner__inner">
                        <span className="otp-test-banner__icon">🧪</span>
                        <div>
                            <strong>Test Mode Active</strong>
                            <span> — OTP is auto-filled instantly. No real emails are sent.</span>
                        </div>
                        <span className="otp-test-banner__badge">TEST</span>
                    </div>
                </div>
            )}

            {showOtpScreen ? (
                /* ── OTP Verification Screen ── */
                <div className="auth-container" style={{ maxWidth: "480px" }}>
                    <div className="auth-card">
                        <div className="auth-header">
                            <div className="auth-logo">
                                {otpTestMode ? "🧪" : "✉️"}
                            </div>
                            <h1 className="auth-title">
                                {otpTestMode ? "Test Mode — Instant OTP" : "Verify Your Email"}
                            </h1>
                            <p className="auth-subtitle">
                                {otpTestMode
                                    ? <>OTP is <strong>auto-filled</strong> below. Just click Verify.</>
                                    : <>We sent a 6-digit code to <strong>{formData.email}</strong></>
                                }
                            </p>
                            {!otpTestMode && (
                                <p style={{ color: "var(--text-muted,#6B7280)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
                                    Check your inbox and spam folder
                                </p>
                            )}
                        </div>

                        {/* Test Mode OTP preview card */}
                        {otpTestMode && testOtp && (
                            <div className="otp-test-card">
                                <div className="otp-test-card__label">🔑 Generated OTP</div>
                                <div className="otp-test-card__code">{testOtp}</div>
                                <div className="otp-test-card__note">Auto-filled in boxes below</div>
                            </div>
                        )}

                        <form onSubmit={handleOtpSubmit}>
                            {/* 6-box OTP input */}
                            <div style={{ display: "flex", gap: "10px", justifyContent: "center", margin: "1.5rem 0" }}>
                                {otpDigits.map((d, i) => (
                                    <input
                                        key={i}
                                        ref={el => otpRefs.current[i] = el}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={d}
                                        onChange={e => handleOtpDigit(i, e.target.value)}
                                        onKeyDown={e => handleOtpKeyDown(i, e)}
                                        onPaste={i === 0 ? handleOtpPaste : undefined}
                                        style={{
                                            width: "52px", height: "60px", textAlign: "center",
                                            fontSize: "1.6rem", fontWeight: "700",
                                            border: `2px solid ${d
                                                ? otpTestMode
                                                    ? "rgba(16, 185, 129, 0.8)"          // green in test mode
                                                    : "var(--pro-accent,#818cf8)"         // purple in real mode
                                                : "var(--pro-glass-border,rgba(255,255,255,0.15))"}`,
                                            borderRadius: "10px",
                                            background: d && otpTestMode
                                                ? "rgba(16, 185, 129, 0.08)"
                                                : "var(--pro-glass-bg,rgba(255,255,255,0.05))",
                                            color: "var(--text-primary,#1f2937)",
                                            outline: "none", transition: "border-color 0.2s, background 0.2s", cursor: "text"
                                        }}
                                    />
                                ))}
                            </div>

                            {otpError && (
                                <div className="auth-alert" style={{ marginBottom: "1rem" }}>
                                    <span className="auth-alert__icon">⚠️</span>
                                    <span>{otpError}</span>
                                </div>
                            )}

                            {/* Timer — hidden in test mode (no expiry concern is shown) */}
                            {!otpTestMode && (
                                <div style={{ textAlign: "center", marginBottom: "1.25rem", fontSize: "0.9rem", color: timer <= 60 ? "#EF4444" : "var(--text-muted,#6B7280)" }}>
                                    {timer > 0
                                        ? <>⏱ Code expires in <strong>{formatTime(timer)}</strong></>
                                        : <span style={{ color: "#EF4444" }}>⚠️ OTP expired — please resend</span>
                                    }
                                </div>
                            )}

                            <button
                                type="submit"
                                className={`auth-submit${otpLoading ? " auth-submit--loading" : ""}${otpTestMode ? " auth-submit--test" : ""}`}
                                disabled={otpLoading || otpDigits.join("").length !== 6}
                            >
                                {otpLoading
                                    ? <><span className="auth-spinner" /> Verifying...</>
                                    : otpTestMode
                                        ? <>🧪 Verify & Create Account (Test Mode)</>
                                        : <>✅ Verify &amp; Create Account</>
                                }
                            </button>

                            <div style={{ marginTop: "1rem", textAlign: "center" }}>
                                {resendCount < resendMax ? (
                                    <button
                                        type="button"
                                        onClick={handleResend}
                                        disabled={resendLoading || otpLoading || (!otpTestMode && timer > 540)}
                                        style={{
                                            background: "none", border: "none",
                                            color: otpTestMode ? "rgba(16,185,129,0.9)" : "var(--pro-accent,#818cf8)",
                                            cursor: (resendLoading || (!otpTestMode && timer > 540)) ? "not-allowed" : "pointer",
                                            textDecoration: "underline", fontSize: "0.9rem", padding: "0.5rem",
                                            opacity: (resendLoading || (!otpTestMode && timer > 540)) ? 0.5 : 1
                                        }}
                                    >
                                        {resendLoading
                                            ? "Generating..."
                                            : otpTestMode
                                                ? `↻ Generate New OTP (${resendMax - resendCount} left)`
                                                : `Resend OTP (${resendMax - resendCount} left)`
                                        }
                                    </button>
                                ) : (
                                    <p style={{ color: "#EF4444", fontSize: "0.85rem" }}>
                                        Resend limit reached. Please{" "}
                                        <button type="button" onClick={() => { setShowOtpScreen(false); setTestOtp(""); }}
                                            style={{ background: "none", border: "none", color: "inherit", textDecoration: "underline", cursor: "pointer", padding: 0 }}>
                                            go back
                                        </button>{" "}and try again.
                                    </p>
                                )}
                                <p style={{ fontSize: "0.8rem", color: "var(--text-muted,#6B7280)", marginTop: "0.5rem" }}>
                                    Used {resendCount}/{resendMax} resends
                                </p>
                            </div>

                            <div style={{ textAlign: "center", marginTop: "1rem" }}>
                                <button type="button"
                                    onClick={() => { setShowOtpScreen(false); setTestOtp(""); setTimerActive(false); }}
                                    style={{ background: "none", border: "none", color: "var(--text-muted,#6B7280)", cursor: "pointer", fontSize: "0.85rem", textDecoration: "underline" }}>
                                    ← Back to registration form
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : (
                /* ── Registration Form ── */
                <div className="auth-container" style={{ maxWidth: "560px" }}>
                    <div className="auth-card reg-card">
                        <div className="auth-header">
                            <div className="auth-logo"><img src={zfLogo} alt="ZenithFlows" style={{ height: '56px', width: '56px', objectFit: 'contain' }} /></div>
                            <h1 className="auth-title">Register Your Institute</h1>
                            <p className="auth-subtitle">Join thousands of institutes. Start free, scale as you grow.</p>

                            {/* Slide Button Toggle */}
                            {modeChecked && (
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "12px",
                                    marginTop: "1.5rem",
                                    background: "var(--pro-glass-bg, rgba(255, 255, 255, 0.05))",
                                    border: "1px solid var(--pro-glass-border, rgba(255, 255, 255, 0.1))",
                                    padding: "12px 20px",
                                    borderRadius: "12px",
                                    maxWidth: "300px",
                                    margin: "1.5rem auto 0 auto"
                                }}>
                                    <span style={{ 
                                        fontSize: "0.85rem", 
                                        fontWeight: !otpTestMode ? "700" : "500",
                                        color: !otpTestMode ? "var(--pro-accent, #818cf8)" : "var(--text-muted, #6b7280)",
                                        transition: "all 0.3s ease"
                                    }}>
                                        Real Mode
                                    </span>
                                    
                                    <button
                                        type="button"
                                        onClick={toggleMode}
                                        style={{
                                            position: "relative",
                                            width: "60px",
                                            height: "32px",
                                            borderRadius: "30px",
                                            background: otpTestMode ? "linear-gradient(135deg, #059669, #10b981)" : "var(--pro-border)",
                                            border: "none",
                                            cursor: "pointer",
                                            transition: "background 0.3s ease",
                                            padding: 0,
                                            boxShadow: otpTestMode ? "0 0 10px rgba(16, 185, 129, 0.3)" : "none"
                                        }}
                                    >
                                        <div style={{
                                            position: "absolute",
                                            top: "3px",
                                            left: otpTestMode ? "calc(100% - 29px)" : "3px",
                                            width: "26px",
                                            height: "26px",
                                            borderRadius: "50%",
                                            background: "#fff",
                                            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                                            transition: "left 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: "12px"
                                        }}>
                                            {otpTestMode ? "🧪" : "📧"}
                                        </div>
                                    </button>

                                    <span style={{ 
                                        fontSize: "0.85rem", 
                                        fontWeight: otpTestMode ? "700" : "500",
                                        color: otpTestMode ? "#10b981" : "var(--text-muted, #6b7280)",
                                        transition: "all 0.3s ease"
                                    }}>
                                        Test Mode
                                    </span>
                                </div>
                            )}
                        </div>

                        <form onSubmit={handleSubmit} className="auth-form reg-form" noValidate>

                            <div className="reg-section">
                                <h3 className="reg-section-title">🏫 Institute Information</h3>
                                <div className="auth-field">
                                    <label className="auth-label"><span className="auth-label__icon">🏷️</span> Institute Name *</label>
                                    <input type="text" name="instituteName" className={`auth-input${errors.instituteName ? " auth-input--error" : ""}`}
                                        placeholder="e.g. Sunrise Academy" value={formData.instituteName} onChange={handleChange} />
                                    {errors.instituteName && <span className="reg-error">{errors.instituteName}</span>}
                                </div>
                                <div className="reg-row">
                                    <div className="auth-field">
                                        <label className="auth-label"><span className="auth-label__icon">✉️</span> Email *</label>
                                        <input type="email" name="email" className={`auth-input${errors.email ? " auth-input--error" : ""}`}
                                            placeholder="institute@example.com" value={formData.email} onChange={handleChange} />
                                        {errors.email && <span className="reg-error">{errors.email}</span>}
                                    </div>
                                    <div className="auth-field">
                                        <label className="auth-label"><span className="auth-label__icon">📱</span> Phone *</label>
                                        <input type="tel" name="phone" className={`auth-input${errors.phone ? " auth-input--error" : ""}`}
                                            placeholder="9876543210" value={formData.phone} onChange={handleChange} />
                                        {errors.phone && <span className="reg-error">{errors.phone}</span>}
                                    </div>
                                </div>
                                <div className="auth-field">
                                    <label className="auth-label"><span className="auth-label__icon">📍</span> Address *</label>
                                    <input type="text" name="address" className={`auth-input${errors.address ? " auth-input--error" : ""}`}
                                        placeholder="Street / Area / Locality" value={formData.address} onChange={handleChange} />
                                    {errors.address && <span className="reg-error">{errors.address}</span>}
                                </div>
                                <div className="reg-row reg-row--3">
                                    <div className="auth-field">
                                        <label className="auth-label">🏙️ City *</label>
                                        <input type="text" name="city" className={`auth-input${errors.city ? " auth-input--error" : ""}`}
                                            placeholder="City" value={formData.city} onChange={handleChange} />
                                        {errors.city && <span className="reg-error">{errors.city}</span>}
                                    </div>
                                    <div className="auth-field">
                                        <label className="auth-label">🗺️ State *</label>
                                        <input type="text" name="state" className={`auth-input${errors.state ? " auth-input--error" : ""}`}
                                            placeholder="State" value={formData.state} onChange={handleChange} />
                                        {errors.state && <span className="reg-error">{errors.state}</span>}
                                    </div>
                                    <div className="auth-field">
                                        <label className="auth-label">📮 ZIP Code *</label>
                                        <input type="text" name="pincode" className={`auth-input${errors.pincode ? " auth-input--error" : ""}`}
                                            placeholder="123456" value={formData.pincode} onChange={handleChange} maxLength="6" />
                                        {errors.pincode && <span className="reg-error">{errors.pincode}</span>}
                                    </div>
                                </div>
                                <div className="auth-field" style={{ marginTop: "1rem" }}>
                                    <label className="auth-label" style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
                                        <span className="auth-label__icon">🖼️</span> 
                                        <span>Institute Logo (Optional)</span>
                                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted, #6b7280)", marginLeft: "8px", fontWeight: "normal" }}>
                                            (Accepted: PNG, JPG, JPEG)
                                        </span>
                                    </label>
                                    <input 
                                        type="file" 
                                        name="logo" 
                                        accept="image/png, image/jpeg, image/jpg" 
                                        className="auth-input" 
                                        onChange={handleChange} 
                                        style={{ padding: "0.5rem" }}
                                    />
                                </div>
                            </div>

                            <div className="reg-section">
                                <h3 className="reg-section-title">🔐 Security</h3>
                                <div className="reg-row">
                                    <div className="auth-field">
                                        <label className="auth-label"><span className="auth-label__icon">🔒</span> Password *</label>
                                        <div style={{ position: 'relative' }}>
                                            <input type={showPassword ? "text" : "password"} name="password" 
                                                className={`auth-input${errors.password ? " auth-input--error" : ""}`}
                                                style={{ 
                                                    paddingRight: '40px',
                                                    borderColor: formData.password && formData.confirmPassword 
                                                        ? (formData.password === formData.confirmPassword ? "#10b981" : "#ef4444") 
                                                        : undefined
                                                }}
                                                placeholder="Min 8 chars, A-Z, 0-9" value={formData.password} onChange={handleChange} />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                                                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                                <EyeIcon visible={showPassword} />
                                            </button>
                                        </div>
                                        {errors.password && <span className="reg-error">{errors.password}</span>}
                                    </div>
                                    <div className="auth-field">
                                        <label className="auth-label"><span className="auth-label__icon">✅</span> Confirm Password *</label>
                                        <div style={{ position: 'relative' }}>
                                            <input type={showConfirmPassword ? "text" : "password"} name="confirmPassword" 
                                                className={`auth-input${errors.confirmPassword ? " auth-input--error" : ""}`}
                                                style={{ 
                                                    paddingRight: '40px',
                                                    borderColor: formData.password && formData.confirmPassword 
                                                        ? (formData.password === formData.confirmPassword ? "#10b981" : "#ef4444") 
                                                        : undefined
                                                }}
                                                placeholder="Repeat password" value={formData.confirmPassword} onChange={handleChange} />
                                            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                                <EyeIcon visible={showConfirmPassword} />
                                            </button>
                                        </div>
                                        {errors.confirmPassword && <span className="reg-error">{errors.confirmPassword}</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="reg-section">
                                <h3 className="reg-section-title">📦 Choose Your Plan</h3>
                                <div className="auth-field">
                                    <label className="auth-label"><span className="auth-label__icon">🎯</span> Select Plan *</label>
                                    <select name="planId" className={`auth-input${errors.planId ? " auth-input--error" : ""}`}
                                        value={formData.planId} onChange={handleChange}>
                                        <option value="">-- Select a plan --</option>
                                        {plans.map(plan => (
                                            <option key={plan.id} value={plan.id}>
                                                {plan.name} — {plan.is_free_trial ? "₹0/month (Free Trial)" : plan.is_lifetime ? `₹${plan.lifetime_price || plan.price} (One-Time)` : `₹${plan.price}/month`}
                                                {plan.is_lifetime 
                                                    ? (plan.max_students_lifetime && plan.max_students_lifetime !== -1 ? ` · Up to ${plan.max_students_lifetime} students` : " · Unlimited")
                                                    : (plan.max_students && plan.max_students !== -1 ? ` · Up to ${plan.max_students} students` : " · Unlimited")
                                                }
                                            </option>
                                        ))}
                                    </select>
                                    {errors.planId && <span className="reg-error">{errors.planId}</span>}
                                    <div className="reg-plan-hint">
                                        <Link to="/pricing" target="_blank" className="auth-link">📋 View all plans &amp; features</Link>
                                    </div>
                                </div>
                            </div>

                            <div className="reg-terms">
                                <label className="reg-terms-label">
                                    <input type="checkbox" name="agreedToTerms" checked={formData.agreedToTerms} onChange={handleChange} />
                                    <span>
                                        I agree to the{" "}
                                        <Link to="/terms" target="_blank" className="auth-link">Terms of Service</Link>
                                        {" "}and{" "}
                                        <Link to="/privacy" target="_blank" className="auth-link">Privacy Policy</Link>
                                    </span>
                                </label>
                                {errors.agreedToTerms && <span className="reg-error">{errors.agreedToTerms}</span>}
                            </div>

                            <button type="submit"
                                className={`auth-submit${loading ? " auth-submit--loading" : ""}${otpTestMode ? " auth-submit--test" : ""}`}
                                disabled={loading} style={{ marginTop: "0.5rem" }}>
                                {loading
                                    ? <><span className="auth-spinner" />{otpTestMode ? " Generating OTP..." : " Sending OTP..."}</>
                                    : otpTestMode
                                        ? <><span>🧪</span> Create Account &amp; Continue (Test)</>
                                        : <><span>🚀</span> Create Account &amp; Continue</>
                                }
                            </button>
                        </form>

                        <div className="auth-footer">
                            <div className="auth-divider"><span>OR</span></div>
                            <p className="auth-footer__text">
                                Already have an account?{" "}
                                <Link to="/login" className="auth-link">Login here</Link>
                            </p>
                            <Link to="/" className="auth-back-home">← Back to Home</Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default RegisterPage;
