/**
 * Admin Public Page Routes
 * All routes protected by JWT auth
 * Images uploaded to Cloudinary (permanent CDN storage)
 * Falls back to local disk when Cloudinary is not configured
 */

const express = require("express");
const router  = express.Router();
const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");
const cloudinary = require("../config/cloudinary");
const verifyToken = require("../middlewares/auth.middleware");
const publicPageController = require("../controllers/publicPage.controller");

// ── Check if Cloudinary is configured ────────────────────────────
const isCloudinaryConfigured =
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_CLOUD_NAME !== "your_cloud_name" &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_KEY !== "your_api_key";

const fileFilter = (req, file, cb) => {
    const allowed = ["image/jpg", "image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only jpg, jpeg, png, webp files are allowed"), false);
};

let imageStorage;

if (isCloudinaryConfigured) {
    // ── Cloudinary storage ────────────────────────────────────────
    const { CloudinaryStorage } = require("multer-storage-cloudinary");
    imageStorage = new CloudinaryStorage({
        cloudinary,
        params: {
            folder: "zf-solution/public-page",
            allowed_formats: ["jpg", "jpeg", "png", "webp"],
            transformation: [
                { width: 1400, height: 1400, crop: "limit" },
                { quality: "auto" },
                { fetch_format: "auto" },
            ],
            public_id: (req, file) =>
                `pub_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        },
    });
} else {
    // ── Local disk storage fallback (dev without Cloudinary) ─────
    const uploadDir = path.join(__dirname, "../uploads/public-page");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    imageStorage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadDir),
        filename: (req, file, cb) => {
            const ext  = path.extname(file.originalname);
            cb(null, `pub_${Date.now()}_${Math.random().toString(36).substr(2, 6)}${ext}`);
        },
    });
}

// Single-file uploader (gallery, faculty)
const upload = multer({
    storage: imageStorage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Dynamic uploader (logo, cover_photo, any field name)
const uploadDynamic = multer({
    storage: imageStorage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
}).any();

// Wrapper: convert array from .any() to keyed object like .fields()
const wrapDynamic = (req, res, next) => {
    uploadDynamic(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        if (Array.isArray(req.files)) {
            const filesMap = {};
            req.files.forEach((f) => {
                if (!filesMap[f.fieldname]) filesMap[f.fieldname] = [];
                filesMap[f.fieldname].push(f);
            });
            req.files = filesMap;
        }
        next();
    });
};

// ── All routes require authentication ─────────────────────────────
router.use(verifyToken);

// Check if feature is available
router.get("/check-feature", publicPageController.checkPublicPageFeature);
router.get("/check-subdomain", publicPageController.checkSubdomainAvailability);

// Main profile routes
router.get("/", publicPageController.getPublicPage);
router.post("/", wrapDynamic, publicPageController.createOrUpdatePublicPage);
router.put("/",  wrapDynamic, publicPageController.createOrUpdatePublicPage);

// Publish / Unpublish
router.post("/publish",   publicPageController.publishPage);
router.post("/unpublish", publicPageController.unpublishPage);

// Gallery
router.post("/gallery",        upload.single("photo"), publicPageController.uploadGalleryPhoto);
router.delete("/gallery/:id",  publicPageController.deleteGalleryPhoto);

// Faculty images (auto mode)
router.post("/faculty-image/:id",   upload.single("photo"), publicPageController.uploadFacultyImage);
router.delete("/faculty-image/:id", publicPageController.deleteFacultyImage);

// Reviews
router.post("/reviews",        publicPageController.addReview);
router.put("/reviews/:id",     publicPageController.updateReview);
router.delete("/reviews/:id",  publicPageController.deleteReview);

// Data for wizard
router.get("/faculty",  publicPageController.getFacultyList);
router.get("/subjects", publicPageController.getSubjectList);

module.exports = router;
