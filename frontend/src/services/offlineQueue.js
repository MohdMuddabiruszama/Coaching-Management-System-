import api from './api';

/**
 * Phase 4C — Offline Queue
 * ─────────────────────────────────────────────────────────────────────────────
 * Stores failed mutations (like attendance marks) while offline.
 * Automatically attempts to replay them when connection is restored.
 *
 * Performance fix: @capacitor/preferences is lazy-loaded (not top-level imported)
 * to avoid crashing on web builds and to reduce initial bundle parse time.
 */

const QUEUE_KEY = 'offline_mutation_queue';

// ── Lazy Preferences loader ────────────────────────────────────────────────
// Mirrors the pattern used in secureStorage.js — only loads the native plugin
// when actually needed (native platform only).
let _Preferences = null;
const getPreferences = async () => {
    if (_Preferences) return _Preferences;
    try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return null;
        const mod = await import('@capacitor/preferences');
        _Preferences = mod.Preferences;
        return _Preferences;
    } catch {
        return null;
    }
};

/**
 * Add a failed request to the offline queue
 * @param {Object} request { method, url, data }
 */
export const addToQueue = async (request) => {
    try {
        const Preferences = await getPreferences();
        if (!Preferences) return; // No-op on web (no native storage available)

        const { value } = await Preferences.get({ key: QUEUE_KEY });
        const queue = value ? JSON.parse(value) : [];
        
        // Add timestamp for debugging/expiry
        queue.push({
            ...request,
            queuedAt: new Date().toISOString()
        });

        await Preferences.set({
            key: QUEUE_KEY,
            value: JSON.stringify(queue)
        });
        
        console.log(`[OfflineQueue] Queued ${request.method} ${request.url}`);
    } catch (e) {
        console.error('[OfflineQueue] Failed to add to queue', e);
    }
};

/**
 * Flush the queue — replay all requests
 */
export const flushQueue = async () => {
    try {
        const Preferences = await getPreferences();
        if (!Preferences) return; // No-op on web

        const { value } = await Preferences.get({ key: QUEUE_KEY });
        if (!value) return;

        const queue = JSON.parse(value);
        if (queue.length === 0) return;

        console.log(`[OfflineQueue] Flushing ${queue.length} items...`);

        const failedItems = [];

        for (const req of queue) {
            try {
                // Replay the request
                if (req.method.toLowerCase() === 'post') {
                    await api.post(req.url, req.data);
                } else if (req.method.toLowerCase() === 'put') {
                    await api.put(req.url, req.data);
                } else if (req.method.toLowerCase() === 'delete') {
                    await api.delete(req.url, { data: req.data });
                }
                console.log(`[OfflineQueue] Replayed successfully: ${req.url}`);
            } catch (error) {
                console.error(`[OfflineQueue] Replay failed: ${req.url}`, error);
                // If it's a 4xx error (like validation), we shouldn't retry it infinitely.
                // But for 5xx or network errors, we keep it in the queue.
                if (!error.response || error.response.status >= 500) {
                    failedItems.push(req);
                }
            }
        }

        // Save only the ones that failed to send again
        await Preferences.set({
            key: QUEUE_KEY,
            value: JSON.stringify(failedItems)
        });

        if (failedItems.length === 0) {
            console.log('[OfflineQueue] Flush complete. All synced.');
        } else {
            console.warn(`[OfflineQueue] Flush finished, but ${failedItems.length} items remain.`);
        }
    } catch (e) {
        console.error('[OfflineQueue] Failed to flush queue', e);
    }
};
