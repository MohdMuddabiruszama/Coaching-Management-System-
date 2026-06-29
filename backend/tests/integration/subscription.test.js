/**
 * ✅ Phase 7: Subscription Lifecycle Integration Tests
 * Tests the full SaaS billing lifecycle using test mode (no real Razorpay calls).
 *
 * Coverage: payment.controller.js, subscription.controller.js
 * - Free trial activation
 * - Duplicate free trial rejection
 * - Paid plan order creation (monthly)
 * - Payment verification with mock order
 * - Yearly plan 20% discount calculation
 * - Subscription status update (super_admin)
 * - List subscriptions with pagination
 */

const request = require("supertest");
const app = require("../../app");
const { User, Institute, Plan, Subscription, RazorpayOrder } = require("../../models");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

describe("Subscription Lifecycle Integration Tests", () => {
    let adminUser;
    let adminToken;
    let institute;
    let freePlan;
    let paidPlan;
    let superAdminToken;

    // ── Setup: Create test users, institute, and plans ─────────────
    beforeAll(async () => {
        const passwordHash = await bcrypt.hash("Test1234!", 10);

        // Create admin user
        adminUser = await User.create({
            name: "Sub Test Admin",
            email: `sub_admin_${Date.now()}@test.com`,
            password_hash: passwordHash,
            role: "admin",
        });

        // Find or create free trial plan
        freePlan = await Plan.findOne({ where: { is_free_trial: true } });
        if (!freePlan) {
            freePlan = await Plan.create({
                name: "Free Trial Test",
                price: 0,
                is_free_trial: true,
                trial_days: 14,
                max_students: 25,
                max_faculty: 5,
                max_classes: 5,
                max_admin_users: 1,
                feature_attendance: "basic",
                feature_fees: false,
                feature_reports: "none",
                feature_announcements: true,
            });
        }

        // Find or create paid plan
        paidPlan = await Plan.findOne({ where: { is_free_trial: false, price: { [require("sequelize").Op.gt]: 0 } } });
        if (!paidPlan) {
            paidPlan = await Plan.create({
                name: "Professional Test",
                price: 999,
                billing_cycle: "monthly",
                is_free_trial: false,
                max_students: 200,
                max_faculty: 30,
                max_classes: 20,
                max_admin_users: 3,
                feature_attendance: "advanced",
                feature_fees: true,
                feature_reports: "advanced",
                feature_announcements: true,
            });
        }

        // Create test institute
        institute = await Institute.create({
            name: "Lifecycle Test Institute",
            email: `lifecycle_${Date.now()}@test.com`,
            phone: "8888888888",
            admin_id: adminUser.id,
            plan_id: freePlan.id,
            status: "pending",
            has_used_trial: false,
        });

        // Update admin with institute_id
        await adminUser.update({ institute_id: institute.id });

        // Generate admin JWT
        adminToken = jwt.sign(
            { id: adminUser.id, role: "admin", institute_id: institute.id },
            process.env.JWT_SECRET || "test_jwt_secret",
            { expiresIn: "1h" }
        );

        // Create super admin for subscription management
        const superAdmin = await User.create({
            name: "Super Admin Test",
            email: `superadmin_${Date.now()}@test.com`,
            password_hash: passwordHash,
            role: "super_admin",
        });
        superAdminToken = jwt.sign(
            { id: superAdmin.id, role: "super_admin" },
            process.env.JWT_SECRET || "test_jwt_secret",
            { expiresIn: "1h" }
        );
    });

    // ── Test 1: Free Trial Activation ────────────────────────────────
    describe("Free Trial Flow", () => {
        it("should activate free trial for new institute", async () => {
            const res = await request(app)
                .post("/api/payment/initiate")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ planId: freePlan.id, billingCycle: "monthly" });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.trial_activated).toBe(true);

            // Verify institute was activated
            const updatedInstitute = await Institute.findByPk(institute.id);
            expect(updatedInstitute.status).toBe("active");
            expect(updatedInstitute.has_used_trial).toBe(true);

            // Verify subscription was created
            const sub = await Subscription.findOne({
                where: { institute_id: institute.id, transaction_reference: "free_trial" },
            });
            expect(sub).not.toBeNull();
            expect(sub.payment_status).toBe("paid");
            expect(Number(sub.amount_paid)).toBe(0);
        });

        it("should reject duplicate free trial attempt", async () => {
            const res = await request(app)
                .post("/api/payment/initiate")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ planId: freePlan.id, billingCycle: "monthly" });

            // Behaviour: it should reject with 400 since trial is already used
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });

    // ── Test 2: Paid Plan — Order Creation (Test Mode) ───────────────
    describe("Paid Plan Flow", () => {
        it("should create a mock order for monthly plan in test mode", async () => {
            const res = await request(app)
                .post("/api/payment/initiate")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    planId: paidPlan.id,
                    billingCycle: "monthly",
                    testMode: true,
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.order).toBeDefined();
            expect(res.body.order.id).toMatch(/^order_mock_/);
            expect(res.body.order.currency).toBe("INR");

            // Verify amount: price + GST in paise
            const gst = paidPlan.gst_percent != null ? Number(paidPlan.gst_percent) : 2;
            const expectedAmount = Math.round((paidPlan.price * (1 + gst / 100)) * 100);
            expect(res.body.order.amount).toBe(expectedAmount);
        });

        it("should create yearly order with 20% discount in test mode", async () => {
            const res = await request(app)
                .post("/api/payment/initiate")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    planId: paidPlan.id,
                    billingCycle: "yearly",
                    testMode: true,
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Yearly = yearly_price OR price × 12 × discount
            const discount = paidPlan.yearly_discount_percent != null ? Number(paidPlan.yearly_discount_percent) : 20;
            const yearlyBase = paidPlan.yearly_price != null ? Number(paidPlan.yearly_price) : (paidPlan.price * 12 * ((100 - discount) / 100));
            const gst = paidPlan.gst_percent != null ? Number(paidPlan.gst_percent) : 2;
            const expectedAmount = Math.round((yearlyBase * (1 + gst / 100)) * 100);
            expect(res.body.order.amount).toBe(expectedAmount);
        });
    });

    // ── Test 3: Payment Verification (Mock Order) ────────────────────
    describe("Payment Verification", () => {
        it("should verify mock payment and activate subscription", async () => {
            // First create a mock order
            const initRes = await request(app)
                .post("/api/payment/initiate")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    planId: paidPlan.id,
                    billingCycle: "monthly",
                    testMode: true,
                });

            const mockOrderId = initRes.body.order.id;

            // Verify the mock payment
            const verifyRes = await request(app)
                .post("/api/payment/verify")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    razorpay_order_id: mockOrderId,
                    razorpay_payment_id: `pay_mock_${Date.now()}`,
                    razorpay_signature: "mock_signature_test",
                    planId: paidPlan.id,
                    billingCycle: "monthly",
                });

            expect(verifyRes.status).toBe(200);
            expect(verifyRes.body.success).toBe(true);

            // Verify institute is active with paid plan
            const updatedInstitute = await Institute.findByPk(institute.id);
            expect(updatedInstitute.status).toBe("active");
            expect(updatedInstitute.plan_id).toBe(paidPlan.id);
        });
    });

    // ── Test 4: Subscription Management (Super Admin) ────────────────
    describe("Subscription Management", () => {
        it("should list all subscriptions with pagination", async () => {
            const res = await request(app)
                .get("/api/subscriptions?page=1&limit=5")
                .set("Authorization", `Bearer ${superAdminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data.subscriptions)).toBe(true);
        });

        it("should update subscription status", async () => {
            // Find an existing subscription
            const sub = await Subscription.findOne({
                where: { institute_id: institute.id },
                order: [["id", "DESC"]],
            });

            if (sub) {
                const res = await request(app)
                    .patch(`/api/subscriptions/${sub.id}/status`)
                    .set("Authorization", `Bearer ${superAdminToken}`)
                    .send({ payment_status: "failed" });

                expect(res.status).toBe(200);
                expect(res.body.success).toBe(true);
            }
        });
    });

    // ── Test 5: Validation ───────────────────────────────────────────
    describe("Input Validation", () => {
        it("should reject payment initiation without planId", async () => {
            const res = await request(app)
                .post("/api/payment/initiate")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ billingCycle: "monthly" });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it("should reject unauthenticated payment request", async () => {
            const res = await request(app)
                .post("/api/payment/initiate")
                .send({ planId: paidPlan.id, billingCycle: "monthly" });

            expect(res.status).toBe(401);
        });
    });
});
