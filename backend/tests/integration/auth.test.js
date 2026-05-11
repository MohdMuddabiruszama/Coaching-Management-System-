const request = require("supertest");
const app = require("../../app");
const { User, Institute, RefreshToken, OtpVerification } = require("../../models");
const bcrypt = require("bcrypt");

describe("Auth Flow Integration Tests", () => {
  let testInstituteId;
  let testAdminId;
  let loginToken;
  let loginRefreshToken;

  const validRegistrationData = {
    name: "Test Institute",
    email: "test_institute@example.com",
    phone: "1234567890",
    password: "SecurePassword123",
    admin_name: "Admin User",
    plan_id: 1, // Basic plan
    address: "123 Test Street",
    city: "Test City",
    state: "Test State",
    pincode: "123456"
  };

  describe("POST /api/auth/register-init", () => {
    it("should initiate registration and create an OTP", async () => {
      const response = await request(app)
        .post("/api/auth/register-init")
        .send(validRegistrationData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // In TEST mode, the message says "Test Mode"
      if (process.env.OTP_TEST_MODE === "true") {
        expect(response.body.message).toContain("Test Mode");
      } else {
        expect(response.body.message).toContain("OTP sent");
      }

      // Verify OTP is created in DB
      const otpRecord = await OtpVerification.findOne({
        where: { email: validRegistrationData.email, type: "registration" },
      });
      expect(otpRecord).not.toBeNull();
      
      if (process.env.OTP_TEST_MODE === "true") {
        expect(response.body.testMode).toBe(true);
        // Backend only logs OTP, doesn't return it in response for security even in test mode
      }
    });

    it("should return validation error for missing fields", async () => {
      const response = await request(app)
        .post("/api/auth/register-init")
        .send({ email: "invalid" }); // Missing name, phone, etc.

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe("POST /api/auth/verify-registration", () => {
    it("should verify OTP and create the institute + admin user", async () => {
      const otpRecord = await OtpVerification.findOne({
        where: { email: validRegistrationData.email, type: "registration" },
      });
      expect(otpRecord).not.toBeNull();

      const response = await request(app)
        .post("/api/auth/verify-registration")
        .send({
          ...validRegistrationData,
          otp: String(otpRecord.otp), // It's .otp, not .otp_code
        });

      if (response.status === 400) {
          console.log("Validation Errors:", response.body.errors);
      }

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      
      testInstituteId = response.body.user.institute_id;
      testAdminId = response.body.user.id;

      // Verify records in DB
      const institute = await Institute.findByPk(testInstituteId);
      expect(institute).not.toBeNull();
      expect(institute.email).toBe(validRegistrationData.email);

      const user = await User.findByPk(testAdminId);
      expect(user).not.toBeNull();
      expect(user.role).toBe("admin");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login successfully and return dual tokens", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: validRegistrationData.email,
          password: validRegistrationData.password,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user).toBeDefined();

      loginToken = response.body.accessToken;
      loginRefreshToken = response.body.refreshToken;

      // Verify refresh token is stored in DB
      const storedToken = await RefreshToken.findOne({
        where: { user_id: testAdminId },
      });
      expect(storedToken).not.toBeNull();
      expect(storedToken.is_revoked).toBe(false);
    });

    it("should return 401 for incorrect password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: validRegistrationData.email,
          password: "WrongPassword!",
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("should refresh the access token using a valid refresh token", async () => {
      const response = await request(app)
        .post("/api/auth/refresh")
        .send({
          refreshToken: loginRefreshToken,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.accessToken).toBeDefined();
      // Note: We don't assert .not.toBe(loginToken) because if the test runs in < 1 second, 
      // the JWT 'iat' payload is identical, resulting in the exact same token string.
    });

    it("should fail with an invalid refresh token", async () => {
      const response = await request(app)
        .post("/api/auth/refresh")
        .send({
          refreshToken: "invalid-token-string",
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/auth/revoke-sessions", () => {
    it("should revoke all sessions for the logged-in user", async () => {
      const response = await request(app)
        .post("/api/auth/revoke-sessions")
        .set("Authorization", `Bearer ${loginToken}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify token is revoked in DB
      const storedToken = await RefreshToken.findOne({
        where: { user_id: testAdminId },
      });
      expect(storedToken.is_revoked).toBe(true);
    });

    it("should block refresh after session is revoked", async () => {
      const response = await request(app)
        .post("/api/auth/refresh")
        .send({
          refreshToken: loginRefreshToken,
        });

      expect(response.status).toBe(401); // REFRESH_INVALID
      expect(response.body.success).toBe(false);
    });
  });
});
