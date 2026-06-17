import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { flushQueue } from "../services/offlineQueue";
import "./NetworkStatus.css";

const IS_NATIVE = Capacitor.isNativePlatform();

const NetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showBackOnline, setShowBackOnline] = useState(false);
    const [serverDown, setServerDown] = useState(false);
    const [retrying, setRetrying] = useState(false);

    useEffect(() => {
        let networkListener;

        const handleOnline = () => {
            setIsOnline(true);
            setShowBackOnline(true);
            setRetrying(false);
            flushQueue(); // Phase 4C: Flush offline queue when reconnected
            setTimeout(() => setShowBackOnline(false), 4000); // Hide success toast after 4s
        };

        const handleOffline = () => {
            setIsOnline(false);
            setShowBackOnline(false);
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

    // Phase 4: Retry handler for mobile offline screen
    const handleRetry = useCallback(() => {
        setRetrying(true);
        // Give the network a moment to reconnect, then reload
        setTimeout(() => {
            if (navigator.onLine) {
                window.location.reload();
            } else {
                setRetrying(false);
            }
        }, 1500);
    }, []);

    if (serverDown) {
        return (
            <div className="server-down-overlay">
                <div className="server-down-card">
                    <div className="server-down-icon-wrapper">
                        <div className="server-down-icon">🔌</div>
                        <div className="pulsing-ring"></div>
                    </div>
                    <h2 className="server-down-title">Platform Unreachable</h2>
                    <p className="server-down-desc">
                        We are currently unable to connect to the backend database servers. Our systems might be under maintenance or experiencing high traffic. Please try again in a few minutes.
                    </p>
                    <button className="server-retry-btn" onClick={() => window.location.reload()}>
                        Retry Connection 🔄
                    </button>
                    <div className="server-status-bar">
                        <span className="server-dot"></span>
                        System Network Status: <span style={{color: '#ff4d4f', fontWeight: 'bold', marginLeft: '4px'}}>Offline</span>
                    </div>
                </div>
            </div>
        );
    }

    // Phase 4 (Mobile): Full-screen offline overlay for native platforms
    if (IS_NATIVE && !isOnline) {
        return (
            <div className="mobile-offline-overlay">
                <div className="mobile-offline-card">
                    <div className="mobile-offline-icon-wrap">
                        <div className="mobile-offline-icon">📡</div>
                        <div className="mobile-offline-ring"></div>
                    </div>
                    <h2 className="mobile-offline-title">No Internet Connection</h2>
                    <p className="mobile-offline-desc">
                        You're currently offline. Please check your Wi-Fi or mobile data and try again.
                    </p>
                    <button
                        className="mobile-offline-retry-btn"
                        onClick={handleRetry}
                        disabled={retrying}
                    >
                        {retrying ? "Checking…" : "Retry Connection 🔄"}
                    </button>
                    <div className="mobile-offline-status">
                        <span className="mobile-offline-dot"></span>
                        Network Status: <span style={{ color: "#ff4d4f", fontWeight: "700", marginLeft: "4px" }}>Offline</span>
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

