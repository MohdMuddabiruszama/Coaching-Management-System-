/**
 * pushNotifications.js
 *
 * Push notifications have been temporarily removed to prevent Android startup crashes
 * because Firebase Cloud Messaging is not yet configured.
 *
 * All functions are now no-ops so the app can compile and run safely.
 */

export const requestPushPermission = async () => false;

export const onPushReceived = (callback) => {
    return () => {};
};

export const getStoredFcmToken = () => {
    return null;
};
