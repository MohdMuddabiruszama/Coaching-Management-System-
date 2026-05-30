/**
 * capacitorPermissions.js — Native File Save Utility
 * ─────────────────────────────────────────────────────────────────────────────
 * STRATEGY (works on ALL Android versions, no storage permission needed):
 *
 *   1. Write file to Directory.Cache (always writable, no perms required)
 *   2. Convert the cache URI to a native URI via Capacitor
 *   3. Open the Share sheet — user saves/opens from there
 *
 * This approach works on Android 5 → Android 16 without any WRITE_EXTERNAL_STORAGE
 * permission, because we never write to external storage directly.
 *
 * On the WEB: falls back to standard <a download> link.
 */

import { Capacitor } from "@capacitor/core";

// ─── Camera Permission ────────────────────────────────────────────────────────
/**
 * Requests camera permission using @capacitor/camera.
 * Returns true if permission is granted, false otherwise.
 */
export async function requestCameraPermission() {
    if (!Capacitor.isNativePlatform()) return true; // Web — browser handles its own prompt

    try {
        const { Camera } = await import("@capacitor/camera");

        let status = await Camera.checkPermissions();
        if (status.camera === "granted") return true;

        if (status.camera === "denied") {
            alert(
                "📷 Camera permission was denied.\n\nPlease go to:\nSettings → Apps → StudentSaaS-Universal → Permissions → Camera → Allow"
            );
            return false;
        }

        // First time — request it
        status = await Camera.requestPermissions({ permissions: ["camera"] });
        return status.camera === "granted";
    } catch (err) {
        console.error("Camera permission error:", err);
        return false;
    }
}

// ─── Native PDF Save (Cache + Share — no storage permission needed) ──────────
/**
 * Saves a base64-encoded file using Cache directory + Share sheet.
 * This works on ALL Android versions (5 through 16+) without permissions.
 *
 * @param {string} base64Data  — Raw base64 string (no "data:..." prefix)
 * @param {string} fileName    — e.g. "Student_ID.pdf"
 * @param {string} mimeType    — e.g. "application/pdf"
 */
export async function saveFileNative(base64Data, fileName, mimeType = "application/pdf") {
    if (!Capacitor.isNativePlatform()) {
        // ── Web: standard browser download ──
        const link = document.createElement("a");
        link.href = `data:${mimeType};base64,${base64Data}`;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return true;
    }

    const { Filesystem, Directory } = await import("@capacitor/filesystem");

    try {
        // ── Step 1: Write to Cache directory (NO permission required on any Android version) ──
        const writeResult = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache,
            recursive: true,
        });

        const nativeUri = writeResult.uri;
        console.log("✅ File cached at:", nativeUri);

        // ── Step 2: Open Share sheet so user can "Save to Downloads" / open / etc. ──
        try {
            const { Share } = await import("@capacitor/share");
            await Share.share({
                title: fileName,
                url: nativeUri,
                dialogTitle: `Save or open ${fileName}`,
            });
        } catch (shareErr) {
            // Share not available or user dismissed — show path
            console.warn("Share failed, trying FilOpener fallback:", shareErr);
            alert(`✅ File saved!\n\nLocation: ${nativeUri}\n\nYou can find it using a file manager app.`);
        }

        return true;
    } catch (err) {
        console.error("saveFileNative error:", err);
        alert("❌ Failed to save file: " + (err.message || String(err)));
        return false;
    }
}

// ─── Convenience: save jsPDF doc natively ────────────────────────────────────
/**
 * Takes a jsPDF `doc` instance and saves it natively on Android or
 * triggers a browser download on web.
 *
 * Usage (replaces doc.save(fileName)):
 *   await savePdfNative(doc, "Student_ID.pdf");
 *
 * @param {object} doc       — jsPDF document instance
 * @param {string} fileName  — desired filename including .pdf extension
 */
export async function savePdfNative(doc, fileName) {
    if (!Capacitor.isNativePlatform()) {
        // Web: standard jsPDF download
        doc.save(fileName);
        return;
    }

    // Extract raw base64 from jsPDF (strips the "data:application/pdf;base64," prefix)
    const dataUri = doc.output("datauristring");
    const base64 = dataUri.split(",")[1];
    await saveFileNative(base64, fileName, "application/pdf");
}

// ─── Download a remote file natively ─────────────────────────────────────────
/**
 * Downloads a remote URL and saves it natively on Android, or opens it
 * in a new tab on web.
 *
 * @param {string} remoteUrl — Full URL to the file
 * @param {string} fileName  — Destination file name
 */
export async function downloadRemoteFile(remoteUrl, fileName) {
    if (!Capacitor.isNativePlatform()) {
        // Web: Force download by fetching as a blob and creating an object URL.
        // This avoids Cloudinary HTTP 400 errors when applying transformations to 'raw' files,
        // and bypasses browser cross-origin download restrictions.
        try {
            // Show a brief loading indicator if we want, but we rely on the component's toast mostly.
            const response = await fetch(remoteUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            
            const blob = await response.blob();
            
            let finalFileName = fileName;
            
            // If the filename has no extension, infer it from the blob's MIME type
            if (!finalFileName.includes('.')) {
                const extMap = {
                    'application/pdf': '.pdf',
                    'image/jpeg': '.jpg',
                    'image/png': '.png',
                    'image/webp': '.webp',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
                    'application/msword': '.doc',
                    'application/zip': '.zip',
                    'text/plain': '.txt',
                    'application/vnd.ms-excel': '.xls',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
                    'application/vnd.ms-powerpoint': '.ppt',
                    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx'
                };
                
                // Cloudinary sometimes returns 'application/octet-stream' for raw PDFs if the original extension was lost.
                // Fallback to .pdf since it's the most common document format on this platform.
                const ext = extMap[blob.type] || '.pdf';
                finalFileName += ext;
            }

            const objectUrl = URL.createObjectURL(blob);
            
            const link = document.createElement("a");
            link.href = objectUrl;
            link.download = finalFileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up the object URL after a short delay
            setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
            return;
        } catch (err) {
            console.warn("Blob download failed, falling back to new tab:", err);
            // Fallback: just open it if fetch fails (e.g., CORS issues)
            const link = document.createElement("a");
            link.href = remoteUrl;
            link.download = fileName; // original name
            link.target = "_blank";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        }
    }

    try {
        // Fetch the file as a blob
        const response = await fetch(remoteUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        const blob = await response.blob();
        const mimeType = blob.type || "application/octet-stream";

        // Convert blob → base64
        const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(",")[1]);
            reader.onerror = () => reject(new Error("FileReader failed"));
            reader.readAsDataURL(blob);
        });

        await saveFileNative(base64, fileName, mimeType);
    } catch (err) {
        console.error("downloadRemoteFile error:", err);
        alert("❌ Failed to download: " + (err.message || String(err)));
    }
}
