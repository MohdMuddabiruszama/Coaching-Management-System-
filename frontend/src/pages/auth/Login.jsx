/**
 * Login Page — Premium Design
 * Phase 5: ThemeSelector with loginMode (light/dark only, always pro theme)
 */

import { useState, useEffect, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { ThemeContext } from "../../context/ThemeContext";
import { BrandingContext } from "../../context/BrandingContext";
import ThemeSelector from "../../components/ThemeSelector";
import { isMobileApp, MOBILE_ALLOWED_ROLE } from "../../config/appVariant";
import "./Auth.css";

function mobileAppLabel() {
  if (!isMobileApp || !MOBILE_ALLOWED_ROLE) return null;
  if (MOBILE_ALLOWED_ROLE === "student") return "Student app";
  if (MOBILE_ALLOWED_ROLE === "parent") return "Parent app";
  return "Faculty app";
}

function Login() {
  const navigate = useNavigate();
  const { login, logout } = useContext(AuthContext);
  const { setTheme, isDark } = useContext(ThemeContext);
  const branding = useContext(BrandingContext);

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPass, setShowPass] = useState(false);

  // Hidden dev menu state
  const [logoClicks, setLogoClicks] = useState(0);
  const [showEnvSwitcher, setShowEnvSwitcher] = useState(false);
  const [customApiUrl, setCustomApiUrl] = useState(localStorage.getItem('API_BASE_URL_OVERRIDE') || "");

  const handleLogoClick = () => {
    setLogoClicks((prev) => {
      const newCount = prev + 1;
      if (newCount >= 5) {
        setShowEnvSwitcher(true);
        return 0;
      }
      // Reset clicks after 2 seconds
      setTimeout(() => setLogoClicks(0), 2000);
      return newCount;
    });
  };

  const handleSaveEnv = (envType) => {
    if (envType === 'live') {
      localStorage.removeItem('API_BASE_URL_OVERRIDE');
    } else if (envType === 'local-android') {
      localStorage.setItem('API_BASE_URL_OVERRIDE', 'http://10.0.2.2:5000/api');
    } else if (envType === 'custom') {
      localStorage.setItem('API_BASE_URL_OVERRIDE', customApiUrl);
    }
    setShowEnvSwitcher(false);
    window.location.reload();
  };


  // Redirect if already logged in
  useEffect(() => {
    const raw = sessionStorage.getItem("user");
    if (!raw) return;
    let userObj;
    try {
      userObj = JSON.parse(raw);
    } catch {
      return;
    }
    if (isMobileApp) {
      if (MOBILE_ALLOWED_ROLE && userObj.role !== MOBILE_ALLOWED_ROLE) {
        logout();
        return;
      }
      if (!MOBILE_ALLOWED_ROLE && !["student", "parent", "faculty"].includes(userObj.role)) {
        logout();
        return;
      }
    }
    if (userObj) {
      if (userObj.institute_status === "pending" && userObj.role === "admin") {
        navigate("/checkout");
        return;
      }
      switch (userObj.role) {
        case "super_admin": navigate("/superadmin/dashboard"); break;
        case "admin": navigate("/admin/dashboard"); break;
        case "faculty": navigate("/faculty/dashboard"); break;
        case "student": navigate("/student/dashboard"); break;
        case "manager": navigate("/admin/dashboard"); break;
        case "parent": navigate("/parent/dashboard"); break;
        default: navigate("/");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- logout is stable enough; avoid re-running on every auth tick
  }, [navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errors[e.target.name] || errors.general) {
      setErrors({});
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Local Validation Check to prevent unnecessary network requests
    let localErrors = {};
    if (!formData.email.trim()) localErrors.email = "Please enter your email";
    if (!formData.password) localErrors.password = "Please enter your password";

    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      setTimeout(() => {
        const firstErrorElement = document.querySelector(".auth-input--error");
        if (firstErrorElement) {
          firstErrorElement.scrollIntoView({ behavior: "smooth", block: "center" });
          firstErrorElement.focus({ preventScroll: true });
        }
      }, 50);
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      await login({ ...formData, source: isMobileApp ? 'mobile' : 'web' });
      const user = JSON.parse(sessionStorage.getItem("user"));
      if (isMobileApp) {
        if (MOBILE_ALLOWED_ROLE && user.role !== MOBILE_ALLOWED_ROLE) {
          logout();
          setErrors({ general: `This app is for ${MOBILE_ALLOWED_ROLE === "faculty" ? "faculty" : MOBILE_ALLOWED_ROLE} accounts only.` });
          return;
        }
        if (!MOBILE_ALLOWED_ROLE && !["student", "parent", "faculty"].includes(user.role)) {
          logout();
          setErrors({ general: "Admin and Manager dashboards are not available on the mobile application." });
          return;
        }
      }
      if (user.institute_status === "pending" && user.role === "admin") {
        navigate("/checkout");
        return;
      }
      switch (user.role) {
        case "super_admin": navigate("/superadmin/dashboard"); break;
        case "admin": navigate("/admin/dashboard"); break;
        case "faculty": navigate("/faculty/dashboard"); break;
        case "student": navigate("/student/dashboard"); break;
        case "manager": navigate("/admin/dashboard"); break;
        case "parent": navigate("/parent/dashboard"); break;
        default: navigate("/");
      }
    } catch (err) {
      const scrollToErr = () => {
        setTimeout(() => {
          const firstErrorElement = document.querySelector(".auth-input--error, .auth-alert");
          if (firstErrorElement) {
            firstErrorElement.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 50);
      };

      // Handle network errors (server down / unreachable)
      if (!err.response) {
        setErrors({ general: "Cannot connect to server. Please check your internet connection or try again later." });
        scrollToErr();
        setLoading(false);
        return;
      }

      const msg = err.response?.data?.message || "Login failed. Please check your credentials.";

      if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("email")) {
        setErrors({ email: "Email not registered. Please check again." });
        scrollToErr();
      } else if (msg.toLowerCase().includes("incorrect password") || msg.toLowerCase().includes("credentials")) {
        setErrors({ password: "Incorrect password. Please try again." });
        scrollToErr();
      } else {
        setErrors({ general: msg });
        scrollToErr();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Developer Environment Switcher (Hidden feature) */}
      {showEnvSwitcher && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem'
        }}>
          <div style={{
            background: isDark ? '#1e293b' : '#fff', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '400px',
            color: isDark ? '#fff' : '#0f172a', boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
          }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>🔧 Developer Options</h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', opacity: 0.8 }}>
              Override the API endpoint for testing. The app will reload upon saving.
            </p>
            
            <button onClick={() => handleSaveEnv('live')} style={{ width: '100%', padding: '10px', marginBottom: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
              🌍 Live Production Server
            </button>
            <button onClick={() => handleSaveEnv('local-android')} style={{ width: '100%', padding: '10px', marginBottom: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
              📱 Android Emulator (10.0.2.2)
            </button>
            
            <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(128,128,128,0.2)', paddingTop: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Custom API URL (e.g., LAN IP)</label>
              <input 
                type="text" 
                value={customApiUrl} 
                onChange={e => setCustomApiUrl(e.target.value)} 
                placeholder="http://192.168.x.x:5000/api"
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '10px', background: isDark ? '#334155' : '#fff', color: isDark ? '#fff' : '#000' }}
              />
              <button onClick={() => handleSaveEnv('custom')} style={{ width: '100%', padding: '10px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
                Save Custom URL
              </button>
            </div>
            
            <button onClick={() => setShowEnvSwitcher(false)} style={{ width: '100%', padding: '10px', marginTop: '1rem', background: 'transparent', color: isDark ? '#94a3b8' : '#64748b', border: '1px solid rgba(128,128,128,0.3)', borderRadius: '8px' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Animated background orbs */}
      <div className="auth-orb auth-orb--1" />
      <div className="auth-orb auth-orb--2" />
      <div className="auth-orb auth-orb--3" />

      {/* Top-right theme controls — hidden on mobile for cleaner UI */}
      {!isMobileApp && (
        <div className="auth-theme-controls">
          <ThemeSelector loginMode />
        </div>
      )}

      <div className="auth-container">
        <div className="auth-card">
          {/* Logo / Brand */}
          <div className="auth-header">
            <div className="auth-logo" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
                <img 
                    src={branding.logo} 
                    alt={branding.name} 
                    className="auth-logo-img"
                />
            </div>
            <h1 
              className="auth-title" 
              style={isMobileApp && branding.color ? { 
                  background: `linear-gradient(135deg, ${branding.color}, #a78bfa)`, 
                  WebkitBackgroundClip: 'text', 
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
              } : {}}
            >
              {branding.name}
            </h1>
            <p className="auth-subtitle">
              {mobileAppLabel() ? `${mobileAppLabel()} — ` : ""}
              Sign in to your account
            </p>
          </div>

          {/* General Error Alert */}
          {errors.general && (
            <div className="auth-alert">
              <span className="auth-alert__icon">⚠️</span>
              <span>{errors.general}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label htmlFor="email" className="auth-label">
                <span className="auth-label__icon">✉️</span>
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                className={`auth-input${errors.email ? " auth-input--error" : ""}`}
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                autoFocus
              />
              {errors.email && <span className="auth-field-error" style={{ color: "#EF4444", fontSize: "0.85rem", marginTop: "4px", display: "block" }}>{errors.email}</span>}
            </div>

            <div className="auth-field">
              <label htmlFor="password" className="auth-label">
                <span className="auth-label__icon">🔒</span>
                Password
              </label>
              <div className="auth-input-wrap">
                <input
                  type={showPass ? "text" : "password"}
                  id="password"
                  name="password"
                  className={`auth-input${errors.password ? " auth-input--error" : ""}`}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPass(p => !p)}
                  tabIndex={-1}
                >
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
              {errors.password && <span className="auth-field-error" style={{ color: "#EF4444", fontSize: "0.85rem", marginTop: "4px", display: "block" }}>{errors.password}</span>}
            </div>

            <div className="auth-row">
              <label className="auth-checkbox">
                <input type="checkbox" />
                <span>Remember me</span>
              </label>
              <Link to="/forgot-password" className="auth-forgot">Forgot password?</Link>
            </div>

            <button
              type="submit"
              className={`auth-submit${loading ? " auth-submit--loading" : ""}`}
              disabled={loading}
            >
              {loading ? (
                <><span className="auth-spinner" /> Signing in...</>
              ) : (
                <><span>🚀</span> Sign In</>
              )}
            </button>
          </form>

          {/* Footer — web only for institute registration / marketing home */}
          {!isMobileApp && (
            <div className="auth-footer">
              <div className="auth-divider"><span>OR</span></div>
              <p className="auth-footer__text">
                Don&apos;t have an account?{" "}
                <Link to="/register" className="auth-link">Register your institute</Link>
              </p>
              <Link to="/" className="auth-back-home">← Back to Home</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
