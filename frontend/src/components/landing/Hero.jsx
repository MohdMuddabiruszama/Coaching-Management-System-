import { useCountUp } from '../../hooks/useCountUp';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { Link } from 'react-router-dom';
import zfLogo from '../../assets/zf-logo.png';
import { useRef, useState, useEffect } from 'react';

export default function Hero() {
  useScrollReveal('reveal', 0.1);
  const statsRef = useRef(null);
  const [statsVisible, setStatsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      setStatsVisible(entries[0].isIntersecting);
    }, { threshold: 0.1 });

    if (statsRef.current) {
      observer.observe(statsRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const countInstitutes = useCountUp(99, 2000, statsVisible);
  const countPassRate = useCountUp(96, 2000, statsVisible);
  const countCities = useCountUp(48, 2000, statsVisible);

  // Phase 3 Fix: "View Pricing" scrolls to #pricing section on same page
  const scrollToPricing = (e) => {
    e.preventDefault();
    const el = document.getElementById('pricing');
    if (el) {
      window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
    }
  };

  return (
    <>
      <section className='lp-hero' id='home'>
        <div className='lp-hero-bg' />
        <div className='lp-hero-blob' />

        <div className='lp-hero-content'>

          <h1 className='lp-hero-h1 reveal' style={{ transitionDelay: '0.1s' }}>
            Manage Your Coaching Institute{' '}
            <span style={{ color: 'var(--lp-indigo)' }}>Like a Pro</span>
          </h1>

          <p className='lp-hero-p reveal' style={{ transitionDelay: '0.2s' }}>
            The all-in-one platform for student management, attendance, fees, online exams & AI analytics. Streamline operations and get back to teaching.
          </p>

          <div className='lp-hero-actions reveal' style={{ transitionDelay: '0.3s' }}>
            <Link to='/register?plan=free_trial' className='lp-btn-primary' style={{ padding: '14px 32px', fontSize: '15px', color: 'white', textDecoration: 'none' }}>
              Start Free Trial →
            </Link>
            <a href='#pricing' className='lp-btn-ghost' onClick={scrollToPricing} style={{ background: 'var(--lp-surface)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', color: 'var(--lp-secondary)', padding: '14px 32px' }}>
              <span style={{marginRight: '8px', color: 'var(--lp-primary)'}}>🏷️</span> View Pricing
            </a>
          </div>

          <div className='lp-trust reveal' style={{ transitionDelay: '0.4s', gap: '24px' }}>
            <div className='lp-trust-item' style={{display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: 'var(--lp-muted)'}}>
              <div style={{width: '20px', height: '20px', borderRadius: '50%', background: 'color-mix(in srgb, var(--lp-primary) 10%, transparent)', color: 'var(--lp-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px'}}>✓</div>
              14-Day Free Trial
            </div>
            <div className='lp-trust-item' style={{display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: 'var(--lp-muted)'}}>
              <div style={{width: '20px', height: '20px', borderRadius: '50%', background: 'color-mix(in srgb, var(--lp-primary) 10%, transparent)', color: 'var(--lp-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px'}}>✓</div>
              No Credit Card
            </div>
            <div className='lp-trust-item' style={{display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: 'var(--lp-muted)'}}>
              <div style={{width: '20px', height: '20px', borderRadius: '50%', background: 'color-mix(in srgb, var(--lp-primary) 10%, transparent)', color: 'var(--lp-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px'}}>✓</div>
              Easy Setup
            </div>
          </div>
        </div>

        <div className='lp-hero-visual reveal' style={{ transitionDelay: '0.5s' }}>
          <div className='lp-detailed-mockup'>
            {/* Sidebar */}
            <div className='lp-mockup-sidebar'>
              <div className='lp-mockup-logo' style={{ display: 'flex', justifyContent: 'center' }}>
                 <img src={zfLogo} alt="ZF" style={{ height: '36px', width: 'auto', objectFit: 'contain', borderRadius: '8px' }} />
              </div>
              <div className='lp-mockup-menu'>
                <div className='lp-mockup-menu-item active'>📊 Dashboard</div>
                <div className='lp-mockup-menu-item'>👨‍🎓 Students</div>
                <div className='lp-mockup-menu-item'>📅 Attendance</div>
                <div className='lp-mockup-menu-item'>💰 Fees</div>
                <div className='lp-mockup-menu-item'>📝 Exams</div>
                <div className='lp-mockup-menu-item'>📈 Reports</div>
                <div className='lp-mockup-menu-item'>💬 Messages</div>
                <div className='lp-mockup-menu-item' style={{marginTop: 'auto'}}>⚙️ Settings</div>
              </div>
            </div>
            
            {/* Main Content */}
            <div className='lp-mockup-main'>
              {/* Header */}
              <div className='lp-mockup-topbar'>
                <div>
                  <h3 style={{margin: 0, fontSize: '16px', color: 'var(--lp-secondary)'}}>Dashboard</h3>
                  <div style={{fontSize: '11px', color: 'var(--lp-muted)'}}>Welcome back, Admin! Here's what's happening today.</div>
                </div>
                <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
                  <span style={{fontSize: '14px', color: 'var(--lp-muted)'}}>🔍</span>
                  <div style={{position: 'relative'}}>
                    <span style={{fontSize: '14px', color: 'var(--lp-muted)'}}>🔔</span>
                    <span style={{position: 'absolute', top: '-2px', right: '-2px', width: '6px', height: '6px', background: 'var(--lp-red)', borderRadius: '50%'}}></span>
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                    <div style={{width: '24px', height: '24px', borderRadius: '50%', background: 'var(--lp-border)'}}></div>
                    <div style={{fontSize: '11px', fontWeight: '600'}}>Admin <span style={{fontSize: '9px', color: 'var(--lp-muted)', display: 'block'}}>Super Admin</span></div>
                  </div>
                </div>
              </div>

              <div style={{padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1}}>
                {/* Stats row */}
                <div className='lp-mockup-stats-row'>
                  <div className='lp-mockup-statcard'>
                    <div className='statcard-icon' style={{background: 'rgba(59, 130, 246, 0.1)', color: 'var(--lp-blue)'}}>👥</div>
                    <div>
                      <div className='statcard-label'>Total Students</div>
                      <div className='statcard-val'>1,245</div>
                      <div className='statcard-sub'><span style={{color: 'var(--lp-green)'}}>+12%</span> this month</div>
                    </div>
                  </div>
                  <div className='lp-mockup-statcard'>
                    <div className='statcard-icon' style={{background: 'rgba(34, 197, 94, 0.1)', color: 'var(--lp-green)'}}>📊</div>
                    <div>
                      <div className='statcard-label'>Today's Attendance</div>
                      <div className='statcard-val'>98%</div>
                      <div className='statcard-sub'>Present: 1,220</div>
                    </div>
                  </div>
                  <div className='lp-mockup-statcard'>
                    <div className='statcard-icon' style={{background: 'rgba(139, 92, 246, 0.1)', color: 'var(--lp-violet)'}}>💳</div>
                    <div>
                      <div className='statcard-label'>Total Revenue</div>
                      <div className='statcard-val'>₹12.4L</div>
                      <div className='statcard-sub'><span style={{color: 'var(--lp-green)'}}>+18%</span> this month</div>
                    </div>
                  </div>
                  <div className='lp-mockup-statcard'>
                    <div className='statcard-icon' style={{background: 'rgba(245, 158, 11, 0.1)', color: 'var(--lp-amber)'}}>📄</div>
                    <div>
                      <div className='statcard-label'>Pending Fees</div>
                      <div className='statcard-val'>₹2.4L</div>
                      <div className='statcard-sub'><span style={{color: 'var(--lp-amber)'}}>45 Students</span></div>
                    </div>
                  </div>
                </div>

                {/* Bottom Row */}
                <div className='lp-mockup-bottom-row'>
                  {/* Chart area */}
                  <div className='lp-mockup-chartarea'>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '16px'}}>
                      <div style={{fontSize: '12px', fontWeight: '700', color: 'var(--lp-secondary)'}}>Monthly Revenue Overview</div>
                      <div style={{fontSize: '10px', color: 'var(--lp-muted)', border: '1px solid var(--lp-border)', padding: '2px 6px', borderRadius: '4px'}}>This Year ⌄</div>
                    </div>
                    <div className='lp-mockup-chart-lines'>
                      <div className='chart-grid-line'><span>₹20L</span><div></div></div>
                      <div className='chart-grid-line'><span>₹15L</span><div></div></div>
                      <div className='chart-grid-line'><span>₹10L</span><div></div></div>
                      <div className='chart-grid-line'><span>₹5L</span><div></div></div>
                      <div className='chart-grid-line'><span>₹0</span><div></div></div>
                    </div>
                    {/* Fake SVG Chart Line */}
                    <svg className="lp-mockup-svg" viewBox="0 0 400 120" preserveAspectRatio="none" style={{overflow: 'visible'}}>
                      <defs>
                        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--lp-primary)" stopOpacity="0.2"/>
                          <stop offset="100%" stopColor="var(--lp-primary)" stopOpacity="0"/>
                        </linearGradient>
                      </defs>
                      <polyline className="lp-chart-line" points="0,102 36,72 72,69 109,54 145,66 181,69 218,57 254,48 290,33 327,36 363,33 400,6" fill="none" stroke="var(--lp-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      <polygon className="lp-chart-area" points="0,102 36,72 72,69 109,54 145,66 181,69 218,57 254,48 290,33 327,36 363,33 400,6 400,120 0,120" fill="url(#grad)" />
                      <circle className="lp-chart-dot" style={{animationDelay: '0.50s'}} cx="0" cy="102" r="4" fill="var(--lp-surface)" stroke="var(--lp-primary)" strokeWidth="2" />
                      <circle className="lp-chart-dot" style={{animationDelay: '0.66s'}} cx="36" cy="72" r="4" fill="var(--lp-surface)" stroke="var(--lp-primary)" strokeWidth="2" />
                      <circle className="lp-chart-dot" style={{animationDelay: '0.82s'}} cx="72" cy="69" r="4" fill="var(--lp-surface)" stroke="var(--lp-primary)" strokeWidth="2" />
                      <circle className="lp-chart-dot" style={{animationDelay: '0.98s'}} cx="109" cy="54" r="4" fill="var(--lp-surface)" stroke="var(--lp-primary)" strokeWidth="2" />
                      <circle className="lp-chart-dot" style={{animationDelay: '1.14s'}} cx="145" cy="66" r="4" fill="var(--lp-surface)" stroke="var(--lp-primary)" strokeWidth="2" />
                      <circle className="lp-chart-dot" style={{animationDelay: '1.30s'}} cx="181" cy="69" r="4" fill="var(--lp-surface)" stroke="var(--lp-primary)" strokeWidth="2" />
                      <circle className="lp-chart-dot" style={{animationDelay: '1.46s'}} cx="218" cy="57" r="4" fill="var(--lp-surface)" stroke="var(--lp-primary)" strokeWidth="2" />
                      <circle className="lp-chart-dot" style={{animationDelay: '1.62s'}} cx="254" cy="48" r="4" fill="var(--lp-surface)" stroke="var(--lp-primary)" strokeWidth="2" />
                      <circle className="lp-chart-dot" style={{animationDelay: '1.78s'}} cx="290" cy="33" r="4" fill="var(--lp-surface)" stroke="var(--lp-primary)" strokeWidth="2" />
                      <circle className="lp-chart-dot" style={{animationDelay: '1.94s'}} cx="327" cy="36" r="4" fill="var(--lp-surface)" stroke="var(--lp-primary)" strokeWidth="2" />
                      <circle className="lp-chart-dot" style={{animationDelay: '2.10s'}} cx="363" cy="33" r="4" fill="var(--lp-surface)" stroke="var(--lp-primary)" strokeWidth="2" />
                      <circle className="lp-chart-dot" style={{animationDelay: '2.26s'}} cx="400" cy="6" r="4" fill="var(--lp-surface)" stroke="var(--lp-primary)" strokeWidth="2" />
                    </svg>
                    <div className='chart-x-axis'>
                      <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
                    </div>
                  </div>

                  {/* Recent Activities */}
                  <div className='lp-mockup-activities'>
                    <div style={{fontSize: '12px', fontWeight: '700', color: 'var(--lp-secondary)', marginBottom: '12px'}}>Recent Activities</div>
                    <div className='activity-item'>
                      <div className='activity-icon' style={{background: 'rgba(59, 130, 246, 0.1)', color: 'var(--lp-blue)'}}>👤</div>
                      <div>
                        <div className='activity-title'>New student Aditya Sharma</div>
                        <div className='activity-time'>Just now</div>
                      </div>
                    </div>
                    <div className='activity-item'>
                      <div className='activity-icon' style={{background: 'rgba(34, 197, 94, 0.1)', color: 'var(--lp-green)'}}>💸</div>
                      <div>
                        <div className='activity-title'>Fee payment of ₹15,000</div>
                        <div className='activity-time'>2 mins ago</div>
                      </div>
                    </div>
                    <div className='activity-item'>
                      <div className='activity-icon' style={{background: 'rgba(16, 185, 129, 0.1)', color: 'var(--lp-emerald)'}}>📋</div>
                      <div>
                        <div className='activity-title'>Attendance marked for Class 10A</div>
                        <div className='activity-time'>10 mins ago</div>
                      </div>
                    </div>
                    <div className='activity-item'>
                      <div className='activity-icon' style={{background: 'rgba(139, 92, 246, 0.1)', color: 'var(--lp-violet)'}}>📝</div>
                      <div>
                        <div className='activity-title'>New exam scheduled</div>
                        <div className='activity-time'>1 hour ago</div>
                      </div>
                    </div>
                    <div style={{marginTop: 'auto', textAlign: 'center'}}>
                      <button style={{width: '100%', padding: '6px', fontSize: '10px', background: 'var(--lp-bg)', border: 'none', color: 'var(--lp-indigo)', borderRadius: '6px', fontWeight: '600'}}>View All Activities</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className='lp-stats-strip reveal' ref={statsRef}>
        <div className='lp-stat-item'>
          <div className='lp-stat-icon' style={{background: 'rgba(168,85,247,0.1)', color: 'var(--lp-fuchsia)'}}>🏫</div>
          <div>
            <div className='lp-stat-num'>{countInstitutes}+</div>
            <div className='lp-stat-label'>Institutes Active</div>
          </div>
        </div>
        <div className='lp-stat-divider'></div>
        <div className='lp-stat-item'>
          <div className='lp-stat-icon' style={{background: 'rgba(34,197,94,0.1)', color: '#22C55E'}}>👥</div>
          <div>
            <div className='lp-stat-num'>50,000+</div>
            <div className='lp-stat-label'>Students Managed</div>
          </div>
        </div>
        <div className='lp-stat-divider'></div>
        <div className='lp-stat-item'>
          <div className='lp-stat-icon' style={{background: 'rgba(59,130,246,0.1)', color: '#3B82F6'}}>📈</div>
          <div>
            <div className='lp-stat-num'>{countPassRate}%</div>
            <div className='lp-stat-label'>Avg. Pass Rate</div>
          </div>
        </div>
        <div className='lp-stat-divider'></div>
        <div className='lp-stat-item'>
          <div className='lp-stat-icon' style={{background: 'rgba(249,115,22,0.1)', color: '#F97316'}}>📍</div>
          <div>
            <div className='lp-stat-num'>{countCities}+</div>
            <div className='lp-stat-label'>Cities Covered</div>
          </div>
        </div>
      </section>
    </>
  );
}
