import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";
import "../admin/PublicPage.css"; // Reuse styling logic

export default function LandingPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview"); // overview | edit | enquiries
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [dashboardStats, setDashboardStats] = useState(null);

  const [enquiries, setEnquiries] = useState([]);

  useEffect(() => {
    fetchDashboardData();
    if (tab === "enquiries") {
      fetchEnquiries();
    }
  }, [tab]);

  const fetchDashboardData = async () => {
    try {
      const res = await api.get("/superadmin/dashboard");
      setDashboardStats(res.data);
    } catch (error) {
      console.error("Failed to fetch dashboard stats", error);
    }
  };

  const fetchEnquiries = async () => {
    try {
      setLoading(true);
      const res = await api.get("/leads");
      if (res.data.success) {
        setEnquiries(res.data.leads);
      }
    } catch (error) {
      console.error("Failed to fetch enquiries", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSource = () => {
    setActionMsg("This section is managed directly in the source code. Please edit the respective components in frontend/src/components/landing to modify.");
    setTimeout(() => setActionMsg(""), 5000);
  };

  const BASE_URL = window.location.origin;

  const copyURL = () => {
    navigator.clipboard.writeText(BASE_URL);
    setActionMsg("Landing Page URL copied to clipboard!");
    setTimeout(() => setActionMsg(""), 3000);
  };

  return (
    <div className="pub-page-container">
      {/* Header */}
      <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🌐</span> ZenithFlows Landing Page
          </h1>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>
            Manage your global public-facing marketing page
          </p>
        </div>
        <button className="animated-btn secondary" onClick={() => navigate("/superadmin/dashboard")}>
          <span className="icon icon-back">←</span> Back to Dashboard
        </button>
      </div>

      {/* Status Banner */}
      <div className="pub-status-banner">
        <div className="banner-left">
          <div style={{ display: "flex", alignItems: "center", gap: ".75rem", marginBottom: ".25rem" }}>
            <h2>Page is Live</h2>
            <span className="live-badge">LIVE</span>
          </div>
          <p>🔗 {BASE_URL}</p>
        </div>
        <div className="banner-actions">
          <a href="/" target="_blank" rel="noreferrer" className="btn btn-outline" style={{ color: "#fff", borderColor: "rgba(255,255,255,.4)", textDecoration: 'none' }}>
            👁 View Live
          </a>
          <button className="btn btn-outline" style={{ color: "#fff", borderColor: "rgba(255,255,255,.4)" }} onClick={copyURL}>
            📋 Copy URL
          </button>
        </div>
      </div>

      {actionMsg && (
        <div style={{ padding: ".75rem 1rem", borderRadius: "10px", background: "rgba(16,185,129,.12)", marginBottom: "1rem", fontWeight: 600, color: "#059669" }}>
          {actionMsg}
        </div>
      )}

      {/* Tab Row */}
      <div className="pub-tab-row">
        <button className={`pub-tab-btn ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>📊 Overview</button>
        <button className={`pub-tab-btn ${tab === "edit" ? "active" : ""}`} onClick={() => setTab("edit")}>✏️ Edit Sections</button>
        <button className={`pub-tab-btn ${tab === "enquiries" ? "active" : ""}`} onClick={() => setTab("enquiries")}>
          📥 Enquiries <span className="badge">{enquiries.length}</span>
        </button>
      </div>

      {/* ─── TAB: OVERVIEW ─── */}
      {tab === "overview" && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
            {(() => {
              const landingPageViews = dashboardStats?.totalLandingPageViews || 0;
              const landingPageRegs = dashboardStats?.totalInstitutes || 0;
              const landingPageConv = dashboardStats?.activeInstitutes || 0;
              const conversionRate = landingPageViews > 0 ? ((landingPageRegs / landingPageViews) * 100).toFixed(1) + "%" : "0%";

              return [
                { icon: "👁", label: "Page Views", value: landingPageViews.toLocaleString() },
                { icon: "📝", label: "Registrations", value: landingPageRegs },
                { icon: "💳", label: "Paid Conversions", value: landingPageConv },
                { icon: "📈", label: "Conversion Rate", value: conversionRate },
              ].map(s => (
                <div key={s.label} style={{ background: "var(--card-bg)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "1.25rem", textAlign: "center" }}>
                  <div style={{ fontSize: "1.75rem" }}>{s.icon}</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, margin: ".25rem 0" }}>{s.value}</div>
                  <div style={{ fontSize: ".8rem", color: "var(--text-secondary)" }}>{s.label}</div>
                </div>
              ));
            })()}
          </div>

          <div style={{ background: "var(--card-bg)", border: "1px solid var(--border-color)", borderRadius: "14px", padding: "1.5rem" }}>
            <h3 style={{ marginTop: 0 }}>SEO & Meta Details</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".75rem", fontSize: ".875rem" }}>
              {[
                { label: "Meta Title", value: "ZenithFlows - The Ultimate ERP" },
                { label: "Meta Description", value: "Automate your institute from admissions to alumni..." },
                { label: "Target Audience", value: "Schools, Colleges, Universities" },
                { label: "Index Status", value: "Indexed by Google" },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ color: "var(--text-secondary)", fontSize: ".75rem", fontWeight: 600, marginBottom: ".15rem" }}>{item.label.toUpperCase()}</div>
                  <div>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: EDIT PAGE ─── */}
      {tab === "edit" && (
        <div style={{ animation: "fadeIn 0.3s ease", display: "grid", gap: "1rem" }}>
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--border-color)", borderRadius: "14px", padding: "1.5rem" }}>
            <h3>Modify Landing Page Sections</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
              The landing page is dynamically driven. Use the settings below to modify the active sections.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1.5rem" }}>
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
                <div>
                  <h4 style={{ margin: "0 0 4px 0" }}>Pricing Plans Configuration</h4>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Manage the subscription plans shown on the landing page</div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => navigate("/superadmin/plans")}>Manage Plans</button>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
                <div>
                  <h4 style={{ margin: "0 0 4px 0" }}>Hero Section Content</h4>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Update H1 Title, Hero Subtitle, and CTAs (Development)</div>
                </div>
                <button className="btn btn-outline btn-sm" onClick={handleEditSource}>Edit Source</button>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
                <div>
                  <h4 style={{ margin: "0 0 4px 0" }}>Features Grid</h4>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Manage the 26 features listed on the site (Development)</div>
                </div>
                <button className="btn btn-outline btn-sm" onClick={handleEditSource}>Edit Source</button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: ENQUIRIES ─── */}
      {tab === "enquiries" && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--border-color)", borderRadius: "14px", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="enquiry-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)", background: "rgba(0,0,0,0.02)" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize:'13px' }}>Name / Email</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize:'13px' }}>Mobile</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize:'13px' }}>Institute & Size</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize:'13px' }}>Plan Interest</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize:'13px' }}>Message</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize:'13px' }}>Date</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize:'13px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {enquiries.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-secondary)" }}>
                        {loading ? "Loading enquiries..." : "No enquiries found."}
                      </td>
                    </tr>
                  ) : enquiries.map(e => (
                    <tr key={e.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 600 }}>{e.name}</div>
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{e.email || '-'}</div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>{e.mobile || '-'}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div>{e.institute}</div>
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{e.students} students</div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ display:'inline-block', padding:'4px 8px', background:'rgba(37,99,235,0.1)', color:'#2563EB', borderRadius:'4px', fontSize:'12px', fontWeight:'600'}}>{e.plan || 'Not selected'}</span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "12px", color: "var(--text-secondary)", maxWidth: "200px", wordWrap: "break-word" }}>
                        {e.message ? (
                          <div style={{ maxHeight: "60px", overflowY: "auto", paddingRight: "4px" }}>
                            {e.message}
                          </div>
                        ) : '-'}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "13px" }}>{new Date(e.date).toLocaleDateString("en-IN")}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span className={`status-badge ${e.status === 'new' ? 'status-new' : 'status-contacted'}`}>
                          {e.status ? e.status.toUpperCase() : 'NEW'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
