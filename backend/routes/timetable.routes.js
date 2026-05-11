const express = require("express");
const router = express.Router();
const timetableController = require("../controllers/timetable.controller");
const verifyToken = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");
const validate = require("../middlewares/validate.middleware"); // ✅ Phase 7
const ttValidator = require("../validators/timetable.validator"); // ✅ Phase 7

// Slot Routes
router.post("/slots", verifyToken, allowRoles("admin"), validate(ttValidator.createSlot), timetableController.createSlot);
router.get("/slots", verifyToken, timetableController.getSlots);
router.delete("/slots/:id", verifyToken, allowRoles("admin"), validate(ttValidator.deleteSlot), timetableController.deleteSlot);

// Timetable Entry Routes
router.post("/", verifyToken, allowRoles("admin"), validate(ttValidator.createEntry), timetableController.createTimetableEntry);
router.put("/:id", verifyToken, allowRoles("admin"), validate(ttValidator.updateEntry), timetableController.updateTimetableEntry);
router.delete("/:id", verifyToken, allowRoles("admin"), validate(ttValidator.deleteEntry), timetableController.deleteTimetableEntry);
router.get("/class/:class_id", verifyToken, validate(ttValidator.getByClass), timetableController.getTimetableByClass);
router.get("/faculty/:faculty_id", verifyToken, validate(ttValidator.getByFaculty), timetableController.getTimetableByFaculty);

module.exports = router;
