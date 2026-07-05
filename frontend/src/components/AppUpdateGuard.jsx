import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import api from '../services/api';

/**
 * Parses version string to an array of integers for comparison.
 * e.g., "1.0.2" -> [1, 0, 2]
 */
const parseVersion = (versionStr) => {
    if (!versionStr) return [0, 0, 0];
    return versionStr.split('.').map(num => parseInt(num, 10) || 0);
};

/**
 * Returns true if current is less than minimum.
 */
const isVersionOlder = (current, min) => {
    const vCurrent = parseVersion(current);
    const vMin = parseVersion(min);
    
    for (let i = 0; i < Math.max(vCurrent.length, vMin.length); i++) {
        const c = vCurrent[i] || 0;
        const m = vMin[i] || 0;
        if (c < m) return true;
        if (c > m) return false;
    }
    return false;
};

const AppUpdateGuard = () => {
    const [needsUpdate, setNeedsUpdate] = useState(false);
    const [updateInfo, setUpdateInfo] = useState(null);

    useEffect(() => {
        // Only run on native platforms
        if (!Capacitor.isNativePlatform()) {
            return;
        }

        const checkVersion = async () => {
            try {
                // Get native app version
                const appInfo = await CapacitorApp.getInfo();
                const currentVersion = appInfo.version;

                // Fetch config from backend
                const response = await api.get('/auth/app-version');
                if (response.data && response.data.success) {
                    const minVersion = response.data.minVersion;
                    if (isVersionOlder(currentVersion, minVersion)) {
                        setUpdateInfo(response.data);
                        setNeedsUpdate(true);
                    }
                }
            } catch (error) {
                console.error("Failed to check app version:", error);
                // Fail open: If the backend is unreachable, don't lock out the user.
            }
        };

        checkVersion();
    }, []);

    const handleUpdateClick = () => {
        if (!updateInfo) return;
        const url = Capacitor.getPlatform() === 'ios' ? updateInfo.appStoreUrl : updateInfo.playStoreUrl;
        if (url) {
            window.location.href = url;
        }
    };

    if (!needsUpdate) return null;

    // Hard-blocking UI that covers everything and has no close button
    return (
        <div style={styles.overlay}>
            <div style={styles.card}>
                <div style={styles.iconContainer}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 8 12 12 14 14"></polyline>
                        <path d="M12 2v2"></path>
                        <path d="M12 20v2"></path>
                        <path d="M4.93 4.93l1.41 1.41"></path>
                        <path d="M17.66 17.66l1.41 1.41"></path>
                        <path d="M2 12h2"></path>
                        <path d="M20 12h2"></path>
                        <path d="M4.93 19.07l1.41-1.41"></path>
                        <path d="M17.66 6.34l1.41-1.41"></path>
                    </svg>
                </div>
                <h1 style={styles.title}>Update Required</h1>
                <p style={styles.description}>
                    A new version of the app is available and required to continue. Please update to the latest version to access new features and improvements.
                </p>
                <button style={styles.button} onClick={handleUpdateClick}>
                    Update Now
                </button>
            </div>
        </div>
    );
};

const styles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#f8fafc',
        zIndex: 999999, // Extremely high z-index to cover everything
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        padding: '40px 30px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.08)',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
    },
    iconContainer: {
        width: '100px',
        height: '100px',
        backgroundColor: '#eef2ff',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '24px'
    },
    title: {
        fontSize: '24px',
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: '16px',
        fontFamily: '"Inter", sans-serif'
    },
    description: {
        fontSize: '15px',
        color: '#64748b',
        lineHeight: '1.6',
        marginBottom: '32px',
        fontFamily: '"Inter", sans-serif'
    },
    button: {
        backgroundColor: '#6366f1',
        color: '#ffffff',
        border: 'none',
        borderRadius: '12px',
        padding: '16px 24px',
        fontSize: '16px',
        fontWeight: '600',
        width: '100%',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
        transition: 'transform 0.2s',
        fontFamily: '"Inter", sans-serif'
    }
};

export default AppUpdateGuard;
