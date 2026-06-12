/**
 * ThemeSelector — Unified Theme Picker
 * 4 options: ☀️ Light (Simple), 🌙 Dark (Simple), ✨ Light Pro, 🔮 Dark Pro
 *   loginMode — (Deprecated) Previously used to limit options. Now behaves universally.
 */

import { useState, useRef, useEffect, useContext } from "react";
import { ThemeContext } from "../context/ThemeContext";
import { FiSun, FiMoon, FiStar, FiAperture } from "react-icons/fi";
import "./ThemeSelector.css";

const THEMES = [
    { id: "light-simple", label: "Light", icon: <FiSun size={18} />, isDark: false, style: "simple" },
    { id: "dark-simple", label: "Dark", icon: <FiMoon size={18} />, isDark: true, style: "simple" },
    { id: "light-pro", label: "Light Pro", icon: <FiStar size={18} style={{ color: '#f59e0b', fill: 'rgba(245, 158, 11, 0.2)' }} />, isDark: false, style: "pro" },
    { id: "dark-pro", label: "Dark Pro", icon: <FiAperture size={18} style={{ color: '#a855f7' }} />, isDark: true, style: "pro" },
];

function ThemeSelector({ loginMode = false }) {
    const { isDark, themeStyle, setTheme } = useContext(ThemeContext);
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef(null);

    // Active theme id
    const activeId = `${isDark ? "dark" : "light"}-${themeStyle}`;
    const active = THEMES.find(t => t.id === activeId) || THEMES[0];

    // Options visible in dropdown
    const visibleThemes = THEMES;

    const selectTheme = (theme) => {
        setTheme(theme.isDark, theme.style);
        setOpen(false);
    };

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    return (
        <div ref={wrapperRef} className="theme-selector">
            <button
                className={`theme-selector__trigger${open ? " theme-selector__trigger--open" : ""}`}
                onClick={() => setOpen(o => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
                title="Change Theme"
                type="button"
            >
                <span className="theme-selector__icon">{active.icon}</span>
                <span className="theme-selector__label">
                    {active.label}
                </span>
                <span className="theme-selector__arrow">▼</span>
            </button>

            {open && (
                <div className="theme-selector__dropdown" role="listbox">
                    {visibleThemes.map(theme => (
                        <button
                            key={theme.id}
                            className={`theme-selector__option${theme.id === activeId ? " theme-selector__option--active" : ""}`}
                            onClick={() => selectTheme(theme)}
                            role="option"
                            aria-selected={theme.id === activeId}
                            type="button"
                        >
                            <span className="theme-selector__opt-icon">{theme.icon}</span>
                            <span className="theme-selector__opt-label">{theme.label}</span>
                            {theme.id === activeId && <span className="theme-selector__check">✓</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default ThemeSelector;
