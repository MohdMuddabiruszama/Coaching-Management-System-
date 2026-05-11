/**
 * ✅ Phase 7: Webhook Integration Tests
 * Tests Razorpay webhook signature verification and event processing.
 *
 * Coverage: webhook.controller.js
 * - subscription.charged → creates subscription, activates institute
 * - subscription.halted  → marks subscription failed, suspends institute
 * - subscription.cancelled → marks unpaid, expires institute
 * - Invalid signature → 400 rejection
 * - Unknown event type → 200 graceful no-op
 * - Missing institute_id → 200 graceful no-op
 */

const request = require("supertest");
const app = require("../../app");
const crypto = require("crypto");
const { Subscription, Institute, Plan, User } = require("../../models");

// ── Test Webhook Secret (mirrors process.env.RAZORPAY_WEBHOOK_SECRET in test) ──
const TEST_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "test_webhook_secret_123";

/**
 * Generate HMAC SHA-256 signature matching Razorpay's verification pattern.
 * The webhook controller hashes the raw body buffer against the secret.
 */
function generateSignature(rawBody) {
    return crypto
        .createHmac("sha256", TEST_WEBHOOK_SECRET)
        .update(rawBody)
        .digest("hex");
}

/**
 * Build a standard Razorpay subscription webhook payload.
 */
function buildPayload(event, overrides = {}) {
    return {
        event,
        payload: {
            subscription: {
                entity: {
                    id: `sub_test_${Date.now()}`,
                    plan_id: overrides.plan_id || null,
                    current_end: overrides.current_end || Math.floor(Date.now() / 1000) + 86400 * 30,
                    notes: {
                        institute_id: overrides.institute_id || null,
                        ...overrides.notes,
                    },
                    ...overrides.entity,
                },
            },
        },
    };
}

describe("Webhook Integration Tests", () => {
    let testInstitute;
    let testPlan;

    // ── Setup: Create a test institute and plan ──────────────────────
    beforeAll(async () => {
        // Find or create a test plan
        testPlan = await Plan.findOne({ where: { name: "Basic" } });
        if (!testPlan) {
            testPlan = await Plan.create({
                name: "Basic",
                price: 999,
                billing_cycle: "monthly",
                max_students: 100,
                max_faculty: 20,
                max_classes: 10,
                max_admin_users: 2,
                feature_attendance: "basic",
                feature_fees: true,
                feature_reports: "basic",
                feature_announcements: true,
            });
        }

        // Create a test institute
        const adminUser = await User.create({
            name: "Webhook Test Admin",
            email: `webhook_admin_${Date.now()}@test.com`,
            password_hash: "$2b$10$testhashedpassword",
            role: "admin",
        });

        testInstitute = await Institute.create({
            name: "Webhook Test Institute",
            email: `webhook_inst_${Date.now()}@test.com`,
            phone: "9999999999",
            admin_id: adminUser.id,
            plan_id: testPlan.id,
            status: "pending",
        });
    });

    // ── Test 1: Invalid signature → 400 ──────────────────────────────
    describe("Signature Verification", () => {
        it("should reject webhook with invalid signature", async () => {
            const payload = buildPayload("subscription.charged", {
                institute_id: testInstitute.id,
                plan_id: testPlan.id,
            });
            const rawBody = JSON.stringify(payload);

            const res = await request(app)
                .post("/api/webhook/razorpay-webhook")
                .set("Content-Type", "application/json")
                .set("x-razorpay-signature", "invalid_signature_here")
                .send(rawBody);

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain("Invalid webhook signature");
        });

        it("should reject webhook with tampered body", async () => {
            const payload = buildPayload("subscription.charged", {
                institute_id: testInstitute.id,
                plan_id: testPlan.id,
            });
            const rawBody = JSON.stringify(payload);
            const validSignature = generateSignature(rawBody);

            // Tamper with body after signing
            const tamperedBody = JSON.stringify({ ...payload, event: "hacked" });

            const res = await request(app)
                .post("/api/webhook/razorpay-webhook")
                .set("Content-Type", "application/json")
                .set("x-razorpay-signature", validSignature)
                .send(tamperedBody);

            expect(res.status).toBe(400);
        });
    });

    // ── Test 2: subscription.charged → Activate Institute ────────────
    describe("subscription.charged", () => {
        it("should activate institute and create subscription with valid signature", async () => {
            const payload = buildPayload("subscription.charged", {
                institute_id: testInstitute.id,
                plan_id: testPlan.id,
                current_end: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
            });
            const rawBody = JSON.stringify(payload);
            const signature = generateSignature(rawBody);

            const res = await request(app)
                .post("/api/webhook/razorpay-webhook")
                .set("Content-Type", "application/json")
                .set("x-razorpay-signature", signature)
                .send(rawBody);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify institute was activated
            const updatedInstitute = await Institute.findByPk(testInstitute.id);
            expect(updatedInstitute.status).toBe("active");

            // Verify subscription was created
            const sub = await Subscription.findOne({
                where: { institute_id: testInstitute.id },
                order: [["id", "DESC"]],
            });
            expect(sub).not.toBeNull();
            expect(sub.payment_status).toBe("paid");
        });
    });

    // ── Test 3: subscription.halted → Suspend Institute ──────────────
    describe("subscription.halted", () => {
        it("should suspend institute when payment fails", async () => {
            // First create a subscription to halt
            const subRef = `sub_halt_${Date.now()}`;
            await Subscription.create({
                institute_id: testInstitute.id,
                plan_id: testPlan.id,
                start_date: new Date(),
                end_date: new Date(Date.now() + 86400000 * 30),
                payment_status: "paid",
                transaction_reference: subRef,
            });

            const payload = buildPayload("subscription.halted", {
                institute_id: testInstitute.id,
            });
            // Set the entity ID to match our transaction_reference
            payload.payload.subscription.entity.id = subRef;

            const rawBody = JSON.stringify(payload);
            const signature = generateSignature(rawBody);

            const res = await request(app)
                .post("/api/webhook/razorpay-webhook")
                .set("Content-Type", "application/json")
                .set("x-razorpay-signature", signature)
                .send(rawBody);

            expect(res.status).toBe(200);

            // Verify institute was suspended
            const institute = await Institute.findByPk(testInstitute.id);
            expect(institute.status).toBe("suspended");

            // Verify subscription was marked as failed
            const sub = await Subscription.findOne({
                where: { transaction_reference: subRef },
            });
            expect(sub.payment_status).toBe("failed");
        });
    });

    // ── Test 4: subscription.cancelled → Expire Institute ────────────
    describe("subscription.cancelled", () => {
        it("should expire institute when subscription is cancelled", async () => {
            const subRef = `sub_cancel_${Date.now()}`;
            await Subscription.create({
                institute_id: testInstitute.id,
                plan_id: testPlan.id,
                start_date: new Date(),
                end_date: new Date(Date.now() + 86400000 * 30),
                payment_status: "paid",
                transaction_reference: subRef,
            });

            const payload = buildPayload("subscription.cancelled", {
                institute_id: testInstitute.id,
            });
            payload.payload.subscription.entity.id = subRef;

            const rawBody = JSON.stringify(payload);
            const signature = generateSignature(rawBody);

            const res = await request(app)
                .post("/api/webhook/razorpay-webhook")
                .set("Content-Type", "application/json")
                .set("x-razorpay-signature", signature)
                .send(rawBody);

            expect(res.status).toBe(200);

            const institute = await Institute.findByPk(testInstitute.id);
            expect(institute.status).toBe("expired");

            const sub = await Subscription.findOne({
                where: { transaction_reference: subRef },
            });
            expect(sub.payment_status).toBe("unpaid");
        });
    });

    // ── Test 5: Unknown event → 200 graceful pass-through ────────────
    describe("Edge Cases", () => {
        it("should return 200 for unknown event type", async () => {
            const payload = buildPayload("payment.captured", {
                institute_id: testInstitute.id,
            });
            const rawBody = JSON.stringify(payload);
            const signature = generateSignature(rawBody);

            const res = await request(app)
                .post("/api/webhook/razorpay-webhook")
                .set("Content-Type", "application/json")
                .set("x-razorpay-signature", signature)
                .send(rawBody);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it("should handle missing institute_id gracefully", async () => {
            const payload = buildPayload("subscription.charged", {
                institute_id: null,
                plan_id: null,
            });
            const rawBody = JSON.stringify(payload);
            const signature = generateSignature(rawBody);

            const res = await request(app)
                .post("/api/webhook/razorpay-webhook")
                .set("Content-Type", "application/json")
                .set("x-razorpay-signature", signature)
                .send(rawBody);

            // Should not crash — returns 200 (graceful no-op)
            expect(res.status).toBe(200);
        });

        it("should handle empty body gracefully", async () => {
            const res = await request(app)
                .post("/api/webhook/razorpay-webhook")
                .set("Content-Type", "application/json")
                .set("x-razorpay-signature", "whatever")
                .send("");

            // Should return 400 (bad signature) or 500 (parse error), not crash
            expect([400, 500]).toContain(res.status);
        });
    });
});
