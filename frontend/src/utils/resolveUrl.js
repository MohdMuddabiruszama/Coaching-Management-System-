/**
 * resolveFileUrl — Smart URL resolver for Cloudinary migration
 *
 * Before Cloudinary: URLs were relative like "/uploads/assignments/file.pdf"
 *                    → needed to prepend API base URL
 * After Cloudinary:  URLs are absolute like "https://res.cloudinary.com/..."
 *                    → use directly, no prefix needed
 *
 * This helper handles BOTH old (legacy data) and new (Cloudinary) URLs,
 * making the transition backward-compatible.
 *
 * Usage:
 *   import { resolveFileUrl, resolveImgUrl } from '../../utils/resolveUrl';
 *
 *   // For file downloads (PDF, DOCX, etc.)
 *   <a href={resolveFileUrl(note.file_url)}>Download</a>
 *
 *   // For images
 *   <img src={resolveImgUrl(student.profile_photo)} />
 */

const API_BASE = (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace('/api', '')
    : import.meta.env.DEV
        ? 'http://localhost:5000'
        : 'https://api.zenithflows.in').replace(/\/$/, '');

/**
 * Resolves any file URL to a usable href/src.
 * - Cloudinary URLs (https://res.cloudinary.com/...) → returned as-is
 * - Blob URLs (blob:...) → returned as-is
 * - Relative paths (/uploads/...) → prepends backend API_BASE
 * - null/undefined → returns empty string
 *
 * @param {string|null} url
 * @returns {string}
 */
export function resolveFileUrl(url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
        return url;
    }
    return `${API_BASE}${url}`;
}

/**
 * Alias for image URLs — same logic as resolveFileUrl.
 * Kept separate for semantic clarity.
 */
export function resolveImgUrl(url) {
    return resolveFileUrl(url);
}

/**
 * Returns Cloudinary-optimized URL for images.
 * Falls back to original URL for non-Cloudinary images.
 *
 * @param {string} url - Cloudinary image URL
 * @param {'thumbnail'|'small'|'medium'|'large'} size
 * @returns {string}
 */
export function resolveCloudinaryImg(url, size = 'medium') {
    if (!url || !url.includes('cloudinary.com')) return resolveFileUrl(url);

    const transforms = {
        thumbnail: 'w_150,h_150,c_fill,q_auto,f_auto',
        small:     'w_300,h_300,c_fill,q_auto,f_auto',
        medium:    'w_600,h_600,c_limit,q_auto,f_auto',
        large:     'w_1200,h_1200,c_limit,q_auto,f_auto',
    };

    return url.replace('/upload/', `/upload/${transforms[size] || transforms.medium}/`);
}

export default resolveFileUrl;
