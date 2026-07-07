import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import './MobileNotificationBanner.css';

/**
 * Phase 5B — In-App Notification Banner
 * ─────────────────────────────────────────────────────────────────────────────
 * Listens for the `push_notification_received` window event (dispatched by usePushNotifications)
 * and shows a slide-down banner inside the app.
 * Listens for `push_notification_tapped` to instantly navigate when opened from tray.
 */
export default function MobileNotificationBanner() {
    const [notification, setNotification] = useState(null);
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    const processNavigation = (notif) => {
        let route = notif.data?.route || notif.data?.url;
        if (route) {
            try {
                let path = route.startsWith("http") ? new URL(route).pathname : route;
                
                // Fix role-based routing mismatches from backend hardcoded routes
                if (user && user.role) {
                    const rolePrefix = user.role === 'faculty' ? '/faculty' : user.role === 'parent' ? '/parent' : '/student';
                    path = path.replace(/^\/(student|faculty|parent|admin)/, rolePrefix);

                    // Fix specific path names (e.g. backend sends /chats but React router uses /chat)
                    if (path.endsWith('/chats')) {
                        path = path.replace('/chats', '/chat');
                    }
                }
                navigate(path);
            } catch (e) {
                // Ignore malformed url
            }
        }
    };

    useEffect(() => {
        const handlePush = (e) => {
            const notif = e.detail;
            if (!notif) return;
            setNotification(notif);
            setTimeout(() => setNotification(null), 4000);
        };

        const handleTap = (e) => {
            const notif = e.detail;
            if (!notif) return;
            processNavigation(notif);
        };

        window.addEventListener('push_notification_received', handlePush);
        window.addEventListener('push_notification_tapped', handleTap);
        return () => {
            window.removeEventListener('push_notification_received', handlePush);
            window.removeEventListener('push_notification_tapped', handleTap);
        };
    }, [navigate, user]);

    if (!notification) return null;

    const handleBannerTap = () => {
        processNavigation(notification);
        setNotification(null);
    };

    return (
        <div className="mnb-container slide-down" onClick={handleBannerTap}>
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
