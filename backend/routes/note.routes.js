const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const { uploadNote } = require("../utils/upload");
const noteController = require("../controllers/note.controller");

// Upload a note (faculty only)
router.post(
    "/upload",
    authMiddleware,
    (req, res, next) => {
        // Catch multer errors
        uploadNote.single("file")(req, res, (err) => {
            if (err) {
                return res.status(400).json({ success: false, message: err.message });
            }
            next();
        });
    },
    noteController.uploadNote
);

// Get notes by class
router.get("/class/:classId", authMiddleware, noteController.getNotesByClass);

// Get notes by subject
router.get("/subject/:subjectId", authMiddleware, noteController.getNotesBySubject);

// Get all notes
router.get("/", authMiddleware, noteController.getAllNotes);

// Record download point
router.post("/download/:id", authMiddleware, noteController.recordDownload);

// Update a note
router.put(
    "/:id",
    authMiddleware,
    (req, res, next) => {
        uploadNote.single("file")(req, res, (err) => {
            if (err) {
                return res.status(400).json({ success: false, message: err.message });
            }
            next();
        });
    },
    noteController.updateNote
);

// Delete a note
router.delete("/:id", authMiddleware, noteController.deleteNote);

module.exports = router;
