import React, { useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { AuthContext } from '../context/AuthContext';
import ForceUpdateScreen from './common/ForceUpdateScreen';

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
    const { minMobileVersion } = useContext(AuthContext);
    const [needsUpdate, setNeedsUpdate] = useState(false);
    const [currentAppVersion, setCurrentAppVersion] = useState("Unknown");

    useEffect(() => {
        // Only run on native platforms
        if (!Capacitor.isNativePlatform() || !minMobileVersion) {
            return;
        }

        const checkVersion = async () => {
            try {
                // Get native app version
                const appInfo = await CapacitorApp.getInfo();
                const currentVersion = appInfo.version;
                setCurrentAppVersion(currentVersion);

                if (isVersionOlder(currentVersion, minMobileVersion)) {
                    setNeedsUpdate(true);
                }
            } catch (error) {
                console.error("Failed to check app version against min version:", error);
            }
        };

        checkVersion();
    }, [minMobileVersion]);

    if (!needsUpdate) return null;

    // Hard-blocking UI that covers everything
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 999999, backgroundColor: '#f3f4f6'
        }}>
            <ForceUpdateScreen currentVersion={currentAppVersion} minVersion={minMobileVersion} />
        </div>
    );
};

export default AppUpdateGuard;
