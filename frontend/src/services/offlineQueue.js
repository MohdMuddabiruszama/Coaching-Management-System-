import api from './api';

/**
 * Phase 4C — Offline Queue (✅ Phase 8: Enhanced with retry cap + expiry)
 * ─────────────────────────────────────────────────────────────────────────────
 * Stores failed mutations (like attendance marks) while offline.
 * Automatically attempts to replay them when connection is restored.
 *
 * Phase 8 additions:
 *   - maxRetries cap: items that fail 5 times are discarded (not retried forever)
 *   - retries counter: tracked per queued item
 *   - 48-hour expiry: stale offline actions that never synced are cleaned up
 *
 * Performance fix: @capacitor/preferences is lazy-loaded (not top-level imported)
 * to avoid crashing on web builds and to reduce initial bundle parse time.
 */

const QUEUE_KEY    = 'offline_mutation_queue';
const MAX_RETRIES  = 5;
const MAX_AGE_MS   = 48 * 60 * 60 * 1000; // 48 hours

// ── Lazy Preferences loader ────────────────────────────────────────────────
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
        if (!Preferences) return; // No-op on web

        const { value } = await Preferences.get({ key: QUEUE_KEY });
        const queue = value ? JSON.parse(value) : [];

        queue.push({
            ...request,
            queuedAt: new Date().toISOString(),
            retries:  0,  // ✅ Phase 8: track retry count
        });

        await Preferences.set({ key: QUEUE_KEY, value: JSON.stringify(queue) });
        console.log(`[OfflineQueue] Queued ${request.method} ${request.url}`);
    } catch (e) {
        console.error('[OfflineQueue] Failed to add to queue', e);
    }
};

/**
 * Flush the queue — replay all requests.
 * Items that fail permanently (5 retries or 48h old) are discarded.
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

        const now = Date.now();
        const remaining = [];

        for (const req of queue) {
            // ✅ Phase 8: Discard expired items (older than 48 hours)
            if (req.queuedAt && (now - new Date(req.queuedAt).getTime()) > MAX_AGE_MS) {
                console.warn(`[OfflineQueue] Discarding expired item: ${req.url} (queued ${req.queuedAt})`);
                continue;
            }

            // ✅ Phase 8: Discard items that have failed too many times
            if ((req.retries || 0) >= MAX_RETRIES) {
                console.error(`[OfflineQueue] Discarding after ${MAX_RETRIES} retries: ${req.url}`);
                continue;
            }

            try {
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
                if (!error.response || error.response.status >= 500) {
                    // Transient error — keep in queue with incremented retry count
                    remaining.push({ ...req, retries: (req.retries || 0) + 1 });
                }
                // 4xx errors are permanent failures — discard them
            }
        }

        await Preferences.set({ key: QUEUE_KEY, value: JSON.stringify(remaining) });

        if (remaining.length === 0) {
            console.log('[OfflineQueue] Flush complete. All synced.');
        } else {
            console.warn(`[OfflineQueue] Flush finished, but ${remaining.length} items remain.`);
        }
    } catch (e) {
        console.error('[OfflineQueue] Failed to flush queue', e);
    }
};
