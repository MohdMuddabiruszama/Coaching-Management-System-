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
    return "https://api.zenithflows.in/api";
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
    timeout: 30000, // 30 s — accommodates remote database latency and heavy queries
    headers: {
        "Content-Type": "application/json",
    },
    // On native Capacitor auth is Bearer-token only; withCredentials causes
    // unnecessary CORS preflight (OPTIONS) requests — skip it on native.
    withCredentials: !Capacitor.isNativePlatform(),
});

/**
 * 🔑 Token Storage & Lifecycle Utilities
 */
const getActiveToken = () => sessionStorage.getItem("token") || localStorage.getItem("token");
const getActiveRefreshToken = () => sessionStorage.getItem("refreshToken") || localStorage.getItem("refreshToken");

const updateStoredTokens = (newToken) => {
    sessionStorage.setItem("token", newToken);
    if (localStorage.getItem("token") && !sessionStorage.getItem("original_session_token")) {
        localStorage.setItem("token", newToken);
    }
};

const clearStoredTokens = () => {
    sessionStorage.clear();
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
};

/**
 * Check if a JWT is expiring within thresholdSeconds
 */
const isTokenExpiringSoon = (token, thresholdSeconds = 90) => {
    if (!token) return false;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return false;
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (!payload.exp) return false;
        return (payload.exp * 1000) - Date.now() < (thresholdSeconds * 1000);
    } catch {
        return false;
    }
};

// ── Refresh Concurrency Mutex & Queue ──
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

const executeTokenRefresh = async () => {
    const refreshToken = getActiveRefreshToken();
    if (!refreshToken) {
        throw new Error("No refresh token available");
    }

    const refreshResponse = await axios.post(
        `${getBaseURL()}/auth/refresh`,
        { refreshToken },
        { headers: { "Content-Type": "application/json" } }
    );

    if (refreshResponse.data?.success && refreshResponse.data?.token) {
        const newToken = refreshResponse.data.token;
        updateStoredTokens(newToken);
        return newToken;
    } else {
        throw new Error(refreshResponse.data?.message || "Token refresh failed");
    }
};

/**
 * 🔐 Request Interceptor (Attach Token + Timing + Proactive Refresh)
 */
api.interceptors.request.use(
    async (config) => {
        // Track request start time for slow API detection
        config.metadata = { startTime: Date.now() };

        try {
            let token = getActiveToken();

            // Skip proactive refresh for auth/refresh endpoints
            const url = config.url || '';
            const isAuthRoute = (
                url.includes("/auth/login") ||
                url.includes("/auth/refresh") ||
                url.includes("/auth/forgot-password") ||
                url.includes("/auth/reset-password") ||
                url.includes("/auth/register")
            );

            // Proactive Refresh: If token is expiring within 90s, refresh before sending
            if (token && !isAuthRoute && isTokenExpiringSoon(token, 90)) {
                if (!isRefreshing) {
                    isRefreshing = true;
                    try {
                        const newToken = await executeTokenRefresh();
                        token = newToken;
                        processQueue(null, newToken);
                    } catch (refreshErr) {
                        processQueue(refreshErr, null);
                    } finally {
                        isRefreshing = false;
                    }
                } else {
                    try {
                        token = await new Promise((resolve, reject) => {
                            failedQueue.push({ resolve, reject });
                        });
                    } catch {
                        // Fall back to current token
                    }
                }
            }

            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            
            // Check for plan expiration blocking mutating requests locally
            const isPlanExpired = sessionStorage.getItem("isPlanExpired") === "true";
            // === LIFETIME BYPASS: Lifetime members are never blocked ===
            const isLifetimeMember = sessionStorage.getItem("isLifetimeMember") === "true";
            if (isPlanExpired && !isLifetimeMember && config.method && config.method.toUpperCase() !== 'GET') {
                const isWhitelisted = url.includes('/auth/') || url.includes('/login') || url.includes('/checkout') || url.includes('/verify') || url.includes('/payment');
                
                if (!isWhitelisted) {
                    throw { customName: "PLAN_EXPIRED_READONLY", message: "Action blocked: Plan is expired. Please upgrade." };
                }
            }

            // ── Smart Adaptive Timeout by Workload ──
            if (!config.timeout || config.timeout === 30000 || config.timeout === 15000) {
                const reqUrl = config.url || '';
                const params = config.params || {};
                const isExport = params.export || reqUrl.includes('export') || reqUrl.includes('download');
                const hasLargeLimit = params.limit && Number(params.limit) >= 500;
                const isHeavyRoute = (
                    reqUrl.includes('/fees/student-fees') ||
                    reqUrl.includes('/fees/payments') ||
                    reqUrl.includes('/reports') ||
                    reqUrl.includes('/finance-analytics') ||
                    reqUrl.includes('/students/export') ||
                    reqUrl.includes('/attendance/bulk')
                );

                if (isExport) {
                    config.timeout = 90000; // 90s for document/PDF/CSV exports
                } else if (isHeavyRoute || hasLargeLimit) {
                    config.timeout = 60000; // 60s for multi-table calculations and 500+ records
                } else {
                    config.timeout = 20000; // 20s standard responsive timeout
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

        // 🌐 Network / Timeout error handling
        if (!response) {
            console.error("🚫 Network/Timeout error:", error.message);

            const isTimeout = (
                error.code === "ECONNABORTED" ||
                (error.message && error.message.toLowerCase().includes("timeout"))
            );

            // Case 1: Request Timeout due to large data or slow network
            if (isTimeout) {
                // NEVER declare the platform dead on timeout!
                import("react-hot-toast").then((module) => {
                    const toast = module.default || module.toast;
                    toast.error(
                        "The server is processing a large volume of data. Please wait a moment or refine your search filters.",
                        { id: "api_timeout_notice", duration: 6000 }
                    );
                });
                return Promise.reject(error);
            }

            // Case 2: Browser is truly offline
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                // NetworkStatus.jsx already shows the "No Internet Connection" banner
                return Promise.reject(error);
            }

            // Case 3: Potential Server Down -> Verify via fast silent health-check gate!
            const hasSession = Boolean(getActiveToken());
            if (hasSession) {
                try {
                    const baseURL = getBaseURL();
                    const healthURL = `${baseURL.replace(/\/api$/, "")}/api/health`;

                    fetch(healthURL, { method: 'GET', cache: 'no-store' })
                        .then((healthRes) => {
                            if (!healthRes.ok) {
                                window.dispatchEvent(new Event('offline_api_error'));
                            } else {
                                // Server is alive! Just a transient network glitch on this single call
                                import("react-hot-toast").then((module) => {
                                    const toast = module.default || module.toast;
                                    toast.error("Transient network glitch. Please retry your action.", { id: "transient_network_glitch" });
                                });
                            }
                        })
                        .catch(() => {
                            // Health check actually failed: backend is truly down!
                            window.dispatchEvent(new Event('offline_api_error'));
                        });
                } catch {
                    window.dispatchEvent(new Event('offline_api_error'));
                }
            }

            return Promise.reject(error);
        }

        const status = response.status;
        const data = response.data;
        const errorCode = data?.code || data?.errors?.code;
        const errorMessage = (data?.message || data?.errors?.message || "").toLowerCase();
        const isTokenExpired = errorCode === "TOKEN_EXPIRED" || errorMessage.includes("token expired");

        // ✅ Robust Token Refresh on 401 TOKEN_EXPIRED with Mutex & Queue
        if (status === 401 && isTokenExpired && !config._retry) {
            if (isRefreshing) {
                // Another request is already refreshing the token — queue this request
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then((newToken) => {
                        config._retry = true;
                        config.headers.Authorization = `Bearer ${newToken}`;
                        return api(config);
                    })
                    .catch((err) => Promise.reject(err));
            }

            config._retry = true;
            isRefreshing = true;

            return new Promise(async (resolve, reject) => {
                try {
                    const newToken = await executeTokenRefresh();
                    processQueue(null, newToken);
                    config.headers.Authorization = `Bearer ${newToken}`;
                    resolve(api(config));
                } catch (refreshError) {
                    processQueue(refreshError, null);
                    console.warn("🔑 Token refresh failed — logging out:", refreshError.message);
                    clearStoredTokens();
                    window.dispatchEvent(new CustomEvent('app_navigate', { detail: { path: '/login', clearSession: true } }));
                    reject(refreshError);
                } finally {
                    isRefreshing = false;
                }
            });
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
            if (status === 403 && (data?.code === "SUBSCRIPTION_EXPIRED" || data?.errors?.code === "SUBSCRIPTION_EXPIRED")) {
                window.dispatchEvent(new CustomEvent('app_navigate', { detail: { path: '/renew-plan' } }));
            }

            // ⚠️ Suspended Institute Account
            if (status === 403 && (data?.code === "INSTITUTE_SUSPENDED" || data?.errors?.code === "INSTITUTE_SUSPENDED")) {
                clearStoredTokens();
                window.dispatchEvent(new CustomEvent('app_navigate', { detail: { path: '/suspended', clearSession: true } }));
                return Promise.reject(error);
            }

            // 🚫 Account Blocked
            if (status === 403 && (data?.code === "ACCOUNT_BLOCKED" || data?.errors?.code === "ACCOUNT_BLOCKED")) {
                handleBlockedAccount();
            }

            // 🔑 Unauthorized (not TOKEN_EXPIRED and not the refresh endpoint itself) — hard logout
            if (status === 401 && !isTokenExpired && !config.url?.includes("/auth/refresh") && window.location.pathname !== "/login") {
                clearStoredTokens();
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


export { getBaseURL };
export default api;