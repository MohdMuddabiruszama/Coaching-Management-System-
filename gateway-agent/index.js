const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ZKLib = require('./local-zklib');

// When compiled with pkg, we want to read the config next to the .exe, not inside it
const CONFIG_PATH = path.join(process.cwd(), 'config.json');

function fatalError(msg) {
    if (msg) console.error(msg);
    console.log("\nPress any key to exit...");
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', () => process.exit(1));
}

// Helper to read config
function readConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            return fatalError("❌ config.json not found. Please create it next to the executable.");
        }
        const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        return fatalError("❌ Error reading config.json: " + err.message);
    }
}

// Helper to save config (update last_sync)
function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    } catch (err) {
        console.error("❌ Error saving config.json:", err.message);
    }
}

// Main Agent Loop
async function runAgent() {
    console.log("=========================================");
    console.log("   ZenithFlows Biometric Gateway Agent");
    console.log("=========================================");

    let config = readConfig();

    if (!config.device_token || config.device_token === "YOUR_DEVICE_TOKEN_HERE") {
        return fatalError("❌ Please set 'device_token' in config.json.");
    }

    // ─── Windows IPv6 fix ──────────────────────────────────────────────────────
    // Node.js 18+ on Windows resolves 'localhost' to ::1 (IPv6) by default.
    // Most dev servers only listen on 127.0.0.1 (IPv4), so the connection fails
    // with ECONNREFUSED. We rewrite 'localhost' → '127.0.0.1' silently.
    const resolvedApiUrl = config.api_url.replace(/localhost/gi, '127.0.0.1');
    if (resolvedApiUrl !== config.api_url) {
        console.log(`⚠️  'localhost' detected in api_url — using 127.0.0.1 to avoid Windows IPv6 issue.`);
    }

    const api = axios.create({
        baseURL: resolvedApiUrl,
        headers: { 'x-device-token': config.device_token },
        timeout: 10000
    });

    console.log(`📡 Connecting to ZenithFlows API at ${resolvedApiUrl}...`);


    // 1. Fetch remote config from API
    let remoteConfig;
    try {
        const res = await api.get(`/api/biometric/gateway/config/${config.device_token}`);
        if (!res.data.success) throw new Error("Invalid response from API");
        remoteConfig = res.data.data;
        console.log(`✅ Authenticated as device: ${remoteConfig.device_name}`);
        console.log(`🔌 Target IP: ${remoteConfig.ip_address}:${remoteConfig.port}`);
    } catch (err) {
        console.error("❌ Failed to fetch device config from API:", err.response?.data || err.message);
        console.log("⏳ Retrying in 30 seconds...");
        setTimeout(runAgent, 30000);
        return;
    }

    if (remoteConfig.connection_type !== 'tcp_ip_lan') {
        return fatalError(`❌ Device connection type is ${remoteConfig.connection_type}. This agent is only for 'tcp_ip_lan' devices.`);
    }

    const intervalSeconds = config.poll_interval_seconds || 30;
    console.log(`⏱️  Starting poll loop every ${intervalSeconds} seconds.`);

    let pollFailCount = 0;

    const pollDevice = async () => {
        // Re-read config in case last_sync changed
        config = readConfig();

        const port = Number(remoteConfig.port) || 4370;

        // ─── ZKLib TCP Connection ──────────────────────────────────────────────
        // Constructor: ZKLib(ip, port, timeout_ms, inport)
        //   - timeout: 20s (increased from 10s for slow Wi-Fi devices)
        //   - inport:  For TCP mode this MUST match the device port (4370).
        //              Using 5200 (the UDP inport) causes TIMEOUT_ON_WRITING_MESSAGE
        //              because the library signals UDP mode to a TCP-only device.
        const zkInstance = new ZKLib(
            remoteConfig.ip_address,
            port,
            20000,   // 20s timeout — ZKTeco Wi-Fi can be slow to respond
            port     // inport = same as port for TCP devices (NOT 5200)
        );

        try {
            // Send heartbeat (fire-and-forget)
            api.post('/api/biometric/gateway/heartbeat', {
                agent_version: "1.0.0",
                uptime: process.uptime()
            }).catch(() => { });

            console.log(`[${new Date().toISOString()}] 🔌 Connecting to device at ${remoteConfig.ip_address}:${port}...`);

            await zkInstance.createSocket();
            pollFailCount = 0; // Reset fail count on successful connection

            // Get attendances
            const attendances = await zkInstance.getAttendances();
            if (!attendances || !attendances.data || attendances.data.length === 0) {
                console.log("   ℹ️  No attendance records found on device.");
                return;
            }

            // Filter new punches since last sync
            const lastSync = new Date(config.last_sync || 0);
            const newPunches = attendances.data.filter(record => {
                return new Date(record.recordTime) > lastSync;
            });

            if (newPunches.length === 0) {
                console.log(`   ✅ No new punches since ${config.last_sync || 'beginning'}.`);
                return;
            }

            console.log(`   📋 Found ${newPunches.length} new punches. Uploading...`);

            // Format for API
            const payload = {
                punches: newPunches.map(p => ({
                    pin: String(p.deviceUserId),
                    punch_time: p.recordTime,
                    punch_type: p.punchType || 'in',
                }))
            };

            // Post to API
            const res = await api.post('/api/biometric/gateway/punch', payload);
            if (res.data.success) {
                console.log(`   ✅ Upload successful! Accepted: ${res.data.accepted}, Skipped: ${res.data.skipped}`);

                // Update last sync to the latest punch time in this batch
                const latestPunchTime = newPunches.reduce((latest, current) => {
                    const currentTime = new Date(current.recordTime);
                    return currentTime > latest ? currentTime : latest;
                }, lastSync);

                config.last_sync = latestPunchTime.toISOString();
                saveConfig(config);
            }
        } catch (err) {
            pollFailCount++;
            const errMsg = err.message || String(err);
            if (errMsg.includes('TIMEOUT') || errMsg.includes('ECONNREFUSED') || errMsg.includes('ECONNRESET')) {
                console.error(`   ❌ Device unreachable (attempt ${pollFailCount}): ${errMsg}`);
                console.error(`      → Check: Is the device powered on and connected to Wi-Fi (${remoteConfig.ip_address})?`);
                console.error(`      → Check: Is TCP port ${port} open on the device? (Menu → Comm → Port = 4370)`);
            } else {
                console.error(`   ❌ Polling error (attempt ${pollFailCount}):`, errMsg);
            }
        } finally {
            try {
                await zkInstance.disconnect();
            } catch (e) {
                // Ignore disconnect errors — device may have already closed connection
            }

            // Schedule next poll
            setTimeout(pollDevice, intervalSeconds * 1000);
        }
    };

    // Start first poll
    pollDevice();
}

// Start
runAgent().catch(err => console.error("Fatal Agent Error:", err));
