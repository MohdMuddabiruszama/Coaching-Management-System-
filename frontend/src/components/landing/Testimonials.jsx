import { TESTIMONIALS } from '../../data/testimonials';
import { useScrollReveal } from '../../hooks/useScrollReveal';

export default function Testimonials() {
  useScrollReveal('reveal', 0.1);

  return (
    <section className='lp-testi' id='testimonials'>
      <div className='lp-section-header reveal' style={{ marginBottom: 0 }}>
        <span className='lp-eyebrow'>Success Stories</span>
        <h2 className='lp-h2'>Trusted by Institute Directors</h2>
        <p className='lp-subtitle'>
          Hear from the leaders who transformed their operations using ZenithFlows.
        </p>
      </div>

      <div className='lp-marquee-wrap reveal'>
        <div className='lp-marquee'>
          {/* Double the array for seamless infinite scrolling */}
          {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
            <div className='lp-testi-card' key={`${t.id}-${i}`}>
              <div style={{ color: '#F59E0B', fontSize: '18px', marginBottom: '16px', letterSpacing: '4px' }}>
                {'★'.repeat(t.stars)}
              </div>
              <p className='lp-testi-text'>"{t.text}"</p>
              
              <div className='lp-testi-author'>
                <div 
                  className='lp-testi-avatar' 
                  style={{ background: `linear-gradient(135deg, ${t.author.gradientFrom}, ${t.author.gradientTo})` }}
                >
                  {t.author.initials}
                </div>
                <div>
                  <div className='lp-testi-name'>{t.author.name}</div>
                  <div className='lp-testi-role'>{t.author.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
