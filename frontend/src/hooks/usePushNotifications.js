import { useEffect, useState } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import api from '../services/api';

let isRegistered = false;

export function usePushNotifications() {
    const [token, setToken] = useState(null);

    useEffect(() => {
        // Only run on native platforms (Android/iOS)
        if (!Capacitor.isNativePlatform()) return;
        if (isRegistered) return;
        isRegistered = true;

        const registerPush = async () => {
            try {
                let permStatus = await PushNotifications.requestPermissions();

                if (permStatus.receive !== 'granted') {
                    console.warn("Push permissions not granted by user.");
                    return;
                }

                await PushNotifications.register();
            } catch (error) {
                console.error("Error checking/requesting push permissions:", error);
            }
        };

        const addListeners = async () => {
            await PushNotifications.addListener('registration', async (pushToken) => {
                console.log('✅ FCM Token received:', pushToken.value);
                setToken(pushToken.value);
                localStorage.setItem('fcm_token', pushToken.value);

                // Register token with backend
                try {
                    const sessionToken = sessionStorage.getItem("token");
                    if (sessionToken) {
                        await api.post('/notifications/device/register', {
                            fcm_token: pushToken.value,
                            platform: Capacitor.getPlatform()
                        });
                        console.log("✅ Device token successfully registered with backend.");
                    }
                } catch (e) {
                    console.error("❌ Failed to register token on backend", e.message);
                }
            });

            await PushNotifications.addListener('registrationError', err => {
                console.error('❌ Push registration error: ', err.error);
            });

            await PushNotifications.addListener('pushNotificationReceived', notification => {
                console.log('📨 Push notification received: ', notification);
                // Dispatch event so MobileNotificationBanner can show it in-app
                window.dispatchEvent(new CustomEvent('push_notification_received', { detail: notification }));
            });

            await PushNotifications.addListener('pushNotificationActionPerformed', notification => {
                console.log('👆 Push notification tapped: ', notification);
                const data = notification.notification.data;
                if (data && (data.route || data.url)) {
                    window.dispatchEvent(new CustomEvent('push_notification_received', { detail: notification.notification }));
                }
            });
        };

        addListeners().then(() => registerPush());

        return () => {
            // Clean up listeners on unmount
            PushNotifications.removeAllListeners();
            isRegistered = false;
        };
    }, []);

    return { token };
}

export function getStoredPushToken() {
    return localStorage.getItem('fcm_token');
}
