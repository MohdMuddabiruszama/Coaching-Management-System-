/**
 * Assignment Upload Utility — Cloudinary Storage (with disk fallback)
 * Faculty reference files & student submissions
 *
 * - If Cloudinary is configured: files go to Cloudinary CDN (permanent)
 * - If Cloudinary is NOT configured: falls back to local /uploads/assignments (dev mode)
 */

const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");
const cloudinary = require("../config/cloudinary");

// ── Check if Cloudinary is configured ─────────────────────────────
const isCloudinaryConfigured =
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_CLOUD_NAME !== "your_cloud_name" &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_KEY !== "your_api_key";

// ── Allowed MIME types ────────────────────────────────────────────
const allowedTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp",
    "application/zip",
    "application/x-zip-compressed",
];

const fileFilter = (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type. Only PDF, DOCX, IMAGE, and ZIP are allowed."), false);
    }
};

let storage;

if (isCloudinaryConfigured) {
    // ── Cloudinary storage ─────────────────────────────────────────
    const { CloudinaryStorage } = require("multer-storage-cloudinary");
    const imageTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];

    storage = new CloudinaryStorage({
        cloudinary,
        params: (req, file) => {
            const isImage = imageTypes.includes(file.mimetype);
            return {
                folder: "zf-solution/assignments",
                resource_type: isImage ? "image" : "raw",
                public_id: `asg-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
                ...(isImage && {
                    transformation: [
                        { width: 2000, height: 2000, crop: "limit" },
                        { quality: "auto" },
                        { fetch_format: "auto" },
                    ],
                }),
            };
        },
    });
    // using Cloudinary storage
} else {
    // ── Local disk storage fallback (for dev without Cloudinary) ──
    const uploadDir = path.join(__dirname, "../uploads/assignments");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadDir),
        filename: (req, file, cb) => {
            const ext  = path.extname(file.originalname);
            const base = path.basename(file.originalname, ext).replace(/\s+/g, "-");
            cb(null, `${Date.now()}-${base}${ext}`);
        },
    });
    console.log("📁 Assignment upload: using local disk storage (Cloudinary not configured)");
}

const uploadAssignment = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
    fileFilter,
});

module.exports = { uploadAssignment };
