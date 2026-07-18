import React, { useEffect } from "react";
import { useSEO } from "../../hooks/useSEO";
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
    maxWidth: '900px',
    margin: '0 auto',
    padding: '0 1.5rem',
  },
  header: {
    marginBottom: '3rem',
  },
  title: {
    fontSize: 'clamp(2rem, 5vw, 3rem)',
    fontWeight: 800,
    color: 'var(--lp-text)',
    marginBottom: '1rem',
    lineHeight: 1.1,
    letterSpacing: '-0.02em'
  },
  date: {
    fontSize: '0.95rem',
    color: 'var(--lp-muted)',
    display: 'inline-block',
    background: 'rgba(99,102,241,0.1)',
    padding: '6px 16px',
    borderRadius: '20px',
    fontWeight: 500,
  },
  h2: {
    fontSize: '1.4rem',
    fontWeight: 700,
    color: 'var(--lp-text)',
    margin: '2.5rem 0 1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  h2Number: {
    background: 'var(--lp-accent)',
    color: '#fff',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    fontSize: '0.9rem',
    fontWeight: 800
  },
  p: {
    fontSize: '1.05rem',
    color: 'var(--lp-muted)',
    lineHeight: 1.8,
    marginBottom: '1.25rem',
  },
  ul: {
    paddingLeft: '1.5rem',
    margin: '0.5rem 0 1.5rem',
    color: 'var(--lp-muted)',
    fontSize: '1.05rem',
    lineHeight: 1.8,
  },
  li: {
    marginBottom: '0.5rem',
  },
  strong: {
    color: 'var(--lp-text)',
    fontWeight: 600,
  },
  contactBox: {
    marginTop: '4rem',
    padding: '2rem',
    background: 'linear-gradient(135deg, rgba(99,102,241,0.05), rgba(168,85,247,0.05))',
    border: '1px solid rgba(99,102,241,0.15)',
    borderRadius: '16px',
    textAlign: 'center'
  }
};

export default function PrivacyPage() {
  useSEO({
    title: 'Privacy Policy — ZenithFlows',
    description: 'Read the Privacy Policy for ZenithFlows — understand how we collect, use, and protect your data on our institute management platform.',
    canonical: '/privacy',
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className='landing-root'>
      <Navbar />
      <section style={legalStyle.section}>
        <div style={legalStyle.container}>
          
          <div style={legalStyle.header}>
            <h1 style={legalStyle.title}>Privacy Policy</h1>
            <span style={legalStyle.date}>
              Effective Date: {new Date().toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          <p style={legalStyle.p}>
            At <strong>ZenithFlows</strong>, we are deeply committed to protecting the privacy and security of our users. This Privacy Policy governs how we collect, use, process, and distribute information across our cloud-based Institute Management System (the "Platform" or "Service"), including our web and mobile applications.
          </p>
          <p style={legalStyle.p}>
            By accessing or using ZenithFlows, whether as an Institute Administrator, Faculty member, Student, or Parent, you agree to the practices described in this policy.
          </p>

          <h2 style={legalStyle.h2}><span style={legalStyle.h2Number}>1</span> Information We Collect</h2>
          <p style={legalStyle.p}>ZenithFlows collects information to provide a seamless educational management experience. We act primarily as a <strong>Data Processor</strong> for the Institutes (who act as Data Controllers). The data we collect includes:</p>
          <ul style={legalStyle.ul}>
            <li style={legalStyle.li}><strong style={legalStyle.strong}>Account & Identity Data:</strong> Names, email addresses, phone numbers, profile photos, and role-based credentials (Admin, Faculty, Student, Parent).</li>
            <li style={legalStyle.li}><strong style={legalStyle.strong}>Academic Data:</strong> Enrollment details, class schedules, assignments, grades, examination marks, and performance analytics.</li>
            <li style={legalStyle.li}><strong style={legalStyle.strong}>Attendance & Biometric Data:</strong> Daily attendance records, QR-code check-ins, and hardware-based biometric attendance logs (where applicable). <em>Note: Raw biometric templates are typically stored on localized hardware and transmitted to our servers only as anonymized confirmation hashes.</em></li>
            <li style={legalStyle.li}><strong style={legalStyle.strong}>Financial Data:</strong> Fee payment records, invoice history, and faculty salary slips. Payment processing is handled by secure third-party gateways (e.g., Razorpay, Stripe); we do not store full credit card numbers.</li>
            <li style={legalStyle.li}><strong style={legalStyle.strong}>Communications:</strong> In-app chat messages, announcements, and administrative notes.</li>
            <li style={legalStyle.li}><strong style={legalStyle.strong}>Device & Usage Data:</strong> IP addresses, browser types, mobile device identifiers, crash logs, and interaction metrics to help us optimize platform performance.</li>
          </ul>

          <h2 style={legalStyle.h2}><span style={legalStyle.h2Number}>2</span> How We Use Your Information</h2>
          <p style={legalStyle.p}>We only process your personal data for legitimate business and educational purposes, including:</p>
          <ul style={legalStyle.ul}>
            <li style={legalStyle.li}><strong>Providing the Service:</strong> Enabling role-based access to dashboards, timetables, and academic reports.</li>
            <li style={legalStyle.li}><strong>Communication:</strong> Sending push notifications, SMS, or emails regarding attendance alerts, fee reminders, and institutional announcements.</li>
            <li style={legalStyle.li}><strong>Security & Fraud Prevention:</strong> Monitoring chat environments for safety, verifying login attempts, and securing academic records.</li>
            <li style={legalStyle.li}><strong>Platform Improvement:</strong> Analyzing aggregated, anonymized usage data to fix bugs, develop new features, and improve UI/UX.</li>
          </ul>

          <h2 style={legalStyle.h2}><span style={legalStyle.h2Number}>3</span> Data Sharing and Disclosure</h2>
          <p style={legalStyle.p}>We do not sell, rent, or trade your personal data. Data is only shared under the following circumstances:</p>
          <ul style={legalStyle.ul}>
            <li style={legalStyle.li}><strong>Within Your Institute:</strong> Information is shared internally based on strict Role-Based Access Control (RBAC). For example, parents can only see their own child's data; faculty can only see data for students in their assigned classes.</li>
            <li style={legalStyle.li}><strong>Service Providers:</strong> We use trusted third-party cloud hosts (e.g., AWS, Google Cloud), email/SMS providers, and payment gateways that are bound by strict data processing agreements.</li>
            <li style={legalStyle.li}><strong>Legal Requirements:</strong> We may disclose information if required to do so by law, valid subpoena, or court order.</li>
          </ul>

          <h2 style={legalStyle.h2}><span style={legalStyle.h2Number}>4</span> Data Security</h2>
          <p style={legalStyle.p}>
            Security is paramount in educational software. We implement industry-standard security protocols, including <strong>TLS/SSL encryption</strong> for data in transit, and AES-256 encryption for sensitive data at rest. We utilize JWT-based authentication, strict CORS policies, and automated backups to prevent unauthorized access, alteration, or loss of data.
          </p>

          <h2 style={legalStyle.h2}><span style={legalStyle.h2Number}>5</span> Children's Privacy</h2>
          <p style={legalStyle.p}>
            ZenithFlows is utilized by educational institutes that may enroll children under the age of 13 (or the applicable age of consent in your region). We rely on the subscribing Institute to obtain appropriate parental consent before provisioning student accounts. If we discover that personal data has been collected from a child without verified institutional/parental consent, we will delete the account immediately.
          </p>

          <h2 style={legalStyle.h2}><span style={legalStyle.h2Number}>6</span> Data Retention and Deletion</h2>
          <p style={legalStyle.p}>
            We retain personal data only for as long as the Institute maintains an active subscription, or as required to fulfill legal/accounting obligations. Upon termination of an Institute's subscription, all associated student, parent, and faculty data is securely purged from our active databases within a standard grace period, unless a specific export request is made by the Institute Administrator.
          </p>

          <h2 style={legalStyle.h2}><span style={legalStyle.h2Number}>7</span> Your Privacy Rights</h2>
          <p style={legalStyle.p}>Depending on your jurisdiction, you have the right to:</p>
          <ul style={legalStyle.ul}>
            <li style={legalStyle.li}>Access the personal data we hold about you.</li>
            <li style={legalStyle.li}>Request corrections to inaccurate data.</li>
            <li style={legalStyle.li}>Request the deletion of your data ("Right to be Forgotten").</li>
          </ul>
          <p style={legalStyle.p}>
            <em>Note to Students/Parents/Faculty:</em> Because your Institute is the Data Controller, requests to access, modify, or delete your data should be directed to your Institute's Administrator. ZenithFlows will assist the Institute in fulfilling these requests.
          </p>

          <div style={legalStyle.contactBox}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--lp-text)', marginBottom: '0.5rem' }}>Questions regarding this policy?</h3>
            <p style={{ color: 'var(--lp-muted)', marginBottom: '1.5rem', fontSize: '1.05rem' }}>
              If you have any questions about how we handle your data, our compliance team is here to help.
            </p>
            <a href="/#contact" style={{ 
              display: 'inline-block',
              padding: '12px 24px', 
              background: 'var(--lp-accent)', 
              color: '#fff', 
              textDecoration: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(99,102,241,0.25)'
            }}>
              Contact Privacy Team
            </a>
          </div>

        </div>
      </section>
      <Footer />
    </div>
  );
}
