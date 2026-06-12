import { useEffect } from 'react';

export function useCursor() {
  useEffect(() => {
    // Only run on desktop/non-touch devices
    if ('ontouchstart' in window) return;

    const dot = document.getElementById('cursor');
    const ring = document.getElementById('cursor-ring');
    let mx = 0, my = 0, rx = 0, ry = 0;

    const onMove = (e) => {
      mx = e.clientX;
      my = e.clientY;
    };
    
    document.addEventListener('mousemove', onMove, { passive: true });

    // Interactive Hover Logic
    const addHoverEffect = () => {
      if (ring) {
        ring.style.transform = `translate(-50%, -50%) scale(1.8)`;
        ring.style.background = 'rgba(37, 99, 235, 0.08)';
        ring.style.borderColor = 'rgba(37, 99, 235, 0.5)';
      }
    };

    const removeHoverEffect = () => {
      if (ring) {
        ring.style.transform = `translate(-50%, -50%) scale(1)`;
        ring.style.background = 'transparent';
        ring.style.borderColor = 'var(--lp-primary)';
      }
    };

    const addClickEffect = () => {
      if (ring) {
        ring.style.transform = `translate(-50%, -50%) scale(0.8)`;
        setTimeout(() => {
          if (ring) ring.style.transform = `translate(-50%, -50%) scale(1.8)`;
        }, 150);
      }
    };

    const interactables = document.querySelectorAll('a, button, input, .feature-card, .lp-btn-ghost, .lp-btn-primary');
    
    interactables.forEach(el => {
      el.addEventListener('mouseenter', addHoverEffect);
      el.addEventListener('mouseleave', removeHoverEffect);
      el.addEventListener('mousedown', addClickEffect);
    });

    let raf;
    const loop = () => {
      // Lerp (Lag) for ring
      rx += (mx - rx) * 0.15;
      ry += (my - ry) * 0.15;

      if (dot) {
        dot.style.left = `${mx}px`;
        dot.style.top = `${my}px`;
      }
      if (ring) {
        ring.style.left = `${rx}px`;
        ring.style.top = `${ry}px`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // MutationObserver to attach events to dynamically added elements
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
          const newInteractables = document.querySelectorAll('a, button, input, .feature-card, .lp-btn-ghost, .lp-btn-primary');
          newInteractables.forEach(el => {
            // Remove first to prevent duplicate listeners
            el.removeEventListener('mouseenter', addHoverEffect);
            el.removeEventListener('mouseleave', removeHoverEffect);
            el.removeEventListener('mousedown', addClickEffect);
            
            el.addEventListener('mouseenter', addHoverEffect);
            el.addEventListener('mouseleave', removeHoverEffect);
            el.addEventListener('mousedown', addClickEffect);
          });
        }
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener('mousemove', onMove);
      interactables.forEach(el => {
        el.removeEventListener('mouseenter', addHoverEffect);
        el.removeEventListener('mouseleave', removeHoverEffect);
        el.removeEventListener('mousedown', addClickEffect);
      });
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);
}
