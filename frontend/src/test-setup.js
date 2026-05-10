/**
 * Vitest Global Test Setup — ZF Solution Frontend
 * ================================================
 * Loaded before every test file via vite.config.js `test.setupFiles`.
 *
 * Responsibilities:
 *  1. Extend `expect` with @testing-library/jest-dom matchers
 *  2. Mock Capacitor (not available in jsdom)
 *  3. Mock browser APIs missing from jsdom (sessionStorage, localStorage, matchMedia)
 *  4. Suppress known noisy console errors during tests
 */

import "@testing-library/jest-dom";
import { vi } from "vitest";

// ── 1. Mock Capacitor Core ──────────────────────────────────────────────────
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
    getPlatform:      vi.fn(() => "web"),
  },
}));

// ── 2. Mock Capacitor Plugins ───────────────────────────────────────────────
vi.mock("@capacitor/network", () => ({
  Network: {
    getStatus:             vi.fn(async () => ({ connected: true, connectionType: "wifi" })),
    addListener:           vi.fn(async () => ({ remove: vi.fn() })),
    removeAllListeners:    vi.fn(async () => {}),
  },
}));

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get:    vi.fn(async () => ({ value: null })),
    set:    vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    clear:  vi.fn(async () => {}),
  },
}));

vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: {
    checkPermissions:    vi.fn(async () => ({ receive: "denied" })),
    requestPermissions:  vi.fn(async () => ({ receive: "denied" })),
    addListener:         vi.fn(async () => ({ remove: vi.fn() })),
    removeAllListeners:  vi.fn(async () => {}),
    register:            vi.fn(async () => {}),
  },
}));

vi.mock("@capacitor/splash-screen", () => ({
  SplashScreen: {
    hide:  vi.fn(async () => {}),
    show:  vi.fn(async () => {}),
  },
}));

vi.mock("@capacitor/camera", () => ({
  Camera: {
    getPhoto: vi.fn(async () => ({ webPath: "mock://photo", base64String: "" })),
  },
  CameraResultType: { Uri: "uri", Base64: "base64" },
  CameraSource:     { Camera: "CAMERA", Photos: "PHOTOS" },
}));

// ── 3. Mock browser APIs ────────────────────────────────────────────────────
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn((query) => ({
    matches:          false,
    media:            query,
    onchange:         null,
    addListener:      vi.fn(),
    removeListener:   vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent:    vi.fn(),
  })),
});

// sessionStorage — keep real implementation but ensure it's writable
if (!window.sessionStorage) {
  let storage = {};
  Object.defineProperty(window, "sessionStorage", {
    value: {
      getItem:    (k)    => storage[k] ?? null,
      setItem:    (k, v) => { storage[k] = String(v); },
      removeItem: (k)    => { delete storage[k]; },
      clear:      ()     => { storage = {}; },
    },
  });
}

// navigator.onLine
Object.defineProperty(navigator, "onLine", {
  configurable: true,
  get: () => true,
});

// ── 4. Suppress noisy React / Capacitor console output during tests ─────────
const SUPPRESSED_PATTERNS = [
  "Warning: ReactDOM.render",
  "Warning: An update to",
  "act(...)",
  "[Capacitor]",
  "⚠️ VITE_API_URL",
];

const origError = console.error.bind(console);
const origWarn  = console.warn.bind(console);

console.error = (...args) => {
  const msg = String(args[0] ?? "");
  if (SUPPRESSED_PATTERNS.some((p) => msg.includes(p))) return;
  origError(...args);
};

console.warn = (...args) => {
  const msg = String(args[0] ?? "");
  if (SUPPRESSED_PATTERNS.some((p) => msg.includes(p))) return;
  origWarn(...args);
};
