/**
 * Admin Public Page — 7-Step Wizard (Phases 1-4 implemented)
 * Phase 1: Auto/Manual course toggle with full manual course form
 * Phase 2: Faculty image upload
 * Phase 3: Map embed URL helper
 * Phase 4: YouTube intro video URL field
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import "./PublicPage.css";

const API_BASE = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : 'https://institutes-saas.onrender.com/api')).replace(/\/$/, '');
const resolveImg = (url) => {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  return API_BASE.replace('/api', '') + url;
};

const STEPS = [
  { label: "Basic Info" },
  { label: "Photos" },
  { label: "Stats" },
  { label: "Courses" },
  { label: "Faculty" },
  { label: "Contact" },
  { label: "Publish" },
];

const AFFILIATION_OPTIONS = [
  "CBSE",
  "ICSE",
  "State Board (SSC)",
  "State Board (HSC)",
  "IB (International Baccalaureate)",
  "IGCSE / Cambridge",
  "University-Affiliated",
  "NIOS (National Institute of Open Schooling)",
  "Others",
];
// Values that are recognized presets (for pre-fill detection)
const AFFILIATION_PRESET_SET = new Set(AFFILIATION_OPTIONS);

// 10 built-in course stock images (emojis & gradients as fallbacks)
const STOCK_COURSE_IMAGES = [
  { label: "Science", gradient: "linear-gradient(135deg,#1a6fa8,#1e88e5)", emoji: "🔬" },
  { label: "Mathematics", gradient: "linear-gradient(135deg,#6a1b9a,#9c27b0)", emoji: "📐" },
  { label: "Commerce", gradient: "linear-gradient(135deg,#00695c,#26a69a)", emoji: "💼" },
  { label: "Arts", gradient: "linear-gradient(135deg,#bf360c,#e64a19)", emoji: "🎨" },
  { label: "JEE/NEET", gradient: "linear-gradient(135deg,#283593,#3f51b5)", emoji: "🏆" },
  { label: "Languages", gradient: "linear-gradient(135deg,#4e342e,#795548)", emoji: "📖" },
  { label: "Computer", gradient: "linear-gradient(135deg,#006064,#00acc1)", emoji: "💻" },
  { label: "History", gradient: "linear-gradient(135deg,#e65100,#f57c00)", emoji: "🏛️" },
  { label: "Biology", gradient: "linear-gradient(135deg,#1b5e20,#43a047)", emoji: "🧬" },
  { label: "Physics", gradient: "linear-gradient(135deg,#1565c0,#1976d2)", emoji: "⚛️" },
];

const EMPTY_MANUAL_COURSE = {
  id: null,
  name: "",
  description: "",
  image_url: null,
  stock_image_idx: 0,
  duration_months: 12,
  max_students: 30,
  hours_per_day: 4,
  badge: "",
};

const EMPTY_MANUAL_FACULTY = {
  id: null,
  name: "",
  email: "",
  designation: "",
  image_url: null,
};

export default function PublicPageWizard({ onDone, existingData }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Board / Affiliation — separate state for the "Others" free-text input
  const [affiliationDropdown, setAffiliationDropdown] = useState(""); // dropdown value
  const [affiliationCustom, setAffiliationCustom] = useState("");     // free-text for Others

  // Form state — all steps merged
  const [form, setForm] = useState({
    slug: "",
    tagline: "", description: "", about_text: "", established_year: "",
    years_of_excellence: "", affiliation: "", admission_status: "",
    logo_url: "", cover_photo_url: "",
    pass_rate: "", competitive_selections: "", total_students_display: "",
    usp_points: [""], enrollment_benefits: [""],
    selected_subject_ids: [], selected_faculty_ids: [],
    contact_address: "", contact_phone: "", contact_email: "",
    whatsapp_number: "", working_hours: "", map_embed_url: "",
    social_facebook: "", social_instagram: "", social_youtube: "",
    footer_description: "", seo_title: "", seo_description: "",
    theme_color: "0F2340",
    // Phase 1: Courses
    course_mode: "auto",
    faculty_mode: "auto",
    // Phase 4: YouTube
    youtube_intro_url: "",
  });

  const [logoFile, setLogoFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [newReview, setNewReview] = useState({ student_name: "", review_text: "", rating: 5, achievement: "" });
  const [subjects, setSubjects] = useState([]);
  const [faculty, setFaculty] = useState([]);

  // Phase 1: Manual courses state
  const [manualCourses, setManualCourses] = useState([{ ...EMPTY_MANUAL_COURSE, id: Date.now() }]);
  const [courseImageFiles, setCourseImageFiles] = useState({}); // idx -> File

  const [manualFaculty, setManualFaculty] = useState([{ ...EMPTY_MANUAL_FACULTY, id: Date.now() }]);
  const [facultyImageFiles, setFacultyImageFiles] = useState({}); // idx -> File

  // Phase 2: Faculty image uploads
  const [facultyImageUploading, setFacultyImageUploading] = useState({}); // id -> bool
  const [facultyImageMsg, setFacultyImageMsg] = useState({});

  // Pre-fill from existing data
  useEffect(() => {
    if (existingData) {
      // ── Affiliation pre-fill logic ──────────────────────────────
      // If stored value is a known preset → set dropdown to that value
      // If stored value is non-empty but NOT a preset → it was a custom "Others" entry
      const savedAffil = existingData.affiliation || "";
      if (!savedAffil) {
        setAffiliationDropdown("");
        setAffiliationCustom("");
      } else if (AFFILIATION_PRESET_SET.has(savedAffil)) {
        setAffiliationDropdown(savedAffil);
        setAffiliationCustom("");
      } else {
        // Custom value → restore the "Others" mode
        setAffiliationDropdown("Others");
        setAffiliationCustom(savedAffil);
      }

      setForm(prev => ({
        ...prev,
        slug: existingData.slug || "",
        tagline: existingData.tagline || "",
        description: existingData.description || "",
        about_text: existingData.about_text || "",
        established_year: existingData.established_year || "",
        years_of_excellence: existingData.years_of_excellence || "",
        affiliation: savedAffil,
        admission_status: existingData.admission_status || "",
        pass_rate: existingData.pass_rate || "",
        competitive_selections: existingData.competitive_selections || "",
        total_students_display: existingData.total_students_display || "",
        usp_points: existingData.usp_points?.length ? existingData.usp_points : [""],
        enrollment_benefits: existingData.enrollment_benefits?.length ? existingData.enrollment_benefits : [""],
        selected_subject_ids: existingData.selected_subject_ids || [],
        selected_faculty_ids: existingData.selected_faculty_ids || [],
        contact_address: existingData.contact_address || "",
        contact_phone: existingData.contact_phone || "",
        contact_email: existingData.contact_email || "",
        whatsapp_number: existingData.whatsapp_number || "",
        working_hours: existingData.working_hours || "",
        map_embed_url: existingData.map_embed_url || "",
        social_facebook: existingData.social_facebook || "",
        social_instagram: existingData.social_instagram || "",
        social_youtube: existingData.social_youtube || "",
        footer_description: existingData.footer_description || "",
        seo_title: existingData.seo_title || "",
        seo_description: existingData.seo_description || "",
        theme_color: existingData.theme_color || "0F2340",
        logo_url: existingData.logo_url || "",
        cover_photo_url: existingData.cover_photo_url || "",
        course_mode: existingData.course_mode || "auto",
        faculty_mode: existingData.faculty_mode || "auto",
        youtube_intro_url: existingData.youtube_intro_url || "",
      }));
      if (existingData.logo_url) setLogoPreview(existingData.logo_url);
      if (existingData.cover_photo_url) setCoverPreview(existingData.cover_photo_url);
      if (existingData.gallery) setGallery(existingData.gallery);
      if (existingData.reviews) setReviews(existingData.reviews);
      // Pre-fill manual courses
      if (existingData.manual_courses?.length) {
        setManualCourses(existingData.manual_courses.map(c => ({ ...EMPTY_MANUAL_COURSE, ...c, id: c.id || Date.now() + Math.random() })));
      }
      if (existingData.manual_faculty?.length) {
        setManualFaculty(existingData.manual_faculty.map(f => ({ ...EMPTY_MANUAL_FACULTY, ...f, id: f.id || Date.now() + Math.random() })));
      }
    }
  }, [existingData]);

  useEffect(() => {
    api.get("/admin/public-page/subjects").then(r => setSubjects(r.data.data || [])).catch(() => {});
    api.get("/admin/public-page/faculty").then(r => setFaculty(r.data.data || [])).catch(() => {});
  }, []);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const setList = (key, idx, val) => setForm(prev => {
    const arr = [...prev[key]]; arr[idx] = val; return { ...prev, [key]: arr };
  });
  const addListItem = (key) => setForm(prev => ({ ...prev, [key]: [...prev[key], ""] }));
  const removeListItem = (key, idx) => setForm(prev => ({
    ...prev, [key]: prev[key].filter((_, i) => i !== idx)
  }));

  const toggleId = (key, id) => setForm(prev => {
    const arr = prev[key];
    return { ...prev, [key]: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] };
  });

  // ── Manual course helpers ───────────────────────────────────────
  const updateManualCourse = (idx, key, val) => {
    setManualCourses(prev => {
      const arr = [...prev];
      arr[idx] = { ...arr[idx], [key]: val };
      return arr;
    });
  };
  const addManualCourse = () => {
    if (manualCourses.length >= 10) return;
    setManualCourses(prev => [...prev, { ...EMPTY_MANUAL_COURSE, id: Date.now() }]);
  };
  const removeManualCourse = (idx) => {
    setManualCourses(prev => prev.filter((_, i) => i !== idx));
    setCourseImageFiles(prev => { const n = { ...prev }; delete n[idx]; return n; });
  };

  // ── Manual faculty helpers ───────────────────────────────────────
  const updateManualFaculty = (idx, key, val) => {
    setManualFaculty(prev => {
      const arr = [...prev];
      arr[idx] = { ...arr[idx], [key]: val };
      return arr;
    });
  };
  const addManualFaculty = () => {
    if (manualFaculty.length >= 20) return;
    setManualFaculty(prev => [...prev, { ...EMPTY_MANUAL_FACULTY, id: Date.now() }]);
  };
  const removeManualFaculty = (idx) => {
    setManualFaculty(prev => prev.filter((_, i) => i !== idx));
    setFacultyImageFiles(prev => { const n = { ...prev }; delete n[idx]; return n; });
  };

  // ── Subdomain logic ───────────────────────────────────────────
  const [subdomainStatus, setSubdomainStatus] = useState(null); // { available: bool, msg: string }
  
  const checkSubdomain = async (val) => {
    if (!val) return setSubdomainStatus(null);
    try {
      const res = await api.get(`/admin/public-page/check-subdomain?subdomain=${val}`);
      if (res.data.success) {
        if (res.data.data.available) {
          setSubdomainStatus({ available: true, msg: "✅ Subdomain is available!" });
        } else {
          setSubdomainStatus({ available: false, msg: `❌ ${res.data.data.reason || "Already taken"}` });
        }
      }
    } catch (e) {
      setSubdomainStatus({ available: false, msg: "❌ Error checking availability" });
    }
  };

  // ── Save current step data to backend ──────────────────────────
  const saveStep = useCallback(async (publish = false) => {
    setSaving(true);
    setMsg("");
    try {
      const fd = new FormData();
      const jsonFields = ["usp_points", "enrollment_benefits", "selected_subject_ids", "selected_faculty_ids"];

      // Resolve final affiliation value before sending:
      // If "Others" selected → use the custom text input value
      // If a preset is selected → use that preset value directly
      const resolvedAffiliation = affiliationDropdown === "Others"
        ? affiliationCustom.trim()
        : affiliationDropdown;

      Object.entries(form).forEach(([k, v]) => {
        if (k === "logo_url" || k === "cover_photo_url") return;
        if (k === "affiliation") {
          // We handle affiliation separately below
          return;
        }
        if (jsonFields.includes(k)) fd.append(k, JSON.stringify(v));
        else if (v !== "") fd.append(k, v);
      });

      // Append resolved affiliation
      if (resolvedAffiliation) fd.append("affiliation", resolvedAffiliation);

      // Append manual courses (with stock image idx info; actual files below)
      const coursesPayload = manualCourses.map((c, idx) => ({
        ...c,
        image_url: courseImageFiles[idx] ? null : c.image_url,
      }));
      fd.append("manual_courses", JSON.stringify(coursesPayload));

      const facultyPayload = manualFaculty.map((f, idx) => ({
        ...f,
        image_url: facultyImageFiles[idx] ? null : f.image_url,
      }));
      fd.append("manual_faculty", JSON.stringify(facultyPayload));

      if (logoFile) fd.append("logo", logoFile);
      if (coverFile) fd.append("cover_photo", coverFile);

      // Append course image files
      Object.entries(courseImageFiles).forEach(([idx, file]) => {
        fd.append(`manual_course_img_${idx}`, file);
      });
      Object.entries(facultyImageFiles).forEach(([idx, file]) => {
        fd.append(`manual_faculty_img_${idx}`, file);
      });

      await api.post("/admin/public-page", fd, { headers: { "Content-Type": "multipart/form-data" } });

      if (publish) {
        await api.post("/admin/public-page/publish");
        setMsg("🎉 Your page is now LIVE!");
        if (onDone) onDone();
        return;
      }
    } catch (e) {
      setMsg("⚠️ " + (e.response?.data?.message || "Save failed"));
    } finally {
      setSaving(false);
    }
  }, [form, logoFile, coverFile, onDone, manualCourses, courseImageFiles, manualFaculty, facultyImageFiles, affiliationDropdown, affiliationCustom]);

  const handleNext = async () => {
    await saveStep();
    if (step < STEPS.length - 1) setStep(s => s + 1);
  };

  const handleGalleryUpload = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("photo", file);
    try {
      const r = await api.post("/admin/public-page/gallery", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setGallery(prev => [...prev, r.data.data]);
    } catch (e) { alert("Upload failed: " + (e.response?.data?.message || e.message)); }
  };

  const handleDeleteGallery = async (id) => {
    try {
      await api.delete(`/admin/public-page/gallery/${id}`);
      setGallery(prev => prev.filter(g => g.id !== id));
    } catch (e) { alert("Delete failed"); }
  };

  const handleAddReview = async () => {
    if (!newReview.student_name || !newReview.review_text) return alert("Name and review are required");
    try {
      const r = await api.post("/admin/public-page/reviews", newReview);
      setReviews(prev => [...prev, r.data.data]);
      setNewReview({ student_name: "", review_text: "", rating: 5, achievement: "" });
    } catch (e) { alert(e.response?.data?.message || "Failed to add review"); }
  };

  const handleDeleteReview = async (id) => {
    if (!window.confirm("Delete this review?")) return;
    try {
      await api.delete(`/admin/public-page/reviews/${id}`);
      setReviews(prev => prev.filter(r => r.id !== id));
    } catch (e) { alert("Delete failed"); }
  };

  // Phase 2: Upload faculty image directly
  const handleFacultyImageUpload = async (facultyId, file) => {
    if (!file) return;
    setFacultyImageUploading(prev => ({ ...prev, [facultyId]: true }));
    setFacultyImageMsg(prev => ({ ...prev, [facultyId]: "" }));
    try {
      const fd = new FormData();
      fd.append("photo", file);
      const r = await api.post(`/admin/public-page/faculty-image/${facultyId}`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      // Update local faculty list
      setFaculty(prev => prev.map(f =>
        f.id === facultyId ? { ...f, image_url: r.data.data?.image_url } : f
      ));
      setFacultyImageMsg(prev => ({ ...prev, [facultyId]: "✅ Uploaded!" }));
    } catch (e) {
      setFacultyImageMsg(prev => ({ ...prev, [facultyId]: "❌ " + (e.response?.data?.message || "Upload failed") }));
    } finally {
      setFacultyImageUploading(prev => ({ ...prev, [facultyId]: false }));
    }
  };

  const handleFacultyImageDelete = async (facultyId) => {
    if (!window.confirm("Remove this faculty photo?")) return;
    try {
      await api.delete(`/admin/public-page/faculty-image/${facultyId}`);
      setFaculty(prev => prev.map(f => f.id === facultyId ? { ...f, image_url: null } : f));
      setFacultyImageMsg(prev => ({ ...prev, [facultyId]: "" }));
    } catch (e) { alert("Failed to remove"); }
  };

  const renderFileInput = (label, file, preview, setFile, setPreview, accept = ".jpg,.jpeg,.png,.webp") => (
    <div className="form-row">
      <label>{label}</label>
      <label className="upload-area" style={{ display: "block", cursor: "pointer" }}>
        {preview
          ? <img src={resolveImg(preview)} alt="preview" style={{ width: "100%", maxHeight: "200px", objectFit: "contain", borderRadius: "10px" }} />
          : <div><div style={{ fontSize: "2rem" }}>📸</div><div>Click to upload</div><div className="form-hint">JPG, PNG or WebP · Max 5MB</div></div>
        }
        <input type="file" accept={accept} style={{ display: "none" }} onChange={e => {
          const f = e.target.files[0]; if (!f) return;
          setFile(f); setPreview(URL.createObjectURL(f));
        }} />
      </label>
    </div>
  );

  // ──────────── STEP RENDERS ────────────

  const renderStep0 = () => (
    <div>
      <h3 style={{ marginTop: 0 }}>📋 Basic Institute Info</h3>

      <div style={{ background: "#f8faff", padding: "1.5rem", borderRadius: "10px", border: "1px solid #e8edf5", marginBottom: "1.5rem" }}>
        <h4 style={{ margin: "0 0 1rem 0", color: "#1e3a5f" }}>🌐 Subdomain Setup</h4>
        <div className="form-row">
          <label>Your Public Website Address</label>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input 
              style={{ flex: 1 }}
              placeholder="e.g., iitcoaching" 
              value={form.slug} 
              onChange={e => {
                set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                setSubdomainStatus(null);
              }}
            />
            <span style={{ color: "#64748b", fontWeight: 600 }}>.zenithflows.in</span>
            <button 
              type="button"
              className="btn btn-secondary"
              onClick={() => checkSubdomain(form.slug)}
              disabled={!form.slug || form.slug.length < 3}
            >
              Check
            </button>
          </div>
          {subdomainStatus && (
            <div style={{ marginTop: "8px", fontSize: "0.9rem", color: subdomainStatus.available ? "#10b981" : "#ef4444", fontWeight: 600 }}>
              {subdomainStatus.msg}
            </div>
          )}
          <div className="form-hint" style={{ marginTop: "8px" }}>
            Letters, numbers, and hyphens only. This will be your permanent website link.
          </div>
        </div>
      </div>

      <div className="form-grid-2">
        <div className="form-row">
          <label>Tagline / Motto</label>
          <input placeholder="Excellence Since 2012" value={form.tagline} onChange={e => set("tagline", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Admission Status</label>
          <input placeholder="Admissions Open 2025–26" value={form.admission_status} onChange={e => set("admission_status", e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <label>Short Description (Hero Section)</label>
        <textarea placeholder="A brief description shown on the hero banner..." value={form.description} onChange={e => set("description", e.target.value)} />
      </div>
      <div className="form-row">
        <label>About Text (About Section)</label>
        <textarea rows={4} placeholder="Your detailed institute story..." value={form.about_text} onChange={e => set("about_text", e.target.value)} />
      </div>
      <div className="form-grid-2">
        <div className="form-row">
          <label>Established Year</label>
          <input type="number" min="1900" max="2025" placeholder="2012" value={form.established_year} onChange={e => set("established_year", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Years of Excellence</label>
          <input placeholder="12+" value={form.years_of_excellence} onChange={e => set("years_of_excellence", e.target.value)} />
        </div>
      </div>
      <div className="form-grid-2">
        <div className="form-row">
          <label>Board / Affiliation</label>
          <select
            value={affiliationDropdown}
            onChange={e => {
              const val = e.target.value;
              setAffiliationDropdown(val);
              // If not "Others", update form affiliation directly
              if (val !== "Others") {
                set("affiliation", val);
                setAffiliationCustom("");
              } else {
                // Temporarily set to empty; actual value comes from custom input
                set("affiliation", "");
              }
            }}
          >
            <option value="">Select...</option>
            {AFFILIATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>

          {/* Show custom input when "Others" is selected */}
          {affiliationDropdown === "Others" && (
            <div style={{ marginTop: "0.6rem" }}>
              <input
                id="affiliation-custom-input"
                type="text"
                placeholder="Type your board / affiliation name…"
                value={affiliationCustom}
                maxLength={100}
                autoFocus
                onChange={e => {
                  setAffiliationCustom(e.target.value);
                  set("affiliation", e.target.value);
                }}
                style={{
                  width: "100%",
                  padding: "0.55rem 0.85rem",
                  borderRadius: "8px",
                  border: "1.5px solid var(--primary, #6366f1)",
                  fontSize: ".9rem",
                  outline: "none",
                  boxShadow: "0 0 0 3px rgba(99,102,241,.15)",
                  transition: "border-color .2s, box-shadow .2s",
                  background: "var(--card-bg, #fff)",
                  color: "var(--text-primary)",
                }}
              />
              <div className="form-hint" style={{ marginTop: "0.3rem" }}>
                Enter your board / affiliation name (max 100 characters)
              </div>
            </div>
          )}
        </div>
        <div className="form-row">
          <label>Theme Color (hex)</label>
          <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
            <input type="color" value={`#${form.theme_color}`} style={{ width: 48, height: 38, padding: 2, borderRadius: 8, border: "1px solid var(--border-color)" }}
              onChange={e => set("theme_color", e.target.value.replace("#", ""))} />
            <input value={form.theme_color} onChange={e => set("theme_color", e.target.value.replace("#", ""))} placeholder="0F2340" style={{ flex: 1 }} />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div>
      <h3 style={{ marginTop: 0 }}>📸 Upload Photos</h3>
      <div className="form-grid-2">
        {renderFileInput("Institute Logo (200×200 recommended)", logoFile, logoPreview, setLogoFile, setLogoPreview)}
        {renderFileInput("Cover / Hero Photo (1920×600 recommended)", coverFile, coverPreview, setCoverFile, setCoverPreview)}
      </div>
      <div className="form-row" style={{ marginTop: "1rem" }}>
        <label>Gallery Photos (max 10)</label>
        <div className="gallery-grid">
          {gallery.map(g => (
            <div className="gallery-item" key={g.id}>
              <img src={resolveImg(g.photo_url)} alt={g.label || "gallery"} />
              <button className="remove-btn" onClick={() => handleDeleteGallery(g.id)}>✕</button>
            </div>
          ))}
          {gallery.length < 10 && (
            <label className="upload-area" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", aspectRatio: "1", borderRadius: "10px", cursor: "pointer" }}>
              <span style={{ fontSize: "2rem" }}>+</span>
              <span style={{ fontSize: ".75rem" }}>Add Photo</span>
              <input type="file" accept=".jpg,.jpeg,.png,.webp" style={{ display: "none" }} onChange={e => handleGalleryUpload(e.target.files[0])} />
            </label>
          )}
        </div>
        <div className="form-hint">{gallery.length}/10 photos uploaded</div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <h3 style={{ marginTop: 0 }}>📊 Stats & Achievements</h3>
      <div className="form-grid-2">
        <div className="form-row">
          <label>Total Students Display</label>
          <input placeholder="2,400+" value={form.total_students_display} onChange={e => set("total_students_display", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Board Pass Rate</label>
          <input placeholder="98%" value={form.pass_rate} onChange={e => set("pass_rate", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Competitive Selections</label>
          <input placeholder="450+ JEE/NEET" value={form.competitive_selections} onChange={e => set("competitive_selections", e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <label>USP Points (Up to 5)</label>
        {form.usp_points.map((v, i) => (
          <div className="dynamic-list-item" key={i}>
            <input value={v} onChange={e => setList("usp_points", i, e.target.value)} placeholder={`USP #${i + 1}`} />
            {form.usp_points.length > 1 && <button className="btn-icon-remove" onClick={() => removeListItem("usp_points", i)}>✕</button>}
          </div>
        ))}
        {form.usp_points.length < 5 && <button className="btn btn-sm btn-secondary" onClick={() => addListItem("usp_points")}>+ Add USP</button>}
      </div>
      <div className="form-row">
        <label>Enrollment Benefits (Up to 8)</label>
        {form.enrollment_benefits.map((v, i) => (
          <div className="dynamic-list-item" key={i}>
            <input value={v} onChange={e => setList("enrollment_benefits", i, e.target.value)} placeholder={`Benefit #${i + 1}`} />
            {form.enrollment_benefits.length > 1 && <button className="btn-icon-remove" onClick={() => removeListItem("enrollment_benefits", i)}>✕</button>}
          </div>
        ))}
        {form.enrollment_benefits.length < 8 && <button className="btn btn-sm btn-secondary" onClick={() => addListItem("enrollment_benefits")}>+ Add Benefit</button>}
      </div>
    </div>
  );

  // ── PHASE 1: Course Step ───────────────────────────────────────
  const renderStep3 = () => (
    <div>
      <h3 style={{ marginTop: 0 }}>📚 Courses to Show</h3>

      {/* Auto / Manual Toggle */}
      <div className="course-mode-toggle" style={{ marginBottom: "1.5rem" }}>
        <div className="form-hint" style={{ marginBottom: ".75rem", fontSize: ".85rem", color: "var(--text-secondary)" }}>
          Choose how to display courses on your public page:
        </div>
        <div style={{ display: "flex", gap: ".75rem" }}>
          <button
            type="button"
            className={`mode-btn ${form.course_mode === "auto" ? "mode-btn-active" : ""}`}
            onClick={() => set("course_mode", "auto")}
            style={{
              flex: 1, padding: ".85rem 1rem", borderRadius: "12px", border: "2px solid",
              borderColor: form.course_mode === "auto" ? "var(--primary,#6366f1)" : "var(--border-color)",
              background: form.course_mode === "auto" ? "rgba(99,102,241,.1)" : "transparent",
              cursor: "pointer", transition: "all .2s", textAlign: "left"
            }}>
            <div style={{ fontWeight: 700, fontSize: ".95rem", color: form.course_mode === "auto" ? "var(--primary,#6366f1)" : "var(--text-primary)" }}>
              🔄 Auto (Recommended)
            </div>
            <div style={{ fontSize: ".8rem", color: "var(--text-secondary)", marginTop: ".25rem" }}>
              Automatically displays all subjects from your database
            </div>
          </button>
          <button
            type="button"
            className={`mode-btn ${form.course_mode === "manual" ? "mode-btn-active" : ""}`}
            onClick={() => set("course_mode", "manual")}
            style={{
              flex: 1, padding: ".85rem 1rem", borderRadius: "12px", border: "2px solid",
              borderColor: form.course_mode === "manual" ? "var(--primary,#6366f1)" : "var(--border-color)",
              background: form.course_mode === "manual" ? "rgba(99,102,241,.1)" : "transparent",
              cursor: "pointer", transition: "all .2s", textAlign: "left"
            }}>
            <div style={{ fontWeight: 700, fontSize: ".95rem", color: form.course_mode === "manual" ? "var(--primary,#6366f1)" : "var(--text-primary)" }}>
              ✏️ Manual (Custom)
            </div>
            <div style={{ fontSize: ".8rem", color: "var(--text-secondary)", marginTop: ".25rem" }}>
              Add custom course cards with images, descriptions & details
            </div>
          </button>
        </div>
      </div>

      {/* AUTO MODE */}
      {form.course_mode === "auto" && (
        <>
          {subjects.length === 0
            ? <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)", background: "var(--border-color)", borderRadius: "12px" }}>
                ⚠️ No courses/subjects found. Please add subjects from the <strong>Subjects</strong> section first.
              </div>
            : <div className="check-list">
                {subjects.map(s => (
                  <label className={`check-item ${form.selected_subject_ids.includes(s.id) ? "selected" : ""}`} key={s.id}>
                    <input type="checkbox" checked={form.selected_subject_ids.includes(s.id)} onChange={() => toggleId("selected_subject_ids", s.id)} />
                    <div className="item-info">
                      <div className="item-name">{s.name}</div>
                      <div className="item-sub">Class: {s.Class?.name || "—"}</div>
                    </div>
                  </label>
                ))}
              </div>
          }
          <p className="form-hint" style={{ marginTop: "1rem" }}>Selected: {form.selected_subject_ids.length} of {subjects.length}. Leave all unchecked to show all.</p>
        </>
      )}

      {/* MANUAL MODE */}
      {form.course_mode === "manual" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div className="form-hint">Add up to 10 custom courses. Choose an image for each.</div>
            {manualCourses.length < 10 && (
              <button className="btn btn-sm btn-primary" onClick={addManualCourse}>+ Add Course</button>
            )}
          </div>

          {manualCourses.map((course, idx) => (
            <div key={course.id} className="manual-course-card" style={{
              border: "1px solid var(--border-color)", borderRadius: "14px", padding: "1.25rem",
              marginBottom: "1rem", background: "var(--card-bg,#fff)", position: "relative"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div style={{ fontWeight: 700, fontSize: ".9rem", color: "var(--text-secondary)" }}>Course #{idx + 1}</div>
                {manualCourses.length > 1 && (
                  <button className="btn-icon-remove" onClick={() => removeManualCourse(idx)} style={{ position: "static" }}>✕</button>
                )}
              </div>

              <div className="form-grid-2">
                {/* Course Image picker */}
                <div className="form-row">
                  <label>Course Image</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: ".4rem", marginBottom: ".75rem" }}>
                    {STOCK_COURSE_IMAGES.map((img, i) => (
                      <button
                        key={i}
                        type="button"
                        title={img.label}
                        onClick={() => { updateManualCourse(idx, "stock_image_idx", i); updateManualCourse(idx, "image_url", null); setCourseImageFiles(prev => { const n = { ...prev }; delete n[idx]; return n; }); }}
                        style={{
                          background: img.gradient, border: "3px solid",
                          borderColor: (!courseImageFiles[idx] && !course.image_url && course.stock_image_idx === i) ? "#fff" : "transparent",
                          borderRadius: "8px", aspectRatio: "1", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "1.2rem", boxShadow: (!courseImageFiles[idx] && !course.image_url && course.stock_image_idx === i) ? "0 0 0 3px var(--primary,#6366f1)" : "none",
                          transition: "all .15s"
                        }}>
                        {img.emoji}
                      </button>
                    ))}
                  </div>
                  {/* Custom image upload */}
                  <label className="upload-area" style={{ display: "flex", alignItems: "center", gap: ".75rem", padding: ".75rem 1rem", cursor: "pointer" }}>
                    {(courseImageFiles[idx] || course.image_url) ? (
                      <img
                        src={courseImageFiles[idx] ? URL.createObjectURL(courseImageFiles[idx]) : resolveImg(course.image_url)}
                        alt="course"
                        style={{ width: 50, height: 50, borderRadius: "8px", objectFit: "cover" }}
                      />
                    ) : (
                      <span style={{ fontSize: "1.5rem" }}>📁</span>
                    )}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: ".85rem" }}>Upload Custom Image</div>
                      <div className="form-hint">JPG/PNG · Max 5MB (overrides selection above)</div>
                    </div>
                    <input type="file" accept=".jpg,.jpeg,.png,.webp" style={{ display: "none" }}
                      onChange={e => {
                        const f = e.target.files[0];
                        if (!f) return;
                        setCourseImageFiles(prev => ({ ...prev, [idx]: f }));
                        updateManualCourse(idx, "image_url", null);
                      }} />
                  </label>
                </div>

                {/* Course details */}
                <div>
                  <div className="form-row">
                    <label>Course Name *</label>
                    <input placeholder="e.g. Science Foundation" value={course.name} onChange={e => updateManualCourse(idx, "name", e.target.value)} />
                  </div>
                  <div className="form-row">
                    <label>Badge Label</label>
                    <input placeholder="e.g. Popular / New / JEE/NEET" value={course.badge} onChange={e => updateManualCourse(idx, "badge", e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="form-row">
                <label>Course Description</label>
                <textarea rows={2} placeholder="Brief overview of this course..." value={course.description} onChange={e => updateManualCourse(idx, "description", e.target.value)} />
              </div>

              <div className="form-grid-2" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div className="form-row">
                  <label>Duration (months)</label>
                  <input type="number" min={1} max={60} value={course.duration_months} onChange={e => updateManualCourse(idx, "duration_months", parseInt(e.target.value) || 12)} />
                </div>
                <div className="form-row">
                  <label>Seats Available</label>
                  <input type="number" min={1} max={500} value={course.max_students} onChange={e => updateManualCourse(idx, "max_students", parseInt(e.target.value) || 30)} />
                </div>
                <div className="form-row">
                  <label>Hours per Day</label>
                  <input type="number" min={1} max={12} step={0.5} value={course.hours_per_day} onChange={e => updateManualCourse(idx, "hours_per_day", parseFloat(e.target.value) || 4)} />
                </div>
              </div>
            </div>
          ))}

          {manualCourses.length < 10 && (
            <button className="btn btn-secondary" style={{ width: "100%", padding: ".85rem" }} onClick={addManualCourse}>
              + Add Another Course ({manualCourses.length}/10)
            </button>
          )}
        </div>
      )}
    </div>
  );

  // ── PHASE 2: Faculty Step with image upload ──────────────────
  const renderStep4 = () => (
    <div>
      <h3 style={{ marginTop: 0 }}>👩‍🏫 Select Faculty to Show</h3>

      {/* Auto / Manual Toggle */}
      <div className="course-mode-toggle" style={{ marginBottom: "1.5rem" }}>
        <div className="form-hint" style={{ marginBottom: ".75rem", fontSize: ".85rem", color: "var(--text-secondary)" }}>
          Choose how to display faculty on your public page:
        </div>
        <div style={{ display: "flex", gap: ".75rem" }}>
          <button
            type="button"
            className={`mode-btn ${form.faculty_mode === "auto" ? "mode-btn-active" : ""}`}
            onClick={() => set("faculty_mode", "auto")}
            style={{
              flex: 1, padding: ".85rem 1rem", borderRadius: "12px", border: "2px solid",
              borderColor: form.faculty_mode === "auto" ? "var(--primary,#6366f1)" : "var(--border-color)",
              background: form.faculty_mode === "auto" ? "rgba(99,102,241,.1)" : "transparent",
              cursor: "pointer", transition: "all .2s", textAlign: "left"
            }}>
            <div style={{ fontWeight: 700, fontSize: ".95rem", color: form.faculty_mode === "auto" ? "var(--primary,#6366f1)" : "var(--text-primary)" }}>
              🔄 Auto (Recommended)
            </div>
            <div style={{ fontSize: ".8rem", color: "var(--text-secondary)", marginTop: ".25rem" }}>
              Automatically displays faculty from your database
            </div>
          </button>
          <button
            type="button"
            className={`mode-btn ${form.faculty_mode === "manual" ? "mode-btn-active" : ""}`}
            onClick={() => set("faculty_mode", "manual")}
            style={{
              flex: 1, padding: ".85rem 1rem", borderRadius: "12px", border: "2px solid",
              borderColor: form.faculty_mode === "manual" ? "var(--primary,#6366f1)" : "var(--border-color)",
              background: form.faculty_mode === "manual" ? "rgba(99,102,241,.1)" : "transparent",
              cursor: "pointer", transition: "all .2s", textAlign: "left"
            }}>
            <div style={{ fontWeight: 700, fontSize: ".95rem", color: form.faculty_mode === "manual" ? "var(--primary,#6366f1)" : "var(--text-primary)" }}>
              ✏️ Manual (Custom)
            </div>
            <div style={{ fontSize: ".8rem", color: "var(--text-secondary)", marginTop: ".25rem" }}>
              Add custom faculty cards with images, designations & details
            </div>
          </button>
        </div>
      </div>

      {form.faculty_mode === "auto" && (
        <>
          {faculty.length === 0
            ? <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)", background: "var(--border-color)", borderRadius: "12px" }}>
                ⚠️ No faculty found. Please add faculty from the <strong>Faculty</strong> section first.
              </div>
            : <div style={{ display: "flex", flexDirection: "column", gap: ".75rem" }}>
                {faculty.map(f => (
                  <div
                    key={f.id}
                    className={`faculty-wizard-card ${form.selected_faculty_ids.includes(f.id) ? "selected" : ""}`}
                    style={{
                      border: "1px solid",
                      borderColor: form.selected_faculty_ids.includes(f.id) ? "var(--primary,#6366f1)" : "var(--border-color)",
                      borderRadius: "14px", padding: "1rem 1.25rem",
                      background: form.selected_faculty_ids.includes(f.id) ? "rgba(99,102,241,.06)" : "var(--card-bg,#fff)",
                      transition: "all .2s"
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                      <input
                        type="checkbox"
                        checked={form.selected_faculty_ids.includes(f.id)}
                        onChange={() => toggleId("selected_faculty_ids", f.id)}
                        style={{ width: 18, height: 18, accentColor: "var(--primary,#6366f1)", flexShrink: 0 }}
                      />
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <div style={{
                          width: 56, height: 56, borderRadius: "50%", overflow: "hidden",
                          background: f.image_url ? "transparent" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", fontWeight: 700, fontSize: "1.2rem", flexShrink: 0
                        }}>
                          {f.image_url
                            ? <img src={resolveImg(f.image_url)} alt={f.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : (f.name || "F")[0].toUpperCase()
                          }
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: ".95rem" }}>{f.name}</div>
                        <div style={{ fontSize: ".8rem", color: "var(--text-secondary)" }}>{f.email}</div>
                        {f.designation && <div style={{ fontSize: ".78rem", color: "var(--text-secondary)" }}>{f.designation}</div>}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: ".4rem", flexShrink: 0 }}>
                        <label
                          className="btn btn-sm btn-secondary"
                          style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: ".35rem" }}
                          title="Upload faculty photo">
                          {facultyImageUploading[f.id] ? "Uploading..." : f.image_url ? "📸 Change Photo" : "📸 Upload Photo"}
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp"
                            style={{ display: "none" }}
                            disabled={facultyImageUploading[f.id]}
                            onChange={e => {
                              const file = e.target.files[0];
                              if (file) handleFacultyImageUpload(f.id, file);
                            }}
                          />
                        </label>
                        {f.image_url && (
                          <button
                            className="btn btn-sm btn-danger"
                            style={{ fontSize: ".75rem" }}
                            onClick={() => handleFacultyImageDelete(f.id)}>
                            🗑 Remove
                          </button>
                        )}
                        {facultyImageMsg[f.id] && (
                          <div style={{ fontSize: ".75rem", color: facultyImageMsg[f.id].startsWith("✅") ? "#10b981" : "#ef4444" }}>
                            {facultyImageMsg[f.id]}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
          }
          <p className="form-hint" style={{ marginTop: "1rem" }}>Selected: {form.selected_faculty_ids.length} of {faculty.length}. Leave all unchecked to show all.</p>
        </>
      )}

      {form.faculty_mode === "manual" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div className="form-hint">Add custom faculty members. Choose an image for each.</div>
            {manualFaculty.length < 20 && (
              <button className="btn btn-sm btn-primary" onClick={addManualFaculty}>+ Add Faculty</button>
            )}
          </div>

          {manualFaculty.map((fac, idx) => (
            <div key={fac.id} className="manual-course-card" style={{
              border: "1px solid var(--border-color)", borderRadius: "14px", padding: "1.25rem",
              marginBottom: "1rem", background: "var(--card-bg,#fff)", position: "relative"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div style={{ fontWeight: 700, fontSize: ".9rem", color: "var(--text-secondary)" }}>Faculty #{idx + 1}</div>
                {manualFaculty.length > 1 && (
                  <button className="btn-icon-remove" onClick={() => removeManualFaculty(idx)} style={{ position: "static" }}>✕</button>
                )}
              </div>

              <div className="form-grid-2">
                <div className="form-row">
                  <label>Faculty Image</label>
                  <label className="upload-area" style={{ display: "flex", alignItems: "center", gap: ".75rem", padding: ".75rem 1rem", cursor: "pointer" }}>
                    {(facultyImageFiles[idx] || fac.image_url) ? (
                      <img
                        src={facultyImageFiles[idx] ? URL.createObjectURL(facultyImageFiles[idx]) : resolveImg(fac.image_url)}
                        alt="faculty"
                        style={{ width: 50, height: 50, borderRadius: "50%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ width: 50, height: 50, borderRadius: "50%", background: "var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>
                        👤
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: ".85rem" }}>Upload Photo</div>
                      <div className="form-hint">JPG/PNG · Max 5MB</div>
                    </div>
                    <input type="file" accept=".jpg,.jpeg,.png,.webp" style={{ display: "none" }}
                      onChange={e => {
                        const f = e.target.files[0];
                        if (!f) return;
                        setFacultyImageFiles(prev => ({ ...prev, [idx]: f }));
                        updateManualFaculty(idx, "image_url", null);
                      }} />
                  </label>
                </div>

                <div>
                  <div className="form-row">
                    <label>Faculty Name *</label>
                    <input placeholder="e.g. John Doe" value={fac.name} onChange={e => updateManualFaculty(idx, "name", e.target.value)} />
                  </div>
                  <div className="form-row">
                    <label>Designation</label>
                    <input placeholder="e.g. Senior Mathematics Faculty" value={fac.designation} onChange={e => updateManualFaculty(idx, "designation", e.target.value)} />
                  </div>
                  <div className="form-row">
                    <label>Email / Qualification (Optional)</label>
                    <input placeholder="e.g. M.Sc. Mathematics" value={fac.email} onChange={e => updateManualFaculty(idx, "email", e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          ))}

          {manualFaculty.length < 20 && (
            <button className="btn btn-secondary" style={{ width: "100%", padding: ".85rem" }} onClick={addManualFaculty}>
              + Add Another Faculty ({manualFaculty.length}/20)
            </button>
          )}
        </div>
      )}

      {/* Student Reviews */}
      <div className="form-row" style={{ marginTop: "1.5rem" }}>
        <label>Student Reviews / Testimonials</label>
        {reviews.map(r => (
          <div className="review-card" key={r.id}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{r.student_name}</div>
              <div className="stars">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
              <div style={{ fontSize: ".85rem", marginTop: ".25rem" }}>{r.review_text}</div>
              {r.achievement && <div className="form-hint">{r.achievement}</div>}
            </div>
            <div className="review-actions">
              <button className="btn btn-sm btn-danger" onClick={() => handleDeleteReview(r.id)}>✕</button>
            </div>
          </div>
        ))}
        {reviews.length < 10 && (
          <div style={{ border: "1px solid var(--border-color)", borderRadius: "12px", padding: "1rem", marginTop: ".75rem" }}>
            <div className="form-grid-2">
              <div className="form-row">
                <label>Student Name</label>
                <input value={newReview.student_name} onChange={e => setNewReview(p => ({ ...p, student_name: e.target.value }))} />
              </div>
              <div className="form-row">
                <label>Achievement</label>
                <input placeholder="JEE 2024 - AIR 240" value={newReview.achievement} onChange={e => setNewReview(p => ({ ...p, achievement: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <label>Review Text</label>
              <textarea rows={2} value={newReview.review_text} onChange={e => setNewReview(p => ({ ...p, review_text: e.target.value }))} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <label>Rating: </label>
              {[1, 2, 3, 4, 5].map(n => (
                <span key={n} style={{ cursor: "pointer", fontSize: "1.3rem", color: n <= newReview.rating ? "#f59e0b" : "#d1d5db" }}
                  onClick={() => setNewReview(p => ({ ...p, rating: n }))}>★</span>
              ))}
              <button className="btn btn-sm btn-primary" style={{ marginLeft: "auto" }} onClick={handleAddReview}>+ Add Review</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div>
      <h3 style={{ marginTop: 0 }}>📞 Contact & Social Links</h3>
      <div className="form-row">
        <label>Full Address</label>
        <textarea placeholder="123 Main St, City, State - 400001" value={form.contact_address} onChange={e => set("contact_address", e.target.value)} />
      </div>
      <div className="form-grid-2">
        <div className="form-row">
          <label>Phone Number</label>
          <input placeholder="+91 98765 43210" value={form.contact_phone} onChange={e => set("contact_phone", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Email Address</label>
          <input type="email" placeholder="info@institute.com" value={form.contact_email} onChange={e => set("contact_email", e.target.value)} />
        </div>
        <div className="form-row">
          <label>WhatsApp Number (10 digits)</label>
          <input placeholder="9876543210" value={form.whatsapp_number} onChange={e => set("whatsapp_number", e.target.value)} />
          <div className="form-hint">Used for WhatsApp floating button on your public page</div>
        </div>
        <div className="form-row">
          <label>Working Hours</label>
          <input placeholder="Mon–Sat 7AM–9PM" value={form.working_hours} onChange={e => set("working_hours", e.target.value)} />
        </div>
      </div>

      {/* Phase 3 – Map embed URL with helper */}
      <div className="form-row">
        <label>Google Maps URL or Embed URL</label>
        <input
          placeholder="Paste Google Maps link or embed URL"
          value={form.map_embed_url}
          onChange={e => set("map_embed_url", e.target.value)}
        />
        <div className="form-hint" style={{ marginTop: ".5rem" }}>
          💡 <strong>How to get your map link:</strong> Open <a href="https://maps.google.com" target="_blank" rel="noreferrer" style={{ color: "var(--primary,#6366f1)" }}>Google Maps</a>
          &nbsp;→ Search your institute → Click <strong>Share</strong> → Copy any link. We will automatically convert it to an embed URL.
        </div>
        {form.map_embed_url && (
          <div style={{ marginTop: ".75rem", borderRadius: "12px", overflow: "hidden", height: 200, border: "1px solid var(--border-color)" }}>
            <iframe
              src={buildPreviewMapUrl(form.map_embed_url)}
              title="Map Preview"
              style={{ width: "100%", height: "100%", border: 0 }}
              allowFullScreen
              loading="lazy"
            />
          </div>
        )}
      </div>

      {/* Phase 4 – YouTube intro video */}
      <div className="form-row" style={{ marginTop: "1rem" }}>
        <label>🎬 YouTube Intro Video</label>
        <input
          placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
          value={form.youtube_intro_url}
          onChange={e => set("youtube_intro_url", e.target.value)}
        />
        <div className="form-hint">
          Paste any YouTube video link. Supports watch, youtu.be, Shorts, and Live URLs.
        </div>
        {form.youtube_intro_url && buildYtPreviewUrl(form.youtube_intro_url) && (
          <div style={{ marginTop: ".75rem", borderRadius: "12px", overflow: "hidden", aspectRatio: "16/9", maxHeight: 240, border: "1px solid var(--border-color)" }}>
            <iframe
              src={buildYtPreviewUrl(form.youtube_intro_url)}
              title="YouTube Preview"
              style={{ width: "100%", height: "100%", border: 0 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
        {form.youtube_intro_url && !buildYtPreviewUrl(form.youtube_intro_url) && (
          <div style={{ color: "#f59e0b", fontSize: ".83rem", marginTop: ".4rem" }}>
            ⚠️ Could not parse YouTube URL. Please use a standard YouTube link.
          </div>
        )}
      </div>

      <div className="form-grid-2">
        <div className="form-row">
          <label>Facebook URL</label>
          <input placeholder="https://facebook.com/..." value={form.social_facebook} onChange={e => set("social_facebook", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Instagram URL</label>
          <input placeholder="https://instagram.com/..." value={form.social_instagram} onChange={e => set("social_instagram", e.target.value)} />
        </div>
        <div className="form-row">
          <label>YouTube Channel URL</label>
          <input placeholder="https://youtube.com/..." value={form.social_youtube} onChange={e => set("social_youtube", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Footer Description</label>
          <input placeholder="Empowering students since 2012" value={form.footer_description} onChange={e => set("footer_description", e.target.value)} />
        </div>
      </div>
      <div className="form-grid-2">
        <div className="form-row">
          <label>SEO Title</label>
          <input placeholder="Bright Future Academy | Best Coaching in City" value={form.seo_title} onChange={e => set("seo_title", e.target.value)} />
        </div>
        <div className="form-row">
          <label>SEO Description</label>
          <input placeholder="Top-ranked coaching with 98% pass rate..." value={form.seo_description} onChange={e => set("seo_description", e.target.value)} />
        </div>
      </div>
    </div>
  );

  const renderStep6 = () => {
    const checks = [
      { label: "Tagline added", done: !!form.tagline },
      { label: "Description added", done: !!form.description },
      { label: "Logo uploaded", done: !!(logoPreview || form.logo_url) },
      { label: "Contact phone added", done: !!form.contact_phone },
      { label: "Address added", done: !!form.contact_address },
      { label: form.course_mode === "manual" ? "At least 1 manual course added" : "At least 1 course selected",
        done: form.course_mode === "manual" ? manualCourses.some(c => c.name.trim()) : (form.selected_subject_ids.length > 0 || subjects.length === 0) },
    ];
    const allGood = checks.every(c => c.done);
    return (
      <div>
        <h3 style={{ marginTop: 0 }}>🚀 Review & Publish</h3>
        <div className="publish-preview">
          <div className="preview-hero" style={{ background: `linear-gradient(135deg, #${form.theme_color}, #1e3a5f)` }}>
            <div className="logo-circle">
              {logoPreview ? <img src={resolveImg(logoPreview)} alt="logo" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : "🏫"}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{existingData?.name || "Your Institute"}</div>
              <div style={{ opacity: .8, fontSize: ".85rem" }}>{form.tagline || "Your tagline here"}</div>
              <div style={{ fontSize: ".75rem", opacity: .6, marginTop: ".25rem" }}>
                yourdomain.com/i/{existingData?.slug || "your-institute"}
              </div>
            </div>
          </div>
          <div className="publish-checklist">
            <div style={{ fontWeight: 700, marginBottom: ".75rem" }}>Page Readiness Checklist</div>
            {checks.map((c, i) => (
              <div className="checklist-item" key={i}>
                <span className="ci-icon">{c.done ? "✅" : "⚠️"}</span>
                <span style={{ color: c.done ? "var(--text-primary)" : "#f59e0b" }}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>
        {msg && <div style={{ padding: ".75rem 1rem", borderRadius: "10px", background: "rgba(99,102,241,.1)", marginBottom: "1rem", fontWeight: 600 }}>{msg}</div>}
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={() => saveStep(false)} disabled={saving}>
            {saving ? "Saving..." : "💾 Save as Draft"}
          </button>
          <button className="btn btn-success" onClick={() => saveStep(true)} disabled={saving || !allGood}>
            {saving ? "Publishing..." : "🚀 Publish Now"}
          </button>
          {!allGood && <span style={{ fontSize: ".8rem", color: "var(--text-secondary)", alignSelf: "center" }}>Complete all checklist items to publish</span>}
        </div>
      </div>
    );
  };

  const stepRenders = [renderStep0, renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6];

  return (
    <div className="wizard-wrapper">
      {/* Progress bar */}
      <div className="wizard-progress">
        <div className="wizard-steps-bar">
          {STEPS.map((s, i) => (
            <div className={`wizard-step-item ${i < step ? "done" : ""} ${i === step ? "active" : ""}`} key={i} onClick={() => setStep(i)} style={{ cursor: "pointer" }}>
              <span style={{ fontSize: ".7rem", marginTop: ".2rem" }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step body */}
      <div className="wizard-body">
        {stepRenders[step]()}
      </div>

      {/* Footer nav */}
      <div className="wizard-footer">
        <button className="btn btn-secondary" onClick={() => setStep(s => s - 1)} disabled={step === 0}>← Back</button>
        <span style={{ fontSize: ".8rem", color: "var(--text-secondary)" }}>Step {step + 1} of {STEPS.length}</span>
        {step < STEPS.length - 1
          ? <button className="btn btn-primary" onClick={handleNext} disabled={saving}>{saving ? "Saving..." : "Save & Next →"}</button>
          : null
        }
      </div>
    </div>
  );
}

// ── Client-side YouTube embed URL builder (for preview) ──────────
function buildYtPreviewUrl(url) {
  if (!url || !url.trim()) return null;
  url = url.trim();
  if (url.includes('youtube.com/embed/')) return url;
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}?rel=0`;
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}?rel=0`;
  const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}?rel=0`;
  const liveMatch = url.match(/\/live\/([a-zA-Z0-9_-]{11})/);
  if (liveMatch) return `https://www.youtube.com/embed/${liveMatch[1]}?rel=0`;
  return null;
}

// ── Client-side map URL normalizer (for preview) ─────────────────
function buildPreviewMapUrl(url) {
  if (!url || !url.trim()) return '';
  url = url.trim();
  if (url.includes('/maps/embed')) return url;
  const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (coordMatch) return `https://maps.google.com/maps?q=${coordMatch[1]},${coordMatch[2]}&output=embed`;
  const placeMatch = url.match(/\/place\/([^/@?]+)/);
  if (placeMatch) return `https://maps.google.com/maps?q=${encodeURIComponent(placeMatch[1].replace(/\+/g, ' '))}&output=embed`;
  if (url.includes('google.com/maps')) return `https://maps.google.com/maps?q=${encodeURIComponent(url)}&output=embed`;
  return url;
}
