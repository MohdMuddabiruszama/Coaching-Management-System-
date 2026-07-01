import { useState, useEffect, useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { flushQueue } from "../services/offlineQueue";
import "./NetworkStatus.css";

const IS_NATIVE = Capacitor.isNativePlatform();

const NetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const [showBackOnline, setShowBackOnline] = useState(false);
    const [serverDown, setServerDown] = useState(false);
    const [retrying, setRetrying] = useState(false);
    
    // Track if we were previously offline so we don't show "Back Online" on app start
    const wasOfflineRef = useRef(typeof navigator !== 'undefined' ? !navigator.onLine : false);

    useEffect(() => {
        let networkListener;
        let timeoutId;

        const handleOnline = () => {
            setIsOnline(true);
            setRetrying(false);
            flushQueue(); // Phase 4C: Flush offline queue when reconnected
            
            if (wasOfflineRef.current) {
                setShowBackOnline(true);
                if (timeoutId) clearTimeout(timeoutId);
                timeoutId = setTimeout(() => setShowBackOnline(false), 4000); // Hide success toast after 4s
            }
            
            wasOfflineRef.current = false;
        };

        const handleOffline = () => {
            setIsOnline(false);
            setShowBackOnline(false);
            wasOfflineRef.current = true;
            if (timeoutId) clearTimeout(timeoutId);
        };

        const handleServerDown = () => {
            setServerDown(true);
        };

        const setupNetwork = async () => {
            const { Capacitor } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const { Network } = await import("@capacitor/network");
                const status = await Network.getStatus();
                if (!status.connected) handleOffline();
                networkListener = await Network.addListener('networkStatusChange', status => {
                    if (status.connected) handleOnline();
                    else handleOffline();
                });
            } else {
                window.addEventListener("online", handleOnline);
                window.addEventListener("offline", handleOffline);
            }
            window.addEventListener("offline_api_error", handleServerDown);
        };

        setupNetwork();

        return () => {
            if (networkListener) {
                networkListener.remove();
            }
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
            window.removeEventListener("offline_api_error", handleServerDown);
        };
    }, []);

    if (serverDown) {
        return (
            <div className="network-status-container offline" style={{ zIndex: 10000000 }}>
                <div className="network-toast offline-toast card" style={{ background: '#1E293B', borderColor: '#334155' }}>
                    <div className="network-icon">🔌</div>
                    <div className="network-content" style={{ flex: 1, paddingRight: '12px' }}>
                        <strong>Platform Unreachable</strong>
                        <p style={{ fontSize: '0.8rem', opacity: 0.9 }}>Backend servers are unresponsive.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                            disabled={retrying}
                            onClick={async () => {
                                setRetrying(true);
                                try {
                                    const baseURL = import.meta.env.VITE_API_URL || 'https://institutes-saas.onrender.com/api';
                                    const healthURL = baseURL.replace(/\/api$/, '/api/health');
                                    await fetch(healthURL, { method: 'GET', cache: 'no-store' });
                                    setServerDown(false);
                                } catch {
                                    // Stay in error state
                                } finally {
                                    setRetrying(false);
                                }
                            }}
                            style={{
                                background: '#3B82F6',
                                border: 'none',
                                color: 'white',
                                padding: '6px 14px',
                                borderRadius: '100px',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                opacity: retrying ? 0.7 : 1
                            }}
                        >
                            {retrying ? '...' : 'Retry'}
                        </button>
                        <button
                            onClick={() => setServerDown(false)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#94A3B8',
                                fontSize: '1.4rem',
                                cursor: 'pointer',
                                padding: '0 4px',
                                lineHeight: '1'
                            }}
                            aria-label="Dismiss"
                        >
                            &times;
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (isOnline && !showBackOnline) return null;

    return (
        <div className={`network-status-container ${!isOnline ? "offline" : "online"}`}>
            {!isOnline ? (
                <div className="network-toast offline-toast card">
                    <div className="network-icon">📡</div>
                    <div className="network-content">
                        <strong>No Internet Connection</strong>
                        <p>You're offline. Check your connection.</p>
                    </div>
                </div>
            ) : (
                <div className="network-toast online-toast card">
                    <div className="network-icon" style={{ filter: "hue-rotate(90deg)" }}>📡</div>
                    <div className="network-content">
                        <strong>Back Online</strong>
                        <p>Your connection has been restored.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NetworkStatus;

