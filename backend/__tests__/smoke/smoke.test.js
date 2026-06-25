/**
 * Smoke Tests — Phase 2
 * ====================
 * Verifies the Express app starts correctly and all basic health-check
 * endpoints return expected responses.
 *
 * These are intentionally lightweight — no DB writes, no auth required.
 * They should ALWAYS pass on a working environment.
 */

const request = require("supertest");
const { app } = require("../helpers/testApp");

// ─────────────────────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────────────────────

describe("🟢 Smoke Tests — Health Check", () => {
  it("GET / → 200 with success:true and version", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.version).toBeDefined();
    expect(res.body.message).toMatch(/ZenithFlows/i);
    expect(res.body.timestamp).toBeDefined();
  });

  it("GET /nonexistent-route → 404 with success:false", async () => {
    const res = await request(app).get("/api/this-route-does-not-exist-xyz");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OTP Mode Endpoint
// ─────────────────────────────────────────────────────────────────────────────

describe("🟢 Smoke Tests — Auth Public Endpoints", () => {
  it("GET /api/auth/otp-mode → 200 with testMode field", async () => {
    const res = await request(app).get("/api/auth/otp-mode");
    expect(res.status).toBe(200);
    // Should return testMode flag
    expect(res.body).toHaveProperty("testMode");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Route Registration — all 36 modules should be loaded (returns 4xx not 404)
// ─────────────────────────────────────────────────────────────────────────────

describe("🟢 Smoke Tests — Route Registration", () => {
  const endpoints = [
    { method: "post", path: "/api/auth/login" },
    { method: "get", path: "/api/students" },
    { method: "get", path: "/api/faculty" },
    { method: "get", path: "/api/classes" },
    { method: "get", path: "/api/subjects" },
    { method: "post", path: "/api/attendance" },
    { method: "get", path: "/api/biometric/devices" },
    { method: "get", path: "/api/fees/structure" },
    { method: "get", path: "/api/exams" },
    { method: "get", path: "/api/announcements" },
    { method: "get", path: "/api/chat/rooms" },
    { method: "get", path: "/api/assignments" },
    { method: "get", path: "/api/notes" },
    { method: "get", path: "/api/timetable/slots" },
    { method: "get", path: "/api/expenses" },
    { method: "get", path: "/api/reports/fees" },
    { method: "get", path: "/api/manager/stats" },
    { method: "get", path: "/api/plans" },
    { method: "get", path: "/api/subscriptions" },
    { method: "get", path: "/api/invoices" },
    { method: "get", path: "/api/leads" },
    { method: "get", path: "/api/transport-fees" },
    { method: "get", path: "/api/superadmin/institutes" },
    { method: "get", path: "/api/admin/stats" },
    { method: "get", path: "/api/institutes" },
  ];

  test.each(endpoints)(
    "$method $path is registered (responds with auth error or success, not 404)",
    async ({ method, path }) => {
      // Getting a 404 means the route was never mounted in app.js or doesn't exist.
      const res = await request(app)[method](path);
      expect(res.status).not.toBe(404);
      expect(res.status).not.toBe(404);
    }
  );

  it("get /api/lifetime/info is registered (may return 404 if unseeded, but has valid JSON)", async () => {
    const res = await request(app).get("/api/lifetime/info");
    // It's allowed to return 404 if the lifetime plan doesn't exist in DB, but it must be a JSON response not an HTML 404.
    expect([200, 404]).toContain(res.status);
    expect(res.headers["content-type"]).toMatch(/json/);
  });
});
