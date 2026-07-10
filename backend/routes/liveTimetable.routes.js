const express = require("express");
const router = express.Router();
const timetableCacheService = require("../services/timetableCacheService");
const { catchAsync } = require("../utils/catchAsync");

/**
 * Get current live period for a given class or faculty
 * @route GET /api/live-timetable/current
 * @access Admin, Faculty, Student
 */
router.get("/current", catchAsync(async (req, res) => {
    const { class_id, faculty_id } = req.query;
    const institute_id = req.user.institute_id;

    if (!class_id && !faculty_id) {
        return res.status(400).json({ success: false, message: "Provide either class_id or faculty_id" });
    }

    const currentPeriod = timetableCacheService.getCurrentPeriod(institute_id, class_id || null, faculty_id || null);

    res.status(200).json({
        success: true,
        data: currentPeriod || null,
        message: currentPeriod ? "Current period found" : "No active period right now"
    });
}));

module.exports = router;
