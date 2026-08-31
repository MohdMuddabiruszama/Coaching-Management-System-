const { BiometricDevice, BiometricPunch } = require("../models");
const { processPunch } = require("./biometric.controller");
const { Op } = require("sequelize");

/**
 * GET /iclock/cdata
 * Device Handshake / Registry
 */
exports.handshake = async (req, res) => {
    try {
        const sn = req.query.SN || req.query.sn;
        console.log(`[ADMS] 🤝 Handshake | SN=${sn} | IP=${req.ip}`);
        
        if (!sn) {
            console.warn(`[ADMS] ⚠️ Handshake missing SN query param`);
            return res.send("ERROR: NO SN");
        }

        const device = await BiometricDevice.findOne({ 
            where: { device_serial: sn, status: { [Op.not]: "inactive" } } 
        });
        
        if (!device) {
            console.warn(`[ADMS] ⚠️ Handshake from UNREGISTERED device: ${sn}`);
            return res.send("ERROR: UNREGISTERED DEVICE");
        }

        const updateData = { last_sync: new Date(), last_punch_at: new Date() };
        if (device.status === "pending") updateData.status = "active";
        await device.update(updateData);
        
        console.log(`[ADMS] ✅ Handshake OK — ${sn}`);
        res.setHeader("Content-Type", "text/plain");
        res.send("OK");
    } catch (err) {
        console.error("[ADMS] ❌ Handshake Error:", err);
        res.status(500).send("ERROR");
    }
};

/**
 * POST /iclock/cdata
 * Push Attendance Logs
 */
exports.receiveData = async (req, res) => {
    try {
        const sn = req.query.SN || req.query.sn;
        const rawData = req.body;
        console.log(`[ADMS] 📨 ReceiveData | SN=${sn} | CT=${req.headers["content-type"]} | body(${String(rawData||"").length}b)`);

        if (!sn) return res.send("ERROR: NO SN");
        const device = await BiometricDevice.findOne({ 
            where: { device_serial: sn, status: { [Op.not]: "inactive" } } 
        });
        if (!device) return res.send("ERROR: UNREGISTERED DEVICE");

        if (device.status === "pending") {
            await device.update({ status: "active", last_punch_at: new Date() });
        }

        // Instant Acknowledgment for minimum time complexity
        res.setHeader("Content-Type", "text/plain");
        res.send("OK");

        if (!rawData || typeof rawData !== 'string') {
            console.warn(`[ADMS] ⚠️ No raw string data found in request body`);
            return;
        }

        // Process entirely in background
        setImmediate(async () => {
            try {
                const lines = rawData.split(/\r?\n/);

                for (let line of lines) {
                    line = line.trim();
                    if (!line) continue;

                    const parts = line.split(/\s+/); 
                    if (parts.length < 3) continue; 

                    const pin = parts[0];
                    const dateStr = parts[1]; 
                    const timeStr = parts[2]; 
                    const status = parts.length > 3 ? parts[3] : "0";

                    const punchDate = new Date(`${dateStr} ${timeStr}`);
                    if (isNaN(punchDate.getTime())) continue;

                    let punchType = "in";
                    if (status === "1" || status === "out") punchType = "out";

                    // Save punch record
                    const punch = await BiometricPunch.create({
                        institute_id: device.institute_id,
                        device_id: device.id,
                        device_user_id: pin,
                        punch_time: punchDate,
                        punch_type: punchType,
                        raw_payload: { admsLine: line, protocol: "ADMS" },
                        processed: false,
                    });

                    // Process logic
                    await processPunch(punch);
                    console.log(`[ADMS] ✅ Punch saved: PIN=${pin} | ${punchDate.toISOString()} | ${punchType}`);
                }

                await device.update({ last_sync: new Date(), last_punch_at: new Date() });
            } catch(e) {
                console.error("[ADMS] ❌ Background Process Error:", e.message);
            }
        });

    } catch (err) {
        console.error("ADMS Receive Error:", err);
        if (!res.headersSent) {
            res.status(500).send("ERROR");
        }
    }
};

/**
 * GET /iclock/getrequest
 * Device polling for commands
 */
exports.getRequest = async (req, res) => {
    try {
        const sn = req.query.SN || req.query.sn;
        console.log(`[ADMS] 📡 GetRequest (heartbeat) | SN=${sn}`);
        if (sn) {
            const device = await BiometricDevice.findOne({ where: { device_serial: sn, status: { [Op.not]: "inactive" } } });
            if (device) await device.update({ last_sync: new Date(), last_punch_at: new Date() });
        }
        res.setHeader("Content-Type", "text/plain");
        res.send("OK");
    } catch (err) {
        console.error("[ADMS] ❌ GetRequest Error:", err);
        res.status(500).send("ERROR");
    }
};

/**
 * POST /iclock/devicecmd
 * Device returning command execution results
 */
exports.deviceCmd = async (req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.send("OK");
};
