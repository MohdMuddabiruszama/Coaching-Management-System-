/**
 * SplashOverlay — Professional animated mobile splash screen.
 *
 * Architecture:
 *  • Native splash (static PNG) appears instantly when app opens.
 *  • This overlay renders immediately in React with the same dark bg — seamless handoff.
 *  • Native splash is hidden at once (behind this overlay, invisible).
 *  • This overlay runs its 2.5 s animation sequence.
 *  • Once auth finishes AND minimum time has elapsed → elegant exit animation.
 *
 * Only renders on native platform or mobile build variants.
 */

import { useContext, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { AuthContext } from "../context/AuthContext";
import { useBrandingContext } from "../context/BrandingContext";
import "./SplashOverlay.css";

/* ── Constants ──────────────────────────────────────────────── */
const IS_NATIVE       = Capacitor.isNativePlatform();
const APP_TYPE        = String(import.meta.env.VITE_APP_VARIANT || "web").toLowerCase();
const IS_MOBILE_BUILD = Boolean(import.meta.env.VITE_APP_VARIANT) && APP_TYPE !== "web";

/** Minimum ms the overlay is visible (lets animations complete). */
const MIN_SHOW_MS = 2500;

/* ── Particle config (static — no random jitter between renders) ── */
const PARTICLES = [
    { id: 0, x:  8, y: 75, size: 3, dur: "5.5s", delay: "0s",    dx:  40 },
    { id: 1, x: 20, y: 60, size: 2, dur: "6.2s", delay: "0.8s",  dx: -30 },
    { id: 2, x: 35, y: 80, size: 4, dur: "4.8s", delay: "1.5s",  dx:  60 },
    { id: 3, x: 50, y: 70, size: 2, dur: "7.0s", delay: "0.3s",  dx: -50 },
    { id: 4, x: 65, y: 85, size: 3, dur: "5.2s", delay: "1.1s",  dx:  35 },
    { id: 5, x: 78, y: 65, size: 2, dur: "6.5s", delay: "0.6s",  dx: -45 },
    { id: 6, x: 90, y: 78, size: 4, dur: "4.5s", delay: "1.8s",  dx:  25 },
    { id: 7, x: 12, y: 40, size: 2, dur: "5.8s", delay: "2.2s",  dx:  55 },
    { id: 8, x: 55, y: 50, size: 3, dur: "6.8s", delay: "0.4s",  dx: -60 },
    { id: 9, x: 85, y: 45, size: 2, dur: "5.0s", delay: "1.3s",  dx:  40 },
];

/* ── Component ──────────────────────────────────────────────── */
export default function SplashOverlay() {
    const { isInitializing } = useContext(AuthContext);
    const { logo, name, tagline } = useBrandingContext();
    
    const [visible,  setVisible]  = useState(true);
    const [exiting,  setExiting]  = useState(false);
    const shownAtRef = useRef(Date.now());

    /* Hide native splash immediately — this overlay takes over */
    useEffect(() => {
        if (!IS_NATIVE) return;
        (async () => {
            try {
                const { SplashScreen } = await import("@capacitor/splash-screen");
                await SplashScreen.hide({ fadeOutDuration: 0 });
            } catch { /* non-fatal */ }
        })();
    }, []);

    /* Trigger exit once auth is done + minimum time has elapsed */
    useEffect(() => {
        if (isInitializing) return;

        const elapsed   = Date.now() - shownAtRef.current;
        const remaining = Math.max(0, MIN_SHOW_MS - elapsed);

        const timer = setTimeout(() => {
            setExiting(true);
            // Remove from DOM after exit animation completes (550 ms)
            setTimeout(() => setVisible(false), 580);
        }, remaining);

        return () => clearTimeout(timer);
    }, [isInitializing]);

    if (!IS_NATIVE && !IS_MOBILE_BUILD) return null;
    if (!visible) return null;

    return (
        <div className={`splash-overlay${exiting ? " splash-exiting" : ""}`}>

            {/* ── Background gradient breath ── */}
            <div className="splash-bg-gradient" />

            {/* ── Ambient orbs ── */}
            <div className="splash-orb splash-orb-1" />
            <div className="splash-orb splash-orb-2" />
            <div className="splash-orb splash-orb-3" />

            {/* ── Floating particles ── */}
            {PARTICLES.map(p => (
                <div
                    key={p.id}
                    className="splash-particle"
                    style={{
                        left:    `${p.x}%`,
                        bottom:  `${p.y - 50}%`,
                        width:   `${p.size}px`,
                        height:  `${p.size}px`,
                        "--p-dur":   p.dur,
                        "--p-delay": p.delay,
                        "--p-dx":    `${p.dx}px`,
                    }}
                />
            ))}

            {/* ── Center content ── */}
            <div className="splash-center">

                {/* Logo + pulsing rings */}
                <div className="splash-logo-wrap">
                    <div className="splash-ring splash-ring-1" />
                    <div className="splash-ring splash-ring-2" />
                    <div className="splash-ring splash-ring-3" />
                    <img
                        className="splash-logo-img"
                        src={logo}
                        alt={name}
                        draggable={false}
                    />
                </div>

                {/* App name + tagline */}
                <div className="splash-text-group">
                    <h1 className="splash-app-name">{name}</h1>
                    <div className="splash-divider" />
                    <p className="splash-tagline">{tagline}</p>
                </div>
            </div>

            {/* ── Loading dots ── */}
            <div className="splash-dots">
                <div className="splash-dot" />
                <div className="splash-dot" />
                <div className="splash-dot" />
            </div>

            {/* ── Version ── */}
            <div className="splash-version">v 1.0.0</div>
        </div>
    );
}
