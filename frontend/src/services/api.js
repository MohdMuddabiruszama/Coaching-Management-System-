import axios from "axios";

/**
 * Resolve API Base URL (Production-ready)
 */
const getBaseURL = () => {
    let baseURL = import.meta.env.VITE_API_URL;

    // Remove trailing slash if present
    if (baseURL) {
        baseURL = baseURL.replace(/\/$/, "");
    }

    if (!baseURL || !baseURL.trim()) {
        console.warn("⚠️ VITE_API_URL is not defined in environment variables");

        if (import.meta.env.DEV) {
            // Development fallback
            return "http://localhost:5000/api";
        } else {
            // Production fallback - Points to the correct Render backend
            return "https://institutes-saas.onrender.com/api";
        }
    }

    return baseURL;
};

/**
 * Axios Instance
 */
const api = axios.create({
    baseURL: getBaseURL(),
    headers: {
        "Content-Type": "application/json",
    },
    withCredentials: true, // useful for cookies (optional)
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
            if (isPlanExpired && config.method && config.method.toUpperCase() !== 'GET') {
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
    (error) => {
        // Handle client-side rejected requests (Plan Expired Read-only)
        if (error.customName === "PLAN_EXPIRED_READONLY") {
            import("react-hot-toast").then((module) => {
                const toast = module.default || module.toast;
                toast.error("Account in Read-Only Mode. Please upgrade your plan to perform actions.", { id: "plan_expired" });
            });
            return Promise.reject(error);
        }
        
        const { response } = error;

        // 🌐 Network error (Server Unreachable)
        if (!response) {
            console.error("🚫 Network error:", error.message);
            window.dispatchEvent(new Event('offline_api_error'));
            return Promise.reject(error);
        }

        const status = response.status;
        const data = response.data;

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

            // 🔑 Unauthorized — dispatch event instead of hard redirect
            if (status === 401 && window.location.pathname !== "/login") {
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
 * 🚫 Handle Blocked Account Logic (Clean Separation)
 */
function handleBlockedAccount() {
    try {
        const storedUser = sessionStorage.getItem("user");

        if (!storedUser) {
            sessionStorage.clear();
            window.location.href = "/login";
            return;
        }

        const user = JSON.parse(storedUser);

        // Student / Parent
        if (user.role === "student" || user.role === "parent") {
            alert("Your account has been blocked. Contact administrator.");
            sessionStorage.clear();
            window.location.href = "/login";
            return;
        }

        // Admin / Manager
        if (user.status !== "blocked") {
            user.status = "blocked";
            sessionStorage.setItem("user", JSON.stringify(user));
        }

        if (!window.location.pathname.includes("/admin/dashboard")) {
            window.location.href = "/admin/dashboard";
        }

    } catch (err) {
        console.error("⚠️ Blocked account handling error:", err.message);
        sessionStorage.clear();
        window.location.href = "/login";
    }
}

export default api;