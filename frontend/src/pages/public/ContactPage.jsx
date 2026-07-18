/**
 * ContactPage — Standalone /contact route
 * Gives ZenithFlows a dedicated, indexable Contact page.
 * Reuses the existing Contact component — no duplication.
 */

import { useEffect } from 'react';
import Navbar from '../../components/landing/Navbar';
import Contact from '../../components/landing/Contact';
import Footer from '../../components/landing/Footer';
import { useCursor } from '../../hooks/useCursor';
import { useSEO } from '../../hooks/useSEO';
import '../../styles/landing.css';

export default function ContactPage() {
  useCursor();

  useSEO({
    title: 'Contact ZenithFlows — Support, Demos & Enquiries',
    description: 'Contact the ZenithFlows team for demo requests, pricing enquiries, technical support, or partnership opportunities. We\'re here to help.',
    canonical: '/contact',
    ogTitle: 'Contact ZenithFlows',
    ogDescription: 'Reach out for demos, support, or enquiries. The ZenithFlows team is ready to help your institute.',
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

        {/* ── SEO heading block ─────────────────────────────────────── */}
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
            Get in Touch
          </p>
          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 800,
            color: 'var(--lp-text)',
            lineHeight: 1.15,
            marginBottom: '1rem',
            letterSpacing: '-0.02em',
          }}>
            We'd Love to Hear From You
          </h1>
          <p style={{
            fontSize: '1.1rem',
            color: 'var(--lp-muted)',
            lineHeight: 1.75,
            maxWidth: '620px',
            margin: '0 auto 2rem',
          }}>
            Whether you'd like a personalised demo, have a billing question, or want to explore
            a partnership with ZenithFlows — our team is here to help.
          </p>
        </section>

        {/* ── Reuse the existing Contact component ─────────────────── */}
        <Contact />

      </main>

      <Footer />
    </div>
  );
}
