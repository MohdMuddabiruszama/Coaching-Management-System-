const app = require("./app");
require("./utils/cron");
const { keepAlive } = require("./utils/keepAlive");

const PORT = process.env.PORT || 8080;
const HOST = "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
    console.log(`✅ Server running on http://${HOST}:${PORT}`);
    console.log(`📱 Mobile devices can reach backend at http://[IP_ADDRESS]:${PORT}/api`);
    keepAlive();
});

// ============================================================
// ✅ PHASE 1: PROCESS-LEVEL CRASH PREVENTION
// ============================================================
// For a multi-tenant SaaS, calling process.exit(1) immediately
// disconnects EVERY institute using the platform at that moment.
// Instead: log the error, alert if critical, and let the process
// continue (or let PM2/Render restart it gracefully).
// ============================================================

let { logger } = (() => {
    try { return require("./utils/logger"); }
    catch { return { logger: console }; }
})();

process.on("uncaughtException", (err, origin) => {
    logger.error("⚠️ UNCAUGHT EXCEPTION", {
        type: "uncaughtException",
        origin,
        message: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
    });
    // For truly unrecoverable errors, initiate graceful shutdown
    // Let PM2/Render restart the process — don't exit immediately
    // which would disconnect all active users
    if (process.env.NODE_ENV === "production") {
        gracefulShutdown("uncaughtException");
    } else {
        process.exit(1); // In dev, crash fast to surface bugs
    }
});

process.on("unhandledRejection", (reason, promise) => {
    logger.error("⚠️ UNHANDLED PROMISE REJECTION", {
        type: "unhandledRejection",
        message: reason?.message || String(reason),
        stack: reason?.stack,
        promise: String(promise),
        timestamp: new Date().toISOString(),
    });
    // Promise rejections are usually recoverable — log but don't exit
    // If the same error repeats, PM2 health checks will trigger a restart
});

process.on("warning", (warning) => {
    if (warning.name === "MaxListenersExceededWarning") {
        logger.warn?.("⚠️ Possible memory leak — too many listeners", {
            warning: warning.message,
        });
    }
});

// ── Graceful Shutdown ──────────────────────────────────────────────────────
// Allows in-flight requests to finish before the process exits.
// Used by PM2, Docker, and Render during deploys/restarts.
const gracefulShutdown = (signal) => {
    console.log(`\n🔄 Graceful shutdown triggered by: ${signal}`);
    server.close(() => {
        console.log("✅ HTTP server closed. Exiting process.");
        process.exit(0);
    });
    // Force exit after 10s if requests are still hanging
    setTimeout(() => {
        console.error("❌ Forced exit after 10s timeout");
        process.exit(1);
    }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM")); // Render/Docker stop
process.on("SIGINT",  () => gracefulShutdown("SIGINT"));  // Ctrl+C in dev


