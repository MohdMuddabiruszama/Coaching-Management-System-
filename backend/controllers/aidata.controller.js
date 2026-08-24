/**
 * Biomax N-series Push Protocol Controller
 * ─────────────────────────────────────────────────────────────────────────────
 * The Biomax N300 (N-MULTIBIO300) sends TWO types of POST /AIData.aspx requests:
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
 *  1. device_token  (Biomax N300 sends token header)
 *  2. device_serial (ZKTeco ADMS protocol sends SN)
 *  3. Fallback: most recently synced active device
 */
async function findDevice(token, sn) {
    // 1. Match by device_token (Biomax JSON REST)
    if (token) {
        const d = await BiometricDevice.findOne({
            where: { device_token: token, status: { [Op.in]: ["active", "pending"] } }
        });
        if (d) { console.log(`[AIData] Device found by token → ${d.device_serial}`); return d; }
    }
    // 2. Match by serial number (ADMS text protocol)
    if (sn) {
        const d = await BiometricDevice.findOne({
            where: { device_serial: sn, status: { [Op.in]: ["active", "pending"] } }
        });
        if (d) { console.log(`[AIData] Device found by SN → ${d.device_serial}`); return d; }
    }
    // 3. Last resort — most recently synced active device
    const d = await BiometricDevice.findOne({
        where: { status: "active" },
        order: [["last_sync", "DESC"]]
    });
    if (d) { console.log(`[AIData] Device found by fallback → ${d.device_serial}`); }
    return d;
}

// ─── Handshake — GET /AIData.aspx ────────────────────────────────────────────

exports.handshake = async (req, res) => {
    try {
        const sn = extractSN(req);
        console.log(`[AIData] Handshake | SN=${sn} | headers=${JSON.stringify(req.headers)}`);

        if (!sn) {
            // Device did not send SN — still respond OK so it keeps pushing data
            return res.status(200).type("text/plain").set("Connection", "close").send("OK");
        }

        const device = await BiometricDevice.findOne({
            where: { device_serial: sn, status: { [Op.in]: ["active", "pending"] } }
        });

        if (!device) {
            console.warn(`[AIData] Unregistered device: SN=${sn}`);
            return res.status(200).type("text/plain").send("ERROR: UNREGISTERED DEVICE");
        }

        const upd = { last_sync: new Date() };
        if (device.status === "pending") { upd.status = "active"; }
        await device.update(upd);

        const reply = [
            `GET OPTION FROM: ${sn}`,
            `ATTLOGStamp=9999`,
            `OPERLOGStamp=9999`,
            `Realtime=1`,
            `Encrypt=None`,
        ].join("\r\n");

        res.status(200).type("text/plain").set("Connection", "close").send(reply);
    } catch (err) {
        console.error("[AIData] Handshake error:", err.message);
        res.status(200).type("text/plain").send("ERROR");
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
                return res.status(200).json({ result: "ok" });
            }

            // Type 1 — Face/Palm template sync (large base64 blob) → just ACK
            if (json.face || json.faceData || json.faceTemplate || json.palm) {
                console.log(`[AIData] Face/Palm template ACK — token=${token}`);
                return res.status(200).json({ result: "ok" });
            }

            // Door status heartbeat
            if (json.door_status) {
                return res.status(200).json({ result: "ok" });
            }

            // Type 2 — Attendance punch
            if (typeof json.userId !== "undefined" && json.time) {
                const device = await findDevice(token, sn);
                if (!device) {
                    console.warn(`[AIData] No device found — token=${token}, SN=${sn}. Is the device registered in admin dashboard?`);
                    return res.status(200).json({ result: "ok" });
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
                    return res.status(200).json({ result: "ok" });
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

                setImmediate(async () => {
                    try { await processPunch(punch); }
                    catch (e) { console.error(`[AIData] Background error:`, e.message); }
                });

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
                return res.status(200).json({ result: "ok" });
            }

            // Unknown JSON format — log and ACK
            console.log(`[AIData] Unknown JSON keys: ${Object.keys(json).join(", ")}`);
            return res.status(200).json({ result: "ok" });
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
        res.status(200).json({ result: "ok" }); // Always ACK so device doesn't loop
    }
};

// ─── Command Poll — GET /getrequest.aspx ─────────────────────────────────────

exports.getRequest = async (req, res) => {
    try {
        const sn = extractSN(req);
        if (sn) {
            const device = await BiometricDevice.findOne({ where: { device_serial: sn } });
            if (device) {
                const statusUpdate = { last_sync: new Date() };
                if (device.status === "pending") statusUpdate.status = "active";
                await device.update(statusUpdate);
            }
        }
        res.status(200).type("text/plain").set("Connection", "close").send("OK");
    } catch (err) {
        res.status(200).type("text/plain").send("ERROR");
    }
};

// ─── Command Result — POST /devicecmd.aspx ───────────────────────────────────

exports.deviceCmd = async (req, res) => {
    res.status(200).json({ result: "ok" });
};
