import { createContext, useState, useEffect, useContext } from "react";
import { loginUser } from "../services/auth.service";
import { BrandingContext } from "./BrandingContext";

export const AuthContext = createContext();

const persistSession = (token, user) => {
  sessionStorage.setItem("token", token);
  sessionStorage.setItem("user", JSON.stringify(user));
  localStorage.removeItem("token");
  localStorage.removeItem("user");
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
      if (!sessionStorage.getItem("token") && legacyToken) {
        sessionStorage.setItem("token", legacyToken);
        if (legacyUser) sessionStorage.setItem("user", legacyUser);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
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
        } else {
           logout();
        }
      } catch (err) {
        console.error("Session verification failed:", err.message);
        logout();
      } finally {
        setIsInitializing(false);
      }
    };
    
    verifySession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (data) => {
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

    persistSession(token, user);
    sessionStorage.setItem("isPlanExpired", isExpired ? "true" : "false");
    sessionStorage.setItem("isLifetimeMember", isLifetime ? "true" : "false");
    // ✅ Phase 7: Store refresh token for auto-refresh
    if (refreshToken) {
        sessionStorage.setItem("refreshToken", refreshToken);
    }

    // ── Dynamic branding: save institute branding after login ──
    setBranding(user);

    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.clear();

    // ── Dynamic branding: reset to ZF defaults on logout ──
    clearBranding();

    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, isInitializing }}>
      {children}
    </AuthContext.Provider>
  );
};
