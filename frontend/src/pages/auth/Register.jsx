/**
 * Register Page
 * Institute registration form
 */

import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import api from "../../services/api";
import "./Auth.css";
import zfLogo from "../../assets/zf-logo.png";

function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get("plan");

  const [formData, setFormData] = useState({
    instituteName: "",
    email: "",
    phone: "",
    address: "",
    planId: planId || "",
    password: "",
    confirmPassword: "",
    logo: null,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showRedirect, setShowRedirect] = useState(false);

  useEffect(() => {
    if (!planId) {
      setShowRedirect(true);
      const timer = setTimeout(() => {
        navigate("/pricing");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [planId, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      const formPayload = new FormData();
      formPayload.append("instituteName", formData.instituteName);
      formPayload.append("email", formData.email);
      formPayload.append("phone", formData.phone);
      formPayload.append("address", formData.address);
      formPayload.append("password", formData.password);
      formPayload.append("planId", formData.planId || "");
      if (formData.logo) {
        formPayload.append("logo", formData.logo);
      }

      await api.post("/auth/register", formPayload, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (showRedirect) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="alert alert-error">
            <span>⛔</span>
            <div>
              <strong>No Plan Selected!</strong>
              <p>Please select a plan to register. Redirecting to Pricing...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="alert alert-success">
            <span>✅</span>
            <div>
              <strong>Registration Successful!</strong>
              <p>Redirecting to login...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title"><img src={zfLogo} alt="ZenithFlows" style={{ height: '65px', width: '65px', objectFit: 'contain', verticalAlign: 'middle', marginRight: '8px' }} />ZenithFlows</h1>
          <p className="auth-subtitle">Create your institute account</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="instituteName" className="form-label">
              Institute Name
            </label>
            <input
              type="text"
              id="instituteName"
              name="instituteName"
              className="form-input"
              placeholder="ABC Coaching Center"
              value={formData.instituteName}
              onChange={handleChange}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className="form-input"
              placeholder="admin@example.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone" className="form-label">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              className="form-input"
              placeholder="+91 9876543210"
              value={formData.phone}
              onChange={handleChange}
              required
              minLength={10}
            />
          </div>

          <div className="form-group">
            <label htmlFor="address" className="form-label">
              Address
            </label>
            <textarea
              id="address"
              name="address"
              className="form-input"
              placeholder="Institute Address"
              value={formData.address}
              onChange={handleChange}
              required
              rows="2"
            />
          </div>

          <div className="form-group">
            <label htmlFor="logo" className="form-label">
              Institute Logo (Optional)
            </label>
            <input
              type="file"
              id="logo"
              name="logo"
              accept="image/*"
              className="form-input"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setFormData({ ...formData, logo: e.target.files[0] });
                  setError("");
                }
              }}
              style={{ padding: "0.5rem" }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              className="form-input"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              className="form-input"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?{" "}
            <Link to="/login" className="font-semibold">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
