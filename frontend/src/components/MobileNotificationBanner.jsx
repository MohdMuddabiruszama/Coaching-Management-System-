import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './MobileNotificationBanner.css';

/**
 * Phase 5B — In-App Notification Banner
 * ─────────────────────────────────────────────────────────────────────────────
 * Listens for the `push_notification_received` window event (dispatched by usePushNotifications)
 * and shows a slide-down banner inside the app.
 * If tapped, it routes to the path in notification data.
 */
export default function MobileNotificationBanner() {
    const [notification, setNotification] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const handlePush = (e) => {
            const notif = e.detail;
            if (!notif) return;
            
            setNotification(notif);

            // Auto-hide after 4 seconds
            setTimeout(() => {
                setNotification(null);
            }, 4000);
        };

        window.addEventListener('push_notification_received', handlePush);
        return () => window.removeEventListener('push_notification_received', handlePush);
    }, []);

    if (!notification) return null;

    const handleTap = () => {
        const route = notification.data?.route || notification.data?.url;
        if (route) {
            try {
                const path = route.startsWith("http") ? new URL(route).pathname : route;
                navigate(path);
            } catch (e) {
                // Ignore malformed url
            }
        }
        setNotification(null);
    };

    return (
        <div className="mnb-container slide-down" onClick={handleTap}>
            <div className="mnb-content">
                <div className="mnb-icon">📢</div>
                <div className="mnb-text">
                    <h4>{notification.title || 'New Notification'}</h4>
                    <p>{notification.body || ''}</p>
                </div>
            </div>
            {/* Optional dismiss button if they swipe or click X */}
            <div 
                className="mnb-close" 
                onClick={(e) => { 
                    e.stopPropagation(); 
                    setNotification(null); 
                }}
            >
                ✕
            </div>
        </div>
    );
}
