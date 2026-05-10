/**
 * ProtectedRoute Tests — ZF Solution Frontend
 * ============================================
 * Covers all access-control scenarios:
 *  - Unauthenticated → /login
 *  - Blocked account → BlockedScreen
 *  - First login student → /student/change-password
 *  - Wrong role → /unauthorized
 *  - Pending institute admin → /checkout
 *  - Expired plan → shows ExpiredPlanBanner
 *  - Authorized user → renders children
 *  - isInitializing → shows spinner
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProtectedRoute from "../../routes/ProtectedRoute";
import { AuthContext } from "../../context/AuthContext";

// ── Mock heavy child components ───────────────────────────────────────────────
vi.mock("../../pages/admin/BlockedScreen", () => ({
  default: () => <div data-testid="blocked-screen">Blocked</div>,
}));

vi.mock("../../components/common/ExpiredPlanBanner", () => ({
  default: () => <div data-testid="expired-banner">Expired</div>,
}));

// ── Helper ────────────────────────────────────────────────────────────────────
const renderRoute = ({ user, isInitializing = false, allowedRoles = [], token = null, skipFirstLoginCheck = false }) => {
  if (token) sessionStorage.setItem("token", token);
  else sessionStorage.removeItem("token");

  return render(
    <AuthContext.Provider value={{ user, isInitializing }}>
      <MemoryRouter>
        <ProtectedRoute allowedRoles={allowedRoles} skipFirstLoginCheck={skipFirstLoginCheck}>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    </AuthContext.Provider>
  );
};

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("🛡️ ProtectedRoute — Loading State", () => {
  it("TC-PR-001 | shows spinner while isInitializing = true", () => {
    renderRoute({ user: null, isInitializing: true });
    // Spinner renders, content does NOT render
    expect(screen.queryByTestId("protected-content")).toBeNull();
  });
});

describe("🛡️ ProtectedRoute — Unauthenticated", () => {
  it("TC-PR-010 | no token → redirects to /login (no content rendered)", () => {
    renderRoute({ user: null, token: null });
    expect(screen.queryByTestId("protected-content")).toBeNull();
  });

  it("TC-PR-011 | token present but user null → redirects to /login", () => {
    renderRoute({ user: null, token: "some-token" });
    expect(screen.queryByTestId("protected-content")).toBeNull();
  });
});

describe("🛡️ ProtectedRoute — Blocked Account", () => {
  it("TC-PR-020 | status=blocked → renders BlockedScreen", () => {
    const user = { id: 1, role: "admin", status: "blocked", isPlanExpired: false };
    renderRoute({ user, token: "valid-token" });
    expect(screen.getByTestId("blocked-screen")).toBeTruthy();
    expect(screen.queryByTestId("protected-content")).toBeNull();
  });
});

describe("🛡️ ProtectedRoute — First Login Student", () => {
  it("TC-PR-030 | student with is_first_login=true → redirects (no content)", () => {
    const user = { id: 2, role: "student", status: "active", is_first_login: true, isPlanExpired: false };
    renderRoute({ user, token: "student-token", allowedRoles: ["student"] });
    expect(screen.queryByTestId("protected-content")).toBeNull();
  });

  it("TC-PR-031 | skipFirstLoginCheck=true bypasses the first-login redirect", () => {
    const user = { id: 2, role: "student", status: "active", is_first_login: true, isPlanExpired: false };
    renderRoute({ user, token: "student-token", allowedRoles: ["student"], skipFirstLoginCheck: true });
    expect(screen.getByTestId("protected-content")).toBeTruthy();
  });
});

describe("🛡️ ProtectedRoute — Role Authorization", () => {
  it("TC-PR-040 | wrong role → redirects to /unauthorized (no content)", () => {
    const user = { id: 3, role: "student", status: "active", is_first_login: false, isPlanExpired: false };
    renderRoute({ user, token: "student-token", allowedRoles: ["admin"] });
    expect(screen.queryByTestId("protected-content")).toBeNull();
  });

  it("TC-PR-041 | correct role → renders children", () => {
    const user = { id: 4, role: "admin", status: "active", is_first_login: false, isPlanExpired: false };
    renderRoute({ user, token: "admin-token", allowedRoles: ["admin"] });
    expect(screen.getByTestId("protected-content")).toBeTruthy();
  });

  it("TC-PR-042 | no allowedRoles restriction → any role can access", () => {
    const user = { id: 5, role: "faculty", status: "active", is_first_login: false, isPlanExpired: false };
    renderRoute({ user, token: "faculty-token", allowedRoles: [] });
    expect(screen.getByTestId("protected-content")).toBeTruthy();
  });

  it("TC-PR-043 | super_admin bypasses plan expiry banner", () => {
    const user = { id: 99, role: "super_admin", status: "active", is_first_login: false, isPlanExpired: true };
    renderRoute({ user, token: "super-token", allowedRoles: ["super_admin"] });
    expect(screen.queryByTestId("expired-banner")).toBeNull();
    expect(screen.getByTestId("protected-content")).toBeTruthy();
  });
});

describe("🛡️ ProtectedRoute — Plan Expiry", () => {
  it("TC-PR-050 | isPlanExpired=true → shows ExpiredPlanBanner + content still renders", () => {
    const user = { id: 6, role: "admin", status: "active", is_first_login: false, isPlanExpired: true };
    renderRoute({ user, token: "admin-token", allowedRoles: ["admin"] });
    expect(screen.getByTestId("expired-banner")).toBeTruthy();
    expect(screen.getByTestId("protected-content")).toBeTruthy();
  });

  it("TC-PR-051 | isPlanExpired=false → no banner", () => {
    const user = { id: 7, role: "admin", status: "active", is_first_login: false, isPlanExpired: false };
    renderRoute({ user, token: "admin-token", allowedRoles: ["admin"] });
    expect(screen.queryByTestId("expired-banner")).toBeNull();
  });
});

describe("🛡️ ProtectedRoute — Pending Institute", () => {
  it("TC-PR-060 | admin with institute_status=pending → redirects to /checkout", () => {
    const user = { id: 8, role: "admin", status: "active", is_first_login: false, isPlanExpired: false, institute_status: "pending" };
    renderRoute({ user, token: "admin-token", allowedRoles: ["admin"] });
    expect(screen.queryByTestId("protected-content")).toBeNull();
  });
});
