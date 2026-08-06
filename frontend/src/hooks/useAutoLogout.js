import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export const useAutoLogout = (logoutCallback) => {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [timeoutMinutes, setTimeoutMinutes] = useState(15);
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Fetch the global timeout setting from the server once on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await api.get('/auth/system-settings');
        if (data && data.settings && data.settings.autoLogoutTimer) {
          setTimeoutMinutes(data.settings.autoLogoutTimer);
        }
      } catch (err) {
        console.error("Failed to fetch auto-logout timer setting", err);
      }
    };
    fetchSettings();
  }, []);

  const resetActivity = useCallback(() => {
    setLastActivity(Date.now());
    if (showWarning) {
      setShowWarning(false);
      setCountdown(60);
    }
  }, [showWarning]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    // If the warning is showing, don't reset activity (user must click "Stay Logged In" button)
    const handleActivity = () => {
      if (!showWarning) {
        resetActivity();
      }
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [showWarning, resetActivity]);

  useEffect(() => {
    // Check activity every second
    const interval = setInterval(() => {
      const now = Date.now();
      const inactiveDuration = now - lastActivity;
      const timeoutMs = timeoutMinutes * 60 * 1000;

      if (inactiveDuration >= timeoutMs && !showWarning) {
        setShowWarning(true);
        setCountdown(60);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastActivity, timeoutMinutes, showWarning]);

  // Countdown timer logic when warning is shown
  useEffect(() => {
    let timer;
    if (showWarning) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
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
  }, [showWarning, logoutCallback]);

  return {
    showWarning,
    countdown,
    stayLoggedIn: resetActivity
  };
};
