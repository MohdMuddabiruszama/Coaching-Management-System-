import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export const useAutoLogout = (logoutCallback, enabled = true) => {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [timeoutMinutes, setTimeoutMinutes] = useState(30);
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Fetch the global timeout setting from the server once on mount
  useEffect(() => {
    let isMounted = true;
    const fetchSettings = async () => {
      try {
        const { data } = await api.get('/auth/system-settings');
        if (isMounted && data?.settings?.autoLogoutTimer !== undefined) {
          const parsed = Number(data.settings.autoLogoutTimer);
          const minutes = isNaN(parsed) ? 30 : parsed;
          setTimeoutMinutes(minutes);
          console.info(`🔒 [Auto-Logout] Initialized: policy is ${minutes > 0 ? `${minutes} min idle timeout` : 'DISABLED'}. Enabled for this user: ${enabled}`);
        }
      } catch (err) {
        console.warn("Could not load auto-logout setting — default 30 min:", err.message);
      }
    };
    fetchSettings();
    return () => { isMounted = false; };
  }, [enabled]);

  // Listen for real-time updates and manual test triggers
  useEffect(() => {
    const handleUpdate = (e) => {
      if (e.detail?.timer !== undefined) {
        const parsed = Number(e.detail.timer);
        const minutes = isNaN(parsed) ? 30 : parsed;
        setTimeoutMinutes(minutes);
        setLastActivity(Date.now());
        setShowWarning(false);
        console.info(`🔒 [Auto-Logout] Settings dynamically updated to ${minutes} min.`);
      }
    };

    const handleTest = () => {
      console.info("🧪 [Auto-Logout] Manual test triggered: displaying warning modal.");
      setShowWarning(true);
      setCountdown(60);
    };

    window.addEventListener('auto_logout_setting_updated', handleUpdate);
    window.addEventListener('trigger_auto_logout_test', handleTest);

    return () => {
      window.removeEventListener('auto_logout_setting_updated', handleUpdate);
      window.removeEventListener('trigger_auto_logout_test', handleTest);
    };
  }, []);

  const resetActivity = useCallback(() => {
    setLastActivity(Date.now());
    if (showWarning) {
      setShowWarning(false);
      setCountdown(60);
    }
  }, [showWarning]);

  // Activity listeners (throttled to avoid performance impact)
  useEffect(() => {
    if (!enabled || timeoutMinutes <= 0) return;

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'];
    let lastHandled = 0;

    const handleActivity = () => {
      const now = Date.now();
      // Throttle activity updates to once every 2 seconds
      if (now - lastHandled > 2000) {
        lastHandled = now;
        if (!showWarning) {
          resetActivity();
        }
      }
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [enabled, timeoutMinutes, showWarning, resetActivity]);

  // Inactivity check interval
  useEffect(() => {
    if (!enabled || timeoutMinutes <= 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const inactiveDuration = now - lastActivity;
      const timeoutMs = timeoutMinutes * 60 * 1000;

      if (inactiveDuration >= timeoutMs && !showWarning) {
        console.info(`⚠️ [Auto-Logout] User inactive for ${Math.round(inactiveDuration / 1000)}s >= ${timeoutMinutes * 60}s. Displaying countdown warning.`);
        setShowWarning(true);
        setCountdown(60);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [enabled, lastActivity, timeoutMinutes, showWarning]);

  // Countdown timer logic when warning modal is shown
  useEffect(() => {
    if (!enabled || timeoutMinutes <= 0) return;

    let timer;
    if (showWarning) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            console.warn("🚨 [Auto-Logout] Inactivity countdown reached 0. Logging out user.");
            logoutCallback();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [enabled, showWarning, timeoutMinutes, logoutCallback]);

  return {
    showWarning,
    countdown,
    stayLoggedIn: resetActivity,
    timeoutMinutes,
  };
};
