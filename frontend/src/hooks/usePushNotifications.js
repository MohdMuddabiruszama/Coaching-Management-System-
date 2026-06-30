/**
 * usePushNotifications
 *
 * Push notifications have been temporarily removed to prevent Android startup crashes
 * because Firebase Cloud Messaging is not yet configured.
 *
 * All functions are now no-ops so the app can compile and run safely.
 */

export function usePushNotifications() {
    // No-op
}

/** Utility: read the stored FCM token synchronously (from localStorage). */
export function getStoredPushToken() {
    return null;
}
