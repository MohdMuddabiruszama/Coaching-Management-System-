import { useState, useEffect } from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import toast from 'react-hot-toast';
import api from '../../services/api';

/* ── Icons ── */
const IconMail = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>;
const IconPhone = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>;
const IconMapPin = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>;
const IconChat = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /><circle cx="8" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="16" cy="12" r="1.5" /></svg>;
const IconEdit = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
const IconShieldCheck = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg>;

/* ── Inline Styles ── */
const S = {
  wrap: { padding: '120px 0', background: 'var(--lp-bg)', position: 'relative', fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif" },
  inner: { maxWidth: '1440px', margin: '0 auto', padding: '0 4vw' },
  header: { textAlign: 'center', marginBottom: '4rem' },
  eyebrow: { display: 'inline-block', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--lp-primary, #6366f1)', marginBottom: '0.5rem' },
  h2: { fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 800, color: 'var(--lp-text, #0f172a)', lineHeight: 1.2, marginBottom: '1rem', letterSpacing: '-0.5px' },
  subtitle: { fontSize: '1.05rem', color: 'var(--lp-muted, #64748b)', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '40px', alignItems: 'flex-start' },

  leftCol: { display: 'flex', flexDirection: 'column', gap: '20px' },

  infoCard: {
    background: 'var(--lp-surface)', border: '1px solid var(--lp-border)', borderRadius: '16px',
    padding: '24px 32px', display: 'flex', alignItems: 'center', gap: '24px',
    boxShadow: 'var(--lp-shadow-sm)', transition: 'transform 0.2s', cursor: 'pointer'
  },
  promoCard: {
    background: 'rgba(99,102,241,0.03)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '16px',
    padding: '32px', display: 'flex', alignItems: 'flex-start', gap: '24px', marginTop: '10px'
  },

  iconWrap: {
    width: '56px', height: '56px', background: 'rgba(99,102,241,0.1)', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lp-primary, #6366f1)', flexShrink: 0,
  },
  promoIconWrap: {
    width: '56px', height: '56px', background: 'var(--lp-primary, #6366f1)', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', flexShrink: 0,
    boxShadow: '0 4px 10px rgba(99,102,241,0.3)'
  },

  cardTitle: { fontSize: '1.05rem', fontWeight: 800, color: 'var(--lp-text)', marginBottom: '6px' },
  cardDesc: { fontSize: '0.95rem', color: 'var(--lp-muted)', lineHeight: 1.5 },

  promoBtn: {
    marginTop: '20px', background: 'var(--lp-surface)', color: 'var(--lp-primary, #6366f1)',
    border: '1px solid rgba(99,102,241,0.3)', padding: '10px 20px', borderRadius: '10px',
    fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px',
    transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
  },

  formCard: {
    background: 'var(--lp-surface)', border: '1px solid var(--lp-border)', borderRadius: '24px',
    padding: '48px', boxShadow: 'var(--lp-shadow-md)'
  },

  formHeader: { display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '36px' },
  formHeaderIcon: {
    width: '52px', height: '52px', background: 'var(--lp-primary, #6366f1)', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', flexShrink: 0,
    boxShadow: '0 4px 10px rgba(99,102,241,0.3)'
  },
  formTitle: { fontSize: '1.35rem', fontWeight: 800, color: 'var(--lp-text)', marginBottom: '6px' },
  formDesc: { fontSize: '0.95rem', color: 'var(--lp-muted)' },

  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' },
  label: { fontSize: '0.75rem', fontWeight: 800, color: 'var(--lp-text)', textTransform: 'uppercase', letterSpacing: '0.5px' },
  input: {
    padding: '16px 18px', background: 'var(--lp-bg)', border: '1px solid var(--lp-border)',
    borderRadius: '12px', fontSize: '0.95rem', color: 'var(--lp-text)', outline: 'none',
    transition: 'all 0.2s', fontFamily: 'inherit', width: '100%'
  },

  submitBtn: {
    width: '100%', background: 'var(--lp-primary, #6366f1)', color: '#ffffff',
    padding: '18px', borderRadius: '12px', fontSize: '1.05rem', fontWeight: 700, border: 'none',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
    transition: 'all 0.2s', marginTop: '16px', boxShadow: '0 8px 16px rgba(99,102,241,0.25)'
  },

  secureNote: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    marginTop: '20px', color: 'var(--lp-primary, #6366f1)', fontSize: '0.85rem', fontWeight: 600
  }
};

export default function Contact() {
  useScrollReveal('reveal', 0.1);
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await api.get('/plans');
        if (response.data.success || response.data.data) {
          const activePlans = (response.data.data || []).filter(p => p.status === 'active');
          setPlans(activePlans);
        }
      } catch (error) {
        console.error('Failed to fetch plans for contact form', error);
      } finally {
        setPlansLoading(false);
      }
    };
    fetchPlans();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.target);
      const data = {
        name: formData.get('name'),
        phone: formData.get('phone'),
        email: formData.get('email'),
        institute: formData.get('institute'),
        studentCount: formData.get('studentCount') || null,
        plan: formData.get('plan') || null,
        message: formData.get('message') || null
      };

      const response = await api.post('/leads', data);

      if (response.data.success) {
        toast.success(response.data.message || 'Message sent! We will contact you within 24 hours.');
        e.target.reset();
      } else {
        toast.error(response.data.message || 'Failed to send message. Please try again.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'An error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contact" style={S.wrap}>
      {/* Micro animations for inputs and cards */}
      <style>{`
        .lp-contact-input:focus { border-color: var(--lp-primary) !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15) !important; }
        .lp-contact-c:hover { transform: translateY(-3px); border-color: rgba(99,102,241,0.3) !important; }
        .lp-contact-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(99,102,241,0.35) !important; filter: brightness(1.1); }
        .lp-contact-btn:active { transform: translateY(1px); filter: brightness(0.95); box-shadow: none !important; }
        .lp-promo-btn:hover { background: var(--lp-primary) !important; color: #fff !important; }
        @media (max-width: 640px) {
          .lp-contact-row { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={S.inner}>
        {/* Header */}
        <div className="reveal" style={S.header}>
          <span style={S.eyebrow}>Get In Touch</span>
          <h2 style={S.h2}>Ready to Transform Your Institute?</h2>
          <p style={S.subtitle}>
            Our team is here to help you get started with a free demo, data migration, and answering any specific operational questions.
          </p>
        </div>

        <div className="reveal" style={S.grid}>
          {/* Left Column: Info Cards */}
          <div style={S.leftCol}>
            <div className="lp-contact-c" style={S.infoCard}>
              <div style={S.iconWrap}><IconMail /></div>
              <div>
                <div style={S.cardTitle}>Email Us</div>
                <div style={S.cardDesc}>muddabir03@gmail.com<br />support@studentsaas.in</div>
              </div>
            </div>

            <div className="lp-contact-c" style={S.infoCard}>
              <div style={S.iconWrap}><IconPhone /></div>
              <div>
                <div style={S.cardTitle}>Call or WhatsApp</div>
                <div style={S.cardDesc}>+91 82756 68600<br />Mon-Sat, 9AM to 7PM IST</div>
              </div>
            </div>

            <div className="lp-contact-c" style={S.infoCard}>
              <div style={S.iconWrap}><IconMapPin /></div>
              <div>
                <div style={S.cardTitle}>Headquarters</div>
                <div style={S.cardDesc}>MD Lines, Tolichowki<br />Hyderabad, Telangana 500001</div>
              </div>
            </div>

            {/* Promo Card */}
            <div style={S.promoCard}>
              <div style={S.promoIconWrap}><IconChat /></div>
              <div>
                <div style={S.cardTitle}>Prefer to talk?</div>
                <div style={S.cardDesc}>Book a free demo and our expert will connect with you.</div>
                <button className="lp-promo-btn" style={S.promoBtn} onClick={() => window.location.href = '/book-demo'}>
                  Book Free Demo <span>→</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Form Card */}
          <div style={S.formCard}>
            <div style={S.formHeader}>
              <div style={S.formHeaderIcon}><IconEdit /></div>
              <div>
                <div style={S.formTitle}>Send us a message</div>
                <div style={S.formDesc}>Fill out the form and we'll get back to you shortly.</div>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="lp-contact-row" style={S.formRow}>
                <div style={{ ...S.formGroup, marginBottom: 0 }}>
                  <label style={S.label}>Full Name *</label>
                  <input type="text" name="name" required className="lp-contact-input" style={S.input} placeholder="Enter your full name" />
                </div>
                <div style={{ ...S.formGroup, marginBottom: 0 }}>
                  <label style={S.label}>Phone Number *</label>
                  <input type="tel" name="phone" required className="lp-contact-input" style={S.input} placeholder="Enter your phone number" maxLength={10} />
                </div>
              </div>

              <div style={S.formGroup}>
                <label style={S.label}>Email Address *</label>
                <input type="email" name="email" required className="lp-contact-input" style={S.input} placeholder="Enter your email address" />
              </div>

              <div style={S.formGroup}>
                <label style={S.label}>Message / Inquiry *</label>
                <textarea
                  name="message"
                  required
                  className="lp-contact-input"
                  style={{ ...S.input, minHeight: '120px', resize: 'vertical' }}
                  placeholder="How can we help you?"
                ></textarea>
              </div>

              <button type="submit" disabled={loading} className="lp-contact-btn" style={S.submitBtn}>
                {loading ? 'Sending...' : 'Send Message'}
              </button>

              <div style={S.secureNote}>
                <IconShieldCheck />
                <span>Your information is secure and will never be shared.</span>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
