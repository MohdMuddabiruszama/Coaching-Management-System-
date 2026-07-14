import { useState, useEffect } from 'react';
import Navbar from '../../components/landing/Navbar';
import Hero from '../../components/landing/Hero';
import Features from '../../components/landing/Features';
import Pricing from '../../components/landing/Pricing';
import Testimonials from '../../components/landing/Testimonials';
import FAQ from '../../components/landing/FAQ';
import Contact from '../../components/landing/Contact';
import Footer from '../../components/landing/Footer';
import { useCursor } from '../../hooks/useCursor';
import '../../styles/landing.css';

export default function Home() {
  useCursor(); // Custom lag cursor effect

  // Scroll progress bar
  useEffect(() => {
    const update = () => {
      const scrolled = window.scrollY;
      const total = document.body.scrollHeight - window.innerHeight;
      const pct = (scrolled / total) * 100;
      const bar = document.getElementById('progress-bar');
      if (bar) bar.style.width = pct + '%';
    };
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  // Scroll to the right section based on the URL path or hash
  useEffect(() => {
    const p = window.location.pathname;
    const hash = window.location.hash.replace('#', '');
    const sectionMap = {
      '/pricing': 'pricing',
      '/renew-plan': 'pricing',
      '/features': 'features',
      '/terms': 'terms',
      '/privacy': 'privacy',
    };

    const sectionId = hash || sectionMap[p];
    if (sectionId) {
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) window.scrollTo({ top: el.offsetTop - 72, behavior: 'smooth' });
      }, 400);
    }
  }, []);

  // Set circular favicon for the landing page
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = Math.max(img.width, img.height);
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      
      // Draw circular clipping path
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();
      
      // Draw image
      const dx = (size - img.width) / 2;
      const dy = (size - img.height) / 2;
      ctx.drawImage(img, dx, dy, img.width, img.height);
      
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = canvas.toDataURL('image/png');
    };
    img.src = "/logo.png";
  }, []);

  return (
    <div className='landing-root'>
      <div id='progress-bar' />
      <div id='cursor' />
      <div id='cursor-ring' />
      <div id='mobile-drawer-root' />

      <Navbar />

      <main>
        <Hero />
        <Features />
        <Pricing />
        {/* Hiding Testimonials for now as per user request */}
        {false && <Testimonials />}
        <FAQ />
        <Contact />

      </main>

      <Footer />
    </div>
  );
}
