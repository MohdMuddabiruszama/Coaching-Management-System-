/**
 * AboutPage — Standalone /about route
 * Gives ZenithFlows a dedicated, indexable About page with real HTML content.
 * Includes: mission, what we do, team values, and a CTA.
 */

import { useEffect } from 'react';
import Navbar from '../../components/landing/Navbar';
import Footer from '../../components/landing/Footer';
import { Link } from 'react-router-dom';
import { useCursor } from '../../hooks/useCursor';
import { useSEO } from '../../hooks/useSEO';
import '../../styles/landing.css';

const STATS = [
  { value: '500+', label: 'Institutes Served' },
  { value: '1 Lakh+', label: 'Students Managed' },
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '4.9★', label: 'Average Rating' },
];

const VALUES = [
  {
    icon: '🚀',
    title: 'Built for Speed',
    desc: 'Every feature is engineered for performance. Minimum API calls, fast CRUD, and optimised queries ensure a snappy experience even on slow connections.',
  },
  {
    icon: '🔒',
    title: 'Security First',
    desc: 'Role-based access control, encrypted data, and multi-tenant isolation keep every institute\'s data safe and private.',
  },
  {
    icon: '🌐',
    title: 'Multi-Platform',
    desc: 'Works on web, Android student app, faculty app, and parent app — all from a single codebase with no compromise in experience.',
  },
  {
    icon: '❤️',
    title: 'Customer Obsessed',
    desc: 'We listen to institutes, iterate fast, and ship features that actually matter. Our roadmap is driven by real user feedback.',
  },
];

export default function AboutPage() {
  useCursor();

  useSEO({
    title: 'About ZenithFlows — Institute ERP for Coaching Centres & Schools',
    description: 'Learn about ZenithFlows — the mission, technology, and team behind India\'s cloud-based institute management platform for coaching centres, schools, and colleges.',
    canonical: '/about',
    ogTitle: 'About ZenithFlows',
    ogDescription: 'India\'s cloud-based ERP for coaching institutes and schools. Learn about our mission and technology.',
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const S = {
    page: { minHeight: '100vh', background: 'var(--lp-bg)', paddingTop: '80px' },
    section: { padding: '80px 4vw', maxWidth: '1100px', margin: '0 auto' },
    eyebrow: {
      display: 'inline-block', fontSize: '0.78rem', fontWeight: 700,
      letterSpacing: '2px', textTransform: 'uppercase',
      color: 'var(--lp-primary, #6366f1)', marginBottom: '0.75rem',
    },
    h1: {
      fontSize: 'clamp(2rem, 5vw, 3.2rem)', fontWeight: 800,
      color: 'var(--lp-text)', lineHeight: 1.15,
      marginBottom: '1.25rem', letterSpacing: '-0.02em',
    },
    h2: {
      fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 700,
      color: 'var(--lp-text)', lineHeight: 1.2,
      marginBottom: '1rem', letterSpacing: '-0.01em',
    },
    lead: {
      fontSize: '1.15rem', color: 'var(--lp-muted)',
      lineHeight: 1.8, maxWidth: '720px',
    },
    p: { fontSize: '1.05rem', color: 'var(--lp-muted)', lineHeight: 1.8, marginBottom: '1.25rem' },
    divider: { border: 'none', borderTop: '1px solid var(--lp-border, rgba(255,255,255,0.08))', margin: '0' },
  };

  return (
    <div className='landing-root'>
      <div id='cursor' />
      <div id='cursor-ring' />
      <div id='mobile-drawer-root' />

      <Navbar />

      <main style={S.page}>

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <section style={{ ...S.section, textAlign: 'center' }}>
          <p style={S.eyebrow}>Our Story</p>
          <h1 style={S.h1}>
            Built for Institutes.<br />Designed for Growth.
          </h1>
          <p style={{ ...S.lead, margin: '0 auto 2.5rem' }}>
            ZenithFlows is a cloud-based ERP platform built specifically for coaching institutes,
            schools, colleges, and training centres across India. We help administrators, faculty,
            students, and parents collaborate seamlessly — from attendance to fee collection,
            exams to parent communication.
          </p>
          {/* Stats bar */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
            gap: '2rem 4rem', marginTop: '3rem',
          }}>
            {STATS.map((s) => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--lp-primary, #6366f1)', lineHeight: 1 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--lp-muted)', marginTop: '0.35rem' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        <hr style={S.divider} />

        {/* ── Mission ──────────────────────────────────────────────── */}
        <section style={{ ...S.section, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}>
          <div>
            <p style={S.eyebrow}>Our Mission</p>
            <h2 style={S.h2}>Simplifying Institute Operations Across India</h2>
            <p style={S.p}>
              Education institutions spend too much time on administrative tasks — manual attendance,
              physical fee registers, paper-based exam records. ZenithFlows was created to change that.
            </p>
            <p style={S.p}>
              Our mission is to give every coaching institute — from a 20-student tuition centre to a
              2,000-student college — access to enterprise-grade tools that are affordable, intuitive,
              and built for India's unique educational ecosystem.
            </p>
            <p style={S.p}>
              We are a multi-tenant SaaS platform. Every institute gets its own isolated, secure
              environment with full branding control, custom plans, and dedicated support.
            </p>
          </div>
          <div style={{
            background: 'linear-gradient(135deg, var(--lp-primary, #6366f1) 0%, #8b5cf6 100%)',
            borderRadius: '24px', padding: '3rem', color: '#fff',
          }}>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1rem', color: '#fff' }}>
              What ZenithFlows Manages
            </h3>
            {[
              '✅ Student & Faculty Management',
              '✅ Attendance (QR / Biometric / Manual)',
              '✅ Fee Collection & Receipts',
              '✅ Examinations & Report Cards',
              '✅ Timetable & Scheduling',
              '✅ Parent Communication Portal',
              '✅ Announcements & Notices',
              '✅ Analytics & Reports',
              '✅ Live Chat & Messaging',
              '✅ Mobile Apps (Android)',
            ].map((item) => (
              <p key={item} style={{ margin: '0.5rem 0', fontSize: '0.95rem', color: 'rgba(255,255,255,0.9)' }}>
                {item}
              </p>
            ))}
          </div>
        </section>

        <hr style={S.divider} />

        {/* ── Values ───────────────────────────────────────────────── */}
        <section style={{ ...S.section, textAlign: 'center' }}>
          <p style={S.eyebrow}>Our Values</p>
          <h2 style={S.h2}>Why Institutes Choose ZenithFlows</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '1.5rem', marginTop: '2.5rem',
          }}>
            {VALUES.map((v) => (
              <div key={v.title} style={{
                background: 'var(--lp-card, rgba(255,255,255,0.04))',
                border: '1px solid var(--lp-border, rgba(255,255,255,0.08))',
                borderRadius: '16px', padding: '2rem', textAlign: 'left',
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>{v.icon}</div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--lp-text)', marginBottom: '0.6rem' }}>
                  {v.title}
                </h3>
                <p style={{ fontSize: '0.92rem', color: 'var(--lp-muted)', lineHeight: 1.7 }}>{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <hr style={S.divider} />

        {/* ── CTA ──────────────────────────────────────────────────── */}
        <section style={{ ...S.section, textAlign: 'center' }}>
          <h2 style={S.h2}>Ready to Transform Your Institute?</h2>
          <p style={{ ...S.lead, margin: '0 auto 2rem' }}>
            Join hundreds of institutes already running on ZenithFlows. Get started with a free demo today.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              to='/book-demo'
              style={{
                display: 'inline-block', padding: '0.9rem 2.2rem',
                background: 'var(--lp-primary, #6366f1)', color: '#fff',
                borderRadius: '12px', fontWeight: 700, fontSize: '1rem',
                textDecoration: 'none',
              }}
            >
              Book a Free Demo
            </Link>
            <Link
              to='/pricing'
              style={{
                display: 'inline-block', padding: '0.9rem 2.2rem',
                background: 'transparent',
                border: '1.5px solid var(--lp-border, rgba(255,255,255,0.2))',
                color: 'var(--lp-text)', borderRadius: '12px',
                fontWeight: 600, fontSize: '1rem', textDecoration: 'none',
              }}
            >
              View Pricing
            </Link>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
