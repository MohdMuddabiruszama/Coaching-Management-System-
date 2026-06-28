/**
 * PM2 Ecosystem Configuration
 * ─────────────────────────────────────────────────────────────────────────────
 * ✅ PHASE 3: Controlled Restart Strategy
 *
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 save && pm2 startup
 *
 * Why cluster mode with 2 instances?
 *   If one instance crashes, PM2 instantly restarts JUST that instance.
 *   The other instance keeps serving all institutes without visible downtime.
 *   This is the real-world answer to "never goes down" for a multi-tenant SaaS.
 *
 * NOTE: On Render/Railway, this config is for local/VPS deployments.
 * Those platforms have built-in restart mechanisms. On Render, set
 * the start command to: node server.js (single instance is fine with Render's
 * zero-downtime deploy and health checks).
 * ─────────────────────────────────────────────────────────────────────────────
 */

module.exports = {
    apps: [
        {
            name:              "zenithflows-api",
            script:            "./server.js",
            cwd:               __dirname,

            // Cluster mode: spawn 2 workers, sharing the same port via IPC
            // If you have 4+ CPU cores, increase to "max" or 4
            instances:         process.env.PM2_INSTANCES || 2,
            exec_mode:         "cluster",

            // Memory threshold: restart an instance if it exceeds 500MB
            // (catches memory leaks before they cause OOM crashes)
            max_memory_restart: process.env.PM2_MAX_MEMORY || "500M",

            // Restart behavior
            autorestart:       true,
            max_restarts:      10,      // After 10 restarts in min_uptime window, mark as errored
            min_uptime:        "30s",   // Must stay up 30s to count as "started successfully"
            restart_delay:     2000,    // Wait 2s between restart attempts (avoids crash loops)

            // Don't restart if stopped manually (pm2 stop)
            stop_exit_codes:   [0],

            // Log configuration
            out_file:          "./logs/pm2-out.log",
            error_file:        "./logs/pm2-error.log",
            log_date_format:   "YYYY-MM-DD HH:mm:ss",
            merge_logs:        true,

            // Environment variables per environment
            env: {
                NODE_ENV:  "development",
                PORT:      "5000",
            },
            env_production: {
                NODE_ENV:  "production",
                PORT:      "8080",
                // PM2_INSTANCES and PM2_MAX_MEMORY should be set in Render/server env
            },

            // ── Watch (dev only — disabled in production) ──────────────────
            watch:             false,

            // ── Zero-downtime reload ────────────────────────────────────────
            // Use: pm2 reload zenithflows-api
            // This replaces instances one-by-one without dropping connections
            kill_timeout:      5000,    // 5s to finish in-flight requests before SIGKILL
            listen_timeout:    3000,    // 3s for new instance to start listening
        },
    ],
};
