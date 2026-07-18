import { useEffect } from 'react';
import { useSEO } from '../../hooks/useSEO';
import Navbar from '../../components/landing/Navbar';
import BookDemo from '../../components/landing/BookDemo';
import Footer from '../../components/landing/Footer';
import { useCursor } from '../../hooks/useCursor';
import '../../styles/landing.css';

export default function BookDemoPage() {
  useCursor(); // Custom lag cursor effect

  useSEO({
    title: 'Book a Free Demo — ZenithFlows Institute Management System',
    description: 'Book a free personalised demo of ZenithFlows for your coaching institute, school or college. See attendance, fees, exams and parent communication in action.',
    canonical: '/book-demo',
    ogTitle: 'Book a Free ZenithFlows Demo',
    ogDescription: 'Schedule a live demo and see how ZenithFlows can transform your institute’s operations.',
  });

  useEffect(() => {
    // Scroll to top when page loads
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className='landing-root'>
      <div id='cursor' />
      <div id='cursor-ring' />
      <div id='mobile-drawer-root' />

      <Navbar />

      <main style={{ paddingTop: '80px', minHeight: '100vh', background: 'var(--lp-bg)' }}>
        <BookDemo />
      </main>

      <Footer />
    </div>
  );
}
