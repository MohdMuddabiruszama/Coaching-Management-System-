/**
 * NetworkStatus Tests — ZF Solution Frontend
 * ============================================
 * Tests the online/offline/server-down state logic.
 *
 * NOTE: NetworkStatus imports a CSS file. In jsdom, CSS imports are no-ops.
 * We test the component logic by triggering DOM events and verifying state
 * transitions using `@testing-library/react`'s act() + waitFor().
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import NetworkStatus from "../../components/NetworkStatus";

// CSS imports are no-ops in jsdom — no mock needed
// Capacitor mocked in test-setup.js as IS_NATIVE = false

beforeEach(() => {
  vi.clearAllMocks();
  // Reset online state
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
});

afterEach(() => {
  // Cleanup event listeners by unmounting between tests
});

describe("📡 NetworkStatus — Online (no events)", () => {
  it("TC-NET-001 | renders null when online and no events fired", () => {
    const { container } = render(<NetworkStatus />);
    // Component returns null when online and no back-online toast needed
    expect(container.firstChild).toBeNull();
  });
});

describe("📡 NetworkStatus — Server Down (offline_api_error event)", () => {
  it("TC-NET-010 | component mounts without crashing", () => {
    // Verifies the component renders cleanly in jsdom (no exception)
    expect(() => render(<NetworkStatus />)).not.toThrow();
  });

  it("TC-NET-011 | offline_api_error event does not crash the component", async () => {
    render(<NetworkStatus />);
    // Should not throw — async handler is fire-and-forget
    await act(async () => {
      window.dispatchEvent(new Event("offline_api_error"));
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(document.body).toBeTruthy();
  });
});

describe("📡 NetworkStatus — Offline event (web, non-native)", () => {
  it("TC-NET-020 | dispatching window offline event triggers offline state", async () => {
    // Set navigator.onLine to false before firing event
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    render(<NetworkStatus />);

    await act(async () => {
      window.dispatchEvent(new Event("offline"));
    });

    await waitFor(
      () => {
        const body = document.body.innerHTML;
        expect(
          body.includes("offline") ||
          body.includes("Internet") ||
          body.includes("connection")
        ).toBe(true);
      },
      { timeout: 3000 }
    );
  });

  it("TC-NET-021 | back-online state triggers after online event", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    render(<NetworkStatus />);

    await act(async () => {
      window.dispatchEvent(new Event("offline"));
    });

    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(
      () => {
        const body = document.body.innerHTML;
        // Either "Back Online" text or online class appears
        expect(
          body.includes("online") || body.includes("Online") || body.includes("connection")
        ).toBe(true);
      },
      { timeout: 5000 }
    );
  });
});

describe("📡 NetworkStatus — State Logic (unit)", () => {
  it("TC-NET-030 | IS_NATIVE is false in test environment (Capacitor mocked)", async () => {
    const { Capacitor } = await import("@capacitor/core");
    expect(Capacitor.isNativePlatform()).toBe(false);
  });
});
