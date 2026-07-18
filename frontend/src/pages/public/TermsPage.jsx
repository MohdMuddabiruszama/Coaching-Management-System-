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

export default function TermsPage() {
  useSEO({
    title: 'Terms of Service — ZenithFlows',
    description: 'Read the Terms of Service for ZenithFlows — the cloud-based institute management platform. Understand your rights, responsibilities, and our policies.',
    canonical: '/terms',
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
            <h1 style={legalStyle.title}>Terms of Service</h1>
            <span style={legalStyle.date}>
              Effective Date: {new Date().toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          <p style={legalStyle.p}>
            Welcome to <strong>ZenithFlows</strong> ("we," "our," or "us"). These Terms of Service ("Terms") govern your access to and use of the ZenithFlows website, web application, mobile applications, and all associated software and services (collectively, the "Platform" or "Service").
          </p>
          <p style={legalStyle.p}>
            By registering an account, purchasing a subscription, or simply accessing the Platform as a user (Institute Admin, Faculty, Student, or Parent), you signify that you have read, understood, and agree to be bound by these Terms.
          </p>

          <h2 style={legalStyle.h2}><span style={legalStyle.h2Number}>1</span> Description of Service</h2>
          <p style={legalStyle.p}>
            ZenithFlows provides a comprehensive, cloud-based Institute Management System designed to assist educational coaching centers and schools with administrative tasks. Features include, but are not limited to, student enrollment, fee tracking, assignment management, real-time chat, and biometric/QR attendance tracking.
          </p>

          <h2 style={legalStyle.h2}><span style={legalStyle.h2Number}>2</span> Account Registration & Responsibilities</h2>
          <ul style={legalStyle.ul}>
            <li style={legalStyle.li}><strong style={legalStyle.strong}>Institute Accounts:</strong> The primary subscriber ("Institute Administrator") is fully responsible for all activity occurring under their institute's tenant. The Institute Administrator must ensure that the creation of sub-accounts (Faculty, Students, Parents) complies with local laws, including obtaining necessary consent for minors.</li>
            <li style={legalStyle.li}><strong style={legalStyle.strong}>Account Security:</strong> You are responsible for safeguarding your login credentials. You must notify us immediately of any unauthorized use of your account. We will not be liable for any loss or damage arising from your failure to protect your password.</li>
            <li style={legalStyle.li}><strong style={legalStyle.strong}>Data Accuracy:</strong> You agree to provide true, accurate, current, and complete information during registration and maintain its accuracy.</li>
          </ul>

          <h2 style={legalStyle.h2}><span style={legalStyle.h2Number}>3</span> Subscription, Fees, and Payments</h2>
          <ul style={legalStyle.ul}>
            <li style={legalStyle.li}><strong style={legalStyle.strong}>Billing Cycle:</strong> ZenithFlows is offered as a Software-as-a-Service (SaaS). Subscriptions are billed in advance on a recurring schedule (monthly, annually) or via one-time Lifetime access purchases, as selected at checkout.</li>
            <li style={legalStyle.li}><strong style={legalStyle.strong}>Payment Gateways:</strong> We utilize secure third-party payment gateways (e.g., Razorpay) for transaction processing. You agree to their respective terms of service when making a payment.</li>
            <li style={legalStyle.li}><strong style={legalStyle.strong}>Refund Policy:</strong> All subscription fees are non-refundable unless expressly stated otherwise in writing or required by applicable law.</li>
            <li style={legalStyle.li}><strong style={legalStyle.strong}>Account Suspension:</strong> We reserve the right to suspend or restrict your institute's access to the Platform if your subscription fees are past due.</li>
          </ul>

          <h2 style={legalStyle.h2}><span style={legalStyle.h2Number}>4</span> Acceptable Use Policy</h2>
          <p style={legalStyle.p}>While using the ZenithFlows Platform, you agree <strong>NOT</strong> to:</p>
          <ul style={legalStyle.ul}>
            <li style={legalStyle.li}>Upload, transmit, or share malicious code, viruses, or disruptive software.</li>
            <li style={legalStyle.li}>Use the in-app chat or announcement features to transmit unlawful, harassing, defamatory, or abusive content.</li>
            <li style={legalStyle.li}>Attempt to reverse-engineer, decompile, or otherwise extract the source code of the Platform.</li>
            <li style={legalStyle.li}>Bypass or attempt to bypass any security or authentication measures (including biometric systems).</li>
          </ul>

          <h2 style={legalStyle.h2}><span style={legalStyle.h2Number}>5</span> Intellectual Property & Data Ownership</h2>
          <p style={legalStyle.p}>
            <strong style={legalStyle.strong}>Your Data:</strong> The Institute retains full ownership of all academic, personal, and financial data uploaded to the Platform ("Customer Data"). You grant us a limited, worldwide, non-exclusive license to host, copy, transmit, and display this data strictly to provide the Service to you.
          </p>
          <p style={legalStyle.p}>
            <strong style={legalStyle.strong}>Our IP:</strong> ZenithFlows retains all rights, title, and interest in the Platform, including its codebase, UI/UX designs, algorithms, trademarks, and branding. You may not duplicate, copy, or reuse any portion of the HTML/CSS/JS, visual design elements, or concepts without express written permission.
          </p>

          <h2 style={legalStyle.h2}><span style={legalStyle.h2Number}>6</span> Third-Party Hardware Integrations</h2>
          <p style={legalStyle.p}>
            ZenithFlows supports integration with third-party biometric hardware devices. We provide the software bridging to sync this data, but we are not liable for hardware malfunctions, network failures at the device level, or bodily harm/property damage resulting from the installation or use of third-party physical hardware.
          </p>

          <h2 style={legalStyle.h2}><span style={legalStyle.h2Number}>7</span> Disclaimer of Warranties & Limitation of Liability</h2>
          <p style={legalStyle.p}>
            The Service is provided on an "AS IS" and "AS AVAILABLE" basis. ZenithFlows makes no warranties, expressed or implied, regarding the continuous availability, error-free operation, or absolute security of the Platform.
          </p>
          <p style={legalStyle.p}>
            To the maximum extent permitted by law, ZenithFlows shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill, arising out of your use or inability to use the Service.
          </p>

          <h2 style={legalStyle.h2}><span style={legalStyle.h2Number}>8</span> Termination</h2>
          <p style={legalStyle.p}>
            You may terminate your account at any time by contacting our support team or utilizing the in-app billing settings. We reserve the right to suspend or terminate your account immediately, without prior notice, if you breach these Terms. Upon termination, your right to use the Service will cease immediately, and all associated data will be scheduled for deletion per our Privacy Policy.
          </p>

          <h2 style={legalStyle.h2}><span style={legalStyle.h2Number}>9</span> Changes to Terms</h2>
          <p style={legalStyle.p}>
            We reserve the right to modify or replace these Terms at any time. We will provide reasonable advance notice (via email or in-app notification) of any material changes. Your continued use of the Service after any revisions become effective constitutes your acceptance of the revised Terms.
          </p>

          <div style={legalStyle.contactBox}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--lp-text)', marginBottom: '0.5rem' }}>Need clarification on our terms?</h3>
            <p style={{ color: 'var(--lp-muted)', marginBottom: '1.5rem', fontSize: '1.05rem' }}>
              Our legal and support teams are available to address any concerns.
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
              Contact Support
            </a>
          </div>

        </div>
      </section>
      <Footer />
    </div>
  );
}
