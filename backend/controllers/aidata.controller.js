/**
 * Biomax AI Push Protocol Controller
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles the proprietary "AIData" push protocol used by Biomax N-series
 * devices (N300/N-MULTIBIO300, N-WL20, BM300W, N-E90 Pro, etc.)
 *
 * Device sends to:
 *   GET  /AIData.aspx?SN=xxx&options=all&pushver=2.0.1   → Handshake
 *   POST /AIData.aspx?SN=xxx&table=ATTLOG&Stamp=9999     → Attendance Push
 *   GET  /getrequest.aspx?SN=xxx                         → Command Poll
 *   POST /devicecmd.aspx?SN=xxx                          → Command Result
 *
 * Data format (tab-separated, one record per line):
 *   PIN\tDateTime\tStatus\tVerify\tWorkCode\r\n
 *   e.g. "1\t2026-08-20 10:30:45\t0\t1\t0\r\n"
 *
 * Status codes: 0=Check-In, 1=Check-Out, 4=OT-In, 5=OT-Out
 * Verify codes: 1=Fingerprint, 4=Face, 15=RFID Card, 20=Password
 */

const { BiometricDevice, BiometricPunch } = require("../models");
const { processPunch } = require("./biometric.controller");
const { Op } = require("sequelize");

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Map Biomax verify code → human-readable method
 */
function resolveVerifyMethod(verifyCode) {
    const code = parseInt(verifyCode, 10);
    if (code === 4)  return "face";
    if (code === 15) return "rfid";
    if (code === 1 || code === 3) return "fingerprint";
    return "fingerprint"; // default
}

/**
 * Map Biomax status code → punch type
 * 0=Check-In, 1=Check-Out, 4=OT-In, 5=OT-Out
 */
function resolvePunchType(statusCode) {
    const code = parseInt(statusCode, 10);
    if (code === 1 || code === 5) return "out";
    return "in";
}

/**
 * Find a registered, active/pending device by serial number.
 * Returns null if not found — caller must handle.
 */
async function findDevice(sn) {
    if (!sn) return null;
    return BiometricDevice.findOne({
        where: {
            device_serial: sn,
            status: { [Op.in]: ["active", "pending"] }
        }
    });
}

// ─── Handshake — GET /AIData.aspx ────────────────────────────────────────────

/**
 * Device handshake: device sends this on boot/reconnect.
 * We respond with the ADMS-compatible "GET OPTION FROM" header.
 * If the device is pending, we activate it.
 */
exports.handshake = async (req, res) => {
    try {
        const sn = req.query.SN || req.query.sn;
        console.log(`[AIData] Handshake from SN=${sn}`);

        if (!sn) {
            return res.status(200).type("text/plain").send("ERROR: NO SN");
        }

        const device = await findDevice(sn);
        if (!device) {
            console.warn(`[AIData] Unregistered device: SN=${sn}`);
            return res.status(200).type("text/plain").send("ERROR: UNREGISTERED DEVICE");
        }

        // Activate pending devices on first contact
        const updateData = { last_sync: new Date() };
        if (device.status === "pending") {
            updateData.status = "active";
            console.log(`[AIData] Device ${sn} activated (was pending)`);
        }
        await device.update(updateData);

        // Respond with ADMS-compatible option header
        // The device reads "Stamp=9999" to know it should send ALL records
        const response = [
            `GET OPTION FROM: ${sn}`,
            `ATTLOGStamp=9999`,
            `OPERLOGStamp=9999`,
            `ATTPHOTOStamp=9999`,
            `ErrorDelay=30`,
            `Delay=10`,
            `TransTimes=00:00;14:05`,
            `TransInterval=1`,
            `TransFlag=TransData AttLog`,
            `Realtime=1`,
            `Encrypt=None`,
        ].join("\r\n");

        res.status(200).type("text/plain").set("Connection", "close").send(response);
    } catch (err) {
        console.error("[AIData] Handshake error:", err.message);
        res.status(200).type("text/plain").send("ERROR");
    }
};

// ─── Attendance Data Push — POST /AIData.aspx ────────────────────────────────

/**
 * Device pushes attendance records after handshake.
 * Body is tab-separated plain text, one record per line.
 * Format: PIN\tDateTime\tStatus\tVerify\tWorkCode\r\n
 */
exports.receiveData = async (req, res) => {
    try {
        const sn = req.query.SN || req.query.sn;
        const table = req.query.table || "ATTLOG";
        console.log(`[AIData] Data push from SN=${sn}, table=${table}`);

        if (!sn) {
            return res.status(200).type("text/plain").send("ERROR: NO SN");
        }

        const device = await findDevice(sn);
        if (!device) {
            console.warn(`[AIData] Unregistered device push: SN=${sn}`);
            return res.status(200).type("text/plain").send("ERROR: UNREGISTERED DEVICE");
        }

        // Activate if still pending
        if (device.status === "pending") {
            await device.update({ status: "active" });
        }

        // Only process attendance logs (ignore OPERLOG, ATTPHOTO, etc.)
        if (table !== "ATTLOG") {
            await device.update({ last_sync: new Date() });
            return res.status(200).type("text/plain").set("Connection", "close").send("OK");
        }

        const rawBody = req.body;
        if (!rawBody || typeof rawBody !== "string" || rawBody.trim() === "") {
            await device.update({ last_sync: new Date() });
            return res.status(200).type("text/plain").set("Connection", "close").send("OK");
        }

        console.log(`[AIData] Raw body from ${sn}:\n${rawBody}`);

        // Parse each attendance record line
        const lines = rawBody.split(/\r?\n/);
        let processed = 0;
        let failed = 0;

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;

            // Biomax AIData format: PIN<TAB>DateTime<TAB>Status<TAB>Verify<TAB>WorkCode
            // Some firmware variants use spaces instead of tabs — handle both
            const parts = line.includes("\t") ? line.split("\t") : line.split(/\s+/);
            if (parts.length < 2) {
                console.warn(`[AIData] Skipping malformed line: "${line}"`);
                failed++;
                continue;
            }

            const pin        = (parts[0] || "").trim();
            // DateTime can be "2026-08-20 10:30:45" (parts[1]) — already combined
            // OR split as "2026-08-20" (parts[1]) + "10:30:45" (parts[2])
            let dateTimeStr;
            let statusIdx;

            if (parts[1] && parts[1].includes(" ")) {
                // Combined: "2026-08-20 10:30:45"
                dateTimeStr = parts[1].trim();
                statusIdx   = 2;
            } else if (parts.length >= 3 && parts[2] && parts[2].includes(":")) {
                // Split: date in parts[1], time in parts[2]
                dateTimeStr = `${parts[1].trim()} ${parts[2].trim()}`;
                statusIdx   = 3;
            } else {
                dateTimeStr = parts[1].trim();
                statusIdx   = 2;
            }

            const statusCode = (parts[statusIdx]   || "0").trim();
            const verifyCode = (parts[statusIdx+1] || "1").trim();

            const punchDate = new Date(dateTimeStr);
            if (!pin || isNaN(punchDate.getTime())) {
                console.warn(`[AIData] Invalid record: pin="${pin}", datetime="${dateTimeStr}"`);
                failed++;
                continue;
            }

            const punchType    = resolvePunchType(statusCode);
            const verifyMethod = resolveVerifyMethod(verifyCode);

            try {
                const punch = await BiometricPunch.create({
                    institute_id:   device.institute_id,
                    device_id:      device.id,
                    device_user_id: pin,
                    punch_time:     punchDate,
                    punch_type:     punchType,
                    raw_payload: {
                        admsLine:    line,
                        protocol:    "BIOMAX_AIDATA",
                        verifyCode,
                        statusCode,
                        verifyMethod,
                    },
                    processed: false,
                });

                // Process in background — never block the device response
                setImmediate(async () => {
                    try {
                        await processPunch(punch);
                    } catch (e) {
                        console.error(`[AIData] Background process error for punch ${punch.id}:`, e.message);
                    }
                });

                processed++;
                console.log(`[AIData] ✅ Punch saved: PIN=${pin} | ${punchDate.toISOString()} | type=${punchType} | method=${verifyMethod}`);
            } catch (dbErr) {
                console.error(`[AIData] DB error saving punch for PIN=${pin}:`, dbErr.message);
                failed++;
            }
        }

        await device.update({ last_sync: new Date(), last_punch_at: new Date() });
        console.log(`[AIData] Push complete: ${processed} saved, ${failed} failed — SN=${sn}`);

        // CRITICAL: device expects exactly "OK" with Connection: close
        // If it doesn't get this, it will retry in an infinite loop
        res.status(200).type("text/plain").set("Connection", "close").send("OK");
    } catch (err) {
        console.error("[AIData] receiveData error:", err.message);
        res.status(200).type("text/plain").send("ERROR");
    }
};

// ─── Command Poll — GET /getrequest.aspx ─────────────────────────────────────

/**
 * Device polls for pending commands (e.g. delete user, sync time).
 * We have no commands to send — just update last_sync and reply with OK.
 */
exports.getRequest = async (req, res) => {
    try {
        const sn = req.query.SN || req.query.sn;
        if (sn) {
            const device = await BiometricDevice.findOne({ where: { device_serial: sn } });
            if (device) await device.update({ last_sync: new Date() });
        }
        res.status(200).type("text/plain").set("Connection", "close").send("OK");
    } catch (err) {
        res.status(200).type("text/plain").send("ERROR");
    }
};

// ─── Command Result — POST /devicecmd.aspx ───────────────────────────────────

/**
 * Device returns the result of a command we previously issued.
 * Currently a no-op — just acknowledge.
 */
exports.deviceCmd = async (req, res) => {
    res.status(200).type("text/plain").set("Connection", "close").send("OK");
};
