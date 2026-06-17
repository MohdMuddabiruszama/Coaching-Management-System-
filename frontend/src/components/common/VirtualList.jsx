import React, { useState, useRef } from 'react';

/**
 * Phase 4B — Virtual List Component
 * ─────────────────────────────────────────────────────────────────────────────
 * Lightweight virtual list for mobile performance.
 * Only renders items currently visible in the scroll window (plus a buffer).
 * Prevents DOM bloat when rendering hundreds of students.
 */
export default function VirtualList({ 
    items = [], 
    renderItem, 
    itemHeight = 80, 
    containerHeight = '400px', 
    buffer = 5 
}) {
    const [scrollTop, setScrollTop] = useState(0);
    const containerRef = useRef(null);

    const handleScroll = (e) => {
        setScrollTop(e.target.scrollTop);
    };

    const totalHeight = items.length * itemHeight;
    const visibleHeight = containerRef.current ? containerRef.current.clientHeight : 800; // Fallback
    
    // Calculate visible range
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
    const endIndex = Math.min(
        items.length - 1, 
        Math.floor((scrollTop + visibleHeight) / itemHeight) + buffer
    );

    const visibleItems = items.slice(startIndex, endIndex + 1);
    const offsetY = startIndex * itemHeight;

    if (items.length === 0) return null;

    return (
        <div 
            ref={containerRef}
            onScroll={handleScroll}
            className="virtual-list-container"
            style={{ 
                height: containerHeight, 
                overflowY: 'auto',
                position: 'relative',
                WebkitOverflowScrolling: 'touch'
            }}
        >
            <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${offsetY}px)`,
                    willChange: 'transform'
                }}>
                    {visibleItems.map((item, index) => renderItem(item, startIndex + index))}
                </div>
            </div>
        </div>
    );
}
