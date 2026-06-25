import React, { useEffect } from "react";
import Navbar from "../../components/landing/Navbar";
import Footer from "../../components/landing/Footer";
import '../../styles/landing.css';

const legalStyle = {
  section: {
    padding: '80px 0',
    background: 'var(--lp-bg)',
    minHeight: '100vh',
    paddingTop: '120px'
  },
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '0 1.5rem',
  },
  title: {
    fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
    fontWeight: 800,
    color: 'var(--lp-text)',
    marginBottom: '0.5rem',
    lineHeight: 1.2,
  },
  date: {
    fontSize: '0.9rem',
    color: 'var(--lp-muted)',
    marginBottom: '2.5rem',
    display: 'block',
  },
  h2: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: 'var(--lp-text)',
    margin: '2rem 0 0.75rem',
    borderLeft: '3px solid var(--lp-accent)',
    paddingLeft: '12px',
  },
  p: {
    fontSize: '0.95rem',
    color: 'var(--lp-muted)',
    lineHeight: 1.8,
    marginBottom: '1rem',
  },
  ul: {
    paddingLeft: '1.5rem',
    margin: '0.75rem 0 1rem',
    color: 'var(--lp-muted)',
    fontSize: '0.95rem',
    lineHeight: 1.8,
  },
  divider: {
    width: '60px',
    height: '3px',
    background: 'linear-gradient(90deg, var(--lp-accent), transparent)',
    margin: '1rem 0 2rem',
    borderRadius: '2px',
  }
};

export default function TermsPage() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className='landing-root'>
      <Navbar />
      <section style={legalStyle.section}>
        <div style={legalStyle.container}>
          <h2 style={legalStyle.title}>Terms of Service</h2>
          <div style={legalStyle.divider} />
          <span style={legalStyle.date}>
            Last updated: {new Date().toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>

          <h3 style={legalStyle.h2}>1. Acceptance of Terms</h3>
          <p style={legalStyle.p}>
            By accessing or using the ZenithFlows platform ("Service"), you agree to be bound by these Terms of Service. If you disagree with any part of the terms, then you do not have permission to access the Service.
          </p>

          <h3 style={legalStyle.h2}>2. Communications</h3>
          <p style={legalStyle.p}>
            By creating an Account on our Service, you agree to subscribe to newsletters, marketing or promotional materials and other information we may send. However, you may opt out of receiving any, or all, of these communications from us by following the unsubscribe link or instructions provided in any email we send.
          </p>

          <h3 style={legalStyle.h2}>3. User Accounts</h3>
          <p style={legalStyle.p}>
            When you create an account with us, you must provide information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account.
          </p>
          <p style={legalStyle.p}>
            You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password. You agree not to disclose your password to any third party. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.
          </p>

          <h3 style={legalStyle.h2}>4. Institute and Admin Responsibilities</h3>
          <p style={legalStyle.p}>
            Institutes subscribing to our Service are strictly liable for defining roles for administrators, faculty, and students. Ensuring lawful data processing per local regulations stands as the responsibility of the administrative organization handling student records through our platform.
          </p>

          <h3 style={legalStyle.h2}>5. Intellectual Property</h3>
          <p style={legalStyle.p}>
            The Service and its original content, features, and functionality are and will remain the exclusive property of ZenithFlows and its licensors. Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of ZenithFlows.
          </p>

          <h3 style={legalStyle.h2}>6. Termination</h3>
          <p style={legalStyle.p}>
            We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the Service will immediately cease.
          </p>

          <h3 style={legalStyle.h2}>7. Limitation of Liability</h3>
          <p style={legalStyle.p}>
            In no event shall ZenithFlows, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages arising from your access to or inability to access or use the Service.
          </p>

          <h3 style={legalStyle.h2}>8. Changes</h3>
          <p style={legalStyle.p}>
            We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material we will try to provide at least 30 days notice prior to any new terms taking effect. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.
          </p>

          <div style={{ marginTop: '2.5rem', padding: '1.25rem', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px' }}>
            <p style={{ ...legalStyle.p, marginBottom: 0 }}>
              Questions about our Terms? <a href="/#contact" style={{ color: 'var(--lp-accent)', fontWeight: 600 }}>Contact us →</a>
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
