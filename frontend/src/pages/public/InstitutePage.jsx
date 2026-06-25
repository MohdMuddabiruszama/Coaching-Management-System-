/**
 * Institute Public Page — Public-facing component
 * Route: /i/:slug
 * Phase 1: Manual/Auto courses with images + details
 * Phase 2: Faculty photos displayed
 * Phase 3: Map URL auto-fixed on backend
 * Phase 4: YouTube intro video section before About
 */
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./InstitutePage.css";

const API_BASE = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : 'https://institutes-saas.onrender.com/api')).replace(/\/$/, '');
const resolveImg = (url) => {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  return API_BASE.replace('/api', '') + url;
};
const CLASS_OPTIONS = ["8th", "9th", "10th", "11th", "12th", "Dropper", "Other"];

// Stock course gradients matching wizard
const STOCK_GRADIENTS = [
  "linear-gradient(135deg,#1a6fa8,#1e88e5)",
  "linear-gradient(135deg,#6a1b9a,#9c27b0)",
  "linear-gradient(135deg,#00695c,#26a69a)",
  "linear-gradient(135deg,#bf360c,#e64a19)",
  "linear-gradient(135deg,#283593,#3f51b5)",
  "linear-gradient(135deg,#4e342e,#795548)",
  "linear-gradient(135deg,#006064,#00acc1)",
  "linear-gradient(135deg,#e65100,#f57c00)",
  "linear-gradient(135deg,#1b5e20,#43a047)",
  "linear-gradient(135deg,#1565c0,#1976d2)",
];
const STOCK_EMOJIS = ["🔬", "📐", "💼", "🎨", "🏆", "📖", "💻", "🏛️", "🧬", "⚛️"];

// ── Scroll Reveal Hook ────────────────────────────────────────────
function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.pub-reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

// ── Loading Skeleton ──────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ minHeight: "100vh", background: "#f8faff" }}>
      <div style={{ height: 60, background: "rgba(255,255,255,0.96)" }} />
      <div style={{ height: 520, background: "linear-gradient(135deg,#0f2340,#1e3a5f)" }} />
    </div>
  );
}

// ── Star Rating ───────────────────────────────────────────────────
function Stars({ rating }) {
  return (
    <span className="pub-stars">
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────
export default function InstitutePage({ subdomain }) {
  const { slug: urlSlug } = useParams();
  const navigate = useNavigate();

  const activeSlug = subdomain || urlSlug;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Enquiry form state
  const [form, setForm] = useState({ first_name: "", last_name: "", mobile: "", email: "", course_interest: "", current_class: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState("");

  const enqRef = useRef(null);
  const contentRef = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useScrollReveal();

  useEffect(() => {
    const fetchData = async () => {
      if (!activeSlug) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/public/${activeSlug}`);
        if (res.status === 404) {
          navigate("/404", { replace: true });
          return;
        }
        const json = await res.json();
        if (json.error === "NOT_FOUND" || !json.data?.is_published) {
          navigate("/404", { replace: true });
          return;
        }
        if (!res.ok || !json.success) {
          setError("server");
          return;
        }
        setData(json.data);
        // Update document head for SEO
        document.title = json.data.seo_title || `${json.data.name} — Institute`;
        const metaDesc = document.querySelector("meta[name='description']");
        if (metaDesc) metaDesc.setAttribute("content", json.data.seo_description || json.data.description || "");
      } catch (e) {
        // Network error — backend unreachable
        setError("network");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeSlug, navigate, retryCount]);

  // Active Link on Scroll
  useEffect(() => {
    if (!data) return;
    const handleScroll = () => {
      const sections = document.querySelectorAll('section[id], div[id]');
      const navLinks = document.querySelectorAll('.pub-nav-links a');
      let cur = '';
      sections.forEach(s => {
        if (window.scrollY >= s.offsetTop - 100) cur = s.id;
      });
      navLinks.forEach(a => {
        const isActive = a.getAttribute('href') === '#' + cur;
        a.style.color = isActive ? 'var(--pub-primary)' : '';
        a.style.fontWeight = isActive ? '700' : '';
      });
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [data]);

  // Re-run scroll pub-reveal after data load
  useEffect(() => {
    if (data) {
      setTimeout(() => {
        const els = document.querySelectorAll('.pub-reveal');
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach(e => {
              if (e.isIntersecting) {
                e.target.classList.add('visible');
                observer.unobserve(e.target);
              }
            });
          },
          { threshold: 0.12 }
        );
        els.forEach(el => observer.observe(el));
      }, 100);
    }
  }, [data]);

  const scrollToEnq = () => {
    enqRef.current?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  };
  const handleNavLink = (e) => { setMobileMenuOpen(false); };

  const handleEnqSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.first_name.trim()) return setFormError("Name is required");
    if (!/^[6-9]\d{9}$/.test(form.mobile)) return setFormError("Enter valid 10-digit mobile number");

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/public/${activeSlug}/enquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        setSubmitted(true);
      } else {
        setFormError(json.message || "Submission failed");
      }
    } catch (e) {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Skeleton />;
  if (error) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8faff', padding: '2rem'
    }}>
      <div style={{
        textAlign: 'center', maxWidth: 480,
        background: 'white', borderRadius: 20,
        padding: '3rem 2.5rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        border: '1px solid #e8edf5'
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>
          {error === 'network' ? '🌐' : '⚠️'}
        </div>
        <h2 style={{ color: '#1e3a5f', marginBottom: '0.75rem', fontSize: '1.5rem', fontWeight: 800 }}>
          {error === 'network' ? 'Connection Error' : 'Page Unavailable'}
        </h2>
        <p style={{ color: '#64748b', lineHeight: 1.7, marginBottom: '1.75rem', fontSize: '0.95rem' }}>
          {error === 'network'
            ? 'Unable to reach the server. Please check your internet connection and try again.'
            : 'The page could not be loaded due to a server error. Please try again in a moment.'}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
          onClick={() => { setError(null); setLoading(true); setRetryCount(c => c + 1); }}
            style={{
              background: 'linear-gradient(135deg,#1a3c5e,#2563eb)',
              color: 'white', border: 'none', borderRadius: 10,
              padding: '0.75rem 1.75rem', cursor: 'pointer',
              fontWeight: 700, fontSize: '0.95rem'
            }}
          >
            🔄 Try Again
          </button>
          <button
            onClick={() => window.history.back()}
            style={{
              background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0',
              borderRadius: 10, padding: '0.75rem 1.75rem', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.95rem'
            }}
          >
            ← Go Back
          </button>
        </div>
      </div>
    </div>
  );
  if (!data) return null;

  const logoInitial = (data.name || "I").split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const hasCourses = data.courses?.length > 0;
  const hasFaculty = data.faculty?.length > 0;
  const hasYoutube = !!data.youtube_embed_url;

  return (
    <div className="ipage-root" ref={contentRef}>
      {/* ── Navbar ── */}
      <nav className="pub-nav">
        <div className="pub-nav-brand">
          <div className="pub-nav-logo">
            {data.logo_url ? <img src={resolveImg(data.logo_url)} alt="logo" /> : logoInitial}
          </div>
          <div>
            <div className="pub-nav-name">{data.name}</div>
            {data.tagline && <div className="pub-nav-tagline">{data.tagline}</div>}
          </div>
        </div>

        <ul className="pub-nav-links">
          <li><a href="#about">About</a></li>
          {hasYoutube && <li><a href="#video">Video</a></li>}
          {hasCourses && <li><a href="#courses">Courses</a></li>}
          {hasFaculty && <li><a href="#faculty">Faculty</a></li>}
          {data.gallery?.length > 0 && <li><a href="#gallery">Gallery</a></li>}
          <li><a href="#contact">Contact</a></li>
        </ul>

        <div className="pub-nav-cta">
          <button className="pub-btn-primary" onClick={scrollToEnq}>Enroll Now</button>
        </div>

        {/* Hamburger — shown only on mobile via CSS */}
        <button
          className={`pub-nav-hamburger ${mobileMenuOpen ? 'open' : ''}`}
          onClick={() => setMobileMenuOpen(o => !o)}
          aria-label="Toggle navigation menu"
        >
          <span /><span /><span />
        </button>
      </nav>

      {/* ── Mobile Menu Drawer ── */}
      {mobileMenuOpen && (
        <div className="pub-mobile-menu open" onClick={() => setMobileMenuOpen(false)}>
          <div className="pub-mobile-overlay" />
          <div className="pub-mobile-drawer" onClick={e => e.stopPropagation()}>
            <button className="pub-mobile-close" onClick={() => setMobileMenuOpen(false)}>✕</button>
            <a href="#about" onClick={handleNavLink}>About</a>
            {hasYoutube && <a href="#video" onClick={handleNavLink}>Video</a>}
            {hasCourses && <a href="#courses" onClick={handleNavLink}>Courses</a>}
            {hasFaculty && <a href="#faculty" onClick={handleNavLink}>Faculty</a>}
            {data.gallery?.length > 0 && <a href="#gallery" onClick={handleNavLink}>Gallery</a>}
            <a href="#contact" onClick={handleNavLink}>Contact</a>
            <button className="pub-btn-primary" onClick={scrollToEnq}>Enroll Now</button>
          </div>
        </div>
      )}

      {/* ── Hero ── */}
      <section className="pub-hero" id="home">
        <div className="pub-hero-bg" style={{
          background: `linear-gradient(125deg, #${data.theme_color || '1a3c5e'} 0%, #0f2640 55%, #${data.theme_color || '1a3c5e'} 100%)`
        }}></div>
        <div className="pub-hero-blob"></div>

        <div className="pub-hero-left">
          {data.admission_status && (
            <div className="pub-hero-badge">
              <div className="pub-badge-dot"></div>
              {data.admission_status}
            </div>
          )}
          <h1 className="pub-hero-title">{data.name}</h1>
          {data.description && <p className="pub-hero-desc">{data.description}</p>}

          {(data.stats?.students || data.stats?.pass_rate || data.stats?.selections || data.stats?.years) && (
            <div className="pub-hero-stats">
              {data.stats.students && <div><div className="pub-stat-num">{data.stats.students}</div><div className="pub-stat-label">Students</div></div>}
              {data.stats.pass_rate && <div><div className="pub-stat-num">{data.stats.pass_rate}</div><div className="pub-stat-label">Pass Rate</div></div>}
              {data.stats.selections && <div><div className="pub-stat-num">{data.stats.selections}</div><div className="pub-stat-label">Selections</div></div>}
              {data.stats.years && <div><div className="pub-stat-num">{data.stats.years}</div><div className="pub-stat-label">Years</div></div>}
            </div>
          )}

          <div className="pub-hero-actions">
            <button className="pub-btn-primary" style={{ padding: '15px 36px', fontSize: '16px' }} onClick={scrollToEnq}>Enquire Now</button>
            {data.contact?.whatsapp && (
              <a href={`https://wa.me/91${data.contact.whatsapp}`} target="_blank" rel="noopener noreferrer" className="pub-btn-outline" style={{ padding: '15px 36px', fontSize: '16px', color: 'white', borderColor: 'rgba(255,255,255,.4)' }}>
                💬 WhatsApp
              </a>
            )}
          </div>
        </div>

        <div className="pub-hero-card">
          {data.cover_photo_url ? (
            <div className="pub-hero-img-wrap">
              <img src={resolveImg(data.cover_photo_url)} alt="cover" />
            </div>
          ) : (
            <div className="pub-hero-img-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', color: 'white' }}>
              🏫
            </div>
          )}
          {data.contact?.address && (
            <div className="pub-quick-info-row">
              <div className="pub-quick-icon">📍</div>
              <div>
                <div className="pub-quick-text-title">Location</div>
                <div className="pub-quick-text-val">{data.contact.address}</div>
              </div>
            </div>
          )}
          {data.contact?.phone && (
            <div className="pub-quick-info-row">
              <div className="pub-quick-icon">📞</div>
              <div>
                <div className="pub-quick-text-title">Call Us</div>
                <div className="pub-quick-text-val">{data.contact.phone}</div>
              </div>
            </div>
          )}
          {data.affiliation && (
            <div className="pub-quick-info-row">
              <div className="pub-quick-icon">🎓</div>
              <div>
                <div className="pub-quick-text-title">Affiliation</div>
                <div className="pub-quick-text-val">{data.affiliation}</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          PHASE 4 — YouTube Intro Video Section
          Appears BEFORE the About (pub-section) section
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {hasYoutube && (
        <section className="pub-yt-section pub-reveal" id="video">
          <div className="pub-yt-inner">
            <div className="pub-section-label" style={{ textAlign: 'center' }}>WATCH & LEARN</div>
            <h2 className="pub-section-title" style={{ textAlign: 'center' }}>See What We're About</h2>
            <p className="pub-yt-subtitle pub-reveal" style={{ transitionDelay: '.1s' }}>
              Get a glimpse of our campus, teaching style, and student achievements.
            </p>
            <div className="pub-yt-embed-wrap pub-reveal" style={{ transitionDelay: '.2s' }}>
              <div className="pub-yt-frame-container">
                <iframe
                  src={data.youtube_embed_url}
                  title={`${data.name} — Introduction Video`}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
              <div className="pub-yt-glow" style={{ background: `radial-gradient(ellipse at center, #${data.theme_color || '1a3c5e'}55 0%, transparent 70%)` }} />
            </div>
          </div>
        </section>
      )}

      {/* ── About ── */}
      <section className="pub-section" id="about">
        <div className="pub-section-label pub-reveal">ABOUT US</div>
        <h2 className="pub-section-title pub-reveal" style={{ transitionDelay: '0.1s' }}>Why we are the best choice.</h2>
        <div className="pub-about-grid">
          <div className="pub-about-images pub-reveal" style={{ transitionDelay: '0.2s' }}>
            <div className="pub-about-img tall">
              {data.gallery?.[0] ? <img src={resolveImg(data.gallery[0].photo_url)} alt="campus" /> : <div style={{ fontSize: '30px' }}>🏫</div>}
              {data.gallery?.[0]?.label && <div className="pub-about-img-label">{data.gallery[0].label}</div>}
            </div>
            <div className="pub-about-img">
              {data.gallery?.[1] ? <img src={resolveImg(data.gallery[1].photo_url)} alt="campus" /> : <div style={{ fontSize: '30px' }}>📚</div>}
              {data.gallery?.[1]?.label && <div className="pub-about-img-label">{data.gallery[1].label}</div>}
            </div>
            <div className="pub-about-img">
              {data.gallery?.[2] ? <img src={resolveImg(data.gallery[2].photo_url)} alt="campus" /> : <div style={{ fontSize: '30px' }}>👩‍🏫</div>}
              {data.gallery?.[2]?.label && <div className="pub-about-img-label">{data.gallery[2].label}</div>}
            </div>
          </div>
          <div className="pub-reveal" style={{ transitionDelay: '0.3s' }}>
            <p style={{ fontSize: '17px', color: 'var(--muted)', lineHeight: '1.7', marginBottom: '16px' }}>{data.description}</p>
            {data.usp_points?.filter(Boolean).length > 0 && (
              <ul className="pub-value-list">
                {data.usp_points.filter(Boolean).map((usp, i) => {
                  let parsed = String(usp);
                  let icon = "✨";
                  if (parsed.includes("||")) {
                    const parts = parsed.split("||");
                    icon = parts[0] || "✨";
                    parsed = parts.slice(1).join("||");
                  }
                  let title = parsed;
                  let desc = "";
                  if (parsed.includes(":")) {
                    [title, desc] = parsed.split(":");
                  }
                  return (
                    <li key={i} className="pub-value-item pub-reveal" style={{ transitionDelay: `${0.4 + i * 0.1}s` }}>
                      <div className="pub-value-icon">{icon}</div>
                      <div className="pub-value-text">
                        <strong>{title.trim()}</strong>
                        {desc && <p>{desc.trim()}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ── Courses (Phase 1 — auto + manual with images) ── */}
      {hasCourses && (
        <section className="pub-courses-section pub-reveal" id="courses">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '48px' }}>
            <div>
              <div className="pub-section-label" style={{ textAlign: 'left' }}>OUR PROGRAMS</div>
              <h2 className="pub-section-title" style={{ textAlign: 'left', marginBottom: 0 }}>Courses Offered</h2>
            </div>
            <button className="pub-btn-outline" onClick={scrollToEnq}>Enroll Now</button>
          </div>
          <div className="pub-courses-grid">
            {data.courses.map((c, i) => {
              // For manual courses: use uploaded image_url or stock_image_idx
              const isManual = data.course_mode === 'manual';
              const hasCustomImg = isManual && c.image_url;
              const stockIdx = (c.stock_image_idx !== undefined && c.stock_image_idx !== null) ? c.stock_image_idx : (i % 10);
              const bgGradient = STOCK_GRADIENTS[stockIdx] || STOCK_GRADIENTS[i % 10];
              const emoji = STOCK_EMOJIS[stockIdx] || STOCK_EMOJIS[i % 10];

              // Auto mode: guess theme from name
              let autoBg = "linear-gradient(135deg,#1f4b7a,#2c659e)";
              let autoIcon = "🏛️";
              let autoBadge = c.class_name || "Popular";
              if (!isManual) {
                const nl = c.name.toLowerCase();
                if (nl.includes("science") || nl.includes("pcm") || nl.includes("pcb")) { autoBg = "linear-gradient(135deg,#23608f,#1a4e7a)"; autoIcon = "🔬"; autoBadge = "Popular"; }
                else if (nl.includes("jee") || nl.includes("neet")) { autoBg = "linear-gradient(135deg,#8b5cf6,#a855f7)"; autoIcon = "📐"; autoBadge = "JEE/NEET"; }
                else if (nl.includes("commerce")) { autoBg = "linear-gradient(135deg,#059669,#10b981)"; autoIcon = "💼"; autoBadge = "New"; }
                else if (nl.includes("mpsc") || nl.includes("bank")) { autoBg = "linear-gradient(135deg,#ea580c,#f97316)"; autoIcon = "🏛️"; }
              }

              return (
                <div className="pub-course-card pub-reveal" key={c.id || i} style={{ transitionDelay: `${i * 0.1}s` }} onClick={scrollToEnq}>
                  <div className="pub-course-thumb" style={{ background: isManual ? bgGradient : autoBg, overflow: 'hidden', position: 'relative' }}>
                    {hasCustomImg && (
                      <img src={resolveImg(c.image_url)} alt={c.name}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: .85 }} />
                    )}
                    <div className="pub-course-badge">{isManual ? (c.badge || "Course") : autoBadge}</div>
                    <div className="pub-course-icon" style={{ position: 'relative', zIndex: 1 }}>{isManual ? emoji : autoIcon}</div>
                  </div>
                  <div className="pub-course-content">
                    <div className="pub-course-name">{c.name}</div>
                    <div className="pub-course-desc">
                      {c.description || "Comprehensive coverage of all essential topics designed to build strong foundations and achieve excellent results."}
                    </div>
                    <div className="pub-course-meta">
                      {isManual ? (
                        <>
                          <span>📅 {c.duration_months ? `${c.duration_months >= 12 ? Math.round(c.duration_months / 12) + ' Year' : c.duration_months + ' Mo'}` : "1 Year"}</span>
                          <span>👥 {c.max_students || "30"} Seats</span>
                          <span>⏰ {c.hours_per_day || 4} hrs/day</span>
                        </>
                      ) : (
                        <>
                          <span>📅 {c.duration_months ? `${Math.ceil(c.duration_months / 12)} Year` : "1 Year"}</span>
                          <span>👥 {c.max_students || "30"} Seats</span>
                          <span>⏰ 4 hrs/day</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="pub-course-footer">
                    <button className="pub-course-enquire-btn">Enquire</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Achievements Strip ── */}
      {(data.stats?.students || data.stats?.pass_rate || data.stats?.selections || data.stats?.years) && (
        <div className="pub-achievements-strip pub-reveal">
          {data.stats.students && <div><div className="pub-ach-num">{data.stats.students}</div><div className="pub-ach-label">Students Mentored</div></div>}
          {data.stats.pass_rate && <div><div className="pub-ach-num">{data.stats.pass_rate}</div><div className="pub-ach-label">Board Pass Rate</div></div>}
          {data.stats.selections && <div><div className="pub-ach-num">{data.stats.selections}</div><div className="pub-ach-label">Top Selections</div></div>}
          {data.stats.years && <div><div className="pub-ach-num">{data.stats.years}</div><div className="pub-ach-label">Years of Excellence</div></div>}
        </div>
      )}

      {/* ── Faculty (Phase 2 — show photo if uploaded) ── */}
      {hasFaculty && (
        <section className="pub-section" id="faculty" style={{ paddingTop: 0 }}>
          <div className="pub-section-label pub-reveal">MENTORS</div>
          <h2 className="pub-section-title pub-reveal">Our Expert Faculty</h2>
          <div className="pub-faculty-grid">
            {data.faculty.map((f, i) => {
              const facInitials = f.name?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'F';
              return (
                <div className="pub-faculty-card pub-reveal" key={f.id || i} style={{ transitionDelay: `${i * 0.1}s` }}>
                  <div className="pub-faculty-avatar" style={{ overflow: f.image_url ? 'hidden' : 'visible', background: f.image_url ? 'transparent' : 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                    {f.image_url
                      ? <img src={resolveImg(f.image_url)} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : facInitials
                    }
                  </div>
                  <div className="pub-fac-name">{f.name}</div>
                  {f.designation && <div className="pub-fac-designation">{f.designation}</div>}
                  {f.subject && <div className="pub-fac-sub">{f.subject}</div>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Gallery ── */}
      {data.gallery?.length > 0 && (
        <section className="pub-section" id="gallery" style={{ background: 'white' }}>
          <div className="pub-section-label pub-reveal">CAMPUS</div>
          <h2 className="pub-section-title pub-reveal">Life at {data.name}</h2>
          <div className="pub-gallery-grid">
            {data.gallery.slice(0, 6).map((g, i) => (
              <div key={g.id || i} className="pub-gallery-item pub-reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
                <img src={resolveImg(g.photo_url)} alt={g.label || "campus"} loading="lazy" />
                {g.label && <div className="pub-gallery-overlay">{g.label}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Reviews ── */}
      {data.reviews?.length > 0 && (
        <section className="pub-section" id="reviews">
          <div className="pub-section-label pub-reveal">TESTIMONIALS</div>
          <h2 className="pub-section-title pub-reveal">What Students Say</h2>
          <div className="pub-reviews-grid">
            {data.reviews.map((r, i) => (
              <div className="pub-review-card pub-reveal" key={r.id || i} style={{ transitionDelay: `${i * 0.1}s` }}>
                <Stars rating={r.rating} />
                <p className="pub-review-text">"{r.review_text}"</p>
                <div className="pub-reviewer-line">
                  <div className="pub-reviewer-avatar">
                    {(r.student_name || "S")[0]}
                  </div>
                  <div className="pub-reviewer-info">
                    <strong>{r.student_name}</strong>
                    {r.achievement && <span>{r.achievement}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Enroll CTA + Form ── */}
      <section className="pub-enroll-cta" ref={enqRef} id="enquiry">
        <div className="pub-enroll-left pub-reveal">
          <h2>Ready to Join? <br />Enquire Today!</h2>
          {data.enrollment_benefits?.filter(Boolean).length > 0 && (
            <ul className="pub-enroll-features">
              {data.enrollment_benefits.filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          )}
          {data.contact?.whatsapp && (
            <a href={`https://wa.me/91${data.contact.whatsapp}`} target="_blank" rel="noopener noreferrer"
              className="pub-btn-primary" style={{ marginTop: '24px' }}>
              💬 Direct WhatsApp
            </a>
          )}
        </div>
        <div className="pub-form-card pub-reveal" style={{ transitionDelay: '0.2s' }}>
          <h3>📋 Send Enquiry</h3>
          {submitted ? (
            <div style={{ textAlign: "center", padding: "2rem 0" }}>
              <div style={{ fontSize: "3rem" }}>🎉</div>
              <h4 style={{ color: "var(--success)", marginBottom: "8px", fontSize: '20px' }}>Enquiry Submitted!</h4>
              <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "24px" }}>We'll contact you soon. Check your WhatsApp!</p>
              <button className="pub-submit-btn" onClick={() => setSubmitted(false)}>Submit Another</button>
            </div>
          ) : (
            <form onSubmit={handleEnqSubmit}>
              <div className="pub-form-row">
                <div className="pub-form-group">
                  <label className="pub-form-label">First Name *</label>
                  <input className="pub-form-input" value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} placeholder="Rahul" required />
                </div>
                <div className="pub-form-group">
                  <label className="pub-form-label">Last Name</label>
                  <input className="pub-form-input" value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} placeholder="Sharma" />
                </div>
              </div>
              <div className="pub-form-group">
                <label className="pub-form-label">Mobile Number *</label>
                <input className="pub-form-input" value={form.mobile} onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))} placeholder="9876543210" maxLength={10} required />
              </div>
              <div className="pub-form-group">
                <label className="pub-form-label">Email</label>
                <input className="pub-form-input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="rahul@email.com" />
              </div>
              <div className="pub-form-row">
                {data.courses?.length > 0 && (
                  <div className="pub-form-group">
                    <label className="pub-form-label">Course</label>
                    <select className="pub-form-select" value={form.course_interest} onChange={e => setForm(p => ({ ...p, course_interest: e.target.value }))}>
                      <option value="">Select...</option>
                      {data.courses.map((c, i) => <option key={i} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="pub-form-group">
                  <label className="pub-form-label">Class</label>
                  <select className="pub-form-select" value={form.current_class} onChange={e => setForm(p => ({ ...p, current_class: e.target.value }))}>
                    <option value="">Select...</option>
                    {CLASS_OPTIONS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {formError && <div style={{ color: "var(--accent)", fontSize: "13px", marginBottom: "12px", fontWeight: 700 }}>⚠️ {formError}</div>}
              <button type="submit" className="pub-submit-btn" disabled={submitting}>
                {submitting ? "Sending..." : "🚀 Submit Enquiry →"}
              </button>
              <p style={{ fontSize: "12px", color: "var(--muted)", textAlign: "center", marginTop: "12px", margin: 0 }}>
                We'll contact you within 24 hours. No spam.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* ── Contact (Phase 3 — map fix handled on backend) ── */}
      <section className="pub-section" id="contact">
        <div className="pub-section-label pub-reveal">LOCATION</div>
        <h2 className="pub-section-title pub-reveal">Find Us</h2>
        <div className="pub-contact-grid">
          <div className="pub-contact-info pub-reveal">
            {data.contact?.address && (
              <div className="pub-contact-item">
                <div className="pub-contact-icon">📍</div>
                <div className="pub-contact-text">
                  <strong>Visit Us</strong>
                  <p>{data.contact.address}</p>
                </div>
              </div>
            )}
            {data.contact?.phone && (
              <div className="pub-contact-item">
                <div className="pub-contact-icon">📞</div>
                <div className="pub-contact-text">
                  <strong>Call Us</strong>
                  <a href={`tel:${data.contact.phone}`}>{data.contact.phone}</a>
                </div>
              </div>
            )}
            {data.contact?.email && (
              <div className="pub-contact-item">
                <div className="pub-contact-icon">✉️</div>
                <div className="pub-contact-text">
                  <strong>Email Us</strong>
                  <a href={`mailto:${data.contact.email}`}>{data.contact.email}</a>
                </div>
              </div>
            )}
            {data.contact?.working_hours && (
              <div className="pub-contact-item">
                <div className="pub-contact-icon">🕐</div>
                <div className="pub-contact-text">
                  <strong>Working Hours</strong>
                  <p>{data.contact.working_hours}</p>
                </div>
              </div>
            )}
          </div>

          {/* Phase 3: Map — backend already normalizes the URL */}
          <div className="pub-reveal" style={{ transitionDelay: '0.2s', width: '100%', height: '100%', minHeight: '340px' }}>
            {data.contact?.map_embed_url ? (
              <iframe
                src={data.contact.map_embed_url}
                title="Map"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                style={{ width: '100%', height: '100%', border: 0, borderRadius: '16px', minHeight: '340px' }}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', flexDirection: 'column', gap: '16px', background: 'var(--border)', borderRadius: '16px', height: '100%', minHeight: '340px' }}>
                <span style={{ fontSize: '48px' }}>🗺️</span>
                <p style={{ margin: 0, fontWeight: 600 }}>Map not provided</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer>
        <div className="pub-footer-grid">
          <div>
            <div className="pub-footer-brand">
              <div className="pub-footer-brand-logo">{(data.name || "I")[0]}</div>
              {data.name}
            </div>
            <p>{data.footer_description || data.description || "Empowering students to achieve their dreams with expert guidance."}</p>
            {(data.social?.facebook || data.social?.instagram || data.social?.youtube) && (
              <div className="pub-social-links">
                {data.social.facebook && (
                  <a
                    href={data.social.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pub-social-btn pub-social-fb"
                    title="Follow us on Facebook"
                    aria-label="Facebook"
                  >
                    {/* Official Facebook F logo */}
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                      <path d="M24 12.073C24 5.406 18.627 0 12 0S0 5.406 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
                    </svg>
                  </a>
                )}
                {data.social.instagram && (
                  <a
                    href={data.social.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pub-social-btn pub-social-ig"
                    title="Follow us on Instagram"
                    aria-label="Instagram"
                  >
                    {/* Official Instagram camera logo */}
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                    </svg>
                  </a>
                )}
                {data.social.youtube && (
                  <a
                    href={data.social.youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pub-social-btn pub-social-yt"
                    title="Subscribe on YouTube"
                    aria-label="YouTube"
                  >
                    {/* Official YouTube play button logo */}
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                  </a>
                )}
              </div>
            )}
          </div>
          {hasCourses && (
            <div className="pub-footer-col">
              <h4>Our Courses</h4>
              <ul className="pub-footer-links">
                {data.courses.slice(0, 5).map((c, i) => <li key={i}><a href="#courses">{c.name}</a></li>)}
              </ul>
            </div>
          )}
          <div className="pub-footer-col">
            <h4>Quick Links</h4>
            <ul className="pub-footer-links">
              <li><a href="#home">Home</a></li>
              <li><a href="#about">About</a></li>
              {hasCourses && <li><a href="#courses">Courses</a></li>}
              {hasFaculty && <li><a href="#faculty">Faculty</a></li>}
              {data.gallery?.length > 0 && <li><a href="#gallery">Gallery</a></li>}
            </ul>
          </div>
          <div className="pub-footer-col" id="contact-footer">
            <h4>Contact Details</h4>
            <ul className="pub-footer-links" style={{ color: 'rgba(255,255,255,.7)' }}>
              {data.contact?.phone && <li style={{ marginBottom: '8px' }}>{data.contact.phone}</li>}
              {data.contact?.email && <li style={{ marginBottom: '8px' }}>{data.contact.email}</li>}
              {data.contact?.address && <li style={{ lineHeight: 1.5 }}>{data.contact.address}</li>}
            </ul>
          </div>
        </div>
        <div className="pub-footer-bottom">
          <span>© {new Date().getFullYear()} {data.name}. All rights reserved.</span>
          <span className="pub-powered-badge">Powered by ZenithFlows</span>
        </div>
      </footer>

      {/* ── WhatsApp Float ── */}
      {data.contact?.whatsapp && (
        <a href={`https://wa.me/91${data.contact.whatsapp}?text=Hi! I want to know more about the courses.`}
          target="_blank" rel="noopener noreferrer" className="pub-whatsapp-fab" title="Chat on WhatsApp">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M12.031 21.144c-1.637 0-3.238-.431-4.639-1.25l-.333-.196-3.447.904.922-3.361-.215-.342c-.895-1.425-1.368-3.076-1.368-4.786 0-4.99 4.062-9.053 9.051-9.053 2.422 0 4.698.943 6.41 2.656 1.711 1.71 2.654 3.987 2.654 6.402 0 4.99-4.062 9.051-9.05 9.051h.015zm0-16.536c-4.129 0-7.489 3.361-7.489 7.49 0 1.319.344 2.607 1 3.738l.107.17-.615 2.247 2.301-.603.164.098c1.096.634 2.348.968 3.633.968 4.129 0 7.49-3.36 7.49-7.489 0-1.999-.778-3.879-2.192-5.293s-3.292-2.193-5.292-2.193zm4.113 10.218c-.226-.113-1.339-.661-1.547-.737-.206-.075-.357-.112-.507.113-.151.226-.583.737-.714.888-.131.15-.262.17-.488.056-.226-.113-.956-.353-1.821-1.127-.674-.602-1.128-1.345-1.26-1.571-.132-.227-.014-.35.099-.463.102-.102.226-.264.339-.396.113-.131.151-.226.226-.376.075-.15.038-.282-.019-.396-.056-.113-.507-1.223-.695-1.674-.183-.439-.37-.379-.508-.386-.131-.007-.282-.007-.433-.007s-.395.056-.603.282c-.207.226-.79.771-.79 1.881 0 1.111.809 2.185.922 2.336s1.594 2.433 3.863 3.414c.54.232.962.37 1.291.474.542.171 1.036.147 1.425.089.436-.065 1.339-.547 1.527-1.074.188-.528.188-.981.132-1.074-.056-.094-.207-.151-.433-.264z" /></svg>
        </a>
      )}
    </div>
  );
}
