/**
 * Subject Routes
 * ✅ Phase 7: Joi validation on all inputs
 */

const express = require("express");
const router = express.Router();
const subjectController = require("../controllers/subject.controller");
const verifyToken = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");
const checkManagerPermission = require("../middlewares/checkManagerPermission");
const validate = require("../middlewares/validate.middleware"); // ✅ Phase 7
const subjectValidator = require("../validators/subject.validator"); // ✅ Phase 7


router.post("/", verifyToken, allowRoles("admin", "manager"), checkManagerPermission("subjects.create"), validate(subjectValidator.createSubject), subjectController.createSubject);
router.get("/", verifyToken, allowRoles("admin", "faculty", "manager", "student"), checkManagerPermission("subjects.read", ["fees", "attendance", "reports", "timetable", "exams", "classes"]), validate(subjectValidator.getSubjects), subjectController.getAllSubjects);
router.get("/:id", verifyToken, allowRoles("admin", "faculty", "manager"), checkManagerPermission("subjects.read", ["fees", "attendance", "reports", "timetable", "exams", "classes"]), validate(subjectValidator.getSubjectById), subjectController.getSubjectById);
router.put("/:id", verifyToken, allowRoles("admin", "manager"), checkManagerPermission("subjects.update"), validate(subjectValidator.updateSubject), subjectController.updateSubject);
router.delete("/:id", verifyToken, allowRoles("admin", "manager"), checkManagerPermission("subjects.delete"), validate(subjectValidator.deleteSubject), subjectController.deleteSubject);

module.exports = router;
