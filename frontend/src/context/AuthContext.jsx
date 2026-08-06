import { createContext, useState, useEffect, useContext } from "react";
import { loginUser } from "../services/auth.service";
import { BrandingContext } from "./BrandingContext";
import { getStoredPushToken } from "../hooks/usePushNotifications";
import { Capacitor } from "@capacitor/core";
import api from "../services/api";

export const AuthContext = createContext();

const persistSession = (token, user, rememberMe = false) => {
  sessionStorage.setItem("token", token);
  sessionStorage.setItem("user", JSON.stringify(user));
  if (Capacitor.isNativePlatform() || rememberMe) {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
  } else {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Access branding setters — BrandingProvider is mounted above us in App.jsx
  const { setBranding, clearBranding } = useContext(BrandingContext);

  useEffect(() => {
    const verifySession = async () => {
      const legacyToken = localStorage.getItem("token");
      const legacyUser = localStorage.getItem("user");
      const legacyRefresh = localStorage.getItem("refreshToken");
      
      if (!sessionStorage.getItem("token") && legacyToken) {
        sessionStorage.setItem("token", legacyToken);
        if (legacyUser) sessionStorage.setItem("user", legacyUser);
        if (legacyRefresh) sessionStorage.setItem("refreshToken", legacyRefresh);
        
        // We DO NOT remove from localStorage here anymore, because if it's there,
        // it means the user explicitly chose "Remember Me" (or is on Mobile),
        // and it should persist across multiple tabs/sessions.
      }

      const token = sessionStorage.getItem("token");
      if (!token) {
        setIsInitializing(false);
        return;
      }
      try {
        const { getProfile } = await import("../services/auth.service");
        const res = await getProfile();
        if (res.data && res.data.success) {
           const userData = res.data.user;

           // === LIFETIME BYPASS: Lifetime members NEVER expire ===
           const isLifetime = userData.is_lifetime_member ||
                              userData.Institute?.is_lifetime_member ||
                              false;

           let isExpired = false;
           if (!isLifetime) {
               const subEnd = userData.subscription_end || userData.Institute?.subscription_end;
               if (subEnd) {
                   const end = new Date(subEnd);
                   end.setHours(23, 59, 59, 999);
                   if (new Date() > end) isExpired = true;
               }
           }

           sessionStorage.setItem("isPlanExpired", isExpired ? "true" : "false");
           sessionStorage.setItem("isLifetimeMember", isLifetime ? "true" : "false");
           userData.isPlanExpired = isExpired;
           userData.is_lifetime_member = isLifetime;

           // ── Dynamic branding: update with fresh profile data ──
           setBranding(userData);

           setUser(userData);

           // ── Register FCM Token if available ──
           const fcmToken = getStoredPushToken();
           if (fcmToken && Capacitor.isNativePlatform()) {
               api.post('/notifications/device/register', {
                   fcm_token: fcmToken,
                   platform: Capacitor.getPlatform()
               }).catch(e => console.error("FCM Registration error:", e));
           }
        } else {
           logout();
        }
      } catch (err) {
        // ── Smart session handling on error ──────────────────────────────────
        // Auth errors (server responded with 401/403): clear session, force re-login.
        // Network errors (no server response): preserve cached session for offline use.
        // This distinction allows the app to work offline for returning users.
        if (err.response) {
          // Server responded with an error → credentials are invalid → clear session
          console.error("Session verification failed (auth error):", err.response?.status, err.message);
          logout();
        } else {
          // Network error (timeout, no connection, CORS on native, etc.)
          // Keep the cached user so offline navigation still works.
          console.warn("Session verification failed (network error) — keeping cached session:", err.message);
          const cachedUser = sessionStorage.getItem("user");
          if (cachedUser) {
            try {
              const parsedUser = JSON.parse(cachedUser);
              setBranding(parsedUser);
              setUser(parsedUser);
            } catch {
              // Corrupted cache — must re-login
              logout();
            }
          }
          // Don't call logout() — leave the session intact for offline use
        }
      } finally {
        setIsInitializing(false);
      }
    };
    
    verifySession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (data, rememberMe = false) => {
    const response = await loginUser(data);

    const { token, refreshToken, user } = response.data;

    // === LIFETIME BYPASS: Lifetime members NEVER expire ===
    const isLifetime = user.is_lifetime_member || false;

    let isExpired = false;
    if (!isLifetime && user.subscription_end) {
        const end = new Date(user.subscription_end);
        end.setHours(23, 59, 59, 999);
        if (new Date() > end) isExpired = true;
    }
    
    user.isPlanExpired = isExpired;
    user.is_lifetime_member = isLifetime;

    persistSession(token, user, rememberMe);
    sessionStorage.setItem("isPlanExpired", isExpired ? "true" : "false");
    sessionStorage.setItem("isLifetimeMember", isLifetime ? "true" : "false");
    
    if (Capacitor.isNativePlatform() || rememberMe) {
        localStorage.setItem("isPlanExpired", isExpired ? "true" : "false");
        localStorage.setItem("isLifetimeMember", isLifetime ? "true" : "false");
    }

    // ✅ Phase 7: Store refresh token for auto-refresh
    if (refreshToken) {
        sessionStorage.setItem("refreshToken", refreshToken);
        if (Capacitor.isNativePlatform() || rememberMe) {
            localStorage.setItem("refreshToken", refreshToken);
        }
    }

    // ── Dynamic branding: save institute branding after login ──
    setBranding(user);

    setUser(user);

    // ── Register FCM Token if available ──
    const fcmToken = getStoredPushToken();
    if (fcmToken && Capacitor.isNativePlatform()) {
        api.post('/notifications/device/register', {
            fcm_token: fcmToken,
            platform: Capacitor.getPlatform()
        }).catch(e => console.error("FCM Registration error:", e));
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("isPlanExpired");
    localStorage.removeItem("isLifetimeMember");
    sessionStorage.clear();

    // ── Dynamic branding: reset to ZF defaults on logout ──
    clearBranding();

    setUser(null);
  };

  const impersonate = (data) => {
    const { token, refreshToken, user } = data;
    
    // Save current superadmin session
    const currentToken = sessionStorage.getItem("token");
    const currentUser = sessionStorage.getItem("user");
    const currentRefresh = sessionStorage.getItem("refreshToken");
    
    if (currentToken) sessionStorage.setItem("superadmin_token", currentToken);
    if (currentUser) sessionStorage.setItem("superadmin_user", currentUser);
    if (currentRefresh) sessionStorage.setItem("superadmin_refreshToken", currentRefresh);

    // Set impersonated session
    const isLifetime = user.is_lifetime_member || false;
    let isExpired = false;
    if (!isLifetime && user.subscription_end) {
        const end = new Date(user.subscription_end);
        end.setHours(23, 59, 59, 999);
        if (new Date() > end) isExpired = true;
    }
    user.isPlanExpired = isExpired;
    user.is_lifetime_member = isLifetime;

    persistSession(token, user);
    sessionStorage.setItem("isPlanExpired", isExpired ? "true" : "false");
    sessionStorage.setItem("isLifetimeMember", isLifetime ? "true" : "false");
    if (refreshToken) sessionStorage.setItem("refreshToken", refreshToken);
    
    // Intentionally NOT calling setUser(user) to avoid React Router ProtectedRoute 
    // race conditions. The caller must use window.location.href to redirect and reload.
  };

  const stopImpersonating = () => {
    const saToken = sessionStorage.getItem("superadmin_token");
    const saUserStr = sessionStorage.getItem("superadmin_user");
    const saRefresh = sessionStorage.getItem("superadmin_refreshToken");
    
    if (saToken && saUserStr) {
      const saUser = JSON.parse(saUserStr);
      
      const isLifetime = saUser.is_lifetime_member || false;
      let isExpired = false;
      if (!isLifetime && saUser.subscription_end) {
          const end = new Date(saUser.subscription_end);
          end.setHours(23, 59, 59, 999);
          if (new Date() > end) isExpired = true;
      }
      saUser.isPlanExpired = isExpired;
      saUser.is_lifetime_member = isLifetime;

      persistSession(saToken, saUser);
      sessionStorage.setItem("isPlanExpired", isExpired ? "true" : "false");
      sessionStorage.setItem("isLifetimeMember", isLifetime ? "true" : "false");
      if (saRefresh) sessionStorage.setItem("refreshToken", saRefresh);
      
      sessionStorage.removeItem("superadmin_token");
      sessionStorage.removeItem("superadmin_user");
      sessionStorage.removeItem("superadmin_refreshToken");
      
      // Intentionally NOT calling setUser to avoid React Router race conditions.
      // The caller must use window.location.href to redirect and reload.
      return true;
    }
    return false;
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, impersonate, stopImpersonating, isInitializing }}>
      {children}
    </AuthContext.Provider>
  );
};
