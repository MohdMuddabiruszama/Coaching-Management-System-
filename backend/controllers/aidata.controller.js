/**
 * Biomax N-series Push Protocol Controller (AIData / ADMS)
 * ─────────────────────────────────────────────────────────────────────────────
 * Compatible devices: Biomax N-WL20, N300, N-MULTIBIO300, BM300W, and any
 * Biomax device using the HTTP AIData push protocol.
 *
 * The Biomax N-WL20 sends HTTP requests to /AIData.aspx (NOT /iclock/cdata).
 * No SDK is needed — the device pushes data natively over HTTP.
 *
 * Device ADMS Settings (set on the physical device screen):
 *   Server Address : <your-server-ip-or-domain>
 *   Server Port    : 80 (live) or 5000 (local dev)
 *   URL Path       : /AIData.aspx
 *   Enable Domain  : Yes (if using domain) / No (if using IP)
 *   Server Mode    : ADMS or Cloud
 *
 * The device sends TWO types of POST /AIData.aspx requests:
 *
 *  Type 1 — Face template upload (CT: application/json, ~82 KB):
 *    {"face":"AAQEAA...base64..."}
 *    → Sync face data. We just acknowledge with {"result":"ok"}.
 *
 *  Type 2 — Attendance punch (CT: application/json, ~105 B):
 *    {"doorMode":"open","inOut":"IN","ioMode":10,"time":"20260819185902",
 *     "userId":"9999","verifyMode":"Face"}
 *    → Real punch record. We save to BiometricPunch and process.
 *
 * The device does NOT include its SN in the JSON body.
 * SN is sent either as a request header or a query param, so we check both.
 * Biomax N-WL20 also sends a "token" header — we use this to identify the device.
 */

const { BiometricDevice, BiometricPunch } = require("../models");
const { processPunch } = require("./biometric.controller");
const { Op } = require("sequelize");
const socketUtils = require("../utils/socket");

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract Serial Number from all possible locations */
function extractSN(req) {
    return (
        req.query.SN              ||
        req.query.sn              ||
        req.headers["sn"]         ||
        req.headers["serial-number"] ||
        req.headers["x-device-sn"] ||
        null
    );
}

/**
 * Biomax N300 sends its device identity as:
 *   token: "6bbc2a31041675fdee2cc6ce5de6c91c"
 * This matches the device_token column in BiometricDevice.
 */
function extractToken(req) {
    return (
        req.headers["token"]           ||   // Biomax N300/N-WL20/BM300W
        req.headers["x-device-token"]  ||
        req.headers["authorization"]   ||
        req.query.token                ||
        null
    );
}

/** Parse Biomax time string "YYYYMMDDHHMMSS" → Date */
function parseBiomaxTime(timeStr) {
    if (!timeStr || timeStr.length < 14) return null;
    const iso = `${timeStr.slice(0,4)}-${timeStr.slice(4,6)}-${timeStr.slice(6,8)}` +
                `T${timeStr.slice(8,10)}:${timeStr.slice(10,12)}:${timeStr.slice(12,14)}`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
}

/** "IN"/"OUT" → "in"/"out" */
function resolveInOut(inOut) {
    return (inOut || "").toUpperCase() === "OUT" ? "out" : "in";
}

/** "Face"/"Fingerprint"/"Card"/"RFID" → normalised string */
function resolveVerifyMode(mode) {
    const m = (mode || "").toLowerCase();
    if (m.includes("face"))        return "face";
    if (m.includes("card") || m.includes("rfid")) return "rfid";
    return "fingerprint";
}

/**
 * Find device — priority order:
 *  1. device_token  (Biomax N-WL20/N300 sends "token" header)
 *  2. device_serial (ZKTeco/Biomax ADMS SN query param)
 *
 * Accepts any status EXCEPT "inactive" (admin-disabled).
 * This allows "connected", "offline", "pending", and "active" devices
 * to all receive and process pushes.
 */
async function findDevice(token, sn) {
    // 1. Match by device_token (Biomax JSON REST — N-WL20 sends this as header)
    if (token) {
        const d = await BiometricDevice.findOne({
            where: { device_token: token, status: { [Op.not]: "inactive" } }
        });
        if (d) { console.log(`[AIData] ✅ Device found by token → ${d.device_serial} (status: ${d.status})`); return d; }
        console.warn(`[AIData] ⚠️  No device matched token=${token} — check device_token in DB`);
    }
    // 2. Match by serial number (SN query param)
    if (sn) {
        const d = await BiometricDevice.findOne({
            where: { device_serial: sn, status: { [Op.not]: "inactive" } }
        });
        if (d) { console.log(`[AIData] ✅ Device found by SN → ${d.device_serial} (status: ${d.status})`); return d; }
        console.warn(`[AIData] ⚠️  No device matched SN=${sn} — is the device registered in Admin → Biometric → Devices?`);
    }

    console.warn(`[AIData] ❌ findDevice failed: token=${token}, sn=${sn}`);
    console.warn(`[AIData] 💡 Fix: Register the device in Admin Panel → Biometric → Connect Device → paste the serial number`);
    return null;
}

// ─── Handshake — GET /AIData.aspx ────────────────────────────────────────────

exports.handshake = async (req, res) => {
    try {
        const sn    = extractSN(req);
        const token = extractToken(req);
        console.log(`[AIData] 🤝 Handshake | SN=${sn} | token=${token} | IP=${req.ip} | UA=${req.headers["user-agent"]?.slice(0,60)}`);

        // Always respond OK — the device must get a response or it will keep retrying
        const ackText = sn
            ? [`GET OPTION FROM: ${sn}`, `ATTLOGStamp=9999`, `OPERLOGStamp=9999`, `Realtime=1`, `Encrypt=None`].join("\r\n")
            : "OK";

        // Try to find and update device — but don't block the response
        const device = await (async () => {
            if (token) {
                const d = await BiometricDevice.findOne({ where: { device_token: token, status: { [Op.not]: "inactive" } } });
                if (d) return d;
            }
            if (sn) {
                const d = await BiometricDevice.findOne({ where: { device_serial: sn, status: { [Op.not]: "inactive" } } });
                if (d) return d;
            }
            return null;
        })();

        if (device) {
            const upd = { last_sync: new Date(), last_punch_at: new Date() };
            if (device.status === "pending") upd.status = "active";
            await device.update(upd);
            console.log(`[AIData] ✅ Handshake OK — device "${device.device_name}" (${device.device_serial}) last_sync updated`);
        } else {
            console.warn(`[AIData] ⚠️  Handshake from UNREGISTERED device — SN=${sn}, token=${token}`);
            console.warn(`[AIData] 💡 Register it: Admin Panel → Biometric → Connect Device → serial: ${sn || "(unknown)"}`);
        }

        res.status(200).type("text/plain").set("Connection", "close").send(ackText);
    } catch (err) {
        console.error("[AIData] Handshake error:", err.message);
        res.status(200).type("text/plain").send("OK"); // Always ACK
    }
};

// ─── Data Push — POST /AIData.aspx ───────────────────────────────────────────

exports.receiveData = async (req, res) => {
    try {
        const sn    = extractSN(req);
        const token = extractToken(req);
        const ct    = (req.headers["content-type"] || "").toLowerCase();
        const rawBody = req.body || "";

        console.log(`[AIData] POST | token=${token} | SN=${sn} | CT=${ct}`);

        // ── JSON body (Biomax N-series REST protocol) ─────────────────────────
        if (ct.includes("application/json") || ct.includes("json")) {
            let json = {};
            try {
                json = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
            } catch {
                console.warn("[AIData] JSON parse failed, body:", String(rawBody).slice(0, 200));
                return res.status(200).json({ code: 0, message: "success", success: true, result: "ok", ret: "OK" });
            }

            // Type 1 — Face/Palm template sync (large base64 blob) → just ACK
            if (json.face || json.faceData || json.faceTemplate || json.palm) {
                console.log(`[AIData] Face/Palm template ACK — token=${token}`);
                return res.status(200).json({ result: "ok" });
            }

            // Door status heartbeat
            if (json.door_status) {
                return res.status(200).json({ code: 0, message: "success", success: true, result: "ok", ret: "OK" });
            }

            // Device Status Info (contains deviceId) — Auto-learn the token
            if (json.deviceId && token) {
                const d = await BiometricDevice.findOne({ where: { device_serial: json.deviceId } });
                if (d && d.device_token !== token) {
                    await d.update({ device_token: token });
                    console.log(`[AIData] Auto-updated token for device ${json.deviceId} to match incoming token.`);
                }
                // Send full ACK so device doesn't loop status continuously
                return res.status(200).json({ code: 0, message: "success", success: true, result: "ok", ret: "OK" });
            }

            // Type 2 — Attendance punch
            if (typeof json.userId !== "undefined" && json.time) {
                // IMMEDIATELY SEND ACKNOWLEDGMENT TO PREVENT DEVICE TIMEOUTS
                // Send full ACK format so Biomax device clears the punch from its buffer
                res.status(200).json({ code: 0, message: "success", success: true, result: "ok", ret: "OK" });

                // Process everything in the background
                setImmediate(async () => {
                    try {
                        const device = await findDevice(token, sn);
                        if (!device) {
                            console.warn(`[AIData] No device found — token=${token}, SN=${sn}. Is the device registered in admin dashboard?`);
                            return;
                        }

                        // Activate pending device on first punch
                        if (device.status === "pending") {
                            await device.update({ status: "connected" });
                        }

                        const punchDate   = parseBiomaxTime(json.time);
                        const punchType   = resolveInOut(json.inOut);
                        const verifyMethod = resolveVerifyMode(json.verifyMode);

                        if (!punchDate) {
                            console.warn(`[AIData] Bad time value: "${json.time}"`);
                            return;
                        }

                        // ─── Deduplication: skip if same punch already saved ─────────────
                        // Biomax retries the same punch if it thinks the ACK wasn't received.
                        // We prevent creating duplicate records for the same punch.
                        const existingPunch = await BiometricPunch.findOne({
                            where: {
                                device_id:      device.id,
                                device_user_id: String(json.userId),
                                punch_time:     punchDate,
                            },
                        });
                        if (existingPunch) {
                            // Update last_sync so device status stays "connected"
                            await device.update({ last_sync: new Date() });
                            console.log(`[AIData] ⏭️  Duplicate punch skipped (already saved): userId=${json.userId} | ${punchDate.toISOString()}`);
                            return;
                        }

                        const punch = await BiometricPunch.create({
                            institute_id:   device.institute_id,
                            device_id:      device.id,
                            device_user_id: String(json.userId),
                            punch_time:     punchDate,
                            punch_type:     punchType,
                            raw_payload: {
                                ...json,
                                protocol:    "BIOMAX_JSON_REST",
                                device_sn:   sn || device.device_serial,
                                verifyMethod,
                            },
                            processed: false,
                        });

                        try { await processPunch(punch); }
                        catch (e) { console.error(`[AIData] Background error:`, e.message); }

                        const statusUpdate = { last_sync: new Date(), last_punch_at: new Date() };
                        if (device.status === "pending") {
                            statusUpdate.status = "active";
                        }
                        await device.update(statusUpdate);

                        try {
                            const io = socketUtils.getIO?.();
                            if (io) {
                                io.to(`institute_${device.institute_id}`).emit("biometric:punch", {
                                    device_id: device.id,
                                    device_token: device.device_token,
                                    device_name: device.device_name,
                                    device_user_id: json.userId,
                                    punch_time: punchDate.toISOString(),
                                    punch_type: punchType,
                                    status_changed: null,
                                });
                            }
                        } catch (socketErr) {
                            console.warn("[AIData] Socket.io emit failed:", socketErr.message);
                        }

                        console.log(`[AIData] ✅ Punch saved: userId=${json.userId} | ${punchDate.toISOString()} | ${punchType} | ${verifyMethod} | device=${device.device_serial}`);
                    } catch (asyncErr) {
                        console.error("[AIData] Async processing error:", asyncErr.message);
                    }
                });

                return;
            }

            // Unknown JSON format — log and ACK
            console.log(`[AIData] Unknown JSON keys: ${Object.keys(json).join(", ")}`);
            return res.status(200).json({ code: 0, message: "success", success: true, result: "ok", ret: "OK" });
        }

        // ── Plain text body (legacy ADMS text protocol) ───────────────────────
        const textBody = typeof rawBody === "string" ? rawBody : rawBody.toString();
        if (!textBody || textBody.trim() === "") {
            return res.status(200).type("text/plain").set("Connection", "close").send("OK");
        }

        // Parse ADMS format: SN=xxx&table=ATTLOG\nPIN\tDateTime\tStatus\tVerify\n
        let adms_sn = sn, adms_table = req.query.table || "ATTLOG";
        let dataLines = [];
        const lines = textBody.split(/\r?\n/);
        const firstLine = lines[0].trim();

        if (!adms_sn && firstLine.includes("=") && !firstLine.includes("\t")) {
            try {
                const params = new URLSearchParams(firstLine);
                adms_sn    = params.get("SN") || adms_sn;
                adms_table = params.get("table") || adms_table;
                dataLines  = lines.slice(1).filter(l => l.trim());
            } catch { dataLines = lines.filter(l => l.trim()); }
        } else {
            dataLines = lines.filter(l => l.trim());
        }

        if (adms_table !== "ATTLOG" || dataLines.length === 0) {
            return res.status(200).type("text/plain").set("Connection", "close").send("OK");
        }

        const device = await findDevice(null, adms_sn);
        if (!device) {
            console.warn(`[AIData] ADMS: no device for SN=${adms_sn}`);
            return res.status(200).type("text/plain").set("Connection", "close").send("OK");
        }

        for (let line of dataLines) {
            line = line.trim();
            if (!line) continue;
            const parts = line.includes("\t") ? line.split("\t") : line.split(/\s+/);
            if (parts.length < 2) continue;

            const pin = parts[0].trim();
            let dateTimeStr, statusIdx;
            if (parts[1]?.includes(" ") && parts[1]?.includes("-")) {
                dateTimeStr = parts[1].trim(); statusIdx = 2;
            } else if (parts.length >= 3 && parts[2]?.includes(":")) {
                dateTimeStr = `${parts[1].trim()} ${parts[2].trim()}`; statusIdx = 3;
            } else {
                dateTimeStr = parts[1].trim(); statusIdx = 2;
            }

            const punchDate = new Date(dateTimeStr);
            if (!pin || isNaN(punchDate.getTime())) continue;

            const punch = await BiometricPunch.create({
                institute_id:   device.institute_id,
                device_id:      device.id,
                device_user_id: pin,
                punch_time:     punchDate,
                punch_type:     parseInt(parts[statusIdx] || "0") === 1 ? "out" : "in",
                raw_payload:    { admsLine: line, protocol: "BIOMAX_ADMS" },
                processed:      false,
            });
            setImmediate(async () => {
                try { await processPunch(punch); } catch(e) { console.error("[AIData] ADMS process error:", e.message); }
            });

            try {
                const io = socketUtils.getIO?.();
                if (io) {
                    io.to(`institute_${device.institute_id}`).emit("biometric:punch", {
                        device_id: device.id,
                        device_token: device.device_token,
                        device_name: device.device_name,
                        device_user_id: pin,
                        punch_time: punchDate.toISOString(),
                        punch_type: parseInt(parts[statusIdx] || "0") === 1 ? "out" : "in",
                        status_changed: null,
                    });
                }
            } catch (socketErr) {
                console.warn("[AIData] Socket.io emit failed:", socketErr.message);
            }

            console.log(`[AIData] ✅ ADMS punch: PIN=${pin} | ${punchDate.toISOString()}`);
        }

        const admsStatusUpdate = { last_sync: new Date() };
        if (device.status === "pending") admsStatusUpdate.status = "connected";
        await device.update(admsStatusUpdate);
        res.status(200).type("text/plain").set("Connection", "close").send("OK");

    } catch (err) {
        console.error("[AIData] receiveData fatal error:", err.message);
        res.status(200).json({ code: 0, message: "success", success: true, result: "ok", ret: "OK" }); // Always ACK so device doesn't loop
    }
};

// ─── Command Poll — GET /getrequest.aspx ─────────────────────────────────────

exports.getRequest = async (req, res) => {
    try {
        const sn    = extractSN(req);
        const token = extractToken(req);
        console.log(`[AIData] 📡 GetRequest (heartbeat) | SN=${sn} | token=${token}`);
        if (sn || token) {
            const where = sn
                ? { device_serial: sn, status: { [Op.not]: "inactive" } }
                : { device_token: token, status: { [Op.not]: "inactive" } };
            const device = await BiometricDevice.findOne({ where });
            if (device) {
                const statusUpdate = { last_sync: new Date(), last_punch_at: new Date() };
                if (device.status === "pending") statusUpdate.status = "active";
                await device.update(statusUpdate);
                console.log(`[AIData] ✅ Heartbeat updated for device "${device.device_name}"`);
            }
        }
        res.status(200).type("text/plain").set("Connection", "close").send("OK");
    } catch (err) {
        res.status(200).type("text/plain").send("ERROR");
    }
};

// ─── Command Result — POST /devicecmd.aspx ───────────────────────────────────

exports.deviceCmd = async (req, res) => {
    res.status(200).json({ code: 0, message: "success", success: true, result: "ok", ret: "OK" });
};
