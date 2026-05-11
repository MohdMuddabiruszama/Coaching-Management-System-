/**
 * Exam Routes
 * ✅ Phase 7: Joi validation on all inputs
 */

const express = require("express");
const router = express.Router();
const examController = require("../controllers/exam.controller");
const verifyToken = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");
const validate = require("../middlewares/validate.middleware"); // ✅ Phase 7
const examValidator = require("../validators/exam.validator"); // ✅ Phase 7

router.post("/", verifyToken, allowRoles("admin", "faculty"), validate(examValidator.createExam), examController.createExam);
router.get("/", verifyToken, allowRoles("admin", "faculty"), validate(examValidator.getExams), examController.getAllExams);
router.post("/marks", verifyToken, allowRoles("admin", "faculty"), validate(examValidator.enterMarks), examController.enterMarks);
router.get("/:exam_id/marks", verifyToken, allowRoles("admin", "faculty"), validate(examValidator.getExamMarks), examController.getExamMarks);
router.get("/results/:student_id", verifyToken, allowRoles("admin", "faculty", "student"), validate(examValidator.getStudentResults), examController.getStudentResults);
router.delete("/:id", verifyToken, allowRoles("admin", "manager"), validate(examValidator.deleteExam), examController.deleteExam);

module.exports = router;
