/**
 * FeaturesPage — Standalone /features route
 * Renders the full Features section with Navbar/Footer and proper SEO.
 * Reuses the existing Features component — no duplication.
 */

import { useEffect } from 'react';
import Navbar from '../../components/landing/Navbar';
import Features from '../../components/landing/Features';
import Footer from '../../components/landing/Footer';
import { useCursor } from '../../hooks/useCursor';
import { useSEO } from '../../hooks/useSEO';
import '../../styles/landing.css';

export default function FeaturesPage() {
  useCursor();

  useSEO({
    title: 'Features — ZenithFlows Institute Management System',
    description: 'Explore all features of ZenithFlows: attendance tracking, fee management, exam management, timetable, parent portal, biometric integration, smart QR attendance, and more.',
    canonical: '/features',
    ogTitle: 'ZenithFlows Features — Everything Your Institute Needs',
    ogDescription: 'Attendance, fees, exams, timetable, parent portal, biometric, QR attendance — all in one cloud-based ERP.',
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className='landing-root'>
      <div id='cursor' />
      <div id='cursor-ring' />
      <div id='mobile-drawer-root' />

      <Navbar />

      <main style={{ paddingTop: '80px', minHeight: '100vh', background: 'var(--lp-bg)' }}>

        {/* ── SEO-enriched heading block ─────────────────────────────── */}
        <section style={{
          padding: '80px 4vw 0',
          maxWidth: '900px',
          margin: '0 auto',
          textAlign: 'center',
        }}>
          <p style={{
            display: 'inline-block',
            fontSize: '0.78rem',
            fontWeight: 700,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: 'var(--lp-primary, #6366f1)',
            marginBottom: '0.75rem',
          }}>
            Everything You Need
          </p>
          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 800,
            color: 'var(--lp-text)',
            lineHeight: 1.15,
            marginBottom: '1rem',
            letterSpacing: '-0.02em',
          }}>
            Powerful Features for Modern Institutes
          </h1>
          <p style={{
            fontSize: '1.15rem',
            color: 'var(--lp-muted)',
            lineHeight: 1.75,
            maxWidth: '700px',
            margin: '0 auto 2rem',
          }}>
            ZenithFlows is a cloud-based ERP platform designed for coaching institutes, schools,
            colleges, and training centres. It includes attendance management, fee tracking,
            examinations, parent communication, student analytics, and more — all from one dashboard.
          </p>
        </section>

        {/* ── Reuse the existing Features section component ────────── */}
        <Features />

        {/* ── Feature category summary for SEO ─────────────────────── */}
        <section style={{
          padding: '60px 4vw 80px',
          maxWidth: '1100px',
          margin: '0 auto',
        }}>
          <h2 style={{
            fontSize: 'clamp(1.4rem, 3vw, 2rem)',
            fontWeight: 700,
            color: 'var(--lp-text)',
            marginBottom: '2rem',
            textAlign: 'center',
          }}>
            What's Included
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1.5rem',
          }}>
            {[
              {
                icon: '📋',
                title: 'Attendance Management',
                desc: 'Mark, track, and report student and faculty attendance. Supports QR code scanning and biometric integration.',
              },
              {
                icon: '💰',
                title: 'Fee Management',
                desc: 'Manage fee structures, collect payments, generate receipts, and track dues with automated reminders.',
              },
              {
                icon: '📝',
                title: 'Exam & Marks',
                desc: 'Conduct exams, enter marks, generate report cards, and share results with students and parents.',
              },
              {
                icon: '📅',
                title: 'Timetable',
                desc: 'Create and manage class schedules. Students and faculty can view their timetable from any device.',
              },
              {
                icon: '👨‍👩‍👧',
                title: 'Parent Portal',
                desc: "Keep parents informed with real-time updates on attendance, marks, fees, and announcements.",
              },
              {
                icon: '📢',
                title: 'Announcements',
                desc: 'Send notices and announcements to students, parents, and faculty via in-app notifications.',
              },
              {
                icon: '📊',
                title: 'Analytics & Reports',
                desc: 'Generate detailed reports on attendance, fees, performance, and institute-wide analytics.',
              },
              {
                icon: '💬',
                title: 'Live Chat',
                desc: 'Built-in messaging for faculty-student and admin-parent communication in real time.',
              },
            ].map((f) => (
              <div key={f.title} style={{
                background: 'var(--lp-card, rgba(255,255,255,0.04))',
                border: '1px solid var(--lp-border, rgba(255,255,255,0.08))',
                borderRadius: '16px',
                padding: '1.5rem',
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{f.icon}</div>
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'var(--lp-text)',
                  marginBottom: '0.5rem',
                }}>{f.title}</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--lp-muted)', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
