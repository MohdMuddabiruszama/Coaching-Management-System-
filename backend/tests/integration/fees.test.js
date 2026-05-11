const request = require("supertest");
const app = require("../../app");
const { User, Institute, Class, Subject, Student, FeesStructure, StudentFee, Payment, Plan } = require("../../models");

describe("Fee and Payment Flow Integration Tests", () => {
  let adminToken;
  let studentToken;
  let testInstituteId;
  let testAdminId;
  let testClassId;
  let testSubjectId;
  let testStudentId;
  let testStudentUserId;
  let testFeeStructureId;

  // Since tests run in parallel or sequentially, we'll create a completely fresh setup
  // because setupFilesAfterEnv drops everything and recreates it.
  
  beforeAll(async () => {
    // 1. Create a comprehensive plan for testing
    const plan = await Plan.create({
      name: "Test Pro Plan",
      price: 5000,
      duration_months: 1,
      student_limit: 100,
      feature_attendance: "advanced",
      feature_fees: true,
      feature_exams: true,
      feature_chat: true,
      status: "active"
    });

    // 2. Create an Institute & Admin directly via DB
    const institute = await Institute.create({
      name: "Fee Test Institute",
      email: "feetest@institute.com",
      phone: "1112223333",
      address: "Fee St",
      city: "Fee City",
      status: "active",
      plan_id: plan.id,
    });
    testInstituteId = institute.id;

    const adminUser = await User.create({
      name: "Fee Admin",
      email: "fee_admin@institute.com",
      password_hash: "$2b$10$xyz123fakehash", // We'll bypass actual login logic by forcing a token
      role: "admin",
      institute_id: testInstituteId,
      status: "active",
    });
    testAdminId = adminUser.id;

    // 3. Create a Class & Subject
    const cls = await Class.create({
      institute_id: testInstituteId,
      name: "10th Grade",
      section: "A",
    });
    testClassId = cls.id;

    const sub = await Subject.create({
      institute_id: testInstituteId,
      class_id: testClassId,
      name: "Mathematics",
    });
    testSubjectId = sub.id;

    // 4. Create a Student User and Student record
    const studentUser = await User.create({
      name: "John FeeStudent",
      email: "student_fee@example.com",
      password_hash: "$2b$10$xyz123fakehash",
      role: "student",
      institute_id: testInstituteId,
      status: "active",
    });
    testStudentUserId = studentUser.id;

    const studentRecord = await Student.create({
      user_id: testStudentUserId,
      institute_id: testInstituteId,
      class_id: testClassId,
      enrollment_number: "ENR123456",
      is_full_course: false, // Subject-based billing
    });
    testStudentId = studentRecord.id;
    await studentRecord.addSubject(testSubjectId, { through: { institute_id: testInstituteId } });

    // 5. Generate Access Tokens (Using the same logic as generateToken.js but stripped down)
    const jwt = require("jsonwebtoken");
    const generateTestToken = (user) => {
      return jwt.sign(
        { id: user.id, role: user.role, institute_id: user.institute_id, type: "access" },
        process.env.JWT_SECRET || "fallback_secret",
        { expiresIn: "15m" }
      );
    };

    adminToken = generateTestToken(adminUser);
    studentToken = generateTestToken(studentUser);
  });

  describe("POST /api/fees/structure", () => {
    it("should allow admin to create a new fee structure", async () => {
      const response = await request(app)
        .post("/api/fees/structure")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          class_id: testClassId,
          subject_id: testSubjectId,
          individual_student_id: testStudentId, // Force assignment for this test
          fee_type: "Tuition Fee",
          amount: 5000,
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
          description: "Monthly Math Fee",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      
      testFeeStructureId = response.body.data.id;

      // Verify it auto-assigned to our test student
      const assignedFee = await StudentFee.findOne({
        where: { fee_structure_id: testFeeStructureId, student_id: testStudentId }
      });
      expect(assignedFee).not.toBeNull();
      expect(assignedFee.due_amount).toBe("5000.00");
      expect(assignedFee.status).toBe("pending");
    });
  });

  describe("GET /api/fees/my-fees (Student Portal)", () => {
    it("should return assigned fees for the logged-in student", async () => {
      const response = await request(app)
        .get("/api/fees/my-fees")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const fees = response.body.data;
      expect(fees.length).toBeGreaterThan(0);
      
      const mathFee = fees.find(f => f.fee_structure_id === testFeeStructureId);
      expect(mathFee).toBeDefined();
      expect(mathFee.due_amount).toBe("5000.00");
      expect(mathFee.status).toBe("pending");
    });
  });

  describe("POST /api/fees/pay (Admin Recording Payment)", () => {
    it("should record a partial payment successfully", async () => {
      const response = await request(app)
        .post("/api/fees/pay")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          student_id: testStudentId,
          fee_structure_id: testFeeStructureId,
          amount: 2000,
          payment_method: "Cash",
          remarks: "Partial payment for math",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      // Verify the payment record
      const payment = await Payment.findOne({
        where: { student_id: testStudentId, fee_structure_id: testFeeStructureId }
      });
      expect(payment).not.toBeNull();
      expect(payment.amount_paid).toBe("2000.00");

      // Verify StudentFee was updated
      const assignedFee = await StudentFee.findOne({
        where: { fee_structure_id: testFeeStructureId, student_id: testStudentId }
      });
      expect(assignedFee.paid_amount).toBe("2000.00");
      expect(assignedFee.due_amount).toBe("3000.00");
      expect(assignedFee.status).toBe("partial");
    });

    it("should record a final payment and mark as paid", async () => {
      const response = await request(app)
        .post("/api/fees/pay")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          student_id: testStudentId,
          fee_structure_id: testFeeStructureId,
          amount: 3000,
          payment_method: "UPI",
        });

      expect(response.status).toBe(201);

      // Verify StudentFee was updated to PAID
      const assignedFee = await StudentFee.findOne({
        where: { fee_structure_id: testFeeStructureId, student_id: testStudentId }
      });
      expect(assignedFee.paid_amount).toBe("5000.00");
      expect(assignedFee.due_amount).toBe("0.00");
      expect(assignedFee.status).toBe("paid");
    });
  });

});
