import { useState, useEffect } from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import toast from 'react-hot-toast';
import api from '../../services/api';

/* ── Icons ── */
const IconChat = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /><circle cx="8" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="16" cy="12" r="1.5" /></svg>;
const IconEdit = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
const IconCheck = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;

/* ── Inline Styles ── */
const S = {
  wrap: { padding: '80px 0 120px', background: 'var(--lp-bg)', position: 'relative', fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif" },
  inner: { maxWidth: '1000px', margin: '0 auto', padding: '0 4vw' },
  header: { textAlign: 'center', marginBottom: '3rem' },
  eyebrow: { display: 'inline-block', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--lp-primary, #6366f1)', marginBottom: '0.5rem' },
  h2: { fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 800, color: 'var(--lp-text, #0f172a)', lineHeight: 1.2, marginBottom: '1rem', letterSpacing: '-0.5px' },
  subtitle: { fontSize: '1.05rem', color: 'var(--lp-muted, #64748b)', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 },

  grid: { display: 'grid', gridTemplateColumns: '1fr', gap: '40px', alignItems: 'flex-start' },

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
  
  benefitsList: { display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap', marginBottom: '40px', padding: 0, listStyle: 'none' },
  benefitItem: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', color: 'var(--lp-text)', fontWeight: 600 }
};

export default function BookDemo() {
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
        console.error('Failed to fetch plans for demo form', error);
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
        message: formData.get('message') || null,
        type: 'demo_request' // Custom flag to mark as Demo Request
      };

      const response = await api.post('/leads', data);

      if (response.data.success) {
        toast.success(response.data.message || 'Demo request sent! We will contact you soon to schedule the demo.');
        e.target.reset();
      } else {
        toast.error(response.data.message || 'Failed to send request. Please try again.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'An error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="book-demo" style={S.wrap}>
      <style>{`
        .lp-contact-input:focus { border-color: var(--lp-primary) !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15) !important; }
        .lp-contact-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(99,102,241,0.35) !important; filter: brightness(1.1); }
        .lp-contact-btn:active { transform: translateY(1px); filter: brightness(0.95); box-shadow: none !important; }
        @media (max-width: 640px) {
          .lp-contact-row { grid-template-columns: 1fr !important; }
          .lp-form-card { padding: 32px 24px !important; }
        }
      `}</style>

      <div style={S.inner}>
        {/* Header */}
        <div className="reveal" style={S.header}>
          <span style={S.eyebrow}>Free Demo</span>
          <h2 style={S.h2}>Experience the Platform Live</h2>
          <p style={S.subtitle}>
            Book a 1-on-1 personalized tour of ZenithFlows. We'll show you exactly how it can streamline your institute's operations and save you time.
          </p>
        </div>

        <ul className="reveal" style={S.benefitsList}>
          <li style={S.benefitItem}><span style={{color: 'var(--lp-primary)'}}><IconCheck /></span> Customized Walkthrough</li>
          <li style={S.benefitItem}><span style={{color: 'var(--lp-primary)'}}><IconCheck /></span> Q&A Session</li>
          <li style={S.benefitItem}><span style={{color: 'var(--lp-primary)'}}><IconCheck /></span> Data Migration Support</li>
        </ul>

        <div className="reveal" style={S.grid}>
          {/* Form Card */}
          <div className="lp-form-card" style={S.formCard}>
            <div style={S.formHeader}>
              <div style={S.formHeaderIcon}><IconChat /></div>
              <div>
                <div style={S.formTitle}>Book your free demo</div>
                <div style={S.formDesc}>Fill out the details and our experts will schedule a session.</div>
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
                  <input type="tel" name="phone" required className="lp-contact-input" style={S.input} placeholder="Enter your phone number" maxLength={15} />
                </div>
              </div>

              <div style={S.formGroup}>
                <label style={S.label}>Email Address *</label>
                <input type="email" name="email" required className="lp-contact-input" style={S.input} placeholder="Enter your email address" />
              </div>

              <div style={S.formGroup}>
                <label style={S.label}>Institute Name *</label>
                <input type="text" name="institute" required className="lp-contact-input" style={S.input} placeholder="Enter your institute name" />
              </div>

              <div className="lp-contact-row" style={S.formRow}>
                <div style={{ ...S.formGroup, marginBottom: 0 }}>
                  <label style={S.label}>No. of Students</label>
                  <select name="studentCount" className="lp-contact-input" style={S.input}>
                    <option value="">Select number of students</option>
                    <option>Less than 200</option>
                    <option>200 - 800</option>
                    <option>800 - 3000</option>
                    <option>3000+</option>
                  </select>
                </div>
                <div style={{ ...S.formGroup, marginBottom: 0 }}>
                  <label style={S.label}>Plan Interest</label>
                  <select name="plan" className="lp-contact-input" style={S.input}>
                    <option value="">Select a plan</option>
                    {plansLoading ? (
                      <option disabled>Loading plans...</option>
                    ) : (
                      plans.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div style={S.formGroup}>
                <label style={S.label}>Message / Requirements (Optional)</label>
                <textarea
                  name="message"
                  className="lp-contact-input"
                  style={{ ...S.input, minHeight: '100px', resize: 'vertical' }}
                  placeholder="How can we help you?"
                ></textarea>
              </div>

              <button type="submit" disabled={loading} className="lp-contact-btn" style={S.submitBtn}>
                {loading ? 'Sending Request...' : 'Book Free Demo'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
