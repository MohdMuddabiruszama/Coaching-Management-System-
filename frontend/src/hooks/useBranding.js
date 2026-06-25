/**
 * useBranding — Multi-tenant dynamic branding hook.
 *
 * Stores/restores institute branding in localStorage so it persists
 * across app restarts. Falls back to ZF defaults when no branding is saved.
 *
 * Usage:
 *   const { logo, name, tagline, color, setBranding, clearBranding } = useBranding();
 */

import { useState, useCallback } from "react";
import { resolveImgUrl } from "../utils/resolveUrl";
import zfLogo from "../assets/zf-logo.png";

const STORAGE_KEY = "app_branding";

export const DEFAULT_BRANDING = {
    logo: zfLogo,
    name: "ZenithFlows",
    tagline: "Empowering Education",
    color: "#667eea",
    isDefault: true,
};

/** Read branding synchronously from localStorage (no async flash). */
function readStored() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_BRANDING;
        return { ...DEFAULT_BRANDING, ...JSON.parse(raw), isDefault: false };
    } catch {
        return DEFAULT_BRANDING;
    }
}

export function useBranding() {
    const [branding, setBrandingState] = useState(readStored);

    /**
     * Call after successful login.
     * Extracts institute logo/name from the user object returned by the API.
     */
    const setBranding = useCallback((user) => {
        if (!user) return;

        const institute = user.Institute || {};
        const rawLogo   = institute.logo || user.institute_logo || null;
        const name      = institute.name || user.institute_name || DEFAULT_BRANDING.name;
        const color     = institute.theme_color || DEFAULT_BRANDING.color;
        const tagline   = institute.tagline || DEFAULT_BRANDING.tagline;

        // Resolve logo — handles relative /uploads/ paths and Cloudinary URLs
        const logo = rawLogo
            ? resolveImgUrl(rawLogo)
            : DEFAULT_BRANDING.logo;

        const next = { logo, name, tagline, color, isDefault: false };

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch { /* storage quota — non-fatal */ }

        setBrandingState(next);
    }, []);

    /** Call on logout — resets to ZF defaults and clears localStorage. */
    const clearBranding = useCallback(() => {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch { /* non-fatal */ }
        setBrandingState(DEFAULT_BRANDING);
    }, []);

    return { ...branding, setBranding, clearBranding };
}
