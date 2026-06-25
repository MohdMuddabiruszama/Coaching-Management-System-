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

export default function PrivacyPage() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className='landing-root'>
      <Navbar />
      <section style={legalStyle.section}>
        <div style={legalStyle.container}>
          <h2 style={legalStyle.title}>Privacy Policy</h2>
          <div style={legalStyle.divider} />
          <span style={legalStyle.date}>
            Last updated: {new Date().toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>

          <h3 style={legalStyle.h2}>1. Introduction</h3>
          <p style={legalStyle.p}>
            Welcome to ZenithFlows. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our website or use our application ("Service") and tell you about your privacy rights and how the law protects you.
          </p>

          <h3 style={legalStyle.h2}>2. Data We Collect</h3>
          <p style={legalStyle.p}>Personal data means any information about an individual from which that person can be identified. We collect:</p>
          <ul style={legalStyle.ul}>
            <li><strong>Identity Data:</strong> First name, last name, username or similar identifier.</li>
            <li><strong>Contact Data:</strong> Email address and telephone numbers.</li>
            <li><strong>Technical Data:</strong> IP address, login data, browser type and version, time zone, operating system and platform.</li>
            <li><strong>Profile Data:</strong> Username and password, purchases, interests, preferences, feedback and survey responses.</li>
            <li><strong>Usage Data:</strong> Information about how you use our website, products, and services.</li>
          </ul>

          <h3 style={legalStyle.h2}>3. How We Use Your Data</h3>
          <p style={legalStyle.p}>We will only use your personal data when the law allows us to. Most commonly, we will use your personal data to:</p>
          <ul style={legalStyle.ul}>
            <li>Perform the contract we are about to enter into or have entered into with you.</li>
            <li>Operate and improve our legitimate platform services.</li>
            <li>Comply with a legal obligation.</li>
          </ul>

          <h3 style={legalStyle.h2}>4. Data Security</h3>
          <p style={legalStyle.p}>
            We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorized way, altered or disclosed. We limit access to your personal data to those employees, agents, contractors and other third parties who have a business need to know.
          </p>

          <h3 style={legalStyle.h2}>5. Student Privacy Rights</h3>
          <p style={legalStyle.p}>
            As an educational platform, we maintain strict privacy considerations specifically to protect students. Educational records, attendance statistics, grades, and related analytics are only exposed to strictly authorized faculty and the parents or guardians associated with the given individual student profile, in adherence with standard academic privacy guidelines.
          </p>

          <h3 style={legalStyle.h2}>6. Third-Party Links</h3>
          <p style={legalStyle.p}>
            This website may include links to third-party websites, plug-ins, and applications. Clicking on those links or enabling those connections may allow third parties to collect or share data about you. We do not control these third-party websites and are not responsible for their privacy statements.
          </p>

          <h3 style={legalStyle.h2}>7. Your Legal Rights</h3>
          <p style={legalStyle.p}>Under data protection laws you have rights including:</p>
          <ul style={legalStyle.ul}>
            <li>Request access to your personal data.</li>
            <li>Request correction or erasure of your personal data.</li>
            <li>Object to processing of your personal data.</li>
            <li>Request restriction of processing your personal data.</li>
            <li>Request transfer of your personal data.</li>
            <li>Right to withdraw consent.</li>
          </ul>

          <div style={{ marginTop: '2.5rem', padding: '1.25rem', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px' }}>
            <p style={{ ...legalStyle.p, marginBottom: 0 }}>
              Questions about your data? <a href="/#contact" style={{ color: 'var(--lp-accent)', fontWeight: 600 }}>Contact us →</a>
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
