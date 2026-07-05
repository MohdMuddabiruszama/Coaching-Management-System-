/**
 * Fees Controller
 * Handles fee structure and payment tracking
 */

const { FeesStructure, Payment, Student, User, StudentFee, FeeDiscountLog, Class, Subject } = require("../models");
const { Op } = require("sequelize");
const { catchAsync } = require("../utils/catchAsync");
const NotificationService = require("../services/notificationService");

exports.createFeeStructure = catchAsync(async (req, res) => {
  try {
    let { class_id, subject_id, fee_type, amount, due_date, description, individual_student_id } = req.body;
    const institute_id = req.user.institute_id;

    // Coerce string values from HTML form to proper types
    class_id = class_id ? parseInt(class_id, 10) : null;
    subject_id = subject_id && subject_id !== '' ? parseInt(subject_id, 10) : null;
    individual_student_id = individual_student_id && individual_student_id !== '' ? parseInt(individual_student_id, 10) : null;
    amount = parseFloat(amount);

    if (!class_id || isNaN(class_id)) {
      return res.status(400).json({ success: false, message: "Class is required" });
    }
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: "Amount must be greater than 0" });
    }

    const feeStructure = await FeesStructure.create({
      institute_id,
      class_id,
      subject_id: subject_id || null, // null means it's a generic class fee
      individual_student_id: individual_student_id || null,
      fee_type,
      amount,
      due_date,
      description
    });


    // ── Auto-assign StudentFee records ──────────────────────────────────
    const makeFeeRecord = (student_id_val) => ({
      institute_id,
      student_id: student_id_val,
      class_id: class_id,
      fee_structure_id: feeStructure.id,
      original_amount: amount,
      discount_amount: 0,
      final_amount: amount,
      paid_amount: 0,
      due_amount: amount,
      status: 'pending'
    });

    if (individual_student_id) {
      // ── INDIVIDUAL STUDENT target ──
      // Only create a fee record for this specific student
      const student = await Student.findOne({ where: { id: individual_student_id, institute_id } });
      if (student) {
        // Check for duplicate
        const existing = await StudentFee.findOne({
          where: { student_id: individual_student_id, fee_structure_id: feeStructure.id, institute_id }
        });
        if (!existing) {
          await StudentFee.create(makeFeeRecord(individual_student_id));
        }
      }
    } else if (class_id) {
      // ── ALL STUDENTS target ──
      const students = await Student.findAll({
        where: { institute_id },
        include: [{ model: Class, where: { id: class_id } }]
      });

      let targetStudents;

      if (subject_id) {
        // Subject-specific fee — only assign to students enrolled in that subject
        // AND who are NOT full-course (full-course students pay one tuition fee, not per-subject)
        const SubjectModel = require('../models').Subject;
        const subjectWithStudents = await SubjectModel.findOne({
          where: { id: subject_id, institute_id },
          include: [{ model: Student }]
        });
        const enrolledStudentIds = subjectWithStudents?.Students?.map((s) => s.id) || [];
        targetStudents = students.filter((s) => !s.is_full_course && enrolledStudentIds.includes(s.id));
      } else {
        // General class fee (no subject) — apply based on fee type
        if (fee_type === 'Tuition Fee') {
          // Only full-course students pay the general tuition fee
          targetStudents = students.filter((s) => s.is_full_course);
        } else {
          // All other fee types (Exam Fee, Library Fee, Transport Fee, Other) - apply to all
          targetStudents = students;
        }
      }

      const feeRecords = targetStudents.map((s) => makeFeeRecord(s.id));

      if (feeRecords.length > 0) {
        await StudentFee.bulkCreate(feeRecords, { ignoreDuplicates: true });
        
        // Notify all target students
        targetStudents.forEach(stu => {
          NotificationService.notifyStudentAndParents(
            institute_id,
            stu.id,
            "fee_assigned",
            "New Fee Assigned",
            `A new fee "${fee_type}" of ₹${amount} has been assigned. Due Date: ${due_date}`,
            `/student/fees`
          );
        });
      }
    }

    // Phase 4: Individual Student Fee Notification
    if (individual_student_id) {
       NotificationService.notifyStudentAndParents(
          institute_id,
          individual_student_id,
          "fee_assigned",
          "New Fee Assigned",
          `A new fee "${fee_type}" of ₹${amount} has been assigned. Due Date: ${due_date}`,
          `/student/fees`
       );
    }

    res.status(201).json({
      success: true,
      message: "Fee structure created successfully",
      data: feeStructure
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

exports.getAllFeeStructures = catchAsync(async (req, res) => {
  try {
    const { class_id } = req.query;
    const institute_id = req.user.institute_id;

    let whereClause = { institute_id };
    if (class_id) whereClause.class_id = class_id;

    if (req.user.role === "student") {
      // Find the student's primary class and their linked subjects
      const studentObj = await Student.findOne({
        where: { user_id: req.user.id, institute_id },
        include: [
        { model: require("../models").Class },
        { model: require("../models").Subject }]

      });

      if (studentObj) {
        const classIds = studentObj.Classes ? studentObj.Classes.map((c) => c.id) : [];
        if (classIds.length > 0) {
          whereClause.class_id = classIds; // matches any of their classes
        }
        // Do not filter by enrolled subjects, so they can see all subjects to unlock them!
      }
    }

    const feeStructures = await FeesStructure.findAll({
      where: whereClause,
      include: [
      { model: require("../models").Class, attributes: ["name", "section"] },
      { model: require("../models").Subject, attributes: ["name"] }],

      order: [["due_date", "ASC"]]
    });

    // Let's attach the amount already paid by this student for each fee structure structure
    let feesWithPayments = feeStructures.map((f) => f.toJSON());

    if (req.user.role === "student") {
      const studentObj = await Student.findOne({
        where: { user_id: req.user.id, institute_id },
        include: [{ model: require("../models").Subject }]
      });
      if (studentObj) {
        const filteredFees = [];
        for (let fee of feesWithPayments) {
          const payments = await Payment.findAll({
            where: { student_id: studentObj.id, fee_structure_id: fee.id, status: 'success' }
          });
          fee.paid_amount = payments.reduce((sum, p) => sum + parseFloat(p.amount_paid), 0);
          const isEnrolled = !!(fee.subject_id && studentObj.Subjects?.find((s) => s.id === fee.subject_id));
          fee.is_enrolled = isEnrolled;

          // Handle individually assigned fees
          if (fee.individual_student_id) {
            if (fee.individual_student_id === studentObj.id) {
              filteredFees.push(fee);
            }
            continue;
          }

          if (fee.subject_id) {
            // Subject-specific fee
            if (isEnrolled) {
              if (studentObj.is_full_course && fee.fee_type === 'Tuition Fee') {

                // Full course students shouldn't see individual subject tuition fees
              } else {filteredFees.push(fee);
              }
            }
          } else {
            // Full course / General fee
            if (fee.fee_type === 'Tuition Fee') {
              if (studentObj.is_full_course) {
                filteredFees.push(fee);
              }
            } else {
              // Other general fees like Transport, Exam, or Library apply to all in class
              filteredFees.push(fee);
            }
          }
        }
        feesWithPayments = filteredFees;
      }
    }

    res.status(200).json({
      success: true,
      message: "Fee structures retrieved successfully",
      data: feesWithPayments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

exports.recordPayment = catchAsync(async (req, res) => {
  try {
    const { student_id, fee_structure_id, amount, payment_method, transaction_id, payment_date, remarks, reminder_date } = req.body;
    const institute_id = req.user.institute_id;

    let actual_student_id = student_id;
    let studentObj = null;
    if (req.user.role === "student") {
      studentObj = await Student.findOne({ where: { user_id: req.user.id, institute_id } });
      if (!studentObj) {
        return res.status(404).json({ success: false, message: "Student record not found" });
      }
      actual_student_id = studentObj.id;
    } else {
      studentObj = await Student.findOne({ where: { id: student_id, institute_id } });
    }

    // Auto enroll in subject if paying a subject fee
    if (fee_structure_id && studentObj) {
      const fee = await FeesStructure.findOne({ where: { id: fee_structure_id, institute_id } });

      // Validate if already fully paid?
      if (fee) {
        const existingPayments = await Payment.findAll({
          where: { student_id: actual_student_id, fee_structure_id: fee.id, status: 'success' }
        });
        const totalPaidSoFar = existingPayments.reduce((sum, p) => sum + parseFloat(p.amount_paid), 0);
        if (totalPaidSoFar >= parseFloat(fee.amount) && amount > 0) {
          return res.status(400).json({ success: false, message: "This fee is already fully paid." });
        }

        if (fee.subject_id) {
          await studentObj.addSubject(fee.subject_id);
        } else if (fee.fee_type === 'Tuition Fee') {
          await studentObj.update({ is_full_course: true });
        }
      }
    }

    // Find corresponding StudentFee to update
    if (fee_structure_id) {
      const stuFee = await StudentFee.findOne({
        where: { student_id: actual_student_id, fee_structure_id, institute_id }
      });

      if (stuFee) {
        const newPaid = parseFloat(stuFee.paid_amount) + parseFloat(amount);
        const newDue = parseFloat(stuFee.final_amount) - newPaid;

        await stuFee.update({
          paid_amount: newPaid,
          due_amount: newDue > 0 ? newDue : 0,
          status: newDue <= 0 ? 'paid' : 'partial',
          reminder_date: reminder_date || stuFee.reminder_date
        });
      } else if (studentObj) {
        const fee = await FeesStructure.findOne({ where: { id: fee_structure_id } });
        if (fee) {
          const final = parseFloat(fee.amount);
          const due = final - parseFloat(amount);
          await StudentFee.create({
            institute_id,
            student_id: actual_student_id,
            class_id: studentObj.class_id,
            fee_structure_id: fee.id,
            original_amount: final,
            discount_amount: 0,
            final_amount: final,
            paid_amount: amount,
            due_amount: due > 0 ? due : 0,
            status: due <= 0 ? 'paid' : 'partial',
            reminder_date: reminder_date || null
          });
        }
      }
    }

    const payment = await Payment.create({
      institute_id,
      student_id: actual_student_id,
      fee_structure_id: fee_structure_id || null,
      amount_paid: amount,
      payment_method: payment_method || "Credit Card", // Default if not provided
      transaction_id: transaction_id || "TXN_" + Date.now(),
      payment_date: payment_date || new Date(),
      status: "success",
      collected_by: req.user.id,
      remarks: remarks || null
    });

    // Notify payment success
    NotificationService.notifyStudentAndParents(
        institute_id,
        actual_student_id,
        "fee_payment",
        "Payment Received",
        `We have received your payment of ₹${amount}. TXN ID: ${payment.transaction_id}`,
        `/student/fees`
    );

    res.status(201).json({
      success: true,
      message: "Payment recorded successfully",
      data: payment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

exports.getAllPayments = catchAsync(async (req, res) => {
  try {
    const { page = 1, limit = 20, student_id } = req.query;
    const institute_id = req.user.institute_id;
    const offset = (page - 1) * limit;

    const whereClause = { institute_id };
    if (student_id) whereClause.student_id = student_id;

    const { count, rows } = await Payment.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["payment_date", "DESC"]],
      include: [
      {
        model: Student,
        include: [{ model: User, attributes: ["name", "email"] }]
      }]

    });

    res.status(200).json({
      success: true,
      data: rows,
      count
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

exports.getStudentPayments = catchAsync(async (req, res) => {
  try {
    const { student_id } = req.params;
    const institute_id = req.user.institute_id;

    const payments = await Payment.findAll({
      where: { student_id, institute_id },
      order: [["payment_date", "DESC"]]
    });

    const totalPaid = payments.reduce((sum, payment) => sum + (parseFloat(payment.amount_paid) || 0), 0);

    res.status(200).json({
      success: true,
      message: "Student payments retrieved successfully",
      data: {
        payments,
        total_paid: totalPaid
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

exports.updateFeeStructure = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const institute_id = req.user.institute_id;
    let { class_id, subject_id, fee_type, amount, due_date, description, individual_student_id } = req.body;

    // Coerce string values from HTML selects to proper types
    if (class_id !== undefined) class_id = class_id ? parseInt(class_id, 10) : null;
    if (subject_id !== undefined) subject_id = subject_id && subject_id !== '' ? parseInt(subject_id, 10) : null;
    if (individual_student_id !== undefined) individual_student_id = individual_student_id && individual_student_id !== '' ? parseInt(individual_student_id, 10) : null;
    if (amount !== undefined) amount = parseFloat(amount);

    const feeStructure = await FeesStructure.findOne({ where: { id, institute_id } });

    if (!feeStructure) {
      return res.status(404).json({ success: false, message: "Fee structure not found" });
    }

    await feeStructure.update({
      class_id,
      subject_id: subject_id !== undefined ? subject_id || null : feeStructure.subject_id,
      individual_student_id: individual_student_id !== undefined ? individual_student_id || null : feeStructure.individual_student_id,
      fee_type,
      amount,
      due_date,
      description
    });

    res.status(200).json({
      success: true,
      message: "Fee structure updated successfully",
      data: feeStructure
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

exports.deleteFeeStructure = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const institute_id = req.user.institute_id;

    const feeStructure = await FeesStructure.findOne({ where: { id, institute_id } });

    if (!feeStructure) {
      return res.status(404).json({ success: false, message: "Fee structure not found" });
    }

    const existingPayments = await Payment.count({ where: { fee_structure_id: id, institute_id } });
    if (existingPayments > 0) {
      return res.status(400).json({ success: false, message: "Cannot delete fee structure because payments have already been recorded against it." });
    }

    await StudentFee.destroy({ where: { fee_structure_id: id } });
    await feeStructure.destroy();

    res.status(200).json({
      success: true,
      message: "Fee structure deleted successfully"
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

exports.syncSingleStudentFees = catchAsync(async (institute_id, studentObj) => {
  try {
    const { FeesStructure, StudentFee } = require("../models");

    const structures = await FeesStructure.findAll({ where: { institute_id }, raw: true });
    const existingStudentFees = await StudentFee.findAll({
      where: { institute_id, student_id: studentObj.id },
      raw: true
    });

    const toCreate = [];
    const toDeleteIds = [];

    const subjectIds = studentObj.Subjects ? studentObj.Subjects.map((sub) => sub.id) : [];
    const classIds = studentObj.Classes ? studentObj.Classes.map((c) => c.id) : [];

    for (const fs of structures) {
      let applies = false;
      if (fs.individual_student_id) {
        if (studentObj.id === fs.individual_student_id) applies = true;
      } else if (classIds.includes(fs.class_id)) {
        if (fs.subject_id !== null) {
          if (subjectIds.includes(fs.subject_id)) {
            if (fs.fee_type === 'Tuition Fee' && studentObj.is_full_course) {
              applies = false;
            } else {
              applies = true;
            }
          }
        } else {
          if (fs.fee_type === 'Tuition Fee') {
            if (studentObj.is_full_course) applies = true;
          } else {
            applies = true;
          }
        }
      }

      const existingFeeDetails = existingStudentFees.find((f) => f.fee_structure_id === fs.id);

      if (applies) {
        if (!existingFeeDetails) {
          toCreate.push({
            institute_id,
            student_id: studentObj.id,
            class_id: fs.class_id,
            fee_structure_id: fs.id,
            original_amount: fs.amount,
            discount_amount: 0,
            final_amount: fs.amount,
            paid_amount: 0,
            due_amount: fs.amount,
            status: 'pending'
          });
        }
      } else {
        if (existingFeeDetails && parseFloat(existingFeeDetails.paid_amount) === 0) {
          toDeleteIds.push(existingFeeDetails.id);
        }
      }
    }

    if (toDeleteIds.length > 0) {
      await StudentFee.destroy({ where: { id: toDeleteIds } });
    }

    if (toCreate.length > 0) {
      await StudentFee.bulkCreate(toCreate);
    }

    return true;
  } catch (error) {
    console.error("Error syncing student fees:", error);
    return false;
  }
});

exports.getMyFees = catchAsync(async (req, res) => {
  try {
    const institute_id = req.user.institute_id;
    const { Student, Subject, Class, FeesStructure, StudentFee } = require("../models");

    const studentObj = await Student.findOne({
      where: { user_id: req.user.id, institute_id },
      include: [{ model: Subject }, { model: Class }]
    });

    if (!studentObj) {
      return res.status(404).json({ success: false, message: "Student record not found" });
    }

    // 1. Sync the fees for this student
    await exports.syncSingleStudentFees(institute_id, studentObj);

    // 2. Fetch the synced StudentFee records
    const studentFees = await StudentFee.findAll({
      where: { student_id: studentObj.id, institute_id },
      include: [
      { model: Class, attributes: ['name', 'section'] },
      { model: FeesStructure, include: [{ model: Subject, required: false }] }],

      order: [["id", "DESC"]]
    });

    res.status(200).json({ success: true, data: studentFees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

exports.getAssignedStudentFees = catchAsync(async (req, res) => {
  try {
    const institute_id = req.user.institute_id;

    // Auto-sync missing StudentFees for all students/class fees
    // Doing a pass for both generic class fees AND specific enrolled subject fees

    const students = await Student.findAll({
      where: { institute_id },
      include: [{ model: Subject }, { model: Class }]
    });
    const structures = await FeesStructure.findAll({ where: { institute_id }, raw: true });

    const existingStudentFees = await StudentFee.findAll({ where: { institute_id }, raw: true });
    const existingSet = new Set(existingStudentFees.map((sf) => `${sf.student_id}_${sf.fee_structure_id}`));

    const toCreate = [];
    const toDeleteIds = [];

    for (const s of students) {
      const subjectIds = s.Subjects ? s.Subjects.map((sub) => sub.id) : [];
      const classIds = s.Classes ? s.Classes.map((c) => c.id) : [];

      // Existing fees for this student
      const studentExistingFees = existingStudentFees.filter((f) => f.student_id === s.id);

      for (const fs of structures) {
        let applies = false;
        if (fs.individual_student_id) {
          if (s.id === fs.individual_student_id) applies = true;
        } else if (classIds.includes(fs.class_id)) {
          if (fs.subject_id !== null) {
            if (subjectIds.includes(fs.subject_id)) {
              // Subject-level Tuition Fees should NOT apply to full course students
              if (fs.fee_type === 'Tuition Fee' && s.is_full_course) {
                applies = false;
              } else {
                applies = true;
              }
            }
          } else {
            // If no specific subject and it's Tuition Fee, it means "All Subjects (Full Class)"
            if (fs.fee_type === 'Tuition Fee') {
              if (s.is_full_course) applies = true;
            } else {
              // Other general fees like Transport or Library, apply to all in class
              applies = true;
            }
          }
        }

        const existingFeeDetails = studentExistingFees.find((f) => f.fee_structure_id === fs.id);

        if (applies) {
          if (!existingFeeDetails) {
            toCreate.push({
              institute_id,
              student_id: s.id,
              class_id: fs.class_id,
              fee_structure_id: fs.id,
              original_amount: fs.amount,
              discount_amount: 0,
              final_amount: fs.amount,
              paid_amount: 0,
              due_amount: fs.amount,
              status: 'pending'
            });
          }
        } else {
          // If doesn't apply anymore but exists implicitly in db and is unpaid
          if (existingFeeDetails && parseFloat(existingFeeDetails.paid_amount) === 0) {
            toDeleteIds.push(existingFeeDetails.id);
          }
        }
      }
    }

    if (toDeleteIds.length > 0) {
      await StudentFee.destroy({ where: { id: toDeleteIds } });
    }

    if (toCreate.length > 0) {
      await StudentFee.bulkCreate(toCreate);
    }

    // Fetch them all with associations
    let studentFees = await StudentFee.findAll({
      where: { institute_id },
      include: [
      { model: Student, include: [{ model: User, attributes: ['name', 'email'] }] },
      { model: Class, attributes: ['name', 'section'] },
      { model: FeesStructure, include: [{ model: Subject, required: false }] }],

      order: [["id", "DESC"]]
    });

    // Inject any active students who somehow have no fees (e.g. class_id is null or no structure configured)
    const studentsWithFees = new Set(studentFees.map((sf) => sf.student_id));
    const allStudents = await Student.findAll({
      where: { institute_id },
      include: [
      { model: User, attributes: ['name', 'email'] },
      { model: Class, attributes: ['name', 'section'] }]

    });

    for (const s of allStudents) {
      if (!studentsWithFees.has(s.id)) {
        // Return a dummy object so they can at least be found and collected from
        studentFees.push({
          id: `dummy_${s.id}`,
          student_id: s.id,
          class_id: s.Classes?.[0]?.id || null, // fallback class to show in UI
          fee_structure_id: null,
          original_amount: 0,
          discount_amount: 0,
          final_amount: 0,
          paid_amount: 0,
          due_amount: 0,
          status: 'pending', // show as pending so they appear by default!
          Student: s,
          Class: s.Classes?.[0] || null,
          FeesStructure: null
        });
      }
    }

    res.status(200).json({ success: true, data: studentFees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

exports.applyDiscount = catchAsync(async (req, res) => {
  try {
    const { student_fee_id, discount_amount, reason } = req.body;
    const institute_id = req.user.institute_id;

    const stuFee = await StudentFee.findOne({ where: { id: student_fee_id, institute_id } });
    if (!stuFee) return res.status(404).json({ success: false, message: "Student fee record not found" });

    const newDiscount = parseFloat(stuFee.discount_amount) + parseFloat(discount_amount);
    const newFinal = parseFloat(stuFee.original_amount) - newDiscount;

    if (newFinal < 0) {
      return res.status(400).json({ success: false, message: "Discount exceeds original amount." });
    }

    const newDue = newFinal - parseFloat(stuFee.paid_amount);

    // Max manager discount check
    if (req.user.role === 'manager' && parseFloat(discount_amount) > 2000) {
      return res.status(403).json({ success: false, message: "Managers cannot apply a discount of more than ₹2000 at once." });
    }

    await stuFee.update({
      discount_amount: newDiscount,
      final_amount: newFinal,
      due_amount: newDue > 0 ? newDue : 0,
      status: newDue <= 0 ? 'paid' : stuFee.paid_amount > 0 ? 'partial' : 'pending'
    });

    await FeeDiscountLog.create({
      institute_id,
      student_fee_id,
      discount_amount,
      reason: reason || 'Manual Discount',
      approved_by: req.user.id,
      approved_role: req.user.role
    });

    res.status(200).json({ success: true, message: "Discount applied successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

exports.getDiscountLogs = catchAsync(async (req, res) => {
  try {
    const institute_id = req.user.institute_id;
    const logs = await FeeDiscountLog.findAll({
      where: { institute_id },
      include: [
      { model: User, as: "approver", attributes: ["name"] },
      {
        model: StudentFee,
        include: [
        { model: Student, include: [{ model: User, attributes: ["name"] }] }]

      }],

      order: [["id", "DESC"]]
    });
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

exports.updateReminderDate = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const { reminder_date } = req.body;
    const institute_id = req.user.institute_id;

    const stuFee = await StudentFee.findOne({ where: { id, institute_id } });
    if (!stuFee) {
      return res.status(404).json({ success: false, message: "Student fee record not found" });
    }

    await stuFee.update({ reminder_date });

    res.status(200).json({
      success: true,
      message: "Reminder date updated successfully",
      data: stuFee
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = exports;