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
            <div className="auth-logo">
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
