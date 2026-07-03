import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import zfLogo from '../../assets/zf-logo.png';

const NAV_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Testimonials', href: '#testimonials' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Contact', href: '#contact' }
];

// Returns dashboard path based on the stored user role
function getDashboardPath(role) {
  const map = {
    super_admin: '/superadmin/dashboard',
    admin: '/admin/dashboard',
    manager: '/admin/dashboard',
    faculty: '/faculty/dashboard',
    student: '/student/dashboard',
    parent: '/parent/dashboard',
  };
  return map[role] || '/admin/dashboard';
}

function MobileDrawer({ onClose, scrollTo, onLoginClick }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return createPortal(
    <>
      <div className='lp-drawer-overlay' onClick={onClose} />
      <aside className='lp-mobile-drawer'>
        <button className='lp-drawer-close' onClick={onClose}>✕</button>
        <ul className='lp-drawer-links'>
          {NAV_LINKS.map(l => (
            <li key={l.label}>
              <a onClick={() => scrollTo(l.href)}>{l.label}</a>
            </li>
          ))}
        </ul>
        <div className='lp-drawer-btns' style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <button
            className='lp-btn-ghost'
            onClick={onLoginClick}
            style={{ border: '1px solid var(--lp-border)', cursor: 'pointer', width: '100%' }}
          >
            Login / Dashboard
          </button>
          <Link to='/register?plan=free_trial' className='lp-btn-primary' style={{ textDecoration: 'none', textAlign: 'center' }}>Get Started Free</Link>
        </div>
          </aside>
    </>,
    document.getElementById('mobile-drawer-root') || document.body
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState('home');
  const [drawer, setDrawer] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 30);
      const ids = ['home', 'features', 'pricing', 'testimonials', 'faq', 'contact'];
      let current = 'home';
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (el && window.scrollY >= el.offsetTop - 120) current = id;
      });
      setActive(current);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (href) => {
    const id = href.replace('#', '');
    const el = document.getElementById(id);
    if (el) {
      window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
    }
    setDrawer(false);
  };

  // Phase 1 Fix: Smart Login — if already logged in redirect to role dashboard, else go to /login
  const handleLoginClick = () => {
    try {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      const user = JSON.parse(sessionStorage.getItem('user') || localStorage.getItem('user') || 'null');
      if (token && user?.role) {
        navigate(getDashboardPath(user.role));
      } else {
        navigate('/login');
      }
    } catch {
      navigate('/login');
    }
    setDrawer(false);
  };

  return (
    <nav className={`lp-nav ${scrolled ? 'scrolled' : ''}`}>
      <Link to="/" className='lp-logo'>
        <img src={zfLogo} alt="ZF ZenithFlows" style={{ height: '40px', width: 'auto', objectFit: 'contain', borderRadius: '50%' }} />ZenithFlows
      </Link>

      <ul className='lp-nav-links'>
        {NAV_LINKS.map(l => (
          <li key={l.label}>
            <a
              className={active === l.href.slice(1) ? 'active' : ''}
              onClick={() => scrollTo(l.href)}
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>

      <div className='lp-nav-actions'>
        {/* Phase 1: Smart Login — routes to dashboard if logged in, else /login */}
        <button
          className='lp-btn-ghost'
          onClick={handleLoginClick}
          style={{ fontSize: '15px', marginRight: '8px' }}
        >
          Login
        </button>
          <Link to='/register?plan=free_trial' className='lp-btn-primary' style={{ padding: '12px 28px', fontSize: '15px', textDecoration: 'none' }}>Start Free Trial →</Link>
      </div>

      <button className='lp-hamburger' onClick={() => setDrawer(true)}>
        <span /><span /><span />
      </button>

      {drawer && (
        <MobileDrawer
          onClose={() => setDrawer(false)}
          scrollTo={scrollTo}
          onLoginClick={handleLoginClick}
        />
      )}
    </nav>
  );
}
