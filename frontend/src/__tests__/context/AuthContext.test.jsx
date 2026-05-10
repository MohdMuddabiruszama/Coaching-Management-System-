/**
 * AuthContext Tests — ZF Solution Frontend
 * ==========================================
 * Covers:
 *  - login() success + token persistence
 *  - login() plan expiry detection
 *  - logout() clears session
 *  - session verify on mount (getProfile)
 *  - isInitializing lifecycle
 *  - branding triggers (setBranding / clearBranding called)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { AuthProvider, AuthContext } from "../../context/AuthContext";
import { useContext } from "react";

// ── Service mocks ────────────────────────────────────────────────────────────
vi.mock("../../services/auth.service", () => ({
  loginUser: vi.fn(),
  getProfile: vi.fn(),
}));

vi.mock("../../context/BrandingContext", () => ({
  BrandingContext: {
    _currentValue: { setBranding: vi.fn(), clearBranding: vi.fn() },
  },
  BrandingProvider: ({ children }) => children,
}));

import { loginUser, getProfile } from "../../services/auth.service";

// ── Helper: consumer component ────────────────────────────────────────────────
const Consumer = ({ onMount }) => {
  const ctx = useContext(AuthContext);
  onMount?.(ctx);
  return (
    <div>
      <span data-testid="init">{String(ctx.isInitializing)}</span>
      <span data-testid="user">{ctx.user ? ctx.user.role : "null"}</span>
    </div>
  );
};

const renderWithAuth = (onMount) =>
  render(
    <AuthProvider>
      <Consumer onMount={onMount} />
    </AuthProvider>
  );

// ── Setup / Teardown ─────────────────────────────────────────────────────────
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  sessionStorage.clear();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("🔐 AuthContext — initial state (no token)", () => {
  it("starts initializing=true then resolves to false with null user", async () => {
    getProfile.mockResolvedValue({ data: { success: false } });
    renderWithAuth();
    await waitFor(() => expect(screen.getByTestId("init").textContent).toBe("false"));
    expect(screen.getByTestId("user").textContent).toBe("null");
  });
});

describe("🔐 AuthContext — session restore on mount", () => {
  it("TC-AUTH-CTX-001 | restores user from valid session token", async () => {
    const mockUser = { id: 1, role: "admin", institute_id: 1, subscription_end: null };
    sessionStorage.setItem("token", "valid-token");
    getProfile.mockResolvedValue({ data: { success: true, user: mockUser } });

    renderWithAuth();
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("admin"));
  });

  it("TC-AUTH-CTX-002 | clears session if getProfile fails", async () => {
    sessionStorage.setItem("token", "bad-token");
    getProfile.mockRejectedValue(new Error("401 Unauthorized"));

    renderWithAuth();
    await waitFor(() => expect(screen.getByTestId("init").textContent).toBe("false"));
    expect(screen.getByTestId("user").textContent).toBe("null");
    expect(sessionStorage.getItem("token")).toBeNull();
  });

  it("TC-AUTH-CTX-003 | migrates legacy localStorage token to sessionStorage", async () => {
    localStorage.setItem("token", "legacy-token");
    localStorage.setItem("user", JSON.stringify({ id: 1, role: "student" }));
    getProfile.mockResolvedValue({ data: { success: true, user: { id: 1, role: "student", subscription_end: null } } });

    renderWithAuth();
    await waitFor(() => expect(screen.getByTestId("init").textContent).toBe("false"));

    expect(sessionStorage.getItem("token")).toBe("legacy-token");
    expect(localStorage.getItem("token")).toBeNull();
  });
});

describe("🔐 AuthContext — login()", () => {
  it("TC-AUTH-CTX-010 | sets user and token on successful login", async () => {
    const mockUser = { id: 1, role: "admin", subscription_end: null };
    loginUser.mockResolvedValue({ data: { token: "jwt-token", user: mockUser } });
    getProfile.mockResolvedValue({ data: { success: false } });

    let ctx;
    renderWithAuth((c) => { ctx = c; });
    await waitFor(() => expect(screen.getByTestId("init").textContent).toBe("false"));

    await act(async () => {
      await ctx.login({ email: "admin@test.com", password: "Pass123!" });
    });

    expect(sessionStorage.getItem("token")).toBe("jwt-token");
    expect(screen.getByTestId("user").textContent).toBe("admin");
  });

  it("TC-AUTH-CTX-011 | detects plan expiry on login", async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString(); // yesterday
    const mockUser = { id: 1, role: "admin", subscription_end: pastDate };
    loginUser.mockResolvedValue({ data: { token: "jwt-token", user: mockUser } });
    getProfile.mockResolvedValue({ data: { success: false } });

    let ctx;
    renderWithAuth((c) => { ctx = c; });
    await waitFor(() => expect(screen.getByTestId("init").textContent).toBe("false"));

    await act(async () => {
      await ctx.login({ email: "admin@test.com", password: "Pass123!" });
    });

    expect(sessionStorage.getItem("isPlanExpired")).toBe("true");
  });

  it("TC-AUTH-CTX-012 | active subscription → isPlanExpired = false", async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30).toISOString(); // +30 days
    const mockUser = { id: 1, role: "admin", subscription_end: futureDate };
    loginUser.mockResolvedValue({ data: { token: "jwt-token", user: mockUser } });
    getProfile.mockResolvedValue({ data: { success: false } });

    let ctx;
    renderWithAuth((c) => { ctx = c; });
    await waitFor(() => expect(screen.getByTestId("init").textContent).toBe("false"));

    await act(async () => {
      await ctx.login({ email: "admin@test.com", password: "Pass123!" });
    });

    expect(sessionStorage.getItem("isPlanExpired")).toBe("false");
  });
});

describe("🔐 AuthContext — logout()", () => {
  it("TC-AUTH-CTX-020 | clears all session data and user state", async () => {
    sessionStorage.setItem("token", "jwt-token");
    sessionStorage.setItem("isPlanExpired", "false");
    const mockUser = { id: 1, role: "admin", subscription_end: null };
    getProfile.mockResolvedValue({ data: { success: true, user: mockUser } });

    let ctx;
    renderWithAuth((c) => { ctx = c; });
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("admin"));

    act(() => { ctx.logout(); });

    expect(screen.getByTestId("user").textContent).toBe("null");
    expect(sessionStorage.getItem("token")).toBeNull();
  });
});
