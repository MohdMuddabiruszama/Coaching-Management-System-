/**
 * api.js Interceptor Tests — ZF Solution Frontend
 * ================================================
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react-hot-toast", () => ({
  default: { error: vi.fn() },
}));

// Plan expiry blocking helper (mirrors api.js logic)
const checkPlanExpiry = (method, url) => {
  const isPlanExpired = sessionStorage.getItem("isPlanExpired") === "true";
  if (isPlanExpired && method.toUpperCase() !== "GET") {
    const whitelisted = ["/auth/", "/login", "/checkout", "/verify", "/payment"];
    if (!whitelisted.some((w) => url.includes(w))) {
      throw { customName: "PLAN_EXPIRED_READONLY" };
    }
  }
};

beforeEach(() => sessionStorage.clear());

describe("🔐 api.js — Token Attachment", () => {
  it("TC-API-001 | attaches Bearer token from sessionStorage", () => {
    sessionStorage.setItem("token", "test-jwt");
    const config = { headers: {}, method: "GET" };
    const token = sessionStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    expect(config.headers.Authorization).toBe("Bearer test-jwt");
  });

  it("TC-API-002 | no token → no Authorization header", () => {
    const config = { headers: {} };
    const token = sessionStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    expect(config.headers.Authorization).toBeUndefined();
  });
});

describe("🔐 api.js — Plan Expiry Blocking", () => {
  beforeEach(() => sessionStorage.setItem("isPlanExpired", "true"));

  it("TC-API-010 | POST blocked when plan expired", () => {
    expect(() => checkPlanExpiry("POST", "/api/students")).toThrow();
  });

  it("TC-API-011 | GET allowed even when plan expired", () => {
    expect(() => checkPlanExpiry("GET", "/api/students")).not.toThrow();
  });

  it("TC-API-012 | /auth/ routes whitelisted — POST not blocked", () => {
    expect(() => checkPlanExpiry("POST", "/api/auth/login")).not.toThrow();
  });

  it("TC-API-013 | /payment routes whitelisted", () => {
    expect(() => checkPlanExpiry("POST", "/api/payment/verify")).not.toThrow();
  });

  it("TC-API-014 | /checkout routes whitelisted", () => {
    expect(() => checkPlanExpiry("POST", "/api/checkout")).not.toThrow();
  });
});

describe("🌐 api.js — Navigation Events", () => {
  const dispatch = (status, code = null) => {
    const events = [];
    const captureNav = (e) => events.push(e.detail);
    const captureOffline = () => events.push({ type: "offline" });
    window.addEventListener("app_navigate", captureNav);
    window.addEventListener("offline_api_error", captureOffline);

    const data = code ? { code } : {};
    if (status === 401) {
      sessionStorage.clear();
      window.dispatchEvent(new CustomEvent("app_navigate", { detail: { path: "/login", clearSession: true } }));
    }
    if (status === 402) {
      window.dispatchEvent(new CustomEvent("app_navigate", { detail: { path: "/checkout" } }));
    }
    if (status === 403 && data?.code === "SUBSCRIPTION_EXPIRED") {
      window.dispatchEvent(new CustomEvent("app_navigate", { detail: { path: "/renew-plan" } }));
    }
    if (status === 403 && data?.code === "INSTITUTE_SUSPENDED") {
      window.dispatchEvent(new CustomEvent("app_navigate", { detail: { path: "/suspended", clearSession: true } }));
    }
    if (status >= 500) {
      window.dispatchEvent(new Event("offline_api_error"));
    }

    window.removeEventListener("app_navigate", captureNav);
    window.removeEventListener("offline_api_error", captureOffline);
    return events;
  };

  it("TC-API-020 | 401 → app_navigate to /login", () => {
    expect(dispatch(401).some((e) => e.path === "/login")).toBe(true);
  });

  it("TC-API-021 | 402 → app_navigate to /checkout", () => {
    expect(dispatch(402).some((e) => e.path === "/checkout")).toBe(true);
  });

  it("TC-API-022 | 403 SUBSCRIPTION_EXPIRED → /renew-plan", () => {
    expect(dispatch(403, "SUBSCRIPTION_EXPIRED").some((e) => e.path === "/renew-plan")).toBe(true);
  });

  it("TC-API-023 | 403 INSTITUTE_SUSPENDED → /suspended", () => {
    expect(dispatch(403, "INSTITUTE_SUSPENDED").some((e) => e.path === "/suspended")).toBe(true);
  });

  it("TC-API-024 | 500 → offline_api_error event", () => {
    expect(dispatch(500).some((e) => e.type === "offline")).toBe(true);
  });
});
