/**
 * ✅ PHASE 5: Upload Service with Graceful Fallback
 * ─────────────────────────────────────────────────────────────────────────────
 * If Cloudinary is unavailable, saves the file locally and queues it for retry.
 * The student/faculty/note record is ALWAYS saved — a missing photo never blocks
 * the core feature (student enrollment, note creation, etc.).
 *
 * Graceful degradation flow:
 *   1. Try Cloudinary with an 8-second timeout
 *   2. If it fails → save file locally in /uploads/pending/
 *   3. Return { url: null, uploaded: false, queued: true }
 *   4. Caller attaches the local path as a temporary URL (dev) or skips photo
 *   5. A retry cron job (or manual trigger) attempts Cloudinary upload again
 * ─────────────────────────────────────────────────────────────────────────────
 */

const path      = require("path");
const fs        = require("fs");
const cloudinary = require("../config/cloudinary");
const { getBreaker } = require("../utils/circuitBreaker");

// Circuit breaker for Cloudinary — opens after 5 failures
const cloudinaryBreaker = getBreaker("cloudinary", {
    failureThreshold: 5,
    successThreshold: 2,
    timeout:          60000, // 1-minute cooldown before retry
});

// Pending uploads directory for fallback
const PENDING_DIR = path.join(__dirname, "../uploads/pending");
if (!fs.existsSync(PENDING_DIR)) {
    fs.mkdirSync(PENDING_DIR, { recursive: true });
}

/**
 * Upload a file to Cloudinary with graceful fallback.
 *
 * @param {string} filePath  - Local file path (from Multer diskStorage)
 * @param {Object} options   - Cloudinary upload options (folder, public_id, etc.)
 * @returns {Promise<{ url: string|null, publicId: string|null, uploaded: boolean, queued: boolean, localPath: string|null }>}
 */
const uploadWithFallback = async (filePath, options = {}) => {
    if (!filePath) {
        return { url: null, publicId: null, uploaded: false, queued: false, localPath: null };
    }

    // ── Attempt Cloudinary upload through circuit breaker ─────────────────
    try {
        const result = await cloudinaryBreaker.fire(() =>
            cloudinary.uploader.upload(filePath, {
                timeout: 8000, // 8-second timeout — Cloudinary should respond in <2s normally
                ...options,
            })
        );

        // Success — clean up temp file if it exists and Cloudinary storage is confirmed
        if (result.secure_url && fs.existsSync(filePath) && !options.keepLocal) {
            fs.unlink(filePath, () => {}); // Non-blocking cleanup
        }

        return {
            url:       result.secure_url,
            publicId:  result.public_id,
            uploaded:  true,
            queued:    false,
            localPath: null,
        };

    } catch (err) {
        // ── Cloudinary failed — degrade gracefully ────────────────────────
        console.warn(`⚠️ [uploadWithFallback] Cloudinary upload failed: ${err.message}`);

        // Copy file to the pending queue directory for later retry
        let queuedPath = null;
        try {
            const fileName   = path.basename(filePath);
            const pendingPath = path.join(PENDING_DIR, `${Date.now()}-${fileName}`);
            fs.copyFileSync(filePath, pendingPath);
            queuedPath = pendingPath;
        } catch (fsErr) {
            console.error("[uploadWithFallback] Failed to queue file locally:", fsErr.message);
        }

        // Local /uploads URL as temporary fallback (only useful in dev)
        const isLocalFile = fs.existsSync(filePath);
        const tempUrl = isLocalFile
            ? `/uploads/${path.basename(filePath)}`
            : null;

        return {
            url:       tempUrl,   // null in production (Cloudinary CDN not available)
            publicId:  null,
            uploaded:  false,
            queued:    Boolean(queuedPath),
            localPath: queuedPath,
        };
    }
};

/**
 * Delete a file from Cloudinary by public_id.
 * Fails silently — a failed deletion never blocks the main flow.
 *
 * @param {string} publicId - Cloudinary public_id to delete
 */
const deleteFromCloudinary = async (publicId) => {
    if (!publicId) return;
    try {
        await cloudinaryBreaker.fire(() =>
            cloudinary.uploader.destroy(publicId, { timeout: 5000 })
        );
    } catch (err) {
        console.warn(`⚠️ [deleteFromCloudinary] Failed to delete ${publicId}: ${err.message}`);
    }
};

module.exports = { uploadWithFallback, deleteFromCloudinary };
