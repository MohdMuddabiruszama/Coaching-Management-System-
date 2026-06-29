import axios from "axios";
import { Capacitor } from "@capacitor/core";

/**
 * Resolve API Base URL
 * ────────────────────
 * Priority:
 *  1. VITE_API_URL from environment (most reliable — set in .env.mobile.student)
 *  2. Production fallback for native (Capacitor) builds
 *  3. localhost:5000 for web dev only
 *
 * NOTE: On Android, 'localhost' refers to the DEVICE, not the host PC.
 * Use 10.0.2.2 (AVD emulator) or your LAN IP for local dev on native.
 */
const getBaseURL = () => {
    // 0. Highest Priority: Runtime override (set via Login page easter egg)
    const storedURL = localStorage.getItem('API_BASE_URL_OVERRIDE');
    if (storedURL && storedURL.trim() !== '') {
        console.info(`🔧 Using API override from local storage: ${storedURL}`);
        return storedURL;
    }

    let baseURL = import.meta.env.VITE_API_URL;

    // Remove trailing slash if present
    if (baseURL) {
        baseURL = baseURL.replace(/\/$/, "");
        // Safeguard: Ensure baseURL always ends with /api
        if (!baseURL.endsWith("/api")) {
            console.warn(`⚠️ VITE_API_URL (${baseURL}) is missing /api. Auto-appending it.`);
            baseURL += "/api";
        }
        return baseURL;
    }

    console.warn("⚠️ VITE_API_URL is not defined — using smart fallback");

    // Development Environment Fallbacks
    if (import.meta.env.DEV) {
        const hostname = window.location.hostname;
        
        // If accessed via LAN IP (e.g. 192.168.x.x)
        if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '') {
            return `http://${hostname}:5000/api`;
        }

        // Native app local dev
        if (Capacitor.isNativePlatform()) {
            console.info("📱 Native dev platform detected");
            // Android emulator accesses host PC via 10.0.2.2
            return Capacitor.getPlatform() === 'android' ? "http://10.0.2.2:5000/api" : "http://localhost:5000/api";
        }

        // Browser local dev
        return "http://localhost:5000/api";
    }

    // Default Production API (Native Builds and Web)
    return "https://institutes-saas.onrender.com/api";
};

/**
 * Axios Instance
 *
 * Performance notes (mobile):
 *  - withCredentials=false on native: JWT is in Bearer header; cookies unused.
 *    Disabling avoids CORS preflight (OPTIONS) before every API call,
 *    cutting ~50% of HTTP round-trips on Capacitor.
 *  - timeout: 15 s — generous enough for Render cold starts, fast enough
 *    to give users a recoverable error instead of an infinite spinner.
 */
const api = axios.create({
    baseURL: getBaseURL(),
    timeout: 15000, // 15 s — fail fast on slow/dead connections
    headers: {
        "Content-Type": "application/json",
    },
    // On native Capacitor auth is Bearer-token only; withCredentials causes
    // unnecessary CORS preflight (OPTIONS) requests — skip it on native.
    withCredentials: !Capacitor.isNativePlatform(),
});

/**
 * 🔐 Request Interceptor (Attach Token + Timing)
 */
api.interceptors.request.use(
    (config) => {
        // Track request start time for slow API detection
        config.metadata = { startTime: Date.now() };

        try {
            const token = sessionStorage.getItem("token");

            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            
            // Check for plan expiration blocking mutating requests locally
            const isPlanExpired = sessionStorage.getItem("isPlanExpired") === "true";
            // === LIFETIME BYPASS: Lifetime members are never blocked ===
            const isLifetimeMember = sessionStorage.getItem("isLifetimeMember") === "true";
            if (isPlanExpired && !isLifetimeMember && config.method && config.method.toUpperCase() !== 'GET') {
                const url = config.url || '';
                // Whitelist routes that shouldn't be blocked even if expired (e.g. auth, upgrade)
                const isWhitelisted = url.includes('/auth/') || url.includes('/login') || url.includes('/checkout') || url.includes('/verify') || url.includes('/payment');
                
                if (!isWhitelisted) {
                    throw { customName: "PLAN_EXPIRED_READONLY", message: "Action blocked: Plan is expired. Please upgrade." };
                }
            }

        } catch (err) {
            if (err.customName === "PLAN_EXPIRED_READONLY") {
                return Promise.reject(err);
            }
            console.warn("⚠️ Token access error:", err.message);
        }

        return config;
    },
    (error) => Promise.reject(error)
);

/**
 * ⚠️ Response Interceptor (Centralized Error Handling + Timing)
 */
api.interceptors.response.use(
    (response) => {
        // ── Slow API detection ──────────────────────────────────────────────
        const duration = response.config?.metadata
            ? Date.now() - response.config.metadata.startTime
            : null;

        if (duration !== null) {
            if (duration > 10000) {
                console.error(`🐢 [VERY SLOW API] ${response.config.url}: ${duration}ms`);
            } else if (duration > 3000) {
                console.warn(`⚠️ [SLOW API] ${response.config.url}: ${duration}ms`);
            }
        }
        return response;
    },
    async (error) => {
        // Handle client-side rejected requests (Plan Expired Read-only)
        if (error.customName === "PLAN_EXPIRED_READONLY") {
            import("react-hot-toast").then((module) => {
                const toast = module.default || module.toast;
                toast.error("Account in Read-Only Mode. Please upgrade your plan to perform actions.", { id: "plan_expired" });
            });
            return Promise.reject(error);
        }
        
        const { response, config } = error;

        // 🌐 Network error (Server Unreachable)
        if (!response) {
            console.error("🚫 Network error:", error.message);

            // ── Gate: Only show "Platform Unreachable" when the user IS logged in.
            // On a fresh install or after logout, there's no session — the error
            // is expected (no profile to fetch) and must NOT block the login screen.
            // This was the root cause of the permanent "Platform Unreachable" loop.
            const hasSession = Boolean(sessionStorage.getItem("token"));
            if (hasSession) {
                window.dispatchEvent(new Event('offline_api_error'));
            }

            return Promise.reject(error);
        }

        const status = response.status;
        const data = response.data;

        // ✅ Phase 7: Auto-refresh on TOKEN_EXPIRED
        if (status === 401 && data?.code === "TOKEN_EXPIRED" && !config._retry) {
            config._retry = true; // Prevent infinite retry loops

            const refreshToken = sessionStorage.getItem("refreshToken");
            if (refreshToken) {
                try {
                    const refreshResponse = await axios.post(
                        `${getBaseURL()}/auth/refresh`,
                        { refreshToken },
                        { headers: { "Content-Type": "application/json" } }
                    );

                    if (refreshResponse.data?.success && refreshResponse.data?.token) {
                        const newToken = refreshResponse.data.token;
                        sessionStorage.setItem("token", newToken);

                        // Retry the original request with the new token
                        config.headers.Authorization = `Bearer ${newToken}`;
                        return api(config);
                    }
                } catch (refreshError) {
                    console.warn("🔑 Token refresh failed — logging out.");
                    sessionStorage.clear();
                    window.dispatchEvent(new CustomEvent('app_navigate', { detail: { path: '/login', clearSession: true } }));
                    return Promise.reject(refreshError);
                }
            }
        }

        // 🛑 Backend/Database Down (5xx Errors)
        if (status >= 500) {
            console.error(`🛑 Server Error ${status}:`, data);
            window.dispatchEvent(new Event('offline_api_error'));
        }

        try {
            // 💳 Payment Required
            if (status === 402 && !window.location.pathname.includes("/checkout")) {
                window.dispatchEvent(new CustomEvent('app_navigate', { detail: { path: '/checkout' } }));
            }

            // ⏳ Subscription Expired
            if (status === 403 && data?.code === "SUBSCRIPTION_EXPIRED") {
                window.dispatchEvent(new CustomEvent('app_navigate', { detail: { path: '/renew-plan' } }));
            }

            // ⚠️ Suspended Institute Account
            if (status === 403 && data?.code === "INSTITUTE_SUSPENDED") {
                sessionStorage.clear();
                window.dispatchEvent(new CustomEvent('app_navigate', { detail: { path: '/suspended', clearSession: true } }));
                return Promise.reject(error);
            }

            // 🚫 Account Blocked
            if (status === 403 && data?.code === "ACCOUNT_BLOCKED") {
                handleBlockedAccount();
            }

            // 🔑 Unauthorized (not TOKEN_EXPIRED) — hard logout
            if (status === 401 && data?.code !== "TOKEN_EXPIRED" && window.location.pathname !== "/login") {
                sessionStorage.clear();
                window.dispatchEvent(new CustomEvent('app_navigate', { detail: { path: '/login', clearSession: true } }));
            }

        } catch (err) {
            console.error("⚠️ Error handling failed:", err.message);
        }

        return Promise.reject(error);
    }
);

/**
 * 🚫 Handle Blocked Account Logic (Capacitor-safe — uses app_navigate events)
 */
function handleBlockedAccount() {
    try {
        const storedUser = sessionStorage.getItem("user");

        if (!storedUser) {
            sessionStorage.clear();
            window.dispatchEvent(new CustomEvent('app_navigate', { detail: { path: '/login', clearSession: true } }));
            return;
        }

        const user = JSON.parse(storedUser);

        // Student / Parent — show toast then redirect to login
        if (user.role === "student" || user.role === "parent") {
            // Use react-hot-toast instead of alert() (works in WebView)
            import("react-hot-toast").then((module) => {
                const toast = module.default || module.toast;
                toast.error("Your account has been blocked. Contact your administrator.", { duration: 5000, id: "account_blocked" });
            });
            sessionStorage.clear();
            window.dispatchEvent(new CustomEvent('app_navigate', { detail: { path: '/login', clearSession: true } }));
            return;
        }

        // Admin / Manager — mark as blocked in session + navigate to dashboard
        if (user.status !== "blocked") {
            user.status = "blocked";
            sessionStorage.setItem("user", JSON.stringify(user));
        }

        if (!window.location.pathname.includes("/admin/dashboard")) {
            window.dispatchEvent(new CustomEvent('app_navigate', { detail: { path: '/admin/dashboard' } }));
        }

    } catch (err) {
        console.error("⚠️ Blocked account handling error:", err.message);
        sessionStorage.clear();
        window.dispatchEvent(new CustomEvent('app_navigate', { detail: { path: '/login', clearSession: true } }));
    }
}


export default api;