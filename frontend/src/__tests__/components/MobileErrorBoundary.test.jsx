/**
 * MobileErrorBoundary Tests — ZF Solution Frontend
 * ==================================================
 * Covers: crash screen rendering, reload button, error logging.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MobileErrorBoundary from "../../components/MobileErrorBoundary";

// Component that throws on demand
const Bomb = ({ shouldThrow }) => {
  if (shouldThrow) throw new Error("Test crash");
  return <div data-testid="safe-content">Safe</div>;
};

// Suppress expected React error output
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("💥 MobileErrorBoundary", () => {
  it("TC-MEB-001 | renders children when no error", () => {
    render(
      <MobileErrorBoundary>
        <Bomb shouldThrow={false} />
      </MobileErrorBoundary>
    );
    expect(screen.getByTestId("safe-content")).toBeTruthy();
  });

  it("TC-MEB-002 | shows crash screen when child throws", () => {
    render(
      <MobileErrorBoundary>
        <Bomb shouldThrow={true} />
      </MobileErrorBoundary>
    );
    expect(screen.getByText(/Something Went Wrong/i)).toBeTruthy();
    expect(screen.queryByTestId("safe-content")).toBeNull();
  });

  it("TC-MEB-003 | shows Reload App button on crash screen", () => {
    render(
      <MobileErrorBoundary>
        <Bomb shouldThrow={true} />
      </MobileErrorBoundary>
    );
    expect(screen.getByRole("button", { name: /Reload App/i })).toBeTruthy();
  });

  it("TC-MEB-004 | shows Copy Error Info button", () => {
    render(
      <MobileErrorBoundary>
        <Bomb shouldThrow={true} />
      </MobileErrorBoundary>
    );
    expect(screen.getByRole("button", { name: /Copy Error Info/i })).toBeTruthy();
  });

  it("TC-MEB-005 | crash screen has reload button with correct id", () => {
    render(
      <MobileErrorBoundary>
        <Bomb shouldThrow={true} />
      </MobileErrorBoundary>
    );
    expect(document.getElementById("error-boundary-reload-btn")).toBeTruthy();
  });

  it("TC-MEB-006 | dispatches app_crash event on error", () => {
    const events = [];
    window.addEventListener("app_crash", (e) => events.push(e.detail));
    render(
      <MobileErrorBoundary>
        <Bomb shouldThrow={true} />
      </MobileErrorBoundary>
    );
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].message).toBe("Test crash");
  });
});
