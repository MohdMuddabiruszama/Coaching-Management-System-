import { Link } from 'react-router-dom';
import zfLogo from '../../assets/zf-logo.png';

/* ── SVGs ── */
const IconFB = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>;
const IconX = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>;
const IconLI = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>;
const IconYT = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg>;

const IconLoc = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>;
const IconMail = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>;
const IconPhone = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57-.35-.11-.74-.03-1.02.24l-2.2 2.2c-2.83-1.44-5.15-3.75-6.59-6.58l2.2-2.21c.28-.27.36-.66.25-1.01A11.36 11.36 0 0 1 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z"/></svg>;

const IconShield = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>;
const IconCloud = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><line x1="12" y1="12" x2="12" y2="18"/><line x1="9" y1="15" x2="15" y2="15"/></svg>;
const IconHeadset = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>;
const IconRefresh = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>;

/* ── Inline Styles ── */
const S = {
  wrap: { background: 'var(--lp-surface)', paddingTop: '100px', fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif" },
  inner: { maxWidth: '1440px', margin: '0 auto', padding: '0 4vw' },
  grid: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr', gap: '40px', marginBottom: '60px' },
  
  colTitle: { fontWeight: 800, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--lp-text)', marginBottom: '24px' },
  
  desc: { color: 'var(--lp-muted)', fontSize: '0.95rem', lineHeight: 1.6, marginTop: '20px', maxWidth: '280px' },
  socialWrap: { display: 'flex', gap: '12px', marginTop: '24px' },
  
  linkList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px' },
  linkItem: { display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--lp-muted)', fontSize: '0.95rem', textDecoration: 'none', transition: 'color 0.2s' },
  linkIcon: { color: 'var(--lp-primary)', display: 'flex', alignItems: 'center' },
  
  demoBtn: {
    marginTop: '16px', background: 'transparent', color: 'var(--lp-primary)', border: '1px solid var(--lp-primary)',
    padding: '10px 24px', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
  },
  
  highlightsBox: {
    background: 'rgba(99,102,241,0.03)', border: '1px solid var(--lp-border)', borderRadius: '20px',
    padding: '32px 40px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '24px', marginBottom: '60px'
  },
  hlItem: { display: 'flex', alignItems: 'center', gap: '16px', flex: '1 1 200px' },
  hlIconWrap: { width: '48px', height: '48px', background: 'var(--lp-surface)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lp-primary)', border: '1px solid var(--lp-border)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', flexShrink: 0 },
  hlTitle: { fontWeight: 700, fontSize: '0.95rem', color: 'var(--lp-text)', marginBottom: '4px' },
  hlDesc: { fontSize: '0.8rem', color: 'var(--lp-muted)', lineHeight: 1.4 },
  
  bottom: { borderTop: '1px solid var(--lp-border)', padding: '24px 0', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', color: 'var(--lp-muted)', fontSize: '0.85rem' }
};

export default function Footer() {
  return (
    <footer style={S.wrap}>
      <style>{`
        @media (max-width: 900px) { .lp-f-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 600px) { .lp-f-grid { grid-template-columns: 1fr !important; } }
        .lp-social-btn { width: 40px; height: 40px; border: 1px solid var(--lp-border); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: var(--lp-muted); transition: all 0.2s; background: var(--lp-surface); cursor: pointer; }
        .lp-social-btn:hover { color: var(--lp-primary); border-color: var(--lp-primary); transform: translateY(-2px); }
        .lp-f-link:hover { color: var(--lp-primary) !important; }
        .lp-f-demo:hover { background: var(--lp-primary) !important; color: #fff !important; }
      `}</style>
      <div style={S.inner}>
        
        {/* Top 4 Columns */}
        <div className="lp-f-grid" style={S.grid}>
          {/* Col 1 */}
          <div>
            <Link to='/' style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'var(--lp-text)', fontWeight: 800, fontSize: '1.4rem' }}>
              <img src={zfLogo} alt="ZenithFlows" style={{ height: '40px', width: '40px', objectFit: 'contain', borderRadius: '50%' }} /> ZenithFlows
            </Link>
            <p style={S.desc}>
              The all-in-one platform for coaching institutes. Manage students, attendance, fees, and exams seamlessly. Built for scale.
            </p>
            <div style={S.socialWrap}>
              <a href="#" className="lp-social-btn"><IconFB /></a>
              <a href="#" className="lp-social-btn"><IconX /></a>
              <a href="#" className="lp-social-btn"><IconLI /></a>
              <a href="#" className="lp-social-btn"><IconYT /></a>
            </div>
          </div>

          {/* Col 2 */}
          <div>
            <div style={S.colTitle}>Platform</div>
            <ul style={S.linkList}>
              <li><a href="#features" className="lp-f-link" style={S.linkItem}>Features</a></li>
              <li><a href="#pricing" className="lp-f-link" style={S.linkItem}>Pricing & Plans</a></li>
              {/* <li><a href="#testimonials" className="lp-f-link" style={S.linkItem}>Success Stories</a></li> */}
              <li><Link to="/register?plan=free_trial" className="lp-f-link" style={S.linkItem}>Start Free Trial</Link></li>
              <li><Link to="/login" className="lp-f-link" style={S.linkItem}>Sign In</Link></li>
            </ul>
          </div>

          {/* Col 3 */}
          <div>
            <div style={S.colTitle}>Resources</div>
            <ul style={S.linkList}>
              <li><a href="#faq" className="lp-f-link" style={S.linkItem}>FAQ</a></li>
              <li><a href="#contact" className="lp-f-link" style={S.linkItem}>Contact Support</a></li>
              <li><a href="#" className="lp-f-link" style={S.linkItem}>Terms of Service</a></li>
              <li><a href="#" className="lp-f-link" style={S.linkItem}>Privacy Policy</a></li>
              <li><a href="#" className="lp-f-link" style={S.linkItem}>Blog</a></li>
            </ul>
          </div>

          {/* Col 4 */}
          <div>
            <div style={S.colTitle}>Get in Touch</div>
            <ul style={S.linkList}>
              <li style={S.linkItem}><span style={S.linkIcon}><IconLoc /></span> Hyderabad, Telangana</li>
              <li><a href="mailto:muddabir03@gmail.com" className="lp-f-link" style={S.linkItem}><span style={S.linkIcon}><IconMail /></span> muddabir03@gmail.com</a></li>
              <li><a href="tel:+918275668600" className="lp-f-link" style={S.linkItem}><span style={S.linkIcon}><IconPhone /></span> +91 82756 68600</a></li>
            </ul>
            <Link to="/book-demo" className="lp-f-demo" style={S.demoBtn}>
              Book a Demo <span>→</span>
            </Link>
          </div>
        </div>

        {/* Highlights Banner */}
        <div style={S.highlightsBox}>
          <div style={S.hlItem}>
            <div style={S.hlIconWrap}><IconShield /></div>
            <div>
              <div style={S.hlTitle}>Secure & Compliant</div>
              <div style={S.hlDesc}>256-bit SSL encryption & data privacy compliant</div>
            </div>
          </div>
          <div style={S.hlItem}>
            <div style={S.hlIconWrap}><IconCloud /></div>
            <div>
              <div style={S.hlTitle}>99.9% Uptime</div>
              <div style={S.hlDesc}>High availability and reliable infrastructure</div>
            </div>
          </div>
          <div style={S.hlItem}>
            <div style={S.hlIconWrap}><IconHeadset /></div>
            <div>
              <div style={S.hlTitle}>24/7 Support</div>
              <div style={S.hlDesc}>Dedicated support team always here to help</div>
            </div>
          </div>
          <div style={S.hlItem}>
            <div style={S.hlIconWrap}><IconRefresh /></div>
            <div>
              <div style={S.hlTitle}>Regular Updates</div>
              <div style={S.hlDesc}>Continuous improvements and new features</div>
            </div>
          </div>
        </div>

        {/* Bottom Footer */}
        <div style={S.bottom}>
          <span>© {new Date().getFullYear()} ZenithFlows. All rights reserved.</span>
          <span>Made with <span style={{ color: '#ef4444' }}>❤️</span> in Hyderabad, Telangana.</span>
        </div>

      </div>
    </footer>
  );
}
