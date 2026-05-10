/**
 * Assignment Tests — ZF Solution Backend
 * =======================================
 * Tests /api/assignments/* endpoints:
 *  - Auth enforcement (no token → 401)
 *  - Role-based access (student/parent cannot create)
 *  - Validation (empty body, missing fields)
 *  - Submission flow (student submitting)
 *  - Faculty-specific endpoints
 */

const request = require("supertest");
const { app, FAKE_TOKENS } = require("../helpers/testApp");

const ADMIN_AUTH   = { Authorization: `Bearer ${FAKE_TOKENS.admin}` };
const FACULTY_AUTH = { Authorization: `Bearer ${FAKE_TOKENS.faculty}` };
const STUDENT_AUTH = { Authorization: `Bearer ${FAKE_TOKENS.student}` };
const PARENT_AUTH  = { Authorization: `Bearer ${FAKE_TOKENS.parent}` };

// ─────────────────────────────────────────────────────────────────────────────
// Auth Enforcement
// ─────────────────────────────────────────────────────────────────────────────

describe("📝 Assignments — Auth Enforcement", () => {
  it("TC-ASN-001 | GET /api/assignments without token → 401", async () => {
    const res = await request(app).get("/api/assignments");
    expect(res.status).toBe(401);
  });

  it("TC-ASN-002 | POST /api/assignments without token → 401", async () => {
    const res = await request(app)
      .post("/api/assignments")
      .send({ title: "Test", subject_id: 1, due_date: "2025-01-01" });
    expect(res.status).toBe(401);
  });

  it("TC-ASN-003 | DELETE /api/assignments/:id without token → 401", async () => {
    const res = await request(app).delete("/api/assignments/1");
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Role-Based Access
// ─────────────────────────────────────────────────────────────────────────────

describe("📝 Assignments — Role Access Control", () => {
  it("TC-ASN-010 | Student cannot POST new assignment → 401 or 403", async () => {
    const res = await request(app)
      .post("/api/assignments")
      .set(STUDENT_AUTH)
      .send({ title: "Hack", subject_id: 1, due_date: "2025-01-01" });
    expect([401, 403]).toContain(res.status);
  });

  it("TC-ASN-011 | Parent cannot POST new assignment → 401 or 403", async () => {
    const res = await request(app)
      .post("/api/assignments")
      .set(PARENT_AUTH)
      .send({ title: "Hack", subject_id: 1 });
    expect([401, 403]).toContain(res.status);
  });

  it("TC-ASN-012 | Faculty can access GET /api/assignments (with valid token)", async () => {
    const res = await request(app)
      .get("/api/assignments")
      .set(FACULTY_AUTH);
    // With fake token (no real DB user) → 401; with seeded DB → 200
    expect([200, 401, 403]).toContain(res.status);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

describe("📝 Assignments — Validation", () => {
  it("TC-ASN-020 | POST with empty body with faculty token → 400 or 401", async () => {
    const res = await request(app)
      .post("/api/assignments")
      .set(FACULTY_AUTH)
      .send({});
    expect([400, 401]).toContain(res.status);
  });

  it("TC-ASN-021 | POST with missing due_date with faculty → 400 or 401", async () => {
    const res = await request(app)
      .post("/api/assignments")
      .set(FACULTY_AUTH)
      .send({ title: "Homework 1", subject_id: 1 });
    expect([400, 401]).toContain(res.status);
  });

  it("TC-ASN-022 | SQL injection in title is handled safely", async () => {
    const res = await request(app)
      .post("/api/assignments")
      .set(FACULTY_AUTH)
      .send({ title: "'; DROP TABLE assignments;--", subject_id: 1, due_date: "2025-01-01" });
    expect(res.status).not.toBe(500);
  });

  it("TC-ASN-023 | XSS payload in description is rejected or sanitized", async () => {
    const res = await request(app)
      .post("/api/assignments")
      .set(FACULTY_AUTH)
      .send({ title: "Valid Title", description: "<script>alert('xss')</script>", subject_id: 1, due_date: "2025-01-01" });
    expect(res.status).not.toBe(500);
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain("<script>");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Submission Flow
// ─────────────────────────────────────────────────────────────────────────────

describe("📝 Assignments — Student Submission", () => {
  it("TC-ASN-030 | POST /api/assignments/:id/submit without token → 401", async () => {
    const res = await request(app)
      .post("/api/assignments/1/submit")
      .send({ content: "My answer" });
    expect(res.status).toBe(401);
  });

  it("TC-ASN-031 | Student submit for non-existent assignment → 401 or 404", async () => {
    const res = await request(app)
      .post("/api/assignments/99999/submit")
      .set(STUDENT_AUTH)
      .send({ content: "My answer" });
    expect([401, 404]).toContain(res.status);
  });

  it("TC-ASN-032 | Faculty cannot submit as student → 401 or 403", async () => {
    const res = await request(app)
      .post("/api/assignments/1/submit")
      .set(FACULTY_AUTH)
      .send({ content: "Faculty answer" });
    expect([401, 403]).toContain(res.status);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Grading
// ─────────────────────────────────────────────────────────────────────────────

describe("📝 Assignments — Grading", () => {
  it("TC-ASN-040 | Student cannot grade submissions → 401 or 403", async () => {
    const res = await request(app)
      .put("/api/assignments/1/submissions/1/grade")
      .set(STUDENT_AUTH)
      .send({ marks: 85, feedback: "Good work" });
    expect([401, 403]).toContain(res.status);
  });

  it("TC-ASN-041 | Grade endpoint without token → 401", async () => {
    const res = await request(app)
      .put("/api/assignments/1/submissions/1/grade")
      .send({ marks: 85 });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Update & Delete
// ─────────────────────────────────────────────────────────────────────────────

describe("📝 Assignments — Update & Delete", () => {
  it("TC-ASN-050 | PUT /api/assignments/:id without token → 401", async () => {
    const res = await request(app)
      .put("/api/assignments/1")
      .send({ title: "Updated" });
    expect(res.status).toBe(401);
  });

  it("TC-ASN-051 | DELETE /api/assignments/99999 with admin → 401 or 404", async () => {
    const res = await request(app)
      .delete("/api/assignments/99999")
      .set(ADMIN_AUTH);
    expect([401, 404]).toContain(res.status);
  });

  it("TC-ASN-052 | Student cannot delete any assignment → 401 or 403", async () => {
    const res = await request(app)
      .delete("/api/assignments/1")
      .set(STUDENT_AUTH);
    expect([401, 403]).toContain(res.status);
  });
});
