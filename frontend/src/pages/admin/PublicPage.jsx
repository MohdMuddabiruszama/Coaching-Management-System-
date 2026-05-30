/**
 * Admin Public Page — Main Dashboard
 * Manages the institute's public web page
 * Shows: gate card / status card / wizard / enquiry inbox
 */
import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import PublicPageWizard from "./PublicPageWizard";
import "./PublicPage.css";

const STATUS_LABELS = { new: "New", contacted: "Contacted", enrolled: "Enrolled", closed: "Closed" };
const STATUS_CLASS = { new: "status-new", contacted: "status-contacted", enrolled: "status-enrolled", closed: "status-closed" };

export default function PublicPage() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [hasFeature, setHasFeature] = useState(null); // null=loading
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("overview"); // overview | wizard | enquiries
  const [enquiries, setEnquiries] = useState([]);
  const [enquiryFilter, setEnquiryFilter] = useState("all");
  const [enquiryPage, setEnquiryPage] = useState(1);
  const [enquiryTotal, setEnquiryTotal] = useState(0);
  const [enquiryPages, setEnquiryPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState("");
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);

  const BASE_URL = window.location.origin;

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [featRes, pageRes] = await Promise.all([
        api.get("/admin/public-page/check-feature"),
        api.get("/admin/public-page").catch(() => ({ data: { data: null } }))
      ]);
      setHasFeature(featRes.data.has_feature);
      setProfile(pageRes.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchEnquiries = async () => {
    try {
      const params = { page: enquiryPage, limit: 15 };
      if (enquiryFilter !== "all") params.status = enquiryFilter;
      const r = await api.get("/admin/enquiries", { params });
      setEnquiries(r.data.data || []);
      setEnquiryTotal(r.data.total || 0);
      setEnquiryPages(r.data.pages || 1);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (tab === "enquiries") fetchEnquiries();
  }, [tab, enquiryFilter, enquiryPage]);

  const handleUnpublish = async () => {
    if (!window.confirm("Unpublish your page? It will be hidden from the public.")) return;
    try {
      await api.post("/admin/public-page/unpublish");
      setActionMsg("Page unpublished.");
      fetchAll();
    } catch (e) { alert(e.response?.data?.message || "Failed"); }
  };

  const handlePublish = async () => {
    try {
      await api.post("/admin/public-page/publish");
      setActionMsg("🎉 Page is now LIVE!");
      fetchAll();
    } catch (e) { alert(e.response?.data?.message || "Failed"); }
  };

  const copyURL = () => {
    const url = `${BASE_URL}/i/${profile?.slug}`;
    navigator.clipboard.writeText(url);
    setActionMsg("URL copied to clipboard!");
    setTimeout(() => setActionMsg(""), 3000);
  };

  const updateEnquiryStatus = async (id, status) => {
    try {
      await api.put(`/admin/enquiries/${id}/status`, { status });
      setEnquiries(prev => prev.map(e => e.id === id ? { ...e, status } : e));
      if (selectedEnquiry?.id === id) setSelectedEnquiry(p => ({ ...p, status }));
    } catch (e) { alert("Update failed"); }
  };

  const handleOpenEnquiries = async () => {
    setTab("enquiries");
    if (profile && profile.new_enquiry_count > 0) {
      setProfile({ ...profile, new_enquiry_count: 0 });
      try {
        await api.post("/admin/clear-unread-enquiries");
      } catch (e) { console.error("Failed to clear enquiry count", e); }
    }
  };

  // ── Loading ──
  if (loading) return (
    <div className="pub-page-container">
      <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-secondary)" }}>Loading...</div>
    </div>
  );

  // ── Feature gate — no plan ──
  if (!hasFeature) return (
    <div className="pub-page-container">
      <div className="pub-gate-card">
        <div className="gate-icon">🌐</div>
        <h2>Public Web Page</h2>
        <p>
          Create your institute's own public website to attract more students.
          Share your courses, faculty, stats, and achievements — all in one beautiful page.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={() => navigate("/pricing")}>⬆️ Upgrade Plan to Unlock</button>
          <button className="btn btn-secondary" onClick={() => navigate("/admin/dashboard")}>← Back to Dashboard</button>
        </div>
        <div style={{ marginTop: "2rem", display: "flex", gap: "1.5rem", justifyContent: "center", flexWrap: "wrap" }}>
          {["🎯 Attract more students", "📋 Showcase your courses", "📞 Collect enquiries", "🔗 Share a live URL"].map(f => (
            <div key={f} style={{ background: "rgba(99,102,241,.1)", borderRadius: "10px", padding: ".5rem 1rem", fontSize: ".875rem", fontWeight: 600 }}>{f}</div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── No page created yet ──
  if (!profile && tab !== "wizard") return (
    <div className="pub-page-container">
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>🌐 Public Web Page</h1>
        <p style={{ color: "var(--text-secondary)" }}>Create your institute's public-facing website</p>
      </div>
      <div className="pub-gate-card">
        <div className="gate-icon">✨</div>
        <h2>Create Your Public Page</h2>
        <p>
          You can now create your institute's public web page! Share it with parents &amp; students.
          It takes less than 5 minutes to set up.
        </p>
        <button className="btn btn-primary" style={{ fontSize: "1rem", padding: ".75rem 2rem" }} onClick={() => setTab("wizard")}>
          🚀 Start Creating Your Page →
        </button>
      </div>
    </div>
  );

  const pageUrl = `${BASE_URL}/i/${profile?.slug || ""}`;

  return (
    <div className="pub-page-container">
      {/* Header */}
      <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>🌐 Public Web Page</h1>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>Manage your institute's public-facing website</p>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate("/admin/dashboard")}>
          ← Back to Dashboard
        </button>
      </div>

      {/* Status Banner */}
      {profile && tab !== "wizard" && (
        <div className="pub-status-banner">
          <div className="banner-left">
            <div style={{ display: "flex", alignItems: "center", gap: ".75rem", marginBottom: ".25rem" }}>
              <h2>{profile.is_published ? "Page is Live" : "Page is Draft"}</h2>
              {profile.is_published && <span className="live-badge">LIVE</span>}
            </div>
            <p>
              {profile.is_published
                ? `🔗 ${pageUrl}`
                : "Your page is saved as draft. Click Publish to make it live."}
            </p>
          </div>
          <div className="banner-actions">
            {profile.is_published && (
              <>
                <button className="btn btn-outline" style={{ color: "#fff", borderColor: "rgba(255,255,255,.4)" }}
                  onClick={() => window.open(pageUrl, "_blank")}>👁 View Live</button>
                <button className="btn btn-outline" style={{ color: "#fff", borderColor: "rgba(255,255,255,.4)" }}
                  onClick={copyURL}>📋 Copy URL</button>
                <button className="btn btn-danger btn-sm" onClick={handleUnpublish}>🔴 Unpublish</button>
              </>
            )}
            {!profile.is_published && (
              <button className="btn btn-success" onClick={handlePublish}>🚀 Publish Now</button>
            )}
          </div>
        </div>
      )}

      {actionMsg && (
        <div style={{ padding: ".75rem 1rem", borderRadius: "10px", background: "rgba(16,185,129,.12)", marginBottom: "1rem", fontWeight: 600, color: "#059669" }}>
          {actionMsg}
        </div>
      )}

      {/* Tab Row */}
      {profile && (
        <div className="pub-tab-row">
          <button className={`pub-tab-btn ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>📊 Overview</button>
          <button className={`pub-tab-btn ${tab === "wizard" ? "active" : ""}`} onClick={() => setTab("wizard")}>✏️ Edit Page</button>
          <button className={`pub-tab-btn ${tab === "enquiries" ? "active" : ""}`} onClick={handleOpenEnquiries}>
            📥 Enquiries
            {profile.new_enquiry_count > 0 && <span className="badge">{profile.new_enquiry_count}</span>}
          </button>
        </div>
      )}

      {/* ─── TAB: OVERVIEW ─── */}
      {tab === "overview" && profile && (
        <div>
          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
            {[
              { icon: "👁", label: "Page Views", value: profile.page_views || 0 },
              { icon: "📥", label: "Total Enquiries", value: profile.total_enquiries || 0 },
              { icon: "🖼", label: "Gallery Photos", value: profile.gallery?.length || 0 },
              { icon: "⭐", label: "Reviews", value: profile.reviews?.length || 0 },
            ].map(s => (
              <div key={s.label} style={{ background: "var(--card-bg)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "1.25rem", textAlign: "center" }}>
                <div style={{ fontSize: "1.75rem" }}>{s.icon}</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, margin: ".25rem 0" }}>{s.value}</div>
                <div style={{ fontSize: ".8rem", color: "var(--text-secondary)" }}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* Quick info */}
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--border-color)", borderRadius: "14px", padding: "1.5rem" }}>
            <h3 style={{ marginTop: 0 }}>Page Details</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".75rem", fontSize: ".875rem" }}>
              {[
                { label: "Tagline", value: profile.tagline || "—" },
                { label: "Affiliation", value: profile.affiliation || "—" },
                { label: "Pass Rate", value: profile.pass_rate || "—" },
                { label: "Admission Status", value: profile.admission_status || "—" },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ color: "var(--text-secondary)", fontSize: ".75rem", fontWeight: 600, marginBottom: ".15rem" }}>{item.label.toUpperCase()}</div>
                  <div>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: "1rem", display: "flex", gap: ".75rem" }}>
              <button className="btn btn-primary btn-sm" onClick={() => setTab("wizard")}>✏️ Edit Page</button>
              <button className="btn btn-secondary btn-sm" onClick={handleOpenEnquiries}>📥 View Enquiries</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: WIZARD ─── */}
      {tab === "wizard" && (
        <PublicPageWizard
          existingData={profile}
          onDone={() => { fetchAll(); setTab("overview"); }}
        />
      )}

      {/* ─── TAB: ENQUIRIES ─── */}
      {tab === "enquiries" && (
        <div>
          {/* Filter row */}
          <div style={{ display: "flex", gap: ".5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
            {["all", "new", "contacted", "enrolled", "closed"].map(s => (
              <button key={s} className={`pub-tab-btn ${enquiryFilter === s ? "active" : ""}`}
                onClick={() => { setEnquiryFilter(s); setEnquiryPage(1); }}>
                {s === "all" ? "All" : STATUS_LABELS[s]}
              </button>
            ))}
            <span style={{ marginLeft: "auto", color: "var(--text-secondary)", fontSize: ".85rem" }}>
              {enquiryTotal} total
            </span>
          </div>

          {enquiries.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)", background: "var(--card-bg)", border: "1px solid var(--border-color)", borderRadius: "12px" }}>
              No enquiries found.
            </div>
          ) : (
            <div style={{ background: "var(--card-bg)", border: "1px solid var(--border-color)", borderRadius: "14px", overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table className="enquiry-table">
                  <thead>
                    <tr>
                      <th>Name</th><th>Mobile</th><th>Course Interest</th>
                      <th>Class</th><th>Date</th><th>Status</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enquiries.map(e => (
                      <tr key={e.id} onClick={() => setSelectedEnquiry(e)} style={{ cursor: "pointer" }}>
                        <td><strong>{e.first_name} {e.last_name || ""}</strong><br /><span style={{ fontSize: ".75rem", color: "var(--text-secondary)" }}>{e.email}</span></td>
                        <td>
                          <a href={`tel:${e.mobile}`} onClick={ev => ev.stopPropagation()} style={{ color: "var(--primary, #6366f1)", textDecoration: "none" }}>{e.mobile}</a>
                          {e.mobile && (
                            <a href={`https://wa.me/91${e.mobile}?text=Hi ${e.first_name}, we received your enquiry for ${e.course_interest || "our courses"}. How can we help you?`}
                              target="_blank" rel="noopener noreferrer" onClick={ev => ev.stopPropagation()}
                              style={{ marginLeft: ".5rem", fontSize: ".75rem", color: "#25D366" }}>💬 WA</a>
                          )}
                        </td>
                        <td>{e.course_interest || "—"}</td>
                        <td>{e.current_class || "—"}</td>
                        <td style={{ fontSize: ".8rem" }}>{new Date(e.created_at).toLocaleDateString("en-IN")}</td>
                        <td>
                          <span className={`status-badge ${STATUS_CLASS[e.status] || ""}`}>{STATUS_LABELS[e.status] || e.status}</span>
                        </td>
                        <td onClick={ev => ev.stopPropagation()}>
                          <select value={e.status} onChange={ev => updateEnquiryStatus(e.id, ev.target.value)}
                            style={{ padding: "4px 8px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--input-bg, transparent)", fontSize: ".8rem", color: "var(--text-primary)", cursor: "pointer" }}>
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="enrolled">Enrolled</option>
                            <option value="closed">Closed</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {enquiryPages > 1 && (
                <div style={{ padding: "1rem", display: "flex", gap: ".5rem", justifyContent: "center" }}>
                  {Array.from({ length: enquiryPages }, (_, i) => i + 1).map(p => (
                    <button key={p} className={`pub-tab-btn ${enquiryPage === p ? "active" : ""}`} onClick={() => setEnquiryPage(p)}>{p}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Enquiry detail modal */}
          {selectedEnquiry && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
              onClick={() => setSelectedEnquiry(null)}>
              <div style={{ background: "var(--card-bg, #fff)", color: "var(--text-primary)", borderRadius: "16px", padding: "2rem", maxWidth: "480px", width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}
                onClick={e => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <h3 style={{ margin: 0 }}>📋 Enquiry Details</h3>
                  <button style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "var(--text-secondary)" }} onClick={() => setSelectedEnquiry(null)}>✕</button>
                </div>
                {[
                  ["Name", `${selectedEnquiry.first_name} ${selectedEnquiry.last_name || ""}`],
                  ["Mobile", selectedEnquiry.mobile],
                  ["Email", selectedEnquiry.email || "—"],
                  ["Course Interest", selectedEnquiry.course_interest || "—"],
                  ["Current Class", selectedEnquiry.current_class || "—"],
                  ["Message", selectedEnquiry.message || "—"],
                  ["Date", new Date(selectedEnquiry.created_at).toLocaleString("en-IN")],
                  ["Status", STATUS_LABELS[selectedEnquiry.status]],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: "1rem", padding: ".5rem 0", borderBottom: "1px solid var(--border-color)", fontSize: ".875rem" }}>
                    <div style={{ width: 130, color: "var(--text-secondary)", fontWeight: 600, flexShrink: 0 }}>{k}</div>
                    <div>{v}</div>
                  </div>
                ))}
                <div style={{ marginTop: "1.25rem", display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
                  <a href={`tel:${selectedEnquiry.mobile}`} className="btn btn-secondary btn-sm">📞 Call</a>
                  <a href={`https://wa.me/91${selectedEnquiry.mobile}?text=Hi ${selectedEnquiry.first_name}!`} target="_blank" rel="noopener noreferrer" className="btn btn-sm" style={{ background: "#25D366", color: "#fff" }}>💬 WhatsApp</a>
                  <select value={selectedEnquiry.status}
                    onChange={e => updateEnquiryStatus(selectedEnquiry.id, e.target.value)}
                    style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--input-bg, transparent)", color: "var(--text-primary)" }}>
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="enrolled">Enrolled</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
