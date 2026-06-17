/**
 * secureStorage — Phase 2A
 * ─────────────────────────────────────────────────────────────────────────────
 * On native (Android/iOS):  uses @capacitor/preferences (AES-256 encrypted).
 * On web:                   falls back to sessionStorage.
 *
 * API mirrors the native Preferences API but is fully async on both platforms.
 *
 * Usage:
 *   import * as secureStorage from '../services/secureStorage';
 *   await secureStorage.set('token', value);
 *   const token = await secureStorage.get('token');
 *   await secureStorage.remove('token');
 *   await secureStorage.clear();
 */

import { Capacitor } from "@capacitor/core";

const IS_NATIVE = Capacitor.isNativePlatform();

/** Lazy-loaded Preferences plugin (avoids web bundle bloat) */
let _Preferences = null;
const getPreferences = async () => {
    if (!IS_NATIVE) return null;
    if (_Preferences) return _Preferences;
    try {
        const mod = await import("@capacitor/preferences");
        _Preferences = mod.Preferences;
        return _Preferences;
    } catch {
        return null;
    }
};

/**
 * Store a value securely.
 * @param {string} key
 * @param {string} value — always stringified; pass JSON.stringify() for objects
 */
export const set = async (key, value) => {
    try {
        const Preferences = await getPreferences();
        if (Preferences) {
            await Preferences.set({ key, value: String(value) });
        } else {
            sessionStorage.setItem(key, value);
        }
    } catch (err) {
        console.warn(`[secureStorage] set(${key}) failed:`, err?.message);
        // Graceful fallback to sessionStorage
        try { sessionStorage.setItem(key, value); } catch {}
    }
};

/**
 * Retrieve a value.
 * @param {string} key
 * @returns {Promise<string|null>}
 */
export const get = async (key) => {
    try {
        const Preferences = await getPreferences();
        if (Preferences) {
            const { value } = await Preferences.get({ key });
            return value ?? null;
        }
        return sessionStorage.getItem(key);
    } catch (err) {
        console.warn(`[secureStorage] get(${key}) failed:`, err?.message);
        try { return sessionStorage.getItem(key); } catch { return null; }
    }
};

/**
 * Remove a single key.
 * @param {string} key
 */
export const remove = async (key) => {
    try {
        const Preferences = await getPreferences();
        if (Preferences) {
            await Preferences.remove({ key });
        } else {
            sessionStorage.removeItem(key);
        }
    } catch (err) {
        console.warn(`[secureStorage] remove(${key}) failed:`, err?.message);
        try { sessionStorage.removeItem(key); } catch {}
    }
};

/**
 * Clear all stored values.
 * On web, clears only sessionStorage (not localStorage).
 */
export const clear = async () => {
    try {
        const Preferences = await getPreferences();
        if (Preferences) {
            await Preferences.clear();
        } else {
            sessionStorage.clear();
        }
    } catch (err) {
        console.warn("[secureStorage] clear() failed:", err?.message);
        try { sessionStorage.clear(); } catch {}
    }
};

/**
 * Synchronous read — web sessionStorage only.
 * Use this ONLY in synchronous contexts (e.g. axios interceptor).
 * On native this is the same as sessionStorage (token mirrored there by AuthContext).
 */
export const getSync = (key) => {
    try { return sessionStorage.getItem(key); } catch { return null; }
};
