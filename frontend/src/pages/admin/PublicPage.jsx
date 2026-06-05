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
  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");
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
        <div style={{ background: '#faf5ff', border: '1px solid #f3e8ff', borderRadius: '16px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#111827' }}>{profile.is_published ? "Page is Live" : "Page is Draft"}</h2>
              {profile.is_published && <span style={{ background: '#dcfce7', color: '#16a34a', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>● Live</span>}
            </div>
            <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: '0.9rem' }}>
              {profile.is_published
                ? "Your website is publicly accessible and up to date."
                : "Your page is saved as draft. Click Publish to make it live."}
            </p>
            {profile.is_published && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#7e22ce', fontWeight: 600, fontSize: '0.95rem' }}>
                🔗 <a href={pageUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#7e22ce', textDecoration: 'none' }}>{pageUrl}</a>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {profile.is_published && (
              <>
                <button onClick={() => window.open(pageUrl, "_blank")} style={{ background: '#fff', border: '1px solid #d8b4fe', color: '#7e22ce', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>↗</span> View Live Site
                </button>
                <button onClick={copyURL} style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#374151', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>📋</span> Copy URL
                </button>
                <button onClick={handleUnpublish} style={{ background: '#fff', border: '1px solid #fca5a5', color: '#ef4444', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⛔</span> Unpublish
                </button>
              </>
            )}
            {!profile.is_published && (
              <button onClick={handlePublish} style={{ background: '#10b981', border: 'none', color: '#fff', padding: '8px 24px', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🚀 Publish Now
              </button>
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
        <div style={{ marginTop: '24px' }}>
          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "20px", display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '8px', background: '#f3e8ff', color: '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>👁</div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>Page Views</div>
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{profile.page_views || 0}</div>
                </div>
                <div style={{ width: '40%', height: '30px', alignSelf: 'center', overflow: 'hidden' }}>
                    <svg viewBox="0 0 100 30" preserveAspectRatio="none" width="100%" height="100%">
                        <polyline points="0,30 20,20 40,25 60,10 80,15 100,5" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                ▲ 18% from last 30 days
              </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "20px", display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '8px', background: '#dcfce7', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>📥</div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>Total Enquiries</div>
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{profile.total_enquiries || 0}</div>
                </div>
                <div style={{ width: '40%', height: '30px', alignSelf: 'center', overflow: 'hidden' }}>
                    <svg viewBox="0 0 100 30" preserveAspectRatio="none" width="100%" height="100%">
                        <polyline points="0,30 20,25 40,30 60,15 80,5 100,20" fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                ▲ 100% from last 30 days
              </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "20px", display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#fef3c7', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>🖼</div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 600, marginBottom: '2px' }}>Gallery Photos</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{profile.gallery?.length || 0}</div>
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                Total uploaded photos
              </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "20px", display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>⭐</div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 600, marginBottom: '2px' }}>Reviews</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{profile.reviews?.length || 0}</div>
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>
                Average rating 4.5/5
              </div>
            </div>
          </div>

          {/* Details & Quick Actions row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Page Details */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <span style={{ fontSize: '1.2rem', color: '#7e22ce' }}>📄</span>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#111827' }}>Page Details</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {[
                  { label: "Tagline", value: profile.tagline || "—" },
                  { label: "Affiliation", value: profile.affiliation || "—" },
                  { label: "Pass Rate", value: (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span>{profile.pass_rate || "—"}</span>
                          {profile.pass_rate && <span style={{ background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700 }}>Excellent</span>}
                      </div>
                  ) },
                  { label: "Admission Status", value: profile.admission_status || "—" },
                  { label: "Last Updated", value: new Date(profile.updated_at || Date.now()).toLocaleString("en-IN", { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
                ].map((item, idx) => (
                  <div key={item.label} style={{ display: 'flex', padding: '12px 0', borderBottom: idx !== 4 ? '1px solid #f3f4f6' : 'none' }}>
                    <div style={{ width: '160px', color: '#4b5563', fontSize: '0.85rem', fontWeight: 600 }}>{item.label}</div>
                    <div style={{ flex: 1, color: '#111827', fontSize: '0.85rem' }}>{item.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
                <button onClick={() => setTab("wizard")} style={{ background: '#7e22ce', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ✏️ Edit Page
                </button>
                <button onClick={handleOpenEnquiries} style={{ background: '#fff', color: '#7e22ce', border: '1px solid #d8b4fe', padding: '8px 20px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ✉️ View Enquiries
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <span style={{ fontSize: '1.2rem', color: '#f59e0b' }}>⚡</span>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#111827' }}>Quick Actions</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div onClick={() => setTab("wizard")} style={{ display: 'flex', alignItems: 'center', padding: '16px', border: '1px solid #f3f4f6', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', background: '#fafaf9' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#f3e8ff', color: '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginRight: '16px' }}>✏️</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111827' }}>Edit Website Content</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Update text, images, and other content</div>
                  </div>
                  <div style={{ color: '#9ca3af' }}>&gt;</div>
                </div>

                <div onClick={handleOpenEnquiries} style={{ display: 'flex', alignItems: 'center', padding: '16px', border: '1px solid #f3f4f6', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', background: '#fafaf9' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#dcfce7', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginRight: '16px' }}>✉️</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111827' }}>Manage Enquiries</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>View and respond to website enquiries</div>
                  </div>
                  <div style={{ color: '#9ca3af' }}>&gt;</div>
                </div>

                <div onClick={() => setTab("wizard")} style={{ display: 'flex', alignItems: 'center', padding: '16px', border: '1px solid #f3f4f6', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', background: '#fafaf9' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#fef3c7', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginRight: '16px' }}>🖼</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111827' }}>Gallery Management</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Upload and manage gallery photos</div>
                  </div>
                  <div style={{ color: '#9ca3af' }}>&gt;</div>
                </div>

                <div onClick={() => setTab("wizard")} style={{ display: 'flex', alignItems: 'center', padding: '16px', border: '1px solid #f3f4f6', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', background: '#fafaf9' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginRight: '16px' }}>⚙️</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111827' }}>SEO & Settings</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Manage SEO meta, social links and more</div>
                  </div>
                  <div style={{ color: '#9ca3af' }}>&gt;</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '24px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', color: '#1e40af', fontSize: '0.85rem' }}>
            <span style={{ fontSize: '1.1rem' }}>ℹ️</span>
            Changes made to your public website will be reflected immediately after publishing.
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
      {tab === "enquiries" && (() => {
        const uniqueClasses = ["all", ...new Set(enquiries.map(e => e.current_class).filter(Boolean))];
        const filteredEnquiries = enquiries.filter(e => {
          if (classFilter !== "all" && e.current_class !== classFilter) return false;
          if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (
              (e.first_name && e.first_name.toLowerCase().includes(q)) ||
              (e.last_name && e.last_name.toLowerCase().includes(q)) ||
              (e.mobile && e.mobile.includes(q)) ||
              (e.email && e.email.toLowerCase().includes(q))
            );
          }
          return true;
        });

        return (
        <div style={{ marginTop: '24px' }}>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
            {[
              { icon: '✉️', color: '#7e22ce', bg: '#f3e8ff', label: 'Total Enquiries', value: enquiryTotal },
              { icon: '📥', color: '#10b981', bg: '#dcfce7', label: 'New', value: enquiries.filter(e => e.status === 'new').length },
              { icon: '👤', color: '#3b82f6', bg: '#dbeafe', label: 'Contacted', value: enquiries.filter(e => e.status === 'contacted').length },
              { icon: '🎓', color: '#f59e0b', bg: '#fef3c7', label: 'Enrolled', value: enquiries.filter(e => e.status === 'enrolled').length },
              { icon: '🔒', color: '#ef4444', bg: '#fee2e2', label: 'Closed', value: enquiries.filter(e => e.status === 'closed').length },
            ].map(card => (
              <div key={card.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 40, height: 40, borderRadius: '10px', background: card.bg, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                  {card.icon}
                </div>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827', lineHeight: 1, marginBottom: '4px' }}>{card.value}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>{card.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
            {/* Toolbar */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: "flex", gap: "8px" }}>
                {["all", "new", "contacted", "enrolled", "closed"].map(s => (
                  <button key={s} 
                    style={{ background: enquiryFilter === s ? '#7e22ce' : 'transparent', color: enquiryFilter === s ? '#fff' : '#6b7280', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                    onClick={() => { setEnquiryFilter(s); setEnquiryPage(1); }}>
                    {s === "all" ? "All" : STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '0.9rem' }}>🔍</span>
                  <input type="text" placeholder="Search enquiries..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ padding: '8px 12px 8px 36px', borderRadius: '8px', border: '1px solid #e5e7eb', outline: 'none', fontSize: '0.85rem', width: '200px' }} />
                </div>
                <select value={classFilter} onChange={e => setClassFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', outline: 'none', fontSize: '0.85rem', color: '#374151', cursor: 'pointer', background: '#fff' }}>
                  {uniqueClasses.map(c => (
                    <option key={c} value={c}>{c === "all" ? "All Classes" : c}</option>
                  ))}
                </select>
                <select value={enquiryFilter} onChange={e => { setEnquiryFilter(e.target.value); setEnquiryPage(1); }} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', outline: 'none', fontSize: '0.85rem', color: '#374151', cursor: 'pointer', background: '#fff' }}>
                  <option value="all">All Status</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="enrolled">Enrolled</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            {filteredEnquiries.length === 0 ? (
              <div style={{ textAlign: "center", padding: "4rem 2rem", color: "var(--text-secondary)" }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                <h3 style={{ margin: '0 0 0.5rem', color: '#111827' }}>No enquiries found</h3>
                <p style={{ margin: 0 }}>There are no enquiries matching your current filters.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '16px 20px', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Name</th>
                      <th style={{ padding: '16px 20px', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Contact</th>
                      <th style={{ padding: '16px 20px', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Course Interest</th>
                      <th style={{ padding: '16px 20px', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Class</th>
                      <th style={{ padding: '16px 20px', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Date</th>
                      <th style={{ padding: '16px 20px', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Status</th>
                      <th style={{ padding: '16px 20px', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEnquiries.map((e, idx) => {
                      const initials = `${e.first_name?.[0] || ""}${e.last_name?.[0] || ""}`.toUpperCase() || "E";
                      const statusColors = {
                        new: { bg: '#dcfce7', text: '#16a34a' },
                        contacted: { bg: '#fef3c7', text: '#d97706' },
                        enrolled: { bg: '#dbeafe', text: '#2563eb' },
                        closed: { bg: '#f3f4f6', text: '#4b5563' }
                      };
                      const sColor = statusColors[e.status] || statusColors.new;

                      return (
                        <tr key={e.id} style={{ borderBottom: idx !== filteredEnquiries.length - 1 ? '1px solid #f3f4f6' : 'none', cursor: 'pointer', transition: 'background 0.2s' }} onClick={() => setSelectedEnquiry(e)} onMouseEnter={ev => ev.currentTarget.style.background = '#f8fafc'} onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f3e8ff', color: '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, flexShrink: 0 }}>
                                {initials}
                              </div>
                              <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111827' }}>{e.first_name} {e.last_name || ""}</div>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{e.email || "No Email"}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.85rem', color: '#4b5563', fontWeight: 500 }}>{e.mobile}</span>
                                {e.mobile && (
                                  <a href={`https://wa.me/91${e.mobile}`} target="_blank" rel="noopener noreferrer" onClick={ev => ev.stopPropagation()} style={{ color: '#25D366', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                                  </a>
                                )}
                                {e.email && (
                                  <a href={`mailto:${e.email}`} onClick={ev => ev.stopPropagation()} style={{ color: '#7e22ce', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                                  </a>
                                )}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>WA</div>
                            </div>
                          </td>
                          <td style={{ padding: '16px 20px', fontSize: '0.85rem', color: '#374151', maxWidth: '200px' }}>
                            <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {e.course_interest || "—"}
                            </div>
                          </td>
                          <td style={{ padding: '16px 20px', fontSize: '0.85rem', color: '#4b5563' }}>{e.current_class || "—"}</td>
                          <td style={{ padding: '16px 20px', fontSize: '0.85rem', color: '#4b5563' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span>{new Date(e.created_at).toLocaleDateString("en-IN", { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{new Date(e.created_at).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </td>
                          <td style={{ padding: '16px 20px' }}>
                            <span style={{ background: sColor.bg, color: sColor.text, padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, border: `1px solid ${sColor.bg.replace('e', 'd')}` }}>
                              {STATUS_LABELS[e.status] || e.status}
                            </span>
                          </td>
                          <td style={{ padding: '16px 20px' }} onClick={ev => ev.stopPropagation()}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button onClick={() => setSelectedEnquiry(e)} style={{ background: '#f3e8ff', color: '#7e22ce', border: 'none', width: 32, height: 32, borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                👁
                              </button>
                              <div style={{ position: 'relative' }}>
                                <select value={e.status} onChange={ev => updateEnquiryStatus(e.id, ev.target.value)}
                                  style={{ appearance: 'none', background: '#fff', border: '1px solid #e5e7eb', width: 32, height: 32, borderRadius: '8px', cursor: 'pointer', color: 'transparent', textAlign: 'center' }}>
                                  <option value="new">New</option>
                                  <option value="contacted">Contacted</option>
                                  <option value="enrolled">Enrolled</option>
                                  <option value="closed">Closed</option>
                                </select>
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', color: '#6b7280', fontSize: '1.2rem', fontWeight: 'bold' }}>
                                  ⋮
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Pagination Footer */}
            {filteredEnquiries.length > 0 && (
              <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e5e7eb', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                  Showing {(enquiryPage - 1) * 15 + 1} to {Math.min(enquiryPage * 15, enquiryTotal)} of {enquiryTotal} entries
                </div>
                {enquiryPages > 1 && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => setEnquiryPage(p => Math.max(1, p - 1))} disabled={enquiryPage === 1} style={{ background: '#fff', border: '1px solid #e5e7eb', width: 32, height: 32, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: enquiryPage === 1 ? 'not-allowed' : 'pointer', color: '#9ca3af' }}>&lt;</button>
                    {Array.from({ length: enquiryPages }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => setEnquiryPage(p)} style={{ background: enquiryPage === p ? '#7e22ce' : '#fff', color: enquiryPage === p ? '#fff' : '#374151', border: enquiryPage === p ? '1px solid #7e22ce' : '1px solid #e5e7eb', width: 32, height: 32, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>{p}</button>
                    ))}
                    <button onClick={() => setEnquiryPage(p => Math.min(enquiryPages, p + 1))} disabled={enquiryPage === enquiryPages} style={{ background: '#fff', border: '1px solid #e5e7eb', width: 32, height: 32, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: enquiryPage === enquiryPages ? 'not-allowed' : 'pointer', color: '#9ca3af' }}>&gt;</button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ marginTop: '24px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', color: '#1e40af', fontSize: '0.85rem' }}>
            <span style={{ fontSize: '1.1rem' }}>ℹ️</span>
            Enquiries are automatically saved when submitted from your public website.
          </div>
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
        );
      })()}
    </div>
  );
}
