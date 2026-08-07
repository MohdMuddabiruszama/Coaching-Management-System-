/**
 * ✅ Phase 1.5: Keep-Alive Utility
 * Pings the backend every 14 minutes in production to prevent Render free tier sleep.
 * Impact: Eliminates cold starts (~50 second startup delay).
 */

const axios = require("axios");

const BACKEND_URL =
    process.env.BACKEND_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    "https://zf-solution-backend.onrender.com";

let pingInterval = null;

const keepAlive = () => {
    if (process.env.NODE_ENV !== "production") {
        // Keep-alive disabled
        return;
    }

    if (pingInterval) {
        clearInterval(pingInterval);
    }

    // Keep-alive started

    pingInterval = setInterval(async () => {
        try {
            const response = await axios.get(`${BACKEND_URL}/`, {
                timeout: 10000,
                headers: { "User-Agent": "KeepAlive/1.0" },
            });
            console.log(`🏓 Keep-alive ping OK [${response.status}] @ ${new Date().toISOString()}`);
        } catch (error) {
            console.warn("⚠️  Keep-alive ping failed:", error.message);
        }
    }, 14 * 60 * 1000); // 14 minutes
};

const stopKeepAlive = () => {
    if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
        // Keep-alive stopped
    }
};

module.exports = { keepAlive, stopKeepAlive };
