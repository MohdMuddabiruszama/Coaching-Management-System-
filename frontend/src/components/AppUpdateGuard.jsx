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
 * Returns true if current is less than target.
 */
const isVersionOlder = (current, target) => {
    const vCurrent = parseVersion(current);
    const vTarget = parseVersion(target);
    
    for (let i = 0; i < Math.max(vCurrent.length, vTarget.length); i++) {
        const c = vCurrent[i] || 0;
        const m = vTarget[i] || 0;
        if (c < m) return true;
        if (c > m) return false;
    }
    return false;
};

const AppUpdateGuard = () => {
    const { minMobileVersion, latestMobileVersion, updateNotes } = useContext(AuthContext);
    
    // updateState can be: null, 'critical', or 'normal'
    const [updateState, setUpdateState] = useState(null);
    const [currentAppVersion, setCurrentAppVersion] = useState("Unknown");

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
                setCurrentAppVersion(currentVersion);

                // 1. Check for critical update
                if (minMobileVersion && isVersionOlder(currentVersion, minMobileVersion)) {
                    setUpdateState('critical');
                    return;
                }

                // 2. Check for normal update
                if (latestMobileVersion && isVersionOlder(currentVersion, latestMobileVersion)) {
                    const dismissedVersion = localStorage.getItem('dismissedUpdateVersion');
                    // If user hasn't dismissed this specific latest version, show the normal prompt
                    if (dismissedVersion !== latestMobileVersion) {
                        setUpdateState('normal');
                    }
                }
            } catch (error) {
                console.error("Failed to check app version against target versions:", error);
            }
        };

        checkVersion();
    }, [minMobileVersion, latestMobileVersion]);

    const handleDismiss = () => {
        if (latestMobileVersion) {
            localStorage.setItem('dismissedUpdateVersion', latestMobileVersion);
        }
        setUpdateState(null);
    };

    if (!updateState) return null;

    // Hard-blocking UI that covers everything
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 999999, backgroundColor: 'transparent'
        }}>
            <ForceUpdateScreen 
                currentVersion={currentAppVersion} 
                targetVersion={updateState === 'critical' ? minMobileVersion : latestMobileVersion} 
                type={updateState}
                updateNotes={updateNotes}
                onDismiss={handleDismiss}
            />
        </div>
    );
};

export default AppUpdateGuard;
