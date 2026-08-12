const { BiometricDevice, BiometricPunch } = require("../models");
const { processPunch } = require("./biometric.controller");

/**
 * GET /iclock/cdata
 * Device Handshake / Registry
 */
exports.handshake = async (req, res) => {
    try {
        const sn = req.query.SN;
        if (!sn) return res.send("ERROR: NO SN");

        const device = await BiometricDevice.findOne({ where: { device_serial: sn, status: "active" } });
        if (!device) return res.send("ERROR: UNREGISTERED DEVICE");

        await device.update({ last_sync: new Date() });
        
        res.setHeader("Content-Type", "text/plain");
        res.send("OK");
    } catch (err) {
        console.error("ADMS Handshake Error:", err);
        res.status(500).send("ERROR");
    }
};

/**
 * POST /iclock/cdata
 * Push Attendance Logs
 */
exports.receiveData = async (req, res) => {
    try {
        const sn = req.query.SN;
        if (!sn) return res.send("ERROR: NO SN");

        const device = await BiometricDevice.findOne({ where: { device_serial: sn, status: "active" } });
        if (!device) return res.send("ERROR: UNREGISTERED DEVICE");

        const rawData = req.body;
        if (typeof rawData !== 'string') {
            return res.send("OK");
        }

        const lines = rawData.split('\n');

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

            // Process immediately in background
            setImmediate(async () => {
                try {
                    await processPunch(punch);
                } catch(e) {
                    console.error("❌ ADMS Background Process Error:", e.message);
                }
            });
        }

        await device.update({ last_sync: new Date() });

        res.setHeader("Content-Type", "text/plain");
        res.send("OK");
    } catch (err) {
        console.error("ADMS Receive Error:", err);
        res.status(500).send("ERROR");
    }
};

/**
 * GET /iclock/getrequest
 * Device polling for commands
 */
exports.getRequest = async (req, res) => {
    try {
        const sn = req.query.SN;
        if (sn) {
            const device = await BiometricDevice.findOne({ where: { device_serial: sn } });
            if (device) await device.update({ last_sync: new Date() });
        }
        res.setHeader("Content-Type", "text/plain");
        res.send("OK");
    } catch (err) {
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
