import { useState } from 'react';
import { FAQ_ITEMS } from '../../data/faq';
import { useScrollReveal } from '../../hooks/useScrollReveal';

/* ── Icons ── */
const IconPlus = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const IconMinus = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const IconChat = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    <circle cx="8" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/>
  </svg>
);

const IconChevronDown = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto' }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

const IconChevronUp = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto' }}>
    <polyline points="18 15 12 9 6 15"/>
  </svg>
);

/* ── Inline Styles ── */
const S = {
  wrap: { padding: '120px 0', background: 'var(--lp-bg)', position: 'relative', fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif" },
  inner: { maxWidth: '850px', margin: '0 auto', padding: '0 1.5rem' },
  header: { textAlign: 'center', marginBottom: '3rem' },
  eyebrow: { display: 'inline-block', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--lp-primary, #6366f1)', marginBottom: '0.5rem' },
  h2: { fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 800, color: 'var(--lp-text, #0f172a)', lineHeight: 1.2, marginBottom: '1rem', letterSpacing: '-0.5px' },
  subtitle: { fontSize: '1.05rem', color: 'var(--lp-muted, #64748b)', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 },
  
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  
  item: (isOpen) => ({
    background: 'var(--lp-surface)',
    border: `1px solid var(--lp-border)`,
    borderRadius: '12px',
    overflow: 'hidden',
    transition: 'all 0.3s ease',
    boxShadow: isOpen ? 'var(--lp-shadow-sm)' : '0 2px 4px rgba(0,0,0,0.01)',
  }),
  
  qRow: { display: 'flex', alignItems: 'center', padding: '20px 24px', cursor: 'pointer', userSelect: 'none' },
  
  iconWrap: (isOpen) => ({
    width: '26px', height: '26px', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginRight: '16px', flexShrink: 0,
    transition: 'all 0.2s',
    background: isOpen ? 'var(--lp-primary, #6366f1)' : 'transparent',
    color: isOpen ? '#ffffff' : 'var(--lp-primary, #6366f1)',
    border: isOpen ? '1px solid var(--lp-primary, #6366f1)' : '1px solid var(--lp-border)',
  }),
  
  qText: { fontSize: '1.05rem', fontWeight: 600, color: 'var(--lp-text, #0f172a)', flex: 1 },
  
  aWrap: (isOpen) => ({
    maxHeight: isOpen ? '400px' : '0',
    overflow: 'hidden',
    transition: 'max-height 0.3s ease-in-out',
    padding: isOpen ? '0 24px 24px 66px' : '0 24px 0 66px',
    opacity: isOpen ? 1 : 0,
  }),
  
  aText: { color: 'var(--lp-muted, #64748b)', fontSize: '0.95rem', lineHeight: 1.6 },

  /* Contact Footer */
  contactCard: {
    marginTop: '48px', background: 'var(--lp-surface)', border: '1px solid var(--lp-border)', borderRadius: '16px',
    padding: '32px', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap',
    boxShadow: 'var(--lp-shadow-sm)',
  },
  cIconWrap: {
    width: '64px', height: '64px', background: 'rgba(99,102,241,0.1)', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lp-primary, #6366f1)', flexShrink: 0,
  },
  cTextWrap: { flex: 1, minWidth: '200px' },
  cTitle: { fontWeight: 800, fontSize: '1.25rem', color: 'var(--lp-text, #0f172a)', marginBottom: '4px' },
  cDesc: { color: 'var(--lp-muted, #64748b)', fontSize: '0.95rem' },
  cBtn: {
    background: 'var(--lp-primary, #6366f1)', color: '#fff', padding: '14px 28px', borderRadius: '10px',
    fontWeight: 600, fontSize: '0.95rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
    transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(99,102,241,0.2)'
  }
};

export default function FAQ() {
  useScrollReveal('reveal', 0.1);
  const [openId, setOpenId] = useState(null);

  const toggle = (id) => setOpenId(openId === id ? null : id);

  return (
    <section id="faq" style={S.wrap}>
      {/* Micro animations */}
      <style>{`
        .lp-faq-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 14px rgba(99,102,241,0.25) !important; filter: brightness(1.1); }
        .lp-faq-btn:active { transform: translateY(1px); filter: brightness(0.95); box-shadow: none !important; }
        .lp-faq-row:hover .lp-icon-circle { background: #eff6ff !important; border-color: #a5b4fc !important; }
        .lp-faq-row.is-open:hover .lp-icon-circle { background: var(--lp-primary) !important; border-color: var(--lp-primary) !important; }
      `}</style>

      <div style={S.inner}>
        {/* Header */}
        <div className="reveal" style={S.header}>
          <span style={S.eyebrow}>Got Questions?</span>
          <h2 style={S.h2}>Frequently Asked Questions</h2>
          <p style={S.subtitle}>
            Everything you need to know about the product and billing.<br />
            Can't find an answer? Feel free to contact our support team.
          </p>
        </div>

        {/* FAQ List */}
        <div className="reveal" style={S.list}>
          {FAQ_ITEMS.map((item) => {
            const isOpen = openId === item.id;
            return (
              <div key={item.id} style={S.item(isOpen)}>
                <div className={`lp-faq-row ${isOpen ? 'is-open' : ''}`} style={S.qRow} onClick={() => toggle(item.id)}>
                  <div className="lp-icon-circle" style={S.iconWrap(isOpen)}>
                    {isOpen ? <IconMinus /> : <IconPlus />}
                  </div>
                  <div style={S.qText}>{item.question}</div>
                  {isOpen ? <IconChevronUp /> : <IconChevronDown />}
                </div>
                <div style={S.aWrap(isOpen)}>
                  <div style={S.aText}>
                    {item.answer}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Contact Support Footer Card */}
        <div className="reveal" style={S.contactCard}>
          <div style={S.cIconWrap}>
            <IconChat />
          </div>
          <div style={S.cTextWrap}>
            <div style={S.cTitle}>Still have questions?</div>
            <div style={S.cDesc}>Our support team is here to help you.</div>
          </div>
          <button 
            className="lp-faq-btn" 
            style={S.cBtn}
            onClick={() => {
                document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Contact Support <span>→</span>
          </button>
        </div>
      </div>
    </section>
  );
}
